import type { ReactNode } from 'react'
import type { FieldErrors } from '../../lib/api'
import { Field, Input, Select, Textarea } from '../ui'
import type { Tenant } from '../../lib/types'

export type TenantForm = Partial<Tenant> & { create_login?: boolean; password?: string }

export const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Driving Licence', 'Voter ID']
export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say']

export const BLANK_TENANT: TenantForm = {
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

function Group({
  title,
  columns = 2,
  children,
}: {
  title: string
  columns?: 2 | 3
  children: ReactNode
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
        {title}
      </legend>
      <div className={`grid gap-4 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {children}
      </div>
    </fieldset>
  )
}

/**
 * The tenant form body. Shared by the Tenants list and the Tenant details page.
 * `onDocument` is optional — omit it to hide the upload field.
 */
export default function TenantFields({
  value,
  set,
  errors,
  onDocument,
}: {
  value: TenantForm | null
  set: (patch: TenantForm) => void
  errors: FieldErrors
  onDocument?: (file: File | null) => void
}) {
  return (
    <>
      <Group title="Personal information">
        <Field label="Full name" required error={errors.full_name} className="sm:col-span-2">
          <Input
            required
            invalid={Boolean(errors.full_name)}
            value={value?.full_name ?? ''}
            onChange={(event) => set({ full_name: event.target.value })}
          />
        </Field>
        <Field label="Email" required error={errors.email}>
          <Input
            type="email"
            required
            disabled={Boolean(value?.id)}
            invalid={Boolean(errors.email)}
            value={value?.email ?? ''}
            onChange={(event) => set({ email: event.target.value })}
          />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input
            invalid={Boolean(errors.phone)}
            value={value?.phone ?? ''}
            onChange={(event) => set({ phone: event.target.value })}
          />
        </Field>
        <Field label="Date of birth" error={errors.date_of_birth}>
          <Input
            type="date"
            invalid={Boolean(errors.date_of_birth)}
            value={value?.date_of_birth?.slice(0, 10) ?? ''}
            onChange={(event) => set({ date_of_birth: event.target.value })}
          />
        </Field>
        <Field label="Gender">
          <Select value={value?.gender ?? ''} onChange={(event) => set({ gender: event.target.value })}>
            <option value="">Not specified</option>
            {GENDERS.map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Occupation" className="sm:col-span-2">
          <Input
            value={value?.occupation ?? ''}
            onChange={(event) => set({ occupation: event.target.value })}
          />
        </Field>
      </Group>

      <Group title="Identification">
        <Field label="ID proof type">
          <Select
            value={value?.id_proof_type ?? ''}
            onChange={(event) => set({ id_proof_type: event.target.value })}
          >
            <option value="">Not provided</option>
            {ID_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ID number">
          <Input
            value={value?.id_number ?? ''}
            onChange={(event) => set({ id_number: event.target.value })}
          />
        </Field>
        {onDocument && (
          <Field
            label="Document upload"
            className="sm:col-span-2"
            error={errors.document}
            hint={
              value?.document_name
                ? 'A document is already on file. Choosing a new one replaces it.'
                : 'PDF or image, up to 8 MB.'
            }
          >
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              invalid={Boolean(errors.document)}
              onChange={(event) => onDocument(event.target.files?.[0] ?? null)}
              className="file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-700"
            />
          </Field>
        )}
      </Group>

      <Group title="Property">
        <Field label="Unit / room" hint="Assign a property from the tenant's detail page.">
          <Input
            value={value?.unit_room ?? ''}
            onChange={(event) => set({ unit_room: event.target.value })}
            placeholder="4B"
          />
        </Field>
      </Group>

      <Group title="Emergency contact" columns={3}>
        <Field label="Contact name">
          <Input
            value={value?.emergency_name ?? ''}
            onChange={(event) => set({ emergency_name: event.target.value })}
          />
        </Field>
        <Field label="Relationship">
          <Input
            value={value?.emergency_relationship ?? ''}
            onChange={(event) => set({ emergency_relationship: event.target.value })}
            placeholder="Spouse"
          />
        </Field>
        <Field label="Phone number">
          <Input
            value={value?.emergency_phone ?? ''}
            onChange={(event) => set({ emergency_phone: event.target.value })}
          />
        </Field>
      </Group>

      <Field label="Notes">
        <Textarea value={value?.notes ?? ''} onChange={(event) => set({ notes: event.target.value })} />
      </Field>
    </>
  )
}
