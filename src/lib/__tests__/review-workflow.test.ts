import { describe, expect, it } from 'vitest';

import {
  AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION,
  semanticAlignmentCandidateId,
} from '../aggregate-governance/act-crosswalk';
import {
  ALLOWED_BINDING_ROLES,
  assembleBindingFromReview,
  assembleCoverageFromReview,
  assembleCrosswalkFromReview,
  assertNoFinalSemanticOutcomes,
  bindingDecisionDigest,
  buildCrosswalkDerivedCandidateLookup,
  coverageDecisionDigest,
  crosswalkDecisionDigest,
  finalizeBindingWorklist,
  finalizeCoverageWorklist,
  finalizeCrosswalkWorklist,
  isBindingEligibleCrosswalkCandidate,
  type BindingReviewDecisionsDocument,
  type CoverageReviewDecisionsDocument,
  type CrosswalkCandidateEvidence,
  type CrosswalkReviewDecisionsDocument,
} from '../aggregate-governance/review-workflow';
import { runAggregateGovernance } from '../aggregate-governance/pipeline';
import {
  buildDispositionFromReview,
  computeCoverageSourceHash,
} from '../aggregate-governance/course-coverage';
import type {
  CaptureIdentity,
  CourseCoverageAuthoringOverlay,
  StructuralUnitIndexEntry,
} from '../aggregate-governance/contracts';

const AUTHORING = 'a'.repeat(40);
const DELTA = 'delta-receipt:test-1126-workflow';
const RELEASE_HASH = 'b'.repeat(64);
const REVIEWER = 'agent-review:grok:issue-1126-isolated-session:test';

function sampleCoverageWorklist() {
  const items = [
    {
      canonicalId: 'ctc:alpha',
      profile: {
        entityType: 'DomainConcept',
        conceptKind: 'theoretical_construct',
        semanticName: 'alpha',
        displayName: 'Alpha',
        description: 'forward path gain product',
      },
      evidenceCandidates: [
        {
          evidenceId: 'ev-profile-alpha',
          path: 'canonical-profile',
          selector: 'canonicalId:ctc:alpha',
          sourceHash: 'c'.repeat(64),
          kind: 'profile' as const,
          rank: 0,
          weight: 0,
          excerpt: 'canonicalId=ctc:alpha',
          excerptHash: 'd'.repeat(64),
        },
        {
          evidenceId: 'ev-node-alpha',
          path: 'course-content/authoring/knowledge/canonical-nodes.json',
          selector: 'node:alpha',
          sourceHash: 'e'.repeat(64),
          kind: 'canonical_node' as const,
          rank: 1,
          weight: 3,
          excerpt: 'Alpha | lesson=1-1',
          excerptHash: 'f'.repeat(64),
        },
      ],
      retrievalHints: [{ term: 'gain', rank: 0 }],
      itemInputDigest: '',
    },
    {
      canonicalId: 'ctc:beta',
      profile: {
        entityType: 'DomainConcept',
        conceptKind: 'theoretical_construct',
        semanticName: 'beta',
        displayName: 'Beta',
        description: 'unrelated frontier topic',
      },
      evidenceCandidates: [
        {
          evidenceId: 'ev-profile-beta',
          path: 'canonical-profile',
          selector: 'canonicalId:ctc:beta',
          sourceHash: '1'.repeat(64),
          kind: 'profile' as const,
          rank: 0,
          weight: 0,
          excerpt: 'canonicalId=ctc:beta',
          excerptHash: '2'.repeat(64),
        },
      ],
      retrievalHints: [],
      itemInputDigest: '',
    },
  ];
  return finalizeCoverageWorklist({
    schemaVersion: 'course-coverage-worklist/v1',
    generatorVersion: 'course-coverage-worklist-generator/v1',
    deltaReceiptId: DELTA,
    authoringRevision: AUTHORING,
    releaseSetId: 'rs-test',
    releaseId: 'rel-test',
    releaseHash: RELEASE_HASH,
    sourceDatasetHash: '3'.repeat(64),
    membershipCount: items.length,
    items,
  });
}

