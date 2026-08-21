/**
 * Seed data for the in-browser demo backend.
 *
 * Mirrors backend/seed.py so the hosted demo shows the same portfolio as a
 * real deployment: a mix of paid, partial and overdue rent, a lease close to
 * expiry, and maintenance tickets at every stage of the workflow.
 */

export interface DemoUser {
  id: number
  name: string
  email: string
  phone: string
  password: string
  role: 'admin' | 'manager' | 'tenant'
  is_active: boolean
  theme: string
  density: string
  notify_email: boolean
  notify_rent: boolean
  notify_maintenance: boolean
  notify_lease: boolean
  last_login_at: string | null
  password_changed_at: string | null
  created_at: string
}

const iso = (d: Date) => d.toISOString().slice(0, 19)
export const today = () => new Date()
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5)
export const ymd = (d: Date) => d.toISOString().slice(0, 10)

// name, address, city, state, pin, type, unit, floor, furnishing, beds, baths, area, rent
const PROPERTY_SEED: [string, string, string, string, string, string, string, string, string, number, number, number, number][] = [
  ['Riverstone Apartments 4B', '42 Riverstone Ave', 'Pune', 'MH', '411045', 'residential', '4B', '4th', 'semi_furnished', 2, 2, 1150, 28000],
  ['Maple Court Villa 12', '12 Maple Court', 'Pune', 'MH', '411021', 'residential', '12', 'Ground', 'furnished', 3, 3, 2100, 46500],
  ['Harbour View 9A', '9 Harbour Road', 'Mumbai', 'MH', '400005', 'residential', '9A', '9th', 'furnished', 1, 1, 620, 34000],
  ['Lakeside Residency 3C', '3 Lakeside Blvd', 'Pune', 'MH', '411014', 'residential', '3C', '3rd', 'unfurnished', 2, 2, 980, 24500],
  ['Orchid Heights 21', '21 Orchid Lane', 'Bengaluru', 'KA', '560034', 'residential', '21', '2nd', 'semi_furnished', 3, 2, 1650, 52000],
  ['Nexus Business Suite 501', '501 Nexus Tower, MG Road', 'Bengaluru', 'KA', '560001', 'commercial', '501', '5th', 'furnished', 0, 2, 3200, 118000],
  ['Trade Hub Unit 7', '7 Trade Hub, Sector 18', 'Noida', 'UP', '201301', 'commercial', '7', '1st', 'unfurnished', 0, 1, 1400, 62000],
  ['Willow Park 6D', '6 Willow Park', 'Pune', 'MH', '411038', 'residential', '6D', '6th', 'semi_furnished', 2, 1, 900, 21000],
  ['Corner Retail Shop 2', '2 Market Street', 'Pune', 'MH', '411002', 'commercial', '2', 'Ground', 'unfurnished', 0, 1, 480, 38000],
  ['Skyline Loft 15', '15 Skyline Residences', 'Mumbai', 'MH', '400076', 'residential', '15', '15th', 'furnished', 2, 2, 1080, 58000],
  ['Banyan Grove 8A', '8 Banyan Grove', 'Bengaluru', 'KA', '560076', 'residential', '8A', '8th', 'semi_furnished', 2, 2, 1240, 41000],
  ['Metro Plaza Office 302', '302 Metro Plaza', 'Noida', 'UP', '201309', 'commercial', '302', '3rd', 'furnished', 0, 2, 2200, 88000],
]

