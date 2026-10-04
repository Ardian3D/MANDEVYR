import { isAddress } from "viem";
import { evidenceStatus } from "../p0/evidence.ts";
import type { VaultSnapshot } from "../p0/registry.ts";

export const RULESET_VERSION = "2026-10-01.1";
export type Verdict = "PASS" | "REVIEW" | "BLOCK" | "UNKNOWN";
export type Reason = { code: string; severity: Verdict; text: string };

export type MandateRules = {
  maxActionRaw: string;
  maxDailyRaw: string;
  maxEurcActionRaw?: string;
  maxEurcDailyRaw?: string;
  maxGasRaw: string;
  allowedAssets: ("USDC" | "EURC")[];
  deniedTargets: string[];
  requireAvailableWithdrawal: boolean;
  maxEvidenceAgeSeconds: number;
  manualApproval: true;
};

export type Mandate = {
  id: string;
  version: number;
  rules: MandateRules;
  createdAt: string;
  supersedesId: string | null;
};

export type DepositIntent = {
  kind: "vault_deposit";
  chainId: number;
  targetId: string;
  targetAddress: string;
  asset: "USDC" | "EURC";
  amountRaw: string;
};

export type EvidenceRef = {
  sourceType: "arc_rpc" | "provider_listing";
  uri: string;
  observedAt: string | null;
  fetchedAt: string;
  blockNumber: string | null;
  status: "fresh" | "stale" | "error";
  ttlSeconds: number;
  metricDefinition: string;
  summaryHash: string | null;
};

export type PreflightReport = {
  id: string;
  intent: DepositIntent;
  mandateId: string;
  mandateVersion: number;
  verdict: Verdict;
  reasons: Reason[];
  evidence: EvidenceRef[];
  rulesetVersion: string;
  createdAt: string;
  validUntil: string;
  actionAllowed: false;
  summary: string;
};

export const MANDATE_TEMPLATES: Record<"conservative" | "balanced" | "explorer", MandateRules> = {
  conservative: { maxActionRaw: "100000000", maxDailyRaw: "300000000", maxEurcActionRaw: "0", maxEurcDailyRaw: "0", maxGasRaw: "100000000000000000", allowedAssets: ["USDC"], deniedTargets: [], requireAvailableWithdrawal: true, maxEvidenceAgeSeconds: 60, manualApproval: true },
  balanced: { maxActionRaw: "500000000", maxDailyRaw: "1500000000", maxEurcActionRaw: "0", maxEurcDailyRaw: "0", maxGasRaw: "250000000000000000", allowedAssets: ["USDC", "EURC"], deniedTargets: [], requireAvailableWithdrawal: false, maxEvidenceAgeSeconds: 120, manualApproval: true },
  explorer: { maxActionRaw: "2000000000", maxDailyRaw: "5000000000", maxEurcActionRaw: "0", maxEurcDailyRaw: "0", maxGasRaw: "500000000000000000", allowedAssets: ["USDC", "EURC"], deniedTargets: [], requireAvailableWithdrawal: false, maxEvidenceAgeSeconds: 120, manualApproval: true },
};

function uint(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d{0,29})$/.test(value);
}

export function validateRules(value: unknown): MandateRules {
  if (!value || typeof value !== "object") throw new Error("Mandate rules are required.");
  const rules = value as Partial<MandateRules>;
  if (!uint(rules.maxActionRaw) || BigInt(rules.maxActionRaw) === 0n || !uint(rules.maxDailyRaw) || BigInt(rules.maxDailyRaw) < BigInt(rules.maxActionRaw)) throw new Error("Set a valid action limit and a daily limit at least as large.");
  if (rules.maxEurcActionRaw !== undefined || rules.maxEurcDailyRaw !== undefined) {
    if (!uint(rules.maxEurcActionRaw) || !uint(rules.maxEurcDailyRaw) || BigInt(rules.maxEurcDailyRaw) < BigInt(rules.maxEurcActionRaw)) throw new Error("Set valid EURC limits with a daily limit at least as large as the action limit.");
  }
  if (!uint(rules.maxGasRaw)) throw new Error("Set a valid gas limit.");
  if (!Array.isArray(rules.allowedAssets) || rules.allowedAssets.length === 0 || rules.allowedAssets.some((asset) => asset !== "USDC" && asset !== "EURC")) throw new Error("Choose USDC and/or EURC.");
  if (!Array.isArray(rules.deniedTargets) || rules.deniedTargets.length > 20 || rules.deniedTargets.some((target) => typeof target !== "string" || target.length > 100)) throw new Error("Invalid blocked target list.");
  if (typeof rules.requireAvailableWithdrawal !== "boolean" || !Number.isInteger(rules.maxEvidenceAgeSeconds) || rules.maxEvidenceAgeSeconds! < 30 || rules.maxEvidenceAgeSeconds! > 120 || rules.manualApproval !== true) throw new Error("Invalid evidence, withdrawal, or approval setting.");
  return rules as MandateRules;
}

