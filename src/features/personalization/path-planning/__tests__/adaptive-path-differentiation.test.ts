import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_PATH_DIFFERENTIATION_THRESHOLDS,
  computeAdaptivePathPairDifferentiation,
  evaluateAdaptivePathHardDiversity,
  type AdaptivePathDifferentiationCandidate,
} from '../adaptive-path-differentiation';

function candidate(overrides: Partial<AdaptivePathDifferentiationCandidate> = {}): AdaptivePathDifferentiationCandidate {
  return {
    styleId: 'strategy-a',
    coreNodeIds: ['n1', 'n2', 'n3', 'n4'],
    coreObjectKeys: ['k1', 'k2', 'k3'],
    resourceTypeShares: { video: 0.5, simulation: 0.5 },
    estimatedMinutes: 90,
    checkpointSignature: ['inline', 'terminal'],
    ...overrides,
  };
}

describe('adaptive path pair differentiation metrics', () => {
  it('scores fully disjoint paths above every threshold', () => {
    const metrics = computeAdaptivePathPairDifferentiation(
      candidate(),
      candidate({
        styleId: 'strategy-b',
        coreNodeIds: ['n5', 'n6', 'n7', 'n8'],
        coreObjectKeys: ['k4', 'k5', 'k6'],
        resourceTypeShares: { handout: 0.6, konling: 0.4 },
        estimatedMinutes: 140,
        checkpointSignature: ['terminal'],
      }),
    );

    expect(metrics.coreNodeJaccard).toBe(1);
    expect(metrics.objectKeyJaccard).toBe(1);
    expect(metrics.resourceTypeTotalVariation).toBeCloseTo(1);
    expect(metrics.sharedNodeOrderDifference).toBe(0);
    expect(metrics.estimatedMinutesDeltaRatio).toBeGreaterThan(0.2);
    expect(metrics.checkpointStructuralDifference).toBe(true);
    expect(metrics.distinctCoreNodeCount).toBe(8);
    expect(metrics.satisfiedCount).toBe(6);
    expect(metrics.satisfiedRules).toContain('core-node-jaccard');
  });

  it('scores identical paths at zero differentiation', () => {
    const shared = candidate();
    const metrics = computeAdaptivePathPairDifferentiation(shared, { ...shared, styleId: 'strategy-b' });
    expect(metrics.satisfiedCount).toBe(0);
  });

  it('requires at least two shared nodes before order difference counts', () => {
    const metrics = computeAdaptivePathPairDifferentiation(
      candidate({ coreNodeIds: ['n1', 'n2', 'n3'] }),
      candidate({ styleId: 'strategy-b', coreNodeIds: ['n2', 'n1', 'n4'] }),
    );
    expect(metrics.sharedNodeOrderDifference).toBeGreaterThan(0);
    expect(metrics.distinctCoreNodeCount).toBe(2);
  });

  it('detects checkpoint structural difference from count, order, and composition', () => {
    const base = candidate();
    expect(computeAdaptivePathPairDifferentiation(base, candidate({
      styleId: 'strategy-b',
      checkpointSignature: ['inline', 'inline', 'terminal'],
    })).checkpointStructuralDifference).toBe(true);
    expect(computeAdaptivePathPairDifferentiation(base, candidate({
      styleId: 'strategy-b',
      checkpointSignature: ['terminal'],
    })).checkpointStructuralDifference).toBe(true);
    expect(computeAdaptivePathPairDifferentiation(base, candidate({
      styleId: 'strategy-b',
      checkpointSignature: ['inline', 'terminal'],
    })).checkpointStructuralDifference).toBe(false);
  });

  it('treats same-count inline checkpoints in different position buckets as structural difference', () => {
    // 复审修复回归：inline-head vs inline-tail（同数检查点、安排位置不同）必须计为结构差异。
    const base = candidate({ checkpointSignature: ['inline-head', 'terminal'] });
    const metrics = computeAdaptivePathPairDifferentiation(base, candidate({
      styleId: 'strategy-b',
      checkpointSignature: ['inline-tail', 'terminal'],
    }));
    expect(metrics.checkpointStructuralDifference).toBe(true);
    // 同桶（前半程 vs 前半程）不算差异。
    expect(computeAdaptivePathPairDifferentiation(base, candidate({
      styleId: 'strategy-b',
      checkpointSignature: ['inline-head', 'terminal'],
    })).checkpointStructuralDifference).toBe(false);
  });

  it('marks high differentiation only when the minimum satisfied count is met', () => {
    const metrics = computeAdaptivePathPairDifferentiation(
      candidate({ estimatedMinutes: 90 }),
      candidate({ styleId: 'strategy-b', estimatedMinutes: 100, checkpointSignature: ['inline', 'terminal'] }),
    );
    expect(metrics.satisfiedCount).toBeLessThan(ADAPTIVE_PATH_DIFFERENTIATION_THRESHOLDS.minSatisfiedCount);
  });

  it('measures resource type distribution with total variation over union of types', () => {
    const metrics = computeAdaptivePathPairDifferentiation(
      candidate({ resourceTypeShares: { video: 0.9, simulation: 0.1 } }),
      candidate({ styleId: 'strategy-b', resourceTypeShares: { simulation: 0.9, video: 0.1 } }),
    );
    expect(metrics.resourceTypeTotalVariation).toBeCloseTo(0.8);
  });
});

describe('adaptive path hard diversity (#2077)', () => {
  it('passes three disjoint published paths', () => {
    const result = evaluateAdaptivePathHardDiversity([
      { styleId: 'a', identities: [{ id: 'a1' }, { id: 'a2' }], strategy: { generic: true } },
      { styleId: 'b', identities: [{ id: 'b1' }, { id: 'b2' }], strategy: { generic: true } },
      { styleId: 'c', identities: [{ id: 'c1' }, { id: 'c2' }], strategy: { generic: true } },
    ]);
    expect(result.passed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('rejects two near-identical paths even when labels differ', () => {
    const result = evaluateAdaptivePathHardDiversity([
      { styleId: 'a', identities: [{ id: 'shared-1' }, { id: 'shared-2' }], strategy: { generic: true } },
      { styleId: 'b', identities: [{ id: 'shared-1' }, { id: 'shared-2' }], strategy: { generic: true } },
      { styleId: 'c', identities: [{ id: 'shared-1' }, { id: 'c2' }], strategy: { generic: true } },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes('jaccard-similarity-above-30'))).toBe(true);
  });

  it('uses all non-required resources as the unique-share denominator', () => {
    const result = evaluateAdaptivePathHardDiversity([
      {
        styleId: 'a',
        identities: [
          { id: 'local-a1', published: false },
          { id: 'local-a2', published: false },
          { id: 'local-a3', published: false },
          { id: 'pub-a1', published: true },
          { id: 'pub-a2', published: true },
        ],
        strategy: { generic: true },
      },
      {
        styleId: 'b',
        identities: [
          { id: 'local-b1', published: false },
          { id: 'pub-b1', published: true },
          { id: 'pub-b2', published: true },
        ],
        strategy: { generic: true },
      },
      {
        styleId: 'c',
        identities: [
          { id: 'local-c1', published: false },
          { id: 'pub-c1', published: true },
          { id: 'pub-c2', published: true },
        ],
        strategy: { generic: true },
      },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('a:unique-share-below-50');
  });
});
