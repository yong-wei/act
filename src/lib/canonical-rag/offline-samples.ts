/**
 * Offline Canonical RAG sample with complete context fingerprints.
 * Fixture-only helpers stamp context explicitly for tests.
 */

import {
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
} from '@/lib/authoritative-knowledge/contracts';

import { buildCandidateContextFingerprint } from './context-fingerprint';
import type {
  ActStructuralCitationTarget,
  CanonicalRagCoverageEntry,
  CanonicalRagObject,
  CanonicalRagRelation,
  CanonicalRagReleaseContext,
  CanonicalRagShadowInput,
  UpstreamRagReferenceSeed,
  VersionBoundCrosswalk,
} from './contracts';
import type { ActStructuralUnitCrosswalkRecord } from '@/lib/aggregate-governance/contracts';
import { bindCandidateContextForFixtureOnly } from './version-context';

export const CANONICAL_RAG_OFFLINE_SAMPLE_ID = 'canonical-rag-offline-sample.v1' as const;

const CAPTURE = 'd'.repeat(40);
const DELTA = 'delta-receipt:offline-sample-v1';
const INVENTORY = 'inventory-run-offline-1';

export const offlineRelease: CanonicalRagReleaseContext = buildCandidateContextFingerprint({
  releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
  releaseId: CURRENT_AGGREGATE_RELEASE_ID,
  releaseHash: 'a'.repeat(64),
  sourceDatasetHash: 'b'.repeat(64),
  projectionId: 'projection:offline-sample-runtime',
  projectionProfile: 'domain-semantic-runtime',
  projectionDigest: 'c'.repeat(64),
  deltaReceiptId: DELTA,
  coverageOverlayId: 'automatic-control-aggregate-coverage-v1',
  coverageOverlayVersion: 'automatic-control-aggregate-coverage-v1@1',
  coverageSourceHash: '1'.repeat(64),
  coverageCaptureRevision: CAPTURE,
  inventoryRunId: INVENTORY,
});

export const offlineObjects: CanonicalRagObject[] = [
  bindCandidateContextForFixtureOnly({
    canonicalId: 'ctr:root-locus',
    canonicalType: 'DomainConcept',
    label: '根轨迹',
    aliases: ['root locus', 'Root-Locus'],
    summary: 'Graph summary of root locus — not citable.',
  }, offlineRelease),
  bindCandidateContextForFixtureOnly({
    canonicalId: 'ctr:nyquist-stability',
    canonicalType: 'DomainConcept',
    label: '奈奎斯特稳定性',
    aliases: ['Nyquist stability'],
    summary: 'Graph summary of Nyquist — not citable.',
  }, offlineRelease),
  bindCandidateContextForFixtureOnly({
    canonicalId: 'ctr:bode-plot',
    canonicalType: 'DomainConcept',
    label: '伯德图',
    aliases: ['Bode plot'],
    summary: 'Graph summary of Bode — not citable.',
  }, offlineRelease),
  bindCandidateContextForFixtureOnly({
    canonicalId: 'ctr:excluded-topic',
    canonicalType: 'DomainConcept',
    label: '排除主题',
    aliases: [],
    summary: 'Excluded by course coverage.',
  }, offlineRelease),
  bindCandidateContextForFixtureOnly({
    canonicalId: 'ctr:model-representation',
    canonicalType: 'ModelRepresentation',
    label: '模型表示',
    aliases: [],
  }, offlineRelease),
];

export const offlineRelations: CanonicalRagRelation[] = [
  bindCandidateContextForFixtureOnly({
    relationId: 'rel:root-locus-is-a-stability',
    predicate: 'is_a',
    sourceId: 'ctr:root-locus',
    targetId: 'ctr:nyquist-stability',
  }, offlineRelease),
  bindCandidateContextForFixtureOnly({
    relationId: 'rel:root-locus-mentions-bode',
    predicate: 'mentions',
    sourceId: 'ctr:root-locus',
    targetId: 'ctr:bode-plot',
  }, offlineRelease),
  bindCandidateContextForFixtureOnly({
    relationId: 'rel:root-locus-prerequisite-excluded',
    predicate: 'prerequisite',
    sourceId: 'ctr:root-locus',
    targetId: 'ctr:excluded-topic',
  }, offlineRelease),
  bindCandidateContextForFixtureOnly({
    relationId: 'rel:root-locus-has-representation',
    predicate: 'has_representation',
    sourceId: 'ctr:root-locus',
    targetId: 'ctr:model-representation',
  }, offlineRelease),
  bindCandidateContextForFixtureOnly({
    relationId: 'rel:bode-association-nyquist',
    predicate: 'association',
    sourceId: 'ctr:bode-plot',
    targetId: 'ctr:nyquist-stability',
  }, offlineRelease),
];

