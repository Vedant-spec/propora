import { useState } from 'react'
import { resetDemo } from '../demo/backend'
import { ConfirmModal } from './ui'

/**
 * Shown only in the hosted demo. Explains that data lives in this browser and
 * offers a way back to the original seeded portfolio.
 */
export default function DemoBanner() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setBusy(true)
    resetDemo()
    localStorage.removeItem('propora.demo.session')
    window.location.reload()
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-brand-200 bg-brand-50 px-4 py-2 text-center text-xs text-brand-700">
        <span className="font-semibold">Interactive demo</span>
        <span className="opacity-80">
          Everything works — add, edit and delete freely. Data is saved in your browser only, so
          you have your own private copy.
        </span>
        <button
          onClick={() => setOpen(true)}
          className="font-semibold underline underline-offset-2 hover:opacity-80"
        >
          Reset demo data
        </button>
      </div>

      <ConfirmModal
        open={open}
        title="Reset the demo"
        message="This restores the original 12 properties, 8 tenants and all invoices, discarding anything you have changed in this browser."
        confirmLabel="Reset demo data"
        tone="primary"
        busy={busy}
        onConfirm={reset}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