export function validateIntent(value: unknown): DepositIntent {
  if (!value || typeof value !== "object") throw new Error("An intent is required.");
  const intent = value as Partial<DepositIntent>;
  if (intent.kind !== "vault_deposit" || typeof intent.targetId !== "string" || intent.targetId.length > 80 || !isAddress(intent.targetAddress ?? "") || (intent.asset !== "USDC" && intent.asset !== "EURC") || !uint(intent.amountRaw) || BigInt(intent.amountRaw) === 0n) throw new Error("Invalid vault, asset, or amount.");
  if (!Number.isInteger(intent.chainId)) throw new Error("Invalid chain ID.");
  return intent as DepositIntent;
}

export function evaluateDeposit(input: { intent: DepositIntent; rules: MandateRules; vault?: VaultSnapshot; now: number; dailySpentRaw?: string | null }): Omit<PreflightReport, "id" | "mandateId" | "mandateVersion" | "createdAt" | "validUntil"> {
  const { intent, rules, vault, now } = input;
  const reasons: Reason[] = [];
  const add = (code: string, severity: Verdict, text: string) => reasons.push({ code, severity, text });
  if (intent.chainId !== 5042) add("R-CHAIN-001", "BLOCK", "The requested network is not Arc Mainnet (5042).");
  if (!vault || vault.id !== intent.targetId || vault.address.toLowerCase() !== intent.targetAddress.toLowerCase()) add("R-CONTRACT-001", "BLOCK", "The target does not match a reviewed vault address.");
  if (vault && vault.asset !== intent.asset) add("R-ASSET-001", "BLOCK", "The selected asset does not match the vault base asset.");
  if (!rules.allowedAssets.includes(intent.asset)) add("R-ASSET-002", "BLOCK", `${intent.asset} is not enabled in this mandate.`);
  if (rules.deniedTargets.includes(intent.targetId) || rules.deniedTargets.some((target) => target.toLowerCase() === intent.targetAddress.toLowerCase())) add("R-CONTRACT-002", "BLOCK", "This target is blocked by your mandate.");
  if (intent.asset === "EURC") add("R-FX-001", "UNKNOWN", "A verified EURC-to-USDC rate is unavailable, so USDC limits cannot be applied accurately.");
  else {
    if (BigInt(intent.amountRaw) > BigInt(rules.maxActionRaw)) add("R-BUDGET-001", "BLOCK", "The amount exceeds your per-action limit.");
    if (input.dailySpentRaw === null || input.dailySpentRaw === undefined) add("R-BUDGET-002", "REVIEW", "MANDEVYR cannot verify your total spending across other apps in the last 24 hours.");
    else if (BigInt(intent.amountRaw) + BigInt(input.dailySpentRaw) > BigInt(rules.maxDailyRaw)) add("R-BUDGET-002", "BLOCK", "The amount plus known 24-hour spending exceeds your daily limit.");
  }
  if (vault) {
    if (vault.assetDecimals !== 6) add("R-DECIMALS-001", "UNKNOWN", "The asset decimals differ from the supported 6-decimal preflight unit.");
    const status = evidenceStatus(vault, now);
    const age = now - Date.parse(vault.blockTimestamp ?? "");
    if (status !== "fresh" || !Number.isFinite(age) || age > rules.maxEvidenceAgeSeconds * 1000) add("R-DATA-001", "UNKNOWN", "The contract evidence is unavailable or older than your mandate allows.");
    if (rules.requireAvailableWithdrawal) add("R-WITHDRAW-001", "UNKNOWN", "Current withdrawal capacity is unknown for this Morpho Vault V2 vault.");
    add("R-APY-001", "REVIEW", "APY is not independently verified. Review the provider's current terms.");
  }
  add("R-SIM-001", "REVIEW", "This is a research preflight. No transaction quote or simulation is available in P1.");
  add("R-GAS-001", "REVIEW", "Estimated transaction gas is unavailable until an action is prepared in a later phase.");
  const verdict: Verdict = reasons.some((reason) => reason.severity === "BLOCK") ? "BLOCK" : reasons.some((reason) => reason.severity === "UNKNOWN") ? "UNKNOWN" : "REVIEW";
  const evidence: EvidenceRef[] = vault ? [
    { sourceType: "arc_rpc", uri: `https://explorer.arc.io/address/${vault.address}`, observedAt: vault.blockTimestamp, fetchedAt: vault.fetchedAt, blockNumber: vault.blockNumber, status: evidenceStatus(vault, now), ttlSeconds: 120, metricDefinition: "Contract code, base asset and total assets observed at one Arc block", summaryHash: null },
    { sourceType: "provider_listing", uri: vault.sourceUrl, observedAt: null, fetchedAt: vault.reviewedAt, blockNumber: null, status: "stale", ttlSeconds: 0, metricDefinition: "Editorial vault identity check; not live market or liquidity evidence", summaryHash: null },
  ] : [];
  const summary = verdict === "BLOCK" ? "This intent conflicts with your mandate or the reviewed target." : verdict === "UNKNOWN" ? "Required evidence is unavailable; do not rely on this report for an action." : "No hard stop found, but key risks and action estimates still need review.";
  return { intent, verdict, reasons, evidence, rulesetVersion: RULESET_VERSION, actionAllowed: false, summary };
}
