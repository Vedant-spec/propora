import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { api, download, readError, upload } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { formatDate, initials, money, titleCase } from '../lib/format'
import BackLink from '../components/BackLink'
import TenantFields from '../components/forms/TenantFields'
import type { TenantForm } from '../components/forms/TenantFields'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  Detail,
  DetailGrid,
  DetailSkeleton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
} from '../components/ui'
import type { Lease, MaintenanceRequest, Property, Tenant } from '../lib/types'

interface TenantDetail extends Tenant {
  leases: Lease[]
  maintenance_requests: MaintenanceRequest[]
  current_lease: (Lease & { totals?: Record<string, number> }) | null
}

const today = new Date().toISOString().slice(0, 10)
const inAYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)

export default function TenantDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, loading, error, reload } = useResource<TenantDetail>(`/tenants/${id}`)
  const { data: properties } = useResource<Property[]>('/properties', { status: 'available' })

  const [assigning, setAssigning] = useState(false)
  const [editing, setEditing] = useState<TenantForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    property_id: '',
    start_date: today,
    end_date: inAYear,
    rent_amount: 0,
    deposit_amount: 0,
    rent_due_day: 5,
    unit_room: '',
    terms: '',
    generate_schedule: true,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading) return <DetailSkeleton />
  if (error) return <Alert message={error} />
  if (!data) return null

  const lease = data.current_lease
  const setField = (patch: TenantForm) => setEditing((prev) => ({ ...prev, ...patch }))

  const openEdit = () => {
    setErrors({})
    setFormError('')
    setDocumentFile(null)
    setEditing({ ...data })
  }

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      await api(`/tenants/${id}`, { method: 'PUT', body: editing })
      if (documentFile) {
        const formData = new FormData()
        formData.append('file', documentFile)
        await upload(`/tenants/${id}/document`, formData)
      }
      setEditing(null)
      toast.success('Tenant updated')
      await reload()
    } catch (err) {
      const parsed = readError(err)
      setFormError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    setFormError('')
    try {
      await api(`/tenants/${id}`, { method: 'DELETE' })
      toast.success('Tenant deleted')
      navigate('/tenants', { replace: true })
    } catch (err) {
      setFormError(readError(err).message)
      setSaving(false)
    }
  }

  const openDocument = async () => {
    try {
      await download(`/tenants/${id}/document`, {}, `${data.full_name} - ID document`)
    } catch (err) {
      toast.error(readError(err).message)
    }
  }

  const pickProperty = (value: string) => {
    const property = properties?.find((item) => item.id === Number(value))
    setForm((prev) => ({
      ...prev,
      property_id: value,
      rent_amount: property?.rent_amount ?? prev.rent_amount,
      deposit_amount: property?.security_deposit ?? prev.deposit_amount,
      unit_room: property?.unit_label ?? prev.unit_room,
    }))
  }

  const assign = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      await api(`/tenants/${id}/assign`, { method: 'POST', body: form })
      setAssigning(false)
      toast.success(`${data.full_name} assigned to the property`)
      await reload()
    } catch (err) {
      const parsed = readError(err)
      setFormError(parsed.message)
      setErrors(parsed.errors)
    } finally {
      setSaving(false)
    }
  }

  const createLogin = async () => {
    try {
      await api(`/tenants/${id}/login`, { method: 'POST', body: {} })
      toast.success('Portal login created with the default password')
      await reload()
    } catch (err) {
      toast.error(readError(err).message)
    }
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/tenants" label="All tenants" />}
        title={data.full_name}
        subtitle={data.occupation ?? data.email}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge>{data.lease_status === 'none' ? 'no lease' : data.lease_status}</Badge>
            {!lease && (
              <Button size="sm" onClick={() => setAssigning(true)}>
                Assign property
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={openEdit}>
              Edit tenant
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger-soft"
              onClick={() => {
                setFormError('')
                setConfirmDelete(true)
              }}
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Personal information" />
            <DetailGrid>
              <Detail label="Full name" value={data.full_name} />
              <Detail label="Email" value={data.email} />
              <Detail label="Phone" value={data.phone} />
              <Detail label="Date of birth" value={formatDate(data.date_of_birth)} />
              <Detail label="Gender" value={titleCase(data.gender)} />
              <Detail label="Occupation" value={data.occupation} />
            </DetailGrid>
          </Card>

          <Card>
            <CardHeader title="Identification" />
            <DetailGrid>
              <Detail label="ID proof type" value={data.id_proof_type} />
              <Detail label="ID number" value={data.id_number} />
              <Detail
                label="Document"
                value={
                  data.document_name ? (
                    <button
                      type="button"
                      onClick={openDocument}
                      className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M10 2.5a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V3.25A.75.75 0 0 1 10 2.5ZM3.5 14a.75.75 0 0 1 .75.75v1.5h11.5v-1.5a.75.75 0 0 1 1.5 0v2.25a.75.75 0 0 1-.75.75H3.5a.75.75 0 0 1-.75-.75V14.75A.75.75 0 0 1 3.5 14Z" />
                      </svg>
                      Download
                    </button>
                  ) : (
                    <span className="text-ink-500">Not uploaded</span>
                  )
                }
              />
            </DetailGrid>
          </Card>

          <Card>
            <CardHeader title="Emergency contact" />
            <DetailGrid>
              <Detail label="Contact name" value={data.emergency_name} />
              <Detail label="Relationship" value={data.emergency_relationship} />
              <Detail label="Phone number" value={data.emergency_phone} />
            </DetailGrid>
          </Card>

          <Card>
            <CardHeader title="Lease history" />
            {data.leases.length === 0 ? (
              <EmptyState
                title="No leases yet"
                message="Assign this tenant to a property to create their first lease."
                action={<Button size="sm" onClick={() => setAssigning(true)}>Assign property</Button>}
              />
            ) : (
              <Table columns={['Lease', 'Property', 'Term', 'Rent', 'Status']} minWidth={560}>
                {data.leases.map((item) => (
                  <tr key={item.id} className="hover:bg-ink-100/60">
                    <Td>
                      <Link to={`/leases/${item.id}`} className="font-medium text-brand-600 hover:underline">
                        {item.lease_code}
                      </Link>
                    </Td>
                    <Td>
                      <Link to={`/properties/${item.property_id}`} className="hover:underline">
                        {item.property_name}
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
            <CardHeader title="Maintenance requests" />
            {data.maintenance_requests.length === 0 ? (
              <EmptyState title="No requests raised" />
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
          <Card className="p-6 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-700">
              {initials(data.full_name)}
            </span>
            <p className="mt-3 font-semibold text-ink-900">{data.full_name}</p>
            <p className="text-sm text-ink-500">{data.email}</p>
            <div className="mt-4 border-t border-ink-200 pt-4">
              {data.has_login ? (
                <Badge tone="green">Portal login enabled</Badge>
              ) : (
                <>
                  <p className="mb-3 text-sm text-ink-500">No portal login yet.</p>
                  <Button size="sm" variant="secondary" className="w-full" onClick={createLogin}>
                    Create portal login
                  </Button>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Current property" />
            {lease ? (
              <div className="space-y-4 p-5">
                <div>
                  <p className="text-sm text-ink-500">Property</p>
                  <Link
                    to={`/properties/${lease.property_id}`}
                    className="mt-1 block font-medium text-brand-600 hover:underline"
                  >
                    {lease.property_name}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-500">{lease.property_address}</p>
                </div>
                <dl className="space-y-3 border-t border-ink-200 pt-4">
                  <Detail label="Unit / room" value={data.unit_room} />
                  <Detail label="Monthly rent" value={money(lease.rent_amount)} />
                  <Detail label="Deposit" value={money(lease.deposit_amount)} />
                  <Detail label="Lease ends" value={formatDate(lease.end_date)} />
                  {lease.totals && (
                    <Detail
                      label="Outstanding"
                      value={
                        <span className={lease.totals.outstanding > 0 ? 'text-warning' : 'text-success'}>
                          {money(lease.totals.outstanding)}
                        </span>
                      }
                    />
                  )}
                </dl>
              </div>
            ) : (
              <EmptyState
                title="Not assigned"
                message="This tenant is not currently occupying a property."
                action={<Button size="sm" onClick={() => setAssigning(true)}>Assign property</Button>}
              />
            )}
          </Card>

          {data.notes && (
            <Card>
              <CardHeader title="Notes" />
              <p className="whitespace-pre-line px-5 py-4 text-sm text-ink-600">{data.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Tenant property assignment */}
      <Modal
        open={assigning}
        title="Assign property"
        subtitle={`Create a lease linking ${data.full_name} to a vacant unit`}
        onClose={() => setAssigning(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssigning(false)}>
              Cancel
            </Button>
            <Button form="assign-form" type="submit" disabled={saving}>
              {saving ? 'Assigning…' : 'Assign property'}
            </Button>
          </>
        }
      >
        <form id="assign-form" onSubmit={assign} className="space-y-4" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <Field label="Property" required error={errors.property_id} hint="Only vacant units are listed.">
            <Select
              required
              invalid={Boolean(errors.property_id)}
              value={form.property_id}
              onChange={(event) => pickProperty(event.target.value)}
            >
              <option value="">Select a property…</option>
              {(properties ?? []).map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} — {money(property.rent_amount)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lease start" required error={errors.start_date}>
              <Input
                type="date"
                required
                invalid={Boolean(errors.start_date)}
                value={form.start_date}
                onChange={(event) => setForm({ ...form, start_date: event.target.value })}
              />
            </Field>
            <Field label="Lease end" required error={errors.end_date}>
              <Input
                type="date"
                required
                invalid={Boolean(errors.end_date)}
                value={form.end_date}
                onChange={(event) => setForm({ ...form, end_date: event.target.value })}
              />
            </Field>
            <Field label="Monthly rent (₹)" error={errors.rent_amount}>
              <Input
                type="number"
                min={0}
                invalid={Boolean(errors.rent_amount)}
                value={form.rent_amount}
                onChange={(event) => setForm({ ...form, rent_amount: Number(event.target.value) })}
              />
            </Field>
            <Field label="Security deposit (₹)" error={errors.deposit_amount}>
              <Input
                type="number"
                min={0}
                value={form.deposit_amount}
                onChange={(event) => setForm({ ...form, deposit_amount: Number(event.target.value) })}
              />
            </Field>
            <Field label="Unit / room">
              <Input
                value={form.unit_room}
                onChange={(event) => setForm({ ...form, unit_room: event.target.value })}
                placeholder="4B"
              />
            </Field>
            <Field label="Rent due day" error={errors.rent_due_day} hint="Day of the month, 1–28.">
              <Input
                type="number"
                min={1}
                max={28}
                invalid={Boolean(errors.rent_due_day)}
                value={form.rent_due_day}
                onChange={(event) => setForm({ ...form, rent_due_day: Number(event.target.value) })}
              />
            </Field>
            <Field label="Terms" className="sm:col-span-2">
              <Textarea
                value={form.terms}
                onChange={(event) => setForm({ ...form, terms: event.target.value })}
                placeholder="Notice period, lock-in, maintenance responsibilities…"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 rounded-lg border border-ink-200 bg-sunken p-4 text-sm font-medium text-ink-700">
            <input
              type="checkbox"
              checked={form.generate_schedule}
              onChange={(event) => setForm({ ...form, generate_schedule: event.target.checked })}
              className="h-4 w-4 rounded border-ink-300 accent-brand-600"
            />
            Generate a monthly rent invoice for every month of the term
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Edit tenant"
        subtitle={editing?.email}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button form="tenant-detail-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save tenant'}
            </Button>
          </>
        }
      >
        <form id="tenant-detail-form" onSubmit={saveEdit} className="space-y-5" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}
          <TenantFields
            value={editing}
            set={setField}
            errors={errors}
            onDocument={setDocumentFile}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={confirmDelete}
        title="Delete tenant"
        message={
          <>
            Delete <strong className="text-ink-900">{data.full_name}</strong>? Their portal login,
            lease history and payment records are removed with them.
          </>
        }
        confirmLabel="Delete tenant"
        busy={saving}
        error={formError}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}
