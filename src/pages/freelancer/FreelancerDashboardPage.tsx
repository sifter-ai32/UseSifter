import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FolderOpen, Wallet, Clock, TrendingUp, ArrowRight, ArrowUpRight, Loader2, Briefcase, ChevronDown, MessageSquare, CheckCircle2, Circle, User } from 'lucide-react'
import Header from '@/components/layout/Header'
import { useAuthStore } from '@/stores/authStore'
import { getFreelancerDashboard } from '@/lib/api'
import type { FreelancerDashboardProject } from '@/lib/api'

function fmt(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return days === 1 ? '1d' : `${days}d`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function phaseStatusIcon(status: string) {
  if (['Approved', 'AutoReleased'].includes(status)) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
  if (status === 'Submitted') return <Clock className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
  if (status === 'Disputed') return <Circle className="w-3.5 h-3.5 text-red-400" strokeWidth={1.5} />
  return <Circle className="w-3.5 h-3.5 text-[#525252]" strokeWidth={1.5} />
}

// ── Expandable Project Card ──
function ProjectCard({ project }: { project: FreelancerDashboardProject }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="border border-[#ffffff]/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-[#ffffff]/20 bg-[#ffffff]/[0.02]">
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer hover:bg-[#ffffff]/[0.04] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-[#fafafa] truncate">{project.title}</h4>
          <p className="text-xs text-[#737373] mt-1">{project.clientName} · {project.completedPhases}/{project.totalPhases} phases</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-2 w-32">
            <div className="h-[3px] flex-1 bg-[#ffffff]/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-[#fafafa] rounded-full transition-all duration-500" style={{ width: `${project.progress}%` }} />
            </div>
            <span className="text-xs text-[#a6a6a6] w-8 text-right">{project.progress}%</span>
          </div>
          {project.dueDate && <span className="text-[11px] text-[#737373] uppercase tracking-wider hidden sm:block">{fmtDate(project.dueDate)}</span>}
          <ChevronDown className={`w-4 h-4 text-[#737373] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-[#ffffff]/[0.06] px-5 py-5 flex flex-col gap-4">
          {/* Info row */}
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs">
            <div>
              <span className="text-[#737373]">Status</span>
              <p className="text-[#fafafa] font-medium mt-1">{project.status}</p>
            </div>
            <div>
              <span className="text-[#737373]">Total Value</span>
              <p className="text-[#fafafa] font-medium mt-1">{fmt(project.totalAmount)}</p>
            </div>
            <div>
              <span className="text-[#737373]">Started</span>
              <p className="text-[#fafafa] font-medium mt-1">{fmtDate(project.createdAt)}</p>
            </div>
            <div>
              <span className="text-[#737373]">Client</span>
              <p className="text-[#fafafa] font-medium mt-1">{project.clientName}</p>
            </div>
          </div>

          {project.description && (
            <p className="text-sm text-[#737373] leading-relaxed">{project.description}</p>
          )}

          {/* Phase timeline */}
          <div className="flex flex-col gap-1">
            <p className="text-xs text-[#737373] uppercase tracking-widest mb-2 font-medium">Milestones</p>
            {project.phases.map((phase) => (
              <div key={phase.index} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-[#ffffff]/[0.04] transition-colors">
                {phaseStatusIcon(phase.status)}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[#e5e5e5] truncate block">{phase.description}</span>
                </div>
                <span className="text-xs text-[#737373] shrink-0">{fmtDate(phase.deadline)}</span>
                <span className="text-xs text-[#a6a6a6] shrink-0 w-16 text-right">{fmt(phase.amount)}</span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                  ['Approved', 'AutoReleased'].includes(phase.status) ? 'text-emerald-400 bg-emerald-400/10'
                  : phase.status === 'Submitted' ? 'text-amber-400 bg-amber-400/10'
                  : phase.status === 'Disputed' ? 'text-red-400 bg-red-400/10'
                  : 'text-[#737373] bg-[#ffffff]/[0.05]'
                }`}>{phase.status === 'AutoReleased' ? 'Released' : phase.status}</span>
              </div>
            ))}
          </div>

          {/* Action */}
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/freelancer/dealroom') }}
            className="self-start text-sm text-[#000000] bg-[#fafafa] rounded-full px-5 py-2 font-medium hover:bg-[#a6a6a6] transition-colors cursor-pointer flex items-center gap-2"
          >
            Open Deal Room <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}

