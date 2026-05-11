// src/hooks/useEscrowContract.ts
// Solana / Streamflow hooks for escrow interactions.
// Replaces the former wagmi/EVM implementation.

import { useCallback, useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token'
import { SolanaStreamClient, getBN, ICluster } from '@streamflow/stream'
import { USDC_MINT, SOLANA_RPC_URL, SOLANA_NETWORK } from '@/lib/solana'
import { toRawAmount, fromRawAmount } from '@/lib/contracts'

// ── Streamflow client (singleton, no wallet needed for reads) ──
const streamflowCluster: ICluster =
  SOLANA_NETWORK === 'mainnet-beta' ? ICluster.Mainnet : ICluster.Devnet

const sfClient = new SolanaStreamClient({
  clusterUrl: SOLANA_RPC_URL,
  cluster: streamflowCluster,
})

// ── Wallet Connection ──

export function useWallet_() {
  const { publicKey, connected, connect, disconnect, wallet, wallets } = useWallet()

  const connectWallet = useCallback(async () => {
    if (!connected) {
      await connect()
    }
  }, [connected, connect])

  return {
    address: publicKey?.toBase58() ?? null,
    isConnected: connected,
    wallet,
    wallets,
    connectWallet,
    disconnect,
  }
}

// Re-export under the original name so existing callers don't break
export { useWallet_ as useWallet }

export function useWalletVerification(registeredWallet: string | null | undefined) {
  const { publicKey, connected } = useWallet()

  const isWalletMatch =
    connected && !!registeredWallet && publicKey?.toBase58() === registeredWallet

  const walletError =
    connected && registeredWallet && !isWalletMatch
      ? 'Connected wallet does not match your registered wallet'
      : null

  return { isWalletMatch, walletError }
}

// ── Token Balance ──

export function useTokenBalance(
  _tokenAddress: string | undefined,
  walletAddress: string | undefined,
) {
  const { connection } = useConnection()
  const [balance, setBalance] = useState<bigint | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!walletAddress) return
    setIsLoading(true)
    try {
      const owner = new PublicKey(walletAddress)
      const mint = new PublicKey(USDC_MINT)
      const ata = await getAssociatedTokenAddress(mint, owner)
      const info = await getAccount(connection, ata)
      setBalance(info.amount)
    } catch {
      setBalance(0n)
    } finally {
      setIsLoading(false)
    }
  }, [connection, walletAddress])

  return { balance, isLoading, refetch }
}

// ── Deposit required (no platform fee on Streamflow path) ──

export function useComputeRequiredDeposit(totalAmount: number) {
  // Streamflow takes exactly the deposited amount — no extra fee computation needed
  const raw = totalAmount > 0 ? toRawAmount(totalAmount) : undefined
  return { requiredDeposit: raw, isLoading: false }
}

// ── On-chain stream reads ──

export function useOnChainEscrow(streamId: string | null) {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!streamId) return
    setIsLoading(true)
    try {
      const stream = await sfClient.getOne({ id: streamId })
      setData(stream)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [streamId])

  return { escrow: data, isLoading, refetch }
}

// ── Write actions ──

type ActionState = 'idle' | 'signing' | 'confirming' | 'done' | 'error'

export interface EscrowWriteResult {
  isSigning: boolean
  isConfirming: boolean
  txConfirmed: boolean
  txHash: string | null
  writeError: Error | null
  isLoading: boolean
  // Actions
  createEscrowPhases: (args: {
    freelancerWallet: string
    tokenAddress: string
    totalAmount: number
    percentagesBps: number[]
    deadlines: number[]   // unix timestamps (auto-release cliff dates)
    descriptions: string[]
  }) => Promise<string[]> // returns array of streamflow metadataIds (one per phase)
  approvePhase: (args: {
    streamId: string
    phaseAmount: number
    freelancerWallet: string
  }) => Promise<string>   // returns tx signature
  withdrawPhase: (args: { streamId: string; phaseAmount: number }) => Promise<string>
  cancelStream: (streamId: string) => Promise<string>
  submitPhaseCompletion: (escrowDbId: string, phaseIndex: number, workLink: string) => Promise<void>
  requestRevision: (escrowDbId: string, phaseIndex: number, notes: string) => Promise<void>
}

