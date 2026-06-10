'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Eye, ExternalLink } from 'lucide-react'
import { cn, formatVolume, urlHostname, urlPath } from '@/lib/utils'
import { keywordHasSerpAiOverview } from '@/lib/keyword-metrics'
import type { UrlKpiRow } from '@/types'
import KeywordTagCloud from './KeywordTagCloud'
import MissingKeywordCloud from './MissingKeywordCloud'
import { MiniDelta } from './MiniDelta'
import { DomainFavicon } from '@/components/ui/domain-favicon'

interface UrlKpiTableProps {
  rows: UrlKpiRow[]
  title: string
  emptyLabel?: string
  /** Stable key used to persist column visibility per table. */
  storageKey?: string
  /** Show the previous-vs-current "Missing keywords" column (only meaningful when comparing). */
  showMissingKeywords?: boolean
}

type ColumnKey =
  | 'fetchLimit'
  | 'aiKeywords'
  | 'sumVolume'
  | 'avgPosition'
  | 'aiKeywordCloud'
  | 'missingKeywords'

interface ColumnDef {
  key: ColumnKey
  label: string
  defaultVisible: boolean
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'fetchLimit', label: 'Fetch limit', defaultVisible: true },
  { key: 'aiKeywords', label: 'AI keywords', defaultVisible: true },
  { key: 'sumVolume', label: 'Sum search volume', defaultVisible: true },
  { key: 'avgPosition', label: 'Avg. position', defaultVisible: true },
  { key: 'aiKeywordCloud', label: 'Keywords ที่ติด AI Overview', defaultVisible: true },
  { key: 'missingKeywords', label: 'Missing keywords (vs. prev month)', defaultVisible: true },
]

function citationColorClass(aiCitations: number): string {
  if (aiCitations === 0) return 'text-[var(--text-muted)]'
  if (aiCitations >= 15) return 'text-[var(--status-success)]'
  if (aiCitations >= 5) return 'text-[var(--blue)]'
  return 'text-[var(--status-warning)]'
}

function aggregateRow(row: UrlKpiRow): {
  sumVolume: number | null
  avgPosition: number | null
  positionSampleSize: number
} {
  if (row.keywords.length === 0) {
    return { sumVolume: null, avgPosition: null, positionSampleSize: 0 }
  }

  let sumVolume: number | null = null
  let posTotal = 0
  let posCount = 0

  for (const k of row.keywords) {
    if (k.volume != null) {
      sumVolume = (sumVolume ?? 0) + k.volume
    }
    if (k.position != null) {
      posTotal += k.position
      posCount += 1
    }
  }

  const avgPosition = posCount > 0 ? posTotal / posCount : null
  return { sumVolume, avgPosition, positionSampleSize: posCount }
}

