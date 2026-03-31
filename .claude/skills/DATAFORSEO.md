# DATAFORSEO.md — API Client + Parsing Patterns

## Authentication
Basic Auth: `base64(DATAFORSEO_LOGIN:DATAFORSEO_PASSWORD)`
Never call fetch() directly — use `/lib/dataforseo/client.ts`

---

## API Client (copy to /lib/dataforseo/client.ts)

```typescript
const BASE_URL = 'https://api.dataforseo.com/v3'

function getAuthHeader() {
  const creds = `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  return `Basic ${Buffer.from(creds).toString('base64')}`
}

export async function dataForSEOPost(path: string, body: object[]) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`DataForSEO HTTP error: ${res.status}`)
  }

  const json = await res.json()
  return json.tasks ?? []
}
```

---

## Main Endpoint: Rank + AI Overview (same call)

```
POST /serp/google/organic/live/advanced
```

### Request Body Item
```typescript
interface DataForSEOTask {
  keyword: string
  location_name: string        // "Thailand" | "Bangkok,Thailand"
  language_code: string        // "th" | "en"
  device: 'desktop' | 'mobile'
  load_async_ai_overview: true // ALWAYS true
  depth: 100                   // get top 100 results
}
```

### Batching (max 100 tasks per request)
```typescript
import { chunk } from 'lodash'

export async function batchRankCheck(keywords: TrackedKeyword[]) {
  const batches = chunk(keywords, 100)
  const results = []

  for (const batch of batches) {
    const tasks = batch.map(kw => ({
      keyword: kw.keyword,
      location_name: 'Thailand',
      language_code: kw.language_code,
      device: kw.device,
      load_async_ai_overview: true,
      depth: 100,
    }))

    const taskResults = await dataForSEOPost(
      '/serp/google/organic/live/advanced',
      tasks
    )
    results.push(...taskResults)
  }

  return results
}
```

---

## Parsing: Organic Position

```typescript
export function parseOrganicPosition(
  task: DataForSEOTask,
  clientDomain: string
): { position: number | null; url: string | null } {
  // Always check task status first
  if (task.status_code !== 20000) {
    console.warn(`DataForSEO task error: ${task.status_message}`)
    return { position: null, url: null }
  }

  const items = task.result?.[0]?.items ?? []

  const match = items
    .filter((item: any) => item.type === 'organic')
    .find((item: any) => {
      try {
        return new URL(item.url).hostname.includes(clientDomain)
      } catch {
        return item.domain?.includes(clientDomain)
      }
    })

  return {
    position: match?.rank_absolute ?? null,
    url: match?.url ?? null,
  }
}
```

---

## Parsing: AI Overview Citations

```typescript
export interface AIOResult {
  present: boolean
  cited: boolean
  citationPosition: number | null   // 0-indexed (0 = first citation = best)
  citedUrl: string | null
  citedText: string | null          // exact text snippet Google quoted
  elementTitle: string | null       // which section of AIO cited us
}

export function parseAIOCitation(
  task: DataForSEOTask,
  clientDomain: string
): AIOResult {
  const items = task.result?.[0]?.items ?? []
  const aioItem = items.find((i: any) => i.type === 'ai_overview')

  // No AI Overview for this keyword
  if (!aioItem) {
    return {
      present: false, cited: false,
      citationPosition: null, citedUrl: null,
      citedText: null, elementTitle: null,
    }
  }

  // AIO present — now check if client is cited
  for (const element of aioItem.items ?? []) {
    const refs: any[] = element.references ?? []

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]
      const domainMatch =
        ref.domain?.includes(clientDomain) ||
        ref.url?.includes(clientDomain)

      if (domainMatch) {
        return {
          present: true,
          cited: true,
          citationPosition: i,              // 0 = first = best placement
          citedUrl: ref.url ?? null,
          citedText: ref.text ?? null,
          elementTitle: element.title ?? null,
        }
      }
    }
  }

  // AIO present but client not cited
  return {
    present: true, cited: false,
    citationPosition: null, citedUrl: null,
    citedText: null, elementTitle: null,
  }
}
```

---

## Full Parse + Store Pattern (used in Trigger.dev job)

```typescript
export async function processRankResults(
  tasks: any[],
  keywords: TrackedKeyword[],
  clientDomain: string
) {
  const rows = []

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const keyword = keywords[i]

    if (task.status_code !== 20000) continue

    const { position, url } = parseOrganicPosition(task, clientDomain)
    const aio = parseAIOCitation(task, clientDomain)

    // Calculate position change vs yesterday
    const yesterday = await getPreviousPosition(keyword.id)
    const change = position && yesterday
      ? yesterday - position    // positive = moved up (improved)
      : null

    rows.push({
      keyword_id: keyword.id,
      checked_at: new Date().toISOString().split('T')[0],
      organic_position: position,
      ranked_url: url,
      position_change: change,
      aio_present: aio.present,
      aio_cited: aio.cited,
      aio_citation_position: aio.citationPosition,
      aio_cited_url: aio.citedUrl,
      aio_cited_text: aio.citedText,
      aio_element_title: aio.elementTitle,
    })
  }

  return rows
}
```

---

## Cost Reference

| Action | Cost |
|---|---|
| 1 SERP + AIO (cached AIO) | ~$0.001 |
| 1 SERP + AIO (async AIO) | ~$0.002 |
| 100 keywords / day | ~$0.10 |
| 10,000 keywords / day (100 clients) | ~$10/day → ~$300/month |

Always log to `usage_logs` after each batch:
```typescript
await logUsage(orgId, 'dataforseo', keywords.length)
```

---

## Error Handling

```typescript
// DataForSEO returns HTTP 200 even for errors — check status_code
const DATAFORSEO_OK = 20000

tasks.forEach(task => {
  if (task.status_code !== DATAFORSEO_OK) {
    // Log but don't throw — one failed task shouldn't kill the whole batch
    console.error(`[DataForSEO] ${task.status_message}`, {
      keyword: task.data?.keyword,
      code: task.status_code,
    })
    return  // skip this task
  }
  // process...
})
```
