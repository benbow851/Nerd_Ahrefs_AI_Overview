import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ClientWithLatestSnapshot,
  SnapshotWithResults,
  UrlKpiRow,
} from '@/types'
import { keywordHasSerpAiOverview } from '@/lib/keyword-metrics'
import {
  monthKeyToReportMonthIso,
  pulledAtToMonthKeyBangkok,
} from '@/lib/report-month'

/** Fetch all active clients with their latest snapshot summary */
export async function getClientsWithLatestSnapshot(
  supabase: SupabaseClient
): Promise<ClientWithLatestSnapshot[]> {
  // Use the view defined in migration
  const { data, error } = await supabase
    .from('clients_with_latest_snapshot')
    .select('*')

  if (error) throw new Error(error.message)
  return (data ?? []) as ClientWithLatestSnapshot[]
}

/** Fetch a single client by slug */
export async function getClientBySlug(
  supabase: SupabaseClient,
  slug: string
) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) throw new Error(error.message)
  return data
}

const SNAPSHOT_WITH_RESULTS_SELECT = `
  *,
  url_keyword_results (
    *,
    client_urls ( url, label, ahrefs_fetch_limit )
  )
`

/** Fetch latest snapshot for a client with full keyword results */
export async function getLatestSnapshot(
  supabase: SupabaseClient,
  clientId: string
): Promise<SnapshotWithResults | null> {
  const { data, error } = await supabase
    .from('snapshots')
    .select(SNAPSHOT_WITH_RESULTS_SELECT)
    .eq('client_id', clientId)
    .order('pulled_at', { ascending: false, nullsFirst: false })
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as SnapshotWithResults | null
}

/** Fetch a single snapshot (with keyword results) by id. */
export async function getSnapshotById(
  supabase: SupabaseClient,
  snapshotId: string
): Promise<SnapshotWithResults | null> {
  const { data, error } = await supabase
    .from('snapshots')
    .select(SNAPSHOT_WITH_RESULTS_SELECT)
    .eq('id', snapshotId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as SnapshotWithResults | null
}

/** Raw snapshot rows (newest pull first) — for custom grouping. */
export async function getClientSnapshotRowsForReporting(
  supabase: SupabaseClient,
  clientId: string,
  maxRows = 400
) {
  const { data, error } = await supabase
    .from('snapshots')
    .select('id, snapshot_date, pulled_at, total_citations, kpi_target, total_urls')
    .eq('client_id', clientId)
    .order('pulled_at', { ascending: false, nullsFirst: false })

  if (error) throw new Error(error.message)
  return (data ?? []).slice(0, maxRows)
}

export type MonthlyReportSnapshot = {
  id: string
  snapshot_date: string
  pulled_at: string
  report_month: string
  month_key: string
  total_citations: number | null
  kpi_target: number | null
  total_urls: number | null
}

/**
 * One row per calendar month (Bangkok) by **fetch time** (`pulled_at`).
 * Multiple pulls in the same month → keep the **latest** pull only.
 */
export async function getClientMonthlyReportHistory(
  supabase: SupabaseClient,
  clientId: string,
  maxMonths = 24
): Promise<MonthlyReportSnapshot[]> {
  const rows = await getClientSnapshotRowsForReporting(
    supabase,
    clientId,
    400
  )

  const byMonth = new Map<string, (typeof rows)[0]>()
  for (const row of rows) {
    const pulled = row.pulled_at ?? row.snapshot_date
    const key = pulledAtToMonthKeyBangkok(pulled)
    if (!byMonth.has(key)) byMonth.set(key, row)
  }

  const sorted = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, snap]) => ({
      id: snap.id,
      snapshot_date: snap.snapshot_date,
      pulled_at: snap.pulled_at,
      month_key: monthKey,
      report_month: monthKeyToReportMonthIso(monthKey),
      total_citations: snap.total_citations,
      kpi_target: snap.kpi_target,
      total_urls: snap.total_urls,
    }))

  return sorted.slice(-maxMonths)
}

/**
 * Previous-month snapshot for the dashboard movement comparison.
 *
 * "Previous month" = the most recent monthly report row strictly before the
 * current snapshot's report month (Asia/Bangkok). Returns null when only one
 * monthly row exists (no comparison possible).
 */
export async function getPreviousMonthSnapshot(
  supabase: SupabaseClient,
  clientId: string,
  currentSnapshotPulledAt: string | null
): Promise<MonthlyReportSnapshot | null> {
  const history = await getClientMonthlyReportHistory(supabase, clientId, 24)
  if (history.length < 2) return null

  const currentKey = currentSnapshotPulledAt
    ? pulledAtToMonthKeyBangkok(currentSnapshotPulledAt)
    : history[history.length - 1]!.month_key

  const earlier = history.filter((row) => row.month_key < currentKey)
  if (earlier.length === 0) return null
  return earlier[earlier.length - 1] ?? null
}