export function useEscrowWrite(
  onConfirmed?: (action: string, txHash: string, data?: any) => void,
): EscrowWriteResult {
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet()
  const { connection } = useConnection()

  const [actionState, setActionState] = useState<ActionState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<Error | null>(null)

  const anchorWallet = connected && publicKey && signTransaction && signAllTransactions
    ? { publicKey, signTransaction, signAllTransactions }
    : null

  // Create one Streamflow stream per phase
  const createEscrowPhases = useCallback(async (args: {
    freelancerWallet: string
    tokenAddress: string
    totalAmount: number
    percentagesBps: number[]
    deadlines: number[]
    descriptions: string[]
  }): Promise<string[]> => {
    if (!anchorWallet) throw new Error('Wallet not connected')

    setActionState('signing')
    setWriteError(null)

    const streamIds: string[] = []

    try {
      for (let i = 0; i < args.percentagesBps.length; i++) {
        const phaseAmount = Math.round(args.totalAmount * args.percentagesBps[i] / 10000)
        const cliffTimestamp = args.deadlines[i]
        const nowSec = Math.floor(Date.now() / 1000)

        setActionState('confirming')

        const response = await sfClient.create(
          {
            recipient: args.freelancerWallet,
            tokenId: USDC_MINT,
            start: nowSec,
            amount: getBN(phaseAmount, 6),
            period: 1,
            cliff: cliffTimestamp,
            cliffAmount: getBN(phaseAmount, 6),
            amountPerPeriod: getBN(0, 6),
            name: `UseSifter Phase ${i + 1}${args.descriptions[i] ? ` — ${args.descriptions[i].slice(0, 30)}` : ''}`,
            canTopup: false,
            cancelableBySender: true,
            cancelableByRecipient: false,
            transferableBySender: false,
            transferableByRecipient: false,
            automaticWithdrawal: false,
            withdrawalFrequency: 0,
          },
          { sender: anchorWallet },
        )

        streamIds.push(response.metadataId)
        setTxHash(response.txId)
      }

      setActionState('done')
      onConfirmed?.('createEscrowPhases', txHash ?? '', { streamIds })
      return streamIds
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      setWriteError(err)
      setActionState('error')
      throw err
    }
  }, [anchorWallet, onConfirmed, txHash])

  // Approve phase early: cancel stream → direct SPL transfer to freelancer
  const approvePhase = useCallback(async (args: {
    streamId: string
    phaseAmount: number
    freelancerWallet: string
  }): Promise<string> => {
    if (!anchorWallet || !publicKey) throw new Error('Wallet not connected')

    setActionState('signing')
    setWriteError(null)

    try {
      // Step 1: Cancel the Streamflow stream (returns USDC to client)
      await sfClient.cancel({ id: args.streamId }, { invoker: anchorWallet })

      // Step 2: Send USDC directly to freelancer
      const mint = new PublicKey(USDC_MINT)
      const fromAta = await getAssociatedTokenAddress(mint, publicKey)
      const toAta = await getAssociatedTokenAddress(mint, new PublicKey(args.freelancerWallet))
      const rawAmount = toRawAmount(args.phaseAmount)

      setActionState('confirming')

      const tx = new Transaction().add(
        createTransferInstruction(fromAta, toAta, publicKey, rawAmount),
      )
      tx.feePayer = publicKey
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash

      const signed = await signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')

      setTxHash(sig)
      setActionState('done')
      onConfirmed?.('approvePhase', sig, { streamId: args.streamId })
      return sig
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      setWriteError(err)
      setActionState('error')
      throw err
    }
  }, [anchorWallet, publicKey, signTransaction, connection, onConfirmed])

  // Cancel a stream — returns remaining USDC to client
  const cancelStream = useCallback(async (streamId: string): Promise<string> => {
    if (!anchorWallet) throw new Error('Wallet not connected')

    setActionState('signing')
    setWriteError(null)

    try {
      setActionState('confirming')
      const { txId } = await sfClient.cancel({ id: streamId }, { invoker: anchorWallet })
      setTxHash(txId)
      setActionState('done')
      onConfirmed?.('cancelStream', txId, { streamId })
      return txId
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      setWriteError(err)
      setActionState('error')
      throw err
    }
  }, [anchorWallet, onConfirmed])

  // Freelancer withdraws their own funds after cliff date passes
  const withdrawPhase = useCallback(async (args: {
    streamId: string
    phaseAmount: number
  }): Promise<string> => {
    if (!anchorWallet) throw new Error('Wallet not connected')

    setActionState('signing')
    setWriteError(null)

    try {
      setActionState('confirming')
      const { txId } = await sfClient.withdraw(
        { id: args.streamId, amount: getBN(args.phaseAmount, 6) },
        { invoker: anchorWallet },
      )
      setTxHash(txId)
      setActionState('done')
      onConfirmed?.('withdrawPhase', txId, { streamId: args.streamId })
      return txId
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      setWriteError(err)
      setActionState('error')
      throw err
    }
  }, [anchorWallet, onConfirmed])

  // Submit phase completion — off-chain DB update only (no on-chain action)
  const submitPhaseCompletion = useCallback(async (
    _escrowDbId: string,
    _phaseIndex: number,
    _workLink: string,
  ) => {
    // Handled entirely via API call from the component; no wallet interaction needed
  }, [])

  // Request revision — off-chain DB update only
  const requestRevision = useCallback(async (
    _escrowDbId: string,
    _phaseIndex: number,
    _notes: string,
  ) => {
    // Handled entirely via API call from the component; no wallet interaction needed
  }, [])

  return {
    isSigning: actionState === 'signing',
    isConfirming: actionState === 'confirming',
    txConfirmed: actionState === 'done',
    txHash,
    writeError,
    isLoading: actionState === 'signing' || actionState === 'confirming',
    createEscrowPhases,
    approvePhase,
    withdrawPhase,
    cancelStream,
    submitPhaseCompletion,
    requestRevision,
  }
}