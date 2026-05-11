import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Handshake, AlertCircle, Users } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { validateInviteLink, joinViaInviteLink } from '@/lib/api'

export default function JoinWorkspacePage() {
  const { token } = useParams<{ token: string }>()
  const user = useAuthStore((s) => s.user)
  const userType = useAuthStore((s) => s.userType)
  const navigate = useNavigate()

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'joining' | 'error'>('loading')
  const [workspace, setWorkspace] = useState<{ id: string; name: string; description: string | null; memberCount: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    validateInviteLink(token).then((res) => {
      if (res.valid && res.workspace) {
        setWorkspace(res.workspace)
        setStatus('valid')
      } else {
        setErrorMsg(res.expired ? 'This invite link has expired.' : res.exhausted ? 'This invite link has reached its usage limit.' : 'Invalid invite link.')
        setStatus('invalid')
      }
    }).catch(() => {
      setErrorMsg('Failed to validate invite link.')
      setStatus('invalid')
    })
  }, [token])

  const handleJoin = async () => {
    if (!token || !user) return
    setStatus('joining')
    try {
      const result = await joinViaInviteLink(token, user.id)
      const dealRoomPath = userType === 'client' ? '/dealroom' : '/freelancer/dealroom'
      navigate(`${dealRoomPath}/${result.workspace.id}`)
    } catch {
      setErrorMsg('Failed to join. Please try again.')
      setStatus('error')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-sm text-[#a6a6a6] mb-4">You need to be logged in to join a Deal Room.</p>
          <button type="button" onClick={() => { sessionStorage.setItem('sifter-invite-redirect', `/join/${token}`); navigate('/') }} className="bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors px-6 py-2.5 rounded-lg text-sm font-normal cursor-pointer">
            Log In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {(status === 'loading') && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#a6a6a6]" strokeWidth={1.5} />
            <p className="text-sm text-[#a6a6a6]">Validating invite link...</p>
          </div>
        )}

        {(status === 'invalid' || status === 'error') && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-[#ef4444]" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-[#a6a6a6]">{errorMsg}</p>
            <button type="button" onClick={() => navigate(userType === 'client' ? '/dealrooms' : '/freelancer/dealrooms')} className="border border-[#ffffff]/15 bg-[#ffffff]/5 text-[#fafafa] hover:bg-[#ffffff]/10 transition-colors px-6 py-2.5 rounded-lg text-sm font-normal cursor-pointer">
              Go to Messages
            </button>
          </div>
        )}

        {(status === 'valid' || status === 'joining') && workspace && (
          <div className="border border-[#ffffff]/10 bg-[#ffffff]/[0.02] rounded-2xl p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#ffffff]/10 border border-[#ffffff]/10 flex items-center justify-center mb-5">
              <Handshake className="w-8 h-8 text-[#fafafa]" strokeWidth={1.5} />
            </div>
            <h1 className="text-xl font-normal text-[#fafafa] mb-1">{workspace.name}</h1>
            {workspace.description && <p className="text-sm text-[#a6a6a6] mb-3">{workspace.description}</p>}
            <div className="flex items-center gap-1.5 text-xs text-[#737373] mb-6">
              <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{workspace.memberCount} member{workspace.memberCount !== 1 ? 's' : ''}</span>
            </div>
            <button
              type="button"
              onClick={handleJoin}
              disabled={status === 'joining'}
              className="w-full bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === 'joining' ? (
                <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> Joining...</>
              ) : (
                <><Handshake className="w-4 h-4" strokeWidth={1.5} /> Join Deal Room</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
