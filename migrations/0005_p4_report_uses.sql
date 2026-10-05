CREATE TABLE IF NOT EXISTS p4_report_uses (
  wallet TEXT NOT NULL,
  report_id TEXT NOT NULL,
  day TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'holder')),
  token_block TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (wallet, report_id)
);
CREATE INDEX IF NOT EXISTS p4_report_uses_day ON p4_report_uses (wallet, day);
