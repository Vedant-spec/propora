import { Link, useParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { formatDate, money, titleCase } from '../lib/format'
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
  PageHeader,
  Table,
  Td,
} from '../components/ui'
import type { Lease, MaintenanceRequest, Property } from '../lib/types'

interface PropertyDetail extends Property {
  leases: Lease[]
  maintenance_requests: MaintenanceRequest[]
  current_lease: (Lease & { payments?: any[]; totals?: Record<string, number> }) | null
}

export default function PropertyDetails() {
  const { id } = useParams()
  const { data, loading, error } = useResource<PropertyDetail>(`/properties/${id}`)

  if (loading) return <DetailSkeleton />
  if (error) return <Alert message={error} />
  if (!data) return null

  const lease = data.current_lease

  return (
    <>
      <PageHeader
        back={<BackLink to="/properties" label="All properties" />}
        title={data.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{data.property_code}</span>
            <span>·</span>
            <span>
              {data.address}
              {data.city ? `, ${data.city}` : ''}
              {data.zip_code ? ` ${data.zip_code}` : ''}
            </span>
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Badge>{data.status}</Badge>
            <Link to="/properties">
              <Button variant="secondary" size="sm">
                Edit property
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Property information" />
            <DetailGrid>
              <Detail label="Property ID" value={data.property_code} />
              <Detail label="Type" value={titleCase(data.property_type)} />
              <Detail label="Unit" value={data.unit_label} />
              <Detail label="Floor" value={data.floor} />
              <Detail label="Furnishing" value={titleCase(data.furnishing)} />
              <Detail label="Area" value={data.area_sqft ? `${data.area_sqft} sq ft` : null} />
              <Detail
                label="Layout"
                value={
                  data.property_type === 'residential'
                    ? `${data.bedrooms} BHK · ${data.bathrooms} bath`
                    : `${data.bathrooms} washroom`
                }
              />
              <Detail label="City" value={data.city} />
              <Detail label="State" value={data.state} />
            </DetailGrid>
          </Card>

          <Card>
            <CardHeader title="Financials" />
            <DetailGrid>
              <Detail label="Monthly rent" value={money(data.rent_amount)} />
              <Detail label="Security deposit" value={money(data.security_deposit)} />
              <Detail label="Maintenance charge" value={money(data.maintenance_charge)} />
            </DetailGrid>
          </Card>

          {data.description && (
            <Card>
              <CardHeader title="Description" />
              <p className="whitespace-pre-line px-5 py-4 text-sm text-ink-600">{data.description}</p>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Lease history"
              subtitle={`${data.leases.length} agreement${data.leases.length === 1 ? '' : 's'} on record`}
            />
            {data.leases.length === 0 ? (
              <EmptyState title="No leases yet" message="This unit has never been let." />
            ) : (
              <Table columns={['Lease', 'Tenant', 'Term', 'Rent', 'Status']} minWidth={560}>
                {data.leases.map((item) => (
                  <tr key={item.id} className="hover:bg-ink-100/60">
                    <Td>
                      <Link to={`/leases/${item.id}`} className="font-medium text-brand-600 hover:underline">
                        {item.lease_code}
                      </Link>
                    </Td>
                    <Td>
                      <Link to={`/tenants/${item.tenant_id}`} className="hover:underline">
                        {item.tenant_name}
                      </Link>
                    </Td>
                    <Td className="text-xs">
                      {formatDate(item.start_date)} → {formatDate(item.end_date)}
                    </Td>
                    <Td>{money(item.rent_amount)}</Td>
                    <Td>
                      <Badge>{item.lease_state}</Badge>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Maintenance history"
              subtitle={`${data.maintenance_requests.length} request${data.maintenance_requests.length === 1 ? '' : 's'}`}
              action={
                <Link
                  to={`/maintenance?property=${data.id}`}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  Open in maintenance
                </Link>
              }
            />
            {data.maintenance_requests.length === 0 ? (
              <EmptyState title="No maintenance logged" message="Nothing has been raised for this unit." />
            ) : (
              <Table columns={['Ticket', 'Title', 'Priority', 'Status', 'Raised']} minWidth={560}>
                {data.maintenance_requests.slice(0, 8).map((item) => (
                  <tr key={item.id} className="hover:bg-ink-100/60">
                    <Td>
                      <Link to={`/maintenance/${item.id}`} className="font-medium text-brand-600 hover:underline">
                        {item.ticket_code}
                      </Link>
                    </Td>
                    <Td className="text-ink-900">{item.title}</Td>
                    <Td>
                      <Badge>{item.priority}</Badge>
                    </Td>
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

        <div className="space-y-4">
          <Card>
            <CardHeader title="Current occupancy" />
            {lease ? (
              <div className="space-y-4 p-5">
                <div>
                  <p className="text-sm text-ink-500">Tenant</p>
                  <Link
                    to={`/tenants/${lease.tenant_id}`}
                    className="mt-1 block font-medium text-brand-600 hover:underline"
                  >
                    {lease.tenant_name}
                  </Link>
                  {lease.tenant_phone && (
                    <p className="mt-0.5 text-sm text-ink-500">{lease.tenant_phone}</p>
                  )}
                  {lease.tenant_email && (
                    <p className="text-sm text-ink-500">{lease.tenant_email}</p>
                  )}
                </div>
                <div className="border-t border-ink-200 pt-4">
                  <dl className="space-y-3">
                    <Detail label="Lease" value={lease.lease_code} />
                    <Detail
                      label="Term"
                      value={`${formatDate(lease.start_date)} → ${formatDate(lease.end_date)}`}
                    />
                    <Detail
                      label="Days remaining"
                      value={
                        lease.days_remaining !== null && lease.days_remaining !== undefined
                          ? `${lease.days_remaining} days`
                          : null
                      }
                    />
                    <Detail label="Rent" value={money(lease.rent_amount)} />
                    <Detail label="Deposit held" value={money(lease.deposit_amount)} />
                  </dl>
                </div>
                {lease.totals && (
                  <div className="border-t border-ink-200 pt-4">
                    <dl className="space-y-3">
                      <Detail label="Billed to date" value={money(lease.totals.billed)} />
                      <Detail
                        label="Collected"
                        value={<span className="text-success">{money(lease.totals.collected)}</span>}
                      />
                      <Detail
                        label="Outstanding"
                        value={
                          <span className={lease.totals.outstanding > 0 ? 'text-warning' : 'text-success'}>
                            {money(lease.totals.outstanding)}
                          </span>
                        }
                      />
                    </dl>
                  </div>
                )}
                <Link to={`/leases/${lease.id}`}>
                  <Button variant="secondary" className="w-full">
                    View lease
                  </Button>
                </Link>
              </div>
            ) : (
              <EmptyState
                title="Vacant"
                message="No active lease. Assign a tenant to start earning rent on this unit."
                action={
                  <Link to="/leases">
                    <Button size="sm">Create lease</Button>
                  </Link>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Managed by" />
            <div className="p-5">
              {data.manager_name ? (
                <p className="font-medium text-ink-900">{data.manager_name}</p>
              ) : (
                <p className="text-sm text-ink-500">No manager assigned</p>
              )}
              <p className="mt-3 text-xs text-ink-500">Added {formatDate(data.created_at)}</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
