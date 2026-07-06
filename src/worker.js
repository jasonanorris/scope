import { sampleProjects, sampleTasks } from './data/sampleData.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const allowedStatuses = new Set(['Backlog', 'In Progress', 'Review', 'Done'])
const allowedPriorities = new Set(['Low', 'Medium', 'High'])
const allowedUserTypes = new Set(['standard', 'manager', 'admin'])
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

function getUserEmail(request) {
  const identity = (
    request.headers.get('cf-access-authenticated-user-email') ??
    request.headers.get('cf-access-jwt-assertion') ??
    'local-development-user'
  )

  return identity.trim().toLowerCase()
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
    title: row.title ?? '',
    type: row.type ?? 'standard',
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

function bindAll(statement, bindings) {
  return bindings.length > 0 ? statement.bind(...bindings).all() : statement.all()
}

async function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          type TEXT NOT NULL DEFAULT 'standard',
          created_by INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          project_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL,
          priority TEXT NOT NULL,
          due_date TEXT NOT NULL DEFAULT '',
          owner TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS project_members (
          project_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
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

  await db.prepare("ALTER TABLE users ADD COLUMN type TEXT NOT NULL DEFAULT 'standard'").run().catch(() => {})
  await db.prepare("ALTER TABLE users ADD COLUMN title TEXT NOT NULL DEFAULT ''").run().catch(() => {})
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_users_type ON users(type)').run()
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

async function ensureCurrentUser(db, email) {
  const now = new Date().toISOString()
  const name = email.includes('@') ? email.split('@')[0] : 'Local user'
  const existing = await db.prepare('SELECT id FROM users LIMIT 1').first()
  const type = existing ? 'standard' : 'admin'

  await db
    .prepare(
      `INSERT INTO users (email, name, title, type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET updated_at = excluded.updated_at`,
    )
    .bind(email, name, '', type, now, now)
    .run()

  const currentUser = await getCurrentUser(db, email)

  if (currentUser && currentUser.created_by === null) {
    await db
      .prepare('UPDATE users SET created_by = ?, updated_at = ? WHERE id = ?')
      .bind(currentUser.id, now, currentUser.id)
      .run()
  }

  return getCurrentUser(db, email)
}

async function getCurrentUser(db, email) {
  return db
    .prepare('SELECT id, email, name, title, type, created_by FROM users WHERE email = ?')
    .bind(email)
    .first()
}

async function ensureOwnedProjectMemberships(db, currentUserId) {
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at)
       SELECT id, ?, 'owner', ?
       FROM projects
       WHERE user_id = ?`,
    )
    .bind(currentUserId, now, currentUserId)
    .run()
}

async function ensureSampleData(db, currentUser) {
  const currentUserId = currentUser.id

  const existing = await db
    .prepare('SELECT COUNT(*) AS count FROM projects WHERE user_id = ?')
    .bind(currentUserId)
    .first()

  if (existing?.count > 0) {
    return
  }

  const now = new Date().toISOString()
  const projectIdMap = new Map()
  const statements = []

  for (const project of sampleProjects) {
    const result = await db
      .prepare('INSERT INTO projects (user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(currentUserId, project.name, project.description, now, now)
      .run()
    const projectId = result.meta.last_row_id
    projectIdMap.set(project.id, projectId)
    statements.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
        )
        .bind(projectId, currentUserId, 'owner', now),
    )
  }

  for (const task of sampleTasks) {
    statements.push(
      db
        .prepare(
          `INSERT INTO tasks (
            user_id, project_id, title, description, status, priority, due_date, owner, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          currentUserId,
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

async function loadWorkspace(db, userEmail) {
  const currentUser = await ensureCurrentUser(db, userEmail)
  await ensureSampleData(db, currentUser)
  await ensureOwnedProjectMemberships(db, currentUser.id)
  const isAdmin = currentUser?.type === 'admin'
  const projectScope = isAdmin ? '1 = 1' : '(p.user_id = ? OR pm.user_id = ?)'
  const projectBindings = isAdmin ? [] : [currentUser.id, currentUser.id]
  const taskBindings = isAdmin ? [] : [currentUser.id, currentUser.id]
  const userBindings = isAdmin
    ? []
    : [currentUser.id, currentUser.id, currentUser.id, currentUser.id]
  const memberBindings = isAdmin ? [] : [currentUser.id, currentUser.id]

  const [projectRows, taskRows, userRows, memberRows] = await Promise.all([
    bindAll(
      db
      .prepare(
        `SELECT DISTINCT p.id, p.user_id, p.name, p.description, p.created_at
         FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.id
         WHERE ${projectScope}
         ORDER BY p.created_at ASC`,
      ),
      projectBindings,
    ),
    bindAll(
      db
      .prepare(
        `SELECT DISTINCT t.id, t.project_id, t.title, t.description, t.status, t.priority, t.due_date, t.owner, t.created_at
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         LEFT JOIN project_members pm ON pm.project_id = p.id
         WHERE ${projectScope}
         ORDER BY t.created_at DESC`,
      ),
      taskBindings,
    ),
    bindAll(
      db
      .prepare(
        `SELECT DISTINCT u.id, u.email, u.name, u.title, u.type
         FROM users u
         LEFT JOIN project_members pm ON pm.user_id = u.id
         LEFT JOIN projects p ON p.id = pm.project_id
         WHERE ${
           isAdmin
             ? '1 = 1'
             : `u.created_by = ? OR u.id = ? OR p.user_id = ? OR pm.project_id IN (
           SELECT project_id FROM project_members WHERE user_id = ?
         )`
         }
         ORDER BY u.name ASC, u.email ASC`,
      ),
      userBindings,
    ),
    bindAll(
      db
      .prepare(
        `SELECT pm.project_id, pm.user_id, pm.role
         FROM project_members pm
         INNER JOIN projects p ON p.id = pm.project_id
         WHERE ${
           isAdmin
             ? '1 = 1'
             : `p.user_id = ? OR pm.project_id IN (
           SELECT project_id FROM project_members WHERE user_id = ?
         )`
         }`,
      ),
      memberBindings,
    ),
  ])

  return {
    projects: projectRows.results.map(toProject),
    tasks: taskRows.results.map(toTask),
    users: userRows.results.map(toUser),
    projectMembers: memberRows.results.map(toProjectMember),
    currentUserId: currentUser.id,
    currentUserType: currentUser?.type ?? 'standard',
  }
}

async function handleApi(request, env) {
  if (!env.DB) {
    return error('D1 binding DB is not configured.', 500)
  }

  await ensureSchema(env.DB)

  const userEmail = getUserEmail(request)
  const url = new URL(request.url)
  const method = request.method

  if (method === 'GET' && url.pathname === '/api/workspace') {
    return json(await loadWorkspace(env.DB, userEmail))
  }

  if (method === 'POST' && url.pathname === '/api/projects') {
    const currentUser = await ensureCurrentUser(env.DB, userEmail)
    const input = await readJson(request)
    const name = input?.name?.trim()

    if (!name) {
      return error('Project name is required.')
    }

    const now = new Date().toISOString()
    const project = {
      name,
      description: input?.description?.trim() || 'New project',
    }

    const result = await env.DB
      .prepare('INSERT INTO projects (user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(currentUser.id, project.name, project.description, now, now)
      .run()

    project.id = result.meta.last_row_id

    await env.DB
      .prepare(
        'INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
      )
      .bind(project.id, currentUser.id, 'owner', now)
      .run()

    return json(project, { status: 201 })
  }

  if (method === 'POST' && url.pathname === '/api/users') {
    const currentUser = await ensureCurrentUser(env.DB, userEmail)

    if (!['admin', 'manager'].includes(currentUser?.type)) {
      return error('Only admins and managers can create users.', 403)
    }

    const input = await readJson(request)
    const email = input?.email?.trim().toLowerCase()

    if (!email || !email.includes('@')) {
      return error('A valid user email is required.')
    }

    const now = new Date().toISOString()
    const name = input?.name?.trim() || email.split('@')[0]
    const title = input?.title?.trim() ?? ''
    const requestedType = input?.type ?? 'standard'
    const type = currentUser.type === 'admin' && allowedUserTypes.has(requestedType) ? requestedType : 'standard'

    await env.DB
      .prepare(
        `INSERT INTO users (email, name, title, type, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET name = excluded.name, title = excluded.title, type = excluded.type, updated_at = excluded.updated_at`,
      )
      .bind(email, name, title, type, currentUser.id, now, now)
      .run()

    const savedUser = await env.DB
      .prepare('SELECT id, email, name, title, type FROM users WHERE email = ?')
      .bind(email)
      .first()

    return json(toUser(savedUser), { status: 201 })
  }

  const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/)

  if (userMatch && method === 'PATCH') {
    const currentUser = await ensureCurrentUser(env.DB, userEmail)

    if (currentUser?.type !== 'admin') {
      return error('Only admins can change user types.', 403)
    }

    const targetUserId = Number(decodeURIComponent(userMatch[1]))

    if (!Number.isInteger(targetUserId)) {
      return error('User id is not valid.')
    }

    const input = await readJson(request)
    const nextType = input?.type
    const nextTitle = typeof input?.title === 'string' ? input.title.trim() : undefined

    if (nextType !== undefined && !allowedUserTypes.has(nextType)) {
      return error('User type is not valid.')
    }

    if (nextType !== undefined) {
      await env.DB
        .prepare('UPDATE users SET type = ?, updated_at = ? WHERE id = ?')
        .bind(nextType, new Date().toISOString(), targetUserId)
        .run()
    }

    if (nextTitle !== undefined) {
      await env.DB
        .prepare('UPDATE users SET title = ?, updated_at = ? WHERE id = ?')
        .bind(nextTitle, new Date().toISOString(), targetUserId)
        .run()
    }

    const user = await env.DB
      .prepare('SELECT id, email, name, title, type FROM users WHERE id = ?')
      .bind(targetUserId)
      .first()

    if (!user) {
      return error('User was not found.', 404)
    }

    return json(toUser(user))
  }

  const projectMembersMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/members$/)

  if (projectMembersMatch && method === 'PUT') {
    const projectId = Number(projectMembersMatch[1])

    if (!Number.isInteger(projectId)) {
      return error('Project id is not valid.')
    }

    const input = await readJson(request)
    const currentUser = await ensureCurrentUser(env.DB, userEmail)

    if (!['admin', 'manager'].includes(currentUser?.type)) {
      return error('Only admins and managers can manage project users.', 403)
    }

    const project = await env.DB
      .prepare(
        `SELECT DISTINCT p.id, p.user_id
         FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.id
         WHERE p.id = ? AND (? = 'admin' OR p.user_id = ? OR pm.user_id = ?)`,
      )
      .bind(projectId, currentUser.type, currentUser.id, currentUser.id)
      .first()

    if (!project) {
      return error('You do not have permission to manage this project.', 403)
    }

    const requestedUserIds = Array.isArray(input?.userIds) ? input.userIds : []
    const memberIds = [
      ...new Set([...requestedUserIds, project.user_id].map((id) => Number(id)).filter(Number.isInteger)),
    ]
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
          .bind(projectId, memberId, memberId === project.user_id ? 'owner' : 'member', now),
      ),
    )

    const rows = await env.DB
      .prepare('SELECT project_id, user_id, role FROM project_members WHERE project_id = ? ORDER BY role DESC')
      .bind(projectId)
      .all()

    return json(rows.results.map(toProjectMember))
  }

  if (method === 'POST' && url.pathname === '/api/tasks') {
    const currentUser = await ensureCurrentUser(env.DB, userEmail)
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
      .bind(input.projectId, currentUser.id, currentUser.id)
      .first()

    if (!project) {
      return error('Project was not found.', 404)
    }

    const now = new Date().toISOString()
    const task = {
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate ?? '',
      owner: input.owner?.trim() ?? '',
      createdAt: now,
    }

    const result = await env.DB
      .prepare(
        `INSERT INTO tasks (
          user_id, project_id, title, description, status, priority, due_date, owner, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        currentUser.id,
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

    task.id = result.meta.last_row_id

    return json(task, { status: 201 })
  }

  const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/)

  if (taskMatch && method === 'PATCH') {
    const currentUser = await ensureCurrentUser(env.DB, userEmail)
    const taskId = Number(taskMatch[1])

    if (!Number.isInteger(taskId)) {
      return error('Task id is not valid.')
    }

    const input = await readJson(request)
    const current = await env.DB
      .prepare(
        `SELECT t.*
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         LEFT JOIN project_members pm ON pm.project_id = p.id
         WHERE t.id = ? AND (p.user_id = ? OR pm.user_id = ?)`,
      )
      .bind(taskId, currentUser.id, currentUser.id)
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
    const currentUser = await ensureCurrentUser(env.DB, userEmail)
    const taskId = Number(taskMatch[1])

    if (!Number.isInteger(taskId)) {
      return error('Task id is not valid.')
    }

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
      .bind(taskId, currentUser.id, currentUser.id)
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
