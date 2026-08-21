import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { api, readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { formatDate, formatDateTime, money, titleCase } from '../lib/format'
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
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressSteps,
  Select,
  Textarea,
} from '../components/ui'
import type { MaintenanceRequest, User } from '../lib/types'

const STEPS = [
  { key: 'open', label: 'Open' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'closed', label: 'Closed' },
]

const STATUSES = ['open', 'assigned', 'in_progress', 'completed', 'closed']

export default function MaintenanceDetails() {
  const { id } = useParams()
  const toast = useToast()
  const { data, loading, error, reload } = useResource<MaintenanceRequest>(`/maintenance/${id}`)
  const { data: users } = useResource<User[]>('/auth/users')

  const [assigning, setAssigning] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [assignForm, setAssignForm] = useState({
    assigned_to: '',
    technician_name: '',
    technician_phone: '',
    scheduled_date: '',
  })
  const [statusForm, setStatusForm] = useState({ status: '', resolution_notes: '', cost: 0 })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading) return <DetailSkeleton />
  if (error) return <Alert message={error} />
  if (!data) return null

  const staff = (users ?? []).filter((user) => user.role !== 'tenant')
  const currentStep = Math.max(STEPS.findIndex((step) => step.key === data.status), 0)

  const openAssign = () => {
    setAssignForm({
      assigned_to: data.assigned_to ? String(data.assigned_to) : '',
      technician_name: data.technician_name ?? '',
      technician_phone: data.technician_phone ?? '',
      scheduled_date: data.scheduled_date ?? '',
    })
    setErrors({})
    setFormError('')
    setAssigning(true)
  }

  const openUpdate = () => {
    setStatusForm({
      status: data.status,
      resolution_notes: data.resolution_notes ?? '',
      cost: data.cost ?? 0,
    })
    setErrors({})
    setFormError('')
    setUpdating(true)
  }

  const submitAssign = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      await api(`/maintenance/${id}/assign`, { method: 'POST', body: assignForm })
      setAssigning(false)
      toast.success('Request assigned')
      await reload()
    } catch (err) {
      const parsed = readError(err)
      setFormError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSaving(false)
    }
  }

  const submitUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      await api(`/maintenance/${id}`, { method: 'PUT', body: statusForm })
      setUpdating(false)
      toast.success(`Status updated to ${statusForm.status.replace('_', ' ')}`)
      await reload()
    } catch (err) {
      const parsed = readError(err)
      setFormError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSaving(false)
    }
  }

  const timeline = [
    { label: 'Raised', at: data.created_at },
    { label: 'Assigned', at: data.assigned_at },
    { label: 'Completed', at: data.completed_at },
    { label: 'Closed', at: data.closed_at },
  ].filter((entry) => entry.at)

  return (
    <>
      <PageHeader
        back={<BackLink to="/maintenance" label="All requests" />}
        title={data.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{data.ticket_code}</span>
            <span>·</span>
            <span className="capitalize">{data.category}</span>
            <span>·</span>
            <span>raised {formatDate(data.created_at)}</span>
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Badge>{data.priority}</Badge>
            <Badge>{data.status}</Badge>
            <Button size="sm" variant="secondary" onClick={openAssign}>
              Assign
            </Button>
            <Button size="sm" onClick={openUpdate}>
              Update status
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardHeader title="Progress" subtitle={`Open for ${data.age_days} day${data.age_days === 1 ? '' : 's'}`} />
        <div className="p-5">
          <ProgressSteps steps={STEPS} current={currentStep} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Request information" />
            <DetailGrid>
              <Detail label="Ticket" value={data.ticket_code} />
              <Detail label="Category" value={titleCase(data.category)} />
              <Detail label="Priority" value={<Badge>{data.priority}</Badge>} />
              <Detail label="Status" value={<Badge>{data.status}</Badge>} />
              <Detail label="Age" value={`${data.age_days} days`} />
              <Detail label="Cost" value={data.cost ? money(data.cost) : null} />
            </DetailGrid>
          </Card>

          {data.description && (
            <Card>
              <CardHeader title="Description" />
              <p className="whitespace-pre-line px-5 py-4 text-sm text-ink-600">{data.description}</p>
            </Card>
          )}

          {data.resolution_notes && (
            <Card>
              <CardHeader title="Resolution" />
              <div className="px-5 py-4">
                <div className="rounded-lg bg-success-soft px-4 py-3">
                  <p className="whitespace-pre-line text-sm text-success">{data.resolution_notes}</p>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Timeline" />
            <ol className="px-5 py-4">
              {timeline.map((entry, index) => (
                <li key={entry.label} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-600" />
                    {index < timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-ink-200" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-medium text-ink-900">{entry.label}</p>
                    <p className="text-xs text-ink-500">{formatDateTime(entry.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Property" />
            <div className="p-5">
              <Link to={`/properties/${data.property_id}`} className="font-medium text-brand-600 hover:underline">
                {data.property_name}
              </Link>
              <p className="mt-1 text-sm text-ink-500">{data.property_address}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Raised by" />
            <div className="p-5">
              {data.tenant_id ? (
                <>
                  <Link to={`/tenants/${data.tenant_id}`} className="font-medium text-brand-600 hover:underline">
                    {data.tenant_name}
                  </Link>
                  {data.tenant_phone && <p className="mt-1 text-sm text-ink-500">{data.tenant_phone}</p>}
                </>
              ) : (
                <p className="text-sm text-ink-500">Logged by staff</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Assignment" />
            <div className="p-5">
              {data.assignee_name || data.technician_name ? (
                <dl className="space-y-3">
                  <Detail label="Staff owner" value={data.assignee_name} />
                  <Detail label="Technician" value={data.technician_name} />
                  <Detail label="Technician phone" value={data.technician_phone} />
                  <Detail label="Scheduled visit" value={formatDate(data.scheduled_date)} />
                </dl>
              ) : (
                <>
                  <p className="mb-3 text-sm text-ink-500">Nobody is assigned to this request yet.</p>
                  <Button size="sm" className="w-full" onClick={openAssign}>
                    Assign now
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Assign request */}
      <Modal
        open={assigning}
        title="Assign maintenance request"
        subtitle={data.ticket_code}
        onClose={() => setAssigning(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssigning(false)}>
              Cancel
            </Button>
            <Button form="assign-request" type="submit" disabled={saving}>
              {saving ? 'Assigning…' : 'Assign request'}
            </Button>
          </>
        }
      >
        <form id="assign-request" onSubmit={submitAssign} className="space-y-4" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <Field label="Staff owner" error={errors.assigned_to}>
            <Select
              invalid={Boolean(errors.assigned_to)}
              value={assignForm.assigned_to}
              onChange={(event) => setAssignForm({ ...assignForm, assigned_to: event.target.value })}
            >
              <option value="">Unassigned</option>
              {staff.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Technician / vendor">
              <Input
                value={assignForm.technician_name}
                onChange={(event) => setAssignForm({ ...assignForm, technician_name: event.target.value })}
                placeholder="Ramesh Plumbing Works"
              />
            </Field>
            <Field label="Technician phone">
              <Input
                value={assignForm.technician_phone}
                onChange={(event) => setAssignForm({ ...assignForm, technician_phone: event.target.value })}
              />
            </Field>
            <Field label="Scheduled visit" className="sm:col-span-2" error={errors.scheduled_date}>
              <Input
                type="date"
                invalid={Boolean(errors.scheduled_date)}
                value={assignForm.scheduled_date}
                onChange={(event) => setAssignForm({ ...assignForm, scheduled_date: event.target.value })}
              />
            </Field>
          </div>

          <Alert tone="info" message="Assigning moves an open request to Assigned and notifies the tenant." />
        </form>
      </Modal>

      {/* Update status */}
      <Modal
        open={updating}
        title="Update status"
        subtitle={data.ticket_code}
        onClose={() => setUpdating(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUpdating(false)}>
              Cancel
            </Button>
            <Button form="update-request" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="update-request" onSubmit={submitUpdate} className="space-y-4" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <Field label="Status" required error={errors.status}>
            <Select
              invalid={Boolean(errors.status)}
              value={statusForm.status}
              onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value })}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Cost (₹)" error={errors.cost} hint="Parts, labour and vendor charges.">
            <Input
              type="number"
              min={0}
              invalid={Boolean(errors.cost)}
              value={statusForm.cost}
              onChange={(event) => setStatusForm({ ...statusForm, cost: Number(event.target.value) })}
            />
          </Field>

          <Field
            label="Resolution notes"
            error={errors.resolution_notes}
            required={['completed', 'closed'].includes(statusForm.status)}
            hint="Required before a request can be completed or closed."
          >
            <Textarea
              invalid={Boolean(errors.resolution_notes)}
              value={statusForm.resolution_notes}
              onChange={(event) => setStatusForm({ ...statusForm, resolution_notes: event.target.value })}
              placeholder="What was done, who attended, parts replaced…"
            />
          </Field>
        </form>
      </Modal>
    </>
  )
}
