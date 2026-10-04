export const P2_CHAIN_ID = 5042;
export const P2_RPC = "https://rpc.mainnet.arc.io";
export const P2_EXPLORER = "https://explorer.arc.io";
export const P2_USDC = "0x3600000000000000000000000000000000000000";
export const P2_QUOTE_TTL_MS = 60_000;

export type ActionKind = "deposit" | "withdraw";
export type ActionState = "draft" | "preflight_ready" | "wallet_prompt" | "submitted" | "confirmed" | "reverted" | "dropped" | "unknown";
export type StepKind = "approval" | "action";
export type PreparedAction = {
  id: string;
  chainId: typeof P2_CHAIN_ID;
  wallet: `0x${string}`;
  vaultId: string;
  vaultName: string;
  vault: `0x${string}`;
  target: `0x${string}`;
  calldata: `0x${string}`;
  asset: `0x${string}`;
  assetSymbol: "USDC" | "EURC";
  assetDecimals: number;
  shareDecimals: number;
  kind: ActionKind;
  amountRaw: string;
  previewRaw: string;
  minSharesRaw: string | null;
  previewLabel: "estimated shares received" | "estimated shares to burn";
  allowanceRaw: string | null;
  approvalAmountRaw: string | null;
  gasLimitRaw: string;
  gasPriceRaw: string;
  gasCostRaw: string;
  gasUnit: "native USDC";
  blockNumber: string;
  routeBlockNumber?: string;
  routeDeadline?: string;
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

/** Reject extra decimals instead of silently rounding the wallet amount. */
export function parseAssetAmount(value: string): string {
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value)) throw new Error("Enter a positive amount with up to 6 decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const raw = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  return parsePositiveRaw(raw.toString()).toString();
}

export function reservedDepositRaw(actions: PreparedAction[], asset: string): bigint {
  return actions.reduce((sum, action) => sum + (
    action.chainId === P2_CHAIN_ID && action.asset.toLowerCase() === asset.toLowerCase() && action.kind === "deposit" && action.step === "action"
      ? BigInt(action.amountRaw) : 0n
  ), 0n);
}

export function isExpired(action: Pick<PreparedAction, "validUntil">, now = Date.now()): boolean {
  return !Number.isFinite(Date.parse(action.validUntil)) || now >= Date.parse(action.validUntil);
}

export function canPrompt(action: PreparedAction, wallet: string, chainId: number, now = Date.now()): boolean {
  return action.chainId === P2_CHAIN_ID && action.state === "preflight_ready" && !isExpired(action, now) && action.wallet.toLowerCase() === wallet.toLowerCase() && chainId === P2_CHAIN_ID;
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
  if (/insufficient funds/i.test(message)) return "Your wallet does not have enough asset balance or native Arc USDC for gas.";
  if (/allowance|transfer amount exceeds/i.test(message)) return "The token allowance is too low. Refresh the review and approve the exact amount first.";
  return "The action could not be prepared or verified. Refresh the review before trying again.";
}
