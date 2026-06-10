import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getAhrefsApiKey } from '@/lib/env-server'
import { pullSingleUrlSnapshot } from '@/lib/snapshot-engine'

export const runtime = 'nodejs'

const pullUrlSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional(),
})

type RouteContext = { params: { slug: string; urlId: string } }

export async function POST(request: Request, { params }: RouteContext) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = getAhrefsApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AHREFS_API_KEY not configured.' },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = pullUrlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const admin = createAdminClient()

  // Resolve client_id from slug + verify URL belongs to it.
  const { data: client, error: clientErr } = await admin
    .from('clients')
    .select('id')
    .eq('slug', params.slug)
    .single()
  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  try {
    const result = await pullSingleUrlSnapshot(
      client.id,
      params.urlId,
      parsed.data.date,
      admin,
      apiKey
    )
    return NextResponse.json({
      snapshotId: result.snapshotId,
      snapshotDate: result.snapshotDate,
      citationCount: result.citationCount,
      urlsProcessed: result.urlsProcessed,
      errors: result.errors,
      success: result.success,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
