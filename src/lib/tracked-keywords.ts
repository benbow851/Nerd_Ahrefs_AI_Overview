import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClientTrackedKeyword } from '@/types'

export async function getClientTrackedKeywords(
  supabase: SupabaseClient,
  clientId: string,
  activeOnly = true
): Promise<ClientTrackedKeyword[]> {
  let q = supabase
    .from('client_tracked_keywords')
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order')
    .order('created_at')

  if (activeOnly) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ClientTrackedKeyword[]
}

export async function countActiveTrackedKeywords(
  supabase: SupabaseClient,
  clientId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('client_tracked_keywords')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('is_active', true)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export function groupTrackedKeywordsByUrlId(
  keywords: ClientTrackedKeyword[]
): Map<string, ClientTrackedKeyword[]> {
  const map = new Map<string, ClientTrackedKeyword[]>()
  for (const kw of keywords) {
    const list = map.get(kw.url_id) ?? []
    list.push(kw)
    map.set(kw.url_id, list)
  }
  return map
}

/** Normalize for matching Ahrefs keyword strings */
export function normalizeKeywordKey(keyword: string): string {
  return keyword.trim().toLowerCase()
}
