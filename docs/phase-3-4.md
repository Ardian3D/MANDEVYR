# P3 and P4 release record — 2026-10-05

## Verified Arc token

- Network: Arc Mainnet, chain ID 5042.
- Contract: `0xeD2CBF69b36A0E26De6d121be086f31EDAf3b424`.
- ERC-20 reads on 2026-10-05 at an Arc Mainnet block: name `MANDEVYR`, symbol `MDVYR`, 18 decimals, observed total supply `1,000,000,000`. Supply can change if tokens are burned.
- Market page: <https://argus.world/token/0xeD2CBF69b36A0E26De6d121be086f31EDAf3b424>.
- Holder utility: signed-in wallets can open one new saved-preflight deep dive per UTC day. A wallet with at least 1 MDVYR at the block checked when opening a new report can open five. Reopening the same report does not use another daily slot. Existing report access remains after the day or token balance changes. The base preflight, vault research, and risk evidence are available without the token.
- The server verifies chain, contract bytecode, token name, symbol, decimals, supply, and `balanceOf` at one block. If RPC verification fails, the holder increase fails closed; the free slot remains available.

The screenshot shared by the founder shows an Argus page with a 1% buy tax, a 1% base fee, and a fee split of 60% creator funds, 15% buyback and burn, 15% dividends, and 10% liquidity. These market settings have not yet been independently read from the token's live Argus contract or API. They are intentionally omitted from the product UI until verified. Treasury allocation and vesting disclosures also remain to be published by the founder. No price or return claim is made.

## Agent and API surface

- `/api/p1/x402/config` publishes current paid-endpoint readiness, the 0.01 USDC raw price (`10000`), Arc network `eip155:5042`, native USDC asset, and facilitator.
- `/api/p1/x402/reports/{report_id}/deep-dive` requires a valid wallet SIWE session and ownership of that saved report before it can return an x402 402 challenge. It uses x402 v2, the exact EVM scheme, and Arcus as the independent facilitator. After settlement, the transaction hash and result hash are recorded in D1. A previously paid report can be reopened without another payment.
- The configured USDC payee is the founder-provided Arc wallet `0x2D44a6E9afAEA4d686E886f93b0BfD2059F20F01`.
- `P3_X402_ENABLED` is active only for `P3_X402_TEST_WALLET`; other wallets cannot obtain a paid challenge. The Agent API page provides a manual, exact 0.01 USDC wallet checkout for an owned saved report. The server records the signed authorization before settlement, locks each report to one active authorization, records the result hash, and offers a receipt recovery endpoint that checks the Arc transaction and event. A funded x402 settlement and recovery test are still outstanding. Do not remove the wallet restriction or describe x402 as publicly launched until those tests and an independent integration review pass. Arcus is an independent facilitator; its production reliability and current terms still need review.
- `/api/p1/agent/policy` and `/api/p1/agent/review` enforce a per-wallet HTTPS origin and endpoint allowlist, per-request and daily raw-USDC caps, and manual approval. The review records purpose and outcome. It does **not** verify an external 402 quote or execute an agent payment. Reviewed allowed amounts conservatively occupy that day's review allowance; they are not represented as onchain spending.
- No server-held wallet keys, automatic payment delegation, or AI provider keys are accepted. BYOK AI is not active. Deterministic rules remain authoritative.
- Before widening paid access, run `node --experimental-strip-types scripts/smoke-x402-quote.mjs`. This offline smoke checks that the mounted route returns an x402 v2 402 for an owned report, a 404 without a payment challenge for a non-owned report, the exact Arc quote, signature encoding, and recovery rejection without a real receipt. It cannot validate settlement without a wallet transaction.

## Release gates still open

On 2026-10-05, D1 migrations `0005`, `0006`, and `0007` were applied to the production database. Worker version `81761674-10a9-488d-accc-95f2e51f5f3f` was deployed, and the frontend was pushed to `main`. Public `/api/p1/health` returned database ready, P2 writes enabled, holder utility ready, agent policy ready, and x402 disabled. The public utility and agent routes returned the current frontend asset.

On 2026-10-06 local time, migration `0008` and Worker version `c0c26ebc-85f7-45d6-8998-1405b905da2d` were deployed. The production health endpoint returned `x402PilotEnabled: true` and `x402Enabled: false`; the anonymous config returned `mode: "pilot"` and `enabled: false`. The pilot is restricted to the configured founder wallet. No funded x402 payment has been submitted as part of this deployment.

1. Check CORS, account session, quota, and mobile/desktop layout on the public domain. Test a holder and nonholder wallet through the whole report entitlement flow with real Arc reads. Check date rollover and report access across wallets.
2. The Galaxy USDC funded approval/deposit/withdraw round trip succeeded on Arc Mainnet; [the receipt record](p2-funded-galaxy-2026-10-05.md) lists the transactions. Complete small funded tests for Gauntlet USDC Prime and Gauntlet EURC Prime, plus an independent integration review, before claiming all P2 routes are verified.
3. The x402 wallet pilot is available to the configured test wallet. Run one 0.01 USDC funded settlement through Arcus, verify the Arc receipt, D1 audit, and idempotent report reopen. Exercise the recovery endpoint with a settled payment whose audit write fails, then review provider failure and refund behavior before lifting the wallet restriction.
4. Publish the final token allocation, treasury, vesting, Argus fee terms, independent contract/security review, and incident response owner. The token already exists, but the PRD P4 launch gate cannot be retroactively called passed without these disclosures.

## Source material

- [Arcus x402 quickstart](https://docs.arcusnetwork.co/quickstart)
- [x402 foundation SDK and protocol](https://github.com/x402-foundation/x402)
- [Argus documentation](https://argus.world/docs)
