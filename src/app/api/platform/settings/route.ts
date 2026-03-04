import { NextResponse } from 'next/server'
import { getHomeDynamicModelEnabled } from '@/lib/platform-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const homeDynamicModelEnabled = await getHomeDynamicModelEnabled(false)
  return NextResponse.json(
    { homeDynamicModelEnabled },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
