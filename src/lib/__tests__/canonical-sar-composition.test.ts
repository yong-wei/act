import { describe, expect, it, vi } from 'vitest';

import {
  assertBindingKindMatrix,
  assertCompleteAdapterSet,
  assertPinnedMatchesVersion,
  assertVerifiedSarBindingSet,
  buildFixtureBindingRecords,
  buildFixtureVersion,
  buildOfflineCompositionFixture,
  buildSarCompositionCacheKey,
  CANONICAL_SAR_FIXTURE_IDS,
  composeCanonicalSar,
  computeBindingSetDigest,
  createFiveSourceAdapterSet,
  evaluateBindingForTraversal,
  expectedSourceVersionClosure,
  isReviewedCrossNamespaceBinding,
  mergeVerifiedSarBindingSets,
  productionRetrievalUsesLegacy,
  projectReviewedKaqBindingsToSar,
  projectReviewedResourceBindingsToSar,
  qualifySarId,
  SarBindingCapabilityError,
  SarCutoverActivationError,
  selectSarAuthority,
  type SarCrossNamespaceBinding,
} from '@/lib/canonical-sar-composition';
import { mintVerifiedSarBindingSetForTests } from '@/lib/canonical-sar-composition/testing';
import * as bindingCapability from '@/lib/canonical-sar-composition/binding-capability';
import * as sarIndex from '@/lib/canonical-sar-composition';
import {
  generateKaqCanonicalBindings,
  isReviewedShadowBinding,
  reviewKaqCanonicalBinding,
} from '@/lib/canonical-kaq-binding';
import { mintVerifiedKaqPinnedContextForTests } from '@/lib/canonical-kaq-binding/testing';
import {
  assertGovernedResourceBindingResult,
  buildBindingPublicationGateContext,
  governResourceBindings,
  isGovernedResourceBindingResult,
} from '@/lib/aggregate-governance/resource-bindings';
import {
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
} from '@/lib/authoritative-knowledge/contracts';

function pinnedFor(version: ReturnType<typeof buildFixtureVersion>) {
  return mintVerifiedKaqPinnedContextForTests({
    releaseSetId: version.releaseSetId,
    releaseId: version.releaseId,
    releaseHash: version.releaseHash,
    sourceDatasetHash: version.sourceDatasetHash,
    deltaReceiptId: version.deltaReceiptId,
    coverageOverlayId: version.coverageOverlayId,
    coverageOverlayVersion: version.coverageOverlayVersion,
    coverageSourceHash: version.coverageSourceHash,
    coverageCaptureRevision: version.coverageCaptureRevision,
    admittedCanonicalIds: [
      CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
      CANONICAL_SAR_FIXTURE_IDS.transferFunction,
      CANONICAL_SAR_FIXTURE_IDS.rootLocus,
      CANONICAL_SAR_FIXTURE_IDS.bodePlot,
    ],
  });
}

function realReviewedKaq(version: ReturnType<typeof buildFixtureVersion>) {
  const pinned = pinnedFor(version);
  const generated = generateKaqCanonicalBindings({
    proposals: [
      {
        kaqRoleId: CANONICAL_SAR_FIXTURE_IDS.kaqRoleFeedback,
        targets: [
          {
            canonicalId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
            bindingRole: 'PRIMARY_IDENTITY',
            evidenceRefs: ['evidence:semantic-1'],
            semanticRationale: 'Primary identity alignment.',
            objectRevision: 'obj-rev:1',
          },
        ],
        rejectedAutoSources: ['legacy-id', 'same-name'],
      },
    ],
    pinned,
  });
  expect(generated.bindings.length).toBe(1);
  const accepted = reviewKaqCanonicalBinding(
    generated.bindings[0]!,
    {
      bindingId: generated.bindings[0]!.id,
      outcome: 'ACCEPT',
      reviewIdentity: 'issue-1114-reviewer',
      reviewRationale: 'Independent semantic review.',
    },
    pinned,
  );
  return { pinned, accepted };
}

describe('provenance: no public unrestricted seal/mint', () => {
  it('public index and binding-capability lack general production seal/mint', () => {
    expect('sealGovernedSarBindingSet' in sarIndex).toBe(false);
    expect('mintVerifiedSarBindingSet' in sarIndex).toBe(false);
    expect('mintVerifiedSarBindingSetForTests' in sarIndex).toBe(false);
    expect('sealGovernedSarBindingSet' in bindingCapability).toBe(false);
    expect('mintVerifiedSarBindingSet' in bindingCapability).toBe(false);
    // test-only mint exists on capability module but not public index
    expect(typeof bindingCapability.mintVerifiedSarBindingSetForTests).toBe('function');
  });
});

