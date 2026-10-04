import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { parseSiweMessage } from "viem/siwe";
import type { RegistryResponse } from "../p0/registry.ts";
import { VAULTS } from "../p0/registry.ts";
import { evidenceStatus } from "../p0/evidence.ts";
import { evaluateDeposit, validateIntent, validateRules, type Mandate, type PreflightReport } from "./rules.ts";
import { isHex } from "viem";
import { getP2Config, p2Client, prepareP2Action, verifyP2Adapter, type P2Bindings } from "../p2/adapter.ts";
import { isExpired, parsePositiveRaw, receiptState, reservedDepositRaw, type PreparedAction } from "../p2/core.ts";

type Statement = { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }> };
export type P1Database = { prepare(sql: string): Statement };
type Env = { Bindings: { DB?: P1Database } & P2Bindings };
type Session = { wallet: string; tokenHash: string };
type MandateRow = { id: string; version: number; rules_json: string; created_at: string; supersedes_id: string | null };
type ReportRow = { report_json: string; input_hash: string };
type AlertRow = { id: string; vault_id: string; rule_id: string; severity: string; before_json: string | null; after_json: string; source_uri: string; created_at: string; read_at: string | null };
type ActionRow = { action_json: string; input_hash: string; state: string; tx_hash: string | null; updated_at: string };
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

  async function actionFor(c: Context<Env>, wallet: string, id: string) {
    const row = await c.env.DB!.prepare("SELECT action_json, input_hash, state, tx_hash, updated_at FROM p2_actions WHERE id = ? AND wallet = ?").bind(id, wallet).first<ActionRow>();
    if (!row) return null;
    const action = JSON.parse(row.action_json) as PreparedAction;
    return action.chainId === getP2Config(c.env).chainId ? { row, action } : null;
  }

  app.get("/actions/config", async (c) => {
    const config = getP2Config(c.env);
    return c.json({ chainId: config.chainId, network: config.network, vaults: config.vaults, explorer: config.explorer, configured: config.configured, writesEnabled: config.writesEnabled });
  });

  app.post("/actions/prepare", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    if (!await rateAllowed(c.env.DB!, `p2:${current.wallet}`, 30, 3600)) return c.json({ error: "Hourly action review limit reached." }, 429);
    const body = await c.req.json().catch(() => null) as { vaultId?: unknown; kind?: unknown; amountRaw?: unknown; idempotencyKey?: unknown } | null;
    if (typeof body?.vaultId !== "string" || !getP2Config(c.env).vaults.some((vault) => vault.id === body.vaultId) || (body?.kind !== "deposit" && body?.kind !== "withdraw") || typeof body.amountRaw !== "string" || typeof body.idempotencyKey !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(body.idempotencyKey)) return c.json({ error: "Choose a reviewed vault, action, amount, and review key." }, 400);
    const selected = getP2Config(c.env, body.vaultId);
    let amountRaw: bigint;
    try { amountRaw = parsePositiveRaw(body.amountRaw); } catch (error) { return c.json({ error: error instanceof Error ? error.message : "Invalid amount." }, 400); }
    const inputHash = await sha256(json({ chainId: selected.chainId, vaultId: selected.vaultId, kind: body.kind, amountRaw: amountRaw.toString(), wallet: current.wallet }));
    const existing = await c.env.DB!.prepare("SELECT action_json, input_hash FROM p2_actions WHERE wallet = ? AND idempotency_key = ?").bind(current.wallet, body.idempotencyKey).first<ActionRow>();
    if (existing) {
      const action = JSON.parse(existing.action_json) as PreparedAction;
      return action.chainId === getP2Config(c.env).chainId && existing.input_hash === inputHash ? c.json(action) : c.json({ error: "This review key was already used for different input." }, 409);
    }
    const active = await c.env.DB!.prepare("SELECT id, version, rules_json, created_at, supersedes_id FROM p1_mandates WHERE wallet = ? ORDER BY version DESC LIMIT 1").bind(current.wallet).first<MandateRow>();
    if (!active) return c.json({ error: "Create a mandate before preparing an action." }, 409);
    const pending = await c.env.DB!.prepare("SELECT action_json FROM p2_actions WHERE wallet = ? AND state IN ('wallet_prompt', 'submitted', 'unknown') AND created_at > ?").bind(current.wallet, new Date(Date.now() - 30 * 60_000).toISOString()).all<{ action_json: string }>();
    if (pending.results.some((row) => (JSON.parse(row.action_json) as PreparedAction).chainId === getP2Config(c.env).chainId)) return c.json({ error: "A previous wallet action is unresolved. Check its receipt before preparing another." }, 409);
    if (body.kind === "deposit") {
      const recent = await c.env.DB!.prepare("SELECT action_json FROM p2_actions WHERE wallet = ? AND created_at > ? AND state IN ('wallet_prompt', 'submitted', 'confirmed', 'unknown')").bind(current.wallet, new Date(Date.now() - 24 * 60 * 60_000).toISOString()).all<{ action_json: string }>();
      const reserved = reservedDepositRaw(recent.results.map((row) => JSON.parse(row.action_json) as PreparedAction), selected.asset);
      const dailyLimit = selected.assetSymbol === "EURC" ? mapMandate(active).rules.maxEurcDailyRaw : mapMandate(active).rules.maxDailyRaw;
      if (!dailyLimit || amountRaw + reserved > BigInt(dailyLimit)) return c.json({ error: `This amount would exceed the mandate's ${selected.assetSymbol} 24-hour limit for recorded actions.` }, 409);
    }
    try {
      const action = await prepareP2Action({ vaultId: body.vaultId, kind: body.kind, amountRaw: amountRaw.toString(), wallet: current.wallet as `0x${string}`, mandate: mapMandate(active), env: c.env });
      await c.env.DB!.prepare("INSERT INTO p2_actions (id, wallet, mandate_id, idempotency_key, input_hash, action_json, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(action.id, current.wallet, active.id, body.idempotencyKey, inputHash, json(action), action.state, action.createdAt, action.createdAt).run();
      return c.json(action, 201);
    } catch (error) { return c.json({ error: error instanceof Error ? error.message : "The action could not be prepared." }, 409); }
  });

  app.get("/actions", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const rows = await c.env.DB!.prepare("SELECT action_json FROM p2_actions WHERE wallet = ? AND json_extract(action_json, '$.chainId') = ? ORDER BY created_at DESC LIMIT 30").bind(current.wallet, getP2Config(c.env).chainId).all<{ action_json: string }>();
    return c.json({ items: rows.results.map((row) => JSON.parse(row.action_json) as PreparedAction) });
  });

  app.post("/actions/:id/prompt", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const found = await actionFor(c, current.wallet, c.req.param("id"));
    if (!found) return c.json({ error: "Action not found." }, 404);
    const { action } = found;
    if (action.state !== "preflight_ready" || isExpired(action)) return c.json({ error: "The review has expired or a wallet request is already in progress. Prepare a fresh review." }, 409);
    const active = await c.env.DB!.prepare("SELECT id, version, rules_json, created_at, supersedes_id FROM p1_mandates WHERE wallet = ? ORDER BY version DESC LIMIT 1").bind(current.wallet).first<MandateRow>();
    if (active?.id !== action.mandateId) return c.json({ error: "Your mandate changed. Prepare a fresh review." }, 409);
    try {
      const config = getP2Config(c.env, action.vaultId);
      if (!config.writesEnabled) return c.json({ error: "Arc Mainnet actions have been paused." }, 409);
      if (action.chainId !== config.chainId || action.vault.toLowerCase() !== config.vault.toLowerCase() || action.asset.toLowerCase() !== config.asset.toLowerCase() || action.codeHash.toLowerCase() !== config.vaultCodeHash.toLowerCase()) throw new Error("The reviewed route changed.");
      const expectedTarget = action.step === "action" ? config.bundle : action.kind === "deposit" ? config.asset : config.vault;
      if (action.target.toLowerCase() !== expectedTarget.toLowerCase()) throw new Error("The reviewed transaction target changed.");
      if (BigInt(action.gasLimitRaw) * await p2Client.getGasPrice() > BigInt(mapMandate(active!).rules.maxGasRaw)) throw new Error("The current gas price exceeds the mandate.");
      await verifyP2Adapter(config);
      await p2Client.call({ account: action.wallet, to: action.target, data: action.calldata });
    } catch { return c.json({ error: "The adapter or simulation changed. Refresh the review." }, 409); }
    const next: PreparedAction = { ...action, state: "wallet_prompt" };
    const changed = await c.env.DB!.prepare("UPDATE p2_actions SET action_json = ?, state = ?, updated_at = ? WHERE id = ? AND wallet = ? AND state = 'preflight_ready'").bind(json(next), next.state, new Date().toISOString(), action.id, current.wallet).run();
    return changed.meta.changes ? c.json(next) : c.json({ error: "Another wallet request is already in progress." }, 409);
  });

  app.post("/actions/:id/rejected", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const found = await actionFor(c, current.wallet, c.req.param("id"));
    if (!found) return c.json({ error: "Action not found." }, 404);
    if (found.action.state !== "wallet_prompt") return c.json({ error: "This action cannot be cancelled." }, 409);
    const next: PreparedAction = { ...found.action, state: "draft", message: "Wallet request cancelled. Prepare a fresh review to try again." };
    await c.env.DB!.prepare("UPDATE p2_actions SET action_json = ?, state = ?, updated_at = ? WHERE id = ? AND wallet = ? AND state = 'wallet_prompt'").bind(json(next), next.state, new Date().toISOString(), next.id, current.wallet).run();
    return c.json(next);
  });

  app.post("/actions/:id/tx", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const found = await actionFor(c, current.wallet, c.req.param("id"));
    if (!found) return c.json({ error: "Action not found." }, 404);
    const body = await c.req.json().catch(() => null) as { hash?: unknown } | null;
    if (typeof body?.hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(body.hash) || !isHex(body.hash)) return c.json({ error: "A valid transaction hash is required." }, 400);
    const action = found.action;
    if (["submitted", "unknown", "dropped"].includes(action.state) && action.txHash?.toLowerCase() === body.hash.toLowerCase()) return c.json(action);
    if (!["wallet_prompt", "submitted", "unknown", "dropped"].includes(action.state)) return c.json({ error: "This action is not waiting for a wallet transaction." }, 409);
    let tx;
    try { tx = await p2Client.getTransaction({ hash: body.hash as `0x${string}` }); }
    catch { return c.json({ error: "Transaction is not visible on Arc Mainnet yet. Retry recording this hash; do not send another transaction." }, 425); }
    if (tx.from.toLowerCase() !== current.wallet || tx.to?.toLowerCase() !== action.target.toLowerCase() || tx.input.toLowerCase() !== action.calldata.toLowerCase() || tx.value !== 0n || tx.chainId !== action.chainId) return c.json({ error: "Transaction does not match the approved review." }, 409);
    if (action.state !== "wallet_prompt" && (action.txNonce === null || action.txNonce === undefined || tx.nonce !== action.txNonce)) return c.json({ error: "Replacement transaction must use the original wallet nonce." }, 409);
    const next: PreparedAction = { ...action, state: "submitted", txHash: body.hash as `0x${string}`, txNonce: tx.nonce, submittedAt: new Date().toISOString(), message: null };
    try {
      const changed = await c.env.DB!.prepare("UPDATE p2_actions SET action_json = ?, state = ?, tx_hash = ?, updated_at = ? WHERE id = ? AND wallet = ? AND state = ?").bind(json(next), next.state, next.txHash, new Date().toISOString(), next.id, current.wallet, action.state).run();
      return changed.meta.changes ? c.json(next) : c.json({ error: "This wallet action was already recorded." }, 409);
    } catch { return c.json({ error: "This transaction hash is already recorded for another action." }, 409); }
  });

  app.get("/actions/:id", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const found = await actionFor(c, current.wallet, c.req.param("id"));
    if (!found) return c.json({ error: "Action not found." }, 404);
    const action = found.action;
    if (!action.txHash || !["submitted", "unknown"].includes(action.state)) return c.json(action);
    let receipt: { status: "success" | "reverted" } | null = null;
    let known = false;
    let notFound = false;
    try {
      const tx = await p2Client.getTransaction({ hash: action.txHash });
      known = tx.from.toLowerCase() === action.wallet.toLowerCase() && tx.to?.toLowerCase() === action.target.toLowerCase() && tx.input.toLowerCase() === action.calldata.toLowerCase();
      if (!known) return c.json({ error: "The recorded transaction no longer matches this action." }, 409);
      try { receipt = await p2Client.getTransactionReceipt({ hash: action.txHash }); } catch { /* Pending or provider unavailable. */ }
    } catch (cause) { notFound = cause instanceof Error && cause.name === "TransactionNotFoundError"; }
    let replacementPossible = false;
    if (notFound && action.txNonce !== null && action.txNonce !== undefined) {
      try { replacementPossible = await p2Client.getTransactionCount({ address: action.wallet, blockTag: "latest" }) > action.txNonce; }
      catch { replacementPossible = true; }
    }
    const state = receiptState(receipt, notFound && !replacementPossible, Date.now() - Date.parse(action.submittedAt ?? found.row.updated_at));
    const next: PreparedAction = { ...action, state, message: state === "reverted" ? "The transaction reverted on Arc Mainnet." : state === "dropped" ? "This transaction was not found after 30 minutes." : replacementPossible ? "The original hash is missing and the wallet nonce advanced. A replacement may have landed; track its new hash below." : state === "unknown" ? "Receipt pending or RPC unavailable. Check the explorer before retrying." : null };
    if (next.state !== action.state) await c.env.DB!.prepare("UPDATE p2_actions SET action_json = ?, state = ?, updated_at = ? WHERE id = ? AND wallet = ?").bind(json(next), next.state, new Date().toISOString(), next.id, current.wallet).run();
    return c.json(next);
  });

  app.get("/data/export", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const [mandates, reports, watchlist, alerts, actions] = await Promise.all([
      c.env.DB!.prepare("SELECT id, version, rules_json, created_at, supersedes_id FROM p1_mandates WHERE wallet = ? ORDER BY version DESC").bind(current.wallet).all<MandateRow>(),
      c.env.DB!.prepare("SELECT report_json FROM p1_reports WHERE wallet = ? ORDER BY created_at DESC").bind(current.wallet).all<ReportRow>(),
      c.env.DB!.prepare("SELECT vault_id FROM p1_watchlist WHERE wallet = ? ORDER BY created_at DESC").bind(current.wallet).all<{ vault_id: string }>(),
      c.env.DB!.prepare("SELECT id, vault_id, rule_id, severity, before_json, after_json, source_uri, created_at, read_at FROM p1_alerts WHERE wallet = ? ORDER BY created_at DESC").bind(current.wallet).all<AlertRow>(),
      c.env.DB!.prepare("SELECT action_json FROM p2_actions WHERE wallet = ? ORDER BY created_at DESC").bind(current.wallet).all<{ action_json: string }>(),
    ]);
    return c.json({ schemaVersion: 2, exportedAt: new Date().toISOString(), wallet: current.wallet, mandates: mandates.results.map(mapMandate), reports: reports.results.map((row) => JSON.parse(row.report_json)), watchlist: watchlist.results.map((row) => row.vault_id), alerts: alerts.results.map((row) => ({ id: row.id, vaultId: row.vault_id, ruleId: row.rule_id, severity: row.severity, before: row.before_json ? JSON.parse(row.before_json) : null, after: JSON.parse(row.after_json), sourceUri: row.source_uri, createdAt: row.created_at, readAt: row.read_at })), actions: actions.results.map((row) => JSON.parse(row.action_json)) });
  });

  app.post("/data/delete", async (c) => {
    const current = await session(c);
    if (!current) return c.json({ error: "Wallet sign-in required." }, 401);
    const body = await c.req.json().catch(() => null) as { confirm?: unknown } | null;
    if (body?.confirm !== "DELETE") return c.json({ error: "Type DELETE to confirm account data removal." }, 400);
    for (const table of ["p2_actions", "p1_reports", "p1_alerts", "p1_watchlist", "p1_mandates", "p1_sessions"] as const) {
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
