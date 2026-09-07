import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  assertVersionClosedShadowInput,
  buildCandidateContextFingerprint,
  buildOfflineShadowInput,
  CanonicalRagVersionContextError,
  CANDIDATE_CONTEXT_FIELD_KEYS,
  deriveStructuralTargetFromObservations,
  evaluateFinalEvidenceCandidate,
  expandCanonicalRelations,
  isCompleteValidatedCrosswalk,
  membershipMatchesRelease,
  offlineRelease,
  offlineSampleCases,
  productionAnswerUsesLegacy,
  resolveUpstreamThroughActCrosswalk,
  runCanonicalRagShadow,
  selectRagAuthority,
  StructuralObservationError,
  tryActivateCanonicalCutover,
  RagCutoverActivationError,
  type CanonicalRagReleaseContext,
  type RagCutoverAuthorityReceipt,
  type VersionBoundCrosswalk,
} from '@/lib/canonical-rag';
import {
  GOVERNED_TEXTBOOK_FIXTURE_KIND,
  loadGovernedTextbookFixture,
  mapGovernedSeedsToSourcePackItems,
  productionNumberedCitations,
  runLegacyProductionWithCanonicalShadow,
} from '@/lib/canonical-rag/server';
import {
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
} from '@/lib/authoritative-knowledge/contracts';
import type { SourcePackItem } from '@/lib/source-pack/types';
import type { ActStructuralCitationTarget } from '@/lib/canonical-rag';

describe('canonical-rag authority (preserved)', () => {
  it('legacy dial keeps production Legacy and never activates cutover', () => {
    expect(selectRagAuthority('PRODUCTION_ANSWER', { productionAuthority: 'legacy' }).authority).toBe('LEGACY');
    expect(productionAnswerUsesLegacy(selectRagAuthority('PRODUCTION_ANSWER', { productionAuthority: 'legacy' }))).toBe(true);
    expect(() => selectRagAuthority('CUTOVER_ACTIVATION')).toThrow(RagCutoverActivationError);
    expect(() => tryActivateCanonicalCutover({
      cutoverReceipt: validCutoverReceipt(),
      shadowSucceeded: true,
    })).toThrow(RagCutoverActivationError);
  });
});

describe('complete context fingerprint including Projection identity', () => {
  it('includes projectionId and projectionProfile in the fingerprint key set', () => {
    expect(CANDIDATE_CONTEXT_FIELD_KEYS).toContain('projectionId');
    expect(CANDIDATE_CONTEXT_FIELD_KEYS).toContain('projectionProfile');
    expect(CANDIDATE_CONTEXT_FIELD_KEYS).toContain('projectionDigest');
    expect(offlineRelease.projectionId.length).toBeGreaterThan(0);
    expect(offlineRelease.projectionProfile.length).toBeGreaterThan(0);
  });

  it('membershipMatchesRelease fails when only projectionId or projectionProfile changes', () => {
    const base = offlineRelease;
    const onlyProjectionId = buildCandidateContextFingerprint({
      ...base,
      projectionId: `${base.projectionId}-mutated`,
    });
    const onlyProjectionProfile = buildCandidateContextFingerprint({
      ...base,
      projectionProfile: `${base.projectionProfile}-mutated`,
    });
    expect(membershipMatchesRelease(onlyProjectionId, base)).toBe(false);
    expect(membershipMatchesRelease(onlyProjectionProfile, base)).toBe(false);
    expect(onlyProjectionId.contextDigest).not.toBe(base.contextDigest);
    expect(onlyProjectionProfile.contextDigest).not.toBe(base.contextDigest);
  });

  it('rejects mixed membership for every fingerprint field including projection identity', () => {
    const fields = CANDIDATE_CONTEXT_FIELD_KEYS;
    for (const field of fields) {
      const release = mutateContextField(offlineRelease, field);
      const objects = buildOfflineShadowInput().objects.map((object, index) => (
        index === 0 ? { ...object, ...release } : object
      ));
      expect(() => assertVersionClosedShadowInput(buildOfflineShadowInput({ objects }))).toThrow(
        CanonicalRagVersionContextError,
      );
    }
  });

  it('requires upstream context and rejects missing or mixed full fingerprints', () => {
    const base = buildOfflineShadowInput();
    const missingContext = new Map(base.upstreamByCanonicalId);
    missingContext.set('ctr:root-locus', [{
      publishedEntityId: 'upstream:root-locus',
      retrievalChunkId: 'chunk:root-locus-para-2',
      citationTargetId: 'cite:root-locus-para-2',
      canonicalId: 'ctr:root-locus',
      // @ts-expect-error intentional missing context
      context: undefined,
    }]);
    expect(() => assertVersionClosedShadowInput({
      ...base,
      upstreamByCanonicalId: missingContext,
    })).toThrow(/missing mandatory context|missing-upstream/u);

    const mixed = new Map(base.upstreamByCanonicalId);
    mixed.set('ctr:root-locus', [{
      publishedEntityId: 'upstream:root-locus',
      retrievalChunkId: 'chunk:root-locus-para-2',
      citationTargetId: 'cite:root-locus-para-2',
      canonicalId: 'ctr:root-locus',
      context: mutateContextField(offlineRelease, 'projectionId'),
    }]);
    expect(() => assertVersionClosedShadowInput({
      ...base,
      upstreamByCanonicalId: mixed,
    })).toThrow(/mixed-upstream|not bound/u);
  });
});

