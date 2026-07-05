export function EmptyState({ title, message, actionLabel, onAction }) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {actionLabel ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}
