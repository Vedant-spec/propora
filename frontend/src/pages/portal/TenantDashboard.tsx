import { Link } from 'react-router-dom'
import { useResource } from '../../hooks/useResource'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatMonth, money, relativeTime, titleCase } from '../../lib/format'
import {
  Badge,
  Button,
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
} from '../../components/ui'
import type { PortalOverview } from '../../lib/types'

export default function TenantDashboard() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useResource<PortalOverview>('/portal/overview')

  if (loading) {
    return (
      <>
        <PageHeader title="Loading your details…" />
        <StatSkeleton />
        <Card className="mt-4">
          <TableSkeleton rows={4} columns={4} />
        </Card>
      </>
    )
  }
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { lease, property, stats, recent_payments, open_requests, recent_updates } = data

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.name?.split(' ')[0] ?? ''}`}
        subtitle="Your lease, rent and maintenance at a glance."
      />

      {!lease ? (
        <Card>
          <EmptyState
            title="No active lease"
            message="You do not have an active lease right now. Contact your property manager if that looks wrong."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Monthly rent"
              value={money(stats.rent_amount)}
              hint={`Due on the ${lease.rent_due_day}th`}
              tone="brand"
            />
            <StatCard
              label="Next payment due"
              value={stats.next_due_amount ? money(stats.next_due_amount) : '—'}
              hint={formatDate(stats.next_due_date)}
              tone={stats.payment_status === 'overdue' ? 'red' : 'brand'}
            />
            <StatCard
              label="Outstanding balance"
              value={money(stats.outstanding)}
              hint={stats.outstanding > 0 ? 'Please settle soon' : 'All clear'}
              tone={stats.outstanding > 0 ? 'amber' : 'green'}
            />
            <StatCard
              label="Open requests"
              value={stats.open_requests}
              hint={stats.open_requests ? 'Being worked on' : 'Nothing pending'}
              tone={stats.open_requests ? 'amber' : 'green'}
            />
          </div>

          {/* My property summary */}
          <Card className="mt-4">
            <CardHeader
              title={property?.name ?? lease.property_name ?? 'Your home'}
              subtitle={lease.property_address}
              action={
                <div className="flex flex-wrap gap-2">
                  <Badge>{stats.lease_status}</Badge>
                  <Link to="/portal/property">
                    <Button size="sm" variant="secondary">
                      My property
                    </Button>
                  </Link>
                </div>
              }
            />
            <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-ink-500">Lease period</p>
                <p className="mt-1 font-medium text-ink-900">
                  {formatDate(lease.start_date)} → {formatDate(lease.end_date)}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {stats.days_remaining !== null && stats.days_remaining !== undefined
                    ? stats.days_remaining >= 0
                      ? `${stats.days_remaining} days remaining`
                      : 'expired'
                    : ''}
                </p>
              </div>
              <div>
                <p className="text-sm text-ink-500">Security deposit</p>
                <p className="mt-1 font-medium text-ink-900">{money(stats.deposit_amount)}</p>
                <p className="mt-0.5 text-xs text-ink-500">Held by the landlord</p>
              </div>
              <div>
                <p className="text-sm text-ink-500">Paid to date</p>
                <p className="mt-1 font-medium text-success">{money(stats.total_paid)}</p>
                <p className="mt-0.5 text-xs text-ink-500">{stats.paid_invoices} invoices settled</p>
              </div>
              <div>
                <p className="text-sm text-ink-500">Payment status</p>
                <p className="mt-1">
                  <Badge>{stats.payment_status}</Badge>
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Recent payments"
                action={
                  <Link to="/portal/payments" className="text-sm font-medium text-brand-600 hover:underline">
                    View all
                  </Link>
                }
              />
              {recent_payments.length === 0 ? (
                <EmptyState title="No invoices yet" />
              ) : (
                <Table columns={['Period', 'Due', 'Amount', 'Status']} minWidth={460}>
                  {recent_payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-ink-100/60">
                      <Td className="font-medium text-ink-900">{formatMonth(payment.period)}</Td>
                      <Td className="text-xs">{formatDate(payment.due_date)}</Td>
                      <Td>{money(payment.amount)}</Td>
                      <Td>
                        <Badge>{payment.status}</Badge>
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Open maintenance requests"
                subtitle={`${stats.open_requests} awaiting resolution`}
                action={
                  <Link to="/portal/maintenance">
                    <Button size="sm">Raise a request</Button>
                  </Link>
                }
              />
              {open_requests.length === 0 ? (
                <EmptyState title="Nothing pending" message="You have no open maintenance requests." />
              ) : (
                <Table columns={['Request', 'Priority', 'Status', 'Raised']} minWidth={460}>
                  {open_requests.map((request) => (
                    <tr key={request.id} className="hover:bg-ink-100/60">
                      <Td className="font-medium text-ink-900">{request.title}</Td>
                      <Td>
                        <Badge>{request.priority}</Badge>
                      </Td>
                      <Td>
                        <Badge>{request.status}</Badge>
                      </Td>
                      <Td className="text-xs">{formatDate(request.created_at)}</Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </div>

          {recent_updates.length > 0 && (
            <Card className="mt-4">
              <CardHeader title="Recent maintenance updates" subtitle="Latest activity on your requests" />
              <ol className="divide-y divide-ink-200">
                {recent_updates.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <span className="flex-1 text-sm text-ink-800">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-ink-500">
                        {' '}
                        is now {titleCase(item.status).toLowerCase()}
                      </span>
                    </span>
                    <Badge>{item.status}</Badge>
                    <span className="text-xs text-ink-500">{relativeTime(item.updated_at)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}
    </>
  )
}
