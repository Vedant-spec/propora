import { useState } from 'react'
import { api, readError, tokenStore } from '../../lib/api'
import type { FieldErrors } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDateTime } from '../../lib/format'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  Field,
  Input,
} from '../../components/ui'

export default function SecuritySettings() {
  const { user, refresh } = useAuth()
  const toast = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setErrors({})

    if (newPassword !== confirmPassword) {
      setErrors({ confirm_password: 'The new passwords do not match' })
      return
    }

    setSaving(true)
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword },
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated')
      await refresh()
    } catch (err) {
      const parsed = readError(err)
      setError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSaving(false)
    }
  }

  const signOutEverywhere = async () => {
    setSigningOut(true)
    try {
      // The server rotates the token version and hands this device a fresh token.
      const result = await api<{ access_token: string }>('/auth/sign-out-everywhere', {
        method: 'POST',
      })
      tokenStore.set(result.access_token)
      setConfirmSignOut(false)
      toast.success('Signed out of all other devices')
      await refresh()
    } catch (err) {
      toast.error(readError(err).message)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Sign-in activity" subtitle="Where and when this account was last used." />
        <dl className="divide-y divide-ink-200">
          {[
            { label: 'Last sign-in', value: formatDateTime(user?.last_login_at) },
            { label: 'Password last changed', value: formatDateTime(user?.password_changed_at) },
            { label: 'Account created', value: formatDateTime(user?.created_at) },
            { label: 'Session length', value: '12 hours' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <dt className="text-sm text-ink-500">{row.label}</dt>
              <dd className="font-medium text-ink-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Change password"
          subtitle="Passwords are stored hashed with a per-user salt, never in plain text."
        />
        <form onSubmit={changePassword} className="space-y-4 p-5" noValidate>
          {error && !Object.keys(errors).length && <Alert message={error} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Current password" required error={errors.current_password} className="sm:col-span-2">
              <Input
                type="password"
                autoComplete="current-password"
                required
                invalid={Boolean(errors.current_password)}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
            <Field label="New password" required error={errors.new_password} hint="At least 6 characters.">
              <Input
                type="password"
                autoComplete="new-password"
                required
                invalid={Boolean(errors.new_password)}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </Field>
            <Field label="Confirm new password" required error={errors.confirm_password}>
              <Input
                type="password"
                autoComplete="new-password"
                required
                invalid={Boolean(errors.confirm_password)}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </Field>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Active sessions"
          subtitle="Signing out everywhere invalidates every token issued to this account."
        />
        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-sunken px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-soft text-success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm4 15h8"
                  />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-ink-900">This device</p>
                <p className="text-xs text-ink-500">
                  Signed in {formatDateTime(user?.last_login_at)}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success ring-1 ring-inset ring-success-ring">
              Current
            </span>
          </div>

          <div className="mt-4">
            <Button variant="danger" onClick={() => setConfirmSignOut(true)}>
              Sign out of all other devices
            </Button>
            <p className="mt-2 text-xs text-ink-500">
              You stay signed in here. Every other browser or device will need to sign in again.
            </p>
          </div>
        </div>
      </Card>

      <ConfirmModal
        open={confirmSignOut}
        title="Sign out everywhere"
        message="Every other session for this account will be ended immediately. You will remain signed in on this device."
        confirmLabel="Sign out other devices"
        busy={signingOut}
        onConfirm={signOutEverywhere}
        onClose={() => setConfirmSignOut(false)}
      />
    </div>
  )
}
