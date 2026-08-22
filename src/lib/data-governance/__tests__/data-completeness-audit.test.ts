import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildResourceNodeRegistry, buildResourceSemanticProjection } from '@/lib/resource-node-registry';
import { buildResourceNodeRegistryFromTeachingResources } from '@/lib/teacher-resource-node-data';
import {
  buildDataCompletenessAuditReport,
  renderDataCompletenessAuditMarkdown,
  type DataCompletenessDocumentGradingAuditInput,
  type DataCompletenessDocumentRubricDraftInput,
  type DataCompletenessLearningFactInput,
} from '../data-completeness-audit';
import { pseudonymousAuditId } from '../math-document-grading-contracts';
import type { LearningEvidenceCorpusChunk } from '../learning-evidence-rag-corpus';

function workbenchSourceEventId(runId: string, criterionId: string, rubricVersion: string) {
  return `grading:${[runId, criterionId, rubricVersion].map(encodeURIComponent).join(':')}`;
}

function approvedWorkbenchDraft(
  overrides: Partial<DataCompletenessDocumentRubricDraftInput> = {},
): DataCompletenessDocumentRubricDraftInput {
  return {
    id: 'draft-approved-1',
    ownerUserId: 'student-1',
    reviewerState: 'approved',
    runId: 'run-1',
    rubricId: 'rubric-1',
    rubricVersion: 'rubric-v1',
    approvedCriterionIds: ['criterion-1'],
    ...overrides,
  };
}

function pipelineSourceEventId(runId: string, criterionId: string, rubricVersion: string) {
  return `adaptive-assessment:document-rubric-grading:${[runId, criterionId, rubricVersion].map(encodeURIComponent).join(':')}`;
}

function teacherReviewDigest(value: string, field: string) {
  return pseudonymousAuditId(`${field}:${value}`, `teacher-review:${field}`);
}

function approvedPipelineAudit(
  overrides: Partial<DataCompletenessDocumentGradingAuditInput> = {},
): DataCompletenessDocumentGradingAuditInput {
  const sourceEventId = pipelineSourceEventId('run-1', 'criterion-1', 'sha256:question');
  return {
    id: 'audit-1',
    action: 'grading-run.teacher-reviewed',
    resourceType: 'GradingRun',
    resourceId: 'run-1',
    decision: 'approved',
    rubricVersion: 'sha256:question',
    sourceEventDigests: [teacherReviewDigest(sourceEventId, 'source-event')],
    criterionDigests: [teacherReviewDigest('criterion-1', 'criterion')],
    ...overrides,
  };
}

function pipelineFact(
  overrides: Partial<DataCompletenessLearningFactInput> = {},
): DataCompletenessLearningFactInput {
  return {
    id: 'fact-document-grading-1',
    userId: 'student-1',
    factType: 'document_rubric_grading',
    sourceEventId: pipelineSourceEventId('run-1', 'criterion-1', 'sha256:question'),
    sourceLogId: 'audit-1',
    contextJson: { gradingRunId: 'run-1', criterionId: 'criterion-1', rubricVersion: 'sha256:question' },
    ...overrides,
  };
}

function approvedPipelineRun() {
  return { id: 'run-1', state: 'APPROVED', rubricVersion: 'sha256:question', studentId: 'student-1', assessments: [{ criterionId: 'criterion-1' }] };
}

function workbenchFact(
  overrides: Partial<DataCompletenessLearningFactInput> = {},
): DataCompletenessLearningFactInput {
  return {
    id: 'workbench-fact-1',
    userId: 'student-1',
    factType: 'document_rubric_grading',
    sourceEventId: workbenchSourceEventId('run-1', 'criterion-1', 'rubric-v1'),
    sourceLogId: 'draft-approved-1',
    contextJson: {
      gradingRunId: 'run-1',
      rubricId: 'rubric-1',
      rubricVersion: 'rubric-v1',
      criterionId: 'criterion-1',
    },
    ...overrides,
  };
}

