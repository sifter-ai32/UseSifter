export const ESCROW_FACTORY_ADDRESS = (import.meta.env.VITE_ESCROW_FACTORY || '0x8093Fae41c37E532d9A5448d171f074DDC9e8b2f') as `0x${string}`
export const ARBITRATOR_ADDRESS = (import.meta.env.VITE_ARBITRATOR || '0x2F42815F62dDec06CE5Ed5C275352d69cd716814') as `0x${string}`
export const USDC_ADDRESS = (import.meta.env.VITE_USDC || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48') as `0x${string}`
export const USDT_ADDRESS = (import.meta.env.VITE_USDT || '0xdAC17F958D2ee523a2206206994597C13D831ec7') as `0x${string}`

export function fromRawAmount(raw: string | bigint): number {
  return Number(BigInt(raw)) / 1e6
}

export function tokenLabel(address: string): string {
  const lower = address.toLowerCase()
  if (lower === USDC_ADDRESS.toLowerCase()) return 'USDC'
  if (lower === USDT_ADDRESS.toLowerCase()) return 'USDT'
  return 'Unknown'
}
