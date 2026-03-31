# DATABASE.md — Supabase Patterns

## Supabase Client — Which to Use

| Context | Client | Key |
|---|---|---|
| Server Component | `createServerClient()` | anon (via cookie session) |
| API Route (Next.js) | `createServerClient()` | anon (via cookie session) |
| Client Component | `createBrowserClient()` | anon public |
| Trigger.dev Job | `createClient(url, SERVICE_ROLE_KEY)` | service role — bypasses RLS |

```typescript
// /lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )
}

// /lib/supabase/job.ts (for Trigger.dev only)
import { createClient } from '@supabase/supabase-js'
export const jobSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

---

## Multi-tenant Rule — Always Filter by organization_id

```typescript
// CORRECT — explicit org filter
const { data } = await supabase
  .from('tracked_keywords')
  .select('*, projects(domain)')
  .eq('organization_id', orgId)
  .eq('is_active', true)

// WRONG — even if RLS would cover it, never rely on it alone
const { data } = await supabase
  .from('tracked_keywords')
  .select('*')
```

---

## Full Schema Reference

```sql
-- Core multi-tenancy
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  plan            TEXT DEFAULT 'free',    -- free | starter | pro | agency
  stripe_customer_id TEXT,
  keyword_limit   INTEGER DEFAULT 50,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Projects (one per client domain)
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_name     TEXT NOT NULL,
  domain          TEXT NOT NULL,           -- e.g. "samitivej.co.th"
  gsc_property    TEXT,                    -- e.g. "sc-domain:samitivej.co.th"
  ga4_property_id TEXT,                    -- e.g. "properties/123456789"
  ahrefs_target   TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Keywords to track
CREATE TABLE tracked_keywords (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  keyword         TEXT NOT NULL,
  country_code    TEXT DEFAULT 'TH',
  language_code   TEXT DEFAULT 'th',
  device          TEXT DEFAULT 'desktop',  -- desktop | mobile
  tag             TEXT,                    -- "brand" | "competitor" | "service"
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Daily rank results (one row per keyword per day)
CREATE TABLE keyword_rankings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id            UUID REFERENCES tracked_keywords(id) ON DELETE CASCADE,
  checked_at            DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Traditional SERP
  organic_position      INTEGER,           -- NULL = not in top 100
  ranked_url            TEXT,
  position_change       INTEGER,           -- vs previous day (+/-)

  -- AI Overview
  aio_present           BOOLEAN DEFAULT FALSE,
  aio_cited             BOOLEAN DEFAULT FALSE,
  aio_citation_position INTEGER,           -- 0 = first citation in AIO
  aio_cited_url         TEXT,
  aio_cited_text        TEXT,              -- exact snippet Google quoted
  aio_element_title     TEXT,              -- which AIO section cited us

  UNIQUE(keyword_id, checked_at)
);

-- Report generation jobs
CREATE TABLE report_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  report_type     TEXT DEFAULT 'monthly',
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  status          TEXT DEFAULT 'pending',  -- pending|processing|done|failed
  pdf_url         TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- White-label config per project
CREATE TABLE white_label_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  agency_name     TEXT DEFAULT 'NerdOptimize',
  primary_color   TEXT DEFAULT '#4d62a7',
  logo_url        TEXT,
  report_footer   TEXT,
  custom_domain   TEXT
);

-- API usage tracking (for billing/limits)
CREATE TABLE usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  api             TEXT NOT NULL,           -- 'dataforseo' | 'claude' | 'gsc'
  units           INTEGER NOT NULL,        -- number of API calls / keywords checked
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_config ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (repeat for each table)
CREATE POLICY "org_isolation" ON projects
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid()
    )
  );
```

---

## Common Query Patterns

### Upsert Daily Rankings
```typescript
await supabase
  .from('keyword_rankings')
  .upsert(
    {
      keyword_id,
      checked_at: new Date().toISOString().split('T')[0],
      organic_position,
      ranked_url,
      position_change,
      aio_present,
      aio_cited,
      aio_citation_position,
      aio_cited_url,
      aio_cited_text,
    },
    { onConflict: 'keyword_id,checked_at' }
  )
```

### Get Keywords With Latest Ranking
```typescript
const { data } = await supabase
  .from('tracked_keywords')
  .select(`
    *,
    keyword_rankings (
      organic_position,
      position_change,
      aio_present,
      aio_cited,
      aio_citation_position,
      aio_cited_text,
      checked_at
    )
  `)
  .eq('project_id', projectId)
  .eq('is_active', true)
  .order('checked_at', { ascending: false, referencedTable: 'keyword_rankings' })
  .limit(1, { foreignTable: 'keyword_rankings' })
```

### Real-time Report Status Subscription
```typescript
// Subscribe in component, clean up on unmount
const channel = supabase
  .channel(`report-${jobId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'report_jobs',
      filter: `id=eq.${jobId}`,
    },
    (payload) => {
      const job = payload.new as ReportJob
      setStatus(job.status)
      if (job.status === 'done') setPdfUrl(job.pdf_url)
    }
  )
  .subscribe()

return () => supabase.removeChannel(channel)
```

### Log API Usage
```typescript
await supabase
  .from('usage_logs')
  .insert({
    organization_id: orgId,
    date: new Date().toISOString().split('T')[0],
    api: 'dataforseo',
    units: keywords.length,
  })
```
