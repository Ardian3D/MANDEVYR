import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  Eye,
  Globe2,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  ClipboardCheck,
  History,
  Bell,
  Wallet,
  Send,
  X,
} from "lucide-react";
import { formatUnits, isAddress } from "viem";
import { Brand } from "../components/Brand";
import {
  ARC_EXPLORER,
  VAULTS,
  type RegistryResponse,
  type VaultSnapshot,
  type WalletSnapshot,
} from "./registry";
import { evidenceStatus } from "./evidence";
import {
  listenForWallets,
  requestWalletAnnouncements,
  type WalletOption,
} from "./wallets";
import { LogoSculpture } from "./LogoSculpture";
import { VaultLogo } from "./VaultLogo";
import { P1_ENABLED } from "../p1/config";
import "./workspace.css";
import "./logo-sculpture.css";

const P2Panel = lazy(() => import("../p2/P2Panel").then((module) => ({ default: module.P2Panel })));

const WATCHLIST_KEY = "mandevyr:p0:watchlist";
const ACTIVE_WALLET_KEY = "mandevyr:p0:wallet";
const EMPTY_ENTRIES: VaultSnapshot[] = [];
const P1Panel = lazy(() => import("../p1/P1Panel").then((module) => ({ default: module.P1Panel })));

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function amount(raw: string | null, decimals: number | null, maximum = 2): string {
  if (raw === null || decimals === null) return "Data unavailable";
  try {
    const units = formatUnits(BigInt(raw), decimals);
    const number = Number(units);
    if (!Number.isFinite(number)) return "Data unavailable";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: maximum, notation: number >= 1_000_000 ? "compact" : "standard" }).format(number);
  } catch {
    return "Data unavailable";
  }
}

function timeLabel(value: string | null) {
  if (!value) return "Not observed";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not observed";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
}

