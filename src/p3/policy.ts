export type AgentPolicy = {
  allowedOrigins: string[];
  allowedPathPrefixes: string[];
  maxPerRequestRaw: string;
  maxDailyRaw: string;
  manualApproval: true;
  enabled: boolean;
};

export const DEFAULT_AGENT_POLICY: AgentPolicy = {
  allowedOrigins: [],
  allowedPathPrefixes: [],
  maxPerRequestRaw: "10000",
  maxDailyRaw: "50000",
  manualApproval: true,
  enabled: false,
};

function raw(value: unknown): value is string { return typeof value === "string" && /^(0|[1-9]\d{0,12})$/.test(value); }

export function validateAgentPolicy(value: unknown): AgentPolicy {
  if (!value || typeof value !== "object") throw new Error("An agent spending policy is required.");
  const policy = value as Partial<AgentPolicy>;
  if (!Array.isArray(policy.allowedOrigins) || policy.allowedOrigins.length > 10 || policy.allowedOrigins.some((origin) => {
    if (typeof origin !== "string") return true;
    try { const url = new URL(origin); return url.protocol !== "https:" || url.origin !== origin || Boolean(url.username || url.password) || url.hostname === "localhost" || /^(\d+\.){3}\d+$/.test(url.hostname); }
    catch { return true; }
  })) throw new Error("Use at most ten exact HTTPS origins; local and IP hosts are not allowed.");
  if (!Array.isArray(policy.allowedPathPrefixes) || policy.allowedPathPrefixes.length > 20 || policy.allowedPathPrefixes.some((path) => typeof path !== "string" || !path.startsWith("/") || path.includes("..") || path.length > 160)) throw new Error("Use valid path prefixes starting with /.");
  if (!raw(policy.maxPerRequestRaw) || !raw(policy.maxDailyRaw) || BigInt(policy.maxPerRequestRaw) === 0n || BigInt(policy.maxDailyRaw) < BigInt(policy.maxPerRequestRaw)) throw new Error("Daily USDC cap must be at least the per-request cap.");
  if (policy.manualApproval !== true || typeof policy.enabled !== "boolean") throw new Error("Manual wallet approval is required for every payment.");
  return policy as AgentPolicy;
}

export function assessAgentSpend(input: { policy: AgentPolicy; resourceUrl: string; priceRaw: string; spentTodayRaw: string }) {
  const { policy, resourceUrl, priceRaw, spentTodayRaw } = input;
  let url: URL;
  try { url = new URL(resourceUrl); } catch { return { allowed: false, reason: "Invalid resource URL." }; }
  if (!policy.enabled) return { allowed: false, reason: "Agent spending is disabled." };
  if (url.protocol !== "https:" || url.username || url.password || !policy.allowedOrigins.includes(url.origin) || !policy.allowedPathPrefixes.some((path) => url.pathname.startsWith(path))) return { allowed: false, reason: "Resource is outside the domain or endpoint allowlist." };
  if (!raw(priceRaw) || BigInt(priceRaw) === 0n || !raw(spentTodayRaw)) return { allowed: false, reason: "Invalid USDC amount." };
  if (BigInt(priceRaw) > BigInt(policy.maxPerRequestRaw)) return { allowed: false, reason: "Price exceeds the per-request USDC cap." };
  if (BigInt(priceRaw) + BigInt(spentTodayRaw) > BigInt(policy.maxDailyRaw)) return { allowed: false, reason: "Price exceeds the remaining daily USDC cap." };
  return { allowed: true, reason: "Within policy; a separate wallet approval is still required." };
}
