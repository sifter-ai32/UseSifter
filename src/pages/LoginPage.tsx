import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

type AuthMode = 'signin' | 'signup'

function AuraLogo() {
  return <img src="/sifter-navbar-logo.png" alt="Sifter" className="h-12 w-auto" />
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const authLogin = useAuthStore((s) => s.login)
  const sendOtp = useAuthStore((s) => s.sendOtp)
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete)
  const userType = useAuthStore((s) => s.userType)
  const [googleLoading, setGoogleLoading] = useState(false)

  const isSignUp = mode === 'signup'

  // Redirect authenticated users away from login
  useEffect(() => {
    if (isAuthenticated) {
      if (onboardingComplete && userType) {
        const invite = sessionStorage.getItem('sifter-invite-redirect')
        if (invite) {
          sessionStorage.removeItem('sifter-invite-redirect')
          navigate(invite, { replace: true })
        } else {
          navigate(userType === 'talent' ? '/freelancer/dashboard' : '/chat', { replace: true })
        }
      } else {
        navigate('/onboarding/name', { replace: true })
      }
    }
  }, [isAuthenticated, onboardingComplete, userType, navigate])

  const getPostLoginRoute = () => {
    const { onboardingComplete, userType } = useAuthStore.getState()
    if (onboardingComplete) {
      const invite = sessionStorage.getItem('sifter-invite-redirect')
      if (invite) {
        sessionStorage.removeItem('sifter-invite-redirect')
        return invite
      }
      return userType === 'talent' ? '/freelancer/dashboard' : '/chat'
    }
    return '/onboarding/name'
  }

  const handleGoogleLogin = async () => {
    if (isSignUp && !agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }
    setError('')
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
      navigate(getPostLoginRoute())
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('popup-closed-by-user') || message.includes('cancelled-popup-request')) {
        return
      }
      setError(message || 'Google sign-in failed. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    if (isSignUp) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
      if (!agreedToTerms) {
        setError('Please agree to the Terms of Service and Privacy Policy to continue.')
        return
      }
      setLoading(true)
      try {
        await sendOtp(trimmedEmail, password)
        navigate('/verify-otp')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(true)
      try {
        await authLogin(trimmedEmail, password)
        navigate(getPostLoginRoute())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid credentials.')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="bg-black min-h-screen flex items-center justify-center p-4 text-[#fafafa] antialiased selection:bg-[#737373]/40 selection:text-white">
      <div className="w-full max-w-[420px] bg-black border border-white/[0.1] rounded-3xl p-8 sm:p-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <AuraLogo />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light tracking-tight mb-2 text-[#fafafa]">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-[#737373] font-light">
            {isSignUp
              ? 'Get started with Sifter'
              : 'Sign in to continue'}
          </p>
        </div>

        {/* OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/[0.1] rounded-full py-3 transition-colors duration-200 mb-6 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#a6a6a6]" strokeWidth={1.5} />
          ) : (
            <GoogleIcon />
          )}
          <span className="text-sm font-medium text-[#a6a6a6] group-hover:text-[#fafafa] transition-colors duration-200">
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-[11px] text-[#525252] uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        {/* Sign In / Sign Up Toggle */}
        <div className="flex bg-white/[0.03] rounded-full p-1 border border-white/[0.08] mb-6">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); setAgreedToTerms(false) }}
            className={`flex-1 py-2 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer ${
              !isSignUp
                ? 'text-[#fafafa] bg-white/[0.08] border border-white/[0.12]'
                : 'text-[#525252] hover:text-[#a6a6a6] border border-transparent'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer ${
              isSignUp
                ? 'text-[#fafafa] bg-white/[0.08] border border-white/[0.12]'
                : 'text-[#525252] hover:text-[#a6a6a6] border border-transparent'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
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

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#a6a6a6]">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-[#e5e5e5] placeholder:text-[#525252] focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all duration-200 tracking-[0.15em]"
            />
          </div>

          {isSignUp && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#a6a6a6]">Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-[#e5e5e5] placeholder:text-[#525252] focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all duration-200 tracking-[0.15em]"
              />
            </div>
          )}

          {/* Terms checkbox — signup only */}
          {isSignUp && (
            <label className="flex items-start gap-3 cursor-pointer group pt-1">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-[18px] h-[18px] rounded-[5px] border border-white/20 bg-white/5 peer-checked:bg-[#fafafa] peer-checked:border-[#fafafa] transition-all duration-200 flex items-center justify-center">
                  {agreedToTerms && (
                    <svg className="w-3 h-3 text-black" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs text-[#737373] leading-relaxed group-hover:text-[#a6a6a6] transition-colors">
                I agree to the{' '}
                <Link to="/terms" className="text-[#a6a6a6] underline decoration-white/20 underline-offset-2 hover:text-[#fafafa] hover:decoration-white/40 transition-all">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-[#a6a6a6] underline decoration-white/20 underline-offset-2 hover:text-[#fafafa] hover:decoration-white/40 transition-all">
                  Privacy Policy
                </Link>
              </span>
            </label>
          )}

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#fafafa] hover:opacity-80 text-black rounded-full py-3 mt-2 transition-all duration-200 font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Mail className="w-4 h-4" strokeWidth={1.5} />
            )}
            <span className="text-sm">
              {loading ? (isSignUp ? 'Signing up...' : 'Logging in...') : isSignUp ? 'Sign up with Email' : 'Sign in with Email'}
            </span>
          </button>
        </form>

        {/* Footer — Forgot password for sign in, T&C info for sign up */}
        {isSignUp ? (
          <p className="mt-6 text-center text-xs text-[#525252]">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>
        ) : (
          <div className="mt-6 text-center">
            <Link
              to="/forgot-password"
              className="text-xs text-[#737373] hover:text-[#fafafa] underline decoration-white/20 underline-offset-2 hover:decoration-white/40 transition-all duration-200"
            >
              Forgot your password?
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
