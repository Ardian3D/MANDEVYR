/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createP1Api, type P1Database } from "../p1/api";
import { MANDATE_TEMPLATES } from "../p1/rules";
import * as adapter from "./adapter";
import type { PreparedAction } from "./core";

const wallet = "0x1111111111111111111111111111111111111111";
const token = "a".repeat(64);
const databases: DatabaseSync[] = [];

function harness() {
  const sqlite = new DatabaseSync(":memory:");
  databases.push(sqlite);
  for (const name of ["0001_p1.sql", "0002_rate_limits.sql", "0003_p2_actions.sql", "0004_p2_wallet_revision.sql"]) sqlite.exec(readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
  sqlite.prepare("INSERT INTO p1_sessions VALUES (?, ?, ?, NULL)").run(createHash("sha256").update(token).digest("hex"), wallet, Math.floor(Date.now() / 1000) + 600);
  sqlite.prepare("INSERT INTO p1_mandates VALUES (?, ?, 1, ?, ?, NULL)").run("mandate", wallet, JSON.stringify({ ...MANDATE_TEMPLATES.balanced, maxActionRaw: "100000000", maxDailyRaw: "100000000" }), new Date().toISOString());
  const db: P1Database = { prepare(sql) {
    let args: SQLInputValue[] = [];
    return {
      bind(...values) { args = values as SQLInputValue[]; return this; },
      async first<T>() { return (sqlite.prepare(sql).get(...args) ?? null) as T | null; },
      async all<T>() { return { results: sqlite.prepare(sql).all(...args) as T[] }; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
    };
  } };
  const config = adapter.getP2Config({});
  const insert = (id: string, state = "preflight_ready", amountRaw = "60000000") => {
    const action = { id, wallet, chainId: 5042, vaultId: config.vaultId, vault: config.vault, asset: config.asset, target: config.bundle, codeHash: config.vaultCodeHash, calldata: "0x1234", state, kind: "deposit", step: "action", amountRaw, mandateId: "mandate", gasLimitRaw: "100000", gasPriceRaw: "1", createdAt: new Date().toISOString(), validUntil: new Date(Date.now() + 60_000).toISOString() } as unknown as PreparedAction;
    sqlite.prepare("INSERT INTO p2_actions (id,wallet,mandate_id,idempotency_key,input_hash,action_json,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id,wallet,"mandate",id,id,JSON.stringify(action),state,action.createdAt,action.createdAt);
  };
  const app = createP1Api(async () => ({ items: [] }) as never, async () => false);
  const prompt = (id: string) => app.request(`http://localhost/actions/${id}/prompt`, { method: "POST", headers: { Cookie: `mandevyr_session=${token}`, Origin: "http://localhost" } }, { DB: db, P2_MAINNET_WRITES_ENABLED: "true" });
  return { sqlite, insert, prompt };
}

beforeEach(() => {
  vi.spyOn(adapter, "verifyP2Adapter").mockResolvedValue({ assetDecimals: 6, shareDecimals: 18, blockNumber: 1n, observedAt: new Date().toISOString() });
  vi.spyOn(adapter.p2Client, "getGasPrice").mockResolvedValue(1n);
  vi.spyOn(adapter.p2Client, "estimateGas").mockResolvedValue(50000n);
  vi.spyOn(adapter.p2Client, "getBalance").mockResolvedValue(1000n * 10n ** 18n);
  vi.spyOn(adapter.p2Client, "call").mockResolvedValue({ data: "0x" });
});
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) db.close(); });

describe("P2 wallet prompt reservations", () => {
  it("allows only one simultaneous prompt even when both reviews passed preparation", async () => {
    const api = harness(); api.insert("one"); api.insert("two");
    const responses = await Promise.all([api.prompt("one"), api.prompt("two")]);
    expect(responses.map((item) => item.status).sort()).toEqual([200,409]);
  });
  it("rechecks the daily budget after another deposit has confirmed", async () => {
    const api = harness(); api.insert("draft"); api.insert("spent", "confirmed");
    const response = await api.prompt("draft");
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("daily budget");
  });
  it("does not open the wallet after a mandate changes during simulation", async () => {
    const api = harness(); api.insert("draft");
    vi.mocked(adapter.p2Client.call).mockImplementationOnce(async () => {
      api.sqlite.prepare("UPDATE p1_mandates SET id = 'new-mandate'").run();
      return { data: "0x" };
    });
    expect((await api.prompt("draft")).status).toBe(409);
  });
  it("rejects a gas estimate that no longer fits the reviewed gas limit", async () => {
    const api = harness(); api.insert("draft");
    vi.mocked(adapter.p2Client.estimateGas).mockResolvedValue(100001n);
    expect((await api.prompt("draft")).status).toBe(409);
  });
  it("rejects a review that expires while the network check is running", async () => {
    const api = harness(); api.insert("draft");
    const later = Date.now() + 61_000;
    vi.mocked(adapter.p2Client.call).mockImplementationOnce(async () => { vi.spyOn(Date, "now").mockReturnValue(later); return { data: "0x" }; });
    expect((await api.prompt("draft")).status).toBe(409);
  });
});
