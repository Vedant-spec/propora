import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import AuthShell from '../components/AuthShell'
import { Alert, Button, Field, Input } from '../components/ui'

interface OtpRequestResult {
  message: string
  expires_in_minutes: number
  resend_in_seconds: number
  sms_configured: boolean
  /** Only present when no SMS gateway is connected — see the backend. */
  demo_code?: string
}

const CODE_LENGTH = 6

export default function PhoneLogin() {
  const { user, loading, verifyOtp } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState<OtpRequestResult | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  // Count the resend cooldown down so the button says when it will work.
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  if (loading) return null
  if (user) return <Navigate to={user.role === 'tenant' ? '/portal' : '/dashboard'} replace />

  const requestCode = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setError('')
    setErrors({})
    setSubmitting(true)
    try {
      const result = await api<OtpRequestResult>('/auth/otp/request', {
        method: 'POST',
        body: { phone },
        silent401: true,
      })
      setSent(result)
      setCooldown(result.resend_in_seconds ?? 60)
      setStep('code')
      setCode('')
    } catch (err) {
      const parsed = readError(err)
      setError(parsed.message)
      setErrors(parsed.errors)
      // A 429 carries the remaining cooldown in its message; keep the user on
      // the code step rather than bouncing them back.
      if (parsed.message.includes('just sent')) setStep('code')
    } finally {
      setSubmitting(false)
    }
  }

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setErrors({})
    setSubmitting(true)
    try {
      const signedIn = await verifyOtp(phone, code)
      navigate(signedIn.role === 'tenant' ? '/portal' : '/dashboard', { replace: true })
    } catch (err) {
      const parsed = readError(err)
      setError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSubmitting(false)
    }
  }

  const footer = (
    <>
      Prefer a password?{' '}
      <Link to="/login" className="font-medium text-brand-600 hover:underline">
        Sign in with email
      </Link>
    </>
  )

  if (step === 'phone') {
    return (
      <AuthShell
        title="Sign in with your mobile"
        subtitle="We will send a one-time code to your registered number."
        footer={footer}
      >
        <form onSubmit={requestCode} className="mt-8 space-y-4" noValidate>
          {error && !Object.keys(errors).length && <Alert message={error} />}

          <Field label="Mobile number" required error={errors.phone}>
            <Input
              type="tel"
              autoFocus
              required
              autoComplete="tel"
              inputMode="tel"
              invalid={Boolean(errors.phone)}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98200 41122"
            />
          </Field>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Sending code…' : 'Send code'}
          </Button>

          <p className="text-center text-xs text-ink-500">
            Only numbers already on an account can receive a code.
          </p>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Enter your code"
      subtitle={`We sent a ${CODE_LENGTH}-digit code to ${phone}.`}
      footer={footer}
    >
      <form onSubmit={submitCode} className="mt-8 space-y-4" noValidate>
        {error && !Object.keys(errors).length && <Alert message={error} />}

        {sent?.demo_code && (
          <Alert
            tone="info"
            title="No SMS gateway connected"
            message={
              <span className="mt-1 block">
                Your code is{' '}
                <strong className="font-mono text-base tracking-widest">{sent.demo_code}</strong>.
                Connect an SMS provider and this is sent by text instead.
              </span>
            }
          />
        )}

        <Field label="Verification code" required error={errors.code}>
          <Input
            ref={codeRef}
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            invalid={Boolean(errors.code)}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="text-center text-lg tracking-[0.5em] font-mono"
          />
        </Field>

        <Button
          type="submit"
          disabled={submitting || code.length < CODE_LENGTH}
          className="w-full"
        >
          {submitting ? 'Verifying…' : 'Verify and sign in'}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setStep('phone')
              setError('')
              setErrors({})
            }}
            className="font-medium text-ink-500 hover:text-ink-800"
          >
            Change number
          </button>
          <button
            type="button"
            disabled={cooldown > 0 || submitting}
            onClick={() => requestCode()}
            className="font-medium text-brand-600 hover:underline disabled:text-ink-400 disabled:no-underline"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>

        <p className="text-center text-xs text-ink-500">
          The code expires in {sent?.expires_in_minutes ?? 5} minutes.
        </p>
      </form>
    </AuthShell>
  )
}
