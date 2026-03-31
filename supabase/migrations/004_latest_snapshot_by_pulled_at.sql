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
