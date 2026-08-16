-- Grants the least-privilege application role (`arca_app`, used by DATABASE_URL) baseline
-- CRUD access on the public schema. Runs via DIRECT_URL (a superuser/schema-owner role) like
-- every other migration, but GRANT itself requires the target role to already exist in the
-- Postgres cluster (roles are cluster-wide, not created by migrations, and login credentials
-- must not be checked into version control). Provisioning `arca_app` with its own per-environment
-- password is an infra/ops step that must happen before this migration runs; if it hasn't,
-- this migration fails loudly with "role arca_app does not exist" instead of leaving the app
-- to fail silently later at query time.

GRANT USAGE ON SCHEMA public TO arca_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO arca_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO arca_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO arca_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO arca_app;