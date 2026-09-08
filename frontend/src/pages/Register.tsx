import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import AuthShell from '../components/AuthShell'
import { Alert, Button, Field, Input } from '../components/ui'

/** Simple strength meter so the choice gets feedback before submitting. */
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

export default function Register() {
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (user) return <Navigate to={user.role === 'tenant' ? '/portal' : '/dashboard'} replace />

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setErrors({})
    setSubmitting(true)
    try {
      const result = await register(form)
      navigate('/portal', {
        replace: true,
        state: { linked: result.linked_to_existing_tenant },
      })
    } catch (err) {
      const parsed = readError(err)
      setError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSubmitting(false)
    }
  }

  const score = strengthOf(form.password)

  return (
    <AuthShell
      title="Create your account"
      subtitle="For tenants. Property staff accounts are created by an administrator."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {error && !Object.keys(errors).length && <Alert message={error} />}

        <Field label="Full name" required error={errors.name}>
          <Input
            autoFocus
            required
            autoComplete="name"
            invalid={Boolean(errors.name)}
            value={form.name}
            onChange={(event) => set({ name: event.target.value })}
            placeholder="Aarav Sharma"
          />
        </Field>

        <Field
          label="Email address"
          required
          error={errors.email}
          hint="If your property manager already added you, use the same email to pick up your lease."
        >
          <Input
            type="email"
            required
            autoComplete="username"
            invalid={Boolean(errors.email)}
            value={form.email}
            onChange={(event) => set({ email: event.target.value })}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="Mobile number"
          error={errors.phone}
          hint="Optional — add it to sign in with a code instead of a password."
        >
          <Input
            type="tel"
            autoComplete="tel"
            invalid={Boolean(errors.phone)}
            value={form.phone}
            onChange={(event) => set({ phone: event.target.value })}
            placeholder="+91 98200 41122"
          />
        </Field>

        <Field label="Password" required error={errors.password} hint="At least 6 characters.">
          <Input
            type="password"
            required
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            value={form.password}
            onChange={(event) => set({ password: event.target.value })}
          />
        </Field>

        {form.password && (
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

        <Field label="Confirm password" required error={errors.confirm_password}>
          <Input
            type="password"
            required
            autoComplete="new-password"
            invalid={Boolean(errors.confirm_password)}
            value={form.confirm_password}
            onChange={(event) => set({ confirm_password: event.target.value })}
          />
        </Field>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="text-center text-xs text-ink-500">
          Your password is stored hashed, never in plain text.
        </p>
      </form>
    </AuthShell>
  )
}
