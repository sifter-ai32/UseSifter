import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DealRoomPhase } from '@/types/dealRoom'
import { useWallet, useEscrowWrite, useComputeRequiredDeposit } from '@/hooks/useEscrowContract'
import { useAuthStore } from '@/stores/authStore'
import { USDC_ADDRESS, fromRawAmount } from '@/lib/contracts'
import * as api from '@/lib/api'

const freshPhase = (): DealRoomPhase => ({ id: Date.now(), name: '', pct: 0 })

type EscrowFlowStep = 'idle' | 'creating' | 'done'

interface EscrowDraft {
  step: number
  phases: DealRoomPhase[]
  budget: string
  selectedToken: string
  autoReleaseTimeout: number
  phaseDeadlines: Record<number, string>
  freelancerWallet: string | null
  freelancerId: string | null
}

function storageKey(wsId: string) { return `escrow-draft-${wsId}` }

function loadDraft(wsId?: string | null): EscrowDraft | null {
  if (!wsId) return null
  try {
    const raw = localStorage.getItem(storageKey(wsId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveDraft(wsId: string | null | undefined, draft: EscrowDraft) {
  if (!wsId) return
  try { localStorage.setItem(storageKey(wsId), JSON.stringify(draft)) } catch { /* noop */ }
}

function clearDraft(wsId: string | null | undefined) {
  if (!wsId) return
  try { localStorage.removeItem(storageKey(wsId)) } catch { /* noop */ }
}

interface WorkspaceMember {
  id: string
  user: { id: string; walletAddress: string | null; userType: string | null }
}

export function useEscrow(workspaceId?: string | null, _workspaceMemberIds?: string[], _workspaceMembers?: WorkspaceMember[]) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  // Load saved draft for this workspace
  const draft = loadDraft(workspaceId)

  // UI state
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState(draft?.step ?? 1)
  const [slideOutOpen, setSlideOutOpen] = useState(false)

  // Phase config
  const [phases, setPhases] = useState<DealRoomPhase[]>(draft?.phases ?? [freshPhase()])
  const [budget, setBudget] = useState(draft?.budget ?? '')
  const [tc1, setTc1] = useState(false)
  const [tc2, setTc2] = useState(false)

  // Escrow config
  const [selectedToken, setSelectedToken] = useState<string>(draft?.selectedToken ?? USDC_ADDRESS)
  const [autoReleaseTimeout, setAutoReleaseTimeout] = useState(draft?.autoReleaseTimeout ?? 7)
  const [phaseDeadlines, setPhaseDeadlines] = useState<Record<number, string>>(draft?.phaseDeadlines ?? {})

  // Streamflow flow state
  const [flowStep, setFlowStep] = useState<EscrowFlowStep>('idle')
  const [flowError, setFlowError] = useState<string | null>(null)
  const [freelancerWallet, setFreelancerWallet] = useState<string | null>(draft?.freelancerWallet ?? null)
  const [freelancerId, setFreelancerId] = useState<string | null>(draft?.freelancerId ?? null)

  // Persist draft to localStorage whenever data changes
  useEffect(() => {
    const hasData = phases.some(p => p.name || p.pct > 0) || budget || freelancerWallet
    if (hasData) {
      saveDraft(workspaceId, { step, phases, budget, selectedToken, autoReleaseTimeout, phaseDeadlines, freelancerWallet, freelancerId })
    }
  }, [step, phases, budget, selectedToken, autoReleaseTimeout, phaseDeadlines, freelancerWallet, freelancerId, workspaceId])

  // Wallet
  const wallet = useWallet()
  const walletConnected = wallet.isConnected

  // Budget
  const totalPct = phases.reduce((sum, p) => sum + p.pct, 0)
  const budgetNum = parseFloat(budget) || 0
  const { requiredDeposit } = useComputeRequiredDeposit(budgetNum)

  // Fetch existing escrow for this workspace
  const { data: workspaceEscrows, isPending: escrowsPending } = useQuery({
    queryKey: ['workspace-escrows', workspaceId, user?.id],
    queryFn: () => api.listEscrows(user!.id, undefined, workspaceId!),
    enabled: !!user?.id && !!workspaceId,
    staleTime: 60_000,
  })
  const escrowLoading = !!user?.id && !!workspaceId && escrowsPending

  // Find escrow linked to this workspace (filtered server-side by workspaceId)
  const activeEscrow = workspaceEscrows?.[0] ?? null
  const isActive = !!activeEscrow && activeEscrow.status !== 'Cancelled'

  // Streamflow write hook — no longer needs an onConfirmed callback for create flow
  // (handled inline in completePayment); used directly by panel actions
  const escrowWrite = useEscrowWrite()

  const isProcessing = escrowWrite.isLoading || flowStep === 'creating'

  // Allow user to manually cancel a stuck flow
  const cancelFlow = useCallback(() => {
    setFlowStep('idle')
    setFlowError('Transaction cancelled.')
  }, [])

  // Phase CRUD
  const addPhase = useCallback(() => {
    setPhases((prev) => [...prev, { id: Date.now(), name: '', pct: 0 }])
  }, [])

  const removePhase = useCallback((id: number) => {
    setPhases((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const updatePhaseName = useCallback((id: number, name: string) => {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }, [])

  const updatePhasePct = useCallback((id: number, val: string) => {
    if (val === '') {
      setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, pct: 0, pctInput: '' } : p)))
      return
    }
    let num = parseInt(val) || 0
    if (num < 0) num = 0
    if (num > 100) num = 100
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, pct: num, pctInput: undefined } : p)))
  }, [])

  const updatePhaseDeadline = useCallback((id: number, date: string) => {
    setPhaseDeadlines(prev => ({ ...prev, [id]: date }))
  }, [])

  // Reload draft from localStorage when switching workspaces
  const prevWorkspaceRef = useRef(workspaceId)
  useEffect(() => {
    if (workspaceId && prevWorkspaceRef.current && workspaceId !== prevWorkspaceRef.current) {
      const newDraft = loadDraft(workspaceId)
      setPhases(newDraft?.phases ?? [freshPhase()])
      setBudget(newDraft?.budget ?? '')
      setPhaseDeadlines(newDraft?.phaseDeadlines ?? {})
      setSelectedToken(newDraft?.selectedToken ?? USDC_ADDRESS)
      setAutoReleaseTimeout(newDraft?.autoReleaseTimeout ?? 7)
      setFreelancerWallet(newDraft?.freelancerWallet ?? null)
      setFreelancerId(newDraft?.freelancerId ?? null)
      setTc1(false)
      setTc2(false)
      setStep(newDraft?.step ?? 0)
    }
    prevWorkspaceRef.current = workspaceId
  }, [workspaceId])

  // Modal actions
  const openEscrow = useCallback(() => {
    if (!isActive) {
      setFlowStep('idle')
      setFlowError(null)
      setStep((prev) => {
        if (!freelancerId) return 0
        if (prev < 1 || prev >= 5) return 1
        return prev
      })
      setModalOpen(true)
    } else {
      setSlideOutOpen(true)
    }
  }, [isActive, freelancerId])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setFlowStep('idle')
    setFlowError(null)
  }, [])

  // Streamflow: create N streams in one flow (no separate approve/fund step)
  const completePayment = useCallback(async () => {
    if (!wallet.isConnected || !freelancerWallet || !user || !freelancerId) {
      setFlowError('Wallet not connected or freelancer wallet not set')
      return
    }

    setFlowError(null)
    setFlowStep('creating')

    const percentagesBps = phases.map(p => p.pct * 100)
    const deadlines = phases.map((p, i) => {
      const dl = phaseDeadlines[p.id]
      if (dl) return Math.floor(new Date(dl).getTime() / 1000)
      return Math.floor(Date.now() / 1000) + (i + 1) * 30 * 86400
    })
    const descriptions = phases.map(p => p.name)

    try {
      const streamIds = await escrowWrite.createEscrowPhases({
        freelancerWallet,
        tokenAddress: selectedToken,
        totalAmount: budgetNum,
        percentagesBps,
        deadlines,
        descriptions,
      })

      if (!streamIds || streamIds.length === 0) {
        throw new Error('No streams were created')
      }

      await api.createEscrowRecord({
        chainEscrowId: streamIds[0],
        clientId: user.id,
        freelancerId,
        projectTitle: 'Deal Room Escrow',
        tokenAddress: selectedToken,
        totalAmount: String(budgetNum),
        totalDeposit: String(budgetNum), // no fee on Streamflow
        autoReleaseTimeout: autoReleaseTimeout * 86400,
        txHashCreate: escrowWrite.txHash ?? undefined,
        workspaceId: workspaceId || undefined,
        phases: phases.map((p, i) => ({
          phaseIndex: i,
          description: p.name,
          percentageBps: p.pct * 100,
          amount: String(budgetNum * (p.pct / 100)),
          deadline: phaseDeadlines[p.id] || new Date(deadlines[i] * 1000).toISOString(),
          streamId: streamIds[i],
        })),
      })

      setFlowStep('done')
      setStep(5)
      queryClient.invalidateQueries({ queryKey: ['workspace-escrows'] })
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      setFlowError(err.message || 'Failed to create escrow')
      setFlowStep('idle')
    }
  }, [
    wallet.isConnected, freelancerWallet, user, freelancerId, phases, phaseDeadlines,
    selectedToken, budgetNum, autoReleaseTimeout, escrowWrite, workspaceId, queryClient,
  ])

  const finish = useCallback(() => {
    setModalOpen(false)
    setFlowStep('idle')
    setFlowError(null)
    setTc1(false)
    setTc2(false)
    setPhases([freshPhase()])
    setBudget('')
    setPhaseDeadlines({})
    setFreelancerWallet(null)
    setFreelancerId(null)
    clearDraft(workspaceId)
    setTimeout(() => setStep(1), 300)
  }, [workspaceId])

  // Connect wallet action
  const connectWallet = useCallback(() => {
    wallet.connectWallet()
  }, [wallet])

  const disconnectWallet = useCallback(() => {
    wallet.disconnect?.()
  }, [wallet])

  return {
    // Escrow state
    escrowLoading,
    isActive,
    activeEscrow,
    modalOpen,
    step,
    setStep,
    slideOutOpen,
    setSlideOutOpen,
    // Phase config
    phases,
    budget,
    setBudget,
    totalPct,
    budgetNum,
    addPhase,
    removePhase,
    updatePhaseName,
    updatePhasePct,
    // Deadlines
    phaseDeadlines,
    updatePhaseDeadline,
    // Token
    selectedToken,
    setSelectedToken,
    autoReleaseTimeout,
    setAutoReleaseTimeout,
    // Wallet
    walletConnected,
    walletAddress: wallet.address,
    isCorrectChain: true, // Solana has no chain switching — always true
    connectWallet,
    disconnectWallet,
    // Freelancer
    freelancerWallet,
    setFreelancerWallet,
    freelancerId,
    setFreelancerId,
    // Terms
    tc1,
    setTc1,
    tc2,
    setTc2,
    // Flow
    isProcessing,
    flowStep,
    flowError,
    requiredDeposit: requiredDeposit ? fromRawAmount(requiredDeposit) : null,
    // Actions
    openEscrow,
    closeModal,
    completePayment,
    cancelFlow,
    finish,
    // Streamflow write (for panel actions)
    escrowWrite,
  }
}
