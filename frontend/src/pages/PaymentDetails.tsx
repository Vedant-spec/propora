import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { api, readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { formatDate, formatDateTime, formatMonth, money, titleCase } from '../lib/format'
import BackLink from '../components/BackLink'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Detail,
  DetailGrid,
  DetailSkeleton,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Table,
  Td,
  Textarea,
} from '../components/ui'
import type { Lease, Payment } from '../lib/types'

interface PaymentDetail extends Payment {
  lease: Lease | null
  lease_history: Payment[]
}

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online payment' },
]

const today = new Date().toISOString().slice(0, 10)

export default function PaymentDetails() {
  const { id } = useParams()
  const toast = useToast()
  const { data, loading, error, reload } = useResource<PaymentDetail>(`/payments/${id}`)

  const [recording, setRecording] = useState(false)
  const [form, setForm] = useState({
    amount: 0,
    method: 'upi',
    reference: '',
    paid_date: today,
    notes: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading) return <DetailSkeleton />
  if (error) return <Alert message={error} />
  if (!data) return null

  const openRecord = () => {
    setForm({
      amount: data.balance,
      method: data.method ?? 'upi',
      reference: data.reference ?? '',
      paid_date: today,
      notes: '',
    })
    setErrors({})
    setFormError('')
    setRecording(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      await api(`/payments/${id}/record`, { method: 'POST', body: form })
      setRecording(false)
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

  return (
    <>
      <PageHeader
        back={<BackLink to="/payments" label="All payments" />}
        title={`Payment ${data.payment_code}`}
        subtitle={`${data.tenant_name} · ${formatMonth(data.period)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge>{data.status}</Badge>
            {data.status !== 'paid' && <Button size="sm" onClick={openRecord}>Record payment</Button>}
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Amount billed" value={money(data.amount)} tone="neutral" />
        <StatCard label="Amount paid" value={money(data.amount_paid)} tone="green" />
        <StatCard
          label="Balance"
          value={money(data.balance)}
          tone={data.balance > 0 ? 'amber' : 'green'}
        />
        <StatCard
          label="Due date"
          value={formatDate(data.due_date)}
          hint={data.days_overdue ? `${data.days_overdue} days overdue` : 'Within terms'}
          tone={data.days_overdue ? 'red' : 'green'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Transaction information" />
            <DetailGrid>
              <Detail label="Payment ID" value={data.payment_code} />
              <Detail label="Period" value={formatMonth(data.period)} />
              <Detail label="Due date" value={formatDate(data.due_date)} />
              <Detail label="Payment date" value={formatDate(data.paid_date)} />
              <Detail label="Payment method" value={data.method ? titleCase(data.method) : null} />
              <Detail label="Transaction ID" value={data.reference} />
              <Detail label="Status" value={<Badge>{data.status}</Badge>} />
              <Detail label="Raised on" value={formatDateTime(data.created_at)} />
            </DetailGrid>
          </Card>

          {data.notes && (
            <Card>
              <CardHeader title="Notes" />
              <p className="whitespace-pre-line px-5 py-4 text-sm text-ink-600">{data.notes}</p>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Payment history for this lease"
              subtitle="Most recent invoices first"
              action={
                data.lease_id ? (
                  <Link to={`/leases/${data.lease_id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    View lease
                  </Link>
                ) : undefined
              }
            />
            <Table columns={['Period', 'Due', 'Billed', 'Paid', 'Status']} minWidth={520}>
              {data.lease_history.map((item) => (
                <tr
                  key={item.id}
                  className={item.id === data.id ? 'bg-brand-50/50' : 'hover:bg-ink-100/60'}
                >
                  <Td>
                    <Link to={`/payments/${item.id}`} className="font-medium text-brand-600 hover:underline">
                      {formatMonth(item.period)}
                    </Link>
                  </Td>
                  <Td className="text-xs">{formatDate(item.due_date)}</Td>
                  <Td>{money(item.amount)}</Td>
                  <Td className="text-success">{money(item.amount_paid)}</Td>
                  <Td>
                    <Badge>{item.status}</Badge>
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Tenant" />
            <div className="p-5">
              <Link to={`/tenants/${data.tenant_id}`} className="font-medium text-brand-600 hover:underline">
                {data.tenant_name}
              </Link>
              {data.tenant_email && <p className="mt-1 text-sm text-ink-500">{data.tenant_email}</p>}
              {data.tenant_phone && <p className="text-sm text-ink-500">{data.tenant_phone}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Property" />
            <div className="p-5">
              <Link to={`/properties/${data.property_id}`} className="font-medium text-brand-600 hover:underline">
                {data.property_name}
              </Link>
              <p className="mt-1 text-sm text-ink-500">{data.property_address}</p>
            </div>
          </Card>

          {data.status !== 'paid' && (
            <Card>
              <CardHeader title="Settle this invoice" />
              <div className="p-5">
                <p className="mb-3 text-sm text-ink-500">
                  Outstanding balance of{' '}
                  <strong className="text-warning">{money(data.balance)}</strong>.
                </p>
                <Button className="w-full" onClick={openRecord}>
                  Record payment
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={recording}
        title="Record payment"
        subtitle={`${data.tenant_name} · ${formatMonth(data.period)}`}
        onClose={() => setRecording(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRecording(false)}>
              Cancel
            </Button>
            <Button form="record-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Record payment'}
            </Button>
          </>
        }
      >
        <form id="record-form" onSubmit={submit} className="space-y-4" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <div className="rounded-lg bg-sunken p-4 text-sm">
            <p className="text-ink-600">
              Billed {money(data.amount)} · Outstanding{' '}
              <strong className="text-warning">{money(data.balance)}</strong>
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
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
              />
            </Field>
            <Field label="Paid on" error={errors.paid_date}>
              <Input
                type="date"
                value={form.paid_date}
                onChange={(event) => setForm({ ...form, paid_date: event.target.value })}
              />
            </Field>
            <Field label="Payment method" error={errors.method}>
              <Select
                invalid={Boolean(errors.method)}
                value={form.method}
                onChange={(event) => setForm({ ...form, method: event.target.value })}
              >
                {METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Transaction ID">
              <Input
                value={form.reference}
                onChange={(event) => setForm({ ...form, reference: event.target.value })}
                placeholder="TXN123456"
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  )
}
