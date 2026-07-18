import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CompetencyVector } from '../competency-model';
import { getProfileEligibleEvidenceSourceIds } from '../evidence-source-catalog';
import { readAdaptiveLearnerState } from '../adaptive-learner-state-service';
import { buildStudentEvidenceFeaturePayload } from '../student-evidence-feature-cache';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  PORTRAIT_V2_EVIDENCE_FAMILIES,
  PORTRAIT_V2_PAYLOAD_VERSION,
  createPortraitV2Payload,
  derivePortraitV2Compatibility,
  projectPortraitV2ForConsumer,
  readLatestPortraitV2Snapshot,
  validatePortraitV2Payload,
  validatePortraitV2Projection,
  writePortraitV2Snapshot,
  type PortraitV2Payload,
  type PortraitV2SnapshotRow,
} from '../portrait-v2-model';

const generatedAt = '2026-07-10T00:00:00.000Z';

function legacyVectorAt(input: {
  up: string;
  stable: string;
  down: string;
}): CompetencyVector {
  return {
    controlModeling: { score: 60, trend: 'up', confidence: 0.6, evidenceCount: 2, lastUpdated: input.up },
    parameterDesign: { score: 61, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: input.stable },
    crossDomainTransfer: { score: 62, trend: 'down', confidence: 0.6, evidenceCount: 2, lastUpdated: input.down },
    engineeringDecision: { score: 63, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: input.stable },
    inquiryReflection: { score: 64, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: input.stable },
    selfDirectedLearning: { score: 65, trend: 'up', confidence: 0.6, evidenceCount: 2, lastUpdated: input.up },
  };
}

