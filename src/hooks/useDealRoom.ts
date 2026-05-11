import { useEffect, useState, useCallback, useRef } from 'react'
import { useSocket } from './useSocket'

interface Message {
  id: string
  content: string
  fileUrl?: string | null
  fileType?: string | null
  fileName?: string | null
  createdAt: string
  sender: { id: string; name: string; avatar?: string | null }
}

export function useDealRoom(dealRoomId: string | null) {
  const socketRef = useSocket()
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Join/leave room
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !dealRoomId) return

    socket.emit('join-room', dealRoomId)
    return () => {
      socket.emit('leave-room', dealRoomId)
    }
  }, [dealRoomId, socketRef])

  // Listen for typing indicators
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !dealRoomId) return

    const handleTypingStart = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => new Set(prev).add(userId))
      const existing = typingTimeouts.current.get(userId)
      if (existing) clearTimeout(existing)
      typingTimeouts.current.set(
        userId,
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev)
            next.delete(userId)
            return next
          })
        }, 3000)
      )
    }

    const handleTypingStop = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
      const existing = typingTimeouts.current.get(userId)
      if (existing) clearTimeout(existing)
    }

    socket.on('typing-start', handleTypingStart)
    socket.on('typing-stop', handleTypingStop)
    return () => {
      socket.off('typing-start', handleTypingStart)
      socket.off('typing-stop', handleTypingStop)
    }
  }, [dealRoomId, socketRef])

  // Subscribe to new messages
  const onNewMessage = useCallback(
    (handler: (msg: Message) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on('new-message', handler)
      return () => {
        socket.off('new-message', handler)
      }
    },
    [socketRef]
  )

  // Subscribe to message updates (e.g. invitation status changes)
  const onMessageUpdated = useCallback(
    (handler: (msg: Message) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on('message-updated', handler)
      return () => {
        socket.off('message-updated', handler)
      }
    },
    [socketRef]
  )

  // Send message via socket
  const sendMessage = useCallback(
    (content: string, attachment?: { fileUrl: string; fileType: string; fileName: string }) => {
      const socket = socketRef.current
      if (!socket || !dealRoomId) return
      socket.emit('send-message', { dealRoomId, content, ...attachment })
    },
    [dealRoomId, socketRef]
  )

  // Typing indicators
  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const socket = socketRef.current
      if (!socket || !dealRoomId) return
      socket.emit(isTyping ? 'typing-start' : 'typing-stop', dealRoomId)
    },
    [dealRoomId, socketRef]
  )

  return { sendMessage, emitTyping, typingUsers, onNewMessage, onMessageUpdated }
}
