# P2 action composer — local implementation and release gate

Status as of 2026-10-02: the local transaction workflow and its UI are implemented. A no-yield ERC-4626 vault and guarded router have been deployed to Arc Testnet and used for real approval, deposit, and withdrawal tests. **Wallet writes remain disabled by default in code and on the public deployment.** The local `.dev.vars` enables only the testnet fixture. Morpho Vault V2 and mainnet transactions remain disabled. The P2 testnet gate still needs the owner's UI review and the remaining provider failure cases before a public release.

## What is implemented

- `/app/actions` has a responsive review composer for one Arc Testnet vault and exact USDC amounts. It displays the wallet, chain, contract, token, current allowance, exact approval, shares preview, minimum shares, gas at the current price, expiry, and explorer evidence.
- The Worker endpoint under `/api/p1/actions` uses the existing SIWE wallet session and active mandate. A fresh preparation checks the Arc Testnet chain ID, configured vault/router bytecode hashes, EIP-1967 implementation slots, vault and router asset identities, token decimals/symbol, wallet balance, allowance, vault shares, withdrawal limit, gas limit, mandate limits, and a current-block simulation.
- A deposit uses `GuardedVaultRouter.sol`, which pins the vault and asset and enforces the minimum share amount inside the deposit transaction. Approval is for the exact amount, and it must confirm before the deposit is prepared again. A withdrawal calls the vault directly only if `maxWithdraw` and simulation pass. This adapter targets a **no-yield Arc Testnet ERC-4626 fixture**. It is not a Morpho Vault V2 adapter.
- After the wallet sends a transaction, the Worker checks the hash's sender, destination, calldata, value, and chain. It records the wallet nonce and reports `confirmed` only after a successful onchain receipt. Pending/provider errors remain `unknown`; onchain reverts are `reverted`. A missing transaction is `dropped` only after 30 minutes, a specific transaction-not-found response, and a wallet nonce that has not advanced. If the nonce advanced, the status remains `unknown` and the user can provide a replacement hash; the server verifies that its call and nonce match.
- Action records are scoped to the signed-in wallet, included in account export/deletion, and block a second action while a recent prompt or transaction remains unresolved. Mainnet is hard-coded out of the action path.

## Arc Testnet deployment

| Item | Address / hash |
|---|---|
| Test vault | `0x13ce55f330092b2b86f235cd7ab71fc34614cd97` |
| Vault runtime keccak256 | `0x2141c626c0b26c88852838302460233324845ed6c28cfa10a88c105bfd9b53ba` |
| Guarded router | `0x6dabae5f8556fd806a026048a48233f40d6b5068` |
| Router runtime keccak256 | `0x2e040d46dbf6134a0643666b99b8a9a672cc3962588fe60fc008e5ec8f93b1f1` |
| Arc Testnet USDC | `0x3600000000000000000000000000000000000000` |

