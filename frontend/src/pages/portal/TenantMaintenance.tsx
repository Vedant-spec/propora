import { useState } from 'react'
import { useResource } from '../../hooks/useResource'
import { api, readError } from '../../lib/api'
import type { FieldErrors } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { formatDate, formatDateTime, titleCase } from '../../lib/format'
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
  ProgressSteps,
  Select,
  StatCard,
  Tabs,
  TableSkeleton,
  Textarea,
} from '../../components/ui'
import type { MaintenanceRequest } from '../../lib/types'

const CATEGORIES = ['plumbing', 'electrical', 'cleaning', 'hvac', 'security', 'other']

const STEPS = [
  { key: 'open', label: 'Open' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'closed', label: 'Closed' },
]

const BLANK = { title: '', description: '', category: 'other', priority: 'medium' }

export default function TenantMaintenance() {
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const { data, loading, error, reload } = useResource<MaintenanceRequest[]>('/maintenance', {
    status: filter,
  })

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      await api('/maintenance', { method: 'POST', body: form })
      setOpen(false)
      setForm(BLANK)
      toast.success('Request submitted — the team has been notified')
      await reload()
    } catch (err) {
      const parsed = readError(err)
      setFormError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSaving(false)
    }
  }

  const requests = data ?? []
  const openCount = requests.filter((item) =>
    ['open', 'assigned', 'in_progress'].includes(item.status),
  ).length

  return (
    <>
      <PageHeader
        title="Maintenance"
        subtitle="Raise a complaint and follow it through to completion."
        action={
          <Button
            onClick={() => {
              setErrors({})
              setFormError('')
              setOpen(true)
            }}
          >
            + New request
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total raised" value={requests.length} tone="brand" />
        <StatCard label="Still open" value={openCount} tone={openCount ? 'amber' : 'green'} />
        <StatCard label="Resolved" value={requests.length - openCount} tone="green" />
      </div>

      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'all', label: 'All requests' },
          { value: 'open', label: 'Open' },
          { value: 'history', label: 'Resolved' },
        ]}
      />

      {loading ? (
        <Card>
          <TableSkeleton rows={4} columns={3} />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState
            title="No requests here"
            message="Something not working at home? Raise a request and the team will pick it up."
            action={<Button onClick={() => setOpen(true)}>+ New request</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const stepIndex = Math.max(
              STEPS.findIndex((step) => step.key === request.status),
              0,
            )
            return (
              <Card key={request.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink-900">{request.title}</h3>
                    <p className="mt-0.5 text-sm text-ink-500">
                      <span className="font-mono text-xs">{request.ticket_code}</span> ·{' '}
                      <span className="capitalize">{request.category}</span> · raised{' '}
                      {formatDate(request.created_at)}
                      {request.assignee_name ? ` · handled by ${request.assignee_name}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{request.priority}</Badge>
                    <Badge>{request.status}</Badge>
                  </div>
                </div>

                {request.description && (
                  <p className="mt-3 text-sm text-ink-600">{request.description}</p>
                )}

                <div className="mt-5">
                  <ProgressSteps steps={STEPS} current={stepIndex} />
                </div>

                {(request.technician_name || request.scheduled_date) && (
                  <div className="mt-5 grid gap-3 rounded-lg bg-sunken p-4 sm:grid-cols-2">
                    {request.technician_name && (
                      <div>
                        <p className="text-xs text-ink-500">Technician</p>
                        <p className="mt-0.5 text-sm font-medium text-ink-900">
                          {request.technician_name}
                        </p>
                        {request.technician_phone && (
                          <p className="text-xs text-ink-500">{request.technician_phone}</p>
                        )}
                      </div>
                    )}
                    {request.scheduled_date && (
                      <div>
                        <p className="text-xs text-ink-500">Scheduled visit</p>
                        <p className="mt-0.5 text-sm font-medium text-ink-900">
                          {formatDate(request.scheduled_date)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {request.resolution_notes && (
                  <div className="mt-4 rounded-lg bg-success-soft px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-success">
                      Resolution
                    </p>
                    <p className="mt-1 text-sm text-success">{request.resolution_notes}</p>
                    {request.completed_at && (
                      <p className="mt-1.5 text-xs text-success opacity-80">
                        Completed {formatDateTime(request.completed_at)}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        title="Raise a maintenance request"
        subtitle="Tell us what needs fixing and how urgent it is"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button form="tenant-maintenance" type="submit" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit request'}
            </Button>
          </>
        }
      >
        <form id="tenant-maintenance" onSubmit={submit} className="space-y-4" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <Field label="What is the problem?" required error={errors.title}>
            <Input
              required
              invalid={Boolean(errors.title)}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Kitchen tap is leaking"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" error={errors.category}>
              <Select
                invalid={Boolean(errors.category)}
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="How urgent is it?" error={errors.priority}>
              <Select
                invalid={Boolean(errors.priority)}
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
              >
                <option value="low">Low — can wait</option>
                <option value="medium">Medium — this week</option>
                <option value="high">High — within a day or two</option>
                <option value="urgent">Urgent — unsafe or unusable</option>
              </Select>
            </Field>
          </div>

          <Field
            label="Describe it"
            hint="When it started, what you have already tried, best time to visit."
          >
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </>
  )
}
