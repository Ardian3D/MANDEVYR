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
    eyebrow: "THE MANDEVYR THESIS",
    title: "Intelligence should answer to you.",
    paragraphs: [
      "Onchain finance is opening up to people and agents alike. But an opportunity is only useful when you can understand its terms, its evidence, and its place inside your own boundaries.",
      "MANDEVYR is being built as a decision workspace for Arc. A mandate captures your limits. A preflight checks a proposed move. An evidence trail makes the reasoning visible. You decide what happens next.",
      "The first release focuses on curated, read-only intelligence and transparent preflight checks. Wallet-approved actions, x402 services, and token utility follow in stages. This site demonstrates the concept; live financial integrations are not available here yet.",
    ],
  },
  roadmap: {
    eyebrow: "A PRODUCT-LED ROADMAP",
    title: "Build the usefulness first.",
    paragraphs: [
      "01 / Foundation — Brand, landing experience, and an interactive preflight concept. This is the current stage.",
      "02 / Intelligence — Curated Arc data, personal mandates, evidence-backed reports, and useful alerts.",
      "03 / Actions & API — Wallet-approved actions and metered x402 services, after integration and security checks.",
      "04 / Token utility — A planned launch through Argus, with working benefits and transparent terms. Report credits, expanded monitoring, and API access are proposed utilities. No token contract, supply, launch date, or holder benefits have been finalized.",
    ],
  },
  privacy: {
    eyebrow: "THIS WEBSITE",
    title: "Explore without handing over your data.",
    paragraphs: [
      "The interactive preview runs in your browser using illustrative data. It does not connect a wallet, ask for an email address, collect a payment, or submit a transaction.",
      "This version has no analytics trackers or third-party font requests. Your preview settings reset when the page reloads. Standard hosting access logs may be processed by the hosting provider when this website is deployed.",
      "External links to Arc and Argus lead to independent websites with their own terms. A full product privacy notice will accompany any future accounts, alerts, or financial integrations.",
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
    "You can try the interactive preflight on this page. It uses illustrative data to show how spending limits and source freshness affect a decision. Live data, wallet connections, and transactions are part of the next development stages.",
  ],
  [
    "Will an agent have control of my funds?",
    "The planned first release is non-custodial. You keep your keys and approve each action with your wallet. Any future delegation will require explicit permissions, spending limits, and a separate security review.",
  ],
  [
    "How do yield, tokenized assets, and x402 fit together?",
    "They are different kinds of financial actions that benefit from the same checks: know the source, understand the terms, stay within a budget, and review before proceeding. Tokenized assets also require issuer and eligibility checks.",
  ],
  [
    "Is the MANDEVYR token available?",
    "No token has been launched. A future launch through Argus is planned after useful product features are available. The token address, supply, benefits, and launch terms will be published only when confirmed.",
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
    document.title = "MANDEVYR — Your capital. Your command.";
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
          <div className="hero-coordinate coordinate-left">
            MV / 001
            <br />
            <span>INTELLIGENCE IN MOTION</span>
          </div>
          <div className="hero-coordinate coordinate-right">
            YOUR RULES.
            <br />
            <span>EVERY SINGLE MOVE.</span>
          </div>
          <div className="hero-copy">
            <div className="hero-enter hero-status">
              <span className="status-dot" /> AGENTIC FINANCE, REFRAMED{" "}
              <span className="status-version">EARLY PREVIEW</span>
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
              <span>BEING BUILT FOR ARC NETWORK</span>
              <img
                src="/brand/arc-ondark.svg"
                alt="Arc"
                width="69"
                height="30"
              />
            </a>
          </div>
          <div className="hero-bottom">
            <span>
              <i /> HUMAN CONTROL. ONCHAIN POSSIBILITY.
            </span>
            <a href="#worlds">
              SCROLL TO DISCOVER <ArrowDown size={13} />
            </a>
            <span>01 — 05</span>
          </div>
        </section>

        <div className="capabilities-strip" aria-label="Product focus">
          <span>ONE WORKSPACE. MORE POSSIBILITY.</span>
          <div>
            <span>Yield intelligence</span>
            <i>✳</i>
            <span>Agent payments</span>
            <i>✳</i>
            <span>Tokenized assets</span>
            <i>✳</i>
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
            <div className="section-topline">
              <span className="eyebrow">01 / A CONNECTED FINANCIAL WORLD</span>
              <span className="mono">THREE PATHS. ONE PERSONAL MANDATE.</span>
            </div>
            <div className="world-layout">
              <div className="world-copy">
                <span className="world-number">
                  0{mode + 1}
                  <span>/ 03</span>
                </span>
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
                  <span>0{index + 1}</span>
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
          <span className="eyebrow reveal">AUTONOMY, WITH BOUNDARIES.</span>
          <h2 className="reveal">
            Agents move fast.
            <br />
            <span>You set the</span> <em>limits.</em>
          </h2>
          <div className="principles reveal">
            <div>
              <span>01 / DEFINE</span>
              <p>
                Your budget.
                <br />
                Your boundaries.
              </p>
            </div>
            <ArrowRight />
            <div>
              <span>02 / VERIFY</span>
              <p>
                Visible evidence.
                <br />
                Clear reasoning.
              </p>
            </div>
            <ArrowRight />
            <div>
              <span>03 / DECIDE</span>
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
          <div className="section-topline reveal">
            <span className="eyebrow">02 / FROM INTENT TO INSIGHT</span>
            <span className="mono">
              <i className="status-dot" /> INTERACTIVE CONCEPT
            </span>
          </div>
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
            <span className="token-coordinate">UTILITY AT THE CENTER.</span>
          </div>
          <div className="token-copy reveal">
            <span className="eyebrow">03 / THE MANDEVYR TOKEN</span>
            <h2>
              A part of
              <br />
              <em>what comes next.</em>
            </h2>
            <p>
              Designed around the things you actually use. Deeper intelligence.
              More monitoring. Access for your agents.
            </p>
            <div className="utility-list">
              <span>
                01 <strong>Report credits</strong>
                <ArrowUpRight size={16} />
              </span>
              <span>
                02 <strong>Expanded monitoring</strong>
                <ArrowUpRight size={16} />
              </span>
              <span>
                03 <strong>Metered API access</strong>
                <ArrowUpRight size={16} />
              </span>
            </div>
            <div className="token-meta">
              <span className="outline-badge">PLANNED · NOT LIVE</span>
              <button onClick={() => openDocument("roadmap")}>
                View the roadmap <ArrowUpRight size={14} />
              </button>
            </div>
            <p className="fine-print">
              Proposed utilities. Launch planned through{" "}
              <a href="https://argus.world" target="_blank" rel="noreferrer">
                Argus
              </a>
              . Terms, availability, and token details are not finalized.
            </p>
          </div>
        </section>

        <section className="faq-section section-shell">
          <div className="faq-heading reveal">
            <span className="eyebrow">04 / A LITTLE MORE CLARITY</span>
            <h2>
              Good
              <br />
              <em>questions.</em>
            </h2>
          </div>
          <div className="faq-list reveal">
            {faqs.map(([question, answer], index) => (
              <details className="faq-item" key={question}>
                <summary>
                  <span className="faq-number">0{index + 1}</span>
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
          <span className="eyebrow reveal">THE NEXT MOVE IS YOURS.</span>
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
        <span>{section}</span>
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
          <span className="eyebrow">
            {documentContent[activeDocument].eyebrow}
          </span>
          <h2 id="document-title">{documentContent[activeDocument].title}</h2>
          {activeDocument === "roadmap" ? (
            <ol className="modal-roadmap">
              {documentContent.roadmap.paragraphs.map((p, index) => (
                <li key={p}>
                  <span className="phase-index">0{index + 1}</span>
                  <div>
                    <span className="phase-status">
                      {
                        ["CURRENT STAGE", "PLANNED", "PLANNED", "PROPOSED"][
                          index
                        ]
                      }
                    </span>
                    <h3>
                      {
                        [
                          "Foundation",
                          "Intelligence",
                          "Actions & API",
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
