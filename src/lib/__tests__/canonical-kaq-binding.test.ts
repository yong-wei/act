import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ACCEPTED_DELTA_RECEIPT_EVIDENCE_VERSION,
  admittedCanonicalIdsFromCoverageEntries,
  assertAcceptedDeltaReceiptEvidence,
  assertConflictLedgerIntegrity,
  assertFormalSelectorUnchanged,
  assertFormalTeachingProjectionProof,
  assertKaqPinnedContextFingerprint,
  assertNoForbiddenAutoInheritance,
  assertPlannerMayConsumeTeachingRelations,
  assertReviewedKaqRoleCanonicalMapping,
  assertShadowCannotActivateKaqCutover,
  assertVerifiedCourseCoverageBundle,
  assertVerifiedKaqPinnedContext,
  buildActkgTeachingProjectionRelation,
  buildKaqPinnedContextFromVerifiedAuthority,
  buildReviewedKaqRoleCanonicalMapping,
  courseCoverageCreatesTeachingProjectionEdge,
  detectTeachingRelationConflicts,
  detectTeachingRelationCycles,
  describeActkgTeachingRelationAuthority,
  describeKaqOwnedRelationAuthority,
  engineeringPredicateTeachingInferenceTable,
  evaluateKaqCatalogCanonicalReadiness,
  formalKaqConsumersUseLegacy,
  generateKaqCanonicalBindings,
  inferTeachingRelationFromEngineeringPredicate,
  KAQ_OWNED_RELATION_NAMESPACES,
  KaqAuthorityInputError,
  KaqCutoverActivationError,
  KaqPinnedContextError,
  listAutocontrolKaqKnowledgeRoleIds,
  markStaleKaqBindings,
  migrationReviewSeesCanonicalReadiness,
  PINNED_KAQ_AGGREGATE_RELEASE_ID,
  PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
  PINNED_KAQ_COVERAGE_OVERLAY_ID,
  preserveHistoricalLearningFacts,
  projectKaqCatalogCanonicalBindingStatus,
  projectKaqEdgeToCanonicalSpace,
  rejectAutoInheritedBinding,
  resolveReviewedShadowBindings,
  resolveTeachingProjectionAvailability,
  retireAcceptedConflictingKaqRelations,
  reviewKaqCanonicalBinding,
  reviewTeachingRelationConflict,
  selectKaqAuthority,
  selectPlannerTeachingRelations,
  tryActivateKaqCanonicalCutover,
  unavailableTeachingProjection,
  validateAutocontrolKaqGraphCatalogWithCanonicalReadiness,
  type AcceptedDeltaReceiptEvidence,
  type KaqCanonicalBinding,
  type KaqKnowledgeToKnowledgeRelation,
  type ReviewedKaqRoleCanonicalMapping,
  type VerifiedKaqPinnedContext,
} from '@/lib/canonical-kaq-binding';
import {
  mintAcceptedDeltaEvidenceForTests,
  mintFormalTeachingProjectionProofForTests,
  mintVerifiedCoverageForTests,
  mintVerifiedKaqPinnedContextForTests,
} from '@/lib/canonical-kaq-binding/testing';
import { buildKaqPinnedContext } from '@/lib/canonical-kaq-binding/pinned-context';
import type { AggregateCoverageAuthoritySource } from '@/lib/canonical-kaq-binding';
import {
  AUTOCONTROL_KAQ_GRAPH_VERSION,
  validateAutocontrolKaqGraphCatalog,
} from '@/lib/data-governance/autocontrol-kaq-graph-catalog';
import {
  describeKaqOwnedGraphRelation,
  kaqGraphEdgeOwnership,
} from '@/lib/data-governance/kaq-graph-schema';

const releaseHash = 'a'.repeat(64);
const sourceDatasetHash = 'b'.repeat(64);
const coverageSourceHash = 'c'.repeat(64);
const coverageCaptureRevision = 'd'.repeat(40);
const deltaReceiptId = 'delta-receipt:accepted-aggregate-v1';
const coverageVersionId = 'agg-cov:automatic-control@1';
const governanceReceiptId = 'agg-gov:receipt-v1';

function pinned(overrides: Partial<{
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string;
  deltaReceiptId: string;
  coverageOverlayId: string;
  coverageOverlayVersion: string;
  coverageSourceHash: string;
  coverageCaptureRevision: string;
  admittedCanonicalIds: readonly string[];
}> = {}): import('@/lib/canonical-kaq-binding').VerifiedKaqPinnedContext {
  const defaultAdmitted = [
    'ctr:object:feedback-loop',
    'ctr:object:transfer-function',
    'ctr:object:root-locus',
    'ctr:object:bode-plot',
  ];
  const fields = {
    releaseSetId: overrides.releaseSetId ?? PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
    releaseId: overrides.releaseId ?? PINNED_KAQ_AGGREGATE_RELEASE_ID,
    releaseHash: overrides.releaseHash ?? releaseHash,
    sourceDatasetHash: overrides.sourceDatasetHash ?? sourceDatasetHash,
    deltaReceiptId: overrides.deltaReceiptId ?? deltaReceiptId,
    coverageOverlayId: overrides.coverageOverlayId ?? PINNED_KAQ_COVERAGE_OVERLAY_ID,
    coverageOverlayVersion: overrides.coverageOverlayVersion ?? '1',
    coverageSourceHash: overrides.coverageSourceHash ?? coverageSourceHash,
    coverageCaptureRevision: overrides.coverageCaptureRevision ?? coverageCaptureRevision,
    admittedCanonicalIds: overrides.admittedCanonicalIds
      ? [...overrides.admittedCanonicalIds]
      : defaultAdmitted,
  };
  return mintVerifiedKaqPinnedContextForTests(fields);
}

function rawUnverifiedPinned() {
  return buildKaqPinnedContext({
    releaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
    releaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
    releaseHash,
    sourceDatasetHash,
    deltaReceiptId,
    coverageOverlayId: PINNED_KAQ_COVERAGE_OVERLAY_ID,
    coverageOverlayVersion: '1',
    coverageSourceHash,
    coverageCaptureRevision,
    admittedCanonicalIds: [
      'ctr:object:feedback-loop',
      'ctr:object:transfer-function',
      'ctr:object:root-locus',
      'ctr:object:bode-plot',
    ],
  });
}

function acceptBinding(
  binding: KaqCanonicalBinding,
  context: ReturnType<typeof pinned>,
): KaqCanonicalBinding {
  return reviewKaqCanonicalBinding(
    binding,
    {
      bindingId: binding.id,
      outcome: 'ACCEPT',
      reviewIdentity: 'issue-1113-semantic-reviewer-v1',
      reviewRationale: 'Independent semantic alignment with course objectives.',
    },
    context,
  );
}

function acceptedDelta(overrides: Partial<{
  id: string;
  authorizationState: string;
  candidateReleaseSetId: string;
  candidateReleaseId: string;
  candidateReleaseHash: string;
  candidateSourceDatasetHash: string;
  outputDigest: string;
  captureRevision: string;
}> = {}): AcceptedDeltaReceiptEvidence {
  return mintAcceptedDeltaEvidenceForTests({
    id: deltaReceiptId,
    authorizationState: 'ACCEPTED',
    candidateReleaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
    candidateReleaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
    candidateReleaseHash: releaseHash,
    candidateSourceDatasetHash: sourceDatasetHash,
    outputDigest: 'e'.repeat(64),
    captureRevision: coverageCaptureRevision,
    ...overrides,
  });
}

function availableAggregateCoverage(contextIds: readonly string[] = [
  'ctr:object:feedback-loop',
  'ctr:object:transfer-function',
  'ctr:object:root-locus',
  'ctr:object:bode-plot',
], overrides: {
  entries?: AggregateCoverageAuthoritySource['entries'];
  selectorOverlayId?: string;
  versionLifecycle?: string;
  governanceAuthorityState?: string;
  governanceProductionAuthoritative?: boolean;
  governanceCoverageVersionId?: string | null;
} = {}): AggregateCoverageAuthoritySource {
  const selector = {
    courseId: 'automatic-control',
    overlayId: overrides.selectorOverlayId ?? PINNED_KAQ_COVERAGE_OVERLAY_ID,
    overlayVersion: '1',
    releaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
    releaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
  };
  return {
    selector,
    version: {
      id: coverageVersionId,
      courseId: selector.courseId,
      overlayId: PINNED_KAQ_COVERAGE_OVERLAY_ID,
      overlayVersion: '1',
      releaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
      releaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
      releaseHash,
      sourceDatasetHash,
      deltaReceiptId,
      authoringRevision: coverageCaptureRevision,
      captureRevision: coverageCaptureRevision,
      sourceHash: coverageSourceHash,
      lifecycleState: overrides.versionLifecycle ?? 'CURRENT',
    },
    entries: overrides.entries ?? contextIds.map((canonicalId, ordinal) => ({
      canonicalId,
      role: 'formal_objective',
      ordinal,
      lifecycleState: 'CURRENT',
    })),
    governance: {
      id: governanceReceiptId,
      coverageVersionId: overrides.governanceCoverageVersionId === undefined
        ? coverageVersionId
        : overrides.governanceCoverageVersionId,
      releaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
      releaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
      releaseHash,
      sourceDatasetHash,
      deltaReceiptId,
      deltaOutputDigest: 'e'.repeat(64),
      deltaCaptureRevision: coverageCaptureRevision,
      coverageSourceHash,
      captureRevision: coverageCaptureRevision,
      authoringRevision: coverageCaptureRevision,
      authorityState: overrides.governanceAuthorityState ?? 'SHADOW',
      productionAuthoritative: overrides.governanceProductionAuthoritative ?? false,
    },
  };
}

