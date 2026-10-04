import { morphoViemExtension, type ActionRequirement } from "@morpho-org/morpho-sdk";
import { getChainAddresses } from "@morpho-org/morpho-sdk/addresses";
import { vaultBundlesV1Abi, vaultV2Abi, vaultV2FactoryAbi } from "@morpho-org/morpho-sdk/abis";
import { createPublicClient, decodeFunctionData, http, keccak256, parseAbi, zeroAddress, zeroHash, type Address, type Hex } from "viem";
import { arc } from "viem/chains";
import type { Mandate } from "../p1/rules.ts";
import { VAULTS } from "../p0/registry.ts";
import { P2_CHAIN_ID, P2_EXPLORER, P2_QUOTE_TTL_MS, P2_RPC, P2_USDC, parsePositiveRaw, type ActionKind, type PreparedAction } from "./core.ts";

export type P2Bindings = { P2_MAINNET_WRITES_ENABLED?: string };

export const GALAXY_USDC = "0x8E357432CC12ff425c36432F312968aEb16112AF" as const;
const VAULT_CODE_HASH = "0xac3d89c4bed30ede74f4e94e9c0e124a13ed24d0e011181515996362879bae57";
const EURC_VAULT_CODE_HASH = "0x0d9a18645e4c23fd5698069edd84ca001b630b0aeff6dd64863debaa2f2dc511";
const BUNDLE_CODE_HASH = "0xa8ec5960bb20a33ed52e8248aed85ee3148135b185bba8bb74eb572a987fd4a5";
const addresses = getChainAddresses(P2_CHAIN_ID);
const BUNDLE = "0x76c1dEefAe48523E14903085081Bda2999450b68" as const;
const FACTORY = "0x3b0eefaBfa22ec7CF2c73877ac16e78D76749f12" as const;
const DEAD = "0x000000000000000000000000000000000000dEaD";
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const TOLERANCE_WAD = 1_000_000_000_000_000n; // 0.1% share-price tolerance.

export const p2Client = createPublicClient({ chain: arc, transport: http(P2_RPC, { timeout: 12_000, retryCount: 1 }) });
const morphoClient = p2Client.extend(morphoViemExtension({ supportSignature: false }));
const assetAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);

