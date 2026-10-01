import type { VaultDefinition, VaultSnapshot } from "./registry";

export function sourceMatches(
  definition: VaultDefinition,
  observed: { code: `0x${string}` | undefined; assetAddress: string; assetSymbol: string },
): boolean {
  return Boolean(observed.code && observed.code !== "0x")
    && observed.assetAddress.toLowerCase() === definition.assetAddress.toLowerCase()
    && observed.assetSymbol === definition.asset;
}

export function evidenceStatus(
  vault: Pick<VaultSnapshot, "status" | "blockTimestamp">,
  now: number,
): "fresh" | "stale" | "error" {
  if (vault.status === "error") return "error";
  if (vault.status === "stale") return "stale";
  const timestamp = Date.parse(vault.blockTimestamp ?? "");
  if (!Number.isFinite(timestamp) || timestamp > now + 30_000 || now - timestamp > 120_000) return "stale";
  return "fresh";
}
