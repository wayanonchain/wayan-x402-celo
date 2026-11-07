/** Offline tests: no network, no keys, no wallet. Live payments are covered by the sample transactions in README. */
import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { dataSuffix, readSuffix, MARKER } from '../src/attribution.js'
import { buildRoutes, createApp, missingLiveKeys } from '../src/app.js'
import { CFG, IDENTITY_REGISTRY, NETWORKS, PACKAGES } from '../src/config.js'

const PAY_TO = getAddress('0x2B94E5E4eFE0c3b4893B8e4ed4291007472Ab302')

describe('ERC-8021 attribution suffix', () => {
  it('matches the schema-0 reference encoding', () => {
    // "baseapp,morpho" (14 bytes) + length 0x0e + schema 0x00 + marker, as in the ERC-8021 example.
    expect(dataSuffix(['baseapp', 'morpho'])).toBe(
      '0x626173656170702c6d6f7270686f0e00' + MARKER.slice(2),
    )
  })

  it('round-trips through calldata', () => {
    const calldata = ('0xa9059cbb' + '00'.repeat(64) + dataSuffix(['celo_c0170f9f7e58']).slice(2)) as `0x${string}`
    expect(readSuffix(calldata)).toEqual(['celo_c0170f9f7e58'])
    expect(readSuffix('0xa9059cbb')).toBeNull()
  })

  it('refuses empty or non-ascii codes', () => {
    expect(() => dataSuffix([' '])).toThrow()
    expect(() => dataSuffix(['кириллица'])).toThrow()
  })
})

describe('catalog and payment requirements', () => {
  it('sells the Wayan packages at their list prices', () => {
    expect(PACKAGES.pilot.usd).toBe(39)
    expect(PACKAGES.topup_200.usd).toBe(15)
  })

  it('accepts USA₮, USDT and USDC on Celo mainnet', () => {
    expect(NETWORKS.mainnet.chainId).toBe(42220)
    expect(NETWORKS.mainnet.tokens.map((t) => t.symbol)).toEqual(['USAT', 'USDT', 'USDC'])
    expect(IDENTITY_REGISTRY).toBe('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432')
  })

  it('asks for the exact price in every token, paid to the seller', () => {
    const routes = buildRoutes(PAY_TO) as Record<string, any>
    expect(Object.keys(routes)).toEqual(['GET /buy/pilot', 'GET /buy/topup_200'])
    for (const option of routes['GET /buy/pilot'].accepts) {
      expect(option).toMatchObject({ scheme: 'exact', network: CFG.caip2, payTo: PAY_TO })
      expect(option.price.amount).toBe('39000000')
    }
    expect(routes['GET /buy/topup_200'].accepts[0].price.amount).toBe('15000000')
  })
})

describe('demo mode (no secrets)', () => {
  const { app, live, missing } = createApp({})

  it('starts without keys and says which are missing', () => {
    expect(live).toBe(false)
    expect(missing).toEqual(['X402_API_KEY', 'SELLER_PAY_TO', 'WAYAN_X402_SECRET'])
    expect(missingLiveKeys({ X402_API_KEY: 'k', SELLER_PAY_TO: PAY_TO, WAYAN_X402_SECRET: 's' })).toEqual([])
  })

  it('serves the catalog, health and agent card', async () => {
    const catalog = await (await app.request('/catalog')).json()
    expect(catalog.mode).toBe('demo')
    expect(catalog.packages.map((p: any) => p.id)).toEqual(['pilot', 'topup_200'])
    expect((await (await app.request('/health')).json()).ok).toBe(true)
    const card = await (await app.request('/.well-known/agent-card.json')).json()
    expect(card.x402Support).toBe(true)
  })

  it('never sells in demo mode', async () => {
    const res = await app.request('/buy/pilot')
    expect(res.status).toBe(503)
    expect(res.headers.get('payment-required')).toBeNull()
    expect((await app.request('/buy/nothing')).status).toBe(404)
  })
})
