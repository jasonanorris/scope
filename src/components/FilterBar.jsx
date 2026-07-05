export function FilterBar({ filters, statuses, onChange, onClear }) {
  const hasFilters = filters.search || filters.status !== 'All' || filters.priority !== 'All'

  function updateFilter(field, value) {
    onChange({ ...filters, [field]: value })
  }

  return (
    <section className="filter-strip" aria-label="Task filters">
      <label>
        <span className="sr-only">Status</span>
        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
          <option value="All">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Priority</span>
        <select value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
          <option value="All">All priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
      </label>
      <button type="button" onClick={onClear} disabled={!hasFilters}>
        Clear
      </button>
    </section>
  )
}
