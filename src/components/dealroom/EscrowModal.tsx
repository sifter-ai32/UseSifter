import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Lock, Pen, PlusCircle, Trash2, Wallet,
  FileText, CreditCard, Loader2, PartyPopper,
  CheckCircle, Calendar, AlertTriangle, MoreVertical,
  ChevronDown, Globe, Coins, Clock, User, Users, Send,
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import type { DealRoomPhase, DealRoomMember } from '@/types/dealRoom'
import type { WorkspaceMemberInfo } from '@/lib/api'
import { TOKEN_OPTIONS, tokenLabel } from '@/lib/contracts'
import { getInitials, getImageUrl } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useWalletVerification } from '@/hooks/useEscrowContract'

type EscrowFlowStep = 'idle' | 'creating' | 'approving' | 'funding' | 'done'

interface EscrowModalProps {
  open: boolean
  onClose: () => void
  step: number
  setStep: (step: number) => void
  phases: DealRoomPhase[]
  totalPct: number
  budget: string
  setBudget: (val: string) => void
  budgetNum: number
  // Wallet
  walletConnected: boolean
  walletAddress?: string
  isCorrectChain?: boolean
  connectWallet: () => void
  disconnectWallet: () => void
  // Token
  selectedToken: string
  setSelectedToken: (token: string) => void
  autoReleaseTimeout: number
  setAutoReleaseTimeout: (days: number) => void
  // Deadlines
  phaseDeadlines: Record<number, string>
  updatePhaseDeadline: (id: number, date: string) => void
  // Freelancer
  freelancerWallet: string | null
  setFreelancerWallet: (w: string | null) => void
  freelancerId: string | null
  setFreelancerId: (id: string | null) => void
  // Terms
  tc1: boolean
  setTc1: (val: boolean) => void
  tc2: boolean
  setTc2: (val: boolean) => void
  // Flow
  isProcessing: boolean
  flowStep: EscrowFlowStep
  flowError: string | null
  requiredDeposit: number | null
  // Members & actions
  members: DealRoomMember[]
  workspaceMembers: WorkspaceMemberInfo[]
  currentUserId: string
  onRequestWallet: (freelancerId: string, freelancerName: string) => void
  addPhase: () => void
  removePhase: (id: number) => void
  updatePhaseName: (id: number, name: string) => void
  updatePhasePct: (id: number, val: string) => void
  completePayment: () => void
  cancelFlow: () => void
  finish: () => void
}

export default function EscrowModal({
  open, onClose, step, setStep,
  phases, totalPct, budget, setBudget, budgetNum,
  walletConnected, walletAddress, isCorrectChain,
  connectWallet, disconnectWallet,
  selectedToken, setSelectedToken,
  autoReleaseTimeout, setAutoReleaseTimeout,
  phaseDeadlines, updatePhaseDeadline,
  freelancerWallet, setFreelancerWallet,
  freelancerId: _freelancerId, setFreelancerId,
  tc1, setTc1, tc2, setTc2,
  isProcessing, flowStep, flowError, requiredDeposit,
  members, workspaceMembers, currentUserId, onRequestWallet,
  addPhase, removePhase, updatePhaseName, updatePhasePct,
  completePayment, cancelFlow, finish,
}: EscrowModalProps) {
  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      {step === 0 && (
        <StepSelectParticipant
          workspaceMembers={workspaceMembers}
          currentUserId={currentUserId}
          onCancel={onClose}
          onSelect={(memberId, memberWallet) => {
            setFreelancerId(memberId)
            setFreelancerWallet(memberWallet)
            setStep(1)
          }}
          onRequestWallet={(freelancerId, freelancerName) => {
            onRequestWallet(freelancerId, freelancerName)
            onClose()
          }}
        />
      )}
      {step === 1 && <StepCreate onBack={() => setStep(0)} onNext={() => setStep(2)} />}
      {step === 2 && (
        <StepPhases
          phases={phases}
          totalPct={totalPct}
          phaseDeadlines={phaseDeadlines}
          updatePhaseDeadline={updatePhaseDeadline}
          addPhase={addPhase}
          removePhase={removePhase}
          updatePhaseName={updatePhaseName}
          updatePhasePct={updatePhasePct}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepBudget
          budget={budget}
          setBudget={setBudget}
          walletConnected={walletConnected}
          walletAddress={walletAddress}
          isCorrectChain={isCorrectChain}
          connectWallet={connectWallet}
          disconnectWallet={disconnectWallet}
          selectedToken={selectedToken}
          setSelectedToken={setSelectedToken}
          autoReleaseTimeout={autoReleaseTimeout}
          setAutoReleaseTimeout={setAutoReleaseTimeout}
          freelancerWallet={freelancerWallet}
          setFreelancerWallet={setFreelancerWallet}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <StepReview
          phases={phases}
          budgetNum={budgetNum}
          selectedToken={selectedToken}
          requiredDeposit={requiredDeposit}
          tc1={tc1}
          setTc1={setTc1}
          tc2={tc2}
          setTc2={setTc2}
          isProcessing={isProcessing}
          flowStep={flowStep}
          flowError={flowError}
          onBack={() => setStep(3)}
          onConfirm={completePayment}
          onCancel={cancelFlow}
        />
      )}
      {step === 5 && <StepSuccess onFinish={finish} />}
    </Modal>
  )
}

