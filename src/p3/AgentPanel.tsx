import { useCallback, useEffect, useState } from "react";
import { createSiweMessage } from "viem/siwe";
import { formatUnits, parseUnits } from "viem";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { ArrowRight, CircleAlert, Code2, LockKeyhole, ShieldCheck, Wallet } from "lucide-react";
import type { EthereumProvider } from "../p0/wallets";
import { X402_AMOUNT_RAW, X402_ASSET, X402_NETWORK } from "./payment-recovery";
import { createProviderSigner } from "./provider-signer";
import { DEFAULT_AGENT_POLICY, type AgentPolicy } from "./policy";
import "./agent.css";

type Props = { wallet: `0x${string}` | null; walletChain: number | null; provider: EthereumProvider | null };
type Seller = { enabled: boolean; mode: "off" | "pilot" | "public"; network: string; priceUsdc: string; priceRaw: string; resource: string; facilitator: string; payee: string | null };
type Review = { id: string; resource_url: string; purpose: string; price_raw: string; decision: string; reason: string; created_at: string };
type SavedReport = { id: string; createdAt: string; intent: { targetId: string } };
type Quote = { reportId: string; idempotencyKey: string; required: PaymentRequired };
type PendingPayment = { wallet: string; reportId: string; idempotencyKey: string; paymentSignature: string; txHash: string; createdAt: number };
const PENDING_KEY = "mandevyr:x402:pending";
function validateQuote(required: PaymentRequired, seller: Seller) {
  const options = required.accepts.filter((item) => item.scheme === "exact" && item.network === X402_NETWORK && item.asset.toLowerCase() === X402_ASSET && item.amount === X402_AMOUNT_RAW && item.payTo.toLowerCase() === seller.payee?.toLowerCase());
  if (required.x402Version !== 2 || required.accepts.length !== 1 || options.length !== 1 || seller.network !== X402_NETWORK || seller.priceRaw !== X402_AMOUNT_RAW) throw new Error("The payment quote differs from the reviewed Arc USDC price or receiver.");
}
function restorePending(): PendingPayment | null {
  try {
    const value = sessionStorage.getItem(PENDING_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as PendingPayment;
    return /^prf_[0-9a-f-]{36}$/.test(parsed.reportId) && /^0x[0-9a-fA-F]{40}$/.test(parsed.wallet) && typeof parsed.paymentSignature === "string" && Number.isFinite(parsed.createdAt) ? parsed : null;
  } catch { return null; }
}
async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/p1${path}`, { method, credentials: "same-origin", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

export function AgentPanel({ wallet, walletChain, provider }: Props) {
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [policy, setPolicy] = useState<AgentPolicy>(DEFAULT_AGENT_POLICY);
  const [origins, setOrigins] = useState("");
  const [paths, setPaths] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [resourceUrl, setResourceUrl] = useState("");
  const [purpose, setPurpose] = useState("");
  const [price, setPrice] = useState("0.01");
  const [reportId, setReportId] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(restorePending);
  const [recoveryHash, setRecoveryHash] = useState("");
  const [paymentHash, setPaymentHash] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = Boolean(wallet && walletChain === 5042 && sessionWallet?.toLowerCase() === wallet.toLowerCase());

  const refresh = useCallback(async () => {
    const [config, me] = await Promise.all([api<Seller>("/x402/config"), api<{ wallet: string }>("/me").catch(() => null)]);
    setSeller(config); setSessionWallet(me?.wallet ?? null);
    if (!me?.wallet || !wallet || walletChain !== 5042 || me.wallet.toLowerCase() !== wallet.toLowerCase()) { setReviews([]); setReports([]); return; }
    const [saved, ledger, history] = await Promise.all([api<{ policy: AgentPolicy }>("/agent/policy"), api<{ items: Review[] }>("/agent/reviews"), api<{ items: SavedReport[] }>("/history")]);
    setPolicy(saved.policy); setOrigins(saved.policy.allowedOrigins.join("\n")); setPaths(saved.policy.allowedPathPrefixes.join("\n")); setReviews(ledger.items); setReports(history.items);
  }, [wallet, walletChain]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Agent service unavailable.")); }, 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => { if (!pendingPayment) return; const timer = window.setInterval(() => setNow(Date.now()), 10_000); return () => window.clearInterval(timer); }, [pendingPayment]);

  const signIn = async () => {
    if (!wallet || !provider || walletChain !== 5042) return;
    setBusy(true); setError(null);
    try {
      const { nonce } = await api<{ nonce: string }>("/auth/nonce", "POST");
      const issuedAt = new Date();
      const messageToSign = createSiweMessage({ address: wallet, chainId: 5042, domain: window.location.host, uri: window.location.origin, version: "1", nonce, issuedAt, expirationTime: new Date(issuedAt.getTime() + 300_000), statement: "Sign in to configure agent spending reviews. No transaction is requested." });
      const signature = await provider.request({ method: "personal_sign", params: [messageToSign, wallet] });
      if (typeof signature !== "string") throw new Error("The wallet did not return a signature.");
      await api("/auth/verify", "POST", { message: messageToSign, signature });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in cancelled."); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const next = { ...policy, allowedOrigins: origins.split(/\r?\n/).map((v) => v.trim()).filter(Boolean), allowedPathPrefixes: paths.split(/\r?\n/).map((v) => v.trim()).filter(Boolean), manualApproval: true as const };
      const result = await api<{ policy: AgentPolicy }>("/agent/policy", "PUT", { policy: next });
      setPolicy(result.policy); setMessage("Policy saved. Every real payment still needs a separate wallet confirmation.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save policy."); }
    finally { setBusy(false); }
  };

  const review = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const priceRaw = parseUnits(price, 6).toString();
      const result = await api<{ allowed: boolean; reason: string }>("/agent/review", "POST", { resourceUrl, purpose, priceRaw });
      setMessage(`${result.allowed ? "Within limits" : "Blocked"}: ${result.reason} This is a policy review; no payment was sent.`);
      const ledger = await api<{ items: Review[] }>("/agent/reviews"); setReviews(ledger.items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review request."); }
    finally { setBusy(false); }
  };

  const checkQuote = async () => {
    if (!seller?.enabled || !signedIn || !/^prf_[0-9a-f-]{36}$/.test(reportId.trim())) { setError("Enter a saved report ID owned by this signed-in wallet."); return; }
    setBusy(true); setError(null); setMessage(null); setQuote(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch(`/api/p1/x402/reports/${reportId.trim()}/deep-dive`, { credentials: "same-origin", cache: "no-store", headers: { "Idempotency-Key": idempotencyKey } });
      if (response.ok) { if (pendingPayment?.reportId === reportId.trim()) { sessionStorage.removeItem(PENDING_KEY); setPendingPayment(null); } setMessage("This report is already paid and can be reopened without another payment."); return; }
      if (response.status !== 402) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error || `Quote request failed (${response.status}).`); }
      const encoded = response.headers.get("PAYMENT-REQUIRED");
      if (!encoded) throw new Error("The seller did not return an x402 payment quote.");
      const required = JSON.parse(atob(encoded)) as PaymentRequired;
      validateQuote(required, seller);
      setQuote({ reportId: reportId.trim(), idempotencyKey, required });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read payment quote."); }
    finally { setBusy(false); }
  };

  const submitSignedPayment = async (pending: PendingPayment) => {
    const response = await fetch(`/api/p1/x402/reports/${pending.reportId}/deep-dive`, { credentials: "same-origin", cache: "no-store", headers: { "Idempotency-Key": pending.idempotencyKey, "PAYMENT-SIGNATURE": pending.paymentSignature } });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(body.error || `Payment request returned ${response.status}. Check Arc before signing again.`);
    const receipt = response.headers.get("PAYMENT-RESPONSE");
    if (!receipt) {
      const access = await fetch(`/api/p1/x402/reports/${pending.reportId}/deep-dive`, { credentials: "same-origin", cache: "no-store" });
      if (!access.ok) throw new Error("The response has no settlement receipt or recorded access. Check Arc before signing again.");
      sessionStorage.removeItem(PENDING_KEY); setPendingPayment(null); setQuote(null); setMessage("This report already has paid access."); return;
    }
    const settled = JSON.parse(atob(receipt)) as { success?: boolean; transaction?: string; network?: string };
    if (!settled.success || settled.network !== X402_NETWORK || !/^0x[0-9a-fA-F]{64}$/.test(settled.transaction ?? "")) throw new Error("The settlement receipt is incomplete. Check Arc before signing again.");
    pending.txHash = settled.transaction!;
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)); setPendingPayment(pending); setPaymentHash(pending.txHash); setRecoveryHash(pending.txHash);
    if (response.headers.get("X-Mandevyr-Audit") === "recorded") { sessionStorage.removeItem(PENDING_KEY); setPendingPayment(null); setQuote(null); setMessage("Payment settled and the report receipt was recorded."); }
    else setMessage("Payment settled on Arc, but its app receipt needs recovery. Use the button below; do not sign a second payment.");
  };

  const payReport = async () => {
    if (!quote || !seller?.enabled || !wallet || !provider || walletChain !== 5042) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      validateQuote(quote.required, seller);
      const [chain, accounts] = await Promise.all([provider.request({ method: "eth_chainId" }), provider.request({ method: "eth_accounts" })]);
      if (Number(chain) !== 5042 || !Array.isArray(accounts) || String(accounts[0]).toLowerCase() !== wallet.toLowerCase()) throw new Error("Wallet or network changed. Check the quote again.");
      const signer = createProviderSigner(provider, wallet);
      const client = new x402Client().register(X402_NETWORK, new ExactEvmScheme(signer));
      const http = new x402HTTPClient(client);
      const payload = await http.createPaymentPayload(quote.required);
      const paymentSignature = http.encodePaymentSignatureHeader(payload)["PAYMENT-SIGNATURE"];
      if (!paymentSignature) throw new Error("Could not encode the signed payment.");
      const pending = { wallet, reportId: quote.reportId, idempotencyKey: quote.idempotencyKey, paymentSignature, txHash: "", createdAt: Date.now() };
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)); setPendingPayment(pending);
      await submitSignedPayment(pending);
    } catch (cause) { setError(`${cause instanceof Error ? cause.message : "Payment status is unknown."} Do not sign again until the Arc receipt is checked.`); }
    finally { setBusy(false); }
  };

  const retrySignedPayment = async () => {
    if (!pendingPayment || pendingPayment.wallet.toLowerCase() !== wallet?.toLowerCase() || pendingPayment.txHash) return;
    setBusy(true); setError(null); setMessage(null);
    try { await submitSignedPayment(pendingPayment); }
    catch (cause) { setError(`${cause instanceof Error ? cause.message : "Payment status is unknown."} Check Arc before signing again.`); }
    finally { setBusy(false); }
  };

  const recoverPayment = async () => {
    if (!pendingPayment || pendingPayment.wallet.toLowerCase() !== wallet?.toLowerCase() || !/^0x[0-9a-fA-F]{64}$/.test(recoveryHash.trim())) { setError("Enter the Arc settlement hash for this wallet and report."); return; }
    setBusy(true); setError(null);
    try {
      const result = await api<{ transactionHash: string }>(`/x402/reports/${pendingPayment.reportId}/recover`, "POST", { idempotencyKey: pendingPayment.idempotencyKey, paymentSignature: pendingPayment.paymentSignature, txHash: recoveryHash.trim() });
      sessionStorage.removeItem(PENDING_KEY); setPendingPayment(null); setPaymentHash(result.transactionHash); setMessage("Payment receipt recovered. Reopen the report without paying again.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not recover the payment receipt."); }
    finally { setBusy(false); }
  };

  return <div className="agent-page">
    <section className="agent-hero"><span className="agent-kicker">P3 / AGENT & API ECONOMY</span><h1>An API with <em>clear boundaries.</em></h1><p>MANDEVYR can sell a deterministic report deep dive over x402 on Arc. Agent spending policies keep domains, endpoints, and USDC amounts visible before any wallet action.</p><div className="agent-hero-badges"><span><Code2 size={15} /> x402 v2 · Arc Mainnet</span><span><ShieldCheck size={15} /> Human wallet approval</span></div></section>
    <div className="agent-grid"><section className="agent-card"><span className="agent-kicker">01 / SELLER API</span><h2>Deep-dive endpoint</h2><p>Price: <strong>{seller?.priceUsdc ?? "—"} USDC</strong> per saved report. A caller must own the report through wallet sign-in before the API presents a 402 payment request.</p><code>GET {seller?.resource ?? "/api/p1/x402/reports/{report_id}/deep-dive"}</code><div className={`agent-status ${seller?.enabled ? "agent-live" : ""}`}>{seller?.enabled ? seller.mode === "pilot" ? "Wallet pilot active" : "Paid endpoint enabled" : seller?.mode === "pilot" ? "Wallet pilot restricted" : "Paid endpoint awaiting final payment test"}</div><small>Facilitator: {seller?.facilitator ?? "Arcus"}. Settlement and gas are handled by the facilitator. Existing free and holder report access stays available.</small></section>
      <section className="agent-card"><span className="agent-kicker">02 / BUYER CONTROLS</span><h2>One request at a time.</h2><p>Save an allowlist and caps for an agent request review. The review records its purpose and quoted price. This workspace does not submit an external x402 payment automatically.</p>{!signedIn && <button type="button" className="agent-button" disabled={!wallet || walletChain !== 5042 || busy} onClick={() => void signIn()}><Wallet size={16} /> {wallet ? walletChain === 5042 ? "Sign in to set policy" : "Switch wallet to Arc" : "Connect wallet above"} <ArrowRight size={16} /></button>}<div className="agent-human"><LockKeyhole size={16} /> Manual approval stays required.</div></section></div>
    {signedIn && <><section className="agent-card agent-policy"><div><span className="agent-kicker">03 / SPENDING POLICY</span><h2>Define the edge.</h2></div><div className="agent-form-grid"><label>Allowed HTTPS origins, one per line<textarea value={origins} onChange={(e) => setOrigins(e.target.value)} rows={3} placeholder="https://api.example.com" /></label><label>Allowed endpoint prefixes, one per line<textarea value={paths} onChange={(e) => setPaths(e.target.value)} rows={3} placeholder="/v1/reports/" /></label><label>Per-request cap, USDC<input type="text" inputMode="decimal" value={formatUnits(BigInt(policy.maxPerRequestRaw), 6)} onChange={(e) => { try { setPolicy({ ...policy, maxPerRequestRaw: parseUnits(e.target.value, 6).toString() }); } catch { /* Keep last valid value. */ } }} /></label><label>Daily review cap, USDC<input type="text" inputMode="decimal" value={formatUnits(BigInt(policy.maxDailyRaw), 6)} onChange={(e) => { try { setPolicy({ ...policy, maxDailyRaw: parseUnits(e.target.value, 6).toString() }); } catch { /* Keep last valid value. */ } }} /></label></div><label className="agent-toggle"><input type="checkbox" checked={policy.enabled} onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })} /> Enable policy reviews</label><button type="button" className="agent-button" onClick={() => void save()} disabled={busy}>Save policy <ArrowRight size={16} /></button></section>
      <section className="agent-card agent-policy"><span className="agent-kicker">04 / REVIEW A REQUEST</span><h2>Check before paying.</h2><div className="agent-form-grid"><label>Resource URL<input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://api.example.com/v1/reports/123" /></label><label>Purpose<input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Fetch a research report" /></label><label>Quoted price, USDC<input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" /></label></div><button type="button" className="agent-button" onClick={() => void review()} disabled={busy}>Review request <ArrowRight size={16} /></button><p className="agent-note">Enter a quote you obtained from the seller. MANDEVYR checks your policy but does not verify this external quote or move funds.</p></section>
      <section className="agent-card agent-policy"><span className="agent-kicker">05 / AUDIT TRAIL</span><h2>Recent reviews.</h2>{reviews.length === 0 ? <p>No requests reviewed yet.</p> : <div className="agent-reviews">{reviews.map((item) => <article key={item.id}><strong className={item.decision === "allowed" ? "agent-allowed" : "agent-blocked"}>{item.decision.toUpperCase()}</strong><span>{item.purpose}<small>{item.resource_url} · {formatUnits(BigInt(item.price_raw), 6)} USDC</small></span><time>{new Date(item.created_at).toLocaleString()}</time></article>)}</div>}</section></>}
    {signedIn && <section className="agent-card agent-policy">
      <span className="agent-kicker">06 / X402 PAYMENT</span><h2>One report. One signed payment.</h2>
      <p>Enter a saved preflight ID. The app checks the Arc quote before your wallet signs an exact 0.01 USDC payment. No unlimited token approval is requested.</p>
      <div className="agent-form-grid"><label>Choose a saved report<select value={reportId} onChange={(event) => { setReportId(event.target.value); setQuote(null); }}><option value="">Select a report</option>{reports.map((report) => <option key={report.id} value={report.id}>{report.intent.targetId} · {new Date(report.createdAt).toLocaleDateString()} · {report.id.slice(0, 12)}…</option>)}</select></label></div>
      {!reports.length && <p className="agent-note">No saved reports yet. <a href="/app/preflight/new">Create a preflight</a> first, then return here.</p>}
      <button type="button" className="agent-button" disabled={busy || !seller?.enabled || !/^prf_[0-9a-f-]{36}$/.test(reportId.trim())} onClick={() => void checkQuote()}>Check live quote <ArrowRight size={16} /></button>
      {quote && seller && <div className="agent-quote"><strong>0.01 USDC · Arc Mainnet</strong><span>Receiver: {seller.payee}</span><span>Report: {quote.reportId}</span><button type="button" className="agent-button" disabled={busy || !provider || walletChain !== 5042 || Boolean(pendingPayment)} onClick={() => void payReport()}>Sign exact payment in wallet <Wallet size={16} /></button></div>}
      {pendingPayment && pendingPayment.wallet.toLowerCase() === wallet?.toLowerCase() && <div className="agent-quote"><strong>Receipt recovery</strong><p>A signed payment is saved in this browser session. Check Arc before signing anything again.</p>{!pendingPayment.txHash && <button type="button" className="agent-button" disabled={busy} onClick={() => void retrySignedPayment()}>Retry the same signature <ArrowRight size={16} /></button>}<label>Arc settlement hash<input value={recoveryHash} onChange={(event) => setRecoveryHash(event.target.value)} placeholder="0x..." /></label><button type="button" className="agent-button" disabled={busy || !/^0x[0-9a-fA-F]{64}$/.test(recoveryHash.trim())} onClick={() => void recoverPayment()}>Recover receipt <ArrowRight size={16} /></button><button type="button" className="agent-clear" disabled={busy || now - pendingPayment.createdAt < 300_000} onClick={() => { sessionStorage.removeItem(PENDING_KEY); setPendingPayment(null); setQuote(null); }}>Clear expired local signature after checking Arc</button></div>}
      {paymentHash && <a className="agent-tx" href={`https://explorer.arc.io/tx/${paymentHash}`} target="_blank" rel="noreferrer">View Arc payment receipt ↗</a>}
      <p className="agent-note">{seller?.enabled ? "Wallet confirmation is required. Check uncertain payments on Arc before signing again." : "Paid x402 is awaiting its funded pilot. Free and holder reports remain available."}</p>
    </section>}
    {message && <p className="agent-message" role="status">{message}</p>}{error && <p className="agent-message agent-error" role="alert"><CircleAlert size={16} /> {error}</p>}
  </div>;
}
