import { Users, Zap, TrendingUp, Trophy } from 'lucide-react'
import { KpiCard } from './KpiCard'
import type { ClientWithLatestSnapshot } from '@/types'

interface SummaryStatsProps {
  clients: ClientWithLatestSnapshot[]
}

export function SummaryStats({ clients }: SummaryStatsProps) {
  const totalClients = clients.length

  const totalCitations = clients.reduce(
    (sum, c) => sum + (c.total_citations ?? 0),
    0,
  )

  const clientsWithPct = clients.filter((c) => c.kpi_pct !== null)
  const avgKpiPct =
    clientsWithPct.length > 0
      ? Math.round(
          clientsWithPct.reduce((sum, c) => sum + (c.kpi_pct ?? 0), 0) /
            clientsWithPct.length,
        )
      : 0

  const clientsAtTarget = clients.filter(
    (c) => c.kpi_pct !== null && c.kpi_pct >= 100,
  ).length

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <KpiCard
        label="Total Projects"
        value={totalClients}
        sub="Active accounts"
        color="default"
        icon={<Users size={18} />}
      />

      <KpiCard
        label="Total AI Citations"
        value={totalCitations.toLocaleString()}
        sub="Across all projects"
        color="blue"
        icon={<Zap size={18} />}
      />

      <KpiCard
        label="Avg KPI %"
        value={`${avgKpiPct}%`}
        sub="Mean across projects"
        color={avgKpiPct >= 100 ? 'success' : avgKpiPct >= 60 ? 'blue' : avgKpiPct >= 30 ? 'warning' : 'danger'}
        icon={<TrendingUp size={18} />}
      />

      <KpiCard
        label="Projects at Target"
        value={clientsAtTarget}
        sub={`of ${totalClients} total`}
        color="success"
        icon={<Trophy size={18} />}
      />
    </div>
  )
}
