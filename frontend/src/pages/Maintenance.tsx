import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { api, readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { formatDate, titleCase } from '../lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchBar,
  Select,
  StatCard,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Textarea,
} from '../components/ui'
import type { MaintenanceRequest, Property, Tenant } from '../lib/types'

const CATEGORIES = ['plumbing', 'electrical', 'cleaning', 'hvac', 'security', 'other']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']

export default function Maintenance() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [status, setStatus] = useState(params.get('status') ?? 'open')
  const [priority, setPriority] = useState('all')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const propertyId = params.get('property') ?? ''

  const { data, loading, error, reload } = useResource<MaintenanceRequest[]>('/maintenance', {
    status,
    priority,
    category,
    search,
    property_id: propertyId,
  })
  const { data: properties } = useResource<Property[]>('/properties')
  const { data: tenants } = useResource<Tenant[]>('/tenants')

  const [creating, setCreating] = useState<Partial<MaintenanceRequest> | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const counts = useMemo(() => {
    const rows = data ?? []
    return {
      total: rows.length,
      urgent: rows.filter((row) => row.priority === 'urgent').length,
      unassigned: rows.filter((row) => !row.assigned_to).length,
      inProgress: rows.filter((row) => row.status === 'in_progress').length,
    }
  }, [data])

  const changeStatus = (value: string) => {
    setStatus(value)
    const next = new URLSearchParams(params)
    next.set('status', value)
    setParams(next, { replace: true })
  }

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      await api('/maintenance', { method: 'POST', body: creating })
      setCreating(null)
      toast.success('Maintenance request logged')
      await reload()
    } catch (err) {
      const parsed = readError(err)
      setFormError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Maintenance"
        subtitle="Complaints raised by tenants and jobs logged by the team."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/maintenance/dashboard">
              <Button variant="secondary">Dashboard</Button>
            </Link>
            <Link to="/maintenance/history">
              <Button variant="secondary">History</Button>
            </Link>
            <Button
              onClick={() => {
                setErrors({})
                setFormError('')
                setCreating({ priority: 'medium', category: 'other' })
              }}
            >
              + Log request
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Showing" value={counts.total} tone="brand" />
        <StatCard label="Urgent" value={counts.urgent} tone={counts.urgent ? 'red' : 'green'} />
        <StatCard
          label="Unassigned"
          value={counts.unassigned}
          tone={counts.unassigned ? 'amber' : 'green'}
        />
        <StatCard label="In progress" value={counts.inProgress} tone="neutral" />
      </div>

      <Tabs
        value={status}
        onChange={changeStatus}
        tabs={[
          { value: 'open', label: 'Still open' },
          { value: 'assigned', label: 'Assigned' },
          { value: 'in_progress', label: 'In progress' },
          { value: 'completed', label: 'Completed' },
          { value: 'closed', label: 'Closed' },
          { value: 'all', label: 'All' },
        ]}
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search ticket, title or description…"
            className="lg:col-span-2"
          />
          <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="all">All priorities</option>
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </Select>
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </Select>
        </div>
        {propertyId && (
          <p className="mt-3 text-sm text-ink-500">
            Filtered to one property.{' '}
            <Link to="/maintenance" className="text-brand-600 hover:underline">
              Clear filter
            </Link>
          </p>
        )}
      </Card>

      <Card>
        {loading ? (
          <TableSkeleton rows={7} columns={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="Nothing to show"
            message="No maintenance requests match these filters."
          />
        ) : (
          <Table
            columns={['Ticket', 'Property', 'Raised by', 'Priority', 'Status', 'Assigned to', 'Age', '']}
            minWidth={1000}
          >
            {data.map((request) => (
              <tr key={request.id} className="hover:bg-ink-100/60">
                <Td>
                  <Link
                    to={`/maintenance/${request.id}`}
                    className="font-medium text-ink-900 hover:text-brand-600 hover:underline"
                  >
                    {request.title}
                  </Link>
                  <div className="text-xs text-ink-500">
                    <span className="font-mono">{request.ticket_code}</span> ·{' '}
                    <span className="capitalize">{request.category}</span>
                  </div>
                </Td>
                <Td className="text-sm">{request.property_name}</Td>
                <Td className="text-sm">
                  {request.tenant_name ?? <span className="text-ink-500">Staff</span>}
                </Td>
                <Td>
                  <Badge>{request.priority}</Badge>
                </Td>
                <Td>
                  <Badge>{request.status}</Badge>
                </Td>
                <Td className="text-sm">
                  {request.assignee_name ?? <span className="text-ink-500">Unassigned</span>}
                  {request.technician_name && (
                    <div className="text-xs text-ink-500">{request.technician_name}</div>
                  )}
                </Td>
                <Td>
                  <span className={request.age_days && request.age_days >= 7 ? 'text-warning' : ''}>
                    {request.age_days}d
                  </span>
                  <div className="text-xs text-ink-500">{formatDate(request.created_at)}</div>
                </Td>
                <Td className="text-right">
                  <Link to={`/maintenance/${request.id}`}>
                    <Button size="sm" variant="secondary">
                      Manage
                    </Button>
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Log a new request */}
      <Modal
        open={Boolean(creating)}
        title="Log maintenance request"
        subtitle="Raise a job against a property on behalf of a tenant or the building"
        onClose={() => setCreating(null)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(null)}>
              Cancel
            </Button>
            <Button form="create-maintenance" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create request'}
            </Button>
          </>
        }
      >
        <form id="create-maintenance" onSubmit={submitCreate} className="space-y-4" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <Field label="Title" required error={errors.title}>
            <Input
              required
              invalid={Boolean(errors.title)}
              value={creating?.title ?? ''}
              onChange={(event) => setCreating((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Kitchen tap is leaking"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Property" required error={errors.property_id}>
              <Select
                required
                invalid={Boolean(errors.property_id)}
                value={creating?.property_id ?? ''}
                onChange={(event) =>
                  setCreating((prev) => ({ ...prev, property_id: Number(event.target.value) }))
                }
              >
                <option value="">Select a property…</option>
                {(properties ?? []).map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tenant" hint="Optional — leave blank for common-area work.">
              <Select
                value={creating?.tenant_id ?? ''}
                onChange={(event) =>
                  setCreating((prev) => ({
                    ...prev,
                    tenant_id: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              >
                <option value="">No specific tenant</option>
                {(tenants ?? []).map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category" error={errors.category}>
              <Select
                invalid={Boolean(errors.category)}
                value={creating?.category ?? 'other'}
                onChange={(event) => setCreating((prev) => ({ ...prev, category: event.target.value }))}
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" error={errors.priority}>
              <Select
                invalid={Boolean(errors.priority)}
                value={creating?.priority ?? 'medium'}
                onChange={(event) =>
                  setCreating((prev) => ({
                    ...prev,
                    priority: event.target.value as MaintenanceRequest['priority'],
                  }))
                }
              >
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea
                value={creating?.description ?? ''}
                onChange={(event) =>
                  setCreating((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="What is wrong, when it started, access instructions…"
              />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  )
}
