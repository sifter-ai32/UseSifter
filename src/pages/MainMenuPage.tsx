import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Search,
  DollarSign,
  Paintbrush,
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
import FreelancerProfilePanel from '@/components/FreelancerProfilePanel'
import { useAuthStore } from '@/stores/authStore'
import { sendAiChatMessage, triggerNegotiations, listAiChatSessions, getAiChatSession } from '@/lib/api'
import type { MatchedFreelancerInfo, AiChatSessionListItem } from '@/lib/api'

// ────────────────────────────────────────────────────────────────────────────
// Shared UI Components
// ────────────────────────────────────────────────────────────────────────────

function LogoIcon({ size = 14 }: { size?: number }) {
  return <img src="/sifter-logo.png" alt="Sifter" style={{ width: size, height: size }} />
}

function WordSpan({ word, delay }: { word: string; delay: number }) {
  return (
    <span
      className="inline-block opacity-0 whitespace-pre animate-[fadeUp_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]"
      style={{ animationDelay: `${delay}s` }}
    >
      {word}{' '}
    </span>
  )
}

interface PromptCardProps {
  icon: React.ReactNode
  text: string
  onClick: () => void
}

function PromptCard({ icon, text, onClick }: PromptCardProps) {
  return (
    <div onClick={onClick} className="border border-[#737373]/20 bg-[#ffffff]/[0.02] rounded-2xl p-4 sm:p-5 flex flex-col justify-between items-start min-h-[110px] sm:min-h-[130px] hover:bg-[#ffffff]/[0.05] hover:border-[#737373]/40 transition-all duration-300 cursor-pointer group gap-3">
      <span className="text-[#737373] group-hover:text-[#fafafa] transition-colors">
        {icon}
      </span>
      <p className="text-sm sm:text-base text-[#fafafa] font-extralight leading-snug">
        {text}
      </p>
    </div>
  )
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

// ────────────────────────────────────────────────────────────────────────────
// Sidebar Components
// ────────────────────────────────────────────────────────────────────────────

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
                    {s.title || s.project?.title || 'New project'}
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

function ProgressView({ progress, matchedFreelancers, selectedFreelancers, onToggleFreelancer, onViewProfile, onStartOutreach, outreachStatus }: {
  progress: ProgressFields
  matchedFreelancers: MatchedFreelancerInfo[]
  selectedFreelancers: Set<string>
  onToggleFreelancer: (userId: string) => void
  onViewProfile: (userId: string) => void
  onStartOutreach: () => void
  outreachStatus: 'idle' | 'sending' | 'sent' | 'error'
}) {
  const selectedCount = selectedFreelancers.size
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1 mb-8">
        <h3 className="text-sm font-medium text-[#fafafa] tracking-tight">Project Sourcing</h3>
        <p className="text-xs font-extralight text-[#a6a6a6]">Gathering requirements and matching candidates.</p>
      </div>

      <div className="flex flex-col mb-6 ml-1">
        <ProgressStep done={progress.scope} title="Project Scope" subtitle="What needs to be built" />
        <ProgressStep done={progress.skills} title="Skills Needed" subtitle="Tools and expertise required" />
        <ProgressStep done={progress.budget} title="Budget" subtitle="Payment range and structure" />
        <ProgressStep done={progress.timeline} title="Timeline" subtitle="Start date and deadline" />
        <ProgressStep done={progress.preferences} title="Preferences" subtitle="Experience and communication style" />
        <ProgressStep done={progress.confirmed} title="Final Confirmation" subtitle={progress.confirmed ? 'Requirements logged successfully' : 'Waiting for confirmation'} />
      </div>

      <div className="flex flex-col mb-6 ml-1">
        <ProgressStep done={progress.matching_started} title="Matching" subtitle={progress.matching_started ? 'Filtering out to find the best' : 'Waiting for requirements'} />
        <ProgressStep done={progress.matching_complete} title="Shortlisting to top 5" subtitle={progress.matching_complete ? 'Finalists selected' : 'Curating the finalists'} />
        <ProgressStep done={outreachStatus === 'sent'} last title="Outreach" subtitle={
          outreachStatus === 'sending' ? 'Reaching out now...' :
          outreachStatus === 'sent' ? 'Outreach sent' :
          'Select profiles and start outreach'
        } />
      </div>

      {outreachStatus === 'sent' && (
        <div className="mb-8 ml-1 flex items-center gap-2 p-3 rounded-xl bg-[#ffffff]/5 border border-[#ffffff]/10">
          <Check className="w-4 h-4 text-[#fafafa]" />
          <span className="text-sm font-light text-[#a6a6a6]">Outreach sent! Freelancers will respond in Opportunities.</span>
        </div>
      )}

      {matchedFreelancers.length > 0 && (
        <div className="flex flex-col pt-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-[18px] h-[18px] text-[#fafafa]" strokeWidth={1.5} />
              <h4 className="text-sm font-medium tracking-tight text-[#fafafa]">Top {matchedFreelancers.length} Shortlisted</h4>
            </div>
            {outreachStatus !== 'sent' && (
              <span className="text-xs font-light text-[#737373]">{selectedCount} selected</span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {matchedFreelancers.map((f) => {
              const initials = f.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              const isSelected = selectedFreelancers.has(f.userId)
              return (
                <div key={f.userId} className="flex flex-col gap-2 p-3 rounded-xl bg-[#ffffff]/5 border border-[#ffffff]/10 hover:bg-[#ffffff]/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onViewProfile(f.userId)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#ffffff]/20 flex items-center justify-center text-[#fafafa] text-xs font-medium shrink-0 overflow-hidden">
                        {f.avatar ? (
                          <img src={f.avatar} alt={f.name} className="w-full h-full object-cover" />
                        ) : initials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-[#fafafa] hover:underline">
                          {f.name}
                        </span>
                        <span className="text-xs font-light text-[#737373] truncate">{f.title || 'Freelancer'}</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-light text-[#a6a6a6]">{f.score}%</span>
                      {outreachStatus !== 'sent' && (
                        <button
                          type="button"
                          onClick={() => onToggleFreelancer(f.userId)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#fafafa] border-[#fafafa]'
                              : 'border-[#737373]/40 hover:border-[#737373]'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-[#000000]" strokeWidth={2.5} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {progress.matching_complete && outreachStatus !== 'sent' && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onStartOutreach}
                disabled={outreachStatus === 'sending' || selectedCount === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#fafafa] text-[#000000] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                {outreachStatus === 'sending' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending outreach...
                  </>
                ) : outreachStatus === 'error' ? (
                  'Retry Outreach'
                ) : selectedCount === 0 ? (
                  'Select profiles to outreach'
                ) : (
                  `Start Outreach to ${selectedCount} Selected`
                )}
              </button>
              {outreachStatus === 'error' && (
                <p className="text-xs text-red-400 mt-2 text-center">Failed to send outreach. Please try again.</p>
              )}
            </div>
          )}
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

export default function MainMenuPage() {
  const { user } = useAuthStore()
  const userName = user?.name || 'User'

  // Chat state
  const [chatStarted, setChatStarted] = useState(false)
  const hasAnimatedRef = useRef(false) // tracks if welcome entrance animation already played
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressFields>(DEFAULT_PROGRESS)
  const [matchedFreelancers, setMatchedFreelancers] = useState<MatchedFreelancerInfo[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [outreachStatus, setOutreachStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [selectedFreelancers, setSelectedFreelancers] = useState<Set<string>>(new Set())
  const [profilePanelId, setProfilePanelId] = useState<string | null>(null)

  // Sidebar state
  const [sidebarView, setSidebarView] = useState<SidebarView>(null)
  const [sidebarReady, setSidebarReady] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [historySessions, setHistorySessions] = useState<AiChatSessionListItem[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Push history state when chat starts, handle browser back button
  useEffect(() => {
    if (chatStarted) {
      window.history.pushState({ chatStarted: true }, '')
    }
  }, [chatStarted])

  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      if (chatStarted && (!e.state || !e.state.chatStarted)) {
        e.preventDefault()
        handleNewChat()
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatStarted])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatStarted) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, chatStarted])

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

  // Pre-fetch history on mount so it's ready when sidebar opens
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Delay content render until sidebar transition completes
  useEffect(() => {
    if (sidebarView) {
      const timer = setTimeout(() => setSidebarReady(true), 320)
      return () => clearTimeout(timer)
    }
    setSidebarReady(false)
  }, [sidebarView])

  // Refresh history when sidebar opens (keeps existing data visible until fetch completes)
  useEffect(() => {
    if (sidebarView === 'history') fetchHistory()
  }, [sidebarView, fetchHistory])

  // Load a past session's state including chat messages
  async function handleSelectSession(session: AiChatSessionListItem) {
    setSessionId(session.id)
    setProgress(session.collectedFields || DEFAULT_PROGRESS)
    setMatchedFreelancers(session.matchedFreelancers || [])
    setSelectedFreelancers(new Set((session.matchedFreelancers || []).map(f => f.userId)))
    setProjectId(session.projectId)
    setOutreachStatus('idle')
    setSidebarView(null)
    setChatStarted(true)

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

    // Transition to chat view on first message
    if (!chatStarted) {
      hasAnimatedRef.current = true
      setChatStarted(true)
    }

    const userMsg: ChatMessage = { role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setMessage('')
    setIsLoading(true)

    try {
      const result = await sendAiChatMessage(content, user.id, sessionId || undefined)

      if (!sessionId) setSessionId(result.sessionId)

      setMessages(prev => [...prev, { role: 'assistant', content: result.text }])

      if (result.session.collectedFields) {
        setProgress(result.session.collectedFields)
      }
      if (result.session.matchedFreelancers) {
        setMatchedFreelancers(result.session.matchedFreelancers)
        setSelectedFreelancers(new Set(result.session.matchedFreelancers.map((f: MatchedFreelancerInfo) => f.userId)))
      }
      if (result.session.projectId) {
        setProjectId(result.session.projectId)
      }

      // Auto-open progress sidebar when matching completes
      if (result.toolsCalled.includes('search_and_match_freelancers')) {
        setSidebarView('progress')
      }

      // Auto-update outreach status when AI triggers outreach
      if (result.toolsCalled.includes('start_outreach')) {
        setOutreachStatus('sent')
      }

      fetchHistory()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }

  // Start a new chat — reset everything back to welcome view
  function handleNewChat() {
    setChatStarted(false)
    setMessages([])
    setMessage('')
    setSessionId(null)
    setProgress(DEFAULT_PROGRESS)
    setMatchedFreelancers([])
    setSelectedFreelancers(new Set())
    setProjectId(null)
    setOutreachStatus('idle')
    setSidebarView(null)
    setDropdownOpen(false)
  }

  // Toggle freelancer selection
  function handleToggleFreelancer(userId: string) {
    setSelectedFreelancers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  // Trigger outreach — only for selected freelancers
  const handleStartOutreach = useCallback(async () => {
    if (!projectId || selectedFreelancers.size === 0) return
    setOutreachStatus('sending')
    try {
      const freelancerIds = Array.from(selectedFreelancers)
      await triggerNegotiations(projectId, freelancerIds)
      setOutreachStatus('sent')
    } catch {
      setOutreachStatus('error')
    }
  }, [projectId, selectedFreelancers])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  function handlePromptClick(text: string) {
    setMessage(text)
    textareaRef.current?.focus()
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#000000] text-[#fafafa] selection:bg-[#737373]/40 selection:text-[#ffffff]">
      <Header />

      <div className="flex-1 flex overflow-hidden relative w-full pt-16">
        <main className="flex-1 flex flex-col h-full w-full relative z-10">
          {/* Welcome layer — fades out cleanly */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center px-5 sm:px-8 transition-all duration-300 ease-out ${
              chatStarted ? 'opacity-0 -translate-y-3 pointer-events-none' : 'opacity-100 translate-y-0'
            }`}
          >
            <div className="flex flex-col gap-8 sm:gap-12 w-full max-w-[760px]">
              {/* Heading */}
              <div className="flex flex-col gap-x-4 gap-y-4">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-[#fafafa] leading-[1.15] flex flex-col">
                  <div className="w-full">
                    {['Hi', 'there,'].map((word, i) => (
                      <WordSpan key={word} word={word} delay={0.1 + i * 0.1} />
                    ))}
                    <WordSpan word={userName} delay={0.3} />
                  </div>
                  <div className="w-full text-[#a6a6a6]">
                    {['Tell', 'me', 'about', 'your', 'requirements'].map((word, i) => (
                      <WordSpan key={word} word={word} delay={1.0 + i * 0.1} />
                    ))}
                  </div>
                </h1>
              </div>

              {/* Cards */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 ${
                  !chatStarted && !hasAnimatedRef.current ? 'opacity-0 animate-[fadeUp_1.5s_cubic-bezier(0.16,1,0.3,1)_forwards]' : ''
                }`}
                style={!chatStarted && !hasAnimatedRef.current ? { animationDelay: '2.3s' } : undefined}
              >
                <PromptCard
                  icon={<Search className="w-5 h-5" strokeWidth={1.5} />}
                  text="Help me find the right freelancer for my task"
                  onClick={() => handlePromptClick('Help me find the right freelancer for my task')}
                />
                <PromptCard
                  icon={<DollarSign className="w-5 h-5" strokeWidth={1.5} />}
                  text="I need to hire within a specific budget"
                  onClick={() => handlePromptClick('I need to hire within a specific budget')}
                />
                <PromptCard
                  icon={<Paintbrush className="w-5 h-5" strokeWidth={1.5} />}
                  text="I'm looking for a designer for my project"
                  onClick={() => handlePromptClick("I'm looking for a designer for my project")}
                />
              </div>

              {/* Welcome input */}
              <div
                className={`border border-[#737373]/30 rounded-3xl bg-[#ffffff]/[0.03] flex flex-col focus-within:border-[#737373] focus-within:bg-[#ffffff]/[0.05] transition-colors duration-300 shadow-lg mt-0 sm:mt-2 ${
                  !chatStarted && !hasAnimatedRef.current ? 'opacity-0 animate-[fadeUp_1.5s_cubic-bezier(0.16,1,0.3,1)_forwards]' : ''
                }`}
                style={!chatStarted && !hasAnimatedRef.current ? { animationDelay: '2.9s' } : undefined}
              >
                <div className="p-3 sm:p-5">
                  <textarea
                    ref={!chatStarted ? textareaRef : undefined}
                    placeholder="Ask whatever you want..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-none outline-none resize-none text-[#fafafa] placeholder:text-[#737373] w-full min-h-[40px] sm:min-h-[56px] text-base sm:text-lg font-extralight py-1"
                    rows={1}
                  />
                </div>
                <div className="px-3 sm:px-5 pb-3 sm:pb-4 flex items-center justify-end">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <span className="text-xs sm:text-sm font-extralight text-[#737373]">{message.length}/1000</span>
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!message.trim()}
                      className="bg-[#fafafa] text-[#000000] p-1.5 rounded-xl hover:opacity-80 transition-opacity flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat layer — fades in cleanly */}
          <div
            className={`absolute inset-0 flex flex-col transition-all duration-500 ease-out delay-150 ${
              chatStarted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
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

            {/* Chat input */}
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 bg-gradient-to-t from-[#000000] via-[#000000]/90 to-transparent">
              <div className="w-full max-w-3xl mx-auto flex flex-col transition-all duration-300 border-[#737373]/30 border bg-[#000000] focus-within:border-[#737373] focus-within:bg-[#0a0a0a] rounded-3xl shadow-2xl">
                <div className="p-3 sm:p-5">
                  <textarea
                    ref={chatStarted ? textareaRef : undefined}
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
          <div className="min-w-[85vw] max-w-[340px] md:min-w-[340px] h-full flex flex-col">
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
            <div className="flex-1 overflow-y-auto p-6">
              {sidebarReady && sidebarView === 'history' && (
                <HistoryView
                  sessions={historySessions}
                  activeSessionId={sessionId}
                  onSelectSession={handleSelectSession}
                />
              )}
              {sidebarReady && sidebarView === 'progress' && (
                <ProgressView
                  progress={progress}
                  matchedFreelancers={matchedFreelancers}
                  selectedFreelancers={selectedFreelancers}
                  onToggleFreelancer={handleToggleFreelancer}
                  onViewProfile={(id) => setProfilePanelId(id)}
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
            {chatStarted && (
              <>
                <button
                  type="button"
                  onClick={() => { handleNewChat() }}
                  className="w-full text-left px-4 py-2.5 text-sm font-light text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <SquarePen className="w-[18px] h-[18px]" strokeWidth={1.5} />
                  New Chat
                </button>
                <div className="h-px w-full bg-[#ffffff]/5 my-1" />
              </>
            )}
            <button
              type="button"
              onClick={() => { setSidebarView('history'); setDropdownOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm font-light text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <History className="w-[18px] h-[18px]" strokeWidth={1.5} />
              History
            </button>
            {chatStarted && (
              <button
                type="button"
                onClick={() => { setSidebarView('progress'); setDropdownOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm font-light text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <ListChecks className="w-[18px] h-[18px]" strokeWidth={1.5} />
                Progress
              </button>
            )}
          </div>
        )}
      </div>

      <FreelancerProfilePanel
        freelancerId={profilePanelId}
        onClose={() => setProfilePanelId(null)}
      />
    </div>
  )
}