describe('provenance: KAQ reviewed bindings', () => {
  it('rejects clones that change canonicalId while keeping old id/evidence/review', () => {
    const version = buildFixtureVersion();
    const { pinned, accepted } = realReviewedKaq(version);
    expect(isReviewedShadowBinding(accepted, pinned)).toBe(true);
    expect(Object.isFrozen(accepted)).toBe(true);

    const forged = {
      ...accepted,
      canonicalId: CANONICAL_SAR_FIXTURE_IDS.rootLocus,
    };
    expect(isReviewedShadowBinding(forged, pinned)).toBe(false);

    const projected = projectReviewedKaqBindingsToSar({
      bindings: [forged as typeof accepted],
      pinned,
      version,
    });
    expect(projected.bindings).toHaveLength(0);

    // Hand-built ACCEPTED object rejected.
    const handBuilt = {
      ...accepted,
      id: 'hand-built',
    };
    expect(isReviewedShadowBinding(handBuilt as typeof accepted, pinned)).toBe(false);
  });

  it('projects only mint-registered reviewed KAQ bindings', () => {
    const version = buildFixtureVersion();
    const { pinned, accepted } = realReviewedKaq(version);
    const set = projectReviewedKaqBindingsToSar({
      bindings: [accepted],
      pinned,
      version,
    });
    expect(assertVerifiedSarBindingSet(set, version).bindings).toHaveLength(1);
    expect(set.bindings[0]!.toIdentity).toBe(CANONICAL_SAR_FIXTURE_IDS.feedbackLoop);
    expect(Object.isFrozen(set.bindings[0])).toBe(true);
  });
});

