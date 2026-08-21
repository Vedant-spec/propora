import { Link } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { Button } from '../components/ui'

export default function SessionExpired() {
  return (
    <AuthShell
      title="Your session has ended"
      subtitle="For your security, PROPORA signs you out after a period of inactivity."
      footer="Sessions last 12 hours, or until you sign out of all devices."
    >
      <div className="mt-8 space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-warning-ring bg-warning-soft px-4 py-3.5 text-sm text-warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 h-5 w-5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 2.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
          </svg>
          <p>
            Any unsaved changes on the previous screen were not submitted. Sign in again to pick up
            where you left off.
          </p>
        </div>

        <Link to="/login">
          <Button className="w-full">Sign in again</Button>
        </Link>

        <Link to="/">
          <Button variant="secondary" className="w-full">
            Back to home
          </Button>
        </Link>
      </div>
    </AuthShell>
  )
}
