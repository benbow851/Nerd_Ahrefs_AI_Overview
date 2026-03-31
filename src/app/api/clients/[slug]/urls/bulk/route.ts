import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { normalizeRootDomain, resolveBulkUrlLine } from '@/lib/utils'

const bulkSchema = z.object({
  urlsText: z.string().min(1, 'Paste at least one line'),
  ahrefs_fetch_limit: z.number().int().min(1).max(1000).default(30),
})

type RouteContext = { params: { slug: string } }

export async function POST(request: Request, { params }: RouteContext) {
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

  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const admin = createAdminClient()
  const { data: client, error: clientErr } = await admin
    .from('clients')
    .select('id, domain')
    .eq('slug', params.slug)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const rootDomain = normalizeRootDomain(client.domain)
  const lines = parsed.data.urlsText.split(/\r?\n/)

  const { data: lastSort } = await admin
    .from('client_urls')
    .select('sort_order')
    .eq('client_id', client.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  let sortOrder = (lastSort?.sort_order ?? -1) + 1

  const created: unknown[] = []
  const skipped: { line: string; reason: string }[] = []

  for (const line of lines) {
    const resolved = resolveBulkUrlLine(line, rootDomain)
    if (!resolved) {
      if (line.trim()) skipped.push({ line: line.trim(), reason: 'Invalid URL' })
      continue
    }

    const { data, error } = await admin
      .from('client_urls')
      .insert({
        client_id: client.id,
        url: resolved,
        label: '',
        ahrefs_fetch_limit: parsed.data.ahrefs_fetch_limit,
        sort_order: sortOrder++,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        skipped.push({ line: resolved, reason: 'Duplicate for this project' })
      } else {
        skipped.push({ line: resolved, reason: error.message })
      }
      continue
    }
    created.push(data)
  }

  return NextResponse.json(
    {
      created: created.length,
      skipped,
      items: created,
    },
    { status: 201 }
  )
}
