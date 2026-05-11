import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, Paperclip, X, Send,
  Loader2, FileText, XCircle, Handshake,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import SearchInput from '@/components/ui/SearchInput'
import ContactItem, { type Contact } from '@/components/messaging/ContactItem'
import MessageAttachment from '@/components/messaging/MessageAttachment'
import { SidebarSkeleton, ChatAreaSkeleton } from '@/components/messaging/ChatSkeleton'
import { useAuthStore } from '@/stores/authStore'
import { getInitials, formatTime, getImageUrl } from '@/lib/utils'
import {
  listDealRooms, getDealRoomMessages, createDirectDealRoom,
  getUser, sendMessage as apiSendMessage, uploadChatFile,
  createWorkspace,
  type DealRoom, type Message as ApiMessage,
} from '@/lib/api'
import { useDealRoom } from '@/hooks/useDealRoom'
import InvitationCard from '@/components/messaging/InvitationCard'
import Modal from '@/components/ui/Modal'
import { useOnlineUsers } from '@/hooks/useSocket'

/* ─── Helpers ─── */

function toContact(room: DealRoom): Contact {
  const lastMsg = room.messages?.[0]
  const name = room.otherUser?.name || room.project?.title || 'Direct Message'
  return {
    id: room.id,
    userId: room.otherUser?.id,
    initials: getInitials(name),
    name,
    avatar: getImageUrl(room.otherUser?.avatar),
    lastMessage: lastMsg?.content || '',
    time: lastMsg ? formatTime(lastMsg.createdAt) : '',
  }
}

/* ─── Main Component ─── */

