import { cn } from '@/lib/utils'

type KpiCardColor = 'default' | 'blue' | 'success' | 'warning' | 'danger'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  color?: KpiCardColor
  icon?: React.ReactNode
}

const valueColorMap: Record<KpiCardColor, string> = {
  default: 'text-[var(--cloud)]',
  blue:    'text-[#4d62a7]',
  success: 'text-[#44a2a5]',
  warning: 'text-[#f7991a]',
  danger:  'text-[#bf415c]',
}

export function KpiCard({ label, value, sub, color = 'default', icon }: KpiCardProps) {
  return (
    <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
      {icon && (
        <div className="absolute top-4 right-4 text-[var(--text-muted)]">
          {icon}
        </div>
      )}

      <p
        className={cn(
          'font-[700] leading-none tracking-tight',
          valueColorMap[color],
        )}
        style={{ fontSize: '2.5rem', fontFamily: 'Poppins, sans-serif' }}
      >
        {value}
      </p>

      <p className="mt-2 text-xs text-[var(--text-muted)] uppercase tracking-wide">
        {label}
      </p>

      {sub && (
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{sub}</p>
      )}
    </div>
  )
}
