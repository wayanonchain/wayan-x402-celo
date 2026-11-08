/**
 * Live-mode storefront with the real x402 middleware (review 2026-11-08, R5). The facilitator and the Wayan issuer
 * are an in-memory fetch: no network, no real keys, no signatures.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const seller = '0x2B94E5E4eFE0c3b4893B8e4ed4291007472Ab302'
const payer = '0x0000000000000000000000000000000000000001'
const network = 'eip155:42220'
const USDC = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
let calls: string[]
let settlementSucceeds: boolean
let app: any

const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const signature = (accepted: any) =>
  Buffer.from(JSON.stringify({
    x402Version: 2,
    accepted,
    payload: { signature: '0xNOT_A_SIGNATURE', authorization: {
      from: payer, to: seller, value: '15000000', validAfter: '0', validBefore: '9999999999', nonce: '0x' + '11'.repeat(32),
    } },
  })).toString('base64')
const accepted = { scheme: 'exact', network, asset: USDC, amount: '15000000', payTo: seller }
// The offer exactly as the storefront makes it, the way a real client copies it into its payment.
const offered = async () => {
  const challenge = await app.request('/buy/topup_200')
  const required = JSON.parse(Buffer.from(challenge.headers.get('payment-required'), 'base64').toString())
  return required.accepts.find((x: any) => x.asset.toLowerCase() === USDC.toLowerCase())
}
const sideEffects = () => calls.filter((x) => ['verify', 'issue', 'settle'].includes(x))

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('X402_NETWORK', 'mainnet')
  vi.stubEnv('WAYAN_X402_SECRET', 'test-only-secret')
  vi.stubEnv('WAYAN_API_URL', 'https://issuer.test.invalid')
  calls = []
  settlementSucceeds = true
  vi.stubGlobal('fetch', async (input: any) => {
    const url = String(input)
    if (url.endsWith('/supported')) {
      calls.push('supported')
      return json({ kinds: [{ x402Version: 2, scheme: 'exact', network }], extensions: [], signers: {} })
    }
    if (url.endsWith('/verify')) {
      calls.push('verify')
      return json({ isValid: true, payer })
    }
    if (url.endsWith('/settle')) {
      calls.push('settle')
      return json(settlementSucceeds
        ? { success: true, transaction: '0xtest', network }
        : { success: false, transaction: '', network, errorReason: 'test_settlement_failed' })
    }
    if (url === 'https://issuer.test.invalid/api/x402/redeem-codes') {
      calls.push('issue')
      return json({ code: 'TEST-ONLY', redeem_url: 'https://wayanwarrior.pro/?promo=TEST-ONLY', package_id: 'topup_200', reused: false })
    }
    throw new Error('network disabled in tests: ' + url)
  })
  const { createApp } = await import('../src/app.js')
  app = createApp({ X402_API_KEY: 'test-only-key', SELLER_PAY_TO: seller, WAYAN_X402_SECRET: 'test-only-secret' }).app
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it.each([
  ['without a payment header', {}],
  ['with a junk header', { 'payment-signature': 'junk' }],
  ['with a synthetic payment payload', { 'payment-signature': signature(accepted) }],
])('HEAD %s is refused with 405 and does nothing', async (_why, headers) => {
  const res = await app.request('/buy/topup_200', { method: 'HEAD', headers })
  expect(res.status).toBe(405)
  expect(sideEffects()).toEqual([])
})

it.each(['POST', 'PUT', 'DELETE'])('%s on /buy is refused before any payment logic', async (method) => {
  const res = await app.request('/buy/topup_200', { method, headers: { 'payment-signature': signature(accepted) } })
  expect(res.status).toBe(405)
  expect(sideEffects()).toEqual([])
})

it('GET without payment gets the 402 offer and nothing is issued', async () => {
  const res = await app.request('/buy/topup_200')
  expect(res.status).toBe(402)
  expect(res.headers.get('payment-required')).toBeTruthy()
  expect(sideEffects()).toEqual([])
})

it('GET with a verified payment: verify, issue, settle, and the code is returned', async () => {
  const res = await app.request('/buy/topup_200', { headers: { 'payment-signature': signature(await offered()) } })
  expect(sideEffects()).toEqual(['verify', 'issue', 'settle'])
  expect(res.status).toBe(200)
  expect((await res.json()).code).toBe('TEST-ONLY')
})

it('when settlement fails the code is not released to the buyer', async () => {
  settlementSucceeds = false
  const res = await app.request('/buy/topup_200', { headers: { 'payment-signature': signature(await offered()) } })
  expect(sideEffects()).toEqual(['verify', 'issue', 'settle'])
  expect(res.status).toBe(402)
  expect(await res.text()).not.toContain('TEST-ONLY')
})
