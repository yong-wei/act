import { describe, expect, it } from 'vitest';

import { selectResourceKnowledgeAuthority } from '@/lib/canonical-resource-binding';
import type { ResourceBindingInventory } from '@/lib/canonical-resource-binding';

import {
  attemptDeterministicAlignment,
  acceptSemanticAlignment,
  generateSemanticAlignmentCandidates,
  invalidateCrosswalks,
  referenceOpaqueUpstream,
  validateCrosswalkForShadowPublication,
} from '../aggregate-governance/act-crosswalk';
import { verifyCoherentCapture, requireCoherentCapture } from '../aggregate-governance/capture';
import {
  buildDispositionFromReview,
  computeCoverageSourceHash,
  courseRoleCreatesTeachingProjectionEdge,
  mergeIncrementalCoverage,
  validateCourseCoverageAuthoring,
} from '../aggregate-governance/course-coverage';
// buildDispositionFromReview is used for candidate-rejection fixtures
import type {
  CaptureIdentity,
  CourseCoverageAuthoringOverlay,
  CourseCoverageDisposition,
  StructuralUnitIndexEntry,
} from '../aggregate-governance/contracts';
import {
  V03_R2_FIXTURE_OBJECT_COUNT,
  selectCanonicalObjectMembership,
} from '../aggregate-governance/membership';
import { runAggregateGovernance } from '../aggregate-governance/pipeline';
import { buildDownstreamReadinessDiagnostics } from '../aggregate-governance/readiness';
import {
  assertFormalSelectorsRemainLegacy,
  governResourceBindings,
} from '../aggregate-governance/resource-bindings';
import {
  evaluateSemanticRevalidation,
  packagingNoopRevalidation,
  receiptsDoNotCopyPublicationIdentity,
} from '../aggregate-governance/revalidation';
import { buildStructuralUnitIndexFromInventory } from '../aggregate-governance/structural-index';
import { buildAggregateGovernanceSummary } from '../aggregate-governance/summary';
import {
  buildGovernanceWorkManifest,
  expandBaselineCrosswalkWork,
} from '../aggregate-governance/work-manifest';
import { sha256Canonical } from '../aggregate-governance/hash';
import { buildResourceIndexFromValidatedCrosswalks } from '../aggregate-governance/resource-index';
import {
  AggregateGovernanceRepository,
  type AggregateGovernanceDatabase,
  type AggregateGovernanceTransaction,
} from '../aggregate-governance/repository';
import {
  classifyUpstreamReferences,
  partitionUpstreamByKind,
} from '../aggregate-governance/upstream-classification';
import type { AggregateGovernanceRunResult } from '../aggregate-governance/pipeline';

const GOV = 'a'.repeat(40);
const IMPORT = 'b'.repeat(40);
const DELTA_CAP = 'c'.repeat(40);

const CAPTURE: CaptureIdentity = {
  captureRevision: GOV,
  importCaptureRevision: IMPORT,
  deltaCaptureRevision: DELTA_CAP,
  dbWatermark: '0/16B2A40',
  releaseSetId: 'actkg-authoritative-candidate-v3-r2',
  releaseId: 'ctr:release:control-theory-engineering-v0.3',
  releaseHash: 'b'.repeat(64),
  sourceDatasetHash: 'c'.repeat(64),
  deltaReceiptId: 'delta-receipt-1',
  deltaOutputDigest: 'd'.repeat(64),
  deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
  runtimeProjectionId: 'proj-runtime',
  runtimeProjectionDigest: 'e'.repeat(64),
  inventoryRunId: 'inv-1',
  structuralUnitIndexVersion: 'struct-v1',
  authoringRevision: GOV,
  coverageSourceHash: 'f'.repeat(64),
};

function observedOf(capture: CaptureIdentity) {
  return { ...capture };
}

function disposition(
  canonicalId: string,
  role: CourseCoverageDisposition['role'] = 'formal_objective',
): CourseCoverageDisposition {
  return buildDispositionFromReview({
    canonicalId,
    role,
    rationale: role === 'excluded_with_rationale'
      ? 'outside automatic-control formal scope for this baseline'
      : null,
    evidenceRefs: role === 'excluded_with_rationale'
      ? ['review:issue-1126', `profile:${canonicalId}`]
      : [`profile:${canonicalId}`],
    reviewIdentity: 'issue-1126-test-reviewer',
  });
}

function authoring(
  entries: CourseCoverageDisposition[],
  mode: 'baseline' | 'incremental' = 'baseline',
): CourseCoverageAuthoringOverlay {
  const withoutHash = {
    schemaVersion: 'act-course-coverage-overlay/v2' as const,
    overlayId: 'automatic-control-aggregate-coverage-v1' as const,
    overlayVersion: '1',
    courseId: 'automatic-control' as const,
    releaseSetId: CAPTURE.releaseSetId,
    releaseId: CAPTURE.releaseId,
    releaseHash: CAPTURE.releaseHash,
    sourceDatasetHash: CAPTURE.sourceDatasetHash,
    deltaReceiptId: CAPTURE.deltaReceiptId,
    mode,
    authoringRevision: CAPTURE.authoringRevision!,
    entries,
  };
  return {
    ...withoutHash,
    sourceHash: computeCoverageSourceHash(withoutHash),
  };
}

const UNIT: StructuralUnitIndexEntry = {
  sourceEditionId: 'edition-hu-8th',
  sourceVersion: '8',
  structuralUnitId: 'unit-root-locus-1',
  structuralUnitVersion: 'v1',
  structuralUnitHash: 'f'.repeat(64),
  stableIds: ['stable:root-locus'],
  contentHashes: ['1'.repeat(64)],
  atomicResourceId: 'atomic-1',
  resourceId: 'resource-1',
  segmentId: 'seg-1',
  resourceSegmentHash: '2'.repeat(64),
  textPreviewDigest: '3'.repeat(64),
};

describe('aggregate governance capture coherence', () => {
  it('accepts independently observed capture when import/delta differ from governance', () => {
    expect(CAPTURE.captureRevision).not.toBe(CAPTURE.importCaptureRevision);
    expect(CAPTURE.captureRevision).not.toBe(CAPTURE.deltaCaptureRevision);
    expect(verifyCoherentCapture({
      expected: CAPTURE,
      observed: observedOf(CAPTURE),
    }).coherent).toBe(true);
  });

  it('fails on tautology or drift within any single identity', () => {
    expect(verifyCoherentCapture({
      expected: CAPTURE,
      observed: CAPTURE,
    }).coherent).toBe(false);
    expect(verifyCoherentCapture({
      expected: CAPTURE,
      observed: { ...CAPTURE, importCaptureRevision: '0'.repeat(40) },
    }).coherent).toBe(false);
    expect(verifyCoherentCapture({
      expected: CAPTURE,
      observed: { ...CAPTURE, deltaCaptureRevision: '1'.repeat(40) },
    }).coherent).toBe(false);
    expect(verifyCoherentCapture({
      expected: CAPTURE,
      observed: { ...CAPTURE, inventoryRunId: 'other' },
    }).coherent).toBe(false);
    expect(() => requireCoherentCapture({
      expected: CAPTURE,
      observed: { ...CAPTURE, releaseHash: '0'.repeat(64) },
    })).toThrow(/capture drift/u);
  });
});

