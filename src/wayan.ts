/**
 * The one call into Wayan Warrior: after a paid x402 request, ask Wayan for a single-use redeem code worth the
 * package. The body is signed with HMAC-SHA256 (WAYAN_X402_SECRET, shared with the Wayan server only); Wayan answers
 * the same code for the same payment reference, so a retried request never mints a second code.
 */
import { createHmac } from 'node:crypto'
import type { PackageId } from './config.js'

export type RedeemCode = { code: string; redeem_url: string; package_id: PackageId; reused: boolean }

export type PaidSale = {
  package_id: PackageId
  payment_reference: string // payer + EIP-3009 nonce: unique per signed payment
  network: string
  asset: string
  amount_units: string
  payer: string
}

export async function mintRedeemCode(sale: PaidSale): Promise<RedeemCode> {
  const base = (process.env.WAYAN_API_URL ?? 'https://wayanwarrior.pro').replace(/\/$/, '')
  const secret = process.env.WAYAN_X402_SECRET
  if (!secret) throw new Error('WAYAN_X402_SECRET is not set')
  const body = JSON.stringify(sale)
  const ts = Math.floor(Date.now() / 1000).toString()
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
  const res = await fetch(`${base}/api/x402/redeem-codes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Wayan-Timestamp': ts, 'X-Wayan-Signature': sig },
    body,
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Wayan refused the redeem code (HTTP ${res.status})`)
  const data = (await res.json()) as RedeemCode
  if (!data.code || !data.redeem_url?.startsWith('https://wayanwarrior.pro/')) throw new Error('Wayan answered without a code')
  return data
}
