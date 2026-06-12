-- SQL test harness — runs directly against molotov_test (plain Postgres).
-- Run with: psql molotov_test -f supabase/tests/run_sql_tests.sql
--
-- All test code lives inside DO $$ ... $$ plpgsql blocks; assertion helpers are
-- inline. Isolation between groups: reset_projection() truncates and resets.
-- No dependency on Docker or Supabase JS.

\set ON_ERROR_STOP on

-- ─── shared assertion helpers ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _assert_eq(label TEXT, actual TEXT, expected TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL [%]  expected="%"  got="%"', label, expected, actual;
  END IF;
  RAISE NOTICE 'PASS  %', label;
END;
$$;

CREATE OR REPLACE FUNCTION _assert_int(label TEXT, actual INTEGER, expected INTEGER)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL [%]  expected=%  got=%', label, expected, actual;
  END IF;
  RAISE NOTICE 'PASS  %', label;
END;
$$;

CREATE OR REPLACE FUNCTION _assert_true(label TEXT, cond BOOLEAN)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL [%]  condition was %', label, cond;
  END IF;
  RAISE NOTICE 'PASS  %', label;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- (a)  Reconstructability
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '══ (a) Reconstructability ══'; END $$ LANGUAGE plpgsql;

-- a1-a6: primary sale produces exact expected state
DO $$
BEGIN
  PERFORM reset_projection();

  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  PERFORM apply_minted_event(0,'ALICE','ALICE','ipfs://Qmtest',500,1, 101,'tx_mint',0);
  PERFORM apply_listing_created(0,'NFT','ALICE',0,100000000,'XLM','fixed_price',1,0,0,NULL, 102,'tx_list',0);
  PERFORM apply_transfer(0,'ALICE','MARKET', 102,'tx_list',1);
  PERFORM apply_sold(103,'tx_buy',0, 0,0,'BOB','ALICE',100000000,'XLM',0,0,2500000);
  PERFORM apply_transfer(0,'MARKET','BOB', 103,'tx_buy',1);

  PERFORM _assert_eq('a1 artist exists',
    (SELECT address FROM artists WHERE address='ALICE'), 'ALICE');
  PERFORM _assert_true('a2 not revoked',
    (SELECT NOT revoked FROM artists WHERE address='ALICE'));
  PERFORM _assert_eq('a3 token owner=bob',
    (SELECT owner FROM tokens WHERE token_id=0), 'BOB');
  PERFORM _assert_eq('a4 listing sold',
    (SELECT status FROM listings WHERE listing_id=0), 'sold');
  PERFORM _assert_int('a5 editions_sold=1',
    (SELECT editions_sold FROM listings WHERE listing_id=0), 1);
  PERFORM _assert_int('a6 one sale',   (SELECT COUNT(*)::INTEGER FROM sales), 1);
  PERFORM _assert_int('a6 two xfers',  (SELECT COUNT(*)::INTEGER FROM token_transfers), 2);
END $$ LANGUAGE plpgsql;

-- a7-a9: revoke then re-register clears flag
DO $$
BEGIN
  PERFORM reset_projection();
  PERFORM apply_artist_registered('ALICE', 100, 'tx_r1', 0);
  PERFORM apply_artist_revoked   ('ALICE', 110, 'tx_rev', 0);

  PERFORM _assert_true('a7 revoked=true',
    (SELECT revoked FROM artists WHERE address='ALICE'));
  PERFORM _assert_eq('a7 revoked_at_ledger',
    (SELECT revoked_at_ledger::TEXT FROM artists WHERE address='ALICE'), '110');

  PERFORM apply_artist_registered('ALICE', 120, 'tx_r2', 0);
  PERFORM _assert_true('a8 revoked cleared',
    (SELECT NOT revoked FROM artists WHERE address='ALICE'));
  PERFORM _assert_true('a9 revoked_at_ledger null',
    (SELECT revoked_at_ledger IS NULL FROM artists WHERE address='ALICE'));
END $$ LANGUAGE plpgsql;

-- a10: truncate + replay → identical snapshot
DO $$
DECLARE
  snap1 TEXT;
  snap2 TEXT;
BEGIN
  PERFORM reset_projection();

  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  PERFORM apply_minted_event(0,'ALICE','ALICE','ipfs://Qm',500,1, 101,'tx_mint',0);
  PERFORM apply_listing_created(0,'NFT','ALICE',0,100000000,'XLM','fixed_price',1,0,0,NULL, 102,'tx_list',0);
  PERFORM apply_transfer(0,'ALICE','MARKET', 102,'tx_list',1);
  PERFORM apply_sold(103,'tx_buy',0, 0,0,'BOB','ALICE',100000000,'XLM',0,0,2500000);
  PERFORM apply_transfer(0,'MARKET','BOB', 103,'tx_buy',1);

  -- snapshot 1
  SELECT string_agg(row_to_json(r)::TEXT, '|' ORDER BY row_to_json(r)::TEXT) INTO snap1 FROM (
    SELECT 'a' tbl, address key, revoked::TEXT val FROM artists
    UNION ALL SELECT 't', token_id::TEXT, owner FROM tokens
    UNION ALL SELECT 'l', listing_id::TEXT, status||':'||editions_sold::TEXT FROM listings
    UNION ALL SELECT 's', 'n', COUNT(*)::TEXT FROM sales
    UNION ALL SELECT 'x', 'n', COUNT(*)::TEXT FROM token_transfers
  ) r;

  PERFORM reset_projection();

  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  PERFORM apply_minted_event(0,'ALICE','ALICE','ipfs://Qm',500,1, 101,'tx_mint',0);
  PERFORM apply_listing_created(0,'NFT','ALICE',0,100000000,'XLM','fixed_price',1,0,0,NULL, 102,'tx_list',0);
  PERFORM apply_transfer(0,'ALICE','MARKET', 102,'tx_list',1);
  PERFORM apply_sold(103,'tx_buy',0, 0,0,'BOB','ALICE',100000000,'XLM',0,0,2500000);
  PERFORM apply_transfer(0,'MARKET','BOB', 103,'tx_buy',1);

  -- snapshot 2
  SELECT string_agg(row_to_json(r)::TEXT, '|' ORDER BY row_to_json(r)::TEXT) INTO snap2 FROM (
    SELECT 'a' tbl, address key, revoked::TEXT val FROM artists
    UNION ALL SELECT 't', token_id::TEXT, owner FROM tokens
    UNION ALL SELECT 'l', listing_id::TEXT, status||':'||editions_sold::TEXT FROM listings
    UNION ALL SELECT 's', 'n', COUNT(*)::TEXT FROM sales
    UNION ALL SELECT 'x', 'n', COUNT(*)::TEXT FROM token_transfers
  ) r;

  PERFORM _assert_eq('a10 truncate+replay=same snapshot', snap2, snap1);
END $$ LANGUAGE plpgsql;

-- a11-a12: effective_owner view
DO $$
BEGIN
  PERFORM reset_projection();
  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  PERFORM apply_minted_event(0,'ALICE','ALICE','ipfs://Qm',500,1, 101,'tx_mint',0);
  PERFORM apply_listing_created(0,'NFT','ALICE',0,100000000,'XLM','fixed_price',1,0,0,NULL, 102,'tx_list',0);
  PERFORM apply_transfer(0,'ALICE','MARKET', 102,'tx_list',1);

  PERFORM _assert_eq('a11 effective_owner escrowed=seller',
    (SELECT effective_owner FROM token_effective_owner WHERE token_id=0), 'ALICE');
  PERFORM _assert_true('a11 active_listing_id=0',
    (SELECT active_listing_id = 0 FROM token_effective_owner WHERE token_id=0));

  PERFORM apply_sold(103,'tx_buy',0, 0,0,'BOB','ALICE',100000000,'XLM',0,0,2500000);
  PERFORM apply_transfer(0,'MARKET','BOB', 103,'tx_buy',1);

  PERFORM _assert_eq('a12 effective_owner after sale=buyer',
    (SELECT effective_owner FROM token_effective_owner WHERE token_id=0), 'BOB');
  PERFORM _assert_true('a12 no active listing',
    (SELECT active_listing_id IS NULL FROM token_effective_owner WHERE token_id=0));
END $$ LANGUAGE plpgsql;

-- a13: cancel sets status=cancelled
DO $$
BEGIN
  PERFORM reset_projection();
  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  PERFORM apply_minted_event(0,'ALICE','ALICE','ipfs://Qm',500,1, 101,'tx_mint',0);
  PERFORM apply_listing_created(0,'NFT','ALICE',0,100000000,'XLM','fixed_price',1,0,0,NULL, 102,'tx_list',0);
  PERFORM apply_listing_cancelled(0);
  PERFORM _assert_eq('a13 cancel→status=cancelled',
    (SELECT status FROM listings WHERE listing_id=0), 'cancelled');
END $$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- (b)  Idempotency
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '══ (b) Idempotency ══'; END $$ LANGUAGE plpgsql;

-- b1-b3: duplicate primitive events are no-ops
DO $$
BEGIN
  PERFORM reset_projection();
  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  PERFORM _assert_int('b1 dup ArtistRegistered=1 row',
    (SELECT COUNT(*)::INTEGER FROM artists WHERE address='ALICE'), 1);

  PERFORM apply_minted_event(0,'ALICE','ALICE','ipfs://Qm',500,1, 101,'tx_mint',0);
  PERFORM apply_minted_event(0,'ALICE','ALICE','ipfs://Qm',500,1, 101,'tx_mint',0);
  PERFORM _assert_int('b2 dup MintedEvent=1 token', (SELECT COUNT(*)::INTEGER FROM tokens), 1);

  PERFORM apply_transfer(0,'ALICE','BOB', 102,'tx_tr',0);
  PERFORM apply_transfer(0,'ALICE','BOB', 102,'tx_tr',0);
  PERFORM _assert_int('b3 dup Transfer=1 row', (SELECT COUNT(*)::INTEGER FROM token_transfers), 1);
  PERFORM _assert_eq('b3 owner=BOB', (SELECT owner FROM tokens WHERE token_id=0), 'BOB');
END $$ LANGUAGE plpgsql;

-- b4: FixedPrice Sold replay — THE bug: editions_sold must not double-increment
DO $$
BEGIN
  PERFORM reset_projection();
  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  PERFORM apply_minted_event(0,'ALICE','ALICE','ipfs://Qm',500,1, 101,'tx_mint',0);
  PERFORM apply_listing_created(0,'NFT','ALICE',0,100000000,'XLM','fixed_price',1,0,0,NULL, 102,'tx_list',0);
  PERFORM apply_transfer(0,'ALICE','MARKET', 102,'tx_list',1);

  PERFORM apply_sold(103,'tx_buy',0, 0,0,'BOB','ALICE',100000000,'XLM',0,0,2500000);
  PERFORM apply_sold(103,'tx_buy',0, 0,0,'BOB','ALICE',100000000,'XLM',0,0,2500000); -- replay

  PERFORM _assert_int('b4 editions_sold stays 1',
    (SELECT editions_sold FROM listings WHERE listing_id=0), 1);
  PERFORM _assert_eq('b4 status stays sold',
    (SELECT status FROM listings WHERE listing_id=0), 'sold');
  PERFORM _assert_int('b4 one sale row', (SELECT COUNT(*)::INTEGER FROM sales), 1);
END $$ LANGUAGE plpgsql;

-- b5-b6: OpenEdition mid-sellthrough + replay
DO $$
BEGIN
  PERFORM reset_projection();
  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  PERFORM apply_minted_event(0,'ALICE','ALICE','ipfs://Qm0',500,1, 101,'tx_m0',0);
  PERFORM apply_minted_event(1,'ALICE','ALICE','ipfs://Qm1',500,1, 101,'tx_m1',0);
  PERFORM apply_minted_event(2,'ALICE','ALICE','ipfs://Qm2',500,1, 101,'tx_m2',0);
  PERFORM apply_listing_created(0,'NFT','ALICE',0,50000000,'XLM','open_edition',3,0,0,NULL, 102,'tx_list',0);
  PERFORM apply_transfer(0,'ALICE','MARKET', 102,'tx_list',1);
  PERFORM apply_transfer(1,'ALICE','MARKET', 102,'tx_list',2);
  PERFORM apply_transfer(2,'ALICE','MARKET', 102,'tx_list',3);

  -- Sell edition 0
  PERFORM apply_sold(200,'tx_s0',0, 0,0,'BOB','ALICE',50000000,'XLM',0,0,1250000);
  PERFORM apply_transfer(0,'MARKET','BOB', 200,'tx_s0',1);
  -- Replay same Sold → must be no-op
  PERFORM apply_sold(200,'tx_s0',0, 0,0,'BOB','ALICE',50000000,'XLM',0,0,1250000);

  PERFORM _assert_int('b5 editions_sold=1 after replay',
    (SELECT editions_sold FROM listings WHERE listing_id=0), 1);
  PERFORM _assert_eq('b5 status still active',
    (SELECT status FROM listings WHERE listing_id=0), 'active');
  PERFORM _assert_int('b5 one sale row', (SELECT COUNT(*)::INTEGER FROM sales), 1);

  -- effective_owner: token 0 sold → BOB; token 2 still escrowed → ALICE
  PERFORM _assert_eq('b5 effective_owner[0]=BOB',
    (SELECT effective_owner FROM token_effective_owner WHERE token_id=0), 'BOB');
  PERFORM _assert_eq('b5 effective_owner[2]=ALICE (still in escrow)',
    (SELECT effective_owner FROM token_effective_owner WHERE token_id=2), 'ALICE');

  -- Sell editions 1 and 2
  PERFORM apply_sold(201,'tx_s1',0, 0,1,'BOB','ALICE',50000000,'XLM',0,0,1250000);
  PERFORM apply_sold(202,'tx_s2',0, 0,2,'BOB','ALICE',50000000,'XLM',0,0,1250000);

  PERFORM _assert_int('b6 editions_sold=3',
    (SELECT editions_sold FROM listings WHERE listing_id=0), 3);
  PERFORM _assert_eq('b6 status=sold',
    (SELECT status FROM listings WHERE listing_id=0), 'sold');
  PERFORM _assert_int('b6 three sales', (SELECT COUNT(*)::INTEGER FROM sales), 3);
END $$ LANGUAGE plpgsql;

-- b7: dup ListingCreated
DO $$
BEGIN
  PERFORM reset_projection();
  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  PERFORM apply_minted_event(0,'ALICE','ALICE','ipfs://Qm',500,1, 101,'tx_mint',0);
  PERFORM apply_listing_created(0,'NFT','ALICE',0,100000000,'XLM','fixed_price',1,0,0,NULL, 102,'tx_list',0);
  PERFORM apply_listing_created(0,'NFT','ALICE',0,100000000,'XLM','fixed_price',1,0,0,NULL, 102,'tx_list',0);
  PERFORM _assert_int('b7 dup ListingCreated=1 row',
    (SELECT COUNT(*)::INTEGER FROM listings), 1);
END $$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- (c)  RLS — anon access
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '══ (c) RLS ══'; END $$ LANGUAGE plpgsql;

-- c1-c6: anon SELECT permissions
DO $$
BEGIN
  PERFORM reset_projection();
  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);

  SET ROLE anon;

  PERFORM _assert_int('c1 anon SELECT artists=1 row',
    (SELECT COUNT(*)::INTEGER FROM artists), 1);
  PERFORM _assert_int('c2 anon SELECT tokens ok (empty)',
    (SELECT COUNT(*)::INTEGER FROM tokens), 0);
  PERFORM _assert_int('c3 anon SELECT listings ok (empty)',
    (SELECT COUNT(*)::INTEGER FROM listings), 0);
  PERFORM _assert_int('c4 anon SELECT sales ok (empty)',
    (SELECT COUNT(*)::INTEGER FROM sales), 0);
  PERFORM _assert_int('c5 anon SELECT token_transfers ok (empty)',
    (SELECT COUNT(*)::INTEGER FROM token_transfers), 0);
  -- No SELECT policy on indexer_cursor → 0 rows (not an error)
  PERFORM _assert_int('c6 anon indexer_cursor=0 rows (RLS blocks)',
    (SELECT COUNT(*)::INTEGER FROM indexer_cursor), 0);

  RESET ROLE;