/** @deprecated alias kept for local readability in older test blocks */
const availableCoverage = availableAggregateCoverage;

function availableTeachingProjection(context: ReturnType<typeof pinned> = pinned()) {
  const formalProof = mintFormalTeachingProjectionProofForTests({
    pinned: context,
    projectionId: 'ctr:projection:teaching-v1',
    projectionDigest: '1'.repeat(64),
    formalReleaseAttestationId: 'attestation:teaching-projection-release-v1',
    formalReleaseAttestationDigest: '2'.repeat(64),
  });
  return resolveTeachingProjectionAvailability({
    pinned: context,
    formalProof,
  });
}

const migrationSelector = () => selectKaqAuthority('MIGRATION_REVIEW');
const formalPlanningSelector = () => selectKaqAuthority('FORMAL_PLANNING');

/** Build ACCEPTED shadow bindings + closed reviewed mapping for planner tests. */
function reviewedMappingFixture(context: ReturnType<typeof pinned> = pinned()): {
  bindings: KaqCanonicalBinding[];
  mapping: ReviewedKaqRoleCanonicalMapping;
} {
  const generated = generateKaqCanonicalBindings({
    pinned: context,
    proposals: [
      {
        kaqRoleId: 'kn:autocontrol:feedback-loop',
        targets: [{
          canonicalId: 'ctr:object:feedback-loop',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['e-feedback'],
          semanticRationale: 'reviewed feedback identity',
          objectRevision: 'r1',
        }],
      },
      {
        kaqRoleId: 'kn:autocontrol:transfer-function-model',
        targets: [{
          canonicalId: 'ctr:object:transfer-function',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['e-tf'],
          semanticRationale: 'reviewed TF identity',
          objectRevision: 'r1',
        }],
      },
    ],
  });
  const bindings = generated.bindings.map((b) => acceptBinding(b, context));
  const mapping = buildReviewedKaqRoleCanonicalMapping({ bindings, pinned: context });
  return { bindings, mapping };
}

