import { describe, expect, it } from "vitest";
import { evidenceStatus, sourceMatches } from "./evidence";
import { VAULTS } from "./registry";

describe("source evidence", () => {
  const vault = VAULTS[0];
  const observed = {
    code: "0x6000" as const,
    assetAddress: vault.assetAddress,
    assetSymbol: vault.asset,
  };

  it("fails closed when code, underlying address, or symbol differs", () => {
    expect(sourceMatches(vault, observed)).toBe(true);
    expect(sourceMatches(vault, { ...observed, code: undefined })).toBe(false);
    expect(sourceMatches(vault, { ...observed, assetAddress: VAULTS[2].assetAddress })).toBe(false);
    expect(sourceMatches(vault, { ...observed, assetSymbol: "EURC" })).toBe(false);
  });

  it("never marks old, missing, or future observations fresh", () => {
    const now = Date.parse("2026-09-30T12:00:00.000Z");
    expect(evidenceStatus({ status: "fresh", blockTimestamp: "2026-09-30T11:59:00.000Z" }, now)).toBe("fresh");
    expect(evidenceStatus({ status: "fresh", blockTimestamp: "2026-09-30T11:57:59.000Z" }, now)).toBe("stale");
    expect(evidenceStatus({ status: "fresh", blockTimestamp: null }, now)).toBe("stale");
    expect(evidenceStatus({ status: "fresh", blockTimestamp: "2026-09-30T12:01:00.000Z" }, now)).toBe("stale");
    expect(evidenceStatus({ status: "error", blockTimestamp: "2026-09-30T11:59:00.000Z" }, now)).toBe("error");
  });
});
