import { createPublicClient, encodeFunctionData, http, isAddress, keccak256, parseAbi, type Address, type Hex } from "viem";
import { arcTestnet } from "viem/chains";
import type { Mandate } from "../p1/rules.ts";
import { P2_CHAIN_ID, P2_EXPLORER, P2_QUOTE_TTL_MS, P2_RPC, P2_USDC, parsePositiveRaw, type ActionKind, type PreparedAction } from "./core.ts";

export type P2Bindings = {
  P2_TESTNET_VAULT?: string;
  P2_TESTNET_VAULT_CODE_HASH?: string;
  P2_TESTNET_ROUTER?: string;
  P2_TESTNET_ROUTER_CODE_HASH?: string;
  P2_WRITES_ENABLED?: string;
};

export const p2Client = createPublicClient({ chain: arcTestnet, transport: http(P2_RPC, { timeout: 9_000, retryCount: 1 }) });
const vaultAbi = parseAbi([
  "function asset() view returns (address)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function previewDeposit(uint256) view returns (uint256)",
  "function previewWithdraw(uint256) view returns (uint256)",
  "function maxWithdraw(address) view returns (uint256)",
  "function withdraw(uint256,address,address) returns (uint256)",
]);
const assetAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const routerAbi = parseAbi([
  "function vault() view returns (address)",
  "function asset() view returns (address)",
  "function deposit(uint256,uint256,address) returns (uint256)",
]);
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

export function getP2Config(env: P2Bindings) {
  const vault = env.P2_TESTNET_VAULT;
  const router = env.P2_TESTNET_ROUTER;
  const vaultCodeHash = env.P2_TESTNET_VAULT_CODE_HASH;
  const routerCodeHash = env.P2_TESTNET_ROUTER_CODE_HASH;
  const configured = Boolean(vault && isAddress(vault) && router && isAddress(router) && /^0x[0-9a-fA-F]{64}$/.test(vaultCodeHash ?? "") && /^0x[0-9a-fA-F]{64}$/.test(routerCodeHash ?? ""));
  return {
    chainId: P2_CHAIN_ID,
    network: "Arc Testnet",
    vault: configured ? vault as Address : null,
    router: configured ? router as Address : null,
    asset: P2_USDC as Address,
    explorer: P2_EXPLORER,
    configured,
    writesEnabled: configured && env.P2_WRITES_ENABLED === "true",
    vaultCodeHash: configured ? vaultCodeHash as Hex : null,
    routerCodeHash: configured ? routerCodeHash as Hex : null,
  };
}

export async function verifyP2Adapter(config: ReturnType<typeof getP2Config>) {
  if (!config.configured || !config.vault || !config.router || !config.vaultCodeHash || !config.routerCodeHash) throw new Error("A reviewed Arc Testnet vault and guarded router are not configured.");
  const [chainId, vaultCode, routerCode, asset, routerVault, routerAsset, decimals, symbol, shareDecimals, vaultImplementation, routerImplementation] = await Promise.all([
    p2Client.getChainId(),
    p2Client.getBytecode({ address: config.vault }),
    p2Client.getBytecode({ address: config.router }),
    p2Client.readContract({ address: config.vault, abi: vaultAbi, functionName: "asset" }),
    p2Client.readContract({ address: config.router, abi: routerAbi, functionName: "vault" }),
    p2Client.readContract({ address: config.router, abi: routerAbi, functionName: "asset" }),
    p2Client.readContract({ address: config.asset, abi: assetAbi, functionName: "decimals" }),
    p2Client.readContract({ address: config.asset, abi: assetAbi, functionName: "symbol" }),
    p2Client.readContract({ address: config.vault, abi: vaultAbi, functionName: "decimals" }),
    p2Client.getStorageAt({ address: config.vault, slot: IMPLEMENTATION_SLOT }),
    p2Client.getStorageAt({ address: config.router, slot: IMPLEMENTATION_SLOT }),
  ]);
  if (chainId !== P2_CHAIN_ID || !vaultCode || !routerCode || keccak256(vaultCode).toLowerCase() !== config.vaultCodeHash.toLowerCase() || keccak256(routerCode).toLowerCase() !== config.routerCodeHash.toLowerCase() || asset.toLowerCase() !== config.asset.toLowerCase() || routerVault.toLowerCase() !== config.vault.toLowerCase() || routerAsset.toLowerCase() !== config.asset.toLowerCase() || decimals !== 6 || symbol !== "USDC" || shareDecimals < 6 || shareDecimals > 30 || BigInt(vaultImplementation ?? "0x0") !== 0n || BigInt(routerImplementation ?? "0x0") !== 0n) throw new Error("Adapter identity changed or the Arc Testnet asset does not match. Actions are paused.");
  return { assetDecimals: decimals, shareDecimals };
}

