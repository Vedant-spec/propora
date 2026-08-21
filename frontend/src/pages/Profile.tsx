import { useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { initials, titleCase } from '../lib/format'
import { Alert, Button, Card, CardHeader, Field, Input, PageHeader } from '../components/ui'

export default function Profile() {
  const { user, refresh } = useAuth()

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [occupation, setOccupation] = useState('')
  const [emergency, setEmergency] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const isTenant = user?.role === 'tenant'

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setSavingProfile(true)
    setProfileError('')
    setProfileMessage('')
    try {
      await api('/auth/me', {
        method: 'PUT',
        body: isTenant
          ? { name, phone, occupation, emergency_contact: emergency }
          : { name, phone },
      })
      await refresh()
      setProfileMessage('Profile updated.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not update your profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.')
      return
    }
    setSavingPassword(true)
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword },
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password changed.')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change your password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <>
      <PageHeader title="My profile" subtitle="Your contact details and sign-in security." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-700">
              {initials(user?.name)}
            </span>
            <p className="mt-3 text-base font-semibold text-ink-900">{user?.name}</p>
            <p className="text-sm text-ink-500">{user?.email}</p>
            <span className="mt-3 rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-600">
              {titleCase(user?.role)}
            </span>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Contact details" />
            <form onSubmit={saveProfile} className="space-y-4 p-5">
              {profileError && <Alert message={profileError} />}
              {profileMessage && <Alert message={profileMessage} tone="success" />}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input required value={name} onChange={(event) => setName(event.target.value)} />
                </Field>
                <Field label="Phone">
                  <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
                </Field>
                <Field label="Email" hint="Contact an administrator to change your email.">
                  <Input value={user?.email ?? ''} disabled />
                </Field>
                {isTenant && (
                  <>
                    <Field label="Occupation">
                      <Input value={occupation} onChange={(event) => setOccupation(event.target.value)} />
                    </Field>
                    <Field label="Emergency contact" className="sm:col-span-2">
                      <Input value={emergency} onChange={(event) => setEmergency(event.target.value)} />
                    </Field>
                  </>
                )}
              </div>

              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Change password" subtitle="Passwords are stored hashed, never in plain text." />
            <form onSubmit={changePassword} className="space-y-4 p-5">
              {passwordError && <Alert message={passwordError} />}
              {passwordMessage && <Alert message={passwordMessage} tone="success" />}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Current password" className="sm:col-span-2">
                  <Input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                </Field>
                <Field label="New password" hint="At least 6 characters.">
                  <Input type="password" required autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                </Field>
                <Field label="Confirm new password">
                  <Input type="password" required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </Field>
              </div>

              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  )
}
