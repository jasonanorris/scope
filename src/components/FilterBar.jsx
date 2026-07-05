export function FilterBar({ filters, statuses, onChange, onClear }) {
  const hasFilters = filters.search || filters.status !== 'All' || filters.priority !== 'All'

  function updateFilter(field, value) {
    onChange({ ...filters, [field]: value })
  }

  return (
    <section className="filter-panel" aria-label="Task filters">
      <div className="section-heading">
        <h2>Filters</h2>
        <button type="button" onClick={onClear} disabled={!hasFilters}>
          Clear
        </button>
      </div>

      <label>
        Search
        <input
          type="search"
          value={filters.search}
          onChange={(event) => updateFilter('search', event.target.value)}
          placeholder="Title or notes"
        />
      </label>

      <div className="filter-grid">
        <label>
          Status
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option>All</option>
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select
            value={filters.priority}
            onChange={(event) => updateFilter('priority', event.target.value)}
          >
            <option>All</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
      </div>
    </section>
  )
}
