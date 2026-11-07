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
 * Without the live keys the server starts in demo mode (see src/app.ts).
 */
import { serve } from '@hono/node-server'
import { CFG, PORT, PUBLIC_URL } from './config.js'
import { createApp } from './app.js'

const { app, live, missing } = createApp()

serve({ fetch: app.fetch, port: PORT })
if (live) {
  console.log(`Wayan x402 storefront on ${CFG.label}: ${PUBLIC_URL} (pay to ${process.env.SELLER_PAY_TO})`)
} else {
  console.log(`Wayan x402 storefront on ${CFG.label} in DEMO mode: http://localhost:${PORT}/catalog`)
  console.log(`/buy answers 503 until these are set (see .env.example): ${missing.join(', ')}`)
}
