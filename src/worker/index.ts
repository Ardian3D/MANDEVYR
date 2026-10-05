import { Hono } from "hono";
import { createPublicClient, http, isAddress, parseAbi } from "viem";
import { arc } from "viem/chains";
import {
  ARC_RPC,
  VAULTS,
  type RegistryResponse,
  type VaultDefinition,
  type VaultSnapshot,
  type WalletSnapshot,
} from "../p0/registry.ts";
import { evidenceStatus, sourceMatches } from "../p0/evidence.ts";
import { createP1Api, runWatchtower, type P1Database } from "../p1/api.ts";

const app = new Hono<{ Bindings: { DB?: P1Database } }>();
const client = createPublicClient({
  chain: arc,
  transport: http(ARC_RPC, { timeout: 9_000, retryCount: 1, retryDelay: 200 }),
});

const vaultAbi = parseAbi([
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
]);
const assetAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

type Cached = { until: number; value: RegistryResponse };
let cached: Cached | undefined;
const lastGood = new Map<string, VaultSnapshot>();

function failedVault(def: VaultDefinition, fetchedAt: string): VaultSnapshot {
  return {
    ...def,
    chainId: 5042,
    type: "vault",
    status: "error",
    codePresent: false,
    assetMatched: false,
    shareSymbol: null,
    shareDecimals: null,
    assetDecimals: null,
    totalAssetsRaw: null,
    blockNumber: null,
    blockTimestamp: null,
    fetchedAt,
    error: "On-chain evidence is unavailable. This entry cannot be assessed right now.",
  };
}

async function inspectVault(def: VaultDefinition, blockNumber: bigint, blockTimestamp: string, fetchedAt: string): Promise<VaultSnapshot> {
  try {
    const [code, assetAddress, totalAssets, shareSymbol, shareDecimals] = await Promise.all([
      client.getBytecode({ address: def.address, blockNumber }),
      client.readContract({ address: def.address, abi: vaultAbi, functionName: "asset", blockNumber }),
      client.readContract({ address: def.address, abi: vaultAbi, functionName: "totalAssets", blockNumber }),
      client.readContract({ address: def.address, abi: vaultAbi, functionName: "symbol", blockNumber }),
      client.readContract({ address: def.address, abi: vaultAbi, functionName: "decimals", blockNumber }),
    ]);
    const [assetSymbol, assetDecimals] = await Promise.all([
      client.readContract({ address: assetAddress, abi: assetAbi, functionName: "symbol", blockNumber }),
      client.readContract({ address: assetAddress, abi: assetAbi, functionName: "decimals", blockNumber }),
    ]);
    const valid = sourceMatches(def, { code, assetAddress, assetSymbol });
    return {
      ...def,
      chainId: 5042,
      type: "vault",
      status: valid ? "fresh" : "error",
      codePresent: Boolean(code && code !== "0x"),
      assetMatched: assetAddress.toLowerCase() === def.assetAddress.toLowerCase() && assetSymbol === def.asset,
      shareSymbol,
      shareDecimals,
      assetDecimals,
      totalAssetsRaw: valid ? totalAssets.toString() : null,
      blockNumber: blockNumber.toString(),
      blockTimestamp,
      fetchedAt,
      error: valid ? null : "Contract code or base asset does not match the reviewed source.",
    };
  } catch {
    return failedVault(def, fetchedAt);
  }
}

