CREATE TABLE IF NOT EXISTS p3_x402_pending (
  wallet TEXT NOT NULL,
  report_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL UNIQUE,
  result_hash TEXT,
  valid_before INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (wallet, report_id, idempotency_key),
  UNIQUE (wallet, report_id)
);