describe('canonical KAQ pinned context', () => {
  it('builds fail-closed context only for the pinned aggregate + CourseCoverage', () => {
    const context = pinned();
    expect(context.releaseSetId).toBe(PINNED_KAQ_AGGREGATE_RELEASE_SET_ID);
    expect(context.releaseId).toBe(PINNED_KAQ_AGGREGATE_RELEASE_ID);
    expect(context.contextDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(() => buildKaqPinnedContext({
      ...context,
      releaseSetId: 'some-other-release-set',
      contextDigest: undefined as unknown as string,
    } as never)).toThrow(/pinned aggregate/);
  });

  it('fail-closes sourceDatasetHash and other digest fields that are not 64-char lowercase sha256', () => {
    const base = {
      releaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
      releaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
      releaseHash,
      sourceDatasetHash,
      deltaReceiptId,
      coverageOverlayId: PINNED_KAQ_COVERAGE_OVERLAY_ID,
      coverageOverlayVersion: '1',
      coverageSourceHash,
      coverageCaptureRevision,
      admittedCanonicalIds: ['ctr:object:feedback-loop'],
    };

    expect(() => buildKaqPinnedContext({
      ...base,
      sourceDatasetHash: 'not-a-sha256',
    })).toThrow(KaqPinnedContextError);
    expect(() => buildKaqPinnedContext({
      ...base,
      sourceDatasetHash: 'not-a-sha256',
    })).toThrow(/sourceDatasetHash must be 64-char lowercase sha256/);

    expect(() => buildKaqPinnedContext({
      ...base,
      sourceDatasetHash: 'B'.repeat(64), // uppercase rejected
    })).toThrow(/sourceDatasetHash/);

    expect(() => buildKaqPinnedContext({
      ...base,
      sourceDatasetHash: 'b'.repeat(63),
    })).toThrow(/sourceDatasetHash/);

    expect(() => buildKaqPinnedContext({
      ...base,
      releaseHash: 'protocol:arbitrary-token',
    })).toThrow(/releaseHash/);

    expect(() => buildKaqPinnedContext({
      ...base,
      coverageSourceHash: 'xyz',
    })).toThrow(/coverageSourceHash/);
  });

  it('recomputes contextDigest and rejects forged or drifted pinned fingerprints', () => {
    const context = pinned();
    expect(assertKaqPinnedContextFingerprint(context).contextDigest).toBe(context.contextDigest);

    // Random digest with otherwise valid fields
    expect(() => assertKaqPinnedContextFingerprint({
      ...context,
      contextDigest: 'f'.repeat(64),
    })).toThrow(/does not match pinned context fields/);

    // Field drift without recomputing digest
    expect(() => assertKaqPinnedContextFingerprint({
      ...context,
      coverageSourceHash: 'e'.repeat(64),
      // contextDigest left as original
    })).toThrow(KaqPinnedContextError);

    expect(() => assertKaqPinnedContextFingerprint({
      ...context,
      coverageCaptureRevision: 'e'.repeat(40),
    })).toThrow(/does not match/);

    expect(() => assertKaqPinnedContextFingerprint({
      ...context,
      deltaReceiptId: 'delta-receipt:tampered',
    })).toThrow(/does not match/);

    expect(() => assertKaqPinnedContextFingerprint({
      ...context,
      admittedCanonicalIds: [...context.admittedCanonicalIds, 'ctr:object:extra'],
    })).toThrow(/does not match/);

    // Availability must re-verify fingerprint — forged digest yields unavailable
    const forged = {
      ...context,
      contextDigest: '9'.repeat(64),
    };
    const forgedProof = mintFormalTeachingProjectionProofForTests({
      pinned: context,
      projectionId: 'ctr:projection:teaching-v1',
      projectionDigest: '1'.repeat(64),
      formalReleaseAttestationId: 'attestation:x',
      formalReleaseAttestationDigest: '2'.repeat(64),
    });
    const unavailable = resolveTeachingProjectionAvailability({
      pinned: forged,
      formalProof: forgedProof,
    });
    expect(unavailable.available).toBe(false);
    if (unavailable.available) throw new Error('expected unavailable');
    expect(unavailable.reason).toBe('pinned-context-fingerprint-invalid');
  });

  it('admits only active CourseCoverage roles (excludes excluded_with_rationale)', () => {
    expect(admittedCanonicalIdsFromCoverageEntries([
      { canonicalId: 'ctr:object:feedback-loop', role: 'formal_objective' },
      { canonicalId: 'ctr:object:excluded', role: 'excluded_with_rationale' },
      { canonicalId: 'ctr:object:root-locus', role: 'necessary_prerequisite' },
    ])).toEqual([
      'ctr:object:feedback-loop',
      'ctr:object:root-locus',
    ]);

    // Verified mint refuses excluded-only coverage.
    const delta = acceptedDelta();
    expect(() => mintVerifiedCoverageForTests({
      delta,
      coverage: availableAggregateCoverage([], {
        entries: [
          {
            canonicalId: 'ctr:object:excluded',
            role: 'excluded_with_rationale',
            ordinal: 0,
            lifecycleState: 'CURRENT',
          },
        ],
      }),
    })).toThrow(/no active admitted roles|excluded/);
  });
});

describe('KAQ canonical binding generation and review', () => {
  it('supports one-to-many and many-to-one role-qualified bindings', () => {
    const context = pinned();
    const { bindings, rejected } = generateKaqCanonicalBindings({
      pinned: context,
      proposals: [
        {
          kaqRoleId: 'kn:autocontrol:feedback-loop',
          targets: [
            {
              canonicalId: 'ctr:object:feedback-loop',
              bindingRole: 'PRIMARY_IDENTITY',
              evidenceRefs: ['kaq-objective:knowledge:autocontrol:feedback-loop'],
              semanticRationale: 'Role teaches closed-loop feedback structure.',
              objectRevision: 'rev-1',
            },
            {
              canonicalId: 'ctr:object:transfer-function',
              bindingRole: 'COMPOSITION_PART',
              evidenceRefs: ['kaq-objective:knowledge:autocontrol:feedback-loop'],
              semanticRationale: 'Role also requires TF model of the loop.',
              objectRevision: 'rev-1',
            },
          ],
          rejectedAutoSources: ['legacy-id', 'same-name'],
        },
        {
          kaqRoleId: 'kn:autocontrol:root-locus',
          targets: [
            {
              canonicalId: 'ctr:object:root-locus',
              bindingRole: 'PRIMARY_IDENTITY',
              evidenceRefs: ['kaq-objective:knowledge:autocontrol:root-locus'],
              semanticRationale: 'Root-locus teaching role.',
              objectRevision: 'rev-1',
            },
          ],
        },
        {
          kaqRoleId: 'kn:autocontrol:frequency-response',
          targets: [
            {
              canonicalId: 'ctr:object:root-locus',
              bindingRole: 'SUPPORTING_OBJECT',
              evidenceRefs: ['kaq-objective:knowledge:autocontrol:frequency-response'],
              semanticRationale: 'Frequency role references locus geometry as supporting object.',
              objectRevision: 'rev-1',
            },
          ],
        },
      ],
    });

    expect(rejected).toEqual([]);
    // one role → two objects
    expect(bindings.filter((b) => b.kaqRoleId === 'kn:autocontrol:feedback-loop')).toHaveLength(2);
    // two roles → one object
    expect(bindings.filter((b) => b.canonicalId === 'ctr:object:root-locus')).toHaveLength(2);
    expect(bindings.every((b) => b.authorityState === 'SHADOW')).toBe(true);
    expect(bindings.every((b) => b.productionAuthoritative === false)).toBe(true);
    expect(bindings.every((b) => b.inheritedFromLegacyId === null)).toBe(true);
    expect(bindings.every((b) => b.sameNameAutoMatch === false)).toBe(true);

    const reviewed = acceptBinding(bindings[0]!, context);
    expect(reviewed.reviewState).toBe('ACCEPTED');
    expect(reviewed.authorityState).toBe('SHADOW');
  });

  it('rejects Legacy ID inheritance and same-name auto-match without review', () => {
    expect(() => rejectAutoInheritedBinding({
      source: 'legacy-id',
      kaqRoleId: 'kn:autocontrol:feedback-loop',
      candidateCanonicalId: 'legacy-feedback',
      legacyNodeId: 'legacy-feedback',
    })).toThrow(/Legacy ID inheritance is forbidden/);

    expect(() => assertNoForbiddenAutoInheritance({
      kaqRoleId: 'kn:role',
      proposal: {
        kaqRoleId: 'kn:role',
        targets: [{
          canonicalId: 'legacy-node-1',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['e1'],
          semanticRationale: 'should still fail on legacy id equality',
          objectRevision: 'r1',
        }],
      },
      legacyNodeIdByRole: { 'kn:role': 'legacy-node-1' },
    })).toThrow(/Legacy ID inheritance is forbidden/);

    expect(() => assertNoForbiddenAutoInheritance({
      kaqRoleId: 'kn:role',
      proposal: {
        kaqRoleId: 'kn:role',
        targets: [{
          canonicalId: 'ctr:object:feedback-loop',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: [],
          semanticRationale: '',
          objectRevision: 'r1',
        }],
      },
      labelsByRole: { 'kn:role': 'Feedback Loop' },
      labelsByCanonical: { 'ctr:object:feedback-loop': 'Feedback Loop' },
    })).toThrow(/same-name auto-match is forbidden/);

    // Same-name is allowed only with independent semantic evidence.
    expect(() => assertNoForbiddenAutoInheritance({
      kaqRoleId: 'kn:role',
      proposal: {
        kaqRoleId: 'kn:role',
        targets: [{
          canonicalId: 'ctr:object:feedback-loop',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['semantic-review:1'],
          semanticRationale: 'Reviewed alignment despite shared label.',
          objectRevision: 'r1',
        }],
        rejectedAutoSources: ['same-name'],
      },
      labelsByRole: { 'kn:role': 'Feedback Loop' },
      labelsByCanonical: { 'ctr:object:feedback-loop': 'Feedback Loop' },
    })).not.toThrow();
  });

  it('restricts shadow bindings to admitted CourseCoverage and marks stale on drift', () => {
    const context = pinned();
    const { bindings, rejected } = generateKaqCanonicalBindings({
      pinned: context,
      proposals: [{
        kaqRoleId: 'kn:role',
        targets: [
          {
            canonicalId: 'ctr:object:feedback-loop',
            bindingRole: 'PRIMARY_IDENTITY',
            evidenceRefs: ['e1'],
            semanticRationale: 'in coverage',
            objectRevision: 'r1',
          },
          {
            canonicalId: 'ctr:object:not-in-coverage',
            bindingRole: 'PRIMARY_IDENTITY',
            evidenceRefs: ['e2'],
            semanticRationale: 'out of coverage',
            objectRevision: 'r1',
          },
        ],
      }],
    });
    expect(bindings).toHaveLength(1);
    expect(rejected.some((row) => row.reason === 'canonical-outside-coverage')).toBe(true);

    const accepted = acceptBinding(bindings[0]!, context);
    const drifted = pinned({
      admittedCanonicalIds: ['ctr:object:transfer-function'],
    });
    const stale = markStaleKaqBindings([accepted], drifted);
    expect(stale[0]?.reviewState).toBe('STALE');
    expect(stale[0]?.lifecycleState).toBe('SUPERSEDED');
    expect(resolveReviewedShadowBindings({
      kaqRoleId: 'kn:role',
      bindings: stale,
      pinned: drifted,
    })).toEqual([]);
  });

  it('never rewrites historical LearningFacts or creates Canonical sidecars', () => {
    const result = preserveHistoricalLearningFacts([
      {
        factId: 'fact-1',
        knowledgeRevision: 'legacy-rev-9',
        knowledgeAuthority: 'LEGACY',
        legacyKnowledgeNodeId: '反馈_1_1',
      },
    ]);
    expect(result).toEqual({
      rewritten: false,
      sidecarCreated: false,
      retainedLegacyRevision: true,
      facts: [{
        factId: 'fact-1',
        knowledgeRevision: 'legacy-rev-9',
        knowledgeAuthority: 'LEGACY',
        legacyKnowledgeNodeId: '反馈_1_1',
      }],
    });
  });
});

describe('relation ownership and Teaching Projection boundary', () => {
  it('keeps KAQ ownership of capability/quality/goal/runtime pedagogical namespaces', () => {
    expect(KAQ_OWNED_RELATION_NAMESPACES).toEqual([
      'knowledge-capability-quality',
      'learning-goal',
      'runtime-pedagogical',
    ]);
    expect(describeKaqOwnedRelationAuthority('knowledge-capability-quality', 'v1')).toEqual({
      namespace: 'knowledge-capability-quality',
      authority: 'KAQ',
      version: 'v1',
    });
    expect(kaqGraphEdgeOwnership('depends-on', AUTOCONTROL_KAQ_GRAPH_VERSION).authority).toBe('KAQ');
    expect(describeKaqOwnedGraphRelation('learning-goal', 'goal-v1').namespace).toBe('learning-goal');
  });

  it('never infers prerequisite/contains teaching relations from engineering predicates', () => {
    const table = engineeringPredicateTeachingInferenceTable();
    expect(table.contains).toBeNull();
    expect(table.prerequisite).toBeNull();
    expect(table.part_of).toBeNull();
    expect(table.is_a).toBeNull();
    expect(inferTeachingRelationFromEngineeringPredicate('part_of')).toBeNull();
    expect(inferTeachingRelationFromEngineeringPredicate('contains')).toBeNull();
    expect(courseCoverageCreatesTeachingProjectionEdge('necessary_prerequisite')).toBe(false);
    expect(courseCoverageCreatesTeachingProjectionEdge('formal_objective')).toBe(false);

    expect(unavailableTeachingProjection()).toMatchObject({
      available: false,
      blocked: true,
      reason: 'formal-teaching-projection-not-available',
    });
    expect(resolveTeachingProjectionAvailability({
      pinned: pinned(),
    }).available).toBe(false);

    expect(() => buildActkgTeachingProjectionRelation({
      availability: unavailableTeachingProjection(),
      pinned: pinned(),
      id: 'tp-1',
      predicate: 'prerequisite',
      sourceCanonicalId: 'a',
      targetCanonicalId: 'b',
      version: 'v1',
    })).toThrow(/formal Teaching Projection is not available/);
  });

  it('admits Teaching Projection only against formal proof + re-verified pinned fingerprint', () => {
    const context = pinned();

    const missingPinned = resolveTeachingProjectionAvailability({
      formalProof: mintFormalTeachingProjectionProofForTests({
        pinned: context,
        projectionId: 'ctr:projection:teaching-v1',
        projectionDigest: '1'.repeat(64),
        formalReleaseAttestationId: 'attestation:x',
        formalReleaseAttestationDigest: '2'.repeat(64),
      }),
    });
    expect(missingPinned.available).toBe(false);
    if (missingPinned.available) throw new Error('expected unavailable');
    expect(missingPinned.reason).toBe('missing-pinned-context');

    // Free projection identity without formal attestation never admits.
    const freeProjection = resolveTeachingProjectionAvailability({
      pinned: context,
      teachingProjection: {
        projectionId: 'ctr:projection:teaching-v1',
        projectionDigest: '1'.repeat(64),
      },
    });
    expect(freeProjection.available).toBe(false);
    if (freeProjection.available) throw new Error('expected unavailable');
    expect(freeProjection.reason).toBe('missing-formal-teaching-proof');

    // Unbranded plain object with plausible fields cannot admit (no capability brand).
    const unbrandedProof = {
      schemaVersion: 'act-formal-teaching-projection-proof/v1',
      proofKind: 'FORMAL_ACTKG_TEACHING_PROJECTION_RELEASE',
      releaseSetId: context.releaseSetId,
      releaseId: context.releaseId,
      releaseHash: context.releaseHash,
      pinnedContextDigest: context.contextDigest,
      projectionId: 'ctr:projection:teaching-v1',
      projectionDigest: '1'.repeat(64),
      formalReleaseAttestationId: 'attestation:x',
      formalReleaseAttestationDigest: '2'.repeat(64),
      proofDigest: '9'.repeat(64),
    };
    const badProof = resolveTeachingProjectionAvailability({
      pinned: context,
      formalProof: unbrandedProof,
    });
    expect(badProof.available).toBe(false);
    if (badProof.available) throw new Error('expected unavailable');
    expect(
      badProof.reason === 'missing-formal-teaching-proof'
      || badProof.reason === 'teaching-proof-mismatch',
    ).toBe(true);

    expect(resolveTeachingProjectionAvailability({ pinned: context }).available).toBe(false);

    const availability = availableTeachingProjection(context);
    expect(availability.available).toBe(true);
    if (!availability.available) throw new Error('expected available');
    expect(availability.releaseSetId).toBe(PINNED_KAQ_AGGREGATE_RELEASE_SET_ID);
    expect(availability.releaseId).toBe(PINNED_KAQ_AGGREGATE_RELEASE_ID);
    expect(availability.pinnedContextDigest).toBe(context.contextDigest);

    // pinned is required — out-of-coverage endpoints always fail
    const relation = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-prereq-1',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    expect(relation.authority).toBe('ACTKG');
    expect(relation.pinnedContextDigest).toBe(context.contextDigest);
    expect(describeActkgTeachingRelationAuthority(relation).authority).toBe('ACTKG');

    expect(() => buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-out',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:not-admitted',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    })).toThrow(/outside CourseCoverage/);
  });
});

