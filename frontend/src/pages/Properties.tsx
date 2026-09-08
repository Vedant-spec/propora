import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { api, readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { money, titleCase } from '../lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  SearchBar,
  Select,
  StatCard,
  Table,
  TableSkeleton,
  Tabs,
  Td,
} from '../components/ui'
import PropertyFields, { BLANK_PROPERTY } from '../components/forms/PropertyFields'
import type { Property } from '../lib/types'


interface Summary {
  total: number
  available: number
  occupied: number
  maintenance: number
  occupancy_rate: number
}

export default function Properties() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('recent')

  const { data, loading, error, reload } = useResource<Property[]>('/properties', {
    search,
    status,
    type,
    sort,
  })
  const { data: summary, reload: reloadSummary } = useResource<Summary>('/properties/summary')

  const [editing, setEditing] = useState<Partial<Property> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Property | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    await Promise.all([reload(), reloadSummary()])
  }

  const openNew = () => {
    setErrors({})
    setFormError('')
    setEditing({ ...BLANK_PROPERTY })
  }

  const openEdit = (property: Property) => {
    setErrors({})
    setFormError('')
    setEditing(property)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      if (editing.id) {
        await api(`/properties/${editing.id}`, { method: 'PUT', body: editing })
        toast.success('Property updated')
      } else {
        await api('/properties', { method: 'POST', body: editing })
        toast.success('Property added')
      }
      setEditing(null)
      await refresh()
    } catch (err) {
      const parsed = readError(err)
      setFormError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirmDelete) return
    setSaving(true)
    setFormError('')
    try {
      await api(`/properties/${confirmDelete.id}`, { method: 'DELETE' })
      setConfirmDelete(null)
      toast.success('Property deleted')
      await refresh()
    } catch (err) {
      setFormError(readError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const set = (patch: Partial<Property>) => setEditing((prev) => ({ ...prev, ...patch }))

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="Every unit in the portfolio, with availability and rent."
        action={<Button onClick={openNew}>+ Add property</Button>}
      />

      {summary && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total properties" value={summary.total} tone="brand" />
          <StatCard label="Occupied" value={summary.occupied} hint={`${summary.occupancy_rate}% occupancy`} tone="green" />
          <StatCard label="Available" value={summary.available} tone="neutral" />
          <StatCard
            label="Under maintenance"
            value={summary.maintenance}
            tone={summary.maintenance ? 'amber' : 'neutral'}
          />
        </div>
      )}

      {/* Property availability tabs */}
      <Tabs
        value={status}
        onChange={setStatus}
        tabs={[
          { value: 'all', label: 'All', count: summary?.total },
          { value: 'available', label: 'Available', count: summary?.available },
          { value: 'occupied', label: 'Occupied', count: summary?.occupied },
          { value: 'maintenance', label: 'Maintenance', count: summary?.maintenance },
        ]}
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search name, ID, address or city…"
            className="lg:col-span-2"
          />
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">All types</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="recent">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="rent_high">Rent: high to low</option>
            <option value="rent_low">Rent: low to high</option>
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
            title="No properties found"
            message="Try clearing the filters, or add your first property."
            action={<Button onClick={openNew}>+ Add property</Button>}
          />
        ) : (
          <Table columns={['Property', 'Type', 'Layout', 'Rent', 'Status', 'Current tenant', '']} minWidth={860}>
            {data.map((property) => (
              <tr key={property.id} className="hover:bg-ink-100/60">
                <Td>
                  <Link
                    to={`/properties/${property.id}`}
                    className="font-medium text-ink-900 hover:text-brand-600 hover:underline"
                  >
                    {property.name}
                  </Link>
                  <div className="text-xs text-ink-500">
                    <span className="font-mono">{property.property_code}</span> · {property.address}
                    {property.city ? `, ${property.city}` : ''}
                  </div>
                </Td>
                <Td>
                  <span className="capitalize">{property.property_type}</span>
                  <div className="text-xs text-ink-500">{titleCase(property.furnishing)}</div>
                </Td>
                <Td className="text-sm">
                  {property.property_type === 'residential'
                    ? `${property.bedrooms} BHK · ${property.bathrooms} bath`
                    : `${property.bathrooms} washroom`}
                  <div className="text-xs text-ink-500">
                    {property.area_sqft} sq ft{property.floor ? ` · ${property.floor} floor` : ''}
                  </div>
                </Td>
                <Td className="font-medium">
                  {money(property.rent_amount)}
                  <div className="text-xs font-normal text-ink-500">
                    dep. {money(property.security_deposit)}
                  </div>
                </Td>
                <Td>
                  <Badge>{property.status}</Badge>
                </Td>
                <Td>
                  {property.current_tenant ? (
                    <Link
                      to={`/tenants/${property.current_tenant_id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {property.current_tenant}
                    </Link>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <Link to={`/properties/${property.id}`}>
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(property)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => {
                      setFormError('')
                      setConfirmDelete(property)
                    }}
                  >
                    Delete
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Add / edit property */}
      <Modal
        open={Boolean(editing)}
        title={editing?.id ? 'Edit property' : 'Add property'}
        subtitle={editing?.id ? editing.property_code : 'Register a new unit in the portfolio'}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button form="property-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save property'}
            </Button>
          </>
        }
      >
        <form id="property-form" onSubmit={save} className="space-y-5" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <PropertyFields value={editing} set={set} errors={errors} />
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title="Delete property"
        message={
          <>
            Delete <strong className="text-ink-900">{confirmDelete?.name}</strong>? This also removes
            its lease history and maintenance records. This cannot be undone.
          </>
        }
        confirmLabel="Delete property"
        busy={saving}
        error={formError}
        onConfirm={remove}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  )
}
