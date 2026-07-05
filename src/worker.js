import { sampleProjects, sampleTasks } from './data/sampleData.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const allowedStatuses = new Set(['Backlog', 'In Progress', 'Review', 'Done'])
const allowedPriorities = new Set(['Low', 'Medium', 'High'])
let schemaReady

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init.headers ?? {}),
    },
  })
}

function error(message, status = 400) {
  return json({ error: message }, { status })
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`
}

function getUserId(request) {
  const identity = (
    request.headers.get('cf-access-authenticated-user-email') ??
    request.headers.get('cf-access-jwt-assertion') ??
    'local-development-user'
  )

  return identity.trim().toLowerCase()
}

function userSuffix(userId) {
  let hash = 0

  for (const character of userId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return hash.toString(36)
}

function toProject(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.user_id,
  }
}

function toTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    owner: row.owner,
    createdAt: row.created_at,
  }
}

function toUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
  }
}

function toProjectMember(row) {
  return {
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role,
  }
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL,
          priority TEXT NOT NULL,
          due_date TEXT NOT NULL DEFAULT '',
          owner TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS project_members (
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'member',
          created_at TEXT NOT NULL,
          PRIMARY KEY (project_id, user_id),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id)'),
    ]).catch((error) => {
      schemaReady = undefined
      throw error
    })
  }

  await schemaReady
}

function validateTaskInput(input) {
  if (!input?.projectId || !input?.title?.trim()) {
    return 'Project and title are required.'
  }

  if (!allowedStatuses.has(input.status)) {
    return 'Status is not valid.'
  }

  if (!allowedPriorities.has(input.priority)) {
    return 'Priority is not valid.'
  }

  return ''
}

async function ensureCurrentUser(db, userId) {
  const now = new Date().toISOString()
  const name = userId.includes('@') ? userId.split('@')[0] : 'Local user'

  await db
    .prepare(
      `INSERT INTO users (id, email, name, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at`,
    )
    .bind(userId, userId, name, userId, now, now)
    .run()
}

async function ensureOwnedProjectMemberships(db, userId) {
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at)
       SELECT id, ?, 'owner', ?
       FROM projects
       WHERE user_id = ?`,
    )
    .bind(userId, now, userId)
    .run()
}

