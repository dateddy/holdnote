-- Keep `anon` locked out of anything created later (no trial mode, DEC-004).
-- Supabase grants anon/authenticated/service_role on every new public object by default; the
-- initial migration only revoked what existed then. This removes the default for anon, so a new
-- table never becomes reachable without a login, even if its RLS is forgotten.
-- `authenticated` keeps its defaults: each migration still grants it explicitly (db-migration).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
