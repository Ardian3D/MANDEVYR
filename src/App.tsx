import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Menu,
  Plus,
  X,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Brand } from "./components/Brand";
import { FlowField } from "./components/FlowField";
import { HoverGrid } from "./components/HoverGrid";
import { SignalVisual } from "./components/SignalVisual";
import { PreflightDemo } from "./components/PreflightDemo";
import { Link } from "react-router-dom";
gsap.registerPlugin(ScrollTrigger);
type Document = "vision" | "roadmap" | "privacy";
const copyrightYear = new Date().getFullYear();
const documentContent = {
  vision: {
    title: "Intelligence should answer to you.",
    paragraphs: [
      "Onchain finance is opening up to people and agents alike. But an opportunity is only useful when you can understand its terms, its evidence, and its place inside your own boundaries.",
      "MANDEVYR is being built as a decision workspace for Arc. A mandate captures your limits. A preflight checks a proposed move. An evidence trail makes the reasoning visible. You decide what happens next.",
      "The workspace now includes Arc vault research, wallet-signed mandates and preflights, alerts, and wallet-approved Morpho actions. The landing preflight remains an illustrative demo. Agent spending reviews and MDVYR holder access are available in the app; the paid x402 endpoint remains behind a production switch pending a payment test.",
    ],
  },
  roadmap: {
    title: "Build the usefulness first.",
    paragraphs: [
      "01 / Foundation — Arc vault registry, contract evidence, optional wallet view, and watchlist are live.",
      "02 / Intelligence & Actions — Saved mandates, preflights, Watchtower, history, and wallet-confirmed Morpho actions are in the app. A funded Galaxy USDC deposit and withdrawal succeeded on Arc; other vaults still need funded testing.",
      "03 / Agent API — Spending policy reviews and a guarded x402 report endpoint are built. Paid settlement remains disabled until its production payment test passes.",
      "04 / Token utility — MDVYR is live on Arc through Argus. The app checks its onchain balance for a larger daily deep-dive allowance; see the Utility page for the verified contract and exact terms.",
    ],
  },
  privacy: {
    title: "Explore without handing over your data.",
    paragraphs: [
      "The landing preflight is an illustrative browser-only demo. In the app, wallet connection is optional. Saved mandates, reports, alerts, and token utility require a wallet sign-in message; Morpho actions require separate wallet transaction confirmations.",
      "Selected wallet preference and the local watchlist are stored in your browser. Signed-in account data and audit records are stored in Cloudflare D1. MANDEVYR does not ask for or store your private key. Hosting providers may retain normal access logs.",
      "Arc, Morpho, and Argus are independent services. MANDEVYR does not claim their endorsement. Review each wallet prompt and the current terms of external services.",
    ],
  },
};

const faqs = [
  [
    "What is MANDEVYR?",
    "MANDEVYR is an agentic finance workspace being built for Arc. It brings your spending rules, onchain evidence, and preflight checks into one place, so you can understand a proposed action before approving it.",
  ],
  [
    "Can I use the product right now?",
    "Yes. Launch App opens Arc vault research, saved mandates and reports, Watchtower, wallet-approved Morpho actions, and the MDVYR Utility page. The preflight on this landing page remains illustrative. A small real-fund Galaxy USDC approval, deposit, and withdrawal succeeded on Arc Mainnet; the other vaults still need funded testing.",
  ],
  [
    "Will an agent have control of my funds?",
    "No. You keep your keys and approve each transaction in your wallet. The Agent API currently reviews proposed spending against your allowlist and caps; it does not execute payments. Automatic delegation would need a separate security review.",
  ],
  [
    "How do yield, tokenized assets, and x402 fit together?",
    "They are different kinds of financial actions that benefit from the same checks: know the source, understand the terms, stay within a budget, and review before proceeding. Tokenized assets also require issuer and eligibility checks.",
  ],
  [
    "Is the MANDEVYR token available?",
    "Yes. MDVYR is on Arc Mainnet at 0xeD2CBF69b36A0E26De6d121be086f31EDAf3b424. The app verifies token identity and holder balance onchain. A balance of at least 1 MDVYR raises the daily saved-report deep-dive allowance from one to five. See Utility for details and the Argus link.",
  ],
];