async function ensureSampleData(db, userId) {
  await ensureCurrentUser(db, userId)

  const existing = await db
    .prepare('SELECT COUNT(*) AS count FROM projects WHERE user_id = ?')
    .bind(userId)
    .first()

  if (existing?.count > 0) {
    return
  }

  const suffix = userSuffix(userId)
  const now = new Date().toISOString()
  const projectIdMap = new Map()
  const statements = []

  for (const project of sampleProjects) {
    const id = `${project.id}-${suffix}`
    projectIdMap.set(project.id, id)
    statements.push(
      db
        .prepare(
          'INSERT INTO projects (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(id, userId, project.name, project.description, now, now),
    )
    statements.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
        )
        .bind(id, userId, 'owner', now),
    )
  }

  for (const task of sampleTasks) {
    statements.push(
      db
        .prepare(
          `INSERT INTO tasks (
            id, user_id, project_id, title, description, status, priority, due_date, owner, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `${task.id}-${suffix}`,
          userId,
          projectIdMap.get(task.projectId),
          task.title,
          task.description,
          task.status,
          task.priority,
          task.dueDate,
          task.owner,
          task.createdAt,
          now,
        ),
    )
  }

  await db.batch(statements)
}

async function loadWorkspace(db, userId) {
  await ensureCurrentUser(db, userId)
  await ensureSampleData(db, userId)
  await ensureOwnedProjectMemberships(db, userId)

  const [projectRows, taskRows, userRows, memberRows] = await Promise.all([
    db
      .prepare(
        `SELECT DISTINCT p.id, p.user_id, p.name, p.description, p.created_at
         FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.id
         WHERE p.user_id = ? OR pm.user_id = ?
         ORDER BY p.created_at ASC`,
      )
      .bind(userId, userId)
      .all(),
    db
      .prepare(
        `SELECT DISTINCT t.id, t.project_id, t.title, t.description, t.status, t.priority, t.due_date, t.owner, t.created_at
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         LEFT JOIN project_members pm ON pm.project_id = p.id
         WHERE p.user_id = ? OR pm.user_id = ?
         ORDER BY t.created_at DESC`,
      )
      .bind(userId, userId)
      .all(),
    db
      .prepare(
        `SELECT DISTINCT u.id, u.email, u.name
         FROM users u
         LEFT JOIN project_members pm ON pm.user_id = u.id
         LEFT JOIN projects p ON p.id = pm.project_id
         WHERE u.created_by = ? OR u.id = ? OR p.user_id = ? OR pm.project_id IN (
           SELECT project_id FROM project_members WHERE user_id = ?
         )
         ORDER BY u.name ASC, u.email ASC`,
      )
      .bind(userId, userId, userId, userId)
      .all(),
    db
      .prepare(
        `SELECT pm.project_id, pm.user_id, pm.role
         FROM project_members pm
         INNER JOIN projects p ON p.id = pm.project_id
         WHERE p.user_id = ? OR pm.project_id IN (
           SELECT project_id FROM project_members WHERE user_id = ?
         )`,
      )
      .bind(userId, userId)
      .all(),
  ])

  return {
    projects: projectRows.results.map(toProject),
    tasks: taskRows.results.map(toTask),
    users: userRows.results.map(toUser),
    projectMembers: memberRows.results.map(toProjectMember),
    currentUserId: userId,
  }
}

async function handleApi(request, env) {
  if (!env.DB) {
    return error('D1 binding DB is not configured.', 500)
  }

  await ensureSchema(env.DB)

  const userId = getUserId(request)
  const url = new URL(request.url)
  const method = request.method

  if (method === 'GET' && url.pathname === '/api/workspace') {
    return json(await loadWorkspace(env.DB, userId))
  }

  if (method === 'POST' && url.pathname === '/api/projects') {
    const input = await readJson(request)
    const name = input?.name?.trim()

    if (!name) {
      return error('Project name is required.')
    }

    const now = new Date().toISOString()
    const project = {
      id: createId('project'),
      name,
      description: input?.description?.trim() || 'New project',
    }

    await env.DB
      .prepare(
        'INSERT INTO projects (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(project.id, userId, project.name, project.description, now, now)
      .run()

    await env.DB
      .prepare(
        'INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
      )
      .bind(project.id, userId, 'owner', now)
      .run()

    return json(project, { status: 201 })
  }

  if (method === 'POST' && url.pathname === '/api/users') {
    const input = await readJson(request)
    const email = input?.email?.trim().toLowerCase()

    if (!email || !email.includes('@')) {
      return error('A valid user email is required.')
    }

    const now = new Date().toISOString()
    const name = input?.name?.trim() || email.split('@')[0]

    await env.DB
      .prepare(
        `INSERT INTO users (id, email, name, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, updated_at = excluded.updated_at`,
      )
      .bind(email, email, name, userId, now, now)
      .run()

    return json({ id: email, email, name }, { status: 201 })
  }

  const projectMembersMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/members$/)

  if (projectMembersMatch && method === 'PUT') {
    const projectId = projectMembersMatch[1]
    const input = await readJson(request)
    const project = await env.DB
      .prepare('SELECT id, user_id FROM projects WHERE id = ? AND user_id = ?')
      .bind(projectId, userId)
      .first()

    if (!project) {
      return error('Only the project owner can manage members.', 403)
    }

    const requestedUserIds = Array.isArray(input?.userIds) ? input.userIds : []
    const memberIds = [...new Set([...requestedUserIds, userId].map((id) => String(id).toLowerCase()))]
    const now = new Date().toISOString()

    if (memberIds.length > 0) {
      const placeholders = memberIds.map(() => '?').join(', ')
      const existingUsers = await env.DB
        .prepare(`SELECT id FROM users WHERE id IN (${placeholders})`)
        .bind(...memberIds)
        .all()
      const existingIds = new Set(existingUsers.results.map((user) => user.id))

      for (const memberId of memberIds) {
        if (!existingIds.has(memberId)) {
          return error(`User ${memberId} does not exist.`, 400)
        }
      }
    }

    await env.DB.prepare('DELETE FROM project_members WHERE project_id = ?').bind(projectId).run()
    await env.DB.batch(
      memberIds.map((memberId) =>
        env.DB
          .prepare(
            'INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
          )
          .bind(projectId, memberId, memberId === userId ? 'owner' : 'member', now),
      ),
    )

    const rows = await env.DB
      .prepare('SELECT project_id, user_id, role FROM project_members WHERE project_id = ? ORDER BY role DESC')
      .bind(projectId)
      .all()

    return json(rows.results.map(toProjectMember))
  }

  if (method === 'POST' && url.pathname === '/api/tasks') {
    const input = await readJson(request)
    const validationError = validateTaskInput(input)

    if (validationError) {
      return error(validationError)
    }

    const project = await env.DB
      .prepare(
        `SELECT p.id
         FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.id
         WHERE p.id = ? AND (p.user_id = ? OR pm.user_id = ?)`,
      )
      .bind(input.projectId, userId, userId)
      .first()

    if (!project) {
      return error('Project was not found.', 404)
    }

    const now = new Date().toISOString()
    const task = {
      id: createId('task'),
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate ?? '',
      owner: input.owner?.trim() ?? '',
      createdAt: now,
    }

    await env.DB
      .prepare(
        `INSERT INTO tasks (
          id, user_id, project_id, title, description, status, priority, due_date, owner, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        task.id,
        userId,
        task.projectId,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.dueDate,
        task.owner,
        task.createdAt,
        now,
      )
      .run()

    return json(task, { status: 201 })
  }

  const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/)

  if (taskMatch && method === 'PATCH') {
    const taskId = taskMatch[1]
    const input = await readJson(request)
    const current = await env.DB
      .prepare(
        `SELECT t.*
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         LEFT JOIN project_members pm ON pm.project_id = p.id
         WHERE t.id = ? AND (p.user_id = ? OR pm.user_id = ?)`,
      )
      .bind(taskId, userId, userId)
      .first()

    if (!current) {
      return error('Task was not found.', 404)
    }

    const updated = {
      title: input?.title?.trim() ?? current.title,
      description: input?.description?.trim() ?? current.description,
      status: input?.status ?? current.status,
      priority: input?.priority ?? current.priority,
      dueDate: input?.dueDate ?? current.due_date,
      owner: input?.owner?.trim() ?? current.owner,
    }

    if (!updated.title) {
      return error('Task title is required.')
    }

    if (!allowedStatuses.has(updated.status) || !allowedPriorities.has(updated.priority)) {
      return error('Task status or priority is not valid.')
    }

    await env.DB
      .prepare(
        `UPDATE tasks
         SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, owner = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        updated.title,
        updated.description,
        updated.status,
        updated.priority,
        updated.dueDate,
        updated.owner,
        new Date().toISOString(),
        taskId,
      )
      .run()

    return json({
      id: current.id,
      projectId: current.project_id,
      ...updated,
      createdAt: current.created_at,
    })
  }

  if (taskMatch && method === 'DELETE') {
    await env.DB
      .prepare(
        `DELETE FROM tasks
         WHERE id = ? AND project_id IN (
           SELECT p.id
           FROM projects p
           LEFT JOIN project_members pm ON pm.project_id = p.id
           WHERE p.user_id = ? OR pm.user_id = ?
         )`,
      )
      .bind(taskMatch[1], userId, userId)
      .run()
    return new Response(null, { status: 204 })
  }

  return error('API route not found.', 404)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env)
    }

    return env.ASSETS.fetch(request)
  },
}
