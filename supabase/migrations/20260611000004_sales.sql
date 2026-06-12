CREATE TABLE sales (
  id                    BIGSERIAL       PRIMARY KEY,
  ledger                BIGINT          NOT NULL,
  tx_hash               TEXT            NOT NULL,
  event_index           INTEGER         NOT NULL,
  listing_id            BIGINT          NOT NULL REFERENCES listings(listing_id),
  token_id              INTEGER         NOT NULL,
  buyer                 TEXT            NOT NULL,
  seller                TEXT            NOT NULL,
  price                 NUMERIC(39,0)   NOT NULL,
  currency              TEXT            NOT NULL,
  royalty_paid          NUMERIC(39,0)   NOT NULL,
  referral_paid         NUMERIC(39,0)   NOT NULL,
  fee_paid              NUMERIC(39,0)   NOT NULL,
  UNIQUE (ledger, tx_hash, event_index)
);
