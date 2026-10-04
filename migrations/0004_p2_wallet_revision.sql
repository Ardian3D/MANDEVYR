-- Optimistic concurrency guard for daily budgets checked before wallet prompts.
CREATE TABLE IF NOT EXISTS p2_wallet_revision (
  wallet TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO p2_wallet_revision (wallet, revision)
  SELECT DISTINCT wallet, 0 FROM p2_actions;
CREATE TRIGGER IF NOT EXISTS p2_revision_insert AFTER INSERT ON p2_actions BEGIN
  INSERT INTO p2_wallet_revision (wallet, revision) VALUES (NEW.wallet, 1)
    ON CONFLICT(wallet) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER IF NOT EXISTS p2_revision_update AFTER UPDATE ON p2_actions BEGIN
  UPDATE p2_wallet_revision SET revision = revision + 1 WHERE wallet = NEW.wallet;
END;
CREATE TRIGGER IF NOT EXISTS p2_revision_delete AFTER DELETE ON p2_actions BEGIN
  UPDATE p2_wallet_revision SET revision = revision + 1 WHERE wallet = OLD.wallet;
END;
