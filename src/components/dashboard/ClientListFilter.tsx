'use client'

import { useMemo, useState } from 'react'
import { Search, Folder, Tags } from 'lucide-react'
import { ClientRow } from './ClientRow'
import { cn } from '@/lib/utils'
import type { ClientWithLatestSnapshot } from '@/types'

interface ClientListFilterProps {
  clients: ClientWithLatestSnapshot[]
}

export default function ClientListFilter({ clients }: ClientListFilterProps) {
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState<string>('')
  const [activeTags, setActiveTags] = useState<string[]>([])

  const folders = useMemo(() => {
    const set = new Set<string>()
    for (const c of clients) {
      if (c.folder) set.add(c.folder)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [clients])

  const tags = useMemo(() => {
    const set = new Set<string>()
    for (const c of clients) {
      for (const t of c.tags ?? []) set.add(t)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [clients])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter((c) => {
      if (folder && (c.folder ?? '') !== folder) return false
      if (activeTags.length > 0) {
        const cTags = c.tags ?? []
        if (!activeTags.every((t) => cTags.includes(t))) return false
      }
      if (q) {
        const matches =
          c.name.toLowerCase().includes(q) ||
          c.domain.toLowerCase().includes(q) ||
          (c.folder ?? '').toLowerCase().includes(q) ||
          (c.tags ?? []).some((t) => t.toLowerCase().includes(q))
        if (!matches) return false
      }
      return true
    })
  }, [clients, query, folder, activeTags])

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, folders, tags…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--blue)] transition-colors"
          />
        </div>

        {folders.length > 0 && (
          <div className="relative">
            <Folder
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            />
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--blue)] transition-colors"
            >
              <option value="">All folders</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tags size={13} className="text-[var(--text-muted)] mr-0.5" />
          {tags.map((t) => {
            const active = activeTags.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
                  active
                    ? 'bg-[var(--blue)]/15 text-[var(--blue)] border-[var(--blue)]/40'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--blue)] hover:text-[var(--text-primary)]',
                )}
              >
                {t}
              </button>
            )
          })}
          {activeTags.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTags([])}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline ml-1"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="card-nerd overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)] italic">
            {query || folder || activeTags.length > 0
              ? 'No projects match the current filters.'
              : 'No projects yet — create one to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs uppercase tracking-wide border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 font-medium">Project / Domain</th>
                  <th className="text-left px-4 py-3 font-medium">Folder / Tags</th>
                  <th className="text-center px-4 py-3 font-medium">URLs</th>
                  <th className="text-center px-4 py-3 font-medium">Citations</th>
                  <th className="text-left px-4 py-3 font-medium">KPI %</th>
                  <th className="text-left px-4 py-3 font-medium">Last Pull</th>
                  <th className="text-center px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <ClientRow key={client.id} client={client} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
