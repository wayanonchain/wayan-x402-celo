/**
 * Wayan Warrior x402 storefront on Celo.
 *
 *   GET /buy/pilot      402 -> pay $39 in USA₮ / USDT / USDC -> { code, redeem_url }
 *   GET /buy/topup_200  402 -> pay $15                        -> { code, redeem_url }
 *   GET /catalog        free: packages, prices, accepted tokens
 *   GET /.well-known/agent-card.json  ERC-8004 registration file
 *
 * The buyer (a person's wallet or an AI agent with @x402/fetch) signs one EIP-3009 authorization; the Celo
 * facilitator verifies and settles it on chain and pays the gas. The paid response is a single-use code that adds
 * the package to any Wayan account at wayanwarrior.pro. Nothing here holds the buyer's keys or funds.
 */
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { decodePaymentSignatureHeader } from '@x402/core/http'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { getAddress } from 'viem'
import { CFG, NET, PACKAGES, PORT, PUBLIC_URL, type PackageId } from './config.js'
import { agentCard } from './card.js'
import { mintRedeemCode } from './wayan.js'

for (const key of ['X402_API_KEY', 'SELLER_PAY_TO', 'WAYAN_X402_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} (see .env.example)`)
    process.exit(1)
  }
}
const PAY_TO = getAddress(process.env.SELLER_PAY_TO!)

const facilitator = new HTTPFacilitatorClient({
  url: CFG.facilitator,
  createAuthHeaders: async () => {
    const h = { 'X-API-Key': process.env.X402_API_KEY! }
    return { verify: h, settle: h, supported: h }
  },
})
const resourceServer = new x402ResourceServer(facilitator)
resourceServer.register('eip155:*', new ExactEvmScheme())

const units = (usd: number) => String(Math.round(usd * 1_000_000)) // every accepted token has 6 decimals

const routes = Object.fromEntries(
  (Object.keys(PACKAGES) as PackageId[]).map((id) => [
    `GET /buy/${id}`,
    {
      accepts: CFG.tokens.map((t) => ({
        scheme: 'exact',
        network: CFG.caip2,
        payTo: PAY_TO,
        price: { amount: units(PACKAGES[id].usd), asset: t.address, extra: { name: t.name, version: t.version } },
      })),
      description: `Wayan Warrior ${PACKAGES[id].title}. Paid response: a single-use redeem code for wayanwarrior.pro.`,
      mimeType: 'application/json',
    },
  ]),
)

const app = new Hono()

app.get('/', (c) => c.redirect('/catalog'))
app.get('/health', (c) => c.json({ ok: true, network: CFG.label }))
app.get('/catalog', (c) =>
  c.json({
    seller: 'Wayan Warrior',
    site: 'https://wayanwarrior.pro',
    network: CFG.caip2,
    pay_to: PAY_TO,
    tokens: CFG.tokens.map((t) => t.symbol),
    packages: Object.entries(PACKAGES).map(([id, p]) => ({ id, price_usd: p.usd, title: p.title, buy: `${PUBLIC_URL}/buy/${id}` })),
    how: 'GET a buy URL with an x402 client (e.g. @x402/fetch). You get a code; redeem it at wayanwarrior.pro under Billing & plan > Have a promo code.',
  }),
)
app.get('/.well-known/agent-card.json', (c) => c.json(agentCard()))

app.use(paymentMiddleware(routes as any, resourceServer)) // routes first, then the server

app.get('/buy/:id', async (c) => {
  const id = c.req.param('id') as PackageId
  if (!(id in PACKAGES)) return c.json({ error: 'unknown package' }, 404)
  // The middleware has verified the payment by now; the header names who paid and with which nonce.
  const header = c.req.header('payment-signature') ?? ''
  const payment = decodePaymentSignatureHeader(header) as any
  const auth = payment?.payload?.authorization ?? {}
  const accepted = payment?.accepted ?? {}
  const code = await mintRedeemCode({
    package_id: id,
    payment_reference: `${NET}:${String(auth.from).toLowerCase()}:${auth.nonce}`,
    network: CFG.caip2,
    asset: String(accepted.asset ?? ''),
    amount_units: String(auth.value ?? accepted.amount ?? ''),
    payer: String(auth.from ?? ''),
  })
  return c.json({
    package: id,
    code: code.code,
    redeem_url: code.redeem_url,
    note: 'Single use. Open the redeem URL (or Billing & plan > Have a promo code on wayanwarrior.pro) and enter the code.',
  })
})

serve({ fetch: app.fetch, port: PORT })
console.log(`Wayan x402 storefront on ${CFG.label}: ${PUBLIC_URL} (pay to ${PAY_TO})`)
