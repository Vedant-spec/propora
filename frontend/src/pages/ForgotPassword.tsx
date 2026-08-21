import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import AuthShell from '../components/AuthShell'
import { Alert, Button, Field, Input } from '../components/ui'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [expiry, setExpiry] = useState(30)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setErrors({})
    setSubmitting(true)
    try {
      const result = await api<{ expires_in_minutes?: number }>('/auth/forgot-password', {
        method: 'POST',
        body: { email },
        silent401: true,
      })
      setExpiry(result.expires_in_minutes ?? 30)
      setSent(true)
    } catch (err) {
      const parsed = readError(err)
      setError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`If ${email} is registered, a password reset link is on its way.`}
        footer={
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="mt-8 space-y-4">
          <Alert tone="success" message="Reset link sent." />

          <div className="rounded-lg border border-ink-200 bg-sunken p-4 text-sm text-ink-600">
            <p className="font-medium text-ink-900">What happens next</p>
            <ol className="mt-2.5 space-y-2">
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  1
                </span>
                Open the email from PROPORA and select <strong>Reset my password</strong>.
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  2
                </span>
                Choose a new password — at least 6 characters.
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  3
                </span>
                Sign in with it. Any other active sessions are signed out.
              </li>
            </ol>
            <p className="mt-3.5 border-t border-ink-200 pt-3 text-xs text-ink-500">
              The link expires in {expiry} minutes and can only be used once. Nothing arrived?
              Check your spam folder, or request another link below.
            </p>
          </div>

          <Button variant="secondary" className="w-full" onClick={() => setSent(false)}>
            Send to a different email
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we will send a link to set a new one."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Back to sign in
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
            autoFocus
            required
            invalid={Boolean(errors.email)}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
          />
        </Field>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthShell>
  )
}
