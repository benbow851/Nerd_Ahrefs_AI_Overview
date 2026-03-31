'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { cn, getDefaultSnapshotDate } from '@/lib/utils'

interface PullSnapshotButtonProps {
  clientId: string
  /** YYYY-MM-DD — matches server getDefaultSnapshotDate() */
  defaultPullDate: string
}

type PullStatus = 'idle' | 'loading' | 'success' | 'error'

export default function PullSnapshotButton({
  clientId,
  defaultPullDate,
}: PullSnapshotButtonProps) {
  const [pullDate, setPullDate] = useState(defaultPullDate)
  const [status, setStatus] = useState<PullStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastPulledDate, setLastPulledDate] = useState<string | null>(null)

  const handlePull = async () => {
    setStatus('loading')
    setErrorMsg(null)
    setLastPulledDate(null)

    try {
      const res = await fetch('/api/snapshots/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, date: pullDate }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data?.error ?? 'Pull failed')
        setStatus('error')
        return
      }

      const data = await res.json().catch(() => ({}))
      if (data?.snapshotDate) setLastPulledDate(data.snapshotDate as string)
      setStatus('success')
      setTimeout(() => {
        window.location.reload()
      }, 1200)
    } catch {
      setErrorMsg('Network error — please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-col items-end gap-1 text-right">
        <label className="text-[0.65rem] uppercase tracking-wide text-[var(--text-muted)]">
          Ahrefs <code className="text-[var(--text-secondary)]">date</code>{' '}
          (YYYY-MM-DD)
        </label>
        <input
          type="date"
          value={pullDate}
          onChange={e => setPullDate(e.target.value)}
          disabled={status === 'loading'}
          className={cn(
            'rounded-lg border border-[var(--border)] bg-[var(--bg-card)]',
            'text-xs text-[var(--text-primary)] px-2 py-1.5',
            'focus:outline-none focus:ring-1 focus:ring-[var(--blue)]',
            'disabled:opacity-60',
          )}
        />
        <button
          type="button"
          onClick={() => setPullDate(getDefaultSnapshotDate())}
          disabled={status === 'loading'}
          className="text-[0.65rem] text-[var(--blue)] hover:underline disabled:opacity-50"
        >
          ใช้เมื่อวาน (Bangkok)
        </button>
        <p className="text-[0.65rem] text-[var(--text-muted)] max-w-[260px]">
          จำนวนแถวต่อ URL = ค่า Fetch limit ใน Manage URLs (สูงสุด 1000 ต่อ Ahrefs)
        </p>
      </div>

      <button
        onClick={handlePull}
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
        {status === 'loading' && (
          <RefreshCw size={14} className="animate-spin" />
        )}
        {status === 'success' && <CheckCircle size={14} />}
        {status === 'error' && <AlertCircle size={14} />}
        {status === 'idle' && <RefreshCw size={14} strokeWidth={1.75} />}

        {status === 'loading'
          ? `Pulling ${pullDate}…`
          : status === 'success'
          ? lastPulledDate
            ? `Done — ${lastPulledDate}`
            : 'Done!'
          : status === 'error'
          ? 'Retry Pull'
          : `Pull Snapshot (${pullDate})`}
      </button>

      {errorMsg && (
        <p className="text-xs text-[var(--status-danger)] max-w-[240px] text-right">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