function sampleCrosswalkWorklist() {
  const groups = [
    {
      groupId: 'ctc:alpha',
      canonicalId: 'ctc:alpha',
      profile: {
        entityType: 'DomainConcept',
        conceptKind: null,
        semanticName: 'alpha',
        displayName: 'Alpha',
        description: 'forward path',
      },
      profileDigest: '4'.repeat(64),
      tripleKeys: [
        'ctc:alpha\u001fchunk:1\u001fcite:1',
        'ctc:alpha\u001fchunk:2\u001fcite:2',
      ],
      upstreams: [
        {
          publishedEntityId: 'ctc:alpha',
          retrievalChunkId: 'chunk:1',
          citationTargetId: 'cite:1',
        },
        {
          publishedEntityId: 'ctc:alpha',
          retrievalChunkId: 'chunk:2',
          citationTargetId: 'cite:2',
        },
      ],
      coverageRoleHint: null,
      coverageExcluded: false,
      candidates: [
        {
          candidateId: '5'.repeat(64),
          structuralUnitId: 'knowledge-card:alpha',
          structuralUnitVersion: AUTHORING,
          structuralUnitHash: '6'.repeat(64),
          resourceId: 'knowledge-card:alpha',
          segmentId: 'alpha',
          atomicResourceId: 'atomic:alpha',
          resourceSegmentHash: '6'.repeat(64),
          inventoryDisposition: 'INCLUDED' as const,
          reasonCodes: ['positive:pathEligible'] as string[],
          title: 'Alpha card',
          family: 'knowledge-card',
          sourcePath: 'course-content/runtime/knowledge/cards/nodes/alpha.md',
          sourceHash: '7'.repeat(64),
          sourceSelector: 'alpha',
          selectedJsonValue: null,
          sourceExcerpt: '# Alpha\nforward path gain',
          sourceExcerptHash: '8'.repeat(64),
          reviewAuditLocator: {
            status: 'agent-reviewed',
            reviewerId: 'r1',
            reviewBatchId: 'b1',
            reviewedSourceHash: 'sha256:7',
            reviewedVersionRef: 'v1',
          },
          graphNodeRefs: { knowledge: ['alpha'] },
          generatorRank: 0,
        },
      ],
      groupInputDigest: '',
    },
  ];
  return finalizeCrosswalkWorklist({
    schemaVersion: 'act-crosswalk-semantic-worklist/v2',
    generatorVersion: 'act-crosswalk-worklist-generator/v3',
    deltaReceiptId: DELTA,
    authoringRevision: AUTHORING,
    inventoryRunId: 'inventory:test',
    releaseSetId: 'rs-test',
    releaseId: 'rel-test',
    runtimeProjectionArtifactPath:
      'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
    runtimeProjectionArtifactHash: '9'.repeat(64),
    structuralIndexVersion: 'struct-index:test',
    objectTripleCount: 2,
    relationTripleCount: 0,
    groupCount: groups.length,
    groups,
  });
}

function sampleBindingWorklist() {
  const items = [
    {
      pairId: 'pair:alpha',
      canonicalId: 'ctc:alpha',
      resourceId: 'knowledge-card:alpha',
      structuralUnitId: 'knowledge-card:alpha',
      segmentId: 'alpha',
      resourceSegmentHash: '6'.repeat(64),
      atomicResourceId: 'atomic:alpha',
      profile: {
        entityType: 'DomainConcept',
        conceptKind: null,
        semanticName: 'alpha',
        displayName: 'Alpha',
        description: 'forward path',
      },
      resourceEvidence: {
        title: 'Alpha card',
        family: 'knowledge-card',
        sourcePath: 'course-content/runtime/knowledge/cards/nodes/alpha.md',
        sourceHash: '7'.repeat(64),
        sourceSelector: 'alpha',
        sourceExcerpt: '# Alpha',
        sourceExcerptHash: '8'.repeat(64),
        graphNodeRefs: { knowledge: ['alpha'] },
        reviewAuditLocator: {
          status: 'agent-reviewed',
          reviewerId: 'r1',
          reviewBatchId: 'b1',
          reviewedSourceHash: 'sha256:7',
        },
      },
      allowedRoles: [...ALLOWED_BINDING_ROLES],
      itemInputDigest: '',
    },
  ];
  return finalizeBindingWorklist({
    schemaVersion: 'act-resource-binding-worklist/v2',
    generatorVersion: 'act-resource-binding-worklist-generator/v1',
    deltaReceiptId: DELTA,
    authoringRevision: AUTHORING,
    inventoryRunId: 'inventory:test',
    crosswalkWorklistInputDigest: 'a1'.padEnd(64, '0'),
    crosswalkActiveReviewsDigest: 'a2'.padEnd(64, '0'),
    items,
  });
}

