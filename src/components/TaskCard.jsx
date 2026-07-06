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

export function TaskCard({ task, onOpenTask }) {
  const dueTone = getDueTone(task.dueDate, task.status)
  const taskInitial = task.title.trim().charAt(0).toUpperCase() || 'T'
  const taskHref = `?task=${encodeURIComponent(task.id)}`

  return (
    <a
      className="task-card"
      href={taskHref}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return
        }

        event.preventDefault()
        onOpenTask(task)
      }}
    >
      <div className="task-card-header">
        <span className="task-initial" aria-hidden="true">
          {taskInitial}
        </span>
        <div>
          <h3>{task.title}</h3>
          {task.description ? <p>{task.description}</p> : null}
        </div>
      </div>

      <div className="task-meta" aria-label="Task details">
        <span className={priorityClass[task.priority]}>{task.priority}</span>
        <span className={dueTone}>{formatDueDate(task.dueDate)}</span>
        <span>{task.owner || 'Unassigned'}</span>
      </div>
    </a>
  )
}
