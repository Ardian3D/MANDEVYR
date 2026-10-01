export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  providers?: EthereumProvider[];
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isPhantom?: boolean;
  isMetaMask?: boolean;
};

export type WalletOption = {
  id: string;
  rememberKey: string;
  name: string;
  icon: string | null;
  provider: EthereumProvider;
  discovery: "eip6963" | "legacy";
};

type Announcement = {
  info?: { uuid?: unknown; name?: unknown; icon?: unknown; rdns?: unknown };
  provider?: unknown;
};

const isProvider = (value: unknown): value is EthereumProvider =>
  typeof value === "object" && value !== null && "request" in value
  && typeof value.request === "function";

function legacyName(provider: EthereumProvider): string {
  if (provider.isRabby) return "Rabby Wallet";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isBraveWallet) return "Brave Wallet";
  if (provider.isPhantom) return "Phantom";
  if (provider.isMetaMask) return "MetaMask";
  return "Browser wallet";
}

function safeIcon(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 100_000) return null;
  return /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[a-zA-Z0-9+/=]+$/.test(value)
    ? value
    : null;
}

export function requestWalletAnnouncements() {
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function listenForWallets(onChange: (wallets: WalletOption[]) => void): () => void {
  let wallets: WalletOption[] = [];
  const timers: number[] = [];

  const add = (option: WalletOption) => {
    const index = wallets.findIndex((item) => item.provider === option.provider);
    if (index >= 0) {
      if (wallets[index].discovery === "eip6963" && option.discovery === "legacy") return;
      wallets = wallets.map((item, position) => position === index ? option : item);
    } else {
      wallets = [...wallets, option];
    }
    onChange([...wallets]);
  };

  const onAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<Announcement>).detail;
    if (!detail || !isProvider(detail.provider)) return;
    const name = typeof detail.info?.name === "string" ? detail.info.name.trim().slice(0, 60) : "";
    const uuid = typeof detail.info?.uuid === "string" ? detail.info.uuid.trim() : "";
    const rdns = typeof detail.info?.rdns === "string" ? detail.info.rdns.trim().toLowerCase() : "";
    if (!name || !uuid) return;
    add({
      id: `eip6963:${uuid}`,
      rememberKey: `eip6963:${rdns || name.toLowerCase()}`,
      name,
      icon: safeIcon(detail.info?.icon),
      provider: detail.provider,
      discovery: "eip6963",
    });
  };

  const collectLegacy = () => {
    const injected = (window as Window & { ethereum?: unknown }).ethereum;
    if (!isProvider(injected)) return;
    const providers = Array.isArray(injected.providers)
      ? injected.providers.filter(isProvider)
      : [injected];
    providers.forEach((provider, index) => {
      const name = legacyName(provider);
      add({
        id: `legacy:${name.toLowerCase().replace(/\s+/g, "-")}:${index}`,
        rememberKey: `legacy:${name.toLowerCase().replace(/\s+/g, "-")}:${index}`,
        name,
        icon: null,
        provider,
        discovery: "legacy",
      });
    });
  };

  window.addEventListener("eip6963:announceProvider", onAnnouncement);
  requestWalletAnnouncements();
  for (const delay of [0, 250, 1_000]) timers.push(window.setTimeout(collectLegacy, delay));

  return () => {
    window.removeEventListener("eip6963:announceProvider", onAnnouncement);
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}
