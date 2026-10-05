import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createProviderSigner } from "./provider-signer.ts";

describe("x402 browser wallet signer", () => {
  it("sends an EIP-712 v4 request and returns the wallet's signature", async () => {
    const account = privateKeyToAccount(`0x${"33".repeat(32)}`);
    const domain = { name: "USDC", version: "2", chainId: 5042, verifyingContract: "0x3600000000000000000000000000000000000000" } as const;
    const types = { TransferWithAuthorization: [
      { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
    ] } as const;
    const message = { from: account.address, to: "0x1111111111111111111111111111111111111111" as const, value: 10000n, validAfter: 0n, validBefore: 2000000000n, nonce: `0x${"44".repeat(32)}` as `0x${string}` };
    const expected = await account.signTypedData({ domain, types, primaryType: "TransferWithAuthorization", message });
    let method = "";
    const provider = { request: async (args: { method: string; params?: unknown[] }) => {
      method = args.method;
      expect(args.params?.[0]).toBe(account.address);
      const typed = JSON.parse(String(args.params?.[1]));
      expect(typed.types.EIP712Domain.map((item: { name: string }) => item.name)).toEqual(["name", "version", "chainId", "verifyingContract"]);
      return account.signTypedData(typed);
    } };
    const actual = await createProviderSigner(provider, account.address).signTypedData({ domain, types, primaryType: "TransferWithAuthorization", message });
    expect(method).toBe("eth_signTypedData_v4");
    expect(actual).toBe(expected);
  });
});
