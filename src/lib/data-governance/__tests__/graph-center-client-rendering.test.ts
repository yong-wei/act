import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  filterGraphCenterPayload,
  GraphCenterClient,
  selectGraphCenterPayloadNode,
} from '@/features/graph-center/graph-center-client';
import { buildGraphCenterPayload, type ResourceFieldCompletionGraphSummary } from '../graph-center';
import {
  createLearningEvidenceCorpusChunk,
  type LearningEvidenceCorpusChunk,
} from '../learning-evidence-rag-corpus';
import type { AdaptiveLearnerState } from '../adaptive-learner-state-service';
import { buildResourceNodeRegistry } from '../../resource-node-registry';
import { buildKaqArtifactVersionRefs } from '../../kaq-artifact-versioning';
import { RESOURCE_FIELD_COMPLETION_AUDIT_VERSION } from '../../resource-field-completion-audit';

describe('graph center client surface', () => {
  it('renders domain switching, filters, list fallback, and selected-node detail', () => {
    const payload = buildGraphCenterPayload({
      domain: 'capability',
      objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
      portraitDimension: 'simulationValidationEvidence',
      selectedNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(html).toContain('data-graph-center-surface="read-only"');
    expect(html).toContain('data-graph-center-domain="capability"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('id="graph-center-objective"');
    expect(html).toContain('id="graph-center-portrait"');
    expect(html).toContain('data-graph-center-list-fallback="true"');
    expect(html).toContain('data-graph-center-detail="true"');
    expect(html).toContain('用仿真证据验证方案');
    expect(html).toContain('资源绑定');
    expect(html).toContain('kn:autocontrol:simulation-validation');
    expect(html).toContain('资源覆盖');
    expect(html).toContain('RAG 索引');
    expect(html).toContain('已校验引用');
    expect(html).toContain('资源类型');
    expect(html).toContain('校验');
    expect(html).toContain('通过');
    expect(html).toContain('data-graph-center-knowledge-compatibility-link="true"');
    expect(html).toContain('href="/knowledge"');
  });

  it('renders overlay and seed-coverage limitations outside graph body nodes', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(html).toContain('data-graph-center-limitations="true"');
    expect(html).toContain('学习者</span><span class="text-xs text-platform-fg-muted">未接入');
    expect(html).toContain('Runtime content');
    expect(html).toContain('部分覆盖');
    expect(html).toContain('覆盖缺口');
    expect(html).toContain('缺少 RAG 索引');
    expect(html).not.toContain('coveredResourceIds');
  });

  it('renders learner overlay mode with text labels and recommendation evidence', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      resourceRegistry: buildFullCoverageRegistry(),
      evidenceCorpus: [verifiedChunk()],
      learnerOverlay: {
        state: learnerState('learner-1', 0.84, 0.72, 3),
        requestedLearnerId: 'learner-1',
        viewerRole: 'student',
        authorized: true,
        verifiedCitationRefs: {
          'kn:autocontrol:controller-correction': ['chunk-controller-correction-verified'],
        },
      },
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, {
      initialPayload: payload,
      initialDisplayMode: 'learner',
    }));

    expect(html).toContain('学习者</span><span class="text-xs text-platform-fg-muted">可用');
    expect(html).toContain('已掌握');
    expect(html).toContain('学习者 overlay');
    expect(html).toContain('进入下一目标');
    expect(html).toContain('已校验引用 1');
  });

  it('renders graph center actions in selected detail and list fallback paths', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'STUDENT',
      resourceRegistry: buildFullCoverageRegistry(),
      evidenceCorpus: [verifiedChunk()],
      learnerOverlay: {
        state: learnerState('learner-1', 0.84, 0.72, 3),
        requestedLearnerId: 'learner-1',
        viewerRole: 'student',
        authorized: true,
      },
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(html).toContain('data-graph-center-actions="true"');
    expect(html).toContain('data-graph-center-node-actions="kn:autocontrol:controller-correction"');
    expect(html).toContain('进入学习路径');
    expect(html).toContain('查看推荐资源');
    expect(html).toContain('复查个人证据');
    expect(html).toContain('向 Konling 提问');
    expect(html).toContain('data-action-status="available"');
    expect(html).toContain('data-action-status="degraded"');
    expect(html).toContain('证据复查需要学习者证据路由接入');
    expect(html).toContain('href="/interactive-learning?learningGoalId=knowledge%3Aautocontrol%3Acontroller-correction&amp;graphNodeId=kn%3Aautocontrol%3Acontroller-correction"');
  });

  it('renders class heat mode with suppression and denominator labels', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      classOverlay: {
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: true,
        minimumDenominator: 3,
        learnerStates: [learnerState('learner-1', 0.84, 0.72, 3)],
      },
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, {
      initialPayload: payload,
      initialDisplayMode: 'class',
    }));

    expect(html).toContain('班级</span><span class="text-xs text-platform-fg-muted">已抑制');
    expect(html).toContain('小样本抑制');
    expect(html).toContain('班级 overlay');
    expect(html).toContain('分母 1');
    expect(html).toContain('最小分母 5');
  });

  it('preserves server-provided verified resource coverage in the initial render', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      resourceRegistry: buildFullCoverageRegistry(),
      evidenceCorpus: [verifiedChunk()],
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(payload.selectedNode?.resourceCoverage.coverageState).toBe('sufficient');
    expect(html).toContain('覆盖充分');
    expect(html).toContain('RAG 索引 1');
    expect(html).toContain('可引用 1');
    expect(html).toContain('已校验引用 1');
    expect(html).not.toContain('缺少已校验引用');
  });

  it('renders teacher resource field completion diagnostics when present', () => {
    const resourceFieldCompletionSummary: ResourceFieldCompletionGraphSummary = {
      graphCoverageDiagnostics: {
        'kn:autocontrol:controller-correction': {
          complete: 1,
          missingField: 2,
          provisional: 1,
          humanConfirmed: 1,
          citationReady: 1,
          pathEligible: 1,
          blocked: 1,
          denominator: 3,
          sourceWindow: { from: null, to: '2026-06-22T00:00:00.000Z' },
          missingFieldCodes: ['missing-content-hash', 'provisional-metadata'],
          limitationReasons: ['metadata is provisional'],
          sampleLimitations: ['registry:sample: metadata is provisional'],
          artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
        },
      },
    };
    const teacherPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'TEACHER',
      resourceFieldCompletionSummary,
    });
    const studentPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'STUDENT',
      resourceFieldCompletionSummary,
    });

    const teacherHtml = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: teacherPayload }));
    const studentHtml = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: studentPayload }));

    expect(teacherHtml).toContain('字段完成');
    expect(teacherHtml).toContain('完整 1');
    expect(teacherHtml).toContain('缺字段 2');
    expect(teacherHtml).toContain('暂定 1');
    expect(teacherHtml).toContain('人审 1');
    expect(teacherHtml).toContain('缺少内容哈希');
    expect(teacherHtml).toContain('暂定元数据');
    expect(teacherHtml).toContain('registry:sample: metadata is provisional');
    expect(teacherHtml).toContain('data-graph-center-action-id="teacher:inspect-resource-gap"');
    expect(teacherHtml).toContain('data-action-status="degraded"');
    expect(teacherHtml).toContain('href="/teacher/resources/resource-nodes?graphNodeId=kn%3Aautocontrol%3Acontroller-correction&amp;learningGoalId=knowledge%3Aautocontrol%3Acontroller-correction"');
    expect(studentHtml).not.toContain('字段完成');
    expect(studentHtml).not.toContain('缺少内容哈希');
  });

  it('skips resource field completion summary work for student payloads', () => {
    const resourceFieldCompletionSummary = {
      get graphCoverageDiagnostics(): ResourceFieldCompletionGraphSummary['graphCoverageDiagnostics'] {
        throw new Error('student payload must not compute field completion diagnostics');
      },
    } satisfies ResourceFieldCompletionGraphSummary;

    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'STUDENT',
      resourceFieldCompletionSummary,
    });

    expect(payload.selectedNode?.resourceCoverage.fieldCompletion).toBeUndefined();
  });

  it('preserves server-provided coverage when selecting another node from the same payload', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      evidenceCorpus: [
        verifiedChunk({
          id: 'chunk-feedback-loop-verified',
          knowledgeNodeRef: '反馈_1_1',
          href: '/interactive-learning/resources/lesson01-feedback-precheck-v1',
        }),
      ],
    });
    const selectedPayload = selectGraphCenterPayloadNode(payload, 'kn:autocontrol:feedback-loop');

    expect(payload.resourceCoverage['kn:autocontrol:feedback-loop'].ragIndexedCount).toBe(1);
    expect(selectedPayload.selectedNode?.node.id).toBe('kn:autocontrol:feedback-loop');
    expect(selectedPayload.selectedNode?.resourceCoverage.ragIndexedCount).toBe(1);
    expect(selectedPayload.selectedNode?.resourceCoverage.verifiedCitationCount).toBe(1);
  });

  it('preserves an initial no-match selected node state', () => {
    const payload = buildGraphCenterPayload({
      domain: 'quality',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });
    const selectedPayload = selectGraphCenterPayloadNode(payload, null, { preserveEmptySelection: true });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(payload.selectedNode).toBeNull();
    expect(selectedPayload.selectedNode).toBeNull();
    expect(html).toContain('无匹配节点');
  });

  it('defaults to the first node when a reused payload receives an empty selection', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });
    const selectedPayload = selectGraphCenterPayloadNode(payload, null);

    expect(payload.selectedNode?.node.id).toBe('kn:autocontrol:controller-correction');
    expect(selectedPayload.selectedNode?.node.id).toBe(payload.graph.nodes[0].id);
  });

  it('filters a server root payload without dropping verified coverage', () => {
    const rootPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      resourceRegistry: buildFullCoverageRegistry(),
      evidenceCorpus: [verifiedChunk()],
    });
    const filteredPayload = filterGraphCenterPayload(rootPayload, {
      objectiveId: 'knowledge:autocontrol:controller-correction',
      portraitDimension: null,
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });

    expect(filteredPayload.graph.nodes.map((node) => node.id)).toEqual(['kn:autocontrol:controller-correction']);
    expect(filteredPayload.selectedNode?.resourceCoverage.ragIndexedCount).toBe(1);
    expect(filteredPayload.selectedNode?.resourceCoverage.verifiedCitationCount).toBe(1);
  });

  it('keeps overall objective filtering aligned with service graph bindings', () => {
    const rootPayload = buildGraphCenterPayload({ domain: 'knowledge' });
    const filteredPayload = filterGraphCenterPayload(rootPayload, {
      objectiveId: 'knowledge:autocontrol',
      portraitDimension: null,
      selectedNodeId: null,
    });

    expect(filteredPayload.graph.nodes.length).toBe(rootPayload.domains.find((domain) => domain.id === 'knowledge')?.nodeCount);
    expect(filteredPayload.selectedNode?.node.id).toBe(rootPayload.graph.nodes[0].id);
  });

  it('filters server-provided learner and class overlay items with the graph nodes', () => {
    const rootPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      learnerOverlay: {
        state: learnerState('learner-1', 0.84, 0.72, 3),
        requestedLearnerId: 'learner-1',
        viewerRole: 'student',
        authorized: true,
      },
      classOverlay: {
        classId: 'class-1',
        viewerRole: 'teacher',
        authorized: true,
        learnerStates: [
          learnerState('learner-1', 0.84, 0.72, 3),
          learnerState('learner-2', 0.74, 0.72, 3),
          learnerState('learner-3', 0.64, 0.72, 3),
          learnerState('learner-4', 0.54, 0.72, 3),
          learnerState('learner-5', 0.44, 0.72, 3),
        ],
      },
    });
    const filteredPayload = filterGraphCenterPayload(rootPayload, {
      objectiveId: 'knowledge:autocontrol:controller-correction',
      portraitDimension: null,
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });

    expect(Object.keys(filteredPayload.learnerOverlay.items)).toEqual(['kn:autocontrol:controller-correction']);
    expect(Object.keys(filteredPayload.classOverlay.items)).toEqual(['kn:autocontrol:controller-correction']);
    expect(filteredPayload.overlays.learner).toBe('available');
    expect(filteredPayload.overlays.class).toBe('available');
    expect(filteredPayload.selectedNode?.node.id).toBe('kn:autocontrol:controller-correction');
    expect(filteredPayload.limitations.map((limitation) => limitation.code)).not.toContain(
      'class-overlay-suppressed',
    );

    const lowConfidencePayload = filterGraphCenterPayload(rootPayload, {
      objectiveId: 'knowledge:autocontrol:feedback-loop',
      portraitDimension: null,
      selectedNodeId: 'kn:autocontrol:feedback-loop',
    });

    expect(Object.keys(lowConfidencePayload.learnerOverlay.items)).toEqual(['kn:autocontrol:feedback-loop']);
    expect(lowConfidencePayload.overlays.learner).toBe('low-confidence');
    expect(lowConfidencePayload.learnerOverlay.limitations.map((limitation) => limitation.code)).toContain(
      'learner-overlay-low-confidence',
    );
    expect(lowConfidencePayload.limitations.map((limitation) => limitation.code)).toContain(
      'learner-overlay-low-confidence',
    );
    expect(lowConfidencePayload.limitations.filter((limitation) => (
      limitation.code === 'learner-overlay-low-confidence'
    ))).toHaveLength(1);
  });
});

