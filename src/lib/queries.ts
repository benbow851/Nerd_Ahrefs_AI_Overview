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

/** Fetch latest snapshot for a client with full keyword results */
export async function getLatestSnapshot(
  supabase: SupabaseClient,
  clientId: string
): Promise<SnapshotWithResults | null> {
  const { data, error } = await supabase
    .from('snapshots')
    .select(`
      *,
      url_keyword_results (
        *,
        client_urls ( url, label, ahrefs_fetch_limit )
      )
    `)
    .eq('client_id', clientId)
    .order('pulled_at', { ascending: false, nullsFirst: false })
    .order('snapshot_date', { ascending: false })
    .limit(1)
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
 * Build UrlKpiRow array from a snapshot's keyword results.
 * Groups by URL and computes per-URL citation counts.
 * When `snapshot` is null (no pull yet), every URL is a row with zero keywords.
 */
export function buildUrlKpiRows(
  snapshot: SnapshotWithResults | null,
  clientUrls: {
    id: string
    url: string
    label: string | null
    ahrefs_fetch_limit: number
  }[]
): UrlKpiRow[] {
  const grouped = new Map<string, SnapshotWithResults['url_keyword_results']>()
  if (snapshot?.url_keyword_results?.length) {
    for (const kw of snapshot.url_keyword_results) {
      const existing = grouped.get(kw.url_id) ?? []
      existing.push(kw)
      grouped.set(kw.url_id, existing)
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

    return {
      urlId: cu.id,
      url: cu.url,
      label: cu.label,
      ahrefsFetchLimit: cu.ahrefs_fetch_limit,
      aiCitations,
      totalSumTraffic,
      keywords: kwResults.map(k => ({
        keyword: k.keyword,
        kind: k.best_position_kind,
        position: k.best_position,
        volume: k.volume,
        sum_traffic: k.sum_traffic ?? null,
        serp_features: k.serp_features ?? null,
      })),
    }
  })
}
