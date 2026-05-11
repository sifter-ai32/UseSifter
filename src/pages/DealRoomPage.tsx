import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, Paperclip, Send, Link2, Lock, Info, ShieldCheck,
  X, Loader2, FileText, XCircle, Archive, ArchiveRestore,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import SearchInput from '@/components/ui/SearchInput'
import RoomItem from '@/components/dealroom/RoomItem'
import GroupInfoModal from '@/components/dealroom/GroupInfoModal'
import ShareModal from '@/components/dealroom/ShareModal'
import EscrowModal from '@/components/dealroom/EscrowModal'
import EscrowPanel from '@/components/dealroom/EscrowPanel'
import WalletRequestCard from '@/components/dealroom/WalletRequestCard'
import MessageAttachment from '@/components/messaging/MessageAttachment'
import { useEscrow } from '@/hooks/useEscrow'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useAuthStore } from '@/stores/authStore'
import { getInitials, formatTime, getImageUrl } from '@/lib/utils'
import * as api from '@/lib/api'
import {
  listWorkspaces, getWorkspace, getWorkspaceMessages, uploadWorkspaceFile,
  createInviteLink, archiveWorkspace, unarchiveWorkspace,
  type Workspace, type WorkspaceMessageInfo,
} from '@/lib/api'
import type { DealRoomRoom, DealRoomMember } from '@/types/dealRoom'

/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */

function toRoom(ws: Workspace): DealRoomRoom {
  return {
    id: ws.id,
    initials: getInitials(ws.name),
    name: ws.name,
    lastMessage: ws.lastMessage?.content || '',
    time: ws.lastMessage ? formatTime(ws.lastMessage.createdAt) : '',
  }
}

function toMember(m: Workspace['members'][number]): DealRoomMember {
  return {
    initials: getInitials(m.user.name),
    name: m.user.name,
    role: m.role === 'owner' ? 'Owner' : 'Member',
  }
}

const STALE = 5 * 60_000  // 5 min — real-time socket keeps data fresh
const GC    = 10 * 60_000 // 10 min cache retention

/* ────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────── */

