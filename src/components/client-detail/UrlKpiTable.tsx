import { ExternalLink } from 'lucide-react'
import { cn, formatVolume, urlHostname, urlPath } from '@/lib/utils'
import {
  keywordCitedInAiOverviewBox,
  keywordHasSerpAiOverview,
} from '@/lib/keyword-metrics'
import type { UrlKpiRow } from '@/types'
import KeywordTagCloud from './KeywordTagCloud'
import { DomainFavicon } from '@/components/ui/domain-favicon'

interface UrlKpiTableProps {
  rows: UrlKpiRow[]
  title: string
  emptyLabel?: string
}

function citationColorClass(aiCitations: number): string {
  if (aiCitations === 0) return 'text-[var(--text-muted)]'
  if (aiCitations >= 15) return 'text-[var(--status-success)]'
  if (aiCitations >= 5) return 'text-[var(--blue)]'
  return 'text-[var(--status-warning)]'
}

/** Per-URL status (not compared to project KPI — that is on dashboard cards). */
function UrlDataStatusChip({
  aiCitations,
  hasOrganicKeywords,
}: {
  aiCitations: number
  hasOrganicKeywords: boolean
}) {
  if (aiCitations === 0) {
    if (hasOrganicKeywords) {
      return (
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-white/5 text-[var(--text-secondary)] border border-[var(--border)]',
          )}
        >
          Organic SERP
        </span>
      )
    }
    return (
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          'bg-white/5 text-[var(--text-muted)] border border-[var(--border)]',
        )}
      >
        ยังไม่มี keyword
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        'bg-[var(--status-success)]/15 text-[var(--status-success)]',
        'border border-[var(--status-success)]/30',
      )}
    >
      มีข้อมูล
    </span>
  )
}

export default function UrlKpiTable({
  rows,
  title,
  emptyLabel = 'No URLs found',
}: UrlKpiTableProps) {
  return (
    <div className="card-nerd overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)]">
        <h3
          className="text-sm font-semibold text-[var(--text-primary)]"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {title}
        </h3>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)] italic">
          {emptyLabel}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium w-[26%]">URL</th>
                <th className="text-center px-4 py-3 font-medium w-[10%]">
                  Fetch limit
                </th>
                <th className="text-center px-4 py-3 font-medium w-[11%]">
                  AI keywords
                </th>
                <th className="text-center px-4 py-3 font-medium w-[11%]">
                  Est. traffic
                </th>
                <th className="text-center px-4 py-3 font-medium w-[12%]">
                  สถานะ
                </th>
                <th className="text-left px-5 py-3 font-medium">
                  Keywords ที่ติด AI Overview
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => {
                const aiOverviewKeywords = row.keywords.filter(k =>
                  keywordHasSerpAiOverview(k),
                )
                const hasOrganicKeywords = row.keywords.some(
                  k =>
                    keywordHasSerpAiOverview(k) &&
                    !keywordCitedInAiOverviewBox(k),
                )

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

                    <td className="px-4 py-3 text-center align-top">
                      <span
                        className="text-[var(--text-secondary)] font-medium tabular-nums"
                        title="Ahrefs API limit (rows) for this URL"
                      >
                        {row.ahrefsFetchLimit}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center align-top">
                      <span
                        className={cn(
                          'text-base font-bold tabular-nums',
                          citationColorClass(row.aiCitations),
                        )}
                      >
                        {row.aiCitations}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center align-top">
                      <span
                        className="text-[var(--text-secondary)] font-medium tabular-nums"
                        title="Sum of Ahrefs organic traffic estimates for keywords in this row"
                      >
                        {row.keywords.length === 0 || row.totalSumTraffic === null
                          ? '—'
                          : formatVolume(row.totalSumTraffic)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center align-top">
                      <UrlDataStatusChip
                        aiCitations={row.aiCitations}
                        hasOrganicKeywords={hasOrganicKeywords}
                      />
                    </td>

                    <td className="px-5 py-3 align-top">
                      <KeywordTagCloud keywords={aiOverviewKeywords} />
                    </td>
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