describe('provenance: resource BindingGovernanceResult', () => {
  const capture = {
    releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
    releaseId: CURRENT_AGGREGATE_RELEASE_ID,
    releaseHash: 'a'.repeat(64),
    sourceDatasetHash: 'b'.repeat(64),
    deltaReceiptId: 'delta-receipt:accepted-aggregate-v1',
    deltaOutputDigest: 'c'.repeat(64),
    deltaClassification: 'NO_OP_PACKAGING',
    captureRevision: 'e'.repeat(40),
    importCaptureRevision: 'e'.repeat(40),
    deltaCaptureRevision: 'e'.repeat(40),
    authoringRevision: 'e'.repeat(40),
    inventoryRunId: 'inventory:run-v1',
    dbWatermark: 'wm:v1',
    runtimeProjectionId: 'proj:ctkg-0-2-runtime',
    runtimeProjectionDigest: 'c'.repeat(64),
    structuralUnitIndexVersion: '1',
    coverageSourceHash: 'd'.repeat(64),
  };

  function realGovernedShadowResult() {
    const gate = buildBindingPublicationGateContext({
      capture,
      canonicalIndex: [{
        releaseSetId: capture.releaseSetId,
        releaseId: capture.releaseId,
        canonicalId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
        objectRevision: 'obj-rev:1',
        canonicalType: 'DomainConcept',
      }],
      validatedCrosswalks: [{
        id: 'xwalk-feedback',
        releaseId: capture.releaseId,
        canonicalId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
        resourceId: 'resource-feedback',
        structuralUnitId: 'unit-feedback',
        structuralUnitVersion: capture.captureRevision,
        structuralUnitHash: 'f'.repeat(64),
        segmentId: 'seg-feedback',
        resourceSegmentHash: '2'.repeat(64),
        inventoryRunId: capture.inventoryRunId,
        atomicResourceId: 'atomic-feedback',
        captureRevision: capture.captureRevision,
        validationDigest: 'v'.repeat(64),
        sourceEditionId: 'edition',
        sourceVersion: '1',
        evidenceContentHash: 'f'.repeat(64),
      }],
    });
    return governResourceBindings({
      capture,
      work: [{
        pairKey: [
          'resource-feedback',
          'unit-feedback',
          'seg-feedback',
          '2'.repeat(64),
        ].join('\u001f'),
        canonicalId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
        resourceId: 'resource-feedback',
        structuralUnitId: 'unit-feedback',
        segmentId: 'seg-feedback',
        action: 'review',
        reasons: ['fixture-review'],
      }],
      previousDecisions: [],
      canonicalIndex: [{
        releaseSetId: capture.releaseSetId,
        releaseId: capture.releaseId,
        canonicalId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
        objectRevision: 'obj-rev:1',
        canonicalType: 'DomainConcept',
      }],
      resourceIndex: [{
        resourceId: 'resource-feedback',
        structuralUnitId: 'unit-feedback',
        segmentId: 'seg-feedback',
        resourceSegmentHash: '2'.repeat(64),
        candidateCanonicalIds: [CANONICAL_SAR_FIXTURE_IDS.feedbackLoop],
        deterministicRole: 'EXPLAINS',
        evidenceIds: ['atomic-feedback'],
      }],
      generatorPromptVersion: 'aggregate-binding/v1',
      publicationGateContext: gate,
    });
  }

  it('projects real governResourceBindings SHADOW_PUBLISHED output; rejects clone/hand-built', () => {
    const version = buildFixtureVersion({
      releaseSetId: capture.releaseSetId,
      releaseId: capture.releaseId,
      releaseHash: capture.releaseHash,
      sourceDatasetHash: capture.sourceDatasetHash,
      deltaReceiptId: capture.deltaReceiptId,
      coverageCaptureRevision: capture.captureRevision,
      inventoryRunId: capture.inventoryRunId,
    });
    const pinned = pinnedFor(version);
    const result = realGovernedShadowResult();
    expect(isGovernedResourceBindingResult(result)).toBe(true);
    expect(assertGovernedResourceBindingResult(result).shadowPublishedCount).toBeGreaterThan(0);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.decisions)).toBe(true);
    if (result.decisions[0]) {
      expect(Object.isFrozen(result.decisions[0])).toBe(true);
    }

    const projected = projectReviewedResourceBindingsToSar({
      governanceResult: result,
      pinned,
      version,
    });
    expect(projected.bindings.length).toBeGreaterThan(0);
    expect(projected.bindings[0]!.kind).toBe('resource-canonical');
    expect(projected.bindings[0]!.toIdentity).toBe(CANONICAL_SAR_FIXTURE_IDS.feedbackLoop);

    // Result clone rejected.
    const clone = { ...result, decisions: result.decisions.map((d) => ({ ...d })) };
    expect(isGovernedResourceBindingResult(clone)).toBe(false);
    expect(() => assertGovernedResourceBindingResult(clone)).toThrow(/not a governResourceBindings/);
    expect(() =>
      projectReviewedResourceBindingsToSar({
        governanceResult: clone as typeof result,
        pinned,
        version,
      }),
    ).toThrow(/not a governResourceBindings/);

    // Hand-built result rejected.
    const handBuilt = {
      candidates: [],
      candidatesGenerated: 0,
      decisions: result.decisions.map((d) => ({ ...d })),
      pendingReviewCandidates: [],
      reusedDecisionIds: [],
      invalidated: [],
      reusable: [],
      revalidationReceipts: [],
      shadowPublishedCount: 1,
    };
    expect(() => assertGovernedResourceBindingResult(handBuilt)).toThrow();
  });
});

describe('path/learner: adapters only in production; no plain-object projectors', () => {
  it('has no production path/learner projector exports', () => {
    expect('projectGovernedPathBindingToSar' in sarIndex).toBe(false);
    expect('projectGovernedLearnerBindingToSar' in sarIndex).toBe(false);
    expect('projectReviewedPathBindingToSar' in sarIndex).toBe(false);
  });

  it('still queries path and learner adapters from explicit seeds', async () => {
    const fixture = buildOfflineCompositionFixture();
    const result = await composeCanonicalSar({
      seeds: [
        { id: CANONICAL_SAR_FIXTURE_IDS.pathNode, namespace: 'path' },
        { id: CANONICAL_SAR_FIXTURE_IDS.learnerSlice, namespace: 'learner-state' },
      ],
      scope: fixture.scope,
      version: fixture.version,
      bindings: mintVerifiedSarBindingSetForTests([], fixture.version),
      adapters: fixture.adapters,
      authorityConsumer: 'OFFLINE_EVAL',
      budget: { maxHops: 0 },
    });
    const ids = (result.projection?.nodes ?? []).map((n) => n.id);
    expect(ids).toContain(qualifySarId('path', CANONICAL_SAR_FIXTURE_IDS.pathNode));
    expect(ids).toContain(
      qualifySarId('learner-state', CANONICAL_SAR_FIXTURE_IDS.learnerSlice),
    );
  });
});