export default function DealRoomPage() {
  const user = useAuthStore((s) => s.user)
  const userType = useAuthStore((s) => s.userType)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const basePath = userType === 'client' ? '/dealroom' : '/freelancer/dealroom'

  /* ───────────────── 1. Data Layer ───────────────── */

  // Always fetch BOTH lists on mount — tab switching is just a filter, zero network.
  const { data: activeList = [], isPending: activePending } = useQuery({
    queryKey: ['workspaces', user?.id, 'active'],
    queryFn: () => listWorkspaces(user!.id, false),
    enabled: !!user?.id,
    staleTime: STALE,
    gcTime: GC,
  })

  const { data: archivedList = [], isPending: archivedPending } = useQuery({
    queryKey: ['workspaces', user?.id, 'archived'],
    queryFn: () => listWorkspaces(user!.id, true),
    enabled: !!user?.id,
    staleTime: STALE,
    gcTime: GC,
  })

  // Build a quick lookup set of archived ids (cheap — recalculates only when list changes)
  const archivedIds = useMemo(
    () => new Set(archivedList.map((w) => w.id)),
    [archivedList],
  )

  // ── Derived tab: 100% driven by URL, never stored in state ──
  // If the URL points to a workspace that's in the archived list → archived tab.
  // Otherwise → active tab (default).
  const tab: 'active' | 'archived' = workspaceId && archivedIds.has(workspaceId) ? 'archived' : 'active'

  // Which list to show in sidebar
  const sidebarList = tab === 'active' ? activeList : archivedList
  // Selected workspace id: URL param, or first in current tab, or null
  const activeId = workspaceId || sidebarList[0]?.id || null

  // Fetch active workspace detail
  const { data: workspace, isPending: wsPending, isError: wsError } = useQuery({
    queryKey: ['workspace', activeId],
    queryFn: () => getWorkspace(activeId!),
    enabled: !!activeId,
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  })

  // Fetch active workspace messages
  const { data: messages = [], isPending: msgPending } = useQuery({
    queryKey: ['workspace-messages', activeId],
    queryFn: () => getWorkspaceMessages(activeId!),
    enabled: !!activeId,
    staleTime: STALE,
    gcTime: GC,
    retry: 2,
  })

  // ── Prefetch everything so switching rooms/tabs is instant ──
  const allIds = useMemo(
    () => [...activeList, ...archivedList].map((w) => w.id),
    [activeList, archivedList],
  )

  useEffect(() => {
    allIds.forEach((id) => {
      queryClient.prefetchQuery({
        queryKey: ['workspace', id],
        queryFn: () => getWorkspace(id),
        staleTime: STALE,
      })
      queryClient.prefetchQuery({
        queryKey: ['workspace-messages', id],
        queryFn: () => getWorkspaceMessages(id),
        staleTime: STALE,
      })
    })
  }, [allIds, queryClient])

  /* ───────────────── 2. Derived Data ───────────────── */

  const rooms = sidebarList.map(toRoom)
  const members = workspace?.members?.map(toMember) || []
  const isCreator = workspace?.creatorId === user?.id
  const isArchived = workspace?.archived ?? false

  /* ───────────────── 3. Real-time ───────────────── */

  const { sendMessage: socketSend, emitTyping, typingUsers, onNewMessage, onMemberJoined, requestWallet, confirmWalletConnected, onWalletUpdated } = useWorkspace(activeId)

  useEffect(() => {
    return onNewMessage((msg) => {
      queryClient.setQueryData<WorkspaceMessageInfo[]>(['workspace-messages', activeId], (old) => {
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

  useEffect(() => {
    return onMemberJoined(({ workspaceId: wsId }) => {
      if (wsId === activeId) {
        queryClient.invalidateQueries({ queryKey: ['workspace', activeId] })
      }
    })
  }, [activeId, onMemberJoined, queryClient])

  // Listen for wallet-updated events to refresh the wallet_request message card
  useEffect(() => {
    return onWalletUpdated(({ messageId, userId: updatedUserId, walletAddress }) => {
      queryClient.setQueryData<WorkspaceMessageInfo[]>(['workspace-messages', activeId], (old) => {
        if (!old) return old ?? []
        return old.map((m) => {
          if (m.id === messageId) {
            return { ...m, metadata: { ...(m.metadata as Record<string, unknown> || {}), status: 'connected', walletAddress } }
          }
          return m
        })
      })
      // Also refresh workspace members to update wallet addresses
      queryClient.invalidateQueries({ queryKey: ['workspace', activeId] })
      // Update auth store if current user connected wallet
      if (updatedUserId === user?.id) {
        useAuthStore.getState().setWalletAddress(walletAddress)
      }
    })
  }, [activeId, onWalletUpdated, queryClient, user?.id])

  /* ───────────────── 4. UI State ───────────────── */

  const [mobileInboxOpen, setMobileInboxOpen] = useState(false)
  const [groupInfoOpen, setGroupInfoOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const typingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const workspaceMemberIds = useMemo(
    () => workspace?.members?.map(m => m.user.id) || [],
    [workspace?.members],
  )
  const escrow = useEscrow(activeId, workspaceMemberIds, workspace?.members)
  const [isArchiving, setIsArchiving] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)

  const othersTyping = user ? [...typingUsers].filter((id) => id !== user.id) : []

  /* ───────────────── 5. Actions ───────────────── */

  // Tab switch — just navigate to the first room in the target list
  const switchTab = useCallback((target: 'active' | 'archived') => {
    const list = target === 'active' ? activeList : archivedList
    navigate(list[0] ? `${basePath}/${list[0].id}` : basePath, { replace: true })
  }, [activeList, archivedList, basePath, navigate])

  // Archive / Unarchive — optimistic cache update + navigate
  const handleArchiveToggle = useCallback(async () => {
    if (!user || !activeId || isArchiving) return
    setIsArchiving(true)
    try {
      if (isArchived) {
        await unarchiveWorkspace(activeId, user.id)
        // Move item: archived → active cache
        queryClient.setQueryData<Workspace>(['workspace', activeId], (old) =>
          old ? { ...old, archived: false, archivedAt: null } : old
        )
        queryClient.setQueryData<Workspace[]>(['workspaces', user.id, 'archived'], (old) =>
          old ? old.filter((w) => w.id !== activeId) : old
        )
        const item = archivedList.find((w) => w.id === activeId)
        if (item) {
          queryClient.setQueryData<Workspace[]>(['workspaces', user.id, 'active'], (old) =>
            old ? [{ ...item, archived: false }, ...old] : [{ ...item, archived: false }]
          )
        }
        // Navigate to this room — it's now active, so tab auto-derives to "active"
        navigate(`${basePath}/${activeId}`, { replace: true })
      } else {
        await archiveWorkspace(activeId, user.id)
        // Move item: active → archived cache
        queryClient.setQueryData<Workspace>(['workspace', activeId], (old) =>
          old ? { ...old, archived: true, archivedAt: new Date().toISOString() } : old
        )
        queryClient.setQueryData<Workspace[]>(['workspaces', user.id, 'active'], (old) =>
          old ? old.filter((w) => w.id !== activeId) : old
        )
        const item = activeList.find((w) => w.id === activeId)
        if (item) {
          queryClient.setQueryData<Workspace[]>(['workspaces', user.id, 'archived'], (old) =>
            old ? [{ ...item, archived: true }, ...old] : [{ ...item, archived: true }]
          )
        }
        // Navigate away — show first active, or base
        const remaining = activeList.filter((w) => w.id !== activeId)
        navigate(remaining[0] ? `${basePath}/${remaining[0].id}` : basePath, { replace: true })
      }
    } catch { /* ignore */ }
    setIsArchiving(false)
  }, [user, activeId, isArchived, isArchiving, activeList, archivedList, queryClient, basePath, navigate])

  // Generate share link
  const handleGenerateLink = useCallback(async () => {
    if (!user || !activeId) return
    setIsGeneratingLink(true)
    try {
      const result = await createInviteLink(activeId, user.id)
      setInviteUrl(result.url)
    } catch { /* ignore */ }
    setIsGeneratingLink(false)
  }, [user, activeId])

  // Auto-scroll
  const prevMsgCountRef = useRef(0)
  useEffect(() => {
    if (prevMsgCountRef.current > 0 && messages.length > prevMsgCountRef.current) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMsgCountRef.current = messages.length
  }, [messages.length])

  // File handling
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size must be under 10MB')
      setTimeout(() => setFileError(null), 4000)
      return
    }
    setPendingFile(file)
    setPendingFilePreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    e.target.value = ''
    textInputRef.current?.focus()
  }, [])

  const clearPendingFile = useCallback(() => {
    if (pendingFilePreview) URL.revokeObjectURL(pendingFilePreview)
    setPendingFile(null)
    setPendingFilePreview(null)
  }, [pendingFilePreview])

  // Send message
  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if (!text && !pendingFile) return
    if (!user || !activeId) return

    const fileToSend = pendingFile

    // Optimistic message
    const optimisticMsg: WorkspaceMessageInfo = {
      id: `temp-${Date.now()}`,
      content: text || '',
      fileUrl: fileToSend ? (fileToSend.type.startsWith('image/') ? pendingFilePreview : 'pending') : null,
      fileType: fileToSend ? (fileToSend.type.startsWith('image/') ? 'image' : fileToSend.type === 'application/pdf' ? 'pdf' : 'file') : null,
      fileName: fileToSend?.name || null,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, name: user.name, avatar: user.avatar ?? null },
    }
    queryClient.setQueryData<WorkspaceMessageInfo[]>(['workspace-messages', activeId], (old) =>
      old ? [...old, optimisticMsg] : [optimisticMsg]
    )

    setInputText('')
    setPendingFile(null)
    setPendingFilePreview(null)
    if (typingRef.current) { emitTyping(false); typingRef.current = false }

    if (fileToSend) {
      setIsUploading(true)
      try {
        const uploaded = await uploadWorkspaceFile(activeId, fileToSend)
        socketSend(text || '', { fileUrl: uploaded.url, fileType: uploaded.fileType, fileName: uploaded.fileName })
      } catch {
        socketSend(text || '')
      } finally {
        setIsUploading(false)
      }
    } else {
      socketSend(text || '')
    }
  }, [inputText, pendingFile, pendingFilePreview, user, activeId, socketSend, emitTyping, queryClient])

  // Typing
  const handleInputChange = useCallback((value: string) => {
    setInputText(value)
    if (value && !typingRef.current) { emitTyping(true); typingRef.current = true }
    else if (!value && typingRef.current) { emitTyping(false); typingRef.current = false }
  }, [emitTyping])

  const handleFinish = () => {
    escrow.finish()
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  /* ───────────────── 6. Loading States ───────────────── */

  const bothListsLoaded = !activePending && !archivedPending

  // On first mount, wait for BOTH sidebar list AND active room data before showing anything.
  // This ensures sidebar and chat appear at the exact same time — no desync.
  const initialReady = bothListsLoaded && (!activeId || (!wsPending && !msgPending && !escrow.escrowLoading))

  // Chat: three states (only evaluated after initialReady)
  const chatEmpty = initialReady && !activeId
  const chatLoading = !!activeId && (wsPending || msgPending)
  const chatReady = !!activeId && !wsPending && !msgPending && !wsError

  /* ───────────────── 7. Error ───────────────── */

  if (wsError && !wsPending) {
    return (
      <div className="bg-[#000000] text-[#fafafa] antialiased h-screen overflow-hidden flex flex-col font-light">
        <Header />
        <main className="flex flex-1 pt-16 items-center justify-center flex-col gap-3">
          <span className="text-sm text-[#737373]">Failed to load deal room</span>
          <button type="button" onClick={() => navigate(basePath)} className="text-sm text-[#a6a6a6] hover:text-[#fafafa] transition-colors cursor-pointer underline underline-offset-4">
            Back to Deal Rooms
          </button>
        </main>
      </div>
    )
  }

  /* ───────────────── 8. Render ───────────────── */

  return (
    <div className="bg-[#000000] text-[#fafafa] antialiased h-screen overflow-hidden flex flex-col font-light">
      <Header />

      <main className="flex flex-1 pt-16 h-full w-full max-w-[1600px] mx-auto">

        {/* ────── Unified Skeleton — sidebar + chat appear together ────── */}
        {!initialReady ? (
          <>
            <aside className="hidden md:flex flex-col w-80 lg:w-96 border-r border-[#ffffff]/10 bg-[#000000]">
              <div className="p-5"><div className="h-6 bg-[#ffffff]/10 rounded w-28 animate-pulse" /></div>
              <div className="px-5 pb-4"><div className="h-9 bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-lg animate-pulse" /></div>
              <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-[#ffffff]/10 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-3.5 bg-[#ffffff]/10 rounded w-24" />
                      <div className="h-3 bg-[#ffffff]/[0.06] rounded w-36" />
                    </div>
                  </div>
                ))}
              </div>
            </aside>
            <section className="flex-1 flex flex-col relative bg-[#000000]">
              <header className="h-[72px] border-b border-[#ffffff]/10 flex items-center px-6 shrink-0 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0 hidden sm:block" />
                  <div className="space-y-2">
                    <div className="h-4 bg-[#ffffff]/10 rounded w-36" />
                    <div className="h-3 bg-[#ffffff]/[0.06] rounded w-20" />
                  </div>
                </div>
              </header>
              <div className="flex-1 p-6 flex flex-col gap-6 animate-pulse">
                <div className="flex gap-3 items-end">
                  <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0" />
                  <div className="h-12 bg-[#ffffff]/[0.06] rounded-2xl rounded-tl-sm w-48" />
                </div>
                <div className="flex gap-3 items-end justify-end">
                  <div className="h-10 bg-[#ffffff]/[0.06] rounded-2xl rounded-tr-sm w-36" />
                  <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0" />
                </div>
                <div className="flex gap-3 items-end">
                  <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0" />
                  <div className="h-16 bg-[#ffffff]/[0.06] rounded-2xl rounded-tl-sm w-56" />
                </div>
              </div>
              <div className="p-4 sm:p-6 pt-2 shrink-0 animate-pulse">
                <div className="h-12 bg-[#ffffff]/5 border border-[#ffffff]/15 rounded-full" />
              </div>
            </section>
          </>
        ) : (
        <>

        {/* ────── Sidebar ────── */}
        <aside className="hidden md:flex flex-col w-80 lg:w-96 border-r border-[#ffffff]/10 bg-[#000000]">
          <div className="p-5">
            <h1 className="text-xl tracking-tight text-[#fafafa] font-normal">Deal Rooms</h1>
          </div>
          <div className="px-5 pb-2 flex gap-1">
            <button
              type="button"
              onClick={() => switchTab('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-normal cursor-pointer transition-colors ${tab === 'active' ? 'bg-[#ffffff]/10 text-[#fafafa]' : 'text-[#737373] hover:text-[#a6a6a6]'}`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => switchTab('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-normal cursor-pointer transition-colors ${tab === 'archived' ? 'bg-[#ffffff]/10 text-[#fafafa]' : 'text-[#737373] hover:text-[#a6a6a6]'}`}
            >
              Archived
            </button>
          </div>
          <div className="px-5 py-2">
            <SearchInput placeholder="Search Rooms" />
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
            {rooms.length === 0 ? (
              <p className="text-xs text-[#737373] text-center py-6">
                {tab === 'archived' ? 'No archived rooms' : 'No active rooms'}
              </p>
            ) : rooms.map((room) => (
              <div key={room.id} className={tab === 'archived' ? 'opacity-60' : ''}>
                <RoomItem
                  room={room}
                  isActive={room.id === activeId}
                  onClick={() => navigate(`${basePath}/${room.id}`)}
                />
              </div>
            ))}
          </div>
        </aside>

        {/* ────── Chat Area ────── */}
        <section className="flex-1 flex flex-col relative bg-[#000000]">

          {/* State: Empty — no rooms in current tab */}
          {chatEmpty && (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-sm text-[#737373]">
                {tab === 'active' ? 'No active deal rooms' : 'No archived deal rooms'}
              </span>
            </div>
          )}

          {/* State: Loading — first fetch for this workspace */}
          {chatLoading && (
            <>
              <header className="h-[72px] border-b border-[#ffffff]/10 flex items-center px-6 shrink-0 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0 hidden sm:block" />
                  <div className="space-y-2">
                    <div className="h-4 bg-[#ffffff]/10 rounded w-36" />
                    <div className="h-3 bg-[#ffffff]/[0.06] rounded w-20" />
                  </div>
                </div>
              </header>
              <div className="flex-1 p-6 flex flex-col gap-6 animate-pulse">
                <div className="flex gap-3 items-end">
                  <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0" />
                  <div className="h-12 bg-[#ffffff]/[0.06] rounded-2xl rounded-tl-sm w-48" />
                </div>
                <div className="flex gap-3 items-end justify-end">
                  <div className="h-10 bg-[#ffffff]/[0.06] rounded-2xl rounded-tr-sm w-36" />
                  <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0" />
                </div>
                <div className="flex gap-3 items-end">
                  <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 shrink-0" />
                  <div className="h-16 bg-[#ffffff]/[0.06] rounded-2xl rounded-tl-sm w-56" />
                </div>
              </div>
              <div className="p-4 sm:p-6 pt-2 shrink-0 animate-pulse">
                <div className="h-12 bg-[#ffffff]/5 border border-[#ffffff]/15 rounded-full" />
              </div>
            </>
          )}

          {/* State: Ready — workspace + messages loaded */}
          {chatReady && (
            <>
              {/* Chat Header */}
              <header className="h-[72px] border-b border-[#ffffff]/10 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                  <button type="button" className="md:hidden text-[#a6a6a6] hover:text-[#fafafa] cursor-pointer" onClick={() => setMobileInboxOpen(true)}>
                    <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                  <button type="button" onClick={() => setGroupInfoOpen(true)} className="flex items-center gap-3 cursor-pointer hover:bg-[#ffffff]/5 p-2 -ml-2 rounded-lg transition-colors text-left">
                    <div className="hidden sm:flex shrink-0">
                      <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] text-[10px]">
                        {getInitials(workspace?.name || '')}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-normal text-[#fafafa]">{workspace?.name || 'Deal Room'}</h2>
                        {isArchived && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#ffffff]/10 bg-[#ffffff]/5">
                            <Archive className="w-3 h-3 text-[#737373]" strokeWidth={1.5} />
                            <span className="text-xs font-normal text-[#737373] tracking-wider uppercase">Archived</span>
                          </div>
                        )}
                        {escrow.isActive && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#ffffff]/20 bg-[#ffffff]/5">
                            <ShieldCheck className="w-3 h-3 text-[#fafafa]" strokeWidth={1.5} />
                            <span className="text-xs font-normal text-[#fafafa] tracking-wider uppercase">Funded</span>
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-[#a6a6a6] block">{members.length} Member{members.length !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  {isCreator && (
                    <button
                      type="button"
                      onClick={handleArchiveToggle}
                      disabled={isArchiving}
                      className="flex items-center justify-center text-[#a6a6a6] hover:text-[#fafafa] transition-colors p-2 rounded-lg hover:bg-[#ffffff]/5 cursor-pointer disabled:opacity-50"
                      title={isArchived ? 'Unarchive' : 'Archive'}
                    >
                      {isArchiving ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> : isArchived ? <ArchiveRestore className="w-5 h-5" strokeWidth={1.5} /> : <Archive className="w-5 h-5" strokeWidth={1.5} />}
                    </button>
                  )}
                  <button type="button" onClick={() => { setShareOpen(true); if (!inviteUrl) handleGenerateLink() }} className="flex items-center justify-center text-[#a6a6a6] hover:text-[#fafafa] transition-colors p-2 rounded-lg hover:bg-[#ffffff]/5 cursor-pointer">
                    <Link2 className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                  {(userType === 'client' || escrow.isActive) && (
                    <button
                      type="button"
                      onClick={escrow.openEscrow}
                      className={`flex items-center gap-2 transition-colors px-4 py-2 rounded-lg text-sm font-normal cursor-pointer ${
                        escrow.isActive
                          ? 'border border-[#ffffff]/20 bg-[#ffffff]/5 text-[#fafafa] hover:bg-[#ffffff]/10'
                          : 'bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6]'
                      }`}
                    >
                      {escrow.isActive ? (
                        <><Info className="w-4 h-4" strokeWidth={1.5} /><span>Escrow Info</span></>
                      ) : (
                        <><Lock className="w-4 h-4" strokeWidth={1.5} /><span>Escrow</span></>
                      )}
                    </button>
                  )}
                </div>
              </header>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto flex flex-col-reverse">
                <div className="p-6 flex flex-col gap-6">
                  {messages.map((msg) => {
                    if (msg.messageType === 'wallet_request') {
                      const meta = msg.metadata as { freelancerId?: string } | null
                      const isFreelancer = meta?.freelancerId === user?.id
                      return (
                        <WalletRequestCard
                          key={msg.id}
                          message={msg}
                          isFreelancer={isFreelancer}
                          onConnect={(messageId, walletAddress) => {
                            confirmWalletConnected(messageId, walletAddress)
                          }}
                        />
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
                          <span className="text-xs text-[#737373] pl-1 mb-0.5">{msg.sender.name}</span>
                          <div className={fileOnly ? '' : 'bg-[#ffffff]/10 border border-[#ffffff]/5 p-3.5 rounded-2xl rounded-tl-sm'}>
                            <MessageAttachment msg={msg} />
                            {hasText && <p className="text-sm text-[#fafafa] leading-relaxed">{msg.content}</p>}
                          </div>
                          <span className="text-xs text-[#737373] pl-1">{formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    )
                  })}

                  {escrow.isActive && escrow.activeEscrow && (() => {
                    const ae = escrow.activeEscrow
                    const completedPhases = ae.phases.filter(p => p.status === 'Approved' || p.status === 'AutoReleased')
                    const submittedPhase = ae.phases.find(p => p.status === 'Submitted')
                    const currentPending = ae.phases.find(p => p.status === 'Pending')
                    const allDone = completedPhases.length === ae.phases.length

                    const bannerCls = "flex justify-center mt-3 mb-1"
                    const pillCls = "bg-[#ffffff]/5 border border-[#ffffff]/10 px-4 py-2 rounded-full flex items-center gap-2"

                    return (
                      <>
                        {/* Funded banner */}
                        <div className={bannerCls}>
                          <div className={pillCls}>
                            <ShieldCheck className="w-4 h-4 text-[#a6a6a6]" strokeWidth={1.5} />
                            <span className="text-sm text-[#a6a6a6]">Escrow funded successfully. Phase 1 active.</span>
                          </div>
                        </div>

                        {/* Per-phase status updates */}
                        {completedPhases.map((p) => (
                          <div key={`released-${p.phaseIndex}`} className={bannerCls}>
                            <div className={pillCls}>
                              <Lock className="w-4 h-4 text-[#10b981]" strokeWidth={1.5} />
                              <span className="text-sm text-[#a6a6a6]">
                                Phase {p.phaseIndex + 1} approved — <span className="text-[#fafafa]">{parseFloat(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC</span> released.
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Work submitted */}
                        {submittedPhase && (
                          <div className={bannerCls}>
                            <div className={pillCls}>
                              <Info className="w-4 h-4 text-[#a6a6a6]" strokeWidth={1.5} />
                              <span className="text-sm text-[#a6a6a6]">
                                Phase {submittedPhase.phaseIndex + 1} work submitted. Awaiting client review.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Next phase active */}
                        {currentPending && completedPhases.length > 0 && !allDone && (
                          <div className={bannerCls}>
                            <div className={pillCls}>
                              <Info className="w-4 h-4 text-[#a6a6a6]" strokeWidth={1.5} />
                              <span className="text-sm text-[#a6a6a6]">Phase {currentPending.phaseIndex + 1} is now active.</span>
                            </div>
                          </div>
                        )}

                        {/* All phases done */}
                        {allDone && (
                          <div className={bannerCls}>
                            <div className={pillCls}>
                              <ShieldCheck className="w-4 h-4 text-[#10b981]" strokeWidth={1.5} />
                              <span className="text-sm text-[#a6a6a6]">All phases completed. Escrow fully released.</span>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  <div ref={chatBottomRef} />
                </div>
              </div>

              {/* Typing */}
              {othersTyping.length > 0 && (
                <div className="px-6 pb-1">
                  <span className="text-xs text-[#737373] italic">Someone is typing...</span>
                </div>
              )}

              {/* File Error */}
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

              {/* Input */}
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
                  <input ref={fileInputRef} type="file" accept="*/*" onChange={handleFileSelect} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-[#a6a6a6] hover:text-[#fafafa] transition-colors rounded-full cursor-pointer" disabled={isUploading}>
                    <Paperclip className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                  <input
                    ref={textInputRef}
                    type="text"
                    placeholder={messages.length === 0 ? 'Start the conversation\u2026' : 'Message group...'}
                    value={inputText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="flex-1 bg-transparent border-none text-[#fafafa] placeholder:text-[#737373] text-sm px-2 py-3 focus:outline-none focus:ring-0 font-light w-full"
                  />
                  <button type="submit" disabled={isUploading || (!inputText.trim() && !pendingFile)} className="p-2.5 text-[#a6a6a6] hover:text-[#fafafa] transition-colors rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> : <Send className="w-5 h-5" strokeWidth={1.5} />}
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
        </>
        )}
      </main>

      {/* Mobile Inbox */}
      {mobileInboxOpen && (
        <div className="fixed inset-0 z-[150] bg-[#000000] flex flex-col md:hidden">
          <div className="p-5 flex items-center justify-between border-b border-[#ffffff]/10">
            <h1 className="text-xl tracking-tight text-[#fafafa] font-normal">Deal Rooms</h1>
            <button type="button" onClick={() => setMobileInboxOpen(false)} className="text-[#a6a6a6] hover:text-[#fafafa] cursor-pointer">
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
          <div className="px-5 py-4">
            <SearchInput placeholder="Search Rooms" />
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
            {rooms.map((room) => (
              <RoomItem
                key={room.id}
                room={room}
                isActive={room.id === activeId}
                onClick={() => { navigate(`${basePath}/${room.id}`); setMobileInboxOpen(false) }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <GroupInfoModal
        open={groupInfoOpen}
        onClose={() => setGroupInfoOpen(false)}
        name={workspace?.name || 'Deal Room'}
        initials={getInitials(workspace?.name || '')}
        description={workspace?.description || ''}
        members={members}
        isCreator={isCreator}
        isArchived={isArchived}
        isArchiving={isArchiving}
        onArchiveToggle={handleArchiveToggle}
      />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        inviteUrl={inviteUrl}
        isGenerating={isGeneratingLink}
        onGenerate={handleGenerateLink}
      />
      <EscrowModal
        open={escrow.modalOpen}
        onClose={escrow.closeModal}
        step={escrow.step}
        setStep={escrow.setStep}
        phases={escrow.phases}
        totalPct={escrow.totalPct}
        budget={escrow.budget}
        setBudget={escrow.setBudget}
        budgetNum={escrow.budgetNum}
        walletConnected={escrow.walletConnected}
        walletAddress={escrow.walletAddress}
        isCorrectChain={escrow.isCorrectChain}
        connectWallet={escrow.connectWallet}
        disconnectWallet={escrow.disconnectWallet}
        selectedToken={escrow.selectedToken}
        setSelectedToken={escrow.setSelectedToken}
        autoReleaseTimeout={escrow.autoReleaseTimeout}
        setAutoReleaseTimeout={escrow.setAutoReleaseTimeout}
        phaseDeadlines={escrow.phaseDeadlines}
        updatePhaseDeadline={escrow.updatePhaseDeadline}
        freelancerWallet={escrow.freelancerWallet}
        setFreelancerWallet={escrow.setFreelancerWallet}
        freelancerId={escrow.freelancerId}
        setFreelancerId={escrow.setFreelancerId}
        tc1={escrow.tc1}
        setTc1={escrow.setTc1}
        tc2={escrow.tc2}
        setTc2={escrow.setTc2}
        isProcessing={escrow.isProcessing}
        flowStep={escrow.flowStep}
        flowError={escrow.flowError}
        requiredDeposit={escrow.requiredDeposit}
        members={members}
        workspaceMembers={workspace?.members || []}
        currentUserId={user?.id || ''}
        onRequestWallet={(freelancerId, freelancerName) => {
          requestWallet(freelancerId, freelancerName)
        }}
        addPhase={escrow.addPhase}
        removePhase={escrow.removePhase}
        updatePhaseName={escrow.updatePhaseName}
        updatePhasePct={escrow.updatePhasePct}
        completePayment={escrow.completePayment}
        cancelFlow={escrow.cancelFlow}
        finish={handleFinish}
      />
      <EscrowPanel
        open={escrow.slideOutOpen}
        onClose={() => escrow.setSlideOutOpen(false)}
        escrow={escrow.activeEscrow}
        onSubmitPhase={async (_id, workLink) => {
          // Submit = pure DB update (no on-chain action on Streamflow)
          const ae = escrow.activeEscrow
          if (!ae || !workLink) return
          const currentPhase = ae.phases.find(p => p.status === 'Pending')
          if (!currentPhase) return

          // Optimistic UI update
          const existingLinks = Array.isArray(currentPhase.workLinks) ? currentPhase.workLinks : []
          const newLinks = [...existingLinks, { url: workLink, submittedAt: new Date().toISOString() }]
          queryClient.setQueryData<api.EscrowInfo[]>(
            ['workspace-escrows', activeId, user?.id],
            (old) => old?.map(e => e.id === ae.id ? {
              ...e,
              phases: e.phases.map(p => p.phaseIndex === currentPhase.phaseIndex
                ? { ...p, workLink, workLinks: newLinks, status: 'Submitted' }
                : p),
            } : e)
          )

          try {
            await api.updateEscrowPhase(ae.id, currentPhase.phaseIndex, {
              status: 'Submitted',
              workLink,
              submittedAt: new Date().toISOString(),
            })
          } catch (e) {
            console.error('Failed to submit phase:', e)
          }
        }}
        onApprovePhase={async (_id) => {
          // Approve = cancel stream + direct USDC transfer to freelancer
          const ae = escrow.activeEscrow
          if (!ae) return
          const currentPhase = ae.phases.find(p => p.status === 'Submitted')
          if (!currentPhase?.streamId || !ae.freelancer.walletAddress) {
            console.error('Phase missing streamId or freelancer wallet')
            return
          }

          try {
            const txHash = await escrow.escrowWrite.approvePhase({
              streamId: currentPhase.streamId,
              phaseAmount: parseFloat(currentPhase.amount),
              freelancerWallet: ae.freelancer.walletAddress,
            })
            await api.updateEscrowPhase(ae.id, currentPhase.phaseIndex, {
              status: 'Approved',
              txHash,
            })
            queryClient.invalidateQueries({ queryKey: ['workspace-escrows'] })
          } catch (e) {
            console.error('Failed to approve phase:', e)
          }
        }}
        onRequestRevision={async (_id, notes) => {
          // Revision = pure DB update (no on-chain action)
          const ae = escrow.activeEscrow
          if (!ae) return
          const currentPhase = ae.phases.find(p => p.status === 'Submitted')
          if (!currentPhase) return

          try {
            await api.updateEscrowPhase(ae.id, currentPhase.phaseIndex, {
              status: 'Pending',
              revisionNotes: notes,
              revisionCount: currentPhase.revisionCount + 1,
            })
            queryClient.invalidateQueries({ queryKey: ['workspace-escrows'] })
          } catch (e) {
            console.error('Failed to request revision:', e)
          }
        }}
        onRaiseDispute={async (_id) => {
          // Dispute = platform-level / off-chain for hackathon
          const ae = escrow.activeEscrow
          if (!ae || !user) return
          const currentPhase = ae.phases.find(p => p.status === 'Pending' || p.status === 'Submitted')
          if (!currentPhase) return

          try {
            await api.createEscrowDispute(ae.id, {
              phaseIndex: currentPhase.phaseIndex,
              raisedById: user.id,
            })
            queryClient.invalidateQueries({ queryKey: ['workspace-escrows'] })
          } catch (e) {
            console.error('Failed to raise dispute:', e)
          }
        }}
        isLoading={escrow.escrowWrite.isLoading}
      />
    </div>
  )
}
