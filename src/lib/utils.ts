import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, startOfMonth, subDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calendar “today” in a specific IANA timezone as local Y/M/D parts.
 */
function calendarPartsInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const y = parseInt(parts.find(p => p.type === 'year')!.value, 10)
  const m = parseInt(parts.find(p => p.type === 'month')!.value, 10)
  const d = parseInt(parts.find(p => p.type === 'day')!.value, 10)
  return { y, m, d }
}

function ymdFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Default Ahrefs `date` for pulls: **yesterday** in Thailand civil date (Asia/Bangkok),
 * so Vercel (UTC) และเครื่อง local ได้วันเดียวกับที่มักใช้เช็ค Ahrefs
 * ตั้ง `NEXT_PUBLIC_SNAPSHOT_CALENDAR_TIMEZONE` (IANA) ได้ถ้าต้องการโซนอื่น
 */
export function getDefaultSnapshotDate(): string {
  const tz =
    (typeof process !== 'undefined' &&
      process.env.NEXT_PUBLIC_SNAPSHOT_CALENDAR_TIMEZONE) ||
    'Asia/Bangkok'
  const { y, m, d } = calendarPartsInTimeZone(new Date(), tz)
  const todayUtcMidnight = new Date(Date.UTC(y, m - 1, d))
  const yesterday = subDays(todayUtcMidnight, 1)
  return ymdFromParts(
    yesterday.getUTCFullYear(),
    yesterday.getUTCMonth() + 1,
    yesterday.getUTCDate()
  )
}

/** Returns the first day of a given month as YYYY-MM-DD */
export function getMonthStart(date: Date): string {
  return format(startOfMonth(date), 'yyyy-MM-dd')
}

/** Format a snapshot_date (e.g. "2026-03-01") to "March 2026" */
export function formatSnapshotMonth(date: string): string {
  return format(new Date(date), 'MMMM yyyy')
}

/** Delay helper for rate limiting */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Generate a URL-safe slug from a string */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Strip protocol, path, query, and leading www. for root-domain entry fields.
 */
export function normalizeRootDomain(raw: string): string {
  let s = raw.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  const host = s.split('/')[0]?.split('?')[0]?.split('#')[0] ?? ''
  return host.replace(/^www\./, '')
}

/**
 * For bulk URL paste: full URLs pass through; paths like /blog/post become https://{rootDomain}/blog/post
 */
export function resolveBulkUrlLine(
  line: string,
  rootDomain: string
): string | null {
  const t = line.trim()
  if (!t) return null
  const domain = rootDomain.replace(/^www\./i, '').replace(/\/$/, '')
  try {
    if (/^https?:\/\//i.test(t)) {
      const u = new URL(t)
      return u.toString()
    }
    const path = t.startsWith('/') ? t : `/${t}`
    return new URL(path, `https://${domain}`).toString()
  } catch {
    return null
  }
}

/** Hostname for favicon helpers */
export function urlHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/** Calculate KPI percentage, clamped to 0–999 */
export function kpiPercent(citations: number, target: number): number {
  if (target === 0) return 0
  return Math.round((citations / target) * 100)
}

/** Return tailwind color class based on KPI delta */
export function deltaColorClass(delta: number, target: number): string {
  if (delta >= 0) return 'text-[var(--status-success)]'
  const pct = ((target + delta) / target) * 100
  if (pct >= 60) return 'text-[var(--status-warning)]'
  return 'text-[var(--status-danger)]'
}

/** Truncate URL to just path for display */
export function urlPath(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname
  } catch {
    return url
  }
}

/** Format large numbers with K/M suffix */
export function formatVolume(vol: number | null): string {
  if (vol === null || vol === undefined) return '—'
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
  return String(vol)
}
