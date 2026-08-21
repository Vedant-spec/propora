import { useResource } from '../../hooks/useResource'
import { daysUntil, formatDate, money } from '../../lib/format'
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, Spinner } from '../../components/ui'
import type { Lease } from '../../lib/types'

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="mt-1 font-medium text-ink-900">{value}</dd>
    </div>
  )
}

export default function TenantLease() {
  const { data, loading, error } = useResource<Lease[]>('/portal/lease')

  if (loading) return <Spinner label="Loading your lease…" />
  if (error) return <Alert message={error} />

  const leases = data ?? []

  return (
    <>
      <PageHeader title="My lease" subtitle="Your current agreement and past tenancies." />

      {leases.length === 0 ? (
        <Card>
          <EmptyState title="No lease on record" message="Your property manager has not assigned you a lease yet." />
        </Card>
      ) : (
        <div className="space-y-4">
          {leases.map((lease) => {
            const remaining = daysUntil(lease.end_date)
            return (
              <Card key={lease.id}>
                <CardHeader
                  title={lease.property_name ?? 'Property'}
                  subtitle={lease.property_address}
                  action={<Badge>{lease.status}</Badge>}
                />
                <dl className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
                  <Detail label="Lease start" value={formatDate(lease.start_date)} />
                  <Detail
                    label="Lease end"
                    value={
                      lease.status === 'active' && remaining !== null && remaining >= 0
                        ? `${formatDate(lease.end_date)} · ${remaining} days left`
                        : formatDate(lease.end_date)
                    }
                  />
                  <Detail label="Monthly rent" value={money(lease.rent_amount)} />
                  <Detail label="Rent due on" value={`Day ${lease.rent_due_day} of each month`} />
                  <Detail label="Security deposit" value={money(lease.deposit_amount)} />
                  <Detail
                    label="Total term"
                    value={`${Math.max(
                      1,
                      Math.round(
                        (new Date(lease.end_date).getTime() - new Date(lease.start_date).getTime()) /
                          (30 * 864e5),
                      ),
                    )} months`}
                  />
                </dl>

                {lease.terms && (
                  <div className="border-t border-ink-200 px-5 py-4">
                    <p className="mb-1.5 text-sm font-medium text-ink-700">Terms &amp; conditions</p>
                    <p className="whitespace-pre-line text-sm text-ink-600">{lease.terms}</p>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
