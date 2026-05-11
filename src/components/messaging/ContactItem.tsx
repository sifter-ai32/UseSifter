import { CheckCheck } from 'lucide-react'

export interface Contact {
  id: string
  userId?: string
  initials: string
  name: string
  avatar?: string | null
  lastMessage: string
  time: string
  unread?: number
  online?: boolean
  read?: boolean
}

interface ContactItemProps {
  contact: Contact
  isActive: boolean
  onClick: () => void
}

export default function ContactItem({ contact, isActive, onClick }: ContactItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors w-full text-left',
        isActive ? 'bg-[#ffffff]/10 border border-[#ffffff]/5' : 'hover:bg-[#ffffff]/5 group border border-transparent',
      ].join(' ')}
    >
      <div className="relative">
        {contact.avatar ? (
          <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#ffffff]/10 border border-[#ffffff]/5 flex items-center justify-center text-[#fafafa] text-sm">
            {contact.initials}
          </div>
        )}
        {contact.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#fafafa] rounded-full border-2 border-[#000000]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <h3 className="text-sm font-normal text-[#fafafa] truncate">{contact.name}</h3>
          <span className={`text-xs shrink-0 ml-2 ${isActive ? 'text-[#fafafa]' : 'text-[#737373]'}`}>{contact.time}</span>
        </div>
        <p className={`text-xs truncate transition-colors ${isActive ? 'text-[#fafafa]' : 'text-[#a6a6a6] group-hover:text-[#fafafa]'}`}>{contact.lastMessage}</p>
      </div>
      {contact.unread && !isActive && (
        <div className="w-5 h-5 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[10px] text-[#fafafa] font-normal border border-[#ffffff]/20 shrink-0">{contact.unread}</div>
      )}
      {contact.read && !isActive && <CheckCheck className="w-3.5 h-3.5 text-[#737373] shrink-0" strokeWidth={1.5} />}
    </button>
  )
}
