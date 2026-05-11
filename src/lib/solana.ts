import { Connection, clusterApiUrl } from '@solana/web3.js'

export type SolanaNetwork = 'mainnet-beta' | 'devnet'

export const SOLANA_NETWORK = (
  import.meta.env.VITE_SOLANA_NETWORK || 'devnet'
) as SolanaNetwork

export const SOLANA_RPC_URL: string =
  import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(SOLANA_NETWORK)

export const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

// USDC mint addresses
const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDC_DEVNET  = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

export const USDC_MINT =
  import.meta.env.VITE_USDC_MINT ||
  (SOLANA_NETWORK === 'mainnet-beta' ? USDC_MAINNET : USDC_DEVNET)

export const EXPLORER_BASE =
  SOLANA_NETWORK === 'mainnet-beta'
    ? 'https://solscan.io'
    : 'https://solscan.io/?cluster=devnet'

export function explorerTxUrl(signature: string): string {
  return SOLANA_NETWORK === 'mainnet-beta'
    ? `https://solscan.io/tx/${signature}`
    : `https://solscan.io/tx/${signature}?cluster=devnet`
}