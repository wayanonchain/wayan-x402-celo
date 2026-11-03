# How to buy Wayan Warrior on Celo

Wayan Warrior researches what works in your niche on TikTok and Reels, writes lead-generating scripts and renders
videos with your own avatar. You can buy a package yourself on the website, or let your AI agent buy it for you
with stablecoins on Celo. Either way, the package lands in a Wayan account at https://wayanwarrior.pro.

| Package | Price | What you get |
|---|---|---|
| `pilot` | $39 | niche research, 3 scripts, 3 videos and a photo avatar |
| `topup_200` | $15 | +1 video (200 credits) |

## Option 1. You buy it yourself (no code, no agent)

1. Open https://wayanwarrior.pro and sign in with your email.
2. Open the package and pick a payment method: USDG on Robinhood Chain (MetaMask), USDC on Solana, or card / bank transfer in rupiah
   (the payment link comes in Telegram).
3. Pay. The package switches on by itself.

The Celo storefront below is for programs and AI agents: it has no checkout page you click through in a browser.
If you want to pay on Celo by hand, use Option 2 with your own wallet.

## Option 2. Your AI agent buys it on Celo (x402)

The storefront is at https://agents.wayanwarrior.pro. It speaks [x402](https://x402.org): the agent asks for a
package, gets the price, signs one payment and gets back a redeem code.

### What the agent needs

- A wallet on Celo mainnet with at least the package price in **USA₮, USDT or USDC**.
- **No CELO for gas.** The agent only signs an authorization; the Celo facilitator sends the transaction and pays
  the gas.
- An x402 client, for example `@x402/fetch` (TypeScript) or the `buy` script in this repository.

### Steps

1. **Look at the catalog** (free): `GET https://agents.wayanwarrior.pro/catalog` returns packages, prices, accepted
   tokens and the address that gets paid (`pay_to`).
2. **Ask the human** which package to buy and confirm the price. An agent should never buy without a clear yes.
3. **Buy:** `GET https://agents.wayanwarrior.pro/buy/<package>` with an x402 client. The first answer is
   `402 Payment Required` with the price in each token; the client signs one EIP-3009 authorization for exactly that
   amount and repeats the request. The paid answer is:

   ```json
   { "package": "topup_200", "code": "CELO-XXXXXX", "redeem_url": "https://wayanwarrior.pro/?promo=CELO-XXXXXX" }
   ```

   The `payment-response` header carries the Celo transaction hash.
4. **Hand the code to the human.** It is single use and works on any Wayan account.

With this repository:

```bash
npm ci
BUYER_PRIVATE_KEY=0x... PAY_TOKEN=USDC STOREFRONT_URL=https://agents.wayanwarrior.pro npm run buy -- topup_200
```

`PAY_TOKEN` picks the token the wallet holds (`USAT`, `USDT` or `USDC`). The script refuses to pay more than the
package's list price.

With `@x402/fetch` in your own agent:

```ts
import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { privateKeyToAccount } from 'viem/accounts'

const client = new x402Client().register('eip155:*', new ExactEvmScheme(privateKeyToAccount(KEY)))
client.setSpendControls({ maxAmountPerPayment: '$15' }) // the client refuses anything above $1 by default
const res = await wrapFetchWithPayment(fetch, client)('https://agents.wayanwarrior.pro/buy/topup_200')
const { code, redeem_url } = await res.json()
```

### Rules for the agent

- **One request = one payment.** If a buy request fails or times out, do not run it again blindly: first check the
  wallet's history on [Celoscan](https://celoscan.io). If the money left, write to us (below) instead of paying twice.
- Never send the wallet's private key anywhere. The storefront never asks for it; it only receives a signature.
- Pay only to the `pay_to` address from `/catalog`.

## Redeem the code (the human does this)

1. Open the `redeem_url` (or https://wayanwarrior.pro) and sign in with your email.
2. The purchase window opens with the code already filled in under **Have a promo code?**. Press **Apply**.
   If the field is empty (for example, you signed in from another browser), open the `redeem_url` again, or open
   any package and type the code under **Have a promo code?** yourself.
3. The package is added to your account. Start with a niche analysis, then make scripts and videos.

## Agent identity

The storefront agent is registered in the ERC-8004 Identity Registry on Celo
(`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, agentId 10028). Its registration file:
https://agents.wayanwarrior.pro/.well-known/agent-card.json

## Help

Paid but got no code, or the code does not work: zaets@wayanwarrior.pro, with the transaction hash.
