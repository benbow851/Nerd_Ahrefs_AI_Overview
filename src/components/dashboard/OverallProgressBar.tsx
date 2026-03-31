'use client'

import { cn } from '@/lib/utils'

interface OverallProgressBarProps {
  citations: number
  kpiTarget: number
  publishedUrlCount: number
  totalUrlCount: number
}

export function OverallProgressBar({
  citations,
  kpiTarget,
  publishedUrlCount,
  totalUrlCount,
}: OverallProgressBarProps) {
  const safeTarget = kpiTarget > 0 ? kpiTarget : 1

  // Green segment: citations already achieved, clamped to 100%
  const achievedPct = Math.min((citations / safeTarget) * 100, 100)

  // Blue segment: URLs that are published but haven't yet reached full citations.
  // Represents the portion of the bar that is "in progress" beyond what's achieved,
  // capped so the two segments never exceed 100% together.
  const inProgressRaw = ((publishedUrlCount / Math.max(totalUrlCount, 1)) * 100) - achievedPct
  const inProgressPct = Math.max(Math.min(inProgressRaw, 100 - achievedPct), 0)

  const overallPct = Math.round((citations / safeTarget) * 100)

  return (
    <div className="w-full space-y-2">
      {/* Bar */}
      <div className="relative h-4 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
        {/* Green — achieved */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-[var(--status-success)] transition-[width] duration-500 ease-out"
          style={{ width: `${achievedPct}%` }}
        />
        {/* Blue — in progress (offset by the green segment) */}
        <div
          className="absolute top-0 h-full rounded-full bg-[var(--blue)] transition-[width,left] duration-500 ease-out"
          style={{ left: `${achievedPct}%`, width: `${inProgressPct}%` }}
        />
      </div>

      {/* Labels below bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">{citations.toLocaleString()}</span>
          {' / '}
          <span>{kpiTarget.toLocaleString()}</span>
          {' KPI citations'}
        </span>
        <span
          className={cn(
            'font-semibold',
            overallPct >= 100
              ? 'text-[var(--status-success)]'
              : overallPct >= 60
              ? 'text-[var(--blue)]'
              : overallPct >= 30
              ? 'text-[var(--status-warning)]'
              : 'text-[var(--status-danger)]',
          )}
        >
          {overallPct}%
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <LegendPill color="var(--status-success)" label="Achieved" />
        <LegendPill color="var(--blue)" label="In Progress" />
        <LegendPill color="rgba(223,230,239,0.15)" label="Pending" />
      </div>
    </div>
  )
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}
