CREATE TABLE artists (
  address                TEXT        PRIMARY KEY,
  registered_at_ledger   BIGINT      NOT NULL,
  registered_at_tx       TEXT        NOT NULL,
  registered_event_index INTEGER     NOT NULL,
  revoked                BOOLEAN     NOT NULL DEFAULT FALSE,
  revoked_at_ledger      BIGINT,
  revoked_at_tx          TEXT,
  revoked_event_index    INTEGER
);
