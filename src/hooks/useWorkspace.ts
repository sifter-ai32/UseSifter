import { useEffect, useState, useCallback, useRef } from 'react'
import { useSocket } from './useSocket'
import type { WorkspaceMessageInfo, WorkspaceMemberInfo } from '@/lib/api'

export function useWorkspace(workspaceId: string | null) {
  const socketRef = useSocket()
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Join/leave workspace room
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !workspaceId) return

    socket.emit('workspace:join', workspaceId)
    return () => {
      socket.emit('workspace:leave', workspaceId)
    }
  }, [workspaceId, socketRef])

  // Typing indicators
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !workspaceId) return

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

    socket.on('workspace:typing-start', handleTypingStart)
    socket.on('workspace:typing-stop', handleTypingStop)
    return () => {
      socket.off('workspace:typing-start', handleTypingStart)
      socket.off('workspace:typing-stop', handleTypingStop)
    }
  }, [workspaceId, socketRef])

  // Subscribe to new messages
  const onNewMessage = useCallback(
    (handler: (msg: WorkspaceMessageInfo) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on('workspace:new-message', handler)
      return () => {
        socket.off('workspace:new-message', handler)
      }
    },
    [socketRef]
  )

  // Subscribe to member changes
  const onMemberJoined = useCallback(
    (handler: (data: { workspaceId: string; member: WorkspaceMemberInfo }) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on('workspace:member-joined', handler)
      return () => {
        socket.off('workspace:member-joined', handler)
      }
    },
    [socketRef]
  )

  // Send message via socket
  const sendMessage = useCallback(
    (content: string, attachment?: { fileUrl: string; fileType: string; fileName: string }) => {
      const socket = socketRef.current
      if (!socket || !workspaceId) return
      socket.emit('workspace:send-message', { workspaceId, content, ...attachment })
    },
    [workspaceId, socketRef]
  )

  // Typing indicators
  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const socket = socketRef.current
      if (!socket || !workspaceId) return
      socket.emit(isTyping ? 'workspace:typing-start' : 'workspace:typing-stop', workspaceId)
    },
    [workspaceId, socketRef]
  )

  // Request freelancer to connect wallet
  const requestWallet = useCallback(
    (freelancerId: string, freelancerName: string) => {
      const socket = socketRef.current
      if (!socket || !workspaceId) return
      socket.emit('workspace:request-wallet', { workspaceId, freelancerId, freelancerName })
    },
    [workspaceId, socketRef]
  )

  // Freelancer confirms wallet connection
  const confirmWalletConnected = useCallback(
    (messageId: string, walletAddress: string) => {
      const socket = socketRef.current
      if (!socket || !workspaceId) return
      socket.emit('workspace:wallet-connected', { workspaceId, messageId, walletAddress })
    },
    [workspaceId, socketRef]
  )

  // Listen for wallet update events
  const onWalletUpdated = useCallback(
    (handler: (data: { messageId: string; userId: string; walletAddress: string }) => void) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on('workspace:wallet-updated', handler)
      return () => {
        socket.off('workspace:wallet-updated', handler)
      }
    },
    [socketRef]
  )

  return { sendMessage, emitTyping, typingUsers, onNewMessage, onMemberJoined, requestWallet, confirmWalletConnected, onWalletUpdated }
}
