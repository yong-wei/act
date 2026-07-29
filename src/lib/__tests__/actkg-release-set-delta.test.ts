import { describe, expect, it } from 'vitest';

import {
  assertSignalsAreGeneric,
  buildVocabulary,
  computeReleaseSetDelta,
  computeSemanticCollectionDigest,
  crossCheckUpstreamDiff,
  digestObjectMaterialIdentity,
  digestPayload,
  emitDeltaSignals,
  emptyDetails,
  emptyEvidenceRef,
  isPackagingRevisionOnly,
  isStrictlyPriorAnchor,
  parseUpstreamReleaseDiff,
  resolveAuthoritativeRelationReleaseTier,
  assertRelationTierProtocolShape,
  RELEASE_SET_DELTA_ALGORITHM_VERSION,
} from '../../../scripts/actkg-release/release-set-delta';
import type {
  DeltaEvidenceRef,
  DeltaObjectRecord,
  DeltaRelationRecord,
  DeltaSemanticSnapshot,
  DeltaSignalRecord,
  UpstreamReleaseDiffV1,
} from '../../../scripts/actkg-release/release-set-delta-types';
import type { AcceptedAnchor } from '../../../scripts/actkg-release/release-set-delta-load';
import {
  CTKG_0_2_AGGREGATE_PROTOCOL,
  STANDARD_PUBLIC_BUNDLE_PROTOCOL,
} from '../authoritative-knowledge/contracts';

const CAPTURE = 'a'.repeat(40);

function obj(partial: Partial<DeltaObjectRecord> & Pick<DeltaObjectRecord, 'canonicalId' | 'canonicalType'>): DeltaObjectRecord {
  const semanticName = partial.semanticName !== undefined ? partial.semanticName : partial.canonicalId;
  const payload = {
    entity_id: partial.canonicalId,
    entity_type: partial.canonicalType,
    semantic_name: semanticName,
    description: 'desc',
  };
  return {
    canonicalId: partial.canonicalId,
    canonicalType: partial.canonicalType,
    releaseTier: partial.releaseTier ?? 'gold',
    semanticName,
    displayName: partial.displayName ?? semanticName,
    materialIdentityDigest: digestObjectMaterialIdentity({
      canonicalId: partial.canonicalId,
      canonicalType: partial.canonicalType,
      semanticName,
    }),
    payloadDigest: partial.payloadDigest ?? digestPayload(payload),
    supersedes: partial.supersedes ?? null,
  };
}

function rel(partial: Partial<DeltaRelationRecord> & Pick<DeltaRelationRecord, 'relationId' | 'sourceId' | 'targetId'>): DeltaRelationRecord {
  const predicate = partial.predicate ?? 'part_of';
  const direction = partial.direction ?? 'source_to_target';
  return {
    relationId: partial.relationId,
    predicate,
    direction,
    releaseTier: partial.releaseTier ?? 'gold',
    sourceId: partial.sourceId,
    targetId: partial.targetId,
    payloadDigest: partial.payloadDigest ?? digestPayload({
      relation_id: partial.relationId,
      relation_type: predicate,
      direction,
    }),
  };
}

function snapshot(partial: Partial<DeltaSemanticSnapshot> & Pick<DeltaSemanticSnapshot, 'releaseId' | 'releaseHash'>): DeltaSemanticSnapshot {
  const objects = partial.objects ?? [];
  const relations = partial.relations ?? [];
  const vocabulary = partial.vocabulary ?? buildVocabulary(objects, relations);
  const base = {
    releaseSetId: partial.releaseSetId ?? `set:${partial.releaseId}`,
    releaseId: partial.releaseId,
    releaseVersion: partial.releaseVersion ?? `${partial.releaseId}-version`,
    releaseHash: partial.releaseHash,
    sourceDatasetHash: partial.sourceDatasetHash ?? 's'.repeat(64),
    protocol: partial.protocol ?? 'actkg-public-bundle/1',
    runtimeProjectionId: partial.runtimeProjectionId ?? `proj:${partial.releaseId}`,
    runtimeProjectionDigest: partial.runtimeProjectionDigest ?? 'p'.repeat(64),
    objects,
    relations,
    crosswalk: partial.crosswalk ?? [],
    components: partial.components ?? [],
    projections: partial.projections ?? [{
      profile: 'runtime',
      projectionId: `proj:${partial.releaseId}`,
      versionDigest: partial.runtimeProjectionDigest ?? 'p'.repeat(64),
      isRuntime: true,
    }],
    vocabulary,
  };
  return {
    ...base,
    semanticCollectionDigest: partial.semanticCollectionDigest ?? computeSemanticCollectionDigest(base),
  };
}

