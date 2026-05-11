import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Check,
  SquarePen,
  History,
  ListChecks,
  MessageSquare,
  Users,
  Loader2,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { sendAiChatMessage, triggerNegotiations, listAiChatSessions, getAiChatSession } from '@/lib/api'
import type { MatchedFreelancerInfo, AiChatSessionListItem } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

function LogoIcon({ size = 14 }: { size?: number }) {
  return <img src="/sifter-logo.png" alt="Sifter" style={{ width: size, height: size }} />
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex w-full justify-end animate-[slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)_forwards]">
      <div className="bg-[#ffffff]/[0.03] border border-[#ffffff]/10 rounded-2xl rounded-tr-sm px-5 py-4 max-w-[85%] sm:max-w-[75%]">
        <p className="text-[#fafafa] text-sm sm:text-base font-light leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  )
}

function AIMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full gap-4 sm:gap-6 animate-[slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)_forwards]">
      <div className="w-8 h-8 rounded-full border border-[#ffffff]/10 bg-[#000000] flex items-center justify-center shrink-0 mt-1">
        <LogoIcon />
      </div>
      <div className="flex flex-col gap-4 max-w-[85%] sm:max-w-[80%]">
        {children}
      </div>
    </div>
  )
}

function AILoadingDots() {
  return (
    <div className="flex w-full gap-4 sm:gap-6 animate-[fadeIn_0.3s_ease_forwards]">
      <div className="w-8 h-8 rounded-full border border-[#ffffff]/10 bg-[#000000] flex items-center justify-center shrink-0 mt-1">
        <LogoIcon />
      </div>
      <div className="flex items-center h-8">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#737373] animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-[#737373] animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-[#737373] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// Sidebar views
type SidebarView = 'history' | 'progress' | null

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusLabel(status: string): string {
  switch (status) {
    case 'collecting': return 'Gathering info'
    case 'matching': return 'Finding matches'
    case 'completed': return 'Matches found'
    default: return status
  }
}

function HistoryView({ sessions, activeSessionId, onSelectSession }: {
  sessions: AiChatSessionListItem[]
  activeSessionId: string | null
  onSelectSession: (session: AiChatSessionListItem) => void
}) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <MessageSquare className="w-8 h-8 text-[#737373]/50" strokeWidth={1.5} />
        <p className="text-sm font-light text-[#737373]">No past conversations yet.</p>
      </div>
    )
  }

  // Group by relative date
  const groups: Record<string, AiChatSessionListItem[]> = {}
  for (const s of sessions) {
    const label = formatRelativeDate(s.updatedAt)
    if (!groups[label]) groups[label] = []
    groups[label].push(s)
  }

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(groups).map(([label, items]) => (
        <div key={label} className="flex flex-col gap-3">
          <span className="text-[10px] font-medium tracking-widest text-[#737373] uppercase">{label}</span>
          <div className="flex flex-col gap-1">
            {items.map(s => {
              const isActive = s.id === activeSessionId
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectSession(s)}
                  className={`w-full text-left p-3 rounded-xl transition-colors flex flex-col gap-1 border ${
                    isActive
                      ? 'bg-[#ffffff]/5 border-[#ffffff]/10'
                      : 'border-transparent hover:bg-[#ffffff]/5'
                  }`}
                >
                  <span className={`text-sm font-light truncate ${isActive ? 'text-[#fafafa]' : 'text-[#a6a6a6]'}`}>
                    {s.project?.title || 'New project'}
                  </span>
                  <span className={`text-xs font-extralight ${isActive ? 'text-[#a6a6a6]' : 'text-[#737373]'}`}>
                    {statusLabel(s.status)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProgressStep({ title, subtitle, done, last }: { title: string; subtitle: string; done: boolean; last?: boolean }) {
  return (
    <div className={`flex gap-4 relative ${last ? '' : 'pb-7'}`}>
      <div className="flex flex-col items-center relative z-10">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
          done ? 'bg-[#fafafa] shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-[#0a0a0a] border border-[#737373]/30'
        }`}>
          {done && <Check className="w-3 h-3 text-[#000000]" strokeWidth={2} />}
        </div>
      </div>
      {!last && <div className="absolute left-[9.5px] top-[26px] bottom-0 w-px bg-[#ffffff]/20" />}
      <div className="flex flex-col gap-1 pt-0.5">
        <span className={`text-sm ${done ? 'font-medium text-[#fafafa]' : 'font-light text-[#737373]'}`}>{title}</span>
        <span className={`text-xs font-extralight ${done ? 'text-[#a6a6a6]' : 'text-[#737373]/50'}`}>{subtitle}</span>
      </div>
    </div>
  )
}

interface ProgressFields {
  scope: boolean
  skills: boolean
  budget: boolean
  timeline: boolean
  preferences: boolean
  confirmed: boolean
  matching_started: boolean
  matching_complete: boolean
}

const DEFAULT_PROGRESS: ProgressFields = {
  scope: false, skills: false, budget: false,
  timeline: false, preferences: false, confirmed: false,
  matching_started: false, matching_complete: false,
}

function ProgressView({ progress, matchedFreelancers, onStartOutreach, outreachStatus }: {
  progress: ProgressFields
  matchedFreelancers: MatchedFreelancerInfo[]
  onStartOutreach: () => void
  outreachStatus: 'idle' | 'sending' | 'sent' | 'error'
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1 mb-8">
        <h3 className="text-sm font-medium text-[#fafafa] tracking-tight">Project Sourcing</h3>
        <p className="text-xs font-extralight text-[#a6a6a6]">Gathering requirements and matching candidates.</p>
      </div>

      {/* Section 1: Definition */}
      <div className="flex flex-col mb-6 ml-1">
        <ProgressStep done={progress.scope} title="Project Scope" subtitle="What needs to be built" />
        <ProgressStep done={progress.skills} title="Skills Needed" subtitle="Tools and expertise required" />
        <ProgressStep done={progress.budget} title="Budget" subtitle="Payment range and structure" />
        <ProgressStep done={progress.timeline} title="Timeline" subtitle="Start date and deadline" />
        <ProgressStep done={progress.preferences} title="Preferences" subtitle="Experience and communication style" />
        <ProgressStep done={progress.confirmed} title="Final Confirmation" subtitle={progress.confirmed ? 'Requirements logged successfully' : 'Waiting for confirmation'} />
      </div>

      {/* Section 2: Matching Progress */}
      <div className="flex flex-col mb-6 ml-1">
        <ProgressStep done={progress.matching_started} title="Matching" subtitle={progress.matching_started ? 'Filtering out to find the best' : 'Waiting for requirements'} />
        <ProgressStep done={progress.matching_complete} title="Shortlisting to top 5" subtitle={progress.matching_complete ? 'Finalists selected' : 'Curating the finalists'} />
        <ProgressStep done={outreachStatus === 'sent'} last title="Communicating with top 5" subtitle={
          outreachStatus === 'sending' ? 'Reaching out now...' :
          outreachStatus === 'sent' ? 'Outreach sent to all freelancers' :
          'Ready to reach out'
        } />
      </div>

      {/* Start Outreach Button — only show when matching is complete */}
      {progress.matching_complete && outreachStatus !== 'sent' && (
        <div className="mb-8 ml-1">
          <button
            type="button"
            onClick={onStartOutreach}
            disabled={outreachStatus === 'sending'}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#fafafa] text-[#000000] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {outreachStatus === 'sending' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending outreach...
              </>
            ) : outreachStatus === 'error' ? (
              'Retry Outreach'
            ) : (
              'Start Outreach to Top 5'
            )}
          </button>
          {outreachStatus === 'error' && (
            <p className="text-xs text-red-400 mt-2 text-center">Failed to send outreach. Please try again.</p>
          )}
        </div>
      )}

      {outreachStatus === 'sent' && (
        <div className="mb-8 ml-1 flex items-center gap-2 p-3 rounded-xl bg-[#ffffff]/5 border border-[#ffffff]/10">
          <Check className="w-4 h-4 text-green-400" />
          <span className="text-sm font-light text-green-400">Outreach sent! Freelancers will respond in Opportunities.</span>
        </div>
      )}

      {/* Section 3: Shortlisted Freelancers */}
      {matchedFreelancers.length > 0 && (
        <div className="flex flex-col pt-2">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-[18px] h-[18px] text-[#fafafa]" strokeWidth={1.5} />
            <h4 className="text-sm font-medium tracking-tight text-[#fafafa]">Top {matchedFreelancers.length} Shortlisted</h4>
          </div>
          <div className="flex flex-col gap-3">
            {matchedFreelancers.map((f) => {
              const initials = f.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={f.userId} className="flex items-center justify-between p-3 rounded-xl bg-[#ffffff]/5 border border-[#ffffff]/10 hover:bg-[#ffffff]/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#ffffff]/20 flex items-center justify-center text-[#fafafa] text-xs font-medium shrink-0 overflow-hidden">
                      {f.avatar ? (
                        <img src={f.avatar} alt={f.name} className="w-full h-full object-cover" />
                      ) : initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[#fafafa]">{f.name}</span>
                      <span className="text-xs font-light text-[#737373]">{f.title || 'Freelancer'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-light text-[#a6a6a6]">{f.score}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function AIChatPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const initialMessage = (location.state as { message?: string })?.message || ''
  const { user } = useAuthStore()

  const [pageReady, setPageReady] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressFields>(DEFAULT_PROGRESS)
  const [matchedFreelancers, setMatchedFreelancers] = useState<MatchedFreelancerInfo[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [outreachStatus, setOutreachStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const [sidebarView, setSidebarView] = useState<SidebarView>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [historySessions, setHistorySessions] = useState<AiChatSessionListItem[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const didAutoSend = useRef(false)

  // Pre-load all data before showing the page
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function loadAll() {
      try {
        // Fetch history sessions upfront
        const sessions = await listAiChatSessions(user!.id)
        if (cancelled) return
        setHistorySessions(sessions)
      } catch {
        // Ignore — history just won't be populated
      }
      if (!cancelled) setPageReady(true)
    }

    loadAll()
    return () => { cancelled = true }
  }, [user])

  // Auto-send initial message once page is ready
  useEffect(() => {
    if (pageReady && initialMessage && !didAutoSend.current && user && !sessionId) {
      didAutoSend.current = true
      navigate(location.pathname, { replace: true, state: {} })
      handleSendMessage(initialMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageReady, user])

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [message])

  // Fetch history sessions
  const fetchHistory = useCallback(() => {
    if (user) listAiChatSessions(user.id).then(setHistorySessions).catch(() => {})
  }, [user])

  // Refresh history when sidebar opens to history
  useEffect(() => {
    if (sidebarView === 'history') fetchHistory()
  }, [sidebarView, fetchHistory])

  // Load a past session's state including chat messages
  async function handleSelectSession(session: AiChatSessionListItem) {
    setSessionId(session.id)
    setProgress(session.collectedFields || DEFAULT_PROGRESS)
    setMatchedFreelancers(session.matchedFreelancers || [])
    setProjectId(session.projectId)
    setOutreachStatus('idle')
    setSidebarView(null)

    // Fetch full session to get chat messages
    try {
      const full = await getAiChatSession(session.id)
      if (full.chatMessages && full.chatMessages.length > 0) {
        setMessages(full.chatMessages)
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  async function handleSendMessage(text?: string) {
    const content = text || message.trim()
    if (!content || isLoading || !user) return

    const userMsg: ChatMessage = { role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setMessage('')
    setIsLoading(true)

    try {
      const result = await sendAiChatMessage(content, user.id, sessionId || undefined)

      if (!sessionId) setSessionId(result.sessionId)

      setMessages(prev => [...prev, { role: 'assistant', content: result.text }])

      // Update progress from session state
      if (result.session.collectedFields) {
        setProgress(result.session.collectedFields)
      }
      if (result.session.matchedFreelancers) {
        setMatchedFreelancers(result.session.matchedFreelancers)
      }
      if (result.session.projectId) {
        setProjectId(result.session.projectId)
      }

      // Auto-open progress sidebar when matching completes
      if (result.toolsCalled.includes('search_and_match_freelancers')) {
        setSidebarView('progress')
      }

      // Refresh history so current session appears
      fetchHistory()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }

  // Trigger outreach with real data from matching
  const handleStartOutreach = useCallback(async () => {
    if (!projectId || matchedFreelancers.length === 0) return
    setOutreachStatus('sending')
    try {
      const freelancerIds = matchedFreelancers.map(f => f.userId)
      await triggerNegotiations(projectId, freelancerIds)
      setOutreachStatus('sent')
    } catch {
      setOutreachStatus('error')
    }
  }, [projectId, matchedFreelancers])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Skeleton loading screen until all data is pre-loaded
  if (!pageReady) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa]">
        <Header />
        <div className="flex-1 flex overflow-hidden relative w-full pt-16 animate-pulse">
          {/* Main chat area skeleton */}
          <main className="flex-1 flex flex-col h-full w-full">
            {/* Back button skeleton */}
            <div className="px-5 sm:px-8 pt-4">
              <div className="h-5 w-16 bg-[#ffffff]/[0.04] rounded-md" />
            </div>
            {/* Chat messages skeleton */}
            <div className="flex-1 px-5 sm:px-8 py-8 flex flex-col items-center">
              <div className="w-full max-w-3xl flex flex-col gap-10">
                {/* User message skeleton */}
                <div className="flex w-full justify-end">
                  <div className="bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.06] rounded-2xl rounded-tr-sm px-5 py-4 max-w-[75%]">
                    <div className="space-y-2">
                      <div className="h-3.5 w-72 bg-[#ffffff]/[0.06] rounded-md" />
                      <div className="h-3.5 w-56 bg-[#ffffff]/[0.06] rounded-md" />
                      <div className="h-3.5 w-40 bg-[#ffffff]/[0.06] rounded-md" />
                    </div>
                  </div>
                </div>
                {/* AI message skeleton */}
                <div className="flex w-full gap-4 sm:gap-6">
                  <div className="w-8 h-8 rounded-full bg-[#ffffff]/[0.06] shrink-0" />
                  <div className="flex flex-col gap-3 max-w-[80%]">
                    <div className="h-3.5 w-80 bg-[#ffffff]/[0.06] rounded-md" />
                    <div className="h-3.5 w-64 bg-[#ffffff]/[0.04] rounded-md" />
                    <div className="h-3.5 w-72 bg-[#ffffff]/[0.04] rounded-md" />
                    <div className="h-3.5 w-48 bg-[#ffffff]/[0.04] rounded-md" />
                  </div>
                </div>
                {/* Second user message skeleton */}
                <div className="flex w-full justify-end">
                  <div className="bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.06] rounded-2xl rounded-tr-sm px-5 py-4 max-w-[75%]">
                    <div className="space-y-2">
                      <div className="h-3.5 w-48 bg-[#ffffff]/[0.06] rounded-md" />
                      <div className="h-3.5 w-32 bg-[#ffffff]/[0.06] rounded-md" />
                    </div>
                  </div>
                </div>
                {/* Second AI message skeleton */}
                <div className="flex w-full gap-4 sm:gap-6">
                  <div className="w-8 h-8 rounded-full bg-[#ffffff]/[0.06] shrink-0" />
                  <div className="flex flex-col gap-3 max-w-[80%]">
                    <div className="h-3.5 w-72 bg-[#ffffff]/[0.06] rounded-md" />
                    <div className="h-3.5 w-80 bg-[#ffffff]/[0.04] rounded-md" />
                    <div className="h-3.5 w-56 bg-[#ffffff]/[0.04] rounded-md" />
                  </div>
                </div>
              </div>
            </div>
            {/* Input area skeleton */}
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
              <div className="w-full max-w-3xl mx-auto border border-[#ffffff]/[0.06] bg-[#000000] rounded-3xl">
                <div className="p-3 sm:p-5">
                  <div className="h-6 w-64 bg-[#ffffff]/[0.04] rounded-md" />
                </div>
                <div className="px-3 sm:px-5 pb-3 sm:pb-4 flex items-center justify-end gap-3">
                  <div className="h-4 w-12 bg-[#ffffff]/[0.04] rounded-md" />
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#ffffff]/[0.06] rounded-xl" />
                </div>
              </div>
            </div>
          </main>
          {/* Right sidebar skeleton (Move button area) */}
          <div className="fixed top-24 right-6">
            <div className="h-9 w-20 bg-[#ffffff]/[0.04] border border-[#ffffff]/[0.06] rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa] selection:bg-[#737373]/40 selection:text-[#ffffff]">
      <Header />

      <div className="flex-1 flex overflow-hidden relative w-full pt-16">
        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col h-full w-full transition-all duration-300 ease-in-out relative z-10">
          {/* Back Button */}
          <div className="px-5 sm:px-8 pt-4">
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="flex items-center gap-1.5 text-[#737373] hover:text-[#fafafa] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              <span className="text-sm">Back</span>
            </button>
          </div>
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-8 flex flex-col items-center">
            <div className="w-full max-w-3xl flex flex-col gap-10 pb-44">
              {messages.map((msg, i) => (
                msg.role === 'user' ? (
                  <UserMessage key={i} text={msg.content} />
                ) : (
                  <AIMessage key={i}>
                    <p className="text-[#fafafa] text-sm sm:text-base font-light leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </AIMessage>
                )
              ))}
              {isLoading && <AILoadingDots />}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Fixed Input Area at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 bg-gradient-to-t from-[#000000] via-[#000000]/90 to-transparent z-0">
            <div className="w-full max-w-3xl mx-auto flex flex-col focus-within:border-[#737373] focus-within:bg-[#0a0a0a] transition-all duration-300 border-[#737373]/30 border bg-[#000000] rounded-3xl shadow-2xl">
              <div className="p-3 sm:p-5">
                  <textarea
                    ref={textareaRef}
                    placeholder="Describe your project needs..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="bg-transparent border-none outline-none resize-none text-[#fafafa] placeholder:text-[#737373] w-full min-h-[24px] sm:min-h-[28px] text-base sm:text-lg font-light py-1 disabled:opacity-50"
                    rows={1}
                  />
              </div>

              <div className="px-3 sm:px-5 pb-3 sm:pb-4 flex items-center justify-end">
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="text-xs font-light text-[#737373]">{message.length}/1000</span>
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!message.trim() || isLoading}
                    className="bg-[#fafafa] text-[#000000] p-1.5 rounded-xl hover:opacity-80 transition-opacity flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" strokeWidth={1.5} />
                    ) : (
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar — overlay on mobile, push on desktop */}
        {sidebarView && (
          <div className="fixed inset-0 z-[90] bg-black/60 md:hidden" onClick={() => setSidebarView(null)} />
        )}
        <aside
          className={`
            ${sidebarView ? 'fixed inset-y-0 right-0 z-[95] w-[85vw] max-w-[340px] pt-16 md:pt-0 md:relative md:z-auto md:w-[340px]' : 'w-0 border-l-0'}
            h-full bg-[#050505] border-l border-[#ffffff]/10 transition-all duration-300 ease-in-out flex flex-col shrink-0 overflow-hidden
          `}
        >
          <div className="min-w-[85vw] max-w-[340px] md:min-w-[340px]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#ffffff]/10 shrink-0">
              <h2 className="text-xs font-medium tracking-widest text-[#fafafa] uppercase">
                {sidebarView === 'history' ? 'History' : 'Progress'}
              </h2>
              <button
                type="button"
                onClick={() => setSidebarView(null)}
                className="text-[#a6a6a6] hover:text-[#fafafa] transition-colors flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffffff]/5 hover:bg-[#ffffff]/10 border border-[#ffffff]/10 text-xs font-light shadow-sm cursor-pointer"
              >
                <span>Close</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 64px - 62px)' }}>
              {sidebarView === 'history' && (
                <HistoryView
                  sessions={historySessions}
                  activeSessionId={sessionId}
                  onSelectSession={handleSelectSession}
                />
              )}
              {sidebarView === 'progress' && (
                <ProgressView
                  progress={progress}
                  matchedFreelancers={matchedFreelancers}
                  onStartOutreach={handleStartOutreach}
                  outreachStatus={outreachStatus}
                />
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Floating "Move" Dropdown */}
      <div className={`fixed top-24 right-6 flex flex-col items-end z-40 transition-opacity duration-200 ${sidebarView ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="bg-[#1a1a1a] border border-[#ffffff]/10 hover:border-[#ffffff]/30 text-[#fafafa] px-4 py-2 rounded-full flex items-center gap-2 shadow-lg transition-colors text-sm font-light cursor-pointer"
        >
          Move
          <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full mt-2 right-0 w-48 bg-[#0a0a0a] border border-[#ffffff]/10 rounded-xl shadow-2xl py-1 animate-[fadeIn_0.2s_ease_forwards]">
            <button
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm font-light text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <SquarePen className="w-[18px] h-[18px]" strokeWidth={1.5} />
              New Chat
            </button>
            <div className="h-px w-full bg-[#ffffff]/5 my-1" />
            <button
              type="button"
              onClick={() => { setSidebarView('history'); setDropdownOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm font-light text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <History className="w-[18px] h-[18px]" strokeWidth={1.5} />
              History
            </button>
            <button
              type="button"
              onClick={() => { setSidebarView('progress'); setDropdownOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm font-light text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <ListChecks className="w-[18px] h-[18px]" strokeWidth={1.5} />
              Progress
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
