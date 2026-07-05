const priorityClass = {
  Low: 'priority-low',
  Medium: 'priority-medium',
  High: 'priority-high',
}

function formatDueDate(value) {
  if (!value) {
    return 'No due date'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function getDueTone(value, status) {
  if (!value || status === 'Done') {
    return ''
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${value}T00:00:00`)

  if (due < today) {
    return 'overdue'
  }

  return ''
}

export function TaskCard({ task, statuses, onDelete, onTaskChange }) {
  const dueTone = getDueTone(task.dueDate, task.status)

  return (
    <article className="task-card">
      <div className="task-card-header">
        <h3>{task.title}</h3>
        <button type="button" onClick={() => onDelete(task.id)} aria-label={`Delete ${task.title}`}>
          ×
        </button>
      </div>

      {task.description ? <p>{task.description}</p> : null}

      <div className="task-meta" aria-label="Task details">
        <span className={priorityClass[task.priority]}>{task.priority}</span>
        <span className={dueTone}>{formatDueDate(task.dueDate)}</span>
        <span>{task.owner || 'Unassigned'}</span>
      </div>

      <div className="task-actions">
        <label>
          <span className="sr-only">Status for {task.title}</span>
          <select
            value={task.status}
            onChange={(event) => onTaskChange(task.id, { status: event.target.value })}
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Priority for {task.title}</span>
          <select
            value={task.priority}
            onChange={(event) => onTaskChange(task.id, { priority: event.target.value })}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
      </div>
    </article>
  )
}
