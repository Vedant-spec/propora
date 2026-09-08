import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { forwardRef, useEffect } from 'react'

export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ')

/* --------------------------------------------------------------------------
   Button
   -------------------------------------------------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
  size?: 'sm' | 'md'
}

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-brand-contrast hover:bg-brand-500 shadow-ambient',
  secondary: 'bg-surface text-ink-700 border border-ink-200 hover:bg-ink-100',
  ghost: 'text-ink-600 hover:bg-ink-100',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  danger: 'bg-danger text-brand-contrast hover:opacity-90',
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  )
}

/* --------------------------------------------------------------------------
   Surfaces
   -------------------------------------------------------------------------- */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-xl border border-ink-200 bg-surface shadow-ambient', className)}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  back?: ReactNode
}) {
  return (
    <header className="mb-6">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}

/* --------------------------------------------------------------------------
   Badge
   -------------------------------------------------------------------------- */

const BADGE_TONES = {
  green: 'bg-success-soft text-success ring-success-ring',
  red: 'bg-danger-soft text-danger ring-danger-ring',
  amber: 'bg-warning-soft text-warning ring-warning-ring',
  blue: 'bg-info-soft text-info ring-info-ring',
  purple: 'bg-accent-soft text-accent ring-accent-ring',
  gray: 'bg-ink-100 text-ink-600 ring-ink-300',
}

export type BadgeTone = keyof typeof BADGE_TONES

/** Maps every domain status/priority value to a colour tone. */
export function toneFor(value?: string | null): BadgeTone {
  switch (value) {
    case 'paid':
    case 'active':
    case 'available':
    case 'completed':
    case 'closed':
    case 'resolved':
      return 'green'
    case 'overdue':
    case 'urgent':
    case 'terminated':
    case 'expired':
      return 'red'
    case 'pending':
    case 'partial':
    case 'high':
    case 'maintenance':
    case 'open':
    case 'expiring_soon':
      return 'amber'
    case 'occupied':
    case 'in_progress':
    case 'assigned':
    case 'medium':
      return 'blue'
    case 'admin':
      return 'purple'
    default:
      return 'gray'
  }
}

export function Badge({
  children,
  tone,
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  const key: BadgeTone =
    tone ?? (typeof children === 'string' ? toneFor(children) : 'gray')
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        BADGE_TONES[key],
        className,
      )}
    >
      {typeof children === 'string' ? children.replace(/_/g, ' ') : children}
    </span>
  )
}

/* --------------------------------------------------------------------------
   Form controls — every one supports an inline validation message
   -------------------------------------------------------------------------- */

export function Field({
  label,
  children,
  hint,
  error,
  required,
  className,
}: {
  label: string
  children: ReactNode
  hint?: string
  error?: string
  required?: boolean
  className?: string
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path
              fillRule="evenodd"
              d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 7.5A.9.9 0 1 1 8 9.7a.9.9 0 0 1 0 1.8Z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>
      )}
    </label>
  )
}

const CONTROL =
  'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 transition-colors focus:outline-none focus:ring-2 disabled:bg-ink-100 disabled:text-ink-500'
const CONTROL_OK = 'border-ink-200 focus:border-brand-500 focus:ring-brand-500/25'
const CONTROL_BAD = 'border-danger focus:border-danger focus:ring-danger-ring'

type Invalid = { invalid?: boolean }

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Invalid>(
  ({ className, invalid, ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, invalid ? CONTROL_BAD : CONTROL_OK, className)}
    />
  ),
)
Input.displayName = 'Input'

export const Select = ({
  className,
  invalid,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & Invalid) => (
  <select
    {...props}
    aria-invalid={invalid || undefined}
    className={cx(CONTROL, invalid ? CONTROL_BAD : CONTROL_OK, 'cursor-pointer', className)}
  />
)

export const Textarea = ({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Invalid) => (
  <textarea
    {...props}
    aria-invalid={invalid || undefined}
    className={cx(CONTROL, invalid ? CONTROL_BAD : CONTROL_OK, 'min-h-24 resize-y', className)}
  />
)

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={cx('flex items-start gap-2.5', disabled && 'opacity-60')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 accent-brand-600"
      />
      <span>
        <span className="block text-sm font-medium text-ink-700">{label}</span>
        {description && <span className="block text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  )
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-800">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          checked ? 'bg-brand-600' : 'bg-ink-300',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-ambient transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
          )}
        />
      </button>
    </div>
  )
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cx('relative', className)}>
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
      >
        <circle cx="9" cy="9" r="6" />
        <path strokeLinecap="round" d="m17 17-3.5-3.5" />
      </svg>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M4.7 3.6a.75.75 0 0 0-1.1 1.1L6.9 8l-3.3 3.3a.75.75 0 1 0 1.1 1.1L8 9.1l3.3 3.3a.75.75 0 0 0 1.1-1.1L9.1 8l3.3-3.3a.75.75 0 0 0-1.1-1.1L8 6.9 4.7 3.6Z" />
          </svg>
        </button>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Modal + confirmation
   -------------------------------------------------------------------------- */

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm sm:p-8"
    >
      <div
        className={cx(
          'my-auto w-full rounded-xl border border-ink-200 bg-raised shadow-raised',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-ink-200 bg-sunken px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  busy?: boolean
  error?: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-3">
          <Alert message={error} />
        </div>
      )}
      <div className="flex gap-3">
        <span
          className={cx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-50 text-brand-700',
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
        <div className="text-sm text-ink-600">{message}</div>
      </div>
    </Modal>
  )
}