describe('immutable snapshot / TOCTOU', () => {
  it('freezes binding members; mutations cannot change sealed content or digest', async () => {
    const fixture = buildOfflineCompositionFixture();
    const set = fixture.bindings;
    expect(Object.isFrozen(set.bindings)).toBe(true);
    expect(Object.isFrozen(set.bindings[0])).toBe(true);

    const targetBefore = set.bindings[0]!.toIdentity;
    expect(() => {
      (set.bindings[0] as { toIdentity: string }).toIdentity =
        CANONICAL_SAR_FIXTURE_IDS.rootLocus;
    }).toThrow();
    expect(set.bindings[0]!.toIdentity).toBe(targetBefore);

    // Digest stable under attempted mutation.
    const digest = set.bindingSetDigest;
    expect(computeBindingSetDigest(set.bindings)).toBe(digest);

    // Compose after attempted mutation still uses frozen original target.
    const delayedAdapter = {
      ...fixture.adapters,
      repository: {
        ...fixture.adapters.repository,
        async query(input: Parameters<typeof fixture.adapters.repository.query>[0]) {
          // Attempt mutation while awaiting (TOCTOU window).
          try {
            (set.bindings[0] as { toIdentity: string }).toIdentity =
              CANONICAL_SAR_FIXTURE_IDS.rootLocus;
          } catch {
            // expected freeze
          }
          await Promise.resolve();
          return fixture.adapters.repository.query(input);
        },
      },
    };

    const result = await composeCanonicalSar({
      seeds: fixture.seeds,
      scope: fixture.scope,
      version: fixture.version,
      bindings: set,
      adapters: delayedAdapter,
      authorityConsumer: 'SHADOW_COMPARISON',
      budget: { maxHops: 1 },
    });
    expect(result.status).toBe('composed');
    expect(set.bindings[0]!.toIdentity).toBe(targetBefore);
    expect(result.projection!.cacheKey).toBe(
      buildSarCompositionCacheKey({
        seeds: fixture.seeds,
        scope: fixture.scope,
        budget: { maxHops: 1, maxPerSourceCandidates: 16, maxTotalCandidates: 48 },
        version: fixture.version,
        adapters: delayedAdapter,
        bindings: set,
      }),
    );
  });
});

describe('merge + raw set rejection preserved', () => {
  it('rejects forged/cloned merge inputs; merges valid sets; conflicts fail closed', () => {
    const fixture = buildOfflineCompositionFixture();
    const raw = buildFixtureBindingRecords(fixture.version, fixture.scope);
    expect(() =>
      mergeVerifiedSarBindingSets(
        [
          {
            schemaVersion: 'act-verified-sar-binding-set/v1',
            bindings: raw,
            bindingSetDigest: computeBindingSetDigest(raw),
            versionContextDigest: fixture.version.contextDigest,
          },
        ],
        fixture.version,
      ),
    ).toThrow(SarBindingCapabilityError);

    const clone = {
      ...fixture.bindings,
      bindings: fixture.bindings.bindings.map((b) => ({ ...b })),
    };
    expect(() =>
      mergeVerifiedSarBindingSets([clone], fixture.version),
    ).toThrow(SarBindingCapabilityError);

    const a = mintVerifiedSarBindingSetForTests(
      fixture.bindings.bindings.slice(0, 2),
      fixture.version,
    );
    const b = mintVerifiedSarBindingSetForTests(
      fixture.bindings.bindings.slice(2),
      fixture.version,
    );
    const merged = mergeVerifiedSarBindingSets([a, b], fixture.version);
    expect(merged.bindings.length).toBe(fixture.bindings.bindings.length);
    expect(Object.isFrozen(merged.bindings[0])).toBe(true);

    const conflict = mintVerifiedSarBindingSetForTests(
      fixture.bindings.bindings.map((row, i) =>
        i === 0 ? { ...row, evidenceDigest: '9'.repeat(64) } : row,
      ) as SarCrossNamespaceBinding[],
      fixture.version,
    );
    expect(() =>
      mergeVerifiedSarBindingSets([fixture.bindings, conflict], fixture.version),
    ).toThrow(/conflicting content/i);
  });
});

