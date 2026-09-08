import { titleCase } from '../../lib/format'
import type { FieldErrors } from '../../lib/api'
import { Field, Input, Select, Textarea } from '../ui'
import type { Property } from '../../lib/types'

export const FURNISHINGS = ['unfurnished', 'semi_furnished', 'furnished']

export const BLANK_PROPERTY: Partial<Property> = {
  name: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  property_type: 'residential',
  unit_label: '',
  floor: '',
  furnishing: 'unfurnished',
  bedrooms: 0,
  bathrooms: 0,
  area_sqft: 0,
  rent_amount: 0,
  security_deposit: 0,
  maintenance_charge: 0,
  status: 'available',
  description: '',
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

/**
 * The property form body. Shared by the Properties list and the Property
 * details page so both edit exactly the same fields.
 */
export default function PropertyFields({
  value,
  set,
  errors,
}: {
  value: Partial<Property> | null
  set: (patch: Partial<Property>) => void
  errors: FieldErrors
}) {
  return (
    <>
      <Group title="Identity">
        <Field label="Property name" required error={errors.name} className="sm:col-span-2">
          <Input
            required
            invalid={Boolean(errors.name)}
            value={value?.name ?? ''}
            onChange={(event) => set({ name: event.target.value })}
            placeholder="Riverstone Apartments 4B"
          />
        </Field>
        <Field
          label="Property ID"
          error={errors.property_code}
          hint="Leave blank to generate automatically."
        >
          <Input
            invalid={Boolean(errors.property_code)}
            value={value?.property_code ?? ''}
            onChange={(event) => set({ property_code: event.target.value })}
            placeholder="PR-0001"
          />
        </Field>
        <Field label="Property type" error={errors.property_type}>
          <Select
            value={value?.property_type ?? 'residential'}
            onChange={(event) =>
              set({ property_type: event.target.value as Property['property_type'] })
            }
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </Select>
        </Field>
      </Group>

      <Group title="Address">
        <Field label="Address" required error={errors.address} className="sm:col-span-2">
          <Input
            required
            invalid={Boolean(errors.address)}
            value={value?.address ?? ''}
            onChange={(event) => set({ address: event.target.value })}
          />
        </Field>
        <Field label="City">
          <Input value={value?.city ?? ''} onChange={(event) => set({ city: event.target.value })} />
        </Field>
        <Field label="State">
          <Input value={value?.state ?? ''} onChange={(event) => set({ state: event.target.value })} />
        </Field>
        <Field label="Pincode">
          <Input
            value={value?.zip_code ?? ''}
            onChange={(event) => set({ zip_code: event.target.value })}
          />
        </Field>
        <Field label="Unit">
          <Input
            value={value?.unit_label ?? ''}
            onChange={(event) => set({ unit_label: event.target.value })}
            placeholder="4B"
          />
        </Field>
        <Field label="Floor">
          <Input
            value={value?.floor ?? ''}
            onChange={(event) => set({ floor: event.target.value })}
            placeholder="4th"
          />
        </Field>
      </Group>

      <Group title="Specification">
        <Field label="Bedrooms">
          <Input
            type="number"
            min={0}
            value={value?.bedrooms ?? 0}
            onChange={(event) => set({ bedrooms: Number(event.target.value) })}
          />
        </Field>
        <Field label="Bathrooms">
          <Input
            type="number"
            min={0}
            value={value?.bathrooms ?? 0}
            onChange={(event) => set({ bathrooms: Number(event.target.value) })}
          />
        </Field>
        <Field label="Area (sq ft)">
          <Input
            type="number"
            min={0}
            value={value?.area_sqft ?? 0}
            onChange={(event) => set({ area_sqft: Number(event.target.value) })}
          />
        </Field>
        <Field label="Furnishing">
          <Select
            value={value?.furnishing ?? 'unfurnished'}
            onChange={(event) => set({ furnishing: event.target.value })}
          >
            {FURNISHINGS.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
        </Field>
      </Group>

      <Group title="Commercials">
        <Field label="Monthly rent (₹)" error={errors.rent_amount}>
          <Input
            type="number"
            min={0}
            invalid={Boolean(errors.rent_amount)}
            value={value?.rent_amount ?? 0}
            onChange={(event) => set({ rent_amount: Number(event.target.value) })}
          />
        </Field>
        <Field label="Security deposit (₹)" error={errors.security_deposit}>
          <Input
            type="number"
            min={0}
            invalid={Boolean(errors.security_deposit)}
            value={value?.security_deposit ?? 0}
            onChange={(event) => set({ security_deposit: Number(event.target.value) })}
          />
        </Field>
        <Field label="Maintenance charge (₹)" error={errors.maintenance_charge}>
          <Input
            type="number"
            min={0}
            invalid={Boolean(errors.maintenance_charge)}
            value={value?.maintenance_charge ?? 0}
            onChange={(event) => set({ maintenance_charge: Number(event.target.value) })}
          />
        </Field>
        <Field
          label="Availability"
          error={errors.status}
          hint="Set automatically when a lease starts or ends."
        >
          <Select
            invalid={Boolean(errors.status)}
            value={value?.status ?? 'available'}
            onChange={(event) => set({ status: event.target.value as Property['status'] })}
          >
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Under maintenance</option>
          </Select>
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea
            value={value?.description ?? ''}
            onChange={(event) => set({ description: event.target.value })}
          />
        </Field>
      </Group>
    </>
  )
}