function verifiedChunk(input: {
  id?: string;
  knowledgeNodeRef?: string;
  href?: string;
} = {}): LearningEvidenceCorpusChunk {
  const id = input.id ?? 'chunk-controller-correction-verified';
  const knowledgeNodeRef = input.knowledgeNodeRef ?? 'PID控制器_6_656b8b52';
  const href = input.href ?? '/interactive-learning/resources/lesson15-series-knowledge-deck';
  return createLearningEvidenceCorpusChunk({
    id,
    family: 'course-content',
    sourceType: 'course-content',
    sourceRef: {
      id,
      ownerUserId: null,
      classId: null,
      goalId: 'graph-resource-coverage',
      resourceId: id,
    },
    spanRef: { kind: 'text-range', start: 0, end: 20, locator: 'section#pid' },
    display: {
      title: id,
      href: `/learning-evidence/${id}`,
      capsule: 'Resource coverage fixture.',
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: id,
      href,
      locator: 'section#pid',
      contentHash: 'hash-controller-correction',
    },
    content: {
      text: null,
      redactedSummary: 'Resource coverage fixture.',
      hash: 'hash-controller-correction',
    },
    resourceProjection: {
      resourceId: id,
      segmentRef: `${id}:segment`,
      citationTargetRef: `${id}:citation`,
      knowledgeNodeRefs: [knowledgeNodeRef],
      capabilityTargetRefs: [],
      contentHash: 'hash-controller-correction',
      versionRefs: buildKaqArtifactVersionRefs(),
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
      knowledgeTags: [knowledgeNodeRef],
      pageAnchor: 'section#pid',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'public',
        allowedRoles: ['student', 'teacher', 'admin', 'service'],
      },
      conflictGroup: null,
      conflictSignal: null,
    },
    retrieval: {
      tags: [knowledgeNodeRef],
      goals: ['graph-resource-coverage'],
      useCases: ['konling', 'diagnosis', 'prep-pack'],
    },
  });
}