describe('independent structural endpoint mutations fail the resolver path', () => {
  it('mutating unit / SourcePack / inventory observations never resolves against the Crosswalk', async () => {
    const fixture = await loadGovernedTextbookFixture();
    expect(fixture.kind).toBe(GOVERNED_TEXTBOOK_FIXTURE_KIND);

    const resolveWith = (structuralUnits: typeof fixture.shadowInput.structuralUnits) => (
      resolveUpstreamThroughActCrosswalk({
        upstream: {
          publishedEntityId: fixture.crosswalk.row.publishedEntityId,
          retrievalChunkId: fixture.crosswalk.row.retrievalChunkId,
          citationTargetId: fixture.crosswalk.row.citationTargetId,
          canonicalId: 'ctr:root-locus',
          context: fixture.release,
        },
        crosswalks: [fixture.crosswalk],
        structuralUnits,
        release: fixture.release,
      })
    );

    // Baseline must resolve.
    expect(resolveWith([fixture.independentStructuralTarget]).status).toBe('resolved');
    expect(isCompleteValidatedCrosswalk(fixture.crosswalk.row)).toBe(true);

    // --- unit identity mutations → derived target mismatches Crosswalk ---
    for (const mutator of [
      () => deriveStructuralTargetFromObservations({
        unit: {
          ...fixture.unit,
          identity: { ...fixture.unit.identity, bookId: 'wrong-book' },
        },
        sourcePackItem: fixture.productionItem,
        inventory: fixture.inventory,
        context: fixture.release,
      }),
      () => deriveStructuralTargetFromObservations({
        unit: {
          ...fixture.unit,
          identity: { ...fixture.unit.identity, edition: 'wrong-edition' },
        },
        sourcePackItem: fixture.productionItem,
        inventory: fixture.inventory,
        context: fixture.release,
      }),
      () => deriveStructuralTargetFromObservations({
        unit: {
          ...fixture.unit,
          identity: { ...fixture.unit.identity, sourceRevision: 'wrong-revision' },
        },
        sourcePackItem: fixture.productionItem,
        inventory: fixture.inventory,
        context: fixture.release,
      }),
      () => deriveStructuralTargetFromObservations({
        unit: {
          ...fixture.unit,
          id: 'textbook-unit:wrong-id',
          identity: { ...fixture.unit.identity, unitId: 'textbook-unit:wrong-id' },
          resourceProjection: {
            ...fixture.unit.resourceProjection,
            resourceId: 'textbook-unit:wrong-id',
            segmentRef: 'textbook-unit:wrong-id',
          },
        },
        sourcePackItem: {
          ...fixture.productionItem,
          id: 'textbook-unit:wrong-id',
        },
        inventory: {
          ...fixture.inventory,
          resourceId: 'textbook-unit:wrong-id',
          segmentId: 'textbook-unit:wrong-id',
          atomicResourceId: 'atomic:textbook-unit:wrong-id',
        },
        context: fixture.release,
      }),
      () => deriveStructuralTargetFromObservations({
        unit: {
          ...fixture.unit,
          contentHash: '9'.repeat(64),
        },
        sourcePackItem: {
          ...fixture.productionItem,
          metadata: {
            ...fixture.productionItem.metadata,
            contentHash: '9'.repeat(64),
          },
        },
        inventory: fixture.inventory,
        context: fixture.release,
      }),
    ] as const) {
      const target = mutator();
      const status = resolveWith([target]).status;
      // Fail closed: never resolves. Status may be endpoint-mismatch when a
      // same-id partial observation exists, or unreadable when the unit id itself
      // no longer matches any Crosswalk endpoint.
      expect(status === 'endpoint-mismatch' || status === 'unreadable-structural-unit').toBe(true);
      expect(status).not.toBe('resolved');
    }

    // --- SourcePack field mutations ---
    // retrievalChunkId
    expect(resolveWith([
      deriveStructuralTargetFromObservations({
        unit: fixture.unit,
        sourcePackItem: {
          ...fixture.productionItem,
          retrievalChunkId: 'textbook-unit:wrong-chunk',
        },
        inventory: fixture.inventory,
        context: fixture.release,
      }),
    ]).status).toBe('endpoint-mismatch');

    // citationTargetId
    expect(resolveWith([
      deriveStructuralTargetFromObservations({
        unit: fixture.unit,
        sourcePackItem: {
          ...fixture.productionItem,
          citationTargetId: 'textbook-citation:wrong',
          citation: {
            ...fixture.productionItem.citation!,
            citationTargetId: 'textbook-citation:wrong',
          },
        },
        inventory: fixture.inventory,
        context: fixture.release,
      }),
    ]).status).toBe('endpoint-mismatch');

    // href disagreement between unit and SourcePack is construction-fail
    expect(() => deriveStructuralTargetFromObservations({
      unit: fixture.unit,
      sourcePackItem: {
        ...fixture.productionItem,
        citation: {
          ...fixture.productionItem.citation!,
          href: '/textbooks/wrong-href',
        },
      },
      inventory: fixture.inventory,
      context: fixture.release,
    })).toThrow(StructuralObservationError);

    // contentHash disagreement is construction-fail
    expect(() => deriveStructuralTargetFromObservations({
      unit: fixture.unit,
      sourcePackItem: {
        ...fixture.productionItem,
        metadata: {
          ...fixture.productionItem.metadata,
          contentHash: '8'.repeat(64),
        },
      },
      inventory: fixture.inventory,
      context: fixture.release,
    })).toThrow(StructuralObservationError);

    // --- inventory mutations ---
    // resourceId disagreement with unit is construction-fail
    expect(() => deriveStructuralTargetFromObservations({
      unit: fixture.unit,
      sourcePackItem: fixture.productionItem,
      inventory: { ...fixture.inventory, resourceId: 'resource:wrong' },
      context: fixture.release,
    })).toThrow(StructuralObservationError);

    // segmentId disagreement is construction-fail
    expect(() => deriveStructuralTargetFromObservations({
      unit: fixture.unit,
      sourcePackItem: fixture.productionItem,
      inventory: { ...fixture.inventory, segmentId: 'segment:wrong' },
      context: fixture.release,
    })).toThrow(StructuralObservationError);

    // inventoryRunId / capture mismatch with context is construction-fail
    expect(() => deriveStructuralTargetFromObservations({
      unit: fixture.unit,
      sourcePackItem: fixture.productionItem,
      inventory: { ...fixture.inventory, inventoryRunId: 'inventory:wrong' },
      context: fixture.release,
    })).toThrow(StructuralObservationError);

    expect(() => deriveStructuralTargetFromObservations({
      unit: fixture.unit,
      sourcePackItem: fixture.productionItem,
      inventory: { ...fixture.inventory, captureRevision: 'a'.repeat(40) },
      context: fixture.release,
    })).toThrow(StructuralObservationError);

    // resourceSegmentHash mutation constructs but fails resolver endpoint match
    expect(resolveWith([
      deriveStructuralTargetFromObservations({
        unit: fixture.unit,
        sourcePackItem: fixture.productionItem,
        inventory: {
          ...fixture.inventory,
          resourceSegmentHash: '7'.repeat(64),
        },
        context: fixture.release,
      }),
    ]).status).toBe('endpoint-mismatch');

    // atomicResourceId mutation constructs but fails resolver endpoint match
    expect(resolveWith([
      deriveStructuralTargetFromObservations({
        unit: fixture.unit,
        sourcePackItem: fixture.productionItem,
        inventory: {
          ...fixture.inventory,
          atomicResourceId: 'atomic:wrong',
        },
        context: fixture.release,
      }),
    ]).status).toBe('endpoint-mismatch');
  }, 60_000);
});

