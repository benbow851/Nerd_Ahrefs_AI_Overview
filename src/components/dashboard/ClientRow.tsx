'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isLegacyCommitment, kpiColorThreshold } from '@/lib/kpi-calculator'
import type { ClientWithLatestSnapshot } from '@/types'
import { DomainFavicon } from '@/components/ui/domain-favicon'

interface ClientRowProps {
  client: ClientWithLatestSnapshot
}

function kpiColor(pct: number | null, passAt: number): string {
  if (pct === null) return 'text-[var(--text-muted)]'
  if (pct >= passAt) return 'text-[var(--status-success)]'
  if (pct >= passAt * 0.85) return 'text-[var(--status-warning)]'
  return 'text-[var(--status-danger)]'
}

function kpiBarColor(pct: number | null, passAt: number): string {
  if (pct === null) return 'bg-[var(--text-muted)]'
  if (pct >= passAt) return 'bg-[var(--status-success)]'
  if (pct >= passAt * 0.85) return 'bg-[var(--status-warning)]'
  return 'bg-[var(--status-danger)]'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function ClientRow({ client }: ClientRowProps) {
  const [pulling, setPulling] = useState(false)
  const [pullError, setPullError] = useState<string | null>(null)

  const legacy = isLegacyCommitment(client.commitment_type ?? 'ai_citations')
  const passAt = kpiColorThreshold(client)
  const pct = client.kpi_pct !== null ? Math.round(client.kpi_pct) : null
  const barWidth = pct !== null ? Math.min(pct, 100) : 0

  async function handlePull() {
    setPulling(true)
    setPullError(null)
    try {
      const res = await fetch('/api/snapshots/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setPullError(data?.error ?? 'Pull failed')
      }
    } catch {
      setPullError('Network error')
    } finally {
      setPulling(false)
    }
  }

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--bg-surface)] transition-colors">
      {/* Client name + domain */}
      <td className="py-3 px-4">
        <Link
          href={`/clients/${client.slug}`}
          className="inline-flex items-center gap-2 font-medium text-[var(--text-primary)] hover:text-[var(--blue)] transition-colors"
        >
          <DomainFavicon domain={client.domain} size={22} />
          {client.name}
        </Link>
        {legacy && (
          <span className="ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-[var(--status-warning)]/15 text-[var(--status-warning)] border border-[var(--status-warning)]/30">
            Legacy
          </span>
        )}
        <span className="ml-2 inline-block rounded-full px-2 py-0.5 text-xs bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]">
          {client.domain}
        </span>
      </td>

      {/* Folder + tags */}
      <td className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-1.5 max-w-[260px]">
          {client.folder && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-strong)]">
              {client.folder}
            </span>
          )}
          {(client.tags ?? []).map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--blue)]/10 text-[var(--blue)] border border-[var(--blue)]/30"
            >
              {t}
            </span>
          ))}
          {!client.folder && (client.tags ?? []).length === 0 && (
            <span className="text-xs text-[var(--text-muted)]">—</span>
          )}
        </div>
      </td>

      {/* # URLs */}
      <td className="py-3 px-4 text-center text-[var(--text-secondary)]">
        {client.total_urls ?? '—'}
      </td>

      {/* Citations / KPI target */}
      <td className="py-3 px-4 text-center">
        <span className="text-[var(--text-primary)] font-medium">
          {client.total_citations ?? '—'}
        </span>
        <span className="text-[var(--text-muted)]">
          {' / '}
          {legacy
            ? client.total_tracked_keywords ?? '—'
            : client.kpi_keyword_target ?? '—'}
        </span>
      </td>

      {/* KPI % with mini progress bar */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {/* Mini bar */}
          <div className="h-1.5 w-20 rounded-full bg-[var(--bg-surface)] overflow-hidden flex-shrink-0">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500', kpiBarColor(pct, passAt))}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <span className={cn('text-sm font-semibold tabular-nums', kpiColor(pct, passAt))}>
            {pct !== null ? `${pct}%` : '—'}
          </span>
        </div>
      </td>

      {/* Last pull date */}
      <td className="py-3 px-4 text-sm text-[var(--text-muted)]">
        {formatDate(client.snapshot_date)}
      </td>

      {/* Pull action */}
      <td className="py-3 px-4 text-center">
        <button
          onClick={handlePull}
          disabled={pulling}
          title={pullError ?? 'Pull latest snapshot'}
          aria-label="Pull latest snapshot"
          className={cn(
            'inline-flex items-center justify-center rounded-lg p-2 transition-colors',
            'border border-[var(--border)] bg-[var(--bg-card)]',
            'hover:bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            pullError && 'border-[var(--status-danger)] text-[var(--status-danger)]',
          )}
        >
          <RefreshCw
            size={14}
            className={cn(
              'text-[var(--text-secondary)]',
              pulling && 'animate-spin',
              pullError && 'text-[var(--status-danger)]',
            )}
          />
        </button>
      </td>
    </tr>
  )
}
