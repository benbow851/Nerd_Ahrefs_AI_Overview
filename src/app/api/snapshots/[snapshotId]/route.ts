import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

type RouteContext = { params: { snapshotId: string } }

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('snapshots')
    .select(`
      *,
      url_keyword_results (
        *,
        client_urls (*)
      )
    `)
    .eq('id', params.snapshotId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}
