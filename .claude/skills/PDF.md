# PDF.md — Report Generation + Puppeteer Patterns

## Architecture Overview

```
User clicks "Generate Report"
  → POST /api/reports/generate
    → Creates report_jobs row (status: pending)
    → Triggers generateReport Trigger.dev job
      → Fetches all data (GSC, GA4, Ahrefs, rankings)
      → Calls Claude API for AI summary
      → POST /api/generate-pdf
        → Puppeteer opens /report/[id]/print
        → Captures A4 PDF
        → Uploads to Supabase Storage
      → Updates report_jobs (status: done, pdf_url: ...)
  ← Supabase Realtime pushes status to UI
```

---

## Print Page Setup

```typescript
// /app/report/[reportId]/print/page.tsx
// This page is rendered by Puppeteer — not shown to users directly

import { createClient } from '@supabase/supabase-js'

export default async function ReportPrintPage({
  params, searchParams
}: {
  params: { reportId: string }
  searchParams: { token: string }
}) {
  // Validate service token (prevents public access)
  if (searchParams.token !== process.env.REPORT_SERVICE_TOKEN) {
    return <div>Unauthorized</div>
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: job } = await supabase
    .from('report_jobs')
    .select('*, projects(*, white_label_config(*))')
    .eq('id', params.reportId)
    .single()

  const config = job.projects.white_label_config

  return (
    <div className="report-print" style={{ '--brand-color': config?.primary_color ?? '#4d62a7' } as any}>
      <ReportCover job={job} config={config} />
      <ReportExecutiveSummary summary={job.report_data?.summary} />
      <ReportKeywordRankings rankings={job.report_data?.rankings} />
      <ReportAIOVisibility rankings={job.report_data?.rankings} />
      <ReportTraffic gsc={job.report_data?.gscData} ga4={job.report_data?.ga4Data} />
      <ReportBacklinks ahrefs={job.report_data?.ahrefsData} />
      <ReportActions actions={job.report_data?.summary?.actions} />
    </div>
  )
}
```

---

## Print CSS (add to report print layout)

```css
/* /app/report/[reportId]/print/print.css */

@media print {
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  
  .no-print { display: none !important; }

  .page-break {
    page-break-after: always;
    break-after: page;
  }
}

.report-print {
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  color: #1d252d;
  width: 210mm;
  margin: 0 auto;
}

/* Cover page */
.report-cover {
  height: 297mm;
  background-color: var(--brand-color, #4d62a7);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 60px;
  page-break-after: always;
}

/* Section heading */
.report-section-heading {
  font-size: 18px;
  font-weight: 600;
  color: var(--brand-color, #4d62a7);
  border-bottom: 2px solid var(--brand-color, #4d62a7);
  padding-bottom: 8px;
  margin-bottom: 20px;
}

/* Thai body text */
.report-body-th {
  font-family: 'Mitr', sans-serif;
  font-size: 12px;
  line-height: 1.7;
}

/* Page footer */
.report-footer {
  position: running(footer);
  font-size: 10px;
  color: #888;
  text-align: right;
  padding-top: 8px;
  border-top: 0.5px solid #dfe6ef;
}

@page {
  size: A4;
  margin: 40px 40px 60px 40px;
  @bottom-right { content: element(footer); }
}
```

---

## Puppeteer PDF Generation API Route

```typescript
// /app/api/generate-pdf/route.ts
// IMPORTANT: Must run on Node.js runtime — not Edge

import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 300  // 5 minutes for Vercel Pro

export async function POST(req: Request) {
  const { reportJobId } = await req.json()

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  const SERVICE_TOKEN = process.env.REPORT_SERVICE_TOKEN
  const printUrl = `${APP_URL}/report/${reportJobId}/print?token=${SERVICE_TOKEN}`

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const page = await browser.newPage()

  // Load Thai fonts in Puppeteer
  await page.evaluateOnNewDocument(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Mitr:wght@400;500&family=Noto+Sans+Thai:wght@400;500&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  })

  await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 60000 })

  // Wait for charts to render (recharts uses SVG animation)
  await page.waitForTimeout(2000)

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,    // required for brand colors
    margin: { top: '40px', right: '40px', bottom: '60px', left: '40px' },
  })

  await browser.close()

  // Upload to Supabase Storage
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const filename = `reports/${reportJobId}.pdf`
  await supabase.storage
    .from('reports')
    .upload(filename, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  // Create signed URL (valid 7 days)
  const { data: signedUrl } = await supabase.storage
    .from('reports')
    .createSignedUrl(filename, 60 * 60 * 24 * 7)

  return Response.json({ pdfUrl: signedUrl?.signedUrl })
}
```

---

## White-label Config Application

```typescript
// /components/report/ReportCover.tsx
export function ReportCover({ job, config }: { job: ReportJob, config: WhiteLabelConfig }) {
  const agencyName = config?.agency_name ?? 'NerdOptimize'
  const primaryColor = config?.primary_color ?? '#4d62a7'
  const logoUrl = config?.logo_url

  return (
    <div
      className="report-cover page-break"
      style={{ backgroundColor: primaryColor }}
    >
      {/* Agency logo top-right */}
      {logoUrl && (
        <img src={logoUrl} alt={agencyName} className="absolute top-10 right-10 h-12" />
      )}

      {/* Client logo center */}
      <div className="flex-1 flex items-center justify-center">
        <h1 className="text-white text-4xl font-bold">{job.projects.client_name}</h1>
      </div>

      {/* Report details bottom */}
      <div className="text-white opacity-80 text-sm">
        <p>SEO Performance Report</p>
        <p>{formatDateRange(job.date_from, job.date_to)}</p>
        <p className="mt-4">Prepared by {agencyName}</p>
      </div>
    </div>
  )
}
```

---

## AI Executive Summary (Claude API)

```typescript
// /lib/claude/summary.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateAISummary(data: ReportData) {
  const prompt = `
You are an SEO analyst writing an executive summary for a client report.
Client: ${data.projectName}
Period: ${data.dateFrom} to ${data.dateTo}

Data:
- Top ranking changes: ${JSON.stringify(data.rankings.topChanges)}
- GSC: ${data.gscData.clicks} clicks, ${data.gscData.impressions} impressions, avg position ${data.gscData.avgPosition}
- AI Overview: cited in ${data.rankings.aioCitedCount} of ${data.rankings.totalKeywords} keywords
- Sessions: ${data.ga4Data.sessions}, Users: ${data.ga4Data.users}

Write:
1. executiveSummary: 3-4 bullet points in Thai summarizing the month
2. wins: top 3 positive highlights  
3. concerns: top 2 items needing attention
4. actions: 5 prioritized action items with brief rationale

Respond in JSON only. Use Thai language for all text.
`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}
```

---

## Report Section Components Map

| Section | Component | Data Source |
|---|---|---|
| Cover | `ReportCover` | white_label_config |
| Executive Summary | `ReportExecutiveSummary` | Claude API |
| Keyword Rankings | `ReportKeywordRankings` | keyword_rankings table |
| AI Overview Visibility | `ReportAIOVisibility` | keyword_rankings.aio_* fields |
| Organic Traffic | `ReportTraffic` | GSC + GA4 APIs |
| Backlinks | `ReportBacklinks` | Ahrefs MCP |
| Recommended Actions | `ReportActions` | Claude API |

All components are in `/components/report/` — used for both preview UI and PDF print page.
