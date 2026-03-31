// ============================================================
// AI Overview Citation Tracker — Core Types
// ============================================================

export interface Client {
  id: string
  name: string
  domain: string
  slug: string
  /** Dashboard KPI target (not Ahrefs API limit). */
  kpi_keyword_target: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClientUrl {
  id: string
  client_id: string
  url: string
  label: string | null
  /** Ahrefs organic-keywords `limit` for this URL (1–1000). */
  ahrefs_fetch_limit: number
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Snapshot {
  id: string
  client_id: string
  snapshot_date: string
  pulled_at: string
  ahrefs_country: string
  total_urls: number | null
  total_citations: number | null
  total_serp_ai_overlap: number | null
  kpi_target: number | null
  notes: string | null
}

export interface UrlKeywordResult {
  id: string
  snapshot_id: string
  url_id: string
  keyword: string
  best_position: number | null
  volume: number | null
  sum_traffic: number | null
  best_position_kind: string | null
  serp_features: string[] | null
  is_ai_cited: boolean
  created_at: string
}

// ============================================================
// Enriched / joined types for UI
// ============================================================

export interface UrlKeywordResultWithUrl extends UrlKeywordResult {
  client_urls: Pick<ClientUrl, 'url' | 'label' | 'ahrefs_fetch_limit'>
}

export interface SnapshotWithResults extends Snapshot {
  url_keyword_results: UrlKeywordResultWithUrl[]
}

/** One row in the main UrlKpiTable */
export interface UrlKpiRow {
  urlId: string
  url: string
  label: string | null
  /** Ahrefs API row cap for this URL (not project KPI). */
  ahrefsFetchLimit: number
  aiCitations: number
  /** Sum of Ahrefs `sum_traffic` for this URL; null if no traffic field in data. */
  totalSumTraffic: number | null
  keywords: {
    keyword: string
    kind: string | null
    position: number | null
    volume: number | null
    sum_traffic: number | null
    serp_features: string[] | null
  }[]
}

/** Client with latest snapshot summary for dashboard table */
export interface ClientWithLatestSnapshot extends Client {
  snapshot_id: string | null
  snapshot_date: string | null
  total_urls: number | null
  total_citations: number | null
  kpi_pct: number | null
}

// ============================================================
// Ahrefs API types
// ============================================================

export interface AhrefsKeywordResult {
  keyword: string
  best_position: number
  volume: number
  sum_traffic?: number | null
  best_position_kind: string
  serp_features: string[]
}

export interface AhrefsOrgKeywordsResponse {
  keywords: AhrefsKeywordResult[]
  meta: {
    total: number
    count: number
  }
}

// ============================================================
// Snapshot engine return types
// ============================================================

export interface SnapshotPullResult {
  success: boolean
  snapshotId: string
  snapshotDate: string
  citationCount: number
  urlsProcessed: number
  errors: string[]
}

// ============================================================
// API request/response types
// ============================================================

export interface PullSnapshotRequest {
  clientId: string
  date?: string // YYYY-MM-DD, defaults to getDefaultSnapshotDate() (yesterday local)
}

export interface CreateClientRequest {
  name: string
  domain: string
  slug: string
  kpi_keyword_target?: number
}

export interface CreateUrlRequest {
  url: string
  label?: string
  ahrefs_fetch_limit?: number
  sort_order?: number
}

// ============================================================
// Form schemas (used with react-hook-form + zod)
// ============================================================

export type ClientFormValues = {
  name: string
  domain: string
  slug: string
  kpi_keyword_target: number
}

export type UrlFormValues = {
  url: string
  label: string
  ahrefs_fetch_limit: number
  sort_order: number
}
