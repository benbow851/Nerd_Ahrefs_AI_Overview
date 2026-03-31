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