/** Fetch URLs for a client */
export async function getClientUrls(
  supabase: SupabaseClient,
  clientId: string
) {
  const { data, error } = await supabase
    .from('client_urls')
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order')

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Set of url_ids that have ever been part of a snapshot pull (any keyword
 * result) for this client. Used to mark a URL as "Published" once it has been
 * fetched at least once — even if the latest snapshot returned zero keywords
 * or zero AI citations.
 */
export async function getEverFetchedUrlIds(
  supabase: SupabaseClient,
  clientId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('url_keyword_results')
    .select('url_id, snapshots!inner(client_id)')
    .eq('snapshots.client_id', clientId)

  if (error) throw new Error(error.message)
  const ids = new Set<string>()
  for (const row of data ?? []) {
    if ((row as { url_id?: string }).url_id) {
      ids.add((row as { url_id: string }).url_id)
    }
  }
  return ids
}

/**
 * Build UrlKpiRow array from a snapshot's keyword results.
 * Groups by URL and computes per-URL citation counts.
 *
 * - `everFetched` is true when the URL has ever appeared in any snapshot
 *   (so the dashboard can call it "Published" even if the current snapshot
 *   returned zero keywords / zero AI citations).
 * - `missingKeywords` is the set of keywords present in the **previous-month**
 *   snapshot for this URL but absent from the current one.
 */
export function buildUrlKpiRows(
  snapshot: SnapshotWithResults | null,
  clientUrls: {
    id: string
    url: string
    label: string | null
    ahrefs_fetch_limit: number
    last_fetched_at?: string | null
  }[],
  options: {
    previousSnapshot?: SnapshotWithResults | null
    everFetchedUrlIds?: Set<string>
  } = {}
): UrlKpiRow[] {
  const { previousSnapshot, everFetchedUrlIds } = options

  const grouped = new Map<string, SnapshotWithResults['url_keyword_results']>()
  if (snapshot?.url_keyword_results?.length) {
    for (const kw of snapshot.url_keyword_results) {
      const existing = grouped.get(kw.url_id) ?? []
      existing.push(kw)
      grouped.set(kw.url_id, existing)
    }
  }

  const previousByUrl = new Map<
    string,
    SnapshotWithResults['url_keyword_results']
  >()
  if (previousSnapshot?.url_keyword_results?.length) {
    for (const kw of previousSnapshot.url_keyword_results) {
      const existing = previousByUrl.get(kw.url_id) ?? []
      existing.push(kw)
      previousByUrl.set(kw.url_id, existing)
    }
  }

  return clientUrls.map(cu => {
    const kwResults = grouped.get(cu.id) ?? []
    const aiCitations = kwResults.filter(k =>
      keywordHasSerpAiOverview(k)
    ).length
    const hasAnyTraffic = kwResults.some(k => k.sum_traffic != null)
    const totalSumTraffic = hasAnyTraffic
      ? kwResults.reduce((s, k) => s + (k.sum_traffic ?? 0), 0)
      : null

    const currentKeywordSet = new Set(kwResults.map(k => k.keyword))
    const previousKwResults = previousByUrl.get(cu.id) ?? []
    const missingKeywords = previousKwResults
      .filter(k => !currentKeywordSet.has(k.keyword))
      .map(k => ({
        keyword: k.keyword,
        kind: k.best_position_kind,
        position: k.best_position,
        volume: k.volume,
      }))

    const everFetched =
      !!cu.last_fetched_at ||
      kwResults.length > 0 ||
      previousKwResults.length > 0 ||
      (everFetchedUrlIds?.has(cu.id) ?? false)

    const previousAiCitations = previousSnapshot
      ? previousKwResults.filter(k => keywordHasSerpAiOverview(k)).length
      : null
    const aiCitationsDelta =
      previousAiCitations !== null ? aiCitations - previousAiCitations : null

    return {
      urlId: cu.id,
      url: cu.url,
      label: cu.label,
      ahrefsFetchLimit: cu.ahrefs_fetch_limit,
      aiCitations,
      totalSumTraffic,
      everFetched,
      previousAiCitations,
      aiCitationsDelta,
      keywords: kwResults.map(k => ({
        keyword: k.keyword,
        kind: k.best_position_kind,
        position: k.best_position,
        volume: k.volume,
        sum_traffic: k.sum_traffic ?? null,
        serp_features: k.serp_features ?? null,
      })),
      missingKeywords,
    }
  })
}

/**
 * Aggregated "all months" view: every keyword that has ever appeared for this
 * client across all snapshots, deduped by (url_id, keyword) keeping the most
 * recent snapshot's row. Returned in `SnapshotWithResults` shape so the same
 * downstream code path works.
 */
export async function getAggregatedClientSnapshot(
  supabase: SupabaseClient,
  clientId: string
): Promise<SnapshotWithResults | null> {
  const { data: snapshots, error: snapErr } = await supabase
    .from('snapshots')
    .select('id, snapshot_date, pulled_at')
    .eq('client_id', clientId)
    .order('pulled_at', { ascending: false, nullsFirst: false })
    .order('snapshot_date', { ascending: false })

  if (snapErr) throw new Error(snapErr.message)
  if (!snapshots || snapshots.length === 0) return null

  const snapshotIds = snapshots.map((s) => s.id)
  const orderRank = new Map<string, number>()
  snapshots.forEach((s, i) => orderRank.set(s.id, i)) // 0 = most recent

  const { data: results, error: resErr } = await supabase
    .from('url_keyword_results')
    .select('*, client_urls ( url, label, ahrefs_fetch_limit )')
    .in('snapshot_id', snapshotIds)

  if (resErr) throw new Error(resErr.message)

  const dedup = new Map<string, NonNullable<typeof results>[number]>()
  for (const r of results ?? []) {
    const key = `${r.url_id}::${r.keyword}`
    const existing = dedup.get(key)
    const rank = orderRank.get(r.snapshot_id) ?? Number.MAX_SAFE_INTEGER
    const existingRank = existing
      ? orderRank.get(existing.snapshot_id) ?? Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER
    if (!existing || rank < existingRank) dedup.set(key, r)
  }

  const latest = snapshots[0]!
  return {
    id: 'aggregate',
    client_id: clientId,
    snapshot_date: latest.snapshot_date,
    pulled_at: latest.pulled_at,
    ahrefs_country: '',
    total_urls: null,
    total_citations: null,
    total_serp_ai_overlap: null,
    kpi_target: null,
    notes: null,
    url_keyword_results: Array.from(
      dedup.values(),
    ) as SnapshotWithResults['url_keyword_results'],
  }
}