describe('teaching relation conflict review and planner gate', () => {
  const kaqEdge: KaqKnowledgeToKnowledgeRelation = {
    edgeId: 'edge:kaq:feedback->tf',
    sourceRoleId: 'kn:autocontrol:feedback-loop',
    targetRoleId: 'kn:autocontrol:transfer-function-model',
    relation: 'depends-on',
    lifecycleState: 'ACTIVE',
    ownership: 'KAQ',
  };

  it('blocks planners on unresolved conflicts and retires accepted KAQ edges', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);
    const actkg = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-1',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    const conflicts = detectTeachingRelationConflicts({
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
      existingLedger: [],
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.reviewState).toBe('UNRESOLVED');

    const unresolvedGate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
      conflicts,
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(unresolvedGate.blocked).toBe(true);
    expect(unresolvedGate.reason).toBe('unresolved-conflict');
    expect(() => assertPlannerMayConsumeTeachingRelations(unresolvedGate)).toThrow(/Planner blocked/);

    const accepted = reviewTeachingRelationConflict(conflicts[0]!, {
      outcome: 'ACCEPTED_ACTKG',
      reviewIdentity: 'issue-1113-conflict-reviewer-v1',
      reviewRationale: 'ActKG prerequisite supersedes KAQ depends-on for this pair.',
    });
    const parallelGate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
      conflicts: [accepted],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(parallelGate.reason).toBe('parallel-conflict-versions');

    const retired = retireAcceptedConflictingKaqRelations({
      kaqRelations: [kaqEdge],
      conflicts: [accepted],
    });
    expect(retired.relations[0]?.lifecycleState).toBe('RETIRED');
    expect(retired.conflicts[0]?.reviewState).toBe('RETIRED_KAQ');

    // Current ledger drops pairs no longer in the active conflict set.
    const currentLedger = detectTeachingRelationConflicts({
      kaqRelations: retired.relations,
      actkgRelations: [actkg],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
      existingLedger: retired.conflicts,
    });
    expect(currentLedger).toEqual([]);

    const activeGate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: retired.relations,
      actkgRelations: [actkg],
      conflicts: currentLedger,
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(activeGate.blocked).toBe(false);
    expect(activeGate.activeActkgRelationIds).toContain('tp-1');
    expect(activeGate.activeKaqEdgeIds).not.toContain(kaqEdge.edgeId);
    expect(activeGate.reason).toBe('teaching-projection-authority');
  });

  it('does not parallel-activate non-conflicting KAQ K2K edges when Teaching Projection is available', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);
    const actkg = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-unrelated',
      predicate: 'association',
      sourceCanonicalId: 'ctr:object:root-locus',
      targetCanonicalId: 'ctr:object:bode-plot',
      version: 'tp-v1',
    });
    const gate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
      conflicts: [],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(gate.blocked).toBe(false);
    expect(gate.reason).toBe('teaching-projection-authority');
    expect(gate.activeActkgRelationIds).toEqual(['tp-unrelated']);
    expect(gate.activeKaqEdgeIds).toEqual([]);
  });

  it('requires reviewed mapping; rejects candidate/rejected/stale/forged maps', () => {
    const context = pinned();
    const generated = generateKaqCanonicalBindings({
      pinned: context,
      proposals: [{
        kaqRoleId: 'kn:autocontrol:feedback-loop',
        targets: [{
          canonicalId: 'ctr:object:feedback-loop',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['e1'],
          semanticRationale: 'candidate only',
          objectRevision: 'r1',
        }],
      }],
    });
    // CANDIDATE must not enter mapping
    const emptyFromCandidate = buildReviewedKaqRoleCanonicalMapping({
      bindings: generated.bindings,
      pinned: context,
    });
    expect(emptyFromCandidate.bindingIds).toEqual([]);
    expect(emptyFromCandidate.roleToCanonicalIds).toEqual({});

    const accepted = acceptBinding(generated.bindings[0]!, context);
    const rejected = reviewKaqCanonicalBinding(
      generated.bindings[0]!,
      {
        bindingId: generated.bindings[0]!.id,
        outcome: 'REJECT',
        reviewIdentity: 'reviewer',
        reviewRationale: 'no',
      },
      context,
    );
    expect(buildReviewedKaqRoleCanonicalMapping({
      bindings: [rejected],
      pinned: context,
    }).bindingIds).toEqual([]);

    const stale = markStaleKaqBindings([accepted], pinned({
      admittedCanonicalIds: ['ctr:object:transfer-function'],
    }));
    expect(buildReviewedKaqRoleCanonicalMapping({
      bindings: stale,
      pinned: context,
    }).bindingIds).toEqual([]);

    const good = buildReviewedKaqRoleCanonicalMapping({
      bindings: [accepted],
      pinned: context,
    });
    expect(good.roleToCanonicalIds['kn:autocontrol:feedback-loop']).toEqual([
      'ctr:object:feedback-loop',
    ]);

    // Forged mapping with extra role fails against required bindings
    expect(() => assertReviewedKaqRoleCanonicalMapping({
      ...good,
      roleToCanonicalIds: {
        ...good.roleToCanonicalIds,
        'kn:forged': ['ctr:object:feedback-loop'],
      },
    }, context, [accepted])).toThrow(/role set does not match/);

    // Wrong digest fails
    expect(() => assertReviewedKaqRoleCanonicalMapping({
      ...good,
      pinnedContextDigest: 'a'.repeat(64),
    }, context, [accepted])).toThrow(/pinnedContextDigest mismatch/);

    // Bindings are required — omitting them is not a trust path
    expect(() => (assertReviewedKaqRoleCanonicalMapping as Function)(
      good,
      context,
    )).toThrow(/bindings are required/);

    // Self-minted mapping with correct schema/digest/coverage but NO matching
    // accepted binding must fail (cannot invent in-coverage role pairs).
    const selfMinted: ReviewedKaqRoleCanonicalMapping = {
      schemaVersion: good.schemaVersion,
      pinnedContextDigest: context.contextDigest,
      releaseSetId: context.releaseSetId,
      releaseId: context.releaseId,
      roleToCanonicalIds: {
        'kn:autocontrol:feedback-loop': ['ctr:object:feedback-loop'],
        'kn:never-reviewed': ['ctr:object:transfer-function'],
      },
      bindingIds: ['forged-binding-id'],
    };
    expect(() => assertReviewedKaqRoleCanonicalMapping(
      selfMinted,
      context,
      [accepted],
    )).toThrow(/role set does not match reviewed bindings/);
    // Empty bindings cannot validate a non-empty self-minted map
    expect(() => assertReviewedKaqRoleCanonicalMapping(
      selfMinted,
      context,
      [],
    )).toThrow(/role set does not match reviewed bindings/);

    // Planner rejects raw map and rejects omitted bindings path
    const rawGate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability: unavailableTeachingProjection(),
      kaqRelations: [kaqEdge],
      actkgRelations: [],
      conflicts: [],
      reviewedMapping: {
        'kn:autocontrol:feedback-loop': ['ctr:object:feedback-loop'],
      } as never,
      pinned: context,
      bindings: [accepted],
    });
    expect(rawGate.reason).toBe('invalid-reviewed-mapping');

    const forgedCoverageGate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability: unavailableTeachingProjection(),
      kaqRelations: [kaqEdge],
      actkgRelations: [],
      conflicts: [],
      reviewedMapping: selfMinted,
      pinned: context,
      bindings: [accepted],
    });
    expect(forgedCoverageGate.reason).toBe('invalid-reviewed-mapping');
  });

  it('blocks mixed ActKG relation identities that drift from availability', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);
    const good = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-good',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    const mixed = {
      ...good,
      id: 'tp-mixed',
      projectionDigest: '2'.repeat(64),
      projectionId: 'ctr:projection:other',
    };
    const gate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: [],
      actkgRelations: [good, mixed],
      conflicts: [],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(gate.blocked).toBe(true);
    expect(gate.reason).toBe('mixed-actkg-relation-identity');
    expect(gate.blockedEdgeIds).toContain('tp-mixed');
  });

  it('detects cross-authority cycles in canonical ID space and fail-closes unmapped roles', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);

    const kaqForward: KaqKnowledgeToKnowledgeRelation = {
      edgeId: 'edge:kaq:A->B',
      sourceRoleId: 'kn:autocontrol:feedback-loop',
      targetRoleId: 'kn:autocontrol:transfer-function-model',
      relation: 'depends-on',
      lifecycleState: 'ACTIVE',
      ownership: 'KAQ',
    };
    const actkgBack = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp:B->A',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:transfer-function',
      targetCanonicalId: 'ctr:object:feedback-loop',
      version: 'tp-v1',
    });

    const retainConflict = reviewTeachingRelationConflict(
      detectTeachingRelationConflicts({
        kaqRelations: [kaqForward],
        actkgRelations: [actkgBack],
        reviewedMapping: mapping,
        pinned: context,
        bindings,
        existingLedger: [],
      })[0]!,
      {
        outcome: 'RETAIN_KAQ',
        reviewIdentity: 'issue-1113-conflict-reviewer-v1',
        reviewRationale: 'Keep KAQ edge for review fixture; ActKG edge must be suppressed.',
      },
    );
    // RETAIN_KAQ may keep ActKG present in the relation set for exact-set ledger
    // closure / audit, but must suppress it from effective activation.
    const retainGate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: [kaqForward],
      actkgRelations: [actkgBack],
      conflicts: [retainConflict],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(retainGate.blocked).toBe(false);
    expect(retainGate.activeKaqEdgeIds).toContain('edge:kaq:A->B');
    expect(retainGate.activeActkgRelationIds).not.toContain('tp:B->A');
    expect(retainGate.activeActkgRelationIds).toEqual([]);

    const actkgForward = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp:A->B',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    const actkgCycleGate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: [],
      actkgRelations: [actkgForward, actkgBack],
      conflicts: [],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(actkgCycleGate.blocked).toBe(true);
    expect(actkgCycleGate.reason).toBe('cycle-detected');

    const projected = projectKaqEdgeToCanonicalSpace({
      edge: kaqForward,
      reviewedMapping: mapping,
    });
    expect(projected.unmappedRoleIds).toEqual([]);
    const mixedCycle = detectTeachingRelationCycles([
      ...projected.projected,
      {
        edgeId: actkgBack.id,
        sourceId: actkgBack.sourceCanonicalId,
        targetId: actkgBack.targetCanonicalId,
        active: true,
      },
    ]);
    expect(mixedCycle.length).toBeGreaterThan(0);

    // Mapping with only one role → unmapped target when TP unavailable
    const partialBindings = bindings.filter(
      (b) => b.kaqRoleId === 'kn:autocontrol:feedback-loop',
    );
    const partialMapping = buildReviewedKaqRoleCanonicalMapping({
      bindings: partialBindings,
      pinned: context,
    });
    const unmappedGate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability: unavailableTeachingProjection(),
      kaqRelations: [kaqForward],
      actkgRelations: [],
      conflicts: [],
      reviewedMapping: partialMapping,
      pinned: context,
      bindings: partialBindings,
    });
    expect(unmappedGate.blocked).toBe(true);
    expect(unmappedGate.reason).toBe('unmapped-role-endpoint');
    expect(unmappedGate.blockedEdgeIds).toContain('kn:autocontrol:transfer-function-model');
  });

  it('keeps KAQ relations when Teaching Projection is unavailable and roles are mapped', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const cycleEdges = detectTeachingRelationCycles([
      { edgeId: 'e1', sourceId: 'a', targetId: 'b', active: true },
      { edgeId: 'e2', sourceId: 'b', targetId: 'a', active: true },
    ]);
    expect(cycleEdges.length).toBeGreaterThan(0);

    const gate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability: unavailableTeachingProjection(),
      kaqRelations: [kaqEdge],
      actkgRelations: [],
      conflicts: [],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(gate.blocked).toBe(false);
    expect(gate.reason).toBe('teaching-projection-unavailable-using-kaq');
    expect(gate.activeKaqEdgeIds).toEqual([kaqEdge.edgeId]);
  });
});