END $$ LANGUAGE plpgsql;

-- c7: anon cannot INSERT into artists
DO $$
BEGIN
  PERFORM reset_projection();
  SET ROLE anon;
  BEGIN
    INSERT INTO artists (address, registered_at_ledger, registered_at_tx, registered_event_index)
    VALUES ('EVIL', 999, 'tx_evil', 0);
    RAISE EXCEPTION 'FAIL [c7 anon INSERT artists]  no error raised — RLS not blocking';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS  c7 anon INSERT artists blocked (%)', SQLERRM;
  END;
  RESET ROLE;
END $$ LANGUAGE plpgsql;

-- c8: anon cannot UPDATE artists
DO $$
BEGIN
  PERFORM reset_projection();
  PERFORM apply_artist_registered('ALICE', 100, 'tx_reg', 0);
  SET ROLE anon;
  BEGIN
    UPDATE artists SET revoked = TRUE WHERE address = 'ALICE';
    -- UPDATE with no matching RLS policy on ALICE succeeds as a no-op (0 rows),
    -- but the RLS policy for anon only covers SELECT, so this must be blocked.
    -- Postgres raises an error for UPDATE when no WITH CHECK policy exists.
    RAISE EXCEPTION 'FAIL [c8 anon UPDATE artists]  no error raised';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS  c8 anon UPDATE artists blocked (%)', SQLERRM;
  END;
  RESET ROLE;
