import { useEffect, useState } from 'react'

const priorityOptions = ['Low', 'Medium', 'High']
const fieldLabels = {
  description: 'notes',
  status: 'status',
  priority: 'priority',
  owner: 'owner',
}

function formatDate(value) {
  if (!value) {
    return 'No due date'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function getEditableTask(task) {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? '',
    owner: task.owner ?? '',
  }
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getActor(entry) {
  return entry.userName || entry.userEmail || 'Someone'
}

function getHistoryMessage(entry) {
  const actor = getActor(entry)

  if (entry.fieldName === 'description') {
    return `${actor} updated notes`
  }

  return `${actor} changed ${fieldLabels[entry.fieldName] ?? entry.fieldName}`
}

export function TaskDetailPage({ project, statuses, task, taskHistory = [], onBack, onSave }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(() => getEditableTask(task))

  useEffect(() => {
    setDraft(getEditableTask(task))
    setIsEditing(false)
  }, [task])

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!draft.title.trim()) {
      return
    }

    await onSave(task.id, {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      owner: draft.owner.trim(),
    })
    setIsEditing(false)
  }

  return (
    <section className="task-detail" aria-labelledby="task-detail-title">
      <header className="task-detail-header">
        <div>
          <button className="text-button" type="button" onClick={onBack}>
            Back to board
          </button>
          <p className="eyebrow">{project?.name ?? 'Task'}</p>
          <h1 id="task-detail-title">{task.title}</h1>
        </div>

        {isEditing ? (
          <div className="detail-actions">
            <button className="secondary-button" type="button" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button className="primary-button" type="submit" form="task-detail-form">
              Save changes
            </button>
          </div>
        ) : (
          <button className="primary-button" type="button" onClick={() => setIsEditing(true)}>
            Edit
          </button>
        )}
      </header>

      {isEditing ? (
        <form id="task-detail-form" className="task-detail-panel" onSubmit={handleSubmit}>
          <label>
            Title
            <input
              type="text"
              value={draft.title}
              onChange={(event) => updateDraft('title', event.target.value)}
            />
          </label>

          <label>
            Notes
            <textarea
              value={draft.description}
              onChange={(event) => updateDraft('description', event.target.value)}
              rows="7"
            />
          </label>

          <div className="detail-field-grid">
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
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Due date
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
              />
            </label>
          </div>
        </form>
      ) : (
        <>
          <div className="task-detail-panel">
            <div className="detail-description">
              <h2>Notes</h2>
              <p>{task.description || 'No notes added.'}</p>
            </div>

            <dl className="detail-field-grid detail-field-list">
              <div>
                <dt>Status</dt>
                <dd>{task.status}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{task.priority}</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{formatDate(task.dueDate)}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{task.owner || 'Unassigned'}</dd>
              </div>
            </dl>
          </div>

          <section className="task-detail-panel activity-panel" aria-labelledby="task-activity-title">
            <div className="section-heading">
              <h2 id="task-activity-title">Activity</h2>
            </div>

            {taskHistory.length > 0 ? (
              <ol className="activity-list">
                {taskHistory.map((entry) => (
                  <li key={entry.id}>
                    <div>
                      <strong>{getHistoryMessage(entry)}</strong>
                      {entry.fieldName !== 'description' ? (
                        <p>
                          <span>{entry.oldValue || 'Unassigned'}</span>
                          <span aria-hidden="true">-&gt;</span>
                          <span>{entry.newValue || 'Unassigned'}</span>
                        </p>
                      ) : null}
                    </div>
                    <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="activity-empty">No activity yet.</p>
            )}
          </section>
        </>
      )}
    </section>
  )
}
