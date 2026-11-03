/**
 * Buyer: pay a Wayan package over x402 and print the redeem code. This is what an AI agent does for its human.
 *
 *   BUYER_PRIVATE_KEY=0x... STOREFRONT_URL=https://agents.wayanwarrior.pro npm run buy -- pilot
 *
 * The buyer wallet only signs an EIP-3009 authorization for the exact price; the Celo facilitator settles it and
 * pays the gas. The buyer needs the stablecoin, not CELO.
 */
import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { decodePaymentResponseHeader } from '@x402/core/http'
import { privateKeyToAccount } from 'viem/accounts'
import { CFG, PACKAGES, type PackageId } from '../src/config.js'

const pkg = process.argv[2] ?? 'topup_200'
const base = (process.env.STOREFRONT_URL ?? 'http://localhost:8402').replace(/\/$/, '')
const key = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined
if (!key) throw new Error('Set BUYER_PRIVATE_KEY (a wallet holding the stablecoin)')

// PAY_TOKEN=USDC|USDT|USAT picks the token this wallet holds; by default the first option offered (USA₮ on mainnet).
const want = CFG.tokens.find((t) => t.symbol === (process.env.PAY_TOKEN ?? '').toUpperCase())
const client = new x402Client((_version, options) =>
  (want && options.find((o) => o.asset.toLowerCase() === want.address.toLowerCase())) || options[0],
).register('eip155:*', new ExactEvmScheme(privateKeyToAccount(key)))
// The client refuses to pay more than $1 by default; the cap is raised exactly to this package's list price.
const listPrice = PACKAGES[pkg as PackageId]?.usd
if (!listPrice) throw new Error(`Unknown package ${pkg}`)
client.setSpendControls({ maxAmountPerPayment: `$${listPrice}` })
const pay = wrapFetchWithPayment(fetch, client)

const res = await pay(`${base}/buy/${pkg}`)
const settled = res.headers.get('payment-response')
console.log(`HTTP ${res.status}`, await res.json())
if (settled) {
  const s = decodePaymentResponseHeader(settled) as any
  console.log(`settled on ${CFG.label}: ${CFG.explorerTx}${s.transaction}`)
}
