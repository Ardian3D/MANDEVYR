# P2 Actions — Curated Morpho Vault V2 on Arc Mainnet

Status 2026-10-04: `/app/actions` locally supports the three reviewed Morpho Vault V2 entries in the registry on Arc Mainnet (chain ID 5042): Galaxy USDC, Gauntlet USDC Prime, and Gauntlet EURC Prime. The temporary local Node API bridge may enable `P2_MAINNET_WRITES_ENABLED=true` for wallet review; `.dev.vars` keeps it false. No mainnet transaction has been signed or submitted by this project work. The code has **not been pushed or deployed**; the public site is unchanged. Production must keep the switch unset until the release gate below is complete.

## Pinned route

| Contract | Arc Mainnet address | Runtime keccak256 |
|---|---|---|
| Galaxy USDC Vault V2 | `0x8E357432CC12ff425c36432F312968aEb16112AF` | `0xac3d89c4bed30ede74f4e94e9c0e124a13ed24d0e011181515996362879bae57` |
| Gauntlet USDC Prime Vault V2 | `0xdECcd53BE5453215821184824B519E04C7e00bC7` | `0xac3d89c4bed30ede74f4e94e9c0e124a13ed24d0e011181515996362879bae57` |
| Gauntlet EURC Prime Vault V2 | `0x05863F54B05e96092069eF30c9Ca6060336e50B9` | `0x0d9a18645e4c23fd5698069edd84ca001b630b0aeff6dd64863debaa2f2dc511` |
| Morpho VaultBundlesV1 | `0x76c1dEefAe48523E14903085081Bda2999450b68` | `0xa8ec5960bb20a33ed52e8248aed85ee3148135b185bba8bb74eb572a987fd4a5` |
| Native Arc USDC token view | `0x3600000000000000000000000000000000000000` | Checked at preparation |
| Arc EURC token | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` | Checked at preparation |

The Morpho SDK Arc registry supplies the bundle and Vault V2 factory addresses. The adapter checks both against the pinned addresses, verifies the factory recognizes the vault, compares vault and bundle runtime hashes, verifies the vault asset and USDC metadata, rejects EIP-1967 proxies, and checks the vault's dead-address shares. These are identity checks; they do not audit the vault strategy or guarantee liquidity, returns, or capital safety.

Sources: [Morpho Galaxy USDC listing](https://app.morpho.org/arc/vault/0x8E357432CC12ff425c36432F312968aEb16112AF/galaxy-usdc), [Gauntlet USDC Prime](https://app.morpho.org/arc/vault/0xdECcd53BE5453215821184824B519E04C7e00bC7/gauntlet-usdc-prime), [Gauntlet EURC Prime](https://app.morpho.org/arc/vault/0x05863F54B05e96092069eF30c9Ca6060336e50B9/gauntlet-eurc-prime), [Morpho SDK Vault V2 flow](https://docs.morpho.org/developers/sdks/morpho-sdk/vault/), [Arc network settings](https://docs.arc.io/arc/references/connect-to-arc).

## Wallet flow

1. The signed-in wallet selects one of the three pinned vaults, deposit or exact-asset withdrawal, and an amount in the vault asset. The active mandate limits USDC and EURC deposits separately and limits gas in native USDC. EURC deposits require explicit EURC action and daily caps in a newly saved mandate; old mandates have no EURC action cap and cannot deposit EURC.
2. The Worker reads current balances, shares, allowance, share preview, gas, and Morpho Vault V2 data. It uses `@morpho-org/morpho-sdk` v6 with signature support disabled and a 0.1% share-price tolerance. It builds the transaction through the pinned VaultBundlesV1 contract and decodes the resulting calldata to check the vault, amount, deadline, empty permit, and zero referral fee.
3. If the SDK returns an approval requirement, the Worker accepts exactly one `approve` call to the selected vault's base asset for a deposit or to its shares for a withdrawal. The spender must be the pinned bundle. Deposit approval must equal the deposit amount. Withdrawal approval uses the SDK share cap and may reset an oversized allowance. The wallet confirms the approval, then prepares the final action again.
4. The Worker simulates the wallet call, estimates gas, checks the mandate gas cap and native USDC reserve, and provides a 60-second review. The wallet prompts only after another onchain identity and simulation check. The Morpho call also has an onchain deadline.
5. The Worker matches the submitted transaction's sender, destination, calldata, value, chain, and nonce. Only a successful onchain receipt becomes `confirmed`. Provider errors remain `unknown`; replacements must match the original call and nonce.

Arc native USDC has 18 decimals for gas while its ERC-20 view has 6 decimals. The adapter accounts for both. Morpho Vault V2 `maxWithdraw` returns zero by design, so the action uses share balance, preview, SDK share cap, and final simulation instead.

Old testnet action records remain in account export but are excluded from the mainnet Actions history, pending-action gate, and 24-hour deposit tally. The disposable testnet vault/router are no longer used by the active adapter. USDC daily reservations aggregate both USDC vaults; EURC has a separate daily tally without assuming a EURC/USD exchange rate.

## Local switch and deployment gate

- Local `.dev.vars` keeps the switch false. Only the ignored Node API bridge currently enables the mainnet composer for local wallet review; changing its environment value to false closes local wallet actions immediately. Both files are outside Git tracking.
- The Worker defaults to `writesEnabled=false` unless `P2_MAINNET_WRITES_ENABLED` is exactly `true`. The earlier `P2_WRITES_ENABLED` and testnet address bindings have no effect.
- Do not turn this on for a public deployment before independent contract/transaction-flow review, an extension-wallet review on desktop and mobile, explicit risk copy, monitoring and rollback readiness, and a deliberately funded small-value mainnet approval/deposit/withdraw round trip. No testnet fixture can prove the real Galaxy Vault V2 execution path.
- The user's earlier instruction to **not publish** still applies. Pushing or deploying this local change requires a separate decision.

## Verification performed

- Live read-only Arc RPC checks: chain ID 5042; factory `isVaultV2=true` for all three; base assets match the pinned USDC and EURC addresses; both tokens have 6 decimals; vault shares use 18 decimals; dead-address shares are `10^18`; vault hashes match the pinned values; `previewDeposit` and `previewWithdraw` returned nonzero values.
- SDK read-only probes built deposit and withdrawal calls through the pinned Morpho bundle for all three vaults. No transaction was broadcast.
- `npm run typecheck`, `npm test` (23 cases), `npm run lint`, `npm run build`, and `node scripts/smoke-p2.mjs` passed locally. The smoke test used a disposable, unfunded wallet and confirmed rejected input did not create an action. Unit/API cases cover asset-specific daily reservations, pinned bundle calldata, and rejection of an old testnet action through mainnet receipt routes.
- Desktop and mobile browser checks of `/app/actions` showed the three vault choices, correct EURC label and source link, and no mobile horizontal overflow.

Limitations: mainnet approval/deposit/withdraw receipts are **not** yet tested for any of the three vaults. No read-only funded-wallet final-call simulation was completed for the newly added vaults. The local Windows host uses an ignored Node/Hono API bridge because Application Control blocks the Cloudflare `workerd` binary; the build passes, but the normal local Worker runtime was not exercised in this migration.

The previous no-yield testnet fixture and its onchain receipts remain documented in Git history at commit `9ed6e02`. Its `contracts/GuardedVaultRouter.sol` is unaudited fixture code and is not part of this mainnet transaction route.
