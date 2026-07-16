import { describe, expect, it, vi } from 'vitest';

import { createEmptyCompetencyVector } from '../competency-model';
import { PORTRAIT_V2_DIMENSIONS } from '../kaq-objective-taxonomy';
import {
  aggregatePortraitV2,
  hasPortraitV2Evidence,
  resolvePrimaryPortraitV2,
  summarizePortraitV2,
} from '../portrait-v2-consumer';
import {
  createPortraitV2Payload,
  derivePortraitV2Compatibility,
} from '../portrait-v2-model';

const now = new Date('2026-05-20T12:00:00.000Z');

function legacySnapshot() {
  const vector = createEmptyCompetencyVector();
  for (const [index, entry] of Object.values(vector).entries()) {
    entry.score = 60 + index;
    entry.confidence = 0.8;
    entry.evidenceCount = 3;
    entry.lastUpdated = now.toISOString();
  }
  return {
    id: 'legacy-1',
    snapshotAt: now,
    competencyVector: vector,
  };
}

function nativePortrait() {
  return createPortraitV2Payload({
    userId: 'student-1',
    generatedAt: now.toISOString(),
    now,
    dimensions: PORTRAIT_V2_DIMENSIONS.map(({ id }) => ({
      id,
      score: 0,
      confidence: 0,
      trend: 'stable' as const,
      freshness: { state: 'missing' as const, asOf: null, evidenceAgeDays: null },
      evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} },
      lastPositiveEvidenceAt: null,
      lastNegativeEvidenceAt: null,
      rationale: 'No safe legacy mapping exists.',
      limitations: ['missing-native-portrait-v2-evidence'],
      sourceLineage: [],
      calculationVersion: 'portrait-v2-primary.v1',
    })),
    derivation: { kind: 'native', limitations: ['missing-native-portrait-v2-evidence'] },
  });
}

