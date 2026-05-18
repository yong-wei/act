import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('multi-representation linkage arena task state', () => {
  it('resets plant, gain, and ranges when the effective arena seed changes', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/model.ts'),
      'utf8',
    );

    expect(source).toContain('const routeResetKey = useMemo');
    expect(source).toContain('lastRouteResetKeyRef.current === routeResetKey');
    expect(source).toContain('setModelPoles(toPoleZeroPoints(effectiveSeed.poles,');
    expect(source).toContain('setModelZeros(toPoleZeroPoints(effectiveSeed.zeros,');
    expect(source).toContain('setTimeRange(effectiveTimeRange ?? DEFAULT_LINKAGE_TIME_RANGE)');
    expect(source).toContain('setFrequencyRange(effectiveFreqRange ?? DEFAULT_LINKAGE_FREQUENCY_RANGE)');
    expect(source).toContain('routeResetKey,');
    expect(source).toContain('effectiveSeed,');
    expect(source).toContain('effectiveTimeRange,');
    expect(source).toContain('effectiveFreqRange,');
  });
});
