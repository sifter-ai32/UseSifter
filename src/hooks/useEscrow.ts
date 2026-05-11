import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DealRoomPhase } from '@/types/dealRoom'
import { useWallet, useEscrowWrite, useComputeRequiredDeposit } from '@/hooks/useEscrowContract'
import { useAuthStore } from '@/stores/authStore'
import {
  USDC_ADDRESS,
  USDT_ADDRESS,
  fromRawAmount,
} from '@/lib/contracts'
import * as api from '@/lib/api'

const freshPhase = (): DealRoomPhase => ({ id: Date.now(), name: '', pct: 0 })

type EscrowFlowStep = 'idle' | 'creating' | 'approving' | 'funding' | 'done'

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

export function useEscrow(workspaceId?: string | null, workspaceMemberIds?: string[], workspaceMembers?: WorkspaceMember[]) {
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

  // Blockchain flow state
  const [flowStep, setFlowStep] = useState<EscrowFlowStep>('idle')
  const [flowError, setFlowError] = useState<string | null>(null)
  const [pendingChainEscrowId, setPendingChainEscrowId] = useState<number | null>(null)
  const [, setPendingDbEscrowId] = useState<string | null>(null)
  // Refs mirror the state so the onConfirmed callback always has current values
  const pendingChainEscrowIdRef = useRef<number | null>(null)
  const pendingDbEscrowIdRef = useRef<string | null>(null)
  const [freelancerWallet, setFreelancerWallet] = useState<string | null>(draft?.freelancerWallet ?? null)
  const [freelancerId, setFreelancerId] = useState<string | null>(draft?.freelancerId ?? null)

  // No longer auto-set freelancer — user picks via step 0 in the modal

  // USDT requires reset-to-0 before new approval — track whether reset is done
  const usdtResetDoneRef = useRef(false)

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

  // Keep a ref to activeEscrow so the onConfirmed callback always has the latest value
  const activeEscrowRef = useRef(activeEscrow)
  activeEscrowRef.current = activeEscrow

  // Blockchain write hook
  const escrowWriteRef = useRef<any>(null)
  const escrowWrite = useEscrowWrite(
    useCallback(async (action: any, txHash: string, logs?: any[]) => {
      if (action.type === 'createEscrow' && logs && logs.length > 0) {
        // Extract chainEscrowId from EscrowCreated event
        const event = logs[0] as any
        const chainEscrowId = Number(event.args?.escrowId ?? event.args?.[0])
        pendingChainEscrowIdRef.current = chainEscrowId
        setPendingChainEscrowId(chainEscrowId)

        // Save to DB
        try {
          const record = await api.createEscrowRecord({
            chainEscrowId,
            clientId: user!.id,
            freelancerId: freelancerId!,
            projectTitle: 'Deal Room Escrow',
            tokenAddress: selectedToken,
            totalAmount: String(budgetNum),
            totalDeposit: requiredDeposit ? String(fromRawAmount(requiredDeposit)) : String(budgetNum * 1.025),
            autoReleaseTimeout: autoReleaseTimeout * 86400,
            txHashCreate: txHash,
            workspaceId: workspaceId || undefined,
            phases: phases.map((p, i) => ({
              phaseIndex: i,
              description: p.name,
              percentageBps: p.pct * 100,
              amount: String(budgetNum * (p.pct / 100)),
              deadline: phaseDeadlines[p.id] || new Date(Date.now() + (i + 1) * 30 * 86400000).toISOString(),
            })),
          })
          pendingDbEscrowIdRef.current = record.id
          setPendingDbEscrowId(record.id)
        } catch (e) {
          console.error('Failed to save escrow to DB:', e)
        }

        // Move to approve step — reset USDT flag
        usdtResetDoneRef.current = false
        setFlowStep('approving')
      }

      if (action.type === 'approve') {
        const isUSDT = selectedToken.toLowerCase() === USDT_ADDRESS.toLowerCase()

        if (isUSDT && !usdtResetDoneRef.current) {
          // This was the reset-to-0 tx — now do the real approval
          usdtResetDoneRef.current = true
          if (requiredDeposit) {
            escrowWriteRef.current?.approveToken(selectedToken, requiredDeposit)
          }
          return
        }

        // Real approval confirmed — now fund
        const chainId = pendingChainEscrowIdRef.current
        if (chainId !== null) {
          setFlowStep('funding')
          escrowWriteRef.current?.fundEscrow(chainId)
        }
      }

      if (action.type === 'fundEscrow') {
        // Escrow funded! Update DB
        const dbId = pendingDbEscrowIdRef.current
        if (dbId) {
          try {
            await api.updateEscrow(dbId, {
              status: 'Funded',
              txHashFund: txHash,
              fundedAt: new Date().toISOString(),
            })
          } catch (e) {
            console.error('Failed to update escrow status:', e)
          }
        }
        setFlowStep('done')
        setStep(5) // success step
        queryClient.invalidateQueries({ queryKey: ['workspace-escrows'] })
      }

      // ──── Phase actions: update DB + optimistic cache after on-chain confirmation ────
      const esc = activeEscrowRef.current

      // Helper: optimistically update a phase in the query cache
      const optimisticPhaseUpdate = (phaseIndex: number, updates: Record<string, unknown>) => {
        queryClient.setQueryData<api.EscrowInfo[]>(
          ['workspace-escrows', workspaceId, user?.id],
          (old) => old?.map(e => e.id === esc?.id ? {
            ...e,
            phases: e.phases.map(p => p.phaseIndex === phaseIndex ? { ...p, ...updates } : p),
          } : e)
        )
      }

      if (action.type === 'submitPhase' && esc) {
        const currentPhase = esc.phases.find(p => p.status === 'Pending')
        if (currentPhase) {
          const now = new Date().toISOString()
          // Append to workLinks history for optimistic UI
          const existingLinks = Array.isArray(currentPhase.workLinks) ? currentPhase.workLinks : []
          const newWorkLinks = currentPhase.workLink
            ? [...existingLinks, { url: currentPhase.workLink, submittedAt: now }]
            : existingLinks
          optimisticPhaseUpdate(currentPhase.phaseIndex, { status: 'Submitted', submittedAt: now, workLinks: newWorkLinks })
          api.updateEscrowPhase(esc.id, currentPhase.phaseIndex, {
            status: 'Submitted', submittedAt: now,
          }).catch(e => console.error('Failed to update phase status:', e))
        }
      }

      if (action.type === 'approvePhase' && esc) {
        const currentPhase = esc.phases.find(p => p.status === 'Submitted')
        if (currentPhase) {
          optimisticPhaseUpdate(currentPhase.phaseIndex, { status: 'Approved', txHash })
          api.updateEscrowPhase(esc.id, currentPhase.phaseIndex, {
            status: 'Approved', txHash,
          }).catch(e => console.error('Failed to update phase status:', e))
        }
      }

      if (action.type === 'requestRevision' && esc) {
        const currentPhase = esc.phases.find(p => p.status === 'Submitted')
        if (currentPhase) {
          optimisticPhaseUpdate(currentPhase.phaseIndex, { status: 'Pending', revisionCount: currentPhase.revisionCount + 1 })
          api.updateEscrowPhase(esc.id, currentPhase.phaseIndex, {
            status: 'Pending', revisionCount: currentPhase.revisionCount + 1,
          }).catch(e => console.error('Failed to update phase status:', e))
        }
      }

      if (action.type === 'raiseDispute' && esc) {
        const currentPhase = esc.phases.find(p => p.status === 'Pending' || p.status === 'Submitted')
        if (currentPhase) {
          optimisticPhaseUpdate(currentPhase.phaseIndex, { status: 'Disputed' })
          api.updateEscrowPhase(esc.id, currentPhase.phaseIndex, {
            status: 'Disputed',
          }).catch(e => console.error('Failed to update phase status:', e))
        }
      }
    }, [phases, user, freelancerId, selectedToken, budgetNum, requiredDeposit, autoReleaseTimeout, phaseDeadlines, queryClient, workspaceId])
  )
  escrowWriteRef.current = escrowWrite

  // Reset flow when user rejects transaction or MetaMask errors
  useEffect(() => {
    if (escrowWrite.writeError) {
      const msg = (escrowWrite.writeError as any)?.shortMessage || escrowWrite.writeError.message || 'Transaction rejected'
      setFlowError(msg)
      setFlowStep('idle')
    }
  }, [escrowWrite.writeError])

  // Detect when signing ends without a txHash (user rejected / MetaMask crashed)
  const wasSigningRef = useRef(false)
  useEffect(() => {
    if (escrowWrite.isSigning) {
      wasSigningRef.current = true
    } else if (wasSigningRef.current && !escrowWrite.txHash && !escrowWrite.writeError) {
      // Signing ended but no tx hash and no error — MetaMask was closed/crashed
      setFlowError('Transaction was cancelled or MetaMask encountered an error.')
      setFlowStep('idle')
      wasSigningRef.current = false
    } else {
      wasSigningRef.current = false
    }
  }, [escrowWrite.isSigning, escrowWrite.txHash, escrowWrite.writeError])

  const isProcessing = escrowWrite.isLoading || (flowStep !== 'idle' && flowStep !== 'done')

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
      // If no freelancer selected yet, start at step 0 (select participant)
      // Otherwise resume where user left off (between 1-4)
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
    // Don't reset step — preserve it so user resumes where they left off
  }, [])

  // Start blockchain escrow creation flow
  const completePayment = useCallback(() => {
    if (!wallet.isConnected || !freelancerWallet || !user) {
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

    escrowWrite.createEscrow({
      freelancerWallet,
      tokenAddress: selectedToken,
      totalAmount: budgetNum,
      percentagesBps,
      deadlines,
      autoReleaseTimeout: autoReleaseTimeout * 86400,
    })
  }, [wallet.isConnected, freelancerWallet, user, phases, phaseDeadlines, selectedToken, budgetNum, autoReleaseTimeout, escrowWrite])

  // After escrow created on chain, approve token then fund
  // Use a ref guard to ensure we only initiate the approve ONCE
  const approveInitiatedRef = useRef(false)
  useEffect(() => {
    if (flowStep === 'approving' && pendingChainEscrowId !== null && requiredDeposit && !approveInitiatedRef.current) {
      approveInitiatedRef.current = true
      const isUSDT = selectedToken.toLowerCase() === USDT_ADDRESS.toLowerCase()
      if (isUSDT) {
        // USDT quirk: must reset allowance to 0 before setting new value
        escrowWriteRef.current?.resetTokenApproval(selectedToken)
      } else {
        escrowWriteRef.current?.approveToken(selectedToken, requiredDeposit)
      }
    }
    // Reset guard when we leave the approving step
    if (flowStep !== 'approving') {
      approveInitiatedRef.current = false
    }
  }, [flowStep, pendingChainEscrowId, requiredDeposit, selectedToken])

  const finish = useCallback(() => {
    setModalOpen(false)
    setFlowStep('idle')
    setFlowError(null)
    setPendingChainEscrowId(null)
    setPendingDbEscrowId(null)
    pendingChainEscrowIdRef.current = null
    pendingDbEscrowIdRef.current = null
    approveInitiatedRef.current = false
    setTc1(false)
    setTc2(false)
    // Full reset after successful creation
    setPhases([freshPhase()])
    setBudget('')
    setPhaseDeadlines({})
    setFreelancerWallet(null)
    setFreelancerId(null)
    usdtResetDoneRef.current = false
    clearDraft(workspaceId)
    setTimeout(() => setStep(1), 300)
  }, [workspaceId])

  // Connect wallet action
  const connectWallet = useCallback(() => {
    wallet.connectWallet()
  }, [wallet])

  const disconnectWallet = useCallback(() => {
    // wagmi doesn't have a simple disconnect in injected — this is a no-op placeholder
  }, [])

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
    isCorrectChain: wallet.isCorrectChain,
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
    // Escrow write (for panel actions)
    escrowWrite,
  }
}