describe('portrait v2 consumer adapters', () => {
  it('includes all seven dimensions in overall score when evidence is missing', () => {
    const payload = nativePortrait();
    payload.dimensions = payload.dimensions.map(
      (dimension, index): (typeof payload.dimensions)[number] => ({
        ...dimension,
        score: index === 0 ? 90 : 0,
        confidence: index === 0 ? 1 : 0,
        freshness: index === 0
          ? { state: 'current' as const, asOf: now.toISOString(), evidenceAgeDays: 0 }
          : { state: 'missing' as const, asOf: null, evidenceAgeDays: null },
        evidenceSummary: index === 0
          ? { totalCount: 1, sourceFamilyCounts: { LearningFact: 1 } }
          : { totalCount: 0, sourceFamilyCounts: {} },
        lastPositiveEvidenceAt: index === 0 ? now.toISOString() : null,
        limitations: index === 0 ? [] : ['missing-native-portrait-v2-evidence'],
      }),
    );

    const summary = summarizePortraitV2(payload);

    expect(summary.overallScore).toBe(12.9);
    expect(summary.overallScore).toBeLessThan(85);
    expect(summary.strengths).toEqual([payload.dimensions[0].id]);
    expect(summary.weaknesses).toEqual([]);
  });

  it('does not invent strengths or weaknesses for a portrait without evidence', () => {
    const summary = summarizePortraitV2(nativePortrait());

    expect(summary.strengths).toEqual([]);
    expect(summary.weaknesses).toEqual([]);
  });

  it.each([
    { coveredCount: 2, strengthCount: 1, weaknessCount: 1 },
    { coveredCount: 3, strengthCount: 2, weaknessCount: 1 },
    { coveredCount: 4, strengthCount: 2, weaknessCount: 2 },
    { coveredCount: 7, strengthCount: 2, weaknessCount: 2 },
  ])(
    'partitions $coveredCount covered dimensions into ranked, disjoint strengths and weaknesses',
    ({ coveredCount, strengthCount, weaknessCount }) => {
      const payload = nativePortrait();
      payload.dimensions = payload.dimensions.map(
        (dimension, index): (typeof payload.dimensions)[number] => index < coveredCount
          ? {
              ...dimension,
              score: 100 - index,
              confidence: 1,
              freshness: { state: 'current' as const, asOf: now.toISOString(), evidenceAgeDays: 0 },
              evidenceSummary: { totalCount: 1, sourceFamilyCounts: { LearningFact: 1 } },
              lastPositiveEvidenceAt: now.toISOString(),
              limitations: [],
            }
          : dimension,
      );
      const coveredIds = payload.dimensions.slice(0, coveredCount).map((dimension) => dimension.id);

      const summary = summarizePortraitV2(payload);

      expect(summary.strengths).toEqual(coveredIds.slice(0, strengthCount));
      expect(summary.weaknesses).toEqual(coveredIds.slice(-weaknessCount));
      expect(summary.strengths).not.toEqual(expect.arrayContaining(summary.weaknesses));
    },
  );

  it('uses a persisted portrait v2 row as the primary contract', async () => {
    const payload = nativePortrait();
    const resolution = await resolvePrimaryPortraitV2({
      studentPortraitV2Snapshot: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'portrait-1',
          userId: 'student-1',
          snapshotAt: now,
          payloadVersion: payload.payloadVersion,
          calculationVersion: 'portrait-v2-primary.v1',
          migrationVersion: payload.migrationVersion,
          derivationKind: 'native',
          payload,
        }),
      },
    }, 'student-1', 'student', { now });

    expect(resolution.primaryPortrait.derivation.kind).toBe('native');
    expect(resolution.primaryPortrait.dimensions).toHaveLength(7);
    expect(resolution.legacyCompatibility.authority).toBe('legacy-compatibility-only');
    expect(resolution.legacyCompatibility.source).toBe('fallback-empty');
  });

  it('preserves the legacy vector as compatibility data alongside a native portrait', async () => {
    const payload = nativePortrait();
    const snapshot = legacySnapshot();
    const resolution = await resolvePrimaryPortraitV2({
      studentPortraitV2Snapshot: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'portrait-1',
          userId: 'student-1',
          snapshotAt: now,
          payloadVersion: payload.payloadVersion,
          calculationVersion: 'portrait-v2-primary.v1',
          migrationVersion: payload.migrationVersion,
          derivationKind: 'native',
          payload,
        }),
      },
    }, 'student-1', 'student', { now, legacySnapshot: snapshot });

    expect(resolution.primaryPortrait.derivation.kind).toBe('native');
    expect(resolution.legacyCompatibility.source).toBe('StudentCompetencySnapshot');
    expect(resolution.legacyCompatibility.vector.controlModeling.score).toBe(60);
    expect(resolution.legacyCompatibility.authority).toBe('legacy-compatibility-only');
  });

  it('keeps the primary portrait when legacy compatibility projection fails', async () => {
    const payload = nativePortrait();
    const snapshot = legacySnapshot();
    snapshot.competencyVector.controlModeling.lastUpdated = '2026-05-20T13:00:00.000Z';
    const resolution = await resolvePrimaryPortraitV2({
      studentPortraitV2Snapshot: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'portrait-1',
          userId: 'student-1',
          snapshotAt: now,
          payloadVersion: payload.payloadVersion,
          calculationVersion: 'portrait-v2-primary.v1',
          migrationVersion: payload.migrationVersion,
          derivationKind: 'native',
          payload,
        }),
      },
    }, 'student-1', 'student', { now, legacySnapshot: snapshot });

    expect(resolution.primaryPortrait.derivation.kind).toBe('native');
    expect(resolution.legacyCompatibility.source).toBe('fallback-empty');
    expect(resolution.limitations).toContain('legacy-compatibility-projection-failed');
  });

  it('degrades a failing legacy-only compatibility projection to fallback-empty', async () => {
    const snapshot = legacySnapshot();
    snapshot.competencyVector.controlModeling.lastUpdated = '2026-05-20T13:00:00.000Z';

    const resolution = await resolvePrimaryPortraitV2({}, 'student-1', 'student', {
      now,
      legacySnapshot: snapshot,
    });

    expect(resolution.primaryPortrait.dimensions.every((dimension) => dimension.evidenceSummary.totalCount === 0)).toBe(true);
    expect(resolution.legacyCompatibility.source).toBe('fallback-empty');
    expect(resolution.limitations).toContain('legacy-compatibility-projection-failed');
  });

  it('uses a safe timestamp when legacy-only snapshot time is in the future', async () => {
    const snapshot = legacySnapshot();
    snapshot.snapshotAt = new Date('2026-05-20T13:00:00.000Z');

    const resolution = await resolvePrimaryPortraitV2({}, 'student-1', 'student', {
      now,
      legacySnapshot: snapshot,
    });

    expect(resolution.primaryPortrait.dimensions.every((dimension) => dimension.evidenceSummary.totalCount === 0)).toBe(true);
    expect(resolution.legacyCompatibility).toMatchObject({
      source: 'fallback-empty',
      snapshotAt: now.toISOString(),
    });
    expect(resolution.limitations).toContain('legacy-compatibility-projection-failed');
  });

  it('prefers the cache primary marker over a legacy snapshot', async () => {
    const payload = nativePortrait();
    const resolution = await resolvePrimaryPortraitV2({
      studentCompetencySnapshot: { findFirst: vi.fn() },
    }, 'student-1', 'student', {
      now,
      legacySnapshot: legacySnapshot(),
      featureCache: {
        features: {
          approvedAggregates: {
            primaryPortrait: {
              authority: 'portrait-v2-primary',
              payloadVersion: payload.payloadVersion,
              derivationKind: 'native',
              payload,
            },
          },
        },
      },
    });

    expect(resolution.primaryPortrait.derivation.kind).toBe('native');
    expect(resolution.legacyCompatibility.source).toBe('StudentCompetencySnapshot');
    expect(resolution.legacyCompatibility.vector.controlModeling.score).toBe(60);
  });

  it('loads a DB feature cache before resolving its primary portrait marker', async () => {
    const payload = nativePortrait();
    const findUnique = vi.fn().mockResolvedValue({
      features: {
        approvedAggregates: {
          primaryPortrait: {
            authority: 'portrait-v2-primary',
            payloadVersion: payload.payloadVersion,
            derivationKind: 'native',
            payload,
          },
        },
      },
    });
    const resolution = await resolvePrimaryPortraitV2({
      studentCompetencySnapshot: { findFirst: vi.fn() },
      studentEvidenceFeatureCache: { findUnique },
    }, 'student-1', 'student', { now, legacySnapshot: null });

    expect(findUnique).toHaveBeenCalledWith({ where: { userId: 'student-1' } });
    expect(resolution.primaryPortrait.derivation.kind).toBe('native');
  });

  it('projects legacy input only through the explicit compatibility path', async () => {
    const snapshot = legacySnapshot();
    const resolution = await resolvePrimaryPortraitV2({}, 'student-1', 'reviewer', {
      now,
      legacySnapshot: snapshot,
      featureCache: null,
    });
    const summary = summarizePortraitV2(resolution.primaryPortrait);
    const payloadWithMissingDimensionScore = {
      ...resolution.primaryPortrait,
      dimensions: resolution.primaryPortrait.dimensions.map((dimension) =>
        dimension.id === 'simulationValidationEvidence'
          ? { ...dimension, score: 88 }
          : dimension
      ),
    } as typeof resolution.primaryPortrait;
    const aggregate = aggregatePortraitV2([payloadWithMissingDimensionScore]);

    expect(resolution.primaryPortrait.derivation.kind).toBe('compatibility-derived');
    expect(resolution.legacyCompatibility.source).toBe('StudentCompetencySnapshot');
    expect(summary.dimensions).toHaveLength(7);
    expect(summary.limitations).toContain('legacy-six-dimensional-input-is-non-authoritative');
    expect(aggregate.dimensionIds).toHaveLength(7);
    expect(aggregate.sourceCoverage.compatibilityLearners).toBe(1);
    expect(aggregate.dimensions.simulationValidationEvidence).toMatchObject({
      mean: 0,
      evidenceCount: 0,
      freshness: 'missing',
    });
  });

  it('does not query unprovided legacy sources when a caller explicitly supplies null', async () => {
    const findFirst = vi.fn();
    const resolution = await resolvePrimaryPortraitV2({
      studentCompetencySnapshot: { findFirst },
    }, 'student-1', 'student', { now, legacySnapshot: null, featureCache: null });

    expect(findFirst).not.toHaveBeenCalled();
    expect(resolution.legacyCompatibility.source).toBe('fallback-empty');
    expect(resolution.primaryPortrait.derivation.limitations).toContain('missing-native-portrait-v2-evidence');
  });

  it('only treats a portrait with dimension evidence as usable consumer data', async () => {
    const empty = await resolvePrimaryPortraitV2({}, 'student-1', 'reviewer', { now, legacySnapshot: null, featureCache: null });
    const compatible = await resolvePrimaryPortraitV2({}, 'student-1', 'reviewer', {
      now,
      legacySnapshot: legacySnapshot(),
      featureCache: null,
    });

    expect(hasPortraitV2Evidence(empty.primaryPortrait)).toBe(false);
    expect(hasPortraitV2Evidence(compatible.primaryPortrait)).toBe(true);
  });
});
