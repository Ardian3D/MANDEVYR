import { useId, useRef, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  Fingerprint,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Brand } from "./Brand";

const scenarios = {
  yield: {
    label: "Yield",
    icon: Landmark,
    title: "A deposit, with context.",
    target: "Example USDC vault",
    action: "Deposit amount",
    amount: 50,
    limit: 100,
    max: 200,
    step: 5,
    formatted: (n: number) => n.toFixed(0),
    note: "Check a deposit against your spending limit and the age of its source data.",
  },
  payments: {
    label: "Agent payments",
    icon: Zap,
    title: "Small payments. Clear limits.",
    target: "Example market-data API",
    action: "Price per request",
    amount: 0.02,
    limit: 0.05,
    max: 0.1,
    step: 0.01,
    formatted: (n: number) => n.toFixed(2),
    note: "See how a payment for an x402 resource fits inside an agent’s budget.",
  },
  assets: {
    label: "Tokenized assets",
    icon: FileCheck2,
    title: "Look through the token.",
    target: "Example tokenized fund",
    action: "Proposed allocation",
    amount: 75,
    limit: 100,
    max: 200,
    step: 5,
    formatted: (n: number) => n.toFixed(0),
    note: "Check the proposed amount, then review the issuer and redemption evidence.",
  },
} as const;
type Scenario = keyof typeof scenarios;
type Verdict = "PASS" | "BLOCK" | "UNKNOWN" | "REVIEW";
const verdictCopy = {
  PASS: {
    title: "Within your mandate.",
    detail:
      "The example meets your budget and freshness rules. Your approval would still come next.",
  },
  BLOCK: {
    title: "Your limit. Respected.",
    detail:
      "The proposed amount exceeds your mandate. Adjust the amount to continue this example.",
  },
  UNKNOWN: {
    title: "More evidence needed.",
    detail:
      "A source is out of date. The example stays on hold until fresh information is available.",
  },
  REVIEW: {
    title: "A closer look comes first.",
    detail:
      "The amount is within budget. Issuer eligibility and redemption terms still need review.",
  },
};

