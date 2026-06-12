-- Full provenance log for /work/[id] provenance tab.
-- Records every Transfer and Burn event from the NFT contract.
CREATE TABLE token_transfers (
  id                    BIGSERIAL   PRIMARY KEY,
  ledger                BIGINT      NOT NULL,
  tx_hash               TEXT        NOT NULL,
  event_index           INTEGER     NOT NULL,
  token_id              INTEGER     NOT NULL,
  from_address          TEXT,
  to_address            TEXT,
  kind                  TEXT        NOT NULL CHECK (kind IN ('mint','transfer','burn')),
  UNIQUE (ledger, tx_hash, event_index)
);
