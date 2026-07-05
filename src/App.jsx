import { useMemo, useState } from 'react'
import './App.css'
import { FilterBar } from './components/FilterBar.jsx'
import { ProjectSidebar } from './components/ProjectSidebar.jsx'
import { TaskBoard } from './components/TaskBoard.jsx'
import { TaskForm } from './components/TaskForm.jsx'
import { sampleProjects, sampleTasks } from './data/sampleData.js'
import { useLocalStorage } from './hooks/useLocalStorage.js'

const statusOrder = ['Backlog', 'In Progress', 'Review', 'Done']

const defaultFilters = {
  search: '',
  status: 'All',
  priority: 'All',
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function App() {
  const [projects, setProjects] = useLocalStorage('scope.projects', sampleProjects)
  const [tasks, setTasks] = useLocalStorage('scope.tasks', sampleTasks)
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? '')
  const [filters, setFilters] = useState(defaultFilters)
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)

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

  function handleAddProject(name) {
    const nextProject = {
      id: makeId('project'),
      name,
      description: 'New project',
    }

    setProjects((currentProjects) => [...currentProjects, nextProject])
    setSelectedProjectId(nextProject.id)
  }

  function handleAddTask(taskInput) {
    const nextTask = {
      id: makeId('task'),
      projectId: selectedProject.id,
      title: taskInput.title,
      description: taskInput.description,
      status: taskInput.status,
      priority: taskInput.priority,
      dueDate: taskInput.dueDate,
      owner: taskInput.owner,
      createdAt: new Date().toISOString(),
    }

    setTasks((currentTasks) => [nextTask, ...currentTasks])
    setIsTaskFormOpen(false)
  }

  function handleTaskChange(taskId, updates) {
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
    )
  }

  function handleDeleteTask(taskId) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId))
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

        {selectedProject ? (
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
