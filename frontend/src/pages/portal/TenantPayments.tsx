import { useMemo } from 'react'
import { useResource } from '../../hooks/useResource'
import { formatDate, formatMonth, money } from '../../lib/format'
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  Table,
  Td,
} from '../../components/ui'
import type { Payment } from '../../lib/types'

export default function TenantPayments() {
  const { data, loading, error } = useResource<Payment[]>('/portal/payments')

  const summary = useMemo(() => {
    const rows = data ?? []
    const billed = rows.reduce((sum, row) => sum + row.amount, 0)
    const paid = rows.reduce((sum, row) => sum + row.amount_paid, 0)
    return {
      billed,
      paid,
      outstanding: billed - paid,
      overdue: rows.filter((row) => row.status === 'overdue').length,
    }
  }, [data])

  if (loading) return <Spinner label="Loading your payment history…" />
  if (error) return <Alert message={error} />

  const payments = data ?? []

  return (
    <>
      <PageHeader title="Payment history" subtitle="Every rent invoice raised against your lease." />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total billed', value: money(summary.billed), tone: 'text-ink-900' },
          { label: 'Total paid', value: money(summary.paid), tone: 'text-success' },
          { label: 'Outstanding', value: money(summary.outstanding), tone: summary.outstanding > 0 ? 'text-warning' : 'text-success' },
          { label: 'Overdue invoices', value: String(summary.overdue), tone: summary.overdue ? 'text-danger' : 'text-ink-900' },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-sm text-ink-500">{item.label}</p>
            <p className={`mt-1 text-xl font-semibold ${item.tone}`}>{item.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        {payments.length === 0 ? (
          <EmptyState title="No invoices yet" message="Rent invoices appear here once your lease starts." />
        ) : (
          <Table columns={['Period', 'Due date', 'Billed', 'Paid', 'Balance', 'Paid on', 'Method', 'Status']}>
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-ink-50/60">
                <Td className="font-medium text-ink-900">{formatMonth(payment.period)}</Td>
                <Td>{formatDate(payment.due_date)}</Td>
                <Td>{money(payment.amount)}</Td>
                <Td className="text-success">{money(payment.amount_paid)}</Td>
                <Td className={payment.balance > 0 ? 'font-medium text-warning' : 'text-ink-400'}>
                  {money(payment.balance)}
                </Td>
                <Td>{formatDate(payment.paid_date)}</Td>
                <Td className="capitalize">{(payment.method ?? '—').replace('_', ' ')}</Td>
                <Td><Badge>{payment.status}</Badge></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
