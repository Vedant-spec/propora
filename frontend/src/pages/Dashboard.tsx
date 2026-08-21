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
import { useAuth } from '../context/AuthContext'
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
import { compactMoney, formatDate, formatMonth, money, relativeTime, titleCase } from '../lib/format'
import type { DashboardData } from '../lib/types'

interface Activity {
  id: number
  actor_name: string
  action: string
  entity_type: string
  entity_id: number
  summary: string
  created_at?: string
}

const OCCUPANCY_COLORS: Record<string, string> = {
  Occupied: 'var(--color-brand-600)',
  Available: 'var(--color-ink-300)',
  Maintenance: 'var(--color-warning)',
}

const ACTION_STYLES: Record<string, string> = {
  created: 'bg-success-soft text-success',
  updated: 'bg-info-soft text-info',
  deleted: 'bg-danger-soft text-danger',
  paid: 'bg-brand-50 text-brand-700',
}

const ENTITY_LINKS: Record<string, string> = {
  property: '/properties',
  tenant: '/tenants',
  lease: '/leases',
  payment: '/payments',
  maintenance: '/maintenance',
  user: '/users',
}

const chartTooltip = {
  borderRadius: 8,
  border: '1px solid var(--color-ink-200)',
  background: 'var(--color-raised)',
  color: 'var(--color-ink-800)',
  fontSize: 13,
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useResource<DashboardData>('/dashboard')
  const { data: activity } = useResource<Activity[]>('/activity', { limit: 8 })

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Loading your portfolio…" />
        <StatSkeleton />
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <TableSkeleton rows={5} />
          </Card>
          <Card>
            <TableSkeleton rows={5} columns={2} />
          </Card>
        </div>
      </>
    )
  }
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { stats, trend, occupancy, expiring_leases, recent_maintenance, recent_payments } = data

  const occupancyData = occupancy
    .filter((slice) => slice.value > 0)
    .map((slice) => ({ ...slice, fill: OCCUPANCY_COLORS[slice.name] ?? 'var(--color-ink-300)' }))

  const collectionRate = stats.billed_this_month
    ? Math.round((stats.monthly_revenue / stats.billed_this_month) * 100)
    : 0

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? ''}`}
        subtitle="Portfolio health at a glance — occupancy, rent collection and open work."
      />

      {/* Primary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total properties"
          value={stats.total_properties}
          hint={`${stats.occupied} occupied · ${stats.available} vacant`}
          tone="brand"
        />
        <StatCard
          label="Occupancy rate"
          value={`${stats.occupancy_rate}%`}
          hint={`${stats.active_leases} active lease${stats.active_leases === 1 ? '' : 's'}`}
          tone="green"
        />
        <StatCard
          label="Total tenants"
          value={stats.total_tenants}
          hint={`${stats.expiring_soon} lease${stats.expiring_soon === 1 ? '' : 's'} expiring soon`}
          tone={stats.expiring_soon ? 'amber' : 'neutral'}
        />
        <StatCard
          label="Monthly revenue"
          value={money(stats.monthly_revenue)}
          hint={`${collectionRate}% of ${money(stats.billed_this_month)} billed`}
          tone={collectionRate >= 80 ? 'green' : 'amber'}
        />
      </div>

      {/* Secondary metrics */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending rent"
          value={money(stats.pending_rent)}
          hint="Not yet past due"
          tone="brand"
        />
        <StatCard
          label="Overdue rent"
          value={money(stats.overdue_rent)}
          hint={`${stats.overdue_count} invoice${stats.overdue_count === 1 ? '' : 's'} past due`}
          tone={stats.overdue_count ? 'red' : 'green'}
        />
        <StatCard
          label="Open maintenance"
          value={stats.open_maintenance}
          hint={`${stats.urgent_maintenance} urgent`}
          tone={stats.urgent_maintenance ? 'red' : stats.open_maintenance ? 'amber' : 'green'}
        />
        <StatCard
          label="Monthly rent roll"
          value={money(stats.monthly_rent_roll)}
          hint="Contracted across active leases"
          tone="neutral"
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Rent billed vs collected"
            subtitle="Last six months"
            action={
              <Link to="/payments/dashboard" className="text-sm font-medium text-brand-600 hover:underline">
                Payment dashboard
              </Link>
            }
          />
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
                <Tooltip
                  formatter={(value) => money(Number(value))}
                  contentStyle={chartTooltip}
                  cursor={{ fill: 'var(--color-ink-100)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="billed" name="Billed" fill="var(--color-ink-300)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="var(--color-brand-600)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Occupancy" subtitle={`${stats.total_properties} units in portfolio`} />
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancyData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                >
                  {occupancyData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Lists */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Leases expiring soon"
            subtitle="Next 60 days"
            action={
              <Link to="/leases?status=expiring_soon" className="text-sm font-medium text-brand-600 hover:underline">
                View all
              </Link>
            }
          />
          {expiring_leases.length === 0 ? (
            <EmptyState title="Nothing expiring" message="No leases end in the next 60 days." />
          ) : (
            <Table columns={['Property', 'Tenant', 'Ends', 'Rent']} minWidth={520}>
              {expiring_leases.map((lease) => (
                <tr key={lease.id} className="hover:bg-ink-100/60">
                  <Td>
                    <Link to={`/leases/${lease.id}`} className="font-medium text-brand-600 hover:underline">
                      {lease.property_name}
                    </Link>
                  </Td>
                  <Td className="text-sm">{lease.tenant_name}</Td>
                  <Td>
                    <div className="text-xs">{formatDate(lease.end_date)}</div>
                    <span className="text-xs text-warning">
                      {lease.days_remaining !== null && lease.days_remaining !== undefined && lease.days_remaining >= 0
                        ? `in ${lease.days_remaining} days`
                        : 'expired'}
                    </span>
                  </Td>
                  <Td>{money(lease.rent_amount)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Latest maintenance"
            subtitle={`${stats.open_maintenance} request${stats.open_maintenance === 1 ? '' : 's'} still open`}
            action={
              <Link to="/maintenance/dashboard" className="text-sm font-medium text-brand-600 hover:underline">
                Maintenance dashboard
              </Link>
            }
          />
          {recent_maintenance.length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : (
            <Table columns={['Request', 'Property', 'Priority', 'Status']} minWidth={520}>
              {recent_maintenance.map((request) => (
                <tr key={request.id} className="hover:bg-ink-100/60">
                  <Td>
                    <Link to={`/maintenance/${request.id}`} className="font-medium text-brand-600 hover:underline">
                      {request.title}
                    </Link>
                  </Td>
                  <Td className="text-xs">{request.property_name}</Td>
                  <Td>
                    <Badge>{request.priority}</Badge>
                  </Td>
                  <Td>
                    <Badge>{request.status}</Badge>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent payments received"
            action={
              <Link to="/payments" className="text-sm font-medium text-brand-600 hover:underline">
                View all
              </Link>
            }
          />
          {recent_payments.length === 0 ? (
            <EmptyState title="No payments recorded yet" />
          ) : (
            <Table columns={['Tenant', 'Property', 'Period', 'Amount', 'Paid on', 'Method']} minWidth={680}>
              {recent_payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-ink-100/60">
                  <Td>
                    <Link to={`/payments/${payment.id}`} className="font-medium text-brand-600 hover:underline">
                      {payment.tenant_name}
                    </Link>
                  </Td>
                  <Td className="text-xs">{payment.property_name}</Td>
                  <Td className="text-xs">{formatMonth(payment.period)}</Td>
                  <Td className="font-medium text-success">{money(payment.amount_paid)}</Td>
                  <Td className="text-xs">{formatDate(payment.paid_date)}</Td>
                  <Td className="text-xs">{titleCase(payment.method)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {/* Recent activity feed */}
        <Card>
          <CardHeader title="Recent activity" subtitle="What changed across the portfolio" />
          {!activity || activity.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ol className="divide-y divide-ink-200">
              {activity.map((item) => (
                <li key={item.id} className="flex gap-3 px-5 py-3.5">
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase ${
                      ACTION_STYLES[item.action] ?? ACTION_STYLES.updated
                    }`}
                  >
                    {item.action.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <Link
                      to={ENTITY_LINKS[item.entity_type] ?? '/dashboard'}
                      className="block text-sm text-ink-800 hover:text-brand-600"
                    >
                      {item.summary}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {item.actor_name} · {relativeTime(item.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  )
}
