import type { SupabaseClient } from '@supabase/supabase-js'
import type { SnapshotPullResult } from '@/types'
import { getUrlAiOverviewKeywords } from './ahrefs'
import { keywordHasSerpAiOverview } from './keyword-metrics'
import { delay, getDefaultSnapshotDate } from './utils'

/**
 * Pull a monthly AI Overview snapshot for one client.
 * Fetches all active URLs, calls Ahrefs API for each, and persists results.
 */
export async function pullClientSnapshot(
  clientId: string,
  snapshotDate: string | undefined,
  supabase: SupabaseClient,
  ahrefsApiKey: string
): Promise<SnapshotPullResult> {
  const date = snapshotDate ?? getDefaultSnapshotDate()
  const errors: string[] = []

  const { data: clientRow, error: clientMetaErr } = await supabase
    .from('clients')
    .select('kpi_keyword_target')
    .eq('id', clientId)
    .single()

  if (clientMetaErr) {
    throw new Error(`Failed to load client KPI: ${clientMetaErr.message}`)
  }

  const kpiTarget = clientRow?.kpi_keyword_target ?? 30

  // 1. Fetch all active URLs
  const { data: urls, error: urlsErr } = await supabase
    .from('client_urls')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('sort_order')

  if (urlsErr) throw new Error(`Failed to fetch URLs: ${urlsErr.message}`)
  if (!urls || urls.length === 0) {
    return {
      success: false,
      snapshotId: '',
      snapshotDate: date,
      citationCount: 0,
      urlsProcessed: 0,
      errors: ['No active URLs found'],
    }
  }

  // 2. Upsert snapshot record
  const { data: snapshot, error: snapErr } = await supabase
    .from('snapshots')
    .upsert(
      { client_id: clientId, snapshot_date: date },
      { onConflict: 'client_id,snapshot_date' }
    )
    .select()
    .single()

  if (snapErr) throw new Error(`Failed to create snapshot: ${snapErr.message}`)

  // 3. Delete existing keyword results for this snapshot (fresh pull)
  await supabase
    .from('url_keyword_results')
    .delete()
    .eq('snapshot_id', snapshot.id)

  // 4. For each URL, pull Ahrefs data (rate-limited: 300ms gap)
  let totalCitations = 0
  let urlsProcessed = 0

  for (const urlRecord of urls) {
    try {
      await delay(300)
      const fetchCap = urlRecord.ahrefs_fetch_limit ?? 30
      const keywords = await getUrlAiOverviewKeywords(
        urlRecord.url,
        date,
        ahrefsApiKey,
        'th',
        fetchCap
      )

      if (keywords.length > 0) {
        const rows = keywords.map(kw => ({
          snapshot_id: snapshot.id,
          url_id: urlRecord.id,
          keyword: kw.keyword,
          best_position: kw.best_position,
          volume: kw.volume,
          sum_traffic: kw.sum_traffic ?? null,
          best_position_kind: kw.best_position_kind,
          serp_features: kw.serp_features,
        }))

        let insertErr = (
          await supabase.from('url_keyword_results').insert(rows)
        ).error

        if (
          insertErr &&
          /sum_traffic|column/i.test(insertErr.message ?? '')
        ) {
          const withoutTraffic = rows.map(
            ({ sum_traffic: _s, ...rest }) => rest
          )
          insertErr = (
            await supabase.from('url_keyword_results').insert(withoutTraffic)
          ).error
        }

        if (insertErr) {
          errors.push(`${urlRecord.url}: insert error — ${insertErr.message}`)
        }
      }

      const citations = keywords.filter(k => keywordHasSerpAiOverview(k)).length
      totalCitations += citations
      urlsProcessed++
    } catch (e) {
      errors.push(`${urlRecord.url}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 5. Update snapshot summary (KPI = project setting, frozen on this snapshot row)
  await supabase
    .from('snapshots')
    .update({
      total_urls: urls.length,
      total_citations: totalCitations,
      kpi_target: kpiTarget,
      pulled_at: new Date().toISOString(),
    })
    .eq('id', snapshot.id)

  return {
    success: errors.length === 0,
    snapshotId: snapshot.id,
    snapshotDate: date,
    citationCount: totalCitations,
    urlsProcessed,
    errors,
  }
}

/**
 * Pull snapshots for ALL active clients sequentially.
 * Used by the monthly cron edge function.
 */
export async function pullAllClientsSnapshot(
  supabase: SupabaseClient,
  ahrefsApiKey: string,
  snapshotDate?: string
): Promise<{ clientId: string; result: SnapshotPullResult }[]> {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_active', true)

  if (error) throw new Error(`Failed to fetch clients: ${error.message}`)

  const results: { clientId: string; result: SnapshotPullResult }[] = []

  for (const client of clients ?? []) {
    const result = await pullClientSnapshot(
      client.id,
      snapshotDate,
      supabase,
      ahrefsApiKey
    )
    results.push({ clientId: client.id, result })
    // Longer delay between clients
    await delay(1000)
  }

  return results
}