describe('canonical object membership', () => {
  it('requires equality of projection nodes and knowledge_object entries without fixed count', () => {
    const membership = selectCanonicalObjectMembership({
      projectionNodes: [
        { entityId: 'ctc:a' },
        { entityId: 'ctc:b' },
      ],
      releaseEntries: [
        { entityId: 'ctc:a', entityRole: 'knowledge_object' },
        { entityId: 'ctc:b', entityRole: 'knowledge_object' },
        { entityId: 'ctr:rel-1', entityRole: 'relation' },
        { entityId: 'cte:ev-1', entityRole: 'evidence' },
      ],
    });
    expect(membership.canonicalIds).toEqual(['ctc:a', 'ctc:b']);
    expect(membership.source).toBe('projection-nodes-eq-knowledge-object-entries');

    expect(() => selectCanonicalObjectMembership({
      projectionNodes: [{ entityId: 'ctc:a' }],
      releaseEntries: [
        { entityId: 'ctc:a', entityRole: 'knowledge_object' },
        { entityId: 'ctc:b', entityRole: 'knowledge_object' },
      ],
    })).toThrow(/membership ambiguity/u);

    expect(() => selectCanonicalObjectMembership({
      projectionNodes: [{ entityId: 'ctc:a' }],
      releaseEntries: [{ entityId: 'ctc:a', entityRole: 'relation' }],
    })).toThrow(/knowledge_object entry membership is empty/u);

    // Fixture-only constant is documentation of current v0.3-r2 size — not a gate.
    expect(V03_R2_FIXTURE_OBJECT_COUNT).toBe(744);
  });
});

describe('governance work manifest', () => {
  it('does not schedule object/binding work for relation-type crosswalk signals', () => {
    const manifest = buildGovernanceWorkManifest({
      capture: CAPTURE,
      hasGovernedCoverageBaseline: true,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: ['ctc:a', 'ctc:b'],
      signals: [
        {
          scope: 'crosswalk',
          identity: 'ctr:rel-only\u001fchunk-rel\u001fcite-rel',
          action: 'candidate',
          reason: 'added',
        },
        {
          scope: 'crosswalk',
          identity: 'ctr:rel-gone\u001fchunk-x\u001fcite-x',
          action: 'invalidation',
          reason: 'removed',
        },
        {
          scope: 'crosswalk',
          identity: 'ctc:a\u001fchunk-1\u001fcite-1',
          action: 'candidate',
          reason: 'added',
        },
      ],
    });
    expect(manifest.mode).toBe('incremental');
    // Relation crosswalks stay in crosswalk work only.
    expect(manifest.crosswalks.map((row) => row.publishedEntityId).sort()).toEqual([
      'ctc:a',
      'ctr:rel-gone',
      'ctr:rel-only',
    ]);
    // Only membership Canonical objects appear in objects/resourceBindings.
    expect(manifest.objects.every((row) => (
      row.canonicalId === 'ctc:a' || row.canonicalId === 'ctc:b'
    ))).toBe(true);
    expect(manifest.objects.find((row) => row.canonicalId === 'ctr:rel-only')).toBeUndefined();
    expect(manifest.objects.find((row) => row.canonicalId === 'ctr:rel-gone')).toBeUndefined();
    expect(manifest.objects.find((row) => row.canonicalId === 'ctc:a')?.action).toBe('review');
    expect(
      manifest.resourceBindings.some((row) => row.canonicalId === 'ctr:rel-only'),
    ).toBe(false);
    expect(
      manifest.resourceBindings.some((row) => (
        row.canonicalId === 'ctc:a' && row.action === 'review'
      )),
    ).toBe(true);
  });

  it('schedules exhaustive baseline when no governed coverage exists', () => {
    const manifest = buildGovernanceWorkManifest({
      capture: CAPTURE,
      hasGovernedCoverageBaseline: false,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: ['ctc:a', 'ctc:b'],
      signals: [{ scope: 'object', identity: 'ctc:a', action: 'candidate', reason: 'added' }],
    });
    expect(manifest.mode).toBe('baseline');
    expect(manifest.objects.map((row) => row.canonicalId)).toEqual(['ctc:a', 'ctc:b']);
  });

  it('scopes later deltas to added/changed/removed work and revalidates unchanged', () => {
    const manifest = buildGovernanceWorkManifest({
      capture: CAPTURE,
      hasGovernedCoverageBaseline: true,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: ['ctc:a', 'ctc:b', 'ctc:c'],
      signals: [
        { scope: 'object', identity: 'ctc:a', action: 'candidate', reason: 'added' },
        { scope: 'object', identity: 'ctc:gone', action: 'invalidation', reason: 'removed' },
        { scope: 'object', identity: 'ctc:b', action: 'candidate', reason: 'payload_changed' },
      ],
    });
    expect(manifest.mode).toBe('incremental');
    expect(manifest.objects.find((row) => row.canonicalId === 'ctc:a')?.action).toBe('review');
    expect(manifest.objects.find((row) => row.canonicalId === 'ctc:gone')?.action).toBe('invalidate');
    expect(manifest.objects.find((row) => row.canonicalId === 'ctc:c')?.action).toBe('revalidate');
  });

  it('records packaging no-op without object review', () => {
    const manifest = buildGovernanceWorkManifest({
      capture: CAPTURE,
      hasGovernedCoverageBaseline: true,
      deltaClassification: 'COMPATIBLE_PACKAGING_REVISION',
      currentCanonicalIds: ['ctc:a'],
      signals: [],
    });
    expect(manifest.mode).toBe('packaging_noop');
    expect(manifest.objects).toEqual([]);
  });
});

