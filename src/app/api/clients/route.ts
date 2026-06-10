import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { parseLegacySetupText } from '@/lib/legacy-setup'
import { normalizeRootDomain, resolveBulkUrlLine } from '@/lib/utils'

export const revalidate = 300

const legacyUrlGroupSchema = z.object({
  url: z.string().min(1),
  main_keyword: z.string().min(1).max(200),
  longtail_keywords: z.array(z.string().min(1).max(200)).max(100).default([]),
})

const createClientSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  slug: z.string().min(1),
  commitment_type: z
    .enum(['ai_citations', 'legacy_main_longtail'])
    .default('ai_citations'),
  kpi_pass_threshold: z.number().min(1).max(100).default(70),
  kpi_keyword_target: z.number().int().min(1).max(9_999_999).default(30),
  focus_url_count: z.number().int().min(0).max(9_999_999).default(0),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  folder: z.string().max(80).nullable().optional(),
  bulk_urls_text: z.string().optional(),
  bulk_urls_fetch_limit: z.number().int().min(1).max(1000).default(30),
  legacy_url_groups: z.array(legacyUrlGroupSchema).optional(),
  legacy_setup_text: z.string().optional(),
})

export async function GET() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('clients_with_latest_snapshot')
    .select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createClientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const admin = createAdminClient()
  const {
    bulk_urls_text,
    bulk_urls_fetch_limit,
    folder,
    legacy_url_groups,
    legacy_setup_text,
    ...clientPayload
  } = parsed.data

  const rootDomain = normalizeRootDomain(clientPayload.domain)
  let legacyGroups = (legacy_url_groups ?? []).map((g) => ({
    ...g,
    longtail_keywords: g.longtail_keywords ?? [],
  }))
  if (legacy_setup_text?.trim()) {
    const parsedLegacy = parseLegacySetupText(legacy_setup_text, rootDomain)
    legacyGroups = [
      ...legacyGroups,
      ...parsedLegacy.groups.map((g) => ({
        ...g,
        longtail_keywords: g.longtail_keywords ?? [],
      })),
    ]
  }

  const { data: client, error } = await admin
    .from('clients')
    .insert({
      ...clientPayload,
      folder: folder?.trim() ? folder.trim() : null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Legacy tracked keywords + URLs on project creation.
  let legacyResult: { keywords: number; skipped: string[] } | null = null
  if (
    client.commitment_type === 'legacy_main_longtail' &&
    legacyGroups.length > 0
  ) {
    const skipped: string[] = []
    let keywords = 0
    for (const group of legacyGroups) {
      const resolved =
        resolveBulkUrlLine(group.url, rootDomain) ??
        (group.url.startsWith('http') ? group.url : null)
      if (!resolved) {
        skipped.push(`${group.url}: invalid URL`)
        continue
      }

      const { data: urlRow, error: urlErr } = await admin
        .from('client_urls')
        .upsert(
          {
            client_id: client.id,
            url: resolved,
            label: '',
            ahrefs_fetch_limit: 1,
            sort_order: 0,
          },
          { onConflict: 'client_id,url', ignoreDuplicates: false }
        )
        .select('id')
        .single()

      if (urlErr || !urlRow) {
        skipped.push(`${resolved}: ${urlErr?.message ?? 'URL error'}`)
        continue
      }

      const rows = [
        {
          client_id: client.id,
          url_id: urlRow.id,
          keyword: group.main_keyword.trim(),
          tier: 'main',
          is_active: true,
          sort_order: 0,
        },
        ...group.longtail_keywords.map((kw, i) => ({
          client_id: client.id,
          url_id: urlRow.id,
          keyword: kw.trim(),
          tier: 'longtail',
          is_active: true,
          sort_order: i + 1,
        })),
      ]

      const { error: kwErr } = await admin
        .from('client_tracked_keywords')
        .upsert(rows, { onConflict: 'url_id,keyword' })

      if (kwErr) {
        skipped.push(`${resolved}: ${kwErr.message}`)
      } else {
        keywords += rows.length
      }
    }
    legacyResult = { keywords, skipped }
  }

  // Optional bulk URL seeding on project creation (ai_citations mode).
  let bulkResult: {
    created: number
    skipped: { line: string; reason: string }[]
  } | null = null

  if (
    client.commitment_type === 'ai_citations' &&
    bulk_urls_text &&
    bulk_urls_text.trim()
  ) {
    const lines = bulk_urls_text.split(/\r?\n/)
    const skipped: { line: string; reason: string }[] = []
    let sortOrder = 0
    let created = 0

    for (const line of lines) {
      const resolved = resolveBulkUrlLine(line, rootDomain)
      if (!resolved) {
        if (line.trim()) skipped.push({ line: line.trim(), reason: 'Invalid URL' })
        continue
      }

      const { error: insertError } = await admin.from('client_urls').insert({
        client_id: client.id,
        url: resolved,
        label: '',
        ahrefs_fetch_limit: bulk_urls_fetch_limit,
        sort_order: sortOrder++,
      })

      if (insertError) {
        if (insertError.code === '23505') {
          skipped.push({ line: resolved, reason: 'Duplicate for this project' })
        } else {
          skipped.push({ line: resolved, reason: insertError.message })
        }
        continue
      }
      created++
    }

    bulkResult = { created, skipped }
  }

  return NextResponse.json(
    {
      ...client,
      ...(bulkResult ? { bulk: bulkResult } : {}),
      ...(legacyResult ? { legacy: legacyResult } : {}),
    },
    { status: 201 }
  )
}
