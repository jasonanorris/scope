import { useState } from 'react'

export function UserManagement({
  canManageProjectUsers,
  members,
  onAddUser,
  onUpdateMembers,
  onUpdateUserType,
  selectedProject,
  currentUserId,
  currentUserType,
  users,
}) {
  const [draft, setDraft] = useState({ name: '', email: '', title: '', type: 'standard' })
  const memberIds = new Set(members.map((member) => member.userId))
  const isAdmin = currentUserType === 'admin'

  function handleSubmit(event) {
    event.preventDefault()

    if (!draft.email.trim()) {
      return
    }

    onAddUser(draft)
    setDraft({ name: '', email: '', title: '', type: 'standard' })
  }

  function toggleMember(userId) {
    if (!canManageProjectUsers) {
      return
    }

    const nextMemberIds = memberIds.has(userId)
      ? [...memberIds].filter((memberId) => memberId !== userId)
      : [...memberIds, userId]

    onUpdateMembers(nextMemberIds)
  }

  return (
    <section className="user-panel" aria-label="Project users">
      <div className="section-heading">
        <h2>Users</h2>
        <span>{members.length} assigned</span>
      </div>

      <form className="user-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input
            type="text"
            value={draft.name}
            disabled={!canManageProjectUsers}
            onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, name: event.target.value }))}
            placeholder="Name"
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={draft.email}
            disabled={!canManageProjectUsers}
            onChange={(event) =>
              setDraft((currentDraft) => ({ ...currentDraft, email: event.target.value }))
            }
            placeholder="person@example.com"
          />
        </label>
        <label>
          Title
          <input
            type="text"
            value={draft.title}
            disabled={!canManageProjectUsers}
            onChange={(event) =>
              setDraft((currentDraft) => ({ ...currentDraft, title: event.target.value }))
            }
            placeholder="Product lead"
          />
        </label>
        {isAdmin ? (
          <label>
            Type
            <select
              value={draft.type}
              disabled={!canManageProjectUsers}
              onChange={(event) =>
                setDraft((currentDraft) => ({ ...currentDraft, type: event.target.value }))
              }
            >
              <option value="standard">Standard</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        ) : null}
        <button type="submit" disabled={!canManageProjectUsers}>
          Add user
        </button>
      </form>

      <div className="member-list" aria-label={`Assign users to ${selectedProject.name}`}>
        {users.map((user) => {
          const isOwner = user.id === selectedProject.ownerId
          const isCurrentUser = user.id === currentUserId

          return (
            <label className="member-row" key={user.id}>
              <input
                type="checkbox"
                checked={memberIds.has(user.id)}
                disabled={!canManageProjectUsers || isOwner || isCurrentUser}
                onChange={() => toggleMember(user.id)}
              />
              <span>
                <strong>{user.name || user.email}</strong>
                <small>{user.title ? `${user.title} • ${user.email}` : user.email}</small>
              </span>
              {isAdmin ? (
                <select
                  className="user-type-select"
                  value={user.type}
                  disabled={isCurrentUser}
                  aria-label={`User type for ${user.email}`}
                  onChange={(event) => onUpdateUserType(user.id, event.target.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <em>{user.type}</em>
              )}
              {isOwner ? <em>Owner</em> : null}
            </label>
          )
        })}
      </div>
    </section>
  )
}
