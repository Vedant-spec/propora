import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { api } from '../lib/api'
import { initials, titleCase } from '../lib/format'
import NotificationsPanel from './NotificationsPanel'
import { ConfirmModal, cx } from './ui'

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean }

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5 shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
)

const ICONS = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  property: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z',
  tenants: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm11.5 9v-1a4 4 0 0 0-3-3.87M16 4.13a4 4 0 0 1 0 7.75',
  lease: 'M9 12h6m-6 4h6M9 8h2M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5',
  payment: 'M3 10h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm4 8h4',
  maintenance: 'm14.7 6.3 3 3M3 21l3.5-.7L20 6.8a2 2 0 0 0 0-2.8l-.9-.9a2 2 0 0 0-2.8 0L2.8 16.6 3 21Z',
  reports: 'M8 17V9m4 8V5m4 12v-5M4 4v15a1 1 0 0 0 1 1h15',
  users: 'M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 0c-3.6 0-6.5 2-7 5h14c-.5-3-3.4-5-7-5Z',
  profile: 'M5.1 19a7 7 0 0 1 13.8 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9.5Z',
  logout: 'M15 17l5-5-5-5M20 12H9M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
}

const STAFF_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: icon(ICONS.dashboard) },
  { to: '/properties', label: 'Properties', icon: icon(ICONS.property) },
  { to: '/tenants', label: 'Tenants', icon: icon(ICONS.tenants) },
  { to: '/leases', label: 'Leases', icon: icon(ICONS.lease) },
  { to: '/payments', label: 'Rent & payments', icon: icon(ICONS.payment) },
  { to: '/maintenance', label: 'Maintenance', icon: icon(ICONS.maintenance) },
  { to: '/reports', label: 'Reports', icon: icon(ICONS.reports) },
]

const ADMIN_NAV: NavItem[] = [{ to: '/users', label: 'User accounts', icon: icon(ICONS.users) }]

const TENANT_NAV: NavItem[] = [
  { to: '/portal', label: 'Dashboard', icon: icon(ICONS.dashboard), end: true },
  { to: '/portal/property', label: 'My property', icon: icon(ICONS.home) },
  { to: '/portal/lease', label: 'My lease', icon: icon(ICONS.lease) },
  { to: '/portal/payments', label: 'Payment history', icon: icon(ICONS.payment) },
  { to: '/portal/maintenance', label: 'Maintenance', icon: icon(ICONS.maintenance) },
]

const ACCOUNT_NAV: NavItem[] = [
  { to: '/profile', label: 'My profile', icon: icon(ICONS.profile) },
  { to: '/settings', label: 'Settings', icon: icon(ICONS.settings) },
]

function ThemeToggle() {
  const { resolved, toggle } = useTheme()

  const flip = () => {
    toggle()
    // Persist to the account so the choice follows the user to other devices.
    void api('/auth/preferences', {
      method: 'PUT',
      body: { theme: resolved === 'dark' ? 'light' : 'dark' },
    }).catch(() => undefined)
  }

  return (
    <button
      onClick={flip}
      aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
      className="rounded-lg p-2 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
    >
      {icon(resolved === 'dark' ? ICONS.sun : ICONS.moon)}
    </button>
  )
}

export default function Layout() {
  const { user, isStaff, logout } = useAuth()
  const navigate = useNavigate()
  const { choice, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const themeApplied = useRef(false)

  // Apply the theme stored on the account once, at sign-in.
  useEffect(() => {
    if (themeApplied.current || !user?.theme) return
    themeApplied.current = true
    if (user.theme !== choice) setTheme(user.theme)
  }, [user?.theme, choice, setTheme])

  const groups: { label?: string; items: NavItem[] }[] = isStaff
    ? [
        { items: STAFF_NAV },
        ...(user?.role === 'admin' ? [{ label: 'Administration', items: ADMIN_NAV }] : []),
        { label: 'Account', items: ACCOUNT_NAV },
      ]
    : [{ items: TENANT_NAV }, { label: 'Account', items: ACCOUNT_NAV }]

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-overlay lg:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-200 bg-surface transition-transform lg:static lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-ink-200 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-brand-contrast">
            P
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink-900">PROPORA</p>
            <p className="text-xs text-ink-500">
              {isStaff ? 'Management console' : 'Tenant portal'}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {groups.map((group, index) => (
            <div key={group.label ?? index} className="space-y-1">
              {group.label && (
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-200 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-200 text-xs font-semibold text-ink-700">
              {initials(user?.name)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-ink-900">{user?.name}</p>
              <p className="truncate text-xs text-ink-500">{titleCase(user?.role)}</p>
            </div>
          </div>
          <button
            onClick={() => setConfirmLogout(true)}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-danger-soft hover:text-danger"
          >
            {icon(ICONS.logout)}
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-ink-200 bg-surface px-4 py-2.5">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
          >
            {icon(ICONS.menu)}
          </button>
          <span className="font-semibold text-ink-900 lg:hidden">PROPORA</span>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationsPanel />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <ConfirmModal
        open={confirmLogout}
        title="Sign out"
        message={
          <>
            Sign out of PROPORA? You will need your email and password to sign back in.
          </>
        }
        confirmLabel="Sign out"
        tone="danger"
        onConfirm={signOut}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  )
}

