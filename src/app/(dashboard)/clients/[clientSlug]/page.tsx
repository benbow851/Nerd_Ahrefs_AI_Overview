import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getClientBySlug,
  getLatestSnapshot,
  getClientUrls,
  buildUrlKpiRows,
} from '@/lib/queries'
import { getDefaultSnapshotDate, kpiPercent } from '@/lib/utils'
import Topbar from '@/components/layout/Topbar'
import SnapshotHeader from '@/components/client-detail/SnapshotHeader'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { OverallProgressBar } from '@/components/dashboard/OverallProgressBar'
import UrlKpiTable from '@/components/client-detail/UrlKpiTable'
import PullSnapshotButton from '@/components/client-detail/PullSnapshotButton'
import { Target, Zap, TrendingUp, Globe, LinkIcon, Pencil } from 'lucide-react'

interface ClientDetailPageProps {
  params: { clientSlug: string }
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch client
  const client = await getClientBySlug(supabase, params.clientSlug).catch(() => null)
  if (!client) notFound()

  // Fetch snapshot + URLs in parallel
  const [snapshot, clientUrls] = await Promise.all([
    getLatestSnapshot(supabase, client.id).catch(() => null),
    getClientUrls(supabase, client.id).catch(() => []),
  ])

  const allRows = buildUrlKpiRows(snapshot, clientUrls)

  // Split: published = rows that have any keyword data; pending = no keyword data
  const publishedRows = allRows.filter((r) => r.keywords.length > 0)
  const pendingRows = allRows.filter((r) => r.keywords.length === 0)

  const publishedCount = publishedRows.length
  const totalUrlCount = clientUrls.length
  const totalCitations = allRows.reduce((s, r) => s + r.aiCitations, 0)
  const kpiTarget = client.kpi_keyword_target ?? 0
  const overallKpiPct = kpiPercent(totalCitations, kpiTarget)
  const defaultPullDate = getDefaultSnapshotDate()

  return (
    <>
      <Topbar title={client.name} userEmail={user.email ?? ''} />

      <div className="flex-1 p-6 space-y-6">
        {/* Header row: snapshot info + actions */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SnapshotHeader
            client={client}
            snapshot={snapshot}
            publishedUrlCount={publishedCount}
            totalUrlCount={totalUrlCount}
          />
          <div className="flex flex-wrap items-start justify-end gap-3">
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
              Manage URLs
            </Link>
            <PullSnapshotButton
              clientId={client.id}
              defaultPullDate={defaultPullDate}
            />
          </div>
        </div>

        {/* 4 KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            label="KPI Target"
            value={kpiTarget > 0 ? kpiTarget.toLocaleString() : '—'}
            sub="Project keyword goal"
            color="default"
            icon={<Target size={18} />}
          />
          <KpiCard
            label="AI Citations"
            value={totalCitations > 0 ? totalCitations.toLocaleString() : '0'}
            sub="This snapshot"
            color="blue"
            icon={<Zap size={18} />}
          />
          <KpiCard
            label="Overall %"
            value={kpiTarget > 0 ? `${overallKpiPct}%` : '—'}
            sub="Citations / target"
            color={
              kpiTarget === 0
                ? 'default'
                : overallKpiPct >= 100
                ? 'success'
                : overallKpiPct >= 60
                ? 'blue'
                : overallKpiPct >= 30
                ? 'warning'
                : 'danger'
            }
            icon={<TrendingUp size={18} />}
          />
          <KpiCard
            label="URLs Published"
            value={`${publishedCount}/${totalUrlCount}`}
            sub="With keyword data"
            color="default"
            icon={<Globe size={18} />}
          />
        </div>

        {/* Overall progress bar */}
        {kpiTarget > 0 && (
          <div className="card-nerd p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
              Overall Progress
            </h3>
            <OverallProgressBar
              citations={totalCitations}
              kpiTarget={kpiTarget}
              publishedUrlCount={publishedCount}
              totalUrlCount={totalUrlCount}
            />
          </div>
        )}

        <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-3xl">
          <strong className="text-[var(--text-secondary)]">Publish</strong> ในระบบนี้หมายถึง
          URL นั้นมี <strong className="text-[var(--text-secondary)]">keyword data จาก snapshot ล่าสุด</strong>{' '}
          (หลังกด Pull Snapshot สำเร็จ) — ไม่ใช่ปุ่มแยกใน Manage URLs.
          ปุ่ม <strong className="text-[var(--text-secondary)]">Active</strong> ใน Manage URLs
          กำหนดว่า URL นั้นจะถูกดึงจาก Ahrefs ตอน Pull หรือไม่ (
          <span className="italic">ปิด = ข้ามการ fetch</span>).
        </p>

        {/* Published URLs table */}
        <UrlKpiTable
          rows={publishedRows}
          title={`URLs ที่ Publish แล้ว (${publishedCount}/${totalUrlCount})`}
          emptyLabel="No published URLs with keyword data yet."
        />

        {/* Pending URLs table */}
        <UrlKpiTable
          rows={pendingRows}
          title={`URLs ที่ยังไม่ publish (${pendingRows.length})`}
          emptyLabel={
            totalUrlCount === 0
              ? 'ยังไม่มี URL — ไปที่ Manage URLs เพื่อเพิ่ม'
              : 'ทุก URL มี keyword data ใน snapshot นี้แล้ว'
          }
        />
      </div>
    </>
  )
}