describe('course coverage baseline and roles', () => {
  it('requires source evidence for active roles, not only exclusions', () => {
    expect(() => buildDispositionFromReview({
      canonicalId: 'ctc:a',
      role: 'formal_objective',
      reviewIdentity: 'issue-1126-test-reviewer',
      evidenceRefs: [],
    })).toThrow(/requires at least one source evidence ref/u);

    expect(() => buildDispositionFromReview({
      canonicalId: 'ctc:a',
      role: 'necessary_prerequisite',
      reviewIdentity: 'issue-1126-test-reviewer',
      evidenceRefs: ['  ', ''],
    })).toThrow(/requires at least one source evidence ref/u);

    const ok = buildDispositionFromReview({
      canonicalId: 'ctc:a',
      role: 'formal_objective',
      reviewIdentity: 'issue-1126-test-reviewer',
      evidenceRefs: ['profile:ctc:a', 'act-course-source:unit-3-1'],
    });
    expect(ok.evidenceRefs).toEqual(['act-course-source:unit-3-1', 'profile:ctc:a']);
  });

  it('rejects candidate-generator / unreviewed identities even if re-hashed', () => {
    const entries = [
      buildDispositionFromReview({
        canonicalId: 'ctc:a',
        role: 'formal_objective',
        reviewIdentity: 'candidate-generator:unreviewed-heuristic-v1',
        evidenceRefs: ['profile:ctc:a'],
        allowCandidateIdentity: true,
      }),
    ];
    const withoutHash = {
      schemaVersion: 'act-course-coverage-overlay/v2' as const,
      overlayId: 'automatic-control-aggregate-coverage-v1' as const,
      overlayVersion: '1',
      courseId: 'automatic-control' as const,
      releaseSetId: CAPTURE.releaseSetId,
      releaseId: CAPTURE.releaseId,
      releaseHash: CAPTURE.releaseHash,
      sourceDatasetHash: CAPTURE.sourceDatasetHash,
      deltaReceiptId: CAPTURE.deltaReceiptId,
      mode: 'baseline' as const,
      authoringRevision: CAPTURE.authoringRevision!,
      entries,
    };
    const overlay = {
      ...withoutHash,
      sourceHash: computeCoverageSourceHash(withoutHash),
    };
    expect(() => validateCourseCoverageAuthoring(overlay, {
      currentCanonicalIds: ['ctc:a'],
      releaseSetId: CAPTURE.releaseSetId,
      releaseId: CAPTURE.releaseId,
      releaseHash: CAPTURE.releaseHash,
      mode: 'baseline',
    })).toThrow(/non-production review identity/u);

    const unbound = {
      ...authoring([disposition('ctc:a')]),
      deltaReceiptId: 'UNBOUND_CANDIDATE_REQUIRES_REVIEW_ACTIVATION',
    };
    const unboundHashed = {
      ...unbound,
      sourceHash: computeCoverageSourceHash(unbound),
    };
    expect(() => validateCourseCoverageAuthoring(unboundHashed, {
      currentCanonicalIds: ['ctc:a'],
      releaseSetId: CAPTURE.releaseSetId,
      releaseId: CAPTURE.releaseId,
      releaseHash: CAPTURE.releaseHash,
      mode: 'baseline',
    })).toThrow(/unbound\/candidate marker/u);
  });

  it('requires exhaustive unique dispositions, exclusion evidence, and non-null deltaReceiptId', () => {
    const entries = [
      disposition('ctc:a', 'formal_objective'),
      disposition('ctc:b', 'excluded_with_rationale'),
    ];
    const overlay = authoring(entries);
    const validated = validateCourseCoverageAuthoring(overlay, {
      currentCanonicalIds: ['ctc:a', 'ctc:b'],
      releaseSetId: CAPTURE.releaseSetId,
      releaseId: CAPTURE.releaseId,
      releaseHash: CAPTURE.releaseHash,
      sourceDatasetHash: CAPTURE.sourceDatasetHash,
      mode: 'baseline',
    });
    expect(validated.entries).toHaveLength(2);
    expect(courseRoleCreatesTeachingProjectionEdge('necessary_prerequisite')).toBe(false);

    const withoutDelta = {
      ...overlay,
      deltaReceiptId: null as unknown as string,
      sourceHash: '',
    };
    const { sourceHash: _s, ...rest } = withoutDelta;
    const broken = {
      ...rest,
      deltaReceiptId: null,
      sourceHash: computeCoverageSourceHash({
        ...rest,
        deltaReceiptId: null as unknown as string,
      }),
    };
    expect(() => validateCourseCoverageAuthoring(broken, {
      currentCanonicalIds: ['ctc:a', 'ctc:b'],
      releaseSetId: CAPTURE.releaseSetId,
      releaseId: CAPTURE.releaseId,
      releaseHash: CAPTURE.releaseHash,
      mode: 'baseline',
    })).toThrow(/deltaReceiptId is required/u);
  });

  it('merges incremental patch and invalidations without full recomputation of unchanged rows', () => {
    const current = [
      disposition('ctc:a', 'formal_objective'),
      disposition('ctc:b', 'necessary_prerequisite'),
      disposition('ctc:c', 'excluded_with_rationale'),
    ];
    const merged = mergeIncrementalCoverage({
      current,
      patch: [disposition('ctc:a', 'explicit_extension')],
      invalidateCanonicalIds: ['ctc:c'],
      currentCanonicalIds: ['ctc:a', 'ctc:b'],
    });
    expect(merged.map((row) => `${row.canonicalId}:${row.role}`)).toEqual([
      'ctc:a:explicit_extension',
      'ctc:b:necessary_prerequisite',
    ]);
  });
});

describe('opaque upstream and ACT crosswalk alignment', () => {
  it('keeps upstream triples opaque', () => {
    expect(referenceOpaqueUpstream({
      publishedEntityId: 'ctc:a',
      retrievalChunkId: 'chunk-1',
      citationTargetId: 'cite-1',
    })).toEqual({
      publishedEntityId: 'ctc:a',
      retrievalChunkId: 'chunk-1',
      citationTargetId: 'cite-1',
    });
  });

  it('deterministically aligns only with complete inventory/resource tuple', () => {
    const ok = attemptDeterministicAlignment({
      upstream: {
        publishedEntityId: 'ctc:a',
        retrievalChunkId: 'chunk-1',
        citationTargetId: 'cite-1',
      },
      canonicalId: 'ctc:a',
      capture: CAPTURE,
      index: [UNIT],
      stableIds: ['stable:root-locus'],
    });
    expect(ok.validationState).toBe('VALIDATED');
    expect(ok.atomicResourceId).toBe('atomic-1');

    const incomplete = attemptDeterministicAlignment({
      upstream: {
        publishedEntityId: 'ctc:a',
        retrievalChunkId: 'chunk-1',
        citationTargetId: 'cite-1',
      },
      canonicalId: 'ctc:a',
      capture: CAPTURE,
      index: [{
        ...UNIT,
        atomicResourceId: null,
        resourceId: null,
        segmentId: null,
        resourceSegmentHash: null,
      }],
      stableIds: ['stable:root-locus'],
    });
    expect(incomplete.validationState).toBe('UNRESOLVED');
  });

  it('requires isolated semantic review and inventory atomic before publishing', () => {
    const candidates = generateSemanticAlignmentCandidates({
      upstream: {
        publishedEntityId: 'ctc:a',
        retrievalChunkId: 'chunk-1',
        citationTargetId: 'cite-1',
      },
      canonicalId: 'ctc:a',
      canonicalProfileDigest: 'p'.repeat(64),
      index: [UNIT],
      generatorPromptVersion: 'v1',
    });
    const accepted = acceptSemanticAlignment({
      candidate: candidates[0]!,
      review: {
        outcome: 'ACCEPT',
        reviewIdentity: 'isolated-reviewer',
        reviewerPromptVersion: 'rev-v1',
        evidenceDigest: '4'.repeat(64),
        rationale: 'unique structural match',
      },
      capture: CAPTURE,
      inventoryAtomic: {
        atomicResourceId: 'atomic-1',
        resourceId: 'resource-1',
        segmentId: 'seg-1',
        resourceSegmentHash: '2'.repeat(64),
      },
    });
    expect(accepted.validationState).toBe('VALIDATED');

    expect(acceptSemanticAlignment({
      candidate: candidates[0]!,
      review: {
        outcome: 'AMBIGUOUS',
        reviewIdentity: 'isolated-reviewer',
        reviewerPromptVersion: 'rev-v1',
        evidenceDigest: '4'.repeat(64),
        rationale: 'two units plausible',
      },
      capture: CAPTURE,
    }).validationState).toBe('UNRESOLVED');
  });

  it('does not generate semantic candidates against an empty structural index', () => {
    expect(generateSemanticAlignmentCandidates({
      upstream: {
        publishedEntityId: 'ctc:a',
        retrievalChunkId: 'chunk-1',
        citationTargetId: 'cite-1',
      },
      canonicalId: 'ctc:a',
      canonicalProfileDigest: 'p'.repeat(64),
      index: [],
      generatorPromptVersion: 'v1',
    })).toEqual([]);
  });

  it('invalidates only affected crosswalks', () => {
    const current = [
      attemptDeterministicAlignment({
        upstream: {
          publishedEntityId: 'ctc:a',
          retrievalChunkId: 'chunk-1',
          citationTargetId: 'cite-1',
        },
        canonicalId: 'ctc:a',
        capture: CAPTURE,
        index: [UNIT],
        stableIds: ['stable:root-locus'],
      }),
      attemptDeterministicAlignment({
        upstream: {
          publishedEntityId: 'ctc:b',
          retrievalChunkId: 'chunk-2',
          citationTargetId: 'cite-2',
        },
        canonicalId: 'ctc:b',
        capture: CAPTURE,
        index: [{
          ...UNIT,
          structuralUnitId: 'unit-2',
          stableIds: ['stable:b'],
        }],
        stableIds: ['stable:b'],
      }),
    ];
    const { retained, invalidated } = invalidateCrosswalks({
      current,
      removedObjectIds: ['ctc:a'],
    });
    expect(invalidated.map((r) => r.canonicalId)).toEqual(['ctc:a']);
    expect(retained.map((r) => r.canonicalId)).toEqual(['ctc:b']);
  });

  it('rejects publication when capture gates fail', () => {
    const row = attemptDeterministicAlignment({
      upstream: {
        publishedEntityId: 'ctc:a',
        retrievalChunkId: 'chunk-1',
        citationTargetId: 'cite-1',
      },
      canonicalId: 'ctc:a',
      capture: CAPTURE,
      index: [UNIT],
      stableIds: ['stable:root-locus'],
    });
    expect(validateCrosswalkForShadowPublication({
      crosswalk: row,
      capture: CAPTURE,
      existingCurrent: [row],
    }).ok).toBe(true);
    expect(validateCrosswalkForShadowPublication({
      crosswalk: { ...row, captureRevision: '0'.repeat(40) },
      capture: CAPTURE,
      existingCurrent: [],
    }).ok).toBe(false);
  });
});

