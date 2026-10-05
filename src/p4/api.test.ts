/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createP1Api, type P1Database } from "../p1/api";
import type { PreflightReport } from "../p1/rules";
import * as tokenUtility from "./token";

const wallet = "0x1111111111111111111111111111111111111111";
const otherWallet = "0x2222222222222222222222222222222222222222";
const cookie = "a".repeat(64);
const databases: DatabaseSync[] = [];

function harness() {
  const sqlite = new DatabaseSync(":memory:"); databases.push(sqlite);
  for (const name of ["0001_p1.sql", "0002_rate_limits.sql", "0003_p2_actions.sql", "0004_p2_wallet_revision.sql", "0005_p4_report_uses.sql", "0006_p3_x402.sql", "0007_p3_agent_policy.sql"]) sqlite.exec(readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
  sqlite.prepare("INSERT INTO p1_sessions VALUES (?, ?, ?, NULL)").run(createHash("sha256").update(cookie).digest("hex"), wallet, Math.floor(Date.now() / 1000) + 600);
  const db: P1Database = { prepare(sql) { let args: SQLInputValue[] = []; return {
    bind(...values) { args = values as SQLInputValue[]; return this; },
    async first<T>() { return (sqlite.prepare(sql).get(...args) ?? null) as T | null; },
    async all<T>() { return { results: sqlite.prepare(sql).all(...args) as T[] }; },
    async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
  }; } };
  const app = createP1Api(async () => ({ items: [] }) as never, async () => false);
  const insert = (index: number, owner = wallet) => {
    const id = `prf_${index.toString().padStart(8, "0")}-0000-4000-8000-000000000000`;
    const report: PreflightReport = { id, createdAt: new Date().toISOString(), validUntil: new Date(Date.now() + 60_000).toISOString(), mandateId: "mandate", mandateVersion: 1, rulesetVersion: "test", actionAllowed: false, summary: "Review required.", verdict: "REVIEW", reasons: [], evidence: [], intent: { kind: "vault_deposit", chainId: 5042, targetId: "galaxy-usdc", targetAddress: otherWallet, asset: "USDC", amountRaw: "1000000" } };
    sqlite.prepare("INSERT INTO p1_reports VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, owner, "mandate", id, id, JSON.stringify(report), report.createdAt);
    return id;
  };
  const get = (path: string, signed = true) => app.request(`http://localhost${path}`, { headers: signed ? { Cookie: `mandevyr_session=${cookie}` } : {} }, { DB: db });
  const post = (path: string, body: unknown, method = "POST") => app.request(`http://localhost${path}`, { method, headers: { Cookie: `mandevyr_session=${cookie}`, Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify(body) }, { DB: db });
  return { sqlite, insert, get, post };
}
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) db.close(); });

describe("holder deep-dive entitlement", () => {
  it("keeps reports private and never presents payment to a non-owner", async () => {
    const api = harness(); const id = api.insert(1, otherWallet);
    expect((await api.post(`/utility/deep-dive/${id}`, {}, "POST")).status).toBe(404);
    expect((await api.get(`/x402/reports/${id}/deep-dive`)).status).toBe(404);
  });

  it("gives free users one unique report per UTC day and repeat reads do not consume quota", async () => {
    vi.spyOn(tokenUtility, "readHolderEvidence").mockRejectedValue(new Error("RPC unavailable"));
    const api = harness(); const first = api.insert(1); const second = api.insert(2);
    expect((await api.post(`/utility/deep-dive/${first}`, {})).status).toBe(200);
    const repeated = await api.post(`/utility/deep-dive/${first}`, {});
    expect((await repeated.json()).access.repeat).toBe(true);
    expect((await api.post(`/utility/deep-dive/${second}`, {})).status).toBe(429);
    expect(Number(api.sqlite.prepare("SELECT COUNT(*) AS n FROM p4_report_uses").get()?.n)).toBe(1);
  });

  it("does not grant two free reports when requests race", async () => {
    vi.spyOn(tokenUtility, "readHolderEvidence").mockRejectedValue(new Error("RPC unavailable"));
    const api = harness(); const first = api.insert(1); const second = api.insert(2);
    const responses = await Promise.all([api.post(`/utility/deep-dive/${first}`, {}), api.post(`/utility/deep-dive/${second}`, {})]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 429]);
  });

  it("grants five distinct reports only after a verified onchain holder read", async () => {
    vi.spyOn(tokenUtility, "readHolderEvidence").mockImplementation(async (address) => ({ chainId: 5042, token: tokenUtility.MDVYR_TOKEN, wallet: address, blockNumber: "123", observedAt: new Date().toISOString(), balanceRaw: tokenUtility.MDVYR_MIN_BALANCE_RAW.toString(), balance: "1", totalSupplyRaw: (1_000_000_000n * 10n ** 18n).toString(), totalSupply: "1000000000", holder: true, dailyReportLimit: 5 }));
    const api = harness();
    for (let n = 1; n <= 5; n++) expect((await api.post(`/utility/deep-dive/${api.insert(n)}`, {})).status).toBe(200);
    expect((await api.post(`/utility/deep-dive/${api.insert(6)}`, {})).status).toBe(429);
    expect(Number(api.sqlite.prepare("SELECT COUNT(*) AS n FROM p4_report_uses WHERE tier = 'holder'").get()?.n)).toBe(5);
  });
});

describe("agent policy storage", () => {
  it("keeps policy reviews wallet-bound and enforces the daily review cap", async () => {
    const api = harness();
    const policy = { allowedOrigins: ["https://api.example.com"], allowedPathPrefixes: ["/reports/"], maxPerRequestRaw: "10000", maxDailyRaw: "10000", manualApproval: true, enabled: true };
    expect((await api.post("/agent/policy", { policy }, "PUT")).status).toBe(200);
    const first = await api.post("/agent/review", { resourceUrl: "https://api.example.com/reports/a", purpose: "Research", priceRaw: "10000" });
    expect((await first.json()).allowed).toBe(true);
    const second = await api.post("/agent/review", { resourceUrl: "https://api.example.com/reports/b", purpose: "Research", priceRaw: "10000" });
    expect((await second.json()).allowed).toBe(false);
    const ledger = await api.get("/agent/reviews");
    expect((await ledger.json()).items).toHaveLength(2);
    expect(Number(api.sqlite.prepare("SELECT COUNT(*) AS n FROM p3_agent_reviews WHERE decision = 'allowed'").get()?.n)).toBe(1);
  });
});
