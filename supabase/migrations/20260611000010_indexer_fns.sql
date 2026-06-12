-- Postgres functions for each indexer event handler.
-- All are SECURITY DEFINER (run as owner, bypassing RLS for writes) and
-- REVOKE EXECUTE from anon/authenticated (defence-in-depth: anon cannot call them
-- even if they somehow obtained the function name).
-- The poller calls these via supabase.rpc() with the service_role key.

-- ── ArtistRegistry ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION apply_artist_registered(
  p_artist        TEXT,
  p_ledger        BIGINT,
  p_tx            TEXT,
  p_event_index   INTEGER
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  INSERT INTO artists (
    address, registered_at_ledger, registered_at_tx, registered_event_index, revoked
  )
  VALUES (p_artist, p_ledger, p_tx, p_event_index, FALSE)
  ON CONFLICT (address) DO UPDATE
    SET registered_at_ledger   = EXCLUDED.registered_at_ledger,
        registered_at_tx       = EXCLUDED.registered_at_tx,
        registered_event_index = EXCLUDED.registered_event_index,
        revoked                = FALSE,
        revoked_at_ledger      = NULL,
        revoked_at_tx          = NULL,
        revoked_event_index    = NULL;
$$;

CREATE OR REPLACE FUNCTION apply_artist_revoked(
  p_artist        TEXT,
  p_ledger        BIGINT,
  p_tx            TEXT,
  p_event_index   INTEGER
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE artists
     SET revoked             = TRUE,
         revoked_at_ledger   = p_ledger,
         revoked_at_tx       = p_tx,
         revoked_event_index = p_event_index
   WHERE address = p_artist;
$$;

-- ── MolotovNft ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION apply_minted_event(
  p_token_id          INTEGER,
  p_artist            TEXT,
  p_owner             TEXT,
  p_token_uri         TEXT,
  p_royalty_bps       INTEGER,
  p_recipients_count  INTEGER,
  p_ledger            BIGINT,
  p_tx                TEXT,
  p_event_index       INTEGER
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  INSERT INTO tokens (
    token_id, artist, owner, token_uri, royalty_bps, recipients_count,
    minted_at_ledger, minted_at_tx, minted_event_index
  )
  VALUES (
    p_token_id, p_artist, p_owner, p_token_uri, p_royalty_bps, p_recipients_count,
    p_ledger, p_tx, p_event_index
  )
  ON CONFLICT (token_id) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION apply_transfer(
  p_token_id      INTEGER,
  p_from          TEXT,
  p_to            TEXT,
  p_ledger        BIGINT,
  p_tx            TEXT,
  p_event_index   INTEGER
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE tokens SET owner = p_to WHERE token_id = p_token_id;
  INSERT INTO token_transfers (ledger, tx_hash, event_index, token_id, from_address, to_address, kind)
  VALUES (p_ledger, p_tx, p_event_index, p_token_id, p_from, p_to, 'transfer')
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION apply_burn(
  p_token_id      INTEGER,
  p_from          TEXT,
  p_ledger        BIGINT,
  p_tx            TEXT,
  p_event_index   INTEGER
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE tokens SET burned = TRUE WHERE token_id = p_token_id;
  INSERT INTO token_transfers (ledger, tx_hash, event_index, token_id, from_address, to_address, kind)
  VALUES (p_ledger, p_tx, p_event_index, p_token_id, p_from, NULL, 'burn')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── Marketplace ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION apply_listing_created(
  p_listing_id      BIGINT,
  p_nft_contract    TEXT,
  p_seller          TEXT,
  p_token_id        INTEGER,
  p_price           NUMERIC,
  p_currency        TEXT,
  p_kind            TEXT,
  p_editions_total  INTEGER,
  p_ends_at         BIGINT,
  p_referral_bps    INTEGER,
  p_primary_split   JSONB,
  p_ledger          BIGINT,
  p_tx              TEXT,
  p_event_index     INTEGER
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  INSERT INTO listings (
    listing_id, nft_contract, seller, token_id, price, currency, kind,
    editions_total, ends_at, referral_bps, primary_split,
    created_at_ledger, created_at_tx, created_event_index
  )
  VALUES (
    p_listing_id, p_nft_contract, p_seller, p_token_id, p_price, p_currency, p_kind,
    p_editions_total, p_ends_at, p_referral_bps, p_primary_split,
    p_ledger, p_tx, p_event_index
  )
  ON CONFLICT (listing_id) DO NOTHING;
$$;

-- CTE ties the listings UPDATE to the sales INSERT: if the INSERT no-ops (duplicate
-- event), inserted returns zero rows, the FROM join matches nothing, and
-- editions_sold is not double-incremented.
CREATE OR REPLACE FUNCTION apply_sold(
  p_ledger          BIGINT,
  p_tx              TEXT,
  p_event_index     INTEGER,
  p_listing_id      BIGINT,
  p_token_id        INTEGER,
  p_buyer           TEXT,
  p_seller          TEXT,
  p_price           NUMERIC,
  p_currency        TEXT,
  p_royalty_paid    NUMERIC,
  p_referral_paid   NUMERIC,
  p_fee_paid        NUMERIC
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  WITH inserted AS (
    INSERT INTO sales (
      ledger, tx_hash, event_index,
      listing_id, token_id, buyer, seller, price, currency,
      royalty_paid, referral_paid, fee_paid
    )
    VALUES (
      p_ledger, p_tx, p_event_index,
      p_listing_id, p_token_id, p_buyer, p_seller, p_price, p_currency,
      p_royalty_paid, p_referral_paid, p_fee_paid
    )
    ON CONFLICT DO NOTHING
    RETURNING listing_id
  )
  UPDATE listings l
     SET editions_sold = l.editions_sold + 1,
         status = CASE
           WHEN l.kind = 'fixed_price'              THEN 'sold'
           WHEN l.editions_sold + 1 >= l.editions_total THEN 'sold'
           ELSE l.status
         END
    FROM inserted i
   WHERE l.listing_id = i.listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION apply_listing_cancelled(
  p_listing_id  BIGINT
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE listings SET status = 'cancelled' WHERE listing_id = p_listing_id;
$$;

-- ── Cursor ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION advance_cursor(
  p_last_ledger BIGINT,
  p_last_cursor TEXT
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE indexer_cursor
     SET last_ledger = p_last_ledger,
         last_cursor = p_last_cursor,
         updated_at  = now()
   WHERE id = 1;
$$;

-- ── Access control ────────────────────────────────────────────────────────────

-- Postgres grants EXECUTE to PUBLIC by default; anon/authenticated inherit from PUBLIC.
-- Revoke from PUBLIC first, then explicitly from the two low-trust roles.
REVOKE EXECUTE ON FUNCTION apply_artist_registered  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION apply_artist_revoked     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION apply_minted_event       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION apply_transfer           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION apply_burn               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION apply_listing_created    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION apply_sold               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION apply_listing_cancelled  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION advance_cursor           FROM PUBLIC, anon, authenticated;
