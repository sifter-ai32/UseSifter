import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCard,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Mail,
  ChevronDown,
  Clock,
  Users,
  Briefcase,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { useAuthStore } from '@/stores/authStore'
import { getClientDashboard, type ClientDashboardProject } from '@/lib/api'

const POLL_INTERVAL = 5000

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string }> = {
  Beginning: { dot: 'bg-blue-400', bg: 'bg-blue-400/10', text: 'text-blue-400' },
  Processing: { dot: 'bg-amber-400', bg: 'bg-amber-400/10', text: 'text-amber-400' },
  Completed: { dot: 'bg-emerald-400', bg: 'bg-emerald-400/10', text: 'text-emerald-400' },
}

const ESCROW_CONFIG: Record<string, { label: string; color: string }> = {
  Created: { label: 'Escrow Created', color: 'text-[#737373]' },
  Funded: { label: 'Funded', color: 'text-blue-400' },
  Active: { label: 'Active', color: 'text-emerald-400' },
  Completed: { label: 'Released', color: 'text-emerald-400' },
  Disputed: { label: 'Disputed', color: 'text-red-400' },
  Cancelled: { label: 'Cancelled', color: 'text-[#737373]' },
}

function daysUntil(dateStr: string | null): string | null {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'Overdue'
  if (diff === 0) return 'Due today'
  if (diff === 1) return '1 day left'
  return `${diff} days left`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmt(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ProjectCard({ project, isExpanded, onToggle }: {
  project: ClientDashboardProject
  isExpanded: boolean
  onToggle: () => void
}) {
  const navigate = useNavigate()
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.Beginning
  const deadline = daysUntil(project.dueDate)
  const isOverdue = deadline === 'Overdue'

  return (
    <div className="border border-[#ffffff]/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-[#ffffff]/20 bg-[#ffffff]/[0.02]">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer hover:bg-[#ffffff]/[0.04] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-[#fafafa] truncate">{project.name}</h4>
          <p className="text-xs text-[#737373] mt-1">
            {project.freelancerName || 'Unassigned'} · {project.completedPhases}/{project.phaseCount} phases
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-2 w-32">
            <div className="h-[3px] flex-1 bg-[#ffffff]/[0.06] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${project.progress === 100 ? 'bg-emerald-400' : 'bg-[#fafafa]'}`} style={{ width: `${project.progress}%` }} />
            </div>
            <span className="text-xs text-[#a6a6a6] w-8 text-right">{project.progress}%</span>
          </div>
          {deadline && <span className={`text-[11px] uppercase tracking-wider hidden sm:block ${isOverdue ? 'text-red-400' : 'text-[#737373]'}`}>{deadline}</span>}
          <ChevronDown className={`w-4 h-4 text-[#737373] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={1.5} />
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-[#ffffff]/[0.06] px-5 py-5 flex flex-col gap-4">
          {/* Info row */}
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs">
            <div>
              <span className="text-[#737373]">Status</span>
              <p className="text-[#fafafa] font-medium mt-1 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {project.status}
              </p>
            </div>
            <div>
              <span className="text-[#737373]">Budget</span>
              <p className="text-[#fafafa] font-medium mt-1">{project.budget != null ? fmt(project.budget) : '—'}</p>
            </div>
            <div>
              <span className="text-[#737373]">Started</span>
              <p className="text-[#fafafa] font-medium mt-1">{fmtDate(project.createdAt)}</p>
            </div>
            <div>
              <span className="text-[#737373]">Freelancer</span>
              <p className="text-[#fafafa] font-medium mt-1">{project.freelancerName || 'Unassigned'}</p>
            </div>
            {project.escrowStatus && (
              <div>
                <span className="text-[#737373]">Escrow</span>
                <p className={`font-medium mt-1 ${ESCROW_CONFIG[project.escrowStatus]?.color || 'text-[#737373]'}`}>
                  {ESCROW_CONFIG[project.escrowStatus]?.label || project.escrowStatus}
                </p>
              </div>
            )}
          </div>

          {project.description && (
            <p className="text-sm text-[#737373] leading-relaxed">{project.description}</p>
          )}

          {/* Action */}
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/dealroom') }}
            className="self-start text-sm text-[#000000] bg-[#fafafa] rounded-full px-5 py-2 font-medium hover:bg-[#a6a6a6] transition-colors cursor-pointer flex items-center gap-2"
          >
            Open Deal Room <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [projectFilter, setProjectFilter] = useState<'All Projects' | 'Beginning' | 'Processing' | 'Completed'>('All Projects')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const FORCE_DUMMY = import.meta.env.VITE_FORCE_DUMMY === 'true'

  const { data: liveData, isLoading } = useQuery({
    queryKey: ['client-dashboard', userId],
    queryFn: () => getClientDashboard(userId!),
    enabled: !!userId,
    refetchInterval: POLL_INTERVAL,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always' as const,
    staleTime: 0,
  })

  const DUMMY_PROJECTS: ClientDashboardProject[] = [
    { id: 'dp1', name: 'DeFi Protocol V2 UI', status: 'Processing', budget: 8500, description: 'Complete frontend overhaul using React and ethers.js for staking pools.', dueDate: '2026-04-15', createdAt: '2026-02-01', memberCount: 2, phaseCount: 4, completedPhases: 2, progress: 50, proposalCount: 3, negotiationCount: 2, escrowStatus: 'Active', freelancerName: 'Alex Rivera', members: [{ id: 'f1', name: 'Alex Rivera', avatar: null }], phases: [
      { index: 0, description: 'Discovery & Research', status: 'Approved', amount: 1500, deadline: '2026-02-15T00:00:00Z' },
      { index: 1, description: 'Wireframes & Design', status: 'Approved', amount: 2000, deadline: '2026-03-01T00:00:00Z' },
      { index: 2, description: 'Frontend Development', status: 'Submitted', amount: 3000, deadline: '2026-04-01T00:00:00Z' },
      { index: 3, description: 'Testing & Launch', status: 'Pending', amount: 2000, deadline: '2026-04-15T00:00:00Z' },
    ] },
    { id: 'dp2', name: 'NFT Marketplace Audit', status: 'Processing', budget: 4500, description: 'Security audit of ERC-721 implementation and custom royalty contracts.', dueDate: '2026-04-02', createdAt: '2026-03-01', memberCount: 2, phaseCount: 3, completedPhases: 2, progress: 67, proposalCount: 5, negotiationCount: 1, escrowStatus: 'Active', freelancerName: 'Mike Chen', members: [{ id: 'f2', name: 'Mike Chen', avatar: null }], phases: [
      { index: 0, description: 'Initial Audit', status: 'Approved', amount: 1500, deadline: '2026-03-10T00:00:00Z' },
      { index: 1, description: 'Vulnerability Report', status: 'Approved', amount: 1500, deadline: '2026-03-20T00:00:00Z' },
      { index: 2, description: 'Final Review & Sign-off', status: 'Submitted', amount: 1500, deadline: '2026-04-02T00:00:00Z' },
    ] },
    { id: 'dp3', name: 'DAO Governance Dashboard', status: 'Beginning', budget: 9200, description: 'Voting interface and proposal creation flow for community members.', dueDate: '2026-05-10', createdAt: '2026-03-05', memberCount: 2, phaseCount: 4, completedPhases: 0, progress: 0, proposalCount: 2, negotiationCount: 3, escrowStatus: 'Funded', freelancerName: 'Lisa Park', members: [{ id: 'f3', name: 'Lisa Park', avatar: null }], phases: [
      { index: 0, description: 'Requirements & Design', status: 'Pending', amount: 2200, deadline: '2026-04-10T00:00:00Z' },
      { index: 1, description: 'Smart Contract Integration', status: 'Pending', amount: 2500, deadline: '2026-04-25T00:00:00Z' },
      { index: 2, description: 'Frontend Build', status: 'Pending', amount: 2500, deadline: '2026-05-01T00:00:00Z' },
      { index: 3, description: 'Testing & Deployment', status: 'Pending', amount: 2000, deadline: '2026-05-10T00:00:00Z' },
    ] },
    { id: 'dp4', name: 'Mobile Crypto Wallet', status: 'Beginning', budget: 18000, description: 'React Native app for multi-chain asset management with biometric auth.', dueDate: '2026-06-01', createdAt: '2026-03-25', memberCount: 2, phaseCount: 6, completedPhases: 0, progress: 0, proposalCount: 4, negotiationCount: 2, escrowStatus: 'Created', freelancerName: 'David Kim', members: [{ id: 'f4', name: 'David Kim', avatar: null }], phases: [
      { index: 0, description: 'Architecture & Setup', status: 'Pending', amount: 2500, deadline: '2026-04-15T00:00:00Z' },
      { index: 1, description: 'Core Wallet Features', status: 'Pending', amount: 4000, deadline: '2026-04-30T00:00:00Z' },
      { index: 2, description: 'Multi-chain Support', status: 'Pending', amount: 3500, deadline: '2026-05-10T00:00:00Z' },
      { index: 3, description: 'UI/UX Polish', status: 'Pending', amount: 3000, deadline: '2026-05-20T00:00:00Z' },
      { index: 4, description: 'Security Audit', status: 'Pending', amount: 2500, deadline: '2026-05-28T00:00:00Z' },
      { index: 5, description: 'App Store Launch', status: 'Pending', amount: 2500, deadline: '2026-06-01T00:00:00Z' },
    ] },
    { id: 'dp5', name: 'DeFi Analytics Dashboard', status: 'Completed', budget: 6000, description: 'Real-time analytics for DeFi portfolio tracking across protocols.', dueDate: '2026-03-15', createdAt: '2026-01-20', memberCount: 2, phaseCount: 4, completedPhases: 4, progress: 100, proposalCount: 1, negotiationCount: 1, escrowStatus: 'Completed', freelancerName: 'Emma Stone', members: [{ id: 'f5', name: 'Emma Stone', avatar: null }], phases: [
      { index: 0, description: 'Data Pipeline Setup', status: 'Approved', amount: 1500, deadline: '2026-02-10T00:00:00Z' },
      { index: 1, description: 'Dashboard Charts', status: 'Approved', amount: 1500, deadline: '2026-02-28T00:00:00Z' },
      { index: 2, description: 'Portfolio Tracking', status: 'Approved', amount: 1500, deadline: '2026-03-10T00:00:00Z' },
      { index: 3, description: 'QA & Performance', status: 'Approved', amount: 1500, deadline: '2026-03-15T00:00:00Z' },
    ] },
  ]

  const DUMMY_TRANSACTIONS = [
    { purpose: 'Wireframes & Design — Paid to @alex', amount: '$2,000.00', hash: '0xabc123' },
    { purpose: 'Discovery & Research — Paid to @alex', amount: '$1,500.00', hash: '0xdef456' },
    { purpose: 'Deposited to escrow', amount: '$8,500.00', hash: '0x789ghi' },
    { purpose: 'Initial Audit — Paid to @mike', amount: '$1,500.00', hash: '0xjkl012' },
    { purpose: 'Vulnerability Report — Paid to @mike', amount: '$1,500.00', hash: '0xmno345' },
  ]

  const DUMMY_FREELANCERS = [
    { id: 'f1', name: 'Alex Rivera', avatar: null, title: 'Frontend Developer' },
    { id: 'f2', name: 'Mike Chen', avatar: null, title: 'Security Auditor' },
    { id: 'f3', name: 'Lisa Park', avatar: null, title: 'Full Stack Developer' },
  ]

  const data = liveData ? {
    escrowBalance: FORCE_DUMMY ? 24700 : (liveData.escrowBalance || 0),
    transactions: (FORCE_DUMMY || liveData.transactions.length === 0) ? DUMMY_TRANSACTIONS : liveData.transactions,
    freelancers: (FORCE_DUMMY || liveData.freelancers.length === 0) ? DUMMY_FREELANCERS : liveData.freelancers,
    projects: (FORCE_DUMMY || liveData.projects.length === 0) ? DUMMY_PROJECTS : liveData.projects,
  } : null

  const escrowBalance = data?.escrowBalance ?? 0
  const transactions = data?.transactions ?? []
  const freelancers = data?.freelancers ?? []
  const projects = data?.projects ?? []

  const filteredProjects = projects.filter((p) => {
    if (projectFilter === 'All Projects') return true
    return p.status === projectFilter
  })

  const filterCounts = {
    'All Projects': projects.length,
    Beginning: projects.filter(p => p.status === 'Beginning').length,
    Processing: projects.filter(p => p.status === 'Processing').length,
    Completed: projects.filter(p => p.status === 'Completed').length,
  }

  if (isLoading || !data) {
    return (
      <div className="bg-[#000000] text-[#fafafa] antialiased min-h-screen">
        <Header />
        <main className="sm:px-6 lg:px-8 max-w-7xl mx-auto pt-24 px-4 pb-6 w-full">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8">

            {/* Left Column Skeleton */}
            <div className="xl:col-span-7 flex flex-col gap-6 xl:gap-8">
              {/* Escrow Overview Skeleton */}
              <div className="border border-[#ffffff]/10 rounded-3xl p-6 sm:p-8 animate-pulse">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#ffffff]/5" />
                  <div className="h-7 w-72 bg-[#ffffff]/5 rounded-lg" />
                </div>
                <div className="h-4 w-56 bg-[#ffffff]/5 rounded mt-3" />

                <div className="flex flex-col md:flex-row items-end justify-between mt-10 gap-8">
                  <div className="md:w-1/3">
                    <div className="h-12 w-32 bg-[#ffffff]/5 rounded-lg mb-3" />
                    <div className="h-4 w-40 bg-[#ffffff]/5 rounded" />
                  </div>
                  <div className="md:w-2/3 w-full space-y-4">
                    <div className="flex gap-4">
                      <div className="h-4 w-20 bg-[#ffffff]/5 rounded" />
                      <div className="h-4 w-24 bg-[#ffffff]/5 rounded" />
                      <div className="h-4 w-16 bg-[#ffffff]/5 rounded" />
                    </div>
                    <div className="h-px bg-[#ffffff]/10" />
                    <div className="flex gap-4">
                      <div className="h-4 w-28 bg-[#ffffff]/5 rounded" />
                      <div className="h-4 w-16 bg-[#ffffff]/5 rounded" />
                      <div className="h-4 w-20 bg-[#ffffff]/5 rounded" />
                    </div>
                    <div className="h-px bg-[#ffffff]/5" />
                    <div className="flex gap-4">
                      <div className="h-4 w-24 bg-[#ffffff]/5 rounded" />
                      <div className="h-4 w-16 bg-[#ffffff]/5 rounded" />
                      <div className="h-4 w-20 bg-[#ffffff]/5 rounded" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xl:gap-8">
                {/* Freelancers Skeleton */}
                <div className="flex flex-col gap-4 animate-pulse">
                  <div className="h-5 w-56 bg-[#ffffff]/5 rounded mb-2" />
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 p-2 pr-4 rounded-full border border-[#ffffff]/10">
                      <div className="w-10 h-10 rounded-full bg-[#ffffff]/5" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-28 bg-[#ffffff]/5 rounded" />
                        <div className="h-3 w-20 bg-[#ffffff]/5 rounded" />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#ffffff]/5" />
                    </div>
                  ))}
                </div>

                {/* Start New Project Skeleton */}
                <div className="border border-[#ffffff]/10 rounded-3xl p-6 animate-pulse">
                  <div className="h-5 w-40 bg-[#ffffff]/5 rounded mb-3" />
                  <div className="space-y-2 mb-6">
                    <div className="h-3 w-full bg-[#ffffff]/5 rounded" />
                    <div className="h-3 w-4/5 bg-[#ffffff]/5 rounded" />
                    <div className="h-3 w-3/5 bg-[#ffffff]/5 rounded" />
                  </div>
                  <div className="h-12 w-full bg-[#ffffff]/5 rounded-full" />
                </div>
              </div>
            </div>

            {/* Right Column Skeleton */}
            <div className="xl:col-span-5">
              <div className="border border-[#ffffff]/10 rounded-3xl p-6 sm:p-8 animate-pulse">
                <div className="flex items-center justify-between mb-6">
                  <div className="h-6 w-44 bg-[#ffffff]/5 rounded" />
                  <div className="h-7 w-28 bg-[#ffffff]/5 rounded-lg" />
                </div>
                <div className="flex flex-col gap-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-3.5 px-4 py-4 rounded-2xl border border-[#ffffff]/[0.06]">
                      <div className="w-10 h-10 rounded-xl bg-[#ffffff]/5" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 bg-[#ffffff]/5 rounded" />
                        <div className="h-3 w-1/2 bg-[#ffffff]/5 rounded" />
                      </div>
                      <div className="w-6 h-6 rounded-full bg-[#ffffff]/5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-[#000000] text-[#fafafa] antialiased min-h-screen selection:bg-[#ffffff]/20 overflow-x-hidden">
      <Header />

      <main className="sm:px-6 lg:px-8 max-w-7xl mx-auto pt-24 px-4 pb-6 w-full">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8">

          {/* Left Column */}
          <div className="xl:col-span-7 flex flex-col gap-6 xl:gap-8">

            {/* Escrow & Transaction Overview */}
            <section
              className="bg-[#000000] border border-[#ffffff]/10 rounded-3xl p-6 sm:p-8 flex flex-col relative overflow-hidden group transition-colors duration-500 hover:border-[#ffffff]/20"
              style={{ opacity: 0, animation: 'slideFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards' }}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 xl:mb-8 shrink-0">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#ffffff]/5 border border-[#ffffff]/10 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4 text-[#a6a6a6]" strokeWidth={1.5} />
                    </div>
                    <h1 className="sm:text-3xl text-2xl font-medium text-[#fafafa] tracking-tight">Escrow & Transaction Overview</h1>
                  </div>
                  <p className="leading-relaxed text-sm text-[#737373] max-w-sm mt-2">Monitor active escrow funds, and recent transaction history.</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-end justify-between mt-auto gap-12 md:gap-8 flex-1">
                <div className="flex flex-col w-full md:w-1/3 pb-4">
                  <span className="sm:text-5xl text-4xl font-medium text-[#fafafa] tracking-tight mb-3">
                    ${escrowBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                  <p className="leading-relaxed text-sm text-[#737373]">Current Escrow Balance</p>
                </div>

                <div className="md:w-2/3 flex flex-col flex-1 min-h-[120px] max-h-[160px] w-full relative overflow-y-auto thin-scrollbar pr-2 -mr-2">
                  {transactions.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-sm text-[#737373]">No transactions yet</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-[#000000] z-10">
                        <tr className="border-b border-[#ffffff]/10 text-xs text-[#737373] font-medium">
                          <th className="py-3 pr-4 font-medium tracking-tight">Purpose</th>
                          <th className="py-3 px-4 font-medium tracking-tight">Amount (USD)</th>
                          <th className="py-3 pl-4 font-medium tracking-tight text-right">Hash</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {transactions.map((tx, i) => (
                          <tr
                            key={i}
                            className={`${i < transactions.length - 1 ? 'border-b border-[#ffffff]/5' : ''} hover:bg-[#ffffff]/5 transition-colors duration-300 group/row`}
                          >
                            <td className="py-3 pr-4 text-[#fafafa] font-medium">{tx.purpose}</td>
                            <td className="py-3 px-4 text-[#a6a6a6]">{tx.amount}</td>
                            <td className="py-3 pl-4 text-right">
                              {tx.hash ? (
                                <div className="flex items-center justify-end gap-3">
                                  <span className="text-xs text-[#737373] font-mono tracking-wider">
                                    {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                                  </span>
                                  <a
                                    href={`${import.meta.env.VITE_EXPLORER_URL || 'https://etherscan.io'}/tx/${tx.hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-7 h-7 rounded-full bg-[#ffffff]/5 border border-[#ffffff]/10 flex items-center justify-center text-[#a6a6a6] group-hover/row:bg-[#fafafa] group-hover/row:text-[#000000] transition-colors shrink-0"
                                  >
                                    <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  </a>
                                </div>
                              ) : (
                                <span className="text-xs text-[#737373]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xl:gap-8">

              {/* Currently Working Freelancers */}
              <section
                className="flex flex-col gap-4"
                style={{ opacity: 0, animation: 'slideFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards' }}
              >
                <h2 className="text-lg font-medium text-[#fafafa] tracking-tight">Currently Working Freelancers</h2>

                {freelancers.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-[#737373]">No active freelancers</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto thin-scrollbar">
                    {freelancers.map((freelancer) => (
                      <div
                        key={freelancer.id}
                        className="flex items-center justify-between p-2 pr-4 rounded-full border border-[#ffffff]/10 bg-[#000000] hover:bg-[#ffffff]/5 transition-colors duration-300 group/card"
                      >
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => navigate(`/profile/${freelancer.id}`)}
                        >
                          {freelancer.avatar ? (
                            <img
                              src={freelancer.avatar}
                              alt={freelancer.name}
                              className="w-10 h-10 rounded-full object-cover grayscale opacity-80 group-hover/card:grayscale-0 group-hover/card:opacity-100 transition-all duration-300"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-sm font-medium text-[#a6a6a6]">
                              {freelancer.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-[#fafafa] hover:underline">{freelancer.name}</span>
                            <span className="text-xs text-[#737373]">{freelancer.title || 'Freelancer'}</span>
                          </div>
                        </div>
                        <button className="w-8 h-8 rounded-full bg-[#ffffff]/5 border border-[#ffffff]/10 flex items-center justify-center text-[#a6a6a6] hover:bg-[#fafafa] hover:text-[#000000] transition-all duration-300 shrink-0">
                          <Mail className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Start a New Project */}
              <section
                className="bg-[#000000] border border-[#ffffff]/10 rounded-3xl p-6 relative overflow-hidden group flex flex-col"
                style={{ opacity: 0, animation: 'slideFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards' }}
              >
                <div
                  className="absolute -right-12 -top-12 w-64 h-64 opacity-20 transform rotate-12 group-hover:rotate-45 transition-transform duration-700 ease-out"
                  style={{
                    backgroundImage: 'radial-gradient(#ffffff20 1px, transparent 1px)',
                    backgroundSize: '8px 8px',
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#000000]/80 to-[#000000]" />

                <div className="relative z-10 flex flex-col h-full">
                  <h2 className="text-lg font-medium text-[#fafafa] tracking-tight mb-2">Start a New Project</h2>
                  <p className="leading-relaxed text-sm text-[#737373] mb-4">
                    Describe your project requirements, timeline, and budget. Our AI will analyze your needs and streamline the entire hiring process.
                  </p>

                  <button
                    onClick={() => navigate('/chat')}
                    className="flex items-center justify-between w-full rounded-full mt-auto px-5 py-3 text-sm font-medium bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors duration-300 cursor-pointer"
                  >
                    <span>Start with AI</span>
                    <span className="flex items-center justify-center hover:bg-[#000000] hover:text-white transition-all duration-300 bg-stone-50/40 w-8 h-8 border-[#000000]/95 border rounded-full ml-4">
                      <Plus className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                  </button>
                </div>
              </section>
            </div>
          </div>

          {/* Right Column — grid stretch matches left column height */}
          <div className="xl:col-span-5 self-stretch">

            {/* Your Current Projects */}
            <section
              className="bg-[#000000] border border-[#ffffff]/10 rounded-3xl p-6 sm:p-8 group transition-colors duration-500 hover:border-[#ffffff]/20 flex flex-col"
              style={{ opacity: 0, animation: 'slideFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards' }}
            >
              <div className="flex items-center justify-between mb-4 xl:mb-6 relative z-20 shrink-0">
                <h2 className="text-xl font-medium text-[#fafafa] tracking-tight">Your Current Projects</h2>

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 text-xs font-medium text-[#737373] hover:text-[#fafafa] transition-colors duration-300 px-3 py-1.5 rounded-lg border border-[#ffffff]/10 bg-[#000000] cursor-pointer"
                  >
                    {projectFilter}
                    {filterCounts[projectFilter] > 0 && (
                      <span className="text-[10px] text-[#fafafa] bg-[#ffffff]/10 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {filterCounts[projectFilter]}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-[#0a0a0a] border border-[#ffffff]/10 shadow-lg py-1 z-50">
                      {(['All Projects', 'Beginning', 'Processing', 'Completed'] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() => { setProjectFilter(option); setDropdownOpen(false); setExpandedProject(null) }}
                          className={`flex items-center justify-between w-full text-left px-4 py-2 text-xs hover:bg-[#ffffff]/5 transition-colors cursor-pointer ${
                            projectFilter === option ? 'text-[#fafafa]' : 'text-[#737373] hover:text-[#fafafa]'
                          }`}
                        >
                          <span>{option}</span>
                          <span className="text-[10px] text-[#737373]">{filterCounts[option]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 flex-1">
                {filteredProjects.length === 0 && (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-[#737373]">{projectFilter === 'All Projects' ? 'No projects yet' : `No ${projectFilter.toLowerCase()} projects`}</p>
                  </div>
                )}
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isExpanded={expandedProject === project.id}
                    onToggle={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
                  />
                ))}
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  )
}
