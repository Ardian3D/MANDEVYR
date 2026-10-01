import { describe, expect, it } from "vitest";
import { evaluateDeposit, MANDATE_TEMPLATES, validateRules, type DepositIntent } from "./rules";
import { VAULTS, type VaultSnapshot } from "../p0/registry";

const now = Date.parse("2026-10-01T12:00:00Z");
const vault: VaultSnapshot = { ...VAULTS[0], chainId: 5042, type: "vault", status: "fresh", codePresent: true, assetMatched: true, shareSymbol: "vUSDC", shareDecimals: 18, assetDecimals: 6, totalAssetsRaw: "1000000000", blockNumber: "123", blockTimestamp: new Date(now - 1000).toISOString(), fetchedAt: new Date(now).toISOString(), error: null };
const intent: DepositIntent = { kind: "vault_deposit", chainId: 5042, targetId: vault.id, targetAddress: vault.address, asset: "USDC", amountRaw: "50000000" };
const run = (changes: Partial<DepositIntent> = {}, snapshot = vault, rules = MANDATE_TEMPLATES.balanced) => evaluateDeposit({ intent: { ...intent, ...changes }, vault: snapshot, rules, now });

describe("P1 research preflight", () => {
  it("blocks wrong chain, target, and action limit before unknown evidence", () => {
    const result = run({ chainId: 1, targetAddress: "0x0000000000000000000000000000000000000001", amountRaw: "600000000" });
    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining(["R-CHAIN-001", "R-CONTRACT-001", "R-BUDGET-001"]));
    expect(result.actionAllowed).toBe(false);
  });

  it("fails closed on stale evidence and unknown withdrawal capacity", () => {
    const stale = { ...vault, blockTimestamp: new Date(now - 121_000).toISOString() };
    expect(run({}, stale).verdict).toBe("UNKNOWN");
    expect(run({}, vault, MANDATE_TEMPLATES.conservative).reasons.map((reason) => reason.code)).toContain("R-WITHDRAW-001");
  });

  it("keeps even a clean research result in REVIEW without a simulation", () => {
    const result = run();
    expect(result.verdict).toBe("REVIEW");
    expect(result.actionAllowed).toBe(false);
    expect(result.evidence[0].blockNumber).toBe("123");
  });

  it("checks known daily spending using integer units", () => {
    const result = evaluateDeposit({ intent, vault, rules: MANDATE_TEMPLATES.balanced, now, dailySpentRaw: "1490000000" });
    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons.map((reason) => reason.code)).toContain("R-BUDGET-002");
  });

  it("does not treat EURC units as USDC without a verified FX rate", () => {
    const eurc = { ...vault, asset: "EURC" as const, assetAddress: VAULTS[2].assetAddress };
    const result = run({ asset: "EURC" }, eurc);
    expect(result.verdict).toBe("UNKNOWN");
    expect(result.reasons.map((reason) => reason.code)).toContain("R-FX-001");
  });

  it("rejects invalid mandate limits", () => {
    expect(() => validateRules({ ...MANDATE_TEMPLATES.balanced, maxDailyRaw: "10" })).toThrow();
  });
});
