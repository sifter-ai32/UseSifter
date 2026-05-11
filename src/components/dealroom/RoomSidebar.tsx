import SearchInput from '@/components/ui/SearchInput'
import RoomItem from './RoomItem'
import type { DealRoomRoom } from '@/types/dealRoom'

interface RoomSidebarProps {
  rooms: DealRoomRoom[]
  activeRoomId: string
  onSelectRoom: (id: string) => void
}

export default function RoomSidebar({ rooms, activeRoomId, onSelectRoom }: RoomSidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-80 lg:w-96 border-r border-[#ffffff]/10 bg-[#000000]">
      <div className="p-5 flex items-center justify-between">
        <h1 className="text-xl tracking-tight text-[#fafafa] font-normal">Deal Rooms</h1>
      </div>
      <div className="px-5 pb-4">
        <SearchInput placeholder="Search Rooms" />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {rooms.map((room) => (
          <RoomItem
            key={room.id}
            room={room}
            isActive={room.id === activeRoomId}
            onClick={() => onSelectRoom(room.id)}
          />
        ))}
      </div>
    </aside>
  )
}