function loadVisibility(
  storageKey: string | undefined,
  defaults: Record<ColumnKey, boolean>,
): Record<ColumnKey, boolean> {
  if (!storageKey || typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(`urlKpiCols:${storageKey}`)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Record<ColumnKey, boolean>>
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

export default function UrlKpiTable({
  rows,
  title,
  emptyLabel = 'No URLs found',
  storageKey,
  showMissingKeywords = false,
}: UrlKpiTableProps) {
  const columns = useMemo(
    () =>
      ALL_COLUMNS.filter(
        (c) => c.key !== 'missingKeywords' || showMissingKeywords,
      ),
    [showMissingKeywords],
  )

  const defaults = useMemo(
    () =>
      columns.reduce<Record<ColumnKey, boolean>>(
        (acc, c) => ({ ...acc, [c.key]: c.defaultVisible }),
        {} as Record<ColumnKey, boolean>,
      ),
    [columns],
  )

  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>(defaults)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisible(loadVisibility(storageKey, defaults))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        `urlKpiCols:${storageKey}`,
        JSON.stringify(visible),
      )
    } catch {
      // ignore quota errors
    }
  }, [storageKey, visible])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  const toggleCol = (key: ColumnKey) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }))

  const showCol = (key: ColumnKey) => visible[key] ?? false

  return (
    <div className="card-nerd overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
        <h3
          className="text-sm font-semibold text-[var(--text-primary)]"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {title}
        </h3>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--blue)] transition-colors"
            title="Show / hide columns"
          >
            <Eye size={13} strokeWidth={2} />
            Columns
            <ChevronDown
              size={13}
              className={cn('transition-transform', menuOpen && 'rotate-180')}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 min-w-[240px] rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-xl py-1.5">
              {columns.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface)] cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={showCol(c.key)}
                    onChange={() => toggleCol(c.key)}
                    className="rounded border-[var(--border)] bg-[var(--bg-surface)] text-[var(--blue)] focus:ring-[var(--blue)]"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)] italic">
          {emptyLabel}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">URL</th>
                {showCol('fetchLimit') && (
                  <th className="text-center px-4 py-3 font-medium">
                    Fetch limit
                  </th>
                )}
                {showCol('aiKeywords') && (
                  <th className="text-center px-4 py-3 font-medium">
                    AI keywords
                  </th>
                )}
                {showCol('sumVolume') && (
                  <th className="text-center px-4 py-3 font-medium">
                    Sum search volume
                  </th>
                )}
                {showCol('avgPosition') && (
                  <th className="text-center px-4 py-3 font-medium">
                    Avg. position
                  </th>
                )}
                {showCol('aiKeywordCloud') && (
                  <th className="text-left px-5 py-3 font-medium">
                    Keywords ที่ติด AI Overview
                  </th>
                )}
                {showMissingKeywords && showCol('missingKeywords') && (
                  <th className="text-left px-5 py-3 font-medium">
                    Missing keywords
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => {
                const aiOverviewKeywords = row.keywords.filter((k) =>
                  keywordHasSerpAiOverview(k),
                )
                const { sumVolume, avgPosition, positionSampleSize } =
                  aggregateRow(row)

                return (
                  <tr
                    key={row.urlId}
                    className="bg-[var(--bg-card)] hover:bg-white/5 transition-colors table-row-hover"
                  >
                    <td className="px-5 py-3 align-top">
                      <div className="flex items-start gap-2 min-w-0">
                        <DomainFavicon
                          domain={urlHostname(row.url) ?? ''}
                          size={20}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[var(--text-primary)] hover:text-[var(--blue)] transition-colors font-medium truncate max-w-[220px]"
                            title={row.url}
                          >
                            <span className="truncate">{urlPath(row.url)}</span>
                            <ExternalLink
                              size={11}
                              strokeWidth={1.75}
                              className="shrink-0 opacity-50"
                            />
                          </a>
                          {row.label && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-[220px]">
                              {row.label}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {showCol('fetchLimit') && (
                      <td className="px-4 py-3 text-center align-top">
                        <span
                          className="text-[var(--text-secondary)] font-medium tabular-nums"
                          title="Ahrefs API limit (rows) for this URL"
                        >
                          {row.ahrefsFetchLimit}
                        </span>
                      </td>
                    )}

                    {showCol('aiKeywords') && (
                      <td className="px-4 py-3 text-center align-top">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={cn(
                              'text-base font-bold tabular-nums',
                              citationColorClass(row.aiCitations),
                            )}
                            title={
                              row.keywords.length === 0
                                ? 'Fetched but no AI Overview / top-10 keywords found — counts as 0 in totals'
                                : undefined
                            }
                          >
                            {row.keywords.length === 0 ? '—' : row.aiCitations}
                          </span>
                          <MiniDelta
                            delta={row.aiCitationsDelta}
                            title={
                              row.previousAiCitations !== null
                                ? `Previous month: ${row.previousAiCitations}`
                                : undefined
                            }
                          />
                        </div>
                      </td>
                    )}

                    {showCol('sumVolume') && (
                      <td className="px-4 py-3 text-center align-top">
                        <span
                          className="text-[var(--text-secondary)] font-medium tabular-nums"
                          title="Sum of Ahrefs search volume across this row's keywords"
                        >
                          {sumVolume === null ? '—' : formatVolume(sumVolume)}
                        </span>
                      </td>
                    )}

                    {showCol('avgPosition') && (
                      <td className="px-4 py-3 text-center align-top">
                        <span
                          className="text-[var(--text-secondary)] font-medium tabular-nums"
                          title={
                            positionSampleSize > 0
                              ? `Mean of best_position across ${positionSampleSize} keyword(s). Note: keywords are pre-filtered by Ahrefs to URLs cited in the AI Overview, so best_position is the URL's slot inside the AI Overview citation list (typically 1–5), not the organic SERP rank.`
                              : 'No keywords with a position value'
                          }
                        >
                          {avgPosition === null
                            ? '—'
                            : avgPosition.toFixed(1)}
                        </span>
                      </td>
                    )}

                    {showCol('aiKeywordCloud') && (
                      <td className="px-5 py-3 align-top">
                        <KeywordTagCloud keywords={aiOverviewKeywords} />
                      </td>
                    )}

                    {showMissingKeywords && showCol('missingKeywords') && (
                      <td className="px-5 py-3 align-top">
                        <MissingKeywordCloud keywords={row.missingKeywords} />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
