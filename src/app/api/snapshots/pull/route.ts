import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getAhrefsApiKey } from '@/lib/env-server'
import { pullClientSnapshot } from '@/lib/snapshot-engine'

export const runtime = 'nodejs'

const pullSchema = z.object({
  clientId: z.string().min(1),
  date: z.string().optional(),
})

export async function POST(request: Request) {
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
      {
        error:
          'AHREFS_API_KEY not configured. Add AHREFS_API_KEY=your_token to .env.local in the project root (no quotes), save the file, then retry — or stop and run `npm run dev` again. On Vercel/hosting, set the variable in the dashboard.',
      },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = pullSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const { clientId, date } = parsed.data

  try {
    const admin = createAdminClient()
    const result = await pullClientSnapshot(clientId, date, admin, apiKey)

    return NextResponse.json({
      snapshotId: result.snapshotId,
      snapshotDate: result.snapshotDate,
      citationCount: result.citationCount,
      urlsProcessed: result.urlsProcessed,
      errors: result.errors,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
