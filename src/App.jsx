import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  createProject,
  createTask,
  createUser,
  getWorkspace,
  updateProjectMembers,
  updateTask,
  updateUser,
} from './api/workspaceApi.js'
import { FilterBar } from './components/FilterBar.jsx'
import { ProjectSidebar } from './components/ProjectSidebar.jsx'
import { SearchBar } from './components/SearchBar.jsx'
import { TaskBoard } from './components/TaskBoard.jsx'
import { TaskDetailPage } from './components/TaskDetailPage.jsx'
import { TaskForm } from './components/TaskForm.jsx'
import { UserManagement } from './components/UserManagement.jsx'

const statusOrder = ['Backlog', 'In Progress', 'Review', 'Done']

const defaultFilters = {
  search: '',
  status: 'All',
  priority: 'All',
}

function sameId(left, right) {
  return String(left) === String(right)
}

function getTaskIdFromUrl() {
  return new URLSearchParams(window.location.search).get('task') ?? ''
}

function updateTaskUrl(taskId) {
  const url = new URL(window.location.href)

  if (taskId) {
    url.searchParams.set('task', taskId)
  } else {
    url.searchParams.delete('task')
  }

  window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function App() {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [projectMembers, setProjectMembers] = useState([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserType, setCurrentUserType] = useState('standard')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [filters, setFilters] = useState(defaultFilters)
  const [selectedTaskId, setSelectedTaskId] = useState(() => getTaskIdFromUrl())
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadWorkspace() {
      try {
        const data = await getWorkspace()
        const urlTaskId = getTaskIdFromUrl()
        const linkedTask = data.tasks.find((task) => sameId(task.id, urlTaskId))

        if (!isMounted) {
          return
        }

        setProjects(data.projects)
        setTasks(data.tasks)
        setUsers(data.users ?? [])
        setProjectMembers(data.projectMembers ?? [])
        setCurrentUserId(data.currentUserId ?? '')
        setCurrentUserType(data.currentUserType ?? 'standard')
        setSelectedProjectId(
          (currentProjectId) => currentProjectId || linkedTask?.projectId || data.projects[0]?.id || '',
        )
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadWorkspace()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    function handlePopState() {
      const taskId = getTaskIdFromUrl()
      setSelectedTaskId(taskId)

      const linkedTask = tasks.find((task) => sameId(task.id, taskId))
      if (linkedTask) {
        setSelectedProjectId(linkedTask.projectId)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [tasks])

  useEffect(() => {
    if (!isTaskFormOpen && !isUsersModalOpen) {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsTaskFormOpen(false)
        setIsUsersModalOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isTaskFormOpen, isUsersModalOpen])

  const selectedProject = projects.find((project) => sameId(project.id, selectedProjectId)) ?? projects[0]
  const selectedTask = tasks.find((task) => sameId(task.id, selectedTaskId))
  const selectedTaskProject = projects.find((project) => sameId(project.id, selectedTask?.projectId))
  const selectedProjectTasks = tasks.filter((task) => sameId(task.projectId, selectedProject?.id))
  const selectedProjectMembers = projectMembers.filter(
    (member) => sameId(member.projectId, selectedProject?.id),
  )
  const canManageSelectedProjectUsers =
    currentUserType === 'admin' ||
    (currentUserType === 'manager' &&
      selectedProjectMembers.some((member) => sameId(member.userId, currentUserId))) ||
    (currentUserType === 'manager' && sameId(selectedProject?.ownerId, currentUserId))

  const visibleTasks = useMemo(() => {
    const search = filters.search.trim().toLowerCase()

    return selectedProjectTasks.filter((task) => {
      const matchesSearch =
        search.length === 0 ||
        task.title.toLowerCase().includes(search) ||
        task.description.toLowerCase().includes(search)
      const matchesStatus = filters.status === 'All' || task.status === filters.status
      const matchesPriority = filters.priority === 'All' || task.priority === filters.priority

      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [filters, selectedProjectTasks])

  async function handleAddProject(name) {
    try {
      const nextProject = await createProject({
        name,
        description: 'New project',
      })

      setProjects((currentProjects) => [...currentProjects, nextProject])
      setSelectedProjectId(nextProject.id)
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  async function handleAddTask(taskInput) {
    try {
      const nextTask = await createTask({
        projectId: selectedProject.id,
        title: taskInput.title,
        description: taskInput.description,
        status: taskInput.status,
        priority: taskInput.priority,
        dueDate: taskInput.dueDate,
        owner: taskInput.owner,
      })

      setTasks((currentTasks) => [nextTask, ...currentTasks])
      setIsTaskFormOpen(false)
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  async function handleAddUser(userInput) {
    try {
      const savedUser = await createUser(userInput)
      setUsers((currentUsers) => {
        const exists = currentUsers.some((user) => sameId(user.id, savedUser.id))
        return exists
          ? currentUsers.map((user) => (sameId(user.id, savedUser.id) ? savedUser : user))
          : [...currentUsers, savedUser]
      })
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  async function handleUpdateProjectMembers(userIds) {
    if (!selectedProject) {
      return
    }

    const previousMembers = projectMembers
    const nextMembers = userIds.map((userId) => ({
      projectId: selectedProject.id,
      userId,
      role: sameId(userId, currentUserId) ? 'owner' : 'member',
    }))

    setProjectMembers((currentMembers) => [
      ...currentMembers.filter((member) => !sameId(member.projectId, selectedProject.id)),
      ...nextMembers,
    ])

    try {
      const savedMembers = await updateProjectMembers(selectedProject.id, userIds)
      setProjectMembers((currentMembers) => [
        ...currentMembers.filter((member) => !sameId(member.projectId, selectedProject.id)),
        ...savedMembers,
      ])
      setErrorMessage('')
    } catch (error) {
      setProjectMembers(previousMembers)
      setErrorMessage(error.message)
    }
  }

  async function handleUpdateUserType(userId, type) {
    const previousUsers = users

    setUsers((currentUsers) =>
      currentUsers.map((user) => (sameId(user.id, userId) ? { ...user, type } : user)),
    )

    try {
      const savedUser = await updateUser(userId, { type })
      setUsers((currentUsers) => currentUsers.map((user) => (sameId(user.id, userId) ? savedUser : user)))
      setErrorMessage('')
    } catch (error) {
      setUsers(previousUsers)
      setErrorMessage(error.message)
    }
  }

  async function handleTaskChange(taskId, updates) {
    const previousTasks = tasks

    setTasks((currentTasks) =>
      currentTasks.map((task) => (sameId(task.id, taskId) ? { ...task, ...updates } : task)),
    )

    try {
      const savedTask = await updateTask(taskId, updates)
      setTasks((currentTasks) => currentTasks.map((task) => (sameId(task.id, taskId) ? savedTask : task)))
      setErrorMessage('')
    } catch (error) {
      setTasks(previousTasks)
      setErrorMessage(error.message)
      throw error
    }
  }

  function handleClearFilters() {
    setFilters(defaultFilters)
  }

  function handleSelectProject(projectId) {
    setSelectedProjectId(projectId)
    setSelectedTaskId('')
    updateTaskUrl('')
  }

  function handleOpenTask(task) {
    setSelectedTaskId(task.id)
    setSelectedProjectId(task.projectId)
    updateTaskUrl(task.id)
  }

  function handleCloseTask() {
    setSelectedTaskId('')
    updateTaskUrl('')
  }

  return (
    <div className="app-shell">
      <ProjectSidebar
        canManageUsers={currentUserType !== 'standard'}
        isUsersModalOpen={isUsersModalOpen}
        onAddProject={handleAddProject}
        onHome={handleCloseTask}
        onOpenUsers={() => setIsUsersModalOpen(true)}
        onSelectProject={handleSelectProject}
        projects={projects}
        selectedProjectId={selectedProject?.id}
      />

      <main className="workspace" aria-labelledby={selectedTaskId ? 'task-detail-title' : 'workspace-title'}>
        {errorMessage ? (
          <div className="notice" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {!selectedTaskId ? (
          <header className="workspace-header">
            <div>
              <span className="header-accent" aria-hidden="true" />
              <h1 id="workspace-title">{selectedProject?.name ?? 'Projects'}</h1>
              <p className="workspace-summary">
                {selectedProject?.description ?? 'Create a project to begin tracking work.'}
              </p>
            </div>
            <div className="summary-strip" aria-label="Project summary">
              <span>
                <strong>{selectedProjectTasks.length}</strong>
                Tasks
              </span>
              <span>
                <strong>{selectedProjectTasks.filter((task) => task.status !== 'Done').length}</strong>
                Open
              </span>
              <span>
                <strong>{selectedProjectTasks.filter((task) => task.priority === 'High').length}</strong>
                High priority
              </span>
            </div>
          </header>
        ) : null}

        {isLoading ? (
          <section className="empty-state">
            <h2>Loading workspace</h2>
            <p>Fetching your projects and tasks from Cloudflare D1.</p>
          </section>
        ) : selectedTaskId ? (
          selectedTask ? (
            <TaskDetailPage
              onBack={handleCloseTask}
              onSave={handleTaskChange}
              project={selectedTaskProject}
              statuses={statusOrder}
              task={selectedTask}
            />
          ) : (
            <section className="empty-state">
              <h2>Task not found</h2>
              <p>This task may have been moved or removed.</p>
              <button type="button" onClick={handleCloseTask}>
                Back to board
              </button>
            </section>
          )
        ) : selectedProject ? (
          <>
            <section className="workspace-controls" aria-label="Task controls">
              <button
                type="button"
                className="primary-button"
                onClick={() => setIsTaskFormOpen(true)}
                aria-expanded={isTaskFormOpen}
                aria-controls="task-create-dialog"
              >
                New task
              </button>

              <div className="control-group">
                <SearchBar
                  value={filters.search}
                  onChange={(search) => setFilters((currentFilters) => ({ ...currentFilters, search }))}
                />

                <FilterBar
                  filters={filters}
                  onChange={setFilters}
                  onClear={handleClearFilters}
                  statuses={statusOrder}
                />
              </div>

            </section>

            <TaskBoard
              filters={filters}
              onClearFilters={handleClearFilters}
              onOpenTask={handleOpenTask}
              statuses={statusOrder}
              tasks={visibleTasks}
            />
          </>
        ) : (
          <section className="empty-state">
            <h2>No projects yet</h2>
            <p>Add a project from the sidebar to start organizing tasks.</p>
          </section>
        )}
      </main>

      {isTaskFormOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsTaskFormOpen(false)
            }
          }}
        >
          <section
            id="task-create-dialog"
            className="task-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">Create</p>
                <h2 id="task-modal-title">New task</h2>
              </div>
              <button type="button" onClick={() => setIsTaskFormOpen(false)} aria-label="Close new task">
                ×
              </button>
            </header>
            <TaskForm
              onAddTask={handleAddTask}
              onCancel={() => setIsTaskFormOpen(false)}
              statuses={statusOrder}
            />
          </section>
        </div>
      ) : null}

      {isUsersModalOpen && selectedProject ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsUsersModalOpen(false)
            }
          }}
        >
          <section
            id="users-dialog"
            className="task-modal user-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-modal-title"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">Manage</p>
                <h2 id="users-modal-title">Users</h2>
              </div>
              <button type="button" onClick={() => setIsUsersModalOpen(false)} aria-label="Close users">
                ×
              </button>
            </header>
            <UserManagement
              canManageProjectUsers={canManageSelectedProjectUsers}
              currentUserId={currentUserId}
              currentUserType={currentUserType}
              members={selectedProjectMembers}
              onAddUser={handleAddUser}
              onUpdateMembers={handleUpdateProjectMembers}
              onUpdateUserType={handleUpdateUserType}
              selectedProject={selectedProject}
              users={users}
            />
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
