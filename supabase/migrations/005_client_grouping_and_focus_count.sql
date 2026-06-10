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
