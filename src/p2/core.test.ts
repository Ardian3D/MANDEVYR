import { describe, expect, it } from "vitest";
import { canPrompt, isExpired, parsePositiveRaw, receiptState, type PreparedAction } from "./core";
import { getP2Config } from "./adapter";

const action = {
  state: "preflight_ready", wallet: "0x1111111111111111111111111111111111111111",
  chainId: 5042002, validUntil: new Date(61_000).toISOString(),
} as unknown as PreparedAction;

describe("P2 action gates", () => {
  it("accepts integer base units without losing precision", () => {
    expect(parsePositiveRaw("100000000000000000000000000000000000")).toBe(100000000000000000000000000000000000n);
    for (const input of ["0", "-1", "1.5", "01", "1e3", "", 1]) expect(() => parsePositiveRaw(input)).toThrow();
    expect(() => parsePositiveRaw((2n ** 256n).toString())).toThrow();
  });

  it("expires exactly at the valid-until boundary and blocks wrong chain or wallet", () => {
    expect(isExpired(action, 60_999)).toBe(false);
    expect(isExpired(action, 61_000)).toBe(true);
    expect(canPrompt(action, action.wallet, 5042002, 60_999)).toBe(true);
    expect(canPrompt(action, action.wallet, 5042, 60_999)).toBe(false);
    expect(canPrompt(action, "0x2222222222222222222222222222222222222222", 5042002, 60_999)).toBe(false);
    expect(canPrompt({ ...action, state: "wallet_prompt" }, action.wallet, 5042002, 60_999)).toBe(false);
  });

  it("only marks success after a successful receipt, not after a wallet hash", () => {
    expect(receiptState(null, false, 31 * 60_000)).toBe("unknown");
    expect(receiptState(null, true, 29 * 60_000)).toBe("unknown");
    expect(receiptState(null, true, 30 * 60_000)).toBe("dropped");
    expect(receiptState({ status: "reverted" }, false, 100)).toBe("reverted");
    expect(receiptState({ status: "success" }, false, 100)).toBe("confirmed");
  });

  it("keeps the adapter closed without reviewed code hashes and an explicit switch", () => {
    expect(getP2Config({}).writesEnabled).toBe(false);
    expect(getP2Config({ P2_WRITES_ENABLED: "true" }).configured).toBe(false);
    expect(getP2Config({ P2_TESTNET_VAULT: "0x1111111111111111111111111111111111111111", P2_TESTNET_ROUTER: "0x2222222222222222222222222222222222222222", P2_TESTNET_VAULT_CODE_HASH: "0x" + "a".repeat(64), P2_TESTNET_ROUTER_CODE_HASH: "0x" + "b".repeat(64) }).writesEnabled).toBe(false);
  });
});
