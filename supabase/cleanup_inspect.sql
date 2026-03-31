-- Run in Supabase SQL Editor to inspect public tables.
-- This app expects ONLY these relations from repo migrations:
--   tables: clients, client_urls, snapshots, url_keyword_results
--   view:   clients_with_latest_snapshot
--
-- Review any extra tablename below; drop only what you know is unused.

select tablename
from pg_tables
where schemaname = 'public'
order by tablename;

-- Views in public schema:
select viewname
from pg_views
where schemaname = 'public'
order by viewname;

-- Example (DANGEROUS — edit name first):
-- drop table if exists public.some_old_table cascade;
