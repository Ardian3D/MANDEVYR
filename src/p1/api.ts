import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { parseSiweMessage } from "viem/siwe";
import type { RegistryResponse } from "../p0/registry.ts";
import { VAULTS } from "../p0/registry.ts";
import { evidenceStatus } from "../p0/evidence.ts";
import { evaluateDeposit, validateIntent, validateRules, type Mandate, type PreflightReport } from "./rules.ts";

type Statement = { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }> };
export type P1Database = { prepare(sql: string): Statement };
type Env = { Bindings: { DB?: P1Database } };
type Session = { wallet: string; tokenHash: string };
type MandateRow = { id: string; version: number; rules_json: string; created_at: string; supersedes_id: string | null };
type ReportRow = { report_json: string; input_hash: string };
type AlertRow = { id: string; vault_id: string; rule_id: string; severity: string; before_json: string | null; after_json: string; source_uri: string; created_at: string; read_at: string | null };
const COOKIE = "mandevyr_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

const sha256 = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const randomHex = (bytes: number) => Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const json = (value: unknown) => JSON.stringify(value);
function mapMandate(row: MandateRow): Mandate { return { id: row.id, version: row.version, rules: JSON.parse(row.rules_json), createdAt: row.created_at, supersedesId: row.supersedes_id }; }

async function rateAllowed(db: P1Database, key: string, limit: number, windowSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const start = Math.floor(now / windowSeconds) * windowSeconds;
  await db.prepare("INSERT INTO p1_rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start < excluded.window_start THEN 1 ELSE count + 1 END, window_start = excluded.window_start").bind(key, start).run();
  const row = await db.prepare("SELECT count FROM p1_rate_limits WHERE key = ?").bind(key).first<{ count: number }>();
  return (row?.count ?? limit + 1) <= limit;
}

