import { useState } from 'react'
import {
  Calendar, BarChart3, ShieldCheck, Wallet, DollarSign,
  CheckCheck, XCircle, Loader2, AlertTriangle,
  Send, ThumbsUp, RotateCcw, Flag, Link2, ExternalLink,
} from 'lucide-react'
import type { EscrowInfo } from '@/lib/api'
import {
  PhaseStatusLabel,
  PhaseStatus,
  tokenLabel,
} from '@/lib/contracts'
import { useAuthStore } from '@/stores/authStore'
import { useWalletVerification } from '@/hooks/useEscrowContract'

interface EscrowPanelProps {
  open: boolean
  onClose: () => void
  escrow: EscrowInfo | null
  onSubmitPhase?: (escrowId: number, workLink?: string) => void
  onApprovePhase?: (escrowId: number) => void
  onRequestRevision?: (escrowId: number, notes?: string) => void
  onRaiseDispute?: (escrowId: number) => void
  isLoading?: boolean
}

export default function EscrowPanel({
  open, onClose, escrow,
  onSubmitPhase, onApprovePhase, onRequestRevision, onRaiseDispute,
  isLoading,
}: EscrowPanelProps) {
  const user = useAuthStore((s) => s.user)
  const userType = useAuthStore((s) => s.userType)
  const isClient = escrow ? user?.id === escrow.clientId : userType === 'client'
  const isFreelancer = escrow ? user?.id === escrow.freelancerId : userType === 'talent'
  const { walletError } = useWalletVerification(user?.walletAddress)

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm z-[250]" onClick={onClose} />
      )}

      <aside className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-[#050505] border-l border-[#ffffff]/10 z-[300] transform transition-transform duration-300 flex flex-col overflow-y-auto shadow-2xl ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-6 border-b border-[#ffffff]/10 shrink-0">
          <h2 className="text-xl tracking-tight text-[#fafafa] font-normal">Escrow Details</h2>
          <button type="button" onClick={onClose} className="text-[#a6a6a6] hover:text-[#fafafa] transition-colors p-1.5 rounded-full hover:bg-[#ffffff]/5 cursor-pointer">
            <XCircle className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Wallet mismatch warning */}
        {walletError && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#f59e0b] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-sm text-[#f59e0b] font-normal">Wrong wallet connected</p>
              <p className="text-xs text-[#f59e0b]/70 mt-1 leading-relaxed">Please switch to the wallet you registered on the platform in Settings. Transactions signed with a different wallet will fail.</p>
            </div>
          </div>
        )}

        {!escrow ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-[#737373]">No escrow data available</span>
          </div>
        ) : (
          <div className="p-6 flex-1 flex flex-col gap-8">
            <DetailsGrid escrow={escrow} />
            <OverallProgress escrow={escrow} />
            <PhaseTimeline
              escrow={escrow}
              isClient={isClient}
              isFreelancer={isFreelancer}
              onSubmitPhase={onSubmitPhase}
              onApprovePhase={onApprovePhase}
              onRequestRevision={onRequestRevision}
              onRaiseDispute={onRaiseDispute}
              isLoading={isLoading}
              walletBlocked={!!walletError}
            />
          </div>
        )}
      </aside>
    </>
  )
}