describe('schema migration composite identity constraints', () => {
  it('documents composite Delta+Release and coverage FKs in the #1126 migration SQL', async () => {
    const { readFile } = await import('node:fs/promises');
    const sql = await readFile(
      'prisma/migrations/20260730010000_govern_aggregate_course_coverage_and_resource_bindings/migration.sql',
      'utf8',
    );
    expect(sql).toContain('ActkgReleaseSetDeltaReceipt_id_candidate_release_key');
    expect(sql).toContain('AggregateCourseCoverageVersion_delta_release_fkey');
    expect(sql).toContain('ActGovernedStructuralUnitCrosswalk_delta_release_fkey');
    expect(sql).toContain('AggregateGovernanceReceipt_delta_release_fkey');
    expect(sql).toContain('AggregateRevalidationReceipt_delta_release_fkey');
    expect(sql).toContain('AggregateRevalidationReceipt_release_fkey');
    expect(sql).toContain('AggregateGovernanceReceipt_coverage_release_fkey');
    expect(sql).toContain('AggregateCourseCoverageEntry_evidence_check');
    expect(sql).toMatch(/jsonb_array_length\("evidenceRefs"\) > 0/u);
    expect(sql).toMatch(/reviewIdentity[\s\S]*!~\* 'unbound'/u);
    // Canonical membership FKs target public Projection nodes, not private objects.
    expect(sql).toContain('ActkgProjectionNode_releaseId_entityId_key');
    expect(sql).toMatch(
      /AggregateCourseCoverageEntry_canonical_fkey[\s\S]*REFERENCES "ActkgProjectionNode"/u,
    );
    expect(sql).toMatch(
      /ActGovernedStructuralUnitCrosswalk_canonical_fkey[\s\S]*REFERENCES "ActkgProjectionNode"/u,
    );
    expect(sql).not.toMatch(
      /AggregateCourseCoverageEntry_canonical_fkey[\s\S]*REFERENCES "ActkgAuthoritativeObject"/u,
    );
  });
});

describe('upstream relation vs canonical classification', () => {
  it('classifies 744-style object ids vs 130-style relation ids without inventing membership', () => {
    const membership = Array.from({ length: 5 }, (_, i) => `ctc:obj-${i}`);
    const upstream = [
      ...membership.map((id, i) => ({
        publishedEntityId: id,
        retrievalChunkId: `chunk-obj-${i}`,
        citationTargetId: `cite-obj-${i}`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        publishedEntityId: `ctr:rel-${i}`,
        retrievalChunkId: `chunk-rel-${i}`,
        citationTargetId: `cite-rel-${i}`,
      })),
    ];
    const classified = classifyUpstreamReferences(upstream, membership);
    const parts = partitionUpstreamByKind(classified);
    expect(parts.canonicalObject).toHaveLength(5);
    expect(parts.relationOrOther).toHaveLength(3);
    expect(parts.relationOrOther.every((row) => row.canonicalId === null)).toBe(true);
    expect(parts.canonicalObject.every((row) => row.canonicalId === row.publishedEntityId)).toBe(true);

    // Relation id must not pass membership gate.
    expect(() => {
      // Simulate coverage disposition for a relation id — membership validation rejects it.
      validateCourseCoverageAuthoring(
        authoring([disposition('ctr:rel-0')]),
        {
          currentCanonicalIds: membership,
          releaseSetId: CAPTURE.releaseSetId,
          releaseId: CAPTURE.releaseId,
          releaseHash: CAPTURE.releaseHash,
          mode: 'baseline',
        },
      );
    }).toThrow(/missing dispositions|missing object|references missing/u);
  });
});

describe('structural and resource reverse index', () => {
  it('builds versioned index entries from #1124 inventory items', () => {
    const inventory: ResourceBindingInventory = {
      schemaVersion: 'canonical-resource-binding-inventory/v1',
      runId: 'inv-1',
      captureRevision: GOV,
      capturedAt: new Date().toISOString(),
      dbWatermark: '0/1',
      sourceHash: '1'.repeat(64),
      complete: true,
      cutoverReady: false,
      authorityState: 'SHADOW',
      summary: { itemCount: 1, includedCount: 1, excludedCount: 0, unresolvedCount: 0 },
      items: [{
        atomicResourceId: 'atomic-1',
        resourceId: 'resource-1',
        structuralUnitId: 'unit-1',
        segmentId: 'seg-1',
        resourceSegmentHash: '2'.repeat(64),
        disposition: 'INCLUDED',
        reasonCodes: ['positive:published'],
        sourceObservations: [],
        observationDigest: '3'.repeat(64),
      }],
    };
    const index = buildStructuralUnitIndexFromInventory({ inventory });
    expect(index.entries).toHaveLength(1);
    expect(index.version).toMatch(/^struct-index:/u);
  });

  it('populates candidateCanonicalIds only from validated Crosswalk endpoints', () => {
    const index = buildResourceIndexFromValidatedCrosswalks({
      inventoryItems: [
        {
          resourceId: 'resource-1',
          structuralUnitId: 'unit-1',
          segmentId: 'seg-1',
          resourceSegmentHash: '2'.repeat(64),
        },
        {
          resourceId: 'resource-2',
          structuralUnitId: 'unit-2',
          segmentId: 'seg-2',
          resourceSegmentHash: '3'.repeat(64),
        },
      ],
      validatedCrosswalks: [{
        resourceId: 'resource-1',
        structuralUnitId: 'unit-1',
        segmentId: 'seg-1',
        canonicalId: 'ctc:a',
        validationState: 'VALIDATED',
        lifecycleState: 'CURRENT',
      }],
    });
    expect(index.find((r) => r.resourceId === 'resource-1')?.candidateCanonicalIds).toEqual(['ctc:a']);
    expect(index.find((r) => r.resourceId === 'resource-2')?.candidateCanonicalIds).toEqual([]);
  });
});