describe('review-workflow generator invariants', () => {
  it('finalized worklists never embed final semantic outcomes or roles', () => {
    const coverage = sampleCoverageWorklist();
    const crosswalk = sampleCrosswalkWorklist();
    const binding = sampleBindingWorklist();
    expect(() => assertNoFinalSemanticOutcomes(coverage, 'coverage')).not.toThrow();
    expect(() => assertNoFinalSemanticOutcomes(crosswalk, 'crosswalk')).not.toThrow();
    expect(() => assertNoFinalSemanticOutcomes(binding, 'binding')).not.toThrow();
    expect(JSON.stringify(coverage)).not.toMatch(/"role"\s*:\s*"formal_objective"/u);
    expect(JSON.stringify(crosswalk)).not.toMatch(/"outcome"\s*:/u);
    expect(JSON.stringify(binding)).not.toMatch(/"proposedRole"\s*:/u);
    expect(JSON.stringify(binding)).not.toMatch(/"suggestedRoles"\s*:/u);
    // Crosswalk worklist must not smuggle final review outcomes.
    expect(JSON.stringify(crosswalk)).not.toMatch(
      /"ACCEPT"|"REJECT"|"UNSUPPORTED"|"AMBIGUOUS"|"HIGH_IMPACT"/u,
    );
    expect(JSON.stringify(crosswalk)).not.toMatch(/"reviewIdentity"\s*:/u);
  });

  it('repeated finalize is byte-identical', () => {
    const a = JSON.stringify(sampleCoverageWorklist());
    const b = JSON.stringify(sampleCoverageWorklist());
    expect(a).toBe(b);
    expect(JSON.stringify(sampleCrosswalkWorklist()))
      .toBe(JSON.stringify(sampleCrosswalkWorklist()));
    expect(JSON.stringify(sampleBindingWorklist()))
      .toBe(JSON.stringify(sampleBindingWorklist()));
  });

  it('crosswalk candidates keep complete structural identity and excerpt hashes', () => {
    const worklist = sampleCrosswalkWorklist();
    const candidate = worklist.groups[0]!.candidates[0]!;
    expect(candidate.structuralUnitId).toBeTruthy();
    expect(candidate.structuralUnitVersion).toBe(AUTHORING);
    expect(candidate.structuralUnitHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(candidate.sourcePath).toContain('course-content/');
    expect(candidate.sourceExcerpt).toBeTruthy();
    expect(candidate.sourceExcerptHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(candidate.resourceId).toBeTruthy();
    expect(candidate.segmentId).toBeTruthy();
    expect(candidate.atomicResourceId).toBeTruthy();
    expect(candidate.resourceSegmentHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(candidate.inventoryDisposition).toBe('INCLUDED');
    expect(candidate.reasonCodes).toEqual(['positive:pathEligible']);
  });

  it('worklist digest binds inventory disposition and reasonCodes', () => {
    const base = sampleCrosswalkWorklist();
    const mutated = finalizeCrosswalkWorklist({
      ...base,
      groups: base.groups.map((group) => ({
        ...group,
        candidates: group.candidates.map((candidate) => ({
          ...candidate,
          inventoryDisposition: 'EXCLUDED' as const,
          reasonCodes: ['excluded:auditOnly'],
        })),
        groupInputDigest: '',
      })),
    });
    expect(mutated.inputDigest).not.toBe(base.inputDigest);
    expect(mutated.groups[0]!.groupInputDigest).not.toBe(base.groups[0]!.groupInputDigest);
  });

  it('binding eligibility requires INCLUDED and rejects EXCLUDED/UNRESOLVED', () => {
    const included: CrosswalkCandidateEvidence = sampleCrosswalkWorklist().groups[0]!.candidates[0]!;
    expect(isBindingEligibleCrosswalkCandidate(included)).toEqual({ eligible: true });

    expect(isBindingEligibleCrosswalkCandidate({
      ...included,
      inventoryDisposition: 'EXCLUDED',
    })).toEqual({
      eligible: false,
      reason: 'inventory-disposition:EXCLUDED',
    });

    expect(isBindingEligibleCrosswalkCandidate({
      ...included,
      inventoryDisposition: 'UNRESOLVED',
    })).toEqual({
      eligible: false,
      reason: 'inventory-disposition:UNRESOLVED',
    });

    expect(isBindingEligibleCrosswalkCandidate({
      ...included,
      resourceId: null,
    }).eligible).toBe(false);
  });
});

describe('coverage assembler', () => {
  it('assembles complete valid decisions deterministically', () => {
    const worklist = sampleCoverageWorklist();
    const decisions = worklist.items.map((item, index) => {
      const role = index === 0 ? 'formal_objective' as const : 'excluded_with_rationale' as const;
      const rationale = index === 0 ? null : 'No ACT curriculum evidence for this object.';
      const evidenceIds = item.evidenceCandidates.map((row) => row.evidenceId).slice(0, 1);
      const base = {
        canonicalId: item.canonicalId,
        role,
        rationale,
        evidenceIds,
        reviewIdentity: REVIEWER,
        reviewProvider: 'GROK' as const,
        reviewerPromptVersion: 'aggregate-coverage-isolated-review/v1',
      };
      return {
        ...base,
        decisionDigest: coverageDecisionDigest({
          itemInputDigest: item.itemInputDigest,
          ...base,
        }),
      };
    });
    const review: CoverageReviewDecisionsDocument = {
      schemaVersion: 'course-coverage-review-decisions/v1',
      worklistInputDigest: worklist.inputDigest,
      deltaReceiptId: DELTA,
      authoringRevision: AUTHORING,
      reviewProvider: 'GROK',
      reviewerIdentity: REVIEWER,
      reviewerPromptVersion: 'aggregate-coverage-isolated-review/v1',
      decisions,
    };
    const overlay = assembleCoverageFromReview({ worklist, review });
    expect(overlay.entries).toHaveLength(2);
    expect(overlay.entries.map((row) => row.canonicalId)).toEqual(['ctc:alpha', 'ctc:beta']);
    expect(overlay.sourceHash).toMatch(/^[a-f0-9]{64}$/u);
    // Deterministic re-assemble
    const overlay2 = assembleCoverageFromReview({ worklist, review });
    expect(overlay2).toEqual(overlay);
  });

  it('rejects missing/extra decisions, bad evidence, generator identity, stale digest', () => {
    const worklist = sampleCoverageWorklist();
    const item = worklist.items[0]!;
    const good = {
      canonicalId: item.canonicalId,
      role: 'formal_objective' as const,
      rationale: null,
      evidenceIds: [item.evidenceCandidates[0]!.evidenceId],
      reviewIdentity: REVIEWER,
      reviewProvider: 'GROK' as const,
      reviewerPromptVersion: 'aggregate-coverage-isolated-review/v1',
    };
    const goodDecision = {
      ...good,
      decisionDigest: coverageDecisionDigest({
        itemInputDigest: item.itemInputDigest,
        ...good,
      }),
    };

    // missing second decision
    expect(() => assembleCoverageFromReview({
      worklist,
      review: {
        schemaVersion: 'course-coverage-review-decisions/v1',
        worklistInputDigest: worklist.inputDigest,
        deltaReceiptId: DELTA,
        authoringRevision: AUTHORING,
        reviewProvider: 'GROK',
        reviewerIdentity: REVIEWER,
        reviewerPromptVersion: 'aggregate-coverage-isolated-review/v1',
        decisions: [goodDecision],
      },
    })).toThrow(/expected 2 decisions/u);

    // extra unknown id
    const beta = worklist.items[1]!;
    const betaBase = {
      canonicalId: beta.canonicalId,
      role: 'excluded_with_rationale' as const,
      rationale: 'excluded',
      evidenceIds: [beta.evidenceCandidates[0]!.evidenceId],
      reviewIdentity: REVIEWER,
      reviewProvider: 'GROK' as const,
      reviewerPromptVersion: 'aggregate-coverage-isolated-review/v1',
    };
    const betaDecision = {
      ...betaBase,
      decisionDigest: coverageDecisionDigest({
        itemInputDigest: beta.itemInputDigest,
        ...betaBase,
      }),
    };
    expect(() => assembleCoverageFromReview({
      worklist,
      review: {
        schemaVersion: 'course-coverage-review-decisions/v1',
        worklistInputDigest: worklist.inputDigest,
        deltaReceiptId: DELTA,
        authoringRevision: AUTHORING,
        reviewProvider: 'GROK',
        reviewerIdentity: REVIEWER,
        reviewerPromptVersion: 'aggregate-coverage-isolated-review/v1',
        decisions: [
          goodDecision,
          betaDecision,
          {
            ...goodDecision,
            canonicalId: 'ctc:evil',
          },
        ],
      },
    })).toThrow(/expected 2 decisions|unknown canonicalId/u);

    // evidence not in worklist
    expect(() => assembleCoverageFromReview({
      worklist,
      review: {
        schemaVersion: 'course-coverage-review-decisions/v1',
        worklistInputDigest: worklist.inputDigest,
        deltaReceiptId: DELTA,
        authoringRevision: AUTHORING,
        reviewProvider: 'GROK',
        reviewerIdentity: REVIEWER,
        reviewerPromptVersion: 'aggregate-coverage-isolated-review/v1',
        decisions: [
          {
            ...goodDecision,
            evidenceIds: ['not-in-worklist'],
            decisionDigest: coverageDecisionDigest({
              itemInputDigest: item.itemInputDigest,
              ...good,
              evidenceIds: ['not-in-worklist'],
            }),
          },
          betaDecision,
        ],
      },
    })).toThrow(/not present in worklist/u);

    // generator-as-reviewer
    expect(() => assembleCoverageFromReview({
      worklist,
      review: {
        schemaVersion: 'course-coverage-review-decisions/v1',
        worklistInputDigest: worklist.inputDigest,
        deltaReceiptId: DELTA,
        authoringRevision: AUTHORING,
        reviewProvider: 'GROK',
        reviewerIdentity: 'candidate-generator:unreviewed-heuristic-v1',
        reviewerPromptVersion: 'aggregate-coverage-isolated-review/v1',
        decisions: [
          {
            ...goodDecision,
            reviewIdentity: 'candidate-generator:unreviewed-heuristic-v1',
          },
          betaDecision,
        ],
      },
    })).toThrow(/non-production review identity|generator/u);

    // stale worklist digest
    expect(() => assembleCoverageFromReview({
      worklist,
      review: {
        schemaVersion: 'course-coverage-review-decisions/v1',
        worklistInputDigest: '0'.repeat(64),
        deltaReceiptId: DELTA,
        authoringRevision: AUTHORING,
        reviewProvider: 'GROK',
        reviewerIdentity: REVIEWER,
        reviewerPromptVersion: 'aggregate-coverage-isolated-review/v1',
        decisions: [goodDecision, betaDecision],
      },
    })).toThrow(/worklistInputDigest/u);
  });
});

describe('crosswalk assembler', () => {
  it('assembles group decisions onto every triple key', () => {
    const worklist = sampleCrosswalkWorklist();
    const group = worklist.groups[0]!;
    const base = {
      groupId: group.groupId,
      outcome: 'ACCEPT' as const,
      candidateId: group.candidates[0]!.candidateId,
      reviewIdentity: REVIEWER,
      reviewProvider: 'GROK' as const,
      reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
      rationale: 'Exact title and excerpt support the Canonical profile.',
    };
    const review: CrosswalkReviewDecisionsDocument = {
      schemaVersion: 'act-crosswalk-review-decisions/v1',
      worklistInputDigest: worklist.inputDigest,
      deltaReceiptId: DELTA,
      authoringRevision: AUTHORING,
      reviewProvider: 'GROK',
      reviewerIdentity: REVIEWER,
      reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
      decisions: [{
        ...base,
        decisionDigest: crosswalkDecisionDigest({
          groupInputDigest: group.groupInputDigest,
          ...base,
        }),
      }],
    };
    const active = assembleCrosswalkFromReview({ worklist, review });
    expect(Object.keys(active.reviews)).toHaveLength(2);
    expect(active.reviews[group.tripleKeys[0]!]!.outcome).toBe('ACCEPT');
    expect(active.reviews[group.tripleKeys[1]!]!.outcome).toBe('ACCEPT');
  });

  it('projects group ACCEPT to per-triple candidateIds and evidenceDigests', () => {
    // Same Canonical group, two distinct upstream triples. Group-level review
    // seals the representative worklist candidateId; assembly must derive a
    // production candidateId for each real upstream.
    const worklist = sampleCrosswalkWorklist();
    const group = worklist.groups[0]!;
    expect(group.tripleKeys).toHaveLength(2);
    expect(group.upstreams).toHaveLength(2);

    const unit = group.candidates[0]!;
    const base = {
      groupId: group.groupId,
      outcome: 'ACCEPT' as const,
      candidateId: unit.candidateId,
      reviewIdentity: REVIEWER,
      reviewProvider: 'GROK' as const,
      reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
      rationale: 'Group review accepts the structural unit for this Canonical profile.',
    };
    const active = assembleCrosswalkFromReview({
      worklist,
      review: {
        schemaVersion: 'act-crosswalk-review-decisions/v1',
        worklistInputDigest: worklist.inputDigest,
        deltaReceiptId: DELTA,
        authoringRevision: AUTHORING,
        reviewProvider: 'GROK',
        reviewerIdentity: REVIEWER,
        reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
        decisions: [{
          ...base,
          decisionDigest: crosswalkDecisionDigest({
            groupInputDigest: group.groupInputDigest,
            ...base,
          }),
        }],
      },
    });

    const key0 = group.tripleKeys[0]!;
    const key1 = group.tripleKeys[1]!;
    const up0 = group.upstreams.find((u) => (
      `${u.publishedEntityId}\u001f${u.retrievalChunkId}\u001f${u.citationTargetId}` === key0
    ))!;
    const up1 = group.upstreams.find((u) => (
      `${u.publishedEntityId}\u001f${u.retrievalChunkId}\u001f${u.citationTargetId}` === key1
    ))!;
    expect(up0.retrievalChunkId).not.toBe(up1.retrievalChunkId);

    const expected0 = semanticAlignmentCandidateId({
      upstream: up0,
      canonicalId: group.canonicalId,
      structuralUnitId: unit.structuralUnitId,
      structuralUnitHash: unit.structuralUnitHash,
      generatorPromptVersion: AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION,
    });
    const expected1 = semanticAlignmentCandidateId({
      upstream: up1,
      canonicalId: group.canonicalId,
      structuralUnitId: unit.structuralUnitId,
      structuralUnitHash: unit.structuralUnitHash,
      generatorPromptVersion: AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION,
    });
    expect(expected0).not.toBe(expected1);
    expect(active.reviews[key0]!.candidateId).toBe(expected0);
    expect(active.reviews[key1]!.candidateId).toBe(expected1);
    expect(active.reviews[key0]!.evidenceDigest).not.toBe(active.reviews[key1]!.evidenceDigest);
    // Worklist representative id must not be blindly copied to every triple.
    expect(active.reviews[key0]!.candidateId).not.toBe(unit.candidateId);
    expect(active.reviews[key1]!.candidateId).not.toBe(unit.candidateId);

    // Production path resolves each derived id (full-index) without
    // candidateId-not-in-index when the structural unit is present.
    const GOV = AUTHORING;
    const CAPTURE: CaptureIdentity = {
      captureRevision: GOV,
      // One clean ACT capture for all Git revision slots (import/delta/authoring).
      importCaptureRevision: GOV,
      deltaCaptureRevision: GOV,
      dbWatermark: '0/1',
      releaseSetId: 'rs-test',
      releaseId: 'rel-test',
      releaseHash: RELEASE_HASH,
      sourceDatasetHash: '3'.repeat(64),
      deltaReceiptId: DELTA,
      deltaOutputDigest: 'd'.repeat(64),
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      runtimeProjectionId: null,
      runtimeProjectionDigest: null,
      inventoryRunId: 'inventory:test',
      structuralUnitIndexVersion: 'struct-index:test',
      authoringRevision: GOV,
      coverageSourceHash: 'e'.repeat(64),
    };
    const unitEntry: StructuralUnitIndexEntry = {
      sourceEditionId: 'edition-test',
      sourceVersion: '1',
      structuralUnitId: unit.structuralUnitId,
      structuralUnitVersion: unit.structuralUnitVersion,
      structuralUnitHash: unit.structuralUnitHash,
      stableIds: [],
      contentHashes: [unit.structuralUnitHash],
      atomicResourceId: unit.atomicResourceId,
      resourceId: unit.resourceId,
      segmentId: unit.segmentId,
      resourceSegmentHash: unit.resourceSegmentHash,
      textPreviewDigest: 'f'.repeat(64),
      inventoryDisposition: 'INCLUDED',
      reasonCodes: ['positive:pathEligible'],
    };
    const disposition = buildDispositionFromReview({
      canonicalId: group.canonicalId,
      role: 'formal_objective',
      rationale: null,
      evidenceRefs: [`profile:${group.canonicalId}`],
      reviewIdentity: 'issue-1126-test-reviewer',
    });
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
      entries: [disposition],
    };
    const coverage: CourseCoverageAuthoringOverlay = {
      ...withoutHash,
      sourceHash: computeCoverageSourceHash(withoutHash),
    };
    const capture = {
      ...CAPTURE,
      coverageSourceHash: coverage.sourceHash,
      authoringRevision: coverage.authoringRevision,
    };
    const result = runAggregateGovernance({
      capture,
      observedCapture: { ...capture },
      hasGovernedCoverageBaseline: false,
      deltaClassification: 'SEMANTIC_CONTENT_UPDATE',
      currentCanonicalIds: [group.canonicalId],
      signals: [],
      upstreamReferences: [up0, up1],
      structuralUnitIndex: [unitEntry],
      coverageAuthoring: coverage,
      semanticReviews: {
        [key0]: {
          outcome: 'ACCEPT',
          reviewIdentity: REVIEWER,
          reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
          evidenceDigest: active.reviews[key0]!.evidenceDigest,
          rationale: active.reviews[key0]!.rationale,
          candidateId: active.reviews[key0]!.candidateId,
        },
        [key1]: {
          outcome: 'ACCEPT',
          reviewIdentity: REVIEWER,
          reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
          evidenceDigest: active.reviews[key1]!.evidenceDigest,
          rationale: active.reviews[key1]!.rationale,
          candidateId: active.reviews[key1]!.candidateId,
        },
      },
    });
    expect(result.publishedCrosswalks).toHaveLength(2);
    const units = result.publishedCrosswalks.map((row) => row.structuralUnitId).sort();
    expect(units).toEqual([unit.structuralUnitId, unit.structuralUnitId]);
    expect(result.unresolvedCrosswalkDiagnostics.filter((row) => (
      row.publishedEntityId === group.canonicalId
    ))).toHaveLength(0);
  });

  it('indexes representative and per-upstream derived candidateIds for binding lookup', () => {
    const worklist = sampleCrosswalkWorklist();
    const group = worklist.groups[0]!;
    const unit = group.candidates[0]!;
    const lookup = buildCrosswalkDerivedCandidateLookup(worklist.groups);

    // Representative worklist id remains resolvable.
    expect(lookup.get(unit.candidateId)).toEqual(unit);

    // Per-triple production ids (non-representative upstreams) resolve to the
    // same structural candidate evidence.
    const derivedIds = group.upstreams.map((upstream) => semanticAlignmentCandidateId({
      upstream,
      canonicalId: group.canonicalId,
      structuralUnitId: unit.structuralUnitId,
      structuralUnitHash: unit.structuralUnitHash,
      generatorPromptVersion: AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION,
    }));
    expect(new Set(derivedIds).size).toBe(2);
    for (const id of derivedIds) {
      const resolved = lookup.get(id);
      expect(resolved).toBeDefined();
      expect(resolved!.structuralUnitId).toBe(unit.structuralUnitId);
      expect(resolved!.structuralUnitHash).toBe(unit.structuralUnitHash);
      expect(resolved!.resourceId).toBe(unit.resourceId);
    }

    // Assembled active ACCEPT ids are fully covered by the lookup.
    const base = {
      groupId: group.groupId,
      outcome: 'ACCEPT' as const,
      candidateId: unit.candidateId,
      reviewIdentity: REVIEWER,
      reviewProvider: 'GROK' as const,
      reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
      rationale: 'Group accept for binding lookup coverage.',
    };
    const active = assembleCrosswalkFromReview({
      worklist,
      review: {
        schemaVersion: 'act-crosswalk-review-decisions/v1',
        worklistInputDigest: worklist.inputDigest,
        deltaReceiptId: DELTA,
        authoringRevision: AUTHORING,
        reviewProvider: 'GROK',
        reviewerIdentity: REVIEWER,
        reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
        decisions: [{
          ...base,
          decisionDigest: crosswalkDecisionDigest({
            groupInputDigest: group.groupInputDigest,
            ...base,
          }),
        }],
      },
    });
    for (const review of Object.values(active.reviews)) {
      expect(review.candidateId).toBeTruthy();
      expect(lookup.has(review.candidateId!)).toBe(true);
    }
  });

  it('fails closed when a derived candidateId maps to conflicting structural units', () => {
    const worklist = sampleCrosswalkWorklist();
    const group = worklist.groups[0]!;
    const unitA = group.candidates[0]!;
    // Formula binds id+hash (not capture version). Same id+hash with different
    // structuralUnitVersion still collides on derived candidateId while the
    // structural evidence key differs → fail closed.
    const unitB: CrosswalkCandidateEvidence = {
      ...unitA,
      candidateId: '9'.repeat(64),
      structuralUnitVersion: 'f'.repeat(40),
      generatorRank: 1,
    };
    expect(unitB.structuralUnitHash).toBe(unitA.structuralUnitHash);
    expect(unitB.structuralUnitVersion).not.toBe(unitA.structuralUnitVersion);
    expect(() => buildCrosswalkDerivedCandidateLookup([{
      canonicalId: group.canonicalId,
      upstreams: group.upstreams,
      candidates: [unitA, unitB],
    }])).toThrow(/conflicting structural units/u);
  });

  it('rejects invalid candidate, missing group, and generator identity', () => {
    const worklist = sampleCrosswalkWorklist();
    const group = worklist.groups[0]!;
    const base = {
      groupId: group.groupId,
      outcome: 'ACCEPT' as const,
      candidateId: '0'.repeat(64),
      reviewIdentity: REVIEWER,
      reviewProvider: 'GROK' as const,
      reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
      rationale: 'bad candidate',
    };
    expect(() => assembleCrosswalkFromReview({
      worklist,
      review: {
        schemaVersion: 'act-crosswalk-review-decisions/v1',
        worklistInputDigest: worklist.inputDigest,
        deltaReceiptId: DELTA,
        authoringRevision: AUTHORING,
        reviewProvider: 'GROK',
        reviewerIdentity: REVIEWER,
        reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
        decisions: [{
          ...base,
          decisionDigest: crosswalkDecisionDigest({
            groupInputDigest: group.groupInputDigest,
            ...base,
          }),
        }],
      },
    })).toThrow(/not in worklist/u);

    expect(() => assembleCrosswalkFromReview({
      worklist,
      review: {
        schemaVersion: 'act-crosswalk-review-decisions/v1',
        worklistInputDigest: worklist.inputDigest,
        deltaReceiptId: DELTA,
        authoringRevision: AUTHORING,
        reviewProvider: 'GROK',
        reviewerIdentity: 'heuristic-threshold-reviewer',
        reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
        decisions: [],
      },
    })).toThrow(/generator|heuristic/u);
  });

  it('invalidates prior crosswalk review when worklist inputDigest changes', () => {
    const worklist = sampleCrosswalkWorklist();
    const group = worklist.groups[0]!;
    const base = {
      groupId: group.groupId,
      outcome: 'UNSUPPORTED' as const,
      reviewIdentity: REVIEWER,
      reviewProvider: 'GROK' as const,
      reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
      rationale: 'No ACT structural unit supports this object.',
    };
    const review: CrosswalkReviewDecisionsDocument = {
      schemaVersion: 'act-crosswalk-review-decisions/v1',
      worklistInputDigest: worklist.inputDigest,
      deltaReceiptId: DELTA,
      authoringRevision: AUTHORING,
      reviewProvider: 'GROK',
      reviewerIdentity: REVIEWER,
      reviewerPromptVersion: 'aggregate-semantic-align-review/v1',
      decisions: [{
        ...base,
        decisionDigest: crosswalkDecisionDigest({
          groupInputDigest: group.groupInputDigest,
          ...base,
        }),
      }],
    };
    expect(() => assembleCrosswalkFromReview({ worklist, review })).not.toThrow();

    // Simulate regenerated worklist: candidates/evidence changed → digest drifts.
    const regenerated = finalizeCrosswalkWorklist({
      ...worklist,
      generatorVersion: 'act-crosswalk-worklist-generator/v3',
      groups: worklist.groups.map((row) => ({
        ...row,
        candidates: row.candidates.map((candidate) => ({
          ...candidate,
          sourceExcerpt: `${candidate.sourceExcerpt}\nregenerated-evidence`,
          sourceExcerptHash: 'f'.repeat(64),
        })),
        groupInputDigest: '',
      })),
    });
    expect(regenerated.inputDigest).not.toBe(worklist.inputDigest);
    expect(() => assembleCrosswalkFromReview({
      worklist: regenerated,
      review,
    })).toThrow(/worklistInputDigest/u);
  });
});

describe('binding assembler', () => {
  it('assembles ACCEPT with role and rejects role-less ACCEPT / bad evidence', () => {
    const worklist = sampleBindingWorklist();
    const item = worklist.items[0]!;
    const base = {
      pairId: item.pairId,
      outcome: 'ACCEPT' as const,
      proposedRole: 'EXPLAINS' as const,
      reviewIdentity: REVIEWER,
      reviewProvider: 'GROK' as const,
      reviewerPromptVersion: 'aggregate-binding-review/v1',
      evidenceIds: [item.resourceId, item.resourceSegmentHash],
      rationale: 'Resource excerpt teaches the Canonical object.',
    };
    const review: BindingReviewDecisionsDocument = {
      schemaVersion: 'act-resource-binding-review-decisions/v1',
      worklistInputDigest: worklist.inputDigest,
      deltaReceiptId: DELTA,
      authoringRevision: AUTHORING,
      reviewProvider: 'GROK',
      reviewerIdentity: REVIEWER,
      reviewerPromptVersion: 'aggregate-binding-review/v1',
      decisions: [{
        ...base,
        decisionDigest: bindingDecisionDigest({
          itemInputDigest: item.itemInputDigest,
          ...base,
        }),
      }],
    };
    const active = assembleBindingFromReview({ worklist, review });
    expect(active.reviews[item.pairId]!.proposedRole).toBe('EXPLAINS');
    expect(active.summary.candidates).toBe(1);

    expect(() => assembleBindingFromReview({
      worklist,
      review: {
        ...review,
        decisions: [{
          ...base,
          proposedRole: undefined,
          decisionDigest: bindingDecisionDigest({
            itemInputDigest: item.itemInputDigest,
            ...base,
            proposedRole: undefined,
          }),
        }],
      },
    })).toThrow(/proposedRole/u);

    expect(() => assembleBindingFromReview({
      worklist,
      review: {
        ...review,
        decisions: [{
          ...base,
          evidenceIds: ['not-present'],
          decisionDigest: bindingDecisionDigest({
            itemInputDigest: item.itemInputDigest,
            ...base,
            evidenceIds: ['not-present'],
          }),
        }],
      },
    })).toThrow(/not present in worklist/u);
  });
});
