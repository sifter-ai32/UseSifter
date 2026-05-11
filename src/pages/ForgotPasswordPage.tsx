import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react'
import * as api from '@/lib/api'

type Step = 'email' | 'code' | 'newPassword'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError('Please enter your email address.')
      return
    }
    setLoading(true)
    try {
      await api.forgotPassword(trimmed)
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code.')
      return
    }
    setStep('newPassword')
  }

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const result = await api.resetPassword(email.trim().toLowerCase(), otp, newPassword)
      setSuccess(result.message)
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-black min-h-screen flex items-center justify-center p-4 text-[#fafafa] antialiased">
      <div className="w-full max-w-[420px] bg-black border border-white/[0.1] rounded-3xl p-8 sm:p-10">
        {/* Back */}
        <button
          type="button"
          onClick={() => step === 'email' ? navigate('/') : setStep(step === 'newPassword' ? 'code' : 'email')}
          className="flex items-center gap-1.5 text-[#737373] hover:text-[#fafafa] transition-colors cursor-pointer mb-8"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-sm">{step === 'email' ? 'Back to sign in' : 'Back'}</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center mb-5">
            <KeyRound className="w-5 h-5 text-[#a6a6a6]" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-light tracking-tight mb-2 text-[#fafafa]">
            {step === 'email' && 'Reset your password'}
            {step === 'code' && 'Check your email'}
            {step === 'newPassword' && 'Set new password'}
          </h1>
          <p className="text-sm text-[#737373] font-light">
            {step === 'email' && "Enter your email and we'll send you a reset code."}
            {step === 'code' && `We sent a 6-digit code to ${email}`}
            {step === 'newPassword' && 'Choose a strong password for your account.'}
          </p>
        </div>

        {success ? (
          <div className="text-center py-4">
            <p className="text-sm text-green-400">{success}</p>
            <p className="text-xs text-[#737373] mt-2">Redirecting to sign in...</p>
          </div>
        ) : (
          <>
            {/* Email Step */}
            {step === 'email' && (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#a6a6a6]">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-[#e5e5e5] placeholder:text-[#525252] focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all duration-200"
                  />
                </div>
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#fafafa] hover:opacity-80 text-black rounded-full py-3 mt-2 transition-all duration-200 font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : <Mail className="w-4 h-4" strokeWidth={1.5} />}
                  <span className="text-sm">{loading ? 'Sending...' : 'Send reset code'}</span>
                </button>
              </form>
            )}

            {/* OTP Step */}
            {step === 'code' && (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#a6a6a6]">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full bg-white/5 border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-[#e5e5e5] placeholder:text-[#525252] focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all duration-200 tracking-[0.3em] text-center text-lg"
                  />
                </div>
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-[#fafafa] hover:opacity-80 text-black rounded-full py-3 mt-2 transition-all duration-200 font-medium cursor-pointer"
                >
                  <span className="text-sm">Verify code</span>
                </button>
              </form>
            )}

            {/* New Password Step */}
            {step === 'newPassword' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#a6a6a6]">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/[0.12] rounded-xl px-4 py-3 pr-10 text-sm text-[#e5e5e5] placeholder:text-[#525252] focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all duration-200 tracking-[0.15em]"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#fafafa] cursor-pointer">
                      {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#a6a6a6]">Confirm new password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-[#e5e5e5] placeholder:text-[#525252] focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all duration-200 tracking-[0.15em]"
                  />
                </div>
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#fafafa] hover:opacity-80 text-black rounded-full py-3 mt-2 transition-all duration-200 font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : <KeyRound className="w-4 h-4" strokeWidth={1.5} />}
                  <span className="text-sm">{loading ? 'Resetting...' : 'Reset password'}</span>
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
