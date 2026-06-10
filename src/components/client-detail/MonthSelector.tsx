'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { formatSnapshotMonth } from '@/lib/utils'

interface MonthOption {
  month_key: string
  report_month: string
  pulled_at: string
  snapshot_date: string
}

interface MonthSelectorProps {
  options: MonthOption[]
  /** Currently selected month_key (e.g. "2026-04"). */
  current: string
}

export default function MonthSelector({ options, current }: MonthSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (options.length === 0) return null

  const onChange = (monthKey: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', monthKey)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Calendar size={14} className="text-[var(--text-muted)]" />
      <span className="text-xs uppercase tracking-wide text-[var(--text-muted)] font-medium">
        Month
      </span>
      <div className="relative">
        <select
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--blue)] transition-colors"
        >
          {options.length > 1 && <option value="all">All months</option>}
          {[...options]
            .sort((a, b) => b.month_key.localeCompare(a.month_key))
            .map((o) => (
              <option key={o.month_key} value={o.month_key}>
                {formatSnapshotMonth(o.report_month)}
              </option>
            ))}
        </select>
      </div>
    </div>
  )
}
