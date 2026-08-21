import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'

// Auth
import Splash from './pages/Splash'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import SessionExpired from './pages/SessionExpired'

// Admin / manager
import Dashboard from './pages/Dashboard'
import Properties from './pages/Properties'
import PropertyDetails from './pages/PropertyDetails'
import Tenants from './pages/Tenants'
import TenantDetails from './pages/TenantDetails'
import Leases from './pages/Leases'
import LeaseDetails from './pages/LeaseDetails'
import PaymentsDashboard from './pages/PaymentsDashboard'
import Payments from './pages/Payments'
import PaymentDetails from './pages/PaymentDetails'
import MaintenanceDashboard from './pages/MaintenanceDashboard'
import Maintenance from './pages/Maintenance'
import MaintenanceDetails from './pages/MaintenanceDetails'
import MaintenanceHistory from './pages/MaintenanceHistory'
import ReportsDashboard from './pages/ReportsDashboard'
import Reports from './pages/Reports'
import Users from './pages/Users'

// Shared account
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import AppSettings from './pages/settings/AppSettings'
import SecuritySettings from './pages/settings/SecuritySettings'
import NotificationSettings from './pages/settings/NotificationSettings'

// Tenant portal
import TenantDashboard from './pages/portal/TenantDashboard'
import TenantProperty from './pages/portal/TenantProperty'
import TenantLease from './pages/portal/TenantLease'
import TenantPayments from './pages/portal/TenantPayments'
import TenantMaintenance from './pages/portal/TenantMaintenance'

type Role = 'admin' | 'manager' | 'tenant'

function Guard({ children, allow }: { children: ReactNode; allow?: Role[] }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Loading your workspace…" />
  if (!user) return <Navigate to="/login" replace />
  if (allow && !allow.includes(user.role)) {
    return <Navigate to={user.role === 'tenant' ? '/portal' : '/dashboard'} replace />
  }
  return <>{children}</>
}

const staff = (element: ReactNode) => <Guard allow={['admin', 'manager']}>{element}</Guard>
const tenant = (element: ReactNode) => <Guard allow={['tenant']}>{element}</Guard>

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'tenant' ? '/portal' : '/dashboard'} replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Splash />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/session-expired" element={<SessionExpired />} />

              {/* Authenticated shell */}
              <Route
                element={
                  <Guard>
                    <Layout />
                  </Guard>
                }
              >
                <Route path="/dashboard" element={staff(<Dashboard />)} />

                <Route path="/properties" element={staff(<Properties />)} />
                <Route path="/properties/:id" element={staff(<PropertyDetails />)} />

                <Route path="/tenants" element={staff(<Tenants />)} />
                <Route path="/tenants/:id" element={staff(<TenantDetails />)} />

                <Route path="/leases" element={staff(<Leases />)} />
                <Route path="/leases/:id" element={staff(<LeaseDetails />)} />

                <Route path="/payments/dashboard" element={staff(<PaymentsDashboard />)} />
                <Route path="/payments" element={staff(<Payments />)} />
                <Route path="/payments/:id" element={staff(<PaymentDetails />)} />

                <Route path="/maintenance/dashboard" element={staff(<MaintenanceDashboard />)} />
                <Route path="/maintenance/history" element={staff(<MaintenanceHistory />)} />
                <Route path="/maintenance" element={staff(<Maintenance />)} />
                <Route path="/maintenance/:id" element={staff(<MaintenanceDetails />)} />

                <Route path="/reports" element={staff(<ReportsDashboard />)} />
                <Route path="/reports/generate" element={staff(<Reports />)} />

                <Route path="/users" element={<Guard allow={['admin']}><Users /></Guard>} />

                {/* Tenant portal */}
                <Route path="/portal" element={tenant(<TenantDashboard />)} />
                <Route path="/portal/property" element={tenant(<TenantProperty />)} />
                <Route path="/portal/lease" element={tenant(<TenantLease />)} />
                <Route path="/portal/payments" element={tenant(<TenantPayments />)} />
                <Route path="/portal/maintenance" element={tenant(<TenantMaintenance />)} />

                {/* Shared account screens */}
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />}>
                  <Route index element={<AppSettings />} />
                  <Route path="security" element={<SecuritySettings />} />
                  <Route path="notifications" element={<NotificationSettings />} />
                </Route>
              </Route>

              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
