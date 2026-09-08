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
  Modal,
  PageHeader,
  StatCard,
  Table,
  TableSkeleton,
  Tabs,
  Td,
} from '../components/ui'
import LeaseFields, { blankLease } from '../components/forms/LeaseFields'
import type { LeaseForm } from '../components/forms/LeaseFields'
import type { Lease, Property, Tenant } from '../lib/types'


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

  const open = (lease?: Lease) => {
    setErrors({})
    setFormError('')
    setEditing(lease ? { ...lease } : blankLease())
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

          <LeaseFields
            value={editing}
            set={set}
            errors={errors}
            properties={properties ?? []}
            tenants={tenants ?? []}
          />

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
