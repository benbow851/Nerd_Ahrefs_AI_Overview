import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getClientBySlug,
  getLatestSnapshot,
  getSnapshotById,
  getClientUrls,
  buildUrlKpiRows,
  getClientMonthlyReportHistory,
  getEverFetchedUrlIds,
} from '@/lib/queries'
import {
  computeKpiPercent,
  isKpiPassed,
  isLegacyCommitment,
  kpiColorThreshold,
  kpiDenominator,
  COMMITMENT_TYPE_LABELS,
} from '@/lib/kpi-calculator'
import { countActiveTrackedKeywords } from '@/lib/tracked-keywords'
import {
  formatSnapshotMonth,
  getDefaultSnapshotDate,
  kpiPercent,
} from '@/lib/utils'
import { pulledAtToMonthKeyBangkok } from '@/lib/report-month'
import Topbar from '@/components/layout/Topbar'
import SnapshotHeader from '@/components/client-detail/SnapshotHeader'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { DeltaIndicator } from '@/components/dashboard/DeltaIndicator'
import { OverallProgressBar } from '@/components/dashboard/OverallProgressBar'
import { PublishedProgressBar } from '@/components/dashboard/PublishedProgressBar'
import UrlKpiTable from '@/components/client-detail/UrlKpiTable'
import MonthSelector from '@/components/client-detail/MonthSelector'
import PullSnapshotButton from '@/components/client-detail/PullSnapshotButton'
import { Target, Zap, TrendingUp, Globe, LinkIcon, Pencil } from 'lucide-react'

interface ClientDetailPageProps {
  params: { clientSlug: string }
  searchParams: { month?: string }
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: ClientDetailPageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const client = await getClientBySlug(supabase, params.clientSlug).catch(() => null)
  if (!client) notFound()

  const commitmentType = client.commitment_type ?? 'ai_citations'
  const legacy = isLegacyCommitment(commitmentType)

  const [history, clientUrls, everFetchedUrlIds, liveTrackedCount] = await Promise.all([
    getClientMonthlyReportHistory(supabase, client.id, 24).catch(() => []),
    getClientUrls(supabase, client.id).catch(() => []),
    getEverFetchedUrlIds(supabase, client.id).catch(() => new Set<string>()),
    legacy
      ? countActiveTrackedKeywords(supabase, client.id).catch(() => 0)
      : Promise.resolve(0),
  ])

  // ── Mode + month selection ───────────────────────────────────────────────────
  const requestedMonth = searchParams?.month
  const isAllMonths = requestedMonth === 'all' && history.length > 1

  const latestMonthRow =
    history.length > 0 ? history[history.length - 1] : null
  const latestPrevMonthRow =
    history.length >= 2 ? history[history.length - 2] : null

  // The month feeding KPI cards: latest in All-months mode, otherwise the
  // user's selected month (or the latest by default).
  const kpiMonthRow = isAllMonths
    ? latestMonthRow
    : (requestedMonth && history.find((h) => h.month_key === requestedMonth)) ||
      latestMonthRow

  const kpiPrevMonthRow = isAllMonths
    ? latestPrevMonthRow
    : kpiMonthRow
    ? (() => {
        const earlier = history.filter((h) => h.month_key < kpiMonthRow.month_key)
        return earlier.length > 0 ? earlier[earlier.length - 1] : null
      })()
    : null

  // ── Fetch snapshot data ──────────────────────────────────────────────────────
  // - Single-month mode: load just the selected + previous snapshots.
  // - All-months mode: load every monthly snapshot in parallel for the
  //   grouped tables (newest first), and reuse the latest for KPI cards.
  let kpiSnapshot: Awaited<ReturnType<typeof getSnapshotById>> = null
  let kpiPrevSnapshot: Awaited<ReturnType<typeof getSnapshotById>> = null
  type MonthGroup = {
    month: (typeof history)[number]
    snapshot: Awaited<ReturnType<typeof getSnapshotById>>
    previousSnapshot: Awaited<ReturnType<typeof getSnapshotById>>
  }
  let monthlyGroups: MonthGroup[] = []

  if (isAllMonths) {
    const snapshots = await Promise.all(
      history.map((h) => getSnapshotById(supabase, h.id).catch(() => null)),
    )
    monthlyGroups = history.map((h, i) => ({
      month: h,
      snapshot: snapshots[i],
      previousSnapshot: i > 0 ? snapshots[i - 1] : null,
    }))
    kpiSnapshot = snapshots[snapshots.length - 1] ?? null
    kpiPrevSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null
  } else {
    const [snap, prevSnap] = await Promise.all([
      kpiMonthRow
        ? getSnapshotById(supabase, kpiMonthRow.id).catch(() => null)
        : getLatestSnapshot(supabase, client.id).catch(() => null),
      kpiPrevMonthRow
        ? getSnapshotById(supabase, kpiPrevMonthRow.id).catch(() => null)
        : Promise.resolve(null),
    ])
    kpiSnapshot = snap
    kpiPrevSnapshot = prevSnap
  }

