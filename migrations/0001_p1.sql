CREATE TABLE IF NOT EXISTS p1_nonces (
  nonce_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE TABLE IF NOT EXISTS p1_sessions (
  token_hash TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS p1_sessions_wallet ON p1_sessions(wallet);
CREATE TABLE IF NOT EXISTS p1_mandates (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  version INTEGER NOT NULL,
  rules_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  supersedes_id TEXT,
  UNIQUE(wallet, version)
);
CREATE TABLE IF NOT EXISTS p1_reports (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  mandate_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  report_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(wallet, idempotency_key)
);
CREATE INDEX IF NOT EXISTS p1_reports_wallet_time ON p1_reports(wallet, created_at DESC);
CREATE TABLE IF NOT EXISTS p1_watchlist (
  wallet TEXT NOT NULL,
  vault_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(wallet, vault_id)
);
CREATE TABLE IF NOT EXISTS p1_alerts (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  vault_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  dedupe_key TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS p1_alerts_wallet_time ON p1_alerts(wallet, created_at DESC);
CREATE TABLE IF NOT EXISTS p1_observations (
  vault_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  block_number TEXT,
  total_assets_raw TEXT,
  fetched_at TEXT NOT NULL,
  source_uri TEXT NOT NULL
);
