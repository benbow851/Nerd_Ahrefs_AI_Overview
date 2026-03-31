'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { ClientRow } from './ClientRow'
import type { ClientWithLatestSnapshot } from '@/types'

interface ClientListFilterProps {
  clients: ClientWithLatestSnapshot[]
}

export default function ClientListFilter({ clients }: ClientListFilterProps) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.domain.toLowerCase().includes(query.toLowerCase()),
      )
    : clients

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects..."
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--blue)] transition-colors"
        />
      </div>

      {/* Table */}
      <div className="card-nerd overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)] italic">
            {query
              ? `No projects matching "${query}"`
              : 'No projects yet — create one to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs uppercase tracking-wide border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 font-medium">Project / Domain</th>
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
