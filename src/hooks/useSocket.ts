import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/authStore'

let globalSocket: Socket | null = null

export function getSocket(): Socket | null {
  return globalSocket
}

export function useSocket() {
  const user = useAuthStore((s) => s.user)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!user?.id) return

    if (globalSocket?.connected) {
      socketRef.current = globalSocket
      return
    }

    const socket = io(import.meta.env.VITE_API_URL || undefined, {
      auth: { userId: user.id },
      transports: ['websocket', 'polling'],
    })

    globalSocket = socket
    socketRef.current = socket

    return () => {
      // Don't disconnect — singleton stays alive across navigations.
      // Disconnect happens on logout via getSocket().disconnect()
    }
  }, [user?.id])

  return socketRef
}

// Track which users are currently online
export function useOnlineUsers() {
  const socketRef = useSocket()
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const handleOnlineUsers = (userIds: string[]) => {
      setOnlineUsers(new Set(userIds))
    }

    const handleUserOnline = ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev)
        next.add(userId)
        return next
      })
    }

    const handleUserOffline = ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }

    socket.on('online-users', handleOnlineUsers)
    socket.on('user-online', handleUserOnline)
    socket.on('user-offline', handleUserOffline)

    return () => {
      socket.off('online-users', handleOnlineUsers)
      socket.off('user-online', handleUserOnline)
      socket.off('user-offline', handleUserOffline)
    }
  }, [socketRef])

  const isOnline = useCallback((userId: string) => onlineUsers.has(userId), [onlineUsers])

  return { onlineUsers, isOnline }
}
