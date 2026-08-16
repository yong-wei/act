import { describe, expect, it } from 'vitest';
import {
  buildAdaptivePathComparisonKey,
  buildAdaptivePathComparisonVersion,
  enumerateAdaptivePathComparisonPairs,
  normalizeAdaptivePathComparisonPair,
} from '@/lib/adaptive-path-comparison';

describe('adaptive path comparison state', () => {
  it('normalizes an unordered pair according to candidate order', () => {
    expect(normalizeAdaptivePathComparisonPair('b', 'a', ['a', 'b', 'c'])).toEqual({
      leftOptionId: 'a',
      rightOptionId: 'b',
      pairKey: 'a:b',
    });
    expect(normalizeAdaptivePathComparisonPair('a', 'a', ['a', 'b'])).toBeNull();
    expect(normalizeAdaptivePathComparisonPair('x', 'a', ['a', 'b'])).toBeNull();
  });

  it('enumerates every legal pair once for three candidates', () => {
    expect(enumerateAdaptivePathComparisonPairs(['a', 'b', 'c']).map((pair) => pair.pairKey)).toEqual([
      'a:b',
      'a:c',
      'b:c',
    ]);
  });

  it('binds comparison identity to batch, version, and pair', () => {
    const version = buildAdaptivePathComparisonVersion('batch-1', 'path-v1', ['a', 'b']);
    expect(version).toBe('batch-1|path-v1|a|b');
    expect(buildAdaptivePathComparisonKey({
      candidateBatchId: 'batch-1',
      pathVersion: version,
      pairKey: 'a:b',
    })).toBe('batch-1|batch-1|path-v1|a|b|a:b');
  });
});
