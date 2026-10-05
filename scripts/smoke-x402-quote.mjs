// Read-only local smoke test: exercises SIWE ownership and the live Arcus 402 challenge.
// Run: node --experimental-strip-types scripts/smoke-x402-quote.mjs
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createP1Api } from "../src/p1/api.ts";
import { parseSignedX402Payment } from "../src/p3/payment-recovery.ts";
import worker from "../src/worker/index.ts";

const sqlite = new DatabaseSync(":memory:");
for (const name of ["0001_p1.sql", "0002_rate_limits.sql", "0003_p2_actions.sql", "0004_p2_wallet_revision.sql", "0005_p4_report_uses.sql", "0006_p3_x402.sql", "0007_p3_agent_policy.sql", "0008_p3_x402_recovery.sql"]) sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
const offlineAccount = privateKeyToAccount(`0x${"11".repeat(32)}`);
const wallet = offlineAccount.address.toLowerCase();
const cookie = "a".repeat(64);
const id = "prf_00000001-0000-4000-8000-000000000000";
sqlite.prepare("INSERT INTO p1_sessions VALUES (?, ?, ?, NULL)").run(createHash("sha256").update(cookie).digest("hex"), wallet, Math.floor(Date.now() / 1000) + 600);
const report = { id, createdAt: new Date().toISOString(), validUntil: new Date(Date.now() + 60_000).toISOString(), mandateId: "m", mandateVersion: 1, rulesetVersion: "test", actionAllowed: false, summary: "Review", verdict: "REVIEW", reasons: [], evidence: [], intent: { kind: "vault_deposit", chainId: 5042, targetId: "galaxy-usdc", targetAddress: wallet, asset: "USDC", amountRaw: "1000000" } };
sqlite.prepare("INSERT INTO p1_reports VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, wallet, "m", id, id, JSON.stringify(report), report.createdAt);
const DB = { prepare(sql) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return sqlite.prepare(sql).get(...args) ?? null; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; } }; } };
const app = createP1Api(async () => ({ items: [] }), async () => false);
const env = { DB, P3_X402_ENABLED: "true", P3_X402_PAYEE: "0x2D44a6E9afAEA4d686E886f93b0BfD2059F20F01" };
const denied = await app.request("http://localhost/x402/reports/prf_00000002-0000-4000-8000-000000000000/deep-dive", { headers: { Cookie: `mandevyr_session=${cookie}`, "Idempotency-Key": "smoke0002" } }, env);
const response = await app.request(`http://localhost/x402/reports/${id}/deep-dive`, { headers: { Cookie: `mandevyr_session=${cookie}`, "Idempotency-Key": "smoke0001" } }, env);
const mounted = await worker.fetch(new Request(`http://localhost/api/p1/x402/reports/${id}/deep-dive`, { headers: { Cookie: `mandevyr_session=${cookie}`, "Idempotency-Key": "smoke0003" } }), env);
const encoded = response.headers.get("PAYMENT-REQUIRED");
const required = encoded ? JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) : null;
const accepted = required?.accepts?.[0];
const http = new x402HTTPClient(new x402Client().register("eip155:5042", new ExactEvmScheme(offlineAccount)));
const signed = required ? http.encodePaymentSignatureHeader(await http.createPaymentPayload(required))["PAYMENT-SIGNATURE"] : null;
const parsed = signed ? parseSignedX402Payment(signed, offlineAccount.address, env.P3_X402_PAYEE) : null;
const recoveryBody = JSON.stringify({ idempotencyKey: "smoke0001", paymentSignature: signed, txHash: `0x${"00".repeat(32)}` });
const recoveryWithoutPending = await app.request(`http://localhost/x402/reports/${id}/recover`, { method: "POST", headers: { Cookie: `mandevyr_session=${cookie}`, Origin: "http://localhost", "Content-Type": "application/json" }, body: recoveryBody }, env);
if (signed && parsed) sqlite.prepare("INSERT INTO p3_x402_pending (wallet, report_id, idempotency_key, payload_hash, result_hash, valid_before, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(wallet.toLowerCase(), id, "smoke0001", createHash("sha256").update(signed).digest("hex"), "f".repeat(64), Number(parsed.validBefore), new Date().toISOString());
let duplicateReportLocked = false;
try { sqlite.prepare("INSERT INTO p3_x402_pending (wallet, report_id, idempotency_key, payload_hash, result_hash, valid_before, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(wallet.toLowerCase(), id, "smoke0004", "different", "f".repeat(64), Number(parsed.validBefore), new Date().toISOString()); }
catch { duplicateReportLocked = true; }
const recoveryWithoutReceipt = await app.request(`http://localhost/x402/reports/${id}/recover`, { method: "POST", headers: { Cookie: `mandevyr_session=${cookie}`, Origin: "http://localhost", "Content-Type": "application/json" }, body: recoveryBody }, env);
console.log(JSON.stringify({ nonOwnerStatus: denied.status, nonOwnerPaymentRequired: Boolean(denied.headers.get("PAYMENT-REQUIRED")), status: response.status, mountedStatus: mounted.status, mountedPaymentRequired: Boolean(mounted.headers.get("PAYMENT-REQUIRED")), version: required?.x402Version, network: accepted?.network, payTo: accepted?.payTo, amount: accepted?.amount, asset: accepted?.asset, offlineSignatureParsed: Boolean(parsed), duplicateReportLocked, recoveryWithoutPending: recoveryWithoutPending.status, recoveryWithoutReceipt: recoveryWithoutReceipt.status }));
sqlite.close();
if (denied.status !== 404 || denied.headers.get("PAYMENT-REQUIRED") || response.status !== 402 || mounted.status !== 402 || !mounted.headers.get("PAYMENT-REQUIRED") || required?.x402Version !== 2 || accepted?.network !== "eip155:5042" || accepted?.payTo?.toLowerCase() !== env.P3_X402_PAYEE.toLowerCase() || accepted?.amount !== "10000" || accepted?.asset?.toLowerCase() !== "0x3600000000000000000000000000000000000000" || !parsed || !duplicateReportLocked || recoveryWithoutPending.status !== 409 || recoveryWithoutReceipt.status !== 425) process.exitCode = 1;
