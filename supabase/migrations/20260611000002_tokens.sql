CREATE TABLE tokens (
  token_id              INTEGER       PRIMARY KEY,
  artist                TEXT          NOT NULL REFERENCES artists(address),
  owner                 TEXT          NOT NULL,
  token_uri             TEXT,
  royalty_bps           INTEGER       NOT NULL,
  recipients_count      INTEGER       NOT NULL,
  burned                BOOLEAN       NOT NULL DEFAULT FALSE,
  minted_at_ledger      BIGINT        NOT NULL,
  minted_at_tx          TEXT          NOT NULL,
  minted_event_index    INTEGER       NOT NULL
);
