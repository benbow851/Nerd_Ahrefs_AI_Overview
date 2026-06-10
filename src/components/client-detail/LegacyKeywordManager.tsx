'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { KEYWORD_TIER_LABELS } from '@/lib/kpi-calculator'
import type { ClientTrackedKeyword, KeywordTier } from '@/types'

type TrackedRow = ClientTrackedKeyword & {
  client_urls?: { url: string; label: string | null } | null
}

interface LegacyKeywordManagerProps {
  clientSlug: string
}

export default function LegacyKeywordManager({
  clientSlug,
}: LegacyKeywordManagerProps) {
  const [rows, setRows] = useState<TrackedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [mainKeyword, setMainKeyword] = useState('')
  const [longtailText, setLongtailText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientSlug}/tracked-keywords`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load')
      setRows(data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [clientSlug])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const longtail_keywords = longtailText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)

      const res = await fetch(`/api/clients/${clientSlug}/tracked-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groups: [{ url, main_keyword: mainKeyword, longtail_keywords }],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to add')
      setUrl('')
      setMainKeyword('')
      setLongtailText('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this keyword from tracking?')) return
    const res = await fetch(
      `/api/clients/${clientSlug}/tracked-keywords/${id}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.error ?? 'Delete failed')
      return
    }
    await load()
  }

  const grouped = rows.reduce<Record<string, TrackedRow[]>>((acc, row) => {
    const key = row.url_id
    acc[key] = acc[key] ?? []
    acc[key].push(row)
    return acc
  }, {})

  return (
    <div className="card-nerd p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Tracked keywords (Legacy)
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
          1 Main Keyword ต่อ URL — ที่เหลือเป็น Keyword (longtail) ใช้ URL เดียวกัน
          Pull จะเช็คเฉพาะคำเหล่านี้ใน AI Overview เท่านั้น (ประหยัด API credit)
        </p>
      </div>

      {error && (
        <p className="text-sm text-[var(--status-danger)]">{error}</p>
      )}

      <form onSubmit={handleAdd} className="space-y-3 border border-[var(--border)] rounded-lg p-4">
        <div>
          <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
            URL
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/page or /path"
            className="mt-1 w-full px-3 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-surface)]"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
            Main Keyword
          </label>
          <input
            value={mainKeyword}
            onChange={(e) => setMainKeyword(e.target.value)}
            placeholder="คำหลัก 1 คำ"
            className="mt-1 w-full px-3 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-surface)]"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
            Keywords (longtail)
          </label>
          <textarea
            value={longtailText}
            onChange={(e) => setLongtailText(e.target.value)}
            rows={4}
            placeholder="หนึ่งคำต่อบรรทัด"
            className="mt-1 w-full px-3 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-surface)] font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--blue)] disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add URL group
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">ยังไม่มี tracked keywords</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([urlId, kws]) => {
            const pageUrl = kws[0]?.client_urls?.url ?? urlId
            return (
              <div
                key={urlId}
                className="border border-[var(--border)] rounded-lg p-3 space-y-2"
              >
                <p className="text-xs font-mono text-[var(--partner-accent)] break-all">
                  {pageUrl}
                </p>
                <ul className="space-y-1">
                  {kws.map((kw) => (
                    <li
                      key={kw.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        <span
                          className={
                            kw.tier === 'main'
                              ? 'text-[10px] uppercase font-bold text-[var(--blue)] mr-2'
                              : 'text-[10px] uppercase font-bold text-[var(--text-muted)] mr-2'
                          }
                        >
                          {KEYWORD_TIER_LABELS[kw.tier as KeywordTier]}
                        </span>
                        {kw.keyword}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(kw.id)}
                        className="text-[var(--text-muted)] hover:text-[var(--status-danger)]"
                        aria-label="Delete keyword"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