function evidence(kind: DeltaEvidenceRef['kind'], releaseId: string, extra?: Partial<DeltaEvidenceRef>): DeltaEvidenceRef {
  if (kind === 'none') return emptyEvidenceRef();
  return {
    kind,
    releaseSetId: `set:${releaseId}`,
    releaseId,
    releaseVersion: `${releaseId}-version`,
    releaseHash: 'h'.repeat(64),
    sourceDatasetHash: 's'.repeat(64),
    importReceiptId: `receipt:${releaseId}`,
    bundleReceiptId: kind === 'standard_bundle' ? `bundle:${releaseId}` : null,
    bundleId: kind === 'standard_bundle' ? `ctb:${releaseId}` : null,
    bundleRevision: kind === 'standard_bundle' ? 1 : null,
    bundleDigest: kind === 'standard_bundle' ? 'b'.repeat(64) : null,
    runtimeProjectionId: `proj:${releaseId}`,
    runtimeProjectionDigest: 'p'.repeat(64),
    evidenceCaptureRevision: CAPTURE,
    protocol: kind === 'exact_import'
      ? 'ctkg-0.2-aggregate-engineering-release-v1'
      : 'actkg-public-bundle/1',
    acceptedAt: new Date('2026-07-28T00:00:00.000Z').toISOString(),
    semanticSnapshotDigest: 'd'.repeat(64),
    ...extra,
  };
}