function ageLabel(value: string | null, now: number) {
  if (!value) return "No observation";
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1_000));
  if (!Number.isFinite(seconds)) return "No observation";
  if (seconds < 60) return "Less than a minute ago";
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3_600)} hr ago`;
}

function readWatchlist(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string" && VAULTS.some((vault) => vault.id === id)) : [];
  } catch {
    return [];
  }
}

function StatusPill({ vault, now }: { vault: VaultSnapshot; now: number }) {
  const status = evidenceStatus(vault, now);
  return <span className={`p0-status p0-status-${status}`}><i />{status === "fresh" ? "On-chain checked" : status === "stale" ? "Needs refresh" : "Data unavailable"}</span>;
}

function AddressLink({ address, children }: { address: string; children?: React.ReactNode }) {
  return <a href={`${ARC_EXPLORER}/address/${address}`} target="_blank" rel="noreferrer" className="p0-address-link">{children ?? shortAddress(address)}<ArrowUpRight size={14} /></a>;
}

function EmptyState({ title, children, onReset }: { title: string; children: React.ReactNode; onReset?: () => void }) {
  return <div className="p0-empty"><Search size={26} strokeWidth={1.3} /><h3>{title}</h3><p>{children}</p>{onReset && <button type="button" onClick={onReset}>Clear filters <ArrowRight size={15} /></button>}</div>;
}

export function Workspace() {
  const location = useLocation();
  const { id } = useParams();
  const opportunityId = location.pathname.startsWith("/app/opportunities/") ? id : undefined;
  const isP2 = location.pathname === "/app/actions";
  const isP1 = isP2 || ["/app/mandate", "/app/preflight/new", "/app/history", "/app/watch"].includes(location.pathname) || location.pathname.startsWith("/app/preflight/");
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(readWatchlist);
  const [wallet, setWallet] = useState<`0x${string}` | null>(null);
  const [walletChain, setWalletChain] = useState<number | null>(null);
  const [walletData, setWalletData] = useState<WalletSnapshot | null>(null);
  const [availableWallets, setAvailableWallets] = useState<WalletOption[]>([]);
  const [activeWallet, setActiveWallet] = useState<WalletOption | null>(null);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const walletDialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [withdrawFilter, setWithdrawFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  const fetchRegistry = useCallback(async (initial = false) => {
    if (!initial) setRefreshing(true);
    try {
      const response = await fetch("/api/registry", { cache: "no-store" });
      if (!response.ok) throw new Error("The Arc data service did not respond.");
      const next = await response.json() as RegistryResponse;
      if (!Array.isArray(next.items)) throw new Error("The registry response is incomplete.");
      setData(next);
      setLoadError(null);
      setNow(Date.now());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the registry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isP2) return;
    const start = window.setTimeout(() => void fetchRegistry(true), 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void fetchRegistry(); }, 60_000);
    return () => { window.clearTimeout(start); window.clearInterval(timer); };
  }, [fetchRegistry, isP2]);

  useEffect(() => listenForWallets(setAvailableWallets), []);

  useEffect(() => {
    const dialog = walletDialogRef.current;
    if (!dialog) return;
    if (walletDialogOpen && !dialog.open) dialog.showModal();
    if (!walletDialogOpen && dialog.open) dialog.close();
  }, [walletDialogOpen]);

  useEffect(() => {
    if (activeWallet || wallet) return;
    let remembered: string | null = null;
    try { remembered = localStorage.getItem(ACTIVE_WALLET_KEY); } catch { /* Storage can be disabled. */ }
    const choice = availableWallets.find((option) => option.rememberKey === remembered);
    if (!choice) return;
    let cancelled = false;
    Promise.all([
      choice.provider.request({ method: "eth_accounts" }),
      choice.provider.request({ method: "eth_chainId" }),
    ]).then(([accounts, chain]) => {
      if (cancelled) return;
      const account = Array.isArray(accounts) && typeof accounts[0] === "string" && isAddress(accounts[0]) ? accounts[0] as `0x${string}` : null;
      if (!account) return;
      setActiveWallet(choice);
      setWallet(account);
      setWalletChain(typeof chain === "string" ? Number(chain) : null);
    }).catch(() => { /* A silent restore never opens a wallet prompt. */ });
    return () => { cancelled = true; };
  }, [availableWallets, activeWallet, wallet]);

  useEffect(() => {
    if (!activeWallet) return;
    const injected = activeWallet.provider;
    let cancelled = false;
    const sync = async () => {
      try {
        const [accounts, chain] = await Promise.all([
          injected.request({ method: "eth_accounts" }),
          injected.request({ method: "eth_chainId" }),
        ]);
        const account = Array.isArray(accounts) && typeof accounts[0] === "string" && isAddress(accounts[0]) ? accounts[0] as `0x${string}` : null;
        if (!cancelled) {
          setWallet(account);
          setWalletChain(typeof chain === "string" ? Number(chain) : null);
        }
      } catch { /* Keep the disconnected state if the extension is unavailable. */ }
    };
    const onAccounts = () => { void sync(); };
    const onChain = () => { void sync(); };
    void sync();
    injected.on?.("accountsChanged", onAccounts);
    injected.on?.("chainChanged", onChain);
    return () => {
      cancelled = true;
      injected.removeListener?.("accountsChanged", onAccounts);
      injected.removeListener?.("chainChanged", onChain);
    };
  }, [activeWallet]);

  useEffect(() => {
    if (!wallet || walletChain !== 5042) return;
    const controller = new AbortController();
    fetch(`/api/wallet/${wallet}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("Wallet data is unavailable."); return response.json() as Promise<WalletSnapshot>; })
      .then((result) => { if (!controller.signal.aborted) setWalletData(result); })
      .catch(() => { if (!controller.signal.aborted) setWalletData(null); });
    return () => controller.abort();
  }, [wallet, walletChain, data]);

  const openWalletDialog = () => {
    setWalletError(null);
    setWalletDialogOpen(true);
    requestWalletAnnouncements();
  };

  const connectWallet = async (choice: WalletOption) => {
    setWalletBusy(true); setWalletError(null);
    try {
      const accounts = await choice.provider.request({ method: "eth_requestAccounts" });
      const account = Array.isArray(accounts) && typeof accounts[0] === "string" && isAddress(accounts[0]) ? accounts[0] as `0x${string}` : null;
      if (!account) throw new Error("The wallet did not return an address.");
      const chain = await choice.provider.request({ method: "eth_chainId" });
      setActiveWallet(choice);
      setWallet(account);
      setWalletChain(typeof chain === "string" ? Number(chain) : null);
      try { localStorage.setItem(ACTIVE_WALLET_KEY, choice.rememberKey); } catch { /* Storage can be disabled. */ }
      setWalletDialogOpen(false);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Connection was not completed.");
    } finally { setWalletBusy(false); }
  };

  const disconnectWallet = () => {
    setActiveWallet(null);
    setWallet(null);
    setWalletChain(null);
    setWalletData(null);
    setWalletError(null);
    setWalletDialogOpen(false);
    try { localStorage.removeItem(ACTIVE_WALLET_KEY); } catch { /* Storage can be disabled. */ }
  };

  const switchArc = async () => {
    const injected = activeWallet?.provider; if (!injected) return;
    setWalletBusy(true); setWalletError(null);
    try {
      try {
        await injected.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x13b2" }] });
      } catch (error) {
        if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 4902) throw error;
        await injected.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x13b2", chainName: "Arc", rpcUrls: ["https://rpc.mainnet.arc.io"], nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, blockExplorerUrls: [ARC_EXPLORER] }] });
      }
      setWalletChain(5042);
    } catch (error) { setWalletError(error instanceof Error ? error.message : "Network switch was cancelled."); }
    finally { setWalletBusy(false); }
  };

  const toggleWatch = (vaultId: string) => {
    setWatchlist((previous) => {
      const next = previous.includes(vaultId) ? previous.filter((item) => item !== vaultId) : [...previous, vaultId];
      try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)); } catch { /* Storage can be disabled. */ }
      return next;
    });
  };

  const entries = data?.items ?? EMPTY_ENTRIES;
  const walletView = wallet && walletChain === 5042 && walletData?.address.toLowerCase() === wallet.toLowerCase() ? walletData : null;
  const fresh = entries.filter((item) => evidenceStatus(item, now) === "fresh").length;
  const watched = entries.filter((item) => watchlist.includes(item.id));
  const selected = opportunityId ? entries.find((item) => item.id === opportunityId) : undefined;
  const isWatchlist = location.pathname === "/app/watchlist";
  const filtered = (isWatchlist ? watched : entries).filter((item) => {
      const position = walletView?.positions.find((record) => record.vaultId === item.id);
      const withdrawalAvailable = position?.status === "available" && position.maxWithdrawRaw !== null && BigInt(position.maxWithdrawRaw) > 0n;
      return (!query || `${item.name} ${item.curator} ${item.asset} ${item.address}`.toLowerCase().includes(query.toLowerCase()))
        && (assetFilter === "all" || item.asset === assetFilter)
        && (evidenceFilter === "all" || (evidenceFilter === "checked" ? evidenceStatus(item, now) === "fresh" : evidenceStatus(item, now) !== "fresh"))
        && (withdrawFilter === "all" || (withdrawFilter === "available" ? withdrawalAvailable : !withdrawalAvailable))
        && (riskFilter === "all" || item.riskFlags.includes(riskFilter));
    }).sort((a, b) => {
      const score = (item: VaultSnapshot) => evidenceStatus(item, now) === "fresh" ? 1 : 0;
      return score(b) - score(a) || a.name.localeCompare(b.name);
    });

  const resetFilters = () => { setQuery(""); setAssetFilter("all"); setEvidenceFilter("all"); setWithdrawFilter("all"); setRiskFilter("all"); };

  return <div className="p0-shell">
    <aside className={`p0-sidebar ${menuOpen ? "p0-sidebar-open" : ""}`}>
      <Link to="/" className="p0-brand" aria-label="MANDEVYR home"><Brand /></Link>
      <nav className="p0-nav" aria-label="Workspace navigation">
        <Link to="/app" onClick={() => setMenuOpen(false)} className={location.pathname === "/app" ? "active" : ""}><Layers3 size={18} /> Overview</Link>
        <Link to="/app/explore" onClick={() => setMenuOpen(false)} className={location.pathname === "/app/explore" || Boolean(opportunityId) ? "active" : ""}><Globe2 size={18} /> Explore <span>{entries.length || "—"}</span></Link>
        <Link to="/app/watchlist" onClick={() => setMenuOpen(false)} className={isWatchlist ? "active" : ""}><Bookmark size={18} /> Watchlist <span>{watchlist.length}</span></Link>
        {P1_ENABLED && <>
          <Link to="/app/mandate" onClick={() => setMenuOpen(false)} className={location.pathname === "/app/mandate" ? "active" : ""}><SlidersHorizontal size={18} /> Mandate</Link>
          <Link to="/app/preflight/new" onClick={() => setMenuOpen(false)} className={location.pathname.startsWith("/app/preflight") ? "active" : ""}><ClipboardCheck size={18} /> Preflight</Link>
          <Link to="/app/watch" onClick={() => setMenuOpen(false)} className={location.pathname === "/app/watch" ? "active" : ""}><Bell size={18} /> Watchtower</Link>
          <Link to="/app/history" onClick={() => setMenuOpen(false)} className={location.pathname === "/app/history" ? "active" : ""}><History size={18} /> History</Link>
          <Link to="/app/actions" onClick={() => setMenuOpen(false)} className={isP2 ? "active" : ""}><Send size={18} /> Actions</Link>
        </>}
      </nav>
        <div className="p0-side-foot">
          <div className="p0-network-mark"><span className="p0-pulse" /> {isP2 ? "Arc Testnet fixture" : "Read only on Arc"}</div>
        <p>{isP2 ? "Testnet transactions require your wallet confirmation. Mainnet actions remain off." : "Make sense of what is onchain. Keep the final call in your hands."}</p>
        <Link to="/docs">Read the methodology <ArrowUpRight size={14} /></Link>
      </div>
    </aside>
    <div className="p0-main">
      <header className="p0-topbar">
        <button className="p0-mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <div className="p0-breadcrumb"><Link to="/app">MANDEVYR</Link><span>/</span><span>{opportunityId ? "Opportunity" : isP1 ? isP2 ? "Actions" : location.pathname === "/app/mandate" ? "Mandate" : location.pathname === "/app/watch" ? "Watchtower" : location.pathname === "/app/history" ? "History" : "Preflight" : isWatchlist ? "Watchlist" : location.pathname === "/app/explore" ? "Explore" : "Overview"}</span></div>
        <div className="p0-top-actions">
          <span className="p0-mainnet-label"><span /> {isP2 ? "Arc Testnet" : "Arc Mainnet"}</span>
          {wallet ? (isP2 || walletChain === 5042) ? <button type="button" className="p0-wallet-connected" onClick={openWalletDialog} aria-label={`Wallet ${shortAddress(wallet)}. Open wallet menu`}><Wallet size={15} /> {shortAddress(wallet)} <ChevronDown size={13} /></button> : <><button type="button" className="p0-wallet-switch" onClick={() => void switchArc()} disabled={walletBusy}>Switch to Arc <ArrowRight size={15} /></button><button type="button" className="p0-wallet-change" onClick={openWalletDialog} aria-label="Choose another wallet"><Wallet size={17} /></button></> : <button type="button" className="p0-wallet-button" onClick={openWalletDialog}><Wallet size={16} /> Connect wallet</button>}
        </div>
      </header>
      {walletError && !walletDialogOpen && <div className="p0-inline-alert" role="alert"><CircleAlert size={17} />{walletError}<button onClick={() => setWalletError(null)} aria-label="Dismiss wallet message"><X size={15} /></button></div>}
      {wallet && walletChain !== 5042 && !isP2 && <div className="p0-inline-alert" role="status"><CircleAlert size={17} />Your wallet is on another network. Switch to Arc to view your balance and vault positions.</div>}
      {loadError && !isP2 && <div className="p0-inline-alert" role="alert"><CircleAlert size={17} />{loadError} <button type="button" onClick={() => void fetchRegistry()}>Retry <RefreshCw size={14} /></button></div>}
      {isP1 ? <main className="p0-content"><Suspense fallback={<div className="p0-loading" role="status"><LoaderCircle size={24} className="spin" /> Opening workspace…</div>}>{isP2 ? <P2Panel wallet={wallet} walletChain={walletChain} provider={activeWallet?.provider ?? null} /> : <P1Panel path={location.pathname} wallet={wallet} walletChain={walletChain} provider={activeWallet?.provider ?? null} registry={data} />}</Suspense></main> : opportunityId ? <section className="p0-content">{loading ? <div className="p0-loading" role="status"><LoaderCircle size={24} className="spin" /> Checking Arc data…</div> : selected ? <Detail vault={selected} now={now} watched={watchlist.includes(selected.id)} toggleWatch={toggleWatch} walletPosition={walletView?.positions.find((position) => position.vaultId === selected.id)} /> : <div className="p0-detail-empty"><Link to="/app/explore"><ArrowLeft size={15} /> Back to Explore</Link><EmptyState title="Opportunity not found">This ID is not in MANDEVYR's reviewed registry.</EmptyState></div>}</section> : <main className="p0-content">
        <div className="p0-hero">
          <div className="p0-hero-copy"><h1 tabIndex={-1}>{isWatchlist ? <>Your watchlist<span>.</span></> : location.pathname === "/app/explore" ? <>Explore with <em>context.</em></> : <>A clearer field<br />of <em>view.</em></>}</h1><p>{isWatchlist ? "Keep the opportunities you want to revisit in one place. This list lives in your browser." : "A small, sourced view of vaults on Arc. Inspect the evidence, follow the risk, and decide at your own pace."}</p><div className="p0-hero-actions"><Link to="/app/explore" className="p0-primary-link">Explore opportunities <ArrowUpRight size={17} /></Link>{P1_ENABLED && <Link to="/app/preflight/new" className="p0-preflight-link">Run a preflight <ArrowRight size={16} /></Link>}</div></div>
          <LogoSculpture />
        </div>
        <div className="p0-stats" aria-label="Workspace summary"><div><span>NETWORK</span><strong>Arc Mainnet <ArrowUpRight size={19} /></strong><small>Chain ID 5042</small></div><div><span>LIVE CONTRACT CHECKS</span><strong>{loading ? "—" : `${fresh} / ${entries.length}`}</strong><small>Contract + base asset checks</small></div><div><span>WATCHING</span><strong>{watchlist.length.toString().padStart(2, "0")}</strong><small>Saved in this browser</small></div><div><span>YOUR USDC ON ARC</span><strong>{walletView ? `${amount(walletView.nativeUsdcRaw, 18, 3)} USDC` : "Connect wallet"}</strong><small>One native USDC balance</small></div></div>
        <div className="p0-section-heading"><div><h2>{isWatchlist ? "Saved for later" : "Opportunities, with receipts."}</h2></div><div className="p0-section-meta"><span>{loading ? "Checking sources" : `${filtered.length} of ${isWatchlist ? watched.length : entries.length} shown`}</span><button type="button" onClick={() => void fetchRegistry()} disabled={refreshing} aria-label="Refresh on-chain data"><RefreshCw size={17} className={refreshing ? "spin" : ""} /> Refresh</button></div></div>
        <div className="p0-filterbar"><label className="p0-search"><Search size={17} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, curator, asset or contract" aria-label="Search opportunities" /></label><div className="p0-filter-controls"><label>Asset <ChevronDown size={13} /><select value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)}><option value="all">All assets</option><option value="USDC">USDC</option><option value="EURC">EURC</option></select></label><label>Evidence <ChevronDown size={13} /><select value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value)}><option value="all">All states</option><option value="checked">Checked</option><option value="review">Needs review</option></select></label><label>Withdraw <ChevronDown size={13} /><select value={withdrawFilter} onChange={(event) => setWithdrawFilter(event.target.value)}><option value="all">All</option><option value="available">Verified available</option><option value="unknown">Unknown</option></select></label><label>Risk <ChevronDown size={13} /><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option value="all">All flags</option>{[...new Set(VAULTS.flatMap((item) => item.riskFlags))].sort().map((flag) => <option key={flag} value={flag}>{flag}</option>)}</select></label></div></div>
        <div className="p0-layout"><div className="p0-list">
          {loading ? Array.from({ length: 3 }, (_, index) => <div key={index} className="p0-row p0-skeleton" aria-hidden="true"><div /><div /><div /></div>) : filtered.length ? filtered.map((vault) => <VaultRow key={vault.id} vault={vault} now={now} watched={watchlist.includes(vault.id)} toggleWatch={toggleWatch} />) : <EmptyState title={isWatchlist && !watchlist.length ? "Nothing saved yet" : "No matches found"} onReset={resetFilters}>{isWatchlist && !watchlist.length ? "Save a vault from Explore to keep it here." : "Try clearing a filter. Entries with missing contract evidence are marked for review, not silently hidden."}</EmptyState>}
          <div className="p0-list-foot"><ShieldCheck size={17} /> Ordered by evidence state, then name. APY is withheld until its method and source are verified.</div>
        </div><aside className="p0-insight"><h3>Read the source.<br /><em>Then the signal.</em></h3><p>Each entry is checked against the Arc contract address and base asset shown by its provider. A working contract does not mean a vault is risk-free.</p><div className="p0-pulse-stat"><span>Chain observation</span><strong>{entries[0]?.blockNumber ? `#${Number(entries[0].blockNumber).toLocaleString("en-US")}` : "Unavailable"}</strong></div><div className="p0-pulse-stat"><span>Updated</span><strong>{ageLabel(entries[0]?.fetchedAt ?? null, now)}</strong></div><a href="https://docs.arc.io/arc/references/connect-to-arc" target="_blank" rel="noreferrer">About the Arc network <ExternalLink size={14} /></a></aside></div>
        <div className="p0-endnote"><div><Eye size={24} /><span>Read-only workspace</span></div><p>Numbers are live observations, not offers, quotes, or promises. Check the provider's current terms before acting.</p></div>
      </main>}
    </div>
    <dialog ref={walletDialogRef} className="p0-wallet-dialog" aria-labelledby="p0-wallet-title" onClose={() => setWalletDialogOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setWalletDialogOpen(false); }}>
      <div className="p0-wallet-modal">
        <div className="p0-wallet-modal-top"><span>Connect wallet</span><button type="button" onClick={() => setWalletDialogOpen(false)} aria-label="Close wallet chooser"><X size={19} /></button></div>
        <div className="p0-wallet-modal-heading"><div className="p0-wallet-modal-symbol"><Wallet size={27} strokeWidth={1.4} /></div><h2 id="p0-wallet-title">{wallet ? "Your wallet." : "Choose a wallet."}</h2><p>Connect an extension detected in this browser. Your first step is read-only; MANDEVYR will not ask for a signature.</p></div>
        {wallet && <div className="p0-wallet-current"><span>CONNECTED ADDRESS</span><strong>{shortAddress(wallet)}</strong><small>{activeWallet?.name ?? "Browser wallet"} · {walletChain === 5042 ? "Arc Mainnet" : "Other network"}</small></div>}
        <div className="p0-wallet-list-head"><span>AVAILABLE EXTENSIONS</span><span>{String(availableWallets.length).padStart(2, "0")} FOUND</span></div>
        <div className="p0-wallet-list">
          {availableWallets.length ? availableWallets.map((choice) => <button key={choice.id} type="button" className={`p0-wallet-option ${activeWallet?.provider === choice.provider ? "active" : ""}`} onClick={() => void connectWallet(choice)} disabled={walletBusy}><span className="p0-wallet-option-icon">{choice.icon ? <img src={choice.icon} alt="" /> : <Wallet size={23} strokeWidth={1.5} />}</span><span className="p0-wallet-option-name"><strong>{choice.name}</strong><small>{choice.discovery === "eip6963" ? "Detected extension" : "Browser provider"}</small></span>{walletBusy ? <LoaderCircle size={17} className="spin" /> : activeWallet?.provider === choice.provider && wallet ? <Check size={18} /> : <ArrowUpRight size={18} />}</button>) : <div className="p0-wallet-empty"><CircleAlert size={22} /><strong>No wallet extension detected</strong><p>Enable an EVM wallet extension, then refresh this page. Only wallets present in this browser appear here.</p></div>}
        </div>
        {walletError && <div className="p0-wallet-error" role="alert"><CircleAlert size={16} />{walletError}</div>}
        {wallet && <button type="button" className="p0-wallet-disconnect" onClick={disconnectWallet}>Disconnect from MANDEVYR <ArrowRight size={15} /></button>}
        <div className="p0-wallet-modal-foot"><span><span className="p0-pulse" /> Read only on Arc</span><span>No signatures requested</span></div>
      </div>
    </dialog>
  </div>;
}

