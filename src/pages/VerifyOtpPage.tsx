import { useState, useRef, useEffect, useCallback } from 'react'
import type { KeyboardEvent, ClipboardEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Sparkles, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import * as api from '@/lib/api'

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const navigate = useNavigate()

  const pendingEmail = useAuthStore((s) => s.pendingEmail)
  const verifyOtp = useAuthStore((s) => s.verifyOtp)

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const newOtp = [...otp]
    for (let i = 0; i < 6; i++) {
      newOtp[i] = text[i] || ''
    }
    setOtp(newOtp)
    const focusIndex = Math.min(text.length, 5)
    inputRefs.current[focusIndex]?.focus()
  }

  const handleSubmit = useCallback(async () => {
    if (!pendingEmail) return
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const success = await verifyOtp(pendingEmail, code)
      if (success) {
        navigate('/onboarding/name')
      } else {
        setError('Invalid or expired code. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [otp, pendingEmail, verifyOtp, navigate])

  const handleResend = async () => {
    if (resendCooldown > 0 || !pendingEmail) return
    try {
      await api.resendSignupOtp(pendingEmail)
      setResendCooldown(60)
      setError('')
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch {
      setError('Failed to resend code. Please try again.')
    }
  }

  if (!pendingEmail) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen antialiased overflow-x-hidden bg-[#0a0a0a] flex items-center justify-center">
      <main className="flex flex-col w-full max-w-md px-6 mx-auto items-center">
        <div className="mb-6">
          <Sparkles className="w-9 h-9 text-[#e5e5e5]" strokeWidth={1.5} />
        </div>

        <h1 className="text-3xl font-light text-[#e5e5e5] tracking-tight mb-2">
          Check your email
        </h1>
        <p className="text-sm text-[#a3a3a3] mb-8 text-center">
          We sent a 6-digit code to <span className="text-[#e5e5e5] font-medium">{pendingEmail}</span>
        </p>

        <div className="flex gap-3 mb-6" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-2xl font-semibold bg-white/5 border border-white/[0.12] rounded-xl text-[#e5e5e5] focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-4 text-center">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || otp.join('').length !== 6}
          className="w-full flex items-center justify-center gap-2 bg-[#e5e5e5] hover:bg-[#a3a3a3] text-[#0a0a0a] rounded-xl py-3 font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          ) : null}
          <span>{loading ? 'Verifying...' : 'Verify'}</span>
        </button>

        <p className="text-sm text-[#a3a3a3]">
          {"Didn't get the code? "}
          {resendCooldown > 0 ? (
            <span className="text-[#525252]">Resend in {resendCooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-[#e5e5e5] underline underline-offset-2 decoration-white/20 hover:decoration-white/50 cursor-pointer transition-all"
            >
              Resend code
            </button>
          )}
        </p>
      </main>
    </div>
  )
}