function ProjectList({ projects, onCardsHeight }: { projects: FreelancerDashboardProject[]; onCardsHeight?: (h: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? projects : projects.slice(0, 3)
  const hasMore = projects.length > 3
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cardsRef.current && onCardsHeight) {
      onCardsHeight(cardsRef.current.offsetHeight)
    }
  })

  return (
    <div className="flex flex-col">
      <div ref={cardsRef} className="flex flex-col gap-3">
        {visible.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[#737373] hover:text-[#fafafa] transition-colors py-3 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {expanded ? 'Show less' : `Show ${projects.length - 3} more`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}

export default function FreelancerDashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const userName = user?.name || 'Freelancer'
  const userId = user?.id
  const [projectsHeight, setProjectsHeight] = useState(0)


  const { data: liveData, isLoading } = useQuery({
    queryKey: ['freelancer-dashboard', userId],
    queryFn: () => getFreelancerDashboard(userId!),
    enabled: !!userId,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  })

  const FORCE_DUMMY = import.meta.env.VITE_FORCE_DUMMY === 'true'

  const data = liveData ? {
    ...liveData,
    totalEarnings: FORCE_DUMMY ? 12480.50 : (liveData.totalEarnings || 12480.50),
    monthEarnings: FORCE_DUMMY ? 4500.00 : (liveData.monthEarnings || 4500.00),
    pendingClearance: FORCE_DUMMY ? 850.00 : (liveData.pendingClearance || 850.00),
    activeProjectCount: FORCE_DUMMY ? 7 : (liveData.activeProjectCount || 3),
    profileCompleteness: FORCE_DUMMY ? 78 : liveData.profileCompleteness,
    projects: (!FORCE_DUMMY && liveData.projects.length > 0) ? liveData.projects : [
      { id: 'p1', title: 'DeFi Protocol V2 UI', description: 'Complete frontend overhaul using React and ethers.js, focusing on staking pools.', clientName: 'Sarah Jenkins', clientAvatar: null, progress: 65, currentPhaseName: 'Design', dueDate: '2026-04-15', totalPhases: 4, completedPhases: 2, status: 'Active', totalAmount: 8500, createdAt: '2026-02-01T00:00:00Z', phases: [
        { index: 0, description: 'Discovery & Research', status: 'Approved', amount: 1500, deadline: '2026-02-15T00:00:00Z' },
        { index: 1, description: 'Wireframes & Design', status: 'Approved', amount: 2000, deadline: '2026-03-01T00:00:00Z' },
        { index: 2, description: 'Frontend Development', status: 'Submitted', amount: 3000, deadline: '2026-04-01T00:00:00Z' },
        { index: 3, description: 'Testing & Launch', status: 'Pending', amount: 2000, deadline: '2026-04-15T00:00:00Z' },
      ]},
      { id: 'p2', title: 'NFT Marketplace Audit', description: 'Security audit of ERC-721 implementation and custom royalty contracts.', clientName: 'Mike Chen', clientAvatar: null, progress: 90, currentPhaseName: 'Final Review', dueDate: '2026-04-02', totalPhases: 3, completedPhases: 2, status: 'Active', totalAmount: 4500, createdAt: '2026-03-01T00:00:00Z', phases: [
        { index: 0, description: 'Initial Audit', status: 'Approved', amount: 1500, deadline: '2026-03-10T00:00:00Z' },
        { index: 1, description: 'Vulnerability Report', status: 'Approved', amount: 1500, deadline: '2026-03-20T00:00:00Z' },
        { index: 2, description: 'Final Review & Sign-off', status: 'Submitted', amount: 1500, deadline: '2026-04-02T00:00:00Z' },
      ]},
      { id: 'p3', title: 'Layer 2 Bridge Interface', description: 'UX design and component library setup for cross-chain token transfers.', clientName: 'Alex Rivera', clientAvatar: null, progress: 25, currentPhaseName: 'Wireframes', dueDate: '2026-04-28', totalPhases: 5, completedPhases: 1, status: 'Active', totalAmount: 12000, createdAt: '2026-03-10T00:00:00Z', phases: [
        { index: 0, description: 'Research & Architecture', status: 'Approved', amount: 2000, deadline: '2026-03-20T00:00:00Z' },
        { index: 1, description: 'Wireframes', status: 'Pending', amount: 2000, deadline: '2026-04-01T00:00:00Z' },
        { index: 2, description: 'UI Design', status: 'Pending', amount: 3000, deadline: '2026-04-10T00:00:00Z' },
        { index: 3, description: 'Component Library', status: 'Pending', amount: 3000, deadline: '2026-04-20T00:00:00Z' },
        { index: 4, description: 'Integration & QA', status: 'Pending', amount: 2000, deadline: '2026-04-28T00:00:00Z' },
      ]},
      { id: 'p4', title: 'DAO Governance Dashboard', description: 'Voting interface and proposal creation flow for community members.', clientName: 'Lisa Park', clientAvatar: null, progress: 40, currentPhaseName: 'Development', dueDate: '2026-05-10', totalPhases: 4, completedPhases: 1, status: 'Active', totalAmount: 9200, createdAt: '2026-03-05T00:00:00Z', phases: [
        { index: 0, description: 'Requirements & Design', status: 'Approved', amount: 2200, deadline: '2026-03-20T00:00:00Z' },
        { index: 1, description: 'Smart Contract Integration', status: 'Submitted', amount: 2500, deadline: '2026-04-10T00:00:00Z' },
        { index: 2, description: 'Frontend Build', status: 'Pending', amount: 2500, deadline: '2026-04-25T00:00:00Z' },
        { index: 3, description: 'Testing & Deployment', status: 'Pending', amount: 2000, deadline: '2026-05-10T00:00:00Z' },
      ]},
      { id: 'p5', title: 'Mobile Crypto Wallet', description: 'React Native app for multi-chain asset management with biometric auth.', clientName: 'David Kim', clientAvatar: null, progress: 10, currentPhaseName: 'Architecture', dueDate: '2026-06-01', totalPhases: 6, completedPhases: 0, status: 'Funded', totalAmount: 18000, createdAt: '2026-03-25T00:00:00Z', phases: [
        { index: 0, description: 'Architecture & Setup', status: 'Pending', amount: 2500, deadline: '2026-04-05T00:00:00Z' },
        { index: 1, description: 'Core Wallet Features', status: 'Pending', amount: 4000, deadline: '2026-04-20T00:00:00Z' },
        { index: 2, description: 'Multi-chain Support', status: 'Pending', amount: 3500, deadline: '2026-05-01T00:00:00Z' },
        { index: 3, description: 'UI/UX Polish', status: 'Pending', amount: 3000, deadline: '2026-05-12T00:00:00Z' },
        { index: 4, description: 'Security Audit', status: 'Pending', amount: 2500, deadline: '2026-05-22T00:00:00Z' },
        { index: 5, description: 'App Store Launch', status: 'Pending', amount: 2500, deadline: '2026-06-01T00:00:00Z' },
      ]},
      { id: 'p6', title: 'Token Launchpad Platform', description: 'Full-stack platform for IDO token launches with KYC integration.', clientName: 'James Wright', clientAvatar: null, progress: 55, currentPhaseName: 'Backend API', dueDate: '2026-04-20', totalPhases: 3, completedPhases: 1, status: 'Active', totalAmount: 7500, createdAt: '2026-02-15T00:00:00Z', phases: [
        { index: 0, description: 'Smart Contracts', status: 'Approved', amount: 2500, deadline: '2026-03-10T00:00:00Z' },
        { index: 1, description: 'Backend API & KYC', status: 'Submitted', amount: 2500, deadline: '2026-04-01T00:00:00Z' },
        { index: 2, description: 'Frontend & Launch', status: 'Pending', amount: 2500, deadline: '2026-04-20T00:00:00Z' },
      ]},
      { id: 'p7', title: 'DeFi Analytics Dashboard', description: 'Real-time analytics for DeFi portfolio tracking across protocols.', clientName: 'Emma Stone', clientAvatar: null, progress: 80, currentPhaseName: 'QA Testing', dueDate: '2026-04-05', totalPhases: 4, completedPhases: 3, status: 'Active', totalAmount: 6000, createdAt: '2026-01-20T00:00:00Z', phases: [
        { index: 0, description: 'Data Pipeline Setup', status: 'Approved', amount: 1500, deadline: '2026-02-10T00:00:00Z' },
        { index: 1, description: 'Dashboard Charts', status: 'Approved', amount: 1500, deadline: '2026-02-28T00:00:00Z' },
        { index: 2, description: 'Portfolio Tracking', status: 'Approved', amount: 1500, deadline: '2026-03-15T00:00:00Z' },
        { index: 3, description: 'QA & Performance', status: 'Submitted', amount: 1500, deadline: '2026-04-05T00:00:00Z' },
      ]},
    ],
    transactions: (!FORCE_DUMMY && liveData.transactions.length > 0) ? liveData.transactions : [
      { id: 't1', date: '2026-03-28T00:00:00Z', project: 'DeFi Protocol UI', amount: 6450, txHash: '0x123' },
      { id: 't2', date: '2026-03-15T00:00:00Z', project: 'NFT Marketplace Audit', amount: 450, txHash: '0x456' },
      { id: 't3', date: '2026-03-01T00:00:00Z', project: 'Smart Contract Dev', amount: 2100, txHash: '' },
      { id: 't4', date: '2026-02-20T00:00:00Z', project: 'DAO Governance', amount: 2200, txHash: '0x789' },
      { id: 't5', date: '2026-02-10T00:00:00Z', project: 'Token Launchpad', amount: 2500, txHash: '0xabc' },
      { id: 't6', date: '2026-01-28T00:00:00Z', project: 'DeFi Analytics', amount: 1500, txHash: '0xdef' },
      { id: 't7', date: '2026-01-15T00:00:00Z', project: 'Layer 2 Bridge', amount: 2000, txHash: '0xghi' },
      { id: 't8', date: '2026-01-05T00:00:00Z', project: 'Mobile Wallet Research', amount: 3200, txHash: '0xjkl' },
    ],
    recentMessages: (!FORCE_DUMMY && liveData.recentMessages.length > 0) ? liveData.recentMessages : [
      { id: 'm1', dealRoomId: '', senderName: 'Sarah Jenkins', senderAvatar: null, senderInitials: 'SJ', content: 'Are we still on track for the delivery this evening?', createdAt: new Date(Date.now() - 600000).toISOString(), isMe: false },
      { id: 'm2', dealRoomId: '', senderName: 'Mike Chen', senderAvatar: null, senderInitials: 'MC', content: 'Thanks for the update. Looks great so far.', createdAt: new Date(Date.now() - 7200000).toISOString(), isMe: false },
      { id: 'm3', dealRoomId: '', senderName: 'Alex Rivera', senderAvatar: null, senderInitials: 'AR', content: 'Can we schedule a quick call to discuss the revised scope?', createdAt: new Date(Date.now() - 86400000).toISOString(), isMe: false },
      { id: 'm4', dealRoomId: '', senderName: 'Lisa Park', senderAvatar: null, senderInitials: 'LP', content: 'I reviewed the latest mockups — the voting page needs some tweaks.', createdAt: new Date(Date.now() - 172800000).toISOString(), isMe: false },
      { id: 'm5', dealRoomId: '', senderName: 'David Kim', senderAvatar: null, senderInitials: 'DK', content: 'Welcome aboard! Excited to get started on the wallet project.', createdAt: new Date(Date.now() - 259200000).toISOString(), isMe: false },
      { id: 'm6', dealRoomId: '', senderName: 'James Wright', senderAvatar: null, senderInitials: 'JW', content: 'The KYC integration docs are attached. Let me know if anything is unclear.', createdAt: new Date(Date.now() - 345600000).toISOString(), isMe: false },
      { id: 'm7', dealRoomId: '', senderName: 'Emma Stone', senderAvatar: null, senderInitials: 'ES', content: 'QA found a couple of issues on the chart rendering, details in the thread.', createdAt: new Date(Date.now() - 432000000).toISOString(), isMe: false },
    ],
    proposals: (!FORCE_DUMMY && liveData.proposals.length > 0) ? liveData.proposals : [
      { id: 'pr1', title: 'Mobile Wallet App Redesign', status: 'Accepted', amount: 8500, rateType: 'fixed' },
      { id: 'pr2', title: 'E-commerce Backend Migration', status: 'Pending', amount: 12000, rateType: 'fixed' },
      { id: 'pr3', title: 'SaaS Dashboard Components', status: 'Pending', amount: 75, rateType: 'hourly' },
      { id: 'pr4', title: 'Cross-chain DEX Interface', status: 'Accepted', amount: 15000, rateType: 'fixed' },
      { id: 'pr5', title: 'AI Chatbot Integration', status: 'Rejected', amount: 3200, rateType: 'fixed' },
      { id: 'pr6', title: 'Staking Pool Frontend', status: 'Pending', amount: 90, rateType: 'hourly' },
      { id: 'pr7', title: 'Corporate Branding Kit', status: 'Rejected', amount: 1500, rateType: 'fixed' },
    ],
    agenda: [],
  } : null

  if (isLoading || !data) {
    return (
      <div className="min-h-screen w-full bg-[#000000] text-[#fafafa] antialiased">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-5 h-5 animate-spin text-[#737373]" />
        </div>
      </div>
    )
  }

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen w-full bg-[#000000] text-[#fafafa] antialiased selection:bg-[#ffffff]/20 overflow-x-hidden">
      <Header />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">

        {/* ── HERO ── */}
        <div className="mb-10">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-[#737373] tracking-wide mb-1">{dateStr}</p>
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#fafafa]">
                {greeting()}, <span>{userName.split(' ')[0]}</span>
              </h1>
            </div>
          </div>

          {(data.profileCompleteness ?? 100) < 100 && (
            <div className="mt-6 flex items-center gap-5 border border-[#ffffff]/10 rounded-2xl px-5 py-4 hover:border-[#ffffff]/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#a6a6a6]">Profile Completeness</span>
                  <span className="text-sm text-[#fafafa] font-medium">{data.profileCompleteness}%</span>
                </div>
                <div className="h-[3px] w-full bg-[#ffffff]/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-[#fafafa] rounded-full transition-all duration-700" style={{ width: `${data.profileCompleteness}%` }} />
                </div>
              </div>
              <button
                onClick={() => navigate('/freelancer/profile')}
                className="text-sm text-[#000000] bg-[#fafafa] rounded-full px-5 py-2 font-medium hover:bg-[#a6a6a6] transition-colors cursor-pointer shrink-0"
              >
                Complete
              </button>
            </div>
          )}
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Balance', value: fmt(data.totalEarnings), icon: Wallet, sub: 'All time' },
            { label: 'This Month', value: fmt(data.monthEarnings), icon: TrendingUp, sub: today.toLocaleDateString('en-US', { month: 'long' }) },
            { label: 'Pending', value: fmt(data.pendingClearance), icon: Clock, sub: 'Awaiting approval' },
            { label: 'Projects', value: String(data.activeProjectCount), icon: Briefcase, sub: 'Active now' },
          ].map((c) => (
            <div key={c.label} className="border border-[#ffffff]/10 rounded-2xl p-5 sm:p-6 group hover:border-[#ffffff]/20 transition-all duration-300">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs text-[#737373] uppercase tracking-widest font-medium">{c.label}</span>
                <c.icon className="w-4 h-4 text-[#525252] group-hover:text-[#a6a6a6] transition-colors" strokeWidth={1.5} />
              </div>
              <p className="text-3xl sm:text-4xl font-medium tracking-tight text-[#fafafa] leading-none">{c.value}</p>
              <p className="text-xs text-[#737373] mt-3">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── ROW 1: Projects + Messages ── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 xl:gap-8 items-start mb-10">
          <section className="xl:col-span-3">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-medium text-[#fafafa] tracking-tight">Active Projects</h2>
              <button onClick={() => navigate('/freelancer/dealrooms')} className="text-xs text-[#737373] hover:text-[#fafafa] transition-colors flex items-center gap-1.5 cursor-pointer">
                All projects <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
            {data.projects.length === 0 ? (
              <div className="border border-[#ffffff]/10 rounded-2xl py-12 flex flex-col items-center justify-center">
                <FolderOpen className="w-5 h-5 text-[#525252] mb-3" strokeWidth={1.5} />
                <p className="text-sm text-[#737373]">No active projects</p>
              </div>
            ) : (
              <ProjectList projects={data.projects} onCardsHeight={setProjectsHeight} />
            )}
          </section>

          <section className="xl:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-medium text-[#fafafa] tracking-tight">Messages</h2>
              <button onClick={() => navigate('/freelancer/dealrooms')} className="text-xs text-[#737373] hover:text-[#fafafa] transition-colors flex items-center gap-1.5 cursor-pointer">
                Open <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
            {data.recentMessages.length === 0 ? (
              <div className="border border-[#ffffff]/10 rounded-2xl py-12 flex flex-col items-center">
                <MessageSquare className="w-5 h-5 text-[#525252] mb-3" strokeWidth={1.5} />
                <p className="text-sm text-[#737373]">No messages</p>
              </div>
            ) : (
              <div className="border border-[#ffffff]/10 rounded-2xl divide-y divide-[#ffffff]/[0.06] overflow-hidden overflow-y-auto" style={{ height: projectsHeight > 0 ? `${projectsHeight}px` : 'auto' }}>
                {data.recentMessages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => navigate('/freelancer/dealrooms')}
                    className="flex items-start gap-3 px-5 py-4 hover:bg-[#ffffff]/[0.04] transition-colors text-left w-full cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#ffffff]/10 flex items-center justify-center shrink-0 text-xs font-medium text-[#a6a6a6] overflow-hidden mt-0.5">
                      {msg.senderAvatar ? (
                        <img src={msg.senderAvatar} alt="" className="w-full h-full object-cover" />
                      ) : msg.senderInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#fafafa] truncate">{msg.senderName}</span>
                        <span className="text-[11px] text-[#737373] ml-2 shrink-0">{timeAgo(msg.createdAt)}</span>
                      </div>
                      <p className="text-xs text-[#737373] truncate mt-1">{msg.content}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── ROW 2: Transactions + Proposals ── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 xl:gap-8 items-start">
          <section className="xl:col-span-3 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-medium text-[#fafafa] tracking-tight">Transactions</h2>
            </div>
            {data.transactions.length > 0 ? (
              <div className="border border-[#ffffff]/10 rounded-2xl divide-y divide-[#ffffff]/[0.06] overflow-hidden overflow-y-auto max-h-[300px]">
                {data.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#ffffff]/[0.04] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#fafafa] truncate">{tx.project}</p>
                      <p className="text-xs text-[#737373] mt-1">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-sm font-medium text-[#fafafa]">+{fmt(tx.amount)}</span>
                      {tx.txHash && (
                        <a href={`${import.meta.env.VITE_EXPLORER_URL || 'https://etherscan.io'}/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer"
                          className="w-7 h-7 rounded-full bg-[#ffffff]/5 border border-[#ffffff]/10 flex items-center justify-center text-[#a6a6a6] hover:bg-[#fafafa] hover:text-[#000000] transition-colors shrink-0"
                          onClick={(e) => e.stopPropagation()}>
                          <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-[#ffffff]/10 rounded-2xl py-12 flex flex-col items-center justify-center flex-1">
                <p className="text-sm text-[#737373]">No transactions</p>
              </div>
            )}
          </section>

          <section className="xl:col-span-2 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-medium text-[#fafafa] tracking-tight">Proposals</h2>
              <button onClick={() => navigate('/freelancer/opportunities')} className="text-xs text-[#737373] hover:text-[#fafafa] transition-colors flex items-center gap-1.5 cursor-pointer">
                All <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
            {data.proposals.length === 0 ? (
              <div className="border border-[#ffffff]/10 rounded-2xl py-12 flex flex-col items-center flex-1">
                <Briefcase className="w-5 h-5 text-[#525252] mb-3" strokeWidth={1.5} />
                <p className="text-sm text-[#737373]">No proposals</p>
              </div>
            ) : (
              <div className="border border-[#ffffff]/10 rounded-2xl divide-y divide-[#ffffff]/[0.06] overflow-hidden overflow-y-auto max-h-[300px]">
                {data.proposals.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate('/freelancer/opportunities')}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-[#ffffff]/[0.04] transition-all duration-300 cursor-pointer text-left w-full"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-sm font-medium text-[#fafafa] truncate mb-1.5">{p.title}</p>
                      <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${
                        p.status === 'Accepted' ? 'bg-emerald-400/10 text-emerald-400'
                        : p.status === 'Rejected' ? 'bg-red-400/10 text-red-400'
                        : 'bg-amber-400/10 text-amber-400'
                      }`}>{p.status}</span>
                    </div>
                    {p.amount && (
                      <span className={`text-sm font-medium shrink-0 ${p.status === 'Rejected' ? 'text-[#525252] line-through' : 'text-[#fafafa]'}`}>
                        ${p.amount.toLocaleString()}{p.rateType === 'hourly' ? '/hr' : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
