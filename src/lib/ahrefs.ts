import type { AhrefsKeywordResult, AhrefsOrgKeywordsResponse } from '@/types'

const AHREFS_BASE = 'https://api.ahrefs.com/v3'

/** Default Ahrefs `limit` when a URL has no explicit fetch cap. */
export const AHREFS_ORGANIC_KEYWORDS_DEFAULT_LIMIT = 30

export const AHREFS_ORGANIC_KEYWORDS_MAX_LIMIT = 1000

function clampFetchLimit(n: number): number {
  return Math.min(
    AHREFS_ORGANIC_KEYWORDS_MAX_LIMIT,
    Math.max(1, Math.floor(n))
  )
}

/**
 * Fetch organic keywords for an exact URL where the URL ranks in the AI Overview
 * context (not merely keywords whose SERP has an unrelated AI Overview box).
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
  const whereFilter = JSON.stringify({
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
