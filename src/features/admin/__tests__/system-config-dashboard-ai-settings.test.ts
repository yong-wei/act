import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const dashboardSource = readFileSync(
  join(process.cwd(), 'src/features/admin/system-config-dashboard.tsx'),
  'utf8',
);

describe('system config dashboard AI provider settings', () => {
  it('exposes provider compatibility matrix fields in the admin editor', () => {
    expect(dashboardSource).toContain("type AIProviderKind = 'openai-compatible' | 'anthropic-compatible'");
    expect(dashboardSource).toContain('secretRef: string');
    expect(dashboardSource).toContain('priority: number');
    expect(dashboardSource).toContain('capabilities: AIProviderCapabilities');
    expect(dashboardSource).toContain('providerKind: event.target.value as AIProviderKind');
    expect(dashboardSource).toContain('citationNormalization');
  });

  it('renders explicit route model-test states for missing provider and model deep links', () => {
    expect(dashboardSource).toContain('initialTestQuery?: ConfigModelTestQuery | null');
    expect(dashboardSource).toContain('admin-config-model-test:provider');
    expect(dashboardSource).toContain('供应商 ${providerId} 不存在或当前配置不可见。');
    expect(dashboardSource).toContain('供应商 ${provider.name} 下不存在模型 ${modelId}。');
    expect(dashboardSource).toContain('<ActionStatusPanel state={routeModelTestState} className="mb-6" />');
    expect(dashboardSource).toContain("buildAdminOperationId({");
    expect(dashboardSource).toContain("kind: 'admin-config-model-test'");
    expect(dashboardSource).toContain('displayReference: result?.operationId');
    expect(dashboardSource).toContain('const [modelTestActionState, setModelTestActionState]');
    expect(dashboardSource).toContain('actionStateFromLedger');
    expect(dashboardSource).toContain('failedOperationLedger = payload.operationLedger');
    expect(dashboardSource).toContain('operationId: failedOperationId');
    expect(dashboardSource).toContain('setModelTestActionState((current) => failedOperationLedger');
    expect(dashboardSource).toContain('scope: `admin-config-model-test:${provider.id}:${model.model}`');
    expect(dashboardSource).toContain('<ActionStatusPanel state={modelTestActionState} className="mb-6" />');
    expect(dashboardSource).toContain('审计输出：模型测试已排队');
  });

  it('shows config save diff, impact scope, recovery, and idempotency state', () => {
    expect(dashboardSource).toContain('summarizeConfigDiff');
    expect(dashboardSource).toContain('配置内容未变化，本次保存复用相同 idempotency key。');
    expect(dashboardSource).toContain('影响范围：${impactScope}');
    expect(dashboardSource).toContain('save-platform-settings');
    expect(dashboardSource).toContain('save-ai-settings');
    expect(dashboardSource).toContain('configSaveStates.map');
    expect(dashboardSource).toContain('<ActionStatusPanel key={state.identity.id} state={state} className="mb-6" />');
  });

  it('blocks empty provider drafts and does not silently switch the active provider', () => {
    expect(dashboardSource).toContain("showNotice('error', '供应商名称不能为空')");
    expect(dashboardSource).toContain("showNotice('error', 'API 端点不能为空')");
    expect(dashboardSource).toContain('activeProvider: prev.activeProvider');
    expect(dashboardSource).toContain('需显式选用后才会影响运行时配置');
    expect(dashboardSource).not.toContain('setConfig((prev) => ({ ...prev, aiProvider: id');
  });
});
