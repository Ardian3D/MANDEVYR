import { describe, expect, it } from "vitest";
import { encodeEventTopics, encodeFunctionData, parseAbi, toHex, type Hex } from "viem";
import { matchesSettledX402Transfer, parseSignedX402Payment, X402_AMOUNT_RAW, X402_ASSET, X402_NETWORK } from "./payment-recovery.ts";

const wallet = "0x2D44a6E9afAEA4d686E886f93b0BfD2059F20F01";
const payee = "0x1111111111111111111111111111111111111111";
const nonce = `0x${"22".repeat(32)}` as const;
const abi = parseAbi([
  "function transferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce,uint8 v,bytes32 r,bytes32 s)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);
const header = (overrides: Record<string, unknown> = {}) => btoa(JSON.stringify({
  x402Version: 2,
  accepted: { scheme: "exact", network: X402_NETWORK, asset: X402_ASSET, amount: X402_AMOUNT_RAW, payTo: payee, ...overrides },
  payload: { authorization: { from: wallet, to: payee, value: X402_AMOUNT_RAW, validAfter: "0", validBefore: "2000000000", nonce }, signature: `0x${"11".repeat(65)}` },
}));

describe("x402 receipt recovery", () => {
  it("binds a signed payload to the exact wallet, payee, Arc USDC and 0.01 price", () => {
    expect(parseSignedX402Payment(header(), wallet, payee).nonce).toBe(nonce);
    expect(() => parseSignedX402Payment(header({ amount: "20000" }), wallet, payee)).toThrow();
    expect(() => parseSignedX402Payment(header({ network: "eip155:8453" }), wallet, payee)).toThrow();
    expect(() => parseSignedX402Payment(header(), "0x3333333333333333333333333333333333333333", payee)).toThrow();
  });

  it("accepts only a successful matching transferWithAuthorization and USDC Transfer event", () => {
    const payment = parseSignedX402Payment(header(), wallet, payee);
    const tx = { chainId: 5042, to: X402_ASSET, input: encodeFunctionData({ abi, functionName: "transferWithAuthorization", args: [wallet, payee, 10000n, 0n, 2000000000n, nonce, 27, toHex(1n, { size: 32 }), toHex(2n, { size: 32 })] }) };
    const log = { address: X402_ASSET, topics: encodeEventTopics({ abi, eventName: "Transfer", args: { from: wallet, to: payee } }) as unknown as readonly Hex[], data: toHex(10000n, { size: 32 }) };
    expect(matchesSettledX402Transfer(payment, tx, { status: "success", logs: [log] })).toBe(true);
    expect(matchesSettledX402Transfer(payment, tx, { status: "reverted", logs: [log] })).toBe(false);
    expect(matchesSettledX402Transfer(payment, { ...tx, chainId: 8453 }, { status: "success", logs: [log] })).toBe(false);
    expect(matchesSettledX402Transfer(payment, tx, { status: "success", logs: [{ ...log, data: toHex(20000n, { size: 32 }) }] })).toBe(false);
  });
});
