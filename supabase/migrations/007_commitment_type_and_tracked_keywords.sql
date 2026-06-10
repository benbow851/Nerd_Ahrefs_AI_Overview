-- Commitment / measurement mode: ai_citations (default) vs legacy_main_longtail (70% rule)

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS commitment_type text NOT NULL DEFAULT 'ai_citations'
    CHECK (commitment_type IN ('ai_citations', 'legacy_main_longtail')),
  ADD COLUMN IF NOT EXISTS kpi_pass_threshold numeric(5,2) NOT NULL DEFAULT 70;

COMMENT ON COLUMN clients.commitment_type IS
  'ai_citations = current Ahrefs discovery model; legacy_main_longtail = tracked main+longtail with % pass threshold.';
COMMENT ON COLUMN clients.kpi_pass_threshold IS
  'Legacy mode only: cited tracked keywords must reach this % of total tracked (main+longtail).';

-- Tracked keywords for legacy commitment (user-defined, not Ahrefs discovery)
CREATE TABLE IF NOT EXISTS client_tracked_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  url_id uuid NOT NULL REFERENCES client_urls(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('main', 'longtail')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (url_id, keyword)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_main_keyword_per_url
  ON client_tracked_keywords (url_id)
  WHERE tier = 'main' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_tracked_keywords_client
  ON client_tracked_keywords (client_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tracked_keywords_url
  ON client_tracked_keywords (url_id, sort_order);

ALTER TABLE snapshots
  ADD COLUMN IF NOT EXISTS commitment_type text,
  ADD COLUMN IF NOT EXISTS kpi_pass_threshold numeric(5,2),
  ADD COLUMN IF NOT EXISTS total_tracked_keywords int;

ALTER TABLE url_keyword_results
  ADD COLUMN IF NOT EXISTS keyword_tier text CHECK (keyword_tier IN ('main', 'longtail'));

COMMENT ON COLUMN url_keyword_results.keyword_tier IS
  'Legacy mode: main or longtail tier for this tracked keyword row.';

-- RLS
ALTER TABLE client_tracked_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_tracked_keywords" ON client_tracked_keywords
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_tracked_keywords" ON client_tracked_keywords
  FOR ALL USING (auth.role() = 'authenticated');

-- Dashboard view with mode-aware KPI %
DROP VIEW IF EXISTS public.clients_with_latest_snapshot;

CREATE VIEW public.clients_with_latest_snapshot AS
SELECT
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
  c.commitment_type,
  c.kpi_pass_threshold,
  s.id AS snapshot_id,
  s.snapshot_date,
  s.total_urls,
  s.total_citations,
  s.total_tracked_keywords,
  CASE c.commitment_type
    WHEN 'legacy_main_longtail' THEN
      round(
        s.total_citations::numeric
          / nullif(s.total_tracked_keywords, 0) * 100,
        1
      )
    ELSE
      round(
        s.total_citations::numeric
          / nullif(c.kpi_keyword_target, 0) * 100,
        1
      )
  END AS kpi_pct
FROM clients c
LEFT JOIN LATERAL (
  SELECT * FROM snapshots
  WHERE client_id = c.id
  ORDER BY pulled_at DESC NULLS LAST, snapshot_date DESC
  LIMIT 1
) s ON true
WHERE c.is_active = true
ORDER BY kpi_pct DESC NULLS LAST;