describe('revalidation and resource binding reuse', () => {
  it('creates revalidation without copying prior publication identity', () => {
    const receipt = evaluateSemanticRevalidation({
      prior: {
        kind: 'binding',
        identityKey: 'pair-1',
        releaseSetId: 'old-rs',
        releaseId: 'old-rel',
        canonicalDigest: '1'.repeat(64),
        resourceSegmentHash: '2'.repeat(64),
        role: 'EXPLAINS',
        promptReviewerVersion: 'g|r',
        evidenceDigest: '3'.repeat(64),
        structuralGateDigest: '4'.repeat(64),
        publicationIdentity: 'old-publication-id',
        lifecycleState: 'CURRENT',
      },
      current: {
        canonicalDigest: '1'.repeat(64),
        resourceSegmentHash: '2'.repeat(64),
        role: 'EXPLAINS',
        promptReviewerVersion: 'g|r',
        evidenceDigest: '3'.repeat(64),
        structuralGateDigest: '4'.repeat(64),
      },
      newReleaseSetId: CAPTURE.releaseSetId,
      newReleaseId: CAPTURE.releaseId,
      newDeltaReceiptId: CAPTURE.deltaReceiptId,
      captureRevision: CAPTURE.captureRevision,
      kind: 'binding',
    });
    expect(receipt.outcome).toBe('REVALIDATED');
    expect(receipt.id).not.toBe('old-publication-id');
    expect(receiptsDoNotCopyPublicationIdentity([receipt])).toBe(true);
  });

  it('packaging no-op requires prior publication identity and does not copy it', () => {
    expect(() => packagingNoopRevalidation({
      priorPublicationIdentity: CAPTURE.deltaReceiptId,
      newReleaseSetId: CAPTURE.releaseSetId,
      newReleaseId: CAPTURE.releaseId,
      newDeltaReceiptId: CAPTURE.deltaReceiptId,
      captureRevision: CAPTURE.captureRevision,
    })).toThrow(/prior coverage\/Crosswalk\/binding publication/u);

    const receipt = packagingNoopRevalidation({
      priorPublicationIdentity: 'prior-coverage-version-id',
      newReleaseSetId: CAPTURE.releaseSetId,
      newReleaseId: CAPTURE.releaseId,
      newDeltaReceiptId: CAPTURE.deltaReceiptId,
      captureRevision: CAPTURE.captureRevision,
    });
    expect(receipt.outcome).toBe('NO_OP_PACKAGING');
    expect(receipt.id).not.toBe('prior-coverage-version-id');
  });

  it('keeps formal selectors on Legacy', () => {
    expect(assertFormalSelectorsRemainLegacy({
      selectAuthority: selectResourceKnowledgeAuthority,
    })).toBe(true);
  });

  it('invalidates only resource-changed pairs', () => {
    const previous = [{
      id: 'decision-1',
      pairId: 'pair-1',
      releaseSetId: CAPTURE.releaseSetId,
      releaseId: CAPTURE.releaseId,
      canonicalId: 'ctc:a',
      objectRevision: 'rev-1',
      resourceId: 'resource-1',
      structuralUnitId: 'unit-1',
      segmentId: 'seg-1',
      resourceSegmentHash: 'old-hash',
      role: 'EXPLAINS' as const,
      evidenceId: null,
      evidenceDigest: 'e'.repeat(64),
      generatorPromptVersion: 'g1',
      reviewerPromptVersion: 'r1',
      generatorCacheKey: 'gc',
      reviewerCacheKey: 'rc',
      reviewerRole: 'INDEPENDENT_REVIEWER' as const,
      reviewerInputDigest: 'ri',
      candidateDigest: 'cd',
      reviewProvider: 'GPT' as const,
      reviewState: 'ACCEPTED' as const,
      publicationState: 'SHADOW_PUBLISHED' as const,
      highImpactPolicyVersion: 'binding-impact/v1' as const,
      highImpactReasons: [],
      attemptSequence: 1,
      lifecycleState: 'CURRENT' as const,
      supersedesDecisionId: null,
      crosswalkId: null,
      inventoryRunId: 'inv-1',
      captureRevision: CAPTURE.captureRevision,
      structuralUnitVersion: CAPTURE.captureRevision,
      validationDigest: 'v'.repeat(64),
      trigger: 'CANONICAL_CHANGE' as const,
      proposedRole: 'EXPLAINS' as const,
      evidenceIds: [],
    }, {
      id: 'decision-2',
      pairId: 'pair-2',
      releaseSetId: CAPTURE.releaseSetId,
      releaseId: CAPTURE.releaseId,
      canonicalId: 'ctc:b',
      objectRevision: 'rev-1',
      resourceId: 'resource-2',
      structuralUnitId: 'unit-2',
      segmentId: 'seg-2',
      resourceSegmentHash: 'keep-hash',
      role: 'PRACTICES' as const,
      evidenceId: null,
      evidenceDigest: 'e'.repeat(64),
      generatorPromptVersion: 'g1',
      reviewerPromptVersion: 'r1',
      generatorCacheKey: 'gc2',
      reviewerCacheKey: 'rc2',
      reviewerRole: 'INDEPENDENT_REVIEWER' as const,
      reviewerInputDigest: 'ri2',
      candidateDigest: 'cd2',
      reviewProvider: 'GPT' as const,
      reviewState: 'ACCEPTED' as const,
      publicationState: 'SHADOW_PUBLISHED' as const,
      highImpactPolicyVersion: 'binding-impact/v1' as const,
      highImpactReasons: [],
      attemptSequence: 1,
      lifecycleState: 'CURRENT' as const,
      supersedesDecisionId: null,
      crosswalkId: null,
      inventoryRunId: 'inv-1',
      captureRevision: CAPTURE.captureRevision,
      structuralUnitVersion: CAPTURE.captureRevision,
      validationDigest: 'v'.repeat(64),
      trigger: 'RESOURCE_CHANGE' as const,
      proposedRole: 'PRACTICES' as const,
      evidenceIds: [],
    }];

    const result = governResourceBindings({
      capture: CAPTURE,
      work: [{
        pairKey: 'resource-1\u001funit-1\u001fseg-1\u001fnew',
        canonicalId: null,
        resourceId: 'resource-1',
        structuralUnitId: 'unit-1',
        segmentId: 'seg-1',
        action: 'invalidate',
        reasons: ['resource-segment-hash-changed'],
      }],
      previousDecisions: previous,
      canonicalIndex: [],
      resourceIndex: [],
      generatorPromptVersion: 'g1',
    });
    expect(result.invalidated.map((row) => row.id)).toEqual(['decision-1']);
    expect(result.reusable.map((row) => row.id)).toEqual(['decision-2']);
  });
});

