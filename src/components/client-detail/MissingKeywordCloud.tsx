'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface MissingKeyword {
  keyword: string
  kind: string | null
  position: number | null
  volume: number | null
}

interface MissingKeywordCloudProps {
  keywords: MissingKeyword[]
}

const VISIBLE_LIMIT = 12

function kwTitle(kw: MissingKeyword): string {
  const parts: string[] = ['Missing this month']
  if (kw.position !== null) parts.push(`Last position: ${kw.position}`)
  if (kw.volume != null) parts.push(`Vol: ${kw.volume.toLocaleString()}`)
  return parts.join(' · ')
}

export default function MissingKeywordCloud({
  keywords,
}: MissingKeywordCloudProps) {
  const [expanded, setExpanded] = useState(false)

  if (keywords.length === 0) {
    return (
      <p className="text-xs italic text-[var(--text-muted)]">
        ไม่มี keyword ที่หายไป
      </p>
    )
  }

  const visible = expanded ? keywords : keywords.slice(0, VISIBLE_LIMIT)
  const remaining = keywords.length - VISIBLE_LIMIT

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((kw, i) => (
        <span
          key={`${kw.keyword}-${i}`}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-medium bg-[var(--status-danger)]/15 text-[var(--status-danger)] border border-[var(--status-danger)]/40 line-through decoration-[var(--status-danger)]/60"
          title={kwTitle(kw)}
        >
          {kw.keyword}
        </span>
      ))}

      {!expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium',
            'bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/30',
            'hover:bg-[var(--status-danger)]/20 transition-colors cursor-pointer',
          )}
        >
          +{remaining} more
        </button>
      )}

      {expanded && keywords.length > VISIBLE_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium bg-white/5 text-[var(--text-secondary)] border border-[var(--border)] hover:bg-white/10 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  )
}
