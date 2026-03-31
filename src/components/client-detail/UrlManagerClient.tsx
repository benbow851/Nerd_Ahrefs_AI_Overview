'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, X, Loader2, ToggleLeft, ToggleRight, ExternalLink, Layers } from 'lucide-react'
import { cn, urlHostname, urlPath } from '@/lib/utils'
import type { Client, ClientUrl, UrlFormValues } from '@/types'
import { DomainFavicon } from '@/components/ui/domain-favicon'

// ── Zod schema ─────────────────────────────────────────────────────────────────
const urlSchema = z.object({
  url: z.string().url('Enter a valid URL (include https://)'),
  label: z.string().max(120, 'Max 120 characters'),
  ahrefs_fetch_limit: z
    .number({ invalid_type_error: 'Must be a number' })
    .int()
    .min(1, 'Minimum 1')
    .max(1000, 'Maximum 1000 (Ahrefs API)')
    .default(30),
  sort_order: z
    .number({ invalid_type_error: 'Must be a number' })
    .int()
    .min(0)
    .default(0),
})

// ── Small helpers ──────────────────────────────────────────────────────────────
const inputCls = (hasError?: boolean) =>
  [
    'w-full px-3 py-2.5 rounded-lg text-sm',
    'bg-[var(--bg-surface)] border text-[var(--text-primary)]',
    'placeholder:text-[var(--text-muted)]',
    'focus:outline-none focus:ring-1 focus:ring-[var(--blue)] transition-colors',
    hasError
      ? 'border-[var(--status-danger)]'
      : 'border-[var(--border)] focus:border-[var(--blue)]',
  ].join(' ')

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5">
      {children}
    </label>
  )
}

// ── URL form (used for both add & edit) ────────────────────────────────────────
interface UrlFormProps {
  defaultValues?: Partial<UrlFormValues>
  onSubmit: (data: UrlFormValues) => Promise<void>
  onCancel: () => void
  submitLabel: string
}