describe('KAQ authority selector and catalog readiness', () => {
  it('keeps formal consumers on Legacy and exposes readiness only to migration review', () => {
    const formal = selectKaqAuthority('FORMAL_PLANNING');
    expect(formalKaqConsumersUseLegacy(formal)).toBe(true);
    expect(selectKaqAuthority('FORMAL_DIAGNOSIS').authority).toBe('LEGACY');
    expect(selectKaqAuthority('FORMAL_RECOMMENDATION').canonicalBindingsVisible).toBe(false);

    const migration = selectKaqAuthority('MIGRATION_REVIEW');
    expect(migrationReviewSeesCanonicalReadiness(migration)).toBe(true);

    expect(() => selectKaqAuthority('CUTOVER_ACTIVATION')).toThrow(KaqCutoverActivationError);
    expect(() => tryActivateKaqCanonicalCutover({
      cutoverReceiptId: 'self-minted',
      reviewedBindingsReady: true,
      teachingProjection: availableTeachingProjection(),
      shadowSucceeded: true,
    })).toThrow(/cannot activate Canonical KAQ/);

    assertShadowCannotActivateKaqCutover({
      reviewedBindingsReady: true,
      teachingProjection: unavailableTeachingProjection(),
      cutoverReceiptId: 'self-minted',
      shadowSucceeded: true,
    });
  });

  it('proves reviewed bindings and Teaching Projection cannot locally activate formal consumers', () => {
    const context = pinned();
    const { bindings } = generateKaqCanonicalBindings({
      pinned: context,
      proposals: [{
        kaqRoleId: 'kn:autocontrol:feedback-loop',
        targets: [{
          canonicalId: 'ctr:object:feedback-loop',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['e1'],
          semanticRationale: 'reviewed',
          objectRevision: 'r1',
        }],
      }],
    });
    const accepted = [acceptBinding(bindings[0]!, context)];
    const teaching = availableTeachingProjection(context);

    for (const consumer of [
      'FORMAL_DIAGNOSIS',
      'FORMAL_RECOMMENDATION',
      'FORMAL_PLANNING',
    ] as const) {
      const selected = selectKaqAuthority(consumer);
      assertFormalSelectorUnchanged({
        requestedConsumer: consumer,
        selected,
        reviewedBindings: accepted,
        teachingProjection: teaching,
      });
      expect(selected.authority).toBe('LEGACY');
      expect(selected.canonicalBindingsVisible).toBe(false);
      expect(selected.teachingProjectionVisible).toBe(false);
    }
  });

  it('validates catalog binding readiness without changing formal authority', () => {
    const catalogValidation = validateAutocontrolKaqGraphCatalog();
    expect(catalogValidation.graphValidation.valid).toBe(true);
    expect(catalogValidation.objectiveValidation.valid).toBe(true);

    const roles = listAutocontrolKaqKnowledgeRoleIds();
    expect(roles.length).toBeGreaterThan(0);

    const context = pinned({
      admittedCanonicalIds: roles.map((_, index) => `ctr:object:role-${index}`),
    });
    // Without bindings, intended roles are not ready; formal authority stays LEGACY.
    const empty = validateAutocontrolKaqGraphCatalogWithCanonicalReadiness({
      bindings: [],
      pinned: context,
      intendedRoleIds: roles.slice(0, 2),
    });
    expect(empty.formalConsumerAuthority).toBe('LEGACY');
    expect(empty.canonicalReadiness?.ready).toBe(false);
    expect(empty.canonicalReadiness?.migrationReviewVisible).toBe(true);
    expect(empty.canonicalReadiness?.productionAuthoritative).toBe(false);

    const contextOne = pinned({
      admittedCanonicalIds: ['ctr:object:only'],
    });
    const generated = generateKaqCanonicalBindings({
      pinned: contextOne,
      proposals: [{
        kaqRoleId: roles[0]!,
        targets: [{
          canonicalId: 'ctr:object:only',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['e1'],
          semanticRationale: 'ready role',
          objectRevision: 'r1',
        }],
      }],
    });
    const accepted = [acceptBinding(generated.bindings[0]!, contextOne)];
    const readiness = evaluateKaqCatalogCanonicalReadiness({
      intendedRoleIds: [roles[0]!],
      bindings: accepted,
      pinned: contextOne,
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.formalConsumerAuthority).toBe('LEGACY');

    const projection = projectKaqCatalogCanonicalBindingStatus({
      catalogVersion: AUTOCONTROL_KAQ_GRAPH_VERSION,
      intendedRoleIds: [roles[0]!],
      bindings: accepted,
      pinned: contextOne,
    });
    expect(projection.formalAuthority).toBe('LEGACY');
    expect(projection.productionAuthoritative).toBe(false);
    expect(projection.acceptedBindingCount).toBe(1);

    // Stale when release no longer matches
    const staleReadiness = evaluateKaqCatalogCanonicalReadiness({
      intendedRoleIds: [roles[0]!],
      bindings: accepted,
      pinned: pinned({
        admittedCanonicalIds: ['ctr:object:only'],
        coverageSourceHash: '9'.repeat(64),
      }),
    });
    expect(staleReadiness.ready).toBe(false);
    expect(staleReadiness.roles[0]?.reasonCodes).toContain('binding-stale');
  });
});

describe('root-cause: verified pinned is sole consumer entry type', () => {
  it('rejects raw unbranded pinned context at readiness/binding/planner gates', () => {
    const raw = rawUnverifiedPinned();
    expect(() => assertVerifiedKaqPinnedContext(raw)).toThrow(/unbranded or forged/);
    expect(() => evaluateKaqCatalogCanonicalReadiness({
      intendedRoleIds: ['kn:autocontrol:feedback-loop'],
      bindings: [],
      pinned: raw as never,
    })).toThrow(/unbranded or forged/);
    expect(() => generateKaqCanonicalBindings({
      pinned: raw as never,
      proposals: [{
        kaqRoleId: 'kn:x',
        targets: [{
          canonicalId: 'ctr:object:feedback-loop',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['e'],
          semanticRationale: 'x',
          objectRevision: 'r',
        }],
      }],
    })).toThrow(/unbranded or forged/);
  });
});

describe('root-cause: non-enumerable brands + deep immutability', () => {
  it('does not copy capability brands through object spread', () => {
    const context = pinned();
    const delta = acceptedDelta();
    const proof = mintFormalTeachingProjectionProofForTests({
      pinned: context,
      projectionId: 'ctr:projection:teaching-v1',
      projectionDigest: '1'.repeat(64),
      formalReleaseAttestationId: 'attestation:x',
      formalReleaseAttestationDigest: '2'.repeat(64),
    });

    const spreadPinned = { ...context };
    const spreadDelta = { ...delta };
    const spreadProof = { ...proof };

    expect(Object.getOwnPropertySymbols(spreadPinned)).toEqual([]);
    expect(Object.getOwnPropertySymbols(spreadDelta)).toEqual([]);
    expect(Object.getOwnPropertySymbols(spreadProof)).toEqual([]);
    expect(() => assertVerifiedKaqPinnedContext(spreadPinned)).toThrow(/unbranded or forged/);
    expect(() => assertAcceptedDeltaReceiptEvidence(spreadDelta)).toThrow(/unbranded or forged/);
    expect(() => assertFormalTeachingProjectionProof(spreadProof, context)).toThrow(
      /unbranded or forged/,
    );

    // Legitimate branded objects remain consumable.
    expect(assertVerifiedKaqPinnedContext(context)).toBe(context);
    expect(assertAcceptedDeltaReceiptEvidence(delta)).toBe(delta);
    expect(assertFormalTeachingProjectionProof(proof, context)).toBe(proof);
  });

  it('deep-freezes minted authority objects so nested mutation fails', () => {
    const context = pinned();
    const delta = acceptedDelta();
    const coverage = mintVerifiedCoverageForTests({
      delta,
      coverage: availableCoverage(),
    });
    const proof = mintFormalTeachingProjectionProofForTests({
      pinned: context,
      projectionId: 'ctr:projection:teaching-v1',
      projectionDigest: '1'.repeat(64),
      formalReleaseAttestationId: 'attestation:x',
      formalReleaseAttestationDigest: '2'.repeat(64),
    });

    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.admittedCanonicalIds)).toBe(true);
    expect(Object.isFrozen(delta)).toBe(true);
    expect(Object.isFrozen(coverage)).toBe(true);
    expect(Object.isFrozen(coverage.entries)).toBe(true);
    expect(Object.isFrozen(coverage.selector)).toBe(true);
    expect(Object.isFrozen(proof)).toBe(true);

    expect(() => {
      (context as { releaseId: string }).releaseId = 'tampered';
    }).toThrow();
    expect(() => {
      (context.admittedCanonicalIds as string[]).push('ctr:object:extra');
    }).toThrow();
    expect(() => {
      (coverage.entries as Array<{ canonicalId: string }>)[0]!.canonicalId = 'x';
    }).toThrow();
    expect(() => {
      (proof as { proofDigest: string }).proofDigest = '9'.repeat(64);
    }).toThrow();

    // Fields remain intact after failed mutation attempts.
    expect(context.releaseId).toBe(PINNED_KAQ_AGGREGATE_RELEASE_ID);
    expect(assertVerifiedKaqPinnedContext(context).contextDigest).toBe(context.contextDigest);
  });

  it('rejects forged or mismatched formal proofDigest without reminting', () => {
    const context = pinned();
    const proof = mintFormalTeachingProjectionProofForTests({
      pinned: context,
      projectionId: 'ctr:projection:teaching-v1',
      projectionDigest: '1'.repeat(64),
      formalReleaseAttestationId: 'attestation:x',
      formalReleaseAttestationDigest: '2'.repeat(64),
    });

    // Unbranded object with wrong digest remains rejected.
    expect(() => assertFormalTeachingProjectionProof({
      schemaVersion: proof.schemaVersion,
      proofKind: proof.proofKind,
      releaseSetId: proof.releaseSetId,
      releaseId: proof.releaseId,
      releaseHash: proof.releaseHash,
      pinnedContextDigest: proof.pinnedContextDigest,
      projectionId: proof.projectionId,
      projectionDigest: proof.projectionDigest,
      formalReleaseAttestationId: proof.formalReleaseAttestationId,
      formalReleaseAttestationDigest: proof.formalReleaseAttestationDigest,
      proofDigest: '9'.repeat(64),
    }, context)).toThrow(/unbranded or forged/);
  });

  it('rejects reflected Symbol brand copies onto forged clones (WeakSet provenance)', () => {
    const context = pinned();
    const delta = acceptedDelta();
    const coverage = mintVerifiedCoverageForTests({
      delta,
      coverage: availableCoverage(),
    });
    const proof = mintFormalTeachingProjectionProofForTests({
      pinned: context,
      projectionId: 'ctr:projection:teaching-v1',
      projectionDigest: '1'.repeat(64),
      formalReleaseAttestationId: 'attestation:x',
      formalReleaseAttestationDigest: '2'.repeat(64),
    });

    function cloneWithStolenBrand<T extends object>(source: T, overrides: Record<string, unknown> = {}): object {
      const symbols = Object.getOwnPropertySymbols(source);
      expect(symbols.length).toBeGreaterThanOrEqual(1);
      const brand = symbols[0]!;
      const clone: Record<PropertyKey, unknown> = {
        ...(source as Record<string, unknown>),
        ...overrides,
      };
      Object.defineProperty(clone, brand, {
        value: Object.getOwnPropertyDescriptor(source, brand)!.value,
        enumerable: false,
        writable: false,
        configurable: false,
      });
      return clone;
    }

    // Exact field clones still fail: not the mint-registered instance.
    expect(() => assertVerifiedKaqPinnedContext(cloneWithStolenBrand(context))).toThrow(
      /mint-registered|unbranded or forged/,
    );
    expect(() => assertFormalTeachingProjectionProof(
      cloneWithStolenBrand(proof),
      context,
    )).toThrow(/mint-registered|unbranded or forged/);
    expect(() => assertAcceptedDeltaReceiptEvidence(cloneWithStolenBrand(delta))).toThrow(
      /mint-registered|unbranded or forged/,
    );
    expect(() => assertVerifiedCourseCoverageBundle(cloneWithStolenBrand(coverage))).toThrow(
      /mint-registered|unbranded or forged/,
    );

    // Modified clones with stolen brand fail for the same reason (and/or integrity).
    expect(() => assertVerifiedKaqPinnedContext(cloneWithStolenBrand(context, {
      admittedCanonicalIds: [...context.admittedCanonicalIds, 'ctr:forged'],
    }))).toThrow(/mint-registered|unbranded or forged|does not match/);
    expect(() => assertFormalTeachingProjectionProof(
      cloneWithStolenBrand(proof, { proofDigest: '9'.repeat(64) }),
      context,
    )).toThrow(/mint-registered|unbranded or forged|proofDigest/);

    // Legitimate instances still pass.
    expect(assertVerifiedKaqPinnedContext(context)).toBe(context);
    expect(assertFormalTeachingProjectionProof(proof, context)).toBe(proof);
    expect(assertAcceptedDeltaReceiptEvidence(delta)).toBe(delta);
    expect(assertVerifiedCourseCoverageBundle(coverage)).toBe(coverage);
  });
});