  // ── KPI rows (always per-month — never aggregated) ───────────────────────────
  const kpiRows = buildUrlKpiRows(kpiSnapshot, clientUrls, {
    previousSnapshot: kpiPrevSnapshot,
    everFetchedUrlIds,
  })

  // For Published KPI in All-months mode, count URLs that have data IN the
  // latest snapshot specifically (not the lifetime everFetched set).
  const publishedCountForKpi = isAllMonths
    ? kpiRows.filter((r) => r.keywords.length > 0).length
    : kpiRows.filter((r) => r.everFetched).length

  const totalUrlCount = clientUrls.length
  const focusUrlCount = client.focus_url_count ?? 0
  const focusUrlDenominator = focusUrlCount > 0 ? focusUrlCount : totalUrlCount
  const totalCitations = kpiRows.reduce((s, r) => s + r.aiCitations, 0)
  const kpiTarget = client.kpi_keyword_target ?? 0
  const totalTracked =
    kpiSnapshot?.total_tracked_keywords ?? liveTrackedCount ?? 0
  const kpiDenom = kpiDenominator(client, totalTracked)
  const overallKpiPct = computeKpiPercent(totalCitations, client, totalTracked)
  const passThreshold = kpiColorThreshold(client)
  const kpiPassed = isKpiPassed(totalCitations, client, totalTracked)
  const defaultPullDate = getDefaultSnapshotDate()

  const previousMonthLabel = kpiPrevMonthRow
    ? formatSnapshotMonth(kpiPrevMonthRow.report_month)
    : null
  const kpiMonthLabel = kpiMonthRow
    ? formatSnapshotMonth(kpiMonthRow.report_month)
    : null
  const selectedMonthKey = isAllMonths
    ? 'all'
    : kpiMonthRow?.month_key ??
      (kpiSnapshot?.pulled_at
        ? pulledAtToMonthKeyBangkok(kpiSnapshot.pulled_at)
        : '')

  const citationsPrev = kpiPrevMonthRow?.total_citations ?? null
  const citationsDelta =
    citationsPrev !== null && kpiSnapshot ? totalCitations - citationsPrev : null

  const previousKpiPct =
    kpiPrevMonthRow && kpiPrevMonthRow.total_citations !== null
      ? legacy
        ? computeKpiPercent(
            kpiPrevMonthRow.total_citations,
            client,
            kpiPrevMonthRow.total_tracked_keywords
          )
        : kpiPrevMonthRow.kpi_target
          ? kpiPercent(
              kpiPrevMonthRow.total_citations,
              kpiPrevMonthRow.kpi_target
            )
          : null
      : null
  const kpiPctDelta =
    previousKpiPct !== null && kpiDenom > 0 && kpiSnapshot
      ? overallKpiPct - previousKpiPct
      : null

  // ── Single-month tables (only used outside All-months mode) ──────────────────
  const singleModePublishedRows = isAllMonths
    ? []
    : kpiRows.filter((r) => r.everFetched)
  const singleModePendingRows = isAllMonths
    ? []
    : kpiRows.filter((r) => !r.everFetched)

  return (
    <>
      <Topbar title={client.name} userEmail={user.email ?? ''} />

      <div className="flex-1 p-6 space-y-6">
        {/* Header row: snapshot info + actions */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SnapshotHeader
            client={client}
            snapshot={kpiSnapshot}
            publishedUrlCount={publishedCountForKpi}
            focusUrlDenominator={focusUrlDenominator}
          />
          <div className="flex flex-wrap items-start justify-end gap-3">
            {history.length > 0 && (
              <MonthSelector
                options={history}
                current={selectedMonthKey}
              />
            )}
            <Link
              href={`/clients/${client.slug}/edit`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--blue)] transition-colors self-start"
            >
              <Pencil size={14} strokeWidth={1.75} />
              Edit project
            </Link>
            <Link
              href={`/clients/${client.slug}/urls`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--blue)] transition-colors self-start"
            >
              <LinkIcon size={14} strokeWidth={1.75} />
              {legacy ? 'Manage keywords' : 'Manage URLs'}
            </Link>
            <PullSnapshotButton
              clientId={client.id}
              defaultPullDate={defaultPullDate}
            />
          </div>
        </div>

