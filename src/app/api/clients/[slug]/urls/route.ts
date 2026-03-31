import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const addUrlSchema = z.object({
  url: z.string().url('Enter a valid URL'),
  label: z.string().max(120).optional().default(''),
  ahrefs_fetch_limit: z.number().int().min(1).max(1000).default(30),
  sort_order: z.number().int().min(0).default(0),
})

type RouteContext = { params: { slug: string } }

// GET /api/clients/[slug]/urls — list URLs for a client
export async function GET(_request: Request, { params }: RouteContext) {
  const admin = createAdminClient()

  // Resolve slug → client id
  const { data: client, error: clientErr } = await admin
    .from('clients')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('client_urls')
    .select('*')
    .eq('client_id', client.id)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST /api/clients/[slug]/urls — add a URL to a client
export async function POST(request: Request, { params }: RouteContext) {
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

  const parsed = addUrlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const admin = createAdminClient()

  // Resolve slug → client id
  const { data: client, error: clientErr } = await admin
    .from('clients')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('client_urls')
    .insert({ ...parsed.data, client_id: client.id })
    .select()
    .single()

  if (error) {
    // Unique constraint: duplicate URL for this client
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This URL is already added for this client.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
