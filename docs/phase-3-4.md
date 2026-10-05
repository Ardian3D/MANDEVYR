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
- `P3_X402_ENABLED` defaults to `false`. Do not turn it on until a small funded Arc payment verifies 402, signature, settlement, receipt, idempotent reopen, failed handler handling, and audit recovery. Arcus is independent of Circle; check its production reliability and current terms before this switch is changed.
- `/api/p1/agent/policy` and `/api/p1/agent/review` enforce a per-wallet HTTPS origin and endpoint allowlist, per-request and daily raw-USDC caps, and manual approval. The review records purpose and outcome. It does **not** verify an external 402 quote or execute an agent payment. Reviewed allowed amounts conservatively occupy that day's review allowance; they are not represented as onchain spending.
- No server-held wallet keys, automatic payment delegation, or AI provider keys are accepted. BYOK AI is not active. Deterministic rules remain authoritative.
- Before any paid switch, run `node --experimental-strip-types scripts/smoke-x402-quote.mjs`. This read-only smoke checks that the mounted production path returns an x402 v2 402 for an owned report and a 404 without a payment challenge for a non-owned report. It cannot validate settlement without a wallet transaction.

## Release gates still open

On 2026-10-05, D1 migrations `0005`, `0006`, and `0007` were applied to the production database. Worker version `81761674-10a9-488d-accc-95f2e51f5f3f` was deployed, and the frontend was pushed to `main`. Public `/api/p1/health` returned database ready, P2 writes enabled, holder utility ready, agent policy ready, and x402 disabled. The public utility and agent routes returned the current frontend asset.

1. Check CORS, account session, quota, and mobile/desktop layout on the public domain. Test a holder and nonholder wallet through the whole report entitlement flow with real Arc reads. Check date rollover and report access across wallets.
2. Complete P2 funded approval, deposit, and withdrawal with a small user-confirmed amount and independent integration review. Those actions have not been shown to succeed with real funds.
3. Run an x402 funded test through Arcus before enabling the paid endpoint. Add an operational recovery path for a settled payment whose D1 audit write fails and verify provider error/refund behavior.
4. Publish the final token allocation, treasury, vesting, Argus fee terms, independent contract/security review, and incident response owner. The token already exists, but the PRD P4 launch gate cannot be retroactively called passed without these disclosures.

## Source material

- [Arcus x402 quickstart](https://docs.arcusnetwork.co/quickstart)
- [x402 foundation SDK and protocol](https://github.com/x402-foundation/x402)
- [Argus documentation](https://argus.world/docs)
