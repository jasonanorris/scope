import { useState } from 'react'

export function UserManagement({
  currentUserId,
  isProjectOwner,
  members,
  onAddUser,
  onUpdateMembers,
  selectedProject,
  users,
}) {
  const [draft, setDraft] = useState({ name: '', email: '' })
  const memberIds = new Set(members.map((member) => member.userId))

  function handleSubmit(event) {
    event.preventDefault()

    if (!draft.email.trim()) {
      return
    }

    onAddUser(draft)
    setDraft({ name: '', email: '' })
  }

  function toggleMember(userId) {
    if (!isProjectOwner) {
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
            disabled={!isProjectOwner}
            onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, name: event.target.value }))}
            placeholder="Name"
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={draft.email}
            disabled={!isProjectOwner}
            onChange={(event) =>
              setDraft((currentDraft) => ({ ...currentDraft, email: event.target.value }))
            }
            placeholder="person@example.com"
          />
        </label>
        <button type="submit" disabled={!isProjectOwner}>
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
                disabled={!isProjectOwner || isOwner || isCurrentUser}
                onChange={() => toggleMember(user.id)}
              />
              <span>
                <strong>{user.name || user.email}</strong>
                <small>{user.email}</small>
              </span>
              {isOwner ? <em>Owner</em> : null}
            </label>
          )
        })}
      </div>
    </section>
  )
}
