import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Spinner } from '../components/ui'

const FEATURES = [
  {
    title: 'Properties & availability',
    body: 'Every residential and commercial unit in one register, with live occupancy status.',
    icon: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z',
  },
  {
    title: 'Tenants & leases',
    body: 'Complete tenant profiles, identification records and agreements with expiry tracking.',
    icon: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  },
  {
    title: 'Rent collection',
    body: 'Automatic monthly schedules, part-payment handling and overdue detection.',
    icon: 'M3 10h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  },
  {
    title: 'Maintenance workflow',
    body: 'Tenants raise requests online and follow them from open through to closed.',
    icon: 'm14.7 6.3 3 3M3 21l3.5-.7L20 6.8a2 2 0 0 0 0-2.8l-.9-.9a2 2 0 0 0-2.8 0L2.8 16.6 3 21Z',
  },
  {
    title: 'Reports & analytics',
    body: 'Six report types over any date range, exportable to PDF, Excel or CSV.',
    icon: 'M8 17V9m4 8V5m4 12v-5M4 4v15a1 1 0 0 0 1 1h15',
  },
  {
    title: 'Secure access',
    body: 'Hashed passwords, role-based permissions and session control for every account.',
    icon: 'M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z',
  },
]

const SUN = 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'
const MOON = 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z'

export default function Splash() {
  const { user, loading } = useAuth()
  const { resolved, toggle } = useTheme()

  if (loading) return <Spinner label="Starting PROPORA…" />
  // Anyone already signed in goes straight to their workspace.
  if (user) return <Navigate to={user.role === 'tenant' ? '/portal' : '/dashboard'} replace />

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-brand-contrast">
              P
            </span>
            <span className="text-lg font-semibold tracking-wide text-ink-900">PROPORA</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
              className="rounded-lg p-2 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={resolved === 'dark' ? SUN : MOON} />
              </svg>
            </button>
            <Link
              to="/login"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-500"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
            Smart property management &amp; tenant portal
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-5xl">
            Run your properties without the paperwork.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-ink-500 sm:text-lg">
            PROPORA centralises property records, tenant tracking, lease agreements, rent
            collection and maintenance into one secure web portal — for administrators, property
            managers and tenants alike.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-brand-contrast shadow-ambient transition-colors hover:bg-brand-500"
            >
              Get started
            </Link>
            <a
              href="#features"
              className="rounded-lg border border-ink-200 bg-surface px-6 py-3 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
            >
              See what it does
            </a>
          </div>
        </section>

        <section id="features" className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-ink-200 bg-surface p-6 shadow-ambient">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </span>
              <h3 className="mt-4 font-semibold text-ink-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{feature.body}</p>
            </div>
          ))}
        </section>

        <section className="mb-16 rounded-xl border border-ink-200 bg-surface p-8 text-center shadow-ambient">
          <h2 className="text-xl font-semibold text-ink-900">Three roles, one portal</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-500">
            Administrators manage accounts and oversee everything, property managers run
            day-to-day operations, and tenants get a private portal for their own lease, rent and
            maintenance requests.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {['Administrator', 'Property manager', 'Tenant'].map((role) => (
              <div key={role} className="rounded-lg bg-sunken px-4 py-3 text-sm font-medium text-ink-700">
                {role}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-200 bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-ink-500">
          PROPORA — Property Management &amp; Tenant Tracking Portal
        </div>
      </footer>
    </div>
  )
}
