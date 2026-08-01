/**
 * Offline multi-source fixtures for Canonical SAR composition tests (#1114).
 *
 * Cross-namespace bindings here are sealed only via test-only mint
 * (`mintVerifiedSarBindingSetForTests`). Path/learner cross-bindings are
 * fixture/test seams — not production projectors. Production KAQ/resource
 * projection requires real governance provenance registries.
 */

import {
  PINNED_SAR_AGGREGATE_RELEASE_ID,
  PINNED_SAR_AGGREGATE_RELEASE_SET_ID,
  PINNED_SAR_COVERAGE_OVERLAY_ID,
  type SarCompositionScope,
  type SarCompositionSeed,
  type SarCompositionVersionContext,
  type SarCrossNamespaceBinding,
  type SarSourceAdapterSet,
  type VerifiedSarBindingSet,
} from './contracts';
import { createFiveSourceAdapterSet, type StaticSourceRecord } from './adapters';
import { mintVerifiedSarBindingSetForTests } from './testing';
import { buildSarVersionContext } from './version-context';

const RELEASE_HASH = 'a'.repeat(64);
const SOURCE_DATASET_HASH = 'b'.repeat(64);
const PROJECTION_DIGEST = 'c'.repeat(64);
const COVERAGE_SOURCE_HASH = 'd'.repeat(64);
const CAPTURE_REVISION = 'e'.repeat(40);

export const CANONICAL_SAR_FIXTURE_IDS = Object.freeze({
  feedbackLoop: 'ctr:object:feedback-loop',
  transferFunction: 'ctr:object:transfer-function',
  rootLocus: 'ctr:object:root-locus',
  bodePlot: 'ctr:object:bode-plot',
  genericStored: 'ctr:object:generic-stored-type',
  kaqRoleFeedback: 'kaq-role:feedback-control',
  kaqRoleSameName: 'kaq-role:feedback-loop-label-only',
  kaqCollidingLocalId: 'ctr:object:feedback-loop',
  resourceSegment: 'resource-seg:feedback-intro',
  pathNode: 'path-node:unit-1-feedback',
  learnerSlice: 'learner-state:student-alpha:control-correction',
});

export function buildFixtureVersion(
  overrides: Partial<SarCompositionVersionContext> = {},
): SarCompositionVersionContext {
  const fields = {
    releaseSetId: overrides.releaseSetId ?? PINNED_SAR_AGGREGATE_RELEASE_SET_ID,
    releaseId: overrides.releaseId ?? PINNED_SAR_AGGREGATE_RELEASE_ID,
    releaseHash: overrides.releaseHash ?? RELEASE_HASH,
    sourceDatasetHash: overrides.sourceDatasetHash ?? SOURCE_DATASET_HASH,
    projectionId: overrides.projectionId ?? 'proj:ctkg-0-2-runtime',
    projectionProfile: overrides.projectionProfile ?? 'domain-semantic-v1',
    projectionDigest: overrides.projectionDigest ?? PROJECTION_DIGEST,
    deltaReceiptId: overrides.deltaReceiptId ?? 'delta-receipt:accepted-aggregate-v1',
    coverageOverlayId: overrides.coverageOverlayId ?? PINNED_SAR_COVERAGE_OVERLAY_ID,
    coverageOverlayVersion: overrides.coverageOverlayVersion ?? '1',
    coverageSourceHash: overrides.coverageSourceHash ?? COVERAGE_SOURCE_HASH,
    coverageCaptureRevision:
      overrides.coverageCaptureRevision ?? CAPTURE_REVISION,
    inventoryRunId: overrides.inventoryRunId ?? 'inventory:run-v1',
    kaqBindingVersion: overrides.kaqBindingVersion ?? 'kaq-bind:v1',
    resourceBindingVersion: overrides.resourceBindingVersion ?? 'resource-bind:v1',
    pathOverlayVersion: overrides.pathOverlayVersion ?? 'path-overlay:v1',
    learnerStateOverlayVersion:
      overrides.learnerStateOverlayVersion ?? 'learner-state-overlay:v1',
  };
  if (overrides.contextDigest && overrides.contextDigest !== 'broken') {
    return { ...fields, contextDigest: overrides.contextDigest };
  }
  return buildSarVersionContext(fields);
}

