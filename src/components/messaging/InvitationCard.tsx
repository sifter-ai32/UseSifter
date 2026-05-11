import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Handshake, Check, Loader2 } from 'lucide-react'
import { acceptWorkspaceInvite, type Message } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { formatTime } from '@/lib/utils'

interface InvitationCardProps {
  message: Message
  onStatusUpdate?: (updatedMessage: Message) => void
}

export default function InvitationCard({ message, onStatusUpdate }: InvitationCardProps) {
  const user = useAuthStore((s) => s.user)
  const userType = useAuthStore((s) => s.userType)
  const navigate = useNavigate()
  const [isAccepting, setIsAccepting] = useState(false)

  const meta = message.metadata
  const status = meta?.status || 'pending'
  const workspaceName = meta?.workspaceName || 'Deal Room'
  const workspaceId = meta?.workspaceId
  const isFromMe = message.sender.id === user?.id
  const dealRoomPath = userType === 'client' ? '/dealroom' : '/freelancer/dealroom'

  const handleAccept = async () => {
    if (!user) return
    setIsAccepting(true)
    try {
      const result = await acceptWorkspaceInvite(user.id, message.id)
      const newWorkspaceId = result.workspace.id
      onStatusUpdate?.({ ...message, metadata: { ...meta, workspaceId: newWorkspaceId, status: 'accepted' } })
      navigate(`${dealRoomPath}/${newWorkspaceId}`)
    } catch {
      setIsAccepting(false)
    }
  }

  const handleGoToDealRoom = () => {
    if (workspaceId) navigate(`${dealRoomPath}/${workspaceId}`)
  }

  return (
    <div className={`flex gap-3 ${isFromMe ? 'justify-end' : ''} items-end`}>
      {!isFromMe && (
        <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] shrink-0 text-xs hidden sm:flex">
          {message.sender.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
      )}
      <div className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'} gap-1 max-w-[85%] sm:max-w-[70%]`}>
        <div className="border border-[#ffffff]/15 bg-[#ffffff]/[0.03] rounded-2xl p-4 w-full">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#ffffff]/10 flex items-center justify-center shrink-0">
              <Handshake className="w-5 h-5 text-[#fafafa]" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#fafafa] font-normal">Deal Room Invitation</p>
              <p className="text-xs text-[#a6a6a6] truncate">{workspaceName}</p>
            </div>
          </div>
          <p className="text-sm text-[#a6a6a6] mb-4">
            {isFromMe
              ? `You invited them to join "${workspaceName}"`
              : `${message.sender.name} invited you to join "${workspaceName}"`}
          </p>

          {status === 'pending' && !isFromMe && (
            <button
              type="button"
              onClick={handleAccept}
              disabled={isAccepting}
              className="w-full bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2 rounded-lg text-sm font-normal cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAccepting ? (
                <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> Joining...</>
              ) : (
                <><Handshake className="w-4 h-4" strokeWidth={1.5} /> Accept & Join</>
              )}
            </button>
          )}

          {status === 'pending' && isFromMe && (
            <div className="flex items-center gap-2 text-[#737373] text-xs">
              <Loader2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Waiting for response...</span>
            </div>
          )}

          {status === 'accepted' && (
            <button
              type="button"
              onClick={handleGoToDealRoom}
              className="w-full border border-[#ffffff]/20 bg-[#ffffff]/5 text-[#fafafa] hover:bg-[#ffffff]/10 transition-colors py-2 rounded-lg text-sm font-normal cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 text-[#fafafa]" strokeWidth={2} />
              <span>Accepted — Go to Deal Room</span>
            </button>
          )}
        </div>
        <span className="text-xs text-[#737373] px-1">{formatTime(message.createdAt)}</span>
      </div>
      {isFromMe && (
        <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] shrink-0 text-xs hidden sm:flex">
          ME
        </div>
      )}
    </div>
  )
}
