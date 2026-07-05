import { useState } from 'react'

const blankTask = {
  title: '',
  description: '',
  status: 'Backlog',
  priority: 'Medium',
  dueDate: '',
  owner: '',
}

export function TaskForm({ onAddTask, statuses }) {
  const [draft, setDraft] = useState(blankTask)

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!draft.title.trim()) {
      return
    }

    onAddTask({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      owner: draft.owner.trim(),
    })
    setDraft(blankTask)
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="form-primary">
        <label htmlFor="task-title">New task</label>
        <input
          id="task-title"
          type="text"
          value={draft.title}
          onChange={(event) => updateDraft('title', event.target.value)}
          placeholder="Describe the next piece of work"
        />
      </div>

      <label className="sr-only" htmlFor="task-description">
        Task description
      </label>
      <textarea
        id="task-description"
        value={draft.description}
        onChange={(event) => updateDraft('description', event.target.value)}
        placeholder="Notes, acceptance criteria, or context"
        rows="2"
      />

      <div className="form-grid">
        <label>
          Status
          <select value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select
            value={draft.priority}
            onChange={(event) => updateDraft('priority', event.target.value)}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <label>
          Due
          <input
            type="date"
            value={draft.dueDate}
            onChange={(event) => updateDraft('dueDate', event.target.value)}
          />
        </label>
        <label>
          Owner
          <input
            type="text"
            value={draft.owner}
            onChange={(event) => updateDraft('owner', event.target.value)}
            placeholder="Name"
          />
        </label>
      </div>

      <button className="primary-button" type="submit">
        Add task
      </button>
    </form>
  )
}