describe('P1-A complete governance fingerprint close', () => {
  it('fails closed when pinned and version share IDs but any capture/hash field drifts', () => {
    const version = buildFixtureVersion();
    const basePinned = pinnedFor(version);
    expect(() => assertPinnedMatchesVersion(basePinned, version)).not.toThrow();

    for (const field of [
      'sourceDatasetHash',
      'coverageSourceHash',
      'coverageCaptureRevision',
      'releaseHash',
      'deltaReceiptId',
    ] as const) {
      const driftedVersion = buildFixtureVersion({
        ...version,
        [field]:
          field === 'coverageCaptureRevision'
            ? 'f'.repeat(40)
            : '9'.repeat(64),
      });
      // Same releaseSetId/releaseId/overlay IDs — only the drifted field differs.
      expect(driftedVersion.releaseSetId).toBe(version.releaseSetId);
      expect(driftedVersion.releaseId).toBe(version.releaseId);
      expect(driftedVersion.coverageOverlayId).toBe(version.coverageOverlayId);
      expect(() => assertPinnedMatchesVersion(basePinned, driftedVersion)).toThrow(
        SarBindingCapabilityError,
      );
      expect(() => assertPinnedMatchesVersion(basePinned, driftedVersion)).toThrow(
        new RegExp(field),
      );
    }
  });

  it('hard-fails resource projector when governResourceBindings capture/inventory drifts', () => {
    // Real producer result under capture B.
    const captureB = {
      releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
      releaseId: CURRENT_AGGREGATE_RELEASE_ID,
      releaseHash: 'a'.repeat(64),
      sourceDatasetHash: 'b'.repeat(64),
      deltaReceiptId: 'delta-receipt:accepted-aggregate-v1',
      deltaOutputDigest: 'c'.repeat(64),
      deltaClassification: 'NO_OP_PACKAGING',
      captureRevision: 'f'.repeat(40),
      importCaptureRevision: 'f'.repeat(40),
      deltaCaptureRevision: 'f'.repeat(40),
      authoringRevision: 'f'.repeat(40),
      inventoryRunId: 'inventory:run-b',
      dbWatermark: 'wm:v1',
      runtimeProjectionId: 'proj:ctkg-0-2-runtime',
      runtimeProjectionDigest: 'c'.repeat(64),
      structuralUnitIndexVersion: '1',
      coverageSourceHash: 'd'.repeat(64),
    };
    const gate = buildBindingPublicationGateContext({
      capture: captureB,
      canonicalIndex: [{
        releaseSetId: captureB.releaseSetId,
        releaseId: captureB.releaseId,
        canonicalId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
        objectRevision: 'obj-rev:1',
        canonicalType: 'DomainConcept',
      }],
      validatedCrosswalks: [{
        id: 'xwalk-feedback-b',
        releaseId: captureB.releaseId,
        canonicalId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
        resourceId: 'resource-feedback',
        structuralUnitId: 'unit-feedback',
        structuralUnitVersion: captureB.captureRevision,
        structuralUnitHash: 'f'.repeat(64),
        segmentId: 'seg-feedback',
        resourceSegmentHash: '2'.repeat(64),
        inventoryRunId: captureB.inventoryRunId,
        atomicResourceId: 'atomic-feedback',
        captureRevision: captureB.captureRevision,
        validationDigest: 'v'.repeat(64),
        sourceEditionId: 'edition',
        sourceVersion: '1',
        evidenceContentHash: 'f'.repeat(64),
      }],
    });
    const governanceResult = governResourceBindings({
      capture: captureB,
      work: [{
        pairKey: [
          'resource-feedback',
          'unit-feedback',
          'seg-feedback',
          '2'.repeat(64),
        ].join('\u001f'),
        canonicalId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
        resourceId: 'resource-feedback',
        structuralUnitId: 'unit-feedback',
        segmentId: 'seg-feedback',
        action: 'review',
        reasons: ['fixture-review'],
      }],
      previousDecisions: [],
      canonicalIndex: [{
        releaseSetId: captureB.releaseSetId,
        releaseId: captureB.releaseId,
        canonicalId: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop,
        objectRevision: 'obj-rev:1',
        canonicalType: 'DomainConcept',
      }],
      resourceIndex: [{
        resourceId: 'resource-feedback',
        structuralUnitId: 'unit-feedback',
        segmentId: 'seg-feedback',
        resourceSegmentHash: '2'.repeat(64),
        candidateCanonicalIds: [CANONICAL_SAR_FIXTURE_IDS.feedbackLoop],
        deterministicRole: 'EXPLAINS',
        evidenceIds: ['atomic-feedback'],
      }],
      generatorPromptVersion: 'aggregate-binding/v1',
      publicationGateContext: gate,
    });
    expect(governanceResult.shadowPublishedCount).toBeGreaterThan(0);

    // SAR version + pinned share release/overlay IDs but use capture A (drift).
    const versionA = buildFixtureVersion({
      releaseSetId: captureB.releaseSetId,
      releaseId: captureB.releaseId,
      releaseHash: captureB.releaseHash,
      sourceDatasetHash: captureB.sourceDatasetHash,
      deltaReceiptId: captureB.deltaReceiptId,
      coverageSourceHash: captureB.coverageSourceHash,
      coverageCaptureRevision: 'e'.repeat(40),
      inventoryRunId: 'inventory:run-a',
    });
    const pinnedA = pinnedFor(versionA);
    expect(() =>
      projectReviewedResourceBindingsToSar({
        governanceResult,
        pinned: pinnedA,
        version: versionA,
      }),
    ).toThrow(SarBindingCapabilityError);
    expect(() =>
      projectReviewedResourceBindingsToSar({
        governanceResult,
        pinned: pinnedA,
        version: versionA,
      }),
    ).toThrow(/captureRevision|inventoryRunId/);

    // KAQ projector refuses sourceDatasetHash drift under full fingerprint.
    const version = buildFixtureVersion();
    const { pinned, accepted } = realReviewedKaq(version);
    const drifted = buildFixtureVersion({
      ...version,
      sourceDatasetHash: '9'.repeat(64),
    });
    expect(() =>
      projectReviewedKaqBindingsToSar({
        bindings: [accepted],
        pinned,
        version: drifted,
      }),
    ).toThrow(/sourceDatasetHash/);
  });
});

