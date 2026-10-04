import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, Check, ChevronDown, CircleAlert, Clock3, Compass, FileText, History, LoaderCircle, LockKeyhole, Scale, ScanLine, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { formatUnits, parseUnits } from "viem";
import { createSiweMessage } from "viem/siwe";
import type { RegistryResponse } from "../p0/registry";
import { VaultLogo } from "../p0/VaultLogo";
import type { EthereumProvider } from "../p0/wallets";
import { MANDATE_TEMPLATES, type Mandate, type MandateRules, type PreflightReport } from "./rules";
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

  const updateRule = (key: keyof MandateRules, value: MandateRules[keyof MandateRules]) => { setRules((previous) => ({ ...previous, [key]: value })); };
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
  const headings = path === "/app/mandate"
    ? { start: "Your rules.", end: "Your rhythm.", description: "Define your limits once. Bring them to every decision." }
    : path === "/app/history"
      ? { start: "Every decision.", end: "In perspective.", description: "Revisit the evidence, the reasoning, and the rules behind your research." }
      : path === "/app/watch"
        ? { start: "Stay curious.", end: "Stay informed.", description: "Follow your vaults. Keep changes to their source data in view." }
        : { start: "A closer look.", end: "Before you move.", description: "Explore a planned deposit with your limits and onchain evidence in the same frame." };
  const selectedVault = registry?.items.find((item) => item.id === selectedTargetId);
  const templates = [
    { name: "conservative", label: "Conservative", note: "A smaller starting point", icon: ShieldCheck },
    { name: "balanced", label: "Balanced", note: "Room to find your balance", icon: Scale },
    { name: "explorer", label: "Explorer", note: "More room to explore", icon: Compass },
  ] as const;
  const template = templates.find(({ name }) => JSON.stringify(MANDATE_TEMPLATES[name]) === JSON.stringify(rules))?.name;

  return <div className="p1-page">
    <header className="p1-heading">
      <div><h1 tabIndex={-1}>{headings.start}<br /><em>{headings.end}</em></h1><p>{headings.description}</p></div>
      {sessionWallet && <button className="p1-signout" type="button" onClick={() => void signOut()}>Sign out <ArrowUpRight size={15} /></button>}
    </header>
    {storageError && <div className="p1-message" role="alert"><CircleAlert size={19} />{storageError}</div>}
    {error && <div className="p1-message" role="alert"><CircleAlert size={19} />{error}<button type="button" onClick={() => setError(null)}>Dismiss</button></div>}
    {!signedIn && <div className="p1-signin">
      <div className="p1-signin-icon"><LockKeyhole size={21} strokeWidth={1.5} /></div>
      <div className="p1-signin-copy"><strong>A workspace that stays with you.</strong><p>{!wallet ? "Connect your wallet above, then sign in to save your research." : walletChain !== 5042 ? "Switch your wallet to Arc Mainnet to sign in." : sessionWallet ? "Sign in again to use the wallet you just connected." : "Sign a message to save your work. No gas fee or transaction."}</p></div>
      <button type="button" disabled={!wallet || !provider || walletChain !== 5042 || busy || Boolean(storageError)} onClick={() => void signIn()}>{busy ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />} Sign in with wallet</button>
    </div>}

    {path === "/app/mandate" && <div className="p1-layout p1-mandate-layout">
      <section className="p1-card p1-studio">
        <div className="p1-card-head"><div><h2>Make it yours.</h2><p className="p1-muted">Choose a starting point. Every limit is yours to change.</p></div><SlidersHorizontal size={21} strokeWidth={1.5} /></div>
        <div className="p1-templates" aria-label="Mandate templates">
          {templates.map(({ name, label, note, icon: Icon }) => <button className={template === name ? "selected" : ""} key={name} type="button" aria-pressed={template === name} onClick={() => setRules(MANDATE_TEMPLATES[name])}>
            <span className="p1-template-top"><Icon size={22} strokeWidth={1.5} /><span className="p1-radio-dot">{template === name && <Check size={11} />}</span></span>
            <strong>{label}</strong><small>{note}</small>
          </button>)}
        </div>
        <div className="p1-section-label"><h3>Set your limits</h3><span>USDC</span></div>
        <div className="p1-fields p1-money-fields">
          <label><span className="p1-field-name">Per action</span><span className="p1-input-wrap"><input aria-label="Maximum per action" inputMode="decimal" type="number" min="0.000001" step="any" value={money(rules.maxActionRaw)} onChange={(event) => { try { updateRule("maxActionRaw", toRaw(event.target.value, 6)); } catch { /* Wait for valid input. */ } }} /><span>USDC</span></span></label>
          <label><span className="p1-field-name">Per 24 hours</span><span className="p1-input-wrap"><input aria-label="Maximum per 24 hours" inputMode="decimal" type="number" min="0.000001" step="any" value={money(rules.maxDailyRaw)} onChange={(event) => { try { updateRule("maxDailyRaw", toRaw(event.target.value, 6)); } catch { /* Wait for valid input. */ } }} /><span>USDC</span></span></label>
        </div>
        <div className="p1-section-label"><h3>EURC action limits</h3><span>EURC</span></div>
        <div className="p1-fields p1-money-fields">
          <label><span className="p1-field-name">Per action (0 disables deposits)</span><span className="p1-input-wrap"><input aria-label="Maximum EURC per action" inputMode="decimal" type="number" min="0" step="any" value={money(rules.maxEurcActionRaw ?? "0")} onChange={(event) => { try { updateRule("maxEurcActionRaw", toRaw(event.target.value, 6)); } catch { /* Wait for valid input. */ } }} /><span>EURC</span></span></label>
          <label><span className="p1-field-name">Per 24 hours</span><span className="p1-input-wrap"><input aria-label="Maximum EURC per 24 hours" inputMode="decimal" type="number" min="0" step="any" value={money(rules.maxEurcDailyRaw ?? "0")} onChange={(event) => { try { updateRule("maxEurcDailyRaw", toRaw(event.target.value, 6)); } catch { /* Wait for valid input. */ } }} /><span>EURC</span></span></label>
        </div>
        <div className="p1-fields">
          <label><span className="p1-field-name">Maximum gas estimate</span><span className="p1-input-wrap"><input aria-label="Maximum gas estimate" inputMode="decimal" type="number" min="0" step="any" value={money(rules.maxGasRaw, 18)} onChange={(event) => { try { updateRule("maxGasRaw", toRaw(event.target.value, 18)); } catch { /* Wait for valid input. */ } }} /><span>USDC</span></span></label>
          <label><span className="p1-field-name">Maximum evidence age</span><span className="p1-input-wrap"><input aria-label="Maximum evidence age" type="number" min="30" max="120" value={rules.maxEvidenceAgeSeconds} onChange={(event) => updateRule("maxEvidenceAgeSeconds", Number(event.target.value))} /><span>sec</span></span></label>
        </div>
        <div className="p1-section-label"><h3>Assets & access</h3></div>
        <div className="p1-assets">
          {(["USDC", "EURC"] as const).map((asset) => <label className={rules.allowedAssets.includes(asset) ? "is-checked" : ""} key={asset}><img src={`/brand/vaults/${asset.toLowerCase()}.svg`} alt="" width={30} height={30} /><span>{asset}<small>{asset === "USDC" ? "US dollar" : "Euro"} vaults</small></span><input type="checkbox" checked={rules.allowedAssets.includes(asset)} onChange={(event) => updateRule("allowedAssets", event.target.checked ? [...rules.allowedAssets, asset] : rules.allowedAssets.filter((item) => item !== asset))} aria-label={`Allow ${asset} vaults`} /></label>)}
        </div>
        <label className="p1-toggle-row"><span>Proven withdrawal capacity<small>Require evidence that funds can be withdrawn.</small></span><input className="p1-switch" type="checkbox" checked={rules.requireAvailableWithdrawal} onChange={(event) => updateRule("requireAvailableWithdrawal", event.target.checked)} /></label>
        <details className="p1-advanced"><summary>Blocked vaults <span>{rules.deniedTargets.length ? `${rules.deniedTargets.length} selected` : "Optional"}</span><ChevronDown size={16} /></summary><div className="p1-deny">{registry?.items.map((vault) => <label key={vault.id}><input type="checkbox" checked={rules.deniedTargets.includes(vault.id)} onChange={(event) => updateRule("deniedTargets", event.target.checked ? [...rules.deniedTargets, vault.id] : rules.deniedTargets.filter((item) => item !== vault.id))} />{vault.name}</label>)}</div></details>
        <div className="p1-callout"><CircleAlert size={17} /><p>Withdrawal capacity, transaction gas, and spending across other apps are not yet verified. Requiring proven withdrawal capacity returns an UNKNOWN result for these vaults.</p></div>
        <div className="p1-save-row"><span>{signedIn ? "Changes create a new version." : "Your draft stays in this browser."}</span><button className="p1-primary" type="button" disabled={!signedIn || busy} onClick={() => void saveMandate()}>{busy ? "Saving…" : active ? "Save new version" : "Save mandate"}<ArrowRight size={17} /></button></div>
      </section>
      <aside className="p1-side-stack">
        <section className="p1-mandate-preview">
          <div className="p1-preview-top"><ShieldCheck size={24} strokeWidth={1.5} /><span>Draft mandate</span></div>
          <h2>A little structure.<br /><em>A clearer decision.</em></h2>
          <div className="p1-preview-amount"><strong>{money(rules.maxActionRaw)}</strong><span>USDC per action</span></div>
          <dl><div><dt>Daily limit</dt><dd>{money(rules.maxDailyRaw)} USDC</dd></div><div><dt>Allowed assets</dt><dd>{rules.allowedAssets.join(" · ") || "None selected"}</dd></div><div><dt>Evidence age</dt><dd>Up to {rules.maxEvidenceAgeSeconds}s</dd></div><div><dt>Approval</dt><dd>Always manual</dd></div></dl>
          <p><LockKeyhole size={15} /> You keep the final say.</p>
        </section>
        <section className="p1-card p1-version-card"><div className="p1-card-head"><h2>Version history</h2><History size={19} strokeWidth={1.5} /></div>{mandates.length ? mandates.map((mandate, index) => <div className="p1-version" key={mandate.id}><div><strong>Version {mandate.version}</strong>{index === 0 && <span className="p1-tag">Current</span>}</div><span>{date(mandate.createdAt)}</span><small>{money(mandate.rules.maxActionRaw)} USDC per action · {mandate.rules.allowedAssets.join(" / ")}</small></div>) : <div className="p1-version-empty"><span className="p1-version-line" aria-hidden="true"><i /><i /><i /></span><p>Your first saved mandate starts the story. Each change gets its own version.</p></div>}</section>
      </aside>
    </div>}
    {path === "/app/mandate" && signedIn && <details className="p1-card p1-account"><summary>Your workspace data <ChevronDown size={17} /></summary><div className="p1-data-tools"><div><h3>Take your research with you.</h3><p className="p1-muted">Download your saved mandates, reports, and alerts.</p><button type="button" className="p1-text-link" onClick={() => void exportData()}><ArrowDownToLine size={16} /> Export data</button></div><div><label>Delete account data <span>This does not remove public onchain history. Type DELETE to confirm.</span><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} autoComplete="off" /></label><button type="button" disabled={deleteConfirm !== "DELETE" || busy} onClick={() => void deleteData()}>Delete account data</button></div></div></details>}

    {path === "/app/preflight/new" && <div className="p1-layout">
      <section className="p1-card p1-preflight-form">
        <div className="p1-card-head"><h2>What are you exploring?</h2><span className="p1-tag">{active ? `Mandate v${active.version}` : "Draft check"}</span></div>
        <p className="p1-muted">Choose a vault and an amount to research.</p>
        <div className="p1-fields p1-fields-single"><label><span className="p1-field-name">Your vault</span><select value={selectedTargetId} onChange={(event) => setTargetId(event.target.value)}>{registry?.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.asset}</option>)}</select></label></div>
        {selectedVault && <div className="p1-vault-summary"><VaultLogo vault={selectedVault} /><div><strong>{selectedVault.name}</strong><span>{selectedVault.curator} · Arc Mainnet</span></div><a href={selectedVault.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${selectedVault.name} on Morpho`}><ArrowUpRight size={20} /></a></div>}
        <div className="p1-fields p1-fields-single p1-amount-field"><label><span className="p1-field-name">Planned amount</span><span className="p1-input-wrap"><input aria-label="Planned amount" inputMode="decimal" type="number" min="0.000001" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} /><span>{selectedVault?.asset ?? "Asset units"}</span></span></label></div>
        <div className="p1-preflight-facts"><div><span>Active mandate</span>{active ? <strong>Version {active.version}</strong> : <Link to="/app/mandate">Create a mandate <ArrowUpRight size={14} /></Link>}</div><div><span>Network</span><strong>Arc Mainnet</strong></div><div><span>Transaction</span><strong>None requested</strong></div></div>
        <button className="p1-primary p1-primary-wide" type="button" disabled={!signedIn || !active || !selectedTargetId || busy} onClick={() => void runPreflight()}>{busy ? <><LoaderCircle size={17} className="spin" /> Checking sources…</> : <>Run preflight <ArrowRight size={17} /></>}</button>
        <p className="p1-form-note"><LockKeyhole size={14} /> Research only. No funds move and no transaction is signed.</p>
      </section>
      <aside className="p1-card p1-guide"><div className="p1-guide-symbol" aria-hidden="true"><ScanLine size={38} strokeWidth={1} /></div><h2>Clarity comes<br /><em>before action.</em></h2><p className="p1-muted">Your limits and source evidence shape the result.</p><div className="p1-explain"><div><span className="p1-status-dot is-block" /><section><strong>Block</strong><p>A network, target, asset, or mandate rule was violated.</p></section></div><div><span className="p1-status-dot is-unknown" /><section><strong>Unknown</strong><p>Essential evidence is missing or too old to rely on.</p></section></div><div><span className="p1-status-dot is-review" /><section><strong>Review</strong><p>No hard stop, but questions remain for your own review.</p></section></div></div><div className="p1-callout"><Clock3 size={16} /><p>Each result is a saved snapshot. Run a new check when your plans or mandate change.</p></div></aside>
    </div>}
    {path.startsWith("/app/preflight/") && path !== "/app/preflight/new" && <>{report ? <Report report={report} /> : <div className="p1-card p1-center">{signedIn && !error ? <><LoaderCircle size={26} className="spin" /><p>Opening your research…</p></> : <><LockKeyhole size={28} /><p>Sign in with the wallet that created this report to view it.</p></>}</div>}<Link className="p1-text-link" to="/app/preflight/new">Run another preflight <ArrowRight size={15} /></Link></>}

    {path === "/app/history" && <section className="p1-card p1-history-card">
      <div className="p1-card-head"><div><h2>Your research library</h2><p className="p1-muted">Every snapshot keeps its original evidence and mandate.</p></div><span className="p1-tag">{history.length} {history.length === 1 ? "report" : "reports"}</span></div>
      {history.length ? <><div className="p1-history-labels" aria-hidden="true"><span>Result</span><span>Vault</span><span>Amount</span><span>Created</span><span /></div><div className="p1-history">{history.map((item) => <Link key={item.id} to={`/app/preflight/${item.id}`}><span className={`p1-mini-verdict p1-verdict-${item.verdict.toLowerCase()}`}>{item.verdict}</span><strong>{item.intent.targetId.replaceAll("-", " ")}<small>Mandate v{item.mandateVersion}</small></strong><span>{money(item.intent.amountRaw)} {item.intent.asset}</span><time dateTime={item.createdAt}>{date(item.createdAt)}</time><ArrowUpRight size={18} /></Link>)}</div></> : <div className="p1-empty"><div className="p1-paper-art" aria-hidden="true"><div /><div /><div><FileText size={27} strokeWidth={1.2} /><i /><i /><i /></div></div><h3>Your next decision starts here.</h3><p>Run your first preflight. Its evidence, limits, and reasoning will be waiting here whenever you need them.</p><Link className="p1-primary" to="/app/preflight/new">Create your first preflight <ArrowRight size={17} /></Link></div>}
    </section>}

    {path === "/app/watch" && <div className="p1-layout">
      <section className="p1-card p1-watch-inbox"><div className="p1-card-head"><div><h2>Your watchtower</h2><p className="p1-muted">Source changes, with the context attached.</p></div><span className="p1-tag">{alerts.filter((item) => !item.readAt).length} unread</span></div>
        {alerts.length ? alerts.map((alert) => <article className={`p1-alert ${alert.readAt ? "is-read" : ""}`} key={alert.id}><div className="p1-alert-symbol"><Bell size={18} /></div><div className="p1-alert-content"><div><strong>{alert.ruleId === "SOURCE_RESTORED" ? "Source available again" : alert.ruleId === "SOURCE_UNAVAILABLE" ? "Source needs a closer look" : alert.ruleId.replaceAll("_", " ")}</strong><span>{alert.severity}</span></div><p>{alert.vaultId.replaceAll("-", " ")}</p><time dateTime={alert.createdAt}>{date(alert.createdAt)}</time><div className="p1-alert-actions"><a href={alert.sourceUri} target="_blank" rel="noreferrer">Inspect source <ArrowUpRight size={15} /></a>{!alert.readAt && <button type="button" onClick={() => void acknowledge(alert.id)}>Mark read <Check size={14} /></button>}</div></div></article>) : <div className="p1-empty"><div className="p1-watch-art" aria-hidden="true"><i /><i /><i /><span><Bell size={29} strokeWidth={1.3} /></span></div><h3>A little less noise.</h3><p>No source changes recorded yet. Choose the vaults you want to follow; their updates will collect here.</p></div>}
      </section>
      <aside className="p1-card p1-watch-settings"><div className="p1-card-head"><h2>Keep an eye on</h2><span className="p1-tag">{watchedIds.length} saved</span></div><p className="p1-muted">Choose which vaults belong in your view.</p>{registry?.items.map((vault) => <label className="p1-watch-choice" key={vault.id}><VaultLogo vault={vault} /><span>{vault.name}<small>{vault.asset} · {vault.provider}</small></span><input className="p1-switch" type="checkbox" checked={watchedIds.includes(vault.id)} disabled={!signedIn} onChange={() => void toggleWatch(vault.id)} aria-label={`Monitor ${vault.name}`} /></label>)}<div className="p1-callout"><Clock3 size={17} /><p>Source checks run every 15 minutes once scheduled monitoring is deployed. Changes are grouped by vault and rule each day.</p></div><p className="p1-watch-note">Monitoring covers source availability. APY and withdrawal liquidity are not monitored.</p></aside>
    </div>}
  </div>;
}