function nativePayload(): PortraitV2Payload {
  return createPortraitV2Payload({
    userId: 'student-1',
    generatedAt,
    now: generatedAt,
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id, index) => ({
      id,
      score: 60 + index,
      confidence: 0.7,
      freshness: {
        state: 'current',
        asOf: generatedAt,
        evidenceAgeDays: 0,
      },
      evidenceSummary: {
        totalCount: 2,
        sourceFamilyCounts: { LearningFact: 2 },
      },
      lastPositiveEvidenceAt: generatedAt,
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [
        { kind: 'evidence-family', ref: 'LearningFact', privacyScope: 'student-visible' },
        {
          kind: 'citation',
          ref: `citation-target:sha256:${index.toString(16).padStart(64, '0')}`,
          privacyScope: 'student-visible',
        },
        {
          kind: 'hashed',
          ref: `sar:evidence:sha256:${index.toString(16).padStart(64, '0')}`,
          privacyScope: 'student-visible',
        },
        {
          kind: 'aggregate',
          ref: `aggregate:sha256:${index.toString(16).padStart(64, '0')}`,
          privacyScope: 'student-visible',
        },
        { kind: 'teacher-scoped', ref: `teacher-evidence:${index}`, privacyScope: 'teacher-scoped' },
        { kind: 'private-fixture', ref: `private-fixture:${index}`, privacyScope: 'admin-scoped' },
        { kind: 'raw-source', ref: `raw-source:${index}`, privacyScope: 'system-internal' },
      ],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  });
}

function migratedPayload(): PortraitV2Payload {
  const payload = nativePayload();
  payload.derivation = {
    kind: 'migrated',
    sourceLegacySnapshotId: 'legacy-1',
    sourceLegacySnapshotAt: generatedAt,
    mappingVersion: 'legacy-six-to-portrait-v2.v1',
    mappingConfidence: Object.fromEntries(PORTRAIT_V2_DIMENSION_IDS.map((id) => [id, 'high'])),
    limitations: ['legacy-six-dimensional-input-is-non-authoritative'],
  };
  payload.dimensions.forEach((dimension) => {
    dimension.sourceLineage.push({
      kind: 'migration-snapshot',
      ref: 'legacy-snapshot:legacy-1',
      privacyScope: 'audit-only',
    });
  });
  return payload;
}

function snapshotRow(
  payload: PortraitV2Payload = nativePayload(),
  overrides: Partial<PortraitV2SnapshotRow> = {},
): PortraitV2SnapshotRow {
  return {
    id: 'portrait-1',
    userId: payload.userId,
    snapshotAt: payload.generatedAt,
    payloadVersion: payload.payloadVersion,
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    migrationVersion: payload.migrationVersion,
    derivationKind: payload.derivation.kind,
    payload,
    ...overrides,
  };
}

describe('portrait v2 primary model', () => {
  it('defines exactly the seven canonical dimensions with complete primary metadata', () => {
    const payload = nativePayload();

    expect(payload.payloadVersion).toBe(PORTRAIT_V2_PAYLOAD_VERSION);
    expect(payload.dimensions.map((dimension) => dimension.id)).toEqual(PORTRAIT_V2_DIMENSION_IDS);
    expect(payload.dimensions).toHaveLength(7);
    expect(payload.dimensions[0]).toMatchObject({
      score: 60,
      confidence: 0.7,
      freshness: { state: 'current' },
      evidenceSummary: { totalCount: 2 },
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    });
    expect(() => validatePortraitV2Payload(payload)).not.toThrow();
  });

  it('rejects dimensions that omit learner-safe rationale or valid freshness age metadata', () => {
    const missingRationale = nativePayload();
    missingRationale.dimensions[0].rationale = '';
    const invalidAge = nativePayload();
    invalidAge.dimensions[0].freshness.evidenceAgeDays = -1;
    const invalidSourceCounts = nativePayload();
    invalidSourceCounts.dimensions[0].evidenceSummary.sourceFamilyCounts = [] as unknown as Record<string, number>;
    const invalidLineage = nativePayload();
    invalidLineage.dimensions[0].sourceLineage = 'citation:forged' as unknown as PortraitV2Payload['dimensions'][number]['sourceLineage'];
    const invalidMigrationRef = nativePayload();
    invalidMigrationRef.derivation.sourceLegacySnapshotId = 42 as unknown as string;

    expect(() => validatePortraitV2Payload(missingRationale)).toThrow('required metadata');
    expect(() => validatePortraitV2Payload(invalidAge)).toThrow('freshness metadata');
    expect(() => validatePortraitV2Payload(invalidSourceCounts)).toThrow('evidence counts');
    expect(() => validatePortraitV2Payload(invalidLineage)).toThrow('source lineage');
    expect(() => validatePortraitV2Payload(invalidMigrationRef)).toThrow('derivation metadata');
  });

  it.each(['student', 'konling', 'planner', 'reviewer', 'admin'] as const)(
    'rejects sensitive refs embedded in governed summary text for %s',
    (consumer) => {
      const payload = nativePayload();
      payload.derivation.limitations = ['migration-snapshot:legacy-private'];
      payload.dimensions[0].rationale = 'raw-source:teacher-answer-payload';
      payload.dimensions[0].limitations = ['private-fixture:diagnostic-secret'];

      expect(() => projectPortraitV2ForConsumer(payload, consumer)).toThrow('safe summary');
    },
  );

  it('rejects non-canonical timestamps and inconsistent freshness semantics', () => {
    const timezoneMissing = nativePayload();
    timezoneMissing.generatedAt = '2026-07-11T00:00:00';
    const missingWithEvidence = nativePayload();
    missingWithEvidence.dimensions[0].freshness = {
      state: 'missing',
      asOf: generatedAt,
      evidenceAgeDays: 0,
    };
    const currentWithoutEvidenceAge = nativePayload();
    currentWithoutEvidenceAge.dimensions[0].freshness.evidenceAgeDays = null;
    const inconsistentEvidenceAge = nativePayload();
    inconsistentEvidenceAge.dimensions[0].freshness.evidenceAgeDays = 3;
    const calculationVersionMismatch = nativePayload();
    calculationVersionMismatch.dimensions[0].calculationVersion = 'portrait-v2-primary.v0';

    expect(() => validatePortraitV2Payload(timezoneMissing)).toThrow('version metadata');
    expect(() => validatePortraitV2Payload(missingWithEvidence)).toThrow('freshness metadata');
    expect(() => validatePortraitV2Payload(currentWithoutEvidenceAge)).toThrow('freshness metadata');
    expect(() => validatePortraitV2Payload(inconsistentEvidenceAge)).toThrow('freshness metadata');
    expect(() => validatePortraitV2Payload(calculationVersionMismatch)).toThrow('calculation version');
  });

  it('enforces the documented 30/90-day freshness thresholds and evidence timestamp ordering', () => {
    const partialAge = nativePayload();
    partialAge.dimensions[0].freshness = {
      state: 'current',
      asOf: '2026-06-09T00:00:00.000Z',
      evidenceAgeDays: 31,
    };
    partialAge.dimensions[0].lastPositiveEvidenceAt = '2026-06-09T00:00:00.000Z';
    const staleAge = nativePayload();
    staleAge.dimensions[0].freshness = {
      state: 'partial',
      asOf: '2026-04-10T00:00:00.000Z',
      evidenceAgeDays: 91,
    };
    staleAge.dimensions[0].lastPositiveEvidenceAt = '2026-04-10T00:00:00.000Z';
    const futureEvidence = nativePayload();
    futureEvidence.dimensions[0].lastPositiveEvidenceAt = '2026-07-11T00:00:00.000Z';
    const evidenceAfterAsOf = nativePayload();
    evidenceAfterAsOf.dimensions[0].freshness = {
      state: 'current',
      asOf: '2026-07-09T00:00:00.000Z',
      evidenceAgeDays: 1,
    };

    expect(() => validatePortraitV2Payload(partialAge)).toThrow('freshness metadata');
    expect(() => validatePortraitV2Payload(staleAge)).toThrow('freshness metadata');
    expect(() => validatePortraitV2Payload(futureEvidence)).toThrow('evidence timestamps');
    expect(() => validatePortraitV2Payload(evidenceAfterAsOf)).toThrow('evidence timestamps');
  });

  it.each([
    ['native', nativePayload],
    ['migrated', migratedPayload],
  ] as const)('allows stable %s evidence without inventing a polarity timestamp', (_kind, payloadFactory) => {
    const stableEvidence = payloadFactory();
    stableEvidence.dimensions[0].freshness = {
      state: 'current',
      asOf: generatedAt,
      evidenceAgeDays: 0,
    };
    stableEvidence.dimensions[0].lastPositiveEvidenceAt = null;
    stableEvidence.dimensions[0].lastNegativeEvidenceAt = null;

    expect(() => validatePortraitV2Payload(stableEvidence)).not.toThrow();
  });

  it('requires evidence counts, missing state, and last evidence timestamps to describe one consistent record', () => {
    const hiddenCount = nativePayload();
    hiddenCount.dimensions[0].evidenceSummary.sourceFamilyCounts = { LearningFact: 1 };
    const missingWithCounts = nativePayload();
    missingWithCounts.dimensions[0].freshness = { state: 'missing', asOf: null, evidenceAgeDays: null };

    expect(() => validatePortraitV2Payload(hiddenCount)).toThrow('evidence counts');
    expect(() => validatePortraitV2Payload(missingWithCounts)).toThrow('evidence counts');
  });

  it('rejects a high-score high-confidence dimension that declares its governed evidence missing', () => {
    const forgedMissing = nativePayload();
    forgedMissing.dimensions[0] = {
      ...forgedMissing.dimensions[0],
      score: 100,
      confidence: 1,
      freshness: { state: 'missing', asOf: null, evidenceAgeDays: null },
      evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} },
      lastPositiveEvidenceAt: null,
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [],
    };

    expect(() => validatePortraitV2Payload(forgedMissing)).toThrow('missing evidence');
  });

  it('enforces derivation-specific missing summaries and forbids missing summaries on current or stale evidence', () => {
    const factories: Array<[PortraitV2Payload['derivation']['kind'], () => PortraitV2Payload]> = [
      ['native', nativePayload],
      ['migrated', migratedPayload],
      ['compatibility-derived', () => derivePortraitV2Compatibility({
        userId: 'student-1',
        snapshotId: 'legacy-1',
        snapshotAt: generatedAt,
        sourceFamily: 'StudentCompetencySnapshot',
        vector: legacyVectorAt({ up: generatedAt, stable: generatedAt, down: generatedAt }),
        now: new Date(generatedAt),
      })],
    ];

    for (const [kind, factory] of factories) {
      const missing = factory();
      missing.dimensions[0] = {
        ...missing.dimensions[0],
        score: 0,
        confidence: 0,
        freshness: { state: 'missing', asOf: null, evidenceAgeDays: null },
        evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} },
        lastPositiveEvidenceAt: null,
        lastNegativeEvidenceAt: null,
        rationale: 'No safe legacy mapping exists.',
        limitations: kind === 'compatibility-derived'
          ? ['missing-native-portrait-v2-evidence', 'no-safe-legacy-mapping']
          : ['missing-native-portrait-v2-evidence'],
        sourceLineage: [],
      };
      expect(() => validatePortraitV2Payload(missing), `${kind} canonical missing`).not.toThrow();

      const contradictoryMissing = structuredClone(missing);
      contradictoryMissing.dimensions[0].limitations.push('compatibility-derived-not-native-portrait-v2-evidence');
      expect(() => validatePortraitV2Payload(contradictoryMissing), `${kind} contradictory missing`)
        .toThrow('missing evidence');

      for (const freshnessState of ['current', 'stale'] as const) {
        const nonMissing = factory();
        if (freshnessState === 'stale') {
          nonMissing.dimensions[0].freshness = {
            state: 'stale',
            asOf: '2026-04-01T00:00:00.000Z',
            evidenceAgeDays: 100,
          };
          nonMissing.dimensions[0].lastPositiveEvidenceAt = '2026-04-01T00:00:00.000Z';
          nonMissing.dimensions[0].lastNegativeEvidenceAt = null;
        }
        expect(() => validatePortraitV2Payload(nonMissing), `${kind} canonical ${freshnessState}`)
          .not.toThrow();
        nonMissing.dimensions[0].rationale = 'No safe legacy mapping exists.';
        nonMissing.dimensions[0].limitations = ['missing-native-portrait-v2-evidence'];

        expect(() => validatePortraitV2Payload(nonMissing), `${kind} ${freshnessState} missing summary`)
          .toThrow('missing evidence');
      }
    }
  });

  it('requires native and migrated evidence counts to have family-compatible governed lineage', () => {
    const missingLineage = nativePayload();
    missingLineage.dimensions[0].sourceLineage = [];
    const mismatchedLineage = nativePayload();
    mismatchedLineage.dimensions[0].evidenceSummary.sourceFamilyCounts = { AbilityAssessment: 2 };

    expect(() => validatePortraitV2Payload(missingLineage)).toThrow('source lineage');
    expect(() => validatePortraitV2Payload(mismatchedLineage)).toThrow('source lineage');
  });

  it('requires evidence-family counts and lineage to agree in both directions', () => {
    const extraFamilyLineage = nativePayload();
    extraFamilyLineage.dimensions[0].sourceLineage.push({
      kind: 'evidence-family',
      ref: 'AbilityAssessment',
      privacyScope: 'student-visible',
    });
    const duplicateFamilyLineage = nativePayload();
    duplicateFamilyLineage.dimensions[0].sourceLineage.push({
      kind: 'evidence-family',
      ref: 'LearningFact',
      privacyScope: 'student-visible',
    });

    expect(() => validatePortraitV2Payload(extraFamilyLineage)).toThrow('source lineage');
    expect(() => validatePortraitV2Payload(duplicateFamilyLineage)).toThrow('source lineage');
  });

  it('rejects zero and negative source-family count entries instead of treating them as absent', () => {
    const zeroCountFamily = nativePayload();
    zeroCountFamily.dimensions[0].evidenceSummary.sourceFamilyCounts = {
      LearningFact: 2,
      AbilityAssessment: 0,
    };
    const negativeCountFamily = nativePayload();
    negativeCountFamily.dimensions[0].evidenceSummary.sourceFamilyCounts = {
      LearningFact: 3,
      AbilityAssessment: -1,
    };

    expect(() => validatePortraitV2Payload(zeroCountFamily)).toThrow('evidence counts');
    expect(() => validatePortraitV2Payload(negativeCountFamily)).toThrow('evidence counts');
  });

  it.each([
    { kind: 'citation', ref: `citation-target:sha256:${'0'.repeat(64)}`, privacyScope: 'student-visible' },
    { kind: 'aggregate', ref: `aggregate:sha256:${'0'.repeat(64)}`, privacyScope: 'student-visible' },
    { kind: 'hashed', ref: `sar:evidence:sha256:${'0'.repeat(64)}`, privacyScope: 'student-visible' },
    { kind: 'teacher-scoped', ref: 'teacher-evidence:0', privacyScope: 'teacher-scoped' },
    { kind: 'private-fixture', ref: 'private-fixture:0', privacyScope: 'admin-scoped' },
    { kind: 'raw-source', ref: 'raw-source:0', privacyScope: 'system-internal' },
  ] as const)('rejects orphan $kind lineage when the evidence total is zero', (orphanLineage) => {
    const payload = nativePayload();
    payload.dimensions[0].freshness = { state: 'missing', asOf: null, evidenceAgeDays: null };
    payload.dimensions[0].evidenceSummary = { totalCount: 0, sourceFamilyCounts: {} };
    payload.dimensions[0].lastPositiveEvidenceAt = null;
    payload.dimensions[0].lastNegativeEvidenceAt = null;
    payload.dimensions[0].sourceLineage = [orphanLineage];

    expect(() => validatePortraitV2Payload(payload)).toThrow('source lineage');
  });

  it('allows compatibility-derived portraits to cite only the two legacy compatibility source families', () => {
    const payload = derivePortraitV2Compatibility({
      userId: 'student-1',
      snapshotId: 'legacy-1',
      snapshotAt: generatedAt,
      sourceFamily: 'StudentCompetencySnapshot',
      vector: legacyVectorAt({ up: generatedAt, stable: generatedAt, down: generatedAt }),
      now: new Date(generatedAt),
    });
    payload.dimensions[0].evidenceSummary.sourceFamilyCounts = { LearningFact: 2 };
    payload.dimensions[0].sourceLineage = payload.dimensions[0].sourceLineage.map((ref) =>
      ref.kind === 'evidence-family'
        ? { kind: 'evidence-family', ref: 'LearningFact', privacyScope: 'student-visible' }
        : ref);

    expect(() => validatePortraitV2Payload(payload)).toThrow('evidence counts');
  });

  it('limits lineage to the actual derivation source', () => {
    const nativeWithMigrationLineage = nativePayload();
    nativeWithMigrationLineage.dimensions[0].sourceLineage.push({
      kind: 'migration-snapshot',
      ref: 'legacy-snapshot:legacy-1',
      privacyScope: 'audit-only',
    });
    const migratedWithoutMigrationLineage = migratedPayload();
    migratedWithoutMigrationLineage.dimensions[0].sourceLineage =
      migratedWithoutMigrationLineage.dimensions[0].sourceLineage.filter(
        (ref) => ref.kind !== 'migration-snapshot',
      );
    const migratedWithWrongSnapshot = migratedPayload();
    const migrationRef = migratedWithWrongSnapshot.dimensions[0].sourceLineage.find(
      (ref) => ref.kind === 'migration-snapshot',
    );
    if (migrationRef) migrationRef.ref = 'legacy-snapshot:legacy-2';
    const compatibilityWithInventedCitation = derivePortraitV2Compatibility({
      userId: 'student-1',
      snapshotId: 'legacy-1',
      snapshotAt: generatedAt,
      sourceFamily: 'StudentCompetencySnapshot',
      vector: legacyVectorAt({ up: generatedAt, stable: generatedAt, down: generatedAt }),
      now: new Date(generatedAt),
    });
    compatibilityWithInventedCitation.dimensions[0].sourceLineage.push({
      kind: 'citation',
      ref: `citation-target:sha256:${'0'.repeat(64)}`,
      privacyScope: 'student-visible',
    });

    expect(() => validatePortraitV2Payload(nativeWithMigrationLineage)).toThrow('source lineage');
    expect(() => validatePortraitV2Payload(migratedWithoutMigrationLineage)).toThrow('source lineage');
    expect(() => validatePortraitV2Payload(migratedWithWrongSnapshot)).toThrow('source lineage');
    expect(() => validatePortraitV2Payload(compatibilityWithInventedCitation)).toThrow('source lineage');
  });

  it('derives native portrait evidence families from profile-eligible catalog sources', () => {
    expect(PORTRAIT_V2_EVIDENCE_FAMILIES).toEqual(getProfileEligibleEvidenceSourceIds());
    expect(PORTRAIT_V2_EVIDENCE_FAMILIES).toEqual(expect.arrayContaining([
      'AbilityAssessment',
      'PromptAssessment',
      'InteractionLog',
      'StudentStepResponse',
    ]));

    for (const family of ['AbilityAssessment', 'PromptAssessment', 'InteractionLog', 'StudentStepResponse']) {
      const payload = nativePayload();
      payload.dimensions[0].evidenceSummary.sourceFamilyCounts = { [family]: 2 };
      payload.dimensions[0].sourceLineage[0] = {
        kind: 'evidence-family',
        ref: family,
        privacyScope: 'student-visible',
      };
      expect(() => validatePortraitV2Payload(payload)).not.toThrow();
    }

    const inventedFamily = nativePayload();
    inventedFamily.dimensions[0].evidenceSummary.sourceFamilyCounts = { AdaptiveAssessmentAnswer: 2 };
    inventedFamily.dimensions[0].sourceLineage[0] = {
      kind: 'evidence-family',
      ref: 'AdaptiveAssessmentAnswer',
      privacyScope: 'student-visible',
    };
    expect(() => validatePortraitV2Payload(inventedFamily)).toThrow('evidence counts');
  });

  it('rejects unknown persisted JSON fields at every governed nesting level', () => {
    const rootInjection = { ...nativePayload(), rawPayload: { secret: true } };
    const dimensionInjection = nativePayload() as PortraitV2Payload & {
      dimensions: Array<PortraitV2Payload['dimensions'][number] & { privateFixtureRef?: string }>;
    };
    dimensionInjection.dimensions[0].privateFixtureRef = 'fixture:private';
    const lineageInjection = nativePayload() as PortraitV2Payload;
    lineageInjection.dimensions[0].sourceLineage[0] = {
      ...lineageInjection.dimensions[0].sourceLineage[0],
      rawPayload: { answer: 'secret' },
    } as unknown as PortraitV2Payload['dimensions'][number]['sourceLineage'][number];

    expect(() => validatePortraitV2Payload(rootInjection)).toThrow('unknown fields');
    expect(() => validatePortraitV2Payload(dimensionInjection)).toThrow('unknown fields');
    expect(() => validatePortraitV2Payload(lineageInjection)).toThrow('unknown fields');
  });

  it('rejects ungoverned evidence-family keys and forged lineage kind/ref/scope combinations', () => {
    const injectedFamily = nativePayload();
    injectedFamily.dimensions[0].evidenceSummary.sourceFamilyCounts = {
      LearningFact: 1,
      'rawPayload:teacher-secret': 1,
    };
    const forgedCitation = nativePayload();
    forgedCitation.dimensions[0].sourceLineage[0] = {
      kind: 'citation',
      ref: 'teacher-evidence:private-note',
      privacyScope: 'student-visible',
    };
    const elevatedCitation = nativePayload();
    elevatedCitation.dimensions[0].sourceLineage[0] = {
      kind: 'citation',
      ref: `citation-target:sha256:${'0'.repeat(64)}`,
      privacyScope: 'teacher-scoped',
    };
    const malformedHash = nativePayload();
    malformedHash.dimensions[0].sourceLineage[0] = {
      kind: 'hashed',
      ref: 'sha256:not-a-governed-scope-hash',
      privacyScope: 'student-visible',
    };

    expect(() => validatePortraitV2Payload(injectedFamily)).toThrow('evidence counts');
    expect(() => validatePortraitV2Payload(forgedCitation)).toThrow('source lineage');
    expect(() => validatePortraitV2Payload(elevatedCitation)).toThrow('source lineage');
    expect(() => validatePortraitV2Payload(malformedHash)).toThrow('source lineage');
  });

  it('rejects learner-facing citation and aggregate refs that only self-declare a safe prefix and scope', () => {
    const rawCitation = nativePayload();
    rawCitation.dimensions[0].sourceLineage[1] = {
      kind: 'citation',
      ref: 'citation:raw-answer-secret-token',
      privacyScope: 'student-visible',
    };
    const rawAggregate = nativePayload();
    rawAggregate.dimensions[0].sourceLineage[3] = {
      kind: 'aggregate',
      ref: 'aggregate:raw-answer-secret-token',
      privacyScope: 'student-visible',
    };

    expect(() => validatePortraitV2Payload(rawCitation)).toThrow('source lineage');
    expect(() => validatePortraitV2Payload(rawAggregate)).toThrow('source lineage');
  });

  it('derives compatibility freshness, polarity timestamps, and lineage from the actual legacy source', () => {
    const now = new Date('2026-07-11T00:00:00.000Z');
    const payload = derivePortraitV2Compatibility({
      userId: 'student-1',
      snapshotId: 'legacy-1',
      snapshotAt: '2026-07-05T00:00:00.000Z',
      sourceFamily: 'StudentCompetencySnapshot',
      vector: legacyVectorAt({
        up: '2026-07-01T00:00:00.000Z',
        stable: '2026-05-20T00:00:00.000Z',
        down: '2026-01-01T00:00:00.000Z',
      }),
      now,
    });

    expect(payload.generatedAt).toBe(now.toISOString());
    expect(payload.dimensions[0]).toMatchObject({
      freshness: { state: 'current', asOf: '2026-07-01T00:00:00.000Z', evidenceAgeDays: 10 },
      lastPositiveEvidenceAt: '2026-07-01T00:00:00.000Z',
      lastNegativeEvidenceAt: null,
      evidenceSummary: { sourceFamilyCounts: { StudentCompetencySnapshot: 2 } },
    });
    expect(payload.dimensions[2]).toMatchObject({
      freshness: { state: 'partial', asOf: '2026-05-20T00:00:00.000Z', evidenceAgeDays: 52 },
      lastPositiveEvidenceAt: null,
      lastNegativeEvidenceAt: null,
    });
    expect(payload.dimensions[5]).toMatchObject({
      freshness: { state: 'stale', asOf: '2026-01-01T00:00:00.000Z', evidenceAgeDays: 191 },
      lastPositiveEvidenceAt: null,
      lastNegativeEvidenceAt: '2026-01-01T00:00:00.000Z',
    });
    expect(payload.dimensions[0].sourceLineage).toEqual(expect.arrayContaining([
      { kind: 'evidence-family', ref: 'StudentCompetencySnapshot', privacyScope: 'student-visible' },
      { kind: 'migration-snapshot', ref: 'legacy-snapshot:legacy-1', privacyScope: 'audit-only' },
    ]));
  });

  it('ignores zero-evidence legacy dimensions when deriving score, freshness, and polarity', () => {
    const vector = legacyVectorAt({
      up: '2026-07-04T00:00:00.000Z',
      stable: '2026-07-03T00:00:00.000Z',
      down: '2026-07-02T00:00:00.000Z',
    });
    vector.inquiryReflection = {
      score: 100,
      trend: 'down',
      confidence: 1,
      evidenceCount: 0,
      lastUpdated: '2099-01-01T00:00:00.000Z',
    };
    vector.selfDirectedLearning = {
      score: 40,
      trend: 'up',
      confidence: 0.4,
      evidenceCount: 2,
      lastUpdated: '2026-07-04T00:00:00.000Z',
    };

    const payload = derivePortraitV2Compatibility({
      userId: 'student-1',
      snapshotId: 'legacy-1',
      snapshotAt: '2026-07-05T00:00:00.000Z',
      sourceFamily: 'StudentCompetencySnapshot',
      vector,
      now: new Date('2026-07-11T00:00:00.000Z'),
    });

    expect(payload.dimensions[6]).toMatchObject({
      score: 40,
      freshness: { asOf: '2026-07-04T00:00:00.000Z', evidenceAgeDays: 7 },
      lastPositiveEvidenceAt: '2026-07-04T00:00:00.000Z',
      lastNegativeEvidenceAt: null,
      evidenceSummary: { totalCount: 2 },
    });
    expect(payload.dimensions[6].confidence).toBeCloseTo(0.28);
  });

  it('tolerates legacy snapshot clock skew while rejecting future compatibility evidence', () => {
    const now = new Date(generatedAt);
    const vector = legacyVectorAt({
      up: generatedAt,
      stable: generatedAt,
      down: generatedAt,
    });

    expect(() => derivePortraitV2Compatibility({
      userId: 'student-1',
      snapshotAt: '2026-07-11T00:00:00.001Z',
      sourceFamily: 'StudentCompetencySnapshot',
      vector,
      now,
    })).toThrow('snapshotAt');

    const skewedNow = new Date('2026-07-10T00:00:00.002Z');
    vector.controlModeling.lastUpdated = '2026-07-10T00:00:00.001Z';
    expect(() => derivePortraitV2Compatibility({
      userId: 'student-1',
      snapshotAt: '2026-07-10T00:00:00.000Z',
      sourceFamily: 'StudentCompetencySnapshot',
      vector,
      now: skewedNow,
    })).not.toThrow();

    vector.controlModeling.lastUpdated = '2026-07-10T00:00:00.003Z';
    expect(() => derivePortraitV2Compatibility({
      userId: 'student-1',
      snapshotAt: '2026-07-10T00:00:00.000Z',
      sourceFamily: 'StudentCompetencySnapshot',
      vector,
      now: skewedNow,
    })).toThrow('lastUpdated');

    const delayedVector = legacyVectorAt({
      up: '2026-07-01T00:05:00.001Z',
      stable: '2026-07-01T00:00:00.000Z',
      down: '2026-07-01T00:00:00.000Z',
    });
    expect(() => derivePortraitV2Compatibility({
      userId: 'student-1',
      snapshotAt: '2026-07-01T00:00:00.000Z',
      sourceFamily: 'StudentCompetencySnapshot',
      vector: delayedVector,
      now,
    })).toThrow('clock skew');
  });

  it('requires derivation metadata to distinguish native, migrated, and compatibility records', () => {
    const migratedWithoutSource = nativePayload();
    migratedWithoutSource.derivation = { kind: 'migrated', limitations: [] };
    const compatibilityWithoutLimitation = nativePayload();
    compatibilityWithoutLimitation.derivation = { kind: 'compatibility-derived', limitations: [] };
    const nativeWithLegacySource = nativePayload();
    nativeWithLegacySource.derivation.sourceLegacySnapshotId = 'legacy-1';

    expect(() => validatePortraitV2Payload(migratedWithoutSource)).toThrow('derivation metadata');
    expect(() => validatePortraitV2Payload(compatibilityWithoutLimitation)).toThrow('derivation metadata');
    expect(() => validatePortraitV2Payload(nativeWithLegacySource)).toThrow('derivation metadata');
  });

  it('rejects a six-dimensional competency vector as a primary portrait write', async () => {
    const legacyVector = {
      controlModeling: { score: 60 },
      parameterDesign: { score: 60 },
      crossDomainTransfer: { score: 60 },
      engineeringDecision: { score: 60 },
      inquiryReflection: { score: 60 },
      selfDirectedLearning: { score: 60 },
    } as unknown as CompetencyVector;
    const db = {
      studentPortraitV2Snapshot: {
        create: async () => ({ id: 'should-not-write' }),
      },
    };

    await expect(writePortraitV2Snapshot(db, legacyVector as unknown as PortraitV2Payload))
      .rejects.toThrow('canonical portrait v2 payload');
  });

  it('keeps privacy projections outside the primary portrait write boundary', async () => {
    let writes = 0;
    const db = {
      studentPortraitV2Snapshot: {
        create: async () => {
          writes += 1;
          return { id: 'must-not-write' };
        },
      },
    };
    const persistable = nativePayload();
    const projected = projectPortraitV2ForConsumer(persistable, 'student');

    expect(Object.getOwnPropertySymbols(persistable)).toEqual([]);
    expect(Object.getOwnPropertySymbols(projected)).toEqual([]);
    Object.defineProperty(projected, Symbol('forged-persistable-brand'), {
      value: true,
      enumerable: false,
    });

    if (false) {
      // @ts-expect-error A consumer projection is intentionally not a persistable primary payload.
      await writePortraitV2Snapshot(db, projected);
    }
    await expect(writePortraitV2Snapshot(db, projected as unknown as PortraitV2Payload))
      .rejects.toThrow('factory-sealed persistable payload');
    expect(writes).toBe(0);

    await expect(writePortraitV2Snapshot(db, nativePayload()))
      .resolves.toMatchObject({ id: 'must-not-write' });
    expect(writes).toBe(1);
  });

  it('stores and reads the canonical versioned payload without using legacy competency storage', async () => {
    let stored: Record<string, unknown> | null = null;
    const db = {
      studentPortraitV2Snapshot: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = { id: 'portrait-1', ...data };
          return stored;
        },
        findFirst: async () => stored,
      },
    };

    const written = await writePortraitV2Snapshot(db, nativePayload());
    const read = await readLatestPortraitV2Snapshot(db, 'student-1', 'admin');

    expect(written.id).toBe('portrait-1');
    expect(stored).toMatchObject({
      userId: 'student-1',
      payloadVersion: PORTRAIT_V2_PAYLOAD_VERSION,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      derivationKind: 'native',
    });
    expect(read?.dimensions).toHaveLength(7);
    expect(read?.dimensions[0].sourceLineage).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'migration-snapshot' }),
    ]));
  });

  it('rejects forged missing evidence before write and round-trips a canonical missing dimension', async () => {
    let stored: Record<string, unknown> | null = null;
    const db = {
      studentPortraitV2Snapshot: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = { id: 'portrait-missing', ...data };
          return stored;
        },
        findFirst: async () => stored,
      },
    };
    const forgedMissing = nativePayload();
    forgedMissing.dimensions[0] = {
      ...forgedMissing.dimensions[0],
      score: 100,
      confidence: 1,
      freshness: { state: 'missing', asOf: null, evidenceAgeDays: null },
      evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} },
      lastPositiveEvidenceAt: null,
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [],
    };

    await expect(writePortraitV2Snapshot(db, forgedMissing))
      .rejects.toThrow('canonical portrait v2 payload');
    expect(stored).toBeNull();

    const canonicalMissing = nativePayload();
    canonicalMissing.dimensions[0] = {
      ...canonicalMissing.dimensions[0],
      score: 0,
      confidence: 0,
      freshness: { state: 'missing', asOf: null, evidenceAgeDays: null },
      evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} },
      lastPositiveEvidenceAt: null,
      lastNegativeEvidenceAt: null,
      rationale: 'No safe legacy mapping exists.',
      limitations: ['missing-native-portrait-v2-evidence'],
      sourceLineage: [],
    };

    await expect(writePortraitV2Snapshot(db, canonicalMissing))
      .resolves.toMatchObject({ id: 'portrait-missing' });
    const read = await readLatestPortraitV2Snapshot(db, 'student-1', 'admin');
    expect(read?.dimensions[0]).toMatchObject({
        score: 0,
        confidence: 0,
        freshness: { state: 'missing', asOf: null, evidenceAgeDays: null },
        rationale: 'No safe legacy mapping exists.',
        limitations: ['missing-native-portrait-v2-evidence'],
    });
  });

  it.each([
    ['row user', { userId: 'student-2' }],
    ['payload user', { payload: { ...nativePayload(), userId: 'student-2' } }],
    ['payload version', { payloadVersion: 'learner-portrait.v1' }],
    ['calculation version', { calculationVersion: 'portrait-v2-primary.v0' }],
    ['migration version', { migrationVersion: 'portrait-v2-migration.v0' }],
    ['derivation kind', { derivationKind: 'migrated' }],
    ['snapshot timestamp', { snapshotAt: '2026-07-10T23:59:59.000Z' }],
  ] as const)('fails closed when persisted %s metadata disagrees', async (_label, overrides) => {
    const db = {
      studentPortraitV2Snapshot: {
        findFirst: async () => snapshotRow(nativePayload(), overrides),
      },
    };

    await expect(readLatestPortraitV2Snapshot(db, 'student-1', 'student'))
      .rejects.toThrow('persisted portrait v2 snapshot');
  });

  it('normalizes Date snapshot timestamps before enforcing payload generatedAt identity', async () => {
    const db = {
      studentPortraitV2Snapshot: {
        findFirst: async () => snapshotRow(nativePayload(), { snapshotAt: new Date(generatedAt) }),
      },
    };

    await expect(readLatestPortraitV2Snapshot(db, 'student-1', 'student'))
      .resolves.toMatchObject({ generatedAt });
  });

  it('rejects far-future generatedAt on write and snapshotAt on read with an injectable clock', async () => {
    const futurePayload = nativePayload();
    futurePayload.generatedAt = '2099-01-01T00:00:00.000Z';
    futurePayload.dimensions.forEach((dimension) => {
      dimension.freshness.asOf = futurePayload.generatedAt;
      dimension.lastPositiveEvidenceAt = futurePayload.generatedAt;
    });
    const now = new Date('2026-07-11T00:00:00.000Z');

    await expect(writePortraitV2Snapshot({
      studentPortraitV2Snapshot: { create: async () => ({ id: 'future' }) },
    }, futurePayload, { now })).rejects.toThrow('future');

    await expect(readLatestPortraitV2Snapshot({
      studentPortraitV2Snapshot: { findFirst: async () => snapshotRow(futurePayload) },
    }, 'student-1', 'student', { now })).rejects.toThrow('persisted portrait v2 snapshot');

    await expect(writePortraitV2Snapshot({
      studentPortraitV2Snapshot: { create: async () => ({ id: 'current' }) },
    }, nativePayload(), { now })).resolves.toMatchObject({ id: 'current' });
  });

  it('uses zero future tolerance for payload and persisted snapshot timestamps', async () => {
    const now = new Date(generatedAt);
    const oneMillisecondFuture = '2026-07-10T00:00:00.001Z';
    const futurePayload = nativePayload();
    futurePayload.generatedAt = oneMillisecondFuture;
    futurePayload.dimensions.forEach((dimension) => {
      dimension.freshness.asOf = oneMillisecondFuture;
      dimension.lastPositiveEvidenceAt = oneMillisecondFuture;
    });

    expect(() => validatePortraitV2Payload(futurePayload, { now })).toThrow('future');
    await expect(readLatestPortraitV2Snapshot({
      studentPortraitV2Snapshot: {
        findFirst: async () => snapshotRow(nativePayload(), { snapshotAt: oneMillisecondFuture }),
      },
    }, 'student-1', 'student', { now })).rejects.toThrow('persisted portrait v2 snapshot');
  });

  it('persists portrait v2 in a dedicated primary snapshot model', () => {
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('model StudentPortraitV2Snapshot {');
    expect(schema).toMatch(/\bpayload\s+Json\b/);
    expect(schema).toMatch(/\bderivationKind\s+String\b/);
    expect(schema).not.toMatch(/model StudentPortraitV2Snapshot[\s\S]*?competencyVector\s+Json/);
  });

  it.each(['student', 'konling', 'planner'] as const)(
    'redacts restricted source lineage for %s consumers',
    (consumer) => {
      const payload = nativePayload();
      const projected = projectPortraitV2ForConsumer(payload, consumer);
      const refs = projected.dimensions.flatMap((dimension) => dimension.sourceLineage);
      const kinds = refs.map((ref) => ref.kind);

      expect(projected.dimensions[0].evidenceSummary.sourceFamilyCounts).toEqual({ LearningFact: 2 });
      expect(projected.dimensions[0].evidenceSummary.sourceFamilyCounts)
        .not.toBe(payload.dimensions[0].evidenceSummary.sourceFamilyCounts);
      expect(projected.dimensions[0].sourceLineage[0]).not.toBe(payload.dimensions[0].sourceLineage[0]);
      expect(kinds).toEqual(expect.arrayContaining(['citation', 'hashed']));
      expect(kinds).not.toContain('teacher-scoped');
      expect(kinds).not.toContain('private-fixture');
      expect(kinds).not.toContain('migration-snapshot');
      expect(kinds).not.toContain('raw-source');
      expect(projected.derivation.sourceLegacySnapshotId).toBeUndefined();
    },
  );

  it.each(['student', 'konling', 'planner', 'reviewer', 'admin'] as const)(
    'returns a valid migrated projection with audit-only snapshot identity visibility for %s',
    (consumer) => {
      const projected = projectPortraitV2ForConsumer(migratedPayload(), consumer);
      const canReadAuditOnly = consumer === 'admin';

      expect(projected.derivation.sourceLegacySnapshotId).toBe(canReadAuditOnly ? 'legacy-1' : undefined);
      expect(projected.dimensions.flatMap((dimension) => dimension.sourceLineage)
        .some((ref) => ref.kind === 'migration-snapshot')).toBe(canReadAuditOnly);
      expect(() => validatePortraitV2Projection(projected, consumer)).not.toThrow();
    },
  );

  it('rejects a migrated projection when it is validated against a narrower consumer contract', () => {
    const adminProjection = projectPortraitV2ForConsumer(migratedPayload(), 'admin');
    const nativeAdminProjection = projectPortraitV2ForConsumer(nativePayload(), 'admin');

    expect(() => validatePortraitV2Projection(adminProjection, 'student')).toThrow('derivation metadata');
    expect(() => validatePortraitV2Projection(nativeAdminProjection, 'student')).toThrow('source lineage');
  });

  it.each(['student', 'konling', 'planner', 'reviewer', 'admin'] as const)(
    'reads a valid migrated projection with audit-only snapshot identity visibility for %s',
    async (consumer) => {
      const projected = await readLatestPortraitV2Snapshot({
        studentPortraitV2Snapshot: { findFirst: async () => snapshotRow(migratedPayload()) },
      }, 'student-1', consumer);
      const canReadAuditOnly = consumer === 'admin';

      expect(projected?.derivation.sourceLegacySnapshotId).toBe(canReadAuditOnly ? 'legacy-1' : undefined);
      expect(() => validatePortraitV2Projection(projected, consumer)).not.toThrow();
    },
  );

  it('allows scoped audit lineage for reviewers and administrators but never raw source payload refs', () => {
    const reviewer = projectPortraitV2ForConsumer(nativePayload(), 'reviewer');
    const admin = projectPortraitV2ForConsumer(migratedPayload(), 'admin');
    const reviewerKinds = reviewer.dimensions.flatMap((dimension) => dimension.sourceLineage.map((ref) => ref.kind));
    const adminKinds = admin.dimensions.flatMap((dimension) => dimension.sourceLineage.map((ref) => ref.kind));

    expect(reviewerKinds).toContain('teacher-scoped');
    expect(reviewerKinds).not.toContain('private-fixture');
    expect(adminKinds).toEqual(expect.arrayContaining(['teacher-scoped', 'private-fixture', 'migration-snapshot']));
    expect(reviewerKinds).not.toContain('raw-source');
    expect(adminKinds).not.toContain('raw-source');
  });

  it.each([
    ['teacher', 'teacher-scoped'],
    ['admin', 'private-fixture'],
  ] as const)('preserves authorized %s lineage for direct learner-state reads', async (role, expectedKind) => {
    const payload = nativePayload();
    const state = await readAdaptiveLearnerState({
      studentPortraitV2Snapshot: {
        findFirst: async () => snapshotRow(payload),
      },
    }, {
      userId: 'student-1',
      role,
      now: new Date(generatedAt),
    });

    const kinds = state.primaryPortrait.dimensions.flatMap((dimension) =>
      dimension.sourceLineage.map((ref) => ref.kind));
    expect(kinds).toContain(expectedKind);
    expect(kinds).not.toContain('raw-source');
  });

  it('exposes portrait v2 as learner-state primary truth and marks the six-dimensional vector compatibility-only', async () => {
    const payload = nativePayload();
    const legacyVector = {
      controlModeling: { score: 60, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
      parameterDesign: { score: 61, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
      crossDomainTransfer: { score: 62, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
      engineeringDecision: { score: 63, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
      inquiryReflection: { score: 64, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
      selfDirectedLearning: { score: 65, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
    } satisfies CompetencyVector;
    const state = await readAdaptiveLearnerState({
      studentPortraitV2Snapshot: {
        findFirst: async () => snapshotRow(payload),
      },
      studentCompetencySnapshot: {
        findFirst: async () => ({
          id: 'legacy-1',
          snapshotAt: new Date(generatedAt),
          competencyVector: legacyVector,
        }),
      },
    }, {
      userId: 'student-1',
      role: 'student',
      now: new Date(generatedAt),
    });

    expect(state.primaryPortrait.dimensions.map((dimension) => dimension.id)).toEqual(PORTRAIT_V2_DIMENSION_IDS);
    expect(state.primaryPortrait.derivation.kind).toBe('native');
    expect(state.primaryCompetencies.authority).toBe('legacy-compatibility-only');
  });

  it('falls back to legacy compatibility when a persisted portrait row is invalid and records the limitation', async () => {
    const payload = nativePayload();
    const state = await readAdaptiveLearnerState({
      studentPortraitV2Snapshot: {
        findFirst: async () => snapshotRow(payload, { snapshotAt: '2026-07-10T23:59:59.000Z' }),
      },
      studentCompetencySnapshot: {
        findFirst: async () => ({
          id: 'legacy-1',
          snapshotAt: new Date(generatedAt),
          competencyVector: {
            controlModeling: { score: 60, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
            parameterDesign: { score: 61, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
            crossDomainTransfer: { score: 62, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
            engineeringDecision: { score: 63, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
            inquiryReflection: { score: 64, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
            selfDirectedLearning: { score: 65, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
          } satisfies CompetencyVector,
        }),
      },
    }, {
      userId: 'student-1',
      role: 'student',
      now: new Date(generatedAt),
    });

    expect(state.primaryPortrait.derivation.kind).toBe('compatibility-derived');
    expect(state.primaryPortrait.derivation.limitations).toContain('persisted-portrait-v2-invalid-or-incompatible');
    expect(state.primaryPortrait.userId).toBe('student-1');
  });

  it('uses one injected service clock to reject a future persisted portrait and generate the compatibility fallback', async () => {
    const now = new Date('2020-06-15T00:00:00.000Z');
    const futurePayload = nativePayload();
    const legacyVector = legacyVectorAt({
      up: '2020-06-10T00:00:00.000Z',
      stable: '2020-05-20T00:00:00.000Z',
      down: '2020-01-01T00:00:00.000Z',
    });
    const state = await readAdaptiveLearnerState({
      studentPortraitV2Snapshot: {
        findFirst: async () => snapshotRow(futurePayload),
      },
      studentCompetencySnapshot: {
        findFirst: async () => ({
          id: 'legacy-2020',
          snapshotAt: now,
          competencyVector: legacyVector,
        }),
      },
    }, {
      userId: 'student-1',
      role: 'student',
      now,
    });

    expect(state.generatedAt).toBe(now.toISOString());
    expect(state.primaryPortrait.generatedAt).toBe(now.toISOString());
    expect(state.primaryPortrait.derivation.kind).toBe('compatibility-derived');
    expect(state.primaryPortrait.derivation.limitations)
      .toContain('persisted-portrait-v2-invalid-or-incompatible');
  });

  it('records StudentEvidenceFeatureCache as the compatibility source when no direct legacy snapshot is readable', async () => {
    const now = new Date('2026-07-11T00:00:00.000Z');
    const vector = legacyVectorAt({
      up: '2026-07-01T00:00:00.000Z',
      stable: '2026-05-20T00:00:00.000Z',
      down: '2026-01-01T00:00:00.000Z',
    });
    const cache = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts: [],
      latestSnapshot: {
        snapshotAt: new Date('2026-07-05T00:00:00.000Z'),
        factCount: 12,
        calculationVersion: 'competency-v2',
        competencyVector: vector,
      },
      now,
    });
    const state = await readAdaptiveLearnerState({
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          ...cache,
          refreshedAt: now,
        }),
      },
    }, {
      userId: 'student-1',
      role: 'student',
      now,
    });

    expect(state.primaryCompetencies.source).toBe('feature-cache');
    expect(state.primaryPortrait.dimensions[0].evidenceSummary.sourceFamilyCounts)
      .toEqual({ StudentEvidenceFeatureCache: 2 });
    expect(state.primaryPortrait.dimensions[0].sourceLineage).toContainEqual({
      kind: 'evidence-family',
      ref: 'StudentEvidenceFeatureCache',
      privacyScope: 'student-visible',
    });
  });

  it('does not swallow portrait persistence service failures', async () => {
    const persistenceError = new Error('portrait database unavailable');

    await expect(readAdaptiveLearnerState({
      studentPortraitV2Snapshot: {
        findFirst: async () => { throw persistenceError; },
      },
    }, {
      userId: 'student-1',
      role: 'student',
      now: new Date(generatedAt),
    })).rejects.toBe(persistenceError);
  });

  it('derives an explicitly non-authoritative seven-dimensional compatibility view when only legacy data exists', async () => {
    const legacyVector = {
      controlModeling: { score: 60, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
      parameterDesign: { score: 61, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
      crossDomainTransfer: { score: 62, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
      engineeringDecision: { score: 63, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
      inquiryReflection: { score: 64, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
      selfDirectedLearning: { score: 65, trend: 'stable', confidence: 0.6, evidenceCount: 2, lastUpdated: generatedAt },
    } satisfies CompetencyVector;
    const state = await readAdaptiveLearnerState({
      studentCompetencySnapshot: {
        findFirst: async () => ({
          id: 'legacy-1',
          snapshotAt: new Date(generatedAt),
          competencyVector: legacyVector,
        }),
      },
    }, {
      userId: 'student-1',
      role: 'student',
      now: new Date(generatedAt),
    });

    expect(state.primaryPortrait.dimensions).toHaveLength(7);
    expect(state.primaryPortrait.derivation).toMatchObject({
      kind: 'compatibility-derived',
      limitations: ['legacy-six-dimensional-input-is-non-authoritative'],
    });
    expect(state.primaryPortrait.derivation.sourceLegacySnapshotId).toBeUndefined();
    expect(state.primaryPortrait.dimensions.flatMap((dimension) => dimension.sourceLineage)).toEqual(
      expect.arrayContaining([
        { kind: 'evidence-family', ref: 'StudentCompetencySnapshot', privacyScope: 'student-visible' },
      ]),
    );
  });
});
