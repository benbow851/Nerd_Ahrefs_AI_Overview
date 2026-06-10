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
            ({ sum_traffic: _, ...rest }) => rest // eslint-disable-line @typescript-eslint/no-unused-vars
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

      // Mark the URL as fetched even when Ahrefs returned 0 rows — this is
      // what makes "Published" reflect the SEO team's pull progress, not
      // whether AI Overview hits were found.
      const fetchedAt = new Date().toISOString()
      const { error: stampErr } = await supabase
        .from('client_urls')
        .update({ last_fetched_at: fetchedAt })
        .eq('id', urlRecord.id)
      if (stampErr) {
        errors.push(
          `${urlRecord.url}: failed to stamp last_fetched_at — ${stampErr.message}`,
        )
      }
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
 * Pull a single URL into a snapshot for a specific date — without touching
 * other URLs already stored in that snapshot. Used to backfill a URL that
 * was missed in a prior month or to re-fetch one URL on demand.
 */
export async function pullSingleUrlSnapshot(
  clientId: string,
  urlId: string,
  snapshotDate: string | undefined,
  supabase: SupabaseClient,
  ahrefsApiKey: string
): Promise<SnapshotPullResult> {
  const date = snapshotDate ?? getDefaultSnapshotDate()
  const errors: string[] = []

  // 1. Verify URL belongs to this client.
  const { data: urlRecord, error: urlErr } = await supabase
    .from('client_urls')
    .select('id, client_id, url, ahrefs_fetch_limit')
    .eq('id', urlId)
    .single()

  if (urlErr || !urlRecord) {
    return {
      success: false,
      snapshotId: '',
      snapshotDate: date,
      citationCount: 0,
      urlsProcessed: 0,
      errors: [`URL not found: ${urlErr?.message ?? urlId}`],
    }
  }
  if (urlRecord.client_id !== clientId) {
    return {
      success: false,
      snapshotId: '',
      snapshotDate: date,
      citationCount: 0,
      urlsProcessed: 0,
      errors: ['URL does not belong to this client'],
    }
  }

  // 2. Look up project KPI (for snapshot total_citations / kpi_target).
  const { data: clientRow } = await supabase
    .from('clients')
    .select('kpi_keyword_target')
    .eq('id', clientId)
    .single()
  const kpiTarget = clientRow?.kpi_keyword_target ?? 30

  // 3. Upsert the snapshot row for this date (do NOT wipe other URLs' rows).
  const { data: snapshot, error: snapErr } = await supabase
    .from('snapshots')
    .upsert(
      { client_id: clientId, snapshot_date: date },
      { onConflict: 'client_id,snapshot_date' }
    )
    .select()
    .single()

  if (snapErr || !snapshot) {
    throw new Error(
      `Failed to create snapshot: ${snapErr?.message ?? 'unknown error'}`
    )
  }

  // 4. Delete only this URL's prior rows in this snapshot (idempotent re-pull).
  await supabase
    .from('url_keyword_results')
    .delete()
    .eq('snapshot_id', snapshot.id)
    .eq('url_id', urlRecord.id)

  // 5. Pull from Ahrefs.
  let citations = 0
  try {
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
          ({ sum_traffic: _, ...rest }) => rest // eslint-disable-line @typescript-eslint/no-unused-vars
        )
        insertErr = (
          await supabase.from('url_keyword_results').insert(withoutTraffic)
        ).error
      }

      if (insertErr) {
        errors.push(`${urlRecord.url}: insert error — ${insertErr.message}`)
      }
    }

    citations = keywords.filter(k => keywordHasSerpAiOverview(k)).length

    // Stamp last_fetched_at so this URL is treated as Published.
    const { error: stampErr } = await supabase
      .from('client_urls')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', urlRecord.id)
    if (stampErr) {
      errors.push(
        `${urlRecord.url}: failed to stamp last_fetched_at — ${stampErr.message}`,
      )
    }
  } catch (e) {
    errors.push(`${urlRecord.url}: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 6. Recompute snapshot totals from current rows (preserve other URLs' data).
  const { data: allRows } = await supabase
    .from('url_keyword_results')
    .select('url_id, serp_features, best_position_kind')
    .eq('snapshot_id', snapshot.id)

  const aggCitations = (allRows ?? []).filter(r =>
    keywordHasSerpAiOverview(r as { serp_features: string[] | null; best_position_kind: string | null })
  ).length
  const distinctUrlCount = new Set((allRows ?? []).map(r => r.url_id)).size

  await supabase
    .from('snapshots')
    .update({
      total_urls: distinctUrlCount,
      total_citations: aggCitations,
      kpi_target: kpiTarget,
      pulled_at: new Date().toISOString(),
    })
    .eq('id', snapshot.id)

  return {
    success: errors.length === 0,
    snapshotId: snapshot.id,
    snapshotDate: date,
    citationCount: citations,
    urlsProcessed: 1,
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
