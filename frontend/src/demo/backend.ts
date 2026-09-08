/**
 * In-browser backend for the hosted demo.
 *
 * Implements the same routes and the same business rules as the Flask API, so
 * the real React screens run unchanged against it. State lives in localStorage,
 * which means each visitor gets their own private copy of the portfolio and can
 * edit freely without affecting anyone else.
 */
import { buildSeed, ymd } from './data'

const STORE_KEY = 'propora.demo.v1'
const EXPIRING_WINDOW_DAYS = 60
const MAINTENANCE_FLOW = ['open', 'assigned', 'in_progress', 'completed', 'closed']
const MAINTENANCE_OPEN = ['open', 'assigned', 'in_progress']
const CLOSED_STATUSES = ['completed', 'closed']
const UNSETTLED = ['pending', 'overdue', 'partial']

export class DemoError extends Error {
  status: number
  errors: Record<string, string>
  constructor(message: string, status = 400, errors: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

const invalid = (errors: Record<string, string>) =>
  new DemoError('Please correct the highlighted fields', 422, errors)

type Store = {
  users: any[]
  properties: any[]
  tenants: any[]
  leases: any[]
  payments: any[]
  maintenance: any[]
  notifications: any[]
  activities: any[]
}
let store: Store

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* corrupted or unavailable storage — fall back to a fresh seed */
  }
  const fresh = buildSeed()
  persist(fresh)
  return fresh
}

function persist(next: Store = store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    /* private browsing quota — the session still works in memory */
  }
}

export function resetDemo() {
  store = buildSeed()
  persist()
}

store = load()

/* ------------------------------------------------------------------ utils */

const todayStr = () => ymd(new Date())
const nowIso = () => new Date().toISOString().slice(0, 19)
const nextId = (rows: { id: number }[]) => (rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1)
const num = (v: any) => (v === '' || v === null || v === undefined ? 0 : Number(v))
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 864e5)

const userById = (id: number | null) => store.users.find((u) => u.id === id) ?? null
const propertyById = (id: number) => store.properties.find((p) => p.id === id)
const tenantById = (id: number) => store.tenants.find((t) => t.id === id)
const leaseById = (id: number) => store.leases.find((l) => l.id === id)

const tenantProfileFor = (userId: number) => store.tenants.find((t) => t.user_id === userId) ?? null
const activeLeaseForProperty = (pid: number) =>
  store.leases.find((l) => l.property_id === pid && l.status === 'active') ?? null
const activeLeaseForTenant = (tid: number) =>
  store.leases.find((l) => l.tenant_id === tid && l.status === 'active') ?? null

/** Derived invoice status — never stored, exactly as the Flask model does it. */
function paymentStatus(p: any): string {
  const due = num(p.amount)
  const paid = num(p.amount_paid)
  if (due > 0 && paid >= due) return 'paid'
  if (paid > 0 && paid < due) return 'partial'
  if (p.due_date && p.due_date < todayStr()) return 'overdue'
  return 'pending'
}

function leaseState(l: any): string {
  if (l.status !== 'active') return l.status
  const t = todayStr()
  if (l.end_date < t) return 'expired'
  const window = ymd(new Date(Date.now() + EXPIRING_WINDOW_DAYS * 864e5))
  if (l.end_date <= window) return 'expiring_soon'
  return 'active'
}

/* ------------------------------------------------------------ serialisers */

function userDto(u: any) {
  const profile = tenantProfileFor(u.id)
  const { password, ...rest } = u
  return { ...rest, phone_verified: u.phone_verified ?? true, tenant_id: profile?.id ?? null }
}

