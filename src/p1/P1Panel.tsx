import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Bell, Check, CircleAlert, Clock3, FileText, LoaderCircle, ShieldCheck } from "lucide-react";
import { formatUnits, parseUnits } from "viem";
import { createSiweMessage } from "viem/siwe";
import type { RegistryResponse } from "../p0/registry";
import type { EthereumProvider } from "../p0/wallets";
import { MANDATE_TEMPLATES, RULESET_VERSION, type Mandate, type MandateRules, type PreflightReport } from "./rules";
import "./p1.css";

type Props = { path: string; wallet: `0x${string}` | null; walletChain: number | null; provider: EthereumProvider | null; registry: RegistryResponse | null };
type Alert = { id: string; vaultId: string; ruleId: string; severity: string; createdAt: string; readAt: string | null; sourceUri: string; before: unknown; after: unknown };
const BASE = "/api/p1";
const DRAFT = "mandevyr:p1:mandate-draft";

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { method, credentials: "same-origin", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function readDraft(): MandateRules {
  try {
    const raw = localStorage.getItem(DRAFT);
    if (raw) return { ...MANDATE_TEMPLATES.balanced, ...JSON.parse(raw) as Partial<MandateRules> };
  } catch { /* Private browsing may disable storage. */ }
  return MANDATE_TEMPLATES.balanced;
}

function money(raw: string, decimals = 6) { return formatUnits(BigInt(raw), decimals); }
function toRaw(value: string, decimals: number) { return parseUnits(value || "0", decimals).toString(); }
function date(value: string) { return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }); }

function Report({ report }: { report: PreflightReport }) {
  const [viewedAt, setViewedAt] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setViewedAt(Date.now()), 10_000); return () => window.clearInterval(timer); }, []);
  const expired = viewedAt > Date.parse(report.validUntil);
  return <article className="p1-report">
    <div className={`p1-verdict p1-verdict-${report.verdict.toLowerCase()}`}><span>{report.verdict}</span><small>{expired ? "Expired research snapshot" : "Research snapshot · no transaction available"}</small></div>
    <h2>{report.summary}</h2>
    <p>{money(report.intent.amountRaw)} {report.intent.asset} · {report.intent.targetId.replaceAll("-", " ")} · Arc Mainnet</p>
    <div className="p1-report-metadata"><span>Mandate v{report.mandateVersion}</span><span>Ruleset {report.rulesetVersion}</span><span>Created {date(report.createdAt)}</span><span>Valid until {date(report.validUntil)}</span></div>
    <div className="p1-report-grid"><section><h3>What shaped this result</h3><div className="p1-reasons">{report.reasons.map((reason) => <div key={reason.code} className={`p1-reason p1-reason-${reason.severity.toLowerCase()}`}><strong>{reason.code}</strong><p>{reason.text}</p></div>)}</div></section><section><h3>Evidence</h3>{report.evidence.length ? report.evidence.map((source) => <a key={source.uri} className="p1-evidence" href={source.uri} target="_blank" rel="noreferrer"><span>{source.sourceType === "arc_rpc" ? "Arc contract" : "Provider listing"}<small>{source.status} · {source.blockNumber ? `block ${source.blockNumber}` : "editorial review"}</small></span><ArrowUpRight size={18} /></a>) : <p>No verified source was available for this target.</p>}<div className="p1-disclaimer"><ShieldCheck size={18} /><span>Source matching does not establish safety. MANDEVYR cannot submit this intent or reserve any funds.</span></div></section></div>
  </article>;
}

