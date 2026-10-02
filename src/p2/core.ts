export const P2_CHAIN_ID = 5042002;
export const P2_RPC = "https://rpc.testnet.arc.io";
export const P2_EXPLORER = "https://explorer.testnet.arc.io";
export const P2_USDC = "0x3600000000000000000000000000000000000000";
export const P2_QUOTE_TTL_MS = 60_000;

export type ActionKind = "deposit" | "withdraw";
export type ActionState = "draft" | "preflight_ready" | "wallet_prompt" | "submitted" | "confirmed" | "reverted" | "dropped" | "unknown";
export type StepKind = "approval" | "action";
export type PreparedAction = {
  id: string;
  chainId: typeof P2_CHAIN_ID;
  wallet: `0x${string}`;
  vault: `0x${string}`;
  target: `0x${string}`;
  calldata: `0x${string}`;
  asset: `0x${string}`;
  assetDecimals: number;
  shareDecimals: number;
  kind: ActionKind;
  amountRaw: string;
  previewRaw: string;
  minSharesRaw: string | null;
  previewLabel: "shares received" | "shares burned";
  allowanceRaw: string | null;
  approvalAmountRaw: string | null;
  gasLimitRaw: string;
  gasPriceRaw: string;
  gasCostRaw: string;
  gasUnit: "native USDC";
  blockNumber: string;
  codeHash: `0x${string}`;
  mandateId: string;
  mandateVersion: number;
  evidenceUrl: string;
  createdAt: string;
  validUntil: string;
  state: ActionState;
  step: StepKind;
  txHash: `0x${string}` | null;
  txNonce: number | null;
  submittedAt: string | null;
  message: string | null;
};

export function parsePositiveRaw(value: unknown): bigint {
  if (typeof value !== "string" || !/^[1-9]\d{0,77}$/.test(value)) throw new Error("Enter an amount in base units greater than zero.");
  const raw = BigInt(value);
  if (raw >= 2n ** 256n) throw new Error("The amount is too large.");
  return raw;
}

export function isExpired(action: Pick<PreparedAction, "validUntil">, now = Date.now()): boolean {
  return !Number.isFinite(Date.parse(action.validUntil)) || now >= Date.parse(action.validUntil);
}

export function canPrompt(action: PreparedAction, wallet: string, chainId: number, now = Date.now()): boolean {
  return action.state === "preflight_ready" && !isExpired(action, now) && action.wallet.toLowerCase() === wallet.toLowerCase() && chainId === P2_CHAIN_ID;
}

export function receiptState(receipt: { status: "success" | "reverted" } | null, transactionNotFound: boolean, ageMs: number): ActionState {
  if (receipt?.status === "success") return "confirmed";
  if (receipt?.status === "reverted") return "reverted";
  if (transactionNotFound && ageMs >= 30 * 60_000) return "dropped";
  return "unknown";
}

export function formatP2Error(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/user rejected|user denied|4001/i.test(message)) return "You cancelled the wallet request. No transaction was sent.";
  if (/insufficient funds/i.test(message)) return "Your wallet does not have enough testnet USDC for the amount and gas.";
  if (/allowance|transfer amount exceeds/i.test(message)) return "The token allowance is too low. Refresh the review and approve the exact amount first.";
  return "The action could not be prepared or verified. Refresh the review before trying again.";
}
