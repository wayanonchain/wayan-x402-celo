/** ERC-8004 registration file served at /.well-known/agent-card.json; its URL is the agentURI on chain. */
import { CFG, IDENTITY_REGISTRY, PACKAGES, PUBLIC_URL } from './config.js'

export function agentCard() {
  const agentId = process.env.AGENT_ID ? Number(process.env.AGENT_ID) : undefined
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: 'Wayan Warrior',
    description:
      'AI content agent for short video: researches what works in a niche on TikTok and Reels, writes lead-generating ' +
      'scripts and renders videos with the client’s own avatar. Sells its packages over x402 on Celo for USA₮, USDT or USDC.',
    image: 'https://wayanwarrior.pro/assets/wayan-warrior-favicon.svg',
    services: [
      { name: 'web', endpoint: 'https://wayanwarrior.pro' },
      { name: 'x402', endpoint: `${PUBLIC_URL}/catalog` },
      { name: 'agent-skills', endpoint: 'https://wayanwarrior.pro/agent' },
    ],
    x402Support: true,
    active: true,
    registrations: agentId === undefined ? [] : [{ agentId, agentRegistry: `eip155:${CFG.chainId}:${IDENTITY_REGISTRY}` }],
    supportedTrust: ['reputation'],
    offers: Object.entries(PACKAGES).map(([id, p]) => ({ id, price_usd: p.usd, title: p.title, buy: `${PUBLIC_URL}/buy/${id}` })),
  }
}
