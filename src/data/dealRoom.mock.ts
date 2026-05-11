import type { DealRoomRoom, DealRoomMember, DealRoomChatMessage } from '@/types/dealRoom'

export const MOCK_ROOMS: DealRoomRoom[] = [
  { id: '1', initials: 'ER', name: 'E-Commerce Redesign', lastMessage: 'Darlene: Looking forward to start!', time: '12:15pm', online: true },
  { id: '2', initials: 'MA', name: 'Mobile App Dev', lastMessage: 'Robert: Here are the wireframes...', time: '15min ago', unread: 3 },
]

export const MOCK_MEMBERS: DealRoomMember[] = [
  { initials: 'C', name: 'Cynthia', role: 'Owner' },
  { initials: 'DR', name: 'Darlene Robertson', role: 'Freelancer' },
  { initials: 'RS', name: 'Robert Smith', role: 'Designer' },
]

export const MOCK_MESSAGES: DealRoomChatMessage[] = [
  { id: '1', sender: 'You', senderInitials: 'C', role: 'Owner', content: 'Hello everyone! Looking forward to starting the E-commerce redesign.', time: 'Friday 2:20pm', isMe: true },
  { id: '2', sender: 'Darlene Robertson', senderInitials: 'DR', role: 'Freelancer', content: "Hey Cynthia! I've prepared the initial wireframes. Ready when you are.", time: 'Friday 2:21pm', isMe: false },
  { id: '3', sender: 'Robert Smith', senderInitials: 'RS', role: 'Designer', content: 'I have the assets folder ready to share as well.', time: 'Friday 2:22pm', isMe: false },
  { id: '4', sender: 'You', senderInitials: 'C', role: 'Owner', content: 'Sounds perfect! Let me configure the escrow so we can officially begin Phase 1.', time: 'Friday 2:25pm', isMe: true },
]
