'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  hasError?: boolean
  maxTags?: number
}

/**
 * Comma / Enter–separated tag chips. Mirrors SE Ranking-style project tagging.
 */
export function TagInput({
  value,
  onChange,
  placeholder = 'Add tag and press Enter…',
  hasError,
  maxTags = 20,
}: TagInputProps) {
  const [draft, setDraft] = useState('')

  const addTag = (raw: string) => {
    const next = raw.trim().replace(/,/g, '')
    if (!next) return
    if (value.includes(next)) return
    if (value.length >= maxTags) return
    onChange([...value, next])
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
      setDraft('')
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1.5 px-2 py-2 rounded-lg text-sm min-h-[42px]',
        'bg-[var(--bg-surface)] border text-[var(--text-primary)]',
        'focus-within:ring-1 focus-within:ring-[var(--blue)] transition-colors',
        hasError
          ? 'border-[var(--status-danger)]'
          : 'border-[var(--border)] focus-within:border-[var(--blue)]',
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--blue)]/15 text-[var(--blue)] border border-[var(--blue)]/30"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-[var(--blue)] hover:text-[var(--accent-hover)]"
            aria-label={`Remove ${tag}`}
          >
            <X size={11} strokeWidth={2.25} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => {
          if (draft.trim()) {
            addTag(draft)
            setDraft('')
          }
        }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-[var(--text-muted)] text-sm"
      />
    </div>
  )
}
