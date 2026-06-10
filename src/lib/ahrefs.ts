import type { AhrefsKeywordResult, AhrefsOrgKeywordsResponse } from '@/types'

const AHREFS_BASE = 'https://api.ahrefs.com/v3'

/** Default Ahrefs `limit` when a URL has no explicit fetch cap. */
export const AHREFS_ORGANIC_KEYWORDS_DEFAULT_LIMIT = 30

export const AHREFS_ORGANIC_KEYWORDS_MAX_LIMIT = 1000

/** Max keywords per OR-filter call — keeps Ahrefs queries reliable and cheap. */
export const AHREFS_TRACKED_KEYWORD_CHUNK_SIZE = 20

/** AI Overview citation filter — URL must appear inside the AIO answer box. */
export function buildAiOverviewCitationWhereFilter(): Record<string, unknown> {
  return {
    or: [
      {
        and: [
          {
            field: 'serp_features',
            list_is: { any: ['eq', 'ai_overview'] },
          },
          {
            field: 'positions_kinds',
            list_is: { any: ['eq', 'ai_overview'] },
          },
        ],
      },
      {
        and: [
          {
            field: 'serp_features',
            list_is: { any: ['eq', 'ai_overview_sitelink'] },
          },
          {
            field: 'positions_kinds',
            list_is: { any: ['eq', 'ai_overview_sitelink'] },
          },
        ],
      },
    ],
  }
}

function buildKeywordOrFilter(keywords: string[]): Record<string, unknown> {
  return {
    or: keywords.map((keyword) => ({
      field: 'keyword',
      is: ['eq', keyword],
    })),
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function clampFetchLimit(n: number): number {
  return Math.min(
    AHREFS_ORGANIC_KEYWORDS_MAX_LIMIT,
    Math.max(1, Math.floor(n))
  )
}

/**
 * Fetch organic keywords for an exact URL where the URL is cited inside the
 * AI Overview answer box (or its sitelinks). Stricter / cheaper than fetching
 * every keyword on AI-Overview-bearing SERPs — keeps API spend down and
 * produces only true citations.
 *
 * Uses `and` of `serp_features` + `positions_kinds` per Ahrefs filter syntax.
 * Two branches: `ai_overview` and `ai_overview_sitelink` pairs.
 *
 * @see https://api.ahrefs.com/v3/site-explorer/organic-keywords — `where`
 */
export async function getUrlAiOverviewKeywords(
  url: string,
  date: string,
  apiKey: string,
  country = 'th',
  rowLimit = AHREFS_ORGANIC_KEYWORDS_DEFAULT_LIMIT
): Promise<AhrefsKeywordResult[]> {
  const limit = clampFetchLimit(rowLimit)
  const whereFilter = JSON.stringify(buildAiOverviewCitationWhereFilter())

  const params = new URLSearchParams({
    target: url,
    mode: 'exact',
    country: country.toLowerCase(),
    date,
    volume_mode: 'average',
    select:
      'keyword,best_position,volume,serp_features,best_position_kind,sum_traffic',
    order_by: 'sum_traffic:desc',
    limit: String(limit),
    where: whereFilter,
  })

  const res = await fetch(
    `${AHREFS_BASE}/site-explorer/organic-keywords?${params}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      // No cache — always fresh for snapshot pulls
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Ahrefs API error ${res.status}: ${errText}`)
  }

  const data: AhrefsOrgKeywordsResponse = await res.json()
  return data.keywords ?? []
}

/**
 * Legacy commitment: check only user-defined keywords for AI Overview citations.
 * One API call per chunk (≤ AHREFS_TRACKED_KEYWORD_CHUNK_SIZE keywords) per URL.
 * Returns only keywords Ahrefs confirms are cited in AI Overview for this URL.
 */
export async function getUrlTrackedKeywordsAiStatus(
  url: string,
  keywords: string[],
  date: string,
  apiKey: string,
  country = 'th'
): Promise<AhrefsKeywordResult[]> {
  const unique = Array.from(
    new Map(keywords.map((k) => [k.trim(), k.trim()])).values()
  ).filter(Boolean)

  if (unique.length === 0) return []

  const chunks = chunkArray(unique, AHREFS_TRACKED_KEYWORD_CHUNK_SIZE)
  const merged = new Map<string, AhrefsKeywordResult>()

  for (const chunk of chunks) {
    const whereFilter = JSON.stringify({
      and: [
        buildAiOverviewCitationWhereFilter(),
        buildKeywordOrFilter(chunk),
      ],
    })

    const params = new URLSearchParams({
      target: url,
      mode: 'exact',
      country: country.toLowerCase(),
      date,
      volume_mode: 'average',
      select:
        'keyword,best_position,volume,serp_features,best_position_kind,sum_traffic',
      order_by: 'sum_traffic:desc',
      limit: String(chunk.length),
      where: whereFilter,
    })

    const res = await fetch(
      `${AHREFS_BASE}/site-explorer/organic-keywords?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Ahrefs API error ${res.status}: ${errText}`)
    }

    const data: AhrefsOrgKeywordsResponse = await res.json()
    for (const row of data.keywords ?? []) {
      merged.set(row.keyword.trim().toLowerCase(), row)
    }
  }

  return Array.from(merged.values())
}

/**
 * Test connectivity to Ahrefs API
 */
export async function testAhrefsConnection(apiKey: string): Promise<{
  ok: boolean
  message: string
}> {
  try {
    const params = new URLSearchParams({
      target: 'ahrefs.com',
      mode: 'subdomains',
      country: 'us',
      date: new Date().toISOString().split('T')[0],
      select: 'keyword',
      limit: '1',
    })

    const res = await fetch(
      `${AHREFS_BASE}/site-explorer/organic-keywords?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      }
    )

    if (res.ok) {
      return { ok: true, message: 'Connection successful' }
    }
    return { ok: false, message: `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}
