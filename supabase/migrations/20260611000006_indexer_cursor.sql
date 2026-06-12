-- Single-row table; enforced by CHECK (id = 1).
-- Tracks the last successfully indexed ledger and the RPC pagination cursor.
CREATE TABLE indexer_cursor (
  id          INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_ledger BIGINT      NOT NULL DEFAULT 0,
  last_cursor TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO indexer_cursor (id, last_ledger) VALUES (1, 0);