describe('actkg release-set delta pure compute', () => {
  it('emits BASELINE with all candidate members as additions when no prior accepted ReleaseSet exists', () => {
    const candidate = snapshot({
      releaseId: 'ctr:release:first',
      releaseHash: '1'.repeat(64),
      objects: [obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept' })],
      relations: [rel({ relationId: 'ctr:r1', sourceId: 'n1', targetId: 'n2' })],
    });

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId),
      baseSnapshot: null,
      baseEvidence: emptyEvidenceRef(),
      captureRevision: CAPTURE,
    });

    expect(result.classification).toBe('BASELINE');
    expect(result.authorizationState).toBe('ACCEPTED');
    expect(result.details.objects.added).toEqual(['ctc:a']);
    expect(result.algorithmVersion).toBe(RELEASE_SET_DELTA_ALGORITHM_VERSION);
  });

  it('records relation-only additions without fabricating object changes', () => {
    const objects = [
      obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept' }),
      obj({ canonicalId: 'ctc:b', canonicalType: 'DomainConcept' }),
    ];
    const base = snapshot({
      releaseId: 'ctr:release:v1',
      releaseHash: '1'.repeat(64),
      objects,
      relations: [rel({ relationId: 'ctr:r1', sourceId: 'n1', targetId: 'n2' })],
    });
    const candidate = snapshot({
      releaseId: 'ctr:release:v2',
      releaseHash: '2'.repeat(64),
      objects,
      relations: [
        rel({ relationId: 'ctr:r1', sourceId: 'n1', targetId: 'n2' }),
        rel({ relationId: 'ctr:r2', sourceId: 'n2', targetId: 'n1', predicate: 'association', direction: 'unordered' }),
      ],
    });

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, { releaseHash: candidate.releaseHash }),
      baseSnapshot: base,
      baseEvidence: evidence('exact_import', base.releaseId, { releaseHash: base.releaseHash }),
      captureRevision: CAPTURE,
    });

    expect(result.details.objects.added).toEqual([]);
    expect(result.details.relations.added).toEqual(['ctr:r2']);
    expect(result.details.vocabulary.addedPredicates).toEqual(['association']);
  });

  it('records ordinary description payload updates without identity violation', () => {
    const baseObj = obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept', semanticName: 'gain' });
    const changed = obj({
      canonicalId: 'ctc:a',
      canonicalType: 'DomainConcept',
      semanticName: 'gain',
      payloadDigest: digestPayload({
        entity_id: 'ctc:a',
        entity_type: 'DomainConcept',
        semantic_name: 'gain',
        description: 'updated description only',
      }),
    });
    const base = snapshot({
      releaseId: 'ctr:release:v1',
      releaseHash: '1'.repeat(64),
      objects: [baseObj],
    });
    const candidate = snapshot({
      releaseId: 'ctr:release:v2',
      releaseHash: '2'.repeat(64),
      objects: [changed],
    });

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, { releaseHash: candidate.releaseHash }),
      baseSnapshot: base,
      baseEvidence: evidence('exact_import', base.releaseId, { releaseHash: base.releaseHash }),
      captureRevision: CAPTURE,
    });

    expect(result.authorizationState).toBe('ACCEPTED');
    expect(result.details.objects.payloadChanged).toEqual(['ctc:a']);
    expect(result.identityViolations).toEqual([]);
  });

  it('fails closed on semanticName material identity replacement without supersession', () => {
    const base = snapshot({
      releaseId: 'ctr:release:v1',
      releaseHash: '1'.repeat(64),
      objects: [obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept', semanticName: 'gain' })],
    });
    const candidate = snapshot({
      releaseId: 'ctr:release:v2',
      releaseHash: '2'.repeat(64),
      objects: [obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept', semanticName: 'phase' })],
    });

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, { releaseHash: candidate.releaseHash }),
      baseSnapshot: base,
      baseEvidence: evidence('exact_import', base.releaseId, { releaseHash: base.releaseHash }),
      captureRevision: CAPTURE,
    });

    expect(result.authorizationState).toBe('REJECTED_IDENTITY');
    expect(result.identityViolations.some((row) => row.code === 'material_identity_replacement')).toBe(true);
    expect(result.signals).toEqual([]);
  });

  it('records rejected type and endpoint/direction changes in details while rejecting signals', () => {
    const base = snapshot({
      releaseId: 'ctr:release:v1',
      releaseHash: '1'.repeat(64),
      objects: [obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept' })],
      relations: [rel({ relationId: 'ctr:r1', sourceId: 'n1', targetId: 'n2' })],
    });
    const candidate = snapshot({
      releaseId: 'ctr:release:v2',
      releaseHash: '2'.repeat(64),
      objects: [obj({ canonicalId: 'ctc:a', canonicalType: 'Formula' })],
      relations: [rel({
        relationId: 'ctr:r1',
        sourceId: 'n9',
        targetId: 'n2',
        direction: 'parent_to_child',
      })],
    });

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, { releaseHash: candidate.releaseHash }),
      baseSnapshot: base,
      baseEvidence: evidence('exact_import', base.releaseId, { releaseHash: base.releaseHash }),
      captureRevision: CAPTURE,
    });

    expect(result.authorizationState).toBe('REJECTED_IDENTITY');
    expect(result.details.objects.typeChanged).toEqual(['ctc:a']);
    expect(result.summary.objectTypeChanged).toBe(1);
    expect(result.details.relations.endpointChanged).toEqual(['ctr:r1']);
    expect(result.details.relations.directionChanged).toEqual(['ctr:r1']);
    expect(result.summary.relationEndpointChanged).toBe(1);
    expect(result.summary.relationDirectionChanged).toBe(1);
    expect(result.identityViolations.map((row) => row.code).sort()).toEqual([
      'canonical_type_replacement',
      'relation_direction_replacement',
      'relation_endpoint_replacement',
    ].sort());
    expect(result.signals).toEqual([]);
  });

  it('emits vocabulary invalidation signals for removed types and predicates', () => {
    const base = snapshot({
      releaseId: 'ctr:release:v1',
      releaseHash: '1'.repeat(64),
      objects: [
        obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept' }),
        obj({ canonicalId: 'ctc:b', canonicalType: 'Formula' }),
      ],
      relations: [
        rel({ relationId: 'ctr:r1', sourceId: 'n1', targetId: 'n2', predicate: 'part_of' }),
        rel({ relationId: 'ctr:r2', sourceId: 'n2', targetId: 'n1', predicate: 'is_a' }),
      ],
    });
    const candidate = snapshot({
      releaseId: 'ctr:release:v2',
      releaseHash: '2'.repeat(64),
      objects: [obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept' })],
      relations: [rel({ relationId: 'ctr:r1', sourceId: 'n1', targetId: 'n2', predicate: 'part_of' })],
    });

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, { releaseHash: candidate.releaseHash }),
      baseSnapshot: base,
      baseEvidence: evidence('exact_import', base.releaseId, { releaseHash: base.releaseHash }),
      captureRevision: CAPTURE,
    });

    expect(result.details.vocabulary.removedTypes).toEqual(['Formula']);
    expect(result.details.vocabulary.removedPredicates).toEqual(['is_a']);
    expect(result.signals).toContainEqual(expect.objectContaining({
      scope: 'vocabulary',
      identity: 'type:Formula',
      action: 'invalidation',
      reason: 'removed',
    }));
    expect(result.signals).toContainEqual(expect.objectContaining({
      scope: 'vocabulary',
      identity: 'predicate:is_a',
      action: 'invalidation',
      reason: 'removed',
    }));
  });

  it('allows identities containing active/legacy tokens and rejects injected governance fields', () => {
    const details = emptyDetails();
    details.objects.added = ['ctc:active-legacy-selector-node'];
    const signals = emitDeltaSignals(details);
    expect(() => assertSignalsAreGeneric(signals)).not.toThrow();

    const malicious = {
      ...signals[0]!,
      courseRole: 'core',
    } as unknown as DeltaSignalRecord;
    expect(() => assertSignalsAreGeneric([malicious])).toThrow(/unsupported top-level field|forbidden/i);

    const maliciousDigest = {
      ...signals[0]!,
      digests: { courseRole: 'core' } as unknown as DeltaSignalRecord['digests'],
    } as DeltaSignalRecord;
    expect(() => assertSignalsAreGeneric([maliciousDigest])).toThrow(/unsupported key/i);
  });

  it('cross-checks upstream release_version and rejects disagreement', () => {
    const objects = [obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept' })];
    const base = snapshot({
      releaseId: 'ctr:release:v1',
      releaseVersion: 'control-theory-engineering-v0.2',
      releaseHash: '1'.repeat(64),
      objects,
    });
    const candidate = snapshot({
      releaseId: 'ctr:release:v2',
      releaseVersion: 'control-theory-engineering-v0.3',
      releaseHash: '2'.repeat(64),
      objects,
      relations: [rel({ relationId: 'ctr:r-new', sourceId: 'n1', targetId: 'n2' })],
    });

    const agreeing: UpstreamReleaseDiffV1 = {
      contractVersion: 'actkg-release-diff/1',
      baseRelease: {
        releaseId: base.releaseId,
        releaseVersion: base.releaseVersion,
        releaseHash: base.releaseHash,
      },
      targetRelease: {
        releaseId: candidate.releaseId,
        releaseVersion: candidate.releaseVersion,
        releaseHash: candidate.releaseHash,
      },
      objects: { added: [], removed: [], changed: [] },
      relations: { added: ['ctr:r-new'], removed: [], changed: [] },
      crosswalk: { addedCount: 0, removedCount: 0 },
      components: { added: [], removed: [] },
    };

    const ok = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, {
        releaseHash: candidate.releaseHash,
        releaseVersion: candidate.releaseVersion,
      }),
      baseSnapshot: base,
      baseEvidence: evidence('exact_import', base.releaseId, {
        releaseHash: base.releaseHash,
        releaseVersion: base.releaseVersion,
      }),
      captureRevision: CAPTURE,
      upstreamDiff: agreeing,
    });
    expect(ok.authorizationState).toBe('ACCEPTED');
    expect(ok.upstream.status).toBe('AGREED');

    const badVersion: UpstreamReleaseDiffV1 = {
      ...agreeing,
      targetRelease: {
        ...agreeing.targetRelease,
        releaseVersion: 'wrong-version',
      },
    };
    const rejected = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, {
        releaseHash: candidate.releaseHash,
        releaseVersion: candidate.releaseVersion,
        bundleDigest: 'e'.repeat(64),
        bundleReceiptId: 'bundle:version-mismatch',
      }),
      baseSnapshot: base,
      baseEvidence: evidence('exact_import', base.releaseId, {
        releaseHash: base.releaseHash,
        releaseVersion: base.releaseVersion,
      }),
      captureRevision: CAPTURE,
      upstreamDiff: badVersion,
    });
    expect(rejected.authorizationState).toBe('REJECTED_UPSTREAM');
    expect(rejected.upstream.status).toBe('DISAGREED');
  });

  it('uses strict acceptedAt < only; equal timestamps are never previous', () => {
    const candidateEvidence = evidence('standard_bundle', 'ctr:release:v0.3', {
      acceptedAt: '2026-07-28T12:00:00.000Z',
      bundleReceiptId: 'bundle:v03',
      importReceiptId: 'receipt:v03',
    });
    const candidate = {
      evidence: candidateEvidence,
      snapshot: snapshot({
        releaseId: 'ctr:release:v0.3',
        releaseHash: '3'.repeat(64),
      }),
    };

    const priorExact: AcceptedAnchor = {
      kind: 'exact_import',
      releaseId: 'control-theory-engineering-v0.2',
      releaseSetId: 'actkg-authoritative-candidate-v2',
      acceptedAt: new Date('2026-07-28T11:00:00.000Z'),
      bundleReceiptId: null,
      importReceiptId: 'receipt:v02',
    };
    const equalTsDifferentRelease: AcceptedAnchor = {
      kind: 'standard_bundle',
      // Lexicographically smaller ID must still NOT become prior at equal timestamp.
      releaseId: 'aaa:release:spoof',
      releaseSetId: 'set:spoof',
      acceptedAt: new Date('2026-07-28T12:00:00.000Z'),
      bundleReceiptId: 'bundle:aaa',
      importReceiptId: 'receipt:aaa',
    };
    const later: AcceptedAnchor = {
      kind: 'standard_bundle',
      releaseId: 'ctr:release:v0.5',
      releaseSetId: 'set:v05',
      acceptedAt: new Date('2026-07-28T13:00:00.000Z'),
      bundleReceiptId: 'bundle:v05',
      importReceiptId: 'receipt:v05',
    };

    expect(isStrictlyPriorAnchor(priorExact, candidate)).toBe(true);
    expect(isStrictlyPriorAnchor(later, candidate)).toBe(false);
    expect(isStrictlyPriorAnchor(equalTsDifferentRelease, candidate)).toBe(false);
  });

  it('rejects BASELINE when required upstream release_diff is present (no ACT base)', () => {
    const candidate = snapshot({
      releaseId: 'ctr:release:first',
      releaseHash: '1'.repeat(64),
      objects: [obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept' })],
    });
    const upstream: UpstreamReleaseDiffV1 = {
      contractVersion: 'actkg-release-diff/1',
      baseRelease: {
        releaseId: 'ctr:release:ghost',
        releaseVersion: 'ghost-v1',
        releaseHash: '9'.repeat(64),
      },
      targetRelease: {
        releaseId: candidate.releaseId,
        releaseVersion: candidate.releaseVersion,
        releaseHash: candidate.releaseHash,
      },
      objects: { added: ['ctc:a'], removed: [], changed: [] },
      relations: { added: [], removed: [], changed: [] },
      crosswalk: { addedCount: 0, removedCount: 0 },
      components: { added: [], removed: [] },
    };

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId),
      baseSnapshot: null,
      baseEvidence: emptyEvidenceRef(),
      captureRevision: CAPTURE,
      upstreamDiff: upstream,
      // Default is required; explicit true documents the fail-closed path.
      upstreamRequired: true,
    });

    expect(result.classification).toBe('BASELINE');
    expect(result.authorizationState).toBe('REJECTED_UPSTREAM');
    expect(result.upstream.status).toBe('DISAGREED');
    expect(result.signals).toEqual([]);
  });

  it('accepts BASELINE with optional release_diff and still emits full addition signals', () => {
    const candidate = snapshot({
      releaseId: 'ctr:release:first-optional',
      releaseHash: '2'.repeat(64),
      objects: [
        obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept' }),
        obj({ canonicalId: 'ctc:b', canonicalType: 'Formula' }),
      ],
      relations: [rel({ relationId: 'ctr:r1', sourceId: 'n1', targetId: 'n2' })],
    });
    const upstream: UpstreamReleaseDiffV1 = {
      contractVersion: 'actkg-release-diff/1',
      baseRelease: {
        releaseId: 'ctr:release:ghost',
        releaseVersion: 'ghost-v1',
        releaseHash: '9'.repeat(64),
      },
      targetRelease: {
        releaseId: candidate.releaseId,
        releaseVersion: candidate.releaseVersion,
        releaseHash: candidate.releaseHash,
      },
      objects: { added: ['ctc:a', 'ctc:b'], removed: [], changed: [] },
      relations: { added: ['ctr:r1'], removed: [], changed: [] },
      crosswalk: { addedCount: 0, removedCount: 0 },
      components: { added: [], removed: [] },
    };

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId),
      baseSnapshot: null,
      baseEvidence: emptyEvidenceRef(),
      captureRevision: CAPTURE,
      upstreamDiff: upstream,
      upstreamRequired: false,
    });

    expect(result.classification).toBe('BASELINE');
    expect(result.authorizationState).toBe('ACCEPTED');
    expect(result.upstream.status).toBe('NOT_REQUIRED');
    expect(result.details.objects.added).toEqual(['ctc:a', 'ctc:b']);
    expect(result.details.relations.added).toEqual(['ctr:r1']);
    expect(result.signals.some((row) => (
      row.scope === 'object' && row.identity === 'ctc:a' && row.action === 'candidate'
    ))).toBe(true);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('agrees with upstream when legal supersession uses added/removed only (not changed)', () => {
    const base = snapshot({
      releaseId: 'ctr:release:v1',
      releaseHash: '1'.repeat(64),
      objects: [obj({ canonicalId: 'ctc:old', canonicalType: 'DomainConcept' })],
    });
    const candidate = snapshot({
      releaseId: 'ctr:release:v2',
      releaseHash: '2'.repeat(64),
      objects: [obj({
        canonicalId: 'ctc:new',
        canonicalType: 'DomainConcept',
        supersedes: 'ctc:old',
      })],
    });
    const upstream: UpstreamReleaseDiffV1 = {
      contractVersion: 'actkg-release-diff/1',
      baseRelease: {
        releaseId: base.releaseId,
        releaseVersion: base.releaseVersion,
        releaseHash: base.releaseHash,
      },
      targetRelease: {
        releaseId: candidate.releaseId,
        releaseVersion: candidate.releaseVersion,
        releaseHash: candidate.releaseHash,
      },
      objects: {
        added: ['ctc:new'],
        removed: ['ctc:old'],
        changed: [],
      },
      relations: { added: [], removed: [], changed: [] },
      crosswalk: { addedCount: 0, removedCount: 0 },
      components: { added: [], removed: [] },
    };

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, {
        releaseHash: candidate.releaseHash,
        releaseVersion: candidate.releaseVersion,
      }),
      baseSnapshot: base,
      baseEvidence: evidence('exact_import', base.releaseId, {
        releaseHash: base.releaseHash,
        releaseVersion: base.releaseVersion,
      }),
      captureRevision: CAPTURE,
      upstreamDiff: upstream,
      upstreamRequired: true,
    });

    expect(result.authorizationState).toBe('ACCEPTED');
    expect(result.upstream.status).toBe('AGREED');
    expect(result.details.objects.added).toEqual(['ctc:new']);
    expect(result.details.objects.removed).toEqual(['ctc:old']);
    expect(result.details.objects.superseded).toEqual([{ from: 'ctc:old', to: 'ctc:new' }]);
    expect(result.details.objects.payloadChanged).toEqual([]);
  });

  it('still maps same-ID payload changes into upstream objects.changed', () => {
    const baseObj = obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept', semanticName: 'gain' });
    const changed = obj({
      canonicalId: 'ctc:a',
      canonicalType: 'DomainConcept',
      semanticName: 'gain',
      payloadDigest: digestPayload({
        entity_id: 'ctc:a',
        entity_type: 'DomainConcept',
        semantic_name: 'gain',
        description: 'payload only',
      }),
    });
    const base = snapshot({
      releaseId: 'ctr:release:v1',
      releaseHash: '1'.repeat(64),
      objects: [baseObj],
    });
    const candidate = snapshot({
      releaseId: 'ctr:release:v2',
      releaseHash: '2'.repeat(64),
      objects: [changed],
    });
    const upstream: UpstreamReleaseDiffV1 = {
      contractVersion: 'actkg-release-diff/1',
      baseRelease: {
        releaseId: base.releaseId,
        releaseVersion: base.releaseVersion,
        releaseHash: base.releaseHash,
      },
      targetRelease: {
        releaseId: candidate.releaseId,
        releaseVersion: candidate.releaseVersion,
        releaseHash: candidate.releaseHash,
      },
      objects: { added: [], removed: [], changed: ['ctc:a'] },
      relations: { added: [], removed: [], changed: [] },
      crosswalk: { addedCount: 0, removedCount: 0 },
      components: { added: [], removed: [] },
    };

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, {
        releaseHash: candidate.releaseHash,
        releaseVersion: candidate.releaseVersion,
      }),
      baseSnapshot: base,
      baseEvidence: evidence('exact_import', base.releaseId, {
        releaseHash: base.releaseHash,
        releaseVersion: base.releaseVersion,
      }),
      captureRevision: CAPTURE,
      upstreamDiff: upstream,
    });

    expect(result.authorizationState).toBe('ACCEPTED');
    expect(result.upstream.status).toBe('AGREED');
    expect(result.details.objects.payloadChanged).toEqual(['ctc:a']);
  });

  it('rejects forged signalDigest that does not match recomputed body', () => {
    const details = emptyDetails();
    details.objects.added = ['ctc:ok'];
    const signals = emitDeltaSignals(details);
    expect(() => assertSignalsAreGeneric(signals)).not.toThrow();

    const forged = {
      ...signals[0]!,
      signalDigest: '0'.repeat(64),
    };
    expect(() => assertSignalsAreGeneric([forged])).toThrow(/does not match recomputed body digest/i);
  });

  it('resolves relation releaseTier by protocol contract (not payload or row-count)', () => {
    // Exact path: entry only. Stray metadata values are ignored by the resolver
    // (presence of LinkMetadata rows is a separate load-level fail closed).
    expect(resolveAuthoritativeRelationReleaseTier({
      relationId: 'ctr:r1',
      entryReleaseTier: 'gold',
      requireLinkMetadata: false,
    })).toBe('gold');
    expect(resolveAuthoritativeRelationReleaseTier({
      relationId: 'ctr:r1',
      entryReleaseTier: 'gold',
      metadataReleaseTier: 'silver',
      requireLinkMetadata: false,
    })).toBe('gold');

    // Standard path: entry + metadata must agree.
    expect(resolveAuthoritativeRelationReleaseTier({
      relationId: 'ctr:r1',
      entryReleaseTier: 'silver',
      metadataReleaseTier: 'silver',
      requireLinkMetadata: true,
    })).toBe('silver');

    // Standard path with empty/missing metadata fails closed (not entry-only fallback).
    expect(() => resolveAuthoritativeRelationReleaseTier({
      relationId: 'ctr:r1',
      entryReleaseTier: 'gold',
      requireLinkMetadata: true,
      metadataReleaseTier: undefined,
    })).toThrow(/missing authoritative ProjectionLinkMetadata releaseTier/i);

    expect(() => resolveAuthoritativeRelationReleaseTier({
      relationId: 'ctr:r1',
      entryReleaseTier: 'gold',
      requireLinkMetadata: true,
      metadataReleaseTier: '',
    })).toThrow(/missing authoritative ProjectionLinkMetadata releaseTier/i);

    // Standard partial absence for one relation (undefined map get) fails closed.
    expect(() => resolveAuthoritativeRelationReleaseTier({
      relationId: 'ctr:missing-meta',
      entryReleaseTier: 'gold',
      requireLinkMetadata: true,
      metadataReleaseTier: undefined,
    })).toThrow(/ctr:missing-meta.*ProjectionLinkMetadata/i);

    // Tier disagreement fails closed.
    expect(() => resolveAuthoritativeRelationReleaseTier({
      relationId: 'ctr:r1',
      entryReleaseTier: 'gold',
      metadataReleaseTier: 'silver',
      requireLinkMetadata: true,
    })).toThrow(/releaseTier mismatch/i);

    // Missing entry fails closed (never "unknown").
    expect(() => resolveAuthoritativeRelationReleaseTier({
      relationId: 'ctr:r1',
      entryReleaseTier: null,
      requireLinkMetadata: false,
    })).toThrow(/missing authoritative ReleaseEntry releaseTier/i);

    expect(() => resolveAuthoritativeRelationReleaseTier({
      relationId: 'ctr:r1',
      entryReleaseTier: '   ',
      requireLinkMetadata: false,
    })).toThrow(/missing authoritative ReleaseEntry releaseTier/i);
  });

  it('enforces relation tier protocol shape without row-count heuristics', () => {
    // Exact: zero metadata is the contract; any rows fail closed.
    expect(assertRelationTierProtocolShape({
      releaseId: 'ctr:exact',
      protocol: CTKG_0_2_AGGREGATE_PROTOCOL,
      projectionLinkCount: 97,
      linkMetadataRowCount: 0,
    })).toEqual({ requireLinkMetadata: false });
    expect(() => assertRelationTierProtocolShape({
      releaseId: 'ctr:exact',
      protocol: CTKG_0_2_AGGREGATE_PROTOCOL,
      projectionLinkCount: 97,
      linkMetadataRowCount: 1,
    })).toThrow(/must not carry ProjectionLinkMetadata/i);

    // Standard: full-empty metadata table with projection links fails closed.
    expect(() => assertRelationTierProtocolShape({
      releaseId: 'ctr:std',
      protocol: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      projectionLinkCount: 10,
      linkMetadataRowCount: 0,
    })).toThrow(/missing ProjectionLinkMetadata/i);

    // Standard with any metadata rows present still requires per-relation
    // agreement later; shape check only rejects full empty.
    expect(assertRelationTierProtocolShape({
      releaseId: 'ctr:std',
      protocol: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      projectionLinkCount: 10,
      linkMetadataRowCount: 9,
    })).toEqual({ requireLinkMetadata: true });

    expect(assertRelationTierProtocolShape({
      releaseId: 'ctr:std',
      protocol: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      projectionLinkCount: 10,
      linkMetadataRowCount: 10,
    })).toEqual({ requireLinkMetadata: true });
  });

  it('emits relationTierChanged signals when only relation tier changes', () => {
    const objects = [
      obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept' }),
      obj({ canonicalId: 'ctc:b', canonicalType: 'DomainConcept' }),
    ];
    const base = snapshot({
      releaseId: 'ctr:release:v1',
      releaseHash: '1'.repeat(64),
      objects,
      relations: [rel({
        relationId: 'ctr:r1',
        sourceId: 'n1',
        targetId: 'n2',
        releaseTier: 'silver',
      })],
    });
    const candidate = snapshot({
      releaseId: 'ctr:release:v2',
      releaseHash: '2'.repeat(64),
      objects,
      relations: [rel({
        relationId: 'ctr:r1',
        sourceId: 'n1',
        targetId: 'n2',
        releaseTier: 'gold',
      })],
    });

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, {
        releaseHash: candidate.releaseHash,
      }),
      baseSnapshot: base,
      baseEvidence: evidence('exact_import', base.releaseId, {
        releaseHash: base.releaseHash,
      }),
      captureRevision: CAPTURE,
    });

    expect(result.authorizationState).toBe('ACCEPTED');
    expect(result.details.relations.tierChanged).toEqual(['ctr:r1']);
    expect(result.details.relations.added).toEqual([]);
    expect(result.details.relations.removed).toEqual([]);
    expect(result.details.relations.predicateChanged).toEqual([]);
    expect(result.summary.relationTierChanged).toBe(1);
    expect(result.signals).toContainEqual(expect.objectContaining({
      scope: 'relation',
      identity: 'ctr:r1',
      action: 'candidate',
      reason: 'tier_changed',
    }));
  });

  it('fails closed when persisted signalDigest sets drift from recomputation', async () => {
    const { assertSignalDigestSetsMatch } = await import(
      '../../../scripts/actkg-release/release-set-delta-persist'
    );
    expect(() => assertSignalDigestSetsMatch(
      ['a'.repeat(64), 'b'.repeat(64)],
      ['a'.repeat(64), 'b'.repeat(64)],
      'unit',
    )).not.toThrow();
    expect(() => assertSignalDigestSetsMatch(
      ['a'.repeat(64)],
      ['a'.repeat(64), 'b'.repeat(64)],
      'unit',
    )).toThrow(/cardinality drift/i);
    expect(() => assertSignalDigestSetsMatch(
      ['a'.repeat(64), 'c'.repeat(64)],
      ['a'.repeat(64), 'b'.repeat(64)],
      'unit',
    )).toThrow(/set drift/i);
  });

  it('SCHEMA_ISOLATION_UNSUPPORTED exit policy does not fake green when required', async () => {
    const { actkgPostgresSkipExitCode } = await import(
      '../../../scripts/actkg-release/actkg-postgres-harness-policy'
    );
    expect(actkgPostgresSkipExitCode(true)).toBe(1);
    expect(actkgPostgresSkipExitCode(false)).toBe(0);
  });

  it('short-circuits packaging-only revisions with empty semantic changes and no signals', () => {
    const objects = [obj({ canonicalId: 'ctc:a', canonicalType: 'DomainConcept' })];
    const base = snapshot({
      releaseId: 'ctr:release:same',
      releaseHash: '1'.repeat(64),
      sourceDatasetHash: 's'.repeat(64),
      objects,
    });
    const candidate = snapshot({
      releaseId: 'ctr:release:same',
      releaseHash: '1'.repeat(64),
      sourceDatasetHash: 's'.repeat(64),
      objects,
    });
    expect(isPackagingRevisionOnly(base, candidate)).toBe(true);

    const result = computeReleaseSetDelta({
      candidateSnapshot: candidate,
      candidateEvidence: evidence('standard_bundle', candidate.releaseId, {
        releaseHash: candidate.releaseHash,
        bundleRevision: 2,
        bundleDigest: '9'.repeat(64),
        bundleReceiptId: 'bundle:r2',
      }),
      baseSnapshot: base,
      baseEvidence: evidence('standard_bundle', base.releaseId, {
        releaseHash: base.releaseHash,
        bundleRevision: 1,
        bundleDigest: '8'.repeat(64),
        bundleReceiptId: 'bundle:r1',
      }),
      captureRevision: CAPTURE,
    });

    expect(result.classification).toBe('COMPATIBLE_PACKAGING_REVISION');
    expect(result.signals).toEqual([]);
  });

  it('rejects non-sha captureRevision in pure compute', () => {
    expect(() => computeReleaseSetDelta({
      candidateSnapshot: snapshot({
        releaseId: 'ctr:release:x',
        releaseHash: '1'.repeat(64),
      }),
      candidateEvidence: evidence('standard_bundle', 'ctr:release:x'),
      captureRevision: 'not-a-git-sha',
    })).toThrow(/40-character/i);
  });

  it('includes release_version in upstream parse and identity cross-check helper', () => {
    const parsed = parseUpstreamReleaseDiff({
      contract_version: 'actkg-release-diff/1',
      base_release: {
        release_id: 'base',
        release_version: 'v1',
        release_hash: 'a'.repeat(64),
      },
      target_release: {
        release_id: 'target',
        release_version: 'v2',
        release_hash: 'b'.repeat(64),
      },
      objects: { added: [], removed: [], changed: [] },
      relations: { added: [], removed: [], changed: [] },
      crosswalk: { added_count: 0, removed_count: 0 },
      components: { added: [], removed: [] },
    });
    expect(parsed.baseRelease.releaseVersion).toBe('v1');
    const result = crossCheckUpstreamDiff(emptyDetails(), parsed, {
      baseReleaseVersion: 'other',
    });
    expect(result.status).toBe('DISAGREED');
  });
});
