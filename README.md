# Wayan Warrior on Celo: buy AI-made short videos with x402

[Wayan Warrior](https://wayanwarrior.pro) is an AI content agent: it researches what works in a niche on TikTok and
Reels, writes lead-generating scripts and renders videos with the client's own avatar.

This repository is its **x402 storefront on Celo mainnet**. Any AI agent or wallet can buy a Wayan package with one
HTTP request, paying **USA₮, USDT or USDC** through the official [Celo x402 facilitator](https://x402.celo.org).
Built for the Celo × Ripio *Agents on Open Rails* hackathon (track: Open Corridors, USA₮ with x402).

**Buying a package (people and agents): see [BUYING.md](BUYING.md).**

## How it works

```
agent / wallet ──GET /buy/pilot──▶ storefront ──402: price in USA₮/USDT/USDC──▶ agent
agent signs one EIP-3009 authorization (no gas) ──▶ storefront ──verify/settle──▶ Celo facilitator ──▶ Celo mainnet
storefront ──signed request──▶ wayanwarrior.pro ──▶ single-use redeem code ──▶ agent ──▶ human redeems at wayanwarrior.pro
```

| Route | Price | Paid response |
|---|---|---|
| `GET /buy/pilot` | $39 | redeem code: niche research, 3 scripts, 3 videos and a photo avatar |
| `GET /buy/topup_200` | $15 | redeem code: +1 video (200 credits) |
| `GET /catalog` | free | packages, prices, accepted tokens, pay-to address |
| `GET /.well-known/agent-card.json` | free | ERC-8004 registration file (the agent's `agentURI`) |

- **Buyer pays no gas:** the Celo facilitator settles the EIP-3009 transfer and pays gas.
- **No keys held:** the storefront never touches buyer keys; funds go straight to the pay-to wallet.
- **One payment, one code:** the code is keyed by payer + EIP-3009 nonce, so a retry returns the same code.
- **Identity:** the agent is registered in the ERC-8004 Identity Registry on Celo
  (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`).
- **Attribution:** every transaction the agent sends carries the hackathon builder code as an ERC-8021 data suffix
  (`src/attribution.ts`).

## Run

```bash
npm ci
cp .env.example .env      # fill X402_API_KEY, SELLER_PAY_TO, WAYAN_X402_SECRET, ATTRIBUTION_TAG
npm start                 # storefront on PORT (8402)
```

Buy as an agent (a wallet holding USA₮, USDT or USDC on Celo):

```bash
BUYER_PRIVATE_KEY=0x... STOREFRONT_URL=https://agents.wayanwarrior.pro npm run buy -- topup_200
```

Register the agent identity (agent wallet with a little CELO):

```bash
AGENT_PRIVATE_KEY=0x... X402_NETWORK=mainnet npm run register
```

## License

MIT
