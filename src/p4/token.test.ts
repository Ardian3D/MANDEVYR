import { describe, expect, it } from "vitest";
import { buildDeepDive } from "./token";
import type { PreflightReport } from "../p1/rules";
import type { VaultSnapshot } from "../p0/registry";

describe("token report utility", () => {
  it("keeps preflight blocks and evidence limitations visible", () => {
    const report = {
      id: "prf_test", createdAt: "2026-10-05T00:00:00.000Z", validUntil: "2026-10-05T00:01:00.000Z", verdict: "UNKNOWN",
      reasons: [{ code: "R-WITHDRAW-001", severity: "UNKNOWN", text: "Withdrawal capacity is unknown." }],
      evidence: [{ sourceType: "arc_rpc", uri: "https://explorer.arc.io/address/example", status: "fresh", observedAt: "2026-10-05T00:00:00.000Z", blockNumber: "1" }],
    } as PreflightReport;
    const result = buildDeepDive(report);
    expect(result.actionAllowed).toBe(false);
    expect(result.counts.unknowns).toBe(1);
    expect(result.priorityChecks[0].code).toBe("R-WITHDRAW-001");
    expect(result.sources[0].limitation).toContain("not withdrawal liquidity");
  });

  it("adds a current registry observation without treating it as proof of safety", () => {
    const report: PreflightReport = { id: "prf_test", createdAt: "2026-10-05T00:00:00.000Z", validUntil: "2026-10-05T00:01:00.000Z", mandateId: "mandate", mandateVersion: 1, rulesetVersion: "test", actionAllowed: false, summary: "Review", verdict: "REVIEW", reasons: [], evidence: [], intent: { kind: "vault_deposit", chainId: 5042, targetId: "galaxy-usdc", targetAddress: "0x1111111111111111111111111111111111111111", asset: "USDC", amountRaw: "1000000" } };
    const current = { id: "galaxy-usdc", address: report.intent.targetAddress, status: "fresh", codePresent: true, assetMatched: true, blockNumber: "42", blockTimestamp: "2026-10-05T00:02:00.000Z", totalAssetsRaw: "1000000", asset: "USDC" } as VaultSnapshot;
    const result = buildDeepDive(report, current);
    expect(result.liveCheck?.contractMatched).toBe(true);
    expect(result.liveCheck?.blockNumber).toBe("42");
    expect(result.liveCheck?.limitation).toContain("does not prove withdrawal capacity");
  });
});
