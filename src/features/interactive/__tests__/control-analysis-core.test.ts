import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('control analysis core foundation', () => {
  it('builds a 4-1 analysis request with reserved runtime extension fields', async () => {
    const { buildUnit41AnalysisRequest } = await import(
      '@/resources/control-system/analysis/unit-4-1-request-builder'
    );

    const request = buildUnit41AnalysisRequest('step-04', {
      gain: 2.25,
      structures: [{ kind: 'gain', enabled: true, params: { k: 2.25 } }],
    });

    expect(request.runtimeMode).toBe('analysis');
    expect(request.outputs).toEqual(
      expect.arrayContaining(['step_response', 'root_locus', 'magnitude', 'phase', 'nyquist']),
    );
    expect(request).toHaveProperty('delay');
    expect(request).toHaveProperty('discreteConfig');
    expect(request).toHaveProperty('stateSpaceSpec');
    expect(request).toHaveProperty('referenceProfile');
    expect(request).toHaveProperty('disturbanceProfile');
  });

  it('declares a chart panel shell with overlay slot and fixture fallback support', () => {
    const panelPath = join(repoRoot, 'src/resources/control-system/charts/control-chart-panel.tsx');
    expect(existsSync(panelPath)).toBe(true);

    const source = readFileSync(panelPath, 'utf8');
    expect(source).toContain('overlay');
    expect(source).toContain('fallback');
    expect(source).toContain('isFallback');
  });
});