export function buildFixtureScope(
  overrides: Partial<SarCompositionScope> = {},
): SarCompositionScope {
  return {
    courseId: overrides.courseId ?? 'automatic-control',
    learningGoalId: overrides.learningGoalId ?? 'control-correction',
    studentId: overrides.studentId ?? 'student-alpha',
    classId: overrides.classId ?? 'class-demo',
    admittedCanonicalIds: overrides.admittedCanonicalIds ?? [
      CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
      CANONICAL_SAR_FIXTURE_IDS.transferFunction,
      CANONICAL_SAR_FIXTURE_IDS.rootLocus,
      CANONICAL_SAR_FIXTURE_IDS.bodePlot,
    ],
  };
}

function repositoryRecords(): StaticSourceRecord[] {
  return [
    {
      id: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
      objectType: 'DomainConcept',
      label: 'Feedback Loop',
      sourceIdentity: `repo:${CANONICAL_SAR_FIXTURE_IDS.feedbackLoop}`,
      neighborEdges: [
        {
          id: 'rel:feedback-has-formula',
          predicate: 'has_formula',
          fromId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
          toId: CANONICAL_SAR_FIXTURE_IDS.transferFunction,
          sourceIdentity: 'repo-rel:feedback-has-formula',
        },
        {
          id: 'rel:feedback-has-representation',
          predicate: 'has_representation',
          fromId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
          toId: CANONICAL_SAR_FIXTURE_IDS.bodePlot,
          sourceIdentity: 'repo-rel:feedback-has-representation',
        },
        {
          id: 'rel:feedback-mentions-root',
          predicate: 'mentions',
          fromId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
          toId: CANONICAL_SAR_FIXTURE_IDS.rootLocus,
          sourceIdentity: 'repo-rel:feedback-mentions-root',
        },
      ],
    },
    {
      id: CANONICAL_SAR_FIXTURE_IDS.transferFunction,
      objectType: 'Formula',
      label: 'Transfer Function',
      sourceIdentity: `repo:${CANONICAL_SAR_FIXTURE_IDS.transferFunction}`,
    },
    {
      id: CANONICAL_SAR_FIXTURE_IDS.rootLocus,
      objectType: 'DomainConcept',
      label: 'Root Locus',
      sourceIdentity: `repo:${CANONICAL_SAR_FIXTURE_IDS.rootLocus}`,
    },
    {
      id: CANONICAL_SAR_FIXTURE_IDS.bodePlot,
      objectType: 'ModelRepresentation',
      label: 'Bode Plot',
      sourceIdentity: `repo:${CANONICAL_SAR_FIXTURE_IDS.bodePlot}`,
    },
    {
      id: CANONICAL_SAR_FIXTURE_IDS.genericStored,
      objectType: 'GenericStoredObject',
      label: 'Generic Stored Object',
      sourceIdentity: `repo:${CANONICAL_SAR_FIXTURE_IDS.genericStored}`,
    },
  ];
}

function kaqRecords(): StaticSourceRecord[] {
  return [
    {
      id: CANONICAL_SAR_FIXTURE_IDS.kaqRoleFeedback,
      objectType: 'KaqRole',
      label: 'Feedback Control Role',
      sourceIdentity: `kaq:${CANONICAL_SAR_FIXTURE_IDS.kaqRoleFeedback}`,
    },
    {
      id: CANONICAL_SAR_FIXTURE_IDS.kaqRoleSameName,
      objectType: 'KaqRole',
      label: 'Feedback Loop',
      sourceIdentity: `kaq:${CANONICAL_SAR_FIXTURE_IDS.kaqRoleSameName}`,
    },
    {
      id: CANONICAL_SAR_FIXTURE_IDS.kaqCollidingLocalId,
      objectType: 'KaqRole',
      label: 'KAQ Role Colliding Local Id',
      sourceIdentity: `kaq:colliding:${CANONICAL_SAR_FIXTURE_IDS.kaqCollidingLocalId}`,
    },
  ];
}

