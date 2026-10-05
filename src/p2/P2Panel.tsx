import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Check, CircleAlert, Clock3, ExternalLink, Layers3, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { formatUnits, toHex } from "viem";
import { VAULTS, type RegistryResponse } from "../p0/registry";
import { VaultLogo } from "../p0/VaultLogo";
import type { EthereumProvider } from "../p0/wallets";
import type { Mandate } from "../p1/rules";
import { canPrompt, formatP2Error, isExpired, parseAssetAmount, P2_CHAIN_ID, type ActionKind, type PreparedAction } from "./core";
import "./p2.css";

type Props = { wallet: `0x${string}` | null; walletChain: number | null; provider: EthereumProvider | null; previewOnly?: boolean };
type ActionVault = { id: string; name: string; vault: string; asset: string; assetSymbol: "USDC" | "EURC"; sourceUrl: string };
type Config = { chainId: number; network: string; vaults: ActionVault[]; explorer: string; configured: boolean; writesEnabled: boolean };
type Evidence = { vaultId: string; chainId: number; blockNumber: string; observedAt: string };
const BASE = "/api/p1";
const txKey = (id: string) => `mandevyr:p2:tx:${id}`;

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { method, credentials: "same-origin", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

async function previewRegistry(): Promise<RegistryResponse> {
  const response = await fetch("/api/registry", { cache: "no-store" });
  if (!response.ok) throw new Error("Arc registry unavailable.");
  const registry = await response.json() as RegistryResponse;
  if (registry.chainId !== P2_CHAIN_ID || !Array.isArray(registry.items) || registry.items.length !== VAULTS.length ||
    VAULTS.some((vault) => !registry.items.some((item) => item.id === vault.id && item.address.toLowerCase() === vault.address.toLowerCase() && item.assetAddress.toLowerCase() === vault.assetAddress.toLowerCase()))) {
    throw new Error("Arc registry does not match the reviewed vaults.");
  }
  return registry;
}

function short(value: string) { return `${value.slice(0, 8)}…${value.slice(-6)}`; }
function money(raw: string, decimals = 6) { return formatUnits(BigInt(raw), decimals); }
function statusText(state: PreparedAction["state"]) {
  return ({ draft: "Draft", preflight_ready: "Ready for wallet review", wallet_prompt: "Waiting for wallet", submitted: "Submitted to Arc", confirmed: "Confirmed on Arc", reverted: "Reverted on Arc", dropped: "Transaction not found", unknown: "Checking transaction" })[state];
}

export function P2Panel({ wallet, walletChain, provider, previewOnly = false }: Props) {
  const [config, setConfig] = useState<Config | null>(null);
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [kind, setKind] = useState<ActionKind>("deposit");
  const [vaultId, setVaultId] = useState("galaxy-usdc");
  const [amount, setAmount] = useState("10");
  const [action, setAction] = useState<PreparedAction | null>(null);
  const [history, setHistory] = useState<PreparedAction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingHash, setPendingHash] = useState<string | null>(null);
  const [replacementHash, setReplacementHash] = useState("");
  const [configError, setConfigError] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [evidenceError, setEvidenceError] = useState(false);
  const [now, setNow] = useState(Date.now);
  const sending = useRef(false);
  const signedIn = Boolean(wallet && sessionWallet?.toLowerCase() === wallet.toLowerCase());

  const refresh = useCallback(async () => {
    if (previewOnly) {
      try {
        await previewRegistry();
        setConfig({ chainId: P2_CHAIN_ID, network: "Arc Mainnet", vaults: VAULTS.map((vault) => ({ id: vault.id, name: vault.name, vault: vault.address, asset: vault.assetAddress, assetSymbol: vault.asset, sourceUrl: vault.sourceUrl })), explorer: "https://explorer.arc.io", configured: false, writesEnabled: false });
        setConfigError(false);
      } catch { setConfig(null); setConfigError(true); }
      setSessionWallet(null); setMandate(null); setHistory([]); setAction(null);
      return;
    }
    try {
      const nextConfig = await request<Config>("/actions/config");
      if (nextConfig.chainId !== P2_CHAIN_ID || !Array.isArray(nextConfig.vaults) || nextConfig.vaults.length !== 3 || typeof nextConfig.writesEnabled !== "boolean") throw new Error("Mainnet configuration unavailable.");
      setConfig(nextConfig);
      setConfigError(false);
    } catch { setConfig(null); setConfigError(true); }
    try {
      const me = await request<{ wallet: string }>("/me");
      setSessionWallet(me.wallet);
      if (!wallet || me.wallet.toLowerCase() !== wallet.toLowerCase()) { setMandate(null); setHistory([]); setAction(null); return; }
      const [mandates, actions] = await Promise.all([request<{ items: Mandate[] }>("/mandates"), request<{ items: PreparedAction[] }>("/actions")]);
      setMandate(mandates.items[0] ?? null);
      setHistory(actions.items);
      setAction((previous) => previous ? actions.items.find((item) => item.id === previous.id) ?? actions.items[0] ?? null : actions.items[0] ?? null);
    } catch { setSessionWallet(null); setMandate(null); setHistory([]); setAction(null); }
  }, [wallet, previewOnly]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    const inspect = () => (previewOnly
      ? previewRegistry().then((registry) => {
          const vault = registry.items.find((item) => item.id === vaultId);
          const blockTime = Date.parse(vault?.blockTimestamp ?? "");
          if (!vault || vault.status !== "fresh" || !vault.codePresent || !vault.assetMatched || !vault.blockNumber || !Number.isFinite(blockTime) || Math.abs(Date.now() - blockTime) > 120_000) throw new Error("Fresh Arc evidence unavailable.");
          return { vaultId, chainId: P2_CHAIN_ID, blockNumber: vault.blockNumber, observedAt: vault.blockTimestamp! };
        })
      : request<Evidence>(`/actions/evidence/${vaultId}`))
      .then((next) => { if (!cancelled) { setEvidence(next); setEvidenceError(false); } })
      .catch(() => { if (!cancelled) { setEvidence(null); setEvidenceError(true); } });
    void inspect();
    const timer = window.setInterval(() => void inspect(), 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [config, vaultId, previewOnly]);
  useEffect(() => {
    if (previewOnly || !action || !signedIn || !["submitted", "unknown"].includes(action.state)) return;
    const timer = window.setInterval(() => { void request<PreparedAction>(`/actions/${action.id}`).then((next) => { setAction(next); setHistory((items) => items.map((item) => item.id === next.id ? next : item)); }).catch(() => { /* Keep the last known state; provider may be temporarily unavailable. */ }); }, 4000);
    return () => window.clearInterval(timer);
  }, [action, signedIn, previewOnly]);
  useEffect(() => {
    if (previewOnly || !action || action.state !== "wallet_prompt") return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(txKey(action.id)); } catch { /* Storage is optional. */ }
    if (!saved) return;
    const timer = window.setTimeout(() => setPendingHash(saved), 0);
    void request<PreparedAction>(`/actions/${action.id}/tx`, "POST", { hash: saved }).then((next) => setAction(next)).catch(() => { /* Retry recording from the visible action. */ });
    return () => window.clearTimeout(timer);
  }, [action, previewOnly]);

  const switchMainnet = async () => {
    if (previewOnly || !provider) return;
    setBusy(true); setError(null);
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: toHex(P2_CHAIN_ID) }] });
    } catch (cause) {
      if (typeof cause === "object" && cause && "code" in cause && cause.code === 4902) {
        try { await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: toHex(P2_CHAIN_ID), chainName: "Arc Mainnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.mainnet.arc.io"], blockExplorerUrls: ["https://explorer.arc.io"] }] }); }
        catch (error) { setError(formatP2Error(error)); }
      } else setError(formatP2Error(cause));
    } finally { setBusy(false); }
  };

  const prepare = async (review?: PreparedAction) => {
    if (previewOnly || !wallet || walletChain !== P2_CHAIN_ID || !signedIn) return;
    setBusy(true); setError(null); setPendingHash(null);
    try {
      const amountRaw = review?.amountRaw ?? parseAssetAmount(amount);
      const next = await request<PreparedAction>("/actions/prepare", "POST", { vaultId: review?.vaultId ?? vaultId, kind: review?.kind ?? kind, amountRaw, approvalId: review?.id, idempotencyKey: crypto.randomUUID() });
      setAction(next); setHistory((items) => [next, ...items]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare the action."); }
    finally { setBusy(false); }
  };

  const recordHash = async (item: PreparedAction, hash: string) => {
    try { localStorage.setItem(txKey(item.id), hash); } catch { /* The hash is still sent to the API. */ }
    setPendingHash(hash);
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const next = await request<PreparedAction>(`/actions/${item.id}/tx`, "POST", { hash });
        setAction(next); setHistory((items) => items.map((entry) => entry.id === next.id ? next : entry));
        return;
      } catch (cause) {
        if (attempt === 5) throw cause;
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
      }
    }
  };

  const submit = async () => {
    if (previewOnly || !action || !wallet || !provider || sending.current || !canPrompt(action, wallet, walletChain ?? 0)) return;
    sending.current = true; setBusy(true); setError(null); setPendingHash(null);
    let promptAccepted = false;
    let walletCallStarted = false;
    try {
      const currentChain = await provider.request({ method: "eth_chainId" });
      const accounts = await provider.request({ method: "eth_accounts" });
      if (Number(currentChain) !== P2_CHAIN_ID || !Array.isArray(accounts) || String(accounts[0]).toLowerCase() !== wallet.toLowerCase()) throw new Error("Wallet or network changed. Refresh the review.");
      const reviewed = await request<PreparedAction>(`/actions/${action.id}/prompt`, "POST");
      promptAccepted = true; setAction(reviewed);
      const chainBeforeSend = await provider.request({ method: "eth_chainId" });
      const accountsBeforeSend = await provider.request({ method: "eth_accounts" });
      if (Number(chainBeforeSend) !== P2_CHAIN_ID || !Array.isArray(accountsBeforeSend) || String(accountsBeforeSend[0]).toLowerCase() !== wallet.toLowerCase() || isExpired(reviewed)) throw new Error("Wallet, network, or quote changed during review. Do not send this transaction.");
      walletCallStarted = true;
      const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from: wallet, to: reviewed.target, data: reviewed.calldata, value: "0x0", gas: toHex(BigInt(reviewed.gasLimitRaw)), gasPrice: toHex(BigInt(reviewed.gasPriceRaw)), chainId: toHex(P2_CHAIN_ID) }] });
      if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Wallet did not return a transaction hash. Check wallet activity before retrying.");
      await recordHash(reviewed, hash);
    } catch (cause) {
      if (promptAccepted && (!walletCallStarted || /user rejected|user denied|4001/i.test(cause instanceof Error ? cause.message : String(cause)))) {
        try { const next = await request<PreparedAction>(`/actions/${action.id}/rejected`, "POST"); setAction(next); } catch { /* Keep wallet prompt unresolved if the server cannot confirm rejection. */ }
      }
      setError(cause instanceof Error ? cause.message : formatP2Error(cause));
    } finally { sending.current = false; setBusy(false); }
  };

  const trackReplacement = async () => {
    if (previewOnly || !active || !/^0x[0-9a-fA-F]{64}$/.test(replacementHash)) return;
    setBusy(true); setError(null);
    try {
      const next = await request<PreparedAction>(`/actions/${active.id}/tx`, "POST", { hash: replacementHash });
      setAction(next); setHistory((items) => items.map((item) => item.id === next.id ? next : item));
      setReplacementHash("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not verify the replacement transaction."); }
    finally { setBusy(false); }
  };

  const active = action && action.chainId === P2_CHAIN_ID && action.wallet.toLowerCase() === wallet?.toLowerCase() ? action : null;
  const selectedVault = config?.vaults.find((vault) => vault.id === vaultId);
  const definition = VAULTS.find((vault) => vault.id === vaultId);
  const asset = selectedVault?.assetSymbol ?? definition?.asset ?? "USDC";
  const limit = asset === "EURC" ? mandate?.rules.maxEurcActionRaw : mandate?.rules.maxActionRaw;
  const evidenceFresh = evidence?.vaultId === vaultId && now - Date.parse(evidence.observedAt) < 120_000;
  const secondsLeft = active ? Math.max(0, Math.ceil((Date.parse(active.validUntil) - now) / 1000)) : 0;
  const paused = previewOnly || !config?.writesEnabled;
  const depositDisabled = kind === "deposit" && asset === "EURC" && (!limit || BigInt(limit) === 0n);
  const updateAction = (next: PreparedAction) => { setAction(next); setHistory((items) => items.map((item) => item.id === next.id ? next : item)); };

  return <div className="p2-page">
    <header className="p2-heading">
      <div><span className="p2-kicker"><span /> MORPHO ON ARC</span><h1>Your capital.<br /><em>Your call.</em></h1><p>{previewOnly ? "Explore three curated vaults and inspect live Arc Mainnet contract evidence. Wallet actions are paused in this preview." : "A considered move starts here. Choose a vault, review the details, and confirm with your wallet."}</p></div>
      <div className="p2-network-card"><div className="p2-orbit" aria-hidden="true"><i /><i /><span><Layers3 size={25} strokeWidth={1.2} /></span></div><div><span>ONE NETWORK. EVERY VAULT.</span><strong>Arc Mainnet <ArrowUpRight size={16} /></strong><small>USDC & EURC · Morpho Vault V2</small></div></div>
    </header>

    {error && <div className="p2-alert" role="alert"><CircleAlert size={18} /><span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button></div>}
    {configError && <div className="p2-alert" role="alert"><CircleAlert size={18} /><span>{previewOnly ? "Arc registry is unavailable. Contract evidence cannot be shown." : "Action services are unavailable. Your wallet has not been prompted."}</span><button type="button" onClick={() => void refresh()}>Retry</button></div>}
    <section className="p2-vaults" aria-label="Choose a vault">
      <div className="p2-section-heading"><span>01 / SELECT YOUR VAULT</span><span>3 curated routes <Layers3 size={13} /></span></div>
      <div className="p2-vault-grid">{VAULTS.map((vault, index) => <button type="button" key={vault.id} className={`p2-vault-card ${vaultId === vault.id ? "is-selected" : ""}`} aria-pressed={vaultId === vault.id} onClick={() => { setVaultId(vault.id); setEvidenceError(false); }} style={{ animationDelay: `${index * 65}ms` }}>
        <div className="p2-vault-card-top"><VaultLogo vault={vault} /><span className="p2-vault-check">{vaultId === vault.id ? <Check size={13} /> : <ArrowUpRight size={14} />}</span></div>
        <strong>{vault.name}</strong><small>{vault.curator}</small><div className="p2-vault-card-bottom"><span>{vault.asset} <i /> Vault V2</span><span>{vaultId === vault.id ? "Selected" : "Select vault"}</span></div>
      </button>)}</div>
    </section>

    <div className="p2-layout">
      <section className="p2-card p2-compose">
        <div className="p2-card-top"><div><span className="p2-eyebrow">02 / COMPOSE</span><h2>A move on your terms.</h2></div><span className="p2-network-pill"><i /> Arc Mainnet</span></div>
        <div className="p2-tabs" role="group" aria-label="Action type"><button type="button" aria-pressed={kind === "deposit"} className={kind === "deposit" ? "active" : ""} onClick={() => setKind("deposit")}><ArrowDownLeft size={16} />Deposit</button><button type="button" aria-pressed={kind === "withdraw"} className={kind === "withdraw" ? "active" : ""} onClick={() => setKind("withdraw")}><ArrowUpRight size={16} />Withdraw</button></div>
        <div className="p2-amount-box"><label htmlFor="p2-amount">{kind === "deposit" ? "You deposit" : "You withdraw"}</label><div className="p2-amount-line"><input id="p2-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={`${asset} amount`} /><span><img src={`/brand/vaults/${asset.toLowerCase()}.svg`} alt="" />{asset}</span></div><div className="p2-amount-bottom"><span>Amount in {asset}</span><div>{["10", "50", "100"].map((value) => <button type="button" key={value} onClick={() => setAmount(value)}>{value}</button>)}</div></div></div>
        <div className="p2-destination"><div><span className="p2-destination-line" aria-hidden="true" /><span>{kind === "deposit" ? "To vault" : "From vault"}</span></div><strong>{selectedVault?.name ?? definition?.name}</strong></div>
        <div className="p2-facts"><div><span>Per-action deposit limit</span><strong>{mandate ? `${money(limit ?? "0")} ${asset}` : previewOnly ? "Unavailable in preview" : "Set in your mandate"}</strong></div><div><span>Network fees paid in</span><strong><img src="/brand/vaults/usdc.svg" alt="" /> USDC</strong></div><div><span>Wallet approval</span><strong>Always yours <LockKeyhole size={12} /></strong></div></div>
        {paused ? <div className="p2-inline-note"><LockKeyhole size={15} /><span>{previewOnly ? "Preview only. No approval, deposit, or withdrawal can be sent here." : config ? "Wallet actions are paused in this environment. You can still inspect each vault." : configError ? "Reconnect to action services to prepare a review." : "Loading action services…"}</span></div> : !signedIn ? <div className="p2-inline-note"><Wallet size={16} /><span>Sign in to apply your mandate and prepare a wallet review.</span></div> : !mandate ? <div className="p2-inline-note"><LockKeyhole size={15} /><span>Create a mandate to set your deposit and gas limits.</span></div> : depositDisabled ? <div className="p2-inline-note"><CircleAlert size={15} /><span>Set EURC deposit limits in your <a href="/app/mandate">mandate</a> before continuing.</span></div> : null}
        {!paused && signedIn && walletChain !== P2_CHAIN_ID && <div className="p2-inline-note"><CircleAlert size={15} /><span>Your wallet needs Arc Mainnet.</span><button type="button" onClick={() => void switchMainnet()} disabled={!provider || busy}>Switch network <ArrowRight size={14} /></button></div>}
        {!paused && (!signedIn || !mandate) ? <a className="p2-primary" href="/app/mandate"><Wallet size={17} />{signedIn ? "Create your mandate" : "Sign in to continue"}<ArrowRight size={17} /></a> : <button type="button" className="p2-primary" disabled={paused || !selectedVault || !signedIn || !mandate || walletChain !== P2_CHAIN_ID || busy || !amount || depositDisabled} onClick={() => void prepare()}>{busy ? <LoaderCircle size={17} className="spin" /> : <ShieldCheck size={17} />}{paused ? "Wallet actions paused" : "Prepare my review"}<ArrowRight size={17} /></button>}
        <p className="p2-button-note">{previewOnly ? "This preview never sends funds." : "Preparing a review never sends funds."}</p>
      </section>

      <aside className="p2-rail">
        <section className="p2-evidence-card"><div className="p2-evidence-top"><span className="p2-eyebrow">03 / VERIFY</span><ShieldCheck size={19} /></div><h2>A closer look.<br /><em>Before you commit.</em></h2>
          <div className={`p2-evidence-status ${evidenceFresh ? "is-matched" : ""}`}><span>{evidenceFresh ? <Check size={15} /> : evidenceError || configError ? <CircleAlert size={15} /> : <LoaderCircle size={15} className="spin" />}</span><div><strong>{evidenceFresh ? previewOnly ? "Contract and asset matched" : "Contract identity matched" : evidenceError || configError ? "Evidence unavailable" : "Checking mainnet contracts"}</strong><small>{evidenceFresh ? `Arc block ${Number(evidence.blockNumber).toLocaleString("en-US")}` : previewOnly ? "Live Arc evidence is temporarily unavailable." : "A fresh check runs before wallet review."}</small></div></div>
          <dl><div><dt>Network</dt><dd>Arc Mainnet <span>5042</span></dd></div><div><dt>Vault</dt><dd><a href={`https://explorer.arc.io/address/${definition?.address}`} target="_blank" rel="noreferrer">{definition ? short(definition.address) : "—"}<ExternalLink size={12} /></a></dd></div><div><dt>Underlying asset</dt><dd>{asset} <img src={`/brand/vaults/${asset.toLowerCase()}.svg`} alt="" /></dd></div></dl>
          <a className="p2-provider-link" href={definition?.sourceUrl} target="_blank" rel="noreferrer">Explore this vault on Morpho <ArrowUpRight size={15} /></a><p>Identity checks do not assess strategy or guarantee withdrawal liquidity. Review the vault’s risks and terms.</p>
        </section>
        <section className="p2-flow"><span className="p2-eyebrow">YOU STAY IN CONTROL</span><ol><li><span>1</span><div><strong>Review the details</strong><p>Amount, limits, contract, and estimated gas.</p></div></li><li><span>2</span><div><strong>Approve when needed</strong><p>A separate token or vault-share approval.</p></div></li><li><span>3</span><div><strong>Confirm in your wallet</strong><p>Track the result with its onchain receipt.</p></div></li></ol></section>
      </aside>
    </div>

    {active && <section className="p2-card p2-review" aria-label="Current action review">
      <div className="p2-review-head"><div><span className={`p2-state p2-state-${active.state}`}>{statusText(active.state)}</span><h2>{active.step === "approval" ? "Approval comes first." : active.kind === "deposit" ? "Your deposit, in detail." : "Your withdrawal, in detail."}</h2><p>{active.vaultName ?? "Galaxy USDC"} · {active.step === "approval" ? "Approval is a separate wallet transaction." : "Review this snapshot before your wallet opens."}</p></div><button type="button" className="p2-icon-button" onClick={() => void request<PreparedAction>(`/actions/${active.id}`).then(updateAction).catch(() => setError("Could not refresh the receipt."))} aria-label="Refresh action"><RefreshCw size={17} /></button></div>
      <div className="p2-review-amount"><strong>{money(active.amountRaw, active.assetDecimals)} <span>{active.assetSymbol ?? "USDC"}</span></strong>{active.state === "preflight_ready" && <span className={secondsLeft === 0 ? "expired" : ""}><Clock3 size={14} />{secondsLeft ? `Review valid for ${secondsLeft}s` : "Review expired"}</span>}</div>
      <div className="p2-review-grid"><div><span>Wallet</span><strong>{short(active.wallet)}</strong></div><div><span>Transaction target</span><a href={`https://explorer.arc.io/address/${active.target}`} target="_blank" rel="noreferrer">{short(active.target)} <ExternalLink size={12} /></a></div><div><span>Estimated shares</span><strong>{money(active.previewRaw, active.shareDecimals)}</strong></div><div><span>Estimated gas</span><strong>{money(active.gasCostRaw, 18)} USDC</strong></div><div><span>Current allowance</span><strong>{active.allowanceRaw === null ? "Not needed" : `${money(active.allowanceRaw, active.kind === "deposit" ? active.assetDecimals : active.shareDecimals)} ${active.kind === "deposit" ? active.assetSymbol ?? "USDC" : "shares"}`}</strong></div><div><span>Approval amount</span><strong>{active.approvalAmountRaw ? `${money(active.approvalAmountRaw, active.kind === "deposit" ? active.assetDecimals : active.shareDecimals)} ${active.kind === "deposit" ? active.assetSymbol ?? "USDC" : "shares"}` : "None required"}</strong></div><div><span>Share-price tolerance</span><strong>0.1%</strong></div><div><span>Mandate</span><strong>Version {active.mandateVersion}</strong></div></div>
      <div className="p2-review-links"><a href={active.evidenceUrl} target="_blank" rel="noreferrer">View vault evidence <ArrowUpRight size={14} /></a><span>Prepared at Arc block {active.blockNumber}</span></div>
      {active.message && <p className="p2-review-message"><CircleAlert size={15} />{active.message}</p>}
      {(active.txHash || (active.state === "wallet_prompt" && pendingHash)) && <a className="p2-tx-link" href={`https://explorer.arc.io/tx/${active.txHash || pendingHash}`} target="_blank" rel="noreferrer">View transaction {short(active.txHash || pendingHash!)} <ArrowUpRight size={15} /></a>}
      {active.state === "preflight_ready" && <button className="p2-primary" type="button" disabled={paused || busy || !signedIn || walletChain !== P2_CHAIN_ID || isExpired(active, now)} onClick={() => void submit()}><Wallet size={17} />{secondsLeft ? active.step === "approval" ? "Review approval in wallet" : `Review ${active.kind} in wallet` : "Review expired — prepare again"}<ArrowRight size={17} /></button>}
      {active.state === "confirmed" && active.step === "approval" && <button className="p2-primary" type="button" disabled={paused || busy || !signedIn} onClick={() => void prepare(active)}><Check size={17} />Prepare {active.kind}<ArrowRight size={17} /></button>}
    </section>}
    {active && ["wallet_prompt", "submitted", "unknown", "dropped"].includes(active.state) && <details className="p2-replacement"><summary>Track a transaction from your wallet</summary><p>Paste the Arc Mainnet hash if a transaction was sent or replaced. Its wallet, call, chain, and replacement nonce must match the review.</p><form onSubmit={(event) => { event.preventDefault(); void trackReplacement(); }}><input aria-label="Replacement transaction hash" placeholder="0x… transaction hash" value={replacementHash} onChange={(event) => setReplacementHash(event.target.value.trim())} /><button type="submit" disabled={busy || !/^0x[0-9a-fA-F]{64}$/.test(replacementHash)}>Track hash <ArrowRight size={14} /></button></form></details>}
    <section className="p2-history"><div className="p2-section-heading"><h2>Your activity</h2><span><Activity size={13} /> ONCHAIN RECEIPTS</span></div>{history.length ? <div className="p2-history-list">{history.slice(0, 8).map((item) => <button key={item.id} type="button" className={active?.id === item.id ? "is-selected" : ""} onClick={() => setAction(item)}><span className="p2-history-icon">{item.step === "approval" ? <LockKeyhole size={17} /> : item.kind === "deposit" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><span><strong>{item.vaultName ?? "Galaxy USDC"}</strong><small>{item.step === "approval" ? "Token approval" : item.kind === "deposit" ? "Deposit" : "Withdrawal"}</small></span><span className="p2-history-value">{money(item.amountRaw, item.assetDecimals)} {item.assetSymbol ?? "USDC"}<small>{statusText(item.state)}</small></span><ArrowRight size={15} /></button>)}</div> : <div className="p2-empty"><span><Activity size={24} strokeWidth={1.3} /></span><div><h3>A clear record of every move.</h3><p>{previewOnly ? "Wallet actions and transaction history are unavailable in this preview." : signedIn ? "Your reviews and transaction receipts will appear here." : "Sign in to see your reviews and transaction receipts."}</p></div><span className="p2-empty-dots" aria-hidden="true"><i /><i /><i /></span></div>}</section>
    <footer className="p2-footer"><span><LockKeyhole size={12} />Every transaction needs your wallet confirmation.</span><a href="/docs">Read the methodology <ArrowUpRight size={12} /></a></footer>
  </div>;
}