const worlds = [
  {
    name: "Yield intelligence",
    short: "Yield",
    title: "Find the signal.",
    accent: "Know the exposure.",
    copy: "Explore yield with the evidence in view. Compare source quality, understand the conditions, and check every opportunity against your own limits.",
    tags: ["Source freshness", "Risk context", "Personal mandates"],
  },
  {
    name: "Agent payments",
    short: "x402 payments",
    title: "Let agents work.",
    accent: "Keep the controls.",
    copy: "A budget for every agent. A reason for every payment. Shape how your agents access paid data and services through x402, with explicit spending boundaries.",
    tags: ["Per-request budgets", "Payment preflight", "Explicit permissions"],
  },
  {
    name: "Tokenized assets",
    short: "Tokenized assets",
    title: "Real-world assets.",
    accent: "A clearer picture.",
    copy: "Look beyond a stock or fund token. Bring issuer details, access requirements, and redemption terms into the same decision before committing capital.",
    tags: ["Issuer evidence", "Eligibility checks", "Redemption terms"],
  },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState(0);
  const [section, setSection] = useState("Intro");
  const [activeDocument, setActiveDocument] = useState<Document>("vision");
  const dialog = useRef<HTMLDialogElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const story = useRef<HTMLElement>(null);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const media = gsap.matchMedia();
    const ctx = gsap.context(() => {
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".hero-enter", {
          y: 40,
          opacity: 0,
          duration: 1.15,
          stagger: 0.12,
          ease: "power3.out",
        });
        gsap.to(".hero-copy", {
          y: -75,
          opacity: 0.15,
          ease: "none",
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom 20%",
            scrub: 1,
          },
        });
        gsap.to(".hero-sculpture", {
          y: 90,
          scale: 1.13,
          ease: "none",
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: 1.2,
          },
        });
        gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) =>
          gsap.from(el, {
            y: 42,
            opacity: 0,
            duration: 0.85,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 91%", once: true },
          }),
        );
      });
      ScrollTrigger.create({
        trigger: story.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          if (
            window.innerWidth > 900 &&
            window.innerHeight > 720 &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            setMode(Math.min(2, Math.floor(self.progress * 3)));
        },
      });
      document.querySelectorAll<HTMLElement>("[data-chapter]").forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: "top 50%",
          end: "bottom 50%",
          onToggle: (self) => {
            if (self.isActive) setSection(el.dataset.chapter || "Intro");
          },
        });
      });
    }, root);
    return () => {
      media.revert();
      ctx.revert();
    };
  }, []);

  function openDocument(value: Document) {
    setActiveDocument(value);
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
  }
  function chooseWorld(index: number) {
    setMode(index);
    if (
      window.innerWidth > 900 &&
      window.innerHeight > 720 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      story.current
    ) {
      const top = story.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top:
          top +
          (story.current.offsetHeight - window.innerHeight) *
            ((index + 0.35) / 3),
        behavior: "smooth",
      });
    }
  }
  const world = worlds[mode];
  return (
    <div ref={root} className="site">
      <a className="skip-link" href="#experience">
        Skip to interactive preview
      </a>
      <header className="header">
        <a href="#" aria-label="MANDEVYR home">
          <Brand />
        </a>
        <nav
          className={menuOpen ? "nav-links open" : "nav-links"}
          aria-label="Main navigation"
          id="main-navigation"
        >
          <a href="#worlds" onClick={() => setMenuOpen(false)}>
            The vision
          </a>
          <a href="#experience" onClick={() => setMenuOpen(false)}>
            Experience
          </a>
          <Link
            className="nav-docs"
            to="/docs"
            onClick={() => setMenuOpen(false)}
          >
            Docs
          </Link>
          <a href="#token" onClick={() => setMenuOpen(false)}>
            Token
          </a>
        </nav>
        <Link className="nav-cta" to="/app">
          Launch App <ArrowUpRight size={15} />
        </Link>
        <button
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <main>
        <section className="hero" data-chapter="Intro">
          <div className="hero-sculpture">
            <FlowField motion />
          </div>
          <div className="hero-copy">
            <div className="hero-enter hero-status">
              <span className="status-dot" /> Early preview
            </div>
            <h1 className="hero-enter">
              Your capital.
              <br />
              <em>Your command.</em>
            </h1>
            <p className="hero-enter hero-description">
              A new perspective on yield, real-world assets, and agent payments.
              <br className="desktop-break" /> Connected by intelligence. Guided
              by you.
            </p>
            <div className="hero-enter hero-actions">
              <Link className="button button-mint" to="/app">
                Launch App <ArrowUpRight size={17} />
              </Link>
              <a className="button button-outline" href="#worlds">
                Explore the vision <ArrowDown size={15} />
              </a>
            </div>
            <a
              href="https://www.arc.io/"
              target="_blank"
              rel="noreferrer"
              className="hero-enter arc-signature"
            >
              <span>Built for Arc</span>
              <img
                src="/brand/arc-ondark.svg"
                alt="Arc"
                width="69"
                height="30"
              />
            </a>
          </div>
        </section>

        <div className="capabilities-strip" aria-label="Product focus">
          <div>
            <span>Yield intelligence</span>
            <span>Agent payments</span>
            <span>Tokenized assets</span>
            <span>Your mandate</span>
          </div>
        </div>

        <section
          id="worlds"
          ref={story}
          className="worlds"
          data-chapter="Possibilities"
        >
          <div className="worlds-sticky">
            <div className="world-layout">
              <div className="world-copy">
                <div key={mode} className="world-text">
                  <h2>
                    {world.title}
                    <br />
                    <em>{world.accent}</em>
                  </h2>
                  <p>{world.copy}</p>
                  <ul className="world-tags">
                    {world.tags.map((tag) => (
                      <li key={tag}>
                        <Check size={12} />
                        {tag}
                      </li>
                    ))}
                  </ul>
                </div>
                <a className="text-link" href="#experience">
                  Put your rules to the test <ArrowUpRight size={17} />
                </a>
              </div>
              <SignalVisual mode={mode} />
            </div>
            <div
              className="world-tabs"
              role="group"
              aria-label="Explore financial use cases"
            >
              {worlds.map((item, index) => (
                <button
                  key={item.name}
                  className={mode === index ? "active" : ""}
                  aria-pressed={mode === index}
                  onClick={() => chooseWorld(index)}
                >
                  {item.short}
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
            <p className="world-note">
              Product vision · Integrations are in development.
            </p>
          </div>
        </section>

        <section className="manifesto" data-chapter="Your rules">
          <div className="manifesto-orbit" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <h2 className="reveal">
            Agents move fast.
            <br />
            <span>You set the</span> <em>limits.</em>
          </h2>
          <div className="principles reveal">
            <div>
              <span>Define</span>
              <p>
                Your budget.
                <br />
                Your boundaries.
              </p>
            </div>
            <ArrowRight />
            <div>
              <span>Verify</span>
              <p>
                Visible evidence.
                <br />
                Clear reasoning.
              </p>
            </div>
            <ArrowRight />
            <div>
              <span>Decide</span>
              <p>
                Your wallet.
                <br />
                Your final say.
              </p>
            </div>
          </div>
        </section>

        <section
          id="experience"
          className="experience section-shell"
          data-chapter="Experience"
        >
          <div className="experience-heading reveal">
            <h2>
              Make a move.
              <br />
              <em>See what matters.</em>
            </h2>
            <p>
              Set a budget. Change the evidence.
              <br />
              Watch your mandate respond.
              <br />
              <span>No wallet needed. Just curiosity.</span>
            </p>
          </div>
          <div className="reveal">
            <PreflightDemo />
          </div>
        </section>

        <section
          id="token"
          className="token-section section-shell"
          data-chapter="The token"
        >
          <div className="token-sculpture" aria-hidden="true">
            <div className="token-orbit orbit-a" />
            <div className="token-orbit orbit-b" />
            <div className="token-orbit orbit-c" />
            <div className="token-medallion">
              <img src="/logo-remove-bg.png" alt="" width="160" height="160" />
            </div>
          </div>
          <div className="token-copy reveal">
            <h2>
              Utility you can
              <br />
              <em>verify onchain.</em>
            </h2>
            <p>
              MDVYR is live on Arc. The first product benefit expands your daily
              saved-report deep-dive allowance when your wallet holds the token.
            </p>
            <div className="utility-list">
              <span>
                <strong>Deep-dive allowance · live</strong>
                <ArrowUpRight size={16} />
              </span>
              <span>
                <strong>Expanded monitoring · proposed</strong>
                <ArrowUpRight size={16} />
              </span>
              <span>
                <strong>API credits · proposed</strong>
                <ArrowUpRight size={16} />
              </span>
            </div>
            <div className="token-meta">
              <span className="outline-badge">MDVYR · ARC MAINNET</span>
              <a href="/app/utility">See the utility <ArrowUpRight size={14} /></a>
            </div>
            <p className="fine-print">
              Verify the contract and current market terms on{" "}
              <a href="https://argus.world/token/0xeD2CBF69b36A0E26De6d121be086f31EDAf3b424" target="_blank" rel="noreferrer">
                Argus
              </a>
              . Expanded monitoring and API credits are not active benefits.
            </p>
          </div>
        </section>

        <section className="faq-section section-shell">
          <div className="faq-heading reveal">
            <h2>
              Good
              <br />
              <em>questions.</em>
            </h2>
          </div>
          <div className="faq-list reveal">
            {faqs.map(([question, answer]) => (
              <details className="faq-item" key={question}>
                <summary>
                  {question}
                  <Plus size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="closing" data-chapter="Explore">
          <HoverGrid />
          <h2 className="reveal">
            Stay curious.
            <br />
            <em>Stay in command.</em>
          </h2>
          <Link className="button button-mint reveal" to="/app">
            Launch App<ArrowUpRight size={17} />
          </Link>
          <div className="closing-line" aria-hidden="true" />
        </section>
      </main>
      <footer className="footer section-shell">
        <div className="footer-top">
          <a href="#" aria-label="Back to top">
            <Brand />
          </a>
          <span>Intelligence in motion. Control in your hands.</span>
          <a href="#">
            BACK TO TOP <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {copyrightYear} MANDEVYR</span>
          <div className="footer-bottom-actions">
            <nav className="footer-links" aria-label="Project information">
              <button onClick={() => openDocument("vision")}>Our thesis</button>
              <button onClick={() => openDocument("roadmap")}>Roadmap</button>
              <button onClick={() => openDocument("privacy")}>Privacy</button>
              <Link to="/docs">
                Documentation <ArrowUpRight size={13} />
              </Link>
            </nav>
            <nav className="footer-socials" aria-label="MANDEVYR social channels">
              <a
                href="https://x.com/mandevyrfi"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MANDEVYR on X (opens in a new tab)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
                </svg>
                <span>X</span>
              </a>
              <a
                href="https://t.me/mandevyrfi"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MANDEVYR on Telegram (opens in a new tab)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                <span>Telegram</span>
              </a>
            </nav>
          </div>
        </div>
      </footer>
      <nav className="chapter-nav" aria-label="Page chapters">
        {[
          ["Intro", "#"],
          ["Possibilities", "#worlds"],
          ["Experience", "#experience"],
          ["The token", "#token"],
        ].map(([name, href]) => (
          <a
            key={name}
            href={href}
            aria-label={name}
            className={section === name ? "active" : ""}
          />
        ))}
      </nav>
      <dialog
        ref={dialog}
        aria-labelledby="document-title"
        className="document-dialog"
        onClose={() => {
          document.body.style.overflow = "";
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="document-copy">
          <button
            className="dialog-close"
            aria-label="Close document"
            onClick={() => dialog.current?.close()}
            autoFocus
          >
            <X size={20} />
          </button>
          <h2 id="document-title">{documentContent[activeDocument].title}</h2>
          {activeDocument === "roadmap" ? (
            <ol className="modal-roadmap">
              {documentContent.roadmap.paragraphs.map((p, index) => (
                <li key={p}>
                  <span className="phase-index">0{index + 1}</span>
                  <div>
                    <span className="phase-status">
                      {
                        ["LIVE", "LIVE · GALAXY ROUND TRIP VERIFIED", "IN REVIEW", "LIVE · DISCLOSURES IN PROGRESS"][
                          index
                        ]
                      }
                    </span>
                    <h3>
                      {
                        [
                          "Foundation",
                          "Intelligence & Actions",
                          "Agent API",
                          "Token utility",
                        ][index]
                      }
                    </h3>
                    <p>{p.split(" — ")[1]}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            documentContent[activeDocument].paragraphs.map((p, index) => (
              <section className="modal-section" key={p}>
                <h3>
                  {
                    (activeDocument === "privacy"
                      ? [
                          "Your preview stays local",
                          "Website data & hosting",
                          "External services & future updates",
                        ]
                      : [
                          "The opportunity",
                          "The MANDEVYR approach",
                          "Where we begin",
                        ])[index]
                  }
                </h3>
                <p>{p}</p>
              </section>
            ))
          )}
          <div className="modal-bottom">
            <span>
              {activeDocument === "privacy"
                ? "APPLIES TO THIS WEBSITE · 30 SEP 2026"
                : "PRODUCT DIRECTION · EARLY PREVIEW"}
            </span>
            <Link
              to={
                activeDocument === "roadmap"
                  ? "/docs#token-roadmap"
                  : activeDocument === "privacy"
                    ? "/docs#trust-boundaries"
                    : "/docs#introduction"
              }
            >
              Read the docs <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </dialog>
    </div>
  );
}
export default App;
