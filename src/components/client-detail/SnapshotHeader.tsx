import { cn, formatSnapshotMonth } from '@/lib/utils'
import type { Client, Snapshot } from '@/types'
import { DomainFavicon } from '@/components/ui/domain-favicon'

interface SnapshotHeaderProps {
  client: Client
  snapshot: Snapshot | null
  publishedUrlCount: number
  totalUrlCount: number
}

function isT0Baseline(date: string): boolean {
  // Treat the first-ever snapshot for a client as T0 — callers can pass a
  // special sentinel value "T0" or we check if date is the same as
  // client.created_at month. For simplicity we expose the label via the
  // formatted month; callers who want "T0 Baseline" should pass snapshot_date
  // equal to the string "T0". Otherwise we format normally.
  return date === 'T0'
}

export default function SnapshotHeader({
  client,
  snapshot,
  publishedUrlCount,
  totalUrlCount,
}: SnapshotHeaderProps) {
  return (
    <div className="flex flex-wrap items-start gap-4">
      {/* Client name + domain */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className="text-2xl text-[var(--text-primary)] leading-tight"
            style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}
          >
            {client.name}
          </h1>

          {/* Domain badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
              'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
              'border border-[var(--border)]',
            )}
          >
            <DomainFavicon domain={client.domain} size={14} className="opacity-90" />
            {client.domain}
          </span>
        </div>

        {/* Snapshot meta row */}
        {snapshot ? (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Snapshot date badge */}
            <span
              className={cn(
                'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
                'bg-[var(--bg-surface)] text-[var(--text-secondary)]',
                'border border-[var(--border-strong)]',
              )}
            >
              {isT0Baseline(snapshot.snapshot_date)
                ? 'T0 Baseline'
                : formatSnapshotMonth(snapshot.snapshot_date)}
            </span>

            {/* URL count badge */}
            <span
              className={cn(
                'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
                'bg-[var(--blue)] text-white',
              )}
            >
              {publishedUrlCount}/{totalUrlCount} URLs Published
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-muted)] italic">
            No snapshot yet — click Pull to fetch data
          </p>
        )}
      </div>
    </div>
  )
}