describe('root-cause: production cannot mint capability brands', () => {
  it('blocks test mint helpers outside test runtime', () => {
    const env = process.env as Record<string, string | undefined>;
    const prevVitest = env.VITEST;
    const prevNode = env.NODE_ENV;
    const prevWorker = env.VITEST_WORKER_ID;
    try {
      delete env.VITEST;
      delete env.VITEST_WORKER_ID;
      env.NODE_ENV = 'production';
      expect(() => mintAcceptedDeltaEvidenceForTests({
        id: 'x',
        authorizationState: 'ACCEPTED',
        candidateReleaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
        candidateReleaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
        candidateReleaseHash: releaseHash,
        candidateSourceDatasetHash: sourceDatasetHash,
        outputDigest: 'e'.repeat(64),
        captureRevision: coverageCaptureRevision,
      })).toThrow(/test-only/);
      expect(() => mintVerifiedKaqPinnedContextForTests({
        releaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
        releaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
        releaseHash,
        sourceDatasetHash,
        deltaReceiptId,
        coverageOverlayId: PINNED_KAQ_COVERAGE_OVERLAY_ID,
        coverageOverlayVersion: '1',
        coverageSourceHash,
        coverageCaptureRevision,
        admittedCanonicalIds: ['ctr:object:feedback-loop'],
      })).toThrow(/test-only/);
    } finally {
      if (prevVitest === undefined) delete env.VITEST;
      else env.VITEST = prevVitest;
      if (prevWorker === undefined) delete env.VITEST_WORKER_ID;
      else env.VITEST_WORKER_ID = prevWorker;
      env.NODE_ENV = prevNode;
    }
  });
});

