import { describe, expect, it } from 'vitest';
import { buildGraphCenterPayload } from '../graph-center';
import {
  createLearningEvidenceCorpusChunk,
  verifyLearningEvidenceCitations,
  type LearningEvidenceCorpusChunk,
} from '../learning-evidence-rag-corpus';
import { textbookSearchDocumentsToLearningEvidenceCorpus } from '../graph-center-evidence';
import { teachingResourceWhereForGraphCenter } from '../graph-center-source-scope';
import { buildResourceNodeRegistry } from '../../resource-node-registry';
import type { TextbookRuntimeSearchDocument } from '../../textbook-runtime-resources';

describe('graph center payload service', () => {
  it('builds a knowledge-domain payload with objectives, portrait dimensions, and selected node detail', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });

    expect(payload.activeDomain).toBe('knowledge');
    expect(payload.domains.map((domain) => domain.id)).toEqual(['knowledge', 'capability', 'quality']);
    expect(payload.graph.nodes.every((node) => node.domain === 'knowledge')).toBe(true);
    expect(payload.graph.edges.every((edge) => edge.domain === 'knowledge')).toBe(true);
    expect(payload.objectives.some((objective) => objective.id === 'knowledge:autocontrol:controller-correction')).toBe(true);
    expect(payload.portraitDimensions.some((dimension) => dimension.id === 'controllerDesignSynthesis')).toBe(true);
    expect(payload.selectedNode?.node.id).toBe('kn:autocontrol:controller-correction');
    expect(payload.selectedNode?.objectives.map((objective) => objective.id)).toContain('knowledge:autocontrol:controller-correction');
    expect(payload.selectedNode?.boundResourceRefs).toEqual(expect.arrayContaining([
      'PID控制器_6_656b8b52',
      '串联校正_6_fede5751',
    ]));
    expect(payload.validation.objectiveValidation.valid).toBe(true);
    expect(payload.validation.graphValidation.valid).toBe(true);
  });

  it('filters by objective and portrait dimension while keeping selected-node details consistent', () => {
    const payload = buildGraphCenterPayload({
      domain: 'capability',
      objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
      portraitDimension: 'simulationValidationEvidence',
      selectedNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
    });

    expect(payload.activeDomain).toBe('capability');
    expect(payload.objectiveId).toBe('capability:autocontrol:validate-with-simulation-evidence');
    expect(payload.portraitDimension).toBe('simulationValidationEvidence');
    expect(payload.graph.nodes.map((node) => node.id)).toEqual(['cap:autocontrol:validate-with-simulation-evidence']);
    expect(payload.selectedNode?.node.id).toBe('cap:autocontrol:validate-with-simulation-evidence');
    expect(payload.selectedNode?.node.objectiveIds).toContain(payload.objectiveId);
    expect(payload.selectedNode?.node.portraitDimensions).toContain(payload.portraitDimension);
    expect(payload.selectedNode?.boundResourceRefs).toEqual(expect.arrayContaining([
      'cap:autocontrol:validate-with-simulation-evidence',
      'kn:autocontrol:simulation-validation',
    ]));
  });

  it('filters overall objectives through graph-binding refs instead of returning an empty graph', () => {
    const knowledgePayload = buildGraphCenterPayload({
      domain: 'knowledge',
      objectiveId: 'knowledge:autocontrol',
    });
    const capabilityPayload = buildGraphCenterPayload({
      domain: 'capability',
      objectiveId: 'capability:autocontrol',
    });
    const qualityPayload = buildGraphCenterPayload({
      domain: 'quality',
      objectiveId: 'quality:autocontrol',
    });

    expect(knowledgePayload.objectives.find((objective) => objective.id === 'knowledge:autocontrol')?.nodeCount).toBe(
      knowledgePayload.domains.find((domain) => domain.id === 'knowledge')?.nodeCount,
    );
    expect(knowledgePayload.graph.nodes.length).toBeGreaterThan(0);
    expect(capabilityPayload.graph.nodes.length).toBeGreaterThan(0);
    expect(qualityPayload.graph.nodes.length).toBeGreaterThan(0);
    expect(knowledgePayload.graph.nodes.every((node) => node.domain === 'knowledge')).toBe(true);
    expect(capabilityPayload.graph.nodes.every((node) => node.domain === 'capability')).toBe(true);
    expect(qualityPayload.graph.nodes.every((node) => node.domain === 'quality')).toBe(true);
  });

  it('drops invalid filters instead of leaking nodes across domains', () => {
    const payload = buildGraphCenterPayload({
      domain: 'quality',
      objectiveId: 'knowledge:autocontrol:controller-correction',
      portraitDimension: 'controllerDesignSynthesis',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });

    expect(payload.activeDomain).toBe('quality');
    expect(payload.objectiveId).toBeNull();
    expect(payload.selectedNode).toBeNull();
    expect(payload.graph.nodes.every((node) => node.domain === 'quality')).toBe(true);
  });

  it('drops portrait dimensions that are valid globally but unavailable in the active domain', () => {
    const payload = buildGraphCenterPayload({
      domain: 'quality',
      portraitDimension: 'controllerDesignSynthesis',
    });

    expect(payload.activeDomain).toBe('quality');
    expect(payload.portraitDimension).toBeNull();
    expect(payload.graph.nodes.length).toBeGreaterThan(0);
    expect(payload.portraitDimensions.every((dimension) => dimension.id !== 'controllerDesignSynthesis')).toBe(true);
    expect(payload.graph.nodes.every((node) => node.domain === 'quality')).toBe(true);
  });

  it('surfaces seed-coverage limitations and keeps overlay placeholders separate from graph body nodes', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });

    expect(payload.limitations.map((limitation) => limitation.code)).toEqual(expect.arrayContaining([
      'partial-seed-coverage',
      'learner-overlay-unavailable',
      'class-overlay-unavailable',
    ]));
    expect(payload.overlays).toEqual({
      learner: 'unavailable',
      class: 'unavailable',
      resourceCoverage: 'available',
    });
    for (const node of payload.graph.nodes) {
      expect(Object.hasOwn(node, 'learner')).toBe(false);
      expect(Object.hasOwn(node, 'class')).toBe(false);
      expect(Object.hasOwn(node, 'resourceCoverage')).toBe(false);
      expect(Object.hasOwn(node, 'coveredResourceIds')).toBe(false);
    }
  });

  it('marks resource coverage sufficient only when indexed, citation-ready, and verified citation signals are all present', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      resourceRegistry: fullCoverageRegistry(),
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-controller-correction-verified',
          knowledgeNodeRefs: ['PID控制器_6_656b8b52'],
          citationAddress: {
            kind: 'text',
            sourceRefId: 'lesson15-series-knowledge-deck',
            href: '/interactive-learning/resources/lesson15-series-knowledge-deck',
            locator: 'section#pid',
            contentHash: 'hash-controller-correction',
          },
          contentHash: 'hash-controller-correction',
        }),
      ],
    });

    expect(payload.selectedNode?.resourceCoverage.coverageState).toBe('sufficient');
    expect(payload.selectedNode?.resourceCoverage.linkedResourceCount).toBeGreaterThan(0);
    expect(payload.selectedNode?.resourceCoverage.pathEligibleResourceCount).toBeGreaterThan(0);
    expect(payload.selectedNode?.resourceCoverage.ragIndexedCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.citationReadyCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.verifiedCitationCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.assessmentResourceCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.simulationResourceCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.arenaPreviewResourceCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.arenaOfficialResourceCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.terminalValidationCapableResourceCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.missingCoverageTypes).toEqual([]);
  });

  it('keeps linked-resource and path-eligible counts distinct', () => {
    const resourceRegistry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'linked-ready',
          label: 'Linked ready resource',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/resources/linked-ready',
          knowledgeNodeIds: ['反馈_1_1'],
          planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit'],
          },
        },
        {
          id: 'linked-blocked',
          label: 'Linked blocked resource',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/resources/linked-blocked',
          knowledgeNodeIds: ['反馈_1_1'],
          planningOverride: {
            estimatedTimeMinutes: 8,
            teacherPolicy: 'blocked',
            evidenceInstrumentation: ['answer_submit'],
          },
        },
      ],
    });
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:feedback-loop',
      resourceRegistry,
    });

    expect(payload.selectedNode?.resourceCoverage.linkedResourceCount).toBe(2);
    expect(payload.selectedNode?.resourceCoverage.pathEligibleResourceCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.linkedResourceIds).toEqual([
      'registry:linked-blocked',
      'registry:linked-ready',
    ]);
    expect(payload.selectedNode?.resourceCoverage.pathEligibleResourceIds).toEqual(['registry:linked-ready']);
  });

  it('keeps RAG-indexed, citation-ready, and verified-citation counts distinct', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:feedback-loop',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-indexed-only',
          knowledgeNodeRefs: ['反馈_1_1'],
        }),
        ragChunk({
          id: 'chunk-citation-ready-not-verified',
          knowledgeNodeRefs: ['反馈_1_1'],
          citationAddress: {
            kind: 'text',
            sourceRefId: 'lesson01-feedback-precheck-v1',
            href: '/interactive-learning/resources/lesson01-feedback-precheck-v1',
            locator: 'section#feedback',
            contentHash: 'stale-hash',
          },
          contentHash: 'fresh-hash',
        }),
      ],
    });

    expect(payload.selectedNode?.resourceCoverage.coverageState).toBe('partial');
    expect(payload.selectedNode?.resourceCoverage.ragIndexedCount).toBe(2);
    expect(payload.selectedNode?.resourceCoverage.citationReadyCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.verifiedCitationCount).toBe(0);
    expect(payload.selectedNode?.resourceCoverage.missingCoverageTypes).toEqual(expect.arrayContaining([
      'simulation-resource',
      'arena-preview-resource',
      'arena-official-resource',
      'terminal-validation-capable-resource',
    ]));
    expect(payload.selectedNode?.limitations.map((limitation) => limitation.code)).toContain(
      'resource-coverage-indexed-without-verified-citation',
    );
  });

  it('shows indexed-without-verified-citation limitations for capability nodes', () => {
    const payload = buildGraphCenterPayload({
      domain: 'capability',
      selectedNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-capability-indexed-only',
          knowledgeNodeRefs: ['kn:autocontrol:simulation-validation'],
        }),
      ],
    });

    expect(payload.selectedNode?.resourceCoverage.ragIndexedCount).toBe(1);
    expect(payload.selectedNode?.resourceCoverage.verifiedCitationCount).toBe(0);
    expect(payload.selectedNode?.limitations.map((limitation) => limitation.code)).toContain(
      'resource-coverage-indexed-without-verified-citation',
    );
  });

  it('does not count projected chunks that only share a resource id but target unrelated graph refs', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:feedback-loop',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-shared-resource-unrelated-projection',
          knowledgeNodeRefs: ['unrelated-knowledge-node'],
          resourceId: 'registry:lesson01-feedback-precheck-v1',
        }),
      ],
    });

    expect(payload.selectedNode?.resourceCoverage.linkedResourceCount).toBeGreaterThan(0);
    expect(payload.selectedNode?.resourceCoverage.ragIndexedCount).toBe(0);
  });

  it('exposes missing and not-audited coverage states without pretending answerability', () => {
    const missingPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
    });
    const notAuditedPayload = buildGraphCenterPayload({
      domain: 'quality',
      selectedNodeId: 'qual:autocontrol:evidence-integrity',
    });

    expect(missingPayload.selectedNode?.resourceCoverage.coverageState).toBe('missing');
    expect(missingPayload.selectedNode?.resourceCoverage.missingCoverageTypes).toEqual(expect.arrayContaining([
      'linked-resource',
      'path-eligible-resource',
    ]));
    expect(notAuditedPayload.selectedNode?.resourceCoverage.coverageState).toBe('not-audited');
    expect(notAuditedPayload.selectedNode?.resourceCoverage.missingCoverageTypes).toEqual([]);
  });

  it('projects textbook runtime search documents into citation-verifiable coverage corpus without raw text', () => {
    const [chunk] = textbookSearchDocumentsToLearningEvidenceCorpus([
      textbookDocument({
        id: 'dorf-ch10-sec01-chunk-001',
        text: 'Root-locus compensation raw textbook text should not be copied.',
        contentHash: 'hash-textbook-section',
        knowledgeNodeRefs: ['PID控制器_6_656b8b52'],
      }),
    ]);
    const verification = verifyLearningEvidenceCitations(
      [chunk],
      { role: 'teacher', useCase: 'konling' },
      [{
        chunkId: chunk.id,
        sourceType: chunk.sourceType,
        useCase: 'konling',
        addressKind: chunk.citationAddress?.kind,
      }],
      { minimumAuthority: 'contextual' },
    );

    expect(chunk.content.text).toBeNull();
    expect(chunk.display.capsule).toBe('Modern Control Systems 第 10 章 10.1 节');
    expect(chunk.resourceProjection?.knowledgeNodeRefs).toEqual(['PID控制器_6_656b8b52']);
    expect(verification.status).toBe('verified');
  });

  it('scopes graph-center DB teaching resources by viewer role', () => {
    expect(teachingResourceWhereForGraphCenter('STUDENT', 'student-1')).toBeNull();
    expect(teachingResourceWhereForGraphCenter(undefined, undefined)).toBeNull();
    expect(teachingResourceWhereForGraphCenter('TEACHER', null)).toBeNull();
    expect(teachingResourceWhereForGraphCenter('TEACHER', 'teacher-1')).toEqual({ authorId: 'teacher-1' });
    expect(teachingResourceWhereForGraphCenter('ADMIN', 'admin-1')).toEqual({});
  });
});

