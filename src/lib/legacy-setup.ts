import { resolveBulkUrlLine } from '@/lib/utils'
import type { LegacyUrlGroupInput } from '@/types'

/**
 * Parse legacy bulk setup lines:
 *   URL | Main Keyword | longtail1, longtail2
 * Longtail segment is optional.
 */
export function parseLegacySetupText(
  text: string,
  rootDomain: string
): { groups: LegacyUrlGroupInput[]; errors: string[] } {
  const groups: LegacyUrlGroupInput[] = []
  const errors: string[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const parts = line.split('|').map((p) => p.trim())
    if (parts.length < 2) {
      errors.push(`Invalid line (need URL | Main Keyword): ${line}`)
      continue
    }

    const [urlPart, mainKeyword, longtailPart = ''] = parts
    const resolvedUrl = resolveBulkUrlLine(urlPart, rootDomain)
    if (!resolvedUrl) {
      errors.push(`Invalid URL: ${urlPart}`)
      continue
    }
    if (!mainKeyword) {
      errors.push(`Missing Main Keyword for ${urlPart}`)
      continue
    }

    const longtail_keywords = longtailPart
      .split(/[,;]/)
      .map((k) => k.trim())
      .filter(Boolean)

    groups.push({
      url: resolvedUrl,
      main_keyword: mainKeyword,
      longtail_keywords,
    })
  }

  return { groups, errors }
}
