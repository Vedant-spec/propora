import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import AuthShell from '../components/AuthShell'
import { Alert, Button, Field, Input, Spinner } from '../components/ui'

/** Simple strength meter so the user gets feedback before submitting. */
function strengthOf(password: string) {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.min(score, 4)
}

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
const BARS = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-info', 'bg-success']

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [checking, setChecking] = useState(true)
  const [valid, setValid] = useState(false)
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setChecking(false)
      return
    }
    api<{ valid: boolean; name: string; email: string }>(`/auth/reset-password/${token}`, {
      silent401: true,
    })
      .then((result) => {
        setValid(result.valid)
        setAccount({ name: result.name, email: result.email })
      })
      .catch(() => setValid(false))
      .finally(() => setChecking(false))
  }, [token])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setErrors({})

    if (password !== confirm) {
      setErrors({ confirm_password: 'Passwords do not match' })
      return
    }

    setSubmitting(true)
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token, new_password: password, confirm_password: confirm },
        silent401: true,
      })
      setDone(true)
      window.setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err) {
      const parsed = readError(err)
      setError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <AuthShell title="Checking your link">
        <Spinner label="Verifying reset link…" />
      </AuthShell>
    )
  }

  if (!token || !valid) {
    return (
      <AuthShell
        title="Link expired"
        subtitle="This password reset link is invalid or has already been used."
        footer={
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="mt-8 space-y-4">
          <Alert
            tone="warning"
            message="Reset links are valid for 30 minutes and can only be used once."
          />
          <Link to="/forgot-password">
            <Button className="w-full">Request a new link</Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can sign in with your new password.">
        <div className="mt-8 space-y-4">
          <Alert tone="success" message="Taking you to the sign-in screen…" />
          <Link to="/login">
            <Button className="w-full">Sign in now</Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  const score = strengthOf(password)

  return (
    <AuthShell
      title="Set a new password"
      subtitle={account ? `Resetting the password for ${account.email}` : undefined}
      footer={
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {error && !Object.keys(errors).length && <Alert message={error} />}

        <Field label="New password" required error={errors.new_password} hint="At least 6 characters.">
          <Input
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            invalid={Boolean(errors.new_password)}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {password && (
          <div>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    index < score ? BARS[score] : 'bg-ink-200'
                  }`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-500">Strength: {LABELS[score]}</p>
          </div>
        )}

        <Field label="Confirm new password" required error={errors.confirm_password}>
          <Input
            type="password"
            autoComplete="new-password"
            required
            invalid={Boolean(errors.confirm_password)}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Updating…' : 'Reset password'}
        </Button>
      </form>
    </AuthShell>
  )
}