function ragChunk(input: {
  id: string;
  knowledgeNodeRefs: string[];
  citationAddress?: LearningEvidenceCorpusChunk['citationAddress'];
  contentHash?: string;
  resourceId?: string;
}): LearningEvidenceCorpusChunk {
  const contentHash = input.contentHash ?? `${input.id}:hash`;
  const resourceId = input.resourceId ?? input.id;
  return createLearningEvidenceCorpusChunk({
    id: input.id,
    family: 'course-content',
    sourceType: 'course-content',
    sourceRef: {
      id: input.id,
      ownerUserId: null,
      classId: null,
      goalId: 'graph-resource-coverage',
      resourceId,
    },
    spanRef: { kind: 'text-range', start: 0, end: 20, locator: 'section#coverage' },
    display: {
      title: input.id,
      href: `/learning-evidence/${input.id}`,
      capsule: 'Resource coverage fixture.',
    },
    citationAddress: input.citationAddress,
    content: {
      text: null,
      redactedSummary: 'Resource coverage fixture.',
      hash: contentHash,
    },
    resourceProjection: {
      resourceId,
      segmentRef: `${input.id}:segment`,
      citationTargetRef: input.citationAddress ? `${input.id}:citation` : null,
      knowledgeNodeRefs: input.knowledgeNodeRefs,
      capabilityTargetRefs: [],
      contentHash,
    },
    privacyClass: 'public',
    confidence: 'high',
    freshness: {
      indexedAt: '2026-06-21T00:00:00.000Z',
      sourceUpdatedAt: '2026-06-20T00:00:00.000Z',
      expiresAt: null,
      stale: false,
    },
    authority: {
      level: 'canonical',
      knowledgeTags: input.knowledgeNodeRefs,
      pageAnchor: 'section#coverage',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'public',
        allowedRoles: ['student', 'teacher', 'admin', 'service'],
      },
      conflictGroup: null,
      conflictSignal: null,
    },
    retrieval: {
      tags: input.knowledgeNodeRefs,
      goals: ['graph-resource-coverage'],
      useCases: ['konling', 'diagnosis', 'prep-pack'],
    },
  });
}