/* --------------------------------------------------------------------------
   Table
   -------------------------------------------------------------------------- */

export function Table({
  columns,
  children,
  minWidth = 640,
}: {
  columns: ReactNode[]
  children: ReactNode
  minWidth?: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-ink-200 bg-sunken">
            {columns.map((column, index) => (
              <th
                key={index}
                className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-200">{children}</tbody>
      </table>
    </div>
  )
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cx('px-5 py-3.5 align-middle text-ink-700', className)}>{children}</td>
)

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number
  pageCount: number
  total: number
  onChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 px-5 py-3">
      <p className="text-sm text-ink-500">
        Page {page} of {pageCount} · {total} record{total === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Tabs
   -------------------------------------------------------------------------- */

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string; count?: number }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-ink-200 bg-surface p-1">
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cx(
              'flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
              active ? 'bg-brand-600 text-brand-contrast' : 'text-ink-600 hover:bg-ink-100',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cx(
                  'rounded-full px-1.5 py-0.5 text-xs',
                  active ? 'bg-brand-contrast/20' : 'bg-ink-200 text-ink-600',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Detail view helpers
   -------------------------------------------------------------------------- */

export function DetailGrid({ children, columns = 3 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  const map = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }
  return <dl className={cx('grid gap-5 p-5', map[columns])}>{children}</dl>
}

export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-ink-900">
        {value === null || value === undefined || value === '' ? (
          <span className="font-normal text-ink-500">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'brand',
  icon,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'brand' | 'green' | 'amber' | 'red' | 'neutral'
  icon?: ReactNode
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-success-soft text-success',
    amber: 'bg-warning-soft text-warning',
    red: 'bg-danger-soft text-danger',
    neutral: 'bg-ink-100 text-ink-600',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        {icon && (
          <span className={cx('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
      {hint && (
        <span className={cx('mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium', tones[tone])}>
          {hint}
        </span>
      )}
    </Card>
  )
}

/* --------------------------------------------------------------------------
   Progress steps (maintenance workflow tracking)
   -------------------------------------------------------------------------- */

export function ProgressSteps({
  steps,
  current,
}: {
  steps: { key: string; label: string }[]
  current: number
}) {
  return (
    <ol className="flex items-start">
      {steps.map((step, index) => {
        const done = index <= current
        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <span
                className={cx(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  done ? 'bg-brand-600 text-brand-contrast' : 'bg-ink-100 text-ink-600',
                )}
              >
                {index < current ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cx(
                  'mt-1.5 whitespace-nowrap text-xs',
                  done ? 'font-medium text-ink-700' : 'text-ink-500',
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cx('mx-2 mb-5 h-0.5 flex-1', index < current ? 'bg-brand-600' : 'bg-ink-200')}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* --------------------------------------------------------------------------
   Feedback states
   -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string
  message?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 17H7A2 2 0 0 1 5 15V5a2 2 0 0 1 2-2h6l6 6v6a2 2 0 0 1-2 2h-2M13 3v6h6M9 21h6"
            />
          </svg>
        )}
      </div>
      <p className="font-medium text-ink-800">{title}</p>
      {message && <p className="max-w-sm text-sm text-ink-500">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5m0 3.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
        </svg>
      </div>
      <p className="font-medium text-ink-800">Something went wrong</p>
      <p className="max-w-sm text-sm text-ink-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-14 text-sm text-ink-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600" />
      {label}
    </div>
  )
}

/* Skeletons — shown while data loads so the layout does not jump. */

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cx('skeleton', className)} />
)

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-7 w-32" />
          <Skeleton className="mt-3 h-5 w-20 rounded-full" />
        </Card>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="p-5">
      <div className="mb-4 flex gap-4">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cx('h-4 flex-1', colIndex === 0 && 'max-w-[28%]')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <Card>
      <div className="border-b border-ink-200 px-5 py-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-3.5 w-64" />
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index}>
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="mt-2 h-5 w-32" />
          </div>
        ))}
      </div>
    </Card>
  )
}

export function Alert({
  message,
  tone = 'error',
  title,
}: {
  message: ReactNode
  tone?: 'error' | 'success' | 'info' | 'warning'
  title?: string
}) {
  const tones = {
    error: 'border-danger-ring bg-danger-soft text-danger',
    success: 'border-success-ring bg-success-soft text-success',
    info: 'border-info-ring bg-info-soft text-info',
    warning: 'border-warning-ring bg-warning-soft text-warning',
  }
  return (
    <div role="alert" className={cx('rounded-lg border px-3.5 py-2.5 text-sm', tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {message}
    </div>
  )
}
