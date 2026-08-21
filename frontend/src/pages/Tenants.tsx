import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { api, readError, upload } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { formatDate, initials } from '../lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchBar,
  Select,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Textarea,
} from '../components/ui'
import type { Tenant } from '../lib/types'

type TenantForm = Partial<Tenant> & { create_login?: boolean; password?: string }

const BLANK: TenantForm = {
  full_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  id_proof_type: 'Aadhaar',
  id_number: '',
  occupation: '',
  unit_room: '',
  emergency_name: '',
  emergency_relationship: '',
  emergency_phone: '',
  notes: '',
  create_login: true,
  password: '',
}

const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Driving Licence', 'Voter ID']
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say']

export default function Tenants() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [leaseStatus, setLeaseStatus] = useState('all')
  const { data, loading, error, reload } = useResource<Tenant[]>('/tenants', {
    search,
    lease_status: leaseStatus,
  })

  const [editing, setEditing] = useState<TenantForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Tenant | null>(null)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (patch: TenantForm) => setEditing((prev) => ({ ...prev, ...patch }))

  const open = (tenant?: Tenant) => {
    setErrors({})
    setFormError('')
    setDocumentFile(null)
    setEditing(tenant ? { ...tenant } : { ...BLANK })
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      const saved = editing.id
        ? await api<Tenant>(`/tenants/${editing.id}`, { method: 'PUT', body: editing })
        : await api<Tenant>('/tenants', { method: 'POST', body: editing })

      // Documents go up separately as multipart once the record exists.
      if (documentFile) {
        const formData = new FormData()
        formData.append('file', documentFile)
        await upload(`/tenants/${saved.id}/document`, formData)
      }

      setEditing(null)
      toast.success(editing.id ? 'Tenant updated' : 'Tenant added')
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
    if (!confirmDelete) return
    setSaving(true)
    setFormError('')
    try {
      await api(`/tenants/${confirmDelete.id}`, { method: 'DELETE' })
      setConfirmDelete(null)
      toast.success('Tenant deleted')
      await reload()
    } catch (err) {
      setFormError(readError(err).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle="Tenant records, identification and current occupancy."
        action={<Button onClick={() => open()}>+ Add tenant</Button>}
      />

      <Tabs
        value={leaseStatus}
        onChange={setLeaseStatus}
        tabs={[
          { value: 'all', label: 'All tenants' },
          { value: 'active', label: 'Active lease' },
          { value: 'expiring_soon', label: 'Expiring soon' },
          { value: 'unassigned', label: 'Unassigned' },
        ]}
      />

      <Card className="mb-4 p-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email or phone…"
          className="max-w-md"
        />
      </Card>

      <Card>
        {loading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No tenants found"
            message="Add a tenant to start assigning leases."
            action={<Button onClick={() => open()}>+ Add tenant</Button>}
          />
        ) : (
          <Table
            columns={['Tenant', 'Contact', 'ID proof', 'Current property', 'Lease', 'Portal', '']}
            minWidth={900}
          >
            {data.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-ink-100/60">
                <Td>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                      {initials(tenant.full_name)}
                    </span>
                    <div>
                      <Link
                        to={`/tenants/${tenant.id}`}
                        className="font-medium text-ink-900 hover:text-brand-600 hover:underline"
                      >
                        {tenant.full_name}
                      </Link>
                      <div className="text-xs text-ink-500">{tenant.occupation || '—'}</div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <div className="text-sm">{tenant.email}</div>
                  <div className="text-xs text-ink-500">{tenant.phone || '—'}</div>
                </Td>
                <Td className="text-sm">
                  {tenant.id_proof_type || <span className="text-ink-400">—</span>}
                  {tenant.id_number && (
                    <div className="font-mono text-xs text-ink-500">{tenant.id_number}</div>
                  )}
                </Td>
                <Td>
                  {tenant.current_property ? (
                    <Link
                      to={`/properties/${tenant.current_property_id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {tenant.current_property}
                    </Link>
                  ) : (
                    <span className="text-ink-400">Not assigned</span>
                  )}
                  {tenant.unit_room && (
                    <div className="text-xs text-ink-500">Unit {tenant.unit_room}</div>
                  )}
                </Td>
                <Td>
                  <Badge>{tenant.lease_status === 'none' ? 'no lease' : tenant.lease_status}</Badge>
                </Td>
                <Td>
                  {tenant.has_login ? (
                    <Badge tone="green">enabled</Badge>
                  ) : (
                    <span className="text-xs text-ink-400">none</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <Link to={`/tenants/${tenant.id}`}>
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => open(tenant)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => {
                      setFormError('')
                      setConfirmDelete(tenant)
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

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? 'Edit tenant' : 'Add tenant'}
        subtitle={editing?.id ? editing.email : 'Register a new tenant record'}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button form="tenant-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save tenant'}
            </Button>
          </>
        }
      >
        <form id="tenant-form" onSubmit={save} className="space-y-5" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Personal information
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required error={errors.full_name} className="sm:col-span-2">
                <Input
                  required
                  invalid={Boolean(errors.full_name)}
                  value={editing?.full_name ?? ''}
                  onChange={(event) => set({ full_name: event.target.value })}
                />
              </Field>
              <Field label="Email" required error={errors.email}>
                <Input
                  type="email"
                  required
                  disabled={Boolean(editing?.id)}
                  invalid={Boolean(errors.email)}
                  value={editing?.email ?? ''}
                  onChange={(event) => set({ email: event.target.value })}
                />
              </Field>
              <Field label="Phone" error={errors.phone}>
                <Input
                  invalid={Boolean(errors.phone)}
                  value={editing?.phone ?? ''}
                  onChange={(event) => set({ phone: event.target.value })}
                />
              </Field>
              <Field label="Date of birth" error={errors.date_of_birth}>
                <Input
                  type="date"
                  invalid={Boolean(errors.date_of_birth)}
                  value={editing?.date_of_birth?.slice(0, 10) ?? ''}
                  onChange={(event) => set({ date_of_birth: event.target.value })}
                />
              </Field>
              <Field label="Gender">
                <Select
                  value={editing?.gender ?? ''}
                  onChange={(event) => set({ gender: event.target.value })}
                >
                  <option value="">Not specified</option>
                  {GENDERS.map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Occupation" className="sm:col-span-2">
                <Input
                  value={editing?.occupation ?? ''}
                  onChange={(event) => set({ occupation: event.target.value })}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Identification
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ID proof type">
                <Select
                  value={editing?.id_proof_type ?? ''}
                  onChange={(event) => set({ id_proof_type: event.target.value })}
                >
                  <option value="">Not provided</option>
                  {ID_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="ID number">
                <Input
                  value={editing?.id_number ?? ''}
                  onChange={(event) => set({ id_number: event.target.value })}
                />
              </Field>
              <Field
                label="Document upload"
                className="sm:col-span-2"
                error={errors.document}
                hint={
                  editing?.document_name
                    ? 'A document is already on file. Choosing a new one replaces it.'
                    : 'PDF or image, up to 8 MB.'
                }
              >
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  invalid={Boolean(errors.document)}
                  onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                  className="file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-700"
                />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Property
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Unit / room" hint="Assign a property from the tenant's detail page.">
                <Input
                  value={editing?.unit_room ?? ''}
                  onChange={(event) => set({ unit_room: event.target.value })}
                  placeholder="4B"
                />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Emergency contact
            </legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Contact name">
                <Input
                  value={editing?.emergency_name ?? ''}
                  onChange={(event) => set({ emergency_name: event.target.value })}
                />
              </Field>
              <Field label="Relationship">
                <Input
                  value={editing?.emergency_relationship ?? ''}
                  onChange={(event) => set({ emergency_relationship: event.target.value })}
                  placeholder="Spouse"
                />
              </Field>
              <Field label="Phone number">
                <Input
                  value={editing?.emergency_phone ?? ''}
                  onChange={(event) => set({ emergency_phone: event.target.value })}
                />
              </Field>
            </div>
          </fieldset>

          <Field label="Notes">
            <Textarea
              value={editing?.notes ?? ''}
              onChange={(event) => set({ notes: event.target.value })}
            />
          </Field>

          {!editing?.id && (
            <div className="rounded-lg border border-ink-200 bg-sunken p-4">
              <Checkbox
                label="Create a tenant portal login with this email"
                description="They can sign in to view their lease, rent and maintenance requests."
                checked={Boolean(editing?.create_login)}
                onChange={(value) => set({ create_login: value })}
              />
              {editing?.create_login && (
                <div className="mt-3">
                  <Field
                    label="Temporary password"
                    error={errors.password}
                    hint="Leave blank to use the default: tenant123"
                  >
                    <Input
                      type="text"
                      invalid={Boolean(errors.password)}
                      value={editing?.password ?? ''}
                      onChange={(event) => set({ password: event.target.value })}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {editing?.created_at && (
            <p className="text-xs text-ink-500">Added {formatDate(editing.created_at)}</p>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title="Delete tenant"
        message={
          <>
            Delete <strong className="text-ink-900">{confirmDelete?.full_name}</strong>? Their portal
            login, lease history and payment records are removed with them.
          </>
        }
        confirmLabel="Delete tenant"
        busy={saving}
        error={formError}
        onConfirm={remove}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  )
}