/* ─── Step Sub-Components ─── */

function PhaseMenu({ onEditName, onDelete }: { onEditName: () => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const updatePos = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.right })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, updatePos])

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[#737373] hover:text-[#fafafa] transition-colors cursor-pointer p-1 rounded-md hover:bg-[#ffffff]/5"
      >
        <MoreVertical className="w-4 h-4" strokeWidth={1.5} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-[#1a1a1a] border border-[#ffffff]/10 rounded-lg shadow-2xl overflow-hidden min-w-[140px]"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-100%)' }}
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onEditName() }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors cursor-pointer"
          >
            <Pen className="w-3.5 h-3.5" strokeWidth={1.5} />
            Edit Name
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => { setOpen(false); onDelete() }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#a6a6a6]/70 hover:text-[#a6a6a6] hover:bg-[#a6a6a6]/5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              Delete
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

function StepSelectParticipant({
  workspaceMembers, currentUserId, onCancel, onSelect, onRequestWallet,
}: {
  workspaceMembers: WorkspaceMemberInfo[]
  currentUserId: string
  onCancel: () => void
  onSelect: (userId: string, walletAddress: string | null) => void
  onRequestWallet: (freelancerId: string, freelancerName: string) => void
}) {
  const otherMembers = workspaceMembers.filter(m => m.user.id !== currentUserId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [requestSent, setRequestSent] = useState(false)

  const selectedMember = otherMembers.find(m => m.user.id === selectedId)
  const selectedHasWallet = !!selectedMember?.user.walletAddress

  return (
    <div className="flex flex-col p-8 overflow-y-auto">
      <div className="w-12 h-12 rounded-full bg-[#ffffff]/5 border border-[#ffffff]/10 flex items-center justify-center mb-6 mt-2 shrink-0">
        <Users className="w-6 h-6 text-[#fafafa]" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl tracking-tight text-[#fafafa] font-normal mb-2">Who are you working with?</h2>
      <p className="text-sm text-[#a6a6a6] leading-relaxed mb-6">Select the person you're creating this escrow with. Funds will be released to them as milestones are completed.</p>

      <div className="space-y-2 mb-8">
        {otherMembers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[#737373]">No other members in this deal room yet.</p>
            <p className="text-xs text-[#737373] mt-1">Invite someone to the deal room first.</p>
          </div>
        ) : otherMembers.map((m) => {
          const isSelected = selectedId === m.user.id
          const avatarUrl = getImageUrl(m.user.avatar)
          return (
            <button
              key={m.user.id}
              type="button"
              onClick={() => { setSelectedId(m.user.id); setRequestSent(false) }}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#fafafa]/40 bg-[#ffffff]/10'
                  : 'border-[#ffffff]/10 bg-[#ffffff]/[0.02] hover:bg-[#ffffff]/5 hover:border-[#ffffff]/20'
              }`}
            >
              {/* Selection indicator */}
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                isSelected ? 'border-[#fafafa] bg-[#fafafa]' : 'border-[#ffffff]/20'
              }`}>
                {isSelected && <div className="w-2 h-2 rounded-full bg-[#000000]" />}
              </div>

              {/* Avatar */}
              {avatarUrl ? (
                <img src={avatarUrl} alt={m.user.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] text-xs shrink-0">
                  {getInitials(m.user.name || '?')}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#fafafa] font-normal truncate">{m.user.name}</span>
                  {m.user.userType && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#ffffff]/10 text-[#737373] uppercase tracking-wider shrink-0">
                      {m.user.userType === 'talent' ? 'Freelancer' : 'Client'}
                    </span>
                  )}
                </div>
                {m.user.walletAddress ? (
                  <span className="text-xs text-[#737373] font-mono truncate block">
                    {m.user.walletAddress.slice(0, 6)}...{m.user.walletAddress.slice(-4)}
                  </span>
                ) : (
                  <span className="text-xs text-[#f59e0b]">No wallet connected</span>
                )}
              </div>

              {/* Wallet status */}
              <div className="shrink-0">
                {m.user.walletAddress ? (
                  <CheckCircle className="w-4 h-4 text-[#fafafa]" strokeWidth={1.5} />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#f59e0b]" strokeWidth={1.5} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* No-wallet warning when selected member has no wallet */}
      {selectedMember && !selectedHasWallet && (
        <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-sm">
            <p className="text-[#f59e0b] font-medium">Wallet required for escrow</p>
            <p className="text-[#f59e0b]/70 text-xs mt-1 leading-relaxed">
              {selectedMember.user.name} hasn't connected a wallet yet. Send a request in the chat so they can connect one before creating the escrow.
            </p>
          </div>
        </div>
      )}

      <div className="mt-auto pt-4 flex gap-3 border-t border-[#ffffff]/10 shrink-0">
        <button type="button" onClick={onCancel} className="flex-1 border border-[#ffffff]/20 text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer">Cancel</button>
        {selectedMember && !selectedHasWallet ? (
          <button
            type="button"
            onClick={() => {
              onRequestWallet(selectedMember.user.id, selectedMember.user.name)
              setRequestSent(true)
            }}
            disabled={requestSent}
            className="flex-1 bg-[#f59e0b] text-[#000000] hover:bg-[#d97706] transition-colors py-2.5 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {requestSent ? (
              <><CheckCircle className="w-4 h-4" strokeWidth={1.5} /> Request Sent</>
            ) : (
              <><Send className="w-4 h-4" strokeWidth={1.5} /> Request Wallet Connection</>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (selectedMember) onSelect(selectedMember.user.id, selectedMember.user.walletAddress)
            }}
            disabled={!selectedId}
            className="flex-1 bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  )
}

function StepOverview({ members, onCancel, onNext }: { members: DealRoomMember[]; onCancel: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-col p-8 overflow-y-auto">
      <h2 className="text-xl tracking-tight text-[#fafafa] font-normal mb-2 mt-2">Project Overview</h2>
      <p className="text-sm text-[#a6a6a6] leading-relaxed mb-6">Review the deal room details before initiating the smart contract.</p>
      <div className="bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-xl p-5 mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="relative cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] text-sm">ER</div>
            <div className="absolute inset-0 bg-[#000000]/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Pen className="w-3.5 h-3.5 text-[#fafafa]" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex-1 flex justify-between items-center">
            <h3 className="text-base font-normal text-[#fafafa]">Deal Room Escrow</h3>
            <button type="button" className="text-[#737373] hover:text-[#fafafa] p-1.5 rounded-md hover:bg-[#ffffff]/5 transition-colors cursor-pointer">
              <Pen className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 justify-between items-start pt-3 border-t border-[#ffffff]/5">
          <p className="text-sm text-[#a6a6a6] leading-relaxed">Funds are held in a blockchain escrow smart contract and released only when milestones are approved.</p>
        </div>
      </div>
      <h3 className="text-sm font-normal text-[#fafafa] tracking-wide mb-3 uppercase">Participants</h3>
      <div className="space-y-3 mb-8">
        {members.slice(0, 2).map((m) => (
          <div key={m.name} className="flex items-center justify-between p-3 border border-[#ffffff]/10 rounded-lg bg-[#ffffff]/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#ffffff]/10 flex items-center justify-center text-[#fafafa] text-xs">{m.initials}</div>
              <span className="text-sm text-[#fafafa] font-normal">{m.name}</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${m.role === 'Owner' ? 'border border-[#ffffff]/20 bg-[#ffffff]/5 text-[#fafafa]' : 'text-[#a6a6a6]'}`}>{m.role}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-4 flex gap-3 border-t border-[#ffffff]/10 shrink-0">
        <button type="button" onClick={onCancel} className="flex-1 border border-[#ffffff]/20 text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer">Cancel</button>
        <button type="button" onClick={onNext} className="flex-1 bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer">Proceed to Setup</button>
      </div>
    </div>
  )
}

function StepCreate({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-col p-8 overflow-y-auto">
      <div className="w-12 h-12 rounded-full bg-[#ffffff]/5 border border-[#ffffff]/10 flex items-center justify-center mb-6 mt-2 shrink-0">
        <Lock className="w-6 h-6 text-[#fafafa]" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl tracking-tight text-[#fafafa] font-normal mb-2">Create Deal Escrow</h2>
      <p className="text-sm text-[#a6a6a6] leading-relaxed mb-4">Secure your project by funding an escrow. Funds are held safely on the Ethereum blockchain and released only when you approve project milestones.</p>
      <div className="bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2 text-sm text-[#a6a6a6]">
          <CheckCircle className="w-4 h-4 text-[#fafafa]" strokeWidth={1.5} />
          <span>Smart contract secured funds</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#a6a6a6]">
          <CheckCircle className="w-4 h-4 text-[#fafafa]" strokeWidth={1.5} />
          <span>Milestone-based releases</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#a6a6a6]">
          <CheckCircle className="w-4 h-4 text-[#fafafa]" strokeWidth={1.5} />
          <span>Built-in dispute resolution</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#a6a6a6]">
          <CheckCircle className="w-4 h-4 text-[#fafafa]" strokeWidth={1.5} />
          <span>2.5% platform fee per side</span>
        </div>
      </div>
      <div className="mt-auto pt-4 flex gap-3 border-t border-[#ffffff]/10 shrink-0">
        <button type="button" onClick={onBack} className="flex-1 border border-[#ffffff]/20 text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer">Back</button>
        <button type="button" onClick={onNext} className="flex-1 bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer">Define Phases</button>
      </div>
    </div>
  )
}

function StepPhases({
  phases, totalPct, phaseDeadlines, updatePhaseDeadline,
  addPhase, removePhase, updatePhaseName, updatePhasePct, onBack, onNext,
}: {
  phases: DealRoomPhase[]; totalPct: number
  phaseDeadlines: Record<number, string>
  updatePhaseDeadline: (id: number, date: string) => void
  addPhase: () => void; removePhase: (id: number) => void
  updatePhaseName: (id: number, name: string) => void; updatePhasePct: (id: number, val: string) => void
  onBack: () => void; onNext: () => void
}) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const pctInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-edit the first phase if it has no name on mount
  useEffect(() => {
    if (phases.length > 0 && !phases[0].name && editingId === null) {
      setEditingId(phases[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-focus name input when editing starts
  useEffect(() => {
    if (editingId !== null && editingId !== -1 && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingId])

  // Clear warning after 3s
  useEffect(() => {
    if (!warning) return
    const t = setTimeout(() => setWarning(null), 3000)
    return () => clearTimeout(t)
  }, [warning])

  const handleAddPhase = () => {
    if (totalPct >= 100) {
      setWarning('Total is already 100%. Adjust existing phases before adding a new one.')
      return
    }
    addPhase()
    // Get the id of the newly added phase (it uses Date.now())
    // We set editing after a tick so the phase is rendered
    setTimeout(() => {
      const lastPhase = phases[phases.length] // won't work since state hasn't updated yet
      // Instead, use a flag to auto-edit the latest phase
      setEditingId(-1) // sentinel: edit the last phase once it renders
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
    }, 0)
  }

  // When phases change and we have the sentinel, edit the last phase
  useEffect(() => {
    if (editingId === -1 && phases.length > 0) {
      const lastPhase = phases[phases.length - 1]
      setEditingId(lastPhase.id)
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight
        }
      }, 50)
    }
  }, [phases, editingId])

  // Warn when total exceeds 100%
  useEffect(() => {
    if (totalPct > 100) {
      setWarning(`Total is ${totalPct}%. Reduce percentages to equal exactly 100%.`)
    } else if (warning && totalPct <= 100) {
      setWarning(null)
    }
  }, [totalPct])

  const handleNameKeyDown = (e: React.KeyboardEvent, phaseId: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Move focus to percentage input
      setEditingId(null)
      // Focus the pct input for this phase
      setTimeout(() => {
        const pctEl = document.querySelector(`[data-pct-id="${phaseId}"]`) as HTMLInputElement
        if (pctEl) { pctEl.focus(); pctEl.select() }
      }, 50)
    }
    if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  return (
    <div className="flex flex-col p-8 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 mt-2 shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#ffffff]/5 border border-[#ffffff]/10 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-[#fafafa]" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl tracking-tight text-[#fafafa] font-normal">Project Phases</h2>
          <p className="text-sm text-[#737373]">Define milestones that total 100%.</p>
        </div>
        {/* Total badge */}
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 ${
          totalPct === 100
            ? 'bg-[#fafafa]/10 text-[#fafafa] border border-[#fafafa]/20'
            : totalPct > 100
              ? 'bg-[#a6a6a6]/10 text-[#a6a6a6] border border-[#a6a6a6]/20'
              : 'bg-[#ffffff]/5 text-[#a6a6a6] border border-[#ffffff]/10'
        }`}>
          {totalPct}%
        </div>
      </div>

      {/* Warning */}
      {warning && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-[#f59e0b] shrink-0" strokeWidth={1.5} />
          <span className="text-xs text-[#f59e0b]">{warning}</span>
        </div>
      )}

      {/* Phases list */}
      <div className="flex-1 overflow-y-auto space-y-3" ref={listRef}>
        {phases.map((p, index) => (
          <div key={p.id} className="rounded-xl bg-[#ffffff]/[0.03] relative shrink-0">
            {/* Phase header bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#ffffff]/[0.04] rounded-t-xl">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-6 h-6 rounded-md bg-[#ffffff]/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-medium text-[#fafafa]">{index + 1}</span>
                </div>
                {editingId === p.id ? (
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={p.name}
                    onChange={(e) => updatePhaseName(p.id, e.target.value)}
                    onKeyDown={(e) => handleNameKeyDown(e, p.id)}
                    onBlur={() => setEditingId(null)}
                    placeholder="Enter phase name..."
                    className="bg-[#ffffff]/5 text-sm text-[#fafafa] focus:outline-none font-normal placeholder:text-[#737373] flex-1 min-w-0 px-2 py-1 rounded-md border border-[#ffffff]/20 focus:border-[#ffffff]/40 transition-colors"
                  />
                ) : (
                  <span className="text-sm text-[#fafafa] font-normal truncate">{p.name || 'Untitled Phase'}</span>
                )}
              </div>
              <PhaseMenu
                onEditName={() => setEditingId(p.id)}
                onDelete={phases.length > 1 ? () => removePhase(p.id) : undefined}
              />
            </div>

            {/* Phase body */}
            <div className="px-4 py-3 flex items-center gap-3">
              {/* Progress bar */}
              <div className="flex-1">
                <div className="h-1.5 bg-[#ffffff]/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      p.pct > 0 ? 'bg-[#fafafa]' : ''
                    }`}
                    style={{ width: `${Math.min(p.pct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Percentage input */}
              <div className="relative flex items-center shrink-0">
                <input
                  type="number"
                  min={0}
                  max={100}
                  data-pct-id={p.id}
                  value={p.pctInput !== undefined ? p.pctInput : p.pct}
                  onChange={(e) => updatePhasePct(p.id, e.target.value)}
                  className="w-14 text-center bg-[#ffffff]/5 rounded-lg py-1.5 text-sm text-[#fafafa] focus:outline-none focus:bg-[#ffffff]/10 transition-colors"
                />
                <span className="absolute right-1.5 text-xs text-[#737373] pointer-events-none">%</span>
              </div>

              {/* Deadline */}
              <div className="relative shrink-0">
                <input
                  type="date"
                  value={phaseDeadlines[p.id] ? phaseDeadlines[p.id].split('T')[0] : ''}
                  onChange={(e) => updatePhaseDeadline(p.id, e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className="bg-[#ffffff]/5 rounded-lg px-2.5 py-1.5 text-sm text-[#fafafa] focus:outline-none focus:bg-[#ffffff]/10 transition-colors [color-scheme:dark] w-[130px]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Phase */}
      <div className="mt-4 mb-2 shrink-0">
        <button type="button" onClick={handleAddPhase} className="w-full py-2.5 border border-dashed border-[#ffffff]/15 rounded-xl text-sm text-[#737373] hover:text-[#fafafa] hover:border-[#ffffff]/30 hover:bg-[#ffffff]/[0.02] transition-all flex items-center justify-center gap-2 cursor-pointer">
          <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
          Add Phase
        </button>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 flex gap-3 border-t border-[#ffffff]/10 shrink-0">
        <button type="button" onClick={onBack} className="flex-1 border border-[#ffffff]/20 text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer">Back</button>
        <button
          type="button"
          onClick={onNext}
          disabled={totalPct !== 100}
          className="flex-1 bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Set Budget
        </button>
      </div>
    </div>
  )
}

function StepBudget({
  budget, setBudget,
  walletConnected, walletAddress, isCorrectChain,
  connectWallet, disconnectWallet: _disconnectWallet,
  selectedToken, setSelectedToken,
  autoReleaseTimeout, setAutoReleaseTimeout,
  freelancerWallet, setFreelancerWallet: _setFreelancerWallet,
  onBack, onNext,
}: {
  budget: string; setBudget: (val: string) => void
  walletConnected: boolean; walletAddress?: string; isCorrectChain?: boolean
  connectWallet: () => void; disconnectWallet: () => void
  selectedToken: string; setSelectedToken: (t: string) => void
  autoReleaseTimeout: number; setAutoReleaseTimeout: (d: number) => void
  freelancerWallet: string | null; setFreelancerWallet: (w: string | null) => void
  onBack: () => void; onNext: () => void
}) {
  const registeredWallet = useAuthStore((s) => s.user)?.walletAddress
  const { walletError } = useWalletVerification(registeredWallet)
  const [chainOpen, setChainOpen] = useState(false)
  const [coinOpen, setCoinOpen] = useState(false)
  const chainRef = useRef<HTMLDivElement>(null)
  const coinRef = useRef<HTMLDivElement>(null)

  // Shared input style
  const inputCls = 'w-full bg-[#ffffff]/[0.03] border border-[#ffffff]/10 text-[#fafafa] text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#ffffff]/30 transition-colors font-light placeholder:text-[#737373]'
  const labelCls = 'flex items-center gap-1.5 text-xs font-normal text-[#737373] uppercase tracking-wider mb-2'

  useEffect(() => {
    if (!chainOpen && !coinOpen) return
    const handler = (e: MouseEvent) => {
      if (chainOpen && chainRef.current && !chainRef.current.contains(e.target as Node)) setChainOpen(false)
      if (coinOpen && coinRef.current && !coinRef.current.contains(e.target as Node)) setCoinOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [chainOpen, coinOpen])

  const dropdownBtnCls = `w-full ${inputCls} flex items-center gap-2.5 cursor-pointer hover:bg-[#ffffff]/[0.05]`
  const dropdownMenuCls = 'absolute left-0 right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-[#ffffff]/10 rounded-xl shadow-2xl overflow-hidden'
  const dropdownItemCls = (active: boolean) => `w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors cursor-pointer ${active ? 'text-[#fafafa] bg-[#ffffff]/5' : 'text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/[0.03]'}`

  return (
    <div className="flex flex-col p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 mt-2 shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#ffffff]/5 border border-[#ffffff]/10 flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5 text-[#fafafa]" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-xl tracking-tight text-[#fafafa] font-normal">Budget & Payment</h2>
          <p className="text-sm text-[#737373]">Configure chain, token, and wallet details.</p>
        </div>
      </div>

      {/* Chain & Coin row */}
      <div className="flex gap-3 mb-4">
        {/* Chain dropdown */}
        <div className="flex-1 relative" ref={chainRef}>
          <label className={labelCls}>
            <Globe className="w-3 h-3" strokeWidth={1.5} />
            Chain
          </label>
          <button type="button" onClick={() => setChainOpen(v => !v)} className={dropdownBtnCls}>
            <img src="/eth-logo.svg" alt="ETH" className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-left text-sm">Ethereum</span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#737373] transition-transform ${chainOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
          </button>
          {chainOpen && (
            <div className={dropdownMenuCls}>
              <button type="button" onClick={() => setChainOpen(false)} className={dropdownItemCls(true)}>
                <img src="/eth-logo.svg" alt="ETH" className="w-5 h-5 shrink-0" />
                <div className="flex-1 text-left">
                  <span>Ethereum</span>
                  <span className="text-xs text-[#737373] ml-1">{import.meta.env.VITE_NETWORK_NAME || 'Ethereum'}</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Payment Coin dropdown */}
        <div className="flex-1 relative" ref={coinRef}>
          <label className={labelCls}>
            <Coins className="w-3 h-3" strokeWidth={1.5} />
            Payment Coin
          </label>
          <button type="button" onClick={() => setCoinOpen(v => !v)} className={dropdownBtnCls}>
            <img src={tokenLabel(selectedToken) === 'USDC' ? '/usdc-logo.svg' : '/usdt-logo.svg'} alt={tokenLabel(selectedToken)} className="w-5 h-5 rounded-full shrink-0" />
            <span className="flex-1 text-left text-sm">{tokenLabel(selectedToken)}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#737373] transition-transform ${coinOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
          </button>
          {coinOpen && (
            <div className={dropdownMenuCls}>
              {TOKEN_OPTIONS.map((t) => (
                <button
                  key={t.address}
                  type="button"
                  onClick={() => { setSelectedToken(t.address); setCoinOpen(false) }}
                  className={dropdownItemCls(selectedToken === t.address)}
                >
                  <img src={t.label === 'USDC' ? '/usdc-logo.svg' : '/usdt-logo.svg'} alt={t.label} className="w-5 h-5 rounded-full shrink-0" />
                  <span className="flex-1 text-left">{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Total Budget */}
      <div className="mb-4">
        <label className={labelCls}>
          <CreditCard className="w-3 h-3" strokeWidth={1.5} />
          Total Budget
        </label>
        <div className="relative flex items-center">
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="0.00"
            className={`${inputCls} pr-16`}
          />
          <span className="absolute right-4 text-xs text-[#737373] pointer-events-none">{tokenLabel(selectedToken)}</span>
        </div>
      </div>

      {/* Freelancer Wallet */}
      <div className="mb-4">
        <label className={labelCls}>
          <User className="w-3 h-3" strokeWidth={1.5} />
          Freelancer Wallet
        </label>
        {freelancerWallet ? (
          <div className="w-full bg-[#fafafa]/5 border border-[#fafafa]/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#fafafa] shrink-0" strokeWidth={1.5} />
            <span className="text-sm font-mono text-[#fafafa] truncate">{freelancerWallet}</span>
          </div>
        ) : (
          <div className="w-full bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#f59e0b] shrink-0" strokeWidth={1.5} />
            <span className="text-sm text-[#f59e0b]">Freelancer hasn't set up their wallet yet</span>
          </div>
        )}
        <p className="text-[11px] text-[#737373] mt-1.5">Auto-fetched from the freelancer's profile.</p>
      </div>

      {/* Auto-Release */}
      <div className="mb-4">
        <label className={labelCls}>
          <Clock className="w-3 h-3" strokeWidth={1.5} />
          Auto-Release Timeout
        </label>
        <div className="relative flex items-center">
          <input
            type="number"
            min={1}
            max={30}
            value={autoReleaseTimeout}
            onChange={(e) => setAutoReleaseTimeout(parseInt(e.target.value) || 7)}
            className={`${inputCls} pr-14`}
          />
          <span className="absolute right-4 text-xs text-[#737373] pointer-events-none">days</span>
        </div>
        <p className="text-[11px] text-[#737373] mt-1.5 leading-relaxed">Funds auto-release if client doesn't respond after freelancer submits work.</p>
      </div>

      {/* Wallet Connection */}
      <div className="mb-4">
        <label className={labelCls}>
          <Wallet className="w-3 h-3" strokeWidth={1.5} />
          Your Wallet
        </label>
        {!walletConnected ? (
          <button type="button" onClick={connectWallet} className={`${inputCls} flex items-center justify-center gap-2 cursor-pointer hover:bg-[#ffffff]/[0.05]`}>
            <Wallet className="w-4 h-4" strokeWidth={1.5} />
            <span>Connect MetaMask</span>
          </button>
        ) : (
          <>
            <WalletStatus walletAddress={walletAddress} isCorrectChain={isCorrectChain} />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 flex gap-3 border-t border-[#ffffff]/10 shrink-0">
        <button type="button" onClick={onBack} className="flex-1 border border-[#ffffff]/20 text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer">Back</button>
        <button
          type="button"
          onClick={onNext}
          disabled={!walletConnected || !freelancerWallet || !budget || !!walletError}
          className="flex-1 bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Review & Deposit
        </button>
      </div>
    </div>
  )
}

function StepReview({
  phases, budgetNum, selectedToken, requiredDeposit,
  tc1, setTc1, tc2, setTc2, isProcessing, flowStep, flowError,
  onBack, onConfirm, onCancel,
}: {
  phases: DealRoomPhase[]; budgetNum: number
  selectedToken: string; requiredDeposit: number | null
  tc1: boolean; setTc1: (val: boolean) => void
  tc2: boolean; setTc2: (val: boolean) => void
  isProcessing: boolean; flowStep: EscrowFlowStep
  flowError: string | null
  onBack: () => void; onConfirm: () => void; onCancel: () => void
}) {
  const token = tokenLabel(selectedToken)
  const deposit = requiredDeposit ?? budgetNum * 1.025

  const flowLabel = (() => {
    switch (flowStep) {
      case 'creating': return 'Creating escrow on-chain...'
      case 'approving': return `Approving ${token} spend...`
      case 'funding': return 'Funding escrow...'
      default: return null
    }
  })()

  return (
    <div className="flex flex-col p-8 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6 mt-2">
        <div className="w-10 h-10 rounded-full bg-[#ffffff]/10 border border-[#ffffff]/20 flex items-center justify-center text-[#fafafa] shrink-0">
          <FileText className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-xl tracking-tight text-[#fafafa] font-normal">Review Commitment</h2>
          <p className="text-sm text-[#a6a6a6]">Finalize and accept the terms.</p>
        </div>
      </div>
      <div className="bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-xl p-5 mb-4">
        <div className="flex justify-between items-center mb-3 pb-3 border-b border-[#ffffff]/10">
          <span className="text-sm text-[#a6a6a6]">Project Value</span>
          <span className="text-lg font-normal text-[#fafafa]">{budgetNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {token}</span>
        </div>
        <div className="flex justify-between items-center mb-3 pb-3 border-b border-[#ffffff]/10">
          <span className="text-sm text-[#a6a6a6]">Required Deposit (incl. 2.5% fee)</span>
          <span className="text-sm font-normal text-[#fafafa]">{deposit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {token}</span>
        </div>
        <div className="space-y-3">
          {phases.map((p) => {
            const amt = budgetNum * (p.pct / 100)
            return (
              <div key={p.id} className="flex justify-between items-center text-sm">
                <span className="text-[#737373]">{p.name} ({p.pct}%)</span>
                <span className="text-[#fafafa]">{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {token}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Flow status */}
      {flowLabel && (
        <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#3b82f6]" strokeWidth={1.5} />
            <span className="text-sm text-[#3b82f6]">{flowLabel}</span>
          </div>
          <button type="button" onClick={onCancel} className="text-xs text-[#3b82f6] hover:text-[#fafafa] transition-colors cursor-pointer underline underline-offset-2">Cancel</button>
        </div>
      )}

      {flowError && (
        <div className="bg-[#a6a6a6]/10 border border-[#a6a6a6]/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#a6a6a6]" strokeWidth={1.5} />
            <span className="text-sm text-[#a6a6a6]">{flowError}</span>
          </div>
          <button type="button" onClick={onCancel} className="text-xs text-[#a6a6a6] hover:text-[#fafafa] transition-colors cursor-pointer underline underline-offset-2">Dismiss</button>
        </div>
      )}

      <div className="space-y-4 mb-8">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input type="checkbox" checked={tc1} onChange={(e) => setTc1(e.target.checked)} className="mt-1 w-4 h-4 rounded border-[#ffffff]/20 bg-[#ffffff]/5 text-[#fafafa] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#fafafa]" />
          <span className="text-sm text-[#a6a6a6] leading-relaxed group-hover:text-[#fafafa] transition-colors">I agree to the Escrow Terms of Service and authorize the smart contract to hold my funds.</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input type="checkbox" checked={tc2} onChange={(e) => setTc2(e.target.checked)} className="mt-1 w-4 h-4 rounded border-[#ffffff]/20 bg-[#ffffff]/5 text-[#fafafa] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#fafafa]" />
          <span className="text-sm text-[#a6a6a6] leading-relaxed group-hover:text-[#fafafa] transition-colors">I understand that funds will only be released upon my approval of completed milestones.</span>
        </label>
      </div>
      <div className="mt-auto pt-4 flex gap-3 border-t border-[#ffffff]/10 shrink-0">
        <button type="button" onClick={onBack} disabled={isProcessing} className="flex-1 border border-[#ffffff]/20 text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors py-2.5 rounded-lg text-sm font-normal cursor-pointer disabled:opacity-50">Back</button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!(tc1 && tc2) || isProcessing}
          className="flex-1 bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-2.5 rounded-lg text-sm font-normal disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> Processing...</>
          ) : (
            <><CreditCard className="w-4 h-4" strokeWidth={1.5} /> Create & Fund Escrow</>
          )}
        </button>
      </div>
    </div>
  )
}

function WalletStatus({ walletAddress, isCorrectChain }: { walletAddress?: string; isCorrectChain?: boolean }) {
  const registeredWallet = useAuthStore((s) => s.user)?.walletAddress
  const { walletError } = useWalletVerification(registeredWallet)
  const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : ''

  return (
    <>
      {walletError ? (
        <div className="w-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl px-4 py-2.5 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="text-sm text-[#f59e0b] font-normal">Wrong wallet connected</p>
            <p className="text-xs text-[#f59e0b]/70 mt-0.5">Connected: <span className="font-mono">{shortAddr}</span></p>
            <p className="text-xs text-[#f59e0b]/70 mt-1 leading-relaxed">Please switch MetaMask to the wallet you registered in Settings.</p>
          </div>
        </div>
      ) : (
        <div className="w-full bg-[#fafafa]/5 border border-[#fafafa]/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#fafafa]">
            <CheckCircle className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-sm font-mono">{shortAddr}</span>
          </div>
          {!isCorrectChain && (
            <span className="text-xs text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-full">Switch to {import.meta.env.VITE_NETWORK_NAME || 'Ethereum'}</span>
          )}
        </div>
      )}
    </>
  )
}

function StepSuccess({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="flex flex-col p-10 items-center justify-center text-center min-h-[420px]">
      <div className="w-20 h-20 rounded-full bg-[#fafafa]/10 border border-[#fafafa]/30 flex items-center justify-center mb-6">
        <PartyPopper className="w-10 h-10 text-[#fafafa]" strokeWidth={1.5} />
      </div>
      <h2 className="text-2xl tracking-tight text-[#fafafa] font-normal mb-3">Congratulations!</h2>
      <p className="text-sm text-[#a6a6a6] leading-relaxed mb-10 max-w-[260px]">Your escrow has been successfully created and funded on-chain. The contract is active and Phase 1 has officially begun.</p>
      <button type="button" onClick={onFinish} className="w-full bg-[#fafafa] text-[#000000] hover:bg-[#a6a6a6] transition-colors py-3 rounded-lg text-sm font-normal shrink-0 cursor-pointer">
        Return to Chat
      </button>
    </div>
  )
}
