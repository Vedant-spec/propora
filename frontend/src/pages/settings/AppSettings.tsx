import { useState } from 'react'
import { api, readError } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import type { ThemeChoice } from '../../context/ThemeContext'
import { useToast } from '../../context/ToastContext'
import { Alert, Button, Card, CardHeader, cx } from '../../components/ui'

const THEMES: { value: ThemeChoice; label: string; description: string; icon: string }[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Bright surfaces, best in well-lit rooms.',
    icon: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Dim surfaces, easier on the eyes at night.',
    icon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follow whatever your device is set to.',
    icon: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm4 15h8',
  },
]

export default function AppSettings() {
  const { user, refresh } = useAuth()
  const { choice, resolved, setTheme } = useTheme()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const pickTheme = async (value: ThemeChoice) => {
    // Paint immediately, then persist to the account.
    setTheme(value)
    setSaving(true)
    setError('')
    try {
      await api('/auth/preferences', { method: 'PUT', body: { theme: value } })
      await refresh()
      toast.success(`Theme set to ${value}`)
    } catch (err) {
      setError(readError(err).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Appearance"
          subtitle={`Currently showing the ${resolved} theme.`}
        />
        <div className="p-5">
          {error && (
            <div className="mb-4">
              <Alert message={error} />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map((option) => {
              const active = choice === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={saving}
                  onClick={() => pickTheme(option.value)}
                  className={cx(
                    'rounded-xl border p-4 text-left transition-colors disabled:opacity-60',
                    active
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/25'
                      : 'border-ink-200 bg-sunken hover:border-ink-300',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-9 w-9 items-center justify-center rounded-lg',
                      active ? 'bg-brand-600 text-brand-contrast' : 'bg-ink-100 text-ink-500',
                    )}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d={option.icon} />
                    </svg>
                  </span>
                  <p className="mt-3 font-medium text-ink-900">{option.label}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{option.description}</p>
                </button>
              )
            })}
          </div>

          {/* Live preview so the choice is obvious before leaving the page. */}
          <div className="mt-5 rounded-xl border border-ink-200 bg-sunken p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Preview</p>
            <div className="rounded-lg border border-ink-200 bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">Riverstone Apartments 4B</p>
                  <p className="text-xs text-ink-500">42 Riverstone Ave, Pune</p>
                </div>
                <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success ring-1 ring-inset ring-success-ring">
                  Occupied
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <span className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-brand-contrast">
                  Primary
                </span>
                <span className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700">
                  Secondary
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Account" subtitle="Read-only details about this workspace." />
        <dl className="divide-y divide-ink-200">
          {[
            { label: 'Signed in as', value: user?.name },
            { label: 'Email', value: user?.email },
            { label: 'Role', value: user?.role },
            { label: 'Currency', value: 'Indian Rupee (₹)' },
            { label: 'Date format', value: 'DD MMM YYYY' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <dt className="text-sm text-ink-500">{row.label}</dt>
              <dd className="truncate font-medium capitalize text-ink-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader title="About" />
        <div className="p-5 text-sm text-ink-600">
          <p>
            <strong className="text-ink-900">PROPORA</strong> — Smart Property Management &amp;
            Tenant Portal.
          </p>
          <p className="mt-2 text-ink-500">
            Development Phase 1 · React + Flask + MySQL-ready · Role-based access for
            administrators, property managers and tenants.
          </p>
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Reload application
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