function buildFullCoverageRegistry() {
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

function learnerState(
  userId: string,
  score: number | null,
  confidence: number,
  evidenceCount: number,
): AdaptiveLearnerState {
  return {
    userId,
    roleScope: {
      role: 'student',
      classId: 'class-1',
      privacyScopes: ['student-visible'],
    },
    generatedAt: '2026-06-21T00:00:00.000Z',
    authority: 'server-owned',
    knowledgeMastery: {
      coverage: evidenceCount > 0 ? 'available' : 'missing',
      tags: {},
    },
    masteryTraceability: {
      knowledgeTargets: {
        'kn:autocontrol:controller-correction': {
          targetId: 'kn:autocontrol:controller-correction',
          targetKind: 'knowledge',
          masteryLevel: score,
          confidence,
          freshness: evidenceCount > 0 ? 'current' : 'missing',
          supportingEvidenceRefs: evidenceCount > 0
            ? [{
                sourceType: 'LearningFact',
                sourceId: `${userId}:fact`,
                evidenceAt: '2026-06-20T00:00:00.000Z',
                privacyLevel: 'student-visible',
                confidence: 'high',
              }]
            : [],
          sourceCoverage: {
            AdaptiveMasteryUpdate: evidenceCount > 0 ? 'available' : 'missing',
            LearningFact: evidenceCount > 0 ? 'available' : 'missing',
            ArenaSubmission: 'missing',
            AgentToolRun: 'missing',
            StudentEvidenceFeatureCache: evidenceCount > 0 ? 'available' : 'missing',
          },
          limitations: [],
        },
      },
      capabilityTargets: {},
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
