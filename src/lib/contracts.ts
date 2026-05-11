import { USDC_MINT } from '@/lib/solana'

export { USDC_MINT }

export const TOKEN_OPTIONS = [
  { label: 'USDC', address: USDC_MINT, decimals: 6 },
] as const

export function tokenLabel(address: string): string {
  if (address === USDC_MINT) return 'USDC'
  return 'Unknown'
}

// USDC uses 6 decimals on Solana — same as EVM, no change needed
export function toRawAmount(amount: number): bigint {
  return BigInt(Math.round(amount * 1e6))
}

export function fromRawAmount(raw: bigint | string): number {
  return Number(BigInt(raw)) / 1e6
}

export const EscrowStatusLabel: Record<string, string> = {
  Created: 'Created',
  Funded: 'Funded',
  Active: 'Active',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Disputed: 'Disputed',
}

export const PhaseStatusLabel: Record<string, string> = {
  Pending: 'Pending',
  Submitted: 'Submitted',
  Approved: 'Approved',
  Disputed: 'Disputed',
  AutoReleased: 'Auto-Released',
  Cancelled: 'Cancelled',
}