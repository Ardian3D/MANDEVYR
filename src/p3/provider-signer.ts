import type { EthereumProvider } from "../p0/wallets";

/** EIP-1193 adapter for the x402 SDK. The wallet alone holds the signing key. */
export function createProviderSigner(provider: EthereumProvider, wallet: `0x${string}`) {
  return {
    address: wallet,
    signTypedData: async (data: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> }): Promise<`0x${string}`> => {
      const domainTypes = Object.entries(data.domain).filter(([name]) => ["name", "version", "chainId", "verifyingContract", "salt"].includes(name)).map(([name]) => ({ name, type: name === "chainId" ? "uint256" : name === "verifyingContract" ? "address" : name === "salt" ? "bytes32" : "string" }));
      const typed = JSON.stringify({ domain: data.domain, types: { EIP712Domain: domainTypes, ...data.types }, primaryType: data.primaryType, message: data.message }, (_, value) => typeof value === "bigint" ? value.toString() : value);
      const signature = await provider.request({ method: "eth_signTypedData_v4", params: [wallet, typed] });
      if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130,}$/.test(signature)) throw new Error("Wallet did not return a valid typed-data signature.");
      return signature as `0x${string}`;
    },
  };
}
