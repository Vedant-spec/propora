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
import { formatDate, money, titleCase } from '../lib/format'
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
import type { MaintenanceRequest } from '../lib/types'

interface MaintenanceDashboardData {
  stats: {
    total: number
    open: number
    urgent_open: number
    unassigned: number
    completed: number
    closed: number
    avg_resolution_days: number
    raised_this_week: number
    closed_this_week: number
    total_cost: number
  }
  by_status: { status: string; count: number }[]
  by_category: { category: string; count: number }[]
  by_priority: { priority: string; count: number }[]
  ageing: MaintenanceRequest[]
  recent: MaintenanceRequest[]
}

const CATEGORY_COLORS = [
  'var(--color-brand-600)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-accent)',
  'var(--color-ink-300)',
]

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--color-danger)',
  high: 'var(--color-warning)',
  medium: 'var(--color-info)',
  low: 'var(--color-ink-300)',
}

const chartTooltip = {
  borderRadius: 8,
  border: '1px solid var(--color-ink-200)',
  background: 'var(--color-raised)',
  color: 'var(--color-ink-800)',
  fontSize: 13,
}

export default function MaintenanceDashboard() {
  const { data, loading, error, reload } =
    useResource<MaintenanceDashboardData>('/maintenance/dashboard')

  if (loading) {
    return (
      <>
        <PageHeader title="Maintenance dashboard" subtitle="Workload, ageing and resolution performance." />
        <StatSkeleton />
        <Card className="mt-4">
          <TableSkeleton rows={5} />
        </Card>
      </>
    )
  }
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { stats, by_status, by_category, by_priority, ageing, recent } = data

  const categoryData = by_category.map((row, index) => ({
    name: titleCase(row.category),
    value: row.count,
    fill: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }))

  const priorityData = by_priority.map((row) => ({
    name: titleCase(row.priority),
    count: row.count,
    fill: PRIORITY_COLORS[row.priority] ?? 'var(--color-ink-300)',
  }))

  return (
    <>
      <PageHeader
        title="Maintenance dashboard"
        subtitle="Workload, ageing and resolution performance."
        action={
          <Link
            to="/maintenance"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-500"
          >
            All requests
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open requests"
          value={stats.open}
          hint={`${stats.unassigned} unassigned`}
          tone={stats.open ? 'amber' : 'green'}
        />
        <StatCard
          label="Urgent open"
          value={stats.urgent_open}
          hint={stats.urgent_open ? 'Needs attention today' : 'Nothing critical'}
          tone={stats.urgent_open ? 'red' : 'green'}
        />
        <StatCard
          label="Avg resolution"
          value={`${stats.avg_resolution_days} days`}
          hint={`${stats.completed + stats.closed} resolved all time`}
          tone="brand"
        />
        <StatCard
          label="Maintenance spend"
          value={money(stats.total_cost)}
          hint={`${stats.closed_this_week} closed this week`}
          tone="neutral"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Workflow pipeline" subtitle="Requests at each stage" />
          <div className="grid gap-3 p-5 sm:grid-cols-5">
            {by_status.map((stage) => (
              <div key={stage.status} className="rounded-lg bg-sunken p-4 text-center">
                <p className="text-2xl font-semibold text-ink-900">{stage.count}</p>
                <p className="mt-1 text-xs capitalize text-ink-500">
                  {stage.status.replace('_', ' ')}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-ink-200 p-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ink-200)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-ink-500)" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-ink-500)" width={32} />
                  <Tooltip contentStyle={chartTooltip} cursor={{ fill: 'var(--color-ink-100)' }} />
                  <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                    {priorityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="By category" subtitle="Where the work comes from" />
          {categoryData.length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : (
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={3}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltip} />
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
            title="Ageing requests"
            subtitle="Open for a week or longer"
            action={
              <Link to="/maintenance?status=open" className="text-sm font-medium text-brand-600 hover:underline">
                View open
              </Link>
            }
          />
          {ageing.length === 0 ? (
            <EmptyState title="Nothing is ageing" message="Every open request was raised within the last week." />
          ) : (
            <Table columns={['Ticket', 'Property', 'Priority', 'Age']} minWidth={500}>
              {ageing.map((item) => (
                <tr key={item.id} className="hover:bg-ink-100/60">
                  <Td>
                    <Link to={`/maintenance/${item.id}`} className="font-medium text-brand-600 hover:underline">
                      {item.ticket_code}
                    </Link>
                    <div className="text-xs text-ink-500">{item.title}</div>
                  </Td>
                  <Td className="text-xs">{item.property_name}</Td>
                  <Td>
                    <Badge>{item.priority}</Badge>
                  </Td>
                  <Td className="font-medium text-warning">{item.age_days}d</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Latest requests"
            subtitle={`${stats.raised_this_week} raised this week`}
            action={
              <Link to="/maintenance" className="text-sm font-medium text-brand-600 hover:underline">
                View all
              </Link>
            }
          />
          {recent.length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : (
            <Table columns={['Ticket', 'Title', 'Status', 'Raised']} minWidth={500}>
              {recent.map((item) => (
                <tr key={item.id} className="hover:bg-ink-100/60">
                  <Td>
                    <Link to={`/maintenance/${item.id}`} className="font-medium text-brand-600 hover:underline">
                      {item.ticket_code}
                    </Link>
                  </Td>
                  <Td className="text-ink-900">{item.title}</Td>
                  <Td>
                    <Badge>{item.status}</Badge>
                  </Td>
                  <Td className="text-xs">{formatDate(item.created_at)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  )
}
