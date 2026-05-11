import { useEffect, useState, useCallback } from 'react'
import { useSocket } from './useSocket'
import type { NegotiationMessageInfo } from '@/lib/api'

export function useNegotiation(negotiationId: string | null) {
  const socketRef = useSocket()
  const [botTyping, setBotTyping] = useState(false)

  // Join/leave negotiation room
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !negotiationId) return

    socket.emit('negotiation:join', negotiationId)
    return () => {
      socket.emit('negotiation:leave', negotiationId)
    }
  }, [negotiationId, socketRef])

  // Bot typing indicator
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !negotiationId) return

    const handler = ({ typing }: { typing: boolean }) => {
      setBotTyping(typing)
    }

    socket.on('negotiation:typing', handler)
    return () => {
      socket.off('negotiation:typing', handler)
      setBotTyping(false)
    }
  }, [negotiationId, socketRef])

  // Listen for new messages
  const onNewMessage = useCallback(
    (handler: (msg: NegotiationMessageInfo) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on('negotiation:new-message', handler)
      return () => {
        socket.off('negotiation:new-message', handler)
      }
    },
    [socketRef]
  )

  // Listen for status changes
  const onStatusChanged = useCallback(
    (handler: (data: { negotiationId: string; status: string; finalRate?: number }) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on('negotiation:status-changed', handler)
      return () => {
        socket.off('negotiation:status-changed', handler)
      }
    },
    [socketRef]
  )

  // Listen for new negotiations (sidebar refresh)
  const onNewNegotiation = useCallback(
    (handler: (data: { negotiationId: string }) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on('negotiation:new', handler)
      return () => {
        socket.off('negotiation:new', handler)
      }
    },
    [socketRef]
  )

  // Send message via socket
  const sendMessage = useCallback(
    (content: string) => {
      const socket = socketRef.current
      if (!socket || !negotiationId) return
      socket.emit('negotiation:send-message', { negotiationId, content })
    },
    [negotiationId, socketRef]
  )

  return { sendMessage, onNewMessage, onStatusChanged, onNewNegotiation, botTyping }
}
