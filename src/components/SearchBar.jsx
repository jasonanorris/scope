export function SearchBar({ value, onChange }) {
  return (
    <label className="search-field">
      <span className="sr-only">Search tasks</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search tasks"
      />
    </label>
  )
}
