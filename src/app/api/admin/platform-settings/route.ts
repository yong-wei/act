import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin'
import {
  getDataCenterShowDemoSourceLabels,
  getHomeDynamicModelEnabled,
  setDataCenterShowDemoSourceLabels,
  setHomeDynamicModelEnabled,
} from '@/lib/platform-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [homeDynamicModelEnabled, dataCenterShowDemoSourceLabels] = await Promise.all([
    getHomeDynamicModelEnabled(false),
    getDataCenterShowDemoSourceLabels(false),
  ])
  return NextResponse.json(
    { homeDynamicModelEnabled, dataCenterShowDemoSourceLabels },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function PUT(request: Request) {
  const session = await requireAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null) as {
    homeDynamicModelEnabled?: unknown
    dataCenterShowDemoSourceLabels?: unknown
  } | null
  const nextHomeDynamicModelEnabled = payload?.homeDynamicModelEnabled
  const nextDataCenterShowDemoSourceLabels = payload?.dataCenterShowDemoSourceLabels

  if (
    typeof nextHomeDynamicModelEnabled !== 'boolean'
    || typeof nextDataCenterShowDemoSourceLabels !== 'boolean'
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await Promise.all([
    setHomeDynamicModelEnabled(nextHomeDynamicModelEnabled),
    setDataCenterShowDemoSourceLabels(nextDataCenterShowDemoSourceLabels),
  ])
  return NextResponse.json({
    success: true,
    homeDynamicModelEnabled: nextHomeDynamicModelEnabled,
    dataCenterShowDemoSourceLabels: nextDataCenterShowDemoSourceLabels,
  })
}
