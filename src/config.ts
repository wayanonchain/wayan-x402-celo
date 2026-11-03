/**
 * Network, tokens and catalog. Celo Sepolia by default; X402_NETWORK=mainnet for Celo mainnet.
 * Token addresses and EIP-712 domains are copied from the Celo facilitator's /api/config.
 */
import { getAddress, type Address } from 'viem'

try {
  process.loadEnvFile()
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

type Token = { symbol: string; address: Address; name: string; version: string; decimals: 6 }

export const NETWORKS = {
  testnet: {
    caip2: 'eip155:11142220',
    chainId: 11142220,
    label: 'Celo Sepolia',
    rpc: 'https://forno.celo-sepolia.celo-testnet.org',
    facilitator: 'https://api.x402.sepolia.celo.org',
    explorerTx: 'https://celo-sepolia.blockscout.com/tx/',
    tokens: [
      { symbol: 'USDC', address: getAddress('0x01C5C0122039549AD1493B8220cABEdD739BC44E'), name: 'USDC', version: '2', decimals: 6 },
    ] as Token[],
  },
  mainnet: {
    caip2: 'eip155:42220',
    chainId: 42220,
    label: 'Celo mainnet',
    rpc: 'https://forno.celo.org',
    facilitator: 'https://api.x402.celo.org',
    explorerTx: 'https://celoscan.io/tx/',
    // USA₮ first: the hackathon track settles USA₮; USDT and Circle's USDC are accepted too.
    tokens: [
      { symbol: 'USAT', address: getAddress('0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771'), name: 'Tether America USD', version: '1', decimals: 6 },
      { symbol: 'USDT', address: getAddress('0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'), name: 'Tether USD', version: '1', decimals: 6 },
      { symbol: 'USDC', address: getAddress('0xcebA9300f2b948710d2653dD7B07f33A8B32118C'), name: 'USDC', version: '2', decimals: 6 },
    ] as Token[],
  },
} as const

export const NET = (process.env.X402_NETWORK === 'mainnet' ? 'mainnet' : 'testnet') as keyof typeof NETWORKS
export const CFG = NETWORKS[NET]
export const PORT = Number(process.env.PORT ?? 8402)
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '')

/** Wayan packages sold here. Prices mirror https://wayanwarrior.pro/agent; the server re-checks them. */
export const PACKAGES = {
  pilot: { usd: 39, title: 'Pilot: niche research, 3 scripts, 3 videos and a photo avatar' },
  topup_200: { usd: 15, title: 'Top-up: +1 video (200 credits)' },
} as const
export type PackageId = keyof typeof PACKAGES

/** ERC-8004 Identity Registry on Celo (same address on mainnet and Sepolia per the 8004 deployments). */
export const IDENTITY_REGISTRY = getAddress('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432')
