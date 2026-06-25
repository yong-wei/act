import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin'
import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  operationLedgerHeaders,
} from '@/lib/admin-operation-ledger'
import { persistAdminOperationLedger } from '@/lib/admin-operation-ledger-runtime'
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
  const completedAt = new Date().toISOString()
  const operationLedger = buildAdminOperationLedgerEntry({
    kind: 'admin-config-save',
    actorId: session.user.id,
    actorRole: session.user.role,
    scope: 'admin-config-platform-settings',
    startedAt: completedAt,
    completedAt,
    outcome: 'completed',
    idempotencyKey: buildAdminOperationIdempotencyKey([
      'admin-config-save',
      'platform-settings',
      nextHomeDynamicModelEnabled,
      nextDataCenterShowDemoSourceLabels,
      session.user.id,
    ]),
    artifactRefs: [{
      id: 'admin-config-platform-settings',
      kind: 'config-diff',
      label: '平台参数配置',
      authorizedRoles: ['ADMIN'],
      piiMinimized: true,
      revocable: true,
    }],
    rollback: {
      available: false,
      rationale: '平台参数保存通过 diff summary 支持人工恢复，不启用自动回滚。',
    },
    auditSummary: `平台参数已保存：homeDynamicModelEnabled=${nextHomeDynamicModelEnabled}，dataCenterShowDemoSourceLabels=${nextDataCenterShowDemoSourceLabels}。`,
    recoveryState: {
      status: 'available',
      action: '按 diff summary 手动恢复上一组配置',
    },
  })
  await persistAdminOperationLedger(operationLedger)
  return NextResponse.json({
    success: true,
    homeDynamicModelEnabled: nextHomeDynamicModelEnabled,
    dataCenterShowDemoSourceLabels: nextDataCenterShowDemoSourceLabels,
    operationLedger,
  }, {
    headers: operationLedgerHeaders(operationLedger),
  })
}
