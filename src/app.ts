/**
 * The storefront as a Hono app, so the server and the tests build the same thing.
 *
 * Live mode needs X402_API_KEY, SELLER_PAY_TO and WAYAN_X402_SECRET. Without them the app starts in demo mode:
 * /catalog, /health and the agent card work, and /buy answers 503 without asking for or taking any payment.
 */
import { Hono } from 'hono'
import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { decodePaymentSignatureHeader } from '@x402/core/http'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { getAddress, type Address } from 'viem'
import { CFG, NET, PACKAGES, PUBLIC_URL, type PackageId } from './config.js'
import { agentCard } from './card.js'
import { mintRedeemCode } from './wayan.js'

export const LIVE_KEYS = ['X402_API_KEY', 'SELLER_PAY_TO', 'WAYAN_X402_SECRET'] as const

/** Keys that are missing for live sales; an empty list means live mode. */
export function missingLiveKeys(env: NodeJS.ProcessEnv): string[] {
  return LIVE_KEYS.filter((key) => !env[key])
}

const units = (usd: number) => String(Math.round(usd * 1_000_000)) // every accepted token has 6 decimals

/** x402 payment requirements per package: one exact-price option per accepted token, all paid to payTo. */
export function buildRoutes(payTo: Address) {
  return Object.fromEntries(
    (Object.keys(PACKAGES) as PackageId[]).map((id) => [
      `GET /buy/${id}`,
      {
        accepts: CFG.tokens.map((t) => ({
          scheme: 'exact',
          network: CFG.caip2,
          payTo,
          price: { amount: units(PACKAGES[id].usd), asset: t.address, extra: { name: t.name, version: t.version } },
        })),
        description: `Wayan Warrior ${PACKAGES[id].title}. Paid response: a single-use redeem code for wayanwarrior.pro.`,
        mimeType: 'application/json',
      },
    ]),
  )
}

export function createApp(env: NodeJS.ProcessEnv = process.env) {
  const missing = missingLiveKeys(env)
  const live = missing.length === 0
  const payTo = env.SELLER_PAY_TO ? getAddress(env.SELLER_PAY_TO) : null

  const app = new Hono()

  app.get('/', (c) => c.redirect('/catalog'))
  app.get('/health', (c) => c.json({ ok: true, network: CFG.label, mode: live ? 'live' : 'demo' }))
  app.get('/catalog', (c) =>
    c.json({
      seller: 'Wayan Warrior',
      site: 'https://wayanwarrior.pro',
      mode: live ? 'live' : 'demo',
      network: CFG.caip2,
      pay_to: payTo,
      tokens: CFG.tokens.map((t) => t.symbol),
      packages: Object.entries(PACKAGES).map(([id, p]) => ({ id, price_usd: p.usd, title: p.title, buy: `${PUBLIC_URL}/buy/${id}` })),
      how: 'GET a buy URL with an x402 client (e.g. @x402/fetch). You get a code; redeem it at wayanwarrior.pro under Billing & plan > Have a promo code.',
    }),
  )
  app.get('/.well-known/agent-card.json', (c) => c.json(agentCard()))

  // Only GET can buy. Hono runs GET handlers for HEAD, but the x402 middleware matches payment rules on the original
  // method, so a HEAD would reach the handler unverified. Refuse every other method before any payment logic.
  app.use('/buy/*', async (c, next) => {
    if (c.req.method !== 'GET') return c.json({ error: 'method not allowed: buy with GET' }, 405, { Allow: 'GET' })
    await next()
  })

  if (!live) {
    app.get('/buy/:id', (c) => {
      if (!(c.req.param('id') in PACKAGES)) return c.json({ error: 'unknown package' }, 404)
      return c.json({ error: 'demo mode: sales are not configured on this server', missing }, 503)
    })
    return { app, live, missing }
  }

  const facilitator = new HTTPFacilitatorClient({
    url: CFG.facilitator,
    createAuthHeaders: async () => {
      const h = { 'X-API-Key': env.X402_API_KEY! }
      return { verify: h, settle: h, supported: h }
    },
  })
  const resourceServer = new x402ResourceServer(facilitator)
  resourceServer.register('eip155:*', new ExactEvmScheme())

  app.use(paymentMiddleware(buildRoutes(payTo!) as any, resourceServer)) // routes first, then the server

  app.get('/buy/:id', async (c) => {
    if (c.req.method !== 'GET') return c.json({ error: 'method not allowed: buy with GET' }, 405, { Allow: 'GET' })
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

  return { app, live, missing }
}
