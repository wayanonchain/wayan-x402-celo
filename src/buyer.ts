/**
 * Buyer-side checks, kept apart from scripts/buy.ts so they are tested without a key or a network.
 *
 * The buyer signs only an offer that matches what the human agreed to: this network, this token, Wayan's pay-to
 * address and the package's exact price. Anything else stops the purchase before a signature exists.
 */
import { getAddress, type Address } from 'viem'
import { NETWORKS, PACKAGES, type NetworkName, type PackageId } from './config.js'

export type Offer = { scheme: string; network: string; asset: string; amount: string; payTo: string }

export type Expected = { network: NetworkName; token: string; payTo: Address; packageId: PackageId }

export function expectedPurchase(env: NodeJS.ProcessEnv, network: NetworkName, packageId: string, payTo: Address): Expected {
  if (!(packageId in PACKAGES)) throw new Error(`Unknown package "${packageId}" (pilot or topup_200)`)
  const token = (env.PAY_TOKEN ?? '').trim().toUpperCase()
  const symbols = NETWORKS[network].tokens.map((t) => t.symbol)
  if (!token) throw new Error(`Set PAY_TOKEN to the token this wallet holds: ${symbols.join(', ')}`)
  if (!symbols.includes(token)) throw new Error(`PAY_TOKEN "${token}" is not accepted on ${NETWORKS[network].label}: ${symbols.join(', ')}`)
  return { network, token, payTo: getAddress(payTo), packageId: packageId as PackageId }
}

export const priceUnits = (packageId: PackageId) => String(Math.round(PACKAGES[packageId].usd * 1_000_000))

/** The one offer to sign, or an error naming what did not match. Never falls back to another option. */
export function pickOffer(offers: Offer[], want: Expected): Offer {
  const net = NETWORKS[want.network]
  const asset = net.tokens.find((t) => t.symbol === want.token)!.address.toLowerCase()
  const amount = priceUnits(want.packageId)
  const match = offers.find(
    (o) =>
      o.scheme === 'exact' &&
      o.network === net.caip2 &&
      o.asset.toLowerCase() === asset &&
      o.amount === amount &&
      getAddress(o.payTo) === want.payTo,
  )
  if (match) return match
  const seen = offers.map((o) => `${o.network} ${o.asset} ${o.amount} -> ${o.payTo}`).join('; ') || 'none'
  throw new Error(
    `No offer matches ${want.token} on ${net.label}, ${amount} units to ${want.payTo}. Not paying. Offers: ${seen}`,
  )
}

export type Settlement = { ok: boolean; network: string; transaction: string; link: string | null; error?: string }

/** Reads the decoded payment-response header; the explorer comes from the network that settled, not local config. */
export function describeSettlement(s: any): Settlement {
  const network = String(s?.network ?? '')
  const transaction = String(s?.transaction ?? '')
  const known = Object.values(NETWORKS).find((n) => n.caip2 === network)
  return {
    ok: s?.success === true && transaction !== '',
    network: known ? known.label : network || 'unknown network',
    transaction,
    link: known && transaction ? `${known.explorerTx}${transaction}` : null,
    ...(s?.errorReason ? { error: String(s.errorReason) } : {}),
  }
}