describe('data completeness audit', () => {
  it('accepts governed document-rubric grading source events without dangling lineage', () => {
    const report = buildDataCompletenessAuditReport({
      generatedAt: '2026-07-14T00:00:00.000Z',
      learningFacts: [pipelineFact()],
      documentGradingRuns: [approvedPipelineRun()],
      documentGradingAudits: [approvedPipelineAudit()],
    });
    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceEvents).toBe(0);
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'learning-fact-source-event-dangling' })]));
  });

  it('rejects forged or missing document-rubric grading lineage', () => {
    for (const documentGradingRuns of [[], [{ id: 'run-1', state: 'AWAITING_REVIEW', rubricVersion: 'rubric-v1', studentId: 'other-student', assessments: [{ criterionId: 'other-criterion' }] }]]) {
      const report = buildDataCompletenessAuditReport({
        learningFacts: [pipelineFact({ id: 'forged-fact', sourceLogId: null })],
        documentGradingRuns,
      });
      expect(report.layers.find((layer) => layer.id === 'evidenceLineage')?.totals.danglingLearningFactSourceEvents).toBe(1);
    }
  });

  it.each([
    ['rejects a missing pipeline audit anchor', pipelineFact({ sourceLogId: null }), [approvedPipelineAudit()], 1],
    ['rejects a tampered pipeline sourceLogId', pipelineFact({ sourceLogId: 'audit-forged-1' }), [approvedPipelineAudit()], 1],
    ['rejects a pipeline audit for another run', pipelineFact(), [approvedPipelineAudit({ resourceId: 'run-2' })], 1],
    ['rejects a non-teacher-reviewed pipeline audit action', pipelineFact(), [approvedPipelineAudit({ action: 'grading-run.created' })], 1],
    ['rejects a pipeline audit that is not approved', pipelineFact(), [approvedPipelineAudit({ decision: 'returned' })], 1],
    ['rejects a mismatched pipeline source-event digest', pipelineFact(), [approvedPipelineAudit({ sourceEventDigests: [teacherReviewDigest('forged-source', 'source-event')] })], 1],
    ['rejects a mismatched pipeline criterion digest', pipelineFact(), [approvedPipelineAudit({ criterionDigests: [teacherReviewDigest('criterion-2', 'criterion')] })], 1],
  ])('%s', (_label, learningFact, documentGradingAudits, expectedDanglingEvents) => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [learningFact],
      documentGradingRuns: [approvedPipelineRun()],
      documentGradingAudits,
    });
    expect(report.layers.find((layer) => layer.id === 'evidenceLineage')?.totals.danglingLearningFactSourceEvents).toBe(expectedDanglingEvents);
  });

  it.each([
    ['accepts an approved workbench draft anchor', [approvedWorkbenchDraft()], workbenchFact(), 0],
    ['rejects a missing workbench draft', [], workbenchFact(), 1],
    ['rejects a mismatched workbench sourceLogId', [approvedWorkbenchDraft()], workbenchFact({ sourceLogId: 'draft-forged-1' }), 1],
    ['rejects a workbench draft owned by another learner', [approvedWorkbenchDraft({ ownerUserId: 'student-2' })], workbenchFact(), 1],
    ['rejects a workbench draft that is not approved', [approvedWorkbenchDraft({ reviewerState: 'pending' })], workbenchFact(), 1],
    ['rejects a mismatched workbench criterion', [approvedWorkbenchDraft()], workbenchFact({
      sourceEventId: workbenchSourceEventId('run-1', 'criterion-2', 'rubric-v1'),
      contextJson: { gradingRunId: 'run-1', rubricId: 'rubric-1', rubricVersion: 'rubric-v1', criterionId: 'criterion-2' },
    }), 1],
    ['rejects a mismatched workbench rubric', [approvedWorkbenchDraft()], workbenchFact({
      contextJson: { gradingRunId: 'run-1', rubricId: 'rubric-forged', rubricVersion: 'rubric-v1', criterionId: 'criterion-1' },
    }), 1],
    ['rejects a mismatched workbench rubric version', [approvedWorkbenchDraft()], workbenchFact({
      sourceEventId: workbenchSourceEventId('run-1', 'criterion-1', 'rubric-v2'),
      contextJson: { gradingRunId: 'run-1', rubricId: 'rubric-1', rubricVersion: 'rubric-v2', criterionId: 'criterion-1' },
    }), 1],
  ])('%s', (_label, documentRubricDrafts, learningFact, expectedDanglingEvents) => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [learningFact],
      documentRubricDrafts,
    });
    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceEvents).toBe(expectedDanglingEvents);
  });

  it('reports graph, resource, citation, path, lineage, and learner readiness separately', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'sim-controller',
        label: 'Controller tuning simulation',
        type: 'SIMULATION_APP',
        launchTarget: '/sim/controller',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          evidenceInstrumentation: ['InteractionLog:simulation_finish'],
          privacyLevel: 'student-visible',
          readiness: {
            minimumCompetency: {},
            minimumEvidenceCount: 1,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            unlockMessage: 'Ready for controlled simulation.',
            fallbackNodeIds: [],
          },
        },
      }],
    });

    const report = buildDataCompletenessAuditReport({
      generatedAt: '2026-07-02T00:00:00.000Z',
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'controller correction',
        description: 'Controller correction concept.',
        tags: ['correction'],
        resources: ['resource:sim-controller'],
        isActive: true,
        sourceLinkCount: 1,
        targetLinkCount: 1,
      }],
      teachingResources: [{
        id: 'resource-1',
        title: 'Controller resource',
        registryId: 'sim-controller',
        knowledgeNodeIds: ['kn-controller'],
      }],
      resourceRegistry: registry,
      evidenceCorpus: [],
      interactionLogs: [],
      eventDictionaryTypes: [],
      learningEventBatches: [],
      learningFacts: [],
      learnerCandidates: [],
    });

    expect(report.layers.map((layer) => layer.id)).toEqual([
      'graphCore',
      'resourceBinding',
      'resourceDisposition',
      'citationReadiness',
      'pathReadiness',
      'evidenceLineage',
      'learnerFixtureReadiness',
    ]);
    expect(report.layers.find((layer) => layer.id === 'resourceDisposition')?.totals).toMatchObject({
      resourceNodes: 1,
      missingDisposition: 1,
    });
    expect(report.layers.find((layer) => layer.id === 'citationReadiness')?.totals).toMatchObject({
      citationTargets: 1,
      resolvableCitationTargets: 1,
    });
    expect(report.layers.find((layer) => layer.id === 'pathReadiness')?.totals).toMatchObject({
      resourceNodes: 1,
      planningUnits: 1,
    });
    expect(report).not.toHaveProperty('score');
  });

  it('reports declared TeachingResource registryIds that are not registered', () => {
    const teachingResources = [{
      id: 'resource-typo',
      title: 'Typo resource',
      type: 'INTERACTIVE_COMP',
      registryId: 'sim-controller-typo',
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'Controller correction',
        resources: [],
        tags: ['correction'],
      }],
    }];
    const registry = buildResourceNodeRegistryFromTeachingResources(teachingResources, [{
      id: 'sim-controller',
      label: 'Controller tuning simulation',
      type: 'SIMULATION_APP',
      launchTarget: '/sim/controller',
      knowledgeNodeIds: ['kn-controller'],
    }]);
    const report = buildDataCompletenessAuditReport({
      teachingResources,
      resourceRegistry: registry,
    });

    const resourceBinding = report.layers.find((layer) => layer.id === 'resourceBinding');
    expect(resourceBinding?.severity).toBe('blocked');
    expect(resourceBinding?.totals.teachingResourcesUnregisteredRegistry).toBe(1);
    expect(resourceBinding?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'teaching-resource-registry-unregistered',
        stableRef: 'TeachingResource:resource-typo',
      }),
    ]));
  });

  it('treats reviewed graph resource gaps as explained instead of missing refs', () => {
    const report = buildDataCompletenessAuditReport({
      generatedAt: '2026-07-05T00:00:00.000Z',
      knowledgeNodes: [{
        id: 'kn-reviewed-gap',
        name: 'Reviewed gap node',
        description: 'A graph node whose current resource gap has been reviewed.',
        tags: ['reviewed-gap'],
        resources: [],
        isActive: true,
        sourceLinkCount: 1,
        targetLinkCount: 1,
      }],
      reviewedGraphResourceCoverage: [{
        graphNodeId: 'kn-reviewed-gap',
        decision: 'reviewed-limitation',
        limitationCategory: 'resource-not-yet-authored',
        coverageRole: 'explicit-gap',
        reviewerVisibleRationale: 'No existing reviewed resource should be attached until a dedicated node card is authored.',
        sourceVersionRef: 'graph-resource-coverage-overlay.v1',
        sourceHash: hashGraphResourceCoverageTestNode({
          id: 'kn-reviewed-gap',
          name: 'Reviewed gap node',
          description: 'A graph node whose current resource gap has been reviewed.',
          tags: ['reviewed-gap'],
        }),
      }],
    });

    const graphCore = report.layers.find((layer) => layer.id === 'graphCore');
    expect(graphCore?.totals.missingResourceRefs).toBe(0);
    expect(graphCore?.totals.reviewedResourceGaps).toBe(1);
    expect(graphCore?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'graph-node-resource-missing',
        stableRef: 'KnowledgeNode:kn-reviewed-gap',
      }),
    ]));
  });

  it('does not hide graph resource gaps when reviewed overlay is malformed', () => {
    const report = buildDataCompletenessAuditReport({
      knowledgeNodes: [{
        id: 'kn-malformed-gap',
        name: 'Malformed gap node',
        description: 'A graph node with malformed reviewed coverage.',
        tags: ['reviewed-gap'],
        resources: [],
        isActive: true,
        sourceLinkCount: 1,
        targetLinkCount: 1,
      }],
      reviewedGraphResourceCoverage: [{
        graphNodeId: 'kn-malformed-gap',
        decision: 'reviewed-limitation',
        limitationCategory: '',
        coverageRole: 'explicit-gap',
        reviewerVisibleRationale: 'This row is missing its actionable limitation category.',
        sourceVersionRef: 'graph-resource-coverage-overlay.v1',
        sourceHash: hashGraphResourceCoverageTestNode({
          id: 'kn-malformed-gap',
          name: 'Malformed gap node',
          description: 'A graph node with malformed reviewed coverage.',
          tags: ['reviewed-gap'],
        }),
      }],
    });

    const graphCore = report.layers.find((layer) => layer.id === 'graphCore');
    expect(graphCore?.totals.missingResourceRefs).toBe(1);
    expect(graphCore?.totals.reviewedResourceGaps).toBe(0);
    expect(graphCore?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'graph-node-resource-missing',
        stableRef: 'KnowledgeNode:kn-malformed-gap',
      }),
    ]));
  });

  it('does not hide graph resource gaps when reviewed overlay source hash is stale', () => {
    const report = buildDataCompletenessAuditReport({
      knowledgeNodes: [{
        id: 'kn-stale-gap',
        name: 'Stale gap node',
        description: 'A graph node whose reviewed coverage no longer matches.',
        tags: ['reviewed-gap'],
        resources: [],
        isActive: true,
        sourceLinkCount: 1,
        targetLinkCount: 1,
      }],
      reviewedGraphResourceCoverage: [{
        graphNodeId: 'kn-stale-gap',
        decision: 'reviewed-limitation',
        limitationCategory: 'resource-not-yet-authored',
        coverageRole: 'explicit-gap',
        reviewerVisibleRationale: 'This row was reviewed against an older graph node snapshot.',
        sourceVersionRef: 'graph-resource-coverage-overlay.v1',
        sourceHash: 'sha256:stale',
      }],
    });

    const graphCore = report.layers.find((layer) => layer.id === 'graphCore');
    expect(graphCore?.totals.missingResourceRefs).toBe(1);
    expect(graphCore?.totals.reviewedResourceGaps).toBe(0);
    expect(graphCore?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'graph-node-resource-missing',
        stableRef: 'KnowledgeNode:kn-stale-gap',
      }),
    ]));
  });

  it('does not count reviewed limitation rows when the graph node now has resources', () => {
    const report = buildDataCompletenessAuditReport({
      knowledgeNodes: [{
        id: 'kn-resource-bound',
        name: 'Resource bound node',
        description: 'A graph node that gained a reviewed resource ref.',
        tags: ['reviewed-gap'],
        resources: [{ resourceId: 'resource:bound' }],
        isActive: true,
        sourceLinkCount: 1,
        targetLinkCount: 1,
      }],
      reviewedGraphResourceCoverage: [{
        graphNodeId: 'kn-resource-bound',
        decision: 'reviewed-limitation',
        limitationCategory: 'resource-not-yet-authored',
        coverageRole: 'explicit-gap',
        reviewerVisibleRationale: 'This row used to explain a resource gap before the node was bound.',
        sourceVersionRef: 'graph-resource-coverage-overlay.v1',
        sourceHash: hashGraphResourceCoverageTestNode({
          id: 'kn-resource-bound',
          name: 'Resource bound node',
          description: 'A graph node that gained a reviewed resource ref.',
          tags: ['reviewed-gap'],
          resources: [{ resourceId: 'resource:bound' }],
        }),
      }],
    });

    const graphCore = report.layers.find((layer) => layer.id === 'graphCore');
    expect(graphCore?.totals.missingResourceRefs).toBe(0);
    expect(graphCore?.totals.reviewedResourceGaps).toBe(0);
  });

  it('does not hide graph resource gaps when reviewed limitation coverage role is not explicit-gap', () => {
    const report = buildDataCompletenessAuditReport({
      knowledgeNodes: [{
        id: 'kn-wrong-role-gap',
        name: 'Wrong role gap node',
        description: 'A graph node with the wrong reviewed coverage role.',
        tags: ['reviewed-gap'],
        resources: [],
        isActive: true,
        sourceLinkCount: 1,
        targetLinkCount: 1,
      }],
      reviewedGraphResourceCoverage: [{
        graphNodeId: 'kn-wrong-role-gap',
        decision: 'reviewed-limitation',
        limitationCategory: 'resource-not-yet-authored',
        coverageRole: 'path-node',
        reviewerVisibleRationale: 'This row has the wrong coverage role for a resource gap.',
        sourceVersionRef: 'graph-resource-coverage-overlay.v1',
        sourceHash: hashGraphResourceCoverageTestNode({
          id: 'kn-wrong-role-gap',
          name: 'Wrong role gap node',
          description: 'A graph node with the wrong reviewed coverage role.',
          tags: ['reviewed-gap'],
        }),
      }],
    });

    const graphCore = report.layers.find((layer) => layer.id === 'graphCore');
    expect(graphCore?.totals.missingResourceRefs).toBe(1);
    expect(graphCore?.totals.reviewedResourceGaps).toBe(0);
    expect(graphCore?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'graph-node-resource-missing',
        stableRef: 'KnowledgeNode:kn-wrong-role-gap',
      }),
    ]));
  });

  it('counts indexed long-form corpus chunks as verified section citation support', () => {
    const registry = buildResourceNodeRegistry({
      textbooks: [{
        bookId: 'demo-book',
        title: 'Demo textbook',
        sourceHref: '/course-runtime/resources/textbooks/demo-book',
        knowledgeNodeIds: ['kn-controller'],
      }],
      textbookSections: [{
        bookId: 'demo-book',
        sectionId: 'sec-1',
        title: 'Reviewed section',
        citationHref: '/course-runtime/resources/textbooks/demo-book/sections/sec-1.md',
        knowledgeNodeIds: ['kn-controller'],
        capabilityTargetIds: ['controlModeling'],
        estimatedTimeMinutes: 12,
      }],
    });
    const indexedChunk: LearningEvidenceCorpusChunk = {
      id: 'textbook-search:sec-1:chunk-1',
      family: 'course-content',
      sourceType: 'course-content',
      sourceRef: {
        id: 'textbook-search:sec-1:chunk-1',
        resourceId: 'textbook-section:demo-book:sec-1',
      },
      spanRef: { kind: 'text-range', locator: 'chunk-1' },
      display: {
        title: 'Section chunk',
        href: '/course-runtime/resources/textbooks/demo-book/sections/sec-1.md#chunk-1',
        capsule: 'Section chunk',
      },
      citationAddress: {
        kind: 'text',
        sourceRefId: 'chunk-1',
        href: '/course-runtime/resources/textbooks/demo-book/sections/sec-1.md#chunk-1',
        locator: 'chunk-1',
        contentHash: 'hash-1',
      },
      content: {
        text: null,
        redactedSummary: 'Section chunk',
        hash: 'hash-1',
      },
      resourceProjection: {
        resourceId: 'textbook-section:demo-book:sec-1',
        segmentRef: 'sec-1',
        citationTargetRef: 'chunk-1',
        knowledgeNodeRefs: ['kn-controller'],
        capabilityTargetRefs: ['controlModeling'],
      },
      privacyClass: 'public',
      confidence: 'high',
      freshness: {
        indexedAt: '2026-07-03T00:00:00.000Z',
        sourceUpdatedAt: null,
        expiresAt: null,
        stale: false,
      },
      authority: {
        level: 'canonical',
        knowledgeTags: ['kn-controller'],
        pageAnchor: 'chunk-1',
        freshnessBucket: 'current',
        scopeRule: { visibility: 'public', allowedRoles: ['student', 'teacher'] },
      },
      retrieval: {
        tags: ['textbook-section'],
        goals: ['demo-book', 'sec-1'],
        useCases: ['konling', 'recommendation'],
      },
    };

    const report = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      evidenceCorpus: [indexedChunk],
    });
    const citationReadiness = report.layers.find((layer) => layer.id === 'citationReadiness');

    expect(citationReadiness?.totals).toMatchObject({
      citationTargets: 1,
      resolvableCitationTargets: 1,
      verifiedCitationTargets: 1,
      retrievalChunks: 1,
      mappedRetrievalChunks: 1,
      longformSections: 1,
      mappedLongformSections: 1,
      longformCorpusChunks: 1,
      mappedLongformCorpusChunks: 1,
      corpusChunksMissingCitationAddress: 0,
    });
    const indexedFindingIds = citationReadiness?.findings.map((finding) => finding.id) ?? [];
    expect(indexedFindingIds).not.toContain('retrieval-chunk-not-indexed');
    expect(indexedFindingIds).not.toContain('resolvable');

    const missingAddressReport = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      evidenceCorpus: [{
        ...indexedChunk,
        id: 'textbook-search:sec-1:chunk-without-address',
        citationAddress: undefined,
      }],
    });
    const missingAddressCitationReadiness = missingAddressReport.layers.find((layer) =>
      layer.id === 'citationReadiness'
    );

    expect(missingAddressCitationReadiness?.totals).toMatchObject({
      verifiedCitationTargets: 0,
      mappedRetrievalChunks: 0,
      longformSections: 1,
      mappedLongformSections: 0,
      longformCorpusChunks: 1,
      mappedLongformCorpusChunks: 0,
      corpusChunksMissingCitationAddress: 1,
    });
    expect(missingAddressCitationReadiness?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'retrieval-chunk-not-indexed' }),
      expect.objectContaining({ id: 'corpus-chunk-citation-address-missing' }),
    ]));

    const missingHrefReport = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      evidenceCorpus: [{
        ...indexedChunk,
        id: 'textbook-search:sec-1:chunk-without-href',
        citationAddress: {
          ...indexedChunk.citationAddress!,
          href: null,
        },
      }],
    });
    const missingHrefCitationReadiness = missingHrefReport.layers.find((layer) =>
      layer.id === 'citationReadiness'
    );

    expect(missingHrefCitationReadiness?.totals).toMatchObject({
      verifiedCitationTargets: 0,
      mappedRetrievalChunks: 0,
      longformSections: 1,
      mappedLongformSections: 0,
      longformCorpusChunks: 1,
      mappedLongformCorpusChunks: 0,
      corpusChunksMissingCitationAddress: 0,
    });
    expect(missingHrefCitationReadiness?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'retrieval-chunk-not-indexed' }),
    ]));

    const unsafeHrefReport = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      evidenceCorpus: [{
        ...indexedChunk,
        id: 'textbook-search:sec-1:chunk-unsafe-href',
        citationAddress: {
          ...indexedChunk.citationAddress!,
          href: 'javascript:void(0)',
        },
      }],
    });
    const unsafeHrefCitationReadiness = unsafeHrefReport.layers.find((layer) =>
      layer.id === 'citationReadiness'
    );

    expect(unsafeHrefCitationReadiness?.totals).toMatchObject({
      verifiedCitationTargets: 0,
      mappedRetrievalChunks: 0,
      longformSections: 1,
      mappedLongformSections: 0,
      longformCorpusChunks: 1,
      mappedLongformCorpusChunks: 0,
      corpusChunksMissingCitationAddress: 0,
    });
    expect(unsafeHrefCitationReadiness?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'retrieval-chunk-not-indexed' }),
    ]));

    const externalHrefReport = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      evidenceCorpus: [{
        ...indexedChunk,
        id: 'textbook-search:sec-1:chunk-external-href',
        citationAddress: {
          ...indexedChunk.citationAddress!,
          href: 'https://example.com/demo-book/sec-1#chunk-1',
        },
      }],
    });
    const externalHrefCitationReadiness = externalHrefReport.layers.find((layer) =>
      layer.id === 'citationReadiness'
    );

    expect(externalHrefCitationReadiness?.totals).toMatchObject({
      verifiedCitationTargets: 0,
      mappedRetrievalChunks: 0,
      longformSections: 1,
      mappedLongformSections: 0,
      longformCorpusChunks: 1,
      mappedLongformCorpusChunks: 0,
      corpusChunksMissingCitationAddress: 0,
    });
    expect(externalHrefCitationReadiness?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'retrieval-chunk-not-indexed' }),
    ]));

    const genericInternalHrefReport = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      evidenceCorpus: [{
        ...indexedChunk,
        id: 'textbook-search:sec-1:chunk-generic-internal-href',
        citationAddress: {
          ...indexedChunk.citationAddress!,
          href: '/not-course-runtime/demo-book/sec-1#chunk-1',
        },
      }],
    });
    const genericInternalHrefCitationReadiness = genericInternalHrefReport.layers.find((layer) =>
      layer.id === 'citationReadiness'
    );

    expect(genericInternalHrefCitationReadiness?.totals).toMatchObject({
      verifiedCitationTargets: 0,
      mappedRetrievalChunks: 0,
      longformSections: 1,
      mappedLongformSections: 0,
      longformCorpusChunks: 1,
      mappedLongformCorpusChunks: 0,
      corpusChunksMissingCitationAddress: 0,
    });
    expect(genericInternalHrefCitationReadiness?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'retrieval-chunk-not-indexed' }),
    ]));
  });

  it('uses registered long-form sections as citation readiness denominators', () => {
    const registry = buildResourceNodeRegistry({
      textbooks: [{
        bookId: 'demo-book',
        title: 'Demo textbook',
        sourceHref: '/course-runtime/resources/textbooks/demo-book',
        knowledgeNodeIds: ['kn-controller'],
      }],
      textbookSections: [{
        bookId: 'demo-book',
        sectionId: 'sec-1',
        title: 'Indexed section',
        citationHref: '/course-runtime/resources/textbooks/demo-book/sections/sec-1.md',
        knowledgeNodeIds: ['kn-controller'],
        estimatedTimeMinutes: 12,
      }, {
        bookId: 'demo-book',
        sectionId: 'sec-2',
        title: 'Registered but unindexed section',
        citationHref: '/course-runtime/resources/textbooks/demo-book/sections/sec-2.md',
        knowledgeNodeIds: ['kn-controller'],
        estimatedTimeMinutes: 10,
      }],
    });
    const indexedChunk: LearningEvidenceCorpusChunk = {
      id: 'textbook-search:sec-1:chunk-1',
      family: 'course-content',
      sourceType: 'course-content',
      sourceRef: {
        id: 'textbook-search:sec-1:chunk-1',
        resourceId: 'textbook-section:demo-book:sec-1',
      },
      spanRef: { kind: 'text-range', locator: 'chunk-1' },
      display: {
        title: 'Section chunk',
        href: '/course-runtime/resources/textbooks/demo-book/sections/sec-1.md#chunk-1',
        capsule: 'Section chunk',
      },
      citationAddress: {
        kind: 'text',
        sourceRefId: 'chunk-1',
        href: '/course-runtime/resources/textbooks/demo-book/sections/sec-1.md#chunk-1',
        locator: 'chunk-1',
        contentHash: 'hash-1',
      },
      content: {
        text: null,
        redactedSummary: 'Section chunk',
        hash: 'hash-1',
      },
      resourceProjection: {
        resourceId: 'textbook-section:demo-book:sec-1',
        segmentRef: 'sec-1',
        citationTargetRef: 'chunk-1',
        knowledgeNodeRefs: ['kn-controller'],
        capabilityTargetRefs: [],
      },
      privacyClass: 'public',
      confidence: 'high',
      freshness: {
        indexedAt: '2026-07-03T00:00:00.000Z',
        sourceUpdatedAt: null,
        expiresAt: null,
        stale: false,
      },
      authority: {
        level: 'canonical',
        knowledgeTags: ['kn-controller'],
        pageAnchor: 'chunk-1',
        freshnessBucket: 'current',
        scopeRule: { visibility: 'public', allowedRoles: ['student', 'teacher'] },
      },
      retrieval: {
        tags: ['textbook-section'],
        goals: ['demo-book', 'sec-1'],
        useCases: ['konling', 'recommendation'],
      },
    };

    const report = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      evidenceCorpus: [indexedChunk],
    });
    const citationReadiness = report.layers.find((layer) => layer.id === 'citationReadiness');

    expect(citationReadiness?.totals).toMatchObject({
      citationTargets: 2,
      verifiedCitationTargets: 1,
      retrievalChunks: 2,
      mappedRetrievalChunks: 1,
      longformSections: 2,
      mappedLongformSections: 1,
      longformCorpusChunks: 1,
      mappedLongformCorpusChunks: 1,
    });
    expect(citationReadiness?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'retrieval-chunk-not-indexed',
        stableRef: 'retrieval-chunk:textbook-section:demo-book:sec-2:primary',
      }),
    ]));
  });

  it('does not count corpus-only long-form sections as registered citation coverage', () => {
    const registry = buildResourceNodeRegistry({
      textbooks: [{
        bookId: 'demo-book',
        title: 'Demo textbook',
        sourceHref: '/course-runtime/resources/textbooks/demo-book',
        knowledgeNodeIds: ['kn-controller'],
      }],
      textbookSections: [{
        bookId: 'demo-book',
        sectionId: 'sec-1',
        title: 'Registered section',
        citationHref: '/course-runtime/resources/textbooks/demo-book/sections/sec-1.md',
        knowledgeNodeIds: ['kn-controller'],
        estimatedTimeMinutes: 12,
      }],
    });
    const indexedChunk: LearningEvidenceCorpusChunk = {
      id: 'textbook-search:sec-1:chunk-1',
      family: 'course-content',
      sourceType: 'course-content',
      sourceRef: {
        id: 'textbook-search:sec-1:chunk-1',
        resourceId: 'textbook-section:demo-book:sec-1',
      },
      spanRef: { kind: 'text-range', locator: 'chunk-1' },
      display: {
        title: 'Section chunk',
        href: '/course-runtime/resources/textbooks/demo-book/sections/sec-1.md#chunk-1',
        capsule: 'Section chunk',
      },
      citationAddress: {
        kind: 'text',
        sourceRefId: 'chunk-1',
        href: '/course-runtime/resources/textbooks/demo-book/sections/sec-1.md#chunk-1',
        locator: 'chunk-1',
        contentHash: 'hash-1',
      },
      content: {
        text: null,
        redactedSummary: 'Section chunk',
        hash: 'hash-1',
      },
      resourceProjection: {
        resourceId: 'textbook-section:demo-book:sec-1',
        segmentRef: 'sec-1',
        citationTargetRef: 'chunk-1',
        knowledgeNodeRefs: ['kn-controller'],
        capabilityTargetRefs: [],
      },
      privacyClass: 'public',
      confidence: 'high',
      freshness: {
        indexedAt: '2026-07-03T00:00:00.000Z',
        sourceUpdatedAt: null,
        expiresAt: null,
        stale: false,
      },
      authority: {
        level: 'canonical',
        knowledgeTags: ['kn-controller'],
        pageAnchor: 'chunk-1',
        freshnessBucket: 'current',
        scopeRule: { visibility: 'public', allowedRoles: ['student', 'teacher'] },
      },
      retrieval: {
        tags: ['textbook-section'],
        goals: ['demo-book', 'sec-1'],
        useCases: ['konling', 'recommendation'],
      },
    };
    const orphanChunk: LearningEvidenceCorpusChunk = {
      ...indexedChunk,
      id: 'textbook-search:sec-orphan:chunk-1',
      sourceRef: {
        id: 'textbook-search:sec-orphan:chunk-1',
        resourceId: 'textbook-section:demo-book:sec-orphan',
      },
      display: {
        title: 'Orphan section chunk',
        href: '/course-runtime/resources/textbooks/demo-book/sections/sec-orphan.md#chunk-1',
        capsule: 'Orphan section chunk',
      },
      citationAddress: {
        ...indexedChunk.citationAddress!,
        href: '/course-runtime/resources/textbooks/demo-book/sections/sec-orphan.md#chunk-1',
      },
      resourceProjection: {
        ...indexedChunk.resourceProjection!,
        resourceId: 'textbook-section:demo-book:sec-orphan',
        segmentRef: 'sec-orphan',
      },
    };

    const report = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      evidenceCorpus: [indexedChunk, orphanChunk],
    });
    const citationReadiness = report.layers.find((layer) => layer.id === 'citationReadiness');

    expect(citationReadiness?.totals).toMatchObject({
      citationTargets: 1,
      verifiedCitationTargets: 1,
      retrievalChunks: 1,
      mappedRetrievalChunks: 1,
      longformSections: 1,
      mappedLongformSections: 1,
      longformCorpusChunks: 2,
      mappedLongformCorpusChunks: 1,
      orphanLongformCorpusSections: 1,
    });
    expect(citationReadiness?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'longform-corpus-section-unregistered',
        stableRef: 'CorpusSection:textbook-section:demo-book:sec-orphan',
      }),
    ]));
  });

  it('does not auto-confirm resources outside the reviewed core path readiness batch', () => {
    const teachingResources = [{
      id: 'core-resource',
      title: 'Core resource',
      type: 'INTERACTIVE_COMP',
      registryId: 'core-path-node',
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'Controller correction',
        resources: [],
        tags: ['correction'],
      }],
    }, {
      id: 'blocked-resource',
      title: 'Blocked resource',
      type: 'INTERACTIVE_COMP',
      registryId: 'blocked-path-node',
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'Controller correction',
        resources: [],
        tags: ['correction'],
      }],
    }];
    const registry = buildResourceNodeRegistryFromTeachingResources(teachingResources, [{
      id: 'core-path-node',
      label: 'Reviewed core path node',
      type: 'INTERACTIVE_COMP',
      renderTarget: '/teacher/resources/core-path-node',
      knowledgeNodeIds: ['kn-controller'],
      planningOverride: {
        abilityImpact: { controlModeling: 0.25 },
        evidenceInstrumentation: ['resource_open'],
        privacyLevel: 'student-visible',
      },
    }, {
      id: 'blocked-path-node',
      label: 'Blocked core path node',
      type: 'INTERACTIVE_COMP',
      knowledgeNodeIds: ['kn-controller'],
      planningOverride: {
        abilityImpact: { controlModeling: 0.25 },
        evidenceInstrumentation: ['resource_open'],
        privacyLevel: 'student-visible',
      },
    }]);

    const pathNode = registry.nodes.find((node) => node.id === 'registry:core-path-node');
    const blockedNode = registry.nodes.find((node) => node.id === 'registry:blocked-path-node');
    const report = buildDataCompletenessAuditReport({
      teachingResources,
      resourceRegistry: registry,
    });
    const disposition = report.layers.find((layer) => layer.id === 'resourceDisposition');

    expect(pathNode?.planningMetadata.pathDisposition).toMatchObject({
      kind: 'excluded-with-rationale',
      reviewStatus: 'generated-provisional',
      reviewerId: null,
    });
    expect(blockedNode?.planningMetadata.pathDisposition).toMatchObject({
      kind: 'excluded-with-rationale',
      reviewStatus: 'generated-provisional',
      reviewerId: null,
    });
    expect(buildResourceSemanticProjection(pathNode!).planningUnit).toBeNull();
    expect(disposition?.totals).toMatchObject({
      resourceNodes: 6,
      reviewedDispositions: 0,
      missingDisposition: 0,
      missingHumanReview: 6,
      missingExclusionRationale: 0,
      invalidPromotion: 0,
    });
  });

  it('classifies reviewed core teaching resource dispositions only for the pinned review batch', () => {
    const registry = buildResourceNodeRegistryFromTeachingResources([], [{
      id: 'control-odyssey-v1',
      label: 'Control Odyssey reviewed resource',
      type: 'INTERACTIVE_COMP',
      renderTarget: '/interactive-learning/resources/control-odyssey-v1/ship',
      knowledgeNodeIds: ['kn-controller'],
      planningOverride: {
        abilityImpact: { controlModeling: 0.25 },
        evidenceInstrumentation: ['resource_open'],
        privacyLevel: 'student-visible',
      },
    }]);
    const pathNode = registry.nodes.find((node) => node.id === 'registry:control-odyssey-v1');
    const report = buildDataCompletenessAuditReport({ resourceRegistry: registry });
    const disposition = report.layers.find((layer) => layer.id === 'resourceDisposition');

    expect(pathNode?.planningMetadata.pathDisposition).toMatchObject({
      kind: 'path-plannable',
      reviewStatus: 'human-confirmed',
      reviewerId: 'core-resource-path-readiness-review',
    });
    expect(pathNode?.planningMetadata.readiness).toMatchObject({
      minimumCompetency: {},
      minimumEvidenceCount: 0,
    });
    expect(disposition?.totals).toMatchObject({
      resourceNodes: 1,
      reviewedDispositions: 1,
      missingDisposition: 0,
      invalidPromotion: 0,
    });
  });

  it('reports resource disposition gaps separately from path and citation readiness', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'citation-card',
        label: 'Citation card',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/citation-card.png',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          pathDisposition: {
            kind: 'embedded-asset',
            reviewStatus: 'human-confirmed',
            rationale: 'Supports a parent lesson step.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'citation-card',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'excluded-without-rationale',
        label: 'Excluded without rationale',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/obsolete.png',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          pathDisposition: {
            kind: 'excluded-with-rationale',
            reviewStatus: 'human-confirmed',
            rationale: null,
            sourceFamily: 'resource_registry',
            stableSourceRef: 'excluded-without-rationale',
            sourceVersionRef: null,
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'citation-without-rationale',
        label: 'Citation without rationale',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/citation-without-rationale.png',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          pathDisposition: {
            kind: 'supporting-citation',
            reviewStatus: 'human-confirmed',
            rationale: null,
            sourceFamily: 'resource_registry',
            stableSourceRef: 'citation-without-rationale',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'evidence-producing-without-instrumentation',
        label: 'Evidence producing without instrumentation',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          evidenceInstrumentation: [],
          pathDisposition: {
            kind: 'evidence-producing',
            reviewStatus: 'human-confirmed',
            rationale: 'Claims to produce evidence but has no instrumentation.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'evidence-producing-without-instrumentation',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'provisional-path-node',
        label: 'Provisional path node',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          readiness: {
            minimumCompetency: { controlModeling: 0.2 },
            minimumEvidenceCount: 1,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            unlockMessage: '完成基础学习后进入。',
            fallbackNodeIds: [],
          },
          pathDisposition: {
            kind: 'path-plannable',
            reviewStatus: 'generated-provisional',
            rationale: 'Generated suggestion.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'provisional-path-node',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: null,
            reviewerId: null,
          },
        },
      }],
    });
    const corpusOnlyProjection: LearningEvidenceCorpusChunk = {
      id: 'corpus-only-section-chunk',
      family: 'course-content',
      sourceType: 'course-content',
      sourceRef: { id: 'corpus-only-section' },
      spanRef: { kind: 'text-range', start: 0, end: 12 },
      display: { title: 'Corpus only section', href: null, capsule: 'Section' },
      content: { text: 'content', redactedSummary: null, hash: 'hash' },
      resourceProjection: {
        resourceId: 'corpus-only-section',
        segmentRef: 'corpus-only-section',
        citationTargetRef: 'course-content/runtime/corpus-only-section.md',
        knowledgeNodeRefs: ['kn-controller'],
        capabilityTargetRefs: [],
      },
      privacyClass: 'public',
      confidence: 'high',
      freshness: {
        indexedAt: '2026-07-02T00:00:00.000Z',
        sourceUpdatedAt: null,
        expiresAt: null,
        stale: false,
      },
      authority: {
        level: 'canonical',
        knowledgeTags: [],
        pageAnchor: null,
        freshnessBucket: 'current',
        scopeRule: { visibility: 'public', allowedRoles: ['student', 'teacher'] },
      },
      retrieval: {
        tags: [],
        goals: [],
        useCases: ['diagnosis'],
      },
    };
    const registryCoveredCorpusProjection: LearningEvidenceCorpusChunk = {
      ...corpusOnlyProjection,
      id: 'registry-covered-section-chunk',
      sourceRef: { id: 'external-corpus-source' },
      display: { title: 'Registry covered section', href: null, capsule: 'Section' },
      resourceProjection: {
        resourceId: 'resource:registry:provisional-path-node',
        segmentRef: 'registry-covered-section',
        citationTargetRef: 'course-content/runtime/registry-covered-section.md',
        knowledgeNodeRefs: ['kn-controller'],
        capabilityTargetRefs: [],
      },
    };
    const explicitProjectionWithCollidingSourceRef: LearningEvidenceCorpusChunk = {
      ...corpusOnlyProjection,
      id: 'explicit-projection-colliding-source-ref-chunk',
      sourceRef: { id: 'registry:provisional-path-node' },
      display: { title: 'Explicit projection with colliding source ref', href: null, capsule: 'Section' },
      resourceProjection: {
        resourceId: 'resource:corpus-explicit-unmatched',
        segmentRef: 'corpus-explicit-unmatched',
        citationTargetRef: 'course-content/runtime/corpus-explicit-unmatched.md',
        knowledgeNodeRefs: ['kn-controller'],
        capabilityTargetRefs: [],
      },
    };
    const crossFamilySourceRefCollisionProjection: LearningEvidenceCorpusChunk = {
      ...corpusOnlyProjection,
      id: 'cross-family-source-ref-collision-chunk',
      sourceRef: { id: 'provisional-path-node' },
      display: { title: 'Cross family source ref collision', href: null, capsule: 'Section' },
      resourceProjection: {
        resourceId: 'provisional-path-node',
        segmentRef: 'cross-family-source-ref-collision',
        citationTargetRef: 'course-content/runtime/cross-family-source-ref-collision.md',
        knowledgeNodeRefs: ['kn-controller'],
        capabilityTargetRefs: [],
      },
    };

    const report = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      evidenceCorpus: [
        corpusOnlyProjection,
        registryCoveredCorpusProjection,
        explicitProjectionWithCollidingSourceRef,
        crossFamilySourceRefCollisionProjection,
      ],
    });
    const disposition = report.layers.find((layer) => layer.id === 'resourceDisposition');

    expect(disposition?.totals).toMatchObject({
      resourceNodes: 5,
      corpusResourceProjections: 4,
      reviewedDispositions: 3,
      missingDisposition: 3,
      missingHumanReview: 2,
      missingParentPlanningUnit: 1,
      missingDispositionRationale: 2,
      missingExclusionRationale: 1,
      missingEvidenceInstrumentation: 1,
      invalidPromotion: 1,
      unmatchedCorpusResourceProjections: 3,
    });
    expect(disposition?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'missing-path-disposition',
        stableRef: 'ResourceDisposition:corpus:corpus-only-section',
        followupBucket: 'review-resource-path-dispositions',
      }),
      expect.objectContaining({
        id: 'missing-path-disposition',
        stableRef: 'ResourceDisposition:corpus:resource:corpus-explicit-unmatched',
        followupBucket: 'review-resource-path-dispositions',
      }),
      expect.objectContaining({
        id: 'missing-path-disposition',
        stableRef: 'ResourceDisposition:corpus:provisional-path-node',
        followupBucket: 'review-resource-path-dispositions',
      }),
      expect.objectContaining({
        id: 'missing-parent-planning-unit',
        stableRef: 'ResourceDisposition:resource_registry:citation-card',
        followupBucket: 'link-embedded-resource-parents',
      }),
      expect.objectContaining({
        id: 'missing-disposition-rationale',
        stableRef: 'ResourceDisposition:resource_registry:excluded-without-rationale',
        followupBucket: 'review-resource-disposition-rationales',
      }),
      expect.objectContaining({
        id: 'missing-disposition-rationale',
        stableRef: 'ResourceDisposition:resource_registry:citation-without-rationale',
        followupBucket: 'review-resource-disposition-rationales',
      }),
      expect.objectContaining({
        id: 'invalid-path-disposition-promotion',
        stableRef: 'ResourceDisposition:resource_registry:provisional-path-node',
        followupBucket: 'audit-path-disposition-promotions',
      }),
      expect.objectContaining({
        id: 'missing-evidence-instrumentation',
        stableRef: 'ResourceDisposition:resource_registry:evidence-producing-without-instrumentation',
        followupBucket: 'instrument-evidence-producing-resources',
      }),
    ]));
    expect(disposition?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        stableRef: 'ResourceDisposition:corpus:resource:registry:provisional-path-node',
      }),
    ]));
    expect(report.layers.find((layer) => layer.id === 'citationReadiness')).toBeDefined();
    expect(report.layers.find((layer) => layer.id === 'pathReadiness')).toBeDefined();
  });

  it('keeps reviewed non-path dispositions out of path readiness blockers', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'supporting-citation',
        label: 'Supporting citation',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/supporting-citation.png',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          pathDisposition: {
            kind: 'supporting-citation',
            reviewStatus: 'human-confirmed',
            rationale: 'Citation support only.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'supporting-citation',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'evidence-producing',
        label: 'Evidence producing',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          pathDisposition: {
            kind: 'evidence-producing',
            reviewStatus: 'human-confirmed',
            rationale: 'Evidence capture only.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'evidence-producing',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'excluded-with-rationale',
        label: 'Excluded with rationale',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/excluded.png',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          pathDisposition: {
            kind: 'excluded-with-rationale',
            reviewStatus: 'human-confirmed',
            rationale: 'Excluded from independent path planning.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'excluded-with-rationale',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }],
    });

    const report = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      evidenceCorpus: [],
    });
    const resourceBinding = report.layers.find((layer) => layer.id === 'resourceBinding');
    const pathReadiness = report.layers.find((layer) => layer.id === 'pathReadiness');
    const disposition = report.layers.find((layer) => layer.id === 'resourceDisposition');

    expect(resourceBinding?.totals).toMatchObject({
      resourceNodes: 3,
    });
    expect(pathReadiness?.totals).toMatchObject({
      resourceNodes: 0,
      planningUnits: 0,
      blockedPathNodes: 0,
    });
    expect([
      ...resourceBinding!.findings,
      ...pathReadiness!.findings,
    ]).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'invalid-path-disposition-promotion',
      }),
    ]));
    expect(disposition?.totals).toMatchObject({
      resourceNodes: 3,
      reviewedDispositions: 3,
      invalidPromotion: 0,
    });
  });

  it('does not treat non-path registry nodes as path readiness blockers', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'Controller correction',
        tags: ['correction'],
      }],
    });
    const report = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 1,
        knowledgeProgressCount: 1,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 1,
        profileSummaryCount: 1,
        adaptiveAssessmentStateCount: 1,
        featureCache: {
          sourceFactCount: 1,
          sourceCoverage: { LearningFact: 'available' },
        },
      }],
    });

    const pathReadiness = report.layers.find((layer) => layer.id === 'pathReadiness');
    expect(pathReadiness?.severity).toBe('advisory');
    expect(pathReadiness?.totals).toMatchObject({
      resourceNodes: 0,
      blockedPathNodes: 0,
    });
    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(false);
    expect(report.learnerFixture.blockers).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/^pathReadiness:/),
      expect.stringMatching(/^resourceBinding:/),
    ]));
  });

  it('does not treat container registry nodes as citation readiness blockers', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeNodes: [{
        id: 'kn-container',
        name: 'Container knowledge node',
        tags: ['container'],
      }],
    });
    const report = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
    });

    const citationReadiness = report.layers.find((layer) => layer.id === 'citationReadiness');
    expect(citationReadiness?.severity).toBe('advisory');
    expect(citationReadiness?.totals.citationTargets).toBe(0);
    expect(citationReadiness?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'missing-target',
      }),
    ]));
  });

  it('audits evidence lineage without exposing raw event payloads', () => {
    const report = buildDataCompletenessAuditReport({
      interactionLogs: [{
        id: 'log-1',
        userId: 'student-1',
        eventType: 'unknown_event',
        clientEventId: 'event-1',
        attemptKey: null,
        clientEventAt: null,
        createdAt: null,
      }, {
        id: 'log-2',
        userId: 'student-1',
        eventType: 'lesson_submit',
        clientEventId: 'event-1',
        attemptKey: 'attempt-1',
        createdAt: '2026-07-02T00:00:00.000Z',
      }, {
        id: 'log-3',
        userId: 'student-1',
        eventType: 'lesson_submit',
        clientEventId: 'event-3',
        attemptKey: 'attempt-3',
        createdAt: '2026-07-02T00:00:01.000Z',
      }, {
        id: 'log-4',
        userId: 'student-1',
        eventType: 'lesson_submit',
        clientEventId: 'event-4',
        attemptKey: 'attempt-4',
        createdAt: '2026-07-02T00:00:02.000Z',
      }],
      eventDictionaryTypes: ['lesson_submit'],
      learningEventBatches: [{
        id: 'batch-1',
        eventCount: 2,
        processedAt: null,
      }],
      learningFacts: [{
        id: 'fact-1',
        userId: 'student-1',
        factType: 'simulation',
        sourceEventId: null,
        sourceLogId: null,
      }, {
        id: 'fact-2',
        userId: 'student-1',
        factType: 'question',
        sourceEventId: 'missing-client-event',
        sourceLogId: 'missing-log',
      }, {
        id: 'fact-3',
        userId: 'student-1',
        factType: 'question',
        sourceEventId: 'interaction-log:log-3',
        sourceLogId: 'log-3',
      }, {
        id: 'fact-4',
        userId: 'student-1',
        factType: 'question',
        sourceEventId: 'historical:InteractionLog:log-4:lesson_submit',
        sourceLogId: 'log-4',
      }, {
        id: 'fact-5',
        userId: 'student-1',
        factType: 'design',
        sourceEventId: 'arena-official:publication-1:task-1:submission-1:user-1:artifact-1:terminal-validation',
        sourceLogId: 'submission-1',
      }, {
        id: 'fact-6',
        userId: 'student-1',
        factType: 'control_correction_path.selection_recorded',
        sourceEventId: 'control-correction-path:choice:path-1:event-1',
        sourceLogId: 'event-1',
      }, {
        id: 'fact-7',
        userId: 'student-1',
        factType: 'simulation',
        sourceEventId: 'simulation-agent-evidence:simulation_run:run-1:simulation-run-v1',
        sourceLogId: 'run-1',
      }, {
        id: 'fact-8',
        userId: 'student-1',
        factType: 'adaptive_assessment',
        sourceEventId: 'adaptive-assessment:answer-1',
        sourceLogId: 'adaptive-assessment:answer-1',
      }, {
        id: 'fact-9',
        userId: 'student-1',
        factType: 'question',
        sourceEventId: 'historical:StudentStepResponse:response-1:lesson_submit',
        sourceLogId: 'response-1',
      }, {
        id: 'fact-10',
        userId: 'student-1',
        factType: 'arena_preview',
        sourceEventId: 'arena_simulation_run:run-1',
        sourceLogId: 'arena-preview-log',
        contextJson: { arena: { evaluationMode: 'preview' } },
      }],
      studentCompetencySnapshots: [],
      studentProfileSummaries: [],
      studentEvidenceFeatureCaches: [],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.severity).toBe('blocked');
    expect(lineage?.totals).toMatchObject({
      interactionLogsMissingClientEventId: 0,
      interactionLogsMissingAttemptKey: 1,
      interactionLogsMissingTimestamp: 1,
      duplicateClientEventIds: 1,
      eventDictionaryMappingMissing: 1,
      unprocessedLearningEventBatches: 1,
      unattributedLearningFacts: 1,
      danglingLearningFactSourceLogs: 1,
      danglingLearningFactSourceEvents: 1,
      usersMissingCompetencySnapshots: 1,
      usersMissingFeatureCaches: 1,
    });
    expect(JSON.stringify(report)).not.toContain('raw answer');
    expect(JSON.stringify(report)).not.toContain('eventData');
  });

  it('treats partial or missing feature cache source coverage as incomplete', () => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [{
        id: 'fact-partial-cache',
        userId: 'student-partial-cache',
        factType: 'question',
        sourceEventId: 'interaction-log:log-1',
        sourceLogId: 'log-1',
      }],
      studentCompetencySnapshots: [{ userId: 'student-partial-cache' }],
      studentProfileSummaries: [{ userId: 'student-partial-cache' }],
      studentEvidenceFeatureCaches: [{
        userId: 'student-partial-cache',
        sourceFactCount: 1,
        sourceCoverage: {
          LearningFact: 'partial',
          StudentStepResponse: 'missing',
        },
      }, {
        userId: 'student-mixed-cache',
        sourceFactCount: 2,
        sourceCoverage: {
          LearningFact: 'available',
          StudentCompetencySnapshot: 'missing',
        },
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.featureCachesMissingSourceCoverage).toBe(2);
    expect(lineage?.findings.filter((finding) =>
      finding.id === 'student-evidence-feature-cache-source-coverage-missing'
    )).toHaveLength(2);
  });

  it('reports corpus chunks without citation addresses as citation readiness follow-up work', () => {
    const chunkWithoutCitationAddress: LearningEvidenceCorpusChunk = {
      id: 'chunk-missing-address',
      family: 'course-content',
      sourceType: 'course-content',
      sourceRef: { id: 'section-1' },
      spanRef: { kind: 'text-range', start: 0, end: 12 },
      display: { title: 'Grounded section', href: null, capsule: 'Section' },
      content: { text: 'content', redactedSummary: null, hash: 'hash' },
      privacyClass: 'public',
      confidence: 'high',
      freshness: {
        indexedAt: '2026-07-02T00:00:00.000Z',
        sourceUpdatedAt: null,
        expiresAt: null,
        stale: false,
      },
      authority: {
        level: 'canonical',
        knowledgeTags: [],
        pageAnchor: null,
        freshnessBucket: 'current',
        scopeRule: { visibility: 'public', allowedRoles: ['student', 'teacher'] },
      },
      retrieval: {
        tags: [],
        goals: [],
        useCases: ['diagnosis'],
      },
    };

    const report = buildDataCompletenessAuditReport({
      evidenceCorpus: [chunkWithoutCitationAddress],
    });

    const citationReadiness = report.layers.find((layer) => layer.id === 'citationReadiness');
    expect(citationReadiness?.totals.corpusChunksWithCitationAddress).toBe(0);
    expect(citationReadiness?.totals.corpusChunksMissingCitationAddress).toBe(1);
    expect(citationReadiness?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'corpus-chunk-citation-address-missing',
        severity: 'partial',
        stableRef: 'CorpusChunk:chunk-missing-address',
      }),
    ]));
  });

  it('reports runtime artifact loader errors instead of hiding missing resources', () => {
    const report = buildDataCompletenessAuditReport({
      runtimeArtifactErrors: [{
        id: 'runtime-lessons',
        message: 'Missing runtime handout for unit-missing-handout',
      }],
    });

    const resourceBinding = report.layers.find((layer) => layer.id === 'resourceBinding');
    expect(resourceBinding?.severity).toBe('blocked');
    expect(resourceBinding?.totals.runtimeArtifactErrors).toBe(1);
    expect(resourceBinding?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'runtime-artifact-unavailable',
        stableRef: 'RuntimeArtifact:runtime-lessons',
        followupBucket: 'repair-runtime-artifacts',
      }),
    ]));
    expect(report.followupBuckets).toEqual(expect.arrayContaining(['repair-runtime-artifacts']));
  });

  it('treats stale feature caches as incomplete even when source coverage is available', () => {
    const report = buildDataCompletenessAuditReport({
      generatedAt: '2026-07-02T00:00:00.000Z',
      studentEvidenceFeatureCaches: [{
        userId: 'student-old-cache',
        sourceFactCount: 2,
        sourceCoverage: { LearningFact: 'available' },
        refreshedAt: '2026-05-01T00:00:00.000Z',
      }, {
        userId: 'student-marker-cache',
        sourceFactCount: 2,
        sourceCoverage: { LearningFact: 'available' },
        refreshedAt: '2026-07-01T00:00:00.000Z',
        statusMarkers: ['stale'],
      }, {
        userId: 'student-ready-cache',
        sourceFactCount: 2,
        sourceCoverage: { LearningFact: 'available' },
        refreshedAt: '2026-07-01T00:00:00.000Z',
        statusMarkers: [],
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.featureCachesMissingSourceCoverage).toBe(0);
    expect(lineage?.totals.staleFeatureCaches).toBe(2);
    expect(lineage?.findings.filter((finding) =>
      finding.id === 'student-evidence-feature-cache-stale'
    )).toHaveLength(2);
  });

  it('matches bare clientEventId lineage by user instead of globally', () => {
    const report = buildDataCompletenessAuditReport({
      interactionLogs: [{
        id: 'log-student-1',
        userId: 'student-1',
        eventType: 'lesson_submit',
        clientEventId: 'shared-client-event',
        attemptKey: 'attempt-1',
        createdAt: '2026-07-02T00:00:00.000Z',
      }, {
        id: 'log-student-2',
        userId: 'student-2',
        eventType: 'lesson_submit',
        clientEventId: 'shared-client-event',
        attemptKey: 'attempt-2',
        createdAt: '2026-07-02T00:00:01.000Z',
      }, {
        id: 'log-student-1-duplicate',
        userId: 'student-1',
        eventType: 'lesson_submit',
        clientEventId: 'shared-client-event',
        attemptKey: 'attempt-3',
        createdAt: '2026-07-02T00:00:02.000Z',
      }],
      eventDictionaryTypes: ['lesson_submit'],
      learningFacts: [{
        id: 'fact-same-user',
        userId: 'student-1',
        factType: 'question',
        sourceEventId: 'shared-client-event',
        sourceLogId: null,
      }, {
        id: 'fact-cross-user',
        userId: 'student-3',
        factType: 'question',
        sourceEventId: 'shared-client-event',
        sourceLogId: null,
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.duplicateClientEventIds).toBe(1);
    expect(lineage?.totals.danglingLearningFactSourceEvents).toBe(1);
    expect(lineage?.findings.filter((finding) =>
      finding.id === 'interaction-log-client-event-id-duplicate'
    )).toHaveLength(1);
    const duplicateFinding = lineage?.findings.find((finding) =>
      finding.id === 'interaction-log-client-event-id-duplicate'
    );
    expect(duplicateFinding?.stableRef).toMatch(/^clientEventId:sha256:/);
    expect(duplicateFinding?.message).toContain('learner-scoped clientEventId');
    expect(lineage?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:fact-cross-user',
      }),
    ]));
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:fact-same-user',
      }),
    ]));
    expect(JSON.stringify(report)).not.toContain('student-1:shared-client-event');
    expect(JSON.stringify(report)).not.toContain('student-2:shared-client-event');
  });

  it('validates sourceLogId against the learning fact user', () => {
    const report = buildDataCompletenessAuditReport({
      interactionLogs: [{
        id: 'shared-log-id',
        userId: 'student-owner',
        eventType: 'lesson_submit',
        clientEventId: 'owner-client-event',
        attemptKey: 'attempt-owner',
        createdAt: '2026-07-02T00:00:00.000Z',
      }],
      eventDictionaryTypes: ['lesson_submit'],
      learningFacts: [{
        id: 'fact-owner-log',
        userId: 'student-owner',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'shared-log-id',
      }, {
        id: 'fact-cross-user-log',
        userId: 'student-other',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'shared-log-id',
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceLogs).toBe(1);
    expect(lineage?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-log-dangling',
        stableRef: 'LearningFact:fact-cross-user-log',
      }),
    ]));
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-log-dangling',
        stableRef: 'LearningFact:fact-owner-log',
      }),
    ]));
  });

  it('accepts governed Yang Fan fixture learning fact sources', () => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [{
        id: 'yangfan-fixture-fact-assessment',
        userId: 'user-canonical',
        factType: 'question',
        sourceEventId: 'adaptive-assessment:yangfan-diagnostic-fixture:adaptive-answer',
        sourceLogId: null,
      }, {
        id: 'yangfan-fixture-fact-path',
        userId: 'user-canonical',
        factType: 'resource',
        sourceEventId: 'learning-path:yangfan-diagnostic-fixture:path-execution',
        sourceLogId: null,
      }, {
        id: 'yangfan-fixture-fact-konling',
        userId: 'user-canonical',
        factType: 'ai_intervention',
        sourceEventId: 'learning-path:yangfan-diagnostic-fixture:konling-tool-run',
        sourceLogId: null,
      }, {
        id: 'yangfan-fixture-fact-arena-preview',
        userId: 'user-canonical',
        factType: 'simulation',
        sourceEventId: 'control-correction-path:yangfan-diagnostic-fixture:arena-preview',
        sourceLogId: null,
        contextJson: { arena: { official: false, preview: true } },
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceEvents).toBe(0);
    expect(lineage?.totals.danglingLearningFactSourceLogs).toBe(0);
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'learning-fact-source-event-dangling' }),
    ]));
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'learning-fact-source-log-dangling' }),
    ]));
  });

  it('flags legacy Yang Fan fixture learning fact source events', () => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [{
        id: 'legacy-yangfan-fixture-fact-assessment',
        userId: 'user-canonical',
        factType: 'question',
        sourceEventId: 'yangfan-diagnostic-fixture:adaptive-answer',
        sourceLogId: null,
      }, {
        id: 'legacy-yangfan-fixture-fact-path',
        userId: 'user-canonical',
        factType: 'resource',
        sourceEventId: 'yangfan-diagnostic-fixture:path-execution',
        sourceLogId: null,
      }, {
        id: 'legacy-yangfan-fixture-fact-konling',
        userId: 'user-canonical',
        factType: 'ai_intervention',
        sourceEventId: 'yangfan-diagnostic-fixture:konling-tool-run',
        sourceLogId: null,
      }, {
        id: 'legacy-yangfan-fixture-fact-arena-preview',
        userId: 'user-canonical',
        factType: 'simulation',
        sourceEventId: 'yangfan-diagnostic-fixture:arena-preview',
        sourceLogId: null,
        contextJson: { arena: { official: false, preview: true } },
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceEvents).toBe(4);
    expect(lineage?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:legacy-yangfan-fixture-fact-assessment',
      }),
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:legacy-yangfan-fixture-fact-path',
      }),
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:legacy-yangfan-fixture-fact-konling',
      }),
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:legacy-yangfan-fixture-fact-arena-preview',
      }),
    ]));
  });

  it('validates derived InteractionLog sourceEventId against the learning fact user', () => {
    const report = buildDataCompletenessAuditReport({
      interactionLogs: [{
        id: 'owner-log-id',
        userId: 'student-owner',
        eventType: 'lesson_submit',
        clientEventId: 'owner-client-event',
        attemptKey: 'attempt-owner',
        createdAt: '2026-07-02T00:00:00.000Z',
      }],
      eventDictionaryTypes: ['lesson_submit'],
      learningFacts: [{
        id: 'fact-owner-source-event',
        userId: 'student-owner',
        factType: 'question',
        sourceEventId: 'interaction-log:owner-log-id',
        sourceLogId: null,
      }, {
        id: 'fact-owner-historical-event',
        userId: 'student-owner',
        factType: 'question',
        sourceEventId: 'historical:InteractionLog:owner-log-id:lesson_submit',
        sourceLogId: null,
      }, {
        id: 'fact-cross-user-source-event',
        userId: 'student-other',
        factType: 'question',
        sourceEventId: 'interaction-log:owner-log-id',
        sourceLogId: null,
      }, {
        id: 'fact-cross-user-historical-event',
        userId: 'student-other',
        factType: 'question',
        sourceEventId: 'historical:InteractionLog:owner-log-id:lesson_submit',
        sourceLogId: null,
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceEvents).toBe(2);
    expect(lineage?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:fact-cross-user-source-event',
      }),
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:fact-cross-user-historical-event',
      }),
    ]));
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:fact-owner-source-event',
      }),
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:fact-owner-historical-event',
      }),
    ]));
  });

  it('treats governed historical materialization sources as valid external lineage', () => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [
        {
          id: 'fact-historical-simulation',
          userId: 'student-1',
          factType: 'simulation',
          sourceEventId: 'historical:SimulationLog:simulation-1:completed',
          sourceLogId: 'historical:SimulationLog:simulation-1',
        },
        {
          id: 'fact-historical-answer',
          userId: 'student-1',
          factType: 'answer',
          sourceEventId: 'historical:UserAnswer:answer-1:graded',
          sourceLogId: 'historical:UserAnswer:answer-1',
        },
        {
          id: 'fact-historical-ability',
          userId: 'student-1',
          factType: 'ability_assessment',
          sourceEventId: 'historical:AbilityAssessment:assessment-1:score',
          sourceLogId: 'historical:AbilityAssessment:assessment-1',
        },
        {
          id: 'fact-historical-prompt',
          userId: 'student-1',
          factType: 'prompt_assessment',
          sourceEventId: 'historical:PromptAssessment:prompt-1:rubric',
          sourceLogId: 'historical:PromptAssessment:prompt-1',
        },
        {
          id: 'fact-historical-design',
          userId: 'student-1',
          factType: 'design_session',
          sourceEventId: 'historical:DesignSession:design-1:checkpoint',
          sourceLogId: 'historical:DesignSession:design-1',
        },
        {
          id: 'fact-historical-arena',
          userId: 'student-1',
          factType: 'arena_submission',
          sourceEventId: 'historical:ArenaSubmission:submission-1:official',
          sourceLogId: 'historical:ArenaSubmission:submission-1',
        },
        {
          id: 'fact-historical-arena-evaluation',
          userId: 'student-1',
          factType: 'arena_evaluation',
          sourceEventId: 'historical:ArenaEvaluationRun:evaluation-1:official',
          sourceLogId: 'historical:ArenaEvaluationRun:evaluation-1',
        },
        {
          id: 'fact-legacy-migrated-simulation',
          userId: 'student-1',
          factType: 'simulation',
          sourceEventId: null,
          sourceLogId: 'simulation-log-legacy-1',
        },
        {
          id: 'fact-legacy-migrated-answer',
          userId: 'student-1',
          factType: 'question',
          sourceEventId: null,
          sourceLogId: 'user-answer-legacy-1',
        },
        {
          id: 'fact-legacy-migrated-ai-intervention',
          userId: 'student-1',
          factType: 'ai_intervention',
          sourceEventId: null,
          sourceLogId: 'ai-intervention-legacy-1',
        },
        {
          id: 'fact-legacy-migrated-prompt',
          userId: 'student-1',
          factType: 'prompt_design',
          sourceEventId: null,
          sourceLogId: 'prompt-assessment-legacy-1',
        },
      ],
      historicalSourceLogIds: [
        'simulation-log-legacy-1',
        'user-answer-legacy-1',
        'ai-intervention-legacy-1',
        'prompt-assessment-legacy-1',
      ],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceEvents).toBe(0);
    expect(lineage?.totals.danglingLearningFactSourceLogs).toBe(0);
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'learning-fact-source-event-dangling' }),
      expect.objectContaining({ id: 'learning-fact-source-log-dangling' }),
    ]));
  });

  it('validates historical sourceLogId against the learning fact user when ownership is known', () => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [{
        id: 'fact-owned-historical-source',
        userId: 'student-owner',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'answer-owned',
      }, {
        id: 'fact-cross-user-historical-source',
        userId: 'student-other',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'answer-owned',
      }],
      historicalSourceLogIds: [{
        id: 'answer-owned',
        userId: 'student-owner',
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceLogs).toBe(1);
    expect(lineage?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-log-dangling',
        stableRef: 'LearningFact:fact-cross-user-historical-source',
      }),
    ]));
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-log-dangling',
        stableRef: 'LearningFact:fact-owned-historical-source',
      }),
    ]));
  });

  it('keeps ownerless historical sourceLogId entries valid when mixed with owned entries', () => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [{
        id: 'fact-global-legacy-source',
        userId: 'student-owner',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'legacy-global-id',
      }, {
        id: 'fact-owned-source',
        userId: 'student-owner',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'owned-id',
      }, {
        id: 'fact-cross-owned-source',
        userId: 'student-other',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'owned-id',
      }],
      historicalSourceLogIds: [
        'legacy-global-id',
        { id: 'owned-id', userId: 'student-owner' },
      ],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceLogs).toBe(1);
    expect(lineage?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-log-dangling',
        stableRef: 'LearningFact:fact-cross-owned-source',
      }),
    ]));
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-log-dangling',
        stableRef: 'LearningFact:fact-global-legacy-source',
      }),
      expect.objectContaining({
        id: 'learning-fact-source-log-dangling',
        stableRef: 'LearningFact:fact-owned-source',
      }),
    ]));
  });

  it('prefers known historical sourceLogId ownership over duplicate ownerless entries', () => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [{
        id: 'fact-owned-duplicate-source',
        userId: 'student-owner',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'duplicate-id',
      }, {
        id: 'fact-cross-duplicate-source',
        userId: 'student-other',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'duplicate-id',
      }],
      historicalSourceLogIds: [
        'duplicate-id',
        { id: 'duplicate-id', userId: 'student-owner' },
      ],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceLogs).toBe(1);
    expect(lineage?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-log-dangling',
        stableRef: 'LearningFact:fact-cross-duplicate-source',
      }),
    ]));
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-log-dangling',
        stableRef: 'LearningFact:fact-owned-duplicate-source',
      }),
    ]));
  });

  it('masks Yang Fan fixture identifiers and reports duplicates as diagnostics only', () => {
    const report = buildDataCompletenessAuditReport({
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [
        {
          userId: 'user-canonical',
          name: 'Yang Fan',
          email: 'yangfan@example.edu',
          studentNumber: '20230010102605',
          learningFactCount: 3,
          knowledgeProgressCount: 2,
          pathExecutionCount: 1,
          pathExecutionEvidenceRefCount: 1,
          competencySnapshotCount: 1,
          profileSummaryCount: 1,
          adaptiveAssessmentStateCount: 2,
          featureCache: {
            sourceFactCount: 3,
            sourceCoverage: { LearningFact: 'available' },
          },
        },
        {
          userId: 'user-duplicate',
          name: '杨帆',
          email: null,
          studentNumber: null,
        },
      ],
    });

    const serialized = JSON.stringify(report);
    expect(report.learnerFixture.canonical?.maskedUserId).toMatch(/^Learner:sha256:/);
    expect(report.learnerFixture.displayLabel).toBe('canonical-fixture-account');
    expect(report.learnerFixture.displayNameHash).toMatch(/^sha256:/);
    expect(report.learnerFixture.canonical?.adaptiveAssessmentStateCount).toBe(2);
    expect(report.learnerFixture.duplicates).toHaveLength(1);
    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(false);
    expect(serialized).not.toContain('Yang Fan');
    expect(serialized).not.toContain('yangfan@example.edu');
    expect(serialized).not.toContain('20230010102605');
    expect(serialized).not.toContain('user-canonical');
    expect(serialized).not.toContain('杨帆');
  });

  it('reports learner fixture state gaps beyond facts, cache, and path evidence', () => {
    const report = buildDataCompletenessAuditReport({
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 3,
        knowledgeProgressCount: 0,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 0,
        profileSummaryCount: 0,
        featureCache: {
          sourceFactCount: 3,
          sourceCoverage: { LearningFact: 'available' },
        },
        adaptiveAssessmentStateCount: 0,
      }],
    });

    const layer = report.layers.find((entry) => entry.id === 'learnerFixtureReadiness');
    expect(layer?.severity).toBe('partial');
    expect(layer?.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining([
      'fixture-knowledge-progress-missing',
      'fixture-competency-snapshot-missing',
      'fixture-profile-summary-missing',
      'fixture-adaptive-assessment-state-missing',
    ]));
    expect(report.followupBuckets).toEqual(expect.arrayContaining([
      'refresh-competency-snapshots',
      'refresh-profile-summaries',
      'materialize-fixture-adaptive-assessment-state',
    ]));
    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(false);
  });

  it('blocks fixture generation when resource prerequisites remain blocked', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'blocked-controller',
        label: 'Blocked controller resource',
        type: 'SIMULATION_APP',
        knowledgeNodeIds: ['kn-controller'],
      }],
    });
    const report = buildDataCompletenessAuditReport({
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'controller correction',
        description: 'Controller correction concept.',
        tags: ['correction'],
        resources: ['resource:blocked-controller'],
        isActive: true,
        sourceLinkCount: 1,
        targetLinkCount: 1,
      }],
      teachingResources: [{
        id: 'resource-blocked',
        title: 'Blocked controller resource',
        registryId: 'blocked-controller',
        knowledgeNodeIds: ['kn-controller'],
      }],
      resourceRegistry: registry,
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 3,
        knowledgeProgressCount: 1,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 1,
        profileSummaryCount: 1,
        adaptiveAssessmentStateCount: 1,
        featureCache: {
          sourceFactCount: 3,
          sourceCoverage: { LearningFact: 'available' },
        },
      }],
    });

    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(true);
    expect(report.learnerFixture.blockers).toEqual(expect.arrayContaining([
      expect.stringMatching(/^resourceBinding:/),
      expect.stringMatching(/^pathReadiness:/),
    ]));
  });

  it('blocks fixture generation when canonical evidence lineage is blocked', () => {
    const report = buildDataCompletenessAuditReport({
      interactionLogs: [{
        id: 'canonical-log',
        userId: 'user-canonical',
        eventType: 'lesson_submit',
        clientEventId: 'canonical-client-event',
        attemptKey: 'attempt-1',
        clientEventAt: null,
        createdAt: null,
      }],
      learningFacts: [{
        id: 'canonical-dangling-fact',
        userId: 'user-canonical',
        factType: 'question',
        sourceEventId: 'missing-client-event',
        sourceLogId: null,
      }, {
        id: 'canonical-dangling-log-fact',
        userId: 'user-canonical',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'missing-log',
      }],
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 1,
        knowledgeProgressCount: 1,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 1,
        profileSummaryCount: 1,
        adaptiveAssessmentStateCount: 1,
        featureCache: {
          sourceFactCount: 1,
          sourceCoverage: { LearningFact: 'available' },
        },
      }],
    });

    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(true);
    expect(report.learnerFixture.blockers).toContain('evidenceLineage:learning-fact-source-event-dangling');
    expect(report.learnerFixture.blockers).toContain('evidenceLineage:learning-fact-source-log-dangling');
    expect(report.learnerFixture.blockers).toContain('evidenceLineage:interaction-log-timestamp-missing');
  });

  it('blocks fixture generation when global evidence batches remain unprocessed', () => {
    const report = buildDataCompletenessAuditReport({
      learningEventBatches: [{
        id: 'batch-unprocessed',
        eventCount: 2,
        processedAt: null,
      }],
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 1,
        knowledgeProgressCount: 1,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 1,
        profileSummaryCount: 1,
        adaptiveAssessmentStateCount: 1,
        featureCache: {
          sourceFactCount: 1,
          sourceCoverage: { LearningFact: 'available' },
        },
      }],
    });

    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(true);
    expect(report.learnerFixture.blockers).toContain('evidenceLineage:learning-event-batch-unprocessed');
  });

  it('does not block canonical fixture generation for unrelated learner lineage blockers', () => {
    const report = buildDataCompletenessAuditReport({
      interactionLogs: [{
        id: 'canonical-log',
        userId: 'user-canonical',
        eventType: 'lesson_submit',
        clientEventId: 'canonical-client-event',
        attemptKey: 'attempt-1',
        createdAt: '2026-07-02T00:00:00.000Z',
      }],
      eventDictionaryTypes: ['lesson_submit'],
      learningFacts: [{
        id: 'canonical-fact',
        userId: 'user-canonical',
        factType: 'question',
        sourceEventId: 'canonical-client-event',
        sourceLogId: null,
      }, {
        id: 'other-dangling-fact',
        userId: 'user-other',
        factType: 'question',
        sourceEventId: 'missing-client-event',
        sourceLogId: null,
      }],
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 1,
        knowledgeProgressCount: 1,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 1,
        profileSummaryCount: 1,
        adaptiveAssessmentStateCount: 1,
        featureCache: {
          sourceFactCount: 1,
          sourceCoverage: { LearningFact: 'available' },
        },
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.severity).toBe('blocked');
    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(false);
    expect(report.learnerFixture.blockers).not.toContain('evidenceLineage:learning-fact-source-event-dangling');
  });

  it('does not leak canonical fixture display fields when the account is missing', () => {
    const report = buildDataCompletenessAuditReport({
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [],
    });
    const serialized = JSON.stringify(report);
    const markdown = renderDataCompletenessAuditMarkdown(report);

    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(true);
    expect(report.learnerFixture.displayNameHash).toMatch(/^sha256:/);
    expect(serialized).not.toContain('Yang Fan');
    expect(serialized).not.toContain('yangfan@example.edu');
    expect(serialized).not.toContain('20230010102605');
    expect(markdown).not.toContain('Yang Fan');
    expect(markdown).not.toContain('yangfan@example.edu');
    expect(markdown).not.toContain('20230010102605');
  });

  it('renders a compact Markdown summary for reviewers', () => {
    const report = buildDataCompletenessAuditReport({
      generatedAt: '2026-07-02T00:00:00.000Z',
      knowledgeNodes: [],
    });

    const markdown = renderDataCompletenessAuditMarkdown(report);
    expect(markdown).toContain('# Data Completeness Audit');
    expect(markdown).toContain('## Graph core');
    expect(markdown).toContain('## Learner Fixture');
  });
});

function hashGraphResourceCoverageTestNode(node: { id: string; name: string; description: string | null; tags: string[]; resources?: unknown }) {
  const payload = JSON.stringify({
    id: node.id,
    name: node.name,
    description: node.description ?? null,
    tags: node.tags ?? [],
    resources: Array.isArray(node.resources) ? node.resources : [],
  });
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}
