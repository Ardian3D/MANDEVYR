CREATE TABLE IF NOT EXISTS p3_x402_payments (
  wallet TEXT NOT NULL,
  report_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  network TEXT NOT NULL,
  amount_raw TEXT NOT NULL,
  asset TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  result_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (wallet, report_id),
  UNIQUE (wallet, idempotency_key),
  UNIQUE (transaction_hash)
);
