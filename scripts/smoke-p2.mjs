import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

const origin = process.env.MANDEVYR_SMOKE_ORIGIN || "http://127.0.0.1:5173";
const account = privateKeyToAccount(generatePrivateKey());
let cookie = "";

async function call(path, method = "GET", body, expectedStatus = 200) {
  const response = await fetch(`${origin}/api/p1${path}`, { method, headers: { Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
  const data = await response.json();
  if (response.status !== expectedStatus) throw new Error(`${path}: expected ${expectedStatus}, got ${response.status} ${JSON.stringify(data)}`);
  return data;
}

const config = await call("/actions/config");
if (config.chainId !== 5042 || config.vaults?.length !== 3 || !config.vaults.every((vault) => vault.vault && vault.asset && ["USDC", "EURC"].includes(vault.assetSymbol))) throw new Error("Reviewed Morpho vaults on Arc Mainnet are not configured");
await call("/actions", "GET", undefined, 401);
const { nonce } = await call("/auth/nonce", "POST");
const issuedAt = new Date();
const message = createSiweMessage({ address: account.address, chainId: 5042, domain: new URL(origin).host, uri: origin, version: "1", nonce, issuedAt, expirationTime: new Date(issuedAt.getTime() + 300_000) });
await call("/auth/verify", "POST", { message, signature: await account.signMessage({ message }) });
await call("/mandates", "POST", { rules: { maxActionRaw: "100000000", maxDailyRaw: "300000000", maxEurcActionRaw: "100000000", maxEurcDailyRaw: "300000000", maxGasRaw: "100000000000000000", allowedAssets: ["USDC", "EURC"], deniedTargets: [], requireAvailableWithdrawal: false, maxEvidenceAgeSeconds: 120, manualApproval: true } }, 201);
await call("/actions/prepare", "POST", { vaultId: "unknown-vault", kind: "deposit", amountRaw: "1000000", idempotencyKey: crypto.randomUUID() }, 400);
for (const vault of config.vaults) {
  const evidence = await call(`/actions/evidence/${vault.id}`);
  if (evidence.chainId !== 5042 || evidence.vaultId !== vault.id || !evidence.blockNumber || Math.abs(Date.now() - Date.parse(evidence.observedAt)) > 120_000) throw new Error(`Missing current mainnet identity evidence for ${vault.id}`);
  await call("/actions/prepare", "POST", { vaultId: vault.id, kind: "deposit", amountRaw: "not-a-number", idempotencyKey: crypto.randomUUID() }, 400);
  const rejected = await call("/actions/prepare", "POST", { vaultId: vault.id, kind: "deposit", amountRaw: "1000000", idempotencyKey: crypto.randomUUID() }, 409);
  const expectedError = config.writesEnabled ? `Your Arc Mainnet ${vault.assetSymbol} balance is below the requested deposit.` : "Arc Mainnet actions are paused in this environment.";
  if (rejected.error !== expectedError) throw new Error(`Unexpected preparation rejection for ${vault.id}: ${JSON.stringify(rejected)}`);
}
const actions = await call("/actions");
if (actions.items.length) throw new Error("Rejected mainnet review saved an action");
const exported = await call("/data/export");
if (!Array.isArray(exported.actions) || exported.actions.length) throw new Error("P2 export is not scoped or empty");
await call("/data/delete", "POST", { confirm: "DELETE" });
console.log(JSON.stringify({ guestActions: "blocked", mainnetVaults: config.vaults.map((vault) => vault.id), writesEnabled: config.writesEnabled, invalidAmount: "blocked", unfundedPrepare: "blocked", export: "ok", deletion: "ok" }));
