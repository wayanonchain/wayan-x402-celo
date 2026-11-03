/**
 * ERC-8021 builder attribution (schema 0): ascii codes, joined by commas, then one length byte, the schema id
 * byte 0x00 and the 16-byte marker 0x8021...8021. The suffix is appended to the calldata of every transaction
 * this agent sends, so the hackathon dashboard can attribute it. The tag is issued at enrollment.
 */
import { concatHex, stringToHex, toHex, type Hex } from 'viem'

export const MARKER: Hex = '0x80218021802180218021802180218021'

export function dataSuffix(codes: string[]): Hex {
  const joined = codes.map((c) => c.trim()).filter(Boolean).join(',')
  if (!joined) throw new Error('attribution: no builder code')
  if (!/^[\x20-\x7e]+$/.test(joined)) throw new Error('attribution: codes must be printable ascii')
  const bytes = new TextEncoder().encode(joined).length
  if (bytes > 255) throw new Error('attribution: codes longer than 255 bytes')
  return concatHex([stringToHex(joined), toHex(bytes, { size: 1 }), '0x00', MARKER])
}

/** Decode the schema-0 codes at the end of calldata, or null when there is no ERC-8021 suffix. */
export function readSuffix(data: Hex): string[] | null {
  const hex = data.toLowerCase()
  if (!hex.endsWith(MARKER.slice(2))) return null
  const body = hex.slice(0, -MARKER.length + 2)
  const schema = body.slice(-2)
  if (schema !== '00') return null
  const len = parseInt(body.slice(-4, -2), 16)
  const codesHex = body.slice(-4 - len * 2, -4)
  return Buffer.from(codesHex, 'hex').toString('ascii').split(',')
}

export function builderCodes(): string[] {
  const tag = (process.env.ATTRIBUTION_TAG ?? '').trim()
  if (!tag) throw new Error('Set ATTRIBUTION_TAG (issued when you enroll in the hackathon) before any transaction')
  return [tag]
}
