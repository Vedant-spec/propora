import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, tokenStore } from '../lib/api'
import type { User } from '../lib/types'

interface RegisterInput {
  name: string
  email: string
  phone?: string
  password: string
  confirm_password: string
}

interface AuthValue {
  user: User | null
  loading: boolean
  isStaff: boolean
  login: (email: string, password: string) => Promise<User>
  register: (input: RegisterInput) => Promise<{ user: User; linked_to_existing_tenant: boolean }>
  verifyOtp: (phone: string, code: string) => Promise<User>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      setUser(await api<User>('/auth/me'))
    } catch {
      tokenStore.clear()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      // A wrong password must render inline, not bounce to /session-expired.
      silent401: true,
    })
    tokenStore.set(result.access_token)
    setUser(result.user)
    return result.user
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const result = await api<{
      access_token: string
      user: User
      linked_to_existing_tenant: boolean
    }>('/auth/register', { method: 'POST', body: input, silent401: true })
    tokenStore.set(result.access_token)
    setUser(result.user)
    return result
  }, [])

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    const result = await api<{ access_token: string; user: User }>('/auth/otp/verify', {
      method: 'POST',
      body: { phone, code },
      silent401: true,
    })
    tokenStore.set(result.access_token)
    setUser(result.user)
    return result.user
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      isStaff: user?.role === 'admin' || user?.role === 'manager',
      login,
      register,
      verifyOtp,
      logout,
      refresh,
    }),
    [user, loading, login, register, verifyOtp, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
