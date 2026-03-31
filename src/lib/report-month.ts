/**
 * Calendar month key (YYYY-MM) for a timestamp in Asia/Bangkok.
 * Used to group snapshot pulls into monthly dashboard / report rows.
 */
export function pulledAtToMonthKeyBangkok(isoOrDate: string): string {
  const d = new Date(isoOrDate)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  return `${y}-${m}`
}

/** First day of month as YYYY-MM-DD for charts (parseISO-safe). */
export function monthKeyToReportMonthIso(ym: string): string {
  return `${ym}-01`
}
