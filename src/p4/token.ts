import { createPublicClient, fallback, formatUnits, http, parseAbi, type Address } from "viem";
import { arc } from "viem/chains";
import type { PreflightReport } from "../p1/rules.ts";
import type { VaultSnapshot } from "../p0/registry.ts";
import { DAILY_FREE_REPORTS, DAILY_HOLDER_REPORTS, MDVYR_MIN_BALANCE_RAW, MDVYR_TOKEN } from "./config.ts";
export { DAILY_FREE_REPORTS, DAILY_HOLDER_REPORTS, MDVYR_MIN_BALANCE_RAW, MDVYR_TOKEN, MDVYR_ARGUS_URL } from "./config.ts";

const tokenAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const client = createPublicClient({
  chain: arc,
  transport: fallback([
    http("https://rpc.drpc.mainnet.arc.io", { timeout: 9_000, retryCount: 0 }),
    http("https://rpc.blockdaemon.mainnet.arc.io", { timeout: 9_000, retryCount: 0 }),
    http("https://rpc.quicknode.mainnet.arc.io", { timeout: 9_000, retryCount: 0 }),
  ]),
});

export type HolderEvidence = {
  chainId: 5042;
  token: Address;
  wallet: Address;
  blockNumber: string;
  observedAt: string;
  balanceRaw: string;
  balance: string;
  totalSupplyRaw: string;
  totalSupply: string;
  holder: boolean;
  dailyReportLimit: number;
};

export async function readHolderEvidence(wallet: Address): Promise<HolderEvidence> {
  if (await client.getChainId() !== 5042) throw new Error("Arc Mainnet RPC returned another chain.");
  const block = await client.getBlock();
  const [code, name, symbol, decimals, supply, balance] = await Promise.all([
    client.getBytecode({ address: MDVYR_TOKEN, blockNumber: block.number }),
    client.readContract({ address: MDVYR_TOKEN, abi: tokenAbi, functionName: "name", blockNumber: block.number }),
    client.readContract({ address: MDVYR_TOKEN, abi: tokenAbi, functionName: "symbol", blockNumber: block.number }),
    client.readContract({ address: MDVYR_TOKEN, abi: tokenAbi, functionName: "decimals", blockNumber: block.number }),
    client.readContract({ address: MDVYR_TOKEN, abi: tokenAbi, functionName: "totalSupply", blockNumber: block.number }),
    client.readContract({ address: MDVYR_TOKEN, abi: tokenAbi, functionName: "balanceOf", args: [wallet], blockNumber: block.number }),
  ]);
  if (!code || code === "0x" || name !== "MANDEVYR" || symbol !== "MDVYR" || decimals !== 18 || supply <= 0n || supply > 1_000_000_000n * 10n ** 18n) {
    throw new Error("The official token identity could not be verified at this Arc block.");
  }
  const holder = balance >= MDVYR_MIN_BALANCE_RAW;
  return {
    chainId: 5042,
    token: MDVYR_TOKEN,
    wallet,
    blockNumber: block.number.toString(),
    observedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
    balanceRaw: balance.toString(),
    balance: formatUnits(balance, decimals),
    totalSupplyRaw: supply.toString(),
    totalSupply: formatUnits(supply, decimals),
    holder,
    dailyReportLimit: holder ? DAILY_HOLDER_REPORTS : DAILY_FREE_REPORTS,
  };
}

export function buildDeepDive(report: PreflightReport, current?: VaultSnapshot) {
  const blocks = report.reasons.filter((reason) => reason.severity === "BLOCK");
  const unknowns = report.reasons.filter((reason) => reason.severity === "UNKNOWN");
  const reviews = report.reasons.filter((reason) => reason.severity === "REVIEW");
  const sourceChecks = report.evidence.map((source) => ({
    source: source.sourceType,
    url: source.uri,
    status: source.status,
    observedAt: source.observedAt,
    blockNumber: source.blockNumber,
    limitation: source.sourceType === "arc_rpc"
      ? "This block verifies contract identity and total assets, not withdrawal liquidity, strategy safety, or future performance."
      : "This listing is editorial context; it is not live on-chain proof.",
  }));
  return {
    reportId: report.id,
    generatedAt: report.createdAt,
    snapshotAt: report.createdAt,
    snapshotExpired: Date.now() > Date.parse(report.validUntil),
    verdict: report.verdict,
    actionAllowed: false,
    counts: { blocks: blocks.length, unknowns: unknowns.length, reviews: reviews.length },
    priorityChecks: [...blocks, ...unknowns, ...reviews].map((reason) => ({ code: reason.code, severity: reason.severity, explanation: reason.text })),
    sources: sourceChecks,
    liveCheck: current ? {
      status: current.status,
      contractMatched: current.address.toLowerCase() === report.intent.targetAddress.toLowerCase(),
      codePresent: current.codePresent,
      assetMatched: current.assetMatched,
      blockNumber: current.blockNumber,
      observedAt: current.blockTimestamp,
      totalAssetsRaw: current.totalAssetsRaw,
      asset: current.asset,
      snapshotBlockNumber: report.evidence.find((source) => source.sourceType === "arc_rpc")?.blockNumber ?? null,
      limitation: "This refresh checks identity and reported assets only. It does not prove withdrawal capacity, strategy safety, or future returns.",
    } : null,
    nextSteps: [
      "Refresh on-chain evidence before considering any action; this report is a historical snapshot.",
      "Check live withdrawal capacity, transaction simulation, gas, and the vault's current terms in Actions.",
      "Review any BLOCK or UNKNOWN reason before signing a wallet transaction.",
    ],
    methodology: "Deterministic expansion of the saved preflight. No AI or return estimate is used.",
  };
}