describe('graph stage seed-only + harness adjudication (preserved)', () => {
  it('never emits numbered citations from graph stage', () => {
    const shadow = runCanonicalRagShadow(buildOfflineShadowInput({
      query: offlineSampleCases.inQueryEntityMatch.query,
    }));
    expect(shadow.status).toBe('shadow-seeds-recorded');
    expect(shadow.numberedCitations).toEqual([]);
    expect(shadow.governedStructuralSeeds.length).toBeGreaterThan(0);
    expect(evaluateFinalEvidenceCandidate({
      kind: 'ungated-crosswalk-seed',
      id: 'x',
      citable: false,
    }).accepted).toBe(false);
  });

  it('adjudicates via Source Pack; rejects unmappable pools', async () => {
    const fixture = await loadGovernedTextbookFixture();
    const relevant = runLegacyProductionWithCanonicalShadow({
      query: fixture.query,
      production: {
        profile: 'konling-answer',
        role: 'student',
        candidates: [fixture.productionItem],
        graphNodeRefs: [],
      },
      shadow: fixture.shadowInput,
      shadowCandidatePool: fixture.shadowCandidatePool,
      latencyBudgetMs: 5_000,
    });
    expect(relevant.productionAuthority.authority).toBe('LEGACY');
    expect(relevant.shadowSeeds.numberedCitations).toEqual([]);
    expect(relevant.separation.shadowCitationsFromAdjudication).toBe(true);
    expect(relevant.shadowCitations.length).toBeGreaterThan(0);
    expect(productionNumberedCitations(relevant.production).length).toBeGreaterThan(0);

    const unmapped = runLegacyProductionWithCanonicalShadow({
      query: fixture.query,
      production: {
        profile: 'konling-answer',
        role: 'student',
        candidates: [fixture.irrelevantItem],
        graphNodeRefs: [],
      },
      shadow: fixture.shadowInput,
      shadowCandidatePool: [fixture.irrelevantItem],
      latencyBudgetMs: 5_000,
    });
    expect(unmapped.shadowSeeds.governedStructuralSeeds.length).toBeGreaterThan(0);
    expect(unmapped.shadowCitations).toEqual([]);
  }, 60_000);

  it('expands only supported predicates', () => {
    const input = buildOfflineShadowInput();
    const expansion = expandCanonicalRelations({
      seedCanonicalIds: ['ctr:root-locus'],
      relations: input.relations,
      objects: input.objects,
      coverage: input.coverage,
      maxHops: 1,
    });
    expect(expansion.skippedUnsupportedPredicates).toEqual(['mentions', 'prerequisite']);
  });
});

