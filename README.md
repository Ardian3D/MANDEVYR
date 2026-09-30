# MANDEVYR

An English-language landing experience for MANDEVYR, built with **Vite, React, TypeScript, and Tailwind CSS**. The product specification remains in [PRD.md](./PRD.md).

## Run locally

Node.js 22.12+ and npm are required.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

```bash
npm run build      # TypeScript validation and production build
npm run lint       # Oxlint
npm run typecheck  # TypeScript only
npm run preview    # Serve the production build locally
```

## Landing page

- Immersive centered hero with an original generative contour sculpture and pointer response.
- GSAP scroll transitions through yield, x402 payments, and tokenized assets. Compact screens use manual scene selectors.
- In-page documentation experience with an introduction, product model, mandates, preflight checks, use cases, trust boundaries, roadmap, glossary, and primary references.
- Interactive preflight demonstration: amount limits, source freshness, and an issuer-review state.
- Product workflow, planned token utility, expandable FAQ, and native vision/roadmap/privacy dialogs.
- Responsive navigation, keyboard support, and system reduced-motion support.
- Footer links open centered thesis, roadmap, and privacy dialogs. Documentation has its own `/docs` route, with shareable chapter links. The manual Motion button has been removed.
- Launch App opens `/app`, a Coming Soon page with working links to the preview and documentation.
- A short branded launch animation introduces `/app`: animated columns, the MANDEVYR logo, and a screen reveal. System reduced-motion settings use a brief fade instead.
- Official Arc dark-background logo, served locally with the supplied MANDEVYR logo, fonts, and icons. No analytics or signup services are required.

The preflight is a **local concept demonstration**, not a live financial integration. It uses illustrative targets and does not connect a wallet, take payments, or submit transactions. The token is explicitly marked as planned and not launched.

## Files

```text
src/App.tsx                       Landing sections, navigation, dialogs
src/components/Brand.tsx           Supplied logo and wordmark
src/components/FlowField.tsx       Animated canvas contour sculpture
src/components/SignalVisual.tsx    Three finance illustrations and scene transitions
src/components/DocsPage.tsx        Documentation route and chapter navigation
src/components/ComingSoon.tsx      Application Coming Soon route
src/components/LaunchExperience.tsx Branded transition into the application route
src/components/launch-experience.css Launch animation presentation
src/routes.css                    Public-route and centered-dialog styles
src/components/PreflightDemo.tsx   Local, interactive preflight example
src/components/preflight.css       Product preview styles
src/index.css                     Design system, layout, responsive styles
public/logo.png                   Original supplied logo
public/logo-remove-bg.png         Supplied transparent logo
public/brand/arc-ondark.svg        Unmodified official Arc logo
docs/landing-page.md               Design decisions and verification notes
```

Future image assets can be placed in `public/images/` and referenced as `/images/filename.webp`. The original supplied logos are preserved.

## Public routes

- `/`: landing page and local preflight demo.
- `/docs`: introduction, preview guide, product model, mandates, preflight, use cases, trust boundaries, token roadmap, and glossary.
- `/docs#preflight`: example of a shareable documentation chapter.
- `/app`: Coming Soon. The live financial workspace is not implemented.

React Router handles browser navigation. Production hosting must serve `index.html` for application URLs so that direct visits and reloads work. `public/_redirects` includes the SPA fallback for hosts supporting that format, including Cloudflare Pages and Netlify. Other hosts need an equivalent history fallback. No public deployment has been performed.
