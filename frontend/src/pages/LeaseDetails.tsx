import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { api, readError } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { formatDate, formatMonth, money } from '../lib/format'
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
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  StatCard,
  Table,
  Td,
} from '../components/ui'
import type { Lease, Payment } from '../lib/types'

interface LeaseDetail extends Lease {
  payments: Payment[]
  totals: { billed: number; collected: number; outstanding: number }
}

export default function LeaseDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, loading, error, reload } = useResource<LeaseDetail>(`/leases/${id}`)

  const [renewing, setRenewing] = useState(false)
  const [months, setMonths] = useState(12)
  const [newRent, setNewRent] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)

  if (loading) return <DetailSkeleton />
  if (error) return <Alert message={error} />
  if (!data) return null

  const renew = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await api<{ invoices_created: number }>(`/leases/${id}/renew`, {
        method: 'POST',
        body: { months, ...(newRent === '' ? {} : { rent_amount: newRent }) },
      })
      setRenewing(false)
      toast.success(`Lease renewed · ${result.invoices_created} new invoice(s)`)
      await reload()
    } catch (err) {
      toast.error(readError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const generateInvoices = async () => {
    try {
      const result = await api<{ message: string }>(`/leases/${id}/schedule`, { method: 'POST' })
      toast.success(result.message)
      await reload()
    } catch (err) {
      toast.error(readError(err).message)
    }
  }

  const termMonths = Math.max(
    1,
    Math.round(
      (new Date(data.end_date).getTime() - new Date(data.start_date).getTime()) / (30 * 864e5),
    ),
  )

  return (
    <>
      <PageHeader
        back={<BackLink to="/leases" label="All leases" />}
        title={`Lease ${data.lease_code}`}
        subtitle={`${data.tenant_name} at ${data.property_name}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge>{data.lease_state}</Badge>
            <Button size="sm" variant="secondary" onClick={generateInvoices}>
              Generate invoices
            </Button>
            <Button size="sm" onClick={() => setRenewing(true)}>
              Renew lease
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Monthly rent" value={money(data.rent_amount)} hint={`Due on the ${data.rent_due_day}th`} />
        <StatCard label="Billed to date" value={money(data.totals.billed)} tone="neutral" />
        <StatCard label="Collected" value={money(data.totals.collected)} tone="green" />
        <StatCard
          label="Outstanding"
          value={money(data.totals.outstanding)}
          tone={data.totals.outstanding > 0 ? 'amber' : 'green'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Lease information" />
            <DetailGrid>
              <Detail label="Lease ID" value={data.lease_code} />
              <Detail label="Start date" value={formatDate(data.start_date)} />
              <Detail label="End date" value={formatDate(data.end_date)} />
              <Detail label="Total term" value={`${termMonths} months`} />
              <Detail
                label="Days remaining"
                value={
                  data.days_remaining !== null && data.days_remaining !== undefined
                    ? data.days_remaining >= 0
                      ? `${data.days_remaining} days`
                      : `Expired ${Math.abs(data.days_remaining)} days ago`
                    : null
                }
              />
              <Detail label="Rent due day" value={`Day ${data.rent_due_day} of each month`} />
              <Detail label="Monthly rent" value={money(data.rent_amount)} />
              <Detail label="Security deposit" value={money(data.deposit_amount)} />
              <Detail label="Status" value={<Badge>{data.lease_state}</Badge>} />
            </DetailGrid>
          </Card>

          {data.terms && (
            <Card>
              <CardHeader title="Additional terms" />
              <p className="whitespace-pre-line px-5 py-4 text-sm text-ink-600">{data.terms}</p>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Rent schedule"
              subtitle={`${data.payments.length} invoice${data.payments.length === 1 ? '' : 's'}`}
              action={
                <Link
                  to={`/payments?lease=${data.id}`}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  Open in payments
                </Link>
              }
            />
            {data.payments.length === 0 ? (
              <EmptyState
                title="No invoices yet"
                message="Generate the monthly rent schedule for this lease."
                action={<Button size="sm" onClick={generateInvoices}>Generate invoices</Button>}
              />
            ) : (
              <Table columns={['Period', 'Due', 'Billed', 'Paid', 'Balance', 'Status']} minWidth={600}>
                {data.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-ink-100/60">
                    <Td>
                      <Link to={`/payments/${payment.id}`} className="font-medium text-brand-600 hover:underline">
                        {formatMonth(payment.period)}
                      </Link>
                    </Td>
                    <Td className="text-xs">{formatDate(payment.due_date)}</Td>
                    <Td>{money(payment.amount)}</Td>
                    <Td className="text-success">{money(payment.amount_paid)}</Td>
                    <Td className={payment.balance > 0 ? 'font-medium text-warning' : 'text-ink-400'}>
                      {money(payment.balance)}
                    </Td>
                    <Td>
                      <Badge>{payment.status}</Badge>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Tenant" />
            <div className="p-5">
              <Link
                to={`/tenants/${data.tenant_id}`}
                className="font-medium text-brand-600 hover:underline"
              >
                {data.tenant_name}
              </Link>
              {data.tenant_email && <p className="mt-1 text-sm text-ink-500">{data.tenant_email}</p>}
              {data.tenant_phone && <p className="text-sm text-ink-500">{data.tenant_phone}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Property" />
            <div className="p-5">
              <Link
                to={`/properties/${data.property_id}`}
                className="font-medium text-brand-600 hover:underline"
              >
                {data.property_name}
              </Link>
              <p className="mt-1 text-sm text-ink-500">{data.property_address}</p>
              {data.property_code && (
                <p className="mt-2 font-mono text-xs text-ink-400">{data.property_code}</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Actions" />
            <div className="space-y-2 p-5">
              <Button variant="secondary" className="w-full" onClick={() => navigate('/leases')}>
                Edit lease
              </Button>
              <Button variant="secondary" className="w-full" onClick={generateInvoices}>
                Top up rent schedule
              </Button>
              <Button className="w-full" onClick={() => setRenewing(true)}>
                Renew lease
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={renewing}
        title="Renew lease"
        subtitle={`Extend the agreement for ${data.tenant_name}`}
        onClose={() => setRenewing(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenewing(false)}>
              Cancel
            </Button>
            <Button form="renew-form" type="submit" disabled={saving}>
              {saving ? 'Renewing…' : 'Renew lease'}
            </Button>
          </>
        }
      >
        <form id="renew-form" onSubmit={renew} className="space-y-4">
          <div className="rounded-lg bg-sunken p-4 text-sm">
            <p className="text-ink-600">
              Current term ends <strong className="text-ink-900">{formatDate(data.end_date)}</strong>.
            </p>
          </div>
          <Field label="Extend by (months)" required hint="Between 1 and 60 months.">
            <Input
              type="number"
              min={1}
              max={60}
              required
              value={months}
              onChange={(event) => setMonths(Number(event.target.value))}
            />
          </Field>
          <Field label="Revised monthly rent (₹)" hint="Leave blank to keep the current rent.">
            <Input
              type="number"
              min={0}
              value={newRent}
              onChange={(event) => setNewRent(event.target.value === '' ? '' : Number(event.target.value))}
              placeholder={String(data.rent_amount)}
            />
          </Field>
          <Alert
            tone="info"
            message="Renewing extends the end date and generates rent invoices for the new months."
          />
        </form>
      </Modal>
    </>
  )
}
