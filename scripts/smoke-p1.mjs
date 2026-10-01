import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

const origin = process.env.MANDEVYR_SMOKE_ORIGIN || "http://127.0.0.1:5173";
const account = privateKeyToAccount(generatePrivateKey());
let cookie = "";

async function call(path, method = "GET", body) {
  const response = await fetch(`${origin}/api/p1${path}`, {
    method,
    headers: { Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
async function expectStatus(path, method, body, status, headers = {}) {
  const response = await fetch(`${origin}/api/p1${path}`, { method, headers: { Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  if (response.status !== status) throw new Error(`${path}: expected ${status}, received ${response.status}`);
}

const { nonce } = await call("/auth/nonce", "POST");
const issuedAt = new Date();
const message = createSiweMessage({ address: account.address, chainId: 5042, domain: new URL(origin).host, uri: origin, version: "1", nonce, issuedAt, expirationTime: new Date(issuedAt.getTime() + 300_000), statement: "Sign in to save mandates, research reports, and alerts in MANDEVYR. No transaction is requested." });
const signature = await account.signMessage({ message });
await call("/auth/verify", "POST", { message, signature });
await expectStatus("/auth/verify", "POST", { message, signature }, 409);
const me = await call("/me");
if (me.wallet !== account.address.toLowerCase()) throw new Error("Wallet session mismatch");

const mandate = await call("/mandates", "POST", { rules: { maxActionRaw: "100000000", maxDailyRaw: "300000000", maxGasRaw: "100000000000000000", allowedAssets: ["USDC"], deniedTargets: [], requireAvailableWithdrawal: false, maxEvidenceAgeSeconds: 120, manualApproval: true } });
const idempotencyKey = crypto.randomUUID();
const intent = { kind: "vault_deposit", chainId: 5042, targetId: "galaxy-usdc", targetAddress: "0x8E357432CC12ff425c36432F312968aEb16112AF", asset: "USDC", amountRaw: "50000000" };
const report = await call("/preflights", "POST", { intent, idempotencyKey });
const replay = await call("/preflights", "POST", { intent, idempotencyKey });
if (report.id !== replay.id || report.actionAllowed !== false) throw new Error("Preflight replay or action boundary failed");
await call("/mandates", "POST", { rules: { maxActionRaw: "150000000", maxDailyRaw: "300000000", maxGasRaw: "100000000000000000", allowedAssets: ["USDC"], deniedTargets: [], requireAvailableWithdrawal: false, maxEvidenceAgeSeconds: 120, manualApproval: true } });
const replayAfterVersion = await call("/preflights", "POST", { intent, idempotencyKey });
if (replayAfterVersion.id !== report.id || replayAfterVersion.mandateVersion !== mandate.version) throw new Error("Retry changed the saved report after mandate versioning");
await expectStatus("/preflights", "POST", { intent: { ...intent, amountRaw: "60000000" }, idempotencyKey }, 409);
await expectStatus("/mandates", "POST", { rules: {} }, 403, { Origin: "https://unrelated.example" });
const history = await call("/history");
if (!history.items.some((item) => item.id === report.id)) throw new Error("Report missing from history");
await call("/watchlist", "POST", { vaultId: "galaxy-usdc" });
const watchlist = await call("/watchlist");
if (!watchlist.items.includes("galaxy-usdc")) throw new Error("Watchlist did not save");
const firstWalletCookie = cookie;
const accountB = privateKeyToAccount(generatePrivateKey());
const nonceB = await call("/auth/nonce", "POST");
const messageB = createSiweMessage({ address: accountB.address, chainId: 5042, domain: new URL(origin).host, uri: origin, version: "1", nonce: nonceB.nonce, issuedAt: new Date(), expirationTime: new Date(Date.now() + 300_000) });
await call("/auth/verify", "POST", { message: messageB, signature: await accountB.signMessage({ message: messageB }) });
await expectStatus(`/preflights/${report.id}`, "GET", undefined, 404);
const isolatedExport = await call("/data/export");
if (isolatedExport.reports.length || isolatedExport.mandates.length || isolatedExport.watchlist.length) throw new Error("Account export leaked another wallet's data");
cookie = firstWalletCookie;
const exportData = await call("/data/export");
if (exportData.wallet !== account.address.toLowerCase() || !exportData.reports.some((item) => item.id === report.id) || !exportData.watchlist.includes("galaxy-usdc")) throw new Error("Account export omitted saved data");
await expectStatus("/data/delete", "POST", { confirm: "wrong" }, 400);
const deleted = await call("/data/delete", "POST", { confirm: "DELETE" });
if (!deleted.deleted) throw new Error("Account deletion failed");
await expectStatus("/me", "GET", undefined, 401);
console.log(JSON.stringify({ session: "ok", nonceReplay: "rejected", mandateVersion: mandate.version, reportVerdict: report.verdict, idempotency: "ok", history: "ok", watchlist: "ok", walletIsolation: "ok", originCheck: "ok", export: "scoped", deletion: "ok" }));
