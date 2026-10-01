import { ArrowUpRight, Check, Fingerprint, Zap } from "lucide-react";

export function SignalVisual({ mode }: { mode: number }) {
  return (
    <div className={`signal-visual mode-${mode}`}>
      <div className="signal-stage">
        <div className="signal-grid" />
        <div className="chart-scene" aria-hidden={mode !== 0}>
          <div className="chart-caption">
            <span>Example USDC opportunities</span>
            <strong>
              Evidence before exposure.
              <ArrowUpRight size={17} />
            </strong>
          </div>
          <div className="yield-bars">
            {Array.from({ length: 36 }, (_, i) => (
              <i
                key={i}
                style={{
                  height: `${24 + 110 * Math.exp(-(((i - 22) / 10) ** 2)) + 20 * Math.sin(i * 0.16)}px`,
                  transitionDelay: `${i * 8}ms`,
                }}
              />
            ))}
          </div>
          <div className="chart-axis">
            <span>Source quality</span>
            <span>Mandate fit</span>
            <span>Risk context</span>
          </div>
          <div className="chart-callout">
            <Check size={13} /> Rules checked. You decide.
          </div>
        </div>
        <div className="payment-scene" aria-hidden={mode !== 1}>
          <svg viewBox="0 0 600 290" className="payment-paths">
            <path d="M85 145 C180 145 165 60 290 60 S420 145 515 145 M85 145 H515 M85 145 C180 145 165 230 290 230 S420 145 515 145" />
          </svg>
          <div className="payment-node node-agent">
            <Fingerprint />
            <span>YOUR AGENT</span>
          </div>
          <div className="payment-node node-api">
            <Zap />
            <span>x402 API</span>
          </div>
          <span className="packet packet-1" />
          <span className="packet packet-2" />
          <span className="packet packet-3" />
          <div className="payment-amount">
            <small>Example cost per request</small>
            <strong>
              0.02 <span>USDC</span>
            </strong>
            <span className="mono">
              LIMIT 0.05 USDC <Check size={12} />
            </span>
          </div>
        </div>
        <div className="asset-scene" aria-hidden={mode !== 2}>
          <div className="asset-sheet sheet-back">
            <span>REDEMPTION TERMS</span>
            <i />
            <i />
            <i />
          </div>
          <div className="asset-sheet sheet-front">
            <span>
              ASSET PASSPORT <ArrowUpRight size={14} />
            </span>
            <strong>
              Beyond
              <br />
              the ticker.
            </strong>
            <div>
              <span>Issuer evidence</span>
              <Check size={14} />
            </div>
            <div>
              <span>Eligibility</span>
              <span className="review-label">REVIEW</span>
            </div>
            <div>
              <span>Redemption</span>
              <Check size={14} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