function VaultRow({ vault, now, watched, toggleWatch }: { vault: VaultSnapshot; now: number; watched: boolean; toggleWatch: (id: string) => void }) {
  return <article className="p0-row"><div className="p0-row-top"><StatusPill vault={vault} now={now} /><button type="button" className={`p0-bookmark ${watched ? "saved" : ""}`} onClick={() => toggleWatch(vault.id)} aria-label={watched ? `Remove ${vault.name} from watchlist` : `Save ${vault.name} to watchlist`} aria-pressed={watched}><Bookmark size={19} fill={watched ? "currentColor" : "none"} /></button></div><div className="p0-row-body"><div className="p0-row-identity"><VaultLogo vault={vault} /><div><span>{vault.provider} / {vault.curator}</span><h3><Link to={`/app/opportunities/${vault.id}`}>{vault.name} <ArrowUpRight size={18} /></Link></h3><small>Vault · Arc · {vault.asset}</small></div></div><div className="p0-row-metric"><span>ON-CHAIN ASSETS</span><strong>{amount(vault.totalAssetsRaw, vault.assetDecimals)} <small>{vault.asset}</small></strong><small>APY <b>Not verified</b></small></div></div><div className="p0-row-bottom"><div className="p0-risk-list">{vault.riskFlags.slice(0, 2).map((risk) => <span key={risk}>{risk}</span>)}</div><span><Clock3 size={14} /> {ageLabel(vault.blockTimestamp, now)}</span><Link to={`/app/opportunities/${vault.id}`}>Inspect evidence <ArrowRight size={16} /></Link></div></article>;
}