// name, email, phone, occupation, gender, dob, idType, idNumber, emgName, emgRel, emgPhone
const TENANT_SEED: [string, string, string, string, string, string, string, string, string, string, string][] = [
  ['Aarav Sharma', 'aarav.sharma@example.com', '+91 98200 41122', 'Software Engineer', 'male', '1993-04-18', 'Aadhaar', '4821 7736 9014', 'Sunita Sharma', 'Mother', '+91 98200 41100'],
  ['Diya Patel', 'diya.patel@example.com', '+91 98200 55310', 'Architect', 'female', '1990-11-02', 'Aadhaar', '6134 8890 2245', 'Nikhil Patel', 'Spouse', '+91 98200 55300'],
  ['Rohan Mehta', 'rohan.mehta@example.com', '+91 99300 71204', 'Chartered Accountant', 'male', '1988-07-25', 'PAN', 'AKJPM4471C', 'Priya Mehta', 'Sister', '+91 99300 71200'],
  ['Ishita Nair', 'ishita.nair@example.com', '+91 90040 88213', 'Doctor', 'female', '1995-01-30', 'Aadhaar', '7729 3345 8890', 'Rajan Nair', 'Father', '+91 90040 88200'],
  ['Kabir Singh', 'kabir.singh@example.com', '+91 97400 12098', 'Product Designer', 'male', '1992-09-14', 'Passport', 'M4471820', 'Harleen Singh', 'Spouse', '+91 97400 12000'],
  ['Ananya Rao', 'ananya.rao@example.com', '+91 98860 33441', 'Marketing Lead', 'female', '1991-03-08', 'Aadhaar', '3390 1123 7756', 'Suresh Rao', 'Father', '+91 98860 33400'],
  ['Vikram Desai', 'vikram.desai@example.com', '+91 99870 20456', 'Restaurateur', 'male', '1985-12-11', 'PAN', 'BXQPD9923K', 'Nisha Desai', 'Spouse', '+91 99870 20400'],
  ['Meera Joshi', 'meera.joshi@example.com', '+91 98191 44502', 'Data Analyst', 'female', '1996-06-21', 'Aadhaar', '8812 4467 3301', 'Anil Joshi', 'Father', '+91 98191 44500'],
]

// title, category, priority, description
const TICKET_SEED: [string, string, string, string][] = [
  ['Kitchen tap is leaking', 'plumbing', 'high', 'Water pooling under the sink since Monday morning.'],
  ['Bedroom AC not cooling', 'hvac', 'medium', 'Blows air but no cooling. Filter was cleaned last month.'],
  ['Main door lock jammed', 'security', 'urgent', 'Key turns but the latch does not retract fully.'],
  ['Balcony light fused', 'electrical', 'low', 'Bulb replaced twice, fuses again within a day.'],
  ['Seepage on living room wall', 'other', 'high', 'Damp patch spreading near the window frame.'],
  ['Lift making grinding noise', 'other', 'medium', 'Noticeable between floors 3 and 5.'],
  ['Geyser tripping the MCB', 'electrical', 'urgent', 'Trips the whole bathroom circuit when switched on.'],
  ['Broken window latch', 'other', 'low', 'Second bedroom window will not stay shut.'],
  ['Common corridor not cleaned', 'cleaning', 'low', 'Missed for the last four days on our floor.'],
  ['Bathroom drain blocked', 'plumbing', 'high', 'Water drains very slowly in the guest bathroom.'],
  ['CCTV camera offline', 'security', 'medium', 'Lobby camera shows no feed since the power cut.'],
  ['Deep clean before move-in', 'cleaning', 'medium', 'Requested ahead of the new tenancy start date.'],
]

const TECHNICIANS: [string, string][] = [
  ['Ramesh Plumbing Works', '+91 98220 11223'],
  ['Sparks Electrical', '+91 98220 44556'],
  ['CoolAir HVAC Services', '+91 98220 77889'],
  ['SecureFix Locksmiths', '+91 98220 33445'],
  ['BrightHome Cleaning', '+91 98220 66778'],
]

