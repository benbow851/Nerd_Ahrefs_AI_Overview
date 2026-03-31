'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface TrendDataPoint {
  /** First day of report month (YYYY-MM-01), Bangkok calendar month from `pulled_at` */
  report_month: string
  total_citations: number | null
  kpi_target: number | null
}

interface TrendChartProps {
  data: TrendDataPoint[]
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
interface TooltipPayloadEntry {
  name: string
  value: number | null
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  let monthLabel = label ?? ''
  try {
    monthLabel = format(parseISO(label ?? ''), 'MMMM yyyy')
  } catch {
    // keep original label
  }

  return (
    <div
      className="rounded-lg border border-[var(--border-strong)] px-4 py-3 shadow-xl text-sm"
      style={{ background: 'var(--bg-card)', fontFamily: "'Poppins', sans-serif" }}
    >
      <p className="font-semibold text-[var(--text-primary)] mb-2">{monthLabel}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-[var(--text-secondary)]">{entry.name}:</span>
          <span className="font-medium text-[var(--text-primary)]">
            {entry.value ?? '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── X-axis tick formatter ──────────────────────────────────────────────────────
function formatXAxis(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM yy')
  } catch {
    return dateStr
  }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TrendChart({ data }: TrendChartProps) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-[var(--text-muted)] italic">
        Not enough data for a monthly trend — need pulls in at least two calendar
        months (Bangkok).
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 20, left: 0, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(223,230,239,0.07)"
          vertical={false}
        />

        <XAxis
          dataKey="report_month"
          tickFormatter={formatXAxis}
          tick={{
            fill: 'var(--text-muted)',
            fontSize: 11,
            fontFamily: "'Poppins', sans-serif",
          }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />

        <YAxis
          tick={{
            fill: 'var(--text-muted)',
            fontSize: 11,
            fontFamily: "'Poppins', sans-serif",
          }}
          axisLine={false}
          tickLine={false}
          width={32}
          allowDecimals={false}
        />

        <Tooltip content={<CustomTooltip />} />

        <Legend
          wrapperStyle={{
            fontSize: 11,
            fontFamily: "'Poppins', sans-serif",
            color: 'var(--text-secondary)',
            paddingTop: 8,
          }}
        />

        {/* Citations line */}
        <Line
          type="monotone"
          dataKey="total_citations"
          name="AI Citations"
          stroke="#44a2a5"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#44a2a5', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#44a2a5', strokeWidth: 0 }}
          connectNulls
        />

        {/* KPI target line — dashed */}
        <Line
          type="monotone"
          dataKey="kpi_target"
          name="KPI Target"
          stroke="#4d62a7"
          strokeWidth={1.75}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 5, fill: '#4d62a7', strokeWidth: 0 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