function resourceRecords(): StaticSourceRecord[] {
  return [
    {
      id: CANONICAL_SAR_FIXTURE_IDS.resourceSegment,
      objectType: 'ResourceSegment',
      label: 'Feedback Intro Segment',
      sourceIdentity: `resource:${CANONICAL_SAR_FIXTURE_IDS.resourceSegment}`,
    },
  ];
}

function pathRecords(): StaticSourceRecord[] {
  return [
    {
      id: CANONICAL_SAR_FIXTURE_IDS.pathNode,
      objectType: 'PathNode',
      label: 'Unit 1 Feedback Path Node',
      sourceIdentity: `path:${CANONICAL_SAR_FIXTURE_IDS.pathNode}`,
    },
  ];
}

function learnerRecords(): StaticSourceRecord[] {
  return [
    {
      id: CANONICAL_SAR_FIXTURE_IDS.learnerSlice,
      objectType: 'LearnerStateSlice',
      label: 'Student Alpha Control-Correction State',
      sourceIdentity: `learner:${CANONICAL_SAR_FIXTURE_IDS.learnerSlice}`,
    },
  ];
}

/** Raw structural bindings used only by the test-only mint. */
export function buildFixtureBindingRecords(
  version: SarCompositionVersionContext,
  scope: SarCompositionScope = buildFixtureScope(),
): SarCrossNamespaceBinding[] {
  return [
    {
      id: 'sar-bind:kaq:feedback-primary',
      kind: 'kaq-canonical',
      predicate: 'kaq_primary_identity',
      fromNamespace: 'kaq',
      fromIdentity: CANONICAL_SAR_FIXTURE_IDS.kaqRoleFeedback,
      toNamespace: 'repository',
      toIdentity: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
      releaseSetId: version.releaseSetId,
      releaseId: version.releaseId,
      reviewState: 'ACCEPTED',
      authorityState: 'SHADOW',
      productionAuthoritative: false,
      inheritedFromLegacyId: null,
      sameNameAutoMatch: false,
      objectRevision: 'obj-rev:1',
      evidenceDigest: 'f'.repeat(64),
      reviewIdentity: 'fixture-reviewer:kaq-feedback',
      overlayVersion: version.kaqBindingVersion,
      courseId: null,
      learningGoalId: null,
      studentId: null,
      classId: null,
    },
    {
      id: 'sar-bind:resource:feedback-explains',
      kind: 'resource-canonical',
      predicate: 'resource_explains',
      fromNamespace: 'resource',
      fromIdentity: CANONICAL_SAR_FIXTURE_IDS.resourceSegment,
      toNamespace: 'repository',
      toIdentity: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
      releaseSetId: version.releaseSetId,
      releaseId: version.releaseId,
      reviewState: 'ACCEPTED',
      authorityState: 'SHADOW',
      productionAuthoritative: false,
      inheritedFromLegacyId: null,
      sameNameAutoMatch: false,
      objectRevision: 'obj-rev:1',
      evidenceDigest: '1'.repeat(64),
      reviewIdentity: 'fixture-reviewer:resource-feedback',
      overlayVersion: version.resourceBindingVersion,
      courseId: null,
      learningGoalId: null,
      studentId: null,
      classId: null,
    },
    {
      id: 'sar-bind:path:unit-1-covers',
      kind: 'path-canonical',
      predicate: 'path_covers',
      fromNamespace: 'path',
      fromIdentity: CANONICAL_SAR_FIXTURE_IDS.pathNode,
      toNamespace: 'repository',
      toIdentity: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
      releaseSetId: version.releaseSetId,
      releaseId: version.releaseId,
      reviewState: 'ACCEPTED',
      authorityState: 'SHADOW',
      productionAuthoritative: false,
      inheritedFromLegacyId: null,
      sameNameAutoMatch: false,
      objectRevision: 'path-obj-rev:1',
      evidenceDigest: '2'.repeat(64),
      reviewIdentity: 'fixture-reviewer:path-unit-1',
      overlayVersion: version.pathOverlayVersion,
      courseId: scope.courseId ?? 'automatic-control',
      learningGoalId: scope.learningGoalId ?? 'control-correction',
      studentId: null,
      classId: null,
    },
    {
      id: 'sar-bind:learner:alpha-targets',
      kind: 'learner-canonical',
      predicate: 'learner_targets',
      fromNamespace: 'learner-state',
      fromIdentity: CANONICAL_SAR_FIXTURE_IDS.learnerSlice,
      toNamespace: 'repository',
      toIdentity: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
      releaseSetId: version.releaseSetId,
      releaseId: version.releaseId,
      reviewState: 'ACCEPTED',
      authorityState: 'SHADOW',
      productionAuthoritative: false,
      inheritedFromLegacyId: null,
      sameNameAutoMatch: false,
      objectRevision: 'learner-obj-rev:1',
      evidenceDigest: '3'.repeat(64),
      reviewIdentity: 'fixture-reviewer:learner-alpha',
      overlayVersion: version.learnerStateOverlayVersion,
      courseId: scope.courseId ?? 'automatic-control',
      learningGoalId: scope.learningGoalId ?? 'control-correction',
      studentId: scope.studentId ?? 'student-alpha',
      classId: scope.classId ?? 'class-demo',
    },
  ];
}

