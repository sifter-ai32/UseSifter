import { Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { AdminUser } from './lib/api'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DisputeDetailPage from './pages/DisputeDetailPage'
import RescuePage from './pages/RescuePage'

// ──── Auth Context ────

interface AuthContextType {
  user: AdminUser | null
  loading: boolean
  login: (user: AdminUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sifter-admin-user')
      if (stored) setUser(JSON.parse(stored))
    } catch { /* noop */ }
    setLoading(false)
  }, [])

  const login = useCallback((u: AdminUser) => {
    setUser(u)
    localStorage.setItem('sifter-admin-user', JSON.stringify(u))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('sifter-admin-user')
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ──── Protected Route ────

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#fafafa]/20 border-t-[#fafafa] rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

// ──── App ────

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/admin/disputes/:id" element={<ProtectedRoute><DisputeDetailPage /></ProtectedRoute>} />
        <Route path="/admin/rescue" element={<ProtectedRoute><RescuePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AuthProvider>
  )
}
