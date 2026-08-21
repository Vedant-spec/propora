import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { api, readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { formatDate, formatMonth, money } from '../lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchBar,
  Select,
  StatCard,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Textarea,
} from '../components/ui'
import type { Lease, Payment, Property } from '../lib/types'

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online payment' },
]

const today = new Date().toISOString().slice(0, 10)

export default function Payments() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [status, setStatus] = useState(params.get('status') ?? 'all')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('')
  const [method, setMethod] = useState('all')
  const [propertyId, setPropertyId] = useState(params.get('property') ?? '')
  const leaseId = params.get('lease') ?? ''

  const { data, loading, error, reload } = useResource<Payment[]>('/payments', {
    status,
    search,
    period,
    method,
    property_id: propertyId,
    lease_id: leaseId,
  })
  const { data: properties } = useResource<Property[]>('/properties')
  const { data: leases } = useResource<Lease[]>('/leases', { status: 'active' })

  const [recording, setRecording] = useState<Payment | null>(null)
  const [creating, setCreating] = useState<Partial<Payment> | null>(null)
  const [recordForm, setRecordForm] = useState({
    amount: 0,
    method: 'upi',
    reference: '',
    paid_date: today,
    notes: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => {
    const rows = data ?? []
    const billed = rows.reduce((sum, row) => sum + row.amount, 0)
    const collected = rows.reduce((sum, row) => sum + row.amount_paid, 0)
    return {
      billed,
      collected,
      outstanding: billed - collected,
      overdue: rows.filter((row) => row.status === 'overdue').length,
    }
  }, [data])

  const changeStatus = (value: string) => {
    setStatus(value)
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('status')
    else next.set('status', value)
    setParams(next, { replace: true })
  }

  const openRecord = (payment: Payment) => {
    setRecording(payment)
    setRecordForm({
      amount: payment.balance,
      method: payment.method ?? 'upi',
      reference: payment.reference ?? '',
      paid_date: today,
      notes: '',
    })
    setErrors({})
    setFormError('')
  }

  const submitRecord = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!recording) return
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      await api(`/payments/${recording.id}/record`, { method: 'POST', body: recordForm })
      setRecording(null)
      toast.success('Payment recorded')
      await reload()
    } catch (err) {
      const parsed = readError(err)
      setFormError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSaving(false)
    }
  }

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!creating) return
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      await api('/payments', { method: 'POST', body: creating })
      setCreating(null)
      toast.success('Invoice created')
      await reload()
    } catch (err) {
      const parsed = readError(err)
      setFormError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Rent & payments"
        subtitle="Every rent invoice, what has been collected and what is still due."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/payments/dashboard">
              <Button variant="secondary">Payment dashboard</Button>
            </Link>
            <Button
              onClick={() => {
                setErrors({})
                setFormError('')
                setCreating({ due_date: today, amount: 0 })
              }}
            >
              + Add invoice
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Billed" value={money(summary.billed)} tone="neutral" />
        <StatCard label="Collected" value={money(summary.collected)} tone="green" />
        <StatCard
          label="Outstanding"
          value={money(summary.outstanding)}
          tone={summary.outstanding > 0 ? 'amber' : 'green'}
        />
        <StatCard
          label="Overdue invoices"
          value={summary.overdue}
          tone={summary.overdue ? 'red' : 'green'}
        />
      </div>

      <Tabs
        value={status}
        onChange={changeStatus}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'paid', label: 'Paid' },
          { value: 'pending', label: 'Pending' },
          { value: 'partial', label: 'Partial' },
          { value: 'overdue', label: 'Overdue' },
        ]}
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search tenant, property or reference…"
            className="lg:col-span-2"
          />
          <Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
          <Select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="all">All methods</option>
            {METHODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
            className="lg:col-span-2"
          >
            <option value="">All properties</option>
            {(properties ?? []).map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center text-sm text-ink-500 lg:col-span-2">
            {data ? `${data.length} invoice${data.length === 1 ? '' : 's'}` : ''}
            {leaseId && (
              <Link to="/payments" className="ml-2 text-brand-600 hover:underline">
                Clear lease filter
              </Link>
            )}
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <TableSkeleton rows={8} columns={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No invoices match"
            message="Adjust the filters, or generate invoices from a lease."
          />
        ) : (
          <Table
            columns={['Payment ID', 'Tenant', 'Property', 'Due', 'Billed', 'Paid', 'Balance', 'Status', '']}
            minWidth={1040}
          >
            {data.map((payment) => (
              <tr key={payment.id} className="hover:bg-ink-100/60">
                <Td>
                  <Link
                    to={`/payments/${payment.id}`}
                    className="font-mono text-xs font-medium text-brand-600 hover:underline"
                  >
                    {payment.payment_code}
                  </Link>
                  <div className="text-xs text-ink-500">{formatMonth(payment.period)}</div>
                </Td>
                <Td>
                  <Link to={`/tenants/${payment.tenant_id}`} className="hover:text-brand-600 hover:underline">
                    {payment.tenant_name}
                  </Link>
                </Td>
                <Td className="text-sm">{payment.property_name}</Td>
                <Td>
                  <div className="text-xs">{formatDate(payment.due_date)}</div>
                  {payment.paid_date ? (
                    <span className="text-xs text-success">paid {formatDate(payment.paid_date)}</span>
                  ) : payment.days_overdue ? (
                    <span className="text-xs text-danger">{payment.days_overdue} days late</span>
                  ) : null}
                </Td>
                <Td>{money(payment.amount)}</Td>
                <Td className="text-success">{money(payment.amount_paid)}</Td>
                <Td className={payment.balance > 0 ? 'font-medium text-warning' : 'text-ink-400'}>
                  {money(payment.balance)}
                </Td>
                <Td>
                  <Badge>{payment.status}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-right">
                  {payment.status !== 'paid' && (
                    <Button size="sm" variant="secondary" onClick={() => openRecord(payment)}>
                      Record
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Record payment */}
      <Modal
        open={Boolean(recording)}
        title="Record payment"
        subtitle={recording ? `${recording.tenant_name} · ${formatMonth(recording.period)}` : undefined}
        onClose={() => setRecording(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRecording(null)}>
              Cancel
            </Button>
            <Button form="record-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Record payment'}
            </Button>
          </>
        }
      >
        <form id="record-form" onSubmit={submitRecord} className="space-y-4" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <div className="rounded-lg bg-sunken p-4 text-sm">
            <p className="font-medium text-ink-900">{recording?.tenant_name}</p>
            <p className="text-ink-500">{recording?.property_name}</p>
            <p className="mt-2 text-ink-600">
              Billed {money(recording?.amount)} · Outstanding{' '}
              <strong className="text-warning">{money(recording?.balance)}</strong>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount received (₹)" required error={errors.amount}>
              <Input
                type="number"
                min={0}
                step="0.01"
                required
                invalid={Boolean(errors.amount)}
                value={recordForm.amount}
                onChange={(event) => setRecordForm({ ...recordForm, amount: Number(event.target.value) })}
              />
            </Field>
            <Field label="Paid on" error={errors.paid_date}>
              <Input
                type="date"
                value={recordForm.paid_date}
                onChange={(event) => setRecordForm({ ...recordForm, paid_date: event.target.value })}
              />
            </Field>
            <Field label="Payment method" error={errors.method}>
              <Select
                invalid={Boolean(errors.method)}
                value={recordForm.method}
                onChange={(event) => setRecordForm({ ...recordForm, method: event.target.value })}
              >
                {METHODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Transaction ID">
              <Input
                value={recordForm.reference}
                onChange={(event) => setRecordForm({ ...recordForm, reference: event.target.value })}
                placeholder="TXN123456"
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea
                value={recordForm.notes}
                onChange={(event) => setRecordForm({ ...recordForm, notes: event.target.value })}
              />
            </Field>
          </div>
        </form>
      </Modal>

      {/* Manual invoice */}
      <Modal
        open={Boolean(creating)}
        title="Add invoice"
        subtitle="Raise a one-off rent invoice against a lease"
        onClose={() => setCreating(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(null)}>
              Cancel
            </Button>
            <Button form="invoice-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create invoice'}
            </Button>
          </>
        }
      >
        <form id="invoice-form" onSubmit={submitCreate} className="space-y-4" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <Field label="Lease" required error={errors.lease_id}>
            <Select
              required
              invalid={Boolean(errors.lease_id)}
              value={creating?.lease_id ?? ''}
              onChange={(event) => {
                const id = Number(event.target.value)
                const lease = leases?.find((item) => item.id === id)
                setCreating((prev) => ({ ...prev, lease_id: id, amount: lease?.rent_amount ?? 0 }))
              }}
            >
              <option value="">Select a lease…</option>
              {(leases ?? []).map((lease) => (
                <option key={lease.id} value={lease.id}>
                  {lease.tenant_name} — {lease.property_name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (₹)" required error={errors.amount}>
              <Input
                type="number"
                min={0}
                required
                invalid={Boolean(errors.amount)}
                value={creating?.amount ?? 0}
                onChange={(event) =>
                  setCreating((prev) => ({ ...prev, amount: Number(event.target.value) }))
                }
              />
            </Field>
            <Field label="Due date" required error={errors.due_date}>
              <Input
                type="date"
                required
                invalid={Boolean(errors.due_date)}
                value={creating?.due_date ?? today}
                onChange={(event) => setCreating((prev) => ({ ...prev, due_date: event.target.value }))}
              />
            </Field>
            <Field
              label="Period"
              className="sm:col-span-2"
              hint="Defaults to the month of the due date."
            >
              <Input
                type="month"
                value={creating?.period ?? ''}
                onChange={(event) => setCreating((prev) => ({ ...prev, period: event.target.value }))}
              />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  )
}
