/**
 * Buyer: pay a Wayan package over x402 and print the redeem code. This is what an AI agent does for its human.
 *
 *   X402_NETWORK=mainnet PAY_TOKEN=USDC BUYER_PRIVATE_KEY=0x... STOREFRONT_URL=https://agents.wayanwarrior.pro \
 *     npm run buy -- pilot
 *
 * The buyer wallet only signs an EIP-3009 authorization for the exact price; the Celo facilitator settles it and
 * pays the gas. The buyer needs the stablecoin, not CELO. The script signs only an offer on this network, in
 * PAY_TOKEN, to Wayan's pay-to address, at the package price; anything else stops it before signing. It never
 * retries a payment: a failure exits with code 1 and prints what is known about the payment.
 */
import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { decodePaymentResponseHeader } from '@x402/core/http'
import { privateKeyToAccount } from 'viem/accounts'
import { CFG, NET, PACKAGES, WAYAN_PAY_TO } from '../src/config.js'
import { describeSettlement, expectedPurchase, pickOffer } from '../src/buyer.js'

async function main() {
  if (!process.env.X402_NETWORK) throw new Error('Set X402_NETWORK=mainnet (or testnet): the network you pay on')
  const pkg = process.argv[2] ?? 'topup_200'
  const base = (process.env.STOREFRONT_URL ?? 'http://localhost:8402').replace(/\/$/, '')
  const key = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined
  if (!key) throw new Error('Set BUYER_PRIVATE_KEY (a wallet holding the stablecoin)')
  const want = expectedPurchase(process.env, NET, pkg, (process.env.EXPECTED_PAY_TO as `0x${string}`) || WAYAN_PAY_TO)

  const client = new x402Client((_version, options) => pickOffer(options as any, want) as any).register(
    CFG.caip2 as `${string}:${string}`,
    new ExactEvmScheme(privateKeyToAccount(key)),
  )
  // The client refuses to pay more than $1 by default; the cap is raised exactly to this package's list price.
  client.setSpendControls({ maxAmountPerPayment: `$${PACKAGES[want.packageId].usd}` })
  const pay = wrapFetchWithPayment(fetch, client)

  const res = await pay(`${base}/buy/${want.packageId}`)
  // The payment result first: if the body is broken, the transaction is still known.
  const header = res.headers.get('payment-response')
  const settled = header ? describeSettlement(decodePaymentResponseHeader(header)) : null
  if (settled) {
    console.log(settled.ok ? `paid on ${settled.network}:` : `payment NOT settled on ${settled.network}:`, settled.link ?? settled.transaction)
    if (settled.error) console.log(`settlement error: ${settled.error}`)
  }
  const text = await res.text()
  let body: any = null
  try {
    body = JSON.parse(text)
  } catch {
    // reported below
  }
  if (!res.ok || !body?.code || body?.package !== want.packageId) {
    console.error(`Purchase failed: HTTP ${res.status}`, body ?? text.slice(0, 300))
    if (settled?.ok) console.error('The payment went through. Do not pay again: send the transaction link to zaets@wayanwarrior.pro.')
    process.exitCode = 1
    return
  }
  console.log({ package: body.package, code: body.code, redeem_url: body.redeem_url })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
