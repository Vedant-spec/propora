export type Role = 'admin' | 'manager' | 'tenant'

export interface User {
  id: number
  name: string
  email: string
  phone?: string | null
  role: Role
  is_active: boolean
  theme?: 'light' | 'dark' | 'system'
  density?: string
  notify_email?: boolean
  notify_rent?: boolean
  notify_maintenance?: boolean
  notify_lease?: boolean
  tenant_id?: number | null
  last_login_at?: string | null
  password_changed_at?: string | null
  created_at?: string
}

export interface Property {
  id: number
  property_code: string
  name: string
  address: string
  city?: string
  state?: string
  zip_code?: string
  property_type: 'residential' | 'commercial'
  unit_label?: string
  floor?: string
  furnishing?: string
  bedrooms: number
  bathrooms: number
  area_sqft: number
  rent_amount: number
  security_deposit: number
  maintenance_charge: number
  status: 'available' | 'occupied' | 'maintenance'
  description?: string
  manager_id?: number | null
  manager_name?: string | null
  current_tenant?: string | null
  current_tenant_id?: number | null
  current_lease_id?: number | null
  created_at?: string
}

export interface Tenant {
  id: number
  user_id?: number | null
  full_name: string
  email: string
  phone?: string
  date_of_birth?: string | null
  gender?: string
  id_proof_type?: string
  id_number?: string
  document_name?: string | null
  occupation?: string
  unit_room?: string
  emergency_name?: string
  emergency_relationship?: string
  emergency_phone?: string
  notes?: string
  created_at?: string
  current_property?: string | null
  current_property_id?: number | null
  lease_status: string
  has_login?: boolean
}

export type LeaseState = 'active' | 'expiring_soon' | 'expired' | 'terminated'

export interface Lease {
  id: number
  lease_code: string
  property_id: number
  property_name?: string
  property_address?: string
  property_code?: string
  tenant_id: number
  tenant_name?: string
  tenant_email?: string
  tenant_phone?: string
  start_date: string
  end_date: string
  rent_amount: number
  deposit_amount: number
  rent_due_day: number
  status: 'active' | 'expired' | 'terminated'
  lease_state: LeaseState
  days_remaining?: number | null
  terms?: string
  payments?: Payment[]
  totals?: { billed: number; collected: number; outstanding: number }
}

export interface Payment {
  id: number
  payment_code: string
  lease_id: number
  lease_code?: string
  tenant_id?: number
  tenant_name?: string
  tenant_email?: string
  tenant_phone?: string
  property_id?: number
  property_name?: string
  property_address?: string
  amount: number
  amount_paid: number
  balance: number
  due_date: string
  paid_date?: string | null
  period?: string
  method?: string | null
  reference?: string | null
  status: 'pending' | 'paid' | 'partial' | 'overdue'
  days_overdue?: number
  notes?: string
  created_at?: string
}

export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed'

export interface MaintenanceRequest {
  id: number
  ticket_code: string
  property_id: number
  property_name?: string
  property_address?: string
  tenant_id?: number | null
  tenant_name?: string | null
  tenant_phone?: string | null
  title: string
  description?: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: MaintenanceStatus
  assigned_to?: number | null
  assignee_name?: string | null
  technician_name?: string | null
  technician_phone?: string | null
  scheduled_date?: string | null
  cost?: number
  resolution_notes?: string | null
  age_days?: number
  created_at?: string
  updated_at?: string
  assigned_at?: string | null
  completed_at?: string | null
  closed_at?: string | null
}

export interface DashboardData {
  stats: {
    total_properties: number
    occupied: number
    available: number
    under_maintenance: number
    occupancy_rate: number
    total_tenants: number
    active_leases: number
    expiring_soon: number
    monthly_revenue: number
    billed_this_month: number
    pending_rent: number
    overdue_rent: number
    overdue_count: number
    open_maintenance: number
    urgent_maintenance: number
    monthly_rent_roll: number
  }
  trend: { period: string; label: string; billed: number; collected: number }[]
  occupancy: { name: string; value: number }[]
  expiring_leases: Lease[]
  recent_maintenance: MaintenanceRequest[]
  recent_payments: Payment[]
}

export interface PortalOverview {
  tenant: Tenant
  lease: Lease | null
  property: Property | null
  stats: {
    outstanding: number
    rent_amount: number
    deposit_amount: number
    next_due_date: string | null
    next_due_amount: number
    payment_status: string
    lease_status: string
    days_remaining: number | null
    open_requests: number
    paid_invoices: number
    total_paid: number
  }
  recent_payments: Payment[]
  open_requests: MaintenanceRequest[]
  recent_updates: MaintenanceRequest[]
}

export interface ReportData {
  report: string
  label: string
  generated_at: string
  start_date: string | null
  end_date: string | null
  columns: string[]
  rows: (string | number)[][]
  totals: Record<string, number | string>
  money_columns: string[]
}
