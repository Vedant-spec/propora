import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useResource } from '../hooks/useResource'
import { compactMoney, formatDate, formatMonth, money, titleCase } from '../lib/format'
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  StatCard,
  StatSkeleton,
  Table,
  TableSkeleton,
  Td,
} from '../components/ui'
import type { Payment } from '../lib/types'

interface PaymentsDashboardData {
  stats: {
    billed_this_month: number
    collected_this_month: number
    invoices_this_month: number
    collection_rate: number
    pending_amount: number
    pending_count: number
    overdue_amount: number
    overdue_count: number
    paid_count: number
    partial_count: number
  }
  trend: { period: string; label: string; billed: number; collected: number }[]
  by_method: { method: string; amount: number; count: number }[]
  status_counts: Record<string, number>
  overdue: Payment[]
  upcoming: Payment[]
}

const METHOD_COLORS = [
  'var(--color-brand-600)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-info)',
  'var(--color-accent)',
  'var(--color-ink-300)',
]

const chartTooltip = {
  borderRadius: 8,
  border: '1px solid var(--color-ink-200)',
  background: 'var(--color-raised)',
  color: 'var(--color-ink-800)',
  fontSize: 13,
}

export default function PaymentsDashboard() {
  const { data, loading, error, reload } = useResource<PaymentsDashboardData>('/payments/dashboard')

  if (loading) {
    return (
      <>
        <PageHeader title="Payment dashboard" subtitle="Rent collection across the portfolio." />
        <StatSkeleton />
        <Card className="mt-4">
          <TableSkeleton rows={5} />
        </Card>
      </>
    )
  }
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { stats, trend, by_method, overdue, upcoming } = data

  const methodData = by_method.map((row, index) => ({
    name: titleCase(row.method),
    value: row.amount,
    fill: METHOD_COLORS[index % METHOD_COLORS.length],
  }))

  return (
    <>
      <PageHeader
        title="Payment dashboard"
        subtitle="Rent collection across the portfolio."
        action={
          <Link
            to="/payments"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-500"
          >
            All transactions
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Collected this month"
          value={money(stats.collected_this_month)}
          hint={`of ${money(stats.billed_this_month)} billed`}
          tone="green"
        />
        <StatCard
          label="Collection rate"
          value={`${stats.collection_rate}%`}
          hint={`${stats.paid_count} invoices settled`}
          tone={stats.collection_rate >= 80 ? 'green' : 'amber'}
        />
        <StatCard
          label="Pending rent"
          value={money(stats.pending_amount)}
          hint={`${stats.pending_count} not yet due`}
          tone="brand"
        />
        <StatCard
          label="Overdue rent"
          value={money(stats.overdue_amount)}
          hint={`${stats.overdue_count} past due date`}
          tone={stats.overdue_count ? 'red' : 'green'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Billed vs collected" subtitle="Last six months" />
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ink-200)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-ink-500)" />
                <YAxis
                  tickFormatter={(value) => compactMoney(value)}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="var(--color-ink-500)"
                  width={56}
                />
                <Tooltip formatter={(value) => money(Number(value))} contentStyle={chartTooltip} cursor={{ fill: 'var(--color-ink-100)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="billed" name="Billed" fill="var(--color-ink-300)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="var(--color-brand-600)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment methods" subtitle="Share of money received" />
          {methodData.length === 0 ? (
            <EmptyState title="No payments recorded" />
          ) : (
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={methodData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={3}>
                    {methodData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => money(Number(value))} contentStyle={chartTooltip} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Overdue payments"
            subtitle={`${stats.overdue_count} invoice${stats.overdue_count === 1 ? '' : 's'} past due`}
            action={
              <Link to="/payments?status=overdue" className="text-sm font-medium text-brand-600 hover:underline">
                View all
              </Link>
            }
          />
          {overdue.length === 0 ? (
            <EmptyState title="Nothing overdue" message="Every invoice is settled or still within its due date." />
          ) : (
            <Table columns={['Tenant', 'Property', 'Due', 'Balance']} minWidth={520}>
              {overdue.map((payment) => (
                <tr key={payment.id} className="hover:bg-ink-100/60">
                  <Td>
                    <Link to={`/payments/${payment.id}`} className="font-medium text-brand-600 hover:underline">
                      {payment.tenant_name}
                    </Link>
                  </Td>
                  <Td className="text-xs">{payment.property_name}</Td>
                  <Td>
                    <div className="text-xs">{formatDate(payment.due_date)}</div>
                    <span className="text-xs text-danger">{payment.days_overdue} days late</span>
                  </Td>
                  <Td className="font-medium text-warning">{money(payment.balance)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Upcoming rent"
            subtitle={`${stats.pending_count} invoice${stats.pending_count === 1 ? '' : 's'} due soon`}
            action={
              <Link to="/payments?status=pending" className="text-sm font-medium text-brand-600 hover:underline">
                View all
              </Link>
            }
          />
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled" message="No rent invoices are waiting to fall due." />
          ) : (
            <Table columns={['Tenant', 'Property', 'Period', 'Amount']} minWidth={520}>
              {upcoming.map((payment) => (
                <tr key={payment.id} className="hover:bg-ink-100/60">
                  <Td>
                    <Link to={`/payments/${payment.id}`} className="font-medium text-brand-600 hover:underline">
                      {payment.tenant_name}
                    </Link>
                  </Td>
                  <Td className="text-xs">{payment.property_name}</Td>
                  <Td className="text-xs">
                    <div>{formatMonth(payment.period)}</div>
                    <span className="text-ink-500">due {formatDate(payment.due_date)}</span>
                  </Td>
                  <Td className="font-medium">{money(payment.balance)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Status breakdown" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Paid', value: data.status_counts.paid ?? 0, tone: 'green' as const },
            { label: 'Partially paid', value: data.status_counts.partial ?? 0, tone: 'amber' as const },
            { label: 'Pending', value: data.status_counts.pending ?? 0, tone: 'brand' as const },
            { label: 'Overdue', value: data.status_counts.overdue ?? 0, tone: 'red' as const },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-sunken p-4">
              <p className="text-sm text-ink-500">{item.label}</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-xl font-semibold text-ink-900">{item.value}</p>
                <Badge tone={item.tone === 'brand' ? 'blue' : item.tone === 'green' ? 'green' : item.tone === 'amber' ? 'amber' : 'red'}>
                  {item.label}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
