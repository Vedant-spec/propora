import { Link } from 'react-router-dom'
import { useResource } from '../../hooks/useResource'
import { formatDate, money, titleCase } from '../../lib/format'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Detail,
  DetailGrid,
  DetailSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
} from '../../components/ui'
import type { Lease, MaintenanceRequest, Property } from '../../lib/types'

interface MyProperty {
  property: Property | null
  lease: Lease | null
  unit_room: string | null
  manager: { name: string; email: string; phone?: string } | null
  open_requests: MaintenanceRequest[]
}

export default function TenantProperty() {
  const { data, loading, error, reload } = useResource<MyProperty>('/portal/property')

  if (loading) return <DetailSkeleton />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  if (!data.property) {
    return (
      <>
        <PageHeader title="My property" subtitle="The unit you currently occupy." />
        <Card>
          <EmptyState
            title="No property assigned"
            message="You do not have an active lease right now. Contact your property manager if that looks wrong."
          />
        </Card>
      </>
    )
  }

  const { property, lease, manager, open_requests } = data

  return (
    <>
      <PageHeader
        title="My property"
        subtitle="Everything about the home you are renting."
        action={<Badge>{property.status}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title={property.name}
              subtitle={`${property.address}${property.city ? `, ${property.city}` : ''}${
                property.zip_code ? ` ${property.zip_code}` : ''
              }`}
            />
            <DetailGrid>
              <Detail label="Unit / room" value={data.unit_room ?? property.unit_label} />
              <Detail label="Floor" value={property.floor} />
              <Detail label="Type" value={titleCase(property.property_type)} />
              <Detail
                label="Layout"
                value={
                  property.property_type === 'residential'
                    ? `${property.bedrooms} BHK · ${property.bathrooms} bath`
                    : `${property.bathrooms} washroom`
                }
              />
              <Detail label="Area" value={property.area_sqft ? `${property.area_sqft} sq ft` : null} />
              <Detail label="Furnishing" value={titleCase(property.furnishing)} />
            </DetailGrid>
          </Card>

          {property.description && (
            <Card>
              <CardHeader title="About this property" />
              <p className="whitespace-pre-line px-5 py-4 text-sm text-ink-600">
                {property.description}
              </p>
            </Card>
          )}

          <Card>
            <CardHeader title="What you pay" />
            <DetailGrid columns={3}>
              <Detail label="Monthly rent" value={money(lease?.rent_amount ?? property.rent_amount)} />
              <Detail
                label="Security deposit"
                value={money(lease?.deposit_amount ?? property.security_deposit)}
              />
              <Detail label="Maintenance charge" value={money(property.maintenance_charge)} />
            </DetailGrid>
            <div className="border-t border-ink-200 px-5 py-4">
              <Link to="/portal/payments">
                <Button variant="secondary" size="sm">
                  View payment history
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {lease && (
            <Card>
              <CardHeader title="Your lease" action={<Badge>{lease.lease_state}</Badge>} />
              <div className="space-y-3 p-5">
                <Detail label="Lease ID" value={lease.lease_code} />
                <Detail label="Start date" value={formatDate(lease.start_date)} />
                <Detail label="End date" value={formatDate(lease.end_date)} />
                <Detail
                  label="Days remaining"
                  value={
                    lease.days_remaining !== null && lease.days_remaining !== undefined
                      ? `${lease.days_remaining} days`
                      : null
                  }
                />
                <Detail label="Rent due day" value={`Day ${lease.rent_due_day} of each month`} />
              </div>
              <div className="border-t border-ink-200 px-5 py-4">
                <Link to="/portal/lease">
                  <Button variant="secondary" size="sm" className="w-full">
                    Full lease details
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Your property manager" />
            <div className="p-5">
              {manager ? (
                <>
                  <p className="font-medium text-ink-900">{manager.name}</p>
                  <p className="mt-1 text-sm text-ink-500">{manager.email}</p>
                  {manager.phone && <p className="text-sm text-ink-500">{manager.phone}</p>}
                  <p className="mt-3 text-xs text-ink-500">
                    Contact them for anything about your lease or the building.
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-500">No manager assigned to this property yet.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Open requests"
              subtitle={`${open_requests.length} awaiting resolution`}
              action={
                <Link to="/portal/maintenance">
                  <Button size="sm">Raise</Button>
                </Link>
              }
            />
            {open_requests.length === 0 ? (
              <EmptyState title="Nothing pending" message="No open maintenance requests for your home." />
            ) : (
              <ul className="divide-y divide-ink-200">
                {open_requests.map((request) => (
                  <li key={request.id} className="px-5 py-3.5">
                    <p className="text-sm font-medium text-ink-900">{request.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <Badge>{request.priority}</Badge>
                      <Badge>{request.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