describe('strict governed seed → SourcePack endpoint mapping', () => {
  it('maps only exact full-tuple pool items and rejects same-one-ID drift', () => {
    const seed = exactOfflineSeed();
    const exact = exactPoolItemFromSeed(seed);

    // Positive: full identity + edition/version/hash/resource/segment tuple.
    expect(mapGovernedSeedsToSourcePackItems([seed], [exact]).map((item) => item.id)).toEqual([
      seed.structuralUnitId,
    ]);

    // Same structuralUnitId but wrong chunk / citation.
    expect(mapGovernedSeedsToSourcePackItems([seed], [{
      ...exact,
      retrievalChunkId: 'chunk:drifted',
      citationTargetId: 'cite:drifted',
      citation: {
        ...exact.citation!,
        citationTargetId: 'cite:drifted',
        sourceId: 'chunk:drifted',
      },
    }])).toEqual([]);

    // Same chunk but wrong structural unit / citation.
    expect(mapGovernedSeedsToSourcePackItems([seed], [{
      ...exact,
      id: 'unit:other-structure',
      citationTargetId: 'cite:other',
      citation: {
        ...exact.citation!,
        citationTargetId: 'cite:other',
      },
    }])).toEqual([]);

    // Same citation but wrong structural unit / chunk.
    expect(mapGovernedSeedsToSourcePackItems([seed], [{
      ...exact,
      id: 'unit:other-structure',
      retrievalChunkId: 'chunk:other',
      citation: {
        ...exact.citation!,
        sourceId: 'chunk:other',
      },
    }])).toEqual([]);

    // All three IDs match but edition drifts.
    expect(mapGovernedSeedsToSourcePackItems([seed], [{
      ...exact,
      metadata: { ...exact.metadata, edition: '第七版' },
    }])).toEqual([]);

    // All three IDs match but sourceVersion drifts.
    expect(mapGovernedSeedsToSourcePackItems([seed], [{
      ...exact,
      metadata: { ...exact.metadata, sourceVersion: '7th' },
    }])).toEqual([]);

    // All three IDs match but contentHash drifts.
    expect(mapGovernedSeedsToSourcePackItems([seed], [{
      ...exact,
      metadata: { ...exact.metadata, contentHash: '9'.repeat(64) },
    }])).toEqual([]);

    // All three IDs match but resource/segment drifts.
    expect(mapGovernedSeedsToSourcePackItems([seed], [{
      ...exact,
      metadata: {
        ...exact.metadata,
        resourceId: 'resource:other',
        segmentRef: 'segment:other',
      },
    }])).toEqual([]);

    // Required version/content metadata absent → fail closed.
    const { contentHash: _hash, sourceVersion: _version, ...withoutVersionHash } = exact.metadata as Record<string, string>;
    expect(mapGovernedSeedsToSourcePackItems([seed], [{
      ...exact,
      metadata: withoutVersionHash,
    }])).toEqual([]);

    // Missing citation object → fail closed even with top-level IDs.
    const { citation: _citation, ...withoutCitation } = exact;
    expect(mapGovernedSeedsToSourcePackItems([seed], [withoutCitation as SourcePackItem])).toEqual([]);
  });

  it('yields zero shadow citations when pool only has same-one-ID drifted items', async () => {
    const fixture = await loadGovernedTextbookFixture();
    const seed = fixture.independentStructuralTarget;
    const exact = fixture.productionItem;

    const driftedSameId: SourcePackItem = {
      ...exact,
      retrievalChunkId: 'chunk:wrong-edition',
      citationTargetId: 'cite:wrong-edition',
      citation: {
        ...exact.citation!,
        citationTargetId: 'cite:wrong-edition',
        sourceId: 'chunk:wrong-edition',
      },
    };
    expect(mapGovernedSeedsToSourcePackItems([seed], [driftedSameId])).toEqual([]);

    const result = runLegacyProductionWithCanonicalShadow({
      query: fixture.query,
      production: {
        profile: 'konling-answer',
        role: 'student',
        candidates: [fixture.productionItem],
        graphNodeRefs: [],
      },
      shadow: fixture.shadowInput,
      shadowCandidatePool: [driftedSameId],
      latencyBudgetMs: 5_000,
    });
    expect(result.productionAuthority.authority).toBe('LEGACY');
    expect(result.shadowSeeds.numberedCitations).toEqual([]);
    expect(result.shadowCitations).toEqual([]);
    expect(result.production.pack.items.map((item) => item.id)).toEqual([
      fixture.productionItem.id,
    ]);
  }, 60_000);
});