function DetailsGrid({ escrow }: { escrow: EscrowInfo }) {
  const token = tokenLabel(escrow.tokenAddress)
  const totalAmount = parseFloat(escrow.totalAmount)
  const paidPhases = escrow.phases.filter(p => p.status === 'Approved' || p.status === 'AutoReleased')
  const paidAmount = paidPhases.reduce((sum, p) => sum + parseFloat(p.amount), 0)
  const heldAmount = totalAmount - paidAmount

  const statusColor = (() => {
    switch (escrow.status) {
      case 'Active': case 'Funded': return 'text-[#fafafa]'
      case 'Completed': return 'text-[#fafafa]'
      case 'Disputed': return 'text-[#a6a6a6]'
      case 'Cancelled': return 'text-[#737373]'
      default: return 'text-[#a6a6a6]'
    }
  })()

  return (
    <div className="bg-[#0a0a0a] border border-[#ffffff]/[0.06] rounded-2xl p-6">
      <div className="grid grid-cols-2 gap-y-7 gap-x-4">
        <DetailItem icon={Calendar} label="Created" value={new Date(escrow.createdAt).toLocaleDateString()} />
        <DetailItem icon={Calendar} label="Funded" value={escrow.fundedAt ? new Date(escrow.fundedAt).toLocaleDateString() : 'Not yet'} />
        <DetailItem icon={BarChart3} label="Status" value={escrow.status} valueColor={statusColor} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[#737373]">
            <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-sm font-normal">Token</span>
          </div>
          <span className="text-sm text-[#fafafa] font-normal">{token}</span>
        </div>
        <DetailItem icon={Wallet} label="Held" value={`${heldAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${token}`} />
        <DetailItem icon={DollarSign} label="Released" value={`${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${token}`} />
      </div>

      {/* Vault funding transaction */}
      {escrow.txHashFund && (
        <div className="mt-5 pt-5 border-t border-[#ffffff]/[0.06] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#737373] shrink-0" strokeWidth={1.5} />
          <span className="text-xs text-[#737373]">Vault Tx:</span>
          <a
            href={`${import.meta.env.VITE_EXPLORER_URL || 'https://etherscan.io'}/tx/${escrow.txHashFund}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#a6a6a6] hover:text-[#fafafa] transition-colors font-mono underline underline-offset-2 truncate"
          >
            {escrow.txHashFund.slice(0, 10)}...{escrow.txHashFund.slice(-8)}
          </a>
          <ExternalLink className="w-3 h-3 text-[#737373] shrink-0" strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}

function DetailItem({ icon: Icon, label, value, valueColor = 'text-[#fafafa]' }: {
  icon: typeof Calendar; label: string; value: string; valueColor?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[#737373]">
        <Icon className="w-4 h-4" strokeWidth={1.5} />
        <span className="text-sm font-normal">{label}</span>
      </div>
      <span className={`text-sm font-normal ${valueColor}`}>{value}</span>
    </div>
  )
}

function OverallProgress({ escrow }: { escrow: EscrowInfo }) {
  const total = escrow.phases.length
  const completed = escrow.phases.filter(p => p.status === 'Approved' || p.status === 'AutoReleased').length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  const color = pct > 0 ? '#fafafa' : '#737373'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm text-[#fafafa] font-normal">Overall Progress</h3>
        <span className="text-sm font-normal" style={{ color }}>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-[#ffffff]/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function PhaseTimeline({
  escrow, isClient, isFreelancer,
  onSubmitPhase, onApprovePhase, onRequestRevision, onRaiseDispute,
  isLoading, walletBlocked,
}: {
  escrow: EscrowInfo
  isClient: boolean
  isFreelancer: boolean
  onSubmitPhase?: (escrowId: number, workLink?: string) => void
  onApprovePhase?: (escrowId: number) => void
  onRequestRevision?: (escrowId: number, notes?: string) => void
  onRaiseDispute?: (escrowId: number) => void
  isLoading?: boolean
  walletBlocked?: boolean
}) {
  const token = tokenLabel(escrow.tokenAddress)
  const [submitFormOpen, setSubmitFormOpen] = useState<number | null>(null) // phase index
  const [workLink, setWorkLink] = useState('')
  const [revisionFormOpen, setRevisionFormOpen] = useState<number | null>(null)
  const [revisionNotes, setRevisionNotes] = useState('')

  // Find the current active phase index
  const currentPhaseIndex = escrow.phases.findIndex(p =>
    p.status === 'Pending' || p.status === 'Submitted' || p.status === 'Disputed'
  )

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-sm text-[#fafafa] font-normal">Phase Timeline</h3>
      <div className="relative pl-3 mt-1 space-y-9">
        <div className="absolute left-[23px] top-6 bottom-8 w-[1px] bg-[#ffffff]/10" />

        {escrow.phases.map((phase, idx) => {
          const isCompleted = phase.status === 'Approved' || phase.status === 'AutoReleased'
          const isActive = idx === currentPhaseIndex
          const isSubmitted = phase.status === 'Submitted'
          const isDisputed = phase.status === 'Disputed'
          const amount = parseFloat(phase.amount)
          const deadline = new Date(phase.deadline)
          const isOverdue = !isCompleted && deadline < new Date()
          const showSubmitForm = submitFormOpen === idx
          const showRevisionForm = revisionFormOpen === idx

          return (
            <div key={phase.id} className="relative flex gap-5">
              {/* Timeline dot */}
              {isCompleted ? (
                <div className="w-6 h-6 rounded-full bg-[#fafafa] flex items-center justify-center shrink-0 z-10 outline outline-[6px] outline-[#050505]">
                  <CheckCheck className="w-3 h-3 text-[#000000]" strokeWidth={2.5} />
                </div>
              ) : isActive ? (
                <div className="w-6 h-6 rounded-full bg-[#050505] border-[2.5px] border-[#fafafa] flex items-center justify-center shrink-0 z-10 outline outline-[6px] outline-[#050505]">
                  <div className="w-2 h-2 rounded-full bg-[#fafafa]" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#ffffff]/10 border border-[#ffffff]/20 shrink-0 z-10 outline outline-[6px] outline-[#050505]" />
              )}

              <div className="flex flex-col w-full -mt-0.5">
                <h4 className={`text-sm font-normal mb-1 ${isCompleted ? 'text-[#fafafa]' : isActive ? 'text-[#fafafa]' : 'text-[#737373]'}`}>
                  Phase {idx + 1}: {phase.description || `Phase ${idx + 1}`}
                </h4>
                <div className="flex items-center gap-3 text-xs text-[#737373] mb-1 flex-wrap">
                  <span>
                    {isCompleted ? 'Released' : 'Held'}: <span className="text-[#fafafa]">{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {token}</span>
                  </span>
                  {isCompleted ? (
                    <span>
                      Released: <span className="text-[#fafafa]">{phase.submittedAt ? new Date(phase.submittedAt).toLocaleDateString() : deadline.toLocaleDateString()}</span>
                    </span>
                  ) : (
                    <span className={isOverdue ? 'text-[#a6a6a6]' : ''}>
                      Due: {deadline.toLocaleDateString()}
                    </span>
                  )}
                </div>
                {phase.revisionCount > 0 && (
                  <span className="text-xs text-[#a6a6a6] mb-1">Revisions: {phase.revisionCount}</span>
                )}

                {/* Submitted work links history — show whenever there's a link */}
                {(() => {
                  const links = Array.isArray(phase.workLinks) && phase.workLinks.length > 0
                    ? phase.workLinks
                    : phase.workLink ? [{ url: phase.workLink, submittedAt: phase.submittedAt || '' }] : []
                  if (links.length === 0) return null
                  return (
                    <div className="mt-1 mb-1 flex flex-col gap-1.5">
                      {links.map((link, i) => {
                        const url = link.url
                        const href = url.startsWith('http') ? url : `https://${url}`
                        const isLatest = i === links.length - 1
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <Link2 className={`w-3 h-3 shrink-0 ${isLatest ? 'text-[#a6a6a6]' : 'text-[#737373]'}`} strokeWidth={1.5} />
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs transition-colors truncate underline underline-offset-2 ${isLatest ? 'text-[#a6a6a6] hover:text-[#fafafa]' : 'text-[#737373] hover:text-[#a6a6a6] line-through'}`}
                            >
                              {url}
                            </a>
                            <ExternalLink className={`w-3 h-3 shrink-0 ${isLatest ? 'text-[#a6a6a6]' : 'text-[#737373]'}`} strokeWidth={1.5} />
                            {links.length > 1 && (
                              <span className={`text-[10px] ${isLatest ? 'text-[#a6a6a6]' : 'text-[#737373]'}`}>
                                {isLatest ? '(latest)' : `(v${i + 1})`}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Tx hash for completed phases — per-phase release tx */}
                {isCompleted && phase.txHash && (
                  <div className="mt-0.5 mb-1 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-[#737373] shrink-0" strokeWidth={1.5} />
                    <span className="text-xs text-[#737373]">Tx:</span>
                    <a
                      href={`${import.meta.env.VITE_EXPLORER_URL || 'https://etherscan.io'}/tx/${phase.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#737373] hover:text-[#fafafa] transition-colors font-mono underline underline-offset-2"
                    >
                      {phase.txHash.slice(0, 8)}...{phase.txHash.slice(-6)}
                    </a>
                  </div>
                )}

                {/* Revision notes display */}
                {phase.revisionNotes && isActive && (
                  <div className="mt-1 mb-1 px-3 py-2 rounded-lg bg-[#ffffff]/5 border border-[#ffffff]/10">
                    <p className="text-xs text-[#a6a6a6]"><span className="font-medium text-[#fafafa]">Revision notes:</span> {phase.revisionNotes}</p>
                  </div>
                )}

                {/* Status badge — only show for Pending or Disputed, not Submitted */}
                {isActive && !isSubmitted && (
                  <div className="mt-2 mb-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full border border-[#ffffff]/15 bg-[#ffffff]/5 text-[#a6a6a6]`}>
                      {PhaseStatusLabel[PhaseStatus[phase.status as keyof typeof PhaseStatus] ?? 0] || phase.status}
                    </span>
                  </div>
                )}

                {/* Submit Work Form (freelancer) */}
                {showSubmitForm && (
                  <div className="mt-2 mb-2 p-4 rounded-xl bg-[#ffffff]/[0.02] border border-[#ffffff]/10">
                    <h5 className="text-xs font-normal text-[#a6a6a6] mb-3 tracking-wide">Submit Your Work</h5>
                    <div className="mb-3">
                      <div className="relative">
                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" strokeWidth={1.5} />
                        <input
                          type="url"
                          value={workLink}
                          onChange={(e) => setWorkLink(e.target.value)}
                          placeholder="Paste your work link here..."
                          className="w-full bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-[#fafafa] placeholder:text-[#737373] focus:outline-none focus:border-[#ffffff]/20 transition-colors font-light"
                        />
                      </div>
                      <p className="text-[11px] text-[#737373] mt-1.5">Share a link to your completed deliverables.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setSubmitFormOpen(null); setWorkLink('') }}
                        className="flex-1 border border-[#ffffff]/10 text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors py-2 rounded-lg text-xs font-normal cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!workLink.trim()}
                        onClick={() => {
                          if (onSubmitPhase && workLink.trim()) {
                            onSubmitPhase(escrow.chainEscrowId, workLink.trim())
                            setSubmitFormOpen(null)
                            setWorkLink('')
                          }
                        }}
                        className="flex-1 bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2 rounded-lg text-xs font-normal cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3 h-3" strokeWidth={1.5} /> Submit & Sign
                      </button>
                    </div>
                  </div>
                )}

                {/* Revision Request Form (client) */}
                {showRevisionForm && (
                  <div className="mt-2 mb-2 p-4 rounded-xl bg-[#ffffff]/[0.02] border border-[#ffffff]/10">
                    <h5 className="text-xs font-normal text-[#a6a6a6] mb-3 tracking-wide">Request Revision</h5>
                    <div className="mb-3">
                      <textarea
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        placeholder="Describe what needs to be changed..."
                        rows={3}
                        className="w-full bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-lg px-4 py-2.5 text-sm text-[#fafafa] placeholder:text-[#737373] focus:outline-none focus:border-[#ffffff]/20 transition-colors font-light resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setRevisionFormOpen(null); setRevisionNotes('') }}
                        className="flex-1 border border-[#ffffff]/10 text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors py-2 rounded-lg text-xs font-normal cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onRequestRevision) {
                            onRequestRevision(escrow.chainEscrowId, revisionNotes.trim() || undefined)
                            setRevisionFormOpen(null)
                            setRevisionNotes('')
                          }
                        }}
                        className="flex-1 bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2 rounded-lg text-xs font-normal cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3 h-3" strokeWidth={1.5} /> Request Revision
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {isActive && !isLoading && !showSubmitForm && !showRevisionForm && !walletBlocked && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {/* Freelancer: Submit completion */}
                    {isFreelancer && phase.status === 'Pending' && onSubmitPhase && (
                      <button
                        type="button"
                        onClick={() => { setSubmitFormOpen(idx); setWorkLink(phase.workLink || '') }}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors cursor-pointer font-normal"
                      >
                        <Send className="w-3 h-3" strokeWidth={1.5} /> Submit Work
                      </button>
                    )}

                    {/* Client: Approve or Request Revision when submitted */}
                    {isClient && isSubmitted && (
                      <>
                        {onApprovePhase && (
                          <button
                            type="button"
                            onClick={() => onApprovePhase(escrow.chainEscrowId)}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors cursor-pointer font-normal"
                          >
                            <ThumbsUp className="w-3 h-3" strokeWidth={1.5} /> Approve
                          </button>
                        )}
                        {onRequestRevision && (
                          <button
                            type="button"
                            onClick={() => { setRevisionFormOpen(idx); setRevisionNotes('') }}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg border border-[#ffffff]/15 text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors cursor-pointer font-normal"
                          >
                            <RotateCcw className="w-3 h-3" strokeWidth={1.5} /> Revision
                          </button>
                        )}
                      </>
                    )}

                    {/* Both: Raise dispute */}
                    {(isClient || isFreelancer) && !isDisputed && onRaiseDispute && (
                      <button
                        type="button"
                        onClick={() => onRaiseDispute(escrow.chainEscrowId)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg border border-[#ffffff]/15 text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors cursor-pointer font-normal"
                      >
                        <Flag className="w-3 h-3" strokeWidth={1.5} /> Dispute
                      </button>
                    )}
                  </div>
                )}

                {isLoading && isActive && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#a6a6a6]">
                    <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                    <span>Transaction pending...</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