export function createP1Api(getRegistry: () => Promise<RegistryResponse>, verifyMessage: (args: { message: string; signature: `0x${string}`; domain: string; nonce: string }) => Promise<boolean>) {
  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    const db = c.env?.DB;
    if (!db) return c.json({ error: "P1 storage is not configured. Account features are unavailable." }, 503);
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const origin = c.req.header("Origin");
      if (!origin || origin !== new URL(c.req.url).origin) return c.json({ error: "Request origin did not match this site." }, 403);
    }
    await next();
  });

  async function session(c: Context<Env>): Promise<Session | null> {
    const token = getCookie(c, COOKIE);
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    const tokenHash = await sha256(token);
    const row = await c.env.DB!.prepare("SELECT wallet FROM p1_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?").bind(tokenHash, Math.floor(Date.now() / 1000)).first<{ wallet: string }>();
    return row ? { wallet: row.wallet, tokenHash } : null;
  }

  app.post("/auth/nonce", async (c) => {
    const ip = c.req.header("CF-Connecting-IP") ?? "local";
    if (!await rateAllowed(c.env.DB!, `nonce:${await sha256(ip)}`, 12, 300)) return c.json({ error: "Too many sign-in attempts. Try again in a few minutes." }, 429);
    const nonce = randomHex(16);
    await c.env.DB!.prepare("INSERT INTO p1_nonces (nonce_hash, expires_at) VALUES (?, ?)").bind(await sha256(nonce), Math.floor(Date.now() / 1000) + 300).run();
    return c.json({ nonce, expiresAt: new Date(Date.now() + 300_000).toISOString() });
  });

  app.post("/auth/verify", async (c) => {
    const body = await c.req.json().catch(() => null) as { message?: unknown; signature?: unknown } | null;
    if (typeof body?.message !== "string" || body.message.length > 1500 || typeof body.signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(body.signature)) return c.json({ error: "Invalid SIWE message or signature." }, 400);
    let parsed;
    try { parsed = parseSiweMessage(body.message); } catch { return c.json({ error: "Malformed SIWE message." }, 400); }
    const origin = new URL(c.req.url).origin;
    const now = Date.now();
    const issued = parsed.issuedAt?.getTime() ?? NaN;
    const expiry = parsed.expirationTime?.getTime() ?? NaN;
    if (!parsed.nonce || !parsed.address || parsed.chainId !== 5042 || parsed.domain !== new URL(origin).host || parsed.uri !== origin || !Number.isFinite(issued) || issued > now + 30_000 || issued < now - 300_000 || !Number.isFinite(expiry) || expiry <= now || expiry > issued + 300_000) return c.json({ error: "SIWE domain, network, or time window is invalid." }, 400);
    const nonceHash = await sha256(parsed.nonce);
    const present = await c.env.DB!.prepare("SELECT nonce_hash FROM p1_nonces WHERE nonce_hash = ? AND used_at IS NULL AND expires_at > ?").bind(nonceHash, Math.floor(now / 1000)).first();
    if (!present) return c.json({ error: "Sign-in request expired or was already used." }, 409);
    const valid = await verifyMessage({ message: body.message, signature: body.signature as `0x${string}`, domain: parsed.domain, nonce: parsed.nonce }).catch(() => false);
    if (!valid) return c.json({ error: "Wallet signature could not be verified." }, 401);
    const consumed = await c.env.DB!.prepare("UPDATE p1_nonces SET used_at = ? WHERE nonce_hash = ? AND used_at IS NULL AND expires_at > ?").bind(Math.floor(now / 1000), nonceHash, Math.floor(now / 1000)).run();
    if (consumed.meta.changes !== 1) return c.json({ error: "Sign-in request was already used." }, 409);
    const wallet = parsed.address.toLowerCase();
    const token = randomHex(32);
    await c.env.DB!.prepare("INSERT INTO p1_sessions (token_hash, wallet, expires_at) VALUES (?, ?, ?)").bind(await sha256(token), wallet, Math.floor(now / 1000) + SESSION_SECONDS).run();
    setCookie(c, COOKIE, token, { httpOnly: true, secure: origin.startsWith("https:"), sameSite: "Strict", path: "/api/p1", maxAge: SESSION_SECONDS });
    return c.json({ wallet });
  });

  app.post("/auth/logout", async (c) => {
    const current = await session(c);
    if (current) await c.env.DB!.prepare("UPDATE p1_sessions SET revoked_at = ? WHERE token_hash = ?").bind(Math.floor(Date.now() / 1000), current.tokenHash).run();
    setCookie(c, COOKIE, "", { httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Strict", path: "/api/p1", maxAge: 0 });
    return c.json({ ok: true });
  });

  app.get("/me", async (c) => {
    const current = await session(c);
    return current ? c.json({ wallet: current.wallet }) : c.json({ error: "Sign in with your wallet to save research." }, 401);
  });

  app.get("/mandates", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const rows = await c.env.DB!.prepare("SELECT id, version, rules_json, created_at, supersedes_id FROM p1_mandates WHERE wallet = ? ORDER BY version DESC LIMIT 50").bind(current.wallet).all<MandateRow>();
    return c.json({ items: rows.results.map(mapMandate) });
  });

  app.post("/mandates", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const body = await c.req.json().catch(() => null) as { rules?: unknown } | null;
    let rules;
    try { rules = validateRules(body?.rules); } catch (error) { return c.json({ error: error instanceof Error ? error.message : "Invalid mandate." }, 400); }
    const previous = await c.env.DB!.prepare("SELECT id, version, rules_json, created_at, supersedes_id FROM p1_mandates WHERE wallet = ? ORDER BY version DESC LIMIT 1").bind(current.wallet).first<MandateRow>();
    if (previous?.rules_json === json(rules)) return c.json(mapMandate(previous));
    const mandate: Mandate = { id: `mdt_${crypto.randomUUID()}`, version: (previous?.version ?? 0) + 1, rules, createdAt: new Date().toISOString(), supersedesId: previous?.id ?? null };
    try {
      await c.env.DB!.prepare("INSERT INTO p1_mandates (id, wallet, version, rules_json, created_at, supersedes_id) VALUES (?, ?, ?, ?, ?, ?)").bind(mandate.id, current.wallet, mandate.version, json(rules), mandate.createdAt, mandate.supersedesId).run();
    } catch { return c.json({ error: "Mandate changed in another session. Refresh and try again." }, 409); }
    return c.json(mandate, 201);
  });

  app.post("/preflights", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    if (!await rateAllowed(c.env.DB!, `preflight:${current.wallet}`, 40, 3600)) return c.json({ error: "Hourly research limit reached. Try again later." }, 429);
    const body = await c.req.json().catch(() => null) as { intent?: unknown; idempotencyKey?: unknown } | null;
    let intent;
    try { intent = validateIntent(body?.intent); } catch (error) { return c.json({ error: error instanceof Error ? error.message : "Invalid intent." }, 400); }
    if (typeof body?.idempotencyKey !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(body.idempotencyKey)) return c.json({ error: "Invalid idempotency key." }, 400);
    const inputHash = await sha256(json({ intent, wallet: current.wallet }));
    const existing = await c.env.DB!.prepare("SELECT report_json, input_hash FROM p1_reports WHERE wallet = ? AND idempotency_key = ?").bind(current.wallet, body.idempotencyKey).first<ReportRow>();
    if (existing) return existing.input_hash === inputHash ? c.json(JSON.parse(existing.report_json) as PreflightReport) : c.json({ error: "This idempotency key was already used for different input." }, 409);
    const active = await c.env.DB!.prepare("SELECT id, version, rules_json, created_at, supersedes_id FROM p1_mandates WHERE wallet = ? ORDER BY version DESC LIMIT 1").bind(current.wallet).first<MandateRow>();
    if (!active) return c.json({ error: "Create a mandate before running a preflight." }, 409);
    const registry = await getRegistry();
    const snapshot = registry.items.find((vault) => vault.id === intent.targetId);
    const now = Date.now();
    const result = evaluateDeposit({ intent, rules: mapMandate(active).rules, vault: snapshot, now });
    if (snapshot) {
      const summaryHash = await sha256(json({ chainId: snapshot.chainId, address: snapshot.address, status: snapshot.status, assetAddress: snapshot.assetAddress, assetDecimals: snapshot.assetDecimals, totalAssetsRaw: snapshot.totalAssetsRaw, blockNumber: snapshot.blockNumber, blockTimestamp: snapshot.blockTimestamp }));
      result.evidence = result.evidence.map((source) => source.sourceType === "arc_rpc" ? { ...source, summaryHash } : source);
    }
    const report: PreflightReport = { ...result, id: `prf_${crypto.randomUUID()}`, mandateId: active.id, mandateVersion: active.version, createdAt: new Date(now).toISOString(), validUntil: new Date(now + 60_000).toISOString() };
    try {
      await c.env.DB!.prepare("INSERT INTO p1_reports (id, wallet, mandate_id, input_hash, idempotency_key, report_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(report.id, current.wallet, active.id, inputHash, body.idempotencyKey, json(report), report.createdAt).run();
    } catch { return c.json({ error: "A report with this key already exists. Retry with the same input." }, 409); }
    return c.json(report, 201);
  });

  app.get("/preflights/:id", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const row = await c.env.DB!.prepare("SELECT report_json FROM p1_reports WHERE id = ? AND wallet = ?").bind(c.req.param("id"), current.wallet).first<ReportRow>();
    return row ? c.json(JSON.parse(row.report_json) as PreflightReport) : c.json({ error: "Report not found." }, 404);
  });

  app.get("/history", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const rows = await c.env.DB!.prepare("SELECT report_json FROM p1_reports WHERE wallet = ? ORDER BY created_at DESC LIMIT 50").bind(current.wallet).all<ReportRow>();
    return c.json({ items: rows.results.map((row) => JSON.parse(row.report_json) as PreflightReport) });
  });

  app.get("/watchlist", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const rows = await c.env.DB!.prepare("SELECT vault_id FROM p1_watchlist WHERE wallet = ? ORDER BY created_at DESC").bind(current.wallet).all<{ vault_id: string }>();
    return c.json({ items: rows.results.map((row) => row.vault_id) });
  });

  app.post("/watchlist", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    if (!await rateAllowed(c.env.DB!, `watch:${current.wallet}`, 60, 3600)) return c.json({ error: "Watchlist update limit reached. Try again later." }, 429);
    const body = await c.req.json().catch(() => null) as { vaultId?: unknown } | null;
    if (typeof body?.vaultId !== "string" || !VAULTS.some((vault) => vault.id === body.vaultId)) return c.json({ error: "Vault is not in the reviewed registry." }, 400);
    await c.env.DB!.prepare("INSERT OR IGNORE INTO p1_watchlist (wallet, vault_id, created_at) VALUES (?, ?, ?)").bind(current.wallet, body.vaultId, new Date().toISOString()).run();
    return c.json({ vaultId: body.vaultId });
  });

  app.delete("/watchlist/:id", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    await c.env.DB!.prepare("DELETE FROM p1_watchlist WHERE wallet = ? AND vault_id = ?").bind(current.wallet, c.req.param("id")).run();
    return c.json({ ok: true });
  });

  app.get("/alerts", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const rows = await c.env.DB!.prepare("SELECT id, vault_id, rule_id, severity, before_json, after_json, source_uri, created_at, read_at FROM p1_alerts WHERE wallet = ? ORDER BY created_at DESC LIMIT 100").bind(current.wallet).all<AlertRow>();
    return c.json({ items: rows.results.map((row) => ({ id: row.id, vaultId: row.vault_id, ruleId: row.rule_id, severity: row.severity, before: row.before_json ? JSON.parse(row.before_json) : null, after: JSON.parse(row.after_json), sourceUri: row.source_uri, createdAt: row.created_at, readAt: row.read_at })) });
  });

  app.post("/alerts/:id/ack", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const changed = await c.env.DB!.prepare("UPDATE p1_alerts SET read_at = COALESCE(read_at, ?) WHERE id = ? AND wallet = ?").bind(new Date().toISOString(), c.req.param("id"), current.wallet).run();
    return changed.meta.changes ? c.json({ ok: true }) : c.json({ error: "Alert not found." }, 404);
  });

  app.get("/data/export", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const [mandates, reports, watchlist, alerts] = await Promise.all([
      c.env.DB!.prepare("SELECT id, version, rules_json, created_at, supersedes_id FROM p1_mandates WHERE wallet = ? ORDER BY version DESC").bind(current.wallet).all<MandateRow>(),
      c.env.DB!.prepare("SELECT report_json FROM p1_reports WHERE wallet = ? ORDER BY created_at DESC").bind(current.wallet).all<ReportRow>(),
      c.env.DB!.prepare("SELECT vault_id FROM p1_watchlist WHERE wallet = ? ORDER BY created_at DESC").bind(current.wallet).all<{ vault_id: string }>(),
      c.env.DB!.prepare("SELECT id, vault_id, rule_id, severity, before_json, after_json, source_uri, created_at, read_at FROM p1_alerts WHERE wallet = ? ORDER BY created_at DESC").bind(current.wallet).all<AlertRow>(),
    ]);
    return c.json({ schemaVersion: 1, exportedAt: new Date().toISOString(), wallet: current.wallet, mandates: mandates.results.map(mapMandate), reports: reports.results.map((row) => JSON.parse(row.report_json)), watchlist: watchlist.results.map((row) => row.vault_id), alerts: alerts.results.map((row) => ({ id: row.id, vaultId: row.vault_id, ruleId: row.rule_id, severity: row.severity, before: row.before_json ? JSON.parse(row.before_json) : null, after: JSON.parse(row.after_json), sourceUri: row.source_uri, createdAt: row.created_at, readAt: row.read_at })) });
  });

  app.post("/data/delete", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const body = await c.req.json().catch(() => null) as { confirm?: unknown } | null;
    if (body?.confirm !== "DELETE") return c.json({ error: "Type DELETE to confirm account data removal." }, 400);
    for (const table of ["p1_reports", "p1_alerts", "p1_watchlist", "p1_mandates", "p1_sessions"] as const) {
      await c.env.DB!.prepare(`DELETE FROM ${table} WHERE wallet = ?`).bind(current.wallet).run();
    }
    await c.env.DB!.prepare("DELETE FROM p1_rate_limits WHERE key IN (?, ?)").bind(`preflight:${current.wallet}`, `watch:${current.wallet}`).run();
    setCookie(c, COOKIE, "", { httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Strict", path: "/api/p1", maxAge: 0 });
    return c.json({ deleted: true });
  });

  return app;
}

