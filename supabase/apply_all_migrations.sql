-- ============================================================
-- AI Overview Citation Tracker — NerdOptimize
-- Migration: 001_init.sql
-- ============================================================

-- CLIENTS
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null,
  slug text unique not null,
  keywords_per_url int not null default 5,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CLIENT URLS
create table if not exists client_urls (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  url text not null,
  label text,
  target_keywords int not null default 5,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  unique(client_id, url)
);

-- MONTHLY SNAPSHOTS
create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  snapshot_date date not null,
  pulled_at timestamptz default now(),
  ahrefs_country text default 'TH',
  total_urls int,
  total_citations int,
  total_serp_ai_overlap int,
  kpi_target int,
  notes text,
  unique(client_id, snapshot_date)
);

-- URL-LEVEL KEYWORD RESULTS
create table if not exists url_keyword_results (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references snapshots(id) on delete cascade,
  url_id uuid references client_urls(id) on delete cascade,
  keyword text not null,
  best_position int,
  volume int,
  best_position_kind text,
  serp_features text[],
  is_ai_cited boolean generated always as (best_position_kind = 'ai_overview') stored,
  created_at timestamptz default now()
);

-- INDEXES
create index if not exists idx_snapshots_client_date on snapshots(client_id, snapshot_date desc);
create index if not exists idx_ukr_snapshot on url_keyword_results(snapshot_id);
create index if not exists idx_ukr_url on url_keyword_results(url_id);
create index if not exists idx_ukr_cited on url_keyword_results(is_ai_cited) where is_ai_cited = true;
create index if not exists idx_clients_slug on clients(slug);
create index if not exists idx_client_urls_client on client_urls(client_id, sort_order);

-- AUTO-UPDATE updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at
  before update on clients
  for each row execute procedure set_updated_at();

-- RLS
alter table clients enable row level security;
alter table client_urls enable row level security;
alter table snapshots enable row level security;
alter table url_keyword_results enable row level security;

-- Authenticated users can read all (NerdOptimize internal tool)
create policy "auth_read_clients" on clients
  for select using (auth.role() = 'authenticated');

create policy "auth_write_clients" on clients
  for all using (auth.role() = 'authenticated');

create policy "auth_read_client_urls" on client_urls
  for select using (auth.role() = 'authenticated');

create policy "auth_write_client_urls" on client_urls
  for all using (auth.role() = 'authenticated');

create policy "auth_read_snapshots" on snapshots
  for select using (auth.role() = 'authenticated');

create policy "auth_write_snapshots" on snapshots
  for all using (auth.role() = 'authenticated');

create policy "auth_read_url_keyword_results" on url_keyword_results
  for select using (auth.role() = 'authenticated');

create policy "auth_write_url_keyword_results" on url_keyword_results
  for all using (auth.role() = 'authenticated');

-- ============================================================
-- View: clients_with_latest_snapshot
-- ============================================================
create or replace view clients_with_latest_snapshot as
select
  c.id,
  c.name,
  c.slug,
  c.domain,
  c.keywords_per_url,
  c.is_active,
  c.created_at,
  s.id as snapshot_id,
  s.snapshot_date,
  s.total_urls,
  s.total_citations,
  s.kpi_target,
  round(s.total_citations::numeric / nullif(s.kpi_target, 0) * 100, 1) as kpi_pct
from clients c
left join lateral (
  select * from snapshots
  where client_id = c.id
  order by snapshot_date desc
  limit 1
) s on true
where c.is_active = true
order by kpi_pct desc nulls last;
-- Add Ahrefs organic traffic estimate per keyword row (optional display / analysis)

alter table url_keyword_results
  add column if not exists sum_traffic int;

comment on column url_keyword_results.sum_traffic is
  'Ahrefs sum_traffic: estimated monthly organic visits from this keyword (volume_mode affects volume/traffic).';
-- Separate project KPI from per-URL Ahrefs fetch limit (API row cap)

alter table clients rename column keywords_per_url to kpi_keyword_target;

alter table client_urls rename column target_keywords to ahrefs_fetch_limit;

comment on column clients.kpi_keyword_target is
  'Dashboard KPI: target count (AI-overview keywords / citations) for this project.';