describe('end-to-end pure pipeline', () => {
  it('same-run validated crosswalk seeds binding candidates; unresolved does not', () => {
    const coverage = authoring([
      disposition('ctc:a', 'formal_objective'),
    ]);
    const capture = {
      ...CAPTURE,
      coverageSourceHash: coverage.sourceHash,
      authoringRevision: coverage.authoringRevision,
    };
    const segment = {
      resourceId: 'resource-1',
      structuralUnitId: 'unit-root-locus-1',
      segmentId: 'seg-1',
      resourceSegmentHash: '2'.repeat(64),
      candidateCanonicalIds: [] as string[],
      deterministicRole: null as null,
      evidenceIds: [] as string[],
    };
    const withValidated = runAggregateGovernance({
      capture,
      observedCapture: observedOf(capture),
      hasGovernedCoverageBaseline: false,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: ['ctc:a'],
      signals: [],
      upstreamReferences: [{
        publishedEntityId: 'ctc:a',
        retrievalChunkId: 'chunk-1',
        citationTargetId: 'cite-1',
      }],
      structuralUnitIndex: [UNIT],
      alignmentHints: {
        [`ctc:a\u001fchunk-1\u001fcite-1`]: { stableIds: ['stable:root-locus'] },
      },
      coverageAuthoring: coverage,
      resourceIndex: [segment],
      canonicalIndex: [{
        releaseSetId: CAPTURE.releaseSetId,
        releaseId: CAPTURE.releaseId,
        canonicalId: 'ctc:a',
        objectRevision: 'rev-1',
        canonicalType: 'DomainConcept',
      }],
    });
    expect(withValidated.publishedCrosswalks).toHaveLength(1);
    expect(withValidated.publishedCrosswalks[0]?.canonicalId).toBe('ctc:a');
    expect(withValidated.binding?.candidatesGenerated).toBeGreaterThan(0);

    const relationOnly = runAggregateGovernance({
      capture,
      observedCapture: observedOf(capture),
      hasGovernedCoverageBaseline: false,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: ['ctc:a'],
      signals: [],
      upstreamReferences: [{
        publishedEntityId: 'ctr:rel-only',
        retrievalChunkId: 'chunk-rel',
        citationTargetId: 'cite-rel',
      }],
      structuralUnitIndex: [UNIT],
      alignmentHints: {
        [`ctr:rel-only\u001fchunk-rel\u001fcite-rel`]: { stableIds: ['stable:root-locus'] },
      },
      coverageAuthoring: coverage,
      resourceIndex: [segment],
      canonicalIndex: [{
        releaseSetId: CAPTURE.releaseSetId,
        releaseId: CAPTURE.releaseId,
        canonicalId: 'ctc:a',
        objectRevision: 'rev-1',
        canonicalType: 'DomainConcept',
      }],
    });
    expect(relationOnly.publishedCrosswalks).toHaveLength(0);
    expect(relationOnly.unresolvedCrosswalkDiagnostics.some((row) => (
      row.publishedEntityId === 'ctr:rel-only' && row.canonicalId === null
    ))).toBe(true);
    // Relation upstream must not fabricate Canonical binding candidates.
    expect(relationOnly.binding?.candidatesGenerated ?? 0).toBe(0);
  });

  it('runs exhaustive baseline and packaging no-op paths', () => {
    const ids = ['ctc:a', 'ctc:b'];
    const coverage = authoring([
      disposition('ctc:a', 'formal_objective'),
      disposition('ctc:b', 'excluded_with_rationale'),
    ]);
    const upstream = [{
      publishedEntityId: 'ctc:a',
      retrievalChunkId: 'chunk-1',
      citationTargetId: 'cite-1',
    }];
    const capture = {
      ...CAPTURE,
      coverageSourceHash: coverage.sourceHash,
      authoringRevision: coverage.authoringRevision,
    };
    const baseline = runAggregateGovernance({
      capture,
      observedCapture: observedOf(capture),
      hasGovernedCoverageBaseline: false,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: ids,
      signals: [],
      upstreamReferences: upstream,
      structuralUnitIndex: [UNIT],
      alignmentHints: {
        [`ctc:a\u001fchunk-1\u001fcite-1`]: { stableIds: ['stable:root-locus'] },
      },
      coverageAuthoring: coverage,
    });
    expect(baseline.manifest.mode).toBe('baseline');
    expect(baseline.coverageEntries).toHaveLength(2);
    expect(baseline.publishedCrosswalks.some((row) => row.validationState === 'VALIDATED')).toBe(true);
    expect(baseline.teachingProjectionEdgesCreated).toBe(false);
    expect(baseline.selectorsLegacy).toBe(true);

    const packaging = runAggregateGovernance({
      capture,
      observedCapture: observedOf(capture),
      hasGovernedCoverageBaseline: true,
      deltaClassification: 'COMPATIBLE_PACKAGING_REVISION',
      currentCanonicalIds: ids,
      signals: [],
      upstreamReferences: upstream,
      structuralUnitIndex: [UNIT],
      coverageAuthoring: null,
      currentCoverageEntries: baseline.coverageEntries,
      previousCrosswalks: baseline.crosswalks,
      priorSemanticPublicationIdentity: baseline.coverageVersionId ?? baseline.receipt.id,
    });
    expect(packaging.manifest.packagingNoop).toBe(true);
    expect(packaging.revalidationReceipts[0]?.outcome).toBe('NO_OP_PACKAGING');
  });

  it('fails closed on capture drift before semantic work', () => {
    const coverage = authoring([disposition('ctc:a')]);
    const capture = {
      ...CAPTURE,
      coverageSourceHash: coverage.sourceHash,
      authoringRevision: coverage.authoringRevision,
    };
    expect(() => runAggregateGovernance({
      capture,
      observedCapture: { ...capture, importCaptureRevision: '9'.repeat(40) },
      hasGovernedCoverageBaseline: false,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: ['ctc:a'],
      signals: [],
      upstreamReferences: [],
      structuralUnitIndex: [],
      coverageAuthoring: coverage,
    })).toThrow(/capture drift/u);
  });

  it('schedules only affected work on synthetic later deltas', () => {
    const baselineEntries = [
      disposition('ctc:a', 'formal_objective'),
      disposition('ctc:b', 'necessary_prerequisite'),
      disposition('ctc:c', 'excluded_with_rationale'),
    ];
    const patch = authoring([
      disposition('ctc:d', 'formal_objective'),
    ], 'incremental');
    const capture = {
      ...CAPTURE,
      coverageSourceHash: patch.sourceHash,
      authoringRevision: patch.authoringRevision,
    };
    const result = runAggregateGovernance({
      capture,
      observedCapture: observedOf(capture),
      hasGovernedCoverageBaseline: true,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: ['ctc:a', 'ctc:b', 'ctc:d'],
      signals: [
        { scope: 'object', identity: 'ctc:d', action: 'candidate', reason: 'added' },
        { scope: 'object', identity: 'ctc:c', action: 'invalidation', reason: 'removed' },
      ],
      upstreamReferences: [],
      structuralUnitIndex: [],
      coverageAuthoring: patch,
      currentCoverageEntries: baselineEntries,
    });
    expect(result.manifest.mode).toBe('incremental');
    expect(result.manifest.objects.find((row) => row.canonicalId === 'ctc:d')?.action).toBe('review');
    expect(result.manifest.objects.find((row) => row.canonicalId === 'ctc:c')?.action).toBe('invalidate');
  });
});

