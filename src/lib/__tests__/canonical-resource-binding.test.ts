import { describe, expect, it, vi } from 'vitest';

import {
  applyHumanDecision,
  applyPublicationGates,
  buildDeterministicDecision,
  buildResourceBindingInventory,
  buildReviewerInput,
  canonicalCandidateId,
  canonicalSha256,
  evaluateCanonicalResourceCutoverReadiness,
  generateCandidatesForCanonicalChanges,
  generateCandidatesForResourceChanges,
  generatorDecision,
  invalidateChangedResourcePairs,
  normalizeSha256,
  runIndependentReview,
  runtimeProjectionObservation,
  resolveGeneratedPublicationAggregate,
  selectResourceKnowledgeAuthority,
  sha256,
  toPublicResourceBindingInventory,
  type CanonicalObjectIndexEntry,
  type CanonicalResourceBindingCandidate,
  type CanonicalResourceBindingDecision,
  type PublicationGateContext,
  type ResourceInventoryObservation,
  type ResourceSegmentIndexEntry,
} from '@/lib/canonical-resource-binding';
import { loadRuntimeResourceProjectionInputs } from '@/lib/teacher-resource-node-data';

const captureRevision = 'a'.repeat(40);
const capturedAt = '2026-07-28T12:00:00.000Z';
const dbWatermark = '0/ABC';
const segmentHash = sha256('segment');

function observation(
  id: string,
  overrides: Partial<ResourceInventoryObservation> = {},
): ResourceInventoryObservation {
  return {
    sourceObservationId: `source:${id}`,
    sourceKind: 'TeachingResource',
    sourceAvailable: true,
    captureRevision,
    capturedAt,
    dbWatermark,
    atomicResourceId: `TeachingResource:${id}`,
    resourceId: id,
    structuralUnitId: `resource:${id}`,
    segmentId: `resource:${id}:base`,
    resourceSegmentHash: segmentHash,
    positiveSignals: {},
    exclusionSignals: {},
    dispositionDeclared: false,
    ...overrides,
  };
}

const canonicalObject: CanonicalObjectIndexEntry = {
  releaseSetId: 'release-set',
  releaseId: 'release',
  canonicalId: 'canonical',
  objectRevision: 'object-revision',
  canonicalType: 'DomainConcept',
};

const resourceSegment: ResourceSegmentIndexEntry = {
  resourceId: 'resource',
  structuralUnitId: 'structural-unit',
  segmentId: 'segment',
  resourceSegmentHash: segmentHash,
  candidateCanonicalIds: ['canonical'],
  deterministicRole: 'EXPLAINS',
  evidenceIds: ['evidence'],
};

function candidate(): CanonicalResourceBindingCandidate {
  return generateCandidatesForCanonicalChanges({
    changedObjects: [canonicalObject],
    resourceIndex: [resourceSegment],
    generatorPromptVersion: 'generator-v1',
  }).candidates[0]!;
}

function gateContext(
  overrides: Partial<PublicationGateContext> = {},
): PublicationGateContext {
  const crosswalkBase = {
    releaseId: 'release',
    evidenceId: 'evidence',
    evidenceContentHash: sha256('evidence'),
    inventoryRunId: 'inventory-run',
    atomicResourceId: 'atomic-resource',
    resourceId: 'resource',
    structuralUnitId: 'structural-unit',
    segmentId: 'segment',
    resourceSegmentHash: segmentHash,
    captureRevision,
    canonicalId: 'canonical',
  };
  return {
    captureIdentity: {
      inventoryRunId: crosswalkBase.inventoryRunId,
      captureRevision: crosswalkBase.captureRevision,
      structuralUnitVersion: crosswalkBase.captureRevision,
    },
    canonicalObjects: [canonicalObject],
    crosswalks: [{
      id: 'crosswalk',
      ...crosswalkBase,
      sourceEditionId: 'source-edition',
      sourceVersion: 'source-v1',
      structuralUnitVersion: captureRevision,
      structuralUnitHash: segmentHash,
      validationState: 'VALIDATED',
      validationDigest: canonicalSha256(crosswalkBase),
    }],
    evidenceAlignments: [{
      releaseId: 'release',
      evidenceId: 'evidence',
      canonicalId: 'canonical',
    }],
    existingPublished: [],
    ...overrides,
  };
}

