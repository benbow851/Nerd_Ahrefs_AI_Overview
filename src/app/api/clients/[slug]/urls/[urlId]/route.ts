import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const patchUrlSchema = z.object({
  url: z.string().url().optional(),
  label: z.string().max(120).optional(),
  ahrefs_fetch_limit: z.number().int().min(1).max(1000).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

type RouteContext = { params: { slug: string; urlId: string } }

// PATCH /api/clients/[slug]/urls/[urlId] — update a URL (edit fields or toggle active)
export async function PATCH(request: Request, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchUrlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const admin = createAdminClient()

  // Verify the URL belongs to the right client (security check)
  const { data: existing, error: fetchErr } = await admin
    .from('client_urls')
    .select('id, client_id, clients!inner(slug)')
    .eq('id', params.urlId)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'URL not found' }, { status: 404 })
  }

  // @ts-expect-error — Supabase join typing
  if (existing.clients.slug !== params.slug) {
    return NextResponse.json({ error: 'URL does not belong to this client' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('client_urls')
    .update(parsed.data)
    .eq('id', params.urlId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/clients/[slug]/urls/[urlId] — remove a URL
export async function DELETE(_request: Request, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('client_urls')
    .delete()
    .eq('id', params.urlId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
