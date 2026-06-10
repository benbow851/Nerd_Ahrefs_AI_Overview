import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MiniDeltaProps {
  delta: number | null
  /** Tooltip text shown on hover. */
  title?: string
  /** Negative delta = good (e.g. avg position dropping is good). */
  invert?: boolean
}

/**
 * Tiny inline ↑/↓ chip — sized to sit beside a number in a table cell.
 * Use `DeltaIndicator` for the larger KPI-card variant.
 */
export function MiniDelta({ delta, title, invert = false }: MiniDeltaProps) {
  if (delta === null || Number.isNaN(delta)) return null
  if (delta === 0) {
    return (
      <span
        title={title}
        className="inline-flex items-center gap-0.5 text-[0.65rem] text-[var(--text-muted)] tabular-nums"
      >
        <Minus size={9} strokeWidth={2.5} />0
      </span>
    )
  }

  const isUp = delta > 0
  const isPositive = invert ? !isUp : isUp
  const Icon = isUp ? ArrowUp : ArrowDown
  const color = isPositive
    ? 'text-[var(--status-success)]'
    : 'text-[var(--status-danger)]'
  const sign = isUp ? '+' : ''

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-0.5 text-[0.65rem] font-semibold tabular-nums',
        color,
      )}
    >
      <Icon size={9} strokeWidth={2.5} />
      {sign}
      {delta}
    </span>
  )
}
