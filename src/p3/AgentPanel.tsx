import { useCallback, useEffect, useState } from "react";
import { createSiweMessage } from "viem/siwe";
import { formatUnits, parseUnits } from "viem";
import { ArrowRight, CircleAlert, Code2, LockKeyhole, ShieldCheck, Wallet } from "lucide-react";
import type { EthereumProvider } from "../p0/wallets";
import { DEFAULT_AGENT_POLICY, type AgentPolicy } from "./policy";
import "./agent.css";

type Props = { wallet: `0x${string}` | null; walletChain: number | null; provider: EthereumProvider | null };
type Seller = { enabled: boolean; network: string; priceUsdc: string; priceRaw: string; resource: string; facilitator: string };
type Review = { id: string; resource_url: string; purpose: string; price_raw: string; decision: string; reason: string; created_at: string };
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
  const [resourceUrl, setResourceUrl] = useState("");
  const [purpose, setPurpose] = useState("");
  const [price, setPrice] = useState("0.01");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = Boolean(wallet && walletChain === 5042 && sessionWallet?.toLowerCase() === wallet.toLowerCase());

  const refresh = useCallback(async () => {
    const [config, me] = await Promise.all([api<Seller>("/x402/config"), api<{ wallet: string }>("/me").catch(() => null)]);
    setSeller(config); setSessionWallet(me?.wallet ?? null);
    if (!me?.wallet || !wallet || walletChain !== 5042 || me.wallet.toLowerCase() !== wallet.toLowerCase()) { setReviews([]); return; }
    const [saved, ledger] = await Promise.all([api<{ policy: AgentPolicy }>("/agent/policy"), api<{ items: Review[] }>("/agent/reviews")]);
    setPolicy(saved.policy); setOrigins(saved.policy.allowedOrigins.join("\n")); setPaths(saved.policy.allowedPathPrefixes.join("\n")); setReviews(ledger.items);
  }, [wallet, walletChain]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Agent service unavailable.")); }, 0); return () => window.clearTimeout(timer); }, [refresh]);

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

  return <div className="agent-page">
    <section className="agent-hero"><span className="agent-kicker">P3 / AGENT & API ECONOMY</span><h1>An API with <em>clear boundaries.</em></h1><p>MANDEVYR can sell a deterministic report deep dive over x402 on Arc. Agent spending policies keep domains, endpoints, and USDC amounts visible before any wallet action.</p><div className="agent-hero-badges"><span><Code2 size={15} /> x402 v2 · Arc Mainnet</span><span><ShieldCheck size={15} /> Human wallet approval</span></div></section>
    <div className="agent-grid"><section className="agent-card"><span className="agent-kicker">01 / SELLER API</span><h2>Deep-dive endpoint</h2><p>Price: <strong>{seller?.priceUsdc ?? "—"} USDC</strong> per saved report. A caller must own the report through wallet sign-in before the API presents a 402 payment request.</p><code>GET {seller?.resource ?? "/api/p1/x402/reports/{report_id}/deep-dive"}</code><div className={`agent-status ${seller?.enabled ? "agent-live" : ""}`}>{seller?.enabled ? "Paid endpoint enabled" : "Paid endpoint awaiting final payment test"}</div><small>Facilitator: {seller?.facilitator ?? "Arcus"}. Settlement and gas are handled by the facilitator. Existing free and holder report access stays available.</small></section>
      <section className="agent-card"><span className="agent-kicker">02 / BUYER CONTROLS</span><h2>One request at a time.</h2><p>Save an allowlist and caps for an agent request review. The review records its purpose and quoted price. This workspace does not submit an external x402 payment automatically.</p>{!signedIn && <button type="button" className="agent-button" disabled={!wallet || walletChain !== 5042 || busy} onClick={() => void signIn()}><Wallet size={16} /> {wallet ? walletChain === 5042 ? "Sign in to set policy" : "Switch wallet to Arc" : "Connect wallet above"} <ArrowRight size={16} /></button>}<div className="agent-human"><LockKeyhole size={16} /> Manual approval stays required.</div></section></div>
    {signedIn && <><section className="agent-card agent-policy"><div><span className="agent-kicker">03 / SPENDING POLICY</span><h2>Define the edge.</h2></div><div className="agent-form-grid"><label>Allowed HTTPS origins, one per line<textarea value={origins} onChange={(e) => setOrigins(e.target.value)} rows={3} placeholder="https://api.example.com" /></label><label>Allowed endpoint prefixes, one per line<textarea value={paths} onChange={(e) => setPaths(e.target.value)} rows={3} placeholder="/v1/reports/" /></label><label>Per-request cap, USDC<input type="text" inputMode="decimal" value={formatUnits(BigInt(policy.maxPerRequestRaw), 6)} onChange={(e) => { try { setPolicy({ ...policy, maxPerRequestRaw: parseUnits(e.target.value, 6).toString() }); } catch { /* Keep last valid value. */ } }} /></label><label>Daily review cap, USDC<input type="text" inputMode="decimal" value={formatUnits(BigInt(policy.maxDailyRaw), 6)} onChange={(e) => { try { setPolicy({ ...policy, maxDailyRaw: parseUnits(e.target.value, 6).toString() }); } catch { /* Keep last valid value. */ } }} /></label></div><label className="agent-toggle"><input type="checkbox" checked={policy.enabled} onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })} /> Enable policy reviews</label><button type="button" className="agent-button" onClick={() => void save()} disabled={busy}>Save policy <ArrowRight size={16} /></button></section>
      <section className="agent-card agent-policy"><span className="agent-kicker">04 / REVIEW A REQUEST</span><h2>Check before paying.</h2><div className="agent-form-grid"><label>Resource URL<input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://api.example.com/v1/reports/123" /></label><label>Purpose<input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Fetch a research report" /></label><label>Quoted price, USDC<input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" /></label></div><button type="button" className="agent-button" onClick={() => void review()} disabled={busy}>Review request <ArrowRight size={16} /></button><p className="agent-note">Enter a quote you obtained from the seller. MANDEVYR checks your policy but does not verify this external quote or move funds.</p></section>
      <section className="agent-card agent-policy"><span className="agent-kicker">05 / AUDIT TRAIL</span><h2>Recent reviews.</h2>{reviews.length === 0 ? <p>No requests reviewed yet.</p> : <div className="agent-reviews">{reviews.map((item) => <article key={item.id}><strong className={item.decision === "allowed" ? "agent-allowed" : "agent-blocked"}>{item.decision.toUpperCase()}</strong><span>{item.purpose}<small>{item.resource_url} · {formatUnits(BigInt(item.price_raw), 6)} USDC</small></span><time>{new Date(item.created_at).toLocaleString()}</time></article>)}</div>}</section></>}
    {message && <p className="agent-message" role="status">{message}</p>}{error && <p className="agent-message agent-error" role="alert"><CircleAlert size={16} /> {error}</p>}
  </div>;
}
