/**
 * Keywords from `getUrlAiOverviewKeywords` are pre-filtered at the API with
 * `serp_features` + `positions_kinds` (AI Overview placement). These helpers still
 * classify rows for UI and tolerate legacy rows where `best_position_kind` differs.
 */

export function keywordHasSerpAiOverview(k: {
  serp_features?: string[] | null
  best_position_kind?: string | null
  /** UI row shape (`UrlKpiRow.keywords`) */
  kind?: string | null
}): boolean {
  const sf = k.serp_features ?? []
  if (sf.includes('ai_overview')) return true
  if (sf.includes('ai_overview_sitelink')) return true
  const kind = k.best_position_kind ?? k.kind
  return kind === 'ai_overview' || kind === 'ai_overview_sitelink'
}

/** URL appears inside the AI Overview / sitelink snippet (stricter than SERP filter). */
export function keywordCitedInAiOverviewBox(k: {
  best_position_kind?: string | null
  kind?: string | null
}): boolean {
  const kind = k.best_position_kind ?? k.kind
  return kind === 'ai_overview' || kind === 'ai_overview_sitelink'
}
