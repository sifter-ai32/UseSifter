import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

/** Used for onboarding pages — redirects away if onboarding is already done */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete)
  const userType = useAuthStore((s) => s.userType)

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // If onboarding is already complete, redirect to the appropriate dashboard
  // But allow freelancers who haven't completed onboarding to stay on onboarding pages
  if (onboardingComplete && userType) {
    return <Navigate to={userType === 'talent' ? '/freelancer/dashboard' : '/chat'} replace />
  }

  return <>{children}</>
}

/** Auth-only guard — no onboarding redirect. Used for shared pages like Settings. */
export function AuthRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export function ClientRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userType = useAuthStore((s) => s.userType)
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete)

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // If onboarding isn't complete, send to onboarding
  if (!onboardingComplete) {
    return <Navigate to="/onboarding/name" replace />
  }

  // If user is a freelancer, send them to their dashboard
  if (userType === 'talent') {
    return <Navigate to="/freelancer/dashboard" replace />
  }

  return <>{children}</>
}

export function FreelancerRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userType = useAuthStore((s) => s.userType)
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete)

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // If onboarding isn't complete, send to onboarding
  if (!onboardingComplete) {
    return <Navigate to="/onboarding/name" replace />
  }

  // If user is a client, send them to their dashboard
  if (userType === 'client') {
    return <Navigate to="/chat" replace />
  }

  return <>{children}</>
}
