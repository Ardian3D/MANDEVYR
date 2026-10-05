CREATE TABLE IF NOT EXISTS p3_agent_policies (
  wallet TEXT PRIMARY KEY,
  policy_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS p3_agent_reviews (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  resource_url TEXT NOT NULL,
  purpose TEXT NOT NULL,
  price_raw TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allowed', 'blocked')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS p3_agent_reviews_wallet_time ON p3_agent_reviews (wallet, created_at DESC);
