import { describe, expect, it } from 'vitest';
import {
  authorizeAdaptivePathComparisonIdentity,
  buildAdaptivePathComparisonKey,
  buildAdaptivePathComparisonVersion,
  enumerateAdaptivePathComparisonPairs,
  normalizeAdaptivePathComparisonPair,
} from '@/features/personalization/path-planning/adaptive-path-comparison';

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

  it('authorizes only the current saved-path version and server-normalized pair', () => {
    const authorized = authorizeAdaptivePathComparisonIdentity({
      candidateBatchId: 'batch-1',
      candidateBatchCreatedAt: '2026-08-16T10:00:01.000Z',
      currentPathUpdatedAt: '2026-08-16T10:00:00.000Z',
      candidates: [
        { optionId: 'option-a', styleId: 'style-a' },
        { optionId: 'option-b', styleId: 'style-b' },
      ],
      selectedStyleId: 'style-b',
      comparedStyleId: 'style-a',
      requestedComparisonKey: 'batch-1|2026-08-16T10:00:00.000Z|option-a:option-b',
    });

    expect(authorized).toEqual({
      ok: true,
      comparisonKey: 'batch-1|2026-08-16T10:00:00.000Z|option-a:option-b',
      pair: {
        leftOptionId: 'option-a',
        rightOptionId: 'option-b',
        pairKey: 'option-a:option-b',
      },
      pathVersion: '2026-08-16T10:00:00.000Z',
    });
  });

  it('rejects stale saved-path versions and forged comparison keys', () => {
    const input = {
      candidateBatchId: 'batch-1',
      candidateBatchCreatedAt: '2026-08-16T10:00:01.000Z',
      candidates: [
        { optionId: 'option-a', styleId: 'style-a' },
        { optionId: 'option-b', styleId: 'style-b' },
      ],
      selectedStyleId: 'style-a',
      comparedStyleId: 'style-b',
    };
    expect(authorizeAdaptivePathComparisonIdentity({
      ...input,
      currentPathUpdatedAt: '2026-08-16T10:00:02.000Z',
      requestedComparisonKey: 'batch-1|2026-08-16T10:00:02.000Z|option-a:option-b',
    })).toEqual({ ok: false, reason: 'stale-path-version' });
    expect(authorizeAdaptivePathComparisonIdentity({
      ...input,
      currentPathUpdatedAt: '2026-08-16T10:00:00.000Z',
      requestedComparisonKey: 'forged-key',
    })).toEqual({ ok: false, reason: 'comparison-key-mismatch' });
  });
});
