import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { PageHeader, cx } from '../components/ui'

const TABS = [
  { to: '/settings', end: true, label: 'Application' },
  { to: '/settings/security', label: 'Security' },
  { to: '/settings/notifications', label: 'Notifications' },
]

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Appearance, security and notification preferences." />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-ink-200 bg-surface p-1">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cx(
                'shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-brand-600 text-brand-contrast' : 'text-ink-600 hover:bg-ink-100',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </>
  )
}

/** Shared save-state helper for the settings panes. */
export function useSaveState() {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  return { saving, setSaving, message, setMessage, error, setError }
}
