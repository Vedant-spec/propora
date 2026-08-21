import { useState } from 'react'
import { useResource } from '../hooks/useResource'
import { api } from '../lib/api'
import { formatDate, initials } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
} from '../components/ui'
import type { User } from '../lib/types'

type UserForm = Partial<User> & { password?: string }

export default function Users() {
  const { user: me } = useAuth()
  const { data, loading, error, reload } = useResource<User[]>('/auth/users')
  const [editing, setEditing] = useState<UserForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (patch: UserForm) => setEditing((prev) => ({ ...prev, ...patch }))

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setFormError('')
    try {
      if (editing.id) {
        await api(`/auth/users/${editing.id}`, { method: 'PUT', body: editing })
      } else {
        await api('/auth/users', { method: 'POST', body: editing })
      }
      setEditing(null)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the account')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirmDelete) return
    setSaving(true)
    setFormError('')
    try {
      await api(`/auth/users/${confirmDelete.id}`, { method: 'DELETE' })
      setConfirmDelete(null)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not delete the account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="User accounts"
        subtitle="Who can sign in, and what they are allowed to do."
        action={
          <Button onClick={() => { setFormError(''); setEditing({ role: 'manager', is_active: true }) }}>
            + Add user
          </Button>
        }
      />

      {error && <Alert message={error} />}

      <Card>
        {loading ? (
          <Spinner />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No accounts" />
        ) : (
          <Table columns={['User', 'Email', 'Phone', 'Role', 'Status', 'Created', '']}>
            {data.map((user) => (
              <tr key={user.id} className="hover:bg-ink-50/60">
                <Td>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700">
                      {initials(user.name)}
                    </span>
                    <span className="font-medium text-ink-900">
                      {user.name}
                      {user.id === me?.id && <span className="ml-2 text-xs text-ink-400">(you)</span>}
                    </span>
                  </div>
                </Td>
                <Td>{user.email}</Td>
                <Td>{user.phone || '—'}</Td>
                <Td>
                  <Badge tone={user.role === 'admin' ? 'purple' : user.role === 'manager' ? 'blue' : 'gray'}>
                    {user.role}
                  </Badge>
                </Td>
                <Td><Badge tone={user.is_active ? 'green' : 'red'}>{user.is_active ? 'active' : 'disabled'}</Badge></Td>
                <Td className="text-sm">{formatDate(user.created_at)}</Td>
                <Td className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => { setFormError(''); setEditing({ ...user, password: '' }) }}>Edit</Button>
                  {user.id !== me?.id && (
                    <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => { setFormError(''); setConfirmDelete(user) }}>Delete</Button>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? 'Edit account' : 'Add account'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button form="user-form" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save account'}</Button>
          </>
        }
      >
        <form id="user-form" onSubmit={save} className="space-y-4">
          {formError && <Alert message={formError} />}

          <Field label="Full name">
            <Input required value={editing?.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" required disabled={Boolean(editing?.id)} value={editing?.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={editing?.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Role" hint="Admins manage accounts; managers run day-to-day operations.">
            <Select value={editing?.role ?? 'manager'} onChange={(e) => set({ role: e.target.value as User['role'] })}>
              <option value="admin">Administrator</option>
              <option value="manager">Property manager</option>
              <option value="tenant">Tenant</option>
            </Select>
          </Field>
          <Field
            label={editing?.id ? 'Reset password' : 'Password'}
            hint={editing?.id ? 'Leave blank to keep the current password.' : undefined}
          >
            <Input type="text" required={!editing?.id} value={editing?.password ?? ''} onChange={(e) => set({ password: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2.5 text-sm font-medium text-ink-700">
            <input
              type="checkbox"
              checked={editing?.is_active !== false}
              onChange={(e) => set({ is_active: e.target.checked })}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Account is active and may sign in
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title="Delete account"
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={remove} disabled={saving}>{saving ? 'Deleting…' : 'Delete account'}</Button>
          </>
        }
      >
        {formError && <div className="mb-3"><Alert message={formError} /></div>}
        <p className="text-sm text-ink-600">
          Delete the login for <strong className="text-ink-900">{confirmDelete?.name}</strong>? They will no
          longer be able to sign in.
        </p>
      </Modal>
    </>
  )
}