export async function prepareP2Action(input: { kind: ActionKind; amountRaw: string; wallet: Address; mandate: Mandate; env: P2Bindings }): Promise<PreparedAction> {
  const config = getP2Config(input.env);
  if (!config.writesEnabled || !config.vault || !config.router) throw new Error("Testnet transactions are disabled until the adapter review is complete.");
  const amount = parsePositiveRaw(input.amountRaw);
  if (!input.mandate.rules.allowedAssets.includes("USDC")) throw new Error("USDC is not allowed by this mandate.");
  if (input.mandate.rules.deniedTargets.some((target) => target.toLowerCase() === config.vault!.toLowerCase())) throw new Error("This vault is blocked by your mandate.");
  if (input.kind === "deposit" && amount > BigInt(input.mandate.rules.maxActionRaw)) throw new Error("The amount exceeds your mandate's per-action limit.");
  if (input.kind === "deposit" && input.mandate.rules.requireAvailableWithdrawal) throw new Error("This mandate requires verified withdrawal capacity, which is unavailable before the first deposit.");
  const { assetDecimals, shareDecimals } = await verifyP2Adapter(config);
  const blockNumber = await p2Client.getBlockNumber();
  const [gasPrice, balance, initialShares, allowance, nativeBalance] = await Promise.all([
    p2Client.getGasPrice(),
    p2Client.readContract({ address: config.asset, abi: assetAbi, functionName: "balanceOf", args: [input.wallet], blockNumber }),
    p2Client.readContract({ address: config.vault, abi: vaultAbi, functionName: "balanceOf", args: [input.wallet], blockNumber }),
    p2Client.readContract({ address: config.asset, abi: assetAbi, functionName: "allowance", args: [input.wallet, config.router], blockNumber }),
    p2Client.getBalance({ address: input.wallet, blockNumber }),
  ]);
  if (input.kind === "deposit" && balance < amount) throw new Error("Your testnet USDC balance is below the requested amount.");
  let shares = initialShares;
  if (input.kind === "withdraw" && shares === 0n) {
    // Arc RPC can trail a freshly confirmed deposit for a few seconds.
    for (let retry = 0; retry < 2 && shares === 0n; retry++) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      shares = await p2Client.readContract({ address: config.vault, abi: vaultAbi, functionName: "balanceOf", args: [input.wallet] });
    }
    if (shares === 0n) throw new Error("No vault shares are visible yet. If you just deposited, wait for Arc RPC to catch up and retry.");
  }
  const isDeposit = input.kind === "deposit";
  const preview = isDeposit
    ? await p2Client.readContract({ address: config.vault, abi: vaultAbi, functionName: "previewDeposit", args: [amount], blockNumber })
    : await p2Client.readContract({ address: config.vault, abi: vaultAbi, functionName: "previewWithdraw", args: [amount], blockNumber });
  if (preview === 0n) throw new Error("The vault preview returned zero shares.");
  if (!isDeposit) {
    const max = await p2Client.readContract({ address: config.vault, abi: vaultAbi, functionName: "maxWithdraw", args: [input.wallet], blockNumber });
    if (amount > max || preview > shares) throw new Error("The vault cannot currently return this amount. Refresh the withdrawal limit.");
  }
  // The router enforces a minimum share count in the same transaction as deposit.
  const minShares = isDeposit ? preview * 995n / 1000n : null;
  if (isDeposit && !minShares) throw new Error("The deposit is too small to protect with a minimum share count.");
  const approvalRequired = isDeposit && allowance < amount;
  const target = approvalRequired ? config.asset : isDeposit ? config.router : config.vault;
  const calldata = approvalRequired
    ? encodeFunctionData({ abi: assetAbi, functionName: "approve", args: [config.router, amount] })
    : isDeposit
      ? encodeFunctionData({ abi: routerAbi, functionName: "deposit", args: [amount, minShares!, input.wallet] })
      : encodeFunctionData({ abi: vaultAbi, functionName: "withdraw", args: [amount, input.wallet, input.wallet] });
  if (approvalRequired) await p2Client.simulateContract({ address: config.asset, abi: assetAbi, functionName: "approve", args: [config.router, amount], account: input.wallet });
  else if (isDeposit) await p2Client.simulateContract({ address: config.router, abi: routerAbi, functionName: "deposit", args: [amount, minShares!, input.wallet], account: input.wallet });
  else await p2Client.simulateContract({ address: config.vault, abi: vaultAbi, functionName: "withdraw", args: [amount, input.wallet, input.wallet], account: input.wallet });
  const estimatedGas = await p2Client.estimateGas({ account: input.wallet, to: target, data: calldata });
  const gasLimit = estimatedGas * 120n / 100n;
  const gasCost = gasLimit * gasPrice;
  if (gasCost > BigInt(input.mandate.rules.maxGasRaw)) throw new Error("Estimated gas exceeds your mandate's gas limit.");
  if (nativeBalance < gasCost + (isDeposit ? amount * 10n ** 12n : 0n)) throw new Error("Your testnet USDC balance may not cover the amount plus gas.");
  const now = Date.now();
  return {
    id: `act_${crypto.randomUUID()}`, chainId: P2_CHAIN_ID, wallet: input.wallet, vault: config.vault, target, calldata,
    asset: config.asset, assetDecimals, shareDecimals, kind: input.kind, amountRaw: amount.toString(), previewRaw: preview.toString(),
    minSharesRaw: minShares?.toString() ?? null, previewLabel: isDeposit ? "shares received" : "shares burned",
    allowanceRaw: isDeposit ? allowance.toString() : null, approvalAmountRaw: approvalRequired ? amount.toString() : null,
    gasLimitRaw: gasLimit.toString(), gasPriceRaw: gasPrice.toString(), gasCostRaw: gasCost.toString(), gasUnit: "native USDC",
    blockNumber: blockNumber.toString(), codeHash: config.vaultCodeHash!, mandateId: input.mandate.id, mandateVersion: input.mandate.version,
    evidenceUrl: `${P2_EXPLORER}/address/${config.vault}`, createdAt: new Date(now).toISOString(), validUntil: new Date(now + P2_QUOTE_TTL_MS).toISOString(),
    state: "preflight_ready", step: approvalRequired ? "approval" : "action", txHash: null, txNonce: null, submittedAt: null, message: null,
  };
}