function exactOfflineSeed(): ActStructuralCitationTarget {
  const input = buildOfflineShadowInput({
    query: offlineSampleCases.inQueryEntityMatch.query,
  });
  const shadow = runCanonicalRagShadow(input);
  const seed = shadow.governedStructuralSeeds.find(
    (row) => row.structuralUnitId === 'unit:root-locus-para-2',
  );
  if (!seed) throw new Error('expected offline root-locus seed');
  return seed;
}

function exactPoolItemFromSeed(seed: ActStructuralCitationTarget): SourcePackItem {
  const [bookId, ...editionParts] = seed.sourceEditionId.split(':');
  const edition = editionParts.join(':');
  return {
    id: seed.structuralUnitId,
    title: seed.displayTitle,
    sourceKind: 'textbook',
    modality: 'text',
    excerpt: '根轨迹定义见教材正文（精确端点池项）。',
    inclusionRationale: 'exact full-tuple pool item for mapping regression',
    retrievalChunkId: seed.retrievalChunkId,
    citationTargetId: seed.citationTargetId,
    scores: {
      relevance: 0.95,
      graphAlignment: 0.9,
      authority: 0.95,
      eligibility: 0.9,
      freshness: 0.9,
      final: 0.95,
    },
    access: { visibility: 'public', aiUseAllowed: true },
    citation: {
      citationTargetId: seed.citationTargetId,
      sourceId: seed.retrievalChunkId,
      displayTitle: seed.displayTitle,
      href: seed.href ?? undefined,
      resolver: 'course-runtime',
      verified: true,
    },
    metadata: {
      reviewStatus: 'human-confirmed',
      bookId,
      edition,
      contentHash: seed.structuralUnitHash,
      sourceVersion: seed.sourceVersion,
      structuralUnitVersion: seed.structuralUnitVersion,
      resourceId: seed.resourceId,
      segmentRef: seed.segmentId,
      citationLocator: seed.locator ?? '',
    },
  };
}

