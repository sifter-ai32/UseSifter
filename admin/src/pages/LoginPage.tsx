import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../App'
import { adminLogin } from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    navigate('/admin', { replace: true })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const adminUser = await adminLogin(email, password)
      login(adminUser)
      navigate('/admin', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#000' }} className="min-h-screen flex items-center justify-center p-4 antialiased">
      <div className="w-full" style={{ maxWidth: 420 }}>
        {/* Card */}
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '40px 36px' }}>
          {/* Logo */}
          <div className="flex justify-center" style={{ marginBottom: 32 }}>
            <img src="/sifter-logo.png" alt="Sifter" style={{ width: 40, height: 40 }} />
          </div>

          {/* Header */}
          <div className="text-center" style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 200, color: '#fafafa', letterSpacing: '-0.025em', marginBottom: 8 }}>Admin Panel</h1>
            <p style={{ fontSize: 14, fontWeight: 300, color: '#737373' }}>Dispute Resolution Center</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 24 }}>
              <AlertCircle style={{ width: 16, height: 16, color: '#ef4444', flexShrink: 0 }} strokeWidth={1.5} />
              <p style={{ fontSize: 14, fontWeight: 300, color: '#ef4444' }}>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Enter email"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: '#fafafa', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Enter password"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: '#fafafa', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ width: '100%', background: '#e5e5e5', color: '#0a0a0a', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 500, border: 'none', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.target as HTMLElement).style.background = '#cccccc'}
              onMouseLeave={e => (e.target as HTMLElement).style.background = '#e5e5e5'}
            >
              {loading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" strokeWidth={1.5} /> : null}
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center" style={{ marginTop: 24, fontSize: 12, fontWeight: 300, color: '#525252' }}>
          Authorized personnel only
        </p>
      </div>
    </div>
  )
}
