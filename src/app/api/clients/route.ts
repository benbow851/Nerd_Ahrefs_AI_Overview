import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { normalizeRootDomain, resolveBulkUrlLine } from '@/lib/utils'

export const revalidate = 300

const createClientSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  slug: z.string().min(1),
  kpi_keyword_target: z.number().int().min(1).max(9_999_999).default(30),
  focus_url_count: z.number().int().min(0).max(9_999_999).default(0),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  folder: z.string().max(80).nullable().optional(),
  bulk_urls_text: z.string().optional(),
  bulk_urls_fetch_limit: z.number().int().min(1).max(1000).default(30),
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
    ...clientPayload
  } = parsed.data

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

  // Optional bulk URL seeding on project creation.
  let bulkResult: {
    created: number
    skipped: { line: string; reason: string }[]
  } | null = null

  if (bulk_urls_text && bulk_urls_text.trim()) {
    const rootDomain = normalizeRootDomain(client.domain)
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
    bulkResult ? { ...client, bulk: bulkResult } : client,
    { status: 201 }
  )
}