export const offlineCoverage: CanonicalRagCoverageEntry[] = [
  bindCandidateContextForFixtureOnly({ canonicalId: 'ctr:root-locus', role: 'formal_objective' }, offlineRelease),
  bindCandidateContextForFixtureOnly({ canonicalId: 'ctr:nyquist-stability', role: 'necessary_prerequisite' }, offlineRelease),
  bindCandidateContextForFixtureOnly({ canonicalId: 'ctr:bode-plot', role: 'explicit_extension' }, offlineRelease),
  bindCandidateContextForFixtureOnly({ canonicalId: 'ctr:excluded-topic', role: 'excluded_with_rationale' }, offlineRelease),
  bindCandidateContextForFixtureOnly({ canonicalId: 'ctr:model-representation', role: 'explicit_extension' }, offlineRelease),
];

function structuralTarget(partial: {
  id: string;
  version?: string;
  hash: string;
  chunk: string;
  cite: string;
  edition?: string;
  sourceVersion?: string;
  evidence?: string;
  atomic?: string;
  resource?: string;
  segment?: string;
  segmentHash?: string;
  locator: string | null;
  href: string | null;
  title: string;
  readable?: boolean;
}): ActStructuralCitationTarget {
  return bindCandidateContextForFixtureOnly({
    structuralUnitId: partial.id,
    structuralUnitVersion: partial.version ?? 'v1',
    structuralUnitHash: partial.hash,
    retrievalChunkId: partial.chunk,
    citationTargetId: partial.cite,
    sourceEditionId: partial.edition ?? 'edition:hu-shousong-8th',
    sourceVersion: partial.sourceVersion ?? '8th',
    evidenceContentHash: partial.evidence ?? partial.hash,
    atomicResourceId: partial.atomic ?? `atomic:${partial.id}`,
    resourceId: partial.resource ?? `resource:${partial.id}`,
    segmentId: partial.segment ?? `segment:${partial.id}`,
    resourceSegmentHash: partial.segmentHash ?? '3'.repeat(64),
    captureRevision: CAPTURE,
    locator: partial.locator,
    href: partial.href,
    displayTitle: partial.title,
    readable: partial.readable ?? true,
    observationSource: 'derived-from-independent-observations' as const,
  }, offlineRelease);
}

export const offlineStructuralUnits: ActStructuralCitationTarget[] = [
  structuralTarget({
    id: 'unit:root-locus-para-2',
    hash: 'e'.repeat(64),
    chunk: 'chunk:root-locus-para-2',
    cite: 'cite:root-locus-para-2',
    locator: '3.2.1-p2',
    href: '/course-runtime/resources/textbooks/demo/sections/root-locus.md#p2',
    title: '根轨迹定义（第2段）',
    segmentHash: '31'.repeat(32),
  }),
  structuralTarget({
    id: 'unit:nyquist-sec',
    hash: 'f'.repeat(64),
    chunk: 'chunk:nyquist-sec',
    cite: 'cite:nyquist-sec',
    locator: 'chapter-4',
    href: '/course-runtime/resources/textbooks/demo/sections/nyquist.md',
    title: '奈奎斯特稳定性判据',
    segmentHash: '32'.repeat(32),
  }),
  structuralTarget({
    id: 'unit:unreadable',
    hash: '1'.repeat(64),
    chunk: 'chunk:unreadable',
    cite: 'cite:unreadable',
    locator: null,
    href: null,
    title: '不可读单元',
    readable: false,
    segmentHash: '33'.repeat(32),
  }),
];

function wrapCrosswalk(partial: {
  id: string;
  published: string;
  chunk: string;
  cite: string;
  canonical: string;
  unit: string;
  unitVersion?: string;
  unitHash: string;
  evidence?: string;
  atomic?: string;
  resource?: string;
  segment?: string;
  segmentHash?: string;
  validation?: ActStructuralUnitCrosswalkRecord['validationState'];
  lifecycle?: ActStructuralUnitCrosswalkRecord['lifecycleState'];
  delta?: string;
  capture?: string;
  digest?: string | null;
}): VersionBoundCrosswalk {
  const row: ActStructuralUnitCrosswalkRecord = {
    id: partial.id,
    releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
    releaseId: CURRENT_AGGREGATE_RELEASE_ID,
    deltaReceiptId: partial.delta ?? DELTA,
    publishedEntityId: partial.published,
    retrievalChunkId: partial.chunk,
    citationTargetId: partial.cite,
    canonicalId: partial.canonical,
    sourceEditionId: 'edition:hu-shousong-8th',
    sourceVersion: '8th',
    structuralUnitId: partial.unit,
    structuralUnitVersion: partial.unitVersion ?? 'v1',
    structuralUnitHash: partial.unitHash,
    evidenceContentHash: partial.evidence ?? partial.unitHash,
    inventoryRunId: INVENTORY,
    atomicResourceId: partial.atomic ?? `atomic:${partial.unit}`,
    resourceId: partial.resource ?? `resource:${partial.unit}`,
    segmentId: partial.segment ?? `segment:${partial.unit}`,
    resourceSegmentHash: partial.segmentHash ?? '31'.repeat(32),
    captureRevision: partial.capture ?? CAPTURE,
    resolutionState: 'DETERMINISTIC',
    validationState: partial.validation ?? 'VALIDATED',
    validationDigest: partial.digest === undefined ? '4'.repeat(64) : partial.digest,
    reviewIdentity: 'issue-1112-offline-fixture',
    evidenceDigest: '5'.repeat(64),
    lifecycleState: partial.lifecycle ?? 'CURRENT',
  };
  return { ...offlineRelease, row };
}

