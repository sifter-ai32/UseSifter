export interface DealRoomPhase {
  id: number
  name: string
  pct: number
  pctInput?: string
}

export interface DealRoomMember {
  initials: string
  name: string
  role: string
}

export interface DealRoomRoom {
  id: string
  initials: string
  name: string
  lastMessage: string
  time: string
  unread?: number
  online?: boolean
}

export interface DealRoomChatMessage {
  id: string
  sender: string
  senderInitials: string
  role: string
  content: string
  time: string
  isMe: boolean
}