function fullCoverageRegistry() {
  return buildResourceNodeRegistry({
    registeredResources: [
      {
        id: 'full-coverage-assessment',
        label: 'Full coverage assessment',
        type: 'ADAPTIVE_QUIZ',
        renderTarget: '/resources/full-coverage-assessment',
        knowledgeNodeIds: ['PID控制器_6_656b8b52'],
        planningOverride: {
          estimatedTimeMinutes: 8,
          evidenceInstrumentation: ['adaptive_assessment'],
        },
      },
    ],
    simulations: [
      {
        id: 'full-coverage-simulation',
        title: 'Full coverage simulation',
        launchTarget: '/simulations/full-coverage',
        knowledgeNodeIds: ['PID控制器_6_656b8b52'],
        planningOverride: {
          estimatedTimeMinutes: 12,
          evidenceInstrumentation: ['simulation_run'],
        },
      },
    ],
    arenaTasks: [
      {
        id: 'full-coverage-arena-preview',
        title: 'Full coverage Arena preview',
        launchTarget: '/arena/full-coverage-preview',
        knowledgeNodeIds: ['PID控制器_6_656b8b52'],
        official: false,
        planningOverride: {
          estimatedTimeMinutes: 12,
          evidenceInstrumentation: ['arena_simulation_run'],
        },
      },
      {
        id: 'full-coverage-arena-official',
        title: 'Full coverage Arena official',
        launchTarget: '/arena/full-coverage-official',
        knowledgeNodeIds: ['PID控制器_6_656b8b52'],
        official: true,
        planningOverride: {
          estimatedTimeMinutes: 12,
          terminalConstraints: ['terminal-validation'],
          evidenceInstrumentation: ['arena_evaluation_complete'],
        },
      },
    ],
  });
}

function textbookDocument(input: {
  id: string;
  text: string;
  contentHash: string;
  knowledgeNodeRefs: string[];
}): TextbookRuntimeSearchDocument {
  return {
    id: input.id,
    kind: 'chunk',
    title: 'Modern Control Systems 第 10 章 10.1 节',
    href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01.md#chunk-001',
    text: input.text,
    contentHash: input.contentHash,
    resourceProjection: {
      resourceId: 'textbook-section:dorf-modern-control-systems:ch10-sec01',
      segmentRef: 'ch10-sec01',
      citationTargetRef: 'ch10-sec01__chunk-001',
      knowledgeNodeRefs: input.knowledgeNodeRefs,
      capabilityTargetRefs: ['parameterDesign'],
      contentHash: input.contentHash,
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: 'ch10-sec01__chunk-001',
      href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01.md#chunk-001',
      locator: 'chunk-001',
      contentHash: input.contentHash,
    },
    metadata: {
      bookId: 'dorf-modern-control-systems',
      sectionId: 'ch10-sec01',
      chapterId: 'chapter-10',
      chapterNumber: 10,
    },
  };
}
