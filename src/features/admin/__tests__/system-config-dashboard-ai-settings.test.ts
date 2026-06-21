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
  });
});
