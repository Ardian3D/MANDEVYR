# MANDEVYR

MANDEVYR is an English-language Arc decision workspace. The public landing page explains the product; P0 adds a read-only vault registry and wallet view. The detailed product plan is in [PRD.md](./PRD.md).

## Run locally

Node.js 22.12+ and npm are required.

```bash
npm ci
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`. The Cloudflare Vite plugin runs the Hono API locally under `/api/*`, so opening the built HTML file or using a static-only server will not load Arc data.

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run preview
```

## P0 workspace

- `/app`: read-only overview with live Arc Mainnet observations.
- `/app/explore`: curated Morpho vault list, search and filters.
- `/app/opportunities/:id`: contract address, base asset, block and fetch time, provider source, and risk flags.
- `/app/watchlist`: browser-local saved entries.
- Optional injected EVM wallet connection for one native Arc USDC balance and vault-share value. The wallet chooser discovers installed extensions through EIP-6963, with a legacy `window.ethereum` fallback. Clicking Connect Wallet opens the chooser; a wallet prompt is sent only after a user selects an extension. The app never requests a signature or submits a transaction.

The Worker uses a fixed reviewed address list in `src/p0/registry.ts` and reads Arc RPC. Each refresh checks contract code, `asset()`, the asset symbol and decimals, and `totalAssets()` at one block. A failed or stale check is shown explicitly. The app does not present an APY until its source, calculation method, fee treatment, and time window are verified.

Arc's native USDC gas balance is read once via `getBalance` with 18 decimals. The ERC-20 USDC underlying the vaults has 6 decimals and is used only for vault asset amounts; the two representations are never added as separate wallet balances.

Morpho Vault V2 intentionally returns zero for its default `maxWithdraw()`, so P0 marks instant withdrawal capacity **unknown**. Share-to-asset conversion is indicative and does not prove exit liquidity. The app links to the provider and explorer for current terms.

## API

- `GET /api/health` — observed service status.
- `GET /api/registry` — current vault snapshots.
- `GET /api/registry/:id` — one snapshot.
- `GET /api/wallet/:address` — read-only native balance and vault positions for a public address.

The P0 wallet route accepts a public address and forwards read requests to Arc RPC. P1 private routes use a separate SIWE session and D1 storage when configured. Public deployment should be reviewed for operational limits and abuse controls before launch.

The selected wallet preference is stored in this browser. On another app tab, the workspace uses `eth_accounts` to restore an already approved connection without opening the wallet prompt. Disconnect clears MANDEVYR's local selection; it does not revoke the extension's site permission.

## P1 local preview

P1 is available in Vite development at `/app/mandate`, `/app/preflight/new`, `/app/history`, and `/app/watch`. It adds wallet sign-in via SIWE, versioned mandates, immutable research preflights, private report history, a synced watchlist, and an in-app Watchtower inbox. The Worker checks watched vaults every 15 minutes and alerts only when source availability changes. It does not monitor APY, prove withdrawal liquidity, or make transactions.

P2 is implemented locally at `/app/actions` for the three curated Arc Mainnet Morpho Vault V2 vaults: Galaxy USDC, Gauntlet USDC Prime, and Gauntlet EURC Prime. Wallet actions require the separate `P2_MAINNET_WRITES_ENABLED=true` runtime switch, an active mandate, and explicit wallet confirmation. EURC deposits also require separate EURC action and daily caps saved in a new mandate. The public site remains P0; P2 has not been pushed or deployed, and funded mainnet approval/deposit/withdraw transactions have not been verified. See [P2_IMPLEMENTATION.md](./P2_IMPLEMENTATION.md).

Apply all D1 migrations through `0004_p2_wallet_revision.sql` for the latest prompt concurrency checks. The Actions UI includes live contract evidence and responsive vault selection. Run `node --experimental-strip-types scripts/verify-p2-mainnet.mjs` for read-only identity, SDK route, and approval-call checks; the latest result is in [docs/p2-mainnet-verification.json](./docs/p2-mainnet-verification.json). This check never signs or broadcasts a transaction.

The local Cloudflare D1 database is configured with a placeholder ID that is valid only for local development. Apply its migration before using P1:

```bash
npx wrangler d1 migrations apply mandevyr-p1 --local
npm run dev
node scripts/smoke-p1.mjs
```

The smoke script creates random test wallets and checks nonce replay, origin checking, wallet-scoped reports, idempotency, mandates, the watchlist, scoped data export, and account deletion. Use `npx wrangler dev --test-scheduled` to invoke the cron handler locally; cron is not active merely because Vite is open.

Production builds hide P1 routes unless `VITE_P1_ENABLED=true` is set at build time. Before enabling it, create a real Cloudflare D1 database, replace the placeholder ID in `wrangler.jsonc`, apply migrations remotely, deploy the Worker with its scheduled trigger, and verify the full SIWE and cron flow. The current Vercel functions have no D1 binding, so they support P0 only. Do not present P1 as a public feature on Vercel until a production database adapter is configured and tested. P1 remains read-only research; its preflight verdict is never action permission.

## Landing and documentation

The landing preflight is a local concept demonstration with illustrative values. It is separate from the live read-only workspace and cannot perform a payment or trade. `/docs` covers the product model, live registry methodology, current trust boundaries, and roadmap.

The supplied MANDEVYR logos remain in `public/`; the official Arc dark-background logo is in `public/brand/`. No token has launched, and token utility remains a later phase.

## Search and Vercel deployment

The canonical public URL is `https://www.mandevyr.my.id/`. `vercel.json` sets Vercel's output directory to `dist/client` and makes direct visits to `/docs` and `/app/*` load their React routes. `npm run build` also generates route-specific HTML for `/docs` and `/app`, including metadata and crawlable text for the docs. The app route is excluded from search results while it depends on live wallet and RPC state. `public/robots.txt` and `public/sitemap.xml` announce the landing page and docs. The social preview image is `public/og-mandevyr.png`.

After deployment, check that `/`, `/docs`, `/app`, `/robots.txt`, `/sitemap.xml`, and `/og-mandevyr.png` return HTTP 200 and that `/docs` has its own title and canonical URL. The `api/` Vercel functions use a P0-only bundle of the Hono registry because Vercel functions do not receive the separate Worker source file at runtime. Rebuild that bundle when the P0 registry changes. Verify that `/api/health` returns JSON with `status: "ok"` before presenting the Arc workspace as live. If the deployed API reports `degraded`, investigate the Arc RPC or vault checks before advertising live data.

For Google discovery, add the **Domain property** `mandevyr.my.id` to [Google Search Console](https://search.google.com/search-console/), verify ownership with the DNS TXT record Google gives you, submit `https://www.mandevyr.my.id/sitemap.xml`, and use URL Inspection to request indexing of the home page and docs. Verification and requests require the domain owner's Google account. Google decides when and whether to index a page and how to display the title and snippet; these files do not guarantee immediate placement.

## Interactive brand assets

The workspace hero uses an actual Blender-authored GLB with pointer and keyboard rotation, reset, reduced-motion support, and a static WebGL fallback. Editable source and rebuild instructions are in `assets/3d/`. Vault identities use original Morpho CDN curator logos with USDC/EURC badges; provenance is recorded in `public/brand/vaults/SOURCES.md`.

## Stack

Vite, React, TypeScript, React Router, Tailwind CSS, Hono, Cloudflare Workers, viem, GSAP, Three.js, Vitest, and Oxlint. The Worker build and client assets are produced in `dist/`. GitHub Actions runs lint, typecheck, tests, and build on pushes and pull requests.
