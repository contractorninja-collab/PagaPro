-- Fix "permission denied for table ..." when schema was created as superuser but app uses ROLE pagapro.
-- Usage (native Windows Postgres example):
--   set PGPASSWORD=<postgres_superuser_password>
--   psql -h 127.0.0.1 -p 5432 -U postgres -d pagapro -v ON_ERROR_STOP=1 -f scripts/grant_app_role_pagapro.sql

GRANT CONNECT ON DATABASE pagapro TO pagapro;

\c pagapro

GRANT ALL ON SCHEMA public TO pagapro;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pagapro;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pagapro;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO pagapro;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pagapro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pagapro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO pagapro;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, t.typname AS name
    FROM pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  LOOP
    EXECUTE format('ALTER TYPE %I.%I OWNER TO pagapro', r.schema, r.name);
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO pagapro', r.tablename);
  END LOOP;

  FOR r IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO pagapro', r.sequence_name);
  END LOOP;
END $$;