function acceptedDecision(
  overrides: Partial<CanonicalResourceBindingDecision> = {},
): CanonicalResourceBindingDecision {
  const deterministic = buildDeterministicDecision({
    candidate: candidate(),
    evidenceDigest: sha256('evidence'),
    context: gateContext(),
  });
  return {
    ...deterministic,
    reviewProvider: 'GPT',
    reviewState: 'ACCEPTED',
    publicationState: 'CANDIDATE',
    crosswalkId: null,
    validationDigest: null,
    ...overrides,
  };
}

describe('canonical resource inventory', () => {
  it('classifies explicit inclusion, exclusion, and unresolved observations', () => {
    const inventory = buildResourceBindingInventory([
      observation('published', {
        positiveSignals: { published: true },
        dispositionDeclared: true,
      }),
      observation('paused', {
        positiveSignals: { currentlyDelivered: true },
        dispositionDeclared: true,
      }),
      observation('audit', {
        exclusionSignals: { auditOnly: true },
        dispositionDeclared: true,
      }),
      observation('unknown'),
    ]);
    expect(inventory.items.map((item) => [item.resourceId, item.disposition])).toEqual([
      ['audit', 'EXCLUDED'],
      ['paused', 'INCLUDED'],
      ['published', 'INCLUDED'],
      ['unknown', 'UNRESOLVED'],
    ]);
    expect(inventory.complete).toBe(true);
    expect(inventory.cutoverReady).toBe(false);
  });

  it('keeps logical inventory identity stable across capture receipt retries', () => {
    const first = buildResourceBindingInventory([observation('stable', {
      positiveSignals: { published: true },
      dispositionDeclared: true,
    })]);
    const retry = buildResourceBindingInventory([observation('stable', {
      capturedAt: '2026-07-28T12:05:00.000Z',
      dbWatermark: '0/DEF',
      positiveSignals: { published: true },
      dispositionDeclared: true,
    })]);
    expect(retry.runId).toBe(first.runId);
    expect(retry.sourceHash).toBe(first.sourceHash);
    expect(retry.items[0]?.observationDigest).toBe(first.items[0]?.observationDigest);
    const changed = buildResourceBindingInventory([observation('stable', {
      resourceSegmentHash: sha256('changed-segment'),
      positiveSignals: { published: true },
      dispositionDeclared: true,
    })]);
    expect(changed.runId).not.toBe(first.runId);
  });

  it('accepts bare and prefixed hashes without inferring publication from lifecycleScope', () => {
    expect(normalizeSha256(segmentHash)).toBe(segmentHash);
    expect(normalizeSha256(`sha256:${segmentHash}`)).toBe(segmentHash);
    const row = runtimeProjectionObservation({
      projection: {
        id: 'row',
        title: 'row',
        resourceType: 'knowledge_card',
        sourceKind: 'runtime_lesson_step',
        sourceRef: 'row',
        sourcePathOrUrl: null,
        sourceRecord: null,
        sourceHash: `sha256:${segmentHash}`,
        sourceVersionRef: 'v1',
        projectionLevel: 'ResourceNode',
        lifecycleScope: 'runtime',
      },
      captureRevision,
      capturedAt,
      dbWatermark,
    });
    expect(row.sourceAvailable).toBe(true);
    expect(row.positiveSignals?.published).toBeUndefined();
    expect(row.dispositionDeclared).toBe(false);
  });

  it('includes exactly the two audited current path targets in the real runtime artifact', async () => {
    const projections = await loadRuntimeResourceProjectionInputs({ allowMissing: false });
    const observations = projections.map((projection) => runtimeProjectionObservation({
      projection,
      captureRevision,
      capturedAt,
      dbWatermark,
    }));
    const auditedPaths = observations.filter((row) => row.positiveSignals?.pathEligible);
    expect(auditedPaths).toHaveLength(2);
    const inventory = buildResourceBindingInventory(observations);
    for (const path of auditedPaths) {
      expect(inventory.items.find((item) => item.atomicResourceId === path.atomicResourceId))
        .toMatchObject({ disposition: 'INCLUDED' });
    }
    expect(inventory.items).toHaveLength(projections.length);
    expect(inventory.items.every((item) => item.reasonCodes.length > 0)).toBe(true);
  });

  it('aggregates placement references and publishes privacy-minimized revision evidence', () => {
    const inventory = buildResourceBindingInventory([observation('resource', {
      positiveSignals: { published: true },
      dispositionDeclared: true,
      placementRefs: ['lesson-b', 'lesson-a'],
      publicationRevision: {
        id: 'publication',
        revisionNumber: 2,
        manifestHash: sha256('manifest'),
        contentHash: sha256('content'),
      },
    })]);
    expect(inventory.items[0]?.sourceObservations[0]).toMatchObject({
      placementRefs: ['lesson-a', 'lesson-b'],
      publicationRevisionDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(JSON.stringify(toPublicResourceBindingInventory(inventory))).not.toContain('rawPrompt');
  });

  it('uses LessonItem/Plan publication identity and exposes conflicting revisions', () => {
    const lessonItemPublication = {
      id: 'lesson-item-publication',
      revisionNumber: 1,
      manifestHash: sha256('lesson-manifest'),
      contentHash: sha256('lesson-content'),
    };
    expect(resolveGeneratedPublicationAggregate([null, lessonItemPublication])).toEqual({
      published: true,
      publicationRevision: lessonItemPublication,
      conflictReasonCodes: [],
    });
    const conflict = resolveGeneratedPublicationAggregate([
      lessonItemPublication,
      { ...lessonItemPublication, id: 'plan-publication', revisionNumber: 2 },
    ]);
    expect(conflict).toMatchObject({
      published: true,
      publicationRevision: null,
      conflictReasonCodes: ['generated-publication-revision-conflict'],
    });
    const inventory = buildResourceBindingInventory([observation('conflict', {
      positiveSignals: { published: true },
      dispositionDeclared: true,
      conflictReasonCodes: conflict.conflictReasonCodes,
    })]);
    expect(inventory.items[0]).toMatchObject({
      disposition: 'UNRESOLVED',
      reasonCodes: ['generated-publication-revision-conflict'],
    });
  });
});

describe('incremental candidate and review pipeline', () => {
  it('uses one stable pair identity but distinct versioned decision attempts', async () => {
    const byCanonical = candidate();
    const byResource = generateCandidatesForResourceChanges({
      changedSegments: [resourceSegment],
      canonicalIndex: [canonicalObject],
      generatorPromptVersion: 'generator-v1',
    }).candidates[0]!;
    expect(byResource.pairId).toBe(byCanonical.pairId);
    expect(canonicalCandidateId(byResource)).toBe(byCanonical.pairId);
    const generated = generatorDecision(byCanonical, {
      proposedRole: 'EXPLAINS',
      evidenceDigest: sha256('evidence'),
      evidenceIds: ['evidence'],
      highImpactReasons: [],
    });
    const reviewInput = {
      candidate: byCanonical,
      generatorDecision: generated,
      canonicalProfile: {
        canonicalId: 'canonical',
        canonicalType: 'DomainConcept',
        semanticProfile: 'profile',
      },
      resourceSegment: {
        structuralUnitId: 'structural-unit',
        segmentId: 'segment',
        contentHash: segmentHash,
        content: 'segment',
      },
      reviewerPromptVersion: 'reviewer-v1',
      review: vi.fn().mockRejectedValue(new Error('retry')),
    } as const;
    const first = await runIndependentReview({ ...reviewInput, attemptSequence: 1 });
    const second = await runIndependentReview({
      ...reviewInput,
      attemptSequence: 2,
      supersedesDecisionId: first.id,
    });
    expect(first.pairId).toBe(second.pairId);
    expect(first.id).not.toBe(second.id);
    expect(second.supersedesDecisionId).toBe(first.id);
    const regenerated = generateCandidatesForCanonicalChanges({
      changedObjects: [canonicalObject],
      resourceIndex: [resourceSegment],
      generatorPromptVersion: 'generator-v1',
      previousDecisions: [first],
    });
    expect(regenerated.candidates).toHaveLength(1);
  });

  it('keeps same-name Canonical Objects distinct across Releases on resource changes', () => {
    const secondRelease = {
      ...canonicalObject,
      releaseId: 'release-2',
      objectRevision: 'object-revision-2',
    };
    const generated = generateCandidatesForResourceChanges({
      changedSegments: [resourceSegment],
      canonicalIndex: [canonicalObject, secondRelease],
      generatorPromptVersion: 'generator-v1',
    });
    expect(generated.candidates
      .map((row) => [row.releaseId, row.canonicalId])
      .sort(([left], [right]) => left.localeCompare(right))).toEqual([
        ['release', 'canonical'],
        ['release-2', 'canonical'],
      ]);
    expect(new Set(generated.candidates.map((row) => row.pairId))).toHaveLength(2);
  });

  it('reuses decisions only when reviewer prompt and whitelist input identity are unchanged', async () => {
    const row = candidate();
    const generated = generatorDecision(row, {
      proposedRole: 'EXPLAINS',
      evidenceDigest: sha256('evidence'),
      evidenceIds: ['evidence'],
      highImpactReasons: [],
    });
    const decision = await runIndependentReview({
      candidate: row,
      generatorDecision: generated,
      canonicalProfile: {
        canonicalId: 'canonical',
        canonicalType: 'DomainConcept',
        semanticProfile: 'profile',
      },
      resourceSegment: {
        structuralUnitId: 'structural-unit',
        segmentId: 'segment',
        contentHash: segmentHash,
        content: 'segment',
      },
      reviewerPromptVersion: 'reviewer-v1',
      review: async () => ({ outcome: 'ACCEPT', provider: 'GPT' }),
    });
    const reviewerIdentity = {
      pairId: row.pairId,
      reviewerPromptVersion: decision.reviewerPromptVersion,
      reviewerInputDigest: decision.reviewerInputDigest,
    };
    const unchanged = generateCandidatesForCanonicalChanges({
      changedObjects: [canonicalObject],
      resourceIndex: [resourceSegment],
      generatorPromptVersion: 'generator-v1',
      previousDecisions: [decision],
      reviewerIdentities: [reviewerIdentity],
    });
    expect(unchanged).toEqual({
      candidates: [],
      reusedDecisionIds: [decision.id],
    });
    const changedPrompt = generateCandidatesForCanonicalChanges({
      changedObjects: [canonicalObject],
      resourceIndex: [resourceSegment],
      generatorPromptVersion: 'generator-v1',
      previousDecisions: [decision],
      reviewerIdentities: [{
        ...reviewerIdentity,
        reviewerPromptVersion: 'reviewer-v2',
      }],
    });
    expect(changedPrompt.candidates).toHaveLength(1);
    expect(changedPrompt.reusedDecisionIds).toEqual([]);
    const changedPromptDecision = await runIndependentReview({
      candidate: changedPrompt.candidates[0]!,
      generatorDecision: generatorDecision(changedPrompt.candidates[0]!, {
        proposedRole: 'EXPLAINS',
        evidenceDigest: sha256('evidence'),
        evidenceIds: ['evidence'],
        highImpactReasons: [],
      }),
      canonicalProfile: {
        canonicalId: 'canonical',
        canonicalType: 'DomainConcept',
        semanticProfile: 'profile',
      },
      resourceSegment: {
        structuralUnitId: 'structural-unit',
        segmentId: 'segment',
        contentHash: segmentHash,
        content: 'segment',
      },
      reviewerPromptVersion: 'reviewer-v2',
      supersedesDecisionId: decision.id,
      review: async () => ({ outcome: 'ACCEPT', provider: 'GPT' }),
    });
    expect(changedPromptDecision.id).not.toBe(decision.id);
    expect(changedPromptDecision.supersedesDecisionId).toBe(decision.id);
    const changedInput = generateCandidatesForCanonicalChanges({
      changedObjects: [canonicalObject],
      resourceIndex: [resourceSegment],
      generatorPromptVersion: 'generator-v1',
      previousDecisions: [decision],
      reviewerIdentities: [{
        ...reviewerIdentity,
        reviewerInputDigest: sha256('changed-reviewer-input'),
      }],
    });
    expect(changedInput.candidates).toHaveLength(1);
    expect(changedInput.reusedDecisionIds).toEqual([]);
  });

  it('rejects extended or cross-candidate reviewer inputs and binds full cache input', async () => {
    const row = candidate();
    const generated = generatorDecision(row, {
      proposedRole: 'EXPLAINS',
      evidenceDigest: sha256('evidence'),
      evidenceIds: ['evidence'],
      highImpactReasons: [],
    });
    expect(() => buildReviewerInput({
      candidate: row,
      generatorDecision: { ...generated, rawPrompt: 'forbidden' } as never,
      canonicalProfile: {
        canonicalId: 'canonical',
        canonicalType: 'DomainConcept',
        semanticProfile: 'profile',
      },
      resourceSegment: {
        structuralUnitId: 'structural-unit',
        segmentId: 'segment',
        contentHash: segmentHash,
        content: 'segment',
      },
    })).toThrow(/forbidden fields/u);
    expect(() => buildReviewerInput({
      candidate: row,
      generatorDecision: generated,
      canonicalProfile: {
        canonicalId: 'other',
        canonicalType: 'DomainConcept',
        semanticProfile: 'profile',
      },
      resourceSegment: {
        structuralUnitId: 'structural-unit',
        segmentId: 'segment',
        contentHash: segmentHash,
        content: 'segment',
      },
    })).toThrow(/does not match candidate/u);
    const decision = await runIndependentReview({
      candidate: row,
      generatorDecision: generated,
      canonicalProfile: {
        canonicalId: 'canonical',
        canonicalType: 'DomainConcept',
        semanticProfile: 'profile',
      },
      resourceSegment: {
        structuralUnitId: 'structural-unit',
        segmentId: 'segment',
        contentHash: segmentHash,
        content: 'segment',
      },
      reviewerPromptVersion: 'reviewer-v1',
      review: async () => ({ outcome: 'ACCEPT', provider: 'GPT' }),
    });
    expect(decision.reviewerCacheKey).not.toBe(decision.generatorCacheKey);
    expect(decision).toMatchObject({
      reviewerRole: 'INDEPENDENT_REVIEWER',
      highImpactPolicyVersion: 'binding-impact/v1',
    });
  });

  it('invalidates only changed resource hashes', () => {
    const unchanged = acceptedDecision();
    const other = acceptedDecision({
      id: 'other',
      pairId: 'other-pair',
      resourceId: 'other-resource',
      structuralUnitId: 'other-unit',
      segmentId: 'other-segment',
    });
    const result = invalidateChangedResourcePairs([unchanged, other], [{
      ...resourceSegment,
      resourceSegmentHash: sha256('changed'),
    }]);
    expect(result.invalidated.map((row) => row.id)).toEqual([unchanged.id]);
    expect(result.reusable.map((row) => row.id)).toEqual(['other']);
  });
});

describe('publication, human, and authority gates', () => {
  it('binds publication to the exact validated crosswalk endpoint', () => {
    const published = applyPublicationGates(acceptedDecision(), gateContext());
    expect(published).toMatchObject({
      publicationState: 'SHADOW_PUBLISHED',
      crosswalkId: 'crosswalk',
      inventoryRunId: 'inventory-run',
      captureRevision,
      structuralUnitVersion: captureRevision,
      validationDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    const blocked = applyPublicationGates(acceptedDecision(), gateContext({
      crosswalks: gateContext().crosswalks.map((row) => ({
        ...row,
        segmentId: 'other-segment',
      })),
    }));
    expect(blocked).toMatchObject({
      publicationState: 'HUMAN_REQUIRED',
      highImpactReasons: expect.arrayContaining(['crosswalk-not-unique']),
    });
    const current = gateContext().crosswalks[0]!;
    const historical = {
      ...current,
      id: 'historical-crosswalk',
      inventoryRunId: 'historical-inventory-run',
      captureRevision: 'b'.repeat(40),
      structuralUnitVersion: 'b'.repeat(40),
    };
    const currentCapture = applyPublicationGates(acceptedDecision(), gateContext({
      crosswalks: [historical, current],
    }));
    expect(currentCapture).toMatchObject({
      publicationState: 'SHADOW_PUBLISHED',
      crosswalkId: current.id,
      inventoryRunId: current.inventoryRunId,
      captureRevision: current.captureRevision,
      structuralUnitVersion: current.structuralUnitVersion,
    });
    const currentAmbiguous = applyPublicationGates(acceptedDecision(), gateContext({
      crosswalks: [
        current,
        {
          ...current,
          id: 'current-capture-duplicate',
          sourceVersion: 'source-v2',
        },
      ],
    }));
    expect(currentAmbiguous).toMatchObject({
      publicationState: 'HUMAN_REQUIRED',
      highImpactReasons: expect.arrayContaining(['crosswalk-not-unique']),
    });
    const historicalOnly = applyPublicationGates(acceptedDecision(), gateContext({
      crosswalks: [historical],
    }));
    expect(historicalOnly).toMatchObject({
      publicationState: 'HUMAN_REQUIRED',
      highImpactReasons: expect.arrayContaining(['crosswalk-not-unique']),
    });
    const ambiguous = applyPublicationGates(acceptedDecision(), gateContext({
      evidenceAlignments: [
        ...gateContext().evidenceAlignments,
        {
          releaseId: 'release',
          evidenceId: 'evidence',
          canonicalId: 'other-canonical',
        },
      ],
    }));
    expect(ambiguous).toMatchObject({
      publicationState: 'HUMAN_REQUIRED',
      highImpactReasons: expect.arrayContaining(['evidence-alignment-not-unique']),
    });
  });

  it('retains deterministic reasons in a new human decision attempt', () => {
    const disputed = acceptedDecision({
      reviewProvider: 'FIXTURE',
      reviewState: 'HUMAN_REQUIRED',
      publicationState: 'HUMAN_REQUIRED',
      highImpactReasons: ['fixture-review-not-authoritative'],
    });
    const accepted = applyHumanDecision({
      decision: disputed,
      outcome: 'ACCEPT',
      context: gateContext(),
    });
    expect(accepted.id).not.toBe(disputed.id);
    expect(accepted).toMatchObject({
      supersedesDecisionId: disputed.id,
      reviewProvider: 'HUMAN',
      publicationState: 'SHADOW_PUBLISHED',
      highImpactReasons: ['fixture-review-not-authoritative'],
    });
  });

  it('allows distinct canonical bindings but blocks duplicate current pair-role rows', () => {
    const inventory = buildResourceBindingInventory([observation('resource', {
      resourceId: 'resource',
      structuralUnitId: 'structural-unit',
      segmentId: 'segment',
      positiveSignals: { published: true },
      dispositionDeclared: true,
    })]);
    const first = acceptedDecision({ publicationState: 'SHADOW_PUBLISHED' });
    const second = acceptedDecision({
      id: 'second',
      pairId: 'other-canonical-pair',
      canonicalId: 'other-canonical',
      publicationState: 'SHADOW_PUBLISHED',
    });
    expect(evaluateCanonicalResourceCutoverReadiness({
      inventory,
      decisions: [
        first,
        second,
        { ...first, id: 'historical', lifecycleState: 'SUPERSEDED' },
      ],
    }).blockers).toEqual([]);
    expect(evaluateCanonicalResourceCutoverReadiness({
      inventory,
      decisions: [first, { ...first, id: 'duplicate' }],
    }).blockers).toContainEqual({
      atomicResourceId: 'TeachingResource:resource',
      code: 'binding-non-unique',
    });
  });

  it('uses only current shadow publications for readiness coverage', () => {
    const inventory = buildResourceBindingInventory([observation('resource', {
      resourceId: 'resource',
      structuralUnitId: 'structural-unit',
      segmentId: 'segment',
      positiveSignals: { published: true },
      dispositionDeclared: true,
    })]);
    const published = acceptedDecision({ publicationState: 'SHADOW_PUBLISHED' });
    const unpublished = (overrides: Partial<CanonicalResourceBindingDecision>) => acceptedDecision({
      id: `unpublished-${overrides.reviewState}`,
      pairId: `unpublished-pair-${overrides.reviewState}`,
      canonicalId: `unpublished-canonical-${overrides.reviewState}`,
      ...overrides,
    });

    expect(evaluateCanonicalResourceCutoverReadiness({
      inventory,
      decisions: [
        published,
        unpublished({
          reviewState: 'ACCEPTED',
          publicationState: 'CANDIDATE',
        }),
        unpublished({
          reviewState: 'REJECTED',
          publicationState: 'CANDIDATE',
        }),
        unpublished({
          reviewState: 'REVIEW_RETRYABLE',
          publicationState: 'REVIEW_RETRYABLE',
        }),
        unpublished({
          reviewProvider: 'FIXTURE',
          reviewState: 'HUMAN_REQUIRED',
          publicationState: 'HUMAN_REQUIRED',
        }),
      ],
    }).blockers).toEqual([]);

    expect(evaluateCanonicalResourceCutoverReadiness({
      inventory,
      decisions: [unpublished({
        reviewState: 'ACCEPTED',
        publicationState: 'CANDIDATE',
      })],
    }).blockers).toContainEqual({
      atomicResourceId: 'TeachingResource:resource',
      code: 'binding-not-shadow-published',
    });

    expect(evaluateCanonicalResourceCutoverReadiness({
      inventory,
      decisions: [{
        ...published,
        reviewProvider: 'FIXTURE',
      }],
    }).blockers).toContainEqual({
      atomicResourceId: 'TeachingResource:resource',
      code: 'fixture-review',
    });
  });

  it('keeps all formal consumers on Legacy', () => {
    for (const consumer of [
      'FORMAL_RECOMMENDATION',
      'FORMAL_PATH',
      'FORMAL_EVIDENCE',
    ] as const) {
      expect(selectResourceKnowledgeAuthority(consumer)).toMatchObject({
        authority: 'LEGACY',
        canonicalBindingsVisible: false,
      });
    }
  });
});
