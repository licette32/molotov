CREATE TABLE listings (
  listing_id            BIGINT          PRIMARY KEY,
  nft_contract          TEXT            NOT NULL,
  seller                TEXT            NOT NULL,
  token_id              INTEGER         NOT NULL REFERENCES tokens(token_id),
  price                 NUMERIC(39,0)   NOT NULL,
  currency              TEXT            NOT NULL,
  kind                  TEXT            NOT NULL
                                        CHECK (kind IN ('fixed_price','open_edition','auction')),
  editions_total        INTEGER         NOT NULL,
  editions_sold         INTEGER         NOT NULL DEFAULT 0,
  ends_at               BIGINT          NOT NULL DEFAULT 0,
  referral_bps          INTEGER         NOT NULL,
  primary_split         JSONB,
  status                TEXT            NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active','sold','cancelled')),
  created_at_ledger     BIGINT          NOT NULL,
  created_at_tx         TEXT            NOT NULL,
  created_event_index   INTEGER         NOT NULL
);
