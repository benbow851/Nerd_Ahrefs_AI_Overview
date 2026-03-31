'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, Database, Key } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Section card wrapper ───────────────────────────────────────────────────────
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="card-nerd p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && (
          <p className="text-xs text-[var(--text-secondary)] mt-1">{description}</p>
        )}
      </div>
      <div className="border-t border-[var(--border)] pt-4">{children}</div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'idle' | 'loading' | 'success' | 'error' }) {
  if (status === 'idle') return null

  const configs = {
    loading: {
      icon: <Loader2 size={13} className="animate-spin" />,
      label: 'Testing…',
      cls: 'bg-[var(--blue)]/10 text-[var(--blue)] border-[var(--blue)]/30',
    },
    success: {
      icon: <CheckCircle size={13} />,
      label: 'Connected',
      cls: 'bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/30',
    },
    error: {
      icon: <XCircle size={13} />,
      label: 'Failed',
      cls: 'bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/30',
    },
  }

  const c = configs[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        c.cls,
      )}
    >
      {c.icon}
      {c.label}
    </span>
  )
}

// ── Ahrefs API section ────────────────────────────────────────────────────────
function AhrefsApiSection() {
  const [testStatus, setTestStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleTest = async () => {
    setTestStatus('loading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/ahrefs/test')
      const json = await res.json().catch(() => ({}))
      if (json.connected === true) {
        setTestStatus('success')
      } else {
        setErrorMsg(json.message ?? 'Connection test failed')
        setTestStatus('error')
      }
    } catch {
      setErrorMsg('Network error — please try again.')
      setTestStatus('error')
    }
  }

  return (
    <SettingsSection
      title="Ahrefs API"
      description="Used to fetch organic keyword rankings and detect AI Overview citations."
    >
      <div className="space-y-4">
        {/* API key status indicator */}
        <div className="flex items-start gap-3">
          <Key size={16} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
          <div className="space-y-1 flex-1">
            <p className="text-sm text-[var(--text-primary)]">API Key</p>
            <p className="text-xs text-[var(--text-muted)]">
              Set{' '}
              <code className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] text-[11px]">
                AHREFS_API_KEY
              </code>{' '}
              in <code className="text-[11px] text-[var(--text-secondary)]">.env.local</code>, then
              restart <code className="text-[11px] text-[var(--text-secondary)]">npm run dev</code>.
              Pull Snapshot uses this key server-side.
            </p>
          </div>
        </div>

        {/* Test connection button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testStatus === 'loading'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] hover:border-[var(--border-strong)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {testStatus === 'loading' && <Loader2 size={14} className="animate-spin" />}
            Test Connection
          </button>

          <StatusBadge status={testStatus} />
        </div>

        {errorMsg && (
          <p className="text-xs text-[var(--status-danger)]">{errorMsg}</p>
        )}
      </div>
    </SettingsSection>
  )
}

// ── Seed demo data section ────────────────────────────────────────────────────
function SeedDataSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  )
  const [message, setMessage] = useState<string | null>(null)

  const handleSeed = async () => {
    if (
      !window.confirm(
        'This will insert demo projects and snapshot data into your database. Continue?',
      )
    )
      return

    setStatus('loading')
    setMessage(null)

    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const json = await res.json().catch(() => ({}))

      if (res.ok) {
        setStatus('success')
        setMessage(json?.message ?? 'Demo data seeded successfully.')
      } else {
        setStatus('error')
        setMessage(json?.error ?? 'Seeding failed.')
      }
    } catch {
      setStatus('error')
      setMessage('Network error — please try again.')
    }
  }

  return (
    <SettingsSection
      title="Demo Data"
      description="Populate the database with sample projects and snapshots for testing."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Database size={16} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
          <p className="text-sm text-[var(--text-secondary)]">
            Seeds 2 demo projects with 3 months of snapshot history. Safe to run
            multiple times — existing slugs will be skipped.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSeed}
            disabled={status === 'loading'}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'border disabled:opacity-60 disabled:cursor-not-allowed',
              status === 'error'
                ? 'border-[var(--status-danger)] bg-[var(--status-danger)]/10 text-[var(--status-danger)]'
                : status === 'success'
                ? 'border-[var(--status-success)] bg-[var(--status-success)]/10 text-[var(--status-success)]'
                : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
            )}
          >
            {status === 'loading' && <Loader2 size={14} className="animate-spin" />}
            {status === 'loading' ? 'Seeding…' : 'Seed Demo Data'}
          </button>

          <StatusBadge status={status} />
        </div>

        {message && (
          <p
            className={cn(
              'text-xs',
              status === 'error'
                ? 'text-[var(--status-danger)]'
                : 'text-[var(--status-success)]',
            )}
          >
            {message}
          </p>
        )}
      </div>
    </SettingsSection>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SettingsClient() {
  return (
    <div className="space-y-5">
      <AhrefsApiSection />
      <SeedDataSection />
    </div>
  )
}