function Detail({ vault, now, watched, toggleWatch, walletPosition }: { vault: VaultSnapshot; now: number; watched: boolean; toggleWatch: (id: string) => void; walletPosition?: WalletSnapshot["positions"][number] }) {
  const status = evidenceStatus(vault, now);
  const current = status === "fresh" && vault.codePresent && vault.assetMatched;
  return <div className="p0-detail"><Link to="/app/explore" className="p0-back"><ArrowLeft size={16} /> Back to opportunities</Link><div className="p0-detail-hero"><div><div className="p0-detail-title"><VaultLogo vault={vault} /><h1 tabIndex={-1}>{vault.name}<span>.</span></h1></div><p>{vault.description}</p><div className="p0-detail-controls"><button type="button" onClick={() => toggleWatch(vault.id)} className={watched ? "saved" : ""}><Bookmark size={17} fill={watched ? "currentColor" : "none"} /> {watched ? "Saved to watchlist" : "Add to watchlist"}</button><a href={vault.sourceUrl} target="_blank" rel="noreferrer">View at Morpho <ArrowUpRight size={17} /></a>{P1_ENABLED && <Link to={`/app/preflight/new?target=${encodeURIComponent(vault.id)}`}>Run a preflight <ArrowRight size={17} /></Link>}</div></div><div className="p0-detail-seal"><div className={current ? "ok" : "warn"}>{current ? <Check size={34} /> : <CircleAlert size={34} />}</div><strong>{current ? "SOURCE MATCHED" : "REVIEW REQUIRED"}</strong><small>{current ? "Contract code and asset match the reviewed address." : "Fresh contract evidence is unavailable."}</small></div></div>
    <div className="p0-detail-metrics"><div><span>TOTAL ASSETS / ON CHAIN</span><strong>{amount(vault.totalAssetsRaw, vault.assetDecimals)} <small>{vault.asset}</small></strong><p>Vault-reported `totalAssets()` at block {vault.blockNumber ?? "unknown"}.</p></div><div><span>NET APY</span><strong>Not verified</strong><p>No yield rate is quoted without a checked method and time window.</p></div><div><span>YOUR POSITION</span><strong>{walletPosition?.status === "available" ? `${amount(walletPosition.assetsRaw, vault.assetDecimals, 4)} ${vault.asset}` : "Connect to inspect"}</strong><p>{walletPosition?.status === "available" ? "Share value is indicative. Immediate withdrawal capacity is unknown." : "Wallet-specific view only. No transaction is initiated."}</p></div></div>
    <div className="p0-detail-columns"><div className="p0-evidence-card"><div className="p0-card-heading"><StatusPill vault={vault} now={now} /></div><h2>What we checked</h2><div className="p0-evidence-line"><span>Provider listing</span><a href={vault.sourceUrl} target="_blank" rel="noreferrer">Morpho vault page <ExternalLink size={14} /></a></div><div className="p0-evidence-line"><span>Network</span><strong>Arc Mainnet · 5042</strong></div><div className="p0-evidence-line"><span>Vault contract</span><AddressLink address={vault.address} /></div><div className="p0-evidence-line"><span>Contract code</span><strong>{vault.codePresent ? "Present at observed block" : "Unavailable"}</strong></div><div className="p0-evidence-line"><span>Base asset</span><AddressLink address={vault.assetAddress}>{vault.asset} · {shortAddress(vault.assetAddress)}</AddressLink></div><div className="p0-evidence-line"><span>Asset match</span><strong>{vault.assetMatched ? "Confirmed on chain" : "Could not confirm"}</strong></div><div className="p0-evidence-line"><span>Share token</span><strong>{vault.shareSymbol ?? "Unavailable"}</strong></div><div className="p0-evidence-line"><span>Withdrawal capacity</span><a href="https://github.com/morpho-org/vault-v2#overview" target="_blank" rel="noreferrer">Unknown · Vault V2 method <ExternalLink size={14} /></a></div><div className="p0-evidence-line"><span>Block observed</span><strong>{vault.blockNumber ?? "Unavailable"}</strong></div><div className="p0-evidence-line"><span>Block time</span><strong>{timeLabel(vault.blockTimestamp)}</strong></div><div className="p0-evidence-line"><span>Fetched</span><strong>{timeLabel(vault.fetchedAt)}</strong></div><div className="p0-evidence-line"><span>Editorial review</span><strong>{vault.reviewedAt}</strong></div>{vault.error && <p className="p0-evidence-warning">{vault.error}</p>}</div><div className="p0-risk-card"><h2>Risk travels<br /><em>with the asset.</em></h2><p>These flags guide further reading. They are not a rating, an audit, or a statement of safety.</p><div className="p0-risk-stack">{vault.riskFlags.map((flag) => <div key={flag}><strong>{flag}</strong><ArrowDownRight size={16} /></div>)}</div><div className="p0-risk-foot"><LockKeyhole size={18} /><span>Read-only research. MANDEVYR cannot deposit, withdraw, or sign for you in P0.</span></div></div></div>
  </div>;
}
