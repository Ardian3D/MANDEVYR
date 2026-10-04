// Read-only mainnet verification. This script never signs or broadcasts transactions.
import { writeFile } from "node:fs/promises";
import { computeVaultMaxShareAllowance, computeVaultMaxSharePrice, morphoViemExtension } from "@morpho-org/morpho-sdk";
import { getP2Config, p2Client, readExactApproval, verifyBundleCalldata, verifyP2Adapter } from "../src/p2/adapter.ts";

const client = p2Client.extend(morphoViemExtension({ supportSignature: false }));
const userAddress = "0x1111111111111111111111111111111111111111";
const amount = 1_000_000n;
const slippageTolerance = 1_000_000_000_000_000n;
const report = { checkedAt: new Date().toISOString(), chainId: await p2Client.getChainId(), rpc: "https://rpc.mainnet.arc.io", writesEnabledByDefault: getP2Config({}).writesEnabled, fundedRoundTrip: "not_run", vaults: [] };
if (report.chainId !== 5042 || report.writesEnabledByDefault) throw new Error("Mainnet or release-switch invariant failed.");
for (const entry of getP2Config({}).vaults) {
  const config = getP2Config({}, entry.id);
  const identity = await verifyP2Adapter(config);
  const vault = client.morpho.vaultV2(entry.vault, 5042);
  const vaultData = await vault.getData({ blockNumber: identity.blockNumber });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 120);
  const protection = { vaultData, deadline, assets: amount, slippageTolerance };
  const routes = [];
  for (const kind of ["deposit", "withdraw"]) {
    const parameters = { amount, userAddress, vaultData, deadline, slippageTolerance };
    const action = kind === "deposit" ? vault.deposit(parameters) : vault.withdraw(parameters);
    const requirements = await action.getRequirements();
    const approval = readExactApproval(requirements, kind === "deposit" ? entry.asset : entry.vault, config.bundle);
    const cap = kind === "deposit" ? amount : computeVaultMaxShareAllowance(protection);
    if (approval && approval.amount !== cap) throw new Error(`Approval cap mismatch: ${entry.id}/${kind}`);
    const tx = action.buildTx();
    if (tx.to.toLowerCase() !== config.bundle.toLowerCase() || tx.value !== 0n) throw new Error("Unexpected bundle destination or value.");
    verifyBundleCalldata(tx.data, kind, entry.vault, amount, deadline, kind === "deposit" ? computeVaultMaxSharePrice(protection) : undefined);
    if (approval) await p2Client.call({ account: userAddress, to: kind === "deposit" ? entry.asset : entry.vault, data: approval.calldata, value: 0n });
    const replayData = await vault.getData({ blockNumber: identity.blockNumber });
    if (computeVaultMaxShareAllowance({ ...protection, vaultData: replayData }) !== computeVaultMaxShareAllowance(protection)) throw new Error("Snapshot share cap is not reproducible.");
    routes.push({ kind, bundle: tx.to, approvalTarget: kind === "deposit" ? entry.asset : entry.vault, approvalAmountRaw: approval?.amount.toString() ?? null, approvalSimulation: approval ? "passed" : "not_required", bundleCalldata: "matched", finalFundedSimulation: "not_run" });
  }
  report.vaults.push({ id: entry.id, vault: entry.vault, asset: entry.asset, symbol: entry.assetSymbol, codeHash: entry.vaultCodeHash, blockNumber: identity.blockNumber.toString(), observedAt: identity.observedAt, identity: "matched", assetDecimals: identity.assetDecimals, shareDecimals: identity.shareDecimals, routes });
  console.log(`${entry.id}: identity, deposit/withdraw calldata, and approval simulations passed`);
}
await writeFile(new URL("../docs/p2-mainnet-verification.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log("Saved docs/p2-mainnet-verification.json. Funded transactions were not run.");