describe('root-cause: conflict ledger exact set closure', () => {
  it('blocks empty ledger when actual conflicts exist', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);
    const kaqEdge: KaqKnowledgeToKnowledgeRelation = {
      edgeId: 'edge:kaq:feedback->tf',
      sourceRoleId: 'kn:autocontrol:feedback-loop',
      targetRoleId: 'kn:autocontrol:transfer-function-model',
      relation: 'depends-on',
      lifecycleState: 'ACTIVE',
      ownership: 'KAQ',
    };
    const actkg = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-1',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    const gate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
      conflicts: [],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(gate.blocked).toBe(true);
    expect(gate.reason).toBe('invalid-conflict-ledger');
  });
});

describe('P1 authority input closure', () => {
  it('rejects unbranded/forged authority inputs and free-form teaching proof', () => {
    // Plain objects without capability brand fail closed.
    expect(() => assertAcceptedDeltaReceiptEvidence({
      schemaVersion: ACCEPTED_DELTA_RECEIPT_EVIDENCE_VERSION,
      id: 'forged',
      authorizationState: 'ACCEPTED',
      candidateReleaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
      candidateReleaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
      candidateReleaseHash: releaseHash,
      candidateSourceDatasetHash: sourceDatasetHash,
      outputDigest: 'e'.repeat(64),
      captureRevision: coverageCaptureRevision,
    })).toThrow(/unbranded or forged/);

    expect(() => mintAcceptedDeltaEvidenceForTests({
      id: 'x',
      authorizationState: 'REJECTED',
      candidateReleaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
      candidateReleaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
      candidateReleaseHash: releaseHash,
      candidateSourceDatasetHash: sourceDatasetHash,
      outputDigest: 'e'.repeat(64),
      captureRevision: coverageCaptureRevision,
    })).toThrow(/ACCEPTED/);

    expect(() => mintAcceptedDeltaEvidenceForTests({
      id: 'x',
      authorizationState: 'ACCEPTED',
      candidateReleaseSetId: 'not-pinned-set',
      candidateReleaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
      candidateReleaseHash: releaseHash,
      candidateSourceDatasetHash: sourceDatasetHash,
      outputDigest: 'e'.repeat(64),
      captureRevision: coverageCaptureRevision,
    })).toThrow(/not pinned aggregate/);

    const delta = acceptedDelta();
    expect(() => mintVerifiedCoverageForTests({
      delta,
      coverage: availableAggregateCoverage(undefined, { versionLifecycle: 'STALE' }),
    })).toThrow(/CURRENT|not available/);

    expect(() => mintVerifiedCoverageForTests({
      delta,
      coverage: availableAggregateCoverage(undefined, {
        governanceCoverageVersionId: 'wrong-coverage-version',
      }),
    })).toThrow(/coverageVersionId|identity/);

    expect(() => mintVerifiedCoverageForTests({
      delta,
      coverage: availableAggregateCoverage(undefined, {
        selectorOverlayId: 'forged-overlay',
      }),
    })).toThrow(/overlayId|selector/);

    // Unbranded coverage object cannot build pinned context.
    expect(() => buildKaqPinnedContextFromVerifiedAuthority({
      delta,
      coverage: availableCoverage() as never,
    })).toThrow(/unbranded or forged/);

    const verified = mintVerifiedCoverageForTests({
      delta,
      coverage: availableCoverage(),
    });
    expect(verified.identity.authorityState).toBe('SHADOW');
    expect(verified.identity.productionAuthoritative).toBe(false);
    expect(verified.identity.coverageVersionId).toBe(coverageVersionId);
    expect(verified.identity.governanceReceiptId).toBe(governanceReceiptId);
    // No legacy lockRawHash invented on aggregate identity.
    expect(verified.identity).not.toHaveProperty('lockRawHash');
    expect(verified).not.toHaveProperty('audit');

    const context = buildKaqPinnedContextFromVerifiedAuthority({
      delta,
      coverage: verified,
    });
    expect(context.deltaReceiptId).toBe(deltaReceiptId);
    expect(context.contextDigest).toMatch(/^[a-f0-9]{64}$/);

    // Free projection pair still cannot admit
    expect(resolveTeachingProjectionAvailability({
      pinned: context,
      teachingProjection: {
        projectionId: 'ctr:projection:self-minted',
        projectionDigest: '1'.repeat(64),
      },
    }).available).toBe(false);

    // Self-minted formal proof plain object fails brand check
    expect(resolveTeachingProjectionAvailability({
      pinned: context,
      formalProof: {
        schemaVersion: 'act-formal-teaching-projection-proof/v1',
        proofKind: 'FORMAL_ACTKG_TEACHING_PROJECTION_RELEASE',
        releaseSetId: context.releaseSetId,
        releaseId: context.releaseId,
        releaseHash: context.releaseHash,
        pinnedContextDigest: context.contextDigest,
        projectionId: 'p',
        projectionDigest: '1'.repeat(64),
        formalReleaseAttestationId: 'a',
        formalReleaseAttestationDigest: '2'.repeat(64),
        proofDigest: '3'.repeat(64),
      },
    }).available).toBe(false);
  });

  it('documents production server loader API rejects row/result injection', async () => {
    const serverSrc = readFileSync(
      join(process.cwd(), 'src/lib/canonical-kaq-binding/server.ts'),
      'utf8',
    );
    const capabilitySrc = readFileSync(
      join(process.cwd(), 'src/lib/canonical-kaq-binding/authority-capability.ts'),
      'utf8',
    );
    expect(serverSrc).toContain('loadKaqPinnedContextFromDb');
    expect(serverSrc).toContain("import 'server-only'");
    expect(serverSrc).not.toContain('deltaReceiptRow');
    expect(capabilitySrc).toContain('actkgReleaseSetDeltaReceipt.findUnique');
    expect(capabilitySrc).toContain('aggregateCourseCoverageVersion');
    expect(capabilitySrc).toContain('aggregateCourseCoverageEntry');
    expect(capabilitySrc).toContain('aggregateGovernanceReceipt');
    expect(capabilitySrc).not.toContain('readCourseCoverage');
    expect(capabilitySrc).not.toContain('AuthoritativeKnowledgeRepository');
    expect(capabilitySrc).not.toContain('courseCoverageOverlayVersion');
    expect(capabilitySrc).not.toContain('lockRawHash');
    expect(capabilitySrc).toContain('deltaReceiptId');
    expect(capabilitySrc).toContain('coverageSelector');
    // Production mint factories are not exported as open symbols.
    expect(capabilitySrc).toMatch(/function mintAcceptedDeltaReceiptEvidence/);
    expect(capabilitySrc).not.toMatch(/export function mintAcceptedDeltaReceiptEvidence/);
    expect(capabilitySrc).not.toMatch(/export function mintVerifiedCourseCoverageBundle/);
    expect(capabilitySrc).not.toMatch(/export function mintFormalTeachingProjectionProof\(/);

    const barrel = await import('@/lib/canonical-kaq-binding');
    expect('mintFormalTeachingProjectionProof' in barrel).toBe(false);
    expect('mintAcceptedDeltaReceiptEvidence' in barrel).toBe(false);
    expect('loadKaqPinnedContextFromDb' in barrel).toBe(false);
    expect('mintFormalTeachingProjectionProofForTests' in barrel).toBe(false);
    expect('buildKaqPinnedContext' in barrel).toBe(false);
  });
});

describe('P1 selector/planner single source of truth', () => {
  it('fails closed when formal planning selector is used even if Teaching Projection is available', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);
    const actkg = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-formal-block',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    const gate = selectPlannerTeachingRelations({
      selector: formalPlanningSelector(),
      availability,
      kaqRelations: [],
      actkgRelations: [actkg],
      conflicts: [],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(gate.blocked).toBe(true);
    expect(gate.reason).toBe('formal-selector-cannot-activate-actkg');
    expect(gate.activeActkgRelationIds).toEqual([]);
    expect(gate.selectorConsumer).toBe('FORMAL_PLANNING');
  });
});

