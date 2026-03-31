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
