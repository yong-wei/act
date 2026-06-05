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
});