export default function DealRoomsPage() {
  const user = useAuthStore((s) => s.user)
  const userType = useAuthStore((s) => s.userType)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { isOnline } = useOnlineUsers()

  /* ── Data fetching ── */

  const { data: rooms = [], refetch: refetchRooms, isPending: roomsLoading } = useQuery({
    queryKey: ['dealrooms', user?.id],
    queryFn: () => listDealRooms(user?.id),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,   // 5 min — real-time socket handles new messages
    gcTime: 10 * 60_000,     // keep in cache 10 min
  })

  const contacts = rooms.map((room) => {
    const c = toContact(room)
    if (c.userId) c.online = isOnline(c.userId)
    return c
  })

  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const [pendingUser, setPendingUser] = useState<{ id: string; name: string; avatar?: string | null } | null>(null)

  /* ── URL param handling ── */

  useEffect(() => {
    const toParam = searchParams.get('to')
    if (!toParam) return

    const existingRoom = rooms.find(
      (r) => r.clientId === toParam || r.freelancerId === toParam ||
             (r.otherUser && r.otherUser.id === toParam)
    )
    if (existingRoom) {
      setActiveContactId(existingRoom.id)
      setPendingUser(null)
    } else {
      getUser(toParam).then((u) => {
        setPendingUser({ id: u.id, name: u.name, avatar: u.avatar ?? null })
      }).catch(() => {})
    }
    searchParams.delete('to')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, setSearchParams, rooms])

  useEffect(() => {
    const roomParam = searchParams.get('room')
    if (roomParam && contacts.some((c) => c.id === roomParam)) {
      setActiveContactId(roomParam)
      searchParams.delete('room')
      setSearchParams(searchParams, { replace: true })
    }
  }, [contacts, searchParams, setSearchParams])

  const activeId = pendingUser ? null : (activeContactId || contacts[0]?.id || null)

  const { data: apiMessages = [], isPending: messagesLoading } = useQuery({
    queryKey: ['messages', activeId],
    queryFn: () => getDealRoomMessages(activeId!),
    enabled: !!activeId,
    staleTime: 5 * 60_000,   // 5 min — real-time socket handles new messages
    gcTime: 10 * 60_000,     // keep in cache 10 min
  })

  // Prefetch messages for all contacts so switching is instant
  useEffect(() => {
    if (!rooms.length) return
    rooms.forEach((room) => {
      queryClient.prefetchQuery({
        queryKey: ['messages', room.id],
        queryFn: () => getDealRoomMessages(room.id),
        staleTime: 5 * 60_000,
      })
    })
  }, [rooms, queryClient])

  // Show skeleton until BOTH room list and first chat messages are ready
  const isFirstLoad = roomsLoading || (!!activeId && messagesLoading)

  /* ── Real-time ── */

  const { sendMessage: socketSend, emitTyping, typingUsers, onNewMessage, onMessageUpdated } = useDealRoom(activeId)

  useEffect(() => {
    return onNewMessage((msg) => {
      queryClient.setQueryData<ApiMessage[]>(['messages', activeId], (old) => {
        if (!old) return [msg]
        if (old.some((m) => m.id === msg.id)) return old
        let replaced = false
        const filtered = old.filter((m) => {
          if (!replaced && m.id.startsWith('temp-') && m.sender.id === msg.sender.id) {
            replaced = true
            return false
          }
          return true
        })
        return [...filtered, msg]
      })
    })
  }, [activeId, onNewMessage, queryClient])

  // Real-time invitation status updates
  useEffect(() => {
    return onMessageUpdated((updatedMsg) => {
      queryClient.setQueryData<ApiMessage[]>(['messages', activeId], (old) =>
        old?.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
      )
    })
  }, [activeId, onMessageUpdated, queryClient])

  const handleInvitationStatusUpdate = useCallback((updatedMsg: ApiMessage) => {
    queryClient.setQueryData<ApiMessage[]>(['messages', activeId], (old) =>
      old?.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
    )
  }, [activeId, queryClient])

  /* ── Local state ── */

  const [isCreatingDealRoom, setIsCreatingDealRoom] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [mobileInboxOpen, setMobileInboxOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const typingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const pendingContact: Contact | null = pendingUser
    ? { id: pendingUser.id, userId: pendingUser.id, initials: getInitials(pendingUser.name), name: pendingUser.name, avatar: getImageUrl(pendingUser.avatar), lastMessage: '', time: '' }
    : null
  const activeContact = pendingContact || contacts.find((c) => c.id === activeId) || contacts[0]

  /* ── Auto-scroll on new messages ── */

  const prevMsgCountRef = useRef(0)
  useEffect(() => {
    if (prevMsgCountRef.current > 0 && apiMessages.length > prevMsgCountRef.current) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMsgCountRef.current = apiMessages.length
  }, [apiMessages.length])

  /* ── File handling ── */

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size must be under 10MB')
      setTimeout(() => setFileError(null), 4000)
      return
    }
    setPendingFile(file)
    if (file.type.startsWith('image/')) {
      setPendingFilePreview(URL.createObjectURL(file))
    } else {
      setPendingFilePreview(null)
    }
    e.target.value = ''
    textInputRef.current?.focus()
  }, [])

  const clearPendingFile = useCallback(() => {
    if (pendingFilePreview) URL.revokeObjectURL(pendingFilePreview)
    setPendingFile(null)
    setPendingFilePreview(null)
  }, [pendingFilePreview])

  /* ── Send message ── */

  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if (!text && !pendingFile) return
    if (!user) return

    if (pendingUser) {
      setInputText('')
      setPendingFile(null)
      setPendingFilePreview(null)
      try {
        const room = await createDirectDealRoom(user.id, pendingUser.id)
        let attachment: { fileUrl: string; fileType: string; fileName: string } | undefined
        if (pendingFile) {
          setIsUploading(true)
          const uploaded = await uploadChatFile(room.id, pendingFile)
          attachment = { fileUrl: uploaded.url, fileType: uploaded.fileType, fileName: uploaded.fileName }
          setIsUploading(false)
        }
        await apiSendMessage(room.id, text || '', user.id, attachment)
        setPendingUser(null)
        setActiveContactId(room.id)
        await refetchRooms()
        queryClient.invalidateQueries({ queryKey: ['messages', room.id] })
      } catch { setIsUploading(false) }
      return
    }

    const fileToSend = pendingFile
    const messageText = text || ''

    const optimisticMsg: ApiMessage = {
      id: `temp-${Date.now()}`,
      content: messageText,
      fileUrl: fileToSend ? (fileToSend.type.startsWith('image/') ? pendingFilePreview : 'pending') : null,
      fileType: fileToSend ? (fileToSend.type.startsWith('image/') ? 'image' : fileToSend.type === 'application/pdf' ? 'pdf' : 'file') : null,
      fileName: fileToSend?.name || null,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, name: user.name, avatar: user.avatar ?? null },
    }
    queryClient.setQueryData<ApiMessage[]>(['messages', activeId], (old) =>
      old ? [...old, optimisticMsg] : [optimisticMsg]
    )

    setInputText('')
    setPendingFile(null)
    setPendingFilePreview(null)
    if (typingRef.current) {
      emitTyping(false)
      typingRef.current = false
    }

    if (fileToSend && activeId) {
      setIsUploading(true)
      try {
        const uploaded = await uploadChatFile(activeId, fileToSend)
        socketSend(messageText, { fileUrl: uploaded.url, fileType: uploaded.fileType, fileName: uploaded.fileName })
      } catch {
        socketSend(messageText)
      } finally {
        setIsUploading(false)
      }
    } else {
      socketSend(messageText)
    }
  }, [inputText, pendingFile, pendingFilePreview, user, pendingUser, activeId, socketSend, emitTyping, refetchRooms, queryClient])

  /* ── Typing indicators ── */

  const handleInputChange = useCallback((value: string) => {
    setInputText(value)
    if (value && !typingRef.current) {
      emitTyping(true)
      typingRef.current = true
    } else if (!value && typingRef.current) {
      emitTyping(false)
      typingRef.current = false
    }
  }, [emitTyping])

  const othersTyping = user ? [...typingUsers].filter((id) => id !== user.id) : []

  /* ─── Render ─── */

  return (
    <div className="bg-[#000000] text-[#fafafa] antialiased h-screen overflow-hidden flex flex-col font-light">
      <Header />

      <main className="flex flex-1 pt-16 h-full w-full max-w-[1600px] mx-auto">
        {/* Sidebar — only skeleton on very first load */}
        {isFirstLoad ? (
          <aside className="hidden md:flex flex-col w-80 lg:w-96 border-r border-[#ffffff]/10 bg-[#000000]">
            <div className="p-5"><div className="h-6 bg-[#ffffff]/10 rounded w-16 animate-pulse" /></div>
            <div className="px-5 pb-4"><div className="h-9 bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-lg animate-pulse" /></div>
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1"><SidebarSkeleton /></div>
          </aside>
        ) : (
          <aside className="hidden md:flex flex-col w-80 lg:w-96 border-r border-[#ffffff]/10 bg-[#000000]">
            <div className="p-5 flex items-center justify-between">
              <h1 className="text-xl tracking-tight text-[#fafafa] font-normal">Inbox</h1>
            </div>
            <div className="px-5 pb-4">
              <SearchInput />
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1">
              {contacts.map((contact) => (
                <ContactItem
                  key={contact.id}
                  contact={contact}
                  isActive={contact.id === activeId}
                  onClick={() => setActiveContactId(contact.id)}
                />
              ))}
            </div>
          </aside>
        )}

        {/* Chat Area — skeleton only when no cached messages for this chat */}
        {isFirstLoad ? (
          <section className="flex-1 flex flex-col relative bg-[#000000]"><ChatAreaSkeleton /></section>
        ) : (
          <section className="flex-1 flex flex-col relative bg-[#000000]">
            {!activeContact ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm text-[#737373]">No messages yet</span>
              </div>
            ) : (<>
                {/* Chat Header */}
                <header className="h-[72px] border-b border-[#ffffff]/10 flex items-center justify-between px-6 shrink-0">
                  <div className="flex items-center gap-4">
                    <button type="button" className="md:hidden text-[#a6a6a6] hover:text-[#fafafa] cursor-pointer" onClick={() => setMobileInboxOpen(true)}>
                      <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                    {activeContact.avatar ? (
                      <img
                        src={activeContact.avatar}
                        alt={activeContact.name}
                        onClick={() => navigate(`/profile/${activeContact.userId || activeContact.id}`)}
                        className="w-10 h-10 rounded-full object-cover shrink-0 hidden sm:block cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/profile/${activeContact.userId || activeContact.id}`)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[#fafafa] text-sm hidden sm:flex cursor-pointer hover:opacity-80 transition-opacity bg-[#ffffff]/10"
                      >
                        {activeContact.initials}
                      </button>
                    )}
                    <div>
                      <button type="button" onClick={() => navigate(`/profile/${activeContact.userId || activeContact.id}`)} className="text-base font-normal text-[#fafafa] hover:text-[#a6a6a6] transition-colors cursor-pointer">
                        {activeContact.name}
                      </button>
                      {activeContact.online && <span className="text-xs text-[#a6a6a6]">Online</span>}
                    </div>
                  </div>
                  {userType === 'client' && activeContact && activeId && !pendingUser && (
                    <div className="flex items-center gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setNewRoomName(`Deal Room with ${activeContact.name}`)
                          setShowCreateModal(true)
                        }}
                        className="flex items-center gap-2 transition-colors px-4 py-2 rounded-lg text-sm font-normal cursor-pointer bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6]"
                      >
                        <Handshake className="w-4 h-4" strokeWidth={1.5} /><span>Start Deal Room</span>
                      </button>
                    </div>
                  )}
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto flex flex-col-reverse">
                  <div className="p-6 flex flex-col gap-6">
                    {apiMessages.map((msg) => {
                      if (msg.messageType === 'workspace_invitation') {
                        return <InvitationCard key={msg.id} message={msg} onStatusUpdate={handleInvitationStatusUpdate} />
                      }
                      if (msg.messageType === 'system') {
                        return (
                          <div key={msg.id} className="flex justify-center my-2">
                            <div className="bg-[#ffffff]/[0.06] border border-[#ffffff]/[0.08] rounded-lg px-4 py-2 max-w-[80%]">
                              <p className="text-xs text-[#a6a6a6] text-center leading-relaxed">{msg.content}</p>
                            </div>
                          </div>
                        )
                      }
                      const isMe = msg.sender.id === user?.id
                      const hasFile = msg.fileUrl && msg.fileUrl !== 'pending'
                      const hasText = !!msg.content
                      const fileOnly = hasFile && !hasText
                      return isMe ? (
                        <div key={msg.id} className="flex gap-3 justify-end items-end">
                          <div className="flex flex-col items-end gap-1 max-w-[85%] sm:max-w-[70%]">
                            <div className={fileOnly ? '' : 'border border-[#ffffff]/15 bg-transparent p-3.5 rounded-2xl rounded-tr-sm'}>
                              <MessageAttachment msg={msg} />
                              {hasText && <p className="text-sm text-[#fafafa] leading-relaxed">{msg.content}</p>}
                            </div>
                            <span className="text-xs text-[#737373]">{formatTime(msg.createdAt)}</span>
                          </div>
                          {getImageUrl(user?.avatar) ? (
                            <img src={getImageUrl(user.avatar)!} alt="Me" className="w-8 h-8 rounded-full object-cover shrink-0 hidden sm:block" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] shrink-0 text-xs hidden sm:flex">ME</div>
                          )}
                        </div>
                      ) : (
                        <div key={msg.id} className="flex gap-3 items-end">
                          {getImageUrl(msg.sender.avatar) ? (
                            <img src={getImageUrl(msg.sender.avatar)!} alt={msg.sender.name} className="w-8 h-8 rounded-full object-cover shrink-0 hidden sm:block" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] shrink-0 text-xs hidden sm:flex">
                              {getInitials(msg.sender.name || '?')}
                            </div>
                          )}
                          <div className="flex flex-col items-start gap-1 max-w-[85%] sm:max-w-[70%]">
                            <div className={fileOnly ? '' : 'bg-[#ffffff]/10 border border-[#ffffff]/5 p-3.5 rounded-2xl rounded-tl-sm'}>
                              <MessageAttachment msg={msg} />
                              {hasText && <p className="text-sm text-[#fafafa] leading-relaxed">{msg.content}</p>}
                            </div>
                            <span className="text-xs text-[#737373] pl-1">{formatTime(msg.createdAt)}</span>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={chatBottomRef} />
                  </div>
                </div>

                {/* Typing Indicator */}
                {othersTyping.length > 0 && (
                  <div className="px-6 pb-1">
                    <span className="text-xs text-[#737373] italic">Someone is typing...</span>
                  </div>
                )}

                {/* File Error Toast */}
                {fileError && (
                  <div className="absolute bottom-22 left-1/2 -translate-x-1/2 z-20">
                    <div className="flex items-center gap-2.5 bg-[#1a1a1a] border border-[#ffffff]/10 rounded-full pl-3.5 pr-2 py-2 shadow-lg shadow-black/40">
                      <div className="w-5 h-5 rounded-full bg-[#ef4444]/15 flex items-center justify-center shrink-0">
                        <XCircle className="w-3.5 h-3.5 text-[#ef4444]" strokeWidth={2} />
                      </div>
                      <p className="text-[13px] text-[#d4d4d4] whitespace-nowrap font-light">{fileError}</p>
                      <button type="button" onClick={() => setFileError(null)} className="p-1 text-[#525252] hover:text-[#a3a3a3] transition-colors cursor-pointer rounded-full hover:bg-[#ffffff]/5">
                        <X className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Input Area */}
                <div className="p-4 sm:p-6 pt-2 shrink-0">
                  {pendingFile && (
                    <div className="mb-2 flex items-center gap-2 bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-xl px-3 py-2 mx-1">
                      {pendingFilePreview ? (
                        <img src={pendingFilePreview} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[#ef4444]" strokeWidth={1.5} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#fafafa] truncate">{pendingFile.name}</p>
                        <p className="text-xs text-[#737373]">{(pendingFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button type="button" onClick={clearPendingFile} className="p-1 text-[#737373] hover:text-[#fafafa] transition-colors cursor-pointer">
                        <X className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="relative flex items-center w-full bg-[#ffffff]/5 border border-[#ffffff]/15 rounded-full px-2 transition-colors focus-within:border-[#737373]">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="*/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-[#a6a6a6] hover:text-[#fafafa] transition-colors rounded-full cursor-pointer" disabled={isUploading}>
                      <Paperclip className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                    <input
                      ref={textInputRef}
                      type="text"
                      placeholder={pendingFile ? "Add a message (optional)..." : apiMessages.length === 0 ? "Say hello\u2026" : "Message..."}
                      value={inputText}
                      onChange={(e) => handleInputChange(e.target.value)}
                      className="flex-1 bg-transparent border-none text-[#fafafa] placeholder:text-[#737373] text-sm px-2 py-3 focus:outline-none focus:ring-0 font-light w-full"
                    />
                    <button type="submit" disabled={isUploading || (!inputText.trim() && !pendingFile)} className="p-2.5 text-[#a6a6a6] hover:text-[#fafafa] transition-colors rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> : <Send className="w-5 h-5" strokeWidth={1.5} />}
                    </button>
                  </form>
                </div>
              </>)}
          </section>
        )}
      </main>

      {/* Create Deal Room Modal */}
      <Modal open={showCreateModal} onClose={() => { if (!isCreatingDealRoom) { setShowCreateModal(false); setNewRoomName('') } }}>
        <div className="p-8 pb-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-[#ffffff]/10 flex items-center justify-center mb-5">
            <Handshake className="w-7 h-7 text-[#fafafa]" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl tracking-tight text-[#fafafa] font-normal mb-2">Create Deal Room</h2>
          <p className="text-sm text-[#a6a6a6]">Enter a name for the deal room</p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!user || !activeId || !activeContact?.userId || isCreatingDealRoom || !newRoomName.trim()) return
            setIsCreatingDealRoom(true)
            try {
              const result = await createWorkspace({
                name: newRoomName.trim(),
                creatorId: user.id,
                dealRoomId: activeId,
                inviteeId: activeContact.userId,
              })

              // Optimistically add invitation card to 1:1 messages
              if (result.invitationMessage) {
                queryClient.setQueryData<ApiMessage[]>(['messages', activeId], (old) =>
                  old ? [...old, result.invitationMessage] : [result.invitationMessage]
                )
              }

              // Close modal and stay in messages (workspace created when freelancer accepts)
              setShowCreateModal(false)
              setNewRoomName('')
              setIsCreatingDealRoom(false)
            } catch {
              setFileError('Failed to create deal room. Please try again.')
              setTimeout(() => setFileError(null), 4000)
              setIsCreatingDealRoom(false)
            }
          }}
          className="px-8 pb-8 flex flex-col gap-4"
        >
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="e.g. Website Redesign Project"
            autoFocus
            className="w-full bg-[#ffffff]/5 border border-[#ffffff]/15 rounded-lg px-4 py-3 text-sm text-[#fafafa] placeholder:text-[#737373] focus:outline-none focus:border-[#737373] transition-colors font-light"
          />
          <button
            type="submit"
            disabled={isCreatingDealRoom || !newRoomName.trim()}
            className="w-full bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreatingDealRoom ? (
              <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /><span>Creating...</span></>
            ) : (
              <><Handshake className="w-4 h-4" strokeWidth={1.5} /><span>Create</span></>
            )}
          </button>
        </form>
      </Modal>

      {/* Mobile Inbox Overlay */}
      {mobileInboxOpen && (
        <div className="fixed inset-0 z-[150] bg-[#000000] flex flex-col md:hidden">
          <div className="p-5 flex items-center justify-between border-b border-[#ffffff]/10">
            <h1 className="text-xl tracking-tight text-[#fafafa] font-normal">Inbox</h1>
            <button type="button" onClick={() => setMobileInboxOpen(false)} className="text-[#a6a6a6] hover:text-[#fafafa] cursor-pointer">
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
          <div className="px-5 py-4">
            <SearchInput />
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1">
            {contacts.map((contact) => (
              <ContactItem
                key={contact.id}
                contact={contact}
                isActive={contact.id === activeContactId}
                onClick={() => { setActiveContactId(contact.id); setMobileInboxOpen(false) }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
