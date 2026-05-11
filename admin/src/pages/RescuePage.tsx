import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, AlertTriangle, Wallet, CheckCircle2, Shield,
} from 'lucide-react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { ESCROW_FACTORY_ADDRESS, ARBITRATOR_ADDRESS } from '../lib/contracts'
import escrowAbi from '../abi/EscrowFactory.json'

const st = {
  card: { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20 } as React.CSSProperties,
  label: { display: 'block', fontSize: 11, fontWeight: 500, color: '#737373', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 8 } as React.CSSProperties,
  input: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: '#fafafa', outline: 'none' } as React.CSSProperties,
  btnPrimary: { width: '100%', background: '#e5e5e5', color: '#0a0a0a', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer' } as React.CSSProperties,
  btnSec: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#a6a6a6', cursor: 'pointer' } as React.CSSProperties,
}

export default function RescuePage() {
  const navigate = useNavigate()
  const [escrowId, setEscrowId] = useState('')
  const [altFreelancer, setAltFreelancer] = useState('')
  const [altClient, setAltClient] = useState('')
  const [success, setSuccess] = useState(false)

  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const isArbitrator = isConnected && address?.toLowerCase() === ARBITRATOR_ADDRESS.toLowerCase()

  const pendingRef = useRef(false)
  const { writeContract, data: txHash, isPending: isSigning, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (!txConfirmed || !pendingRef.current) return
    pendingRef.current = false; setSuccess(true); reset()
  }, [txConfirmed, reset])

  const handleRescue = () => {
    if (!escrowId || !altFreelancer || !altClient) return
    pendingRef.current = true; setSuccess(false)
    writeContract({ address: ESCROW_FACTORY_ADDRESS, abi: escrowAbi, functionName: 'rescueStuckFunds', args: [BigInt(escrowId), altFreelancer as `0x${string}`, altClient as `0x${string}`] })
  }

  const txPending = isSigning || isConfirming
  const short = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#fafafa' }} className="antialiased">
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 24px' }} className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: '#737373' }}>
            <ArrowLeft style={{ width: 16, height: 16 }} strokeWidth={1.5} />
          </button>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 200, color: '#fafafa' }}>Rescue Stuck Funds</h1>
            <p style={{ fontSize: 12, fontWeight: 300, color: '#525252' }}>Emergency recovery</p>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Warning */}
          <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, padding: 20 }}>
            <div className="flex items-start gap-3">
              <AlertTriangle style={{ width: 20, height: 20, color: '#ef4444', flexShrink: 0, marginTop: 2 }} strokeWidth={1.5} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#ef4444', marginBottom: 4 }}>Emergency Use Only</p>
                <p style={{ fontSize: 12, fontWeight: 200, color: 'rgba(239,68,68,0.7)', lineHeight: 1.6 }}>
                  This function rescues funds from a stuck escrow by sending them to alternate wallets. Only use when normal flows are not possible. Irreversible.
                </p>
              </div>
            </div>
          </div>

          {/* Wallet */}
          <div style={{ ...st.card, padding: 24 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 20 }}>
              <Wallet style={{ width: 16, height: 16, color: '#737373' }} strokeWidth={1.5} />
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#fafafa' }}>Wallet</h2>
            </div>
            {!isConnected ? (
              <button onClick={() => { const c = connectors.find(x => x.id === 'injected') ?? connectors[0]; if (c) connect({ connector: c }) }} style={{ background: '#e5e5e5', color: '#0a0a0a', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer' }}>Connect Wallet</button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="flex items-center justify-between">
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#fafafa', fontFamily: 'monospace' }}>{short(address!)}</p>
                  <button onClick={() => disconnect()} style={st.btnSec}>Disconnect</button>
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

          {/* Form */}
          <div style={{ ...st.card, padding: 24 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 24 }}>
              <Shield style={{ width: 16, height: 16, color: '#737373' }} strokeWidth={1.5} />
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#fafafa' }}>Rescue Parameters</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={st.label}>Chain Escrow ID</label>
                <input type="number" value={escrowId} onChange={e => setEscrowId(e.target.value)} placeholder="0" style={st.input} onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
              </div>
              <div>
                <label style={st.label}>Alternate Freelancer Wallet</label>
                <input type="text" value={altFreelancer} onChange={e => setAltFreelancer(e.target.value)} placeholder="0x..." style={{ ...st.input, fontFamily: 'monospace' }} onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
              </div>
              <div>
                <label style={st.label}>Alternate Client Wallet</label>
                <input type="text" value={altClient} onChange={e => setAltClient(e.target.value)} placeholder="0x..." style={{ ...st.input, fontFamily: 'monospace' }} onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
              </div>
            </div>

            {writeError && (
              <div className="flex items-center gap-2.5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginTop: 20 }}>
                <AlertTriangle style={{ width: 16, height: 16, color: '#ef4444', flexShrink: 0 }} strokeWidth={1.5} />
                <p style={{ fontSize: 12, fontWeight: 300, color: '#ef4444' }}>{writeError.message}</p>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2.5" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '12px 16px', marginTop: 20 }}>
                <CheckCircle2 style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} strokeWidth={1.5} />
                <p style={{ fontSize: 12, fontWeight: 300, color: '#10b981' }}>Funds rescued successfully</p>
              </div>
            )}

            <button onClick={handleRescue} disabled={!isConnected || !isArbitrator || !escrowId || !altFreelancer || !altClient || txPending || success} className="flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" style={{ ...st.btnPrimary, marginTop: 24 }}>
              {!isConnected ? 'Connect Wallet First' : !isArbitrator ? 'Wrong Wallet' : isSigning ? 'Confirm in Wallet...' : isConfirming ? 'Waiting for Confirmation...' : 'Rescue Stuck Funds'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
