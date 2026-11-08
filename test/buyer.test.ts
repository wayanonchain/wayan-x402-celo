/** Buyer checks (review 2026-11-08, R1-R4): offline, no key, no signature. */
import { describe, expect, it } from 'vitest'
import { x402Client } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { describeSettlement, expectedPurchase, pickOffer, type Offer } from '../src/buyer.js'
import { NETWORKS, WAYAN_PAY_TO, parseNetwork } from '../src/config.js'

const main = NETWORKS.mainnet
const [USAT, USDT, USDC] = main.tokens
const offer = (asset: string, over: Partial<Offer> = {}): Offer => ({
  scheme: 'exact', network: main.caip2, asset, amount: '15000000', payTo: WAYAN_PAY_TO, ...over,
})
const allThree = () => [offer(USAT.address), offer(USDT.address), offer(USDC.address)]
const want = (token = 'USDC', pkg = 'topup_200') => expectedPurchase({ PAY_TOKEN: token }, 'mainnet', pkg, WAYAN_PAY_TO)

describe('network setting', () => {
  it('accepts only testnet or mainnet; a typo is an error', () => {
    expect(parseNetwork(undefined)).toBe('testnet')
    expect(parseNetwork('mainnet')).toBe('mainnet')
    expect(() => parseNetwork('mainet')).toThrow(/testnet" or "mainnet/)
  })
})

describe('PAY_TOKEN', () => {
  it('is required and must be a token of the chosen network', () => {
    expect(() => expectedPurchase({}, 'mainnet', 'pilot', WAYAN_PAY_TO)).toThrow(/Set PAY_TOKEN/)
    expect(() => expectedPurchase({ PAY_TOKEN: 'USCD' }, 'mainnet', 'pilot', WAYAN_PAY_TO)).toThrow(/not accepted/)
    expect(() => expectedPurchase({ PAY_TOKEN: 'USAT' }, 'testnet', 'pilot', WAYAN_PAY_TO)).toThrow(/not accepted/)
    expect(() => expectedPurchase({ PAY_TOKEN: 'USDC' }, 'mainnet', 'pro', WAYAN_PAY_TO)).toThrow(/Unknown package/)
  })
})

describe('pickOffer never substitutes', () => {
  it('picks USDC even when USA₮ is offered first, in any order', () => {
    expect(pickOffer(allThree(), want()).asset).toBe(USDC.address)
    expect(pickOffer(allThree().reverse(), want()).asset).toBe(USDC.address)
    expect(pickOffer(allThree(), want('usat')).asset).toBe(USAT.address)
  })

  it.each([
    ['the chosen token is not offered', [offer(USDT.address)]],
    ['the offer is on another network (Base)', [offer('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', { network: 'eip155:8453' })]],
    ['the same USDC symbol is on Sepolia', [offer(NETWORKS.testnet.tokens[0].address, { network: NETWORKS.testnet.caip2 })]],
    ['it pays someone else', [offer(USDC.address, { payTo: '0x0000000000000000000000000000000000000002' })]],
    ['the amount is not the price', [offer(USDC.address, { amount: '15000001' })]],
    ['the scheme is not exact', [offer(USDC.address, { scheme: 'upto' })]],
  ])('refuses when %s', (_why, offers) => {
    expect(() => pickOffer(offers as Offer[], want())).toThrow(/Not paying/)
  })

  it('checks the pilot price separately', () => {
    expect(pickOffer([offer(USDC.address, { amount: '39000000' })], want('USDC', 'pilot')).amount).toBe('39000000')
    expect(() => pickOffer(allThree(), want('USDC', 'pilot'))).toThrow(/Not paying/)
  })

  it('address case does not cause a false refusal', () => {
    expect(pickOffer([offer(USDC.address.toLowerCase(), { payTo: WAYAN_PAY_TO.toLowerCase() })], want()).amount).toBe('15000000')
  })

  it('runs inside the real x402 client, registered on Celo mainnet only', () => {
    const account = { address: '0x0000000000000000000000000000000000000001', signTypedData: () => { throw new Error('no signing in tests') } }
    const client = new x402Client((_v, options) => pickOffer(options as any, want()) as any)
      .register(main.caip2 as `${string}:${string}`, new ExactEvmScheme(account as any))
    client.setSpendControls({ maxAmountPerPayment: '$15' })
    const full = (o: Offer) => ({ ...o, maxTimeoutSeconds: 60, extra: { name: 'x', version: '1' } })
    expect(((client as any).selectPaymentRequirements(2, allThree().map(full) as any) as any).asset).toBe(USDC.address)
    expect(() => (client as any).selectPaymentRequirements(2, [offer(USDC.address, { network: 'eip155:8453' })].map(full) as any)).toThrow()
  })
})

describe('settlement report', () => {
  it('links the explorer of the network that settled, not the local setting', () => {
    const s = describeSettlement({ success: true, network: main.caip2, transaction: '0xabc' })
    expect(s).toMatchObject({ ok: true, network: 'Celo mainnet', link: 'https://celoscan.io/tx/0xabc' })
  })

  it('reports failures and unknown networks without inventing a link', () => {
    expect(describeSettlement({ success: false, network: main.caip2, transaction: '', errorReason: 'x' })).toMatchObject({ ok: false, error: 'x' })
    expect(describeSettlement({ success: true, network: 'eip155:1', transaction: '0xabc' })).toMatchObject({ link: null, network: 'eip155:1' })
  })
})