function propertyDto(p: any, deep = false): any {
  const lease = activeLeaseForProperty(p.id)
  const tenant = lease ? tenantById(lease.tenant_id) : null
  const manager = userById(p.manager_id)
  const data: any = {
    ...p,
    manager_name: manager?.name ?? null,
    current_tenant: tenant?.full_name ?? null,
    current_tenant_id: lease?.tenant_id ?? null,
    current_lease_id: lease?.id ?? null,
  }
  if (deep) {
    data.leases = store.leases
      .filter((l) => l.property_id === p.id)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .map((l) => leaseDto(l))
    data.maintenance_requests = store.maintenance
      .filter((m) => m.property_id === p.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(maintenanceDto)
    data.current_lease = lease ? leaseDto(lease, true) : null
  }
  return data
}

function tenantDto(t: any, deep = false): any {
  const lease = activeLeaseForTenant(t.id)
  const property = lease ? propertyById(lease.property_id) : null
  const data: any = {
    ...t,
    current_property: property?.name ?? null,
    current_property_id: lease?.property_id ?? null,
    lease_status: lease ? leaseState(lease) : 'none',
    has_login: t.user_id !== null && t.user_id !== undefined,
  }
  if (deep) {
    data.leases = store.leases
      .filter((l) => l.tenant_id === t.id)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .map((l) => leaseDto(l))
    data.current_lease = lease ? leaseDto(lease, true) : null
    data.maintenance_requests = store.maintenance
      .filter((m) => m.tenant_id === t.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(maintenanceDto)
  }
  return data
}

function leaseDto(l: any, deep = false): any {
  const property = propertyById(l.property_id)
  const tenant = tenantById(l.tenant_id)
  const data: any = {
    ...l,
    property_name: property?.name ?? null,
    property_address: property?.address ?? null,
    property_code: property?.property_code ?? null,
    tenant_name: tenant?.full_name ?? null,
    tenant_email: tenant?.email ?? null,
    tenant_phone: tenant?.phone ?? null,
    lease_state: leaseState(l),
    days_remaining: l.end_date ? daysBetween(l.end_date, todayStr()) : null,
  }
  if (deep) {
    const rows = store.payments
      .filter((p) => p.lease_id === l.id)
      .sort((a, b) => b.due_date.localeCompare(a.due_date))
    data.payments = rows.map(paymentDto)
    const billed = rows.reduce((s, p) => s + num(p.amount), 0)
    const collected = rows.reduce((s, p) => s + num(p.amount_paid), 0)
    data.totals = { billed, collected, outstanding: billed - collected }
  }
  return data
}

function paymentDto(p: any): any {
  const lease = leaseById(p.lease_id)
  const tenant = lease ? tenantById(lease.tenant_id) : null
  const property = lease ? propertyById(lease.property_id) : null
  const status = paymentStatus(p)
  return {
    ...p,
    status,
    balance: num(p.amount) - num(p.amount_paid),
    days_overdue:
      status === 'paid' || !p.due_date ? 0 : Math.max(daysBetween(todayStr(), p.due_date), 0),
    lease_code: lease?.lease_code ?? null,
    tenant_id: lease?.tenant_id ?? null,
    tenant_name: tenant?.full_name ?? null,
    tenant_email: tenant?.email ?? null,
    tenant_phone: tenant?.phone ?? null,
    property_id: lease?.property_id ?? null,
    property_name: property?.name ?? null,
    property_address: property?.address ?? null,
  }
}

function maintenanceDto(m: any): any {
  const property = propertyById(m.property_id)
  const tenant = m.tenant_id ? tenantById(m.tenant_id) : null
  const assignee = userById(m.assigned_to)
  const end = m.completed_at || m.closed_at || nowIso()
  return {
    ...m,
    property_name: property?.name ?? null,
    property_address: property?.address ?? null,
    tenant_name: tenant?.full_name ?? null,
    tenant_phone: tenant?.phone ?? null,
    assignee_name: assignee?.name ?? null,
    age_days: Math.max(daysBetween(end.slice(0, 10), m.created_at.slice(0, 10)), 0),
  }
}

/* ------------------------------------------------------------ side effects */

function logActivity(actorId: number | null, action: string, entity: string, id: number, summary: string) {
  store.activities.unshift({
    id: nextId(store.activities),
    actor_id: actorId,
    action,
    entity_type: entity,
    entity_id: id,
    summary,
    created_at: nowIso(),
  })
  store.activities = store.activities.slice(0, 60)
}

function notify(
  title: string,
  message: string,
  kind: string,
  link: string,
  opts: { user_id?: number | null; audience?: string | null },
) {
  store.notifications.unshift({
    id: nextId(store.notifications),
    user_id: opts.user_id ?? null,
    audience: opts.audience ?? null,
    title, message, kind, link,
    is_read: false,
    created_at: nowIso(),
  })
}

/** Create one pending rent invoice per month of the lease term. */
function generateSchedule(lease: any): number {
  const existing = new Set(
    store.payments.filter((p) => p.lease_id === lease.id).map((p) => p.period),
  )
  const start = new Date(lease.start_date)
  const end = new Date(lease.end_date)
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  let created = 0
  const day = Math.min(lease.rent_due_day || 5, 28)

  while (cursor <= last) {
    const period = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    if (!existing.has(period)) {
      const id = nextId(store.payments)
      store.payments.push({
        id,
        payment_code: `PY-${String(id).padStart(5, '0')}`,
        lease_id: lease.id,
        amount: lease.rent_amount,
        amount_paid: 0,
        due_date: ymd(new Date(cursor.getFullYear(), cursor.getMonth(), day)),
        paid_date: null,
        period,
        method: null,
        reference: null,
        notes: '',
        created_at: nowIso(),
      })
      created += 1
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return created
}

/* ------------------------------------------------------------------ auth */

let session: { userId: number } | null = null

const SESSION_KEY = 'propora.demo.session'
try {
  const raw = localStorage.getItem(SESSION_KEY)
  if (raw) session = JSON.parse(raw)
} catch {
  /* ignore */
}

function setSession(next: typeof session) {
  session = next
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

function requireUser() {
  const user = session ? userById(session.userId) : null
  if (!user || !user.is_active) throw new DemoError('Sign in to continue', 401)
  return user
}

function requireStaff() {
  const user = requireUser()
  if (user.role === 'tenant') {
    throw new DemoError('You do not have access to this resource', 403)
  }
  return user
}

function requireTenant() {
  const user = requireUser()
  if (user.role !== 'tenant') throw new DemoError('Tenant access only', 403)
  return user
}

/* --------------------------------------------------------------- routing */

type Ctx = { body: any; query: URLSearchParams }
type Handler = (ctx: Ctx, params: string[]) => any

const routes: [string, RegExp, Handler][] = []
const route = (method: string, pattern: RegExp, handler: Handler) =>
  routes.push([method, pattern, handler])

/* ---- auth ---- */

route('POST', /^\/auth\/login$/, ({ body }) => {
  const errors: Record<string, string> = {}
  if (!body.email) errors.email = 'Enter your email address'
  if (!body.password) errors.password = 'Enter your password'
  if (Object.keys(errors).length) throw invalid(errors)

  const user = store.users.find(
    (u) => u.email.toLowerCase() === String(body.email).trim().toLowerCase(),
  )
  if (!user || user.password !== body.password) {
    throw new DemoError('Invalid email or password', 401)
  }
  if (!user.is_active) throw new DemoError('This account has been disabled.', 403)

  user.last_login_at = nowIso()
  setSession({ userId: user.id })
  persist()
  return { access_token: `demo.${user.id}`, user: userDto(user) }
})

route('GET', /^\/auth\/me$/, () => userDto(requireUser()))

route('PUT', /^\/auth\/me$/, ({ body }) => {
  const user = requireUser()
  if ('name' in body && !String(body.name).trim()) {
    throw invalid({ name: 'Name cannot be empty' })
  }
  user.name = body.name ?? user.name
  user.phone = body.phone ?? user.phone

  const profile = tenantProfileFor(user.id)
  if (profile) {
    profile.full_name = user.name
    profile.phone = user.phone
    for (const f of ['occupation', 'gender', 'emergency_name', 'emergency_relationship', 'emergency_phone']) {
      if (f in body) (profile as any)[f] = body[f]
    }
  }
  persist()
  return userDto(user)
})

route('PUT', /^\/auth\/preferences$/, ({ body }) => {
  const user = requireUser()
  if (body.theme && !['light', 'dark', 'system'].includes(body.theme)) {
    throw invalid({ theme: 'Theme must be light, dark or system' })
  }
  for (const f of ['theme', 'density', 'notify_email', 'notify_rent', 'notify_maintenance', 'notify_lease']) {
    if (f in body) (user as any)[f] = body[f]
  }
  persist()
  return userDto(user)
})

route('POST', /^\/auth\/change-password$/, ({ body }) => {
  const user = requireUser()
  const errors: Record<string, string> = {}
  if (!body.current_password) errors.current_password = 'Enter your current password'
  else if (body.current_password !== user.password) {
    errors.current_password = 'That password is not correct'
  }
  if ((body.new_password || '').length < 6) errors.new_password = 'Use at least 6 characters'
  if (Object.keys(errors).length) throw invalid(errors)

  user.password = body.new_password
  user.password_changed_at = nowIso()
  logActivity(user.id, 'updated', 'account', user.id, `${user.name} changed their password`)
  persist()
  return { message: 'Password updated' }
})

route('POST', /^\/auth\/sign-out-everywhere$/, () => {
  const user = requireUser()
  logActivity(user.id, 'updated', 'account', user.id, `${user.name} signed out of all devices`)
  persist()
  return { message: 'Signed out of all other devices', access_token: `demo.${user.id}` }
})

route('POST', /^\/auth\/forgot-password$/, ({ body }) => {
  if (!body.email) throw invalid({ email: 'Enter your email address' })
  return {
    message: 'If that email is registered, a reset link is on its way.',
    expires_in_minutes: 30,
    demo_note: 'Email delivery needs a mail server, so no message is sent in this demo.',
  }
})

route('GET', /^\/auth\/reset-password\/(.+)$/, () => {
  throw new DemoError('This reset link is invalid or has expired', 400)
})

/* ---- self-service: sign up and phone sign-in ---- */

const EMAIL_RE_AUTH = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const OTP_TTL_MINUTES = 5
const OTP_RESEND_SECONDS = 60
const OTP_MAX_ATTEMPTS = 5

/** Match numbers the way people type them: on the last 10 digits. */
function normalizePhone(value: string) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

function findUserByPhone(phone: string) {
  const target = normalizePhone(phone)
  if (target.length < 10) return null
  return store.users.find((u) => u.phone && normalizePhone(u.phone) === target) ?? null
}

// Codes live in memory only — a refresh mid-flow simply means requesting a new one.
const otpStore = new Map<number, { code: string; expires: number; issued: number; attempts: number }>()

route('GET', /^\/auth\/signup-enabled$/, () => ({ enabled: true, sms_configured: false }))

route('POST', /^\/auth\/register$/, ({ body }) => {
  const errors: Record<string, string> = {}
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const phone = String(body.phone ?? '').trim()
  const password = body.password ?? ''

  if (!name) errors.name = 'Enter your full name'
  if (!email) errors.email = 'Enter your email address'
  else if (!EMAIL_RE_AUTH.test(email)) errors.email = 'Enter a valid email address'
  else if (store.users.some((u) => u.email.toLowerCase() === email)) {
    errors.email = 'An account with that email already exists. Try signing in.'
  }
  if (phone) {
    if (normalizePhone(phone).length < 10) errors.phone = 'Enter a valid 10-digit mobile number'
    else if (findUserByPhone(phone)) errors.phone = 'That mobile number is already registered'
  }
  if (password.length < 6) errors.password = 'Use at least 6 characters'
  if (password && password !== body.confirm_password) {
    errors.confirm_password = 'Passwords do not match'
  }
  if (Object.keys(errors).length) throw invalid(errors)

  const user: any = {
    id: nextId(store.users),
    name, email, phone: phone || null, password, role: 'tenant',
    is_active: true, phone_verified: false, theme: 'system', density: 'comfortable',
    notify_email: true, notify_rent: true, notify_maintenance: true, notify_lease: true,
    last_login_at: nowIso(), password_changed_at: nowIso(), created_at: nowIso(),
  }
  store.users.push(user)

  // Adopt a tenant record a manager already created for this email.
  const existing = store.tenants.find((t) => t.email.toLowerCase() === email)
  let linked = false
  if (existing && !existing.user_id) {
    existing.user_id = user.id
    if (phone && !existing.phone) existing.phone = phone
    linked = true
  } else if (existing) {
    store.users = store.users.filter((u) => u.id !== user.id)
    throw invalid({ email: 'An account with that email already exists. Try signing in.' })
  } else {
    store.tenants.push({
      id: nextId(store.tenants), user_id: user.id, full_name: name, email,
      phone: phone || null, date_of_birth: null, gender: '', id_proof_type: '',
      id_number: '', document_name: null, occupation: '', unit_room: '',
      emergency_name: '', emergency_relationship: '', emergency_phone: '',
      notes: '', created_at: nowIso(),
    } as any)
  }

  logActivity(user.id, 'created', 'user', user.id,
    `${name} signed up${linked ? ' and was linked to an existing tenant record' : ''}`)
  setSession({ userId: user.id })
  persist()
  return { access_token: `demo.${user.id}`, user: userDto(user), linked_to_existing_tenant: linked }
})

route('POST', /^\/auth\/otp\/request$/, ({ body }) => {
  const phone = String(body.phone ?? '').trim()
  if (normalizePhone(phone).length < 10) {
    throw invalid({ phone: 'Enter a valid 10-digit mobile number' })
  }

  const user = findUserByPhone(phone)
  const base = {
    message: 'If that number is registered, a 6-digit code is on its way.',
    expires_in_minutes: OTP_TTL_MINUTES,
    resend_in_seconds: OTP_RESEND_SECONDS,
    sms_configured: false,
  }
  // Same answer either way, so this cannot reveal who has an account.
  if (!user || !user.is_active) return base

  const existing = otpStore.get(user.id)
  if (existing) {
    const wait = Math.ceil((existing.issued + OTP_RESEND_SECONDS * 1000 - Date.now()) / 1000)
    if (wait > 0) {
      throw new DemoError(`A code was just sent. Try again in ${wait} seconds.`, 429)
    }
  }

  const code = String(Math.floor(Math.random() * 1e6)).padStart(6, '0')
  otpStore.set(user.id, {
    code,
    expires: Date.now() + OTP_TTL_MINUTES * 60_000,
    issued: Date.now(),
    attempts: 0,
  })
  return {
    ...base,
    message: 'No SMS gateway is connected, so your 6-digit code is shown here.',
    demo_code: code,
  }
})

route('POST', /^\/auth\/otp\/verify$/, ({ body }) => {
  const phone = String(body.phone ?? '').trim()
  const code = String(body.code ?? '').trim()
  const errors: Record<string, string> = {}
  if (normalizePhone(phone).length < 10) errors.phone = 'Enter a valid 10-digit mobile number'
  if (!code) errors.code = 'Enter the code you received'
  if (Object.keys(errors).length) throw invalid(errors)

  const user = findUserByPhone(phone)
  const record = user ? otpStore.get(user.id) : null
  if (!user || !record || record.expires < Date.now() || record.attempts >= OTP_MAX_ATTEMPTS) {
    throw invalid({ code: 'That code has expired. Request a new one.' })
  }

  record.attempts += 1
  if (record.code !== code) {
    const left = OTP_MAX_ATTEMPTS - record.attempts
    if (left <= 0) throw invalid({ code: 'Too many incorrect attempts. Request a new code.' })
    throw invalid({ code: `That code is incorrect. ${left} attempt${left === 1 ? '' : 's'} left.` })
  }

  otpStore.delete(user.id)
  user.phone_verified = true
  user.last_login_at = nowIso()
  logActivity(user.id, 'updated', 'account', user.id, `${user.name} signed in with a phone code`)
  setSession({ userId: user.id })
  persist()
  return { access_token: `demo.${user.id}`, user: userDto(user) }
})

route('GET', /^\/auth\/users$/, ({ query }) => {
  requireStaff()
  const role = query.get('role')
  return store.users
    .filter((u) => !role || role === 'all' || u.role === role)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(userDto)
})

route('POST', /^\/auth\/users$/, ({ body }) => {
  const actor = requireUser()
  if (actor.role !== 'admin') throw new DemoError('Administrators only', 403)
  const errors: Record<string, string> = {}
  for (const [f, label] of [['name', 'Name'], ['email', 'Email'], ['password', 'Password'], ['role', 'Role']]) {
    if (!body[f]) errors[f] = `${label} is required`
  }
  if (body.password && body.password.length < 6) errors.password = 'Use at least 6 characters'
  if (Object.keys(errors).length) throw invalid(errors)

  const email = String(body.email).trim().toLowerCase()
  if (store.users.some((u) => u.email.toLowerCase() === email)) {
    throw invalid({ email: 'A user with that email already exists' })
  }
  const user: any = {
    id: nextId(store.users),
    name: String(body.name).trim(),
    email,
    phone: body.phone ?? '',
    password: body.password,
    role: body.role,
    is_active: body.is_active ?? true,
    theme: 'system',
    density: 'comfortable',
    notify_email: true,
    notify_rent: true,
    notify_maintenance: true,
    notify_lease: true,
    last_login_at: null,
    password_changed_at: nowIso(),
    created_at: nowIso(),
  }
  store.users.push(user)
  if (user.role === 'tenant') {
    store.tenants.push({
      id: nextId(store.tenants),
      user_id: user.id,
      full_name: user.name,
      email: user.email,
      phone: user.phone,
      date_of_birth: null, gender: '', id_proof_type: '', id_number: '',
      document_name: null, occupation: '', unit_room: '',
      emergency_name: '', emergency_relationship: '', emergency_phone: '',
      notes: '', created_at: nowIso(),
    } as any)
  }
  logActivity(actor.id, 'created', 'user', user.id, `Account created for ${user.name} (${user.role})`)
  persist()
  return user_created(user)
})

const user_created = (user: any) => userDto(user)

route('PUT', /^\/auth\/users\/(\d+)$/, ({ body }, [id]) => {
  const actor = requireUser()
  if (actor.role !== 'admin') throw new DemoError('Administrators only', 403)
  const user = userById(Number(id))
  if (!user) throw new DemoError('User not found', 404)
  if (body.password && body.password.length < 6) {
    throw invalid({ password: 'Use at least 6 characters' })
  }
  user.name = body.name ?? user.name
  user.phone = body.phone ?? user.phone
  user.role = body.role ?? user.role
  if ('is_active' in body) user.is_active = Boolean(body.is_active)
  if (body.password) user.password = body.password
  logActivity(actor.id, 'updated', 'user', user.id, `Account updated for ${user.name}`)
  persist()
  return userDto(user)
})

route('DELETE', /^\/auth\/users\/(\d+)$/, (_ctx, [id]) => {
  const actor = requireUser()
  if (actor.role !== 'admin') throw new DemoError('Administrators only', 403)
  const target = Number(id)
  if (target === actor.id) throw new DemoError('You cannot delete your own account', 400)
  const user = userById(target)
  if (!user) throw new DemoError('User not found', 404)
  store.users = store.users.filter((u) => u.id !== target)
  store.tenants = store.tenants.filter((t) => t.user_id !== target)
  logActivity(actor.id, 'deleted', 'user', target, `Account deleted for ${user.name}`)
  persist()
  return { message: 'User deleted' }
})

/* ---- dashboard, activity, notifications ---- */

route('GET', /^\/dashboard$/, () => {
  requireStaff()
  const t = todayStr()
  const occupied = store.properties.filter((p) => p.status === 'occupied').length
  const available = store.properties.filter((p) => p.status === 'available').length
  const underMaintenance = store.properties.filter((p) => p.status === 'maintenance').length
  const total = store.properties.length

  const period = t.slice(0, 7)
  const monthRows = store.payments.filter((p) => p.period === period)
  const collected = monthRows.reduce((s, p) => s + num(p.amount_paid), 0)
  const billed = monthRows.reduce((s, p) => s + num(p.amount), 0)

  const unsettled = store.payments.filter((p) => UNSETTLED.includes(paymentStatus(p)))
  const pending = unsettled.filter((p) => p.due_date >= t)
  const overdue = unsettled.filter((p) => p.due_date < t)
  const bal = (p: any) => num(p.amount) - num(p.amount_paid)

  const openTickets = store.maintenance.filter((m) => MAINTENANCE_OPEN.includes(m.status))
  const expiring = store.leases
    .filter((l) => leaseState(l) === 'expiring_soon')
    .sort((a, b) => a.end_date.localeCompare(b.end_date))

  return {
    stats: {
      total_properties: total,
      occupied, available,
      under_maintenance: underMaintenance,
      occupancy_rate: total ? Math.round((occupied / total) * 1000) / 10 : 0,
      total_tenants: store.tenants.length,
      active_leases: store.leases.filter((l) => l.status === 'active').length,
      expiring_soon: expiring.length,
      monthly_revenue: collected,
      billed_this_month: billed,
      pending_rent: pending.reduce((s, p) => s + bal(p), 0),
      overdue_rent: overdue.reduce((s, p) => s + bal(p), 0),
      overdue_count: overdue.length,
      open_maintenance: openTickets.length,
      urgent_maintenance: openTickets.filter((m) => m.priority === 'urgent').length,
      monthly_rent_roll: store.leases
        .filter((l) => l.status === 'active')
        .reduce((s, l) => s + num(l.rent_amount), 0),
    },
    trend: monthlyTrend(6),
    occupancy: [
      { name: 'Occupied', value: occupied },
      { name: 'Available', value: available },
      { name: 'Maintenance', value: underMaintenance },
    ],
    expiring_leases: expiring.slice(0, 5).map((l) => leaseDto(l)),
    recent_maintenance: [...store.maintenance]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map(maintenanceDto),
    recent_payments: store.payments
      .filter((p) => paymentStatus(p) === 'paid')
      .sort((a, b) => String(b.paid_date).localeCompare(String(a.paid_date)))
      .slice(0, 5)
      .map(paymentDto),
  }
})

function monthlyTrend(count: number) {
  const out = []
  const base = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const rows = store.payments.filter((p) => p.period === key)
    out.push({
      period: key,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      billed: rows.reduce((s, p) => s + num(p.amount), 0),
      collected: rows.reduce((s, p) => s + num(p.amount_paid), 0),
    })
  }
  return out
}

route('GET', /^\/activity$/, ({ query }) => {
  requireStaff()
  const limit = Math.min(Number(query.get('limit') ?? 30), 100)
  const entity = query.get('entity')
  return store.activities
    .filter((a) => !entity || entity === 'all' || a.entity_type === entity)
    .slice(0, limit)
    .map((a) => ({ ...a, actor_name: userById(a.actor_id)?.name ?? 'System' }))
})

function visibleNotifications(user: any) {
  return store.notifications.filter(
    (n) => n.user_id === user.id || (user.role !== 'tenant' && n.audience === 'staff'),
  )
}

route('GET', /^\/notifications$/, ({ query }) => {
  const user = requireUser()
  let items = visibleNotifications(user)
  if (query.get('unread') === 'true') items = items.filter((n) => !n.is_read)
  return {
    items: items.slice(0, 50),
    unread: visibleNotifications(user).filter((n) => !n.is_read).length,
  }
})

route('POST', /^\/notifications\/(\d+)\/read$/, (_c, [id]) => {
  const user = requireUser()
  const note = visibleNotifications(user).find((n) => n.id === Number(id))
  if (!note) throw new DemoError('Notification not found', 404)
  note.is_read = true
  persist()
  return note
})

route('POST', /^\/notifications\/read-all$/, () => {
  const user = requireUser()
  let count = 0
  visibleNotifications(user).forEach((n) => {
    if (!n.is_read) {
      n.is_read = true
      count += 1
    }
  })
  persist()
  return { message: `${count} notification(s) marked as read`, count }
})

route('DELETE', /^\/notifications\/(\d+)$/, (_c, [id]) => {
  const user = requireUser()
  const note = visibleNotifications(user).find((n) => n.id === Number(id))
  if (!note) throw new DemoError('Notification not found', 404)
  store.notifications = store.notifications.filter((n) => n.id !== note.id)
  persist()
  return { message: 'Notification dismissed' }
})

/* ---- properties ---- */

route('GET', /^\/properties$/, ({ query }) => {
  requireStaff()
  let rows = [...store.properties]
  const search = (query.get('search') ?? '').trim().toLowerCase()
  if (search) {
    rows = rows.filter((p) =>
      [p.name, p.address, p.city, p.property_code].some((v) =>
        String(v ?? '').toLowerCase().includes(search),
      ),
    )
  }
  const status = query.get('status')
  if (status && status !== 'all') rows = rows.filter((p) => p.status === status)
  const type = query.get('type')
  if (type && type !== 'all') rows = rows.filter((p) => p.property_type === type)
  const furnishing = query.get('furnishing')
  if (furnishing && furnishing !== 'all') rows = rows.filter((p) => p.furnishing === furnishing)

  const sort = query.get('sort') ?? 'recent'
  const sorters: Record<string, (a: any, b: any) => number> = {
    recent: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    name: (a, b) => a.name.localeCompare(b.name),
    rent_high: (a, b) => num(b.rent_amount) - num(a.rent_amount),
    rent_low: (a, b) => num(a.rent_amount) - num(b.rent_amount),
  }
  rows.sort(sorters[sort] ?? sorters.recent)
  return rows.map((p) => propertyDto(p))
})

route('GET', /^\/properties\/summary$/, () => {
  requireStaff()
  const total = store.properties.length
  const occupied = store.properties.filter((p) => p.status === 'occupied').length
  return {
    total,
    available: store.properties.filter((p) => p.status === 'available').length,
    occupied,
    maintenance: store.properties.filter((p) => p.status === 'maintenance').length,
    occupancy_rate: total ? Math.round((occupied / total) * 1000) / 10 : 0,
  }
})

route('GET', /^\/properties\/(\d+)$/, (_c, [id]) => {
  requireStaff()
  const p = propertyById(Number(id))
  if (!p) throw new DemoError('Property not found', 404)
  return propertyDto(p, true)
})

route('GET', /^\/properties\/(\d+)\/maintenance$/, (_c, [id]) => {
  requireStaff()
  return store.maintenance
    .filter((m) => m.property_id === Number(id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(maintenanceDto)
})

const PROPERTY_TEXT = ['name', 'address', 'city', 'state', 'zip_code', 'property_type',
  'unit_label', 'floor', 'furnishing', 'status', 'description', 'property_code']
const PROPERTY_INT = ['bedrooms', 'bathrooms', 'area_sqft']
const PROPERTY_MONEY = ['rent_amount', 'security_deposit', 'maintenance_charge']

function validateProperty(body: any, existing?: any) {
  const errors: Record<string, string> = {}
  if (!(body.name || existing?.name)) errors.name = 'Property name is required'
  if (!(body.address || existing?.address)) errors.address = 'Address is required'
  for (const f of PROPERTY_MONEY) {
    if (f in body) {
      const v = Number(body[f])
      if (Number.isNaN(v)) errors[f] = 'Enter a valid number'
      else if (v < 0) errors[f] = 'Cannot be negative'
    }
  }
  const code = String(body.property_code ?? '').trim()
  if (code && store.properties.some((p) => p.property_code === code && p.id !== existing?.id)) {
    errors.property_code = 'That property ID is already in use'
  }
  return errors
}

function applyProperty(target: any, body: any) {
  for (const f of PROPERTY_TEXT) {
    if (f in body) target[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  for (const f of PROPERTY_INT) if (body[f] !== undefined && body[f] !== '') target[f] = Number(body[f])
  for (const f of PROPERTY_MONEY) if (f in body) target[f] = num(body[f])
}

route('POST', /^\/properties$/, ({ body }) => {
  const actor = requireStaff()
  const errors = validateProperty(body)
  if (Object.keys(errors).length) throw invalid(errors)

  const p: any = {
    id: nextId(store.properties),
    property_code: '',
    bedrooms: 0, bathrooms: 0, area_sqft: 0,
    rent_amount: 0, security_deposit: 0, maintenance_charge: 0,
    status: 'available',
    manager_id: actor.id,
    created_at: nowIso(),
  }
  applyProperty(p, body)
  if (!p.property_code) p.property_code = `PR-${String(p.id).padStart(4, '0')}`
  store.properties.push(p)
  logActivity(actor.id, 'created', 'property', p.id, `Property added: ${p.name}`)
  persist()
  return propertyDto(p)
})

route('PUT', /^\/properties\/(\d+)$/, ({ body }, [id]) => {
  const actor = requireStaff()
  const p = propertyById(Number(id))
  if (!p) throw new DemoError('Property not found', 404)
  const errors = validateProperty(body, p)
  if (Object.keys(errors).length) throw invalid(errors)
  if (body.status === 'available' && activeLeaseForProperty(p.id)) {
    throw invalid({ status: 'This unit has an active lease and cannot be marked available' })
  }
  applyProperty(p, body)
  logActivity(actor.id, 'updated', 'property', p.id, `Property updated: ${p.name}`)
  persist()
  return propertyDto(p)
})

route('DELETE', /^\/properties\/(\d+)$/, (_c, [id]) => {
  const actor = requireStaff()
  const p = propertyById(Number(id))
  if (!p) throw new DemoError('Property not found', 404)
  if (activeLeaseForProperty(p.id)) {
    throw new DemoError('This property has an active lease. End the lease before deleting it.', 400)
  }
  const leaseIds = store.leases.filter((l) => l.property_id === p.id).map((l) => l.id)
  store.payments = store.payments.filter((x) => !leaseIds.includes(x.lease_id))
  store.leases = store.leases.filter((l) => l.property_id !== p.id)
  store.maintenance = store.maintenance.filter((m) => m.property_id !== p.id)
  store.properties = store.properties.filter((x) => x.id !== p.id)
  logActivity(actor.id, 'deleted', 'property', p.id, `Property deleted: ${p.name}`)
  persist()
  return { message: 'Property deleted' }
})

/* ---- tenants ---- */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const TENANT_TEXT = ['full_name', 'phone', 'gender', 'id_proof_type', 'id_number', 'occupation',
  'unit_room', 'emergency_name', 'emergency_relationship', 'emergency_phone', 'notes']

route('GET', /^\/tenants$/, ({ query }) => {
  requireStaff()
  let rows = [...store.tenants].sort((a, b) => a.full_name.localeCompare(b.full_name))
  const search = (query.get('search') ?? '').trim().toLowerCase()
  if (search) {
    rows = rows.filter((t) =>
      [t.full_name, t.email, t.phone].some((v) => String(v ?? '').toLowerCase().includes(search)),
    )
  }
  const status = query.get('lease_status')
  if (status && status !== 'all') {
    rows = rows.filter((t) => {
      const lease = activeLeaseForTenant(t.id)
      if (status === 'unassigned') return !lease
      return lease ? leaseState(lease) === status : false
    })
  }
  return rows.map((t) => tenantDto(t))
})

route('GET', /^\/tenants\/(\d+)$/, (_c, [id]) => {
  requireStaff()
  const t = tenantById(Number(id))
  if (!t) throw new DemoError('Tenant not found', 404)
  return tenantDto(t, true)
})

function validateTenant(body: any, existing?: any) {
  const errors: Record<string, string> = {}
  if (!(body.full_name || existing?.full_name)) errors.full_name = 'Full name is required'
  const email = String(body.email ?? '').trim()
  if (!existing && !email) errors.email = 'Email is required'
  else if (email && !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address'
  const phone = String(body.phone ?? '').trim()
  if (phone && phone.replace(/\D/g, '').length < 7) errors.phone = 'Enter a valid phone number'
  return errors
}

route('POST', /^\/tenants$/, ({ body }) => {
  const actor = requireStaff()
  const errors = validateTenant(body)
  if (Object.keys(errors).length) throw invalid(errors)

  const email = String(body.email).trim().toLowerCase()
  const t: any = {
    id: nextId(store.tenants),
    user_id: null,
    full_name: String(body.full_name).trim(),
    email,
    date_of_birth: body.date_of_birth || null,
    document_name: null,
    created_at: nowIso(),
  }
  for (const f of TENANT_TEXT) if (f in body) t[f] = body[f]

  if (body.create_login) {
    if (store.users.some((u) => u.email.toLowerCase() === email)) {
      throw invalid({ email: 'A user account with that email already exists' })
    }
    const password = body.password || 'tenant123'
    if (password.length < 6) throw invalid({ password: 'Use at least 6 characters' })
    const user: any = {
      id: nextId(store.users),
      name: t.full_name, email, phone: t.phone ?? '', password, role: 'tenant',
      is_active: true, theme: 'system', density: 'comfortable',
      notify_email: true, notify_rent: true, notify_maintenance: true, notify_lease: true,
      last_login_at: null, password_changed_at: nowIso(), created_at: nowIso(),
    }
    store.users.push(user)
    t.user_id = user.id
  }
  store.tenants.push(t)
  logActivity(actor.id, 'created', 'tenant', t.id, `Tenant added: ${t.full_name}`)
  persist()
  return tenantDto(t)
})

route('PUT', /^\/tenants\/(\d+)$/, ({ body }, [id]) => {
  const actor = requireStaff()
  const t = tenantById(Number(id))
  if (!t) throw new DemoError('Tenant not found', 404)
  const errors = validateTenant(body, t)
  if (Object.keys(errors).length) throw invalid(errors)
  for (const f of TENANT_TEXT) if (f in body) (t as any)[f] = body[f]
  if ('date_of_birth' in body) t.date_of_birth = body.date_of_birth || null
  const user = userById(t.user_id)
  if (user) {
    user.name = t.full_name
    user.phone = t.phone
  }
  logActivity(actor.id, 'updated', 'tenant', t.id, `Tenant updated: ${t.full_name}`)
  persist()
  return tenantDto(t)
})

route('DELETE', /^\/tenants\/(\d+)$/, (_c, [id]) => {
  const actor = requireStaff()
  const t = tenantById(Number(id))
  if (!t) throw new DemoError('Tenant not found', 404)
  if (activeLeaseForTenant(t.id)) {
    throw new DemoError('This tenant has an active lease. End the lease before deleting them.', 400)
  }
  const leaseIds = store.leases.filter((l) => l.tenant_id === t.id).map((l) => l.id)
  store.payments = store.payments.filter((p) => !leaseIds.includes(p.lease_id))
  store.leases = store.leases.filter((l) => l.tenant_id !== t.id)
  store.tenants = store.tenants.filter((x) => x.id !== t.id)
  if (t.user_id) store.users = store.users.filter((u) => u.id !== t.user_id)
  logActivity(actor.id, 'deleted', 'tenant', t.id, `Tenant deleted: ${t.full_name}`)
  persist()
  return { message: 'Tenant deleted' }
})

route('POST', /^\/tenants\/(\d+)\/login$/, ({ body }, [id]) => {
  const actor = requireStaff()
  const t = tenantById(Number(id))
  if (!t) throw new DemoError('Tenant not found', 404)
  if (t.user_id) throw new DemoError('This tenant already has a login', 400)
  const password = body.password || 'tenant123'
  if (password.length < 6) throw invalid({ password: 'Use at least 6 characters' })
  if (store.users.some((u) => u.email.toLowerCase() === t.email.toLowerCase())) {
    throw invalid({ email: 'A user account with that email already exists' })
  }
  const user: any = {
    id: nextId(store.users),
    name: t.full_name, email: t.email, phone: t.phone, password, role: 'tenant',
    is_active: true, theme: 'system', density: 'comfortable',
    notify_email: true, notify_rent: true, notify_maintenance: true, notify_lease: true,
    last_login_at: null, password_changed_at: nowIso(), created_at: nowIso(),
  }
  store.users.push(user)
  t.user_id = user.id
  logActivity(actor.id, 'created', 'user', user.id, `Portal login created for ${t.full_name}`)
  persist()
  return tenantDto(t)
})

route('POST', /^\/tenants\/(\d+)\/assign$/, ({ body }, [id]) => {
  const actor = requireStaff()
  const t = tenantById(Number(id))
  if (!t) throw new DemoError('Tenant not found', 404)

  const errors: Record<string, string> = {}
  if (!body.property_id) errors.property_id = 'Choose a property'
  if (!body.start_date) errors.start_date = 'Lease start date is required'
  if (!body.end_date) errors.end_date = 'Lease end date is required'
  if (Object.keys(errors).length) throw invalid(errors)
  if (activeLeaseForTenant(t.id)) {
    throw new DemoError(`${t.full_name} already has an active lease`, 409)
  }
  const property = propertyById(Number(body.property_id))
  if (!property) throw new DemoError('Property not found', 404)
  if (activeLeaseForProperty(property.id)) {
    throw invalid({ property_id: `${property.name} is already occupied` })
  }
  if (body.end_date <= body.start_date) {
    throw invalid({ end_date: 'End date must be after the start date' })
  }

  const lease: any = {
    id: nextId(store.leases),
    lease_code: '',
    property_id: property.id,
    tenant_id: t.id,
    start_date: body.start_date,
    end_date: body.end_date,
    rent_amount: num(body.rent_amount) || num(property.rent_amount),
    deposit_amount: num(body.deposit_amount) || num(property.security_deposit),
    rent_due_day: Number(body.rent_due_day || 5),
    status: 'active',
    terms: body.terms ?? '',
    created_at: nowIso(),
  }
  lease.lease_code = `LS-${String(lease.id).padStart(4, '0')}`
  store.leases.push(lease)
  property.status = 'occupied'
  if (body.unit_room) t.unit_room = body.unit_room
  if (body.generate_schedule !== false) generateSchedule(lease)

  logActivity(actor.id, 'created', 'lease', lease.id, `${t.full_name} assigned to ${property.name}`)
  if (t.user_id) {
    notify('Your lease is active', `Your lease for ${property.name} is now active.`, 'lease',
      '/portal/lease', { user_id: t.user_id })
  }
  persist()
  return leaseDto(lease, true)
})

route('POST', /^\/tenants\/(\d+)\/document$/, (_c, [id]) => {
  requireStaff()
  const t = tenantById(Number(id))
  if (!t) throw new DemoError('Tenant not found', 404)
  t.document_name = 'demo|uploaded-document.pdf'
  persist()
  return tenantDto(t)
})

/* ---- leases ---- */

route('GET', /^\/leases$/, ({ query }) => {
  requireStaff()
  let rows = [...store.leases].sort((a, b) => b.start_date.localeCompare(a.start_date))
  if (query.get('property_id')) rows = rows.filter((l) => l.property_id === Number(query.get('property_id')))
  if (query.get('tenant_id')) rows = rows.filter((l) => l.tenant_id === Number(query.get('tenant_id')))
  const status = query.get('status')
  if (status && status !== 'all') rows = rows.filter((l) => leaseState(l) === status)
  return rows.map((l) => leaseDto(l))
})

route('GET', /^\/leases\/summary$/, () => {
  requireStaff()
  const active = store.leases.filter((l) => leaseState(l) === 'active')
  const expiring = store.leases
    .filter((l) => leaseState(l) === 'expiring_soon')
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
  return {
    total: store.leases.length,
    active: active.length,
    expiring_soon: expiring.length,
    expired: store.leases.filter((l) => leaseState(l) === 'expired').length,
    terminated: store.leases.filter((l) => l.status === 'terminated').length,
    expiring_window_days: EXPIRING_WINDOW_DAYS,
    monthly_rent_roll: store.leases.filter((l) => l.status === 'active').reduce((s, l) => s + num(l.rent_amount), 0),
    deposits_held: store.leases.filter((l) => l.status === 'active').reduce((s, l) => s + num(l.deposit_amount), 0),
    expiring_leases: expiring.map((l) => leaseDto(l)),
  }
})

route('GET', /^\/leases\/(\d+)$/, (_c, [id]) => {
  requireStaff()
  const l = leaseById(Number(id))
  if (!l) throw new DemoError('Lease not found', 404)
  return leaseDto(l, true)
})

function validateLease(body: any, existing?: any) {
  const errors: Record<string, string> = {}
  if (!existing) {
    if (!body.property_id) errors.property_id = 'Choose a property'
    if (!body.tenant_id) errors.tenant_id = 'Choose a tenant'
    if (!body.start_date) errors.start_date = 'Start date is required'
    if (!body.end_date) errors.end_date = 'End date is required'
  }
  const start = body.start_date || existing?.start_date
  const end = body.end_date || existing?.end_date
  if (start && end && end <= start) errors.end_date = 'End date must be after the start date'
  if (body.rent_due_day !== undefined && body.rent_due_day !== '') {
    const d = Number(body.rent_due_day)
    if (!(d >= 1 && d <= 28)) errors.rent_due_day = 'Pick a day between 1 and 28'
  }
  for (const f of ['rent_amount', 'deposit_amount']) {
    if (f in body && Number(body[f]) < 0) errors[f] = 'Cannot be negative'
  }
  return errors
}

route('POST', /^\/leases$/, ({ body }) => {
  const actor = requireStaff()
  const errors = validateLease(body)
  if (Object.keys(errors).length) throw invalid(errors)

  const property = propertyById(Number(body.property_id))
  const tenant = tenantById(Number(body.tenant_id))
  if (!property || !tenant) throw new DemoError('Property or tenant not found', 404)
  if (activeLeaseForProperty(property.id)) {
    throw invalid({ property_id: `${property.name} already has an active lease` })
  }
  if (activeLeaseForTenant(tenant.id)) {
    throw invalid({ tenant_id: `${tenant.full_name} already has an active lease` })
  }

  const lease: any = {
    id: nextId(store.leases),
    lease_code: '',
    property_id: property.id,
    tenant_id: tenant.id,
    start_date: body.start_date,
    end_date: body.end_date,
    rent_amount: num(body.rent_amount) || num(property.rent_amount),
    deposit_amount: num(body.deposit_amount),
    rent_due_day: Number(body.rent_due_day || 5),
    status: body.status ?? 'active',
    terms: body.terms ?? '',
    created_at: nowIso(),
  }
  lease.lease_code = `LS-${String(lease.id).padStart(4, '0')}`
  store.leases.push(lease)
  if (lease.status === 'active') property.status = 'occupied'
  if (body.generate_schedule !== false) generateSchedule(lease)

  logActivity(actor.id, 'created', 'lease', lease.id,
    `Lease created: ${tenant.full_name} at ${property.name}`)
  if (tenant.user_id) {
    notify('Your lease is active', `Your lease for ${property.name} is now active.`, 'lease',
      '/portal/lease', { user_id: tenant.user_id })
  }
  persist()
  return leaseDto(lease, true)
})

route('PUT', /^\/leases\/(\d+)$/, ({ body }, [id]) => {
  const actor = requireStaff()
  const lease = leaseById(Number(id))
  if (!lease) throw new DemoError('Lease not found', 404)
  const errors = validateLease(body, lease)
  if (Object.keys(errors).length) throw invalid(errors)

  if (body.start_date) lease.start_date = body.start_date
  if (body.end_date) lease.end_date = body.end_date
  if ('rent_amount' in body) lease.rent_amount = num(body.rent_amount)
  if ('deposit_amount' in body) lease.deposit_amount = num(body.deposit_amount)
  if (body.rent_due_day) lease.rent_due_day = Number(body.rent_due_day)
  if ('terms' in body) lease.terms = body.terms
  if ('status' in body) {
    lease.status = body.status
    const property = propertyById(lease.property_id)
    if (property) property.status = lease.status === 'active' ? 'occupied' : 'available'
  }
  logActivity(actor.id, 'updated', 'lease', lease.id, `Lease updated: ${lease.lease_code}`)
  persist()
  return leaseDto(lease)
})

route('POST', /^\/leases\/(\d+)\/renew$/, ({ body }, [id]) => {
  const actor = requireStaff()
  const lease = leaseById(Number(id))
  if (!lease) throw new DemoError('Lease not found', 404)
  const months = Number(body.months || 12)
  if (!(months >= 1 && months <= 60)) throw invalid({ months: 'Choose between 1 and 60 months' })

  const end = new Date(lease.end_date)
  end.setDate(end.getDate() + months * 30)
  lease.end_date = ymd(end)
  lease.status = 'active'
  const property = propertyById(lease.property_id)
  if (property) property.status = 'occupied'
  if (body.rent_amount !== undefined && body.rent_amount !== '') {
    lease.rent_amount = num(body.rent_amount)
  }
  const created = generateSchedule(lease)
  logActivity(actor.id, 'updated', 'lease', lease.id,
    `Lease renewed by ${months} months: ${lease.lease_code}`)
  persist()
  return { lease: leaseDto(lease), invoices_created: created }
})

route('POST', /^\/leases\/(\d+)\/schedule$/, (_c, [id]) => {
  requireStaff()
  const lease = leaseById(Number(id))
  if (!lease) throw new DemoError('Lease not found', 404)
  const count = generateSchedule(lease)
  persist()
  return { message: `${count} invoice(s) generated`, count }
})

route('DELETE', /^\/leases\/(\d+)$/, (_c, [id]) => {
  const actor = requireStaff()
  const lease = leaseById(Number(id))
  if (!lease) throw new DemoError('Lease not found', 404)
  store.payments = store.payments.filter((p) => p.lease_id !== lease.id)
  store.leases = store.leases.filter((l) => l.id !== lease.id)
  const property = propertyById(lease.property_id)
  if (property && !activeLeaseForProperty(property.id)) property.status = 'available'
  logActivity(actor.id, 'deleted', 'lease', lease.id, `Lease deleted: ${lease.lease_code}`)
  persist()
  return { message: 'Lease deleted' }
})

/* ---- payments ---- */

const METHODS = ['upi', 'bank_transfer', 'cash', 'cheque', 'online']

function filterPayments(query: URLSearchParams) {
  let rows = [...store.payments]
  const status = query.get('status')
  if (status === 'unsettled') rows = rows.filter((p) => UNSETTLED.includes(paymentStatus(p)))
  else if (status && status !== 'all') rows = rows.filter((p) => paymentStatus(p) === status)

  const byLease = (fn: (l: any) => boolean) =>
    rows.filter((p) => {
      const l = leaseById(p.lease_id)
      return l ? fn(l) : false
    })

  if (query.get('lease_id')) rows = rows.filter((p) => p.lease_id === Number(query.get('lease_id')))
  if (query.get('tenant_id')) rows = byLease((l) => l.tenant_id === Number(query.get('tenant_id')))
  if (query.get('property_id')) rows = byLease((l) => l.property_id === Number(query.get('property_id')))
  if (query.get('period')) rows = rows.filter((p) => p.period === query.get('period'))
  const method = query.get('method')
  if (method && method !== 'all') rows = rows.filter((p) => p.method === method)
  if (query.get('start_date')) rows = rows.filter((p) => p.due_date >= query.get('start_date')!)
  if (query.get('end_date')) rows = rows.filter((p) => p.due_date <= query.get('end_date')!)

  const search = (query.get('search') ?? '').trim().toLowerCase()
  if (search) {
    rows = rows.filter((p) => {
      const d = paymentDto(p)
      return [d.tenant_name, d.property_name, d.reference, d.payment_code].some((v) =>
        String(v ?? '').toLowerCase().includes(search),
      )
    })
  }
  return rows
}

route('GET', /^\/payments$/, ({ query }) => {
  requireStaff()
  return filterPayments(query)
    .sort((a, b) => b.due_date.localeCompare(a.due_date))
    .map(paymentDto)
})

route('GET', /^\/payments\/dashboard$/, () => {
  requireStaff()
  const t = todayStr()
  const period = t.slice(0, 7)
  const monthRows = store.payments.filter((p) => p.period === period)
  const toDate = store.payments.filter((p) => p.due_date <= t)
  const billedAll = toDate.reduce((s, p) => s + num(p.amount), 0)
  const collectedAll = toDate.reduce((s, p) => s + num(p.amount_paid), 0)

  const bal = (p: any) => num(p.amount) - num(p.amount_paid)
  const pending = store.payments.filter(
    (p) => ['pending', 'partial'].includes(paymentStatus(p)) && p.due_date >= t,
  )
  const overdue = store.payments
    .filter((p) => UNSETTLED.includes(paymentStatus(p)) && p.due_date < t)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  const byMethod = new Map<string, { amount: number; count: number }>()
  store.payments.filter((p) => num(p.amount_paid) > 0).forEach((p) => {
    const key = p.method || 'unrecorded'
    const row = byMethod.get(key) ?? { amount: 0, count: 0 }
    row.amount += num(p.amount_paid)
    row.count += 1
    byMethod.set(key, row)
  })

  const statusCounts: Record<string, number> = {}
  store.payments.forEach((p) => {
    const s = paymentStatus(p)
    statusCounts[s] = (statusCounts[s] ?? 0) + 1
  })

  return {
    stats: {
      billed_this_month: monthRows.reduce((s, p) => s + num(p.amount), 0),
      collected_this_month: monthRows.reduce((s, p) => s + num(p.amount_paid), 0),
      invoices_this_month: monthRows.length,
      collection_rate: billedAll ? Math.round((collectedAll / billedAll) * 1000) / 10 : 0,
      pending_amount: pending.reduce((s, p) => s + bal(p), 0),
      pending_count: pending.length,
      overdue_amount: overdue.reduce((s, p) => s + bal(p), 0),
      overdue_count: overdue.length,
      paid_count: statusCounts.paid ?? 0,
      partial_count: statusCounts.partial ?? 0,
    },
    trend: monthlyTrend(6),
    by_method: [...byMethod.entries()]
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.amount - a.amount),
    status_counts: statusCounts,
    overdue: overdue.slice(0, 8).map(paymentDto),
    upcoming: [...pending].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 8).map(paymentDto),
  }
})

route('GET', /^\/payments\/(\d+)$/, (_c, [id]) => {
  requireStaff()
  const p = store.payments.find((x) => x.id === Number(id))
  if (!p) throw new DemoError('Payment not found', 404)
  const lease = leaseById(p.lease_id)
  return {
    ...paymentDto(p),
    lease: lease ? leaseDto(lease) : null,
    lease_history: store.payments
      .filter((x) => x.lease_id === p.lease_id)
      .sort((a, b) => b.due_date.localeCompare(a.due_date))
      .slice(0, 12)
      .map(paymentDto),
  }
})

route('POST', /^\/payments$/, ({ body }) => {
  const actor = requireStaff()
  const errors: Record<string, string> = {}
  if (!body.lease_id) errors.lease_id = 'Choose a lease'
  if (!body.due_date) errors.due_date = 'Due date is required'
  if (!(num(body.amount) > 0)) errors.amount = 'Enter an amount greater than zero'
  if (Object.keys(errors).length) throw invalid(errors)

  const id = nextId(store.payments)
  const p: any = {
    id,
    payment_code: `PY-${String(id).padStart(5, '0')}`,
    lease_id: Number(body.lease_id),
    amount: num(body.amount),
    amount_paid: num(body.amount_paid),
    due_date: body.due_date,
    paid_date: body.paid_date ?? null,
    period: body.period || String(body.due_date).slice(0, 7),
    method: body.method ?? null,
    reference: body.reference ?? null,
    notes: body.notes ?? '',
    created_at: nowIso(),
  }
  store.payments.push(p)
  logActivity(actor.id, 'created', 'payment', p.id, `Invoice raised: ${p.payment_code}`)
  persist()
  return paymentDto(p)
})

route('PUT', /^\/payments\/(\d+)$/, ({ body }, [id]) => {
  const actor = requireStaff()
  const p = store.payments.find((x) => x.id === Number(id))
  if (!p) throw new DemoError('Payment not found', 404)
  if ('amount' in body) p.amount = num(body.amount)
  if ('amount_paid' in body) p.amount_paid = num(body.amount_paid)
  if (body.due_date) p.due_date = body.due_date
  if ('paid_date' in body) p.paid_date = body.paid_date || null
  for (const f of ['method', 'reference', 'notes', 'period']) if (f in body) p[f] = body[f]
  logActivity(actor.id, 'updated', 'payment', p.id, `Invoice updated: ${p.payment_code}`)
  persist()
  return paymentDto(p)
})

route('POST', /^\/payments\/(\d+)\/record$/, ({ body }, [id]) => {
  const actor = requireStaff()
  const p = store.payments.find((x) => x.id === Number(id))
  if (!p) throw new DemoError('Payment not found', 404)

  const errors: Record<string, string> = {}
  const amount = body.amount === undefined || body.amount === '' ? num(p.amount) : Number(body.amount)
  if (Number.isNaN(amount)) errors.amount = 'Enter a valid number'
  else if (amount <= 0) errors.amount = 'Enter an amount greater than zero'
  else if (amount > num(p.amount) - num(p.amount_paid) + 0.01) {
    errors.amount = 'That is more than the outstanding balance'
  }
  if (body.method && !METHODS.includes(body.method)) errors.method = 'Choose a valid payment method'
  if (Object.keys(errors).length) throw invalid(errors)

  p.amount_paid = num(p.amount_paid) + amount
  p.paid_date = body.paid_date || todayStr()
  p.method = body.method ?? p.method
  p.reference = body.reference ?? p.reference
  if (body.notes) p.notes = body.notes

  const lease = leaseById(p.lease_id)
  const tenant = lease ? tenantById(lease.tenant_id) : null
  logActivity(actor.id, 'paid', 'payment', p.id, `Payment recorded from ${tenant?.full_name ?? 'tenant'}`)
  if (tenant?.user_id) {
    notify('Payment received', `We received ₹${amount.toLocaleString('en-IN')} for ${p.period}. Thank you.`,
      'rent', '/portal/payments', { user_id: tenant.user_id })
  }
  persist()
  return paymentDto(p)
})

route('DELETE', /^\/payments\/(\d+)$/, (_c, [id]) => {
  const actor = requireStaff()
  const p = store.payments.find((x) => x.id === Number(id))
  if (!p) throw new DemoError('Payment not found', 404)
  store.payments = store.payments.filter((x) => x.id !== p.id)
  logActivity(actor.id, 'deleted', 'payment', p.id, `Invoice deleted: ${p.payment_code}`)
  persist()
  return { message: 'Payment deleted' }
})

/* ---- maintenance ---- */

const CATEGORIES = ['plumbing', 'electrical', 'cleaning', 'hvac', 'security', 'other']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']

route('GET', /^\/maintenance$/, ({ query }) => {
  const user = requireUser()
  let rows = [...store.maintenance]

  if (user.role === 'tenant') {
    const profile = tenantProfileFor(user.id)
    rows = profile ? rows.filter((m) => m.tenant_id === profile.id) : []
  } else {
    if (query.get('property_id')) rows = rows.filter((m) => m.property_id === Number(query.get('property_id')))
    if (query.get('tenant_id')) rows = rows.filter((m) => m.tenant_id === Number(query.get('tenant_id')))
    if (query.get('assigned_to')) rows = rows.filter((m) => m.assigned_to === Number(query.get('assigned_to')))
  }

  const status = query.get('status')
  if (status === 'open') rows = rows.filter((m) => MAINTENANCE_OPEN.includes(m.status))
  else if (status === 'history') rows = rows.filter((m) => CLOSED_STATUSES.includes(m.status))
  else if (status && status !== 'all') rows = rows.filter((m) => m.status === status)

  for (const f of ['priority', 'category'] as const) {
    const v = query.get(f)
    if (v && v !== 'all') rows = rows.filter((m) => (m as any)[f] === v)
  }
  const search = (query.get('search') ?? '').trim().toLowerCase()
  if (search) {
    rows = rows.filter((m) =>
      [m.title, m.description, m.ticket_code].some((v) =>
        String(v ?? '').toLowerCase().includes(search),
      ),
    )
  }
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(maintenanceDto)
})

route('GET', /^\/maintenance\/dashboard$/, () => {
  requireStaff()
  const all = store.maintenance.map(maintenanceDto)
  const open = all.filter((m) => MAINTENANCE_OPEN.includes(m.status))
  const closed = all.filter((m) => CLOSED_STATUSES.includes(m.status))

  const byStatus: Record<string, number> = {}
  MAINTENANCE_FLOW.forEach((s) => (byStatus[s] = 0))
  all.forEach((m) => (byStatus[m.status] = (byStatus[m.status] ?? 0) + 1))

  const count = <T extends string>(key: T) => {
    const map = new Map<string, number>()
    all.forEach((m: any) => map.set(m[key], (map.get(m[key]) ?? 0) + 1))
    return [...map.entries()].map(([k, v]) => ({ [key]: k, count: v })) as any[]
  }

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 19)
  const avg = closed.length
    ? Math.round((closed.reduce((s, m) => s + (m.age_days ?? 0), 0) / closed.length) * 10) / 10
    : 0

  return {
    stats: {
      total: all.length,
      open: open.length,
      urgent_open: open.filter((m) => m.priority === 'urgent').length,
      unassigned: open.filter((m) => !m.assigned_to).length,
      completed: byStatus.completed ?? 0,
      closed: byStatus.closed ?? 0,
      avg_resolution_days: avg,
      raised_this_week: all.filter((m) => m.created_at >= weekAgo).length,
      closed_this_week: closed.filter((m) => (m.completed_at || m.closed_at || '') >= weekAgo).length,
      total_cost: all.reduce((s, m) => s + num(m.cost), 0),
    },
    by_status: MAINTENANCE_FLOW.map((s) => ({ status: s, count: byStatus[s] ?? 0 })),
    by_category: count('category'),
    by_priority: count('priority'),
    ageing: open.filter((m) => (m.age_days ?? 0) >= 7).sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0)).slice(0, 8),
    recent: [...all].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8),
  }
})

route('GET', /^\/maintenance\/(\d+)$/, (_c, [id]) => {
  const user = requireUser()
  const m = store.maintenance.find((x) => x.id === Number(id))
  if (!m) throw new DemoError('Request not found', 404)
  if (user.role === 'tenant') {
    const profile = tenantProfileFor(user.id)
    if (!profile || m.tenant_id !== profile.id) throw new DemoError('Request not found', 404)
  }
  return maintenanceDto(m)
})

route('POST', /^\/maintenance$/, ({ body }) => {
  const user = requireUser()
  const errors: Record<string, string> = {}
  if (!String(body.title ?? '').trim()) errors.title = 'Describe the problem in a few words'
  if (body.category && !CATEGORIES.includes(body.category)) errors.category = 'Choose a valid category'
  if (body.priority && !PRIORITIES.includes(body.priority)) errors.priority = 'Choose a valid priority'

  let propertyId: number
  let tenantId: number | null

  if (user.role !== 'tenant') {
    if (!body.property_id) errors.property_id = 'Choose a property'
    if (Object.keys(errors).length) throw invalid(errors)
    propertyId = Number(body.property_id)
    tenantId = body.tenant_id ? Number(body.tenant_id) : null
  } else {
    const profile = tenantProfileFor(user.id)
    const lease = profile ? activeLeaseForTenant(profile.id) : null
    if (!lease) {
      throw new DemoError('You do not have an active lease to raise a request against', 400)
    }
    if (Object.keys(errors).length) throw invalid(errors)
    propertyId = lease.property_id
    tenantId = profile!.id
  }

  const m: any = {
    id: nextId(store.maintenance),
    ticket_code: '',
    property_id: propertyId,
    tenant_id: tenantId,
    title: String(body.title).trim(),
    description: body.description ?? '',
    category: body.category ?? 'other',
    priority: body.priority ?? 'medium',
    status: 'open',
    assigned_to: null,
    technician_name: null,
    technician_phone: null,
    scheduled_date: null,
    cost: 0,
    resolution_notes: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    assigned_at: null,
    completed_at: null,
    closed_at: null,
  }
  m.ticket_code = `MR-${String(m.id).padStart(4, '0')}`
  store.maintenance.push(m)
  logActivity(user.id, 'created', 'maintenance', m.id, `Request raised: ${m.title}`)
  notify('New maintenance request', `${m.ticket_code} — ${m.title} (${m.priority})`,
    'maintenance', '/maintenance', { audience: 'staff' })
  persist()
  return maintenanceDto(m)
})

route('PUT', /^\/maintenance\/(\d+)$/, ({ body }, [id]) => {
  const actor = requireStaff()
  const m = store.maintenance.find((x) => x.id === Number(id))
  if (!m) throw new DemoError('Request not found', 404)

  const errors: Record<string, string> = {}
  if (body.status && !MAINTENANCE_FLOW.includes(body.status)) errors.status = 'Choose a valid status'
  if (body.priority && !PRIORITIES.includes(body.priority)) errors.priority = 'Choose a valid priority'
  if (CLOSED_STATUSES.includes(body.status) && !(body.resolution_notes || m.resolution_notes)) {
    errors.resolution_notes = 'Add a note describing what was done'
  }
  if (Object.keys(errors).length) throw invalid(errors)

  for (const f of ['title', 'description', 'category', 'priority', 'resolution_notes',
    'technician_name', 'technician_phone']) {
    if (f in body) (m as any)[f] = body[f]
  }
  if ('cost' in body) m.cost = num(body.cost)
  if ('scheduled_date' in body) m.scheduled_date = body.scheduled_date || null
  if ('assigned_to' in body) {
    m.assigned_to = body.assigned_to ? Number(body.assigned_to) : null
    if (m.assigned_to) {
      m.assigned_at = m.assigned_at ?? nowIso()
      if (m.status === 'open') m.status = 'assigned'
    }
  }

  const previous = m.status
  if (body.status) {
    m.status = body.status
    if (m.status === 'assigned' && !m.assigned_at) m.assigned_at = nowIso()
    if (m.status === 'completed') m.completed_at = nowIso()
    m.closed_at = m.status === 'closed' ? nowIso() : null
    if (MAINTENANCE_OPEN.includes(m.status)) m.completed_at = null
  }
  m.updated_at = nowIso()

  logActivity(actor.id, 'updated', 'maintenance', m.id, `${m.ticket_code} moved to ${m.status.replace('_', ' ')}`)
  const tenant = m.tenant_id ? tenantById(m.tenant_id) : null
  if (m.status !== previous && tenant?.user_id) {
    notify('Maintenance update', `${m.ticket_code} — ${m.title} is now ${m.status.replace('_', ' ')}.`,
      'maintenance', '/portal/maintenance', { user_id: tenant.user_id })
  }
  persist()
  return maintenanceDto(m)
})

route('POST', /^\/maintenance\/(\d+)\/assign$/, ({ body }, [id]) => {
  const actor = requireStaff()
  const m = store.maintenance.find((x) => x.id === Number(id))
  if (!m) throw new DemoError('Request not found', 404)
  if (!body.assigned_to && !body.technician_name) {
    throw invalid({ assigned_to: 'Choose a staff member or name a technician' })
  }
  if (body.assigned_to) m.assigned_to = Number(body.assigned_to)
  if ('technician_name' in body) m.technician_name = body.technician_name
  if ('technician_phone' in body) m.technician_phone = body.technician_phone
  if (body.scheduled_date) m.scheduled_date = body.scheduled_date
  m.assigned_at = nowIso()
  if (m.status === 'open') m.status = 'assigned'
  m.updated_at = nowIso()

  logActivity(actor.id, 'updated', 'maintenance', m.id, `${m.ticket_code} assigned`)
  const tenant = m.tenant_id ? tenantById(m.tenant_id) : null
  if (tenant?.user_id) {
    notify('Your request has been assigned', `${m.ticket_code} — ${m.title} is being handled.`,
      'maintenance', '/portal/maintenance', { user_id: tenant.user_id })
  }
  persist()
  return maintenanceDto(m)
})

route('DELETE', /^\/maintenance\/(\d+)$/, (_c, [id]) => {
  const actor = requireStaff()
  const m = store.maintenance.find((x) => x.id === Number(id))
  if (!m) throw new DemoError('Request not found', 404)
  store.maintenance = store.maintenance.filter((x) => x.id !== m.id)
  logActivity(actor.id, 'deleted', 'maintenance', m.id, `Request deleted: ${m.ticket_code}`)
  persist()
  return { message: 'Request deleted' }
})

/* ---- reports ---- */

const REPORT_TYPES = [
  { value: 'rent', label: 'Rent Collection Report', description: 'Monthly rent billed, collected and outstanding' },
  { value: 'payments', label: 'Payment Report', description: 'Every transaction with method and status' },
  { value: 'properties', label: 'Property Report', description: 'Occupancy and availability across the portfolio' },
  { value: 'tenants', label: 'Tenant Report', description: 'Tenant directory with lease status' },
  { value: 'leases', label: 'Lease Report', description: 'Agreements, terms and rent roll' },
  { value: 'maintenance', label: 'Maintenance Report', description: 'Request volume, ageing and cost' },
]
const MONEY_COLUMNS = ['Rent', 'Billed', 'Paid', 'Balance', 'Deposit', 'Cost', 'Amount', 'Rent roll']

route('GET', /^\/reports\/types$/, () => {
  requireStaff()
  return REPORT_TYPES
})

route('GET', /^\/reports\/dashboard$/, () => {
  requireStaff()
  const t = todayStr()
  const toDate = store.payments.filter((p) => p.due_date <= t)
  const billed = toDate.reduce((s, p) => s + num(p.amount), 0)
  const collected = toDate.reduce((s, p) => s + num(p.amount_paid), 0)
  const occupied = store.properties.filter((p) => p.status === 'occupied').length
  return {
    reports: REPORT_TYPES,
    headline: {
      properties: store.properties.length,
      occupancy_rate: store.properties.length
        ? Math.round((occupied / store.properties.length) * 1000) / 10
        : 0,
      tenants: store.tenants.length,
      active_leases: store.leases.filter((l) => l.status === 'active').length,
      billed_to_date: billed,
      collected_to_date: collected,
      outstanding: billed - collected,
      collection_rate: billed ? Math.round((collected / billed) * 1000) / 10 : 0,
      maintenance_total: store.maintenance.length,
      maintenance_open: store.maintenance.filter((m) => MAINTENANCE_OPEN.includes(m.status)).length,
      maintenance_cost: store.maintenance.reduce((s, m) => s + num(m.cost), 0),
    },
  }
})

route('GET', /^\/reports$/, ({ query }) => {
  requireStaff()
  const report = query.get('report') ?? 'rent'
  const start = query.get('start_date')
  const end = query.get('end_date')
  const propertyId = query.get('property_id') ? Number(query.get('property_id')) : null
  const tenantId = query.get('tenant_id') ? Number(query.get('tenant_id')) : null
  const status = query.get('status')

  const paymentRows = () => {
    let rows = store.payments.filter((p) => {
      const lease = leaseById(p.lease_id)
      if (!lease) return false
      if (start && p.due_date < start) return false
      if (end && p.due_date > end) return false
      if (status && status !== 'all' && paymentStatus(p) !== status) return false
      if (propertyId && lease.property_id !== propertyId) return false
      if (tenantId && lease.tenant_id !== tenantId) return false
      return true
    })
    return rows.sort((a, b) => a.due_date.localeCompare(b.due_date))
  }

  let columns: string[] = []
  let rows: (string | number)[][] = []
  let totals: Record<string, number | string> = {}

  if (report === 'properties') {
    let items = [...store.properties].sort((a, b) => a.name.localeCompare(b.name))
    if (status && status !== 'all') items = items.filter((p) => p.status === status)
    if (propertyId) items = items.filter((p) => p.id === propertyId)
    columns = ['Property ID', 'Name', 'Address', 'Type', 'Furnishing', 'Rent', 'Status', 'Current tenant']
    rows = items.map((p) => [
      p.property_code, p.name, [p.address, p.city].filter(Boolean).join(', '),
      p.property_type, p.furnishing ?? '-', num(p.rent_amount), p.status,
      propertyDto(p).current_tenant ?? '-',
    ])
    const occ = items.filter((p) => p.status === 'occupied').length
    totals = {
      Properties: items.length,
      Occupied: occ,
      Available: items.filter((p) => p.status === 'available').length,
      'Occupancy %': items.length ? Math.round((occ / items.length) * 1000) / 10 : 0,
      'Rent roll': items.filter((p) => p.status === 'occupied').reduce((s, p) => s + num(p.rent_amount), 0),
    }
  } else if (report === 'tenants') {
    let items = [...store.tenants].sort((a, b) => a.full_name.localeCompare(b.full_name))
    if (tenantId) items = items.filter((t) => t.id === tenantId)
    columns = ['Name', 'Email', 'Phone', 'ID proof', 'Property', 'Unit', 'Lease status']
    rows = items.map((t) => {
      const d = tenantDto(t)
      return [t.full_name, t.email, t.phone || '-', t.id_proof_type || '-',
        d.current_property ?? '-', t.unit_room || '-', d.lease_status]
    })
    totals = {
      Tenants: items.length,
      'With active lease': items.filter((t) => activeLeaseForTenant(t.id)).length,
      Unassigned: items.filter((t) => !activeLeaseForTenant(t.id)).length,
      'With portal login': items.filter((t) => t.user_id).length,
    }
  } else if (report === 'leases') {
    let items = [...store.leases].sort((a, b) => b.start_date.localeCompare(a.start_date))
    if (propertyId) items = items.filter((l) => l.property_id === propertyId)
    if (tenantId) items = items.filter((l) => l.tenant_id === tenantId)
    if (start) items = items.filter((l) => l.end_date >= start)
    if (end) items = items.filter((l) => l.start_date <= end)
    columns = ['Lease ID', 'Property', 'Tenant', 'Start', 'End', 'Rent', 'Deposit', 'Status']
    rows = items.map((l) => {
      const d = leaseDto(l)
      return [l.lease_code, d.property_name ?? '-', d.tenant_name ?? '-', l.start_date,
        l.end_date, num(l.rent_amount), num(l.deposit_amount), d.lease_state]
    })
    totals = {
      Leases: items.length,
      Active: items.filter((l) => l.status === 'active').length,
      'Expiring soon': items.filter((l) => leaseState(l) === 'expiring_soon').length,
      'Rent roll': items.filter((l) => l.status === 'active').reduce((s, l) => s + num(l.rent_amount), 0),
      Deposit: items.filter((l) => l.status === 'active').reduce((s, l) => s + num(l.deposit_amount), 0),
    }
  } else if (report === 'maintenance') {
    let items = store.maintenance.map(maintenanceDto)
    if (propertyId) items = items.filter((m) => m.property_id === propertyId)
    if (tenantId) items = items.filter((m) => m.tenant_id === tenantId)
    if (status && status !== 'all') items = items.filter((m) => m.status === status)
    if (start) items = items.filter((m) => m.created_at.slice(0, 10) >= start)
    if (end) items = items.filter((m) => m.created_at.slice(0, 10) <= end)
    items.sort((a, b) => b.created_at.localeCompare(a.created_at))
    columns = ['Ticket', 'Property', 'Tenant', 'Title', 'Category', 'Priority', 'Status', 'Days', 'Cost', 'Raised']
    rows = items.map((m) => [m.ticket_code, m.property_name ?? '-', m.tenant_name ?? '-', m.title,
      m.category, m.priority, m.status, m.age_days ?? 0, num(m.cost), m.created_at.slice(0, 10)])
    const resolved = items.filter((m) => CLOSED_STATUSES.includes(m.status))
    totals = {
      Requests: items.length,
      Open: items.filter((m) => MAINTENANCE_OPEN.includes(m.status)).length,
      Completed: resolved.length,
      'Avg days to resolve': resolved.length
        ? Math.round((resolved.reduce((s, m) => s + (m.age_days ?? 0), 0) / resolved.length) * 10) / 10
        : 0,
      Cost: items.reduce((s, m) => s + num(m.cost), 0),
    }
  } else if (report === 'payments') {
    const items = paymentRows().map(paymentDto)
    columns = ['Payment ID', 'Tenant', 'Property', 'Due date', 'Paid date', 'Amount', 'Method', 'Reference', 'Status']
    rows = items.map((p) => [p.payment_code, p.tenant_name ?? '-', p.property_name ?? '-',
      p.due_date ?? '-', p.paid_date ?? '-', num(p.amount_paid),
      String(p.method ?? '-').replace('_', ' '), p.reference ?? '-', p.status])
    totals = {
      Transactions: items.length,
      Amount: items.reduce((s, p) => s + num(p.amount_paid), 0),
      'Paid in full': items.filter((p) => p.status === 'paid').length,
      'Part paid': items.filter((p) => p.status === 'partial').length,
    }
  } else {
    const items = paymentRows().map(paymentDto)
    columns = ['Period', 'Property', 'Tenant', 'Due date', 'Billed', 'Paid', 'Balance', 'Status']
    rows = items.map((p) => [p.period ?? '-', p.property_name ?? '-', p.tenant_name ?? '-',
      p.due_date ?? '-', num(p.amount), num(p.amount_paid), num(p.amount) - num(p.amount_paid), p.status])
    const billed = items.reduce((s, p) => s + num(p.amount), 0)
    const collected = items.reduce((s, p) => s + num(p.amount_paid), 0)
    totals = {
      Invoices: items.length,
      Billed: billed,
      Paid: collected,
      Balance: billed - collected,
      'Collection %': billed ? Math.round((collected / billed) * 1000) / 10 : 0,
    }
  }

  return {
    report,
    label: REPORT_TYPES.find((r) => r.value === report)?.label ?? report,
    generated_at: todayStr(),
    start_date: start,
    end_date: end,
    columns,
    rows,
    totals,
    money_columns: columns.filter((c) => MONEY_COLUMNS.includes(c)),
  }
})

/* ---- tenant portal ---- */

function portalProfile() {
  const user = requireTenant()
  const profile = tenantProfileFor(user.id)
  if (!profile) throw new DemoError('No tenant profile linked to this account', 404)
  return profile
}

route('GET', /^\/portal\/overview$/, () => {
  const profile = portalProfile()
  const lease = activeLeaseForTenant(profile.id)
  const property = lease ? propertyById(lease.property_id) : null
  const rows = lease
    ? store.payments.filter((p) => p.lease_id === lease.id).sort((a, b) => b.due_date.localeCompare(a.due_date))
    : []
  const t = todayStr()
  const outstanding = rows
    .filter((p) => UNSETTLED.includes(paymentStatus(p)) && p.due_date <= t)
    .reduce((s, p) => s + num(p.amount) - num(p.amount_paid), 0)
  const nextDue = [...rows]
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .find((p) => UNSETTLED.includes(paymentStatus(p)))
  const mine = store.maintenance.filter((m) => m.tenant_id === profile.id)
  const openRequests = mine.filter((m) => MAINTENANCE_OPEN.includes(m.status))
  const dueSoFar = rows.filter((p) => p.due_date <= t)

  return {
    tenant: tenantDto(profile),
    lease: lease ? leaseDto(lease) : null,
    property: property ? propertyDto(property) : null,
    stats: {
      outstanding: Math.round(outstanding * 100) / 100,
      rent_amount: lease ? num(lease.rent_amount) : 0,
      deposit_amount: lease ? num(lease.deposit_amount) : 0,
      next_due_date: nextDue?.due_date ?? null,
      next_due_amount: nextDue ? num(nextDue.amount) - num(nextDue.amount_paid) : 0,
      payment_status: nextDue ? paymentStatus(nextDue) : 'paid',
      lease_status: lease ? leaseState(lease) : 'none',
      days_remaining: lease ? daysBetween(lease.end_date, t) : null,
      open_requests: openRequests.length,
      paid_invoices: rows.filter((p) => paymentStatus(p) === 'paid').length,
      total_paid: rows.reduce((s, p) => s + num(p.amount_paid), 0),
    },
    recent_payments: (dueSoFar.length ? dueSoFar : rows).slice(0, 5).map(paymentDto),
    open_requests: openRequests.slice(0, 5).map(maintenanceDto),
    recent_updates: [...mine]
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 5)
      .map(maintenanceDto),
  }
})

route('GET', /^\/portal\/property$/, () => {
  const profile = portalProfile()
  const lease = activeLeaseForTenant(profile.id)
  if (!lease) return { property: null, lease: null, manager: null, unit_room: null, open_requests: [] }
  const property = propertyById(lease.property_id)
  const manager = property ? userById(property.manager_id) : null
  return {
    property: property ? propertyDto(property) : null,
    lease: leaseDto(lease),
    unit_room: profile.unit_room,
    manager: manager ? { name: manager.name, email: manager.email, phone: manager.phone } : null,
    open_requests: store.maintenance
      .filter((m) => m.tenant_id === profile.id && MAINTENANCE_OPEN.includes(m.status))
      .map(maintenanceDto),
  }
})

route('GET', /^\/portal\/lease$/, () => {
  const profile = portalProfile()
  return store.leases
    .filter((l) => l.tenant_id === profile.id)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((l) => leaseDto(l))
})

route('GET', /^\/portal\/payments$/, () => {
  const profile = portalProfile()
  const leaseIds = store.leases.filter((l) => l.tenant_id === profile.id).map((l) => l.id)
  return store.payments
    .filter((p) => leaseIds.includes(p.lease_id))
    .sort((a, b) => b.due_date.localeCompare(a.due_date))
    .map(paymentDto)
})

route('GET', /^\/health$/, () => ({ status: 'ok', database: 'browser', email: 'disabled' }))

/* ------------------------------------------------------------- dispatcher */

export function demoRequest(path: string, method: string, body: any): Promise<any> {
  const [rawPath, search] = path.split('?')
  const query = new URLSearchParams(search ?? '')

  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue
    const match = pattern.exec(rawPath)
    if (!match) continue
    // A little latency keeps the loading skeletons visible, as on a real network.
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(handler({ body: body ?? {}, query }, match.slice(1)))
        } catch (err) {
          reject(err)
        }
      }, 90)
    })
  }
  return Promise.reject(new DemoError(`No demo route for ${method} ${rawPath}`, 404))
}

export function demoLogout() {
  setSession(null)
}
