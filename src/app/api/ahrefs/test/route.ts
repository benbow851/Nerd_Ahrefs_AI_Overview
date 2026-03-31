import { NextResponse } from 'next/server'
import { testAhrefsConnection } from '@/lib/ahrefs'
import { getAhrefsApiKey } from '@/lib/env-server'

export const runtime = 'nodejs'

export async function GET() {
  const apiKey = getAhrefsApiKey()

  if (!apiKey) {
    return NextResponse.json({
      connected: false,
      message: 'No API key',
    })
  }

  const result = await testAhrefsConnection(apiKey)

  return NextResponse.json({
    connected: result.ok,
    message: result.message,
  })
}
