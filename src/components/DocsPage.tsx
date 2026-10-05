import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { Brand } from "./Brand";
import { Link, useLocation } from "react-router-dom";

const chapters = [
  { id: "introduction", label: "Introduction", group: "Start here" },
  { id: "quickstart", label: "Try the preview", group: "Start here" },
  { id: "live-arc", label: "Live Arc registry", group: "Start here" },
  { id: "product-model", label: "Product model", group: "Start here" },
  { id: "mandates", label: "Mandates", group: "The workspace" },
  { id: "preflight", label: "Preflight checks", group: "The workspace" },
  { id: "use-cases", label: "Use cases", group: "The workspace" },
  {
    id: "trust-boundaries",
    label: "Trust boundaries",
    group: "Design principles",
  },
  { id: "token-roadmap", label: "Token & roadmap", group: "Design principles" },
  { id: "glossary", label: "Glossary & references", group: "More" },
];

export function DocsPage() {
  const { hash } = useLocation();
  const content = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState("introduction");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!hash) {
      content.current?.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const id = hash.slice(1) || "introduction";
    const node = document.getElementById(`doc-${id}`);
    if (!node || !content.current) return;
    content.current.scrollTo({
      top:
        node.getBoundingClientRect().top -
        content.current.getBoundingClientRect().top +
        content.current.scrollTop,
      behavior: "instant",
    });
  }, [hash]);

  useEffect(() => {
    const container = content.current;
    if (!container) return;
    const update = () => {
      let current = chapters[0].id;
      for (const chapter of chapters) {
        const node = container.querySelector<HTMLElement>(`#doc-${chapter.id}`);
        if (
          node &&
          node.getBoundingClientRect().top <=
            container.getBoundingClientRect().top + 160
        )
          current = chapter.id;
      }
      setActive(current);
    };
    container.addEventListener("scroll", update, { passive: true });
    update();
    return () => container.removeEventListener("scroll", update);
  }, []);

  const groups = [...new Set(chapters.map((chapter) => chapter.group))];
  return (
    <div className="docs-page">
      <header className="docs-topbar">
        <Link to="/" className="docs-brand" aria-label="MANDEVYR home">
          <Brand />
        </Link>
        <span className="docs-top-label"><BookOpen size={15} /> Documentation</span>
        <Link className="docs-close" to="/">
          <ArrowLeft size={15} />
          <span>Back to home</span>
        </Link>
      </header>
      <div className="docs-frame">
        <aside className="docs-sidebar" aria-label="Documentation chapters">
          {groups.map((group) => (
            <div className="docs-nav-group" key={group}>
              <span>{group}</span>
              {chapters
                .filter((chapter) => chapter.group === group)
                .map((chapter) => (
                  <Link
                    key={chapter.id}
                    className={active === chapter.id ? "active" : ""}
                    aria-current={
                      active === chapter.id ? "location" : undefined
                    }
                    to={`/docs#${chapter.id}`}
                  >
                    {chapter.label}
                    <ChevronRight size={13} />
                  </Link>
                ))}
            </div>
          ))}
          <div className="docs-sidebar-foot">Read-only preview</div>
        </aside>

        <main
          className="docs-content"
          ref={content}
          id="docs-main"
          tabIndex={-1}
        >
          <article className="docs-article">
            <section className="docs-intro" id="doc-introduction">
              <h1>
                Move with
                <br />
                <em>clear intent.</em>
              </h1>
              <p className="docs-lede">
                MANDEVYR is an agentic finance workspace being built for Arc
                Network. It makes proposed onchain financial decisions easier to
                inspect, constrain, and approve, bringing your rules, supporting
                evidence, and proposed actions into one deliberate workflow.
              </p>
              <div className="docs-status">
                <span>
                  <i /> In development
                </span>
                <span>Updated Sep 30, 2026</span>
              </div>
            </section>

            <section className="docs-section" id="doc-quickstart">
              <h2>
                Your first <em>preflight.</em>
              </h2>
              <p>
                The landing preview runs locally in your browser. You can
                explore every result without an account, wallet, or payment.
              </p>
              <ol className="docs-steps">
                <li>
                  <strong>Choose a scenario.</strong>
                  <p>
                    Open the interactive preview and choose Yield, Agent
                    payments, or Tokenized assets.
                  </p>
                </li>
                <li>
                  <strong>Set an amount.</strong>
                  <p>
                    The displayed mandate is the limit for that example. Change
                    the amount to see how the rule responds.
                  </p>
                </li>
                <li>
                  <strong>Check the evidence.</strong>
                  <p>
                    Toggle source freshness, then select Run preflight. Expand
                    “What is being checked?” to inspect the rules behind the
                    result.
                  </p>
                </li>
              </ol>
              <div className="docs-example">
                <span>TRY THESE EXAMPLES</span>
                <dl>
                  <div>
                    <dt>Yield · 50 USDC · fresh</dt>
                    <dd>PASS</dd>
                  </div>
                  <div>
                    <dt>Yield · 150 USDC · fresh</dt>
                    <dd>BLOCK</dd>
                  </div>
                  <div>
                    <dt>Yield · 50 USDC · stale</dt>
                    <dd>UNKNOWN</dd>
                  </div>
                  <div>
                    <dt>Tokenized assets · 75 USDC · fresh</dt>
                    <dd>REVIEW</dd>
                  </div>
                </dl>
              </div>
              <p>
                The example checks the amount first, source freshness second,
                and asset review requirements last. A PASS is a rule-check
                result; it does not predict returns or authorize a transaction.
                Changing an input clears the previous result.
              </p>
              <a className="docs-inline-link" href="/#experience">
                Open the interactive preview <ArrowUpRight size={14} />
              </a>
            </section>

            <section className="docs-section" id="doc-live-arc">
              <h2>
                An Arc registry <em>with receipts.</em>
              </h2>
              <p>
                The app lists three Morpho vaults on Arc Mainnet from a fixed,
                reviewed address list. A read-only Worker asks Arc RPC for the
                contract code, base asset, token decimals, total assets, block
                number, and block time. Each vault links to its Morpho page and
                Arc explorer address so you can inspect the same source.
              </p>
              <p>
                Contract and asset checks tell you whether the address still
                matches the reviewed entry. They do not certify a vault's
                security, liquidity, or suitability. A failed or old read is
                marked unavailable or stale. APY stays hidden until a rate
                source, fee treatment, and time window are verified.
              </p>
              <div className="docs-callout">
                <span>WALLET & EXIT DATA</span>
                <p>
                  Wallet connection is optional. The app reads one native Arc
                  USDC balance and vault shares without requesting a signature.
                  Morpho Vault V2's default maxWithdraw value is always zero,
                  so P0 marks immediate withdrawal capacity unknown rather
                  than presenting that zero as a liquidity verdict. Your
                  watchlist and selected wallet preference stay in this browser.
                </p>
              </div>
              <a className="docs-inline-link" href="/app/explore">
                Open the live registry <ArrowUpRight size={14} />
              </a>
            </section>

            <section className="docs-section" id="doc-product-model">
              <h2>
                A workspace around <em>your mandate.</em>
              </h2>
              <p>
                Onchain markets, tokenized assets, and automated services create
                many ways to move value. MANDEVYR is being designed to help a
                person understand a proposed move before deciding whether to
                approve it.
              </p>
              <p>
                The product is organized around three questions: What are you
                trying to do? What rules and evidence apply? What needs your
                attention before you choose?
              </p>
              <div className="docs-principles">
                <div>
                  <span>01</span>
                  <strong>Intent</strong>
                  <p>Describe the kind of action and its limits.</p>
                </div>
                <div>
                  <span>02</span>
                  <strong>Evidence</strong>
                  <p>See the inputs and checks behind a result.</p>
                </div>
                <div>
                  <span>03</span>
                  <strong>Approval</strong>
                  <p>Keep the final decision with the account owner.</p>
                </div>
              </div>
            </section>

            <section className="docs-section" id="doc-mandates">
              <h2>
                Make your boundaries <em>explicit.</em>
              </h2>
              <p>
                A mandate is a saved, wallet-signed set of constraints MANDEVYR
                applies to preflight and Morpho action review. It can describe
                spending limits, allowed assets, blocked vaults, evidence
                freshness, and manual approval requirements.
              </p>
              <div className="docs-callout">
                <span>DESIGN PRINCIPLE</span>
                <p>
                  A mandate helps evaluate an action. It does not grant an agent
                  authority to move funds by itself.
                </p>
              </div>
              <h3>What a mandate contains</h3>
              <ul className="docs-checklist">
                <li>
                  <Check /> Per-action or per-period budget limits.
                </li>
                <li>
                  <Check /> Categories or assets that require extra review.
                </li>
                <li>
                  <Check /> Freshness requirements for market or issuer data.
                </li>
                <li>
                  <Check /> Conditions that always require a human approval.
                </li>
              </ul>
              <p>
                Persistent mandates live in the app after wallet sign-in. The
                landing demo remains illustrative and does not save a mandate.
              </p>
            </section>

            <section className="docs-section" id="doc-preflight">
              <h2>
                Preflight makes the <em>reasoning visible.</em>
              </h2>
              <p>
                A preflight check is a review step that compares a proposed
                action with the available rules and evidence. Its job is to make
                potential issues easier to notice before any wallet signing or
                execution step.
              </p>
              <div className="docs-verdicts">
                <div>
                  <span className="verdict-mark pass">✓</span>
                  <strong>PASS</strong>
                  <p>The example satisfies the rules that were checked.</p>
                </div>
                <div>
                  <span className="verdict-mark review">?</span>
                  <strong>REVIEW</strong>
                  <p>More context or a human review is needed.</p>
                </div>
                <div>
                  <span className="verdict-mark block">×</span>
                  <strong>BLOCK</strong>
                  <p>The example violates a configured limit.</p>
                </div>
                <div>
                  <span className="verdict-mark unknown">…</span>
                  <strong>UNKNOWN</strong>
                  <p>Required evidence is missing or out of date.</p>
                </div>
              </div>
              <p>
                A result is only as useful as its inputs. The landing page demo
                uses illustrative values and simple local rules; it does not
                fetch market data, verify contracts, connect a wallet, or submit
                a transaction.
              </p>
            </section>

            <section className="docs-section" id="doc-use-cases">
              <h2>
                One set of rules.
                <br />
                <em>Many kinds of move.</em>
              </h2>
              <div className="docs-usecase">
                <span>Yield intelligence</span>
                <h3>Understand the opportunity.</h3>
                <p>
                  A future view could collect information about a yield
                  opportunity, its source, terms, freshness, and relevant risk
                  context. MANDEVYR does not promise returns or recommend a
                  particular vault.
                </p>
                <a href="https://docs.arc.io/" target="_blank" rel="noreferrer">
                  Explore Arc developer docs <ExternalLink size={13} />
                </a>
              </div>
              <div className="docs-usecase">
                <span>Agent payments with x402</span>
                <h3>Put a budget around paid requests.</h3>
                <p>
                  x402 is an open protocol for requesting and settling payment
                  for internet resources through an HTTP-based flow. A MANDEVYR
                  integration lets an account owner inspect a service, price,
                  and spending limit. A wallet-restricted pilot can buy one
                  saved report for 0.01 USDC with explicit wallet signing.
                </p>
                <a
                  href="https://github.com/x402-foundation/x402"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the x402 specification <ExternalLink size={13} />
                </a>
              </div>
              <div className="docs-usecase">
                <span>Tokenized assets</span>
                <h3>Look past the ticker.</h3>
                <p>
                  A future asset review could surface issuer information, access
                  or eligibility conditions, and redemption terms alongside a
                  proposed allocation. A tokenized representation does not
                  remove the need to understand issuer, legal, liquidity, or
                  redemption risks.
                </p>
              </div>
            </section>

            <section className="docs-section" id="doc-trust-boundaries">
              <h2>
                Clarity first.
                <br />
                <em>Authority by choice.</em>
              </h2>
              <p>
                MANDEVYR uses user-controlled wallets. Signing in to save
                research is separate from transaction approval. Morpho actions
                require an explicit wallet confirmation for each transaction.
              </p>
              <div className="docs-callout">
                <span>CURRENT STATUS</span>
                <p>
                  The app has wallet-signed accounts, saved mandates and
                  preflights, Watchtower, Morpho Actions, MDVYR holder utility,
                  and agent spending reviews. The landing preflight remains an
                  example. An x402 checkout is available to one test wallet;
                  a funded settlement has not yet been verified. Automatic
                  agent payments are not active. A small real-fund Galaxy USDC approval,
                  deposit, and withdrawal succeeded on Arc Mainnet; the two
                  Gauntlet vaults still need funded tests.
                </p>
              </div>
              <p>
                Public paid API access, automatic delegation, and further wallet
                integrations need their own threat review, testing, and clear
                user-facing disclosures before activation.
              </p>
            </section>

            <section className="docs-section" id="doc-token-roadmap">
              <h2>
                Usefulness <em>comes first.</em>
              </h2>
              <div className="docs-roadmap">
                <div>
                  <span>NOW</span>
                  <strong>Read-only foundation</strong>
                  <p>
                    Landing page, local preflight concept, curated Arc vault
                    registry, evidence details, and optional wallet view.
                  </p>
                </div>
                <div>
                  <span>LIVE</span>
                  <strong>Intelligence</strong>
                  <p>
                    Save mandates and deterministic preflight reports, then
                    monitor alerts from Arc evidence.
                  </p>
                </div>
                <div>
                  <span>IN REVIEW</span>
                  <strong>Actions</strong>
                  <p>
                    Morpho actions require wallet confirmation. The x402 seller
                    endpoint is limited to a test wallet until its funded
                    settlement and recovery tests are complete.
                  </p>
                </div>
                <div>
                  <span>LIVE</span>
                  <strong>Token utility</strong>
                  <p>
                    Arc Mainnet MDVYR balance is checked for a larger daily
                    saved-report deep-dive allowance.
                  </p>
                </div>
              </div>
              <p>
                MDVYR is live on Arc Mainnet at
                {" "}<code>0xeD2CBF69b36A0E26De6d121be086f31EDAf3b424</code>.
                The contract reports a supply of 1,000,000,000 MDVYR. One
                deep dive per UTC day is available to signed-in users; a verified
                balance of at least 1 MDVYR raises the limit to five. Other
                proposed benefits are not active. Trading terms, taxes, and
                allocation should be checked on the Argus token page.
              </p>
              <a
                className="docs-inline-link"
                href="https://argus.world/token/0xeD2CBF69b36A0E26De6d121be086f31EDAf3b424"
                target="_blank"
                rel="noreferrer"
              >
                Visit Argus <ArrowUpRight size={14} />
              </a>
            </section>

            <section className="docs-section docs-last" id="doc-glossary">
              <h2>
                A few useful <em>terms.</em>
              </h2>
              <dl className="docs-glossary">
                <div>
                  <dt>Arc</dt>
                  <dd>
                    The network MANDEVYR is being designed to support. No Circle
                    partnership or endorsement is implied.
                  </dd>
                </div>
                <div>
                  <dt>Mandate</dt>
                  <dd>A user-defined set of limits and review preferences.</dd>
                </div>
                <div>
                  <dt>Preflight</dt>
                  <dd>
                    A proposed review of an action before a wallet approval or
                    transaction.
                  </dd>
                </div>
                <div>
                  <dt>x402</dt>
                  <dd>
                    An open payment protocol built around the HTTP 402 Payment
                    Required flow.
                  </dd>
                </div>
                <div>
                  <dt>Tokenized asset</dt>
                  <dd>
                    A token that represents or relates to an asset; the token
                    and issuer terms still matter.
                  </dd>
                </div>
              </dl>
              <div className="docs-references">
                <span>PRIMARY REFERENCES</span>
                <a href="https://docs.arc.io/" target="_blank" rel="noreferrer">
                  Arc developer documentation <ExternalLink size={13} />
                </a>
                <a
                  href="https://www.arc.io/brand-guidelines-and-partner-toolkit"
                  target="_blank"
                  rel="noreferrer"
                >
                  Arc brand guidelines <ExternalLink size={13} />
                </a>
                <a
                  href="https://github.com/x402-foundation/x402"
                  target="_blank"
                  rel="noreferrer"
                >
                  x402 Foundation specification <ExternalLink size={13} />
                </a>
              </div>
            </section>
            <footer className="docs-footer">
              <a href="/#experience">
                MANDEVYR <span>·</span> BACK TO THE EXPERIENCE{" "}
                <ArrowDownRight size={14} />
              </a>
              <span>PRODUCT CONCEPT · SEPTEMBER 2026</span>
            </footer>
          </article>
        </main>
        <div className="docs-progress" aria-hidden="true">
          <span
            style={{
              height: `${((chapters.findIndex((chapter) => chapter.id === active) + 1) / chapters.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
