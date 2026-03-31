'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface KeywordItem {
  keyword: string
  kind: string | null
  position: number | null
  volume?: number | null
  sum_traffic?: number | null
  serp_features?: string[] | null
}

interface KeywordTagCloudProps {
  keywords: KeywordItem[]
}

const VISIBLE_LIMIT = 15

function kwTitle(kw: KeywordItem): string | undefined {
  const parts: string[] = []
  if (kw.position !== null) parts.push(`Position: ${kw.position}`)
  if (kw.volume != null) parts.push(`Vol: ${kw.volume.toLocaleString()}`)
  if (kw.sum_traffic != null)
    parts.push(`Est. traffic/mo: ${kw.sum_traffic.toLocaleString()}`)
  return parts.length ? parts.join(' · ') : undefined
}

export default function KeywordTagCloud({ keywords }: KeywordTagCloudProps) {
  const [expanded, setExpanded] = useState(false)

  if (keywords.length === 0) {
    return (
      <p className="text-xs italic text-[var(--text-muted)]">
        ไม่พบ keywords ใน AI Overview
      </p>
    )
  }

  const visible = expanded ? keywords : keywords.slice(0, VISIBLE_LIMIT)
  const remaining = keywords.length - VISIBLE_LIMIT

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((kw, i) => {
        const isAiOverview =
          kw.kind === 'ai_overview' || kw.kind === 'ai_overview_sitelink'
        return (
          <span
            key={`${kw.keyword}-${i}`}
            className={cn(
              'badge-keyword',
              !isAiOverview && 'badge-keyword-organic',
            )}
            title={kwTitle(kw)}
          >
            {kw.keyword}
          </span>
        )
      })}

      {!expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium',
            'bg-white/5 text-[var(--text-secondary)] border border-[var(--border)]',
            'hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors cursor-pointer',
          )}
        >
          +{remaining} more
        </button>
      )}

      {expanded && keywords.length > VISIBLE_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium',
            'bg-white/5 text-[var(--text-secondary)] border border-[var(--border)]',
            'hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors cursor-pointer',
          )}
        >
          Show less
        </button>
      )}
    </div>
  )
}
