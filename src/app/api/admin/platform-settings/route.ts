import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin'
import { getHomeDynamicModelEnabled, setHomeDynamicModelEnabled } from '@/lib/platform-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const homeDynamicModelEnabled = await getHomeDynamicModelEnabled(false)
  return NextResponse.json(
    { homeDynamicModelEnabled },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function PUT(request: Request) {
  const session = await requireAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null) as { homeDynamicModelEnabled?: unknown } | null
  const nextValue = payload?.homeDynamicModelEnabled

  if (typeof nextValue !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await setHomeDynamicModelEnabled(nextValue)
  return NextResponse.json({ success: true, homeDynamicModelEnabled: nextValue })
}
