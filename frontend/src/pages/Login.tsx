import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import AuthShell from '../components/AuthShell'
import { Alert, Button, Field, Input, Spinner } from '../components/ui'

const DEMO_ACCOUNTS = [
  { label: 'Administrator', email: 'admin@propora.app', password: 'admin123' },
  { label: 'Property manager', email: 'manager@propora.app', password: 'manager123' },
  { label: 'Tenant', email: 'aarav.sharma@example.com', password: 'tenant123' },
]

export default function Login() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <Spinner label="Checking your session…" />
  if (user) return <Navigate to={user.role === 'tenant' ? '/portal' : '/dashboard'} replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setErrors({})
    setSubmitting(true)
    try {
      const signedIn = await login(email, password)
      navigate(signedIn.role === 'tenant' ? '/portal' : '/dashboard', { replace: true })
    } catch (err) {
      const parsed = readError(err)
      setError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSubmitting(false)
    }
  }

  const useDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email)
    setPassword(account.password)
    setError('')
    setErrors({})
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your PROPORA account to continue."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {error && !Object.keys(errors).length && <Alert message={error} />}

        <Field label="Email address" required error={errors.email}>
          <Input
            type="email"
            autoComplete="username"
            required
            invalid={Boolean(errors.email)}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
          />
        </Field>

        <Field label="Password" required error={errors.password}>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              invalid={Boolean(errors.password)}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-[18px] w-[18px]">
                {showPassword ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-2.4 3.4M6.2 6.6A11.6 11.6 0 0 0 3 12c0 2.5 4 7 9 7 1.3 0 2.5-.3 3.6-.8"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Zm9 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                  />
                )}
              </svg>
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-ink-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-ink-400">or</span>
          <span className="h-px flex-1 bg-ink-200" />
        </div>

        <Link to="/login/phone">
          <Button type="button" variant="secondary" className="w-full">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm4 14h2" />
            </svg>
            Sign in with a mobile code
          </Button>
        </Link>
      </form>

      <div className="mt-8 rounded-lg border border-ink-200 bg-sunken p-4">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Demo accounts
        </p>
        <div className="space-y-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => useDemo(account)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface"
            >
              <span className="font-medium text-ink-700">{account.label}</span>
              <span className="truncate text-xs text-ink-500">{account.email}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  )
}
