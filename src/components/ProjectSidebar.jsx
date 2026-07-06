import { useState } from 'react'

export function ProjectSidebar({
  canManageUsers,
  isUsersModalOpen,
  onAddProject,
  onHome,
  onOpenUsers,
  onSelectProject,
  projects,
  selectedProjectId,
}) {
  const [projectName, setProjectName] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const name = projectName.trim()

    if (!name) {
      return
    }

    onAddProject(name)
    setProjectName('')
  }

  return (
    <aside className="project-sidebar" aria-label="Projects">
      <div className="brand-lockup">
        <div>
          <button className="brand-home" type="button" onClick={onHome}>
            Scope
          </button>
          <span>Project Management</span>
        </div>
      </div>

      <nav className="project-nav" aria-label="Project list">
        <div className="section-heading">
          <h2>Projects</h2>
        </div>
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                className={
                  String(project.id) === String(selectedProjectId) ? 'project-link active' : 'project-link'
                }
                onClick={() => onSelectProject(project.id)}
                aria-current={String(project.id) === String(selectedProjectId) ? 'page' : undefined}
              >
                <span>
                  <strong>{project.name}</strong>
                  <small>{project.description}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {canManageUsers ? (
        <div className="sidebar-actions" aria-label="Workspace actions">
          <button
            type="button"
            onClick={onOpenUsers}
            aria-expanded={isUsersModalOpen}
            aria-controls="users-dialog"
          >
            Users
          </button>
        </div>
      ) : null}

      <form className="compact-form" onSubmit={handleSubmit}>
        <label htmlFor="project-name">New project</label>
        <div>
          <input
            id="project-name"
            type="text"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Project name"
          />
          <button type="submit" aria-label="Add project">
            +
          </button>
        </div>
      </form>
    </aside>
  )
}
