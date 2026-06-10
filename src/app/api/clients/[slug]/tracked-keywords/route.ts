import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { normalizeRootDomain, resolveBulkUrlLine } from '@/lib/utils'

const addGroupSchema = z.object({
  url: z.string().min(1),
  main_keyword: z.string().min(1).max(200),
  longtail_keywords: z.array(z.string().min(1).max(200)).max(100).default([]),
})

const bulkSchema = z.object({
  groups: z.array(addGroupSchema).min(1).max(200),
})

type RouteContext = { params: { slug: string } }

async function getClient(admin: ReturnType<typeof createAdminClient>, slug: string) {
  const { data, error } = await admin
    .from('clients')
    .select('id, domain, commitment_type')
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return data
}

async function upsertUrlForGroup(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  url: string
) {
  const { data: existing } = await admin
    .from('client_urls')
    .select('id')
    .eq('client_id', clientId)
    .eq('url', url)
    .maybeSingle()

  if (existing) return existing.id

  const { data, error } = await admin
    .from('client_urls')
    .insert({
      client_id: clientId,
      url,
      label: '',
      ahrefs_fetch_limit: 1,
      sort_order: 0,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

export async function GET(_request: Request, { params }: RouteContext) {
  const admin = createAdminClient()
  const client = await getClient(admin, params.slug)
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('client_tracked_keywords')
    .select('*, client_urls ( url, label )')
    .eq('client_id', client.id)
    .order('sort_order')
    .order('created_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

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
  const client = await getClient(admin, params.slug)
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
  if (client.commitment_type !== 'legacy_main_longtail') {
    return NextResponse.json(
      { error: 'Tracked keywords are only for Legacy Main + Longtail projects' },
      { status: 422 }
    )
  }

  const rootDomain = normalizeRootDomain(client.domain)
  const created: string[] = []
  const skipped: string[] = []

  for (const group of parsed.data.groups) {
    const url =
      resolveBulkUrlLine(group.url, rootDomain) ??
      (group.url.startsWith('http') ? group.url : null)
    if (!url) {
      skipped.push(`${group.url}: invalid URL`)
      continue
    }

    try {
      const urlId = await upsertUrlForGroup(admin, client.id, url)

      const { error: mainErr } = await admin.from('client_tracked_keywords').upsert(
        {
          client_id: client.id,
          url_id: urlId,
          keyword: group.main_keyword.trim(),
          tier: 'main',
          is_active: true,
        },
        { onConflict: 'url_id,keyword' }
      )
      if (mainErr) throw new Error(mainErr.message)
      created.push(group.main_keyword)

      let sort = 1
      for (const lt of group.longtail_keywords) {
        const { error: ltErr } = await admin.from('client_tracked_keywords').upsert(
          {
            client_id: client.id,
            url_id: urlId,
            keyword: lt.trim(),
            tier: 'longtail',
            is_active: true,
            sort_order: sort++,
          },
          { onConflict: 'url_id,keyword' }
        )
        if (ltErr) {
          skipped.push(`${lt}: ${ltErr.message}`)
        } else {
          created.push(lt)
        }
      }
    } catch (e) {
      skipped.push(
        `${group.url}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  return NextResponse.json({ created: created.length, skipped })
}
