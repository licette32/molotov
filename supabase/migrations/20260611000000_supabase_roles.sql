-- Creates the Supabase-managed roles if they don't already exist.
-- In a real Supabase project these roles are pre-created; this migration is a
-- no-op there. In a plain Postgres test database (CI, local dev without Docker)
-- it sets them up so RLS policies and REVOKE EXECUTE statements work.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END
$$;
