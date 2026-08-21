import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { formatDate, money, titleCase } from '../lib/format'
import BackLink from '../components/BackLink'
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchBar,
  Select,
  StatCard,
  Table,
  TableSkeleton,
  Td,
} from '../components/ui'
import type { MaintenanceRequest } from '../lib/types'

const CATEGORIES = ['plumbing', 'electrical', 'cleaning', 'hvac', 'security', 'other']

export default function MaintenanceHistory() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const { data, loading, error, reload } = useResource<MaintenanceRequest[]>('/maintenance', {
    status: 'history',
    category,
    search,
  })

  const stats = useMemo(() => {
    const rows = data ?? []
    const ages = rows.map((row) => row.age_days ?? 0)
    return {
      total: rows.length,
      cost: rows.reduce((sum, row) => sum + (row.cost ?? 0), 0),
      avgDays: ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : 0,
      closed: rows.filter((row) => row.status === 'closed').length,
    }
  }, [data])

  return (
    <>
      <PageHeader
        back={<BackLink to="/maintenance" label="Active requests" />}
        title="Maintenance history"
        subtitle="Completed and closed requests across the portfolio."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Resolved requests" value={stats.total} tone="green" />
        <StatCard label="Fully closed" value={stats.closed} tone="neutral" />
        <StatCard label="Average resolution" value={`${stats.avgDays} days`} tone="brand" />
        <StatCard label="Total spend" value={money(stats.cost)} tone="neutral" />
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search ticket, title or description…"
            className="sm:col-span-2"
          />
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No completed requests"
            message="Requests appear here once they are completed or closed."
          />
        ) : (
          <Table
            columns={['Ticket', 'Property', 'Tenant', 'Category', 'Resolved in', 'Cost', 'Status']}
            minWidth={760}
          >
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-ink-100/60">
                <Td>
                  <Link to={`/maintenance/${item.id}`} className="font-medium text-brand-600 hover:underline">
                    {item.ticket_code}
                  </Link>
                  <div className="text-xs text-ink-500">{item.title}</div>
                </Td>
                <Td className="text-sm">{item.property_name}</Td>
                <Td className="text-sm">{item.tenant_name ?? <span className="text-ink-400">Staff</span>}</Td>
                <Td className="capitalize">{item.category}</Td>
                <Td>
                  <span className="font-medium">{item.age_days}d</span>
                  <div className="text-xs text-ink-500">
                    closed {formatDate(item.closed_at ?? item.completed_at)}
                  </div>
                </Td>
                <Td>{item.cost ? money(item.cost) : <span className="text-ink-400">—</span>}</Td>
                <Td>
                  <Badge>{item.status}</Badge>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
