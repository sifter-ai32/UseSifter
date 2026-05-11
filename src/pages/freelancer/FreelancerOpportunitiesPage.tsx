import { useState, useRef, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Bot, ChevronLeft, Send, PartyPopper, X, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { useAuthStore } from '@/stores/authStore'
import { useNegotiation } from '@/hooks/useNegotiation'
import {
  listNegotiations,
  getNegotiationMessages,
  sendNegotiationMessage,
  acceptNegotiation,
  type NegotiationMessageInfo,
} from '@/lib/api'

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today'
  if (diff < 172800000) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short' })
}

function statusBadge(status: string) {
  switch (status) {
    case 'outreach_pending':
    case 'outreach_sent':
      return { label: 'New', color: 'text-blue-400' }
    case 'interested':
    case 'in_qa':
      return { label: 'Active', color: 'text-green-400' }
    case 'negotiating':
    case 'awaiting_confirmation':
      return { label: 'Negotiating', color: 'text-yellow-400' }
    case 'agreed':
      return { label: 'Agreed', color: 'text-emerald-400' }
    case 'declined':
    case 'no_response':
      return { label: 'Closed', color: 'text-[#737373]' }
    case 'escalate_to_human':
      return { label: 'Under Review', color: 'text-orange-400' }
    default:
      return { label: status, color: 'text-[#737373]' }
  }
}

function isNegotiationActive(status: string) {
  return !['agreed', 'declined', 'no_response', 'escalate_to_human'].includes(status)
}

export default function FreelancerOpportunitiesPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [input, setInput] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [agreedDealRoomId, _setAgreedWorkspaceId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Fetch negotiations
  const { data: negotiations = [], isLoading: loadingNegotiations } = useQuery({
    queryKey: ['negotiations', user?.id],
    queryFn: () => listNegotiations(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Auto-select first negotiation
  useEffect(() => {
    if (!selectedId && negotiations.length > 0) {
      setSelectedId(negotiations[0].id)
    }
  }, [negotiations, selectedId])

  const selectedNeg = negotiations.find((n) => n.id === selectedId) || null

  // Fetch messages for selected negotiation
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['negotiation-messages', selectedId],
    queryFn: () => getNegotiationMessages(selectedId!),
    enabled: !!selectedId,
    staleTime: 30 * 1000,
  })

  // Real-time socket hook
  const { onNewMessage, onStatusChanged, onNewNegotiation, botTyping } = useNegotiation(selectedId)

  // Listen for new messages in real-time
  useEffect(() => {
    return onNewMessage((msg: NegotiationMessageInfo) => {
      queryClient.setQueryData<NegotiationMessageInfo[]>(['negotiation-messages', selectedId], (old) => {
        if (!old) return [msg]
        // Avoid duplicates
        if (old.some((m) => m.id === msg.id)) return old
        // Replace temp messages from same role
        const filtered = old.filter((m) => !(m.id.startsWith('temp-') && m.role === msg.role))
        return [...filtered, msg]
      })
    })
  }, [selectedId, onNewMessage, queryClient])

  // Listen for status changes
  useEffect(() => {
    return onStatusChanged((data: { status: string; dealRoomId?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['negotiations', user?.id] })
      if (data.status === 'agreed') {
        if (data.dealRoomId) {
          navigate(`/freelancer/dealrooms?room=${data.dealRoomId}`)
        } else {
          navigate('/freelancer/dealrooms')
        }
      }
    })
  }, [onStatusChanged, queryClient, user?.id, navigate])

  // Listen for new negotiations (sidebar refresh)
  useEffect(() => {
    return onNewNegotiation(() => {
      queryClient.invalidateQueries({ queryKey: ['negotiations', user?.id] })
    })
  }, [onNewNegotiation, queryClient, user?.id])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, botTyping])

  // Filter negotiations by search
  const filtered = negotiations.filter(
    (n) =>
      n.project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.project.description || '').toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !selectedId || isSending) return

    setInput('')
    setIsSending(true)

    // Optimistic update
    const tempMsg: NegotiationMessageInfo = {
      id: `temp-${Date.now()}`,
      role: 'freelancer',
      content: text,
      toolCall: null,
      toolData: null,
      createdAt: new Date().toISOString(),
    }
    queryClient.setQueryData<NegotiationMessageInfo[]>(['negotiation-messages', selectedId], (old) =>
      old ? [...old, tempMsg] : [tempMsg],
    )

    try {
      await sendNegotiationMessage(selectedId, text)
      // Refresh negotiations list to update lastMessage
      queryClient.invalidateQueries({ queryKey: ['negotiations', user?.id] })
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleAccept = async () => {
    if (!selectedId || isAccepting) return
    setIsAccepting(true)
    try {
      const result = await acceptNegotiation(selectedId)
      queryClient.invalidateQueries({ queryKey: ['negotiations', user?.id] })
      if (result.dealRoomId) {
        navigate(`/freelancer/dealrooms?room=${result.dealRoomId}`)
      } else {
        navigate('/freelancer/dealrooms')
      }
    } catch (err) {
      console.error('Failed to accept:', err)
      setIsAccepting(false)
    }
  }

  const showAcceptButton = selectedNeg && selectedNeg.status === 'negotiating' && selectedNeg.currentOffer
  const canSendMessage = selectedNeg && isNegotiationActive(selectedNeg.status)

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa]">
      <Header />

      <main className="flex flex-1 pt-16 h-full w-full max-w-[1600px] mx-auto">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'fixed inset-0 z-[80] pt-16 bg-[#000000]' : 'hidden'} md:flex md:relative md:z-auto flex-col w-full md:w-80 lg:w-96 border-r border-[#ffffff]/10 bg-[#000000]`}>
          <div className="p-5 flex items-center justify-between">
            <h1 className="text-xl tracking-tight text-[#fafafa] font-normal">Opportunities</h1>
            <button
              type="button"
              className="md:hidden text-[#a6a6a6] hover:text-[#fafafa]"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="px-5 pb-4 flex gap-2">
            <div className="relative flex items-center flex-1">
              <Search className="absolute left-3 w-3.5 h-3.5 text-[#737373]" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#ffffff]/5 border border-[#ffffff]/10 text-[#fafafa] placeholder:text-[#737373] text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-[#737373] transition-colors font-light"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
            {loadingNegotiations ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 text-[#737373] animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-[#737373] text-sm">
                {searchQuery ? 'No matches found' : 'No opportunities yet'}
              </div>
            ) : (
              filtered.map((neg) => {
                const isActive = neg.id === selectedId
                const badge = statusBadge(neg.status)
                return (
                  <button
                    key={neg.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(neg.id)
                      setSidebarOpen(false)
                    }}
                    className={`w-full text-left p-4 rounded-xl cursor-pointer flex flex-col gap-1 transition-colors ${
                      isActive
                        ? 'bg-[#ffffff]/10 border border-[#ffffff]/5'
                        : 'border border-transparent hover:bg-[#ffffff]/5 group'
                    }`}
                  >
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="text-sm font-normal text-[#fafafa] truncate">{neg.project.title}</h3>
                      <span className={`text-xs shrink-0 ml-2 ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className={`text-xs line-clamp-2 leading-relaxed ${
                      isActive ? 'text-[#a6a6a6]' : 'text-[#737373] group-hover:text-[#a6a6a6]'
                    } transition-colors`}>
                      {neg.lastMessage?.content || neg.project.description || 'New opportunity'}
                    </p>
                    <span className="text-xs text-[#737373] mt-1">{formatDate(neg.updatedAt)}</span>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <section className="flex-1 flex flex-col relative bg-[#000000]">
          {selectedNeg ? (
            <>
              {/* Chat Header */}
              <header className="h-[72px] border-b border-[#ffffff]/10 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    className="md:hidden text-[#a6a6a6] hover:text-[#fafafa]"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                  <div className="hidden sm:flex text-[#fafafa] bg-[#ffffff]/5 w-10 h-10 border-[#ffffff]/10 border rounded-full items-center justify-center">
                    <Bot className="w-5 h-5 text-[#a6a6a6]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-normal text-[#fafafa]">{selectedNeg.project.title}</h2>
                    </div>
                    <span className="text-xs text-[#a6a6a6]">
                      Sifter Coordinator
                      {selectedNeg.currentOffer && selectedNeg.status !== 'agreed' ? ` · Offer: $${selectedNeg.currentOffer}/${selectedNeg.rateType}` : ''}
                      {selectedNeg.finalRate ? ` · Agreed: $${selectedNeg.finalRate}/${selectedNeg.rateType}` : ''}
                    </span>
                  </div>
                </div>
                <div>
                  <span className={`text-xs ${statusBadge(selectedNeg.status).color}`}>
                    {statusBadge(selectedNeg.status).label}
                  </span>
                </div>
              </header>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                <div className="flex justify-center mt-2 mb-4">
                  <span className="text-xs text-[#737373] font-light">{formatDate(selectedNeg.createdAt)}</span>
                </div>

                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 text-[#737373] animate-spin" />
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const showAvatar = msg.role === 'bot' && (idx === 0 || messages[idx - 1]?.role !== 'bot')

                    return msg.role === 'bot' || msg.role === 'system' ? (
                      <div key={msg.id} className="flex gap-3 items-end">
                        <div className={`w-8 h-8 rounded-full bg-[#ffffff]/5 border border-[#ffffff]/10 items-center justify-center text-[#fafafa] shrink-0 hidden sm:flex ${showAvatar ? '' : 'opacity-0'}`}>
                          <Bot className="w-3.5 h-3.5 text-[#a6a6a6]" strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col items-start gap-1 max-w-[85%] sm:max-w-[70%]">
                          <div className="bg-[#ffffff]/10 border border-[#ffffff]/5 p-3.5 rounded-2xl rounded-tl-sm">
                            <p className="text-sm text-[#fafafa] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <span className="text-xs text-[#737373] pl-1 mt-1">{formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    ) : (
                      <div key={msg.id} className="flex gap-3 justify-end items-end">
                        <div className="flex flex-col items-end gap-1 max-w-[85%] sm:max-w-[70%]">
                          <div className="border border-[#ffffff]/15 bg-transparent p-3.5 rounded-2xl rounded-tr-sm">
                            <p className="text-sm text-[#fafafa] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <span className="text-xs text-[#737373] pr-1">{formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    )
                  })
                )}

                {botTyping && (
                  <div className="flex gap-3 items-end">
                    <div className="w-8 h-8 rounded-full bg-[#ffffff]/5 border border-[#ffffff]/10 items-center justify-center text-[#fafafa] shrink-0 hidden sm:flex">
                      <Bot className="w-3.5 h-3.5 text-[#a6a6a6]" strokeWidth={1.5} />
                    </div>
                    <div className="bg-[#ffffff]/10 border border-[#ffffff]/5 p-3.5 rounded-2xl rounded-tl-sm">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-[#737373] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-[#737373] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-[#737373] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Agreed banner */}
                {selectedNeg.status === 'agreed' && selectedNeg.finalRate && (
                  <div className="flex justify-center">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-6 py-3 text-center">
                      <p className="text-sm text-emerald-400">Deal confirmed at ${selectedNeg.finalRate}/{selectedNeg.rateType}</p>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 sm:p-6 pt-2 shrink-0 flex gap-3 items-center">
                <form
                  onSubmit={handleSend}
                  className={`relative flex items-center flex-1 bg-[#ffffff]/5 border border-[#ffffff]/15 rounded-full px-2 transition-colors focus-within:border-[#737373] ${!canSendMessage ? 'opacity-50' : ''}`}
                >
                  <input
                    type="text"
                    placeholder={canSendMessage ? 'Type your message...' : 'This conversation has ended'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={!canSendMessage || isSending}
                    className="flex-1 bg-transparent border-none text-[#fafafa] placeholder:text-[#737373] text-sm px-4 py-3 focus:outline-none focus:ring-0 font-light w-full disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={!canSendMessage || isSending || !input.trim()}
                    className="p-2.5 text-[#a6a6a6] hover:text-[#fafafa] transition-colors rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <Loader2 className="w-[18px] h-[18px] animate-spin" />
                    ) : (
                      <Send className="w-[18px] h-[18px]" strokeWidth={1.5} />
                    )}
                  </button>
                </form>
                {showAcceptButton && (
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={isAccepting}
                    className="bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors px-5 py-3 rounded-full text-sm font-normal shrink-0 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Accept ${selectedNeg.currentOffer}/{selectedNeg.rateType}
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Bot className="w-12 h-12 text-[#737373] mx-auto mb-4" strokeWidth={1} />
                <p className="text-[#737373] text-sm">
                  {loadingNegotiations ? 'Loading opportunities...' : 'No opportunities yet. Check back soon!'}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Celebration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] bg-[#000000]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#000000] border border-[#ffffff]/15 rounded-2xl w-full max-w-md shadow-2xl flex flex-col items-center text-center p-10 relative overflow-hidden">
            <div className="w-16 h-16 rounded-full bg-[#ffffff]/10 border border-[#ffffff]/20 flex items-center justify-center mb-6">
              <PartyPopper className="w-8 h-8 text-[#fafafa]" strokeWidth={1.5} />
            </div>

            <h2 className="text-xl tracking-tight text-[#fafafa] font-normal mb-3">Deal Confirmed!</h2>
            <p className="text-sm text-[#a6a6a6] leading-relaxed mb-8">
              {selectedNeg?.finalRate
                ? `You've agreed to $${selectedNeg.finalRate}/${selectedNeg.rateType}. `
                : ''}
              You can now chat directly with the client.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowModal(false)
                if (agreedDealRoomId) {
                  navigate(`/freelancer/dealrooms?room=${agreedDealRoomId}`)
                } else {
                  navigate('/freelancer/dealrooms')
                }
              }}
              className="w-full bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-3 rounded-lg text-sm font-normal cursor-pointer"
            >
              Go to Messages
            </button>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-[#737373] hover:text-[#fafafa] cursor-pointer"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
