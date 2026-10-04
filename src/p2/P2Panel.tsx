import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, CircleAlert, Clock3, ExternalLink, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { formatUnits, parseUnits, toHex } from "viem";
import type { EthereumProvider } from "../p0/wallets";
import type { Mandate } from "../p1/rules";
import { canPrompt, formatP2Error, isExpired, P2_CHAIN_ID, type ActionKind, type PreparedAction } from "./core";
import "./p2.css";

type Props = { wallet: `0x${string}` | null; walletChain: number | null; provider: EthereumProvider | null };
type ActionVault = { id: string; name: string; vault: string; asset: string; assetSymbol: "USDC" | "EURC"; sourceUrl: string };
type Config = { chainId: number; network: string; vaults: ActionVault[]; explorer: string; configured: boolean; writesEnabled: boolean };
const BASE = "/api/p1";
const txKey = (id: string) => `mandevyr:p2:tx:${id}`;

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { method, credentials: "same-origin", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function short(value: string) { return `${value.slice(0, 8)}…${value.slice(-6)}`; }
function money(raw: string, decimals = 6) { return formatUnits(BigInt(raw), decimals); }
function statusText(state: PreparedAction["state"]) {
  return ({ draft: "Draft", preflight_ready: "Ready for wallet review", wallet_prompt: "Waiting for wallet", submitted: "Submitted to Arc", confirmed: "Confirmed on Arc", reverted: "Reverted on Arc", dropped: "Transaction not found", unknown: "Checking transaction" })[state];
}

export function P2Panel({ wallet, walletChain, provider }: Props) {
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
  const sending = useRef(false);
  const signedIn = Boolean(wallet && sessionWallet?.toLowerCase() === wallet.toLowerCase());

  const refresh = useCallback(async () => {
    try {
      const nextConfig = await request<Config>("/actions/config");
      setConfig(nextConfig);
      const me = await request<{ wallet: string }>("/me");
      setSessionWallet(me.wallet);
      if (!wallet || me.wallet.toLowerCase() !== wallet.toLowerCase()) { setMandate(null); setHistory([]); setAction(null); return; }
      const [mandates, actions] = await Promise.all([request<{ items: Mandate[] }>("/mandates"), request<{ items: PreparedAction[] }>("/actions")]);
      setMandate(mandates.items[0] ?? null);
      setHistory(actions.items);
      setAction((previous) => previous ? actions.items.find((item) => item.id === previous.id) ?? actions.items[0] ?? null : actions.items[0] ?? null);
    } catch { setSessionWallet(null); setMandate(null); setHistory([]); setAction(null); }
  }, [wallet]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!action || !signedIn || !["submitted", "unknown"].includes(action.state)) return;
    const timer = window.setInterval(() => { void request<PreparedAction>(`/actions/${action.id}`).then((next) => { setAction(next); setHistory((items) => items.map((item) => item.id === next.id ? next : item)); }).catch(() => { /* Keep the last known state; provider may be temporarily unavailable. */ }); }, 4000);
    return () => window.clearInterval(timer);
  }, [action, signedIn]);
  useEffect(() => {
    if (!action || action.state !== "wallet_prompt") return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(txKey(action.id)); } catch { /* Storage is optional. */ }
    if (!saved) return;
    const timer = window.setTimeout(() => setPendingHash(saved), 0);
    void request<PreparedAction>(`/actions/${action.id}/tx`, "POST", { hash: saved }).then((next) => setAction(next)).catch(() => { /* Retry recording from the visible action. */ });
    return () => window.clearTimeout(timer);
  }, [action]);

  const switchMainnet = async () => {
    if (!provider) return;
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

  const prepare = async (review?: Pick<PreparedAction, "vaultId" | "amountRaw" | "kind">) => {
    if (!wallet || walletChain !== P2_CHAIN_ID || !signedIn) return;
    setBusy(true); setError(null); setPendingHash(null);
    try {
      const amountRaw = review?.amountRaw ?? parseUnits(amount, 6).toString();
      const next = await request<PreparedAction>("/actions/prepare", "POST", { vaultId: review?.vaultId ?? vaultId, kind: review?.kind ?? kind, amountRaw, idempotencyKey: crypto.randomUUID() });
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
    if (!action || !wallet || !provider || sending.current || !canPrompt(action, wallet, walletChain ?? 0)) return;
    sending.current = true; setBusy(true); setError(null); setPendingHash(null);
    let promptAccepted = false;
    try {
      const currentChain = await provider.request({ method: "eth_chainId" });
      const accounts = await provider.request({ method: "eth_accounts" });
      if (Number(currentChain) !== P2_CHAIN_ID || !Array.isArray(accounts) || String(accounts[0]).toLowerCase() !== wallet.toLowerCase()) throw new Error("Wallet or network changed. Refresh the review.");
      const reviewed = await request<PreparedAction>(`/actions/${action.id}/prompt`, "POST");
      promptAccepted = true; setAction(reviewed);
      const chainBeforeSend = await provider.request({ method: "eth_chainId" });
      const accountsBeforeSend = await provider.request({ method: "eth_accounts" });
      if (Number(chainBeforeSend) !== P2_CHAIN_ID || !Array.isArray(accountsBeforeSend) || String(accountsBeforeSend[0]).toLowerCase() !== wallet.toLowerCase() || isExpired(reviewed)) throw new Error("Wallet, network, or quote changed during review. Do not send this transaction.");
      const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from: wallet, to: reviewed.target, data: reviewed.calldata, value: "0x0", gas: toHex(BigInt(reviewed.gasLimitRaw)), chainId: toHex(P2_CHAIN_ID) }] });
      if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Wallet did not return a transaction hash. Check wallet activity before retrying.");
      await recordHash(reviewed, hash);
    } catch (cause) {
      if (promptAccepted && /user rejected|user denied|4001/i.test(cause instanceof Error ? cause.message : String(cause))) {
        try { const next = await request<PreparedAction>(`/actions/${action.id}/rejected`, "POST"); setAction(next); } catch { /* Keep wallet prompt unresolved if the server cannot confirm rejection. */ }
      }
      setError(cause instanceof Error ? cause.message : formatP2Error(cause));
    } finally { sending.current = false; setBusy(false); }
  };

  const trackReplacement = async () => {
    if (!active || !/^0x[0-9a-fA-F]{64}$/.test(replacementHash)) return;
    setBusy(true); setError(null);
    try {
      const next = await request<PreparedAction>(`/actions/${active.id}/tx`, "POST", { hash: replacementHash });
      setAction(next); setHistory((items) => items.map((item) => item.id === next.id ? next : item));
      setReplacementHash("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not verify the replacement transaction."); }
    finally { setBusy(false); }
  };

  const active = action && action.chainId === P2_CHAIN_ID && action.wallet.toLowerCase() === wallet?.toLowerCase() ? action : null;
  const selectedVault = config?.vaults.find((vault) => vault.id === vaultId) ?? config?.vaults[0];
  return <div className="p2-page">
    <header className="p2-heading"><div><span className="p2-kicker">MORPHO VAULTS ON ARC</span><h1>Review the move.<br /><em>Then make it.</em></h1><p>Prepare a deposit or withdrawal in a reviewed Morpho Vault V2 on Arc Mainnet. Review the vault, risks, and every wallet transaction before you confirm.</p></div><div className="p2-heading-badge"><ShieldCheck size={19} /> Morpho Vault V2</div></header>
    {error && <div className="p2-alert" role="alert"><CircleAlert size={18} />{error}<button type="button" onClick={() => setError(null)}>Dismiss</button></div>}
    {!config?.configured || !config.writesEnabled ? <section className="p2-unavailable"><div className="p2-unavailable-icon"><LockKeyhole size={29} /></div><h2>Mainnet actions are paused.</h2><p>The reviewed Morpho vaults are identified on Arc Mainnet. Wallet transactions remain closed in this environment until the mainnet release switch is enabled.</p>{config?.vaults.map((vault) => <a key={vault.id} href={vault.sourceUrl} target="_blank" rel="noreferrer">View {vault.name} on Morpho <ExternalLink size={14} /></a>)}<div><span>Network</span><strong>Arc Mainnet · 5042</strong></div></section> : <>
      {!signedIn && <div className="p2-notice"><Wallet size={19} /><span>Sign in with your wallet on <a href="/app/mandate">Mandate</a> first. The session follows the same address on Arc Mainnet.</span></div>}
      {signedIn && !mandate && <div className="p2-notice"><LockKeyhole size={19} /><span><a href="/app/mandate">Create a mandate</a> before preparing a transaction.</span></div>}
      {signedIn && walletChain !== P2_CHAIN_ID && <div className="p2-notice"><CircleAlert size={19} /><span>Switch the connected wallet to Arc Mainnet before preparing an action.</span><button type="button" onClick={() => void switchMainnet()} disabled={!provider || busy}>Switch network <ArrowRight size={15} /></button></div>}
      <div className="p2-layout"><section className="p2-card p2-compose"><div className="p2-card-top"><div><h2>Prepare an action</h2><p>One vault, one amount, one wallet review.</p></div><span>Arc Mainnet</span></div><label className="p2-vault-select">Vault<select value={vaultId} onChange={(event) => setVaultId(event.target.value)}>{config.vaults.map((vault) => <option key={vault.id} value={vault.id}>{vault.name} · {vault.assetSymbol}</option>)}</select></label><div className="p2-tabs" role="group" aria-label="Action type"><button type="button" className={kind === "deposit" ? "active" : ""} onClick={() => setKind("deposit")}>Deposit</button><button type="button" className={kind === "withdraw" ? "active" : ""} onClick={() => setKind("withdraw")}>Withdraw</button></div><label className="p2-amount">Amount <div><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={`${selectedVault?.assetSymbol} amount`} /><span>{selectedVault?.assetSymbol}</span></div></label>{selectedVault?.assetSymbol === "EURC" && kind === "deposit" && !mandate?.rules.maxEurcActionRaw?.match(/[1-9]/) && <p className="p2-vault-caveat">Set separate EURC action and daily limits in your mandate before depositing.</p>}<div className="p2-facts"><div><span>Vault contract</span><a href={`${config.explorer}/address/${selectedVault?.vault}`} target="_blank" rel="noreferrer">{selectedVault ? short(selectedVault.vault) : "Unknown"} <ExternalLink size={13} /></a></div><div><span>Mandate</span><strong>{mandate ? `Version ${mandate.version}` : "Required"}</strong></div><div><span>Approval</span><strong>Exact {selectedVault?.assetSymbol} or vault shares when required</strong></div></div><button type="button" className="p2-primary" disabled={!selectedVault || !signedIn || !mandate || walletChain !== P2_CHAIN_ID || busy || !amount} onClick={() => void prepare()}>{busy ? <LoaderCircle size={17} className="spin" /> : <RefreshCw size={17} />} Prepare review <ArrowRight size={17} /></button>{selectedVault && <a className="p2-vault-source" href={selectedVault.sourceUrl} target="_blank" rel="noreferrer">Read {selectedVault.name} details on Morpho <ExternalLink size={14} /></a>}<p className="p2-vault-caveat">Vault rates and withdrawal liquidity can change after this review.</p></section>
      <aside className="p2-card p2-flow"><h2>From intent to receipt.</h2><ol><li><span>01</span><div><strong>Check</strong><p>Fresh contract identity, limits, balance, allowance, preview, simulation, and gas.</p></div></li><li><span>02</span><div><strong>Approve</strong><p>If needed, approve the exact asset amount or the required vault-share cap. Wait for its receipt.</p></div></li><li><span>03</span><div><strong>Confirm</strong><p>Review the final call in your wallet. Onchain receipt decides the status.</p></div></li></ol></aside></div>
      {active && <section className="p2-card p2-review"><div className="p2-review-head"><div><span className={`p2-state p2-state-${active.state}`}>{statusText(active.state)}</span><h2>{active.step === "approval" ? "Token approval" : active.kind === "deposit" ? "Deposit review" : "Withdrawal review"}</h2><p>{active.step === "approval" ? "An approval is a separate wallet transaction. Refresh the action after it confirms." : "This quote is a snapshot. State and gas can change before inclusion."}</p></div><button type="button" onClick={() => void request<PreparedAction>(`/actions/${active.id}`).then(setAction).catch(() => setError("Could not refresh the receipt."))} aria-label="Refresh action"><RefreshCw size={19} /></button></div><div className="p2-review-grid"><div><span>Network</span><strong>Arc Mainnet · 5042</strong></div><div><span>Wallet</span><strong>{short(active.wallet)}</strong></div><div><span>Vault</span><strong>{active.vaultName ?? "Galaxy USDC"}</strong></div><div><span>Target contract</span><strong>{short(active.target)}</strong></div><div><span>Token and amount</span><strong>{money(active.amountRaw, active.assetDecimals)} {active.assetSymbol ?? "USDC"}</strong></div><div><span>Preview</span><strong>{money(active.previewRaw, active.shareDecimals)} {active.previewLabel}</strong></div><div><span>Current allowance</span><strong>{active.allowanceRaw === null ? "Not needed" : `${money(active.allowanceRaw, active.kind === "deposit" ? active.assetDecimals : active.shareDecimals)} ${active.kind === "deposit" ? active.assetSymbol ?? "USDC" : "shares"}`}</strong></div><div><span>New approval</span><strong>{active.approvalAmountRaw ? `${money(active.approvalAmountRaw, active.kind === "deposit" ? active.assetDecimals : active.shareDecimals)} ${active.kind === "deposit" ? active.assetSymbol ?? "USDC" : "shares"}` : "None"}</strong></div><div><span>Gas at current price</span><strong>{money(active.gasCostRaw, 18)} USDC</strong></div><div><span>Share-price tolerance</span><strong>{active.step === "action" ? "0.1%" : "On the next review"}</strong></div><div><span>Valid until</span><strong>{new Date(active.validUntil).toLocaleTimeString("en-US")}</strong></div></div><div className="p2-review-links"><a href={active.evidenceUrl} target="_blank" rel="noreferrer">Vault evidence <ArrowUpRight size={15} /></a><span>Simulated at block {active.blockNumber} · Morpho SDK route</span></div>{active.message && <p className="p2-review-message"><CircleAlert size={16} />{active.message}</p>}{(active.txHash || (active.state === "wallet_prompt" && pendingHash)) && <a className="p2-tx-link" href={`${config.explorer}/tx/${active.txHash || pendingHash}`} target="_blank" rel="noreferrer">View transaction {short(active.txHash || pendingHash!)} <ArrowUpRight size={15} /></a>}{active.state === "preflight_ready" && <button className="p2-primary" type="button" disabled={busy || !wallet || walletChain !== P2_CHAIN_ID || isExpired(active)} onClick={() => void submit()}><Wallet size={17} /> {active.step === "approval" ? "Review approval in wallet" : `Review ${active.kind} in wallet`} <ArrowRight size={17} /></button>}{active.state === "confirmed" && active.step === "approval" && <button className="p2-primary" type="button" disabled={busy} onClick={() => void prepare({ vaultId: active.vaultId ?? "galaxy-usdc", amountRaw: active.amountRaw, kind: active.kind })}><Check size={17} /> Prepare {active.kind} <ArrowRight size={17} /></button>}{active.state === "preflight_ready" && isExpired(active) && <p className="p2-expired"><Clock3 size={16} /> Quote expired. Prepare a fresh review.</p>}</section>}
      {active && ["submitted", "unknown", "dropped"].includes(active.state) && <details className="p2-replacement"><summary>Wallet replaced this transaction?</summary><p>If you sped it up or cancelled it in your wallet, paste the new Arc Mainnet transaction hash. MANDEVYR verifies the wallet, contract call, and original nonce before tracking it.</p><form onSubmit={(event) => { event.preventDefault(); void trackReplacement(); }}><input aria-label="Replacement transaction hash" placeholder="0x..." value={replacementHash} onChange={(event) => setReplacementHash(event.target.value.trim())} /><button type="submit" disabled={busy || !/^0x[0-9a-fA-F]{64}$/.test(replacementHash)}>Track hash</button></form></details>}
      {history.length > 1 && <section className="p2-history"><h2>Recent actions</h2>{history.slice(0, 8).map((item) => <button key={item.id} type="button" onClick={() => setAction(item)}><span>{item.step === "approval" ? "Approval" : item.kind}</span><strong>{item.vaultName ?? "Galaxy USDC"} · {money(item.amountRaw, item.assetDecimals)} {item.assetSymbol ?? "USDC"}</strong><small>{statusText(item.state)}</small><ArrowUpRight size={15} /></button>)}</section>}
    </>}
  </div>;
}
