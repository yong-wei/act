import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildGraphCenterPayload,
  canReadGraphCenterClassOverlay,
  canReadGraphCenterLearnerOverlay,
} from '../graph-center';
import { filterGraphCenterPayload } from '../../../features/graph-center/graph-center-client';
import { PLATFORM_PRIMARY_ROUTE_INVENTORY } from '../../platform-role-navigation';
import type { AdaptiveLearnerState, MasteryEvidenceReference } from '../adaptive-learner-state-service';
import {
  createLearningEvidenceCorpusChunk,
  verifyLearningEvidenceCitations,
  type LearningEvidenceCorpusChunk,
} from '../learning-evidence-rag-corpus';
import { buildKaqArtifactVersionRefs } from '../../kaq-artifact-versioning';
import { textbookSearchDocumentsToLearningEvidenceCorpus } from '../graph-center-evidence';
import { teachingResourceWhereForGraphCenter } from '../graph-center-source-scope';
import { filterTeacherResourceNodes } from '../../teacher-resource-node-management';
import { buildResourceNodeRegistry } from '../../resource-node-registry';
import type { TextbookRuntimeSearchDocument } from '../../textbook-runtime-resources';

const teacherAnalyticsV2Source = readFileSync(
  join(process.cwd(), 'src/app/teacher/classes/[classId]/analytics-v2/page.tsx'),
  'utf8',
);
const adminDataGovernancePageSource = readFileSync(
  join(process.cwd(), 'src/app/admin/data-governance/page.tsx'),
  'utf8',
);
const adminDataGovernanceDashboardSource = readFileSync(
  join(process.cwd(), 'src/features/admin/data-governance-dashboard.tsx'),
  'utf8',
);
const adaptivePracticePageSource = readFileSync(
  join(process.cwd(), 'src/app/assessment/adaptive-practice/page.tsx'),
  'utf8',
);
const adaptivePathAdvisorContextRouteSource = readFileSync(
  join(process.cwd(), 'src/app/api/adaptive/path-advisor-context/route.ts'),
  'utf8',
);
const adaptivePathAdvisorToolRouteSource = readFileSync(
  join(process.cwd(), 'src/app/api/adaptive/path-advisor-tool/route.ts'),
  'utf8',
);
const adminDataGovernanceStatusRouteSource = readFileSync(
  join(process.cwd(), 'src/app/api/admin/data-governance/status/route.ts'),
  'utf8',
);
const teacherPrepPacksPageSource = readFileSync(
  join(process.cwd(), 'src/app/teacher/prep-packs/page.tsx'),
  'utf8',
);
const graphCenterPageSource = readFileSync(
  join(process.cwd(), 'src/app/graph-center/page.tsx'),
  'utf8',
);
const graphCenterClientSource = readFileSync(
  join(process.cwd(), 'src/features/graph-center/graph-center-client.tsx'),
  'utf8',
);

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

  it('shows SAR resource gap suggestions without promoting candidates into official coverage', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-simulation-gap',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'external:sar-simulation-gap',
        }),
        ragChunk({
          id: 'chunk-sar-unrelated-gap',
          knowledgeNodeRefs: ['unrelated-knowledge-node'],
          resourceId: 'external:sar-unrelated-gap',
        }),
      ],
      sarAssociation: {
        enabled: true,
        classId: 'class-1',
      },
    });
    const coverage = payload.selectedNode?.resourceCoverage;
    const associated = payload.selectedNode?.associatedEvidence;

    expect(coverage?.linkedResourceCount).toBe(0);
    expect(coverage?.pathEligibleResourceCount).toBe(0);
    expect(coverage?.citationReadyCount).toBe(0);
    expect(coverage?.verifiedCitationCount).toBe(0);
    expect(coverage?.ragIndexedCount).toBe(1);
    expect(associated?.status).toBe('available');
    expect(associated?.candidateRefs.retrievalChunkIds).toContain('chunk-sar-simulation-gap');
    expect(JSON.stringify(associated)).not.toContain('chunk-sar-unrelated-gap');
    expect(JSON.stringify(associated)).not.toContain('external:sar-unrelated-gap');
    expect(associated?.resourceGapSuggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ref: 'chunk-sar-simulation-gap',
        refType: 'retrieval-chunk',
        status: 'suggested',
        draft: true,
        review: expect.objectContaining({
          state: 'suggested',
          authoritative: false,
          availableActions: ['accept', 'reject', 'defer', 'invalidate'],
          auditPayload: expect.objectContaining({
            candidateRef: 'chunk-sar-simulation-gap',
            candidateRefType: 'retrieval-chunk',
            missingCoverageTypes: expect.arrayContaining([
              'linked-resource',
              'path-eligible-resource',
            ]),
            provenance: expect.objectContaining({
              source: 'graph-center-sar',
            }),
            traceSummary: expect.objectContaining({
              traceHopCount: expect.any(Number),
            }),
          }),
        }),
        suggestedForMissingCoverageTypes: expect.arrayContaining([
          'linked-resource',
          'path-eligible-resource',
        ]),
      }),
    ]));
    expect(associated?.resourceGapSuggestions[0]?.rationale.reason).toContain('ResourceNode governance review');
  });

  it('keeps SAR associated evidence when the client switches from a root payload to another node', () => {
    const rootPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-switch-target-gap',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'external:sar-switch-target-gap',
        }),
      ],
      sarAssociation: {
        enabled: true,
        classId: 'class-1',
      },
    });
    const filtered = filterGraphCenterPayload(rootPayload, {
      objectiveId: null,
      portraitDimension: null,
      selectedNodeId: 'kn:autocontrol:simulation-validation',
    });
    const associated = filtered.selectedNode?.associatedEvidence;

    expect(filtered.selectedNode?.node.id).toBe('kn:autocontrol:simulation-validation');
    expect(associated?.status).toBe('available');
    expect(associated?.candidateRefs.retrievalChunkIds).toContain('chunk-sar-switch-target-gap');
    expect(associated?.resourceGapSuggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ref: 'chunk-sar-switch-target-gap',
        status: 'suggested',
        draft: true,
      }),
    ]));
  });

  it('does not trust raw SAR classId without an authorized class overlay', () => {
    const unauthorizedPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-unowned-class-gap',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'secret-resource-class-2',
          classId: 'class-2',
          privacyClass: 'teacher-visible',
        }),
      ],
      classOverlay: {
        classId: 'class-2',
        viewerRole: 'teacher',
        authorized: false,
        learnerStates: [],
      },
      sarAssociation: {
        enabled: true,
        classId: 'class-2',
      },
    });
    const authorizedPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-owned-class-gap',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'owned-resource-class-1',
          classId: 'class-1',
          privacyClass: 'teacher-visible',
        }),
      ],
      classOverlay: {
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: true,
        learnerStates: [
          learnerState({ userId: 'learner-1', targetId: 'kn:autocontrol:simulation-validation', score: 0.9, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-2', targetId: 'kn:autocontrol:simulation-validation', score: 0.7, confidence: 0.7, evidenceCount: 3, classId: 'class-1' }),
          learnerState({ userId: 'learner-3', targetId: 'kn:autocontrol:simulation-validation', score: 0.5, confidence: 0.7, evidenceCount: 3, classId: 'class-1' }),
          learnerState({ userId: 'learner-4', targetId: 'kn:autocontrol:simulation-validation', score: 0.3, confidence: 0.7, evidenceCount: 3, classId: 'class-1' }),
          learnerState({ userId: 'learner-5', targetId: 'kn:autocontrol:simulation-validation', score: 0.2, confidence: 0.7, evidenceCount: 3, classId: 'class-1' }),
        ],
      },
      sarAssociation: {
        enabled: true,
        classId: 'class-2',
      },
    });

    expect(unauthorizedPayload.classOverlay.status).toBe('unauthorized');
    expect(unauthorizedPayload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).not.toContain('chunk-sar-unowned-class-gap');
    expect(unauthorizedPayload.selectedNode?.associatedEvidence?.candidateRefs.resourceNodeIds).not.toContain('secret-resource-class-2');
    expect(unauthorizedPayload.selectedNode?.associatedEvidence?.resourceGapSuggestions).toEqual([]);
    expect(JSON.stringify(unauthorizedPayload.selectedNode?.associatedEvidence)).not.toContain('secret-resource-class-2');
    expect(JSON.stringify(unauthorizedPayload.selectedNode?.associatedEvidence)).not.toContain('chunk-sar-unowned-class-gap');

    expect(authorizedPayload.classOverlay.status).toBe('available');
    expect(authorizedPayload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).toContain('chunk-sar-owned-class-gap');
    expect(authorizedPayload.selectedNode?.associatedEvidence?.resourceGapSuggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ref: 'chunk-sar-owned-class-gap',
        status: 'suggested',
        draft: true,
      }),
    ]));
  });

  it('does not expose owner-scoped SAR limitations from a raw teacher learnerId without authorized class scope', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-unowned-learner-gap',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'secret-resource-learner-2',
          ownerUserId: 'learner-2',
          classId: 'class-2',
          privacyClass: 'student-visible',
        }),
      ],
      sarAssociation: {
        enabled: true,
        studentId: 'learner-2',
      },
    });
    const serialized = JSON.stringify(payload.selectedNode?.associatedEvidence);

    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).not.toContain('chunk-sar-unowned-learner-gap');
    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.resourceNodeIds).not.toContain('secret-resource-learner-2');
    expect(payload.selectedNode?.associatedEvidence?.resourceGapSuggestions).toEqual([]);
    expect(serialized).not.toContain('chunk-sar-unowned-learner-gap');
    expect(serialized).not.toContain('secret-resource-learner-2');
    expect(serialized).not.toContain('learner-2');
    expect(serialized).not.toContain('class-2');
  });

  it('uses authorized learner overlay class scope for teacher personal-view SAR candidates', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-owned-learner-gap',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'owned-resource-learner-1',
          ownerUserId: 'learner-1',
          classId: 'class-1',
          privacyClass: 'student-visible',
        }),
      ],
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-1',
          targetId: 'kn:autocontrol:simulation-validation',
          score: 0.42,
          confidence: 0.7,
          evidenceCount: 2,
          classId: 'class-1',
        }),
        requestedLearnerId: 'learner-1',
        viewerRole: 'teacher',
        authorized: true,
      },
      sarAssociation: {
        enabled: true,
        studentId: 'learner-1',
      },
    });

    expect(payload.learnerOverlay.classId).toBe('class-1');
    expect(payload.classOverlay.status).toBe('unavailable');
    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).toContain('chunk-sar-owned-learner-gap');
    expect(payload.selectedNode?.associatedEvidence?.resourceGapSuggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ref: 'chunk-sar-owned-learner-gap',
        status: 'suggested',
        draft: true,
      }),
    ]));
  });

  it('does not include same-class owner-scoped SAR candidates for another learner in teacher personal view', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-other-learner-gap',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'other-learner-resource',
          ownerUserId: 'learner-2',
          classId: 'class-1',
          privacyClass: 'student-visible',
        }),
      ],
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-1',
          targetId: 'kn:autocontrol:simulation-validation',
          score: 0.42,
          confidence: 0.7,
          evidenceCount: 2,
          classId: 'class-1',
        }),
        requestedLearnerId: 'learner-1',
        viewerRole: 'teacher',
        authorized: true,
      },
      sarAssociation: {
        enabled: true,
        studentId: 'learner-1',
      },
    });
    const serialized = JSON.stringify(payload.selectedNode?.associatedEvidence);

    expect(payload.learnerOverlay.classId).toBe('class-1');
    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).not.toContain('chunk-sar-other-learner-gap');
    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.resourceNodeIds).not.toContain('other-learner-resource');
    expect(payload.selectedNode?.associatedEvidence?.resourceGapSuggestions).toEqual([]);
    expect(serialized).not.toContain('chunk-sar-other-learner-gap');
    expect(serialized).not.toContain('other-learner-resource');
    expect(serialized).not.toContain('learner-2');
  });

  it('keeps teacher personal-view SAR scoped to the authorized learner when class overlay is also present', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-own-learner-with-class-overlay',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'own-learner-resource',
          ownerUserId: 'learner-1',
          classId: 'class-1',
          privacyClass: 'student-visible',
        }),
        ragChunk({
          id: 'chunk-sar-other-learner-with-class-overlay',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'other-learner-resource-with-class-overlay',
          ownerUserId: 'learner-2',
          classId: 'class-1',
          privacyClass: 'student-visible',
        }),
      ],
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-1',
          targetId: 'kn:autocontrol:simulation-validation',
          score: 0.42,
          confidence: 0.7,
          evidenceCount: 2,
          classId: 'class-1',
        }),
        requestedLearnerId: 'learner-1',
        viewerRole: 'teacher',
        authorized: true,
      },
      classOverlay: {
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: true,
        learnerStates: [
          learnerState({
            userId: 'learner-1',
            targetId: 'kn:autocontrol:simulation-validation',
            score: 0.42,
            confidence: 0.7,
            evidenceCount: 2,
            classId: 'class-1',
          }),
          learnerState({
            userId: 'learner-2',
            targetId: 'kn:autocontrol:simulation-validation',
            score: 0.2,
            confidence: 0.6,
            evidenceCount: 1,
            classId: 'class-1',
          }),
        ],
      },
      sarAssociation: {
        enabled: true,
        studentId: 'learner-1',
      },
    });
    const serialized = JSON.stringify(payload.selectedNode?.associatedEvidence);

    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).toContain('chunk-sar-own-learner-with-class-overlay');
    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).not.toContain('chunk-sar-other-learner-with-class-overlay');
    expect(payload.selectedNode?.associatedEvidence?.resourceGapSuggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ref: 'chunk-sar-own-learner-with-class-overlay',
        status: 'suggested',
        draft: true,
      }),
    ]));
    expect(serialized).not.toContain('chunk-sar-other-learner-with-class-overlay');
    expect(serialized).not.toContain('other-learner-resource-with-class-overlay');
    expect(serialized).not.toContain('learner-2');
  });

  it('keeps empty teacher personal-view SAR scoped to the requested learner class without class overlay', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-empty-own-learner',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'empty-own-learner-resource',
          ownerUserId: 'learner-1',
          classId: 'class-1',
          privacyClass: 'student-visible',
        }),
        ragChunk({
          id: 'chunk-sar-empty-other-learner',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'empty-other-learner-resource',
          ownerUserId: 'learner-2',
          classId: 'class-1',
          privacyClass: 'student-visible',
        }),
      ],
      learnerOverlay: {
        state: null,
        requestedLearnerId: 'learner-1',
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: true,
      },
      sarAssociation: {
        enabled: true,
        studentId: 'learner-1',
      },
    });
    const serialized = JSON.stringify(payload.selectedNode?.associatedEvidence);

    expect(payload.learnerOverlay.status).toBe('empty');
    expect(payload.learnerOverlay.classId).toBe('class-1');
    expect(payload.classOverlay.status).toBe('unavailable');
    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).toContain('chunk-sar-empty-own-learner');
    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).not.toContain('chunk-sar-empty-other-learner');
    expect(serialized).not.toContain('chunk-sar-empty-other-learner');
    expect(serialized).not.toContain('empty-other-learner-resource');
    expect(serialized).not.toContain('learner-2');
  });

  it('redacts student SAR associated evidence refs while preserving safe summaries', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'STUDENT',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-student-gap',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'private-teacher-resource',
        }),
      ],
      sarAssociation: {
        enabled: true,
        studentId: 'learner-1',
        classId: 'class-1',
      },
    });
    const associated = payload.selectedNode?.associatedEvidence;
    const serialized = JSON.stringify(associated);

    expect(associated?.status).toBe('available');
    expect(associated?.candidateRefs.retrievalChunkIds).toEqual(['retrieval-chunk:1']);
    expect(associated?.candidateRefs.resourceNodeIds).toEqual(['resource-candidate:1']);
    expect(associated?.topEvents[0]?.safeSummary).toBeTruthy();
    expect(serialized).not.toContain('chunk-sar-student-gap');
    expect(serialized).not.toContain('private-teacher-resource');
    expect(serialized).not.toContain('external:sar-simulation-gap');
  });

  it('keeps class-scoped student-owned SAR evidence available with redacted refs', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'STUDENT',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-student-class-gap',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'student-class-resource',
          ownerUserId: 'learner-1',
          classId: 'class-1',
          privacyClass: 'student-visible',
        }),
      ],
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-1',
          targetId: 'kn:autocontrol:simulation-validation',
          score: 0.4,
          confidence: 0.7,
          evidenceCount: 2,
          classId: 'class-1',
        }),
        requestedLearnerId: 'learner-1',
        viewerRole: 'student',
        authorized: true,
      },
      sarAssociation: {
        enabled: true,
        studentId: 'learner-1',
      },
    });
    const associated = payload.selectedNode?.associatedEvidence;
    const serialized = JSON.stringify(associated);

    expect(payload.learnerOverlay.classId).toBe('class-1');
    expect(associated?.status).toBe('available');
    expect(associated?.candidateRefs.retrievalChunkIds).toEqual(['retrieval-chunk:1']);
    expect(associated?.resourceGapSuggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ref: 'retrieval-chunk:1',
        status: 'suggested',
        draft: true,
      }),
    ]));
    expect(serialized).not.toContain('chunk-sar-student-class-gap');
    expect(serialized).not.toContain('student-class-resource');
    expect(serialized).not.toContain('learner-1');
    expect(serialized).not.toContain('class-1');
  });

  it('filters student SAR resource gap suggestions by raw covered resource ids before redaction', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:simulation-validation',
      viewerRole: 'STUDENT',
      resourceRegistry: buildResourceNodeRegistry({
        registeredResources: [{
          id: 'student-covered-resource',
          label: 'Student covered resource',
          type: 'ADAPTIVE_QUIZ',
          renderTarget: '/resources/student-covered-resource',
          knowledgeNodeIds: ['跨模型验证比较_4_47006'],
          planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['answer_submit'],
          },
        }],
      }),
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-student-covered-resource',
          knowledgeNodeRefs: ['跨模型验证比较_4_47006'],
          resourceId: 'registry:student-covered-resource',
          ownerUserId: 'learner-1',
          classId: 'class-1',
          privacyClass: 'student-visible',
        }),
      ],
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-1',
          targetId: 'kn:autocontrol:simulation-validation',
          score: 0.4,
          confidence: 0.7,
          evidenceCount: 2,
          classId: 'class-1',
        }),
        requestedLearnerId: 'learner-1',
        viewerRole: 'student',
        authorized: true,
      },
      sarAssociation: {
        enabled: true,
        studentId: 'learner-1',
      },
    });
    const associated = payload.selectedNode?.associatedEvidence;
    const serialized = JSON.stringify(associated);

    expect(associated?.status).toBe('available');
    expect(associated?.candidateRefs.resourceNodeIds).toEqual(['resource-candidate:1']);
    expect(associated?.resourceGapSuggestions.some((suggestion) => suggestion.refType === 'resource-node')).toBe(false);
    expect(associated?.resourceGapSuggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ref: 'retrieval-chunk:1',
        refType: 'retrieval-chunk',
      }),
    ]));
    expect(serialized).not.toContain('registry:student-covered-resource');
    expect(serialized).not.toContain('chunk-sar-student-covered-resource');
    expect(serialized).not.toContain('learner-1');
    expect(serialized).not.toContain('class-1');
  });

  it('wires Graph Center SAR associated evidence into the page and detail panel', () => {
    expect(graphCenterPageSource).toContain('sarAssociation');
    expect(graphCenterPageSource).toContain('enabled: true');
    expect(graphCenterPageSource).toContain("session.user.role === 'STUDENT' ? session.user.id : params?.learnerId ?? null");
    expect(graphCenterPageSource).toContain("session.user.role === 'STUDENT' ? null : params?.classId ?? null");
    expect(graphCenterClientSource).toContain('payload.selectedNode.associatedEvidence');
    expect(graphCenterClientSource).toContain('data-graph-center-sar-association="true"');
    expect(graphCenterClientSource).toContain('data-graph-center-sar-candidate="suggested"');
    expect(graphCenterClientSource).toContain('建议/草稿');
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
    expect(chunk.resourceProjection?.versionRefs).toBeUndefined();
    expect(verification.status).toBe('downgraded');
    expect(verification.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ chunkId: chunk.id, reason: 'missing-version-ref' }),
    ]));
  });

  it('scopes graph-center DB teaching resources by viewer role', () => {
    expect(teachingResourceWhereForGraphCenter('STUDENT', 'student-1')).toBeNull();
    expect(teachingResourceWhereForGraphCenter(undefined, undefined)).toBeNull();
    expect(teachingResourceWhereForGraphCenter('TEACHER', null)).toBeNull();
    expect(teachingResourceWhereForGraphCenter('TEACHER', 'teacher-1')).toEqual({ authorId: 'teacher-1' });
    expect(teachingResourceWhereForGraphCenter('ADMIN', 'admin-1')).toEqual({});
  });

  it('maps server-owned learner state to privacy-safe graph overlay items', () => {
    const authorized = canReadGraphCenterLearnerOverlay({
      viewerRole: 'student',
      viewerUserId: 'learner-1',
      requestedLearnerId: 'learner-1',
    });
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
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-1',
          targetId: 'kn:autocontrol:controller-correction',
          score: 0.86,
          confidence: 0.72,
          evidenceCount: 3,
          evidenceRefs: [
            evidenceRef('LearningFact', 'fact-public', 'student-visible'),
          ],
        }),
        requestedLearnerId: 'learner-1',
        viewerRole: 'student',
        authorized,
        evidenceWindow: {
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-21T00:00:00.000Z',
          freshness: 'current',
        },
        verifiedCitationRefs: {
          'kn:autocontrol:controller-correction': ['chunk-controller-correction-verified'],
        },
      },
    });
    const item = payload.learnerOverlay.items['kn:autocontrol:controller-correction'];

    expect(payload.overlays.learner).toBe('available');
    expect(item.state).toBe('mastered');
    expect(item.score).toBe(0.86);
    expect(item.confidence).toBe(0.72);
    expect(item.evidenceRefs.map((ref) => ref.sourceId)).toEqual(['fact-public']);
    expect(item.evidenceCount).toBe(1);
    expect(item.lastEvidenceAt).toBe('2026-06-20T00:00:00.000Z');
    expect(item.verifiedCitationRefs).toEqual(['chunk-controller-correction-verified']);
    expect(item.reasonCode).toBe('advance');
    expect(item.recommendation.rationale.observedMastery).toContain('86%');
    expect(item.recommendation.rationale.resourceCoverage).toContain('已校验引用 1');
    expect(item.recommendation.evidenceWindow).toEqual({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-21T00:00:00.000Z',
      freshness: 'current',
    });
    expect(Object.hasOwn(payload.graph.nodes[0], 'learnerOverlay')).toBe(false);
  });

  it('derives role-scoped graph center actions with explicit disabled reasons', () => {
    const readOnlyPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });
    const studentPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'STUDENT',
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
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-1',
          targetId: 'kn:autocontrol:controller-correction',
          score: 0.52,
          confidence: 0.72,
          evidenceCount: 2,
        }),
        requestedLearnerId: 'learner-1',
        viewerRole: 'student',
        authorized: true,
      },
    });
    const teacherPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:feedback-loop',
      viewerRole: 'TEACHER',
      classOverlay: {
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: true,
        learnerStates: [
          learnerState({ userId: 'learner-1', targetId: 'kn:autocontrol:feedback-loop', score: 0.2, confidence: 0.7, evidenceCount: 1 }),
          learnerState({ userId: 'learner-2', targetId: 'kn:autocontrol:feedback-loop', score: 0.3, confidence: 0.7, evidenceCount: 1 }),
          learnerState({ userId: 'learner-3', targetId: 'kn:autocontrol:feedback-loop', score: 0.4, confidence: 0.7, evidenceCount: 1 }),
          learnerState({ userId: 'learner-4', targetId: 'kn:autocontrol:feedback-loop', score: 0.5, confidence: 0.7, evidenceCount: 1 }),
          learnerState({ userId: 'learner-5', targetId: 'kn:autocontrol:feedback-loop', score: 0.6, confidence: 0.7, evidenceCount: 1 }),
        ],
      },
    });
    const adminPayload = buildGraphCenterPayload({
      domain: 'quality',
      selectedNodeId: 'qual:autocontrol:evidence-integrity',
      viewerRole: 'ADMIN',
    });

    expect(readOnlyPayload.selectedNode?.actions).toEqual([]);
    expect(studentPayload.selectedNode?.actions.map((action) => action.id)).toEqual([
      'student:start-path',
      'student:inspect-resource',
      'student:review-evidence',
      'student:ask-konling',
    ]);
    expect(studentPayload.selectedNode?.actions.find((action) => action.id === 'student:start-path')).toMatchObject({
      status: 'available',
      role: 'student',
      target: {
        route: '/assessment/adaptive-practice',
        params: {
          goal: 'control-correction',
          graphNodeId: 'kn:autocontrol:controller-correction',
          intent: 'contextual-recommendation',
        },
      },
    });
    const frequencyPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      viewerRole: 'STUDENT',
    });
    expect(frequencyPayload.selectedNode?.actions.find((action) => action.id === 'student:start-path')).toMatchObject({
      status: 'available',
      target: {
        route: '/assessment/adaptive-practice',
        params: {
          goal: 'frequency-response-foundations',
          graphNodeId: 'kn:autocontrol:frequency-response',
          intent: 'contextual-recommendation',
        },
        href: '/assessment/adaptive-practice?goal=frequency-response-foundations&graphNodeId=kn%3Aautocontrol%3Afrequency-response&intent=contextual-recommendation',
      },
    });
    const unmappedPathPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:feedback-loop',
      viewerRole: 'STUDENT',
    });
    const unmappedPathAction = unmappedPathPayload.selectedNode?.actions.find((action) => action.id === 'student:start-path');
    expect(unmappedPathAction).toMatchObject({
      status: 'degraded',
      reasonCode: 'missing-path-context',
      reason: '该节点尚未接入可进入的自适应学习路径入口。',
    });
    expect(unmappedPathAction?.target).toBeUndefined();
    expect(studentPayload.selectedNode?.actions.find((action) => action.id === 'student:ask-konling')).toMatchObject({
      status: 'available',
      target: {
        route: '/assessment/adaptive-practice',
        params: {
          goal: 'control-correction',
          graphNodeId: 'kn:autocontrol:controller-correction',
          intent: 'contextual-recommendation',
        },
        href: '/assessment/adaptive-practice?goal=control-correction&graphNodeId=kn%3Aautocontrol%3Acontroller-correction&intent=contextual-recommendation',
      },
    });
    const unmappedKonlingAction = unmappedPathPayload.selectedNode?.actions.find((action) => action.id === 'student:ask-konling');
    expect(unmappedKonlingAction).toMatchObject({
      status: 'degraded',
      reasonCode: 'missing-path-context',
      reason: '该节点尚未接入可进入的 Konling 图谱提问上下文。',
    });
    expect(unmappedKonlingAction?.target).toBeUndefined();
    expect(studentPayload.selectedNode?.actions.find((action) => action.id === 'student:review-evidence')).toMatchObject({
      status: 'degraded',
      reasonCode: 'missing-evidence-route',
    });
    expect(studentPayload.selectedNode?.resourceCoverage.pathEligibleResourceIds).toContain('arena-task:full-coverage-arena-official');
    expect(studentPayload.selectedNode?.resourceCoverage.pathEligibleResourceRouteIds[0]).toBe('full-coverage-assessment');
    expect(studentPayload.selectedNode?.resourceCoverage.filterKnowledgeRefs).toContain('PID控制器_6_656b8b52');
    expect(studentPayload.selectedNode?.actions.find((action) => action.id === 'student:inspect-resource')).toMatchObject({
      status: 'available',
      target: {
        route: '/interactive-learning/resources/[id]',
        params: {
          resourceId: 'full-coverage-assessment',
          graphNodeId: 'kn:autocontrol:controller-correction',
        },
        href: '/interactive-learning/resources/full-coverage-assessment?graphNodeId=kn%3Aautocontrol%3Acontroller-correction',
      },
    });
    const arenaOnlyPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'STUDENT',
      resourceRegistry: buildResourceNodeRegistry({
        arenaTasks: [{
          id: 'arena-only',
          title: 'Arena only resource',
          launchTarget: '/arena/arena-only',
          knowledgeNodeIds: ['PID控制器_6_656b8b52'],
          official: true,
          planningOverride: {
            estimatedTimeMinutes: 12,
            terminalConstraints: ['terminal-validation'],
            evidenceInstrumentation: ['arena_evaluation_complete'],
          },
        }],
      }),
    });
    expect(arenaOnlyPayload.selectedNode?.resourceCoverage.pathEligibleResourceIds).toEqual(['arena-task:arena-only']);
    expect(arenaOnlyPayload.selectedNode?.resourceCoverage.pathEligibleResourceRouteIds).toEqual([]);
    const arenaOnlyResourceAction = arenaOnlyPayload.selectedNode?.actions.find((action) => action.id === 'student:inspect-resource');
    expect(arenaOnlyResourceAction).toMatchObject({
      status: 'degraded',
      reasonCode: 'missing-resource-context',
    });
    expect(arenaOnlyResourceAction?.target).toBeUndefined();

    expect(teacherPayload.selectedNode?.actions.map((action) => action.id)).toEqual([
      'teacher:diagnose-weak-node',
      'teacher:inspect-affected-population',
      'teacher:inspect-resource-gap',
      'teacher:open-prep-pack',
    ]);
    expect(teacherPayload.selectedNode?.actions.find((action) => action.id === 'teacher:diagnose-weak-node')).toMatchObject({
      status: 'available',
      target: {
        route: '/teacher/classes/[classId]/analytics-v2',
        params: {
          classId: 'class-1',
          graphNodeId: 'kn:autocontrol:feedback-loop',
        },
      },
    });
    expect(teacherPayload.selectedNode?.actions.find((action) => action.id === 'teacher:inspect-affected-population')).toMatchObject({
      status: 'degraded',
      reasonCode: 'missing-route-context',
      reason: '班级诊断入口当前只保留图谱节点提示，尚未按该节点过滤受影响学生。',
      target: {
        route: '/teacher/classes/[classId]/analytics-v2',
        params: {
          classId: 'class-1',
          graphNodeId: 'kn:autocontrol:feedback-loop',
          view: 'population',
        },
        href: '/teacher/classes/class-1/analytics-v2?graphNodeId=kn%3Aautocontrol%3Afeedback-loop&view=population',
      },
    });
    expect(teacherPayload.selectedNode?.actions.find((action) => action.id === 'teacher:inspect-resource-gap')).toMatchObject({
      status: 'degraded',
      reasonCode: 'missing-resource-context',
      target: {
        route: '/teacher/resources/resource-nodes',
        params: {
          knowledge: '反馈_1_1',
          pathEligibility: 'excluded',
        },
      },
    });
    expect(teacherPayload.selectedNode?.actions.find((action) => action.id === 'teacher:open-prep-pack')).toMatchObject({
      status: 'available',
      target: {
        route: '/teacher/prep-packs',
        params: {
          classId: 'class-1',
          graphNodeId: 'kn:autocontrol:feedback-loop',
          learningGoalId: 'knowledge:autocontrol:feedback-loop',
          resourceGapStatus: 'partial',
        },
        href: '/teacher/prep-packs?classId=class-1&graphNodeId=kn%3Aautocontrol%3Afeedback-loop&learningGoalId=knowledge%3Aautocontrol%3Afeedback-loop&resourceGapStatus=partial',
      },
    });
    expect(teacherPayload.selectedNode?.actions.find((action) => action.id === 'teacher:open-prep-pack')?.target?.params).toHaveProperty('graphNodeId');
    expect(teacherPayload.selectedNode?.actions.find((action) => action.id === 'teacher:open-prep-pack')?.target?.params).toHaveProperty('learningGoalId');

    expect(adminPayload.selectedNode?.actions.map((action) => action.id)).toEqual([
      'admin:inspect-resource-binding',
      'admin:inspect-citation-readiness',
      'admin:inspect-overlay-limitations',
    ]);
    expect(adminPayload.selectedNode?.actions.every((action) => action.role === 'admin')).toBe(true);
    expect(adminPayload.selectedNode?.actions.find((action) => action.id === 'admin:inspect-resource-binding')).toMatchObject({
      status: 'available',
      target: {
        route: '/admin/data-governance',
        params: {
          graphNodeId: 'qual:autocontrol:evidence-integrity',
          audit: 'resource-binding',
        },
      },
    });
    expect(adminPayload.selectedNode?.actions.find((action) => action.id === 'admin:inspect-overlay-limitations')).toMatchObject({
      status: 'degraded',
      reasonCode: 'missing-overlay-context',
      target: {
        route: '/admin/data-governance',
        params: {
          graphNodeId: 'qual:autocontrol:evidence-integrity',
          audit: 'overlay-limitations',
        },
      },
    });

    const routeLedgerHrefs = new Set(PLATFORM_PRIMARY_ROUTE_INVENTORY.map((route) => route.href));
    const actionRoutes = [
      ...(studentPayload.selectedNode?.actions ?? []),
      ...(teacherPayload.selectedNode?.actions ?? []),
      ...(adminPayload.selectedNode?.actions ?? []),
    ].flatMap((action) => action.target ? [action.target.route] : []);
    expect(actionRoutes.every((route) => routeLedgerHrefs.has(route))).toBe(true);
  });

  it('keeps Graph Center action targets wired to pages that consume their query context', () => {
    expect(teacherAnalyticsV2Source).toContain("searchParams.get('graphNodeId')");
    expect(teacherAnalyticsV2Source).toContain("searchParams.get('view')");
    expect(teacherAnalyticsV2Source).toContain('data-graph-center-class-action-context');
    expect(teacherAnalyticsV2Source).toContain("setHeatmapView('risk')");
    expect(teacherAnalyticsV2Source).toContain('data-graph-center-population-view');
    expect(adminDataGovernancePageSource).toContain('graphNodeId?: string');
    expect(adminDataGovernancePageSource).toContain('audit?: string');
    expect(adminDataGovernanceDashboardSource).toContain('initialActionQuery?.graphNodeId');
    expect(adminDataGovernanceDashboardSource).toContain('data-graph-center-governance-audit-context');
    expect(adminDataGovernanceDashboardSource).toContain("params.set('graphNodeId', initialActionQuery.graphNodeId.trim())");
    expect(adminDataGovernanceDashboardSource).toContain("params.set('audit', initialActionQuery.audit.trim())");
    expect(adminDataGovernanceDashboardSource).toContain('graphCenterAuditInitialTab');
    expect(adminDataGovernanceStatusRouteSource).toContain("request.nextUrl.searchParams.get('graphNodeId')");
    expect(adminDataGovernanceStatusRouteSource).toContain('graphCenterAudit');
    expect(adaptivePracticePageSource).toContain("const activeGraphNodeId = searchParams.get('graphNodeId')");
    expect(adaptivePracticePageSource).toContain("if (activeGraphNodeId) contextQuery.set('graphNodeId', activeGraphNodeId)");
    expect(adaptivePracticePageSource).toContain('...(payload.graphNodeId ? { graphNodeId: payload.graphNodeId } : {})');
    expect(adaptivePracticePageSource).toContain('graphNodeId,');
    expect(adaptivePathAdvisorContextRouteSource).toContain("url.searchParams.get('graphNodeId')");
    expect(adaptivePathAdvisorContextRouteSource).toContain('isGraphNodeInLearningGoalSubgraph(goalId, graphNodeId)');
    expect(adaptivePathAdvisorContextRouteSource).toContain("'graph-node-context'");
    expect(adaptivePathAdvisorToolRouteSource).toContain('const graphNodeId = typeof body.graphNodeId');
    expect(adaptivePathAdvisorToolRouteSource).toContain('toolInput.graphNodeId');
    expect(teacherPrepPacksPageSource).toContain('graphNodeId?: string');
    expect(teacherPrepPacksPageSource).toContain('learningGoalId?: string');
    expect(teacherPrepPacksPageSource).toContain('resourceGapStatus?: string');
    expect(teacherPrepPacksPageSource).toContain("source: { path: ['sourceEvidenceRefs'], array_contains: [`graph-node:${params.graphNodeId}`] }");
  });

  it('uses resource-node knowledge coverage refs for teacher resource gap links', () => {
    const resourceRegistry = fullCoverageRegistry();
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'TEACHER',
      resourceRegistry,
    });
    const action = payload.selectedNode?.actions.find((item) => item.id === 'teacher:inspect-resource-gap');
    const knowledge = action?.target?.params.knowledge;

    expect(knowledge).toBe('PID控制器_6_656b8b52');
    expect(knowledge).not.toBe('kn:autocontrol:controller-correction');
    expect(filterTeacherResourceNodes(resourceRegistry.nodes, {
      knowledge,
    }).map((node) => node.id)).toEqual(expect.arrayContaining([
      'registry:full-coverage-assessment',
    ]));
  });

  it('uses authorization reason codes for unauthorized graph center actions', () => {
    const unauthorizedLearnerPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'STUDENT',
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-2',
          targetId: 'kn:autocontrol:controller-correction',
          score: 0.2,
          confidence: 0.9,
          evidenceCount: 8,
        }),
        requestedLearnerId: 'learner-1',
        viewerRole: 'student',
        authorized: false,
      },
    });
    const unauthorizedClassPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:feedback-loop',
      viewerRole: 'TEACHER',
      classOverlay: {
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: false,
        learnerStates: [
          learnerState({ userId: 'learner-1', targetId: 'kn:autocontrol:feedback-loop', score: 0.2, confidence: 0.7, evidenceCount: 1 }),
        ],
      },
    });

    expect(unauthorizedLearnerPayload.learnerOverlay.status).toBe('unauthorized');
    expect(unauthorizedLearnerPayload.selectedNode?.actions.find((action) => action.id === 'student:review-evidence')).toMatchObject({
      status: 'disabled',
      reasonCode: 'missing-authorization',
      reason: '当前用户无权读取该学习者图谱 overlay。',
    });
    expect(unauthorizedClassPayload.classOverlay.status).toBe('unauthorized');
    expect(unauthorizedClassPayload.selectedNode?.actions.find((action) => action.id === 'teacher:diagnose-weak-node')).toMatchObject({
      status: 'disabled',
      reasonCode: 'missing-authorization',
      reason: '当前用户无权读取该班级图谱 overlay。',
    });
    expect(unauthorizedClassPayload.selectedNode?.actions.find((action) => action.id === 'teacher:inspect-affected-population')).toMatchObject({
      status: 'disabled',
      reasonCode: 'missing-authorization',
      reason: '当前用户无权读取该班级图谱 overlay。',
    });
    expect(unauthorizedClassPayload.selectedNode?.actions.find((action) => action.id === 'teacher:open-prep-pack')).toMatchObject({
      status: 'disabled',
      reasonCode: 'missing-authorization',
      reason: '当前用户无权读取该班级图谱 overlay。',
      target: undefined,
    });
  });

  it('does not route arena-only path resources through the interactive resource detail page', () => {
    const arenaOnlyRegistry = buildResourceNodeRegistry({
      arenaTasks: [
        {
          id: 'only-arena-official',
          title: 'Only Arena official',
          launchTarget: '/arena/only-arena-official',
          knowledgeNodeIds: ['PID控制器_6_656b8b52'],
          official: true,
          planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['arena_simulation_run'],
          },
        },
      ],
    });
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'STUDENT',
      resourceRegistry: arenaOnlyRegistry,
    });
    const inspectAction = payload.selectedNode?.actions.find((action) => action.id === 'student:inspect-resource');

    expect(payload.selectedNode?.resourceCoverage.pathEligibleResourceIds).toEqual(['arena-task:only-arena-official']);
    expect(payload.selectedNode?.resourceCoverage.pathEligibleResourceRouteIds).toEqual([]);
    expect(inspectAction).toMatchObject({
      status: 'degraded',
      reasonCode: 'missing-resource-context',
    });
    expect(inspectAction?.target).toBeUndefined();
  });

  it('rejects unauthorized learner overlays without leaking inferred state', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-2',
          targetId: 'kn:autocontrol:controller-correction',
          score: 0.2,
          confidence: 0.9,
          evidenceCount: 8,
        }),
        requestedLearnerId: 'learner-2',
        viewerRole: 'student',
        authorized: canReadGraphCenterLearnerOverlay({
          viewerRole: 'student',
          viewerUserId: 'learner-1',
          requestedLearnerId: 'learner-2',
        }),
      },
    });

    expect(payload.overlays.learner).toBe('unauthorized');
    expect(payload.learnerOverlay.items).toEqual({});
    expect(payload.limitations.map((limitation) => limitation.code)).toContain('learner-overlay-unauthorized');
  });

  it('does not derive student-visible mastery from hidden evidence refs', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      resourceRegistry: fullCoverageRegistry(),
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-hidden',
          targetId: 'kn:autocontrol:controller-correction',
          score: 0.92,
          confidence: 0.95,
          evidenceCount: 1,
          evidenceRefs: [
            evidenceRef('AgentToolRun', 'audit-hidden', 'audit-only'),
          ],
        }),
        requestedLearnerId: 'learner-hidden',
        viewerRole: 'student',
        authorized: true,
      },
    });
    const item = payload.learnerOverlay.items['kn:autocontrol:controller-correction'];

    expect(item.evidenceRefs).toEqual([]);
    expect(item.evidenceCount).toBe(0);
    expect(item.lastEvidenceAt).toBeNull();
    expect(item.score).toBeNull();
    expect(item.confidence).toBe(0);
    expect(item.sourceCoverage).toBeNull();
    expect(item.state).toBe('not-started');
    expect(item.limitations).toContain('hidden-evidence-redacted');
  });

  it('hides teacher-scoped evidence from student overlay counts', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      resourceRegistry: fullCoverageRegistry(),
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-teacher-scoped',
          targetId: 'kn:autocontrol:controller-correction',
          score: 0.82,
          confidence: 0.8,
          evidenceCount: 1,
          evidenceRefs: [
            evidenceRef('LearningFact', 'teacher-hidden', 'teacher-scoped'),
          ],
        }),
        requestedLearnerId: 'learner-teacher-scoped',
        viewerRole: 'student',
        authorized: true,
      },
    });
    const item = payload.learnerOverlay.items['kn:autocontrol:controller-correction'];

    expect(item.evidenceRefs).toEqual([]);
    expect(item.evidenceCount).toBe(0);
    expect(item.score).toBeNull();
    expect(item.sourceCoverage).toBeNull();
  });

  it('matches capability overlays through control-correction goal-slice target ids', () => {
    const payload = buildGraphCenterPayload({
      domain: 'capability',
      selectedNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-capability',
          targetId: 'control-correction:simulation-validation:evaluate',
          targetKind: 'capability',
          score: 0.88,
          confidence: 0.76,
          evidenceCount: 2,
        }),
        requestedLearnerId: 'learner-capability',
        viewerRole: 'student',
        authorized: true,
      },
      classOverlay: {
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: true,
        learnerStates: [
          learnerState({
            userId: 'learner-capability-1',
            targetId: 'control-correction:simulation-validation:evaluate',
            targetKind: 'capability',
            score: 0.88,
            confidence: 0.76,
            evidenceCount: 2,
            classId: 'class-1',
          }),
          learnerState({
            userId: 'learner-capability-2',
            targetId: 'control-correction:simulation-validation:evaluate',
            targetKind: 'capability',
            score: 0.8,
            confidence: 0.72,
            evidenceCount: 2,
            classId: 'class-1',
          }),
          learnerState({
            userId: 'learner-capability-3',
            targetId: 'control-correction:simulation-validation:evaluate',
            targetKind: 'capability',
            score: 0.7,
            confidence: 0.7,
            evidenceCount: 2,
            classId: 'class-1',
          }),
          learnerState({
            userId: 'learner-capability-4',
            targetId: 'control-correction:simulation-validation:evaluate',
            targetKind: 'capability',
            score: 0.6,
            confidence: 0.68,
            evidenceCount: 2,
            classId: 'class-1',
          }),
          learnerState({
            userId: 'learner-capability-5',
            targetId: 'control-correction:simulation-validation:evaluate',
            targetKind: 'capability',
            score: 0.56,
            confidence: 0.66,
            evidenceCount: 2,
            classId: 'class-1',
          }),
        ],
      },
    });
    const learnerItem = payload.learnerOverlay.items['cap:autocontrol:validate-with-simulation-evidence'];
    const classItem = payload.classOverlay.items['cap:autocontrol:validate-with-simulation-evidence'];

    expect(learnerItem.score).toBe(0.88);
    expect(learnerItem.state).toBe('mastered');
    expect(learnerItem.evidenceCount).toBe(1);
    expect(classItem.suppressionReason).toBe('none');
    expect(classItem.distribution.mastered).toBe(2);
    expect(classItem.distribution.developing).toBe(3);
  });

  it('does not apply simulation-validation capability evidence to engineering-constraint nodes', () => {
    const payload = buildGraphCenterPayload({
      domain: 'capability',
      selectedNodeId: 'cap:autocontrol:trade-off-engineering-constraints',
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-capability-negative',
          targetId: 'control-correction:simulation-validation:evaluate',
          targetKind: 'capability',
          score: 0.88,
          confidence: 0.76,
          evidenceCount: 2,
        }),
        requestedLearnerId: 'learner-capability-negative',
        viewerRole: 'student',
        authorized: true,
      },
    });
    const item = payload.learnerOverlay.items['cap:autocontrol:trade-off-engineering-constraints'];

    expect(item.score).toBeNull();
    expect(item.confidence).toBe(0);
    expect(item.evidenceCount).toBe(0);
    expect(item.state).toBe('not-started');
    expect(item.reasonCode).toBe('collect-evidence');
  });

  it('maps time-domain and root-locus goal-slice targets to their graph capability nodes', () => {
    const analysisPayload = buildGraphCenterPayload({
      domain: 'capability',
      selectedNodeId: 'cap:autocontrol:interpret-time-frequency-response',
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-analysis',
          targetId: 'control-correction:time-domain-targets:apply',
          targetKind: 'capability',
          score: 0.7,
          confidence: 0.7,
          evidenceCount: 2,
        }),
        requestedLearnerId: 'learner-analysis',
        viewerRole: 'student',
        authorized: true,
      },
    });
    const synthesisPayload = buildGraphCenterPayload({
      domain: 'capability',
      selectedNodeId: 'cap:autocontrol:synthesize-controller-correction',
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-synthesis',
          targetId: 'control-correction:root-locus-design:analyze',
          targetKind: 'capability',
          score: 0.68,
          confidence: 0.7,
          evidenceCount: 2,
        }),
        requestedLearnerId: 'learner-synthesis',
        viewerRole: 'student',
        authorized: true,
      },
    });

    expect(analysisPayload.learnerOverlay.items['cap:autocontrol:interpret-time-frequency-response'].score).toBe(0.7);
    expect(analysisPayload.learnerOverlay.items['cap:autocontrol:interpret-time-frequency-response'].state).toBe('developing');
    expect(synthesisPayload.learnerOverlay.items['cap:autocontrol:synthesize-controller-correction'].score).toBe(0.68);
    expect(synthesisPayload.learnerOverlay.items['cap:autocontrol:synthesize-controller-correction'].state).toBe('developing');
  });

  it('marks learner overlays empty or low-confidence without fabricating mastery', () => {
    const emptyPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      learnerOverlay: {
        state: null,
        requestedLearnerId: 'learner-empty',
        viewerRole: 'student',
        authorized: true,
      },
    });
    const lowConfidencePayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      learnerOverlay: {
        state: learnerState({
          userId: 'learner-low',
          targetId: 'kn:autocontrol:controller-correction',
          score: 0.7,
          confidence: 0.2,
          evidenceCount: 2,
        }),
        requestedLearnerId: 'learner-low',
        viewerRole: 'student',
        authorized: true,
      },
    });

    expect(emptyPayload.overlays.learner).toBe('empty');
    expect(emptyPayload.learnerOverlay.items).toEqual({});
    expect(lowConfidencePayload.overlays.learner).toBe('low-confidence');
    expect(lowConfidencePayload.learnerOverlay.items['kn:autocontrol:controller-correction'].state).toBe('evidence-needed');
    expect(lowConfidencePayload.limitations.map((limitation) => limitation.code)).toContain(
      'learner-overlay-low-confidence',
    );
  });

  it('aggregates authorized class graph overlays with denominator and issue metadata', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      resourceRegistry: fullCoverageRegistry(),
      classOverlay: {
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: canReadGraphCenterClassOverlay({
          viewerRole: 'teacher',
          requestedClassId: 'class-1',
          teacherClassIds: ['class-1'],
        }),
        minimumDenominator: 3,
        roundingIncrement: 1,
        learnerStates: [
          learnerState({ userId: 'learner-1', targetId: 'kn:autocontrol:controller-correction', score: 0.9, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-2', targetId: 'kn:autocontrol:controller-correction', score: 0.64, confidence: 0.7, evidenceCount: 3, classId: 'class-1' }),
          learnerState({ userId: 'learner-3', targetId: 'kn:autocontrol:controller-correction', score: 0.32, confidence: 0.74, evidenceCount: 3, classId: 'class-1' }),
          learnerState({ userId: 'learner-4', targetId: 'kn:autocontrol:controller-correction', score: null, confidence: 0, evidenceCount: 0, classId: 'class-1' }),
          learnerState({ userId: 'learner-5', targetId: 'kn:autocontrol:controller-correction', score: 0.58, confidence: 0.62, evidenceCount: 2, classId: 'class-1' }),
          learnerState({ userId: 'learner-6', targetId: 'kn:autocontrol:controller-correction', score: 0.74, confidence: 0.68, evidenceCount: 2, classId: 'class-1' }),
          learnerState({ userId: 'learner-x', targetId: 'kn:autocontrol:controller-correction', score: 0.1, confidence: 0.9, evidenceCount: 5, classId: 'class-2' }),
        ],
      },
    });
    const item = payload.classOverlay.items['kn:autocontrol:controller-correction'];

    expect(payload.overlays.class).toBe('available');
    expect(item.denominator).toBe(6);
    expect(item.includedPopulation).toBe(6);
    expect(item.excludedPopulation).toBe(1);
    expect(item.suppressionReason).toBe('none');
    expect(item.distribution).toEqual({
      mastered: 1,
      developing: 3,
      weak: 1,
      'not-started': 1,
      'evidence-needed': 0,
    });
    expect(item.averageScore).toBe(0.6);
    expect(item.commonIssueCodes).toContain('targeted-practice');
  });

  it('keeps rounded class distribution totals within the visible denominator', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      resourceRegistry: fullCoverageRegistry(),
      classOverlay: {
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: true,
        minimumDenominator: 5,
        roundingIncrement: 5,
        learnerStates: [
          learnerState({ userId: 'learner-1', targetId: 'kn:autocontrol:controller-correction', score: 0.9, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-2', targetId: 'kn:autocontrol:controller-correction', score: 0.85, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-3', targetId: 'kn:autocontrol:controller-correction', score: 0.8, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-4', targetId: 'kn:autocontrol:controller-correction', score: 0.7, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-5', targetId: 'kn:autocontrol:controller-correction', score: 0.68, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-6', targetId: 'kn:autocontrol:controller-correction', score: 0.65, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-7', targetId: 'kn:autocontrol:controller-correction', score: 0.3, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-8', targetId: 'kn:autocontrol:controller-correction', score: 0.25, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-9', targetId: 'kn:autocontrol:controller-correction', score: 0.2, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-10', targetId: 'kn:autocontrol:controller-correction', score: 0.1, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
        ],
      },
    });
    const item = payload.classOverlay.items['kn:autocontrol:controller-correction'];
    const roundedTotal = Object.values(item.distribution).reduce((sum, value) => sum + value, 0);

    expect(item.denominator).toBe(10);
    expect(roundedTotal).toBeLessThanOrEqual(item.denominator);
    expect(roundedTotal).toBe(10);
    expect(item.distribution).toEqual({
      mastered: 5,
      developing: 0,
      weak: 5,
      'not-started': 0,
      'evidence-needed': 0,
    });
  });

  it('suppresses class overlay distributions when scoped denominator is too low', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      classOverlay: {
        classId: 'class-small',
        viewerRole: 'teacher',
        authorized: true,
        minimumDenominator: 3,
        learnerStates: [
          learnerState({ userId: 'learner-1', targetId: 'kn:autocontrol:controller-correction', score: 0.9, confidence: 0.8, evidenceCount: 4, classId: 'class-small' }),
          learnerState({ userId: 'learner-2', targetId: 'kn:autocontrol:controller-correction', score: 0.2, confidence: 0.8, evidenceCount: 4, classId: 'other-class' }),
        ],
      },
    });
    const item = payload.classOverlay.items['kn:autocontrol:controller-correction'];

    expect(payload.overlays.class).toBe('suppressed');
    expect(item.suppressionReason).toBe('low-denominator');
    expect(item.denominator).toBe(1);
    expect(item.includedPopulation).toBe(0);
    expect(item.excludedPopulation).toBe(2);
    expect(item.distribution).toEqual({
      mastered: 0,
      developing: 0,
      weak: 0,
      'not-started': 0,
      'evidence-needed': 0,
    });
    expect(payload.limitations.map((limitation) => limitation.code)).toContain('class-overlay-suppressed');
  });

  it('does not grant SAR class scope from a suppressed class overlay', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-suppressed-class',
          knowledgeNodeRefs: ['PID控制器_6_656b8b52'],
          resourceId: 'suppressed-class-resource',
          classId: 'class-small',
          privacyClass: 'student-visible',
        }),
      ],
      classOverlay: {
        classId: 'class-small',
        viewerRole: 'teacher',
        authorized: true,
        minimumDenominator: 3,
        learnerStates: [
          learnerState({ userId: 'learner-1', targetId: 'kn:autocontrol:controller-correction', score: 0.9, confidence: 0.8, evidenceCount: 4, classId: 'class-small' }),
        ],
      },
      sarAssociation: {
        enabled: true,
        classId: 'class-small',
      },
    });
    const serialized = JSON.stringify(payload.selectedNode?.associatedEvidence);

    expect(payload.overlays.class).toBe('suppressed');
    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).not.toContain('chunk-sar-suppressed-class');
    expect(payload.selectedNode?.associatedEvidence?.resourceGapSuggestions).toEqual([]);
    expect(serialized).not.toContain('chunk-sar-suppressed-class');
    expect(serialized).not.toContain('suppressed-class-resource');
  });

  it('does not grant SAR class scope when the selected class overlay item is suppressed', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-node-suppressed-class',
          knowledgeNodeRefs: ['PID控制器_6_656b8b52'],
          resourceId: 'node-suppressed-class-resource',
          classId: 'class-mixed',
          privacyClass: 'student-visible',
        }),
      ],
      classOverlay: {
        classId: 'class-mixed',
        viewerRole: 'teacher',
        authorized: true,
        learnerStates: [
          learnerState({ userId: 'learner-1', targetId: 'kn:autocontrol:controller-correction', score: 0.9, confidence: 0.8, evidenceCount: 4, classId: 'class-mixed' }),
          learnerState({ userId: 'learner-2', targetId: 'kn:autocontrol:feedback-loop', score: 0.7, confidence: 0.7, evidenceCount: 3, classId: 'class-mixed' }),
          learnerState({ userId: 'learner-3', targetId: 'kn:autocontrol:feedback-loop', score: 0.6, confidence: 0.7, evidenceCount: 3, classId: 'class-mixed' }),
          learnerState({ userId: 'learner-4', targetId: 'kn:autocontrol:feedback-loop', score: 0.5, confidence: 0.7, evidenceCount: 3, classId: 'class-mixed' }),
          learnerState({ userId: 'learner-5', targetId: 'kn:autocontrol:feedback-loop', score: 0.4, confidence: 0.7, evidenceCount: 3, classId: 'class-mixed' }),
          learnerState({ userId: 'learner-6', targetId: 'kn:autocontrol:feedback-loop', score: 0.3, confidence: 0.7, evidenceCount: 3, classId: 'class-mixed' }),
        ],
      },
      sarAssociation: {
        enabled: true,
        classId: 'class-mixed',
      },
    });
    const selectedItem = payload.classOverlay.items['kn:autocontrol:controller-correction'];
    const serialized = JSON.stringify(payload.selectedNode?.associatedEvidence);

    expect(payload.overlays.class).toBe('available');
    expect(selectedItem.suppressionReason).toBe('low-denominator');
    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).not.toContain('chunk-sar-node-suppressed-class');
    expect(payload.selectedNode?.associatedEvidence?.resourceGapSuggestions).toEqual([]);
    expect(serialized).not.toContain('chunk-sar-node-suppressed-class');
    expect(serialized).not.toContain('node-suppressed-class-resource');
  });

  it('does not grant SAR class scope from an empty class overlay', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'TEACHER',
      evidenceCorpus: [
        ragChunk({
          id: 'chunk-sar-empty-class',
          knowledgeNodeRefs: ['PID控制器_6_656b8b52'],
          resourceId: 'empty-class-resource',
          classId: 'class-empty',
          privacyClass: 'student-visible',
        }),
      ],
      classOverlay: {
        classId: 'class-empty',
        viewerRole: 'teacher',
        authorized: true,
        learnerStates: [],
      },
      sarAssociation: {
        enabled: true,
        classId: 'class-empty',
      },
    });
    const serialized = JSON.stringify(payload.selectedNode?.associatedEvidence);

    expect(payload.overlays.class).toBe('empty');
    expect(payload.selectedNode?.associatedEvidence?.candidateRefs.retrievalChunkIds).not.toContain('chunk-sar-empty-class');
    expect(payload.selectedNode?.associatedEvidence?.resourceGapSuggestions).toEqual([]);
    expect(serialized).not.toContain('chunk-sar-empty-class');
    expect(serialized).not.toContain('empty-class-resource');
  });

  it('suppresses class distributions when node-visible evidence count is below the minimum denominator', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      resourceRegistry: fullCoverageRegistry(),
      classOverlay: {
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: true,
        learnerStates: [
          learnerState({ userId: 'learner-1', targetId: 'kn:autocontrol:controller-correction', score: 0.9, confidence: 0.8, evidenceCount: 4, classId: 'class-1' }),
          learnerState({ userId: 'learner-2', targetId: 'kn:autocontrol:controller-correction', score: null, confidence: 0, evidenceCount: 0, classId: 'class-1' }),
          learnerState({ userId: 'learner-3', targetId: 'kn:autocontrol:controller-correction', score: null, confidence: 0, evidenceCount: 0, classId: 'class-1' }),
          learnerState({ userId: 'learner-4', targetId: 'kn:autocontrol:controller-correction', score: null, confidence: 0, evidenceCount: 0, classId: 'class-1' }),
          learnerState({ userId: 'learner-5', targetId: 'kn:autocontrol:controller-correction', score: null, confidence: 0, evidenceCount: 0, classId: 'class-1' }),
        ],
      },
    });
    const item = payload.classOverlay.items['kn:autocontrol:controller-correction'];

    expect(payload.overlays.class).toBe('suppressed');
    expect(item.denominator).toBe(5);
    expect(item.includedPopulation).toBe(1);
    expect(item.excludedPopulation).toBe(4);
    expect(item.suppressionReason).toBe('low-denominator');
    expect(item.distribution).toEqual({
      mastered: 0,
      developing: 0,
      weak: 0,
      'not-started': 0,
      'evidence-needed': 0,
    });
    expect(item.averageScore).toBeNull();
    expect(item.commonIssueCodes).toEqual([]);
  });
});

