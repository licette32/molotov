-- Test-only helper: truncates all projection tables and resets the cursor.
-- Called via supabase.rpc('reset_projection') in the test harness.
-- SECURITY DEFINER so it can truncate regardless of RLS; REVOKE from anon so
-- only the service_role (test runner) can call it.
CREATE OR REPLACE FUNCTION reset_projection()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE TABLE sales, token_transfers, listings, tokens, artists RESTART IDENTITY CASCADE;
  UPDATE indexer_cursor SET last_ledger = 0, last_cursor = NULL, updated_at = now() WHERE id = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION reset_projection() FROM anon, authenticated;
