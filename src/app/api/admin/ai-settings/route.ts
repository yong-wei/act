import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin';
import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  operationLedgerHeaders,
} from '@/lib/admin-operation-ledger';
import { persistAdminOperationLedger } from '@/lib/admin-operation-ledger-runtime';
import { buildAdminModelProviderRuntimeStates } from '@/lib/ai/model-provider-compatibility';
import {
  getAIProviderSettings,
  normalizeAIProviderSettings,
  setAIProviderSettings,
  validateAIProviderSettings,
  validateAIProviderSettingsInput,
} from '@/lib/ai/provider-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await getAIProviderSettings();
  return NextResponse.json({
    ...settings,
    runtimeStates: buildAdminModelProviderRuntimeStates(settings),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const inputIssues = validateAIProviderSettingsInput(payload);
  if (inputIssues.length > 0) {
    return NextResponse.json(
      { error: 'Invalid AI provider settings', issues: inputIssues },
      { status: 400 }
    );
  }
  const settings = normalizeAIProviderSettings(payload);
  const issues = validateAIProviderSettings(settings);
  if (issues.length > 0) {
    return NextResponse.json(
      { error: 'Invalid AI provider settings', issues },
      { status: 400 }
    );
  }
  const saved = await setAIProviderSettings(settings);
  const completedAt = new Date().toISOString();
  const activeProvider = saved.providers.find((provider) => provider.id === saved.activeProvider);
  const idempotencyKey = buildAdminOperationIdempotencyKey([
    'admin-config-save',
    'ai-settings',
    JSON.stringify({
      activeProvider: saved.activeProvider,
      providers: saved.providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        providerKind: provider.providerKind,
        baseURL: provider.baseURL,
        authMode: provider.authMode,
        secretRef: provider.secretRef,
        selectedModel: provider.selectedModel,
        models: provider.models.map((model) => ({
          id: model.id,
          label: model.label,
          model: model.model,
          description: model.description,
          options: model.options,
        })),
        enabled: provider.enabled,
        priority: provider.priority,
        health: provider.health,
        capabilities: provider.capabilities,
      })),
    }),
    session.user.id,
  ]);
  const operationLedger = buildAdminOperationLedgerEntry({
    kind: 'admin-config-save',
    actorId: session.user.id,
    actorRole: session.user.role,
    scope: `admin-config-ai-settings:${saved.activeProvider}`,
    startedAt: completedAt,
    completedAt,
    outcome: 'completed',
    idempotencyKey,
    artifactRefs: [{
      id: `admin-config-ai-settings:${saved.activeProvider}`,
      kind: 'config-diff',
      label: 'AI 供应商配置',
      authorizedRoles: ['ADMIN'],
      piiMinimized: true,
      revocable: true,
    }],
    rollback: {
      available: false,
      rationale: '系统配置保存通过 diff summary 支持人工恢复，不启用自动回滚。',
    },
    auditSummary: `AI 设置已保存：activeProvider=${saved.activeProvider}，selectedModel=${activeProvider?.selectedModel ?? 'none'}。`,
    recoveryState: {
      status: 'available',
      action: '按 diff summary 手动恢复上一组配置',
    },
  });
  await persistAdminOperationLedger(operationLedger);
  return NextResponse.json({
    ...saved,
    operationLedger,
  }, {
    headers: {
      'Cache-Control': 'no-store',
      ...operationLedgerHeaders(operationLedger),
    },
  });
}
