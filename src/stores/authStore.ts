import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import * as api from '@/lib/api'

export type UserType = 'client' | 'talent' | null

interface AuthUser {
  id: string
  email: string
  name: string
  avatar: string | null
  walletAddress: string | null
}

interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  userType: UserType
  onboardingComplete: boolean
  pendingEmail: string | null
  login: (email: string, password: string) => Promise<boolean>
  sendOtp: (email: string, password: string) => Promise<boolean>
  verifyOtp: (email: string, otp: string) => Promise<boolean>
  loginWithGoogle: () => Promise<boolean>
  setName: (name: string) => void
  setAvatar: (avatar: string | null) => void
  setUserType: (type: 'client' | 'talent') => void
  setWalletAddress: (address: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      userType: null,
      onboardingComplete: false,
      pendingEmail: null,

      login: async (email, password) => {
        const user = await api.login(email, password)
        set({
          isAuthenticated: true,
          user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar ?? null, walletAddress: (user as any).walletAddress ?? null },
          userType: (user.userType as UserType) || null,
          onboardingComplete: user.onboardingComplete,
        })
        return true
      },

      sendOtp: async (email, password) => {
        await api.sendSignupOtp(email, password)
        set({ pendingEmail: email })
        return true
      },

      verifyOtp: async (email, otp) => {
        try {
          const user = await api.verifySignupOtp(email, otp)
          set({
            isAuthenticated: true,
            user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar ?? null, walletAddress: (user as any).walletAddress ?? null },
            userType: (user.userType as UserType) || null,
            onboardingComplete: user.onboardingComplete,
            pendingEmail: null,
          })
          return true
        } catch {
          return false
        }
      },

      loginWithGoogle: async () => {
        const result = await signInWithPopup(auth, googleProvider)
        const idToken = await result.user.getIdToken()
        const user = await api.googleLogin(idToken)
        set({
          isAuthenticated: true,
          user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar ?? null, walletAddress: (user as any).walletAddress ?? null },
          userType: (user.userType as UserType) || null,
          onboardingComplete: user.onboardingComplete,
        })
        return true
      },

      setName: (name) => {
        const state = get()
        if (state.user) {
          api.updateUser(state.user.id, { name }).catch(() => {})
        }
        set((s) => ({
          user: s.user ? { ...s.user, name } : null,
        }))
      },

      setAvatar: (avatar) => {
        set((s) => ({
          user: s.user ? { ...s.user, avatar } : null,
        }))
      },

      setUserType: (type) => {
        const state = get()
        const complete = type === 'client'
        if (state.user) {
          api.updateUser(state.user.id, { userType: type, onboardingComplete: complete } as any).catch(() => {})
        }
        set({ userType: type, onboardingComplete: complete })
      },

      setWalletAddress: (address) => {
        const state = get()
        if (state.user) {
          api.updateUser(state.user.id, { walletAddress: address.toLowerCase() } as any).catch(() => {})
        }
        set((s) => ({
          user: s.user ? { ...s.user, walletAddress: address.toLowerCase() } : null,
        }))
      },

      logout: () => {
        import('@/hooks/useSocket').then(({ getSocket }) => getSocket()?.disconnect())
        set({ isAuthenticated: false, user: null, userType: null, onboardingComplete: false, pendingEmail: null })
      },
    }),
    {
      name: 'sifter-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        userType: state.userType,
        onboardingComplete: state.onboardingComplete,
        pendingEmail: state.pendingEmail,
      }),
    },
  ),
)
