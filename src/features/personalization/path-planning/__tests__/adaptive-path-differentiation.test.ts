import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_PATH_DIFFERENTIATION_THRESHOLDS,
  computeAdaptivePathPairDifferentiation,
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
