import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { createProject, createTask, deleteTask, getWorkspace, updateTask } from './api/workspaceApi.js'
import { FilterBar } from './components/FilterBar.jsx'
import { ProjectSidebar } from './components/ProjectSidebar.jsx'
import { SearchBar } from './components/SearchBar.jsx'
import { TaskBoard } from './components/TaskBoard.jsx'
import { TaskForm } from './components/TaskForm.jsx'

const statusOrder = ['Backlog', 'In Progress', 'Review', 'Done']

const defaultFilters = {
  search: '',
  status: 'All',
  priority: 'All',
}

function App() {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [filters, setFilters] = useState(defaultFilters)
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadWorkspace() {
      try {
        const data = await getWorkspace()

        if (!isMounted) {
          return
        }

        setProjects(data.projects)
        setTasks(data.tasks)
        setSelectedProjectId((currentProjectId) => currentProjectId || data.projects[0]?.id || '')
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

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0]
  const selectedProjectTasks = tasks.filter((task) => task.projectId === selectedProject?.id)

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

  const projectCounts = useMemo(() => {
    return tasks.reduce((counts, task) => {
      counts[task.projectId] = (counts[task.projectId] ?? 0) + 1
      return counts
    }, {})
  }, [tasks])

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

  async function handleTaskChange(taskId, updates) {
    const previousTasks = tasks

    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
    )

    try {
      const savedTask = await updateTask(taskId, updates)
      setTasks((currentTasks) => currentTasks.map((task) => (task.id === taskId ? savedTask : task)))
      setErrorMessage('')
    } catch (error) {
      setTasks(previousTasks)
      setErrorMessage(error.message)
    }
  }

  async function handleDeleteTask(taskId) {
    const previousTasks = tasks

    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId))

    try {
      await deleteTask(taskId)
      setErrorMessage('')
    } catch (error) {
      setTasks(previousTasks)
      setErrorMessage(error.message)
    }
  }

  function handleClearFilters() {
    setFilters(defaultFilters)
  }

  return (
    <div className="app-shell">
      <ProjectSidebar
        projects={projects}
        selectedProjectId={selectedProject?.id}
        taskCounts={projectCounts}
        onAddProject={handleAddProject}
        onSelectProject={setSelectedProjectId}
      />

      <main className="workspace" aria-labelledby="workspace-title">
        {errorMessage ? (
          <div className="notice" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <header className="workspace-header">
          <div>
            <p className="eyebrow">Scope</p>
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

        {isLoading ? (
          <section className="empty-state">
            <h2>Loading workspace</h2>
            <p>Fetching your projects and tasks from Cloudflare D1.</p>
          </section>
        ) : selectedProject ? (
          <>
            <section className="workspace-controls" aria-label="Task controls">
              <button
                type="button"
                className="primary-button"
                onClick={() => setIsTaskFormOpen((isOpen) => !isOpen)}
                aria-expanded={isTaskFormOpen}
                aria-controls="task-create-panel"
              >
                {isTaskFormOpen ? 'Close' : 'New task'}
              </button>

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
            </section>

            {isTaskFormOpen ? (
              <section id="task-create-panel" className="task-create-panel" aria-label="Create a task">
                <TaskForm
                  onAddTask={handleAddTask}
                  onCancel={() => setIsTaskFormOpen(false)}
                  statuses={statusOrder}
                />
              </section>
            ) : null}

            <TaskBoard
              filters={filters}
              onClearFilters={handleClearFilters}
              onDeleteTask={handleDeleteTask}
              onTaskChange={handleTaskChange}
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
    </div>
  )
}

export default App
