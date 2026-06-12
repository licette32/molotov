-- Row-level security for all 6 tables.
--
-- Policy matrix (see indexer-spec.md §5):
--   - anon/authenticated: SELECT on the 5 projection tables; nothing on indexer_cursor.
--   - service_role: bypasses RLS natively — no explicit policy needed.
--   - No role has INSERT/UPDATE/DELETE access via the PostgREST API (only the
--     indexer functions, which use SECURITY DEFINER, can write).

ALTER TABLE artists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens           ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transfers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexer_cursor   ENABLE ROW LEVEL SECURITY;

-- Projection tables: public read, no writes via PostgREST.
CREATE POLICY "public_read" ON artists         FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read" ON tokens          FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read" ON listings        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read" ON sales           FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read" ON token_transfers FOR SELECT TO anon, authenticated USING (true);

-- indexer_cursor: no policy → zero access for anon and authenticated.
-- service_role bypasses RLS and can still read/write.

-- In Supabase these grants come from the platform's PostgREST setup.
-- In plain Postgres (CI / local without Docker) they must be explicit.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON artists, tokens, listings, sales, token_transfers TO anon, authenticated;
-- Allow SELECT on indexer_cursor too; RLS (no policy) ensures zero rows for anon.
-- This lets the test assert COUNT=0 rather than catching a permission error.
GRANT SELECT ON indexer_cursor TO anon, authenticated;
GRANT SELECT ON token_effective_owner TO anon, authenticated;
