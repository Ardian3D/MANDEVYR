# Landing page implementation

Date: 30 September 2026.

## Design direction

The revised design uses Obol as the primary reference: a floating pill navigation, centered oversized typography, an immersive contour background, and financial illustrations that change as the reader scrolls. MANDEVYR keeps its own copy, monogram, generative artwork, and product story. The palette combines near-black, warm white, sage, and mint. All visitor-facing text is English.

The following sites were inspected as visual references, including browser screenshots:

- [Canopy](https://canopyfinance.io/): prominent brand world and an atmospheric first screen.
- [Cashed](https://www.cashed.money/): dark product framing and layered interface objects.
- [TAOLaunch](https://taolaunch.online/): direct hierarchy and a strong hero composition.
- [Obol](https://www.obol.fi/): expressive headline typography, restrained motion, and an embedded product explanation.

No reference-site artwork or financial statistics were copied. The user-supplied MANDEVYR logos are preserved. Fonts are served locally through Fontsource and icons through Lucide.

## Motion and responsive behavior

- `FlowField.tsx` draws an original contour sculpture using Canvas 2D. Its shape moves gently and responds to pointer position. Pixel density is capped at 1.5 and rendering is capped near 30 FPS; drawing pauses when the hero is offscreen or the tab is hidden.
- GSAP ScrollTrigger connects hero depth and opacity to scroll position and introduces section content. The finance story stays in view through three scenes on screens wider than 900px and taller than 720px. Its selectors also navigate to each scene.
- Compact or short viewports use a normal document flow and explicit scene selectors. System reduced-motion preferences disable decorative animation and the extended sticky sequence. The manual Motion control is removed.
- Navigation, scene selectors, preflight inputs, FAQ, and native document dialogs are keyboard-operable. The local demonstration retains its PASS, BLOCK, UNKNOWN, and REVIEW states.
- Docs opens `/docs`, a standalone public documentation route. Chapter links use shareable URL fragments, support browser history, and restore on reload. Thesis, roadmap, and privacy remain centered, scrollable native dialogs with focus containment, Escape dismissal, and background scroll locking.
- Launch App opens `/app`, a Coming Soon page using the original contour artwork. It links to the existing preview and Docs. No dashboard or additional financial-product pages are introduced.
- Both Launch App links use the same client-side route. `LaunchExperience.tsx` introduces `/app` with a finite 2.08-second brand transition: sage columns expand from the center, the supplied logo and wordmark appear, the columns collapse, and an upward wipe reveals Coming Soon. It also runs on a direct visit to `/app`.
- The transition is decorative and does not represent network, wallet, or financial checks. The destination is inert while the overlay is present; focus moves to its heading when the transition completes. Navigation away cancels the timeline and releases the scroll lock. Reduced-motion mode uses a 160ms fade, and changing that preference mid-transition ends the animation.

## Documentation structure

The docs follow the familiar Web3 progression from overview to concepts, practical guides, and references. Uniswap's official documentation was consulted for information structure: [documentation](https://developers.uniswap.org/docs), [concept explanation](https://developers.uniswap.org/docs/get-started/concepts/how-uniswap-works), and [glossary](https://developers.uniswap.org/docs/get-started/concepts/glossary). MANDEVYR's text is original and based on PRD.md and the actual local demo.

The reader contains nine chapters: introduction, a hands-on preview guide, product model, mandates, preflight outcomes, three financial use cases, trust boundaries, planned token/roadmap, and glossary/references. Current capabilities and proposed integrations are identified separately; no API keys, live endpoints, or token contracts are invented.

The preview guide documents deterministic rule order and examples for PASS, BLOCK, UNKNOWN, and REVIEW. Docs and Coming Soon share the landing's English content, local assets, and dark/sage design.

## Official Arc asset

`public/brand/arc-ondark.svg` is an unmodified official asset retrieved from the Arc website on 30 September 2026:

- Guidelines: https://www.arc.io/brand-guidelines-and-partner-toolkit
- Brand kit entry point: https://www.circle.com/pressroom#brandkit
- Source file: https://cdn.prod.website-files.com/685311a976e7c248b5dfde95/688f6e47eca8d8e359537b5f_logo-ondark.svg

The logo is used with “Being built for Arc Network,” reflecting the project's development status. MANDEVYR remains the primary brand. The footer includes trademark attribution and identifies the project as independent.

## Functional boundaries

The landing page is not a deployed backend. The demo uses local examples and visibly identifies them as illustrative. It supports:

- PASS when an example is within its amount limit and source data is fresh.
- BLOCK when an example exceeds its amount limit.
- UNKNOWN when source data is stale and the amount is otherwise within limits.
- REVIEW for tokenized-asset examples that still need issuer and eligibility checks.

Changing an input cancels an in-progress example and clears the previous verdict. Token utility and launch details are marked as proposed. There are no inactive “buy token” or wallet-connection buttons.

## Verification

Browser checks cover the verdict states, evidence disclosure, navigation, FAQ, native dialogs, and mobile layout. Build/typecheck and lint are required after code changes. A manual screenshot review covers desktop and mobile presentation. The application has not been deployed publicly as part of this change.

## Next content decisions

Before adding public social links, provide the official project handles. Before enabling signup, select and implement a real data destination and update the privacy notice. Before live financial integrations, follow the adapter, authentication, and security gates in PRD.md.