/** One bounded cron batch. Only changes in evidence availability create alerts. */
export async function runWatchtower(db: P1Database, getRegistry: () => Promise<RegistryResponse>, now = Date.now()) {
  await db.prepare("DELETE FROM p1_nonces WHERE expires_at < ?").bind(Math.floor(now / 1000) - 86_400).run();
  await db.prepare("DELETE FROM p1_sessions WHERE expires_at < ? OR revoked_at < ?").bind(Math.floor(now / 1000) - 86_400, Math.floor(now / 1000) - 86_400).run();
  await db.prepare("DELETE FROM p1_rate_limits WHERE window_start < ?").bind(Math.floor(now / 1000) - 86_400).run();
  const current = await getRegistry();
  const watched = await db.prepare("SELECT wallet, vault_id FROM p1_watchlist ORDER BY wallet, vault_id LIMIT 500").all<{ wallet: string; vault_id: string }>();
  let created = 0;
  for (const vault of current.items) {
    const status = evidenceStatus(vault, now);
    const previous = await db.prepare("SELECT status, block_number, total_assets_raw, fetched_at FROM p1_observations WHERE vault_id = ?").bind(vault.id).first<{ status: string; block_number: string | null; total_assets_raw: string | null; fetched_at: string }>();
    await db.prepare("INSERT INTO p1_observations (vault_id, status, block_number, total_assets_raw, fetched_at, source_uri) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(vault_id) DO UPDATE SET status=excluded.status, block_number=excluded.block_number, total_assets_raw=excluded.total_assets_raw, fetched_at=excluded.fetched_at, source_uri=excluded.source_uri").bind(vault.id, status, vault.blockNumber, vault.totalAssetsRaw, vault.fetchedAt, vault.sourceUrl).run();
    if (!previous || previous.status === status) continue;
    const ruleId = status === "fresh" ? "SOURCE_RESTORED" : "SOURCE_UNAVAILABLE";
    const bucket = new Date(now).toISOString().slice(0, 10);
    for (const row of watched.results.filter((item) => item.vault_id === vault.id)) {
      const result = await db.prepare("INSERT OR IGNORE INTO p1_alerts (id, wallet, vault_id, rule_id, severity, before_json, after_json, source_uri, created_at, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`alr_${crypto.randomUUID()}`, row.wallet, vault.id, ruleId, status === "fresh" ? "info" : "warning", json({ status: previous.status, blockNumber: previous.block_number, fetchedAt: previous.fetched_at }), json({ status, blockNumber: vault.blockNumber, fetchedAt: vault.fetchedAt }), vault.sourceUrl, new Date(now).toISOString(), `${row.wallet}:${vault.id}:${ruleId}:${bucket}`).run();
      created += result.meta.changes;
    }
  }
  return { checkedVaults: current.items.length, watchedEntries: watched.results.length, alertsCreated: created };
}
