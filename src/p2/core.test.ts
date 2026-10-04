import { describe, expect, it } from "vitest";
import { canPrompt, isExpired, parsePositiveRaw, receiptState, reservedDepositRaw, type PreparedAction } from "./core";
import { getP2Config, readExactApproval, verifyBundleCalldata } from "./adapter";
import { encodeFunctionData, parseAbi, zeroAddress, zeroHash } from "viem";
import type { ActionRequirement } from "@morpho-org/morpho-sdk";
import { vaultBundlesV1Abi } from "@morpho-org/morpho-sdk/abis";

const action = {
  state: "preflight_ready", wallet: "0x1111111111111111111111111111111111111111",
  chainId: 5042, validUntil: new Date(61_000).toISOString(),
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
    expect(canPrompt(action, action.wallet, 5042, 60_999)).toBe(true);
    expect(canPrompt(action, action.wallet, 5042002, 60_999)).toBe(false);
    expect(canPrompt(action, "0x2222222222222222222222222222222222222222", 5042, 60_999)).toBe(false);
    expect(canPrompt({ ...action, state: "wallet_prompt" }, action.wallet, 5042, 60_999)).toBe(false);
  });

  it("only marks success after a successful receipt, not after a wallet hash", () => {
    expect(receiptState(null, false, 31 * 60_000)).toBe("unknown");
    expect(receiptState(null, true, 29 * 60_000)).toBe("unknown");
    expect(receiptState(null, true, 30 * 60_000)).toBe("dropped");
    expect(receiptState({ status: "reverted" }, false, 100)).toBe("reverted");
    expect(receiptState({ status: "success" }, false, 100)).toBe("confirmed");
  });

  it("pins Galaxy USDC but keeps wallet transactions off without the mainnet switch", () => {
    expect(getP2Config({}).chainId).toBe(5042);
    expect(getP2Config({}).configured).toBe(true);
    expect(getP2Config({}).writesEnabled).toBe(false);
    expect(getP2Config({ P2_MAINNET_WRITES_ENABLED: "true" }).writesEnabled).toBe(true);
    expect(getP2Config({ P2_MAINNET_WRITES_ENABLED: "TRUE" }).writesEnabled).toBe(false);
  });

  it("pins all three reviewed Arc Mainnet vault routes and rejects unknown vaults", () => {
    const config = getP2Config({});
    expect(config.vaults.map((vault) => vault.id)).toEqual(["galaxy-usdc", "gauntlet-usdc-prime", "gauntlet-eurc-prime"]);
    expect(getP2Config({}, "gauntlet-usdc-prime").assetSymbol).toBe("USDC");
    const eurc = getP2Config({}, "gauntlet-eurc-prime");
    expect(eurc.assetSymbol).toBe("EURC");
    expect(eurc.asset.toLowerCase()).toBe("0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1");
    expect(eurc.vaultCodeHash).not.toBe(config.vaultCodeHash);
    expect(() => getP2Config({}, "unknown-vault")).toThrow();
  });

  it("keeps 24-hour reserves on the same asset across vaults and excludes approvals and testnet", () => {
    const usdc = getP2Config({}).asset;
    const eurc = getP2Config({}, "gauntlet-eurc-prime").asset;
    const item = (asset: string, amountRaw: string, step: "action" | "approval", chainId = 5042) => ({ asset, amountRaw, step, chainId, kind: "deposit" }) as PreparedAction;
    const actions = [item(usdc, "100", "action"), item(usdc, "200", "action"), item(eurc, "300", "action"), item(usdc, "400", "approval"), item(usdc, "500", "action", 5042002)];
    expect(reservedDepositRaw(actions, usdc)).toBe(300n);
    expect(reservedDepositRaw(actions, eurc)).toBe(300n);
  });

  it("accepts only one exact Morpho bundle approval call", () => {
    const token = "0x3600000000000000000000000000000000000000";
    const bundle = "0x76c1dEefAe48523E14903085081Bda2999450b68";
    const calldata = encodeFunctionData({ abi: parseAbi(["function approve(address,uint256) returns (bool)"]), functionName: "approve", args: [bundle, 1000000n] });
    const call = { to: token, data: calldata, value: 0n } as unknown as ActionRequirement;
    expect(readExactApproval([], token, bundle)).toBeNull();
    expect(readExactApproval([call], token, bundle)?.amount).toBe(1000000n);
    expect(() => readExactApproval([call], token, action.wallet as `0x${string}`)).toThrow();
    expect(() => readExactApproval([{ ...call, to: bundle } as ActionRequirement], token, bundle)).toThrow();
    expect(() => readExactApproval([call, call], token, bundle)).toThrow();
  });

  it("rejects bundle calldata for another amount, vault, or referral fee", () => {
    const vault = getP2Config({}).vault;
    const deadline = 1_800_000_000n;
    const deposit = (fee: bigint) => encodeFunctionData({ abi: vaultBundlesV1Abi, functionName: "vaultBundlesV1Deposit", args: [vault, 1_000_000n, 1_000_000_000_000_000n, { kind: 0, data: "0x" }, fee, zeroAddress, deadline] });
    expect(() => verifyBundleCalldata(deposit(0n), "deposit", vault, 1_000_000n, deadline)).not.toThrow();
    expect(() => verifyBundleCalldata(deposit(0n), "deposit", vault, 2_000_000n, deadline)).toThrow();
    expect(() => verifyBundleCalldata(deposit(0n), "deposit", "0x1111111111111111111111111111111111111111", 1_000_000n, deadline)).toThrow();
    expect(() => verifyBundleCalldata(deposit(1n), "deposit", vault, 1_000_000n, deadline)).toThrow();
    const withdraw = encodeFunctionData({ abi: vaultBundlesV1Abi, functionName: "vaultBundlesV1Withdraw", args: [vault, 1_000_000n, 0n, { value: 0n, nonce: 0n, deadline, v: 0, r: zeroHash, s: zeroHash }, 0n, zeroAddress, deadline] });
    expect(() => verifyBundleCalldata(withdraw, "withdraw", vault, 1_000_000n, deadline)).not.toThrow();
    expect(() => verifyBundleCalldata(withdraw, "deposit", vault, 1_000_000n, deadline)).toThrow();
  });
});
