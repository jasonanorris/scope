import { EmptyState } from './EmptyState.jsx'
import { TaskCard } from './TaskCard.jsx'

export function TaskBoard({
  filters,
  statuses,
  tasks,
  onClearFilters,
  onOpenTask,
}) {
  const hasFilters = filters.search || filters.status !== 'All' || filters.priority !== 'All'

  if (tasks.length === 0) {
    return (
      <EmptyState
        title={hasFilters ? 'No tasks match these filters' : 'No tasks in this project'}
        message={
          hasFilters
            ? 'Clear the filters or adjust your search to bring work back into view.'
            : 'Add a task above to start building the plan.'
        }
        actionLabel={hasFilters ? 'Clear filters' : undefined}
        onAction={hasFilters ? onClearFilters : undefined}
      />
    )
  }

  return (
    <section className="board" aria-label="Task board">
      {statuses.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status)

        return (
          <section className="board-column" key={status} aria-labelledby={`status-${status}`}>
            <header>
              <h2 id={`status-${status}`}>{status}</h2>
              <span>{columnTasks.length}</span>
            </header>
            <div className="task-list">
              {columnTasks.length > 0 ? (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    onOpenTask={onOpenTask}
                    task={task}
                  />
                ))
              ) : (
                <p className="column-empty">No tasks</p>
              )}
            </div>
          </section>
        )
      })}
    </section>
  )
}