function ragChunk(input: {
  id: string;
  knowledgeNodeRefs: string[];
  citationAddress?: LearningEvidenceCorpusChunk['citationAddress'];
  contentHash?: string;
  resourceId?: string;
  ownerUserId?: string | null;
  classId?: string | null;
  privacyClass?: LearningEvidenceCorpusChunk['privacyClass'];
}): LearningEvidenceCorpusChunk {
  const contentHash = input.contentHash ?? `${input.id}:hash`;
  const resourceId = input.resourceId ?? input.id;
  const privacyClass = input.privacyClass ?? 'public';
  return createLearningEvidenceCorpusChunk({
    id: input.id,
    family: 'course-content',
    sourceType: 'course-content',
    sourceRef: {
      id: input.id,
      ownerUserId: input.ownerUserId ?? null,
      classId: input.classId ?? null,
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
      versionRefs: buildKaqArtifactVersionRefs(),
    },
    privacyClass,
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
        visibility: privacyClass,
        allowedRoles: ['student', 'teacher', 'admin', 'service'],
        ownerRequired: Boolean(input.ownerUserId),
        classRequired: Boolean(input.classId),
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

function evidenceRef(
  sourceType: MasteryEvidenceReference['sourceType'],
  sourceId: string,
  privacyLevel: MasteryEvidenceReference['privacyLevel'],
): MasteryEvidenceReference {
  return {
    sourceType,
    sourceId,
    evidenceAt: '2026-06-20T00:00:00.000Z',
    privacyLevel,
    confidence: 'high',
  };
}

function learnerState(input: {
  userId: string;
  targetId: string;
  score: number | null;
  confidence: number;
  evidenceCount: number;
  evidenceRefs?: MasteryEvidenceReference[];
  classId?: string;
  targetKind?: 'knowledge' | 'capability';
}): AdaptiveLearnerState {
  const supportingEvidenceRefs = input.evidenceRefs ?? (
    input.evidenceCount > 0 ? [evidenceRef('LearningFact', `${input.userId}:fact`, 'student-visible')] : []
  );
  return {
    userId: input.userId,
    roleScope: {
      role: 'student',
      classId: input.classId ?? 'class-1',
      privacyScopes: ['student-visible'],
    },
    generatedAt: '2026-06-21T00:00:00.000Z',
    authority: 'server-owned',
    knowledgeMastery: {
      coverage: input.evidenceCount > 0 ? 'available' : 'missing',
      tags: input.targetKind === 'capability' ? {} : {
        [input.targetId]: {
          posteriorMastery: input.score ?? 0,
          confidence: input.confidence,
          evidenceCount: input.evidenceCount,
          source: 'adaptive-assessment',
          algorithmVersion: 'test',
          lastUpdatedAt: '2026-06-20T00:00:00.000Z',
          supportingEvidenceRefs,
          sourceCoverage: sourceCoverage(input.evidenceCount > 0 ? 'available' : 'missing'),
        },
      },
    },
    masteryTraceability: {
      knowledgeTargets: input.targetKind === 'capability' ? {} : {
        [input.targetId]: {
          targetId: input.targetId,
          targetKind: 'knowledge',
          masteryLevel: input.score,
          confidence: input.confidence,
          freshness: input.evidenceCount > 0 ? 'current' : 'missing',
          supportingEvidenceRefs,
          sourceCoverage: sourceCoverage(input.evidenceCount > 0 ? 'available' : 'missing'),
          limitations: input.confidence < 0.35 ? ['low-confidence'] : [],
        },
      },
      capabilityTargets: input.targetKind === 'capability'
        ? {
            [input.targetId]: {
              targetId: input.targetId,
              targetKind: 'capability',
              masteryLevel: input.score,
              confidence: input.confidence,
              freshness: input.evidenceCount > 0 ? 'current' : 'missing',
              supportingEvidenceRefs,
              sourceCoverage: sourceCoverage(input.evidenceCount > 0 ? 'available' : 'missing'),
              limitations: input.confidence < 0.35 ? ['low-confidence'] : [],
            },
          }
        : {},
    },
    pathContext: {
      activeControlCorrectionPath: {
        state: 'none',
        pathId: null,
        status: null,
        currentNodeId: null,
        terminalValidationState: null,
        lowConfidenceMarkers: [],
      },
    },
  } as unknown as AdaptiveLearnerState;
}

function sourceCoverage(state: 'available' | 'partial' | 'missing') {
  return {
    AdaptiveMasteryUpdate: state,
    LearningFact: state,
    ArenaSubmission: 'missing',
    AgentToolRun: 'missing',
    StudentEvidenceFeatureCache: state,
  };
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