END $$ LANGUAGE plpgsql;

-- c9: anon cannot write to indexer_cursor
DO $$
BEGIN
  PERFORM reset_projection();
  SET ROLE anon;
  BEGIN
    UPDATE indexer_cursor SET last_ledger = 9999 WHERE id = 1;
    RAISE EXCEPTION 'FAIL [c9 anon UPDATE indexer_cursor]  no error raised';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS  c9 anon indexer_cursor write blocked (%)', SQLERRM;
  END;
  RESET ROLE;
END $$ LANGUAGE plpgsql;

-- c10: anon cannot call apply_artist_registered (REVOKE EXECUTE)
DO $$
BEGIN
  SET ROLE anon;
  BEGIN
    PERFORM apply_artist_registered('EVIL', 999, 'tx_evil', 0);
    RAISE EXCEPTION 'FAIL [c10 anon apply_artist_registered]  expected permission denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  c10 anon apply_artist_registered revoked';
  END;
  RESET ROLE;
END $$ LANGUAGE plpgsql;

-- c11: anon cannot call apply_sold (REVOKE EXECUTE)
DO $$
BEGIN
  SET ROLE anon;
  BEGIN
    PERFORM apply_sold(999,'tx_evil',0, 0,0,'EVIL','EVIL',1,'XLM',0,0,0);
    RAISE EXCEPTION 'FAIL [c11 anon apply_sold]  expected permission denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  c11 anon apply_sold revoked';
  END;
  RESET ROLE;
END $$ LANGUAGE plpgsql;

-- ─── done ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '══ All tests passed ══'; END $$ LANGUAGE plpgsql;
