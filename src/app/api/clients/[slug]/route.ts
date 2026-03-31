import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { normalizeRootDomain } from '@/lib/utils'

const patchClientSchema = z.object({
  name: z.string().min(1).optional(),
  domain: z
    .string()
    .min(1)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Valid domain e.g. example.com')
    .optional(),
  kpi_keyword_target: z.number().int().min(1).max(9_999_999).optional(),
  is_active: z.boolean().optional(),
})

type RouteContext = { params: { slug: string } }

export async function GET(_request: Request, { params }: RouteContext) {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('clients')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

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

  const parsed = patchClientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const admin = createAdminClient()
  const payload = { ...parsed.data }
  if (payload.domain != null) {
    payload.domain = normalizeRootDomain(payload.domain)
  }
  const { data, error } = await admin
    .from('clients')
    .update(payload)
    .eq('slug', params.slug)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('clients')
    .update({ is_active: false })
    .eq('slug', params.slug)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