/** Deterministic PRNG so every viewer sees an identical portfolio. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

export function buildSeed() {
  const random = rng(20260821)
  const pick = <T,>(arr: T[]) => arr[Math.floor(random() * arr.length)]
  const now = today()

  const users: DemoUser[] = [
    mkUser(1, 'Priya Menon', 'admin@propora.app', '+91 98111 00001', 'admin123', 'admin'),
    mkUser(2, 'Arjun Kulkarni', 'manager@propora.app', '+91 98111 00002', 'manager123', 'manager'),
    mkUser(3, 'Sneha Iyer', 'sneha@propora.app', '+91 98111 00003', 'manager123', 'manager'),
  ]
  const staff = [users[1], users[2]]

  const properties = PROPERTY_SEED.map((row, i) => {
    const [name, address, city, state, zip, type, unit, floor, furnishing, beds, baths, area, rent] = row
    return {
      id: i + 1,
      property_code: `PR-${String(i + 1).padStart(4, '0')}`,
      name, address, city, state, zip_code: zip,
      property_type: type, unit_label: unit, floor, furnishing,
      bedrooms: beds, bathrooms: baths, area_sqft: area,
      rent_amount: rent, security_deposit: rent * 2,
      maintenance_charge: Math.round(rent * 0.05),
      status: 'available',
      description: `${type === 'commercial' ? 'Commercial unit' : 'Residential unit'} ${unit} on the ${floor} floor at ${address}, ${city}.`,
      manager_id: staff[i % staff.length].id,
      created_at: iso(daysAgo(400 - i * 10)),
    }
  })
  properties[properties.length - 1].status = 'maintenance'

  let userId = 4
  const tenants = TENANT_SEED.map((row, i) => {
    const [full_name, email, phone, occupation, gender, dob, idType, idNumber, emgName, emgRel, emgPhone] = row
    users.push(mkUser(userId, full_name, email, phone, 'tenant123', 'tenant'))
    const t = {
      id: i + 1,
      user_id: userId,
      full_name, email, phone,
      date_of_birth: dob,
      gender,
      id_proof_type: idType,
      id_number: idNumber,
      document_name: null as string | null,
      occupation,
      unit_room: '' as string,
      emergency_name: emgName,
      emergency_relationship: emgRel,
      emergency_phone: emgPhone,
      notes: '',
      created_at: iso(daysAgo(300 - i * 12)),
    }
    userId += 1
    return t
  })

  // Seven tenanted units; the first lease is deliberately close to expiry.
  const spans = [330, 300, 270, 240, 200, 150, 120]
  const leases: any[] = []
  const payments: any[] = []
  let paymentId = 1

  for (let i = 0; i < 7; i++) {
    const tenant = tenants[i]
    const property = properties[i]
    const start = new Date(daysAgo(spans[i]))
    start.setDate(1)
    const end = new Date(start)
    end.setDate(end.getDate() + 365)

    const lease = {
      id: i + 1,
      lease_code: `LS-${String(i + 1).padStart(4, '0')}`,
      property_id: property.id,
      tenant_id: tenant.id,
      start_date: ymd(start),
      end_date: ymd(end),
      rent_amount: property.rent_amount,
      deposit_amount: property.security_deposit,
      rent_due_day: 5,
      status: 'active',
      terms:
        'Standard 12-month agreement. Two months security deposit, one month notice period. ' +
        'Society maintenance billed separately. Interior repainting at the tenant’s cost on exit.',
      created_at: iso(start),
    }
    leases.push(lease)
    tenant.unit_room = property.unit_label
    property.status = 'occupied'

    // One invoice per month of the term.
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cursor <= last) {
      const due = new Date(cursor.getFullYear(), cursor.getMonth(), 5)
      const period = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      const p: any = {
        id: paymentId,
        payment_code: `PY-${String(paymentId).padStart(5, '0')}`,
        lease_id: lease.id,
        amount: lease.rent_amount,
        amount_paid: 0,
        due_date: ymd(due),
        paid_date: null,
        period,
        method: null,
        reference: null,
        notes: '',
        created_at: iso(due),
      }

      if (due <= now) {
        const roll = random()
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        if (period === currentPeriod) {
          if (roll < 0.6) settle(p, due, -Math.floor(random() * 4))
        } else if (roll < 0.86) {
          settle(p, due, Math.floor(random() * 7) - 2)
        } else if (roll < 0.94) {
          p.amount_paid = Math.round(p.amount * 0.5)
          p.paid_date = ymd(new Date(due.getTime() + 2 * 864e5))
          p.method = 'upi'
          p.reference = `TXN${100000 + Math.floor(random() * 899999)}`
          p.notes = 'Part payment received, balance promised next week.'
        }
      }
      payments.push(p)
      paymentId += 1
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  function settle(p: any, due: Date, offset: number) {
    p.amount_paid = p.amount
    p.paid_date = ymd(new Date(due.getTime() + offset * 864e5))
    p.method = pick(['upi', 'bank_transfer', 'cash', 'cheque', 'online'])
    p.reference = `TXN${100000 + Math.floor(random() * 899999)}`
  }

  const statuses = ['open', 'assigned', 'in_progress', 'completed', 'closed']
  const maintenance = TICKET_SEED.map((row, i) => {
    const [title, category, priority, description] = row
    const lease = leases[i % leases.length]
    const status = statuses[i % statuses.length]
    const created = daysAgo(1 + Math.floor(random() * 50))
    const assigned = status !== 'open'
    const done = status === 'completed' || status === 'closed'
    const [tech, techPhone] = TECHNICIANS[i % TECHNICIANS.length]
    return {
      id: i + 1,
      ticket_code: `MR-${String(i + 1).padStart(4, '0')}`,
      property_id: lease.property_id,
      tenant_id: lease.tenant_id,
      title, description, category, priority, status,
      assigned_to: assigned ? staff[i % staff.length].id : null,
      technician_name: assigned ? tech : null,
      technician_phone: assigned ? techPhone : null,
      scheduled_date: assigned ? ymd(new Date(created.getTime() + 2 * 864e5)) : null,
      cost: done ? pick([650, 1200, 1850, 2400, 3200]) : 0,
      resolution_notes: done
        ? 'Technician attended, part replaced and tested. Tenant confirmed the fix.'
        : null,
      created_at: iso(created),
      updated_at: iso(created),
      assigned_at: assigned ? iso(new Date(created.getTime() + 6 * 36e5)) : null,
      completed_at: done ? iso(new Date(created.getTime() + 3 * 864e5)) : null,
      closed_at: status === 'closed' ? iso(new Date(created.getTime() + 6 * 864e5)) : null,
    }
  })

  const notifications = [
    mkNote(1, null, 'staff', 'Rent overdue', 'Several invoices are past their due date and need chasing.', 'rent', '/payments', 0.5),
    mkNote(2, null, 'staff', 'Leases expiring soon', 'Review agreements ending in the next 60 days.', 'lease', '/leases', 0.6),
    mkNote(3, null, 'staff', 'Urgent maintenance open', 'Urgent tickets are waiting on assignment.', 'maintenance', '/maintenance', 0.7),
    mkNote(4, 4, null, 'Rent due soon', 'Your next rent instalment is due on the 5th.', 'rent', '/portal/payments', 0.4),
    mkNote(5, 5, null, 'Rent due soon', 'Your next rent instalment is due on the 5th.', 'rent', '/portal/payments', 0.4),
    mkNote(6, 6, null, 'Rent due soon', 'Your next rent instalment is due on the 5th.', 'rent', '/portal/payments', 0.4),
  ]

  const activitySeed: [string, string, string][] = [
    ['created', 'property', 'Property added: Skyline Loft 15'],
    ['created', 'tenant', 'Tenant added: Meera Joshi'],
    ['paid', 'payment', 'Payment recorded from Aarav Sharma'],
    ['updated', 'maintenance', 'MR-0003 moved to in progress'],
    ['created', 'lease', 'Lease created: Ananya Rao at Nexus Business Suite 501'],
    ['paid', 'payment', 'Payment recorded from Diya Patel'],
    ['updated', 'property', 'Property updated: Metro Plaza Office 302'],
    ['created', 'maintenance', 'Request raised: Bathroom drain blocked'],
  ]
  const activities = activitySeed.map(([action, entity_type, summary], i) => ({
    id: i + 1,
    actor_id: i % 3 === 0 ? 1 : 2,
    action,
    entity_type,
    entity_id: i + 1,
    summary,
    created_at: iso(new Date(Date.now() - (i * 7 + 2) * 36e5)),
  }))

  return { users, properties, tenants, leases, payments, maintenance, notifications, activities }
}

function mkUser(
  id: number,
  name: string,
  email: string,
  phone: string,
  password: string,
  role: DemoUser['role'],
): DemoUser {
  return {
    id, name, email, phone, password, role,
    is_active: true,
    theme: 'system',
    density: 'comfortable',
    notify_email: true,
    notify_rent: true,
    notify_maintenance: true,
    notify_lease: true,
    last_login_at: null,
    password_changed_at: iso(daysAgo(90)),
    created_at: iso(daysAgo(420)),
  }
}

function mkNote(
  id: number,
  user_id: number | null,
  audience: string | null,
  title: string,
  message: string,
  kind: string,
  link: string,
  hoursAgo: number,
) {
  return {
    id, user_id, audience, title, message, kind, link,
    is_read: false,
    created_at: iso(new Date(Date.now() - hoursAgo * 36e5)),
  }
}

export { TECHNICIANS }
