/**
 * Register the Wayan agent in the ERC-8004 Identity Registry on Celo, with the builder attribution suffix.
 *
 *   AGENT_PRIVATE_KEY=0x... ATTRIBUTION_TAG=... PUBLIC_URL=https://agents.wayanwarrior.pro npm run register
 *
 * The agent wallet needs a little CELO for gas. Prints the agentId; put it in AGENT_ID so the agent card lists it.
 */
import { createPublicClient, createWalletClient, http, parseAbi, parseEventLogs } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { defineChain } from 'viem'
import { CFG, IDENTITY_REGISTRY, PUBLIC_URL } from '../src/config.js'
import { builderCodes, dataSuffix } from '../src/attribution.js'

const abi = parseAbi([
  'function register(string agentURI) returns (uint256 agentId)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
])

const key = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined
if (!key) throw new Error('Set AGENT_PRIVATE_KEY (the agent wallet, never commit it)')
const account = privateKeyToAccount(key)
const chain = defineChain({
  id: CFG.chainId,
  name: CFG.label,
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: [CFG.rpc] } },
})
const pub = createPublicClient({ chain, transport: http(CFG.rpc) })
const wallet = createWalletClient({ account, chain, transport: http(CFG.rpc) })

const agentURI = `${PUBLIC_URL}/.well-known/agent-card.json`
const suffix = dataSuffix(builderCodes())
console.log(`Registering ${account.address} on ${CFG.label} with agentURI ${agentURI}`)
const hash = await wallet.writeContract({ address: IDENTITY_REGISTRY, abi, functionName: 'register', args: [agentURI], dataSuffix: suffix })
const receipt = await pub.waitForTransactionReceipt({ hash })
const logs = parseEventLogs({ abi, logs: receipt.logs })
const reg = logs.find((l) => l.eventName === 'Registered') ?? logs.find((l) => l.eventName === 'Transfer')
const agentId = reg ? ((reg.args as any).agentId ?? (reg.args as any).tokenId) : undefined
console.log(`status=${receipt.status} tx=${CFG.explorerTx}${hash} agentId=${agentId}`)
