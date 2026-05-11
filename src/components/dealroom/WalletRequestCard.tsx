import { useState } from 'react'
import { Wallet, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import type { WorkspaceMessageInfo } from '@/lib/api'

interface WalletRequestCardProps {
  message: WorkspaceMessageInfo
  isFreelancer: boolean
  onConnect: (messageId: string, walletAddress: string) => void
}

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)
}

export default function WalletRequestCard({ message, isFreelancer, onConnect }: WalletRequestCardProps) {
  const meta = message.metadata as { requestedByName?: string; freelancerName?: string; status?: string; walletAddress?: string } | null
  const isConnected = meta?.status === 'connected'
  const { publicKey, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const [loading, setLoading] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const [error, setError] = useState('')

  const handlePhantomConnect = async () => {
    setError('')
    setLoading(true)
    try {
      if (connected && publicKey) {
        onConnect(message.id, publicKey.toBase58())
      } else {
        setVisible(true)
        // After modal closes, user will be connected — they can click again
      }
    } catch {
      setError('Failed to connect wallet. Try pasting your address manually.')
      setManualMode(true)
    } finally {
      setLoading(false)
    }
  }

  const handleManualSubmit = () => {
    setError('')
    const trimmed = manualAddress.trim()
    if (!isValidSolanaAddress(trimmed)) {
      setError('Invalid Solana wallet address.')
      return
    }
    onConnect(message.id, trimmed)
  }

  // Already connected state
  if (isConnected) {
    const shortAddr = meta?.walletAddress
      ? `${meta.walletAddress.slice(0, 4)}...${meta.walletAddress.slice(-4)}`
      : ''
    return (
      <div className="flex justify-center my-2">
        <div className="bg-[#ffffff]/[0.04] border border-[#ffffff]/10 rounded-2xl px-5 py-4 max-w-[400px] w-full">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-emerald-400/10 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#fafafa]">Wallet Connected</p>
              <p className="text-xs text-[#737373]">{meta?.freelancerName} connected their wallet</p>
            </div>
          </div>
          {shortAddr && (
            <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-3 py-2 mt-2">
              <span className="text-xs text-emerald-400 font-mono">{shortAddr}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Pending state — for the freelancer (action required)
  if (isFreelancer) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-2xl px-5 py-4 max-w-[400px] w-full">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#f59e0b]/10 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-[#f59e0b]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#fafafa]">Wallet Connection Required</p>
              <p className="text-xs text-[#a6a6a6] mt-0.5">
                {meta?.requestedByName} wants to create an escrow with you. Connect your Solana wallet to proceed.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 mb-3 px-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              {error}
            </div>
          )}

          {!manualMode ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={handlePhantomConnect}
                disabled={loading}
                className="w-full bg-[#f59e0b] text-[#000000] hover:bg-[#d97706] transition-colors py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> Connecting...</>
                ) : connected && publicKey ? (
                  <><Wallet className="w-4 h-4" strokeWidth={1.5} /> Use Connected Wallet</>
                ) : (
                  <><Wallet className="w-4 h-4" strokeWidth={1.5} /> Connect Phantom / Solflare</>
                )}
              </button>
              <button
                onClick={() => setManualMode(true)}
                className="w-full text-xs text-[#737373] hover:text-[#a6a6a6] transition-colors py-1.5 cursor-pointer"
              >
                Or paste wallet address manually
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Solana address (e.g. 7xKqR...)"
                className="w-full bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-xl px-4 py-2.5 text-sm text-[#fafafa] placeholder:text-[#525252] focus:outline-none focus:border-[#ffffff]/30 font-mono"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setManualMode(false); setError('') }}
                  className="flex-1 border border-[#ffffff]/20 text-[#a6a6a6] hover:text-[#fafafa] hover:bg-[#ffffff]/5 transition-colors py-2 rounded-xl text-sm cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualAddress.trim()}
                  className="flex-1 bg-[#f59e0b] text-[#000000] hover:bg-[#d97706] transition-colors py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Wallet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Pending state — for the client (waiting)
  return (
    <div className="flex justify-center my-2">
      <div className="bg-[#ffffff]/[0.04] border border-[#ffffff]/10 rounded-2xl px-5 py-4 max-w-[400px] w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f59e0b]/10 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-[#f59e0b]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-[#fafafa]">Wallet Request Sent</p>
            <p className="text-xs text-[#737373] mt-0.5">Waiting for {meta?.freelancerName} to connect their wallet...</p>
          </div>
        </div>
      </div>
    </div>
  )
}
