import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Brand } from "./Brand";
import { FlowField } from "./FlowField";

export function ComingSoon() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="coming-page">
      <div className="coming-art">
        <FlowField motion />
      </div>
      <header className="route-header">
        <Link to="/" aria-label="MANDEVYR home">
          <Brand />
        </Link>
        <Link className="route-back" to="/">
          <ArrowLeft size={14} /> Back to home
        </Link>
      </header>
      <main className="coming-main">
        <div className="coming-emblem" aria-hidden="true">
          <span />
          <span />
          <img src="/logo-remove-bg.png" width="64" height="64" alt="" />
        </div>
        <h1 tabIndex={-1}>
          Coming <em>Soon.</em>
        </h1>
        <p>
          A new workspace for onchain intelligence.
          <br />
          Built around your mandate. Always in your control.
        </p>
        <div className="coming-actions">
          <a href="/#experience" className="button button-mint">
            Try the preview <ArrowUpRight size={16} />
          </a>
          <Link to="/docs" className="button button-outline">
            Explore the docs <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="coming-progress">
          <span>
            <i /> Product preview <strong>AVAILABLE</strong>
          </span>
          <span>
            <i /> Live workspace <strong>IN DEVELOPMENT</strong>
          </span>
        </div>
        <p className="coming-note">
          A launch date has not been announced. Explore the product vision and
          try the local preflight while we build.
        </p>
      </main>
      <footer className="coming-footer">
        <a href="https://www.arc.io/" target="_blank" rel="noreferrer">
          <span>BEING BUILT FOR</span>
          <img src="/brand/arc-ondark.svg" alt="Arc" width="55" height="24" />
        </a>
      </footer>
    </div>
  );
}