        {/* 4 KPI cards — always sourced from kpiMonthRow (latest in All-months mode) */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            label={legacy ? 'Pass threshold' : 'KPI Target'}
            value={
              legacy
                ? `${Number(client.kpi_pass_threshold ?? 70)}%`
                : kpiTarget > 0
                ? kpiTarget.toLocaleString()
                : '—'
            }
            sub={
              legacy
                ? COMMITMENT_TYPE_LABELS.legacy_main_longtail
                : 'Project keyword goal'
            }
            color="default"
            icon={<Target size={18} />}
          />
          <KpiCard
            label={legacy ? 'Cited keywords' : 'AI Citations'}
            value={
              legacy
                ? `${totalCitations}/${totalTracked || '—'}`
                : totalCitations > 0
                ? totalCitations.toLocaleString()
                : '0'
            }
            sub={
              kpiMonthLabel
                ? `${kpiMonthLabel} snapshot`
                : 'This snapshot'
            }
            color="blue"
            icon={<Zap size={18} />}
            footer={
              <DeltaIndicator
                delta={citationsDelta}
                comparedTo={previousMonthLabel}
              />
            }
          />
          <KpiCard
            label="Overall %"
            value={kpiDenom > 0 ? `${overallKpiPct}%` : '—'}
            sub={
              legacy
                ? kpiPassed
                  ? 'PASS — AI Overview cited'
                  : `Need ≥ ${passThreshold}%`
                : 'Citations / target'
            }
            color={
              kpiDenom === 0
                ? 'default'
                : kpiPassed
                ? 'success'
                : overallKpiPct >= passThreshold * 0.85
                ? 'warning'
                : 'danger'
            }
            icon={<TrendingUp size={18} />}
            footer={
              <DeltaIndicator
                delta={kpiPctDelta}
                suffix="%"
                comparedTo={previousMonthLabel}
              />
            }
          />
          <KpiCard
            label="URLs Published"
            value={`${publishedCountForKpi}/${focusUrlDenominator}`}
            sub={
              focusUrlCount > 0
                ? 'Published / focus URL count'
                : 'Add focus URL count in settings'
            }
            color="default"
            icon={<Globe size={18} />}
          />
        </div>

        {/* Progress bars */}
        <div
          className={
            kpiTarget > 0
              ? 'grid grid-cols-1 lg:grid-cols-2 gap-4'
              : 'grid grid-cols-1 gap-4'
          }
        >
          {kpiTarget > 0 && (
            <div className="card-nerd p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
                Overall Progress
              </h3>
              <OverallProgressBar
                citations={totalCitations}
                kpiTarget={kpiTarget}
                publishedUrlCount={publishedCountForKpi}
                totalUrlCount={focusUrlDenominator}
              />
            </div>
          )}
          <div className="card-nerd p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
              Published Progress
            </h3>
            <PublishedProgressBar
              publishedUrlCount={publishedCountForKpi}
              focusUrlCount={focusUrlCount}
              fallbackTotalUrlCount={totalUrlCount}
            />
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-3xl">
          <strong className="text-[var(--text-secondary)]">Publish</strong> ในระบบนี้หมายถึง
          URL นั้นถูก <strong className="text-[var(--text-secondary)]">Fetch อย่างน้อย 1 ครั้ง</strong>{' '}
          (มี keyword data จาก snapshot ใดก็ตาม) — ไม่ต้องมี AI Overview ก็นับเป็น Published.
          ปุ่ม <strong className="text-[var(--text-secondary)]">Active</strong> ใน Manage URLs
          กำหนดว่า URL นั้นจะถูกดึงจาก Ahrefs ตอน Pull หรือไม่ (
          <span className="italic">ปิด = ข้ามการ fetch</span>).
        </p>

        {/* Tables: All-months → one block per month, newest first.
            Single-month → existing Published / Pending split. */}
        {isAllMonths ? (
          <>
            {[...monthlyGroups].reverse().map((group) => {
              const monthLabel = formatSnapshotMonth(group.month.report_month)
              const rows = buildUrlKpiRows(group.snapshot, clientUrls, {
                previousSnapshot: group.previousSnapshot,
                everFetchedUrlIds,
              })
              const monthPublished = rows.filter((r) => r.keywords.length > 0)
              return (
                <UrlKpiTable
                  key={group.month.month_key}
                  rows={monthPublished}
                  storageKey={`${client.slug}:month`}
                  showMissingKeywords={!!group.previousSnapshot}
                  title={`${monthLabel} — ${monthPublished.length} URL${monthPublished.length === 1 ? '' : 's'} with data`}
                  emptyLabel={`No URLs returned keywords in ${monthLabel}.`}
                />
              )
            })}
          </>
        ) : (
          <>
            <UrlKpiTable
              rows={singleModePublishedRows}
              storageKey={`${client.slug}:published`}
              showMissingKeywords={!!kpiPrevMonthRow}
              title={
                kpiMonthLabel
                  ? `Published URLs — ${kpiMonthLabel} (${publishedCountForKpi}/${focusUrlDenominator})`
                  : `Published URLs (${publishedCountForKpi}/${focusUrlDenominator})`
              }
              emptyLabel="ยังไม่มี URL ที่เคยถูก fetch — กด Pull Snapshot เพื่อเริ่ม"
            />
            <UrlKpiTable
              rows={singleModePendingRows}
              storageKey={`${client.slug}:pending`}
              title={`URLs ที่ยังไม่เคย fetch (${singleModePendingRows.length})`}
              emptyLabel={
                totalUrlCount === 0
                  ? 'ยังไม่มี URL — ไปที่ Manage URLs เพื่อเพิ่ม'
                  : 'ทุก URL ถูก fetch อย่างน้อย 1 ครั้งแล้ว'
              }
            />
          </>
        )}
      </div>
    </>
  )
}
