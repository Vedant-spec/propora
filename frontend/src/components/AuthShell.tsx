import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const HIGHLIGHTS = [
  'Centralised property and tenant records',
  'Automated rent schedules and payment tracking',
  'Online maintenance requests with live status',
  'Instant reports and dashboard analytics',
]

/** Shared split layout for every unauthenticated screen. */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const { resolved, toggle } = useTheme()

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-12 text-brand-contrast lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl"
        />

        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-contrast/15 font-bold">
            P
          </span>
          <span className="text-lg font-semibold tracking-wide">PROPORA</span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Property management &amp; tenant tracking, in one place.
          </h2>
          <p className="mt-4 opacity-80">
            Replace scattered spreadsheets and paper files with a single portal for properties,
            tenants, leases, rent collection and maintenance.
          </p>
          <ul className="mt-8 space-y-3 text-sm opacity-80">
            {HIGHLIGHTS.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 opacity-80">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
                    clipRule="evenodd"
                  />
                </svg>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm opacity-70">
          Role-based access · Encrypted passwords · Audit-ready records
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-surface px-6 py-12">
        <button
          onClick={toggle}
          aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
          className="absolute right-4 top-4 rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={
                resolved === 'dark'
                  ? 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'
                  : 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z'
              }
            />
          </svg>
        </button>

        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 font-bold text-brand-contrast">
              P
            </span>
            <span className="text-lg font-semibold text-ink-900">PROPORA</span>
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}

          {children}

          {footer && <div className="mt-6 text-center text-sm text-ink-500">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
