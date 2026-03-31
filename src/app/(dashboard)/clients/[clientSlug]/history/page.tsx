import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getClientBySlug, getClientMonthlyReportHistory } from '@/lib/queries'
import { formatSnapshotMonth, kpiPercent } from '@/lib/utils'
import Topbar from '@/components/layout/Topbar'
import TrendChart from '@/components/client-detail/TrendChart'

interface HistoryPageProps {
  params: { clientSlug: string }
}

export default async function ClientHistoryPage({ params }: HistoryPageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const client = await getClientBySlug(supabase, params.clientSlug).catch(() => null)
  if (!client) notFound()

  const history = await getClientMonthlyReportHistory(supabase, client.id, 12).catch(
    () => [],
  )

  const formatPulledBangkok = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  return (
    <>
      <Topbar title={`${client.name} — History`} userEmail={user.email ?? ''} />

      <div className="flex-1 p-6 space-y-6">
        {/* Back link */}
        <Link
          href={`/clients/${client.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />
          Back to {client.name}
        </Link>

        <div>
          <h1
            className="text-xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Citation Trend
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Up to {history.length} report month{history.length !== 1 ? 's' : ''} for{' '}
            <span className="text-[var(--text-primary)]">{client.domain}</span>
            {' '}
            — grouped by fetch time (Asia/Bangkok); multiple pulls in one month keep the
            latest only.
          </p>
        </div>

        {/* Trend chart */}
        <div className="card-nerd p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-4">
            AI Citations vs KPI Target
          </h2>
          <TrendChart data={history} />
        </div>

        {/* Snapshot history table */}
        <div className="card-nerd overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Monthly report history
            </h2>
          </div>

          {history.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)] italic">
              No snapshot data yet. Pull from the project overview.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs uppercase tracking-wide border-b border-[var(--border)]">
                    <th className="text-left px-5 py-3 font-medium">Report month</th>
                    <th className="text-left px-4 py-3 font-medium">Ahrefs date</th>
                    <th className="text-left px-4 py-3 font-medium">Fetched (BKK)</th>
                    <th className="text-center px-4 py-3 font-medium">URLs</th>
                    <th className="text-center px-4 py-3 font-medium">Citations</th>
                    <th className="text-center px-4 py-3 font-medium">Target</th>
                    <th className="text-center px-4 py-3 font-medium">KPI %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {[...history].reverse().map((snap) => {
                    const pct =
                      snap.kpi_target && snap.total_citations !== null
                        ? kpiPercent(snap.total_citations, snap.kpi_target)
                        : null

                    const pctColor =
                      pct === null
                        ? 'text-[var(--text-muted)]'
                        : pct >= 100
                        ? 'text-[var(--status-success)]'
                        : pct >= 60
                        ? 'text-[var(--blue)]'
                        : pct >= 30
                        ? 'text-[var(--status-warning)]'
                        : 'text-[var(--status-danger)]'

                    return (
                      <tr
                        key={snap.id}
                        className="bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <td className="px-5 py-3 font-medium text-[var(--text-primary)]">
                          {formatSnapshotMonth(snap.report_month)}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                          {snap.snapshot_date ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap text-xs">
                          {formatPulledBangkok(snap.pulled_at)}
                        </td>
                        <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                          {snap.total_urls ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">
                          {snap.total_citations ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                          {snap.kpi_target ?? '—'}
                        </td>
                        <td className={`px-4 py-3 text-center font-semibold tabular-nums ${pctColor}`}>
                          {pct !== null ? `${pct}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
