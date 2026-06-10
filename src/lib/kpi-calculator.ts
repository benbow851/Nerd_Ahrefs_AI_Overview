import type { Client, Snapshot } from '@/types'

export type CommitmentType = 'ai_citations' | 'legacy_main_longtail'

export const COMMITMENT_TYPE_LABELS: Record<CommitmentType, string> = {
  ai_citations: 'AI Citations',
  legacy_main_longtail: 'Legacy Main + Longtail',
}

export const KEYWORD_TIER_LABELS = {
  main: 'Main Keyword',
  longtail: 'Keyword',
} as const

export function isLegacyCommitment(
  type: string | null | undefined
): type is 'legacy_main_longtail' {
  return type === 'legacy_main_longtail'
}

/** KPI % for display — citations vs denominator depends on commitment type. */
export function computeKpiPercent(
  citations: number,
  client: Pick<Client, 'commitment_type' | 'kpi_keyword_target'>,
  totalTrackedKeywords?: number | null
): number {
  if (isLegacyCommitment(client.commitment_type)) {
    const denom = totalTrackedKeywords ?? 0
    if (denom === 0) return 0
    return Math.round((citations / denom) * 100)
  }
  const target = client.kpi_keyword_target ?? 0
  if (target === 0) return 0
  return Math.round((citations / target) * 100)
}

/** Whether the client has met their KPI for the given citation count. */
export function isKpiPassed(
  citations: number,
  client: Pick<
    Client,
    'commitment_type' | 'kpi_keyword_target' | 'kpi_pass_threshold'
  >,
  totalTrackedKeywords?: number | null
): boolean {
  const pct = computeKpiPercent(citations, client, totalTrackedKeywords)
  if (isLegacyCommitment(client.commitment_type)) {
    return pct >= Number(client.kpi_pass_threshold ?? 70)
  }
  return pct >= 100
}

/** Color bucket threshold — legacy uses pass threshold instead of 100. */
export function kpiColorThreshold(
  client: Pick<Client, 'commitment_type' | 'kpi_pass_threshold'>
): number {
  if (isLegacyCommitment(client.commitment_type)) {
    return Number(client.kpi_pass_threshold ?? 70)
  }
  return 100
}

export function kpiDenominator(
  client: Pick<Client, 'commitment_type' | 'kpi_keyword_target'>,
  totalTrackedKeywords?: number | null
): number {
  if (isLegacyCommitment(client.commitment_type)) {
    return totalTrackedKeywords ?? 0
  }
  return client.kpi_keyword_target ?? 0
}

export function snapshotKpiDenominator(
  client: Pick<Client, 'commitment_type' | 'kpi_keyword_target'>,
  snapshot: Pick<Snapshot, 'kpi_target' | 'total_tracked_keywords'> | null
): number {
  if (isLegacyCommitment(client.commitment_type)) {
    return snapshot?.total_tracked_keywords ?? 0
  }
  return snapshot?.kpi_target ?? client.kpi_keyword_target ?? 0
}