describe('readiness diagnostics and summary safety', () => {
  it('blocks teaching projection/path/facts/cutover and omits local paths', () => {
    const readiness = buildDownstreamReadinessDiagnostics({
      capture: CAPTURE,
      coverageEntries: [disposition('ctc:a')],
      crosswalks: [],
      unresolvedUpstreamCount: 3,
      shadowPublishedBindingCount: 0,
    });
    expect(readiness.kaq.ready).toBe(true);
    expect(readiness.rag.ready).toBe(false);
    expect(readiness.teachingProjection.blocked).toBe(true);
    const summary = buildAggregateGovernanceSummary({
      mode: 'baseline',
      captureRevision: CAPTURE.captureRevision,
      releaseSetId: CAPTURE.releaseSetId,
      releaseId: CAPTURE.releaseId,
      deltaReceiptId: CAPTURE.deltaReceiptId,
      coverageEntries: [disposition('ctc:a')],
      crosswalks: [],
      bindings: {
        revalidated: 0,
        invalidated: 0,
        reviewed: 0,
        shadowPublished: 0,
      },
      revalidationReceipts: [packagingNoopRevalidation({
        priorPublicationIdentity: 'prior-publication',
        newReleaseSetId: CAPTURE.releaseSetId,
        newReleaseId: CAPTURE.releaseId,
        newDeltaReceiptId: CAPTURE.deltaReceiptId,
        captureRevision: CAPTURE.captureRevision,
      })],
      packagingNoop: false,
      readiness,
    });
    expect(summary.protectedContentIncluded).toBe(false);
    expect(summary.localPathsIncluded).toBe(false);
    expect(sha256Canonical(summary)).toMatch(/^[a-f0-9]{64}$/u);
  });
});

describe('baseline crosswalk expansion', () => {
  it('expands baseline crosswalk work without claiming empty-index success', () => {
    const base = buildGovernanceWorkManifest({
      capture: CAPTURE,
      hasGovernedCoverageBaseline: false,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: ['ctc:a'],
      signals: [],
    });
    const expanded = expandBaselineCrosswalkWork(base, [{
      publishedEntityId: 'ctc:a',
      retrievalChunkId: 'chunk-1',
      citationTargetId: 'cite-1',
    }]);
    expect(expanded.crosswalks).toHaveLength(1);
  });
});

