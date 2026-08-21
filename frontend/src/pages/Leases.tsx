import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { api, readError } from '../lib/api'
import type { FieldErrors } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { formatDate, money } from '../lib/format'
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
  Select,
  StatCard,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Textarea,
} from '../components/ui'
import type { Lease, Property, Tenant } from '../lib/types'

type LeaseForm = Partial<Lease> & { generate_schedule?: boolean }

const today = new Date().toISOString().slice(0, 10)
const inAYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)

const BLANK: LeaseForm = {
  property_id: undefined,
  tenant_id: undefined,
  start_date: today,
  end_date: inAYear,
  rent_amount: 0,
  deposit_amount: 0,
  rent_due_day: 5,
  status: 'active',
  terms: '',
  generate_schedule: true,
}

interface LeaseSummary {
  total: number
  active: number
  expiring_soon: number
  expired: number
  terminated: number
  expiring_window_days: number
  monthly_rent_roll: number
  deposits_held: number
}

export default function Leases() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') ?? 'all')

  const { data, loading, error, reload } = useResource<Lease[]>('/leases', { status })
  const { data: summary, reload: reloadSummary } = useResource<LeaseSummary>('/leases/summary')
  const { data: properties } = useResource<Property[]>('/properties')
  const { data: tenants } = useResource<Tenant[]>('/tenants')

  const [editing, setEditing] = useState<LeaseForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Lease | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const changeStatus = (value: string) => {
    setStatus(value)
    setParams(value === 'all' ? {} : { status: value }, { replace: true })
  }

  const refresh = async () => {
    await Promise.all([reload(), reloadSummary()])
  }

  const set = (patch: LeaseForm) => setEditing((prev) => ({ ...prev, ...patch }))

  // Only vacant units can start a new lease; keep the current one when editing.
  const selectableProperties = (properties ?? []).filter(
    (property) => property.status !== 'occupied' || property.id === editing?.property_id,
  )
  const selectableTenants = (tenants ?? []).filter(
    (tenant) => tenant.lease_status === 'none' || tenant.id === editing?.tenant_id,
  )

  const pickProperty = (id: number) => {
    const property = properties?.find((item) => item.id === id)
    set({
      property_id: id,
      rent_amount: property?.rent_amount ?? editing?.rent_amount ?? 0,
      deposit_amount: property?.security_deposit ?? editing?.deposit_amount ?? 0,
    })
  }

  const open = (lease?: Lease) => {
    setErrors({})
    setFormError('')
    setEditing(lease ? { ...lease } : { ...BLANK })
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setFormError('')
    setErrors({})
    try {
      if (editing.id) {
        await api(`/leases/${editing.id}`, { method: 'PUT', body: editing })
        toast.success('Lease updated')
      } else {
        await api('/leases', { method: 'POST', body: editing })
        toast.success('Lease created')
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
      await api(`/leases/${confirmDelete.id}`, { method: 'DELETE' })
      setConfirmDelete(null)
      toast.success('Lease deleted')
      await refresh()
    } catch (err) {
      setFormError(readError(err).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Leases"
        subtitle="Agreements linking a tenant to a property, with rent terms and expiry tracking."
        action={<Button onClick={() => open()}>+ New lease</Button>}
      />

      {summary && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active leases" value={summary.active} tone="green" />
          <StatCard
            label="Expiring soon"
            value={summary.expiring_soon}
            hint={`Within ${summary.expiring_window_days} days`}
            tone={summary.expiring_soon ? 'amber' : 'neutral'}
          />
          <StatCard label="Monthly rent roll" value={money(summary.monthly_rent_roll)} tone="brand" />
          <StatCard label="Deposits held" value={money(summary.deposits_held)} tone="neutral" />
        </div>
      )}

      <Tabs
        value={status}
        onChange={changeStatus}
        tabs={[
          { value: 'all', label: 'All', count: summary?.total },
          { value: 'active', label: 'Active', count: summary?.active },
          { value: 'expiring_soon', label: 'Expiring soon', count: summary?.expiring_soon },
          { value: 'expired', label: 'Expired', count: summary?.expired },
          { value: 'terminated', label: 'Terminated', count: summary?.terminated },
        ]}
      />

      <Card>
        {loading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No leases here"
            message="Create a lease to link a tenant to a property."
            action={<Button onClick={() => open()}>+ New lease</Button>}
          />
        ) : (
          <Table
            columns={['Lease', 'Property', 'Tenant', 'Term', 'Rent', 'Status', '']}
            minWidth={900}
          >
            {data.map((lease) => (
              <tr key={lease.id} className="hover:bg-ink-100/60">
                <Td>
                  <Link
                    to={`/leases/${lease.id}`}
                    className="font-mono text-xs font-medium text-brand-600 hover:underline"
                  >
                    {lease.lease_code}
                  </Link>
                </Td>
                <Td>
                  <Link
                    to={`/properties/${lease.property_id}`}
                    className="font-medium text-ink-900 hover:text-brand-600 hover:underline"
                  >
                    {lease.property_name}
                  </Link>
                  <div className="text-xs text-ink-500">{lease.property_address}</div>
                </Td>
                <Td>
                  <Link to={`/tenants/${lease.tenant_id}`} className="hover:text-brand-600 hover:underline">
                    {lease.tenant_name}
                  </Link>
                </Td>
                <Td>
                  <div className="text-xs">
                    {formatDate(lease.start_date)} → {formatDate(lease.end_date)}
                  </div>
                  {lease.status === 'active' && lease.days_remaining !== null && lease.days_remaining !== undefined && (
                    <div
                      className={`text-xs ${
                        lease.days_remaining < 60 ? 'text-warning' : 'text-ink-500'
                      }`}
                    >
                      {lease.days_remaining >= 0
                        ? `${lease.days_remaining} days left`
                        : `expired ${Math.abs(lease.days_remaining)} days ago`}
                    </div>
                  )}
                </Td>
                <Td className="font-medium">
                  {money(lease.rent_amount)}
                  <div className="text-xs font-normal text-ink-500">due on the {lease.rent_due_day}th</div>
                </Td>
                <Td>
                  <Badge>{lease.lease_state}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <Link to={`/leases/${lease.id}`}>
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => open(lease)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => {
                      setFormError('')
                      setConfirmDelete(lease)
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
        title={editing?.id ? 'Edit lease' : 'Create lease'}
        subtitle={editing?.id ? editing.lease_code : 'Link a tenant to a vacant property'}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button form="lease-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save lease'}
            </Button>
          </>
        }
      >
        <form id="lease-form" onSubmit={save} className="space-y-4" noValidate>
          {formError && !Object.keys(errors).length && <Alert message={formError} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Property"
              required
              error={errors.property_id}
              hint={editing?.id ? undefined : 'Only vacant units are listed.'}
            >
              <Select
                required
                disabled={Boolean(editing?.id)}
                invalid={Boolean(errors.property_id)}
                value={editing?.property_id ?? ''}
                onChange={(event) => pickProperty(Number(event.target.value))}
              >
                <option value="">Select a property…</option>
                {selectableProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name} — {money(property.rent_amount)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Tenant"
              required
              error={errors.tenant_id}
              hint={editing?.id ? undefined : 'Only tenants without an active lease.'}
            >
              <Select
                required
                disabled={Boolean(editing?.id)}
                invalid={Boolean(errors.tenant_id)}
                value={editing?.tenant_id ?? ''}
                onChange={(event) => set({ tenant_id: Number(event.target.value) })}
              >
                <option value="">Select a tenant…</option>
                {selectableTenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.full_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Start date" required error={errors.start_date}>
              <Input
                type="date"
                required
                invalid={Boolean(errors.start_date)}
                value={editing?.start_date?.slice(0, 10) ?? ''}
                onChange={(event) => set({ start_date: event.target.value })}
              />
            </Field>
            <Field label="End date" required error={errors.end_date}>
              <Input
                type="date"
                required
                invalid={Boolean(errors.end_date)}
                value={editing?.end_date?.slice(0, 10) ?? ''}
                onChange={(event) => set({ end_date: event.target.value })}
              />
            </Field>
            <Field label="Monthly rent (₹)" required error={errors.rent_amount}>
              <Input
                type="number"
                min={0}
                required
                invalid={Boolean(errors.rent_amount)}
                value={editing?.rent_amount ?? 0}
                onChange={(event) => set({ rent_amount: Number(event.target.value) })}
              />
            </Field>
            <Field label="Security deposit (₹)" error={errors.deposit_amount}>
              <Input
                type="number"
                min={0}
                invalid={Boolean(errors.deposit_amount)}
                value={editing?.deposit_amount ?? 0}
                onChange={(event) => set({ deposit_amount: Number(event.target.value) })}
              />
            </Field>
            <Field label="Rent due day" error={errors.rent_due_day} hint="Day of the month, 1–28.">
              <Input
                type="number"
                min={1}
                max={28}
                invalid={Boolean(errors.rent_due_day)}
                value={editing?.rent_due_day ?? 5}
                onChange={(event) => set({ rent_due_day: Number(event.target.value) })}
              />
            </Field>
            <Field label="Status" error={errors.status}>
              <Select
                value={editing?.status ?? 'active'}
                onChange={(event) => set({ status: event.target.value as Lease['status'] })}
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="terminated">Terminated</option>
              </Select>
            </Field>
            <Field label="Additional terms" className="sm:col-span-2">
              <Textarea
                value={editing?.terms ?? ''}
                onChange={(event) => set({ terms: event.target.value })}
                placeholder="Notice period, lock-in, maintenance responsibilities…"
              />
            </Field>
          </div>

          {!editing?.id && (
            <div className="rounded-lg border border-ink-200 bg-sunken p-4">
              <Checkbox
                label="Generate the monthly rent schedule"
                description="Creates one pending invoice for every month of the term."
                checked={editing?.generate_schedule !== false}
                onChange={(value) => set({ generate_schedule: value })}
              />
            </div>
          )}
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title="Delete lease"
        message={
          <>
            Delete the lease for <strong className="text-ink-900">{confirmDelete?.tenant_name}</strong> at{' '}
            <strong className="text-ink-900">{confirmDelete?.property_name}</strong>? All rent
            invoices under it are removed and the property is marked available.
          </>
        }
        confirmLabel="Delete lease"
        busy={saving}
        error={formError}
        onConfirm={remove}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  )
}
