import { decodeEventLog, decodeFunctionData, isAddress, parseAbi, type Address, type Hex } from "viem";

export const X402_NETWORK = "eip155:5042";
export const X402_ASSET = "0x3600000000000000000000000000000000000000" as const;
export const X402_AMOUNT_RAW = "10000";

const transferAbi = parseAbi([
  "function transferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce,uint8 v,bytes32 r,bytes32 s)",
  "function transferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce,bytes signature)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);

export type SignedX402Payment = {
  wallet: Address;
  payee: Address;
  nonce: Hex;
  validAfter: bigint;
  validBefore: bigint;
};

/** Accept only the exact Arc USDC authorization advertised by this resource. */
export function parseSignedX402Payment(header: string, wallet: string, payee: string): SignedX402Payment {
  if (header.length < 32 || header.length > 8192 || !/^[A-Za-z0-9+/=]+$/.test(header) || !isAddress(wallet) || !isAddress(payee)) throw new Error("Invalid x402 payment header.");
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(atob(header)) as Record<string, unknown>; }
  catch { throw new Error("Invalid x402 payment header."); }
  const accepted = parsed.accepted as Record<string, unknown> | undefined;
  const payload = parsed.payload as Record<string, unknown> | undefined;
  const auth = payload?.authorization as Record<string, unknown> | undefined;
  if (parsed.x402Version !== 2 || accepted?.scheme !== "exact" || accepted.network !== X402_NETWORK ||
    String(accepted.asset).toLowerCase() !== X402_ASSET || accepted.amount !== X402_AMOUNT_RAW ||
    String(accepted.payTo).toLowerCase() !== payee.toLowerCase() || !auth ||
    String(auth.from).toLowerCase() !== wallet.toLowerCase() || String(auth.to).toLowerCase() !== payee.toLowerCase() ||
    auth.value !== X402_AMOUNT_RAW || typeof auth.nonce !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(auth.nonce) ||
    typeof auth.validAfter !== "string" || !/^\d+$/.test(auth.validAfter) ||
    typeof auth.validBefore !== "string" || !/^\d+$/.test(auth.validBefore) ||
    typeof payload?.signature !== "string" || !/^0x[0-9a-fA-F]{130,}$/.test(payload.signature)) throw new Error("The x402 signature does not match this wallet, payee, asset, network, or price.");
  return { wallet: wallet as Address, payee: payee as Address, nonce: auth.nonce as Hex, validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore) };
}

export function matchesSettledX402Transfer(payment: SignedX402Payment, tx: { to: Address | null; input: Hex; chainId?: number | null }, receipt: { status: "success" | "reverted"; logs: readonly { address: Address; topics: readonly Hex[]; data: Hex }[] }): boolean {
  if (receipt.status !== "success" || tx.chainId !== 5042 || tx.to?.toLowerCase() !== X402_ASSET) return false;
  let args: readonly unknown[];
  try {
    const decoded = decodeFunctionData({ abi: transferAbi, data: tx.input });
    if (decoded.functionName !== "transferWithAuthorization") return false;
    args = decoded.args;
  } catch { return false; }
  if (String(args[0]).toLowerCase() !== payment.wallet.toLowerCase() || String(args[1]).toLowerCase() !== payment.payee.toLowerCase() ||
    args[2] !== BigInt(X402_AMOUNT_RAW) || args[3] !== payment.validAfter || args[4] !== payment.validBefore ||
    String(args[5]).toLowerCase() !== payment.nonce.toLowerCase()) return false;
  return receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== X402_ASSET) return false;
    try {
      const event = decodeEventLog({ abi: transferAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      return event.eventName === "Transfer" && event.args.from.toLowerCase() === payment.wallet.toLowerCase() &&
        event.args.to.toLowerCase() === payment.payee.toLowerCase() && event.args.value === BigInt(X402_AMOUNT_RAW);
    } catch { return false; }
  });
}