describe('aggregate governance repository persistence integrity', () => {
  function createMemoryDb() {
    const store = {
      receipts: new Map<string, Record<string, unknown>>(),
      versions: new Map<string, Record<string, unknown> & { entries: Record<string, unknown>[] }>(),
      crosswalks: new Map<string, Record<string, unknown>>(),
      revalidations: new Map<string, Record<string, unknown>>(),
    };

    function matchWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
      for (const [key, value] of Object.entries(where)) {
        if (key === 'NOT' && value && typeof value === 'object') {
          const not = value as Record<string, unknown>;
          for (const [nk, nv] of Object.entries(not)) {
            if (row[nk] === nv) return false;
          }
          continue;
        }
        if (row[key] !== value) return false;
      }
      return true;
    }

    function tableDelegate(
      table: 'receipts' | 'versions' | 'crosswalks' | 'revalidations',
    ) {
      return {
        async create(args: { data: Record<string, unknown> }) {
          const data = { ...args.data };
          if (table === 'versions') {
            store.versions.set(String(data.id), {
              ...data,
              entries: [],
            });
          } else if (table === 'crosswalks') {
            store.crosswalks.set(String(data.id), data);
          } else if (table === 'revalidations') {
            store.revalidations.set(String(data.id), data);
          } else {
            store.receipts.set(String(data.id), data);
          }
          return data;
        },
        async createMany(args: { data: Record<string, unknown>[] }) {
          for (const row of args.data) {
            await this.create({ data: row });
          }
          return { count: args.data.length };
        },
        async findUnique(args: { where: Record<string, unknown>; include?: { entries?: unknown } }) {
          const id = String(args.where.id);
          if (table === 'versions') {
            const row = store.versions.get(id) ?? null;
            if (!row) return null;
            if (args.include?.entries) return { ...row, entries: [...row.entries] };
            return { ...row };
          }
          if (table === 'crosswalks') return store.crosswalks.get(id) ? { ...store.crosswalks.get(id)! } : null;
          if (table === 'revalidations') {
            return store.revalidations.get(id) ? { ...store.revalidations.get(id)! } : null;
          }
          return store.receipts.get(id) ? { ...store.receipts.get(id)! } : null;
        },
        async findFirst(args: { where: Record<string, unknown> }) {
          const rows = table === 'crosswalks'
            ? [...store.crosswalks.values()]
            : table === 'versions'
              ? [...store.versions.values()]
              : table === 'revalidations'
                ? [...store.revalidations.values()]
                : [...store.receipts.values()];
          return rows.find((row) => matchWhere(row, args.where)) ?? null;
        },
        async findMany(args: { where: Record<string, unknown>; orderBy?: unknown }) {
          const rows = table === 'crosswalks'
            ? [...store.crosswalks.values()]
            : table === 'versions'
              ? [...store.versions.values()]
              : table === 'revalidations'
                ? [...store.revalidations.values()]
                : [...store.receipts.values()];
          return rows.filter((row) => matchWhere(row, args.where));
        },
        async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
          let count = 0;
          if (table === 'versions') {
            for (const [id, row] of store.versions) {
              if (matchWhere(row, args.where)) {
                store.versions.set(id, { ...row, ...args.data });
                count += 1;
              }
            }
          } else if (table === 'crosswalks') {
            for (const [id, row] of store.crosswalks) {
              if (matchWhere(row, args.where)) {
                store.crosswalks.set(id, { ...row, ...args.data });
                count += 1;
              }
            }
          }
          return { count };
        },
      };
    }

    const entryDelegate = {
      async create(args: { data: Record<string, unknown> }) {
        const versionId = String(args.data.versionId);
        const version = store.versions.get(versionId);
        if (!version) throw new Error(`missing version ${versionId}`);
        version.entries.push({ ...args.data });
        return args.data;
      },
      async createMany(args: { data: Record<string, unknown>[] }) {
        for (const row of args.data) await this.create({ data: row });
        return { count: args.data.length };
      },
    };

    const tx: AggregateGovernanceTransaction = {
      aggregateGovernanceReceipt: tableDelegate('receipts'),
      aggregateCourseCoverageVersion: tableDelegate('versions'),
      aggregateCourseCoverageEntry: entryDelegate,
      actGovernedStructuralUnitCrosswalk: tableDelegate('crosswalks'),
      aggregateRevalidationReceipt: tableDelegate('revalidations'),
    };

    const db: AggregateGovernanceDatabase = {
      async $transaction(callback) {
        return callback(tx);
      },
      aggregateCourseCoverageVersion: tx.aggregateCourseCoverageVersion,
      actGovernedStructuralUnitCrosswalk: tx.actGovernedStructuralUnitCrosswalk,
      aggregateGovernanceReceipt: tx.aggregateGovernanceReceipt,
    };

    return { db, store, tx };
  }

  function sampleRun(overrides: Partial<AggregateGovernanceRunResult> = {}): AggregateGovernanceRunResult {
    const coverage = authoring([
      disposition('ctc:a', 'formal_objective'),
      disposition('ctc:b', 'excluded_with_rationale'),
    ]);
    const capture = {
      ...CAPTURE,
      coverageSourceHash: coverage.sourceHash,
      authoringRevision: coverage.authoringRevision,
    };
    const base = runAggregateGovernance({
      capture,
      observedCapture: observedOf(capture),
      hasGovernedCoverageBaseline: false,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: ['ctc:a', 'ctc:b'],
      signals: [],
      upstreamReferences: [
        {
          publishedEntityId: 'ctc:a',
          retrievalChunkId: 'chunk-1',
          citationTargetId: 'cite-1',
        },
        {
          publishedEntityId: 'ctr:rel-only',
          retrievalChunkId: 'chunk-rel',
          citationTargetId: 'cite-rel',
        },
      ],
      structuralUnitIndex: [UNIT],
      alignmentHints: {
        [`ctc:a\u001fchunk-1\u001fcite-1`]: { stableIds: ['stable:root-locus'] },
      },
      coverageAuthoring: coverage,
    });
    return {
      ...base,
      ...overrides,
      receipt: {
        ...base.receipt,
        ...(overrides.receipt ?? {}),
        capture: {
          ...base.receipt.capture,
          ...(overrides.receipt?.capture ?? {}),
        },
        summary: overrides.receipt?.summary ?? base.receipt.summary,
      },
      coverageEntries: overrides.coverageEntries ?? base.coverageEntries,
      crosswalks: overrides.crosswalks ?? base.crosswalks,
      publishedCrosswalks: overrides.publishedCrosswalks ?? base.publishedCrosswalks,
      unresolvedCrosswalkDiagnostics:
        overrides.unresolvedCrosswalkDiagnostics ?? base.unresolvedCrosswalkDiagnostics,
      revalidationReceipts: overrides.revalidationReceipts ?? base.revalidationReceipts,
    };
  }

  it('persists unresolved diagnostics and reads them back without counting as published', async () => {
    const { db, store } = createMemoryDb();
    const repo = new AggregateGovernanceRepository(db);
    const run = sampleRun();
    expect(run.publishedCrosswalks.length).toBeGreaterThan(0);
    expect(run.unresolvedCrosswalkDiagnostics.length).toBeGreaterThan(0);

    const first = await repo.persistRun(run);
    expect(first.mode).toBe('created');
    expect(store.crosswalks.size).toBe(run.crosswalks.filter((r) => r.lifecycleState === 'CURRENT').length);

    const current = await repo.readCurrentCrosswalks(CAPTURE.releaseSetId);
    expect(current.some((row) => row.validationState === 'VALIDATED')).toBe(true);
    expect(current.some((row) => (
      row.validationState === 'UNRESOLVED' && row.publishedEntityId === 'ctr:rel-only'
    ))).toBe(true);
    expect(current.every((row) => row.lifecycleState === 'CURRENT')).toBe(true);

    const second = await repo.persistRun(run);
    expect(second.mode).toBe('idempotent');
  });

  it('rejects same coverage version id with changed source/entries', async () => {
    const { db } = createMemoryDb();
    const repo = new AggregateGovernanceRepository(db);
    const run = sampleRun();
    await repo.persistRun(run);

    const conflict = sampleRun({
      coverageEntries: [
        disposition('ctc:a', 'explicit_extension'),
        disposition('ctc:b', 'excluded_with_rationale'),
      ],
      receipt: {
        ...run.receipt,
        id: 'agg-gov:different-receipt',
        outputDigest: '9'.repeat(64),
        inputDigest: '8'.repeat(64),
        capture: {
          ...run.receipt.capture,
          coverageSourceHash: '7'.repeat(64),
        },
      },
    });
    // Force same coverage version id as first run.
    conflict.coverageVersionId = run.coverageVersionId;
    conflict.receipt.coverageVersionId = run.coverageVersionId;

    await expect(repo.persistRun(conflict)).rejects.toThrow(/coverage version .* conflicting immutable content/u);
  });

  it('rejects same crosswalk id/endpoint with changed content', async () => {
    const { db } = createMemoryDb();
    const repo = new AggregateGovernanceRepository(db);
    const run = sampleRun();
    await repo.persistRun(run);

    const validated = run.publishedCrosswalks[0]!;
    const mutated = {
      ...run,
      receipt: {
        ...run.receipt,
        id: 'agg-gov:crosswalk-conflict',
        outputDigest: '6'.repeat(64),
        inputDigest: '5'.repeat(64),
      },
      crosswalks: run.crosswalks.map((row) => (
        row.id === validated.id
          ? { ...row, structuralUnitHash: '0'.repeat(64), validationDigest: '1'.repeat(64) }
          : row
      )),
      publishedCrosswalks: [{
        ...validated,
        structuralUnitHash: '0'.repeat(64),
        validationDigest: '1'.repeat(64),
      }],
    };
    await expect(repo.persistRun(mutated)).rejects.toThrow(/crosswalk .* conflicting immutable content/u);

    // Endpoint collision with different id.
    const endpointClash = {
      ...run,
      receipt: {
        ...run.receipt,
        id: 'agg-gov:endpoint-conflict',
        outputDigest: '4'.repeat(64),
        inputDigest: '3'.repeat(64),
      },
      crosswalks: [
        ...run.crosswalks.filter((row) => row.id !== validated.id),
        {
          ...validated,
          id: 'act-xwalk:different-id',
        },
      ],
      publishedCrosswalks: [{
        ...validated,
        id: 'act-xwalk:different-id',
      }],
    };
    await expect(repo.persistRun(endpointClash)).rejects.toThrow(/crosswalk endpoint conflict/u);
  });

  it('rejects same revalidation/receipt id with changed content', async () => {
    const { db } = createMemoryDb();
    const repo = new AggregateGovernanceRepository(db);
    const packagingReceipt = packagingNoopRevalidation({
      priorPublicationIdentity: 'prior-coverage-version-id',
      newReleaseSetId: CAPTURE.releaseSetId,
      newReleaseId: CAPTURE.releaseId,
      newDeltaReceiptId: CAPTURE.deltaReceiptId,
      captureRevision: CAPTURE.captureRevision,
    });
    const run = sampleRun({
      revalidationReceipts: [packagingReceipt],
    });
    await repo.persistRun(run);

    const revalConflict = sampleRun({
      revalidationReceipts: [{
        ...packagingReceipt,
        identityDigest: '2'.repeat(64),
        outcome: 'REQUIRES_REVIEW',
      }],
      receipt: {
        ...run.receipt,
        id: 'agg-gov:reval-conflict',
        outputDigest: 'a1'.repeat(32),
        inputDigest: 'b1'.repeat(32),
      },
    });
    await expect(repo.persistRun(revalConflict)).rejects.toThrow(/revalidation receipt .* conflicting/u);

    const receiptConflict = {
      ...run,
      receipt: {
        ...run.receipt,
        // same id, different digest/summary
        outputDigest: 'c1'.repeat(32),
        summary: {
          ...run.receipt.summary,
          exclusions: 999,
        },
      },
    };
    await expect(repo.persistRun(receiptConflict)).rejects.toThrow(/governance receipt .* conflicting/u);
  });

  it('marks invalidated crosswalks stale and does not re-publish STALE as CURRENT', async () => {
    const { db, store } = createMemoryDb();
    const repo = new AggregateGovernanceRepository(db);
    const run = sampleRun();
    await repo.persistRun(run);
    const unresolved = run.unresolvedCrosswalkDiagnostics[0]!;
    expect(store.crosswalks.get(unresolved.id)?.lifecycleState).toBe('CURRENT');

    const invalidateRun = sampleRun({
      receipt: {
        ...run.receipt,
        id: 'agg-gov:invalidate',
        outputDigest: 'd1'.repeat(32),
        inputDigest: 'e1'.repeat(32),
      },
      crosswalks: run.crosswalks.filter((row) => row.id !== unresolved.id),
      publishedCrosswalks: run.publishedCrosswalks,
      unresolvedCrosswalkDiagnostics: [],
      invalidatedCrosswalks: [{
        ...unresolved,
        lifecycleState: 'STALE',
        resolutionState: 'STALE',
        validationState: 'STALE',
      }],
    });
    await repo.persistRun(invalidateRun);
    expect(store.crosswalks.get(unresolved.id)?.lifecycleState).toBe('STALE');
    const current = await repo.readCurrentCrosswalks(CAPTURE.releaseSetId);
    expect(current.find((row) => row.id === unresolved.id)).toBeUndefined();
  });
});
