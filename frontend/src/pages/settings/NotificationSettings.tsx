import { useState } from 'react'
import { api, readError } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Alert, Button, Card, CardHeader, Toggle } from '../../components/ui'

type PrefKey = 'notify_email' | 'notify_rent' | 'notify_maintenance' | 'notify_lease'

const CHANNELS: { key: PrefKey; label: string; description: string }[] = [
  {
    key: 'notify_email',
    label: 'Email notifications',
    description: 'Send a copy of important alerts to your email address.',
  },
]

const TOPICS: { key: PrefKey; label: string; description: string }[] = [
  {
    key: 'notify_rent',
    label: 'Rent and payments',
    description: 'Rent falling due, payments received and invoices going overdue.',
  },
  {
    key: 'notify_maintenance',
    label: 'Maintenance updates',
    description: 'New requests, assignments and status changes on tickets.',
  },
  {
    key: 'notify_lease',
    label: 'Lease reminders',
    description: 'Agreements starting, renewing or approaching their end date.',
  },
]

export default function NotificationSettings() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    notify_email: user?.notify_email ?? true,
    notify_rent: user?.notify_rent ?? true,
    notify_maintenance: user?.notify_maintenance ?? true,
    notify_lease: user?.notify_lease ?? true,
  })

  const update = async (key: PrefKey, value: boolean) => {
    const previous = prefs
    // Optimistic flip so the switch feels instant; rolled back on failure.
    setPrefs({ ...prefs, [key]: value })
    setSaving(true)
    setError('')
    try {
      await api('/auth/preferences', { method: 'PUT', body: { [key]: value } })
      await refresh()
      toast.success('Notification preferences saved')
    } catch (err) {
      setPrefs(previous)
      setError(readError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const enableAll = async (value: boolean) => {
    const next = {
      notify_email: value,
      notify_rent: value,
      notify_maintenance: value,
      notify_lease: value,
    }
    const previous = prefs
    setPrefs(next)
    setSaving(true)
    setError('')
    try {
      await api('/auth/preferences', { method: 'PUT', body: next })
      await refresh()
      toast.success(value ? 'All notifications enabled' : 'All notifications muted')
    } catch (err) {
      setPrefs(previous)
      setError(readError(err).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert message={error} />}

      <Card>
        <CardHeader
          title="Delivery"
          subtitle="In-app notifications are always on. Choose whether they also reach your inbox."
        />
        <div className="divide-y divide-ink-200 px-5">
          {CHANNELS.map((item) => (
            <Toggle
              key={item.key}
              label={item.label}
              description={item.description}
              checked={prefs[item.key]}
              onChange={(value) => update(item.key, value)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="What to notify me about"
          subtitle="Turn off any topic you would rather not hear about."
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => enableAll(false)}>
                Mute all
              </Button>
              <Button size="sm" variant="secondary" disabled={saving} onClick={() => enableAll(true)}>
                Enable all
              </Button>
            </div>
          }
        />
        <div className="divide-y divide-ink-200 px-5">
          {TOPICS.map((item) => (
            <Toggle
              key={item.key}
              label={item.label}
              description={item.description}
              checked={prefs[item.key]}
              onChange={(value) => update(item.key, value)}
            />
          ))}
        </div>
      </Card>

      <Alert
        tone="info"
        message="This build stores your preferences and drives the in-app notification bell. Outbound email requires an SMTP server to be configured."
      />
    </div>
  )
}
