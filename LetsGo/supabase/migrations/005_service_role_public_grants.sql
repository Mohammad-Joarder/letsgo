-- ============================================================================
-- service_role + public schema (fixes: permission denied for schema public)
-- Edge Functions use createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
-- PostgREST runs queries as role "service_role". Migration 002 only granted
-- anon/authenticated; without these grants, fare_config / RPC from Edge fails.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO service_role;
