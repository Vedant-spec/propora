import type { FieldErrors } from '../../lib/api'
import { money } from '../../lib/format'
import { Field, Input, Select, Textarea } from '../ui'
import type { Lease, Property, Tenant } from '../../lib/types'

export type LeaseForm = Partial<Lease> & { generate_schedule?: boolean }

const today = () => new Date().toISOString().slice(0, 10)
const inAYear = () => new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)

export const blankLease = (): LeaseForm => ({
  property_id: undefined,
  tenant_id: undefined,
  start_date: today(),
  end_date: inAYear(),
  rent_amount: 0,
  deposit_amount: 0,
  rent_due_day: 5,
  status: 'active',
  terms: '',
  generate_schedule: true,
})

/**
 * The lease form body. Shared by the Leases list and the Lease details page.
 * Property and tenant are fixed once a lease exists — changing either would
 * silently rewrite history, so those selects are disabled when editing.
 */
export default function LeaseFields({
  value,
  set,
  errors,
  properties,
  tenants,
}: {
  value: LeaseForm | null
  set: (patch: LeaseForm) => void
  errors: FieldErrors
  properties: Property[]
  tenants: Tenant[]
}) {
  const editing = Boolean(value?.id)

  // Only vacant units can start a new lease; keep the current one when editing.
  const selectableProperties = properties.filter(
    (property) => property.status !== 'occupied' || property.id === value?.property_id,
  )
  const selectableTenants = tenants.filter(
    (tenant) => tenant.lease_status === 'none' || tenant.id === value?.tenant_id,
  )

  const pickProperty = (id: number) => {
    const property = properties.find((item) => item.id === id)
    set({
      property_id: id,
      rent_amount: property?.rent_amount ?? value?.rent_amount ?? 0,
      deposit_amount: property?.security_deposit ?? value?.deposit_amount ?? 0,
    })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Property"
        required
        error={errors.property_id}
        hint={editing ? undefined : 'Only vacant units are listed.'}
      >
        <Select
          required
          disabled={editing}
          invalid={Boolean(errors.property_id)}
          value={value?.property_id ?? ''}
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
        hint={editing ? undefined : 'Only tenants without an active lease.'}
      >
        <Select
          required
          disabled={editing}
          invalid={Boolean(errors.tenant_id)}
          value={value?.tenant_id ?? ''}
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
          value={value?.start_date?.slice(0, 10) ?? ''}
          onChange={(event) => set({ start_date: event.target.value })}
        />
      </Field>
      <Field label="End date" required error={errors.end_date}>
        <Input
          type="date"
          required
          invalid={Boolean(errors.end_date)}
          value={value?.end_date?.slice(0, 10) ?? ''}
          onChange={(event) => set({ end_date: event.target.value })}
        />
      </Field>
      <Field label="Monthly rent (₹)" required error={errors.rent_amount}>
        <Input
          type="number"
          min={0}
          required
          invalid={Boolean(errors.rent_amount)}
          value={value?.rent_amount ?? 0}
          onChange={(event) => set({ rent_amount: Number(event.target.value) })}
        />
      </Field>
      <Field label="Security deposit (₹)" error={errors.deposit_amount}>
        <Input
          type="number"
          min={0}
          invalid={Boolean(errors.deposit_amount)}
          value={value?.deposit_amount ?? 0}
          onChange={(event) => set({ deposit_amount: Number(event.target.value) })}
        />
      </Field>
      <Field label="Rent due day" error={errors.rent_due_day} hint="Day of the month, 1–28.">
        <Input
          type="number"
          min={1}
          max={28}
          invalid={Boolean(errors.rent_due_day)}
          value={value?.rent_due_day ?? 5}
          onChange={(event) => set({ rent_due_day: Number(event.target.value) })}
        />
      </Field>
      <Field label="Status" error={errors.status}>
        <Select
          value={value?.status ?? 'active'}
          onChange={(event) => set({ status: event.target.value as Lease['status'] })}
        >
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </Select>
      </Field>
      <Field label="Additional terms" className="sm:col-span-2">
        <Textarea
          value={value?.terms ?? ''}
          onChange={(event) => set({ terms: event.target.value })}
          placeholder="Notice period, lock-in, maintenance responsibilities…"
        />
      </Field>
    </div>
  )
}
