# JOBS.md — Trigger.dev v3 Background Job Patterns

## Key Rules
- All job files live in `/trigger/` — Trigger.dev CLI auto-scans this folder
- Job IDs are permanent identifiers — never rename after first deploy
- Jobs use `SERVICE_ROLE_KEY` for Supabase (bypasses RLS — intentional)
- Always update `status` in DB so Supabase Realtime can push updates to UI
- Long-running jobs (PDF, full reports) need `machine: { preset: "small-1x" }`

---

## Job File Template

```typescript
// /trigger/example-job.ts
import { task } from '@trigger.dev/sdk/v3'
import { createClient } from '@supabase/supabase-js'

// Jobs use service role — bypasses RLS (correct for background work)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const exampleJob = task({
  id: 'example-job',            // snake-case, permanent — never change
  
  retry: {
    maxAttempts: 3,
    factor: 2,                  // exponential backoff
    minTimeoutInMs: 2000,
  },

  run: async (payload: { projectId: string }) => {
    const { projectId } = payload
    // job logic here
  },
})
```

---

## Job 1: Daily Rank Check (per project)

```typescript
// /trigger/rank-check.ts
import { task } from '@trigger.dev/sdk/v3'
import { batchRankCheck, processRankResults } from '@/lib/dataforseo'
import { logUsage } from '@/lib/usage'
import { checkDropAlerts } from '@/lib/alerts'
import { jobSupabase } from '@/lib/supabase/job'

export const dailyRankCheck = task({
  id: 'daily-rank-check',
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 3000 },

  run: async (payload: { projectId: string }) => {
    const { projectId } = payload

    // 1. Get project + active keywords
    const { data: project } = await jobSupabase
      .from('projects')
      .select('*, organization_id, domain')
      .eq('id', projectId)
      .single()

    if (!project) throw new Error(`Project not found: ${projectId}`)

    const { data: keywords } = await jobSupabase
      .from('tracked_keywords')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)

    if (!keywords?.length) return { skipped: true, reason: 'no active keywords' }

    // 2. Call DataForSEO in batches of 100
    const tasks = await batchRankCheck(keywords)

    // 3. Parse organic position + AIO citations
    const rows = await processRankResults(tasks, keywords, project.domain)

    // 4. Upsert to Supabase
    await jobSupabase
      .from('keyword_rankings')
      .upsert(rows, { onConflict: 'keyword_id,checked_at' })

    // 5. Log usage for billing
    await logUsage(project.organization_id, 'dataforseo', keywords.length)

    // 6. Alert on significant drops (> 5 positions)
    await checkDropAlerts(projectId, rows)

    return {
      projectId,
      keywordsChecked: keywords.length,
      aioPresent: rows.filter(r => r.aio_present).length,
      aioCited: rows.filter(r => r.aio_cited).length,
    }
  },
})
```

---

## Job 2: Report Generation (full pipeline)

```typescript
// /trigger/report-gen.ts
import { task } from '@trigger.dev/sdk/v3'
import { jobSupabase } from '@/lib/supabase/job'

export const generateReport = task({
  id: 'generate-report',
  machine: { preset: 'small-1x' },    // Needed for Puppeteer (long-running)
  retry: { maxAttempts: 2, factor: 2, minTimeoutInMs: 5000 },

  run: async (payload: { reportJobId: string }) => {
    const { reportJobId } = payload

    // Mark as processing (Realtime pushes this to UI instantly)
    await jobSupabase
      .from('report_jobs')
      .update({ status: 'processing' })
      .eq('id', reportJobId)

    try {
      // 1. Get report job + project details
      const { data: job } = await jobSupabase
        .from('report_jobs')
        .select('*, projects(*, white_label_config(*))')
        .eq('id', reportJobId)
        .single()

      // 2. Fetch all data in parallel
      const [rankings, gscData, ga4Data, ahrefsData] = await Promise.all([
        fetchRankingSummary(job.project_id, job.date_from, job.date_to),
        fetchGSCData(job.projects.gsc_property, job.date_from, job.date_to),
        fetchGA4Data(job.projects.ga4_property_id, job.date_from, job.date_to),
        fetchAhrefsData(job.projects.domain),
      ])

      // 3. Generate AI executive summary (Claude API)
      const summary = await generateAISummary({
        rankings, gscData, ga4Data,
        projectName: job.projects.client_name,
        dateFrom: job.date_from,
        dateTo: job.date_to,
      })

      // 4. Store assembled data for the print page
      await jobSupabase
        .from('report_jobs')
        .update({ report_data: { rankings, gscData, ga4Data, ahrefsData, summary } })
        .eq('id', reportJobId)

      // 5. Generate PDF via Puppeteer
      const pdfRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/generate-pdf`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportJobId }),
        }
      )
      const { pdfUrl } = await pdfRes.json()

      // 6. Mark done — Realtime updates UI with download link
      await jobSupabase
        .from('report_jobs')
        .update({ status: 'done', pdf_url: pdfUrl, completed_at: new Date().toISOString() })
        .eq('id', reportJobId)

      return { success: true, pdfUrl }

    } catch (error) {
      await jobSupabase
        .from('report_jobs')
        .update({ status: 'failed', error_message: String(error) })
        .eq('id', reportJobId)
      throw error   // re-throw so Trigger.dev retries
    }
  },
})
```

---

## Job 3: Daily Cron (fan-out to all projects)

```typescript
// /trigger/cron.ts
import { schedules } from '@trigger.dev/sdk/v3'
import { dailyRankCheck } from './rank-check'
import { jobSupabase } from '@/lib/supabase/job'

export const dailyRankCron = schedules.task({
  id: 'daily-rank-check-cron',
  cron: '0 19 * * *',             // 02:00 Bangkok time = 19:00 UTC

  run: async () => {
    const { data: projects } = await jobSupabase
      .from('projects')
      .select('id, organization_id')
      .eq('is_active', true)

    if (!projects?.length) return

    // Fan-out: one job per project (parallel, independent)
    await dailyRankCheck.batchTrigger(
      projects.map(p => ({
        payload: { projectId: p.id },
      }))
    )

    return { triggered: projects.length }
  },
})
```

---

## Triggering Jobs from API Routes

```typescript
// /app/api/reports/generate/route.ts
import { generateReport } from '@/trigger/report-gen'

export async function POST(req: Request) {
  const { projectId, dateFrom, dateTo } = await req.json()

  // 1. Create job record
  const { data: job } = await supabase
    .from('report_jobs')
    .insert({ project_id: projectId, date_from: dateFrom, date_to: dateTo, status: 'pending' })
    .select()
    .single()

  // 2. Trigger background job (returns immediately — non-blocking)
  const handle = await generateReport.trigger({ reportJobId: job.id })

  return Response.json({
    jobId: job.id,
    triggerId: handle.id,
  })
}
```

---

## Manual Trigger (ad-hoc, e.g. "re-check now" button)

```typescript
// Trigger single project rank check on demand
const handle = await dailyRankCheck.trigger({ projectId })
// Returns immediately — UI subscribes to Supabase Realtime for status
```

---

## Job Status Flow

```
pending → processing → done
                    ↘ failed (error_message set, Trigger.dev retries)
```

Always update `report_jobs.status` at each stage so Realtime pushes to UI.
