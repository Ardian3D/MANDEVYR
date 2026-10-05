import { useCallback, useEffect, useState } from "react";
import { createSiweMessage } from "viem/siwe";
import { ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, FileSearch2, LoaderCircle, ShieldCheck, Wallet } from "lucide-react";
import type { EthereumProvider } from "../p0/wallets";
import type { PreflightReport } from "../p1/rules";
import { MDVYR_ARGUS_URL, MDVYR_MIN_BALANCE_RAW, MDVYR_TOKEN } from "./config";
import "./utility.css";

type Props = { wallet: `0x${string}` | null; walletChain: number | null; provider: EthereumProvider | null };
type TokenStatus = { signedIn: boolean; day: string; usedToday: number; freeDailyReports: number; holderDailyReports: number; evidence: { balance: string; totalSupply: string; holder: boolean; blockNumber: string; observedAt: string; dailyReportLimit: number } | null; evidenceError: string | null };
type DeepDive = { reportId: string; generatedAt: string; snapshotAt: string; snapshotExpired: boolean; verdict: string; counts: { blocks: number; unknowns: number; reviews: number }; priorityChecks: { code: string; severity: string; explanation: string }[]; sources: { source: string; url: string; status: string; blockNumber: string | null; limitation: string }[]; nextSteps: string[]; methodology: string; liveCheck: { status: string; contractMatched: boolean; codePresent: boolean; assetMatched: boolean; blockNumber: string | null; observedAt: string | null; totalAssetsRaw: string | null; asset: string; limitation: string } | null };

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/p1${path}`, { method, credentials: "same-origin", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

export function UtilityPanel({ wallet, walletChain, provider }: Props) {
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [reports, setReports] = useState<PreflightReport[]>([]);
  const [selected, setSelected] = useState<DeepDive | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signedIn = Boolean(wallet && walletChain === 5042 && sessionWallet?.toLowerCase() === wallet.toLowerCase());

  const refresh = useCallback(async () => {
    const [token, me] = await Promise.all([api<TokenStatus>("/utility/token"), api<{ wallet: string }>("/me").catch(() => null)]);
    setStatus(token);
    setSessionWallet(me?.wallet ?? null);
    if (me?.wallet && wallet && walletChain === 5042 && me.wallet.toLowerCase() === wallet.toLowerCase()) {
      const history = await api<{ items: PreflightReport[] }>("/history");
      setReports(history.items);
    } else { setReports([]); setSelected(null); }
  }, [wallet, walletChain]);

  useEffect(() => { const timer = window.setTimeout(() => { void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Utility service unavailable.")); }, 0); return () => window.clearTimeout(timer); }, [refresh]);

  const signIn = async () => {
    if (!wallet || !provider || walletChain !== 5042) return;
    setBusy(true); setError(null);
    try {
      const { nonce } = await api<{ nonce: string }>("/auth/nonce", "POST");
      const issuedAt = new Date();
      const message = createSiweMessage({ address: wallet, chainId: 5042, domain: window.location.host, uri: window.location.origin, version: "1", nonce, issuedAt, expirationTime: new Date(issuedAt.getTime() + 300_000), statement: "Sign in to view MANDEVYR research and token utility. No transaction is requested." });
      const signature = await provider.request({ method: "personal_sign", params: [message, wallet] });
      if (typeof signature !== "string") throw new Error("The wallet did not return a signature.");
      await api("/auth/verify", "POST", { message, signature });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet sign-in was cancelled."); }
    finally { setBusy(false); }
  };

  const openReport = async (id: string) => {
    setBusy(true); setError(null);
    try { const response = await api<{ deepDive: DeepDive }>(`/utility/deep-dive/${encodeURIComponent(id)}`, "POST"); setSelected(response.deepDive); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Deep dive unavailable."); }
    finally { setBusy(false); }
  };

  const limit = status?.evidence?.dailyReportLimit ?? status?.freeDailyReports ?? 1;
  return <div className="utility-page">
    <section className="utility-hero">
      <div><span className="utility-eyebrow"><span /> MDVYR / PRODUCT UTILITY</span><h1>Research that <em>goes deeper.</em></h1><p>Your core preflight stays open. Holding at least 1 MDVYR in the signed-in Arc wallet increases your daily deep-dive allowance from one saved report to five.</p><a className="utility-hero-link" href={MDVYR_ARGUS_URL} target="_blank" rel="noreferrer">View token on Argus <ArrowUpRight size={16} /></a></div>
      <div className="utility-hero-stat"><span>LIVE ON ARC MAINNET</span><strong>MDVYR</strong><small>Verified ERC-20 · supply observed at 1B on Oct 5, 2026</small><div><ShieldCheck size={16} /> Balance checked onchain for each new report</div></div>
    </section>

    <section className="utility-grid">
      <article className="utility-card"><span className="utility-label">01 / YOUR ACCESS</span><h2>{signedIn ? status?.evidence?.holder ? "Holder access" : "Open access" : "Connect your research wallet"}</h2>
        <p>{signedIn ? `${status?.usedToday ?? 0} of ${limit} unique deep dives opened today (UTC).` : "Connect the wallet used for your saved preflights, then sign in with a message. No gas or transaction is required."}</p>
        {signedIn ? <div className="utility-meter"><span style={{ width: `${Math.min(100, ((status?.usedToday ?? 0) / limit) * 100)}%` }} /></div> : <button className="utility-button" type="button" disabled={!wallet || walletChain !== 5042 || busy} onClick={() => void signIn()}><Wallet size={16} /> {wallet ? walletChain === 5042 ? "Sign in with wallet" : "Switch wallet to Arc" : "Connect wallet above"} <ArrowRight size={16} /></button>}
        {signedIn && <div className="utility-balance"><span>MDVYR BALANCE</span><strong>{status?.evidence ? Number(status.evidence.balance).toLocaleString("en-US", { maximumFractionDigits: 4 }) : "Unavailable"}</strong><small>{status?.evidence ? `Arc block ${status.evidence.blockNumber}` : status?.evidenceError}</small></div>}
      </article>
      <article className="utility-card"><span className="utility-label">02 / WHAT IS ACTIVE</span><h2>More room to inspect.</h2><p>One detailed expansion of a saved preflight per UTC day is available to every signed-in wallet. A verified balance of at least 1 MDVYR raises that to five.</p><ul><li><CheckCircle2 size={15} /> Server-enforced, wallet-specific quota</li><li><CheckCircle2 size={15} /> Same report can be reopened without another credit</li><li><CheckCircle2 size={15} /> Existing reports remain readable after the day ends</li></ul></article>
    </section>

    <section className="utility-reports"><div className="utility-section-head"><div><span className="utility-label">03 / SAVED RESEARCH</span><h2>Open a deep dive</h2></div><span>{reports.length} reports</span></div>
      {!signedIn ? <div className="utility-empty"><FileSearch2 size={26} /><p>Sign in with the wallet that created your preflights to see them here.</p></div> : reports.length === 0 ? <div className="utility-empty"><FileSearch2 size={26} /><p>No saved preflights yet. Run one from Preflight, then return here.</p></div> : <div className="utility-report-list">{reports.slice(0, 12).map((report) => <button type="button" key={report.id} disabled={busy} onClick={() => void openReport(report.id)}><span className={`utility-verdict utility-verdict-${report.verdict.toLowerCase()}`}>{report.verdict}</span><span><strong>{report.intent.targetId.replaceAll("-", " ")}</strong><small>{new Date(report.createdAt).toLocaleString()} · {report.intent.asset}</small></span><ArrowRight size={16} /></button>)}</div>}
      {busy && <p className="utility-message"><LoaderCircle size={16} className="spin" /> Checking access…</p>}{error && <p className="utility-message utility-error" role="alert"><CircleAlert size={16} /> {error}</p>}
    </section>

    {selected && <section className="utility-deep-dive"><div className="utility-section-head"><div><span className="utility-label">DETERMINISTIC DEEP DIVE</span><h2>{selected.verdict} · {selected.counts.blocks} blocks, {selected.counts.unknowns} unknowns</h2></div><span>{selected.snapshotExpired ? "Historical snapshot" : "Current snapshot"}</span></div><p>This expands the saved evidence and limitations. It does not approve a transaction or predict returns.</p>{selected.liveCheck && <div className="utility-live-check"><span className="utility-label">CURRENT ARC OBSERVATION</span><strong>{selected.liveCheck.status === "fresh" && selected.liveCheck.contractMatched && selected.liveCheck.codePresent && selected.liveCheck.assetMatched ? "Identity still matches" : "Current evidence needs review"}</strong><small>Block {selected.liveCheck.blockNumber ?? "unavailable"} · {selected.liveCheck.asset} · total assets {selected.liveCheck.totalAssetsRaw ?? "unavailable"} raw units</small><p>{selected.liveCheck.limitation}</p></div>}<div className="utility-checks">{selected.priorityChecks.map((check) => <article key={check.code}><span>{check.severity} / {check.code}</span><p>{check.explanation}</p></article>)}</div><h3>Sources and limits</h3><div className="utility-sources">{selected.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span>{source.source} · {source.status} · {source.blockNumber ?? "editorial"}<small>{source.limitation}</small></span><ArrowUpRight size={16} /></a>)}</div></section>}

    <section className="utility-disclosure"><span className="utility-label">TOKEN TRANSPARENCY</span><h2>Verify the terms at their source.</h2><div><p><strong>Product benefit</strong> 1 vs 5 new saved-report deep dives per UTC day; wallet balance checked when each new report is opened.</p><p><strong>Market terms</strong> Check buy and sell taxes, fee split, liquidity, and rewards on the Argus token page before trading.</p><p><strong>Allocation & vesting</strong> A final founder disclosure is still pending. MANDEVYR does not make a price or return promise.</p></div></section>

    <footer className="utility-footer"><div><span className="utility-label">VERIFIED TOKEN</span><code>{MDVYR_TOKEN}</code><small>Arc Mainnet · 1 MDVYR = {MDVYR_MIN_BALANCE_RAW.toString()} raw units</small></div><p>Balance is read when a new report is opened. Existing access is retained for that report. Market price, taxes and rewards are managed by Argus; this product benefit does not depend on token price.</p></footer>
  </div>;
}