async function registry(force = false): Promise<RegistryResponse> {
  if (!force && cached && Date.now() < cached.until) return cached.value;
  const observedAt = new Date().toISOString();
  let items: VaultSnapshot[];
  try {
    const block = await client.getBlock();
    const blockTimestamp = new Date(Number(block.timestamp) * 1000).toISOString();
    items = await Promise.all(VAULTS.map(async (def) => {
      let item = await inspectVault(def, block.number, blockTimestamp, observedAt);
      if (item.status === "error") item = await inspectVault(def, block.number, blockTimestamp, observedAt);
      if (item.status === "fresh") {
        lastGood.set(def.id, item);
        return item;
      }
      const previous = lastGood.get(def.id);
      return previous
        ? { ...previous, status: "stale" as const, error: "RPC refresh failed. Showing the last checked block." }
        : item;
    }));
  } catch {
    if (cached) {
      return {
        ...cached.value,
        items: cached.value.items.map((item) => ({ ...item, status: "stale" as const, error: "RPC refresh failed. Showing a previous observation." })),
      };
    }
    items = VAULTS.map((def) => failedVault(def, observedAt));
  }
  const value: RegistryResponse = { network: "Arc Mainnet", chainId: 5042, observedAt, items };
  cached = { value, until: Date.now() + (items.every((item) => item.status === "fresh") ? 45_000 : 10_000) };
  return value;
}

app.get("/api/health", async (c) => {
  const data = await registry();
  const verifiedEntries = data.items.filter((item) => evidenceStatus(item, Date.now()) === "fresh").length;
  return c.json({
    status: verifiedEntries === VAULTS.length ? "ok" : "degraded",
    chainId: data.chainId,
    verifiedEntries,
    observedAt: data.observedAt,
  }, 200, { "Cache-Control": "no-store" });
});

app.get("/api/registry", async (c) => c.json(await registry(), 200, { "Cache-Control": "public, max-age=30" }));

app.get("/api/registry/:id", async (c) => {
  const item = (await registry()).items.find((vault) => vault.id === c.req.param("id"));
  if (!item) return c.json({ error: "Opportunity not found" }, 404);
  return c.json(item, 200, { "Cache-Control": "public, max-age=30" });
});

app.get("/api/wallet/:address", async (c) => {
  const address = c.req.param("address");
  if (!isAddress(address)) return c.json({ error: "Invalid wallet address" }, 400);
  try {
    const block = await client.getBlock();
    const nativeUsdc = await client.getBalance({ address, blockNumber: block.number });
    const liveRegistry = await registry();
    const positions = await Promise.all(liveRegistry.items.map(async (vault) => {
      if (vault.status !== "fresh") return { vaultId: vault.id, sharesRaw: "0", assetsRaw: null, maxWithdrawRaw: null, status: "unavailable" as const };
      try {
        const shares = await client.readContract({ address: vault.address, abi: vaultAbi, functionName: "balanceOf", args: [address], blockNumber: block.number });
        const assets = await client.readContract({ address: vault.address, abi: vaultAbi, functionName: "convertToAssets", args: [shares], blockNumber: block.number });
        // Morpho Vault V2 always returns zero from maxWithdraw, regardless of
        // actual exit liquidity. Keep the status unknown until a validated lens exists.
        return { vaultId: vault.id, sharesRaw: shares.toString(), assetsRaw: assets.toString(), maxWithdrawRaw: null, status: "available" as const };
      } catch {
        return { vaultId: vault.id, sharesRaw: "0", assetsRaw: null, maxWithdrawRaw: null, status: "unavailable" as const };
      }
    }));
    const result: WalletSnapshot = {
      address,
      chainId: 5042,
      blockNumber: block.number.toString(),
      observedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
      nativeUsdcRaw: nativeUsdc.toString(),
      nativeUsdcDecimals: 18,
      positions,
    };
    return c.json(result, 200, { "Cache-Control": "no-store" });
  } catch {
    return c.json({ error: "Arc RPC is unavailable. No wallet values are being shown." }, 503, { "Cache-Control": "no-store" });
  }
});

app.route("/api/p1", createP1Api(
  () => registry(true),
  (args) => client.verifySiweMessage(args),
));

export default {
  fetch(request: Request, env?: { DB?: P1Database; MANDEVYR_PUBLIC_ORIGINS?: string; P2_MAINNET_WRITES_ENABLED?: string }) { return app.fetch(request, env); },
  async scheduled(_event: unknown, env: { DB?: P1Database }) {
    if (!env.DB) return;
    await runWatchtower(env.DB, () => registry(true));
  },
};
