import { cn } from '@/lib/utils'

interface PublishedProgressBarProps {
  publishedUrlCount: number
  focusUrlCount: number
  /** Fallback denominator (added URLs) when focusUrlCount is 0. */
  fallbackTotalUrlCount?: number
}

export function PublishedProgressBar({
  publishedUrlCount,
  focusUrlCount,
  fallbackTotalUrlCount = 0,
}: PublishedProgressBarProps) {
  const denominator =
    focusUrlCount > 0 ? focusUrlCount : Math.max(fallbackTotalUrlCount, 0)
  const safe = Math.max(denominator, 1)
  const pct = Math.min(Math.round((publishedUrlCount / safe) * 100), 100)
  const usingFallback = focusUrlCount === 0

  return (
    <div className="w-full space-y-2">
      <div className="relative h-3 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
        <div
          className={cn(
            'absolute left-0 top-0 h-full rounded-full transition-[width] duration-500 ease-out',
            pct >= 100
              ? 'bg-[var(--status-success)]'
              : pct >= 60
              ? 'bg-[var(--blue)]'
              : pct >= 30
              ? 'bg-[var(--status-warning)]'
              : 'bg-[var(--status-danger)]',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">
            {publishedUrlCount}
          </span>
          {' / '}
          <span>{denominator}</span>
          {' URLs published'}
        </span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            pct >= 100
              ? 'text-[var(--status-success)]'
              : pct >= 60
              ? 'text-[var(--blue)]'
              : pct >= 30
              ? 'text-[var(--status-warning)]'
              : 'text-[var(--status-danger)]',
          )}
        >
          {pct}%
        </span>
      </div>

      {usingFallback && (
        <p className="text-xs text-[var(--text-muted)] italic">
          Set Focus URL count in project settings to lock the denominator.
        </p>
      )}
    </div>
  )
}
