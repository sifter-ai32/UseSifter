import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ExternalLink, Wallet, AlertTriangle,
  CheckCircle2, Clock, FileText, Users, Link2,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { getDispute, resolveDispute as apiResolveDispute } from '../lib/api'
import type { DisputeRecord } from '../lib/api'
import { ESCROW_FACTORY_ADDRESS, ARBITRATOR_ADDRESS, fromRawAmount, tokenLabel } from '../lib/contracts'
import escrowAbi from '../abi/EscrowFactory.json'

const s = {
  card: { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20 } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 500, color: '#737373', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  input: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: '#fafafa', outline: 'none' } as React.CSSProperties,
  btnPrimary: { width: '100%', background: '#e5e5e5', color: '#0a0a0a', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'background 0.2s' } as React.CSSProperties,
  btnSec: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#a6a6a6', cursor: 'pointer' } as React.CSSProperties,
}

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [freelancerPct, setFreelancerPct] = useState(50)
  const [resolving, setResolving] = useState(false)
  const [resolveSuccess, setResolveSuccess] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const isArbitrator = isConnected && address?.toLowerCase() === ARBITRATOR_ADDRESS.toLowerCase()

  const { data: dispute = null, isLoading: loading, error: fetchError } = useQuery({
    queryKey: ['admin-dispute', id],
    queryFn: () => getDispute(id!),
    enabled: !!id,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  })
  const error = fetchError ? (fetchError as Error).message : ''

  const pendingBps = useRef<number | null>(null)
  const { writeContract, data: txHash, isPending: isSigning, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (!txConfirmed || pendingBps.current === null || !txHash || !id) return
    const bps = pendingBps.current
    pendingBps.current = null
    apiResolveDispute(id, bps, txHash)
      .then(() => {
        setResolveSuccess(true); setResolving(false)
        queryClient.invalidateQueries({ queryKey: ['admin-dispute', id] })
        queryClient.invalidateQueries({ queryKey: ['admin-disputes'] })
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      })
      .catch(err => { setResolveError(err.message); setResolving(false) })
      .finally(() => reset())
  }, [txConfirmed, txHash, id, reset, queryClient])

  useEffect(() => { if (writeError) { pendingBps.current = null; setResolving(false) } }, [writeError])

  const handleResolve = useCallback(() => {
    if (!dispute || !isArbitrator) return
    const bps = Math.round(freelancerPct * 100)
    pendingBps.current = bps
    setResolving(true); setResolveError(''); setResolveSuccess(false)
    writeContract({ address: ESCROW_FACTORY_ADDRESS, abi: escrowAbi, functionName: 'resolveDispute', args: [BigInt(dispute.escrow.chainEscrowId), bps] })
  }, [dispute, isArbitrator, freelancerPct, writeContract])

  const disputedPhase = dispute?.escrow.phases.find(p => p.phaseIndex === dispute.phaseIndex)
  const amount = disputedPhase ? fromRawAmount(disputedPhase.amount) : 0
  const token = dispute ? tokenLabel(dispute.escrow.tokenAddress) : ''
  const freelancerAmount = amount * (freelancerPct / 100)
  const clientAmount = amount - freelancerAmount
  const isOpen = dispute?.status === 'open'
  const txPending = isSigning || isConfirming
  const short = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  if (loading) return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 24, height: 24, border: '2px solid rgba(250,250,250,0.2)', borderTopColor: '#fafafa', borderRadius: '50%' }} className="animate-spin" />
    </div>
  )

  if (error || !dispute) return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fafafa' }}>
      <div className="text-center">
        <p style={{ fontSize: 14, fontWeight: 300, color: '#ef4444', marginBottom: 16 }}>{error || 'Dispute not found'}</p>
        <button onClick={() => navigate('/admin')} style={{ fontSize: 14, fontWeight: 500, color: '#a6a6a6', background: 'none', border: 'none', cursor: 'pointer' }}>Back to dashboard</button>
      </div>
    </div>
  )

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fafafa' }} className="antialiased">
      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 24px' }} className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: '#737373' }}>
            <ArrowLeft style={{ width: 16, height: 16 }} strokeWidth={1.5} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 200, color: '#fafafa' }}>{dispute.escrow.projectTitle}</h1>
            <p style={{ fontSize: 12, fontWeight: 300, color: '#525252' }}>Dispute — Phase {dispute.phaseIndex + 1}</p>
          </div>
          <span style={{ borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 500, border: '1px solid', ...(isOpen ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.2)' } : { background: 'rgba(16,185,129,0.1)', color: '#10b981', borderColor: 'rgba(16,185,129,0.2)' }) }}>
            {isOpen ? 'Open' : 'Resolved'}
          </span>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div style={{ ...s.card, padding: 20 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <Users style={{ width: 16, height: 16, color: '#737373' }} strokeWidth={1.5} />
                <span style={s.label}>Client</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#fafafa' }}>{dispute.escrow.client.name || dispute.escrow.client.email}</p>
              {dispute.escrow.client.walletAddress && <p style={{ fontSize: 12, fontWeight: 300, color: '#525252', fontFamily: 'monospace', marginTop: 4 }}>{short(dispute.escrow.client.walletAddress)}</p>}
            </div>
            <div style={{ ...s.card, padding: 20 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <Users style={{ width: 16, height: 16, color: '#737373' }} strokeWidth={1.5} />
                <span style={s.label}>Freelancer</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#fafafa' }}>{dispute.escrow.freelancer.name || dispute.escrow.freelancer.email}</p>
              {dispute.escrow.freelancer.walletAddress && <p style={{ fontSize: 12, fontWeight: 300, color: '#525252', fontFamily: 'monospace', marginTop: 4 }}>{short(dispute.escrow.freelancer.walletAddress)}</p>}
            </div>
          </div>

          {/* Disputed Phase */}
          <div style={{ ...s.card, padding: 24 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 20 }}>
              <FileText style={{ width: 16, height: 16, color: '#737373' }} strokeWidth={1.5} />
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#fafafa' }}>Disputed Phase</h2>
            </div>
            <div className="grid grid-cols-2" style={{ gap: '16px 32px', marginBottom: 20 }}>
              <Detail label="Phase" value={`#${dispute.phaseIndex + 1}${disputedPhase?.description ? ` — ${disputedPhase.description}` : ''}`} />
              <Detail label="Amount" value={`${amount.toFixed(2)} ${token}`} highlight />
              <Detail label="Revisions Used" value={String(disputedPhase?.revisionCount ?? 0)} />
              <Detail label="Date Disputed" value={new Date(dispute.createdAt).toLocaleString()} />
            </div>
            {disputedPhase?.workLink && (
              <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ ...s.label, marginBottom: 8 }}>Work Link</p>
                <a href={disputedPhase.workLink.startsWith('http') ? disputedPhase.workLink : `https://${disputedPhase.workLink}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 300, color: '#a6a6a6', textDecoration: 'none' }}>
                  <Link2 style={{ width: 14, height: 14 }} strokeWidth={1.5} />{disputedPhase.workLink}<ExternalLink style={{ width: 12, height: 12 }} strokeWidth={1.5} />
                </a>
              </div>
            )}
            {disputedPhase?.workLinks && disputedPhase.workLinks.length > 1 && (
              <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16 }}>
                <p style={{ ...s.label, marginBottom: 8 }}>Submission History</p>
                {disputedPhase.workLinks.map((link, i) => (
                  <a key={i} href={link.url.startsWith('http') ? link.url : `https://${link.url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 300, color: '#525252', textDecoration: 'none', marginBottom: 6 }}>
                    <span style={{ color: '#737373', fontWeight: 500 }}>v{i + 1}</span>{link.url}<ExternalLink style={{ width: 10, height: 10, flexShrink: 0 }} strokeWidth={1.5} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Dispute Reason */}
          <div style={{ ...s.card, padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: '#fafafa', marginBottom: 16 }}>Dispute Reason</h2>
            <p style={{ fontSize: 14, fontWeight: 200, color: '#a6a6a6', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{dispute.reason || 'No reason provided'}</p>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
            <p style={{ fontSize: 12, fontWeight: 300, color: '#525252' }}>Raised by <span style={{ color: '#737373' }}>{dispute.raisedBy.name || dispute.raisedBy.email}</span></p>
          </div>

          {/* All Phases */}
          <div style={{ ...s.card, padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: '#fafafa', marginBottom: 20 }}>All Phases</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dispute.escrow.phases.map(phase => {
                const active = phase.phaseIndex === dispute.phaseIndex
                return (
                  <div key={phase.id} className="flex items-center justify-between" style={{ padding: '14px 16px', borderRadius: 12, border: active ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.06)', background: active ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)' }}>
                    <div className="flex items-center gap-3">
                      <PhaseStatusIcon status={phase.status} />
                      <p style={{ fontSize: 14, fontWeight: 200, color: '#fafafa' }}>Phase {phase.phaseIndex + 1}{phase.description && <span style={{ color: '#525252' }}> — {phase.description}</span>}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#a6a6a6' }}>{fromRawAmount(phase.amount).toFixed(2)} {token}</span>
                      <span style={{ fontSize: 12, fontWeight: 300, borderRadius: 20, padding: '2px 10px', ...(phase.status === 'Approved' ? { color: '#10b981', background: 'rgba(16,185,129,0.1)' } : phase.status === 'Disputed' ? { color: '#f59e0b', background: 'rgba(245,158,11,0.1)' } : { color: '#525252', background: 'rgba(255,255,255,0.04)' }) }}>{phase.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Wallet */}
          <div style={{ ...s.card, padding: 24 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 20 }}>
              <Wallet style={{ width: 16, height: 16, color: '#737373' }} strokeWidth={1.5} />
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#fafafa' }}>Wallet Connection</h2>
            </div>
            {!isConnected ? (
              <button onClick={() => { const c = connectors.find(x => x.id === 'injected') ?? connectors[0]; if (c) connect({ connector: c }) }} style={{ background: '#e5e5e5', color: '#0a0a0a', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer' }}>Connect Wallet</button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#fafafa', fontFamily: 'monospace' }}>{short(address!)}</p>
                    <p style={{ fontSize: 12, fontWeight: 300, color: '#525252' }}>Connected</p>
                  </div>
                  <button onClick={() => disconnect()} style={s.btnSec}>Disconnect</button>
                </div>
                {!isArbitrator && (
                  <div className="flex items-center gap-2.5" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 16px' }}>
                    <AlertTriangle style={{ width: 16, height: 16, color: '#f59e0b', flexShrink: 0 }} strokeWidth={1.5} />
                    <p style={{ fontSize: 12, fontWeight: 300, color: '#f59e0b' }}>Not the arbitrator. Expected: {short(ARBITRATOR_ADDRESS)}</p>
                  </div>
                )}
                {isArbitrator && (
                  <div className="flex items-center gap-2.5" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '12px 16px' }}>
                    <CheckCircle2 style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} strokeWidth={1.5} />
                    <p style={{ fontSize: 12, fontWeight: 300, color: '#10b981' }}>Arbitrator wallet connected</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resolve */}
          {isOpen ? (
            <div style={{ ...s.card, padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#fafafa', marginBottom: 24 }}>Resolve Dispute</h2>

              <div style={{ marginBottom: 24 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <span style={s.label}>Freelancer Share</span>
                  <span style={{ fontSize: 20, fontWeight: 200, color: '#fafafa' }}>{freelancerPct}%</span>
                </div>
                <input type="range" min={0} max={100} value={freelancerPct} onChange={e => setFreelancerPct(Number(e.target.value))} style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, appearance: 'none', cursor: 'pointer' }} />
                <div className="flex justify-between" style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 300, color: '#525252' }}>0% (All to Client)</span>
                  <span style={{ fontSize: 11, fontWeight: 300, color: '#525252' }}>100% (All to Freelancer)</span>
                </div>
              </div>

              <div className="flex gap-2" style={{ marginBottom: 24 }}>
                {[{ l: '100% FL', v: 100 }, { l: '75/25', v: 75 }, { l: '50/50', v: 50 }, { l: '25/75', v: 25 }, { l: '100% CL', v: 0 }].map(({ l, v }) => (
                  <button key={v} onClick={() => setFreelancerPct(v)} style={{ flex: 1, fontSize: 12, fontWeight: 500, borderRadius: 12, padding: '10px 0', border: freelancerPct === v ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)', background: freelancerPct === v ? 'rgba(255,255,255,0.08)' : 'transparent', color: freelancerPct === v ? '#fafafa' : '#525252', cursor: 'pointer', transition: 'all 0.2s' }}>{l}</button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: 24 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                  <p style={{ ...s.label, marginBottom: 8 }}>Freelancer receives</p>
                  <p style={{ fontSize: 22, fontWeight: 200, color: '#fafafa' }}>{freelancerAmount.toFixed(2)} <span style={{ fontSize: 14, color: '#737373' }}>{token}</span></p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                  <p style={{ ...s.label, marginBottom: 8 }}>Client refunded</p>
                  <p style={{ fontSize: 22, fontWeight: 200, color: '#fafafa' }}>{clientAmount.toFixed(2)} <span style={{ fontSize: 14, color: '#737373' }}>{token}</span></p>
                </div>
              </div>

              {(writeError || resolveError) && (
                <div className="flex items-center gap-2.5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                  <AlertTriangle style={{ width: 16, height: 16, color: '#ef4444', flexShrink: 0 }} strokeWidth={1.5} />
                  <p style={{ fontSize: 12, fontWeight: 300, color: '#ef4444' }}>{(writeError as any)?.shortMessage || writeError?.message || resolveError}</p>
                </div>
              )}
              {resolveSuccess && (
                <div className="flex items-center gap-2.5" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                  <CheckCircle2 style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} strokeWidth={1.5} />
                  <p style={{ fontSize: 12, fontWeight: 300, color: '#10b981' }}>Dispute resolved successfully</p>
                </div>
              )}

              <button onClick={handleResolve} disabled={!isConnected || !isArbitrator || txPending || resolving || resolveSuccess} className="flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" style={s.btnPrimary}>
                {!isConnected ? 'Connect Wallet First' : !isArbitrator ? 'Wrong Wallet' : isSigning ? 'Confirm in Wallet...' : isConfirming ? 'Waiting for Confirmation...' : resolving ? 'Updating Database...' : `Resolve & Sign (${freelancerPct}% to freelancer)`}
              </button>
            </div>
          ) : (
            <div style={{ background: '#0a0a0a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: 24 }}>
              <div className="flex items-center gap-2.5" style={{ marginBottom: 20 }}>
                <CheckCircle2 style={{ width: 20, height: 20, color: '#10b981' }} strokeWidth={1.5} />
                <h2 style={{ fontSize: 16, fontWeight: 200, color: '#10b981' }}>Resolved</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Freelancer Share" value={dispute.freelancerShareBps !== null ? `${(dispute.freelancerShareBps / 100).toFixed(0)}%` : 'N/A'} />
                <Detail label="Resolved At" value={dispute.resolvedAt ? new Date(dispute.resolvedAt).toLocaleString() : 'N/A'} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 500, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: highlight ? 500 : 200, color: highlight ? '#fafafa' : '#a6a6a6' }}>{value}</p>
    </div>
  )
}

function PhaseStatusIcon({ status }: { status: string }) {
  const st = status.toLowerCase()
  if (st === 'approved' || st === 'autoreleased') return <CheckCircle2 style={{ width: 16, height: 16, color: '#10b981' }} strokeWidth={1.5} />
  if (st === 'disputed') return <AlertTriangle style={{ width: 16, height: 16, color: '#f59e0b' }} strokeWidth={1.5} />
  return <Clock style={{ width: 16, height: 16, color: '#525252' }} strokeWidth={1.5} />
}