const PINS = [
  { id: "galaxy-usdc", vault: GALAXY_USDC, asset: P2_USDC, assetSymbol: "USDC", codeHash: VAULT_CODE_HASH },
  { id: "gauntlet-usdc-prime", vault: "0xdECcd53BE5453215821184824B519E04C7e00bC7", asset: P2_USDC, assetSymbol: "USDC", codeHash: VAULT_CODE_HASH },
  { id: "gauntlet-eurc-prime", vault: "0x05863F54B05e96092069eF30c9Ca6060336e50B9", asset: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1", assetSymbol: "EURC", codeHash: EURC_VAULT_CODE_HASH },
] as const;
const ACTION_VAULTS = PINS.map((pin) => {
  const vault = VAULTS.find((item) => item.id === pin.id);
  if (!vault || vault.address.toLowerCase() !== pin.vault.toLowerCase() || vault.assetAddress.toLowerCase() !== pin.asset.toLowerCase() || vault.asset !== pin.assetSymbol) throw new Error(`Reviewed action registry changed for ${pin.id}.`);
  return { id: pin.id, name: vault.name, vault: pin.vault, asset: pin.asset, assetSymbol: pin.assetSymbol, sourceUrl: vault.sourceUrl, vaultCodeHash: pin.codeHash as Hex };
});

export function getP2Vault(vaultId: string) {
  const vault = ACTION_VAULTS.find((item) => item.id === vaultId);
  if (!vault) throw new Error("Vault is not in the reviewed Arc Mainnet action registry.");
  return vault;
}

export function getP2VaultByAddress(address: string) {
  const vault = ACTION_VAULTS.find((item) => item.vault.toLowerCase() === address.toLowerCase());
  if (!vault) throw new Error("Vault is not in the reviewed Arc Mainnet action registry.");
  return vault;
}

export function getP2Config(env: P2Bindings, vaultId = "galaxy-usdc") {
  const selected = getP2Vault(vaultId);
  return {
    chainId: P2_CHAIN_ID,
    network: "Arc Mainnet",
    vault: selected.vault,
    vaultId: selected.id,
    vaultName: selected.name,
    assetSymbol: selected.assetSymbol,
    sourceUrl: selected.sourceUrl,
    vaults: ACTION_VAULTS,
    bundle: BUNDLE,
    asset: selected.asset,
    explorer: P2_EXPLORER,
    configured: true,
    writesEnabled: env.P2_MAINNET_WRITES_ENABLED === "true",
    vaultCodeHash: selected.vaultCodeHash,
    bundleCodeHash: BUNDLE_CODE_HASH as Hex,
  };
}

/** Bind the SDK route to the reviewed Arc contracts before preparing any wallet call. */
export async function verifyP2Adapter(config: ReturnType<typeof getP2Config>) {
  if (addresses.bundles?.vaultBundlesV1?.toLowerCase() !== BUNDLE.toLowerCase() || addresses.vaultV2Factory?.toLowerCase() !== FACTORY.toLowerCase()) throw new Error("Morpho SDK Arc contract registry changed. Mainnet actions are paused.");
  const [chainId, vaultCode, bundleCode, asset, registered, decimals, symbol, shareDecimals, deadShares, vaultImplementation, bundleImplementation] = await Promise.all([
    p2Client.getChainId(),
    p2Client.getBytecode({ address: config.vault }),
    p2Client.getBytecode({ address: config.bundle }),
    p2Client.readContract({ address: config.vault, abi: vaultV2Abi, functionName: "asset" }),
    p2Client.readContract({ address: FACTORY, abi: vaultV2FactoryAbi, functionName: "isVaultV2", args: [config.vault] }),
    p2Client.readContract({ address: config.asset, abi: assetAbi, functionName: "decimals" }),
    p2Client.readContract({ address: config.asset, abi: assetAbi, functionName: "symbol" }),
    p2Client.readContract({ address: config.vault, abi: vaultV2Abi, functionName: "decimals" }),
    p2Client.readContract({ address: config.vault, abi: vaultV2Abi, functionName: "balanceOf", args: [DEAD] }),
    p2Client.getStorageAt({ address: config.vault, slot: IMPLEMENTATION_SLOT }),
    p2Client.getStorageAt({ address: config.bundle, slot: IMPLEMENTATION_SLOT }),
  ]);
  if (
    chainId !== P2_CHAIN_ID || !vaultCode || !bundleCode || !registered ||
    keccak256(vaultCode).toLowerCase() !== config.vaultCodeHash ||
    keccak256(bundleCode).toLowerCase() !== config.bundleCodeHash ||
    asset.toLowerCase() !== config.asset.toLowerCase() ||
    decimals !== 6 || symbol !== config.assetSymbol || shareDecimals !== 18 ||
    deadShares < 10n ** 12n ||
    BigInt(vaultImplementation ?? "0x0") !== 0n || BigInt(bundleImplementation ?? "0x0") !== 0n
  ) throw new Error(`${config.vaultName}, Morpho bundle, or ${config.assetSymbol} identity changed. Mainnet actions are paused.`);
  return { assetDecimals: decimals, shareDecimals };
}

export function readExactApproval(requirements: readonly ActionRequirement[], expectedToken: Address, expectedSpender: Address): { amount: bigint; calldata: Hex } | null {
  if (!requirements.length) return null;
  if (requirements.length !== 1) throw new Error("The Morpho route requested an unexpected prerequisite. Mainnet action paused.");
  const requirement = requirements[0];
  if (!("to" in requirement) || !("data" in requirement)) throw new Error("Unexpected signature prerequisite. Mainnet action paused.");
  if (requirement.to.toLowerCase() !== expectedToken.toLowerCase() || (requirement.value ?? 0n) !== 0n) throw new Error("The Morpho approval target changed. Mainnet action paused.");
  const decoded = decodeFunctionData({ abi: assetAbi, data: requirement.data });
  if (decoded.functionName !== "approve" || decoded.args[0].toLowerCase() !== expectedSpender.toLowerCase() || decoded.args[1] <= 0n) throw new Error("The Morpho approval parameters changed. Mainnet action paused.");
  return { amount: decoded.args[1], calldata: requirement.data };
}

/** Fail closed if a future SDK version encodes different mainnet effects. */
export function verifyBundleCalldata(data: Hex, kind: ActionKind, vault: Address, amount: bigint, deadline: bigint): void {
  const decoded = decodeFunctionData({ abi: vaultBundlesV1Abi, data });
  if (kind === "deposit" && decoded.functionName === "vaultBundlesV1Deposit") {
    const [targetVault, assets, maxSharePrice, permit, referralFee, feeRecipient, txDeadline] = decoded.args;
    if (targetVault.toLowerCase() === vault.toLowerCase() && assets === amount && maxSharePrice > 0n && permit.kind === 0 && permit.data === "0x" && referralFee === 0n && feeRecipient === zeroAddress && txDeadline === deadline) return;
  }
  if (kind === "withdraw" && decoded.functionName === "vaultBundlesV1Withdraw") {
    const [targetVault, assets, shares, permit, referralFee, feeRecipient, txDeadline] = decoded.args;
    if (targetVault.toLowerCase() === vault.toLowerCase() && assets === amount && shares === 0n && permit.value === 0n && permit.nonce === 0n && permit.deadline === deadline && permit.v === 0 && permit.r === zeroHash && permit.s === zeroHash && referralFee === 0n && feeRecipient === zeroAddress && txDeadline === deadline) return;
  }
  throw new Error("The Morpho bundle call differs from the reviewed vault action. Mainnet action paused.");
}

export async function prepareP2Action(input: { vaultId: string; kind: ActionKind; amountRaw: string; wallet: Address; mandate: Mandate; env: P2Bindings }): Promise<PreparedAction> {
  const config = getP2Config(input.env, input.vaultId);
  if (!config.writesEnabled) throw new Error("Arc Mainnet actions are paused in this environment.");
  const amount = parsePositiveRaw(input.amountRaw);
  if (!input.mandate.rules.allowedAssets.includes(config.assetSymbol)) throw new Error(`${config.assetSymbol} is not allowed by this mandate.`);
  if (input.mandate.rules.deniedTargets.some((target) => target === config.vaultId || target.toLowerCase() === config.vault.toLowerCase())) throw new Error(`${config.vaultName} is blocked by your mandate.`);
  const actionLimit = config.assetSymbol === "EURC" ? input.mandate.rules.maxEurcActionRaw : input.mandate.rules.maxActionRaw;
  if (input.kind === "deposit" && (!actionLimit || amount > BigInt(actionLimit))) throw new Error(`The amount exceeds your mandate's ${config.assetSymbol} per-action limit.`);
  if (input.kind === "deposit" && input.mandate.rules.requireAvailableWithdrawal) throw new Error("This mandate requires verified withdrawal capacity, which is unavailable before the first deposit.");
  const { assetDecimals, shareDecimals } = await verifyP2Adapter(config);
  const blockNumber = await p2Client.getBlockNumber();
  const [gasPrice, assetBalance, sharesHeld, nativeBalance] = await Promise.all([
    p2Client.getGasPrice(),
    p2Client.readContract({ address: config.asset, abi: assetAbi, functionName: "balanceOf", args: [input.wallet], blockNumber }),
    p2Client.readContract({ address: config.vault, abi: vaultV2Abi, functionName: "balanceOf", args: [input.wallet], blockNumber }),
    p2Client.getBalance({ address: input.wallet, blockNumber }),
  ]);
  const isDeposit = input.kind === "deposit";
  if (isDeposit && assetBalance < amount) throw new Error(`Your Arc Mainnet ${config.assetSymbol} balance is below the requested deposit.`);
  if (!isDeposit && sharesHeld === 0n) throw new Error(`No ${config.vaultName} vault shares are visible in this wallet.`);
  const preview = await p2Client.readContract({ address: config.vault, abi: vaultV2Abi, functionName: isDeposit ? "previewDeposit" : "previewWithdraw", args: [amount], blockNumber });
  if (preview === 0n) throw new Error("The vault preview returned zero shares.");
  if (!isDeposit && preview > sharesHeld) throw new Error(`This wallet has too few ${config.vaultName} shares for that withdrawal.`);

  const vault = morphoClient.morpho.vaultV2(config.vault, P2_CHAIN_ID);
  const vaultData = await vault.getData();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 120);
  const action = isDeposit
    ? vault.deposit({ amount, userAddress: input.wallet, vaultData, slippageTolerance: TOLERANCE_WAD, deadline })
    : vault.withdraw({ amount, userAddress: input.wallet, vaultData, slippageTolerance: TOLERANCE_WAD, deadline });
  const requirements = await action.getRequirements();
  const approvalToken = isDeposit ? config.asset : config.vault;
  const approval = readExactApproval(requirements, approvalToken, config.bundle);
  if (isDeposit && approval !== null && approval.amount !== amount) throw new Error(`The required ${config.assetSymbol} approval is not the exact deposit amount.`);
  if (!isDeposit && approval !== null && approval.amount < preview) throw new Error("The required vault-share approval is below the withdrawal preview.");
  if (!isDeposit && approval !== null && approval.amount > sharesHeld) throw new Error(`This wallet has too few ${config.vaultName} shares for the protected withdrawal cap.`);
  const spenderAllowance = await p2Client.readContract({ address: approvalToken, abi: assetAbi, functionName: "allowance", args: [input.wallet, config.bundle], blockNumber });
  const bundleTx = action.buildTx();
  if (bundleTx.to.toLowerCase() !== config.bundle.toLowerCase() || bundleTx.value !== 0n) throw new Error("The Morpho transaction target changed. Mainnet action paused.");
  verifyBundleCalldata(bundleTx.data, input.kind, config.vault, amount, deadline);
  const step = approval === null ? "action" : "approval";
  const target = step === "approval" ? approvalToken : bundleTx.to;
  const calldata = approval?.calldata ?? bundleTx.data;
  await p2Client.call({ account: input.wallet, to: target, data: calldata, value: 0n });
  const estimatedGas = await p2Client.estimateGas({ account: input.wallet, to: target, data: calldata, value: 0n });
  const gasLimit = estimatedGas * 120n / 100n;
  const gasCost = gasLimit * gasPrice;
  if (gasCost > BigInt(input.mandate.rules.maxGasRaw)) throw new Error("Estimated gas exceeds your mandate's gas limit.");
  // Native USDC pays gas (18 decimals); its ERC-20 view uses 6 decimals. EURC deposits use a separate token balance.
  if (nativeBalance < gasCost + (isDeposit && config.assetSymbol === "USDC" ? amount * 10n ** 12n : 0n)) throw new Error("Your Arc Mainnet USDC balance may not cover the transaction gas and USDC deposit.");
  const now = Date.now();
  return {
    id: `act_${crypto.randomUUID()}`, chainId: P2_CHAIN_ID, wallet: input.wallet, vaultId: config.vaultId, vaultName: config.vaultName, assetSymbol: config.assetSymbol, vault: config.vault, target, calldata,
    asset: config.asset, assetDecimals, shareDecimals, kind: input.kind, amountRaw: amount.toString(), previewRaw: preview.toString(),
    minSharesRaw: null, previewLabel: isDeposit ? "estimated shares received" : "estimated shares to burn",
    allowanceRaw: spenderAllowance.toString(), approvalAmountRaw: approval?.amount.toString() ?? null,
    gasLimitRaw: gasLimit.toString(), gasPriceRaw: gasPrice.toString(), gasCostRaw: gasCost.toString(), gasUnit: "native USDC",
    blockNumber: blockNumber.toString(), codeHash: config.vaultCodeHash, mandateId: input.mandate.id, mandateVersion: input.mandate.version,
    evidenceUrl: config.sourceUrl, createdAt: new Date(now).toISOString(), validUntil: new Date(Math.min(now + P2_QUOTE_TTL_MS, Number(deadline) * 1000)).toISOString(),
    state: "preflight_ready", step, txHash: null, txNonce: null, submittedAt: null, message: null,
  };
}