export function buildFixtureBindings(
  version: SarCompositionVersionContext,
  scope: SarCompositionScope = buildFixtureScope(),
): VerifiedSarBindingSet {
  return mintVerifiedSarBindingSetForTests(
    buildFixtureBindingRecords(version, scope),
    version,
  );
}

export function buildFixtureAdapters(input: {
  version: SarCompositionVersionContext;
}): SarSourceAdapterSet {
  const { version } = input;
  return createFiveSourceAdapterSet({
    version,
    repository: { records: repositoryRecords() },
    kaq: { records: kaqRecords() },
    resource: { records: resourceRecords() },
    path: { records: pathRecords() },
    learnerState: { records: learnerRecords() },
  });
}

export function buildFixtureSeeds(
  kind: 'repository' | 'multi' = 'multi',
): SarCompositionSeed[] {
  if (kind === 'repository') {
    return [
      {
        id: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
        namespace: 'repository',
      },
    ];
  }
  return [
    {
      id: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
      namespace: 'repository',
    },
    {
      id: CANONICAL_SAR_FIXTURE_IDS.kaqRoleFeedback,
      namespace: 'kaq',
    },
    {
      id: CANONICAL_SAR_FIXTURE_IDS.resourceSegment,
      namespace: 'resource',
    },
    {
      id: CANONICAL_SAR_FIXTURE_IDS.pathNode,
      namespace: 'path',
    },
    {
      id: CANONICAL_SAR_FIXTURE_IDS.learnerSlice,
      namespace: 'learner-state',
    },
  ];
}

export function buildOfflineCompositionFixture(options: {
  versionOverrides?: Partial<SarCompositionVersionContext>;
  scopeOverrides?: Partial<SarCompositionScope>;
} = {}) {
  const version = buildFixtureVersion(options.versionOverrides);
  const scope = buildFixtureScope(options.scopeOverrides);
  const adapters = buildFixtureAdapters({ version });
  const bindings = buildFixtureBindings(version, scope);
  const seeds = buildFixtureSeeds('multi');
  return { version, scope, adapters, bindings, seeds };
}
