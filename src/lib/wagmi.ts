import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'

const chain = Number(import.meta.env.VITE_CHAIN_ID) === 1 ? mainnet : sepolia
const rpcUrl = import.meta.env.VITE_ALCHEMY_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo'

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [
    metaMask(),
    injected(),
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [chain.id]: http(rpcUrl),
  },
})
