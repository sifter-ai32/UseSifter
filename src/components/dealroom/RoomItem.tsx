import type { DealRoomRoom } from '@/types/dealRoom'

interface RoomItemProps {
  room: DealRoomRoom
  isActive: boolean
  onClick: () => void
}

export default function RoomItem({ room, isActive, onClick }: RoomItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors w-full text-left',
        isActive ? 'bg-[#ffffff]/10 border border-[#ffffff]/5' : 'hover:bg-[#ffffff]/5 group border border-transparent',
      ].join(' ')}
    >
      <div className="relative flex shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] text-xs">
          {room.initials}
        </div>
        {room.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#fafafa] rounded-full border-2 border-[#000000] z-10" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <h3 className="text-sm font-normal text-[#fafafa] truncate">{room.name}</h3>
          <span className={`text-xs shrink-0 ml-2 ${isActive ? 'text-[#fafafa]' : 'text-[#737373]'}`}>{room.time}</span>
        </div>
        <p className={`text-xs truncate transition-colors ${isActive ? 'text-[#fafafa]' : 'text-[#a6a6a6] group-hover:text-[#fafafa]'}`}>{room.lastMessage}</p>
      </div>
      {room.unread && !isActive && (
        <div className="w-5 h-5 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[10px] text-[#fafafa] font-normal border border-[#ffffff]/20 shrink-0">{room.unread}</div>
      )}
    </button>
  )
}
