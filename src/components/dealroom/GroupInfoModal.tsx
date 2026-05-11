import { Archive, ArchiveRestore, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import type { DealRoomMember } from '@/types/dealRoom'

interface GroupInfoModalProps {
  open: boolean
  onClose: () => void
  name: string
  initials: string
  description: string
  members: DealRoomMember[]
  isCreator?: boolean
  isArchived?: boolean
  isArchiving?: boolean
  onArchiveToggle?: () => void
}

export default function GroupInfoModal({ open, onClose, name, initials, description, members, isCreator, isArchived, isArchiving, onArchiveToggle }: GroupInfoModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-8 pb-6 flex flex-col items-center text-center border-b border-[#ffffff]/10">
        <div className="mb-4 shrink-0">
          <div className="w-16 h-16 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] text-lg">{initials}</div>
        </div>
        <h2 className="text-xl tracking-tight text-[#fafafa] font-normal mb-2">{name}</h2>
        <p className="text-sm text-[#a6a6a6] leading-relaxed">{description}</p>
      </div>
      <div className="p-6">
        <h3 className="text-sm font-normal text-[#fafafa] tracking-wide mb-4 uppercase">Members ({members.length})</h3>
        <div className="space-y-4">
          {members.map((m) => (
            <div key={m.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] text-xs">{m.initials}</div>
                <span className="text-sm text-[#fafafa] font-normal">{m.name}</span>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded ${m.role === 'Owner' ? 'border border-[#ffffff]/20 bg-[#ffffff]/5 text-[#fafafa]' : 'border border-transparent text-[#a6a6a6]'}`}>
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>
      {isCreator && onArchiveToggle && (
        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onArchiveToggle}
            disabled={isArchiving}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-normal cursor-pointer transition-colors disabled:opacity-50 ${
              isArchived
                ? 'border border-[#ffffff]/15 bg-[#ffffff]/5 text-[#fafafa] hover:bg-[#ffffff]/10'
                : 'border border-[#ffffff]/15 bg-[#ffffff]/5 text-[#a6a6a6] hover:bg-[#ffffff]/10 hover:text-[#fafafa]'
            }`}
          >
            {isArchiving ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
            ) : isArchived ? (
              <><ArchiveRestore className="w-4 h-4" strokeWidth={1.5} /><span>Unarchive Deal Room</span></>
            ) : (
              <><Archive className="w-4 h-4" strokeWidth={1.5} /><span>Archive Deal Room</span></>
            )}
          </button>
        </div>
      )}
    </Modal>
  )
}