function mutateContextField(
  base: CanonicalRagReleaseContext,
  field: keyof CanonicalRagReleaseContext,
): CanonicalRagReleaseContext {
  if (field === 'contextDigest') {
    return buildCandidateContextFingerprint({
      ...base,
      releaseHash: '9'.repeat(64),
    });
  }
  if (
    field === 'releaseHash'
    || field === 'sourceDatasetHash'
    || field === 'projectionDigest'
    || field === 'coverageSourceHash'
  ) {
    return buildCandidateContextFingerprint({
      ...base,
      [field]: '9'.repeat(64),
    });
  }
  if (field === 'coverageCaptureRevision') {
    return buildCandidateContextFingerprint({
      ...base,
      coverageCaptureRevision: 'a'.repeat(40),
    });
  }
  if (field === 'projectionId' || field === 'projectionProfile') {
    return buildCandidateContextFingerprint({
      ...base,
      [field]: `${base[field]}-mutated`,
    });
  }
  return buildCandidateContextFingerprint({
    ...base,
    [field]: `${String(base[field])}-mutated`,
  });
}

function validCutoverReceipt(
  overrides: Partial<RagCutoverAuthorityReceipt> = {},
): RagCutoverAuthorityReceipt {
  return {
    schemaVersion: 'act-rag-cutover-authority/v1',
    receiptId: 'cutover-receipt:test',
    releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
    releaseId: CURRENT_AGGREGATE_RELEASE_ID,
    releaseHash: 'a'.repeat(64),
    captureRevision: 'd'.repeat(40),
    authorityDigest: 'b'.repeat(64),
    activatedAt: '2026-07-30T00:00:00.000Z',
    ...overrides,
  };
}
