import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeltaIndicatorProps {
  /** Numeric delta (current − previous). null = no comparison data. */
  delta: number | null
  /** Suffix shown after the value (e.g. '%' or ''). */
  suffix?: string
  /** Optional comparison-period label, e.g. "vs Feb 2026". */
  comparedTo?: string | null
  /** Force coloring: positive=good (default) or negative=good (e.g. avg position). */
  invert?: boolean
}

/** Compact ↑/↓ delta chip — used on dashboard KPI cards for monthly movement. */
export function DeltaIndicator({
  delta,
  suffix = '',
  comparedTo,
  invert = false,
}: DeltaIndicatorProps) {
  if (delta === null || Number.isNaN(delta)) {
    return (
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        No prior month to compare
      </p>
    )
  }

  const isFlat = delta === 0
  const isUp = delta > 0
  const goodWhenUp = !invert
  const isPositiveSignal = isFlat
    ? false
    : (isUp && goodWhenUp) || (!isUp && !goodWhenUp)

  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown
  const colorCls = isFlat
    ? 'text-[var(--text-muted)]'
    : isPositiveSignal
    ? 'text-[var(--status-success)]'
    : 'text-[var(--status-danger)]'

  const prefix = isFlat ? '' : isUp ? '+' : ''
  const formatted =
    suffix === '%'
      ? `${prefix}${delta}${suffix}`
      : `${prefix}${delta.toLocaleString()}${suffix}`

  return (
    <div className="mt-1 flex items-center gap-1.5 text-xs">
      <span className={cn('inline-flex items-center gap-0.5 font-semibold', colorCls)}>
        <Icon size={12} strokeWidth={2.5} />
        {formatted}
      </span>
      {comparedTo && (
        <span className="text-[var(--text-muted)]">vs {comparedTo}</span>
      )}
    </div>
  )
}
