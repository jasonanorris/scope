async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.error ?? 'Request failed.')
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export function getWorkspace() {
  return requestJson('/api/workspace')
}

export function createProject(project) {
  return requestJson('/api/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  })
}

export function createUser(user) {
  return requestJson('/api/users', {
    method: 'POST',
    body: JSON.stringify(user),
  })
}

export function updateProjectMembers(projectId, userIds) {
  return requestJson(`/api/projects/${projectId}/members`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  })
}

export function createTask(task) {
  return requestJson('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  })
}

export function updateTask(taskId, updates) {
  return requestJson(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export function deleteTask(taskId) {
  return requestJson(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  })
}