describe('P1-B shared total candidate budget for nodes and edges', () => {
  it('caps nodes+edges under maxTotalCandidates; no dangling traversable edges; keeps unsupported read-only', async () => {
    const version = buildFixtureVersion();
    const hubId = 'ctr:object:hub';
    const genericId = 'ctr:object:generic-readonly';
    const scope = {
      courseId: 'automatic-control',
      learningGoalId: 'control-correction',
      studentId: 'student-alpha',
      classId: 'class-demo',
      admittedCanonicalIds: Array.from({ length: 40 }, (_, i) => `ctr:object:n${i}`).concat([
        hubId,
        genericId,
      ]),
    };
    const neighborEdges = [
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `rel:hub-${i}`,
        predicate: 'has_component' as const,
        fromId: hubId,
        toId: `ctr:object:n${i}`,
        sourceIdentity: `repo-rel:hub-${i}`,
      })),
      {
        id: 'rel:hub-mentions-generic',
        predicate: 'mentions' as const,
        fromId: hubId,
        toId: genericId,
        sourceIdentity: 'repo-rel:hub-mentions-generic',
      },
    ];
    const records = [
      {
        id: hubId,
        objectType: 'DomainConcept',
        label: 'Hub',
        sourceIdentity: `repo:${hubId}`,
        neighborEdges,
      },
      {
        id: genericId,
        objectType: 'GenericStoredObject',
        label: 'Generic',
        sourceIdentity: `repo:${genericId}`,
      },
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `ctr:object:n${i}`,
        objectType: 'DomainConcept',
        label: `N${i}`,
        sourceIdentity: `repo:ctr:object:n${i}`,
      })),
    ];
    const adapters = createFiveSourceAdapterSet({
      version,
      repository: { records },
      kaq: { records: [] },
      resource: { records: [] },
      path: { records: [] },
      learnerState: { records: [] },
    });
    const maxTotal = 8;
    const runOnce = () => composeCanonicalSar({
      seeds: [{ id: hubId, namespace: 'repository' }],
      scope,
      version,
      bindings: mintVerifiedSarBindingSetForTests([], version),
      adapters,
      authorityConsumer: 'OFFLINE_EVAL',
      budget: {
        maxHops: 1,
        maxPerSourceCandidates: 50,
        maxTotalCandidates: maxTotal,
      },
    });
    const result = await runOnce();
    expect(result.status).toBe('composed');
    const proj = result.projection!;
    const nodes = proj.nodes.length + proj.readOnlyContext.length;
    const edges = proj.edges.length;
    expect(nodes + edges).toBeLessThanOrEqual(maxTotal);
    expect(proj.limitations).toContain('total-budget');

    // No dangling traversable edges: every traversable endpoint must be present.
    const nodeIds = new Set([
      ...proj.nodes.map((n) => n.id),
      ...proj.readOnlyContext.map((n) => n.id),
    ]);
    for (const edge of proj.edges) {
      if (!edge.supportedForTraversal) continue;
      expect(nodeIds.has(edge.fromId)).toBe(true);
      expect(nodeIds.has(edge.toId)).toBe(true);
    }

    // Unsupported predicate: when neighbor is already in the hit index (seeded),
    // record as read-only context without traversal — pre-patch semantics.
    const withNeighborSeed = await composeCanonicalSar({
      seeds: [
        { id: hubId, namespace: 'repository' },
        { id: genericId, namespace: 'repository' },
      ],
      scope,
      version,
      bindings: mintVerifiedSarBindingSetForTests([], version),
      adapters,
      authorityConsumer: 'OFFLINE_EVAL',
      budget: {
        maxHops: 1,
        maxPerSourceCandidates: 50,
        maxTotalCandidates: 100,
      },
    });
    const mentions = withNeighborSeed.projection!.edges.find(
      (e) => e.predicate === 'mentions',
    );
    expect(mentions?.supportedForTraversal).toBe(false);
    expect(mentions?.skipReason).toBe('unsupported-predicate');
    expect(
      withNeighborSeed.projection!.readOnlyContext.some(
        (n) => n.id === qualifySarId('repository', genericId),
      ),
    ).toBe(true);
    expect(
      withNeighborSeed.projection!.nodes.some(
        (n) => n.id === qualifySarId('repository', genericId),
      ),
    ).toBe(false);

    // Stable truncation under tight budget.
    const again = await runOnce();
    expect(
      again.projection!.nodes.length + again.projection!.readOnlyContext.length,
    ).toBe(nodes);
    expect(again.projection!.edges.length).toBe(edges);
  });
});