function UrlForm({ defaultValues, onSubmit, onCancel, submitLabel }: UrlFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<UrlFormValues>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: '',
      label: '',
      ahrefs_fetch_limit: 30,
      sort_order: 0,
      ...defaultValues,
    },
  })

  const submit = async (data: UrlFormValues) => {
    try {
      await onSubmit(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError('root', { message })
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {errors.root && (
        <div className="rounded-lg px-4 py-3 text-sm bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/30 text-[var(--status-danger)]">
          {errors.root.message}
        </div>
      )}

      <div>
        <FieldLabel>URL</FieldLabel>
        <input
          {...register('url')}
          placeholder="https://example.com/page"
          className={inputCls(!!errors.url)}
        />
        {errors.url && (
          <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.url.message}</p>
        )}
      </div>

      <div>
        <FieldLabel>Label (optional)</FieldLabel>
        <input
          {...register('label')}
          placeholder="Short description e.g. 'Homepage'"
          className={inputCls(!!errors.label)}
        />
        {errors.label && (
          <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.label.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Ahrefs fetch limit</FieldLabel>
          <input
            {...register('ahrefs_fetch_limit', { valueAsNumber: true })}
            type="number"
            min={1}
            max={1000}
            className={inputCls(!!errors.ahrefs_fetch_limit)}
          />
          <p className="mt-1 text-[0.65rem] text-[var(--text-muted)]">
            Max rows per Pull (1–1000). ไม่ใช่ KPI บน dashboard.
          </p>
          {errors.ahrefs_fetch_limit && (
            <p className="mt-1 text-xs text-[var(--status-danger)]">
              {errors.ahrefs_fetch_limit.message}
            </p>
          )}
        </div>
        <div>
          <FieldLabel>Sort Order</FieldLabel>
          <input
            {...register('sort_order', { valueAsNumber: true })}
            type="number"
            min={0}
            className={inputCls(!!errors.sort_order)}
          />
          {errors.sort_order && (
            <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.sort_order.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--blue)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Main client component ──────────────────────────────────────────────────────
interface UrlManagerClientProps {
  client: Client
  initialUrls: ClientUrl[]
}

export default function UrlManagerClient({ client, initialUrls }: UrlManagerClientProps) {
  const [urls, setUrls] = useState<ClientUrl[]>(initialUrls)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkFetchLimit, setBulkFetchLimit] = useState(30)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Add URL ──────────────────────────────────────────────────────────────────
  const handleAdd = async (data: UrlFormValues) => {
    const res = await fetch(`/api/clients/${client.slug}/urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json?.error ?? 'Failed to add URL')
    }
    const json = await res.json()
    setUrls((prev) => [...prev, json as ClientUrl])
    setShowAddDialog(false)
  }

  const handleBulkAdd = async () => {
    setBulkLoading(true)
    setBulkMessage(null)
    try {
      const res = await fetch(`/api/clients/${client.slug}/urls/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlsText: bulkText,
          ahrefs_fetch_limit: bulkFetchLimit,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBulkMessage(String(json?.error ?? 'Bulk add failed'))
        return
      }
      const newItems = (json?.items ?? []) as ClientUrl[]
      if (newItems.length) {
        setUrls((prev) => [...prev, ...newItems].sort((a, b) => a.sort_order - b.sort_order))
      }
      const skipCount = json?.skipped?.length ?? 0
      const created = json?.created ?? 0
      setBulkMessage(
        `Added ${created} URL(s).${skipCount > 0 ? ` Skipped ${skipCount} (duplicate or invalid).` : ''}`,
      )
      if (created > 0) {
        setBulkText('')
      }
    } catch {
      setBulkMessage('Network error — try again.')
    } finally {
      setBulkLoading(false)
    }
  }

  // ── Edit URL ─────────────────────────────────────────────────────────────────
  const handleEdit = async (urlId: string, data: UrlFormValues) => {
    const res = await fetch(`/api/clients/${client.slug}/urls/${urlId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json?.error ?? 'Failed to update URL')
    }
    const json = await res.json()
    setUrls((prev) =>
      prev.map((u) => (u.id === urlId ? (json as ClientUrl) : u)),
    )
    setEditingId(null)
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  const handleToggle = async (urlEntry: ClientUrl) => {
    setTogglingId(urlEntry.id)
    try {
      const res = await fetch(`/api/clients/${client.slug}/urls/${urlEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !urlEntry.is_active }),
      })
      if (res.ok) {
        setUrls((prev) =>
          prev.map((u) =>
            u.id === urlEntry.id ? { ...u, is_active: !u.is_active } : u,
          ),
        )
      }
    } finally {
      setTogglingId(null)
    }
  }

  const editingUrl = editingId ? urls.find((u) => u.id === editingId) : null

  return (
    <div className="space-y-4">
      {/* Add URL actions */}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setShowBulkDialog(true)
            setBulkMessage(null)
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--blue)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          <Layers size={15} strokeWidth={2} />
          Bulk add URLs
        </button>
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--blue)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Plus size={15} strokeWidth={2} />
          Add URL
        </button>
      </div>

      {/* Add URL dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md card-nerd p-6 mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Add URL</h3>
              <button
                onClick={() => setShowAddDialog(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <UrlForm
              onSubmit={handleAdd}
              onCancel={() => setShowAddDialog(false)}
              submitLabel="Add URL"
            />
          </div>
        </div>
      )}

      {showBulkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg card-nerd p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Bulk add URLs
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowBulkDialog(false)
                  setBulkMessage(null)
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
              One URL per line. Use full URLs (
              <code className="text-[var(--text-muted)]">https://…</code>) or paths
              relative to <strong className="text-[var(--text-primary)]">{client.domain}</strong>{' '}
              (e.g. <code className="text-[var(--text-muted)]">/blog/post-1</code>).
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5">
              URLs
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={12}
              placeholder={`https://${client.domain}/page-one\n/seo/\n/blog/article`}
              className="w-full px-3 py-2.5 rounded-lg text-sm font-mono bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--blue)] mb-4"
            />
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5">
                Ahrefs fetch limit (all new rows)
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={bulkFetchLimit}
                onChange={(e) => setBulkFetchLimit(Number(e.target.value) || 30)}
                className="w-full max-w-[120px] px-3 py-2 rounded-lg text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--blue)]"
              />
            </div>
            {bulkMessage && (
              <p
                className={cn(
                  'text-xs mb-3 rounded-lg px-3 py-2 border',
                  /^Added \d+ URL/.test(bulkMessage)
                    ? 'text-[var(--status-success)] bg-[var(--status-success)]/10 border-[var(--status-success)]/25'
                    : 'text-[var(--status-danger)] bg-[var(--status-danger)]/10 border-[var(--status-danger)]/25',
                )}
              >
                {bulkMessage}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={bulkLoading || !bulkText.trim()}
                onClick={handleBulkAdd}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--blue)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {bulkLoading && <Loader2 size={14} className="animate-spin" />}
                {bulkLoading ? 'Adding…' : 'Add all lines'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBulkDialog(false)
                  setBulkMessage(null)
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit URL dialog */}
      {editingId && editingUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md card-nerd p-6 mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Edit URL</h3>
              <button
                onClick={() => setEditingId(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <UrlForm
              defaultValues={{
                url: editingUrl.url,
                label: editingUrl.label ?? '',
                ahrefs_fetch_limit: editingUrl.ahrefs_fetch_limit,
                sort_order: editingUrl.sort_order,
              }}
              onSubmit={(data) => handleEdit(editingId, data)}
              onCancel={() => setEditingId(null)}
              submitLabel="Save Changes"
            />
          </div>
        </div>
      )}

      {/* URLs table */}
      <div className="card-nerd overflow-hidden">
        {urls.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)] italic">
            No URLs added yet. Click &quot;Add URL&quot; to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs uppercase tracking-wide border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 font-medium">URL / Label</th>
                  <th className="text-center px-4 py-3 font-medium">Fetch limit</th>
                  <th className="text-center px-4 py-3 font-medium">Sort</th>
                  <th className="text-center px-4 py-3 font-medium">Active</th>
                  <th className="text-center px-4 py-3 font-medium">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {urls.map((urlEntry) => (
                  <tr
                    key={urlEntry.id}
                    className={cn(
                      'bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] transition-colors',
                      !urlEntry.is_active && 'opacity-50',
                    )}
                  >
                    {/* URL + label */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2 min-w-0 max-w-md">
                        <DomainFavicon
                          domain={urlHostname(urlEntry.url) ?? client.domain}
                          size={20}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <a
                            href={urlEntry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--text-primary)] hover:text-[var(--blue)] transition-colors font-medium truncate"
                            title={urlEntry.url}
                          >
                            <span className="truncate">{urlPath(urlEntry.url)}</span>
                            <ExternalLink size={11} className="shrink-0 opacity-50" />
                          </a>
                          {urlEntry.label && (
                            <p className="text-xs text-[var(--text-muted)] truncate">
                              {urlEntry.label}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center text-[var(--text-secondary)] tabular-nums">
                      {urlEntry.ahrefs_fetch_limit}
                    </td>

                    {/* Sort order */}
                    <td className="px-4 py-3 text-center text-[var(--text-muted)]">
                      {urlEntry.sort_order}
                    </td>

                    {/* Active toggle */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(urlEntry)}
                        disabled={togglingId === urlEntry.id}
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                        title={urlEntry.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {urlEntry.is_active ? (
                          <ToggleRight size={20} className="text-[var(--status-success)]" />
                        ) : (
                          <ToggleLeft size={20} />
                        )}
                      </button>
                    </td>

                    {/* Edit button */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setEditingId(urlEntry.id)}
                        className="inline-flex items-center justify-center p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
                        title="Edit URL"
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