describe('P1 conflict ledger and relation set closure', () => {
  const kaqEdge: KaqKnowledgeToKnowledgeRelation = {
    edgeId: 'edge:kaq:feedback->tf',
    sourceRoleId: 'kn:autocontrol:feedback-loop',
    targetRoleId: 'kn:autocontrol:transfer-function-model',
    relation: 'depends-on',
    lifecycleState: 'ACTIVE',
    ownership: 'KAQ',
  };

  it('blocks RETIRED_KAQ ledger when KAQ edge is still ACTIVE', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);
    const actkg = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-1',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    const conflicts = detectTeachingRelationConflicts({
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
      existingLedger: [],
    });
    const accepted = reviewTeachingRelationConflict(conflicts[0]!, {
      outcome: 'ACCEPTED_ACTKG',
      reviewIdentity: 'reviewer',
      reviewRationale: 'accept actkg',
    });
    // Ledger claims retired without actually retiring the edge
    const fakeRetired = { ...accepted, reviewState: 'RETIRED_KAQ' as const };
    const gate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: [kaqEdge], // still ACTIVE
      actkgRelations: [actkg],
      conflicts: [fakeRetired],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(gate.reason).toBe('parallel-conflict-versions');
  });

  it('keeps non-conflict ActKG relations active when other conflicts exist', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);
    const conflicted = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-conflicted',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    const free = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-free',
      predicate: 'association',
      sourceCanonicalId: 'ctr:object:root-locus',
      targetCanonicalId: 'ctr:object:bode-plot',
      version: 'tp-v1',
    });
    const conflicts = detectTeachingRelationConflicts({
      kaqRelations: [kaqEdge],
      actkgRelations: [conflicted, free],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
      existingLedger: [],
    });
    expect(conflicts).toHaveLength(1);
    const accepted = reviewTeachingRelationConflict(conflicts[0]!, {
      outcome: 'ACCEPTED_ACTKG',
      reviewIdentity: 'reviewer',
      reviewRationale: 'accept',
    });
    const retired = retireAcceptedConflictingKaqRelations({
      kaqRelations: [kaqEdge],
      conflicts: [accepted],
    });
    const currentLedger = detectTeachingRelationConflicts({
      kaqRelations: retired.relations,
      actkgRelations: [conflicted, free],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
      existingLedger: retired.conflicts,
    });
    const gate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: retired.relations,
      actkgRelations: [conflicted, free],
      conflicts: currentLedger,
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(gate.blocked).toBe(false);
    expect(gate.activeActkgRelationIds).toEqual(['tp-conflicted', 'tp-free']);
  });

  it('rejects forged conflict ledger rows and preserves terminal states on re-detection', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);
    const actkg = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-1',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    const conflicts = detectTeachingRelationConflicts({
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
      existingLedger: [],
    });
    expect(() => assertConflictLedgerIntegrity({
      conflicts: [{
        ...conflicts[0]!,
        id: 'forged-id',
      }],
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
    })).toThrow(/does not match endpoints/);

    expect(() => assertConflictLedgerIntegrity({
      conflicts: [{
        ...conflicts[0]!,
        kaqEdgeId: 'missing-edge',
      }],
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
    })).toThrow(/missing KAQ relation|does not match endpoints/);

    const accepted = reviewTeachingRelationConflict(conflicts[0]!, {
      outcome: 'ACCEPTED_ACTKG',
      reviewIdentity: 'reviewer',
      reviewRationale: 'done',
    });
    const redetected = detectTeachingRelationConflicts({
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
      existingLedger: [accepted],
    });
    expect(redetected).toHaveLength(1);
    expect(redetected[0]?.reviewState).toBe('ACCEPTED_ACTKG');
    expect(redetected[0]?.reviewIdentity).toBe('reviewer');
  });
});

describe('P1 one-time review lifecycle', () => {
  it('allows CANDIDATE→ACCEPTED/REJECTED only and refuses terminal rewrite', () => {
    const context = pinned();
    const { bindings } = generateKaqCanonicalBindings({
      pinned: context,
      proposals: [{
        kaqRoleId: 'kn:autocontrol:feedback-loop',
        targets: [{
          canonicalId: 'ctr:object:feedback-loop',
          bindingRole: 'PRIMARY_IDENTITY',
          evidenceRefs: ['e1'],
          semanticRationale: 'once',
          objectRevision: 'r1',
        }],
      }],
    });
    const accepted = acceptBinding(bindings[0]!, context);
    expect(accepted.reviewState).toBe('ACCEPTED');
    expect(() => reviewKaqCanonicalBinding(
      accepted,
      {
        bindingId: accepted.id,
        outcome: 'REJECT',
        reviewIdentity: 'other',
        reviewRationale: 'rewrite',
      },
      context,
    )).toThrow(/only CANDIDATE/);

    const rejected = reviewKaqCanonicalBinding(
      bindings[0]!,
      {
        bindingId: bindings[0]!.id,
        outcome: 'REJECT',
        reviewIdentity: 'r',
        reviewRationale: 'no',
      },
      context,
    );
    expect(() => reviewKaqCanonicalBinding(
      rejected,
      {
        bindingId: rejected.id,
        outcome: 'ACCEPT',
        reviewIdentity: 'r2',
        reviewRationale: 'retry',
      },
      context,
    )).toThrow(/only CANDIDATE/);
  });

  it('keeps retirement consistent with relation lifecycle', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);
    const kaqEdge: KaqKnowledgeToKnowledgeRelation = {
      edgeId: 'edge:kaq:feedback->tf',
      sourceRoleId: 'kn:autocontrol:feedback-loop',
      targetRoleId: 'kn:autocontrol:transfer-function-model',
      relation: 'depends-on',
      lifecycleState: 'ACTIVE',
      ownership: 'KAQ',
    };
    const actkg = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-1',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    const conflicts = detectTeachingRelationConflicts({
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
      existingLedger: [],
    });
    const accepted = reviewTeachingRelationConflict(conflicts[0]!, {
      outcome: 'ACCEPTED_ACTKG',
      reviewIdentity: 'reviewer',
      reviewRationale: 'accept',
    });
    expect(() => reviewTeachingRelationConflict(accepted, {
      outcome: 'RETAIN_KAQ',
      reviewIdentity: 'other',
      reviewRationale: 'rewrite',
    })).toThrow(/already reviewed|immutable/);

    const retired = retireAcceptedConflictingKaqRelations({
      kaqRelations: [kaqEdge],
      conflicts: [accepted],
    });
    expect(retired.relations[0]?.lifecycleState).toBe('RETIRED');
    expect(retired.conflicts[0]?.reviewState).toBe('RETIRED_KAQ');

    const currentLedger = detectTeachingRelationConflicts({
      kaqRelations: retired.relations,
      actkgRelations: [actkg],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
      existingLedger: retired.conflicts,
    });
    const gate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: retired.relations,
      actkgRelations: [actkg],
      conflicts: currentLedger,
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(gate.blocked).toBe(false);
    expect(gate.activeActkgRelationIds).toContain('tp-1');
  });

  it('RETAIN_KAQ keeps KAQ active and suppresses conflicting ActKG without parallel block', () => {
    const context = pinned();
    const { bindings, mapping } = reviewedMappingFixture(context);
    const availability = availableTeachingProjection(context);
    const kaqEdge: KaqKnowledgeToKnowledgeRelation = {
      edgeId: 'edge:kaq:retain-active',
      sourceRoleId: 'kn:autocontrol:feedback-loop',
      targetRoleId: 'kn:autocontrol:transfer-function-model',
      relation: 'depends-on',
      lifecycleState: 'ACTIVE',
      ownership: 'KAQ',
    };
    const actkg = buildActkgTeachingProjectionRelation({
      availability,
      pinned: context,
      id: 'tp-retain-conflict',
      predicate: 'prerequisite',
      sourceCanonicalId: 'ctr:object:feedback-loop',
      targetCanonicalId: 'ctr:object:transfer-function',
      version: 'tp-v1',
    });
    const retain = reviewTeachingRelationConflict(
      detectTeachingRelationConflicts({
        kaqRelations: [kaqEdge],
        actkgRelations: [actkg],
        reviewedMapping: mapping,
        pinned: context,
        bindings,
        existingLedger: [],
      })[0]!,
      {
        outcome: 'RETAIN_KAQ',
        reviewIdentity: 'issue-1113-retain-kaq-reviewer',
        reviewRationale: 'Keep KAQ pedagogical edge; suppress ActKG from effective activation.',
      },
    );
    // ActKG remains in the supplied relation set for exact-set ledger closure.
    const gate = selectPlannerTeachingRelations({
      selector: migrationSelector(),
      availability,
      kaqRelations: [kaqEdge],
      actkgRelations: [actkg],
      conflicts: [retain],
      reviewedMapping: mapping,
      pinned: context,
      bindings,
    });
    expect(gate.blocked).toBe(false);
    expect(gate.available).toBe(true);
    expect(gate.activeKaqEdgeIds).toEqual(['edge:kaq:retain-active']);
    expect(gate.activeActkgRelationIds).not.toContain('tp-retain-conflict');
    expect(gate.activeActkgRelationIds).toEqual([]);
  });
});