describe('preserved composition baselines', () => {
  it('composes five sources, Legacy production selector, scope and edge provenance', async () => {
    const fixture = buildOfflineCompositionFixture();
    assertCompleteAdapterSet(fixture.adapters);
    for (const binding of fixture.bindings.bindings) {
      expect(() => assertBindingKindMatrix(binding)).not.toThrow();
      expect(isReviewedCrossNamespaceBinding(binding, fixture.version)).toBe(true);
    }

    const result = await composeCanonicalSar({
      seeds: fixture.seeds,
      scope: fixture.scope,
      version: fixture.version,
      bindings: fixture.bindings,
      adapters: fixture.adapters,
      authorityConsumer: 'SHADOW_COMPARISON',
      budget: { maxHops: 1 },
      recordedAt: () => new Date('2026-07-20T00:00:00.000Z'),
    });
    expect(result.status).toBe('composed');
    expect(result.shadowEvidence!.recordedAt).toBe('2026-07-20T00:00:00.000Z');
    expect(result.shadowEvidence!.replacesProduction).toBe(false);

    const namespaces = new Set(
      result.projection!.nodes.map((n) => n.provenance.namespace),
    );
    for (const ns of [
      'repository',
      'kaq',
      'resource',
      'path',
      'learner-state',
    ] as const) {
      expect(namespaces.has(ns)).toBe(true);
    }

    // Distinct repository edge identities.
    const repoEdges = result.projection!.edges.filter((e) =>
      e.provenance.sourceIdentity.startsWith('repo-rel:'),
    );
    expect(new Set(repoEdges.map((e) => e.provenance.sourceIdentity)).size).toBeGreaterThan(1);

    // Outside-scope repository seed.
    const emptyScope = await composeCanonicalSar({
      seeds: [{ id: CANONICAL_SAR_FIXTURE_IDS.feedbackLoop, namespace: 'repository' }],
      scope: { ...fixture.scope, admittedCanonicalIds: [] },
      version: fixture.version,
      bindings: mintVerifiedSarBindingSetForTests([], fixture.version),
      adapters: fixture.adapters,
      authorityConsumer: 'OFFLINE_EVAL',
      budget: { maxHops: 0 },
    });
    expect(emptyScope.status).toBe('empty');
    expect(
      emptyScope.projection!.limitations.some((l) => l.includes('outside-scope:repository::')),
    ).toBe(true);

    // Learner scope isolation.
    const crossStudent = await composeCanonicalSar({
      seeds: [
        { id: CANONICAL_SAR_FIXTURE_IDS.learnerSlice, namespace: 'learner-state' },
      ],
      scope: { ...fixture.scope, studentId: 'student-beta' },
      version: fixture.version,
      bindings: fixture.bindings,
      adapters: fixture.adapters,
      authorityConsumer: 'OFFLINE_EVAL',
      budget: { maxHops: 1 },
    });
    expect(
      crossStudent.diagnostics.skippedBindings.some(
        (s) =>
          s.bindingId === 'sar-bind:learner:alpha-targets'
          && s.reason === 'outside-scope',
      ),
    ).toBe(true);

    expect(selectSarAuthority('PRODUCTION_RETRIEVAL').authority).toBe('LEGACY');
    expect(productionRetrievalUsesLegacy(selectSarAuthority('PRODUCTION_RETRIEVAL'))).toBe(
      true,
    );
    expect(() => selectSarAuthority('CUTOVER_ACTIVATION')).toThrow(
      SarCutoverActivationError,
    );

    const production = await composeCanonicalSar({
      seeds: fixture.seeds,
      scope: fixture.scope,
      version: fixture.version,
      bindings: fixture.bindings,
      adapters: fixture.adapters,
      authorityConsumer: 'PRODUCTION_RETRIEVAL',
    });
    expect(production.status).toBe('legacy-only');
  });

  it('namespace collision isolation and evaluateBinding namespace match', async () => {
    const fixture = buildOfflineCompositionFixture();
    const colliding = CANONICAL_SAR_FIXTURE_IDS.kaqCollidingLocalId;
    const result = await composeCanonicalSar({
      seeds: [
        { id: colliding, namespace: 'repository' },
        { id: colliding, namespace: 'kaq' },
      ],
      scope: fixture.scope,
      version: fixture.version,
      bindings: mintVerifiedSarBindingSetForTests([], fixture.version),
      adapters: fixture.adapters,
      authorityConsumer: 'OFFLINE_EVAL',
      budget: { maxHops: 0 },
    });
    expect(
      result.projection!.nodes.some((n) => n.id === qualifySarId('repository', colliding)),
    ).toBe(true);
    expect(
      result.projection!.nodes.some((n) => n.id === qualifySarId('kaq', colliding)),
    ).toBe(true);

    const path = fixture.bindings.bindings.find((b) => b.kind === 'path-canonical')!;
    expect(
      evaluateBindingForTraversal({
        binding: path,
        version: fixture.version,
        seed: { namespace: 'path', localId: path.fromIdentity },
        admittedCanonicalIds: fixture.scope.admittedCanonicalIds,
        scope: fixture.scope,
      }).allowed,
    ).toBe(true);
    expect(
      evaluateBindingForTraversal({
        binding: path,
        version: fixture.version,
        seed: { namespace: 'repository', localId: path.fromIdentity },
        admittedCanonicalIds: fixture.scope.admittedCanonicalIds,
        scope: fixture.scope,
      }).allowed,
    ).toBe(false);
  });

  it('test-only mint fails closed outside test env', () => {
    const fixture = buildOfflineCompositionFixture();
    vi.stubEnv('VITEST', '');
    vi.stubEnv('VITEST_WORKER_ID', '');
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(() =>
        mintVerifiedSarBindingSetForTests([], fixture.version),
      ).toThrow(/test-only/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('rejects raw binding arrays at compose', async () => {
    const fixture = buildOfflineCompositionFixture();
    const raw = buildFixtureBindingRecords(fixture.version, fixture.scope);
    const result = await composeCanonicalSar({
      seeds: fixture.seeds,
      scope: fixture.scope,
      version: fixture.version,
      bindings: raw as unknown as typeof fixture.bindings,
      adapters: fixture.adapters,
      authorityConsumer: 'SHADOW_COMPARISON',
    });
    expect(result.status).toBe('binding-set-rejected');
  });
});

describe('version identity mapping smoke', () => {
  it('path/learner releaseId is null in closed mapping', () => {
    const version = buildFixtureVersion();
    expect(expectedSourceVersionClosure('path', version).releaseId).toBeNull();
    expect(expectedSourceVersionClosure('learner-state', version).releaseId).toBeNull();
    expect(expectedSourceVersionClosure('repository', version).releaseId).toBe(
      version.releaseId,
    );
  });
});
