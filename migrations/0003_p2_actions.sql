CREATE TABLE IF NOT EXISTS p2_actions (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  mandate_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  action_json TEXT NOT NULL,
  state TEXT NOT NULL,
  tx_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(wallet, idempotency_key)
);
CREATE INDEX IF NOT EXISTS p2_actions_wallet_created ON p2_actions(wallet, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS p2_actions_tx_hash ON p2_actions(tx_hash) WHERE tx_hash IS NOT NULL;
