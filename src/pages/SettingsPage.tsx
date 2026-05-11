import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Mail, Shield, Wallet, User,
  Camera, Loader2, Check, AlertTriangle, Eye, EyeOff,
  Smartphone, Clock, CreditCard, Globe,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import FreelancerHeader from '@/components/layout/FreelancerHeader'
import { useAuthStore } from '@/stores/authStore'
import * as api from '@/lib/api'
import { getImageUrl } from '@/lib/utils'

// ─── Shared Styles ───
const CARD = 'bg-[#ffffff]/[0.02] border border-[#ffffff]/[0.08] rounded-2xl'
const LABEL = 'block text-xs font-medium text-[#737373] uppercase tracking-wider mb-2'
const INPUT = 'w-full bg-[#ffffff]/[0.03] border border-[#ffffff]/10 text-[#fafafa] text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#ffffff]/30 transition-colors placeholder:text-[#525252]'
const BTN_PRIMARY = 'px-5 py-2.5 rounded-xl text-sm font-medium bg-[#e5e5e5] text-[#0a0a0a] hover:bg-[#cccccc] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

type ClientTab = 'account' | 'security' | 'billing'
type FreelancerTab = 'account' | 'security' | 'wallet'
type Tab = ClientTab | FreelancerTab

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const userType = useAuthStore((s) => s.userType)
  const setName = useAuthStore((s) => s.setName)
  const setAvatar = useAuthStore((s) => s.setAvatar)
  const setWalletAddress = useAuthStore((s) => s.setWalletAddress)
  const isFreelancer = userType === 'talent'

  const [tab, setTab] = useState<Tab>('account')
  const [loading, setLoading] = useState(true)
  const [fullUser, setFullUser] = useState<api.User | null>(null)

  useEffect(() => {
    if (!user?.id) return
    api.getUser(user.id).then((u) => {
      setFullUser(u)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.id])

  if (!user) return null

  const HeaderComponent = isFreelancer ? FreelancerHeader : Header
  const backPath = isFreelancer ? '/freelancer/dashboard' : '/chat'

  const clientTabs: { key: ClientTab; label: string; icon: typeof User }[] = [
    { key: 'account', label: 'Account', icon: User },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'billing', label: 'Billing & Payments', icon: CreditCard },
  ]

  const freelancerTabs: { key: FreelancerTab; label: string; icon: typeof User }[] = [
    { key: 'account', label: 'Account', icon: User },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'wallet', label: 'Wallet', icon: Wallet },
  ]

  const tabs = isFreelancer ? freelancerTabs : clientTabs

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa] antialiased">
      <HeaderComponent />

      <main className="flex-1 overflow-y-auto pt-16" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back + Title */}
          <div className="flex items-center gap-3 mb-8">
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="p-2 rounded-xl border border-[#ffffff]/[0.08] text-[#737373] hover:text-[#fafafa] hover:bg-[#ffffff]/[0.05] transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 bg-[#ffffff]/[0.03] rounded-xl border border-[#ffffff]/[0.06] mb-8">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer flex-1 justify-center ${
                  tab === t.key
                    ? 'bg-[#ffffff]/[0.08] text-[#fafafa]'
                    : 'text-[#525252] hover:text-[#a6a6a6]'
                }`}
              >
                <t.icon className="w-4 h-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[#525252]" />
            </div>
          ) : isFreelancer ? (
            <>
              {tab === 'account' && (
                <AccountTab user={user} fullUser={fullUser} setFullUser={setFullUser} setName={setName} setAvatar={setAvatar} />
              )}
              {tab === 'security' && <SecurityTab user={user} fullUser={fullUser} setFullUser={setFullUser} />}
              {tab === 'wallet' && (
                <WalletTab user={user} fullUser={fullUser} setFullUser={setFullUser} setWalletAddress={setWalletAddress} />
              )}
            </>
          ) : (
            <>
              {tab === 'account' && (
                <AccountTab user={user} fullUser={fullUser} setFullUser={setFullUser} setName={setName} setAvatar={setAvatar} />
              )}
              {tab === 'security' && <SecurityTab user={user} fullUser={fullUser} setFullUser={setFullUser} />}
              {tab === 'billing' && (
                <BillingTab user={user} fullUser={fullUser} setFullUser={setFullUser} setWalletAddress={setWalletAddress} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: Profile Photo Card
// ─────────────────────────────────────────────────────────────────────────────

function ProfilePhotoCard({
  user, fullUser, setAvatar,
}: {
  user: { id: string; name: string; avatar: string | null }
  fullUser: api.User | null
  setAvatar: (avatar: string | null) => void
}) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const avatarUrl = getImageUrl(fullUser?.avatar || user.avatar)
  const name = fullUser?.name || user.name || 'U'

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/upload`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        setAvatar(data.url)
        // Update user profile with new avatar URL
        await api.updateUser(user.id, { avatar: data.url })
      }
    } catch { /* */ }
    setUploading(false)
  }

  return (
    <div className={`${CARD} p-6`}>
      <h3 className="text-base font-medium text-[#fafafa] mb-5">Profile Photo</h3>
      <div className="flex items-center gap-5">
        <div className="relative group">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover ring-2 ring-[#ffffff]/[0.08]" />
          ) : (
            <div className="w-20 h-20 rounded-full ring-2 ring-[#ffffff]/[0.08] bg-[#1a1a1a] flex items-center justify-center text-2xl font-semibold text-[#e5e5e5]">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 rounded-full bg-[#000000]/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#fafafa]" />
            ) : (
              <Camera className="w-5 h-5 text-[#fafafa]" strokeWidth={1.5} />
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>
        <div>
          <p className="text-sm text-[#a6a6a6]">Click to upload a new photo</p>
          <p className="text-xs text-[#525252] mt-1">JPG, PNG or GIF. Max 5MB.</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: Account Tab (same for Client + Freelancer)
// ─────────────────────────────────────────────────────────────────────────────

function AccountTab({
  user, fullUser, setFullUser, setName, setAvatar,
}: {
  user: { id: string; email: string; name: string; avatar: string | null }
  fullUser: api.User | null
  setFullUser: (u: api.User | null) => void
  setName: (name: string) => void
  setAvatar: (avatar: string | null) => void
}) {
  const [name, setLocalName] = useState(fullUser?.name || user.name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const updated = await api.updateUser(user.id, { name })
      setFullUser(updated)
      setName(name)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* */ }
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-8">
      <ProfilePhotoCard user={user} fullUser={fullUser} setAvatar={setAvatar} />

      <div className={`${CARD} p-6`}>
        <h3 className="text-base font-medium text-[#fafafa] mb-5">Account Information</h3>
        <div className="flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className={LABEL}>
              <span className="flex items-center gap-1.5"><User className="w-3 h-3" strokeWidth={1.5} /> Full Name</span>
            </label>
            <input type="text" value={name} onChange={(e) => setLocalName(e.target.value)} placeholder="Your full name" className={INPUT} />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className={LABEL}>
              <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" strokeWidth={1.5} /> Email Address</span>
            </label>
            <div className="w-full bg-[#ffffff]/[0.02] border border-[#ffffff]/[0.06] rounded-xl px-4 py-3 text-sm text-[#525252] flex items-center justify-between">
              <span>{user.email}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#10b981]/10 text-[#10b981]">Verified</span>
            </div>
            <p className="text-[11px] text-[#525252] mt-1.5 ml-1">Primary login email. Contact support to change.</p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-[#ffffff]/[0.06]">
          <button type="button" onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4 inline mr-1" /> Saved</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: Security Tab
// ─────────────────────────────────────────────────────────────────────────────

function SecurityTab({ user, fullUser, setFullUser }: { user: { id: string; email: string }; fullUser: api.User | null; setFullUser: (u: api.User | null) => void }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const [twoFaEnabled, setTwoFaEnabled] = useState((fullUser as any)?.twoFactorEnabled || false)
  const [setupStep, setSetupStep] = useState<'idle' | 'loading' | 'scan' | 'verify' | 'disabling'>('idle')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [twoFaError, setTwoFaError] = useState('')
  const [twoFaLoading, setTwoFaLoading] = useState(false)

  const passwordMatch = newPw && confirmPw && newPw === confirmPw
  const passwordValid = newPw.length >= 8

  const handleChangePassword = async () => {
    if (!passwordMatch || !passwordValid) {
      setPwError(!passwordValid ? 'Password must be at least 8 characters' : 'Passwords do not match')
      return
    }
    setPwError('')
    setPwLoading(true)
    try {
      await api.changePassword(user.id, currentPw, newPw)
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 2000)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err: any) {
      setPwError(err?.message || 'Failed to change password')
    }
    setPwLoading(false)
  }

  const handleSetup2FA = async () => {
    setSetupStep('loading')
    setTwoFaError('')
    try {
      const data = await api.setup2FA(user.id)
      setQrDataUrl(data.qrDataUrl)
      setSecret(data.secret)
      setSetupStep('scan')
    } catch (err: any) {
      setTwoFaError(err?.message || 'Failed to set up 2FA')
      setSetupStep('idle')
    }
  }

  const handleVerify2FA = async () => {
    setTwoFaLoading(true)
    setTwoFaError('')
    try {
      await api.verify2FA(user.id, totpCode)
      setTwoFaEnabled(true)
      setSetupStep('idle')
      setTotpCode('')
      setQrDataUrl('')
      setSecret('')
      if (fullUser) setFullUser({ ...fullUser, twoFactorEnabled: true } as any)
    } catch (err: any) {
      setTwoFaError(err?.message || 'Invalid code')
    }
    setTwoFaLoading(false)
  }

  const handleDisable2FA = async () => {
    setTwoFaLoading(true)
    setTwoFaError('')
    try {
      await api.disable2FA(user.id, totpCode)
      setTwoFaEnabled(false)
      setSetupStep('idle')
      setTotpCode('')
      if (fullUser) setFullUser({ ...fullUser, twoFactorEnabled: false } as any)
    } catch (err: any) {
      setTwoFaError(err?.message || 'Invalid code')
    }
    setTwoFaLoading(false)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Change Password */}
      <div className={`${CARD} p-6`}>
        <h3 className="text-base font-medium text-[#fafafa] mb-1">Change Password</h3>
        <p className="text-sm text-[#525252] mb-5">Update your password to keep your account secure.</p>

        <div className="flex flex-col gap-4">
          <div>
            <label className={LABEL}>Current Password</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" className={`${INPUT} pr-10`} />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#525252] hover:text-[#a6a6a6] cursor-pointer">
                {showCurrent ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          <div>
            <label className={LABEL}>New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Enter new password" className={`${INPUT} pr-10`} />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#525252] hover:text-[#a6a6a6] cursor-pointer">
                {showNew ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
            {newPw && !passwordValid && (
              <p className="text-[11px] text-[#f59e0b] mt-1.5 ml-1">Must be at least 8 characters</p>
            )}
          </div>

          <div>
            <label className={LABEL}>Confirm New Password</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm new password" className={INPUT} />
            {confirmPw && !passwordMatch && (
              <p className="text-[11px] text-[#ef4444] mt-1.5 ml-1">Passwords do not match</p>
            )}
          </div>

          {pwError && (
            <div className="flex items-center gap-2 text-sm text-[#ef4444]">
              <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              {pwError}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-[#ffffff]/[0.06]">
          <button type="button" onClick={handleChangePassword} disabled={pwLoading || !currentPw || !newPw || !confirmPw} className={BTN_PRIMARY}>
            {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : pwSaved ? <><Check className="w-4 h-4 inline mr-1" /> Updated</> : 'Update Password'}
          </button>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className={`${CARD} p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-medium text-[#fafafa] mb-1">Two-Factor Authentication</h3>
            <p className="text-sm text-[#525252]">Add an extra layer of security by requiring a verification code from your authenticator app.</p>
          </div>
          <div className="shrink-0 mt-1">
            {twoFaEnabled ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">Enabled</span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">Not Enabled</span>
            )}
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-[#ffffff]/[0.06] flex flex-col gap-4">
          {setupStep === 'idle' && !twoFaEnabled && (
            <>
              <div className="flex items-start gap-4 p-4 rounded-xl bg-[#ffffff]/[0.02] border border-[#ffffff]/[0.06]">
                <Smartphone className="w-5 h-5 text-[#737373] shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-sm text-[#fafafa] font-medium">Authenticator App</p>
                  <p className="text-xs text-[#525252] mt-1">Use an app like Google Authenticator or Authy to generate verification codes.</p>
                </div>
              </div>
              <button type="button" onClick={handleSetup2FA} className={BTN_PRIMARY}>Enable 2FA</button>
            </>
          )}

          {setupStep === 'idle' && twoFaEnabled && (
            <>
              <div className="flex items-start gap-4 p-4 rounded-xl bg-[#10b981]/[0.04] border border-[#10b981]/20">
                <Shield className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-sm text-[#fafafa] font-medium">2FA is active</p>
                  <p className="text-xs text-[#525252] mt-1">Your account is protected with two-factor authentication via an authenticator app.</p>
                </div>
              </div>
              <button type="button" onClick={() => { setSetupStep('disabling'); setTotpCode(''); setTwoFaError('') }} className="px-5 py-2.5 rounded-xl text-sm font-medium border border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors cursor-pointer">
                Disable 2FA
              </button>
            </>
          )}

          {setupStep === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#525252]" />
            </div>
          )}

          {setupStep === 'scan' && (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-[#a6a6a6]">Scan this QR code with your authenticator app, then enter the 6-digit code to verify.</p>
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-xl">
                  <img src={qrDataUrl} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] text-[#525252] uppercase tracking-wider font-medium">Or enter this key manually</p>
                <code className="bg-[#ffffff]/[0.03] border border-[#ffffff]/10 rounded-lg px-3 py-2 text-xs text-[#fafafa] font-mono tracking-wider break-all select-all">{secret}</code>
              </div>
              <div>
                <label className={LABEL}>Verification Code</label>
                <div className="flex gap-2">
                  <input type="text" value={totpCode} onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setTwoFaError('') }} placeholder="Enter 6-digit code" maxLength={6} className={`${INPUT} flex-1 font-mono tracking-widest text-center`} autoFocus />
                  <button type="button" onClick={handleVerify2FA} disabled={twoFaLoading || totpCode.length !== 6} className={BTN_PRIMARY + ' shrink-0'}>
                    {twoFaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Enable'}
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => { setSetupStep('idle'); setTotpCode(''); setTwoFaError('') }} className="text-xs text-[#525252] hover:text-[#a6a6a6] cursor-pointer self-start">Cancel setup</button>
            </div>
          )}

          {setupStep === 'disabling' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[#a6a6a6]">Enter a code from your authenticator app to confirm disabling 2FA.</p>
              <div className="flex gap-2">
                <input type="text" value={totpCode} onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setTwoFaError('') }} placeholder="Enter 6-digit code" maxLength={6} className={`${INPUT} flex-1 font-mono tracking-widest text-center`} autoFocus />
                <button type="button" onClick={handleDisable2FA} disabled={twoFaLoading || totpCode.length !== 6} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-[#ef4444] text-white hover:bg-[#dc2626] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                  {twoFaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Disable'}
                </button>
              </div>
              <button type="button" onClick={() => { setSetupStep('idle'); setTotpCode(''); setTwoFaError('') }} className="text-xs text-[#525252] hover:text-[#a6a6a6] cursor-pointer self-start">Cancel</button>
            </div>
          )}

          {twoFaError && (
            <div className="flex items-center gap-1.5 text-xs text-[#ef4444]">
              <AlertTriangle className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              {twoFaError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FREELANCER: Wallet Tab
// ─────────────────────────────────────────────────────────────────────────────

function WalletTab({
  user, fullUser, setFullUser, setWalletAddress,
}: {
  user: { id: string; walletAddress: string | null }
  fullUser: api.User | null
  setFullUser: (u: api.User | null) => void
  setWalletAddress: (address: string) => void
}) {
  const currentWallet = fullUser?.walletAddress || user.walletAddress || ''
  const [wallet, setWallet] = useState(currentWallet)
  const [walletError, setWalletError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isValid = !wallet || /^0x[a-fA-F0-9]{40}$/.test(wallet)
  const hasChanged = wallet.toLowerCase() !== (currentWallet || '').toLowerCase()

  const handleSave = async () => {
    if (!isValid || !hasChanged) return
    setSaving(true)
    setSaved(false)
    setWalletError('')
    try {
      const updated = await api.updateUser(user.id, { walletAddress: wallet.toLowerCase() } as any)
      setFullUser(updated)
      setWalletAddress(wallet)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setWalletError(err?.message || 'Failed to save wallet address')
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-8">
      <div className={`${CARD} p-6`}>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.08] flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-[#fafafa]" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-base font-medium text-[#fafafa]">ETH Wallet Address</h3>
            <p className="text-sm text-[#525252] mt-0.5">Your wallet address for receiving escrow payments from clients.</p>
          </div>
        </div>

        <div>
          <label className={LABEL}>
            <span className="flex items-center gap-1.5"><Wallet className="w-3 h-3" strokeWidth={1.5} /> Wallet Address</span>
          </label>
          <input
            type="text"
            value={wallet}
            onChange={(e) => {
              const v = e.target.value
              setWallet(v)
              setWalletError(v && !/^0x[a-fA-F0-9]{40}$/.test(v) ? 'Please enter a valid Ethereum address (0x...)' : '')
            }}
            placeholder="0x..."
            className={`${INPUT} font-mono`}
          />
          {walletError && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[#ef4444]">
              <AlertTriangle className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              {walletError}
            </div>
          )}
          {!walletError && wallet && isValid && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[#10b981]">
              <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              Valid Ethereum address
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-[#ffffff]/[0.06]">
          <button type="button" onClick={handleSave} disabled={saving || !hasChanged || !isValid || !wallet} className={BTN_PRIMARY}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4 inline mr-1" /> Saved</> : 'Save Wallet'}
          </button>
          {currentWallet && !hasChanged && (
            <span className="text-xs text-[#525252]">Wallet is up to date</span>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className={`${CARD} p-6`}>
        <h3 className="text-base font-medium text-[#fafafa] mb-4">How Escrow Works</h3>
        <div className="flex flex-col gap-4">
          {[
            { icon: Shield, title: 'Secure Smart Contracts', desc: `Funds are held in audited smart contracts on ${import.meta.env.VITE_NETWORK_NAME || 'Ethereum'}.` },
            { icon: CreditCard, title: 'USDC & USDT', desc: 'We support stablecoin payments \u2014 no volatile crypto.' },
            { icon: Clock, title: 'Auto-Release', desc: 'If the client doesn\'t respond after work is submitted, funds auto-release to you.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-3 rounded-xl bg-[#ffffff]/[0.02]">
              <Icon className="w-4 h-4 text-[#737373] mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-sm text-[#fafafa] font-medium">{title}</p>
                <p className="text-xs text-[#525252] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT: Billing & Payments Tab
// ─────────────────────────────────────────────────────────────────────────────

function BillingTab({
  user, fullUser, setFullUser, setWalletAddress,
}: {
  user: { id: string; walletAddress: string | null }
  fullUser: api.User | null
  setFullUser: (u: api.User | null) => void
  setWalletAddress: (address: string) => void
}) {
  const currentWallet = fullUser?.walletAddress || user.walletAddress || ''
  const [wallet, setWallet] = useState(currentWallet)
  const [walletError, setWalletError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [defaultToken, setDefaultToken] = useState('USDC')

  const isValid = !wallet || /^0x[a-fA-F0-9]{40}$/.test(wallet)
  const hasChanged = wallet.toLowerCase() !== (currentWallet || '').toLowerCase()

  const handleSave = async () => {
    if (!isValid || !hasChanged) return
    setSaving(true)
    setSaved(false)
    setWalletError('')
    try {
      const updated = await api.updateUser(user.id, { walletAddress: wallet.toLowerCase() } as any)
      setFullUser(updated)
      setWalletAddress(wallet)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setWalletError(err?.message || 'Failed to save wallet address')
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Wallet Address */}
      <div className={`${CARD} p-6`}>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.08] flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-[#fafafa]" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-base font-medium text-[#fafafa]">Payment Wallet</h3>
            <p className="text-sm text-[#525252] mt-0.5">Your wallet address for funding escrow contracts and paying freelancers.</p>
          </div>
        </div>

        <div>
          <label className={LABEL}>
            <span className="flex items-center gap-1.5"><Wallet className="w-3 h-3" strokeWidth={1.5} /> ETH Wallet Address</span>
          </label>
          <input
            type="text"
            value={wallet}
            onChange={(e) => {
              const v = e.target.value
              setWallet(v)
              setWalletError(v && !/^0x[a-fA-F0-9]{40}$/.test(v) ? 'Please enter a valid Ethereum address (0x...)' : '')
            }}
            placeholder="0x..."
            className={`${INPUT} font-mono`}
          />
          {walletError && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[#ef4444]">
              <AlertTriangle className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              {walletError}
            </div>
          )}
          {!walletError && wallet && isValid && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[#10b981]">
              <Check className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              Valid Ethereum address
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-[#ffffff]/[0.06]">
          <button type="button" onClick={handleSave} disabled={saving || !hasChanged || !isValid || !wallet} className={BTN_PRIMARY}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4 inline mr-1" /> Saved</> : 'Save Wallet'}
          </button>
          {currentWallet && !hasChanged && (
            <span className="text-xs text-[#525252]">Wallet is up to date</span>
          )}
        </div>
      </div>

      {/* Default Token */}
      <div className={`${CARD} p-6`}>
        <h3 className="text-base font-medium text-[#fafafa] mb-1">Default Payment Token</h3>
        <p className="text-sm text-[#525252] mb-5">Choose your preferred stablecoin for new escrow contracts.</p>

        <div className="flex gap-3">
          {(['USDC', 'USDT'] as const).map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => setDefaultToken(token)}
              className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                defaultToken === token
                  ? 'border-[#e5e5e5]/30 bg-[#ffffff]/[0.06]'
                  : 'border-[#ffffff]/[0.08] bg-[#ffffff]/[0.02] hover:bg-[#ffffff]/[0.04]'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                token === 'USDC' ? 'bg-[#2775ca]/20 text-[#2775ca]' : 'bg-[#26a17b]/20 text-[#26a17b]'
              }`}>
                $
              </div>
              <div className="text-left">
                <p className={`text-sm font-medium ${defaultToken === token ? 'text-[#fafafa]' : 'text-[#a6a6a6]'}`}>{token}</p>
                <p className="text-[11px] text-[#525252]">{token === 'USDC' ? 'USD Coin' : 'Tether USD'}</p>
              </div>
              {defaultToken === token && (
                <Check className="w-4 h-4 text-[#e5e5e5] ml-auto" strokeWidth={2} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className={`${CARD} p-6`}>
        <h3 className="text-base font-medium text-[#fafafa] mb-4">How Escrow Payments Work</h3>
        <div className="flex flex-col gap-4">
          {[
            { icon: CreditCard, title: 'Fund with Stablecoins', desc: 'Deposit USDC or USDT into a smart contract when you create a project escrow.' },
            { icon: Shield, title: 'Milestone-Based Release', desc: 'Funds release to the freelancer only when you approve each milestone.' },
            { icon: Clock, title: 'Auto-Release Protection', desc: 'If you don\'t respond within the timeout period, funds auto-release to protect freelancers.' },
            { icon: AlertTriangle, title: 'Dispute Resolution', desc: 'Raise a dispute if work doesn\'t meet requirements. A mediator splits funds fairly.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-3 rounded-xl bg-[#ffffff]/[0.02]">
              <Icon className="w-4 h-4 text-[#737373] mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-sm text-[#fafafa] font-medium">{title}</p>
                <p className="text-xs text-[#525252] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