export function PreflightDemo() {
  const [scenario, setScenario] = useState<Scenario>("yield");
  const [amount, setAmount] = useState(50);
  const [fresh, setFresh] = useState(true);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [running, setRunning] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputId = useId();
  const config = scenarios[scenario];
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const resetResult = () => {
    if (timer.current) clearTimeout(timer.current);
    setRunning(false);
    setVerdict(null);
  };
  function choose(next: Scenario) {
    resetResult();
    setScenario(next);
    setAmount(scenarios[next].amount);
    setFresh(true);
    setShowEvidence(false);
  }
  function run() {
    setRunning(true);
    setVerdict(null);
    timer.current = setTimeout(() => {
      setVerdict(
        amount > config.limit
          ? "BLOCK"
          : !fresh
            ? "UNKNOWN"
            : scenario === "assets"
              ? "REVIEW"
              : "PASS",
      );
      setRunning(false);
    }, 650);
  }

  return (
    <div className="demo-window">
      <div className="demo-topbar">
        <div className="window-dots">
          <i />
          <i />
          <i />
        </div>
        <span>MANDEVYR / WORKSPACE</span>
        <span className="demo-label">INTERACTIVE PREVIEW</span>
      </div>
      <div className="demo-layout">
        <aside className="demo-sidebar">
          <Brand compact />
          <span className="sidebar-caption">YOUR WORKSPACE</span>
          <div className="sidebar-item selected">
            <ShieldCheck size={16} /> Preflight
          </div>
          <div className="sidebar-item">
            <Fingerprint size={16} /> Mandate
          </div>
          <div className="sidebar-item">
            <Wallet size={16} /> Activity
          </div>
          <div className="sidebar-bottom">
            <LockKeyhole size={15} />
            <span>
              Your keys.
              <br />
              Your decisions.
            </span>
          </div>
        </aside>
        <div className="demo-main">
          <div className="demo-heading">
            <div>
              <span className="eyebrow small">A MOMENT OF CLARITY</span>
              <h3>Before you make a move.</h3>
            </div>
            <span className="demo-network">
              <span className="status-dot" /> ARC CONCEPT
            </span>
          </div>
          <div
            className="demo-tabs"
            role="tablist"
            aria-label="Preflight scenario"
          >
            {(Object.keys(scenarios) as Scenario[]).map((key) => {
              const Icon = scenarios[key].icon;
              return (
                <button
                  type="button"
                  key={key}
                  id={`tab-${key}`}
                  role="tab"
                  aria-selected={scenario === key}
                  aria-controls="preflight-panel"
                  tabIndex={scenario === key ? 0 : -1}
                  onKeyDown={(event) => {
                    const keys = Object.keys(scenarios) as Scenario[];
                    if (
                      event.key === "ArrowRight" ||
                      event.key === "ArrowLeft"
                    ) {
                      event.preventDefault();
                      const next =
                        keys[
                          (keys.indexOf(key) +
                            (event.key === "ArrowRight" ? 1 : 2)) %
                            3
                        ];
                      choose(next);
                      document.getElementById(`tab-${next}`)?.focus();
                    }
                  }}
                  onClick={() => choose(key)}
                  className={scenario === key ? "active" : ""}
                >
                  <Icon size={15} />
                  {scenarios[key].label}
                </button>
              );
            })}
          </div>
          <div
            className="demo-content"
            id="preflight-panel"
            role="tabpanel"
            aria-labelledby={`tab-${scenario}`}
          >
            <div className="intent-panel">
              <div className="intent-panel-title">
                <span>01 / DEFINE YOUR MOVE</span>
                <SlidersHorizontal size={14} />
              </div>
              <h4>{config.title}</h4>
              <p>{config.note}</p>
              <div className="target-field">
                <span className="target-icon">
                  <config.icon size={20} />
                </span>
                <div>
                  <span className="micro-label">ILLUSTRATIVE TARGET</span>
                  <strong>{config.target}</strong>
                </div>
                <ChevronRight size={16} />
              </div>
              <label className="amount-label" htmlFor={inputId}>
                {config.action}
                <span>
                  <strong>{config.formatted(amount)}</strong> USDC
                </span>
              </label>
              <input
                id={inputId}
                className="amount-range"
                type="range"
                min={config.step}
                max={config.max}
                step={config.step}
                value={amount}
                onChange={(event) => {
                  resetResult();
                  setAmount(Number(event.target.value));
                }}
              />
              <div className="range-labels">
                <span>{config.formatted(config.step)} USDC</span>
                <span>
                  Mandate limit: {config.formatted(config.limit)} USDC
                </span>
              </div>
              <label className="fresh-toggle">
                <input
                  type="checkbox"
                  checked={fresh}
                  onChange={(event) => {
                    resetResult();
                    setFresh(event.target.checked);
                  }}
                />
                <span className="toggle-ui" />
                <span>Source data is fresh</span>
                <CircleHelp size={13} />
              </label>
              <button
                className="button button-mint demo-run"
                type="button"
                onClick={run}
                disabled={running}
              >
                {running ? (
                  <>
                    <LoaderCircle size={17} className="spin" />
                    Checking your mandate…
                  </>
                ) : (
                  <>
                    Run preflight <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
            <div
              className={`verdict-panel ${verdict ? `verdict-${verdict.toLowerCase()}` : ""}`}
            >
              <div className="intent-panel-title">
                <span>02 / SEE THE REASONING</span>
                <span className="mini-square" />
              </div>
              <div
                className="verdict-copy"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="verdict-icon">
                  {running ? (
                    <LoaderCircle size={31} className="spin" />
                  ) : verdict === "BLOCK" ? (
                    <X size={31} />
                  ) : verdict === "UNKNOWN" || verdict === "REVIEW" ? (
                    <CircleHelp size={31} />
                  ) : (
                    <ShieldCheck size={31} />
                  )}
                </span>
                <span className="verdict-status">
                  {running ? "CHECKING" : (verdict ?? "READY WHEN YOU ARE")}
                </span>
                <h4>
                  {running
                    ? "Connecting the dots."
                    : verdict
                      ? verdictCopy[verdict].title
                      : "Clarity before commitment."}
                </h4>
                <p>
                  {running
                    ? "Evaluating the example against your rules."
                    : verdict
                      ? verdictCopy[verdict].detail
                      : "Change the amount or freshness setting. Then see how your mandate responds."}
                </p>
              </div>
              <div className="rule-summary">
                <div>
                  <span>Spending limit</span>
                  <span
                    className={
                      verdict && amount > config.limit ? "warning-text" : ""
                    }
                  >
                    {verdict
                      ? amount > config.limit
                        ? "Exceeded"
                        : "Within limit"
                      : "Awaiting check"}
                  </span>
                </div>
                <div>
                  <span>Source freshness</span>
                  <span className={verdict && !fresh ? "warning-text" : ""}>
                    {verdict
                      ? fresh
                        ? "Fresh · example"
                        : "Stale · example"
                      : "Awaiting check"}
                  </span>
                </div>
                <div>
                  <span>Your approval</span>
                  <span>
                    Always required <Check size={12} />
                  </span>
                </div>
              </div>
              <button
                className="evidence-button"
                type="button"
                aria-expanded={showEvidence}
                aria-controls="demo-evidence"
                onClick={() => setShowEvidence(!showEvidence)}
              >
                What is being checked?{" "}
                <ChevronRight
                  size={14}
                  className={showEvidence ? "rotated" : ""}
                />
              </button>
            </div>
          </div>
          {showEvidence && (
            <div className="demo-evidence" id="demo-evidence">
              <strong>Three transparent rules.</strong>
              <p>
                The amount must stay within the displayed mandate. Stale source
                data holds the example. Tokenized assets always require a
                separate issuer and eligibility review. This demonstration uses
                local example data and never connects a wallet.
              </p>
            </div>
          )}
          <div className="demo-footnote">
            <LockKeyhole size={12} /> Illustrative data. No wallet connection,
            payment, or transaction.
          </div>
        </div>
      </div>
    </div>
  );
}