export function P1Panel({ path, wallet, walletChain, provider, registry }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [history, setHistory] = useState<PreflightReport[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [rules, setRules] = useState<MandateRules>(readDraft);
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("50");
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [template, setTemplate] = useState("custom");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const active = mandates[0];
  const signedIn = Boolean(wallet && sessionWallet?.toLowerCase() === wallet.toLowerCase() && walletChain === 5042);
  const suggestedTarget = searchParams.get("target");
  const selectedTargetId = targetId || registry?.items.find((item) => item.id === suggestedTarget)?.id || registry?.items[0]?.id || "";

  const refresh = useCallback(async () => {
    try {
      const me = await request<{ wallet: string }>("/me");
      setSessionWallet(me.wallet);
      setStorageError(null);
      if (!wallet || walletChain !== 5042 || me.wallet.toLowerCase() !== wallet.toLowerCase()) {
        setMandates([]); setHistory([]); setAlerts([]); setWatchedIds([]);
        return;
      }
      const [mandateData, historyData, alertData, watchData] = await Promise.all([
        request<{ items: Mandate[] }>("/mandates"),
        request<{ items: PreflightReport[] }>("/history"),
        request<{ items: Alert[] }>("/alerts").catch(() => ({ items: [] as Alert[] })),
        request<{ items: string[] }>("/watchlist").catch(() => ({ items: [] as string[] })),
      ]);
      setMandates(mandateData.items);
      setHistory(historyData.items);
      setAlerts(alertData.items);
      setWatchedIds(watchData.items);
      if (mandateData.items[0]) setRules(mandateData.items[0].rules);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Account service unavailable.";
      if (message.includes("storage is not configured")) setStorageError(message);
      setSessionWallet(null);
      setMandates([]); setHistory([]); setAlerts([]); setWatchedIds([]);
    }
  }, [wallet, walletChain]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!signedIn) return;
    let local: unknown = [];
    try { local = JSON.parse(localStorage.getItem("mandevyr:p0:watchlist") ?? "[]"); } catch { /* Local watchlist is optional. */ }
    if (!Array.isArray(local)) return;
    const missing = local.filter((id): id is string => typeof id === "string" && !watchedIds.includes(id) && Boolean(registry?.items.some((vault) => vault.id === id)));
    if (!missing.length) return;
    void Promise.all(missing.map((vaultId) => request("/watchlist", "POST", { vaultId }))).then(() => setWatchedIds((previous) => [...new Set([...previous, ...missing])])).catch(() => { /* The user can retry from Watchtower. */ });
  }, [signedIn, watchedIds, registry]);
  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify(rules)); } catch { /* Optional draft. */ } }, [rules]);
  useEffect(() => {
    if (path.startsWith("/app/preflight/") && path !== "/app/preflight/new" && signedIn) {
      void request<PreflightReport>(`/preflights/${encodeURIComponent(path.split("/").at(-1) ?? "")}`).then(setReport).catch((cause) => setError(cause instanceof Error ? cause.message : "Report unavailable."));
    }
  }, [path, signedIn]);

  const signIn = async () => {
    if (!wallet || !provider || walletChain !== 5042) return;
    setBusy(true); setError(null);
    try {
      const nonce = await request<{ nonce: string }>("/auth/nonce", "POST");
      const issuedAt = new Date();
      const message = createSiweMessage({ address: wallet, chainId: 5042, domain: window.location.host, uri: window.location.origin, version: "1", nonce: nonce.nonce, issuedAt, expirationTime: new Date(issuedAt.getTime() + 300_000), statement: "Sign in to save mandates, research reports, and alerts in MANDEVYR. No transaction is requested." });
      const signature = await provider.request({ method: "personal_sign", params: [message, wallet] });
      if (typeof signature !== "string") throw new Error("The wallet did not return a signature.");
      await request("/auth/verify", "POST", { message, signature });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in was cancelled."); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    try { await request("/auth/logout", "POST"); setSessionWallet(null); setMandates([]); setHistory([]); setAlerts([]); setWatchedIds([]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not revoke the session."); }
  };

  const saveMandate = async () => {
    setBusy(true); setError(null);
    try {
      const saved = await request<Mandate>("/mandates", "POST", { rules });
      setMandates((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
      navigate("/app/preflight/new");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mandate could not be saved."); }
    finally { setBusy(false); }
  };

  const runPreflight = async () => {
    const vault = registry?.items.find((item) => item.id === selectedTargetId);
    if (!vault) return;
    setBusy(true); setError(null);
    try {
      const result = await request<PreflightReport>("/preflights", "POST", { intent: { kind: "vault_deposit", chainId: walletChain, targetId: vault.id, targetAddress: vault.address, asset: vault.asset, amountRaw: toRaw(amount, 6) }, idempotencyKey: crypto.randomUUID() });
      setReport(result);
      setHistory((previous) => [result, ...previous]);
      navigate(`/app/preflight/${result.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Preflight could not be created."); }
    finally { setBusy(false); }
  };

  const updateRule = (key: keyof MandateRules, value: MandateRules[keyof MandateRules]) => { setRules((previous) => ({ ...previous, [key]: value })); setTemplate("custom"); };
  const toggleWatch = async (vaultId: string) => {
    setError(null);
    try {
      if (watchedIds.includes(vaultId)) {
        await request(`/watchlist/${vaultId}`, "DELETE");
        setWatchedIds((previous) => previous.filter((id) => id !== vaultId));
        try {
          const local = JSON.parse(localStorage.getItem("mandevyr:p0:watchlist") ?? "[]") as unknown;
          if (Array.isArray(local)) localStorage.setItem("mandevyr:p0:watchlist", JSON.stringify(local.filter((id) => id !== vaultId)));
        } catch { /* Local watchlist is optional. */ }
      } else {
        await request("/watchlist", "POST", { vaultId });
        setWatchedIds((previous) => [...previous, vaultId]);
        try {
          const local = JSON.parse(localStorage.getItem("mandevyr:p0:watchlist") ?? "[]") as unknown;
          if (Array.isArray(local)) localStorage.setItem("mandevyr:p0:watchlist", JSON.stringify([...new Set([...local.filter((id): id is string => typeof id === "string"), vaultId])]));
        } catch { /* Local watchlist is optional. */ }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Watchlist could not be updated."); }
  };
  const acknowledge = async (id: string) => {
    try {
      await request(`/alerts/${id}/ack`, "POST");
      setAlerts((previous) => previous.map((alert) => alert.id === id ? { ...alert, readAt: new Date().toISOString() } : alert));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Alert could not be marked read."); }
  };
  const exportData = async () => {
    try {
      const data = await request<unknown>("/data/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = "mandevyr-research-export.json"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
  };
  const deleteData = async () => {
    if (deleteConfirm !== "DELETE") return;
    setBusy(true); setError(null);
    try {
      await request("/data/delete", "POST", { confirm: deleteConfirm });
      setSessionWallet(null); setMandates([]); setHistory([]); setAlerts([]); setWatchedIds([]); setDeleteConfirm("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Deletion failed."); }
    finally { setBusy(false); }
  };
  const title = path === "/app/mandate" ? "Set your boundaries." : path === "/app/history" ? "Your decisions, kept." : path === "/app/watch" ? "Know what changed." : "Check before you move.";
  const description = path === "/app/mandate" ? "A mandate turns your limits into rules. Every change creates a new version; old reports keep the version they used." : path === "/app/history" ? "Read past research with the rules and sources that shaped it." : path === "/app/watch" ? "Changes to your watched vaults appear here with the source that triggered them." : "Test a planned vault deposit against your active mandate and fresh onchain evidence. No wallet transaction is sent.";

  return <div className="p1-page">
    <header className="p1-heading"><div><h1 tabIndex={-1}>{title}</h1><p>{description}</p></div><div className="p1-heading-actions"><span className="p1-phase">Research only · Arc Mainnet</span>{sessionWallet && <button type="button" onClick={() => void signOut()}>Sign out</button>}</div></header>
    {storageError && <div className="p1-message" role="alert"><CircleAlert size={19} />{storageError}</div>}
    {error && <div className="p1-message" role="alert"><CircleAlert size={19} />{error}<button type="button" onClick={() => setError(null)}>Dismiss</button></div>}
    {!signedIn && <div className="p1-signin"><div><ShieldCheck size={25} /><strong>Save your research to this wallet</strong><p>{!wallet ? "Connect a wallet using the button above, then sign a message to create your private workspace." : walletChain !== 5042 ? "Switch your wallet to Arc Mainnet to sign in." : sessionWallet ? "This browser is signed in with a different wallet. Sign in again to use this address." : "One message proves wallet ownership. It costs no gas and cannot move funds."}</p></div><button type="button" disabled={!wallet || !provider || walletChain !== 5042 || busy || Boolean(storageError)} onClick={() => void signIn()}>{busy ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />} Sign in with wallet</button></div>}
    {path === "/app/mandate" && <div className="p1-layout"><section className="p1-card"><div className="p1-card-head"><h2>Mandate Studio</h2>{active && <span>Current version {active.version}</span>}</div><p className="p1-muted">Choose a starting point, then change any limit to match your own decisions.</p><div className="p1-templates">{(["conservative", "balanced", "explorer"] as const).map((name) => <button className={template === name ? "selected" : ""} key={name} type="button" onClick={() => { setRules(MANDATE_TEMPLATES[name]); setTemplate(name); }}>{name}</button>)}</div><div className="p1-fields"><label>Maximum per action <span>USDC equivalent</span><input inputMode="decimal" type="number" min="0.000001" step="any" value={money(rules.maxActionRaw)} onChange={(event) => { try { updateRule("maxActionRaw", toRaw(event.target.value, 6)); } catch { /* Wait for valid input. */ } }} /></label><label>Maximum per 24 hours <span>USDC equivalent</span><input inputMode="decimal" type="number" min="0.000001" step="any" value={money(rules.maxDailyRaw)} onChange={(event) => { try { updateRule("maxDailyRaw", toRaw(event.target.value, 6)); } catch { /* Wait for valid input. */ } }} /></label><label>Maximum gas estimate <span>Arc native USDC</span><input inputMode="decimal" type="number" min="0" step="any" value={money(rules.maxGasRaw, 18)} onChange={(event) => { try { updateRule("maxGasRaw", toRaw(event.target.value, 18)); } catch { /* Wait for valid input. */ } }} /></label><label>Maximum evidence age <span>seconds</span><input type="number" min="30" max="120" value={rules.maxEvidenceAgeSeconds} onChange={(event) => updateRule("maxEvidenceAgeSeconds", Number(event.target.value))} /></label></div><div className="p1-checks"><label><input type="checkbox" checked={rules.allowedAssets.includes("USDC")} onChange={(event) => updateRule("allowedAssets", event.target.checked ? [...rules.allowedAssets, "USDC"] : rules.allowedAssets.filter((asset) => asset !== "USDC"))} /> USDC vaults</label><label><input type="checkbox" checked={rules.allowedAssets.includes("EURC")} onChange={(event) => updateRule("allowedAssets", event.target.checked ? [...rules.allowedAssets, "EURC"] : rules.allowedAssets.filter((asset) => asset !== "EURC"))} /> EURC vaults</label><label><input type="checkbox" checked={rules.requireAvailableWithdrawal} onChange={(event) => updateRule("requireAvailableWithdrawal", event.target.checked)} /> Require proven withdrawal capacity</label></div><fieldset className="p1-deny"><legend>Blocked targets</legend>{registry?.items.map((vault) => <label key={vault.id}><input type="checkbox" checked={rules.deniedTargets.includes(vault.id)} onChange={(event) => updateRule("deniedTargets", event.target.checked ? [...rules.deniedTargets, vault.id] : rules.deniedTargets.filter((item) => item !== vault.id))} />{vault.name}</label>)}</fieldset><p className="p1-muted">Withdrawals for these Morpho Vault V2 entries are not independently proven. Requiring capacity will make their result UNKNOWN. Gas and 24-hour spending cannot yet be verified across apps.</p><button className="p1-primary" type="button" disabled={!signedIn || busy} onClick={() => void saveMandate()}>{busy ? "Saving…" : active ? "Save new version" : "Save mandate"}<ArrowRight size={17} /></button></section><aside className="p1-card"><h2>Version history</h2>{mandates.length ? mandates.map((mandate) => <div className="p1-version" key={mandate.id}><strong>Version {mandate.version}</strong><span>{date(mandate.createdAt)}</span><small>{money(mandate.rules.maxActionRaw)} per action · {mandate.rules.allowedAssets.join(" / ")}</small></div>) : <p className="p1-muted">Your first saved mandate will appear here. Drafts stay in this browser.</p>}</aside></div>}
    {path === "/app/mandate" && signedIn && <section className="p1-card p1-data-tools"><div><h2>Your data</h2><p className="p1-muted">Export the mandates, reports, and alerts saved by MANDEVYR. Deleting them does not remove public onchain history.</p><button type="button" className="p1-text-link" onClick={() => void exportData()}>Download JSON export <ArrowUpRight size={15} /></button></div><div><label>Delete MANDEVYR data <span>Type DELETE to confirm</span><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} autoComplete="off" /></label><button type="button" disabled={deleteConfirm !== "DELETE" || busy} onClick={() => void deleteData()}>Delete account data</button></div></section>}
    {path === "/app/preflight/new" && <div className="p1-layout"><section className="p1-card"><div className="p1-card-head"><h2>New preflight</h2><span>{active ? `Mandate v${active.version}` : "Mandate required"}</span></div><p className="p1-muted">Research a deposit into one reviewed Morpho vault. This does not quote, simulate, sign, or submit a transaction.</p><div className="p1-fields p1-fields-single"><label>Vault<select value={selectedTargetId} onChange={(event) => setTargetId(event.target.value)}>{registry?.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.asset}</option>)}</select></label><label>Planned amount <span>{registry?.items.find((item) => item.id === selectedTargetId)?.asset ?? "asset units"}</span><input inputMode="decimal" type="number" min="0.000001" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} /></label></div><div className="p1-callout"><Clock3 size={17} /><span>Evidence is fetched again when you run the check. A saved report is immutable; rerun it after any amount, wallet, or mandate change.</span></div>{!active && <Link className="p1-text-link" to="/app/mandate">Create a mandate <ArrowRight size={15} /></Link>}<button className="p1-primary" type="button" disabled={!signedIn || !active || !selectedTargetId || busy} onClick={() => void runPreflight()}>{busy ? "Checking sources…" : "Run preflight"}<ArrowRight size={17} /></button></section><aside className="p1-card"><h2>How a result works</h2><div className="p1-explain"><span>BLOCK</span><p>A network, target, asset, or mandate rule was violated.</p><span>UNKNOWN</span><p>Essential evidence is missing or stale.</p><span>REVIEW</span><p>No hard stop, but research questions remain. Transactions are unavailable in P1.</p></div></aside></div>}
    {path.startsWith("/app/preflight/") && path !== "/app/preflight/new" && <>{report ? <Report report={report} /> : <div className="p1-card p1-center">{signedIn && !error ? <><LoaderCircle size={21} className="spin" /> Loading report…</> : "Sign in with the wallet that created this report to view it."}</div>}<Link className="p1-text-link" to="/app/preflight/new">Run another preflight <ArrowRight size={15} /></Link></>}
    {path === "/app/history" && <section className="p1-card"><div className="p1-card-head"><h2>Saved reports</h2><span>{history.length} reports</span></div>{history.length ? <div className="p1-history">{history.map((item) => <Link key={item.id} to={`/app/preflight/${item.id}`}><span className={`p1-mini-verdict p1-verdict-${item.verdict.toLowerCase()}`}>{item.verdict}</span><strong>{item.intent.targetId.replaceAll("-", " ")}</strong><span>{money(item.intent.amountRaw)} {item.intent.asset}</span><small>{date(item.createdAt)}</small><ArrowUpRight size={17} /></Link>)}</div> : <div className="p1-empty"><FileText size={25} /><p>No reports yet. Run a preflight to keep its evidence and mandate version.</p><Link to="/app/preflight/new">Create preflight <ArrowRight size={15} /></Link></div>}</section>}
    {path === "/app/watch" && <div className="p1-layout"><section className="p1-card"><div className="p1-card-head"><h2>Alert inbox</h2><span>{alerts.filter((item) => !item.readAt).length} unread</span></div>{alerts.length ? alerts.map((alert) => <article className="p1-alert" key={alert.id}><div><Bell size={18} /><strong>{alert.ruleId.replaceAll("_", " ")}</strong><span>{alert.severity}</span></div><p>{alert.vaultId.replaceAll("-", " ")} · {date(alert.createdAt)}</p><a href={alert.sourceUri} target="_blank" rel="noreferrer">Inspect source <ArrowUpRight size={15} /></a>{!alert.readAt && <button type="button" onClick={() => void acknowledge(alert.id)}>Mark read</button>}</article>) : <div className="p1-empty"><Bell size={25} /><p>No changes have been recorded for your saved vaults. Watchtower checks source availability, not APY or withdrawal liquidity.</p></div>}</section><aside className="p1-card"><h2>Monitored vaults</h2><p className="p1-muted">The scheduled check compares source availability every 15 minutes when the Cloudflare Worker is deployed. It never sends a transaction.</p>{registry?.items.map((vault) => <label className="p1-watch-choice" key={vault.id}><input type="checkbox" checked={watchedIds.includes(vault.id)} disabled={!signedIn} onChange={() => void toggleWatch(vault.id)} /><span>{vault.name}<small>{vault.asset} · {vault.provider}</small></span></label>)}<p className="p1-muted">Status changes appear at most once per vault and rule per day. Provider outages are evidence alerts, not proof of vault loss.</p></aside></div>}
    <footer className="p1-footer"><Check size={14} /> Ruleset {RULESET_VERSION} · Read-only research · MANDEVYR cannot transact for you.</footer>
  </div>;
}