export const offlineCrosswalks: VersionBoundCrosswalk[] = [
  wrapCrosswalk({
    id: 'xw:root-locus',
    published: 'upstream:root-locus',
    chunk: 'chunk:root-locus-para-2',
    cite: 'cite:root-locus-para-2',
    canonical: 'ctr:root-locus',
    unit: 'unit:root-locus-para-2',
    unitHash: 'e'.repeat(64),
    segmentHash: '31'.repeat(32),
  }),
  wrapCrosswalk({
    id: 'xw:nyquist',
    published: 'upstream:nyquist',
    chunk: 'chunk:nyquist-sec',
    cite: 'cite:nyquist-sec',
    canonical: 'ctr:nyquist-stability',
    unit: 'unit:nyquist-sec',
    unitHash: 'f'.repeat(64),
    segmentHash: '32'.repeat(32),
  }),
  wrapCrosswalk({
    id: 'xw:bode-drifted',
    published: 'upstream:bode',
    chunk: 'chunk:bode',
    cite: 'cite:bode',
    canonical: 'ctr:bode-plot',
    unit: 'unit:unreadable',
    unitHash: '1'.repeat(64),
    segmentHash: '33'.repeat(32),
    validation: 'STALE',
    lifecycle: 'STALE',
    digest: null,
  }),
  wrapCrosswalk({
    id: 'xw:endpoint-mismatch',
    published: 'upstream:endpoint-mismatch',
    chunk: 'chunk:wrong-chunk',
    cite: 'cite:root-locus-para-2',
    canonical: 'ctr:root-locus',
    unit: 'unit:root-locus-para-2',
    unitHash: 'e'.repeat(64),
    segmentHash: '31'.repeat(32),
  }),
];

export const offlineUpstreamByCanonicalId: ReadonlyMap<string, readonly UpstreamRagReferenceSeed[]> = new Map([
  ['ctr:root-locus', [{
    publishedEntityId: 'upstream:root-locus',
    retrievalChunkId: 'chunk:root-locus-para-2',
    citationTargetId: 'cite:root-locus-para-2',
    canonicalId: 'ctr:root-locus',
    context: offlineRelease,
  }]],
  ['ctr:nyquist-stability', [{
    publishedEntityId: 'upstream:nyquist',
    retrievalChunkId: 'chunk:nyquist-sec',
    citationTargetId: 'cite:nyquist-sec',
    canonicalId: 'ctr:nyquist-stability',
    context: offlineRelease,
  }]],
  ['ctr:model-representation', [{
    publishedEntityId: 'upstream:model-representation',
    retrievalChunkId: 'chunk:missing',
    citationTargetId: 'cite:missing',
    canonicalId: 'ctr:model-representation',
    context: offlineRelease,
  }]],
  ['ctr:bode-plot', [{
    publishedEntityId: 'upstream:bode',
    retrievalChunkId: 'chunk:bode',
    citationTargetId: 'cite:bode',
    canonicalId: 'ctr:bode-plot',
    context: offlineRelease,
  }]],
]);

export const offlineSampleCases = Object.freeze({
  directEntityMatch: { id: 'direct-entity-match', query: '根轨迹' },
  inQueryEntityMatch: { id: 'in-query-entity-match', query: '请解释根轨迹的基本概念并给出定义' },
  aliasMatch: { id: 'alias-match', query: 'What is the root locus method?' },
  supportedExpansion: { id: 'supported-expansion', query: '根轨迹' },
  wrongDirection: { id: 'wrong-direction', query: '奈奎斯特稳定性' },
  unsupportedPredicate: { id: 'unsupported-predicate', query: '根轨迹' },
  missingCrosswalk: { id: 'missing-crosswalk', query: '根轨迹' },
  driftedCrosswalk: { id: 'drifted-crosswalk', query: '伯德图' },
  endpointMismatch: { id: 'endpoint-mismatch', query: '根轨迹' },
  shadowSeparation: { id: 'shadow-separation', query: '根轨迹' },
  selectorNegative: { id: 'selector-negative', query: '根轨迹' },
} as const);

export function buildOfflineShadowInput(
  overrides: Partial<CanonicalRagShadowInput> = {},
): CanonicalRagShadowInput {
  return {
    query: '根轨迹',
    release: offlineRelease,
    objects: offlineObjects,
    relations: offlineRelations,
    coverage: offlineCoverage,
    upstreamByCanonicalId: offlineUpstreamByCanonicalId,
    crosswalks: offlineCrosswalks,
    structuralUnits: offlineStructuralUnits,
    legacyCandidateIds: ['unit:legacy-root-locus', 'unit:root-locus-para-2'],
    authorityConsumer: 'SHADOW_COMPARISON',
    maxHops: 1,
    maxExpandedObjects: 16,
    latencyBudgetMs: 250,
    ...overrides,
  };
}
