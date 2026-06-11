import { describe, expect, it } from 'vitest';

import { buildProviderRuntimeSmokeReport } from '@/lib/ai/provider-runtime-smoke';

describe('provider runtime smoke report', () => {
  it('covers assistant-critical provider behavior without leaking secrets', () => {
    const report = buildProviderRuntimeSmokeReport();

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.capabilityCategory)).toEqual([
      'chat',
      'structured-grading',
      'citation-answer',
      'streaming',
      'unavailable-fallback',
    ]);
    expect(JSON.stringify(report)).not.toContain('API_KEY');
    expect(JSON.stringify(report)).not.toContain('sk-');
    expect(report.checks.find((check) => check.capabilityCategory === 'unavailable-fallback')?.detail)
      .toContain('runtime adapter');
  });
});