The vault and router were compiled with Solidity `0.8.30` and OpenZeppelin Contracts `5.6.1`. The vault has no yield strategy, owner, allocator, or proxy. Runtime code hashes, the vault's asset and share decimals, and the router's vault and asset were read back from Arc Testnet. Deployment receipts: [vault](https://explorer.testnet.arc.io/tx/0x0fee9795120ea3d59a61520ed9d1be075092af083bb219d2fddf3c0576b4153c), [router](https://explorer.testnet.arc.io/tx/0xe5a7290f26fda13b7ef52948d2feddb6cf8de02be4059df97caa0ec20afb3afb). These are project fixtures, not official Morpho contracts.

## Enable the local Arc Testnet fixture

Apply `migrations/0003_p2_actions.sql` to the local/preview D1 database. Set these Worker environment bindings only after validating the deployed contracts and the UI:

```text
P2_TESTNET_VAULT=<Arc Testnet vault address>
P2_TESTNET_VAULT_CODE_HASH=<keccak256(runtime bytecode)>
P2_TESTNET_ROUTER=<Arc Testnet guarded router address>
P2_TESTNET_ROUTER_CODE_HASH=<keccak256(runtime bytecode)>
P2_WRITES_ENABLED=true
```

The router source in `contracts/GuardedVaultRouter.sol` is an **unaudited testnet fixture**. Do not deploy it to mainnet. The bytecode hash must be taken from each deployed address; constructor immutables change the router runtime hash. The adapter rejects EIP-1967 proxies and does not support arbitrary proxy schemes or Morpho Vault V2 `maxWithdraw`, which intentionally returns zero. A separate Morpho SDK integration and review are required for those vaults. The local `.dev.vars` is ignored by Git. It is used only for this computer's testnet UI; the public site receives no P2 bindings.

## Tests run locally

- `npm run build`, `npm run lint`, `npm test` — pass. P2 unit cases cover integer precision, exact expiry, wrong wallet/chain, receipt status, and the default kill switch.
- `node scripts/smoke-p1.mjs` — pass after local migration, including session isolation, replay rejection, export, and deletion.
- `node scripts/smoke-p2.mjs` — pass with no adapter configured: unauthenticated access rejected, invalid amounts rejected, writes stay closed, and no action record is created.
- Desktop 1440px and mobile 390px browser checks — no JavaScript errors or horizontal overflow.
- One local EVM integration run at chain ID 5042002, using disposable Ganache accounts and Solidity mocks: guarded deposit confirmed, exact allowance consumed, inflated minimum-share requirement reverted atomically, and a withdrawal confirmed with expected balances.
- Arc Testnet API and transaction run with a disposable faucet wallet: [exact approval of 1 USDC](https://explorer.testnet.arc.io/tx/0x2a0063efa8e1ea4b5ae061145220428ce4233eae09dc0e718006d9e5cee4152b), [deposit of 1 USDC](https://explorer.testnet.arc.io/tx/0x2aeeb224aa99f8f179d383e7bc3832dac8945a491b869db007b3cc58d147bef6), and [withdrawal of 0.4 USDC](https://explorer.testnet.arc.io/tx/0x9d0da416105a739768a61ed25a40dff80f6aad855738a80313f057cecb415bd9). Each action passed SIWE, mandate, preflight, prompt, transaction matching, and receipt confirmation. Remaining shares were 0.6 and router allowance was zero. Native/testnet USDC was obtained from Circle's faucet; no mainnet funds were used.
- Negative API tests passed for guest and origin rejection, malformed amount, mandate limit, kill switch, bytecode mismatch, gas reserve, expired quote, mismatched transaction hash, wallet rejection, and wallet isolation. Unit/API tests also cover provider timeout, receipt revert/success, dropped status, nonce advance, and replacement hash matching. `npm run build`, `npm run lint`, `npm test` (17 cases), `node scripts/smoke-p1.mjs`, and `npm audit` passed after deployment; `solc` was removed from regular dev dependencies to avoid its transitive audit findings.
- Local desktop and mobile browser checks passed. At 390px, the page's document scroll width equals the viewport width (390px).
- The first withdrawal preparation immediately after deposit saw an older Arc RPC block. The adapter now retries a zero-share read and gives a clear catch-up message if the RPC is still behind.

Wrangler's `d1 migrations apply --local` failed on this Windows host with `spawn UNKNOWN`. For local verification, migration 0003 was applied to the existing local D1 SQLite state using Node's SQLite API. Deployment must still use the normal D1 migration procedure in its target environment.

## Remaining gate before marking P2 complete

1. Have the project owner review the actual wallet UI on desktop and mobile, including the no-yield fixture disclosure, approval, wallet prompt, expired quote, wrong chain, and receipts.
2. If a public testnet release is planned, repeat wallet prompt rejection and replacement with a real extension wallet. Provider timeout, replacement matching, and dropped behavior have been tested through a controlled API harness; they were not forced on the funded Arc Testnet wallet.
3. Keep mainnet actions disabled until a Morpho SDK adapter with onchain share-price protection, a peer/security review, kill switch, runbook, real gas costs, and separate testnet evidence are complete.

Local development note: Windows Application Control blocked the newly installed `workerd.exe` after dependency updates. The local preview is temporarily running Vite without the Cloudflare plugin plus a Node/Hono API bridge against the same local SQLite D1 state. This workaround is ignored by Git and does not alter the Cloudflare production configuration. A regular Cloudflare Worker dev run needs an allowed `workerd.exe` on this machine.

References: [Arc network configuration](https://docs.arc.io/arc/references/connect-to-arc), [Morpho Vault V2 asset flow](https://docs.morpho.org/developers/earn/tutorials/assets-flow/), [Morpho Vault V2 source and max functions](https://github.com/morpho-org/vault-v2/blob/main/src/VaultV2.sol).
