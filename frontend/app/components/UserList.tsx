import { useCallback, useEffect, useState } from 'react'

import { User, apiJson } from '../lib/api'
import { canDeleteUser } from '../lib/userDelete'

type UserListProps = {
  onUsersChanged?: () => void
}

export function UserList({ onUsersChanged }: UserListProps) {
  const [users, setUsers] = useState<User[]>([])
  const [editing, setEditing] = useState<User | null>(null)
  const [editNim, setEditNim] = useState('')
  const [editName, setEditName] = useState('')
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [deleteText, setDeleteText] = useState('')
  const [error, setError] = useState('')

  const loadUsers = useCallback(async () => {
    setError('')
    try {
      setUsers(await apiJson<User[]>('/api/users'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const startEdit = (user: User) => {
    setEditing(user)
    setEditNim(user.nim)
    setEditName(user.name)
    setError('')
  }

  const saveEdit = async () => {
    if (!editing) return
    try {
      await apiJson<User>(`/api/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nim: editNim, name: editName }),
      })
      setEditing(null)
      await loadUsers()
      onUsersChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
      await loadUsers()
    }
  }

  const removeUser = async () => {
    if (!deleteUser || !canDeleteUser(deleteText, deleteUser.nim)) return
    try {
      await apiJson<{ success: boolean }>(`/api/users/${deleteUser.id}`, { method: 'DELETE' })
      setDeleteUser(null)
      setDeleteText('')
      await loadUsers()
      onUsersChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
      await loadUsers()
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading"><h2>Enrolled Users</h2><button type="button" onClick={() => void loadUsers()}>Refresh</button></div>
      {error && <p className="error-text">{error}</p>}
      <ul className="user-list">
        {users.map((user) => (
          <li key={user.id}>
            <div><strong>{user.nim}</strong> — {user.name}</div>
            <div className="row-actions">
              <button type="button" onClick={() => startEdit(user)}>Edit</button>
              <button type="button" className="danger" onClick={() => { setDeleteUser(user); setDeleteText('') }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void saveEdit() }}>
          <h3>Edit user</h3>
          <input aria-label="NIM" value={editNim} onChange={(event) => setEditNim(event.target.value)} />
          <input aria-label="Full name" value={editName} onChange={(event) => setEditName(event.target.value)} />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditing(null)}>Cancel</button>
        </form>
      )}

      {deleteUser && (
        <div className="inline-form danger-zone">
          <h3>Delete {deleteUser.name}?</h3>
          <p>Historical logs stay, but they lose the user link. Type <strong>{deleteUser.nim}</strong> to confirm.</p>
          <input aria-label="Confirm NIM" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} />
          <button type="button" className="danger" disabled={!canDeleteUser(deleteText, deleteUser.nim)} onClick={() => void removeUser()}>Delete user</button>
          <button type="button" onClick={() => setDeleteUser(null)}>Cancel</button>
        </div>
      )}
    </section>
  )
}