comment on column client_urls.ahrefs_fetch_limit is
  'Max rows to request from Ahrefs organic-keywords API for this URL (1–1000).';

alter table clients alter column kpi_keyword_target set default 30;
alter table client_urls alter column ahrefs_fetch_limit set default 30;

-- Dashboard: use live project KPI for % (citations come from latest snapshot)
-- DROP required: REPLACing would remove columns (e.g. old kpi_target); Postgres forbids that.
drop view if exists public.clients_with_latest_snapshot;

create view public.clients_with_latest_snapshot as
select
  c.id,
  c.name,
  c.slug,
  c.domain,
  c.kpi_keyword_target,
  c.is_active,
  c.created_at,
  s.id as snapshot_id,
  s.snapshot_date,
  s.total_urls,
  s.total_citations,
  round(
    s.total_citations::numeric / nullif(c.kpi_keyword_target, 0) * 100,
    1
  ) as kpi_pct
from clients c
left join lateral (
  select * from snapshots
  where client_id = c.id
  order by snapshot_date desc
  limit 1
) s on true
where c.is_active = true
order by kpi_pct desc nulls last;
-- Dashboard list: "latest" snapshot = most recently pulled (not max Ahrefs date only)

drop view if exists public.clients_with_latest_snapshot;

create view public.clients_with_latest_snapshot as
select
  c.id,
  c.name,
  c.slug,
  c.domain,
  c.kpi_keyword_target,
  c.is_active,
  c.created_at,
  s.id as snapshot_id,
  s.snapshot_date,
  s.total_urls,
  s.total_citations,
  round(
    s.total_citations::numeric / nullif(c.kpi_keyword_target, 0) * 100,
    1
  ) as kpi_pct
from clients c
left join lateral (
  select * from snapshots
  where client_id = c.id
  order by pulled_at desc nulls last, snapshot_date desc
  limit 1
) s on true
where c.is_active = true
order by kpi_pct desc nulls last;
-- Project grouping (tags + folder) and focus URL target count
-- Lets the team group projects/clients (folder + tags) like SE Ranking,
-- and tracks how many URLs the project plans to publish so the dashboard
-- can render published / focus_url_count progress.

alter table clients
  add column if not exists tags text[] not null default '{}',
  add column if not exists folder text,
  add column if not exists focus_url_count int not null default 0;

comment on column clients.tags is
  'Free-form tags for grouping projects (multi-select).';
comment on column clients.folder is
  'Optional folder/group label (single value, like SE Ranking groups).';
comment on column clients.focus_url_count is
  'Planned/target number of focus URLs for this project. Used as the denominator on the dashboard "URLs Published" badge.';

create index if not exists idx_clients_folder on clients(folder);
create index if not exists idx_clients_tags on clients using gin(tags);

-- Refresh the dashboard view so the new fields are available.
drop view if exists public.clients_with_latest_snapshot;

create view public.clients_with_latest_snapshot as
select
  c.id,
  c.name,
  c.slug,
  c.domain,
  c.kpi_keyword_target,
  c.is_active,
  c.created_at,
  c.tags,
  c.folder,
  c.focus_url_count,
  s.id as snapshot_id,
  s.snapshot_date,
  s.total_urls,
  s.total_citations,
  round(
    s.total_citations::numeric / nullif(c.kpi_keyword_target, 0) * 100,
    1
  ) as kpi_pct
from clients c
left join lateral (
  select * from snapshots
  where client_id = c.id
  order by pulled_at desc nulls last, snapshot_date desc
  limit 1
) s on true
where c.is_active = true
order by kpi_pct desc nulls last;
-- Track the most recent Ahrefs pull per URL — even when the fetch returned
-- zero keywords. Lets the dashboard treat a URL as "Published" once it has
-- been attempted at least once, regardless of whether AI Overview keywords
-- were found.

alter table client_urls
  add column if not exists last_fetched_at timestamptz;

comment on column client_urls.last_fetched_at is
  'Timestamp of the most recent Ahrefs Pull for this URL. Set whether the response had keywords or was empty.';

create index if not exists idx_client_urls_last_fetched_at
  on client_urls(client_id, last_fetched_at);
