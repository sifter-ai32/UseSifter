import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  User,
  Clock,
  ArrowRight,
  Plus,
  Briefcase,
  TrendingUp,
  DollarSign,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import EscrowPanel from '@/components/dealroom/EscrowPanel'
import { useAuthStore } from '@/stores/authStore'
import { listEscrows, type EscrowInfo } from '@/lib/api'
import { getImageUrl } from '@/lib/utils'

function getProjectStatus(escrowStatus: string): string {
  if (escrowStatus === 'Completed') return 'Completed'
  if (['Funded', 'Active', 'Disputed'].includes(escrowStatus)) return 'Processing'
  return 'Beginning'
}

function getBudgetLabel(escrowStatus: string): string {
  if (escrowStatus === 'Completed') return 'Paid'
  if (['Funded', 'Active'].includes(escrowStatus)) return 'Funded'
  return 'Created'
}

function formatBudget(amount: string | number): string {
  const n = Number(amount)
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `$${n.toLocaleString()}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SegmentedProgress({ progress }: { progress: number }) {
  const filled = Math.round(progress / 10)
  return (
    <div className="flex-1">
      <div className="flex justify-between items-center text-[12px] mb-2">
        <span className="text-[#737373] font-normal">Progress</span>
        <span className={`${progress > 0 ? 'text-[#fafafa]' : 'text-[#737373]'} font-medium tracking-wide`}>
          {progress}%
        </span>
      </div>
      <div className="flex gap-[3px] h-[5px] w-full">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors duration-300 ${
              i < filled ? 'bg-[#fafafa]' : 'bg-[#ffffff]/[0.06]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function ProjectCard({
  escrow,
  onViewDetails,
}: {
  escrow: EscrowInfo
  onViewDetails: () => void
}) {
  const status = getProjectStatus(escrow.status)
  const budget = `$${Number(escrow.totalAmount).toLocaleString()}`
  const budgetLabel = getBudgetLabel(escrow.status)
  const totalPhases = escrow.phases?.length ?? 0
  const completedPhases = escrow.phases?.filter(p => ['Approved', 'AutoReleased'].includes(p.status)).length ?? 0
  const progress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0
  const firstDeadline = escrow.phases?.[0]?.deadline

  return (
    <div className="flex flex-col bg-[#0a0a0a]/80 border border-[#ffffff]/[0.07] hover:border-[#ffffff]/15 rounded-2xl p-6 transition-all duration-500 h-full group relative overflow-hidden hover:shadow-[0_0_40px_-12px_rgba(255,255,255,0.06)]">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />

      <div className="relative z-[1] flex flex-col h-full">
        {/* Header: Status & Budget */}
        <div className="flex justify-between items-start mb-5">
          <span className="px-2.5 py-1 rounded-md bg-[#ffffff]/5 border border-[#ffffff]/10 text-[11px] font-medium text-[#a6a6a6] uppercase tracking-widest">
            {status}
          </span>
          <div className="text-right">
            <span className="text-[15px] font-medium tracking-tight text-[#fafafa] block leading-tight">
              {budget}
            </span>
            <span className="text-[10px] text-[#525252] uppercase tracking-widest font-medium">
              {budgetLabel}
            </span>
          </div>
        </div>

        {/* Body: Title & Description */}
        <h3 className="text-[17px] font-medium tracking-tight text-[#e5e5e5] mb-2.5 group-hover:text-white transition-colors duration-300">
          {escrow.projectTitle}
        </h3>
        <p className="text-[13px] text-[#737373] font-light mb-6 line-clamp-2 leading-relaxed">
          {escrow.projectDescription || 'No description'}
        </p>

        {/* Freelancer & Due Date */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            {escrow.freelancer ? (
              <>
                <div className="w-7 h-7 rounded-full bg-[#ffffff]/10 border border-[#ffffff]/10 overflow-hidden shrink-0 ring-2 ring-[#0a0a0a]">
                  {escrow.freelancer.avatar ? (
                    <img
                      src={getImageUrl(escrow.freelancer.avatar) ?? undefined}
                      alt={escrow.freelancer.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-[#a6a6a6]">
                      {escrow.freelancer.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <span className="text-[13px] font-normal text-[#a6a6a6]">
                  {escrow.freelancer.name}
                </span>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full border border-dashed border-[#ffffff]/15 bg-[#ffffff]/[0.03] flex items-center justify-center shrink-0 text-[#525252]">
                  <User className="w-3.5 h-3.5" strokeWidth={1.5} />
                </div>
                <span className="text-[13px] font-normal text-[#525252]">Unassigned</span>
              </>
            )}
          </div>
          <span className="text-[11px] text-[#525252] font-normal flex items-center gap-1">
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            {formatDate(firstDeadline)}
          </span>
        </div>

        {/* Footer: Progress & Action */}
        <div className="mt-auto pt-5 border-t border-[#ffffff]/[0.06] flex items-center justify-between gap-5">
          <SegmentedProgress progress={progress} />
          <button
            type="button"
            onClick={onViewDetails}
            className="cursor-pointer shrink-0 px-3.5 py-2 bg-[#ffffff]/[0.04] hover:bg-[#ffffff]/[0.08] border border-[#ffffff]/[0.08] hover:border-[#ffffff]/15 rounded-lg text-[12px] font-medium text-[#a6a6a6] hover:text-[#fafafa] transition-all duration-300 flex items-center gap-1.5 translate-y-[1px]"
          >
            Details
            <ArrowRight className="w-3 h-3" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}


const FILTERS = ['Processing', 'Beginning', 'Completed']

export default function ProjectsPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const [detailEscrowInfo, setDetailEscrowInfo] = useState<EscrowInfo | null>(null)
  const [activeFilter, setActiveFilter] = useState('Processing')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: escrows, isLoading } = useQuery({
    queryKey: ['escrows', userId],
    queryFn: () => listEscrows(userId!, undefined, undefined),
    enabled: !!userId,
    refetchInterval: 5000,
  })

  const projects = (escrows ?? []).map(e => ({
    ...e,
    _status: getProjectStatus(e.status),
  }))

  const filtered = projects
    .filter(p => p._status === activeFilter)
    .filter(p => !searchQuery || p.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()))

  const totalBudget = projects.reduce((sum, p) => sum + Number(p.totalAmount), 0)
  const inProgress = projects.filter(p => p._status === 'Processing').length
  const dueSoon = projects.filter(p => {
    const firstPhase = p.phases?.find(ph => ph.status === 'Pending' || ph.status === 'Submitted')
    if (!firstPhase?.deadline) return false
    const days = Math.ceil((new Date(firstPhase.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 7
  }).length

  const stats = [
    { label: 'Total Projects', value: String(projects.length), icon: Briefcase },
    { label: 'In Progress', value: String(inProgress), icon: TrendingUp },
    { label: 'Total Budget', value: formatBudget(totalBudget), icon: DollarSign },
    { label: 'Due Soon', value: String(dueSoon), icon: Clock },
  ]

  if (isLoading) {
    return (
      <div className="bg-[#000000] text-[#fafafa] antialiased min-h-screen font-light">
        <Header />
        <main className="sm:px-6 lg:px-8 max-w-[1600px] mx-auto pt-24 px-4 pb-12 animate-pulse">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="h-8 w-40 bg-[#ffffff]/5 rounded-lg mb-2" />
              <div className="h-4 w-56 bg-[#ffffff]/5 rounded" />
            </div>
            <div className="h-10 w-36 bg-[#ffffff]/5 rounded-xl" />
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl border border-[#ffffff]/[0.06]">
                <div className="w-9 h-9 rounded-lg bg-[#ffffff]/5" />
                <div className="space-y-1.5">
                  <div className="h-3 w-20 bg-[#ffffff]/5 rounded" />
                  <div className="h-5 w-12 bg-[#ffffff]/5 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Filter bar skeleton */}
          <div className="flex items-center justify-between mb-8">
            <div className="h-9 w-64 bg-[#ffffff]/5 rounded-lg" />
            <div className="flex gap-2.5">
              <div className="h-9 w-56 bg-[#ffffff]/5 rounded-lg" />
              <div className="h-9 w-20 bg-[#ffffff]/5 rounded-lg" />
            </div>
          </div>

          {/* Project cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl border border-[#ffffff]/[0.07] p-6">
                <div className="flex justify-between mb-5">
                  <div className="h-6 w-24 bg-[#ffffff]/5 rounded-md" />
                  <div className="h-5 w-16 bg-[#ffffff]/5 rounded" />
                </div>
                <div className="h-5 w-3/4 bg-[#ffffff]/5 rounded mb-2.5" />
                <div className="h-4 w-full bg-[#ffffff]/5 rounded mb-1.5" />
                <div className="h-4 w-2/3 bg-[#ffffff]/5 rounded mb-6" />
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#ffffff]/5" />
                    <div className="h-4 w-20 bg-[#ffffff]/5 rounded" />
                  </div>
                  <div className="h-3 w-14 bg-[#ffffff]/5 rounded" />
                </div>
                <div className="pt-5 border-t border-[#ffffff]/[0.06] flex items-center justify-between gap-5">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 bg-[#ffffff]/5 rounded" />
                    <div className="flex gap-[3px] h-[5px]">
                      {Array.from({ length: 10 }, (_, j) => (
                        <div key={j} className="flex-1 rounded-full bg-[#ffffff]/[0.06]" />
                      ))}
                    </div>
                  </div>
                  <div className="h-8 w-20 bg-[#ffffff]/5 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-[#000000] text-[#fafafa] antialiased min-h-screen font-light">
      <Header />

      <main className="sm:px-6 lg:px-8 max-w-[1600px] mx-auto pt-24 px-4 pb-12">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-[fadeUp_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight">Projects</h1>
            <p className="text-sm text-[#525252] mt-1 font-light">Manage and track your active projects</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fafafa] text-[#0a0a0a] text-sm font-medium hover:bg-[#e5e5e5] transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            New Project
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 animate-[fadeUp_0.6s_cubic-bezier(0.16,1,0.3,1)_100ms_forwards] opacity-0">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#ffffff]/[0.02] border border-[#ffffff]/[0.06] hover:border-[#ffffff]/10 transition-all duration-300"
            >
              <div className="w-9 h-9 rounded-lg bg-[#ffffff]/[0.04] flex items-center justify-center shrink-0">
                <stat.icon className="w-[18px] h-[18px] text-[#a6a6a6]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[11px] text-[#525252] uppercase tracking-widest font-medium">{stat.label}</p>
                <p className="text-lg font-semibold tracking-tight text-[#fafafa]">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar: Filter Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-[fadeUp_0.6s_cubic-bezier(0.16,1,0.3,1)_200ms_forwards] opacity-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#ffffff]/[0.03] border border-[#ffffff]/[0.06]">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`cursor-pointer px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-all duration-300 ${
                  activeFilter === filter
                    ? 'bg-[#ffffff]/10 text-[#fafafa] shadow-sm'
                    : 'text-[#525252] hover:text-[#a6a6a6]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4"
                strokeWidth={1.5}
              />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-[#3f3f3f] text-sm bg-[#ffffff]/[0.02] w-56 border-[#ffffff]/[0.06] border rounded-lg pt-2 pr-4 pb-2 pl-9 text-[#fafafa]"
              />
            </div>
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 w-full items-stretch animate-[fadeUp_0.6s_cubic-bezier(0.16,1,0.3,1)_300ms_forwards] opacity-0">
          {filtered.length === 0 && (
            <div className="col-span-full flex items-center justify-center py-16">
              <p className="text-sm text-[#737373]">No {activeFilter.toLowerCase()} projects</p>
            </div>
          )}
          {filtered.map((escrow) => (
            <ProjectCard
              key={escrow.id}
              escrow={escrow}
              onViewDetails={() => setDetailEscrowInfo(escrow)}
            />
          ))}
        </div>
      </main>

      {/* Detail Panel — reuses the deal room EscrowPanel */}
      <EscrowPanel
        open={!!detailEscrowInfo}
        onClose={() => setDetailEscrowInfo(null)}
        escrow={detailEscrowInfo}
      />
    </div>
  )
}
