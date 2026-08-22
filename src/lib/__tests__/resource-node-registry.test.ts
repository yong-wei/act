import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  GOVERNED_PATH_NODE_TYPES,
  PATH_NODE_SEMANTICS,
  RESOURCE_NODE_TYPES,
  auditResourcePathPlanningDisposition,
  auditResourceNode,
  buildMediaSourceManifestSemanticProjection,
  buildResourceSemanticProjection,
  buildResourceNodeRegistry,
  validateResourceMediaSourceManifest,
  validateResourceSemanticProjection,
  RESOURCE_SEMANTIC_SOURCE_OWNERSHIP,
  type Resource,
  type ResourceMediaSourceManifest,
  type ResourceNode,
  type RuntimeResourceProjectionInput,
} from '../resource-node-registry';
import { getAllRegisteredResourceMetadata, getRegisteredResourceMetadata } from '../resource-registry-metadata';
import {
  CONTROL_CORRECTION_RESOURCE_GRAPH_VERSION,
  buildControlCorrectionResourceNodeRegistry,
} from '../control-correction-resource-seed';
import { buildKaqArtifactVersionRefs } from '../kaq-artifact-versioning';

function isResolvableSeedTarget(target: string): boolean {
  if (/^https?:\/\//.test(target)) return true;
  const pathOnly = target.split('?')[0];
  if (pathOnly.startsWith('/interactive-learning/resources/')) {
    const resourceId = pathOnly.replace('/interactive-learning/resources/', '');
    return Boolean(getRegisteredResourceMetadata(resourceId)) &&
      existsSync(path.join(process.cwd(), 'src/app/interactive-learning/resources/[id]/page.tsx'));
  }
  if (pathOnly.startsWith('/interactive-learning/courses/')) {
    const parts = pathOnly.split('/');
    const courseSlug = parts[3];
    return Boolean(courseSlug) &&
      existsSync(path.join(process.cwd(), `src/app/interactive-learning/courses/${courseSlug}/student/[sessionId]/page.tsx`));
  }
  if (pathOnly.startsWith('/arena/challenges/')) {
    return existsSync(path.join(process.cwd(), 'src/app/arena/challenges/[taskId]/page.tsx'));
  }
  if (pathOnly.startsWith('/profile/growth')) {
    return existsSync(path.join(process.cwd(), 'src/app/(main)/profile/growth/page.tsx'));
  }
  if (pathOnly.startsWith('/ai/copilot')) {
    return existsSync(path.join(process.cwd(), 'src/app/ai/copilot/page.tsx'));
  }
  return existsSync(path.join(process.cwd(), target.replace(/^\//, '')));
}

function sampleRegistry() {
  return buildResourceNodeRegistry({
    teachingResources: [
      {
        id: 'tr-video',
        title: 'Bode 视频',
        type: 'STATIC_MEDIA',
        content: 'bode.mp4',
        knowledgeNodeIds: ['kn-bode'],
      },
      {
        id: 'tr-quiz',
        title: '频域后测',
        type: 'INTERACTIVE_COMP',
        registryId: 'lesson12-bode-post-quiz',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    registeredResources: [
      {
        id: 'lesson12-bode-post-quiz',
        label: '伯德图后测',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-bode'],
      },
      {
        id: 'adaptive-bode-quiz',
        label: '伯德图自适应练习',
        type: 'ADAPTIVE_QUIZ',
        renderTarget: '/interactive-learning/resources/adaptive-bode-quiz',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    knowledgeNodes: [
      { id: 'kn-bode', name: '伯德图' },
    ],
    runtimeLessons: [
      {
        lessonId: 'unit-2-3-frequency-response-bode-intro',
        title: '频率响应入门',
        steps: [
          {
            id: 'step-01',
            title: '频域入口',
            knowledgeNodeIds: ['kn-bode'],
            renderTarget: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-01',
          },
        ],
        handoutPdfPath: '/course-runtime/lessons/2-3/handout.pdf',
        mediaResources: [
          {
            id: 'intro-video',
            title: '频域导入视频',
            kind: 'video',
            url: 'https://example.test/video.mp4',
            teachingResourceId: 'tr-video',
          },
          {
            id: 'intro-audio',
            title: '频域导入音频',
            kind: 'audio',
            url: 'https://example.test/audio.mp3',
          },
          {
            id: 'slide-deck',
            title: '频域课件',
            kind: 'slides',
            url: 'https://example.test/slides.pdf',
          },
        ],
      },
    ],
    textbooks: [
      {
        bookId: 'dorf-modern-control-systems',
        title: 'Modern Control Systems',
        sourceHref: '/course-content/runtime/resources/textbooks/dorf-modern-control-systems',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    textbookSections: [
      {
        bookId: 'dorf-modern-control-systems',
        sectionId: 'ch10-sec01',
        title: '根轨迹校正设计',
        citationHref: '/course-content/runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01',
        knowledgeNodeIds: ['kn-bode'],
        capabilityTargetIds: ['parameterDesign'],
        estimatedTimeMinutes: 18,
      },
    ],
    simulations: [
      {
        id: 'cruise',
        title: '邮轮舒适度仿真',
        launchTarget: '/simulations/cruise',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    arenaTasks: [
      {
        id: 'task-second-order-lead-pid',
        title: '横摇控制 Arena',
        launchTarget: '/arena/challenges/task-second-order-lead-pid',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['simulation:cruise'],
        official: true,
        planningOverride: {
          readiness: {
            minimumCompetency: { controlModeling: 0.6 },
            minimumEvidenceCount: 1,
            requiredCompletedNodeIds: ['simulation:cruise'],
            requiredOutcomeRefs: ['simulation_run:cruise'],
            unlockMessage: '完成邮轮仿真后解锁 Arena。',
            fallbackNodeIds: ['simulation:cruise'],
          },
        },
      },
    ],
    externalResources: [
      {
        id: 'bode-open-course',
        title: '伯德图开放课程资料',
        source: 'Open Course',
        url: 'https://example.test/bode-open-course',
        estimatedTimeMinutes: 14,
        knowledgeNodeIds: ['kn-bode'],
        applicableGoalId: 'frequency-response-foundations',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      },
    ],
    controlWorkbenchTasks: [
      {
        id: 'bode-workbench',
        title: '伯德图控制工作台',
        launchTarget: '/simulations/control-workbench?task=bode',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    reflectionPrompts: [
      {
        id: 'reflection-1',
        title: '频域反思',
        renderTarget: '/profile/growth?prompt=reflection-1',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    checkpoints: [
      {
        id: 'bode-checkpoint',
        title: '伯德图阶段检查',
        assessmentPurpose: '确认伯德图关键概念',
        criteria: ['解释斜率', '说明穿越频率'],
        requiredEvidenceRefs: ['adaptive_quiz.completed'],
        remediationBehavior: 'retry-prerequisite-node',
        launchTarget: '/assessment/adaptive-practice?checkpoint=bode',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    aiInterventions: [
      {
        id: 'hint-bode',
        title: '伯德图提示',
        renderTarget: '/ai/copilot?context=bode',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    konlingSupports: [
      {
        id: 'konling-bode',
        title: '伯德图控灵伴学',
        renderTarget: '/ai/copilot?context=bode-konling',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    projects: [
      {
        id: 'bode-project',
        title: '伯德图项目',
        launchTarget: '/missions?project=bode',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['arena-task:task-second-order-lead-pid'],
      },
    ],
  });
}

function runtimeProjectionSidecar(
  overrides: Partial<RuntimeResourceProjectionInput>,
): RuntimeResourceProjectionInput {
  return {
    id: 'runtime-step:unit-demo:step',
    resourceNodeId: 'lesson-step:unit-demo:step',
    title: 'Runtime step',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: 'unit-demo:step',
    sourcePathOrUrl: 'course-content/runtime/lessons/unit-demo/interactive-manifest.json',
    sourceRecord: 'unit-demo:step',
    sourceHash: 'sha256:step',
    sourceVersionRef: 'interactive-manifest.v2',
    projectionLevel: 'ResourceNode',
    routeTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step',
    graphNodeRefs: {
      knowledge: ['kn-demo'],
      capability: ['controlModeling'],
      quality: [],
    },
    estimatedTimeMinutes: 8,
    evidenceInstrumentation: ['lesson_step_view'],
    privacyScope: 'student-visible',
    teacherPolicy: 'allowed',
    evidenceContract: {
      eventSource: true,
      eventType: true,
      clientEventIdPolicy: true,
      attemptKey: true,
      sourceLogId: true,
      dedupeKey: true,
      timestamps: true,
      learningFactPolicy: true,
      confidencePolicy: true,
      privacyScope: true,
    },
    reviewAudit: {
      status: 'human-confirmed',
      reviewerId: 'teacher-1',
      reviewerRole: 'teacher',
      reviewedAt: '2026-06-22T00:00:00.000Z',
      reviewBatchId: 'runtime-projection-batch-1',
      reviewedSourceHash: 'sha256:step',
      reviewedVersionRef: 'interactive-manifest.v2',
      generationToolOrModel: 'template',
      promptOrManifestHash: null,
      confidence: 0.9,
      staleInvalidationRule: 'stale when source hash or version changes',
    },
    ...overrides,
  };
}

describe('resource node registry', () => {
  it('does not materialize audit-only runtime projections as ResourceNodes', () => {
    const projectionId = 'textbook-section:book:synthetic-audit-only';
    const registry = buildResourceNodeRegistry({
      runtimeResourceProjections: [runtimeProjectionSidecar({
        id: projectionId,
        resourceNodeId: null,
        resourceType: 'textbook_section',
        sourceKind: 'textbook_section',
        sourceRef: projectionId,
        sourceRecord: projectionId,
        lifecycleScope: 'audit-only',
        privacyScope: 'teacher-scoped',
        teacherPolicy: 'teacher-only',
      })],
    });

    expect(registry.nodes).toEqual([]);
    expect(registry.edges).toEqual([]);
  });

  it('keeps audit-only projection IDs from merging into existing textbook sections', () => {
    const projectionId = 'textbook-section:book:section-1';
    const registry = buildResourceNodeRegistry({
      textbookSections: [{
        bookId: 'book',
        sectionId: 'section-1',
        title: 'Existing reviewed section',
        citationHref: '/course-runtime/resources/textbooks/book/sections/section-1',
        knowledgeNodeIds: ['kn-existing'],
      }],
      runtimeResourceProjections: [runtimeProjectionSidecar({
        id: projectionId,
        resourceNodeId: null,
        title: 'Audit-only duplicate title',
        resourceType: 'textbook_section',
        sourceKind: 'textbook_section',
        sourceRef: 'authoring-textbook-section:book:section-1',
        sourceRecord: 'authoring-textbook-section:book:section-1',
        lifecycleScope: 'audit-only',
        privacyScope: 'teacher-scoped',
        teacherPolicy: 'teacher-only',
      })],
    });

    expect(registry.nodes).toHaveLength(1);
    expect(registry.nodes[0]).toMatchObject({
      id: projectionId,
      title: 'Existing reviewed section',
      runtimeProjection: null,
      planningMetadata: { knowledgeCoverage: ['kn-existing'] },
    });
    expect(registry.nodes[0].sourceRefs).not.toContainEqual(expect.objectContaining({
      ref: 'authoring-textbook-section:book:section-1',
    }));
  });

  it('still materializes non-audit model-cleared teacher-only retrieval projections', () => {
    const projectionId = 'textbook-section:book:model-cleared-retrieval';
    const registry = buildResourceNodeRegistry({
      runtimeResourceProjections: [runtimeProjectionSidecar({
        id: projectionId,
        resourceNodeId: null,
        resourceType: 'textbook_section',
        sourceKind: 'textbook_section',
        sourceRef: projectionId,
        sourceRecord: projectionId,
        projectionLevel: 'ResourceSegment',
        lifecycleScope: 'runtime',
        routeTarget: null,
        renderTarget: '/course-runtime/resources/textbooks/book/sections/model-cleared-retrieval',
        privacyScope: 'teacher-scoped',
        teacherPolicy: 'teacher-only',
        reviewAudit: {
          ...runtimeProjectionSidecar({}).reviewAudit!,
          status: 'model-cleared',
        },
        groundingEligibility: {
          retrievalReady: true,
          citationReady: true,
          authoringTriageReady: false,
        },
        pathEligibility: {
          current: false,
          afterCompletion: false,
          masteryAffecting: false,
          blockedBy: ['missing-human-review'],
        },
      })],
    });

    expect(registry.nodes).toHaveLength(1);
    expect(registry.nodes[0]).toMatchObject({
      id: projectionId,
      runtimeProjection: {
        id: projectionId,
        projectionLevel: 'ResourceSegment',
        reviewAudit: { status: 'model-cleared' },
      },
      planningMetadata: {
        privacyLevel: 'teacher-scoped',
        teacherPolicy: 'teacher-only',
      },
    });
  });

  it('loads an audited versioned control-correction seed graph across required resource types', () => {
    const registry = buildControlCorrectionResourceNodeRegistry();
    const eligibleNodes = registry.nodes.filter((node) => node.eligibility.pathEligible);

    expect(CONTROL_CORRECTION_RESOURCE_GRAPH_VERSION).toBe('control-correction-resource-graph.v1');
    expect(new Set(eligibleNodes.map((node) => node.type))).toEqual(new Set([
      'knowledge_card',
      'handout',
      'video',
      'quiz',
      'simulation',
      'arena_task',
      'reflection',
      'ai_intervention',
    ]));
    expect(eligibleNodes.every((node) => node.launchTarget || node.renderTarget)).toBe(true);
    expect(eligibleNodes.every((node) => isResolvableSeedTarget(node.launchTarget ?? node.renderTarget ?? '')))
      .toBe(true);
    expect(eligibleNodes.every((node) => node.planningMetadata.knowledgeCoverage.length > 0)).toBe(true);
    expect(eligibleNodes.every((node) => node.planningMetadata.evidenceInstrumentation.length > 0)).toBe(true);
    expect(eligibleNodes.every((node) => node.planningMetadata.privacyLevel === 'student-visible')).toBe(true);
    expect(registry.edges).toContainEqual(expect.objectContaining({
      fromNodeId: 'simulation:control-correction-step-response-lab',
      toNodeId: 'arena-task:task-second-order-lead-pid',
      kind: 'prerequisite',
    }));
    expect(registry.nodes.find((node) => node.id === 'simulation:control-correction-step-response-lab')?.planningMetadata.terminalConstraints)
      .toContain('transfer-validation');
    expect(registry.nodes.find((node) => node.id === 'arena-task:task-second-order-lead-pid')?.planningMetadata.terminalConstraints)
      .toContain('terminal-validation');
    expect(registry.nodes.find((node) => node.id === 'simulation:control-correction-step-response-lab')?.planningMetadata.readiness)
      .toMatchObject({
        minimumCompetency: {
          controlModeling: expect.any(Number),
          parameterDesign: expect.any(Number),
        },
        minimumEvidenceCount: expect.any(Number),
        requiredCompletedNodeIds: ['registry:lesson09-correction-precheck'],
      });
    expect(registry.nodes.find((node) => node.id === 'arena-task:task-second-order-lead-pid')?.planningMetadata.readiness)
      .toMatchObject({
        minimumCompetency: {
          controlModeling: expect.any(Number),
          parameterDesign: expect.any(Number),
        },
        minimumEvidenceCount: expect.any(Number),
        requiredCompletedNodeIds: ['simulation:control-correction-step-response-lab'],
        requiredOutcomeRefs: ['simulation_run:control-correction-step-response-lab'],
        unlockMessage: 'Arena 暂未解锁，完成仿真验证后会自动进入。',
      });
  });

  it('keeps incomplete control-correction seed fixtures out of path eligibility', () => {
    const registry = buildControlCorrectionResourceNodeRegistry({
      includeInvalidFixture: true,
    });

    expect(registry.audit.ineligibleNodes).toContainEqual(expect.objectContaining({
      id: 'registry:control-correction-invalid-quiz',
      reasons: expect.arrayContaining([
        'missing-render-or-launch-target',
        'missing-evidence-instrumentation',
      ]),
    }));
    expect(registry.nodes.find((node) => node.id === 'registry:control-correction-invalid-quiz')?.eligibility.pathEligible)
      .toBe(false);
  });

  it.each([
    ['generic Arena route', '/arena', 'generic-arena-target'],
    ['mismatched Arena route', '/arena/challenges/task-ship-roll-comfort', 'arena-route-mismatch'],
  ])('blocks %s from ResourceNode path eligibility', (_label, launchTarget, reason) => {
    const registry = buildResourceNodeRegistry({
      arenaTasks: [{
        id: 'task-second-order-lead-pid',
        title: '二阶对象快速稳定挑战',
        launchTarget,
        knowledgeNodeIds: ['kn-bode'],
        official: true,
        planningOverride: {
          abilityImpact: { controlModeling: 0.4 },
          evidenceInstrumentation: ['arena_evaluation_complete'],
        },
      }],
    });

    expect(registry.nodes[0]?.eligibility).toMatchObject({
      pathEligible: false,
      reasons: expect.arrayContaining([reason]),
    });
    expect(registry.audit.ineligibleNodes[0]?.reasons).toContain(reason);
  });

  it('blocks unknown Arena catalog tasks even when identity and route agree', () => {
    const registry = buildResourceNodeRegistry({
      arenaTasks: [{
        id: 'unknown-task',
        title: 'Unknown Arena task',
        launchTarget: '/arena/challenges/unknown-task',
        knowledgeNodeIds: ['kn-bode'],
        official: true,
        planningOverride: {
          abilityImpact: { controlModeling: 0.4 },
          evidenceInstrumentation: ['arena_evaluation_complete'],
        },
      }],
    });

    expect(registry.nodes[0]?.eligibility).toMatchObject({
      pathEligible: false,
      reasons: expect.arrayContaining(['unknown-arena-task']),
    });
  });

  it('blocks an explicitly path-plannable Arena node that uses a knowledge placeholder identity', () => {
    const canonical = buildControlCorrectionResourceNodeRegistry().nodes.find(
      (node) => node.id === 'arena-task:task-second-order-lead-pid',
    ) as ResourceNode;
    const placeholder: ResourceNode = {
      ...canonical,
      id: '根轨迹_1_1',
      sourceKind: 'knowledge_graph',
      sourceRef: '根轨迹_1_1',
      launchTarget: '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
      planningMetadata: {
        ...canonical.planningMetadata,
        pathDisposition: {
          kind: 'path-plannable',
          reviewStatus: 'human-confirmed',
          rationale: 'Legacy fixture marked path-plannable.',
          sourceFamily: 'knowledge_graph',
          stableSourceRef: '根轨迹_1_1',
          sourceVersionRef: 'legacy-fixture.v1',
          parentResourceNodeId: null,
          reviewedAt: '2026-07-10T00:00:00.000Z',
          reviewerId: 'fixture-reviewer',
        },
      },
    };

    expect(auditResourceNode(placeholder).reasons).toContain('knowledge-placeholder-identity');
    expect(auditResourceNode(placeholder).pathEligible).toBe(false);
  });

  it('blocks a terminal-validation Arena node with a knowledge placeholder even without a path disposition', () => {
    const canonical = buildControlCorrectionResourceNodeRegistry().nodes.find(
      (node) => node.id === 'arena-task:task-second-order-lead-pid',
    ) as ResourceNode;
    const placeholder: ResourceNode = {
      ...canonical,
      id: '根轨迹_1_1',
      sourceKind: 'knowledge_graph',
      sourceRef: '根轨迹_1_1',
      launchTarget: '/arena?nodeId=%E6%A0%B9%E8%BD%A8%E8%BF%B9_1_1',
      planningMetadata: {
        ...canonical.planningMetadata,
        pathDisposition: undefined,
        terminalConstraints: ['terminal-validation'],
      },
    };

    expect(auditResourceNode(placeholder)).toMatchObject({
      pathEligible: false,
      reasons: expect.arrayContaining(['knowledge-placeholder-identity']),
    });
  });

  it('audits empty readiness metadata on high-complexity path nodes as missing', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'empty-readiness',
          title: '空 readiness 仿真',
          launchTarget: '/simulations/empty-readiness',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: {
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run'],
            readiness: {} as any,
          },
        },
      ],
    });

    expect(registry.nodes.find((node) => node.id === 'simulation:empty-readiness')?.eligibility.auditIssues)
      .toContainEqual(expect.objectContaining({
        code: 'missing-readiness-metadata',
        severity: 'warning',
      }));
  });

  it('audits path-planning dispositions and syncs canonical planner eligibility', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'parent-path-node',
        label: 'Parent path node',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-bode'],
      }, {
        id: 'non-plannable-parent',
        label: 'Non plannable parent',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/non-plannable-parent.png',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          pathDisposition: {
            kind: 'supporting-citation',
            reviewStatus: 'human-confirmed',
            rationale: 'Citation-only parent candidate.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'non-plannable-parent',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'missing-disposition',
        label: 'Missing disposition resource',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-bode'],
      }, {
        id: 'provisional-path-disposition',
        label: 'Provisional path disposition',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-bode'],
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
            rationale: 'Script suggested this resource as a path node.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'provisional-path-disposition',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: null,
            reviewerId: null,
          },
        },
      }, {
        id: 'supporting-citation-disposition',
        label: 'Supporting citation resource',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/supporting-citation.png',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          pathDisposition: {
            kind: 'supporting-citation',
            reviewStatus: 'human-confirmed',
            rationale: 'Citation-only support for a lesson explanation.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'supporting-citation-disposition',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'supporting-citation-without-rationale',
        label: 'Supporting citation without rationale',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/supporting-citation-without-rationale.png',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          pathDisposition: {
            kind: 'supporting-citation',
            reviewStatus: 'human-confirmed',
            rationale: null,
            sourceFamily: 'resource_registry',
            stableSourceRef: 'supporting-citation-without-rationale',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'human-confirmed-without-evidence',
        label: 'Human confirmed without evidence',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-bode'],
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
            reviewStatus: 'human-confirmed',
            rationale: 'Marked reviewed without durable reviewer evidence.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'human-confirmed-without-evidence',
            sourceVersionRef: null,
            parentResourceNodeId: null,
            reviewedAt: null,
            reviewerId: null,
          },
        },
      }, {
        id: 'evidence-producing-disposition',
        label: 'Evidence producing resource',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          pathDisposition: {
            kind: 'evidence-producing',
            reviewStatus: 'human-confirmed',
            rationale: 'Produces learner evidence without being the independent path target.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'evidence-producing-disposition',
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
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          evidenceInstrumentation: [],
          pathDisposition: {
            kind: 'evidence-producing',
            reviewStatus: 'human-confirmed',
            rationale: 'Claims evidence production without instrumentation.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'evidence-producing-without-instrumentation',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'embedded-without-parent',
        label: 'Embedded asset without parent',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/embedded.png',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          pathDisposition: {
            kind: 'embedded-asset',
            reviewStatus: 'human-confirmed',
            rationale: 'Illustrates a parent lesson step.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'embedded-without-parent',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'embedded-with-valid-parent',
        label: 'Embedded asset with valid parent',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/embedded-valid.png',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          pathDisposition: {
            kind: 'embedded-asset',
            reviewStatus: 'human-confirmed',
            rationale: 'Illustrates a valid parent path node.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'embedded-with-valid-parent',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: 'registry:parent-path-node',
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'embedded-with-missing-parent',
        label: 'Embedded asset with missing parent',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/embedded-missing.png',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          pathDisposition: {
            kind: 'embedded-asset',
            reviewStatus: 'human-confirmed',
            rationale: 'References a missing parent path node.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'embedded-with-missing-parent',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: 'registry:missing-parent',
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'embedded-with-non-plannable-parent',
        label: 'Embedded asset with non-plannable parent',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/embedded-non-plannable.png',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          pathDisposition: {
            kind: 'embedded-asset',
            reviewStatus: 'human-confirmed',
            rationale: 'References a non-plannable parent resource.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'embedded-with-non-plannable-parent',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: 'registry:non-plannable-parent',
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'resource-governance-review',
          },
        },
      }, {
        id: 'excluded-without-rationale',
        label: 'Excluded without rationale',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/obsolete.png',
        knowledgeNodeIds: ['kn-bode'],
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
        id: 'excluded-with-rationale',
        label: 'Excluded with rationale',
        type: 'STATIC_MEDIA',
        renderTarget: '/course-runtime/assets/excluded.png',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          pathDisposition: {
            kind: 'excluded-with-rationale',
            reviewStatus: 'human-confirmed',
            rationale: 'Outdated support asset retained only for citation traceability.',
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

    const node = (id: string) => registry.nodes.find((item) => item.id === `registry:${id}`)!;
    const nodesById = new Map(registry.nodes.map((item) => [item.id, item]));

    expect(auditResourcePathPlanningDisposition(node('missing-disposition'))).toContainEqual(expect.objectContaining({
      code: 'missing-path-disposition',
    }));
    expect(auditResourcePathPlanningDisposition(node('provisional-path-disposition'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-disposition-review' }),
      expect.objectContaining({ code: 'invalid-path-disposition-promotion', severity: 'blocking' }),
    ]));
    expect(auditResourcePathPlanningDisposition(node('human-confirmed-without-evidence'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-disposition-review' }),
      expect.objectContaining({ code: 'invalid-path-disposition-promotion', severity: 'blocking' }),
    ]));
    expect(auditResourcePathPlanningDisposition(node('supporting-citation-disposition'))).toEqual([]);
    expect(auditResourcePathPlanningDisposition(node('supporting-citation-without-rationale'))).toContainEqual(
      expect.objectContaining({ code: 'missing-disposition-rationale' }),
    );
    expect(auditResourcePathPlanningDisposition(node('evidence-producing-disposition'))).toEqual([]);
    expect(auditResourcePathPlanningDisposition(node('evidence-producing-without-instrumentation'))).toContainEqual(expect.objectContaining({
      code: 'missing-evidence-instrumentation',
    }));
    expect(auditResourcePathPlanningDisposition(node('embedded-without-parent'))).toContainEqual(expect.objectContaining({
      code: 'missing-parent-planning-unit',
    }));
    expect(auditResourcePathPlanningDisposition(
      node('embedded-with-valid-parent'),
      { nodesById },
    )).toEqual([]);
    expect(auditResourcePathPlanningDisposition(
      node('embedded-with-missing-parent'),
      { nodesById },
    )).toContainEqual(expect.objectContaining({
      code: 'missing-parent-planning-unit',
    }));
    expect(auditResourcePathPlanningDisposition(
      node('embedded-with-non-plannable-parent'),
      { nodesById },
    )).toContainEqual(expect.objectContaining({
      code: 'missing-parent-planning-unit',
    }));
    expect(auditResourcePathPlanningDisposition(node('excluded-without-rationale'))).toContainEqual(expect.objectContaining({
      code: 'missing-disposition-rationale',
    }));
    expect(auditResourcePathPlanningDisposition(node('excluded-with-rationale'))).toEqual([]);
    expect(node('provisional-path-disposition').eligibility.pathEligible).toBe(false);
    expect(node('supporting-citation-disposition').eligibility.pathEligible).toBe(false);
    expect(node('supporting-citation-disposition').eligibility.reasons).toContain('invalid-path-disposition-promotion');
    expect(node('evidence-producing-disposition').eligibility.pathEligible).toBe(false);
    expect(node('excluded-with-rationale').eligibility.pathEligible).toBe(false);
    expect(buildResourceSemanticProjection(node('supporting-citation-disposition')).planningUnit).toBeNull();
    expect(buildResourceSemanticProjection(node('supporting-citation-disposition')).resource.projectionStatus.planning)
      .toBe('blocked');
    expect(buildResourceSemanticProjection(node('evidence-producing-disposition')).planningUnit).toBeNull();
    expect(buildResourceSemanticProjection(node('excluded-with-rationale')).planningUnit).toBeNull();
    expect(buildResourceSemanticProjection(node('human-confirmed-without-evidence')).planningUnit).toBeNull();
  });

  it('can require evidence instrumentation as a blocking audit gate without changing the default registry policy', () => {
    const defaultRegistry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'missing-evidence-quiz',
          label: '缺少证据埋点的测验',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/teacher/resources',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: {
            evidenceInstrumentation: [],
          },
        },
      ],
    });
    const strictRegistry = buildResourceNodeRegistry({
      auditOptions: {
        strictEvidenceInstrumentation: true,
      },
      registeredResources: [
        {
          id: 'missing-evidence-quiz',
          label: '缺少证据埋点的测验',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/teacher/resources',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: {
            evidenceInstrumentation: [],
          },
        },
      ],
    });

    expect(defaultRegistry.nodes[0].eligibility.pathEligible).toBe(true);
    expect(defaultRegistry.nodes[0].eligibility.auditIssues).toContainEqual(expect.objectContaining({
      code: 'missing-evidence-instrumentation',
      severity: 'warning',
    }));
    expect(strictRegistry.nodes[0].eligibility.pathEligible).toBe(false);
    expect(strictRegistry.nodes[0].eligibility.auditIssues).toContainEqual(expect.objectContaining({
      code: 'missing-evidence-instrumentation',
      severity: 'blocking',
    }));
  });

  it('registers every supported path-plannable resource type with stable source references', () => {
    const registry = sampleRegistry();

    expect(registry.supportedTypes).toEqual(RESOURCE_NODE_TYPES);
    expect(new Set(registry.nodes.map((node) => node.type))).toEqual(new Set(RESOURCE_NODE_TYPES));
    expect(registry.nodes.every((node) => node.id && node.title && node.sourceKind && node.sourceRef)).toBe(true);
    expect(registry.nodes.every((node) => 'renderTarget' in node && 'launchTarget' in node)).toBe(true);
  });

  it('keeps curated registered resource semantics in the central metadata export', () => {
    const registeredResources = getAllRegisteredResourceMetadata();
    const registry = buildResourceNodeRegistry({ registeredResources });
    const unmapped = registry.nodes.filter((node) => node.eligibility.reasons.includes('missing-knowledge-mapping'));

    expect(registeredResources.length).toBeGreaterThanOrEqual(133);
    expect(unmapped).toEqual([]);
    const correctionPrecheck = registry.nodes.find((node) => node.id === 'registry:lesson09-correction-precheck');
    expect(correctionPrecheck).toMatchObject({
      renderTarget: '/interactive-learning/resources/lesson09-correction-precheck',
      planningMetadata: {
        knowledgeCoverage: expect.arrayContaining([
          '时域指标到目标极点区域_3_36001',
          '根轨迹增益换算_3_4b1d9e6c',
        ]),
        abilityImpact: {
          diagnosticAssessment: expect.any(Number),
          parameterDesign: expect.any(Number),
        },
      },
      eligibility: { pathEligible: true },
    });
    expect(correctionPrecheck?.planningMetadata.knowledgeCoverage).toHaveLength(2);
    expect(registry.nodes.find((node) => node.id === 'registry:lesson02-modeling-handout-v1')).toMatchObject({
      planningMetadata: {
        availability: 'archived',
        knowledgeCoverage: expect.arrayContaining(['机理建模_1_2']),
      },
      eligibility: {
        pathEligible: false,
        reasons: expect.arrayContaining(['unavailable-resource']),
      },
    });
    expect(registry.nodes.find((node) => node.id === 'registry:lesson07-static-classification')).toMatchObject({
      planningMetadata: {
        knowledgeCoverage: expect.arrayContaining(['二阶系统_3_3a0af45b']),
        evidenceInstrumentation: ['static_media_view'],
      },
      eligibility: { pathEligible: true },
    });
    expect(registry.nodes.find((node) => node.id === 'registry:lesson02-legacy-pretest-v1')).toMatchObject({
      planningMetadata: {
        availability: 'archived',
        teacherPolicy: 'blocked',
      },
      eligibility: {
        pathEligible: false,
        reasons: expect.arrayContaining(['unavailable-resource', 'teacher-policy-blocked']),
      },
    });
    expect(registry.nodes.find((node) => node.id === 'registry:classroom-video')).toMatchObject({
      planningMetadata: {
        availability: 'teacher_only',
        teacherPolicy: 'teacher-only',
        privacyLevel: 'teacher-scoped',
      },
      eligibility: {
        pathEligible: false,
        reasons: expect.arrayContaining(['unavailable-resource']),
      },
    });
    expect(registry.nodes.find((node) => node.id === 'arena-task:task-second-order-lead-pid')).toMatchObject({
      sourceKind: 'arena_task',
      sourceRef: 'task-second-order-lead-pid',
      launchTarget: '/arena/challenges/task-second-order-lead-pid',
      sourceRefs: expect.arrayContaining([
        { kind: 'resource_registry', ref: 'arena-challenge-workbench' },
      ]),
      planningMetadata: {
        readiness: {
          requiredCompletedNodeIds: ['registry:lesson09-summary-card'],
          requiredOutcomeRefs: ['simulation_run:lesson09-time-domain-synthesis'],
        },
      },
    });
    expect(registry.nodes.find((node) => node.id === 'arena-task:task-cruise-roll-blackbox-identification'))
      .toMatchObject({
        sourceKind: 'arena_task',
        sourceRef: 'task-cruise-roll-blackbox-identification',
        launchTarget: '/arena/challenges/task-cruise-roll-blackbox-identification',
        planningMetadata: {
          pathDisposition: {
            kind: 'path-plannable',
            reviewStatus: 'human-confirmed',
            sourceFamily: 'arena_task',
            stableSourceRef: 'task-cruise-roll-blackbox-identification',
            sourceVersionRef: 'arena-path-target-integrity.v1',
          },
          readiness: {
            fallbackNodeIds: ['registry:lesson15-series-precheck'],
          },
        },
      });
    expect(registry.nodes.some((node) => node.id === 'registry:arena-challenge-workbench')).toBe(false);
    expect(registry.nodes.find((node) => node.id === 'registry:lesson09-time-domain-synthesis')).toMatchObject({
      type: 'lesson_step',
      planningMetadata: {
        evidenceInstrumentation: expect.arrayContaining(['simulation_trace_verified']),
      },
      eligibility: { pathEligible: true },
    });

    const activeRegisteredNodes = registry.nodes.filter((node) =>
      node.sourceKind === 'resource_registry' &&
      node.planningMetadata.availability !== 'archived' &&
      node.planningMetadata.teacherPolicy !== 'blocked' &&
      node.planningMetadata.teacherPolicy !== 'teacher-only'
    );
    const incompleteActiveNodes = activeRegisteredNodes
      .filter((node) =>
        node.planningMetadata.knowledgeCoverage.length === 0 ||
        node.planningMetadata.evidenceInstrumentation.length === 0 ||
        Object.keys(node.planningMetadata.abilityImpact).length === 0 ||
        typeof node.planningMetadata.estimatedTimeMinutes !== 'number' ||
        node.eligibility.auditIssues.length > 0
      )
      .map((node) => ({
        id: node.id,
        auditIssues: node.eligibility.auditIssues.map((issue) => issue.code),
      }));
    const unlockedSimulations = activeRegisteredNodes
      .filter((node) => node.type === 'simulation' && !node.planningMetadata.readiness)
      .map((node) => node.id);

    expect(activeRegisteredNodes).toHaveLength(137);
    expect(incompleteActiveNodes).toEqual([]);
    expect(unlockedSimulations).toEqual([]);
  });

  it('derives lesson13 physics builder as an interactive lesson step for both source projections', () => {
    const registeredResources = getAllRegisteredResourceMetadata();
    const registry = buildResourceNodeRegistry({
      registeredResources,
      teachingResources: [{
        id: 'lesson13-physics-builder-simple',
        title: '阻尼调节实验',
        type: 'INTERACTIVE_COMP',
        registryId: 'lesson13-physics-builder-simple',
        knowledgeNodeIds: ['对象化三域验证_3_56cb3a4e'],
      }],
    });

    expect(registry.nodes.find((node) => node.id === 'registry:lesson13-physics-builder-simple')).toMatchObject({
      type: 'lesson_step',
    });
    expect(registry.nodes.find((node) => node.id === 'teaching-resource:lesson13-physics-builder-simple')).toMatchObject({
      type: 'lesson_step',
      launchTarget: '/interactive-learning/resources/lesson13-physics-builder-simple',
    });
  });

  it('registers textbook sections as path-plannable resources without turning textbook containers into path nodes', () => {
    const registry = buildResourceNodeRegistry({
      textbooks: [
        {
          bookId: 'dorf-modern-control-systems',
          title: 'Modern Control Systems',
          sourceHref: '/course-content/runtime/resources/textbooks/dorf-modern-control-systems',
          knowledgeNodeIds: ['kn-root-locus'],
        },
      ],
      textbookSections: [
        {
          bookId: 'dorf-modern-control-systems',
          sectionId: 'ch10-sec01',
          title: '根轨迹校正设计',
          citationHref: '/course-content/runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01',
          knowledgeNodeIds: ['kn-root-locus'],
          capabilityTargetIds: ['parameterDesign', 'controlModeling'],
          estimatedTimeMinutes: 18,
          prerequisiteNodeIds: ['knowledge-card:kn-root-locus'],
        },
      ],
      knowledgeCards: [
        {
          id: 'kn-root-locus',
          title: '根轨迹知识卡',
          sourceRef: 'kn-root-locus:card',
          renderTarget: '/knowledge/cards/kn-root-locus',
          knowledgeNodeIds: ['kn-root-locus'],
        },
      ],
    });

    const textbook = registry.nodes.find((node) => node.id === 'textbook:dorf-modern-control-systems');
    const section = registry.nodes.find((node) =>
      node.id === 'textbook-section:dorf-modern-control-systems:ch10-sec01'
    );

    expect(textbook).toMatchObject({
      type: 'textbook',
      sourceKind: 'textbook',
      eligibility: {
        pathEligible: false,
        reasons: expect.arrayContaining(['textbook-container-not-path-node']),
      },
    });
    expect(section).toMatchObject({
      type: 'textbook_section',
      sourceKind: 'textbook_section',
      renderTarget: '/course-content/runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01',
      sourceRefs: expect.arrayContaining([
        { kind: 'textbook', ref: 'dorf-modern-control-systems' },
        { kind: 'textbook_section', ref: 'dorf-modern-control-systems:ch10-sec01' },
      ]),
      pathSemantics: {
        type: 'textbook_section',
        displayName: '教材节',
        evidenceBehavior: 'explicit_access',
      },
      planningMetadata: {
        knowledgeCoverage: ['kn-root-locus'],
        abilityImpact: {
          controlModeling: expect.any(Number),
          parameterDesign: expect.any(Number),
        },
        estimatedTimeMinutes: 18,
        evidenceInstrumentation: ['textbook_section_open'],
      },
      eligibility: { pathEligible: true },
    });
    expect(registry.edges).toContainEqual(expect.objectContaining({
      fromNodeId: 'knowledge-card:kn-root-locus',
      toNodeId: 'textbook-section:dorf-modern-control-systems:ch10-sec01',
      kind: 'prerequisite',
    }));
  });

  it('exposes central governed path semantics for every accepted path node type', () => {
    const registry = buildResourceNodeRegistry({
      runtimeLessons: [{
        lessonId: 'unit-demo',
        title: '互动课',
        steps: [{
          id: 'step-1',
          title: '互动讲解',
          knowledgeNodeIds: ['kn-demo'],
          renderTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step-1',
        }],
        mediaResources: [{
          id: 'slides',
          title: '课件',
          kind: 'slides',
          url: 'https://example.test/unit-demo-slides.pdf',
        }],
      }],
      knowledgeCards: [{
        id: 'demo-card',
        title: '知识卡',
        sourceRef: 'kn-demo:card',
        renderTarget: '/knowledge/cards/demo-card',
        knowledgeNodeIds: ['kn-demo'],
      }],
      registeredResources: [{
        id: 'demo-quiz',
        label: '自适应练习',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/demo-quiz',
        knowledgeNodeIds: ['kn-demo'],
      }],
      controlWorkbenchTasks: [{
        id: 'demo-workbench',
        title: '控制工作台任务',
        launchTarget: '/simulations/control-workbench?task=demo',
        knowledgeNodeIds: ['kn-demo'],
      }],
      simulations: [{
        id: 'demo-sim',
        title: '仿真实验',
        launchTarget: '/simulations/demo',
        knowledgeNodeIds: ['kn-demo'],
      }],
      arenaTasks: [{
        id: 'task-second-order-lead-pid',
        title: 'Arena 挑战',
        launchTarget: '/arena/challenges/task-second-order-lead-pid',
        knowledgeNodeIds: ['kn-demo'],
      }],
      externalResources: [{
        id: 'demo-paper',
        title: '外部资料',
        source: 'IEEE Control Systems',
        url: 'https://example.edu/control/paper',
        estimatedTimeMinutes: 12,
        knowledgeNodeIds: ['kn-demo'],
        applicableGoalId: 'goal-demo',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      }],
      reflectionPrompts: [{
        id: 'demo-reflection',
        title: '反思',
        renderTarget: '/profile/growth?prompt=demo',
        knowledgeNodeIds: ['kn-demo'],
      }],
      checkpoints: [{
        id: 'demo-checkpoint',
        title: '阶段检查',
        assessmentPurpose: '确认学生能解释当前路径的核心概念',
        criteria: ['说明关键概念', '给出例子'],
        requiredEvidenceRefs: ['learning_path.execution.completed'],
        remediationBehavior: 'retry-prerequisite-node',
        reviewState: 'pending',
        launchTarget: '/assessment/adaptive-practice?checkpoint=demo',
        knowledgeNodeIds: ['kn-demo'],
      }],
      konlingSupports: [{
        id: 'demo-konling',
        title: '控灵伴学',
        renderTarget: '/ai/copilot?context=demo',
        knowledgeNodeIds: ['kn-demo'],
      }],
      textbookSections: [{
        bookId: 'demo-book',
        sectionId: 'sec-1',
        title: '教材节',
        citationHref: '/course-content/runtime/resources/textbooks/demo-book/sections/sec-1',
        knowledgeNodeIds: ['kn-demo'],
        capabilityTargetIds: ['controlModeling'],
      }],
    });

    expect(GOVERNED_PATH_NODE_TYPES).toEqual([
      'interactive_lesson',
      'knowledge_card',
      'textbook_section',
      'slides',
      'adaptive_quiz',
      'control_workbench',
      'simulation',
      'arena_task',
      'external_resource',
      'reflection',
      'checkpoint',
      'konling',
    ]);
    expect(Object.keys(PATH_NODE_SEMANTICS).sort()).toEqual([...GOVERNED_PATH_NODE_TYPES].sort());
    expect(Object.values(PATH_NODE_SEMANTICS).every((semantics) =>
      semantics.displayName && semantics.iconKey && semantics.shapeHint && semantics.evidenceBehavior
    )).toBe(true);
    expect(new Set(registry.nodes.map((node) => node.pathSemantics.type))).toEqual(new Set(GOVERNED_PATH_NODE_TYPES));
    expect(registry.nodes.every((node) => node.pathSemantics.iconKey === PATH_NODE_SEMANTICS[node.pathSemantics.type].iconKey))
      .toBe(true);
    expect(registry.nodes.find((node) => node.id === 'checkpoint:demo-checkpoint')).toMatchObject({
      type: 'checkpoint',
      pathSemantics: {
        type: 'checkpoint',
        iconKey: 'checkpoint',
        shapeHint: 'gate',
      },
      checkpoint: {
        assessmentPurpose: '确认学生能解释当前路径的核心概念',
        criteria: ['说明关键概念', '给出例子'],
        requiredEvidenceRefs: ['learning_path.execution.completed'],
        remediationBehavior: 'retry-prerequisite-node',
        reviewState: 'pending',
      },
    });
    expect(registry.nodes.find((node) => node.id === 'runtime-media:unit-demo:slides')).toMatchObject({
      type: 'slides',
      pathSemantics: {
        type: 'slides',
        iconKey: 'slides',
        shapeHint: 'card',
        evidenceBehavior: 'explicit_access',
      },
    });
    expect(registry.nodes.find((node) => node.id === 'textbook-section:demo-book:sec-1')).toMatchObject({
      type: 'textbook_section',
      pathSemantics: {
        type: 'textbook_section',
        iconKey: 'textbook-section',
        shapeHint: 'card',
      },
    });
  });

  it('audits external resources before path eligibility and never invents missing targets', () => {
    const registry = buildResourceNodeRegistry({
      externalResources: [
        {
          id: 'complete',
          title: '完整外部资料',
          source: 'MIT OCW',
          url: 'https://ocw.mit.edu/control/lesson',
          estimatedTimeMinutes: 18,
          knowledgeNodeIds: ['kn-bode'],
          applicableGoalId: 'frequency-response-foundations',
          evidenceUseStatus: 'explicit-access-required',
          privacyPolicy: 'student-visible',
        },
        {
          id: 'unsafe',
          title: '不安全外部资料',
          source: '',
          url: 'javascript:alert(1)',
          estimatedTimeMinutes: -5,
          knowledgeNodeIds: [],
          applicableGoalId: '',
          evidenceUseStatus: 'reference-only',
          privacyPolicy: 'student-visible',
        },
        {
          id: 'override-coverage',
          title: '覆盖范围来自规划覆写',
          source: 'MIT OCW',
          url: 'https://ocw.mit.edu/control/override',
          estimatedTimeMinutes: 10,
          knowledgeNodeIds: [],
          applicableGoalId: 'frequency-response-foundations',
          evidenceUseStatus: 'explicit-access-required',
          privacyPolicy: 'student-visible',
          planningOverride: {
            knowledgeCoverage: ['kn-bode'],
          },
        },
      ],
    });

    expect(registry.nodes.find((node) => node.id === 'external-resource:complete')).toMatchObject({
      type: 'external_resource',
      launchTarget: 'https://ocw.mit.edu/control/lesson',
      pathSemantics: {
        type: 'external_resource',
        evidenceBehavior: 'explicit_access',
      },
      externalResource: {
        source: 'MIT OCW',
        applicableGoalId: 'frequency-response-foundations',
        evidenceUseStatus: 'explicit-access-required',
      },
      eligibility: { pathEligible: true },
    });
    expect(registry.nodes.find((node) => node.id === 'external-resource:unsafe')).toMatchObject({
      launchTarget: null,
      eligibility: {
        pathEligible: false,
        reasons: expect.arrayContaining([
          'unsafe-external-url',
          'missing-external-source',
          'missing-external-estimated-time',
          'missing-external-applicable-goal',
          'external-resource-reference-only',
          'missing-knowledge-mapping',
        ]),
      },
    });
    expect(JSON.stringify(registry.nodes.find((node) => node.id === 'external-resource:unsafe'))).not.toContain('javascript:');
    expect(registry.nodes.find((node) => node.id === 'external-resource:override-coverage')).toMatchObject({
      planningMetadata: {
        knowledgeCoverage: ['kn-bode'],
      },
      externalResource: {
        knowledgeCoverage: ['kn-bode'],
      },
      eligibility: { pathEligible: true },
    });
  });

  it('keeps runtime media and TeachingResource ownership separate when sources overlap', () => {
    const registry = sampleRegistry();
    const teachingVideo = registry.nodes.find((node) => node.id === 'teaching-resource:tr-video');
    const runtimeVideo = registry.nodes.find((node) =>
      node.id === 'runtime-media:unit-2-3-frequency-response-bode-intro:intro-video'
    );

    expect(teachingVideo).toMatchObject({
      renderTarget: '/interactive-learning/resources/tr-video',
    });
    expect(teachingVideo?.renderTarget).not.toBe('/api/resources/tr-video');
    expect(runtimeVideo).toMatchObject({
      type: 'video',
      sourceKind: 'runtime_lesson_media',
      sourceOfRecord: {
        content: 'runtime_lesson_media',
        catalogMetadata: 'TeachingResource',
        planningMetadata: 'ResourceNode',
      },
    });
    expect(runtimeVideo?.sourceRefs).toEqual([
      { kind: 'runtime_lesson_media', ref: 'unit-2-3-frequency-response-bode-intro:intro-video' },
      { kind: 'teaching_resource', ref: 'tr-video' },
    ]);
  });

  it('projects unified resource semantics without taking ownership of source content or catalog metadata', () => {
    const registry = sampleRegistry();
    const teachingQuiz = registry.nodes.find((node) => node.id === 'teaching-resource:tr-quiz') as ResourceNode;
    const textbookContainer = registry.nodes.find((node) =>
      node.id === 'textbook:dorf-modern-control-systems'
    ) as ResourceNode;
    const runtimeVideo = registry.nodes.find((node) =>
      node.id === 'runtime-media:unit-2-3-frequency-response-bode-intro:intro-video'
    ) as ResourceNode;

    const teachingQuizProjection = buildResourceSemanticProjection(teachingQuiz);
    const textbookContainerProjection = buildResourceSemanticProjection(textbookContainer);
    const projection = buildResourceSemanticProjection(runtimeVideo);

    expect(RESOURCE_SEMANTIC_SOURCE_OWNERSHIP.runtime_lesson_media).toMatchObject({
      contentOwner: 'runtime_lesson_media',
      catalogMetadataOwner: 'runtime_lesson_media',
    });
    expect(RESOURCE_SEMANTIC_SOURCE_OWNERSHIP.teaching_resource).toMatchObject({
      contentOwner: 'TeachingResource',
      catalogMetadataOwner: 'TeachingResource',
    });
    expect(RESOURCE_SEMANTIC_SOURCE_OWNERSHIP.grading_artifact).toMatchObject({
      contentOwner: 'grading',
      rawSubmissionOwner: 'grading',
    });
    expect(projection.resource).toMatchObject({
      id: 'resource:runtime-media:unit-2-3-frequency-response-bode-intro:intro-video',
      resourceNodeId: runtimeVideo.id,
      sourceOfRecord: {
        content: 'runtime_lesson_media',
        catalogMetadata: 'TeachingResource',
        planningMetadata: 'ResourceNode',
      },
      sourceRefs: [
        { kind: 'runtime_lesson_media', ref: 'unit-2-3-frequency-response-bode-intro:intro-video' },
        { kind: 'teaching_resource', ref: 'tr-video' },
      ],
    });
    expect(projection.resource).not.toHaveProperty('rawContent');
    expect(projection.resource).not.toHaveProperty('teacherEditableCatalogMetadata');
    expect(validateResourceSemanticProjection({
      ...projection.resource,
      rawContent: 'copied transcript',
      teacherEditableCatalogMetadata: { title: 'copied teacher title' },
    } as any)).toEqual([
      'rawContent',
      'teacherEditableCatalogMetadata',
    ]);
    expect(validateResourceSemanticProjection({
      sourceKind: 'runtime_lesson_media',
      segments: [{ rawContent: 'nested transcript' }],
      governance: { teacherEditableCatalogMetadata: { title: 'nested teacher title' } },
    } as any)).toEqual([
      'segments.0.rawContent',
      'governance.teacherEditableCatalogMetadata',
    ]);
    const handoutProjectionFindings = validateResourceSemanticProjection({
      ...projection,
      markdownBody: 'copied projection-level handout markdown',
      resource: {
        ...projection.resource,
        sourceKind: 'runtime_handout',
        markdownBody: 'copied handout markdown',
        pdfBytes: 'copied handout bytes',
      },
      segments: [{
        ...projection.segments[0],
        markdownBody: 'copied sibling handout markdown',
      }],
    } as any);
    expect(handoutProjectionFindings).toEqual(expect.arrayContaining([
      'markdownBody',
      'resource.markdownBody',
      'resource.pdfBytes',
      'segments.0.markdownBody',
    ]));
    expect(handoutProjectionFindings).toHaveLength(4);
    expect(validateResourceSemanticProjection({
      resource: {
        sourceKind: 'toString',
        markdownBody: 'ignored for unknown source kind',
      },
    } as any)).toEqual([]);
    expect(teachingQuizProjection.resource.sourceRefs).toEqual(expect.arrayContaining([
      { kind: 'teaching_resource', ref: 'tr-quiz' },
      { kind: 'resource_registry', ref: 'lesson12-bode-post-quiz' },
    ]));
    expect(teachingQuizProjection.segments[0].sourceRef).toEqual({ kind: 'teaching_resource', ref: 'tr-quiz' });
    expect(teachingQuizProjection.citationTargets[0].sourceRef).toEqual({ kind: 'teaching_resource', ref: 'tr-quiz' });
    expect(projection.resource.graphProfile).toMatchObject({
      versionRefs: {
        graphCatalogVersion: 'autocontrol-kaq-graph.v1',
        resourceRegistryVersion: 'resource-node-registry.v1',
        resourceProjectionVersion: 'resource-semantic-projection.v1',
      },
      graphNodeRefs: {
        knowledge: ['kn-bode'],
        capability: expect.any(Array),
        quality: [],
      },
      stableSegmentRefs: ['resource-segment:runtime-media:unit-2-3-frequency-response-bode-intro:intro-video:primary'],
      sceneAvailability: {
        path: { allowed: true, reason: null },
        konling: { allowed: true, reason: null },
        diagnosis: { allowed: true, reason: null },
      },
      citationReadiness: {
        status: 'missing-transcript-or-anchor',
        verified: false,
      },
      evidenceCapability: {
        terminalValidationRole: 'supporting',
      },
    });
    expect(projection.segments[0]).toMatchObject({
      kind: 'video',
      anchor: {
        kind: 'media',
      },
      graphNodeRefs: {
        knowledge: ['kn-bode'],
      },
      sceneAvailability: {
        konling: { allowed: true, reason: null },
      },
      citationReadiness: {
        status: 'missing-transcript-or-anchor',
        verified: false,
      },
      evidenceCapability: {
        terminalValidationRole: 'supporting',
      },
    });
    expect(textbookContainer.planningMetadata.terminalConstraints).toContain('container-resource');
    expect(textbookContainerProjection.resource.graphProfile.evidenceCapability).toMatchObject({
      instrumentationRefs: [],
      terminalValidationRole: 'none',
    });
    expect(validateResourceSemanticProjection({
      ...teachingQuizProjection,
      resource: {
        ...teachingQuizProjection.resource,
        defaultConfig: { copied: true },
      },
    } as any)).toEqual(['resource.defaultConfig']);
    expect(validateResourceSemanticProjection({
      segments: [{
        sourceRef: { kind: 'runtime_handout', ref: 'runtime-handout:lesson-1' },
        markdownBody: 'copied handout markdown',
      }],
    } as any)).toEqual(['segments.0.markdownBody']);
    const gradingArtifactResource: Resource = {
      id: 'resource:grading-artifact:essay-1',
      resourceNodeId: 'grading-artifact:essay-1',
      title: '作业批改证据',
      type: 'reflection',
      sourceKind: 'grading_artifact',
      sourceRefs: [{ kind: 'grading_artifact', ref: 'submission:essay-1' }],
      contentHash: null,
      knowledgeNodeIds: ['kn-bode'],
      capabilityTargetIds: ['inquiryReflection'],
      graphProfile: {
        versionRefs: buildKaqArtifactVersionRefs(),
        graphNodeRefs: {
          knowledge: ['kn-bode'],
          capability: ['inquiryReflection'],
          quality: [],
        },
        sceneAvailability: {
          path: { allowed: false, reason: 'not-path-audited' },
          konling: { allowed: false, reason: 'missing-target' },
          diagnosis: { allowed: false, reason: 'missing-target' },
          grading: { allowed: false, reason: 'missing-target' },
          'prep-pack': { allowed: false, reason: 'missing-target' },
          report: { allowed: false, reason: 'missing-target' },
        },
        stableSegmentRefs: [],
        citationReadiness: {
          status: 'missing-target',
          verified: false,
          limitations: ['missing-target'],
        },
        evidenceCapability: {
          instrumentationRefs: [],
          terminalValidationRole: 'none',
        },
        pathProfile: {
          estimatedTimeMinutes: 0,
          cognitiveLoad: 'low',
          effort: 'low',
          readiness: null,
        },
        governanceLimitations: [],
      },
      sourceOfRecord: {
        content: 'grading',
        catalogMetadata: 'grading',
        planningMetadata: 'ResourceNode',
      },
      projectionStatus: {
        retrieval: 'mapped',
        planning: 'blocked',
      },
      governance: {
        availability: 'teacher_only',
        teacherPolicy: 'teacher-only',
        privacyLevel: 'teacher-scoped',
        pathDisposition: null,
        auditIssueCodes: [],
      },
    };
    expect(validateResourceSemanticProjection({
      ...gradingArtifactResource,
      rawSubmission: 'student private answer',
    } as any)).toEqual(['rawSubmission']);
  });

  it('requires confirmed runtime projection sidecars before creating PlanningUnits', () => {
    const confirmedProjection = runtimeProjectionSidecar({
      id: 'runtime-step:unit-demo:step-1',
      resourceNodeId: 'lesson-step:unit-demo:step-1',
      title: '已审核步骤',
      sourceRef: 'unit-demo:step-1',
      sourceRecord: 'unit-demo:step-1',
      sourceHash: 'sha256:step-manifest',
      sourceVersionRef: 'interactive-manifest.v2',
      routeTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step-1',
      graphNodeRefs: {
        knowledge: ['kn-demo'],
        capability: ['controlModeling'],
        quality: [],
      },
      readiness: {
        minimumCompetency: {
          controlModeling: 0.2,
        },
        minimumEvidenceCount: 1,
        requiredCompletedNodeIds: [],
        requiredOutcomeRefs: [],
        unlockMessage: '完成本单元前序学习证据后进入该步骤。',
        fallbackNodeIds: [],
      },
      evidenceContract: {
        eventSource: true,
        eventType: true,
        clientEventIdPolicy: true,
        attemptKey: true,
        sourceLogId: true,
        dedupeKey: true,
        timestamps: true,
        learningFactPolicy: true,
        learningFactMaterializationPolicy: 'materialized-learning-fact',
        confidencePolicy: true,
        privacyScope: true,
        complete: true,
        missingFields: [],
      },
      reviewAudit: {
        status: 'human-confirmed',
        reviewerId: 'teacher-1',
        reviewerRole: 'teacher',
        reviewedAt: '2026-06-22T00:00:00.000Z',
        reviewBatchId: 'runtime-projection-batch-1',
        reviewedSourceHash: 'sha256:step-manifest-plus-overlay',
        reviewedVersionRef: 'interactive-manifest.v2',
        generationToolOrModel: 'template',
        promptOrManifestHash: 'sha256:step-manifest-plus-overlay',
        confidence: 0.92,
        staleInvalidationRule: 'stale when source hash or version changes',
      },
    });
    const provisionalProjection = runtimeProjectionSidecar({
      id: 'runtime-step:unit-demo:step-2',
      resourceNodeId: 'lesson-step:unit-demo:step-2',
      title: '临时步骤',
      sourceRef: 'unit-demo:step-2',
      sourceRecord: 'unit-demo:step-2',
      sourceHash: 'sha256:step-2',
      sourceVersionRef: 'interactive-manifest.v2',
      routeTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step-2',
      graphNodeRefs: {
        knowledge: ['kn-demo'],
        capability: ['controlModeling'],
        quality: [],
      },
      reviewAudit: {
        status: 'generated-provisional',
        reviewerId: null,
        reviewerRole: null,
        reviewedAt: null,
        reviewBatchId: null,
        reviewedSourceHash: null,
        reviewedVersionRef: 'interactive-manifest.v2',
        generationToolOrModel: 'template',
        promptOrManifestHash: null,
        confidence: null,
        staleInvalidationRule: 'requires human review before path eligibility or mastery effect',
      },
    });
    const agentReviewedProjection = runtimeProjectionSidecar({
      ...confirmedProjection,
      id: 'runtime-step:unit-demo:step-agent-reviewed',
      resourceNodeId: 'lesson-step:unit-demo:step-agent-reviewed',
      sourceRef: 'unit-demo:step-agent-reviewed',
      sourceRecord: 'unit-demo:step-agent-reviewed',
      sourceHash: 'sha256:step-agent-reviewed',
      reviewAudit: {
        ...confirmedProjection.reviewAudit!,
        status: 'agent-reviewed',
        reviewerId: 'implementing-agent-882',
        reviewerRole: 'implementing-agent',
        reviewedSourceHash: 'sha256:step-agent-reviewed',
        promptOrManifestHash: null,
      },
    });
    const staleProjection = runtimeProjectionSidecar({
      id: 'runtime-step:unit-demo:step-3',
      resourceNodeId: 'lesson-step:unit-demo:step-3',
      title: '过期步骤',
      sourceRef: 'unit-demo:step-3',
      sourceRecord: 'unit-demo:step-3',
      sourceHash: 'sha256:new',
      sourceVersionRef: 'interactive-manifest.v2',
      routeTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step-3',
      graphNodeRefs: {
        knowledge: ['kn-demo'],
        capability: ['controlModeling'],
        quality: [],
      },
      reviewAudit: {
        status: 'human-confirmed',
        reviewerId: 'teacher-1',
        reviewerRole: 'teacher',
        reviewedAt: '2026-06-22T00:00:00.000Z',
        reviewBatchId: 'runtime-projection-batch-1',
        reviewedSourceHash: 'sha256:old',
        reviewedVersionRef: 'interactive-manifest.v2',
        generationToolOrModel: 'template',
        promptOrManifestHash: null,
        confidence: 0.92,
        staleInvalidationRule: 'stale when source hash or version changes',
      },
    });
    const missingCapabilityProjection = runtimeProjectionSidecar({
      id: 'runtime-step:unit-demo:step-4',
      resourceNodeId: 'lesson-step:unit-demo:step-4',
      title: '缺少能力映射的步骤',
      sourceRef: 'unit-demo:step-4',
      sourceRecord: 'unit-demo:step-4',
      sourceHash: 'sha256:step-4',
      sourceVersionRef: 'interactive-manifest.v2',
      routeTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step-4',
      graphNodeRefs: {
        knowledge: ['kn-demo'],
        capability: [],
        quality: [],
      },
      reviewAudit: {
        status: 'human-confirmed',
        reviewerId: 'teacher-1',
        reviewerRole: 'teacher',
        reviewedAt: '2026-06-22T00:00:00.000Z',
        reviewBatchId: 'runtime-projection-batch-1',
        reviewedSourceHash: 'sha256:step-4',
        reviewedVersionRef: 'interactive-manifest.v2',
        generationToolOrModel: 'template',
        promptOrManifestHash: null,
        confidence: 0.92,
        staleInvalidationRule: 'stale when source hash or version changes',
      },
    });
    const registry = buildResourceNodeRegistry({
      runtimeResourceProjections: [
        confirmedProjection,
        agentReviewedProjection,
        provisionalProjection,
        staleProjection,
        missingCapabilityProjection,
      ],
    });

    const confirmed = registry.nodes.find((node) => node.id === 'lesson-step:unit-demo:step-1') as ResourceNode;
    const agentReviewed = registry.nodes.find((node) => node.id === 'lesson-step:unit-demo:step-agent-reviewed') as ResourceNode;
    const provisional = registry.nodes.find((node) => node.id === 'lesson-step:unit-demo:step-2') as ResourceNode;
    const stale = registry.nodes.find((node) => node.id === 'lesson-step:unit-demo:step-3') as ResourceNode;
    const missingCapability = registry.nodes.find((node) => node.id === 'lesson-step:unit-demo:step-4') as ResourceNode;
    const confirmedSemanticProjection = buildResourceSemanticProjection(confirmed);
    const agentReviewedSemanticProjection = buildResourceSemanticProjection(agentReviewed);
    const provisionalSemanticProjection = buildResourceSemanticProjection(provisional);
    const staleSemanticProjection = buildResourceSemanticProjection(stale);
    const missingCapabilitySemanticProjection = buildResourceSemanticProjection(missingCapability);

    expect(confirmed.eligibility.pathEligible).toBe(true);
    expect(agentReviewed.eligibility.pathEligible).toBe(false);
    expect(agentReviewedSemanticProjection.planningUnit).toBeNull();
    expect(agentReviewed.eligibility.auditIssues).toContainEqual(expect.objectContaining({
      code: 'provisional-runtime-projection',
      severity: 'blocking',
    }));
    expect(provisional.eligibility.pathEligible).toBe(false);
    expect(provisional.eligibility.auditIssues).toContainEqual(expect.objectContaining({
      code: 'provisional-runtime-projection',
      severity: 'blocking',
    }));
    expect(stale.eligibility.pathEligible).toBe(false);
    expect(stale.eligibility.auditIssues).toContainEqual(expect.objectContaining({
      code: 'stale-runtime-projection',
      severity: 'blocking',
    }));
    expect(missingCapability.planningMetadata.abilityImpact).toEqual({});
    expect(missingCapability.eligibility.pathEligible).toBe(false);
    expect(missingCapability.eligibility.auditIssues).toContainEqual(expect.objectContaining({
      code: 'missing-capability-mapping',
      severity: 'blocking',
    }));
    expect(confirmedSemanticProjection.planningUnit).toMatchObject({
      id: 'planning-unit:lesson-step:unit-demo:step-1',
      target: '/interactive-learning/courses/unit-demo/student/demo?step=step-1',
      knowledgeCoverage: ['kn-demo'],
      graphNodeRefs: {
        capability: ['controlModeling'],
      },
      readiness: {
        minimumCompetency: {
          controlModeling: 0.2,
        },
        minimumEvidenceCount: 1,
        unlockMessage: '完成本单元前序学习证据后进入该步骤。',
      },
    });
    expect(confirmedSemanticProjection.resource.contentHash).toBe('sha256:step-manifest');
    expect(provisionalSemanticProjection.planningUnit).toBeNull();
    expect(provisionalSemanticProjection.resource.governance.auditIssueCodes).toContain('provisional-runtime-projection');
    expect(staleSemanticProjection.planningUnit).toBeNull();
    expect(staleSemanticProjection.resource.governance.auditIssueCodes).toContain('stale-runtime-projection');
    expect(missingCapabilitySemanticProjection.planningUnit).toBeNull();
    expect(missingCapabilitySemanticProjection.resource.governance.auditIssueCodes).toContain('missing-capability-mapping');
  });

  it('keeps path-execution-only knowledge-card projection evidence contracts complete', () => {
    const registry = buildResourceNodeRegistry({
      runtimeResourceProjections: [
        runtimeProjectionSidecar({
          id: 'knowledge-card:feedback-loop',
          resourceNodeId: 'knowledge-card:feedback-loop',
          title: 'Feedback loop card',
          resourceType: 'knowledge_card',
          sourceKind: 'knowledge_graph',
          sourceRef: 'feedback-loop',
          sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/feedback-loop.md',
          sourceRecord: 'feedback-loop',
          sourceHash: 'sha256:feedback-loop',
          sourceVersionRef: 'runtime-knowledge-card.v1',
          projectionLevel: 'ResourceNode',
          routeTarget: '/knowledge?node=feedback-loop',
          graphNodeRefs: {
            knowledge: ['feedback-loop'],
            capability: ['controlModeling'],
            quality: [],
          },
          evidenceInstrumentation: ['knowledge_card_open'],
          evidenceContract: {
            eventSource: true,
            eventType: true,
            clientEventIdPolicy: true,
            attemptKey: true,
            sourceLogId: true,
            dedupeKey: true,
            timestamps: true,
            learningFactPolicy: false,
            learningFactMaterializationPolicy: 'path-execution-evidence-only',
            confidencePolicy: true,
            privacyScope: true,
            complete: true,
            missingFields: [],
          },
          reviewAudit: {
            status: 'human-confirmed',
            reviewerId: 'teacher-1',
            reviewerRole: 'teacher',
            reviewedAt: '2026-06-22T00:00:00.000Z',
            reviewBatchId: 'runtime-projection-batch-1',
            reviewedSourceHash: 'sha256:feedback-loop',
            reviewedVersionRef: 'runtime-knowledge-card.v1',
            generationToolOrModel: 'template',
            promptOrManifestHash: null,
            confidence: 0.9,
            staleInvalidationRule: 'stale when source hash or version changes',
          },
        }),
      ],
    });

    const node = registry.nodes.find((candidate) => candidate.id === 'knowledge-card:feedback-loop') as ResourceNode;
    expect(node.runtimeProjection?.evidenceContract).toMatchObject({
      complete: true,
      learningFactPolicy: false,
      learningFactMaterializationPolicy: 'path-execution-evidence-only',
      missingFields: [],
    });
    expect(node.eligibility.auditIssues).not.toContainEqual(expect.objectContaining({
      code: 'missing-runtime-projection-evidence-contract',
    }));
    expect(buildResourceSemanticProjection(node).resource.governance.auditIssueCodes)
      .not.toContain('missing-runtime-projection-evidence-contract');
  });

  it('requires runtime projection evidence contracts to declare LearningFact materialization policy', () => {
    const registry = buildResourceNodeRegistry({
      runtimeResourceProjections: [
        runtimeProjectionSidecar({
          id: 'runtime-step:unit-demo:legacy-policy',
          resourceNodeId: 'lesson-step:unit-demo:legacy-policy',
          title: 'Legacy policy step',
          sourceRef: 'unit-demo:legacy-policy',
          sourceRecord: 'unit-demo:legacy-policy',
          sourceHash: 'sha256:legacy-policy',
          sourceVersionRef: 'runtime-step.v1',
          projectionLevel: 'ResourceNode',
          routeTarget: '/interactive-learning/courses/unit-demo/student/demo?step=legacy-policy',
          graphNodeRefs: {
            knowledge: ['kn-demo'],
            capability: ['controlModeling'],
            quality: [],
          },
          evidenceInstrumentation: ['resource_completed'],
          evidenceContract: {
            eventSource: true,
            eventType: true,
            clientEventIdPolicy: true,
            attemptKey: true,
            sourceLogId: true,
            dedupeKey: true,
            timestamps: true,
            learningFactPolicy: true,
            confidencePolicy: true,
            privacyScope: true,
            complete: true,
            missingFields: [],
          },
          reviewAudit: {
            status: 'human-confirmed',
            reviewerId: 'teacher-1',
            reviewerRole: 'teacher',
            reviewedAt: '2026-06-22T00:00:00.000Z',
            reviewBatchId: 'runtime-projection-batch-1',
            reviewedSourceHash: 'sha256:legacy-policy',
            reviewedVersionRef: 'runtime-step.v1',
            generationToolOrModel: 'template',
            promptOrManifestHash: null,
            confidence: 0.9,
            staleInvalidationRule: 'stale when source hash or version changes',
          },
        }),
      ],
    });

    const node = registry.nodes.find((candidate) => candidate.id === 'lesson-step:unit-demo:legacy-policy') as ResourceNode;
    expect(node.runtimeProjection?.evidenceContract).toMatchObject({
      complete: false,
      missingFields: ['learningFactMaterializationPolicy'],
    });
    expect(node.eligibility.auditIssues).toContainEqual(expect.objectContaining({
      code: 'missing-runtime-projection-evidence-contract',
      severity: 'blocking',
    }));
    expect(buildResourceSemanticProjection(node).resource.governance.auditIssueCodes)
      .toContain('missing-runtime-projection-evidence-contract');
  });

  it('blocks sidecar-backed PlanningUnits when the projection has no verified route target', () => {
    const registry = buildResourceNodeRegistry({
      runtimeResourceProjections: [
        runtimeProjectionSidecar({
          id: 'runtime-step:unit-demo:no-route',
          resourceNodeId: 'lesson-step:unit-demo:no-route',
          title: '缺少真实路由的步骤',
          sourceRef: 'unit-demo:no-route',
          sourceRecord: 'unit-demo:no-route',
          routeTarget: null,
          renderTarget: 'course-content/runtime/lessons/unit-demo/interactive-manifest.json',
        }),
        runtimeProjectionSidecar({
          id: 'runtime-step:unit-demo:planning-no-route',
          resourceNodeId: 'lesson-step:unit-demo:planning-no-route',
          title: '缺少真实路由的规划步骤',
          sourceRef: 'unit-demo:planning-no-route',
          sourceRecord: 'unit-demo:planning-no-route',
          projectionLevel: 'PlanningUnit',
          routeTarget: null,
          renderTarget: 'course-content/runtime/lessons/unit-demo/interactive-manifest.json',
        }),
      ],
    });
    const node = registry.nodes.find((item) => item.id === 'lesson-step:unit-demo:no-route') as ResourceNode;
    const planningNode = registry.nodes.find((item) => item.id === 'lesson-step:unit-demo:planning-no-route') as ResourceNode;
    const projection = buildResourceSemanticProjection(node);
    const planningProjection = buildResourceSemanticProjection(planningNode);

    expect(node.renderTarget).toBeNull();
    expect(node.launchTarget).toBeNull();
    expect(node.eligibility.pathEligible).toBe(false);
    expect(node.eligibility.auditIssues).toContainEqual(expect.objectContaining({
      code: 'missing-runtime-projection-route-target',
      severity: 'blocking',
    }));
    expect(projection.planningUnit).toBeNull();
    expect(projection.resource.governance.auditIssueCodes).toEqual(expect.arrayContaining([
      'missing-render-or-launch-target',
      'missing-runtime-projection-route-target',
    ]));
    expect(planningNode.renderTarget).toBeNull();
    expect(planningNode.launchTarget).toBeNull();
    expect(planningNode.eligibility.auditIssues).toContainEqual(expect.objectContaining({
      code: 'missing-runtime-projection-route-target',
      severity: 'blocking',
    }));
    expect(planningProjection.planningUnit).toBeNull();
  });

  it('attaches ResourceSegment runtime sidecars to existing runtime resources as planning blockers', () => {
    const registry = buildResourceNodeRegistry({
      runtimeLessons: [
        {
          lessonId: 'unit-demo',
          title: '示例单元',
          knowledgeNodeIds: ['kn-demo'],
          handoutPath: 'course-content/runtime/lessons/unit-demo/handout.md',
          mediaResources: [
            {
              id: 'figure.png',
              title: '示例图片',
              kind: 'other',
              url: 'course-content/runtime/lessons/unit-demo/figure.png',
            },
          ],
        },
      ],
      runtimeResourceProjections: [
        runtimeProjectionSidecar({
          id: 'runtime-handout:unit-demo',
          resourceNodeId: 'runtime-handout:unit-demo',
          title: '示例单元讲义',
          resourceType: 'handout',
          sourceKind: 'runtime_handout',
          sourceRef: 'unit-demo',
          sourceRecord: 'unit-demo',
          projectionLevel: 'ResourceSegment',
          routeTarget: null,
          graphNodeRefs: {
            knowledge: ['kn-demo'],
            capability: ['controlModeling'],
            quality: [],
          },
          reviewAudit: {
            status: 'generated-provisional',
            reviewerId: null,
            reviewerRole: null,
            reviewedAt: null,
            reviewBatchId: null,
            reviewedSourceHash: null,
            reviewedVersionRef: 'interactive-manifest.v2',
            generationToolOrModel: 'template',
            promptOrManifestHash: null,
            confidence: null,
            staleInvalidationRule: 'requires human review before path eligibility or mastery effect',
          },
        }),
        runtimeProjectionSidecar({
          id: 'runtime-media:unit-demo:figure.png',
          resourceNodeId: 'runtime-media:unit-demo:figure.png',
          title: '示例图片',
          resourceType: 'image',
          sourceKind: 'runtime_lesson_media',
          sourceRef: 'unit-demo:figure.png',
          sourceRecord: 'unit-demo:figure.png',
          projectionLevel: 'ResourceSegment',
          routeTarget: null,
          sourcePathOrUrl: 'course-content/runtime/lessons/unit-demo/figure.png',
          graphNodeRefs: {
            knowledge: ['kn-demo'],
            capability: [],
            quality: [],
          },
          reviewAudit: {
            status: 'generated-provisional',
            reviewerId: null,
            reviewerRole: null,
            reviewedAt: null,
            reviewBatchId: null,
            reviewedSourceHash: null,
            reviewedVersionRef: 'interactive-manifest.v2',
            generationToolOrModel: 'template',
            promptOrManifestHash: null,
            confidence: null,
            staleInvalidationRule: 'requires human review before path eligibility or mastery effect',
          },
        }),
      ],
    });
    const node = registry.nodes.find((item) => item.id === 'runtime-handout:unit-demo') as ResourceNode;
    const imageMediaNode = registry.nodes.find((item) => item.id === 'runtime-media:unit-demo:figure.png') as ResourceNode;
    const projection = buildResourceSemanticProjection(node);
    const imageMediaProjection = buildResourceSemanticProjection(imageMediaNode);

    expect(node.runtimeProjection?.projectionLevel).toBe('ResourceSegment');
    expect(node.eligibility.pathEligible).toBe(false);
    expect(node.eligibility.auditIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'runtime-projection-not-path-resource' }),
      expect.objectContaining({ code: 'provisional-runtime-projection' }),
    ]));
    expect(projection.planningUnit).toBeNull();
    expect(projection.resource.governance.auditIssueCodes).toEqual(expect.arrayContaining([
      'runtime-projection-not-path-resource',
      'provisional-runtime-projection',
    ]));
    expect(imageMediaNode.type).toBe('handout');
    expect(imageMediaNode.runtimeProjection?.projectionLevel).toBe('ResourceSegment');
    expect(imageMediaNode.planningMetadata.abilityImpact).toEqual({});
    expect(imageMediaNode.eligibility.pathEligible).toBe(false);
    expect(imageMediaNode.eligibility.auditIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'runtime-projection-not-path-resource' }),
      expect.objectContaining({ code: 'missing-capability-mapping' }),
      expect.objectContaining({ code: 'provisional-runtime-projection' }),
    ]));
    expect(imageMediaProjection.planningUnit).toBeNull();
    expect(imageMediaProjection.resource.capabilityTargetIds).toEqual([]);
    expect(imageMediaProjection.resource.graphProfile.graphNodeRefs.capability).toEqual([]);
    expect(imageMediaProjection.resource.governance.auditIssueCodes).toEqual(expect.arrayContaining([
      'runtime-projection-not-path-resource',
      'missing-capability-mapping',
      'provisional-runtime-projection',
    ]));
  });

  it('keeps ResourceSegment sidecar render targets without treating them as launch targets', () => {
    const registry = buildResourceNodeRegistry({
      runtimeResourceProjections: [
        runtimeProjectionSidecar({
          id: 'infograph:kn-demo',
          resourceNodeId: null,
          title: '知识图谱信息图',
          resourceType: 'image',
          sourceKind: 'knowledge_graph',
          sourceRef: 'kn-demo',
          sourceRecord: 'kn-demo',
          projectionLevel: 'ResourceSegment',
          routeTarget: null,
          renderTarget: '/course-runtime/knowledge/infographs/nodes/kn-demo.png',
          sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
          graphNodeRefs: {
            knowledge: ['kn-demo'],
            capability: ['controlModeling'],
            quality: [],
          },
          reviewAudit: {
            status: 'generated-provisional',
            reviewerId: null,
            reviewerRole: null,
            reviewedAt: null,
            reviewBatchId: null,
            reviewedSourceHash: null,
            reviewedVersionRef: 'knowledge-infograph-manifest.v1',
            generationToolOrModel: 'template',
            promptOrManifestHash: null,
            confidence: null,
            staleInvalidationRule: 'requires human review before path eligibility or mastery effect',
          },
        }),
      ],
    });
    const node = registry.nodes.find((item) => item.id === 'infograph:kn-demo') as ResourceNode;
    const projection = buildResourceSemanticProjection(node);

    expect(node.renderTarget).toBe('/course-runtime/knowledge/infographs/nodes/kn-demo.png');
    expect(node.launchTarget).toBeNull();
    expect(node.eligibility.auditIssues).not.toContainEqual(expect.objectContaining({
      code: 'missing-render-or-launch-target',
    }));
    expect(node.eligibility.auditIssues).toContainEqual(expect.objectContaining({
      code: 'runtime-projection-not-path-resource',
      severity: 'blocking',
    }));
    expect(projection.planningUnit).toBeNull();
    expect(projection.citationTargets).toContainEqual(expect.objectContaining({
      target: '/course-runtime/knowledge/infographs/nodes/kn-demo.png',
      status: 'resolvable',
    }));
  });

  it('maps path-eligible ResourceNodes into PlanningUnits through audited planning metadata', () => {
    const registry = sampleRegistry();
    const arenaTask = registry.nodes.find((node) => node.id === 'arena-task:task-second-order-lead-pid') as ResourceNode;
    const brokenExternal = buildResourceNodeRegistry({
      externalResources: [
        {
          id: 'missing-citation',
          title: '缺失引用地址',
          source: 'External',
          estimatedTimeMinutes: 10,
          knowledgeNodeIds: ['kn-bode'],
          applicableGoalId: 'frequency-response-foundations',
          evidenceUseStatus: 'explicit-access-required',
          privacyPolicy: 'student-visible',
        },
      ],
    }).nodes[0];
    const lockedSimulation = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'terminal-sim',
          title: '终端仿真',
          launchTarget: '/simulations/terminal',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: {
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['simulation_run'],
          },
        },
      ],
    }).nodes[0];
    const auditBlockedRegistry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'audit-blocked-resource',
          label: '缺少能力映射的路径资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/audit-blocked-resource',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: {
            abilityImpact: {},
            evidenceInstrumentation: ['resource_interaction'],
          },
        },
        {
          id: 'audit-blocked-evidence-resource',
          label: '缺少证据配置的路径资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/audit-blocked-evidence-resource',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: {
            evidenceInstrumentation: [],
          },
        },
      ],
      knowledgeNodes: [
        { id: 'kn-bode', name: '伯德图' },
      ],
    });
    const auditBlockedResource = auditBlockedRegistry.nodes
      .find((node) => node.id === 'registry:audit-blocked-resource') as ResourceNode;
    const auditBlockedEvidenceResource = auditBlockedRegistry.nodes
      .find((node) => node.id === 'registry:audit-blocked-evidence-resource') as ResourceNode;

    const projection = buildResourceSemanticProjection(arenaTask);
    const brokenProjection = buildResourceSemanticProjection(brokenExternal);
    const lockedProjection = buildResourceSemanticProjection(lockedSimulation);
    const auditBlockedProjection = buildResourceSemanticProjection(auditBlockedResource);
    const auditBlockedEvidenceProjection = buildResourceSemanticProjection(auditBlockedEvidenceResource);

    expect(projection.planningUnit).toMatchObject({
      id: 'planning-unit:arena-task:task-second-order-lead-pid',
      resourceNodeId: 'arena-task:task-second-order-lead-pid',
      pathEligible: true,
      target: '/arena/challenges/task-second-order-lead-pid',
      prerequisites: ['simulation:cruise'],
      knowledgeCoverage: ['kn-bode'],
      estimatedTimeMinutes: 25,
      cognitiveLoad: 'high',
      effort: 'high',
      evidenceInstrumentation: ['arena_evaluation_complete'],
      launchBinding: {
        kind: 'resource-node',
        target: '/arena/challenges/task-second-order-lead-pid',
        sourceRef: { kind: 'arena_task', ref: 'task-second-order-lead-pid' },
      },
      privacyLevel: 'student-visible',
      teacherPolicy: 'allowed',
      graphNodeRefs: {
        knowledge: ['kn-bode'],
        capability: ['crossDomainTransfer', 'engineeringDecision', 'parameterDesign'],
        quality: [],
      },
      sceneAvailability: {
        path: { allowed: true, reason: null },
        grading: { allowed: true, reason: null },
      },
      evidenceCapability: {
        instrumentationRefs: ['arena_evaluation_complete'],
        terminalValidationRole: 'supporting',
      },
      pathProfile: {
        estimatedTimeMinutes: 25,
        cognitiveLoad: 'high',
        effort: 'high',
      },
      pathSemantics: {
        type: 'arena_task',
        evidenceBehavior: 'judged_submission',
      },
    });
    expect(projection.citationTargets).toContainEqual(expect.objectContaining({
      id: 'citation-target:arena-task:task-second-order-lead-pid:primary',
      resourceSegmentId: 'resource-segment:arena-task:task-second-order-lead-pid:primary',
      target: '/arena/challenges/task-second-order-lead-pid',
      status: 'resolvable',
    }));
    expect(projection.retrievalChunks).toContainEqual(expect.objectContaining({
      id: 'retrieval-chunk:arena-task:task-second-order-lead-pid:primary',
      resourceSegmentId: 'resource-segment:arena-task:task-second-order-lead-pid:primary',
      citationTargetId: 'citation-target:arena-task:task-second-order-lead-pid:primary',
      projectionStatus: 'not-indexed',
      pathEligibility: {
        eligible: false,
        reason: 'resource-node-planning-audit-required',
      },
    }));
    expect(brokenProjection.planningUnit).toBeNull();
    expect(brokenProjection.citationTargets).toContainEqual(expect.objectContaining({
      id: 'citation-target:external-resource:missing-citation:primary',
      status: 'missing-target',
    }));
    expect(brokenProjection.retrievalChunks).toContainEqual(expect.objectContaining({
      id: 'retrieval-chunk:external-resource:missing-citation:primary',
      citationTargetId: 'citation-target:external-resource:missing-citation:primary',
      projectionStatus: 'blocked',
    }));
    expect(lockedSimulation.eligibility).toMatchObject({
      pathEligible: true,
      reasons: expect.arrayContaining(['missing-readiness-metadata']),
    });
    expect(lockedProjection.planningUnit).toMatchObject({
      id: 'planning-unit:simulation:terminal-sim',
      resourceNodeId: 'simulation:terminal-sim',
      target: '/simulations/terminal',
      cognitiveLoad: 'high',
      readiness: null,
    });
    expect(lockedProjection.resource.projectionStatus).toMatchObject({
      retrieval: 'mapped',
      planning: 'mapped',
    });
    expect(auditBlockedResource.eligibility.pathEligible).toBe(true);
    expect(auditBlockedProjection.planningUnit).toBeNull();
    expect(auditBlockedProjection.resource).toMatchObject({
      capabilityTargetIds: [],
      projectionStatus: {
        retrieval: 'mapped',
        planning: 'blocked',
      },
      graphProfile: {
        sceneAvailability: {
          path: { allowed: false, reason: 'not-path-audited' },
        },
        governanceLimitations: expect.arrayContaining([
          expect.objectContaining({ code: 'missing-capability-mapping' }),
        ]),
      },
      governance: {
        auditIssueCodes: ['missing-capability-mapping'],
      },
    });
    expect(auditBlockedEvidenceResource.eligibility.pathEligible).toBe(true);
    expect(auditBlockedEvidenceProjection.planningUnit).toBeNull();
    expect(auditBlockedEvidenceProjection.resource).toMatchObject({
      projectionStatus: {
        retrieval: 'mapped',
        planning: 'blocked',
      },
      graphProfile: {
        sceneAvailability: {
          path: { allowed: false, reason: 'not-path-audited' },
        },
        governanceLimitations: expect.arrayContaining([
          expect.objectContaining({ code: 'missing-evidence-instrumentation' }),
        ]),
      },
      governance: {
        auditIssueCodes: ['missing-evidence-instrumentation'],
      },
    });
    expect(auditBlockedRegistry.audit.pathEligibleNodes).toBe(0);
    expect(auditBlockedRegistry.audit.ineligibleNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'registry:audit-blocked-resource',
        reasons: ['missing-capability-mapping'],
      }),
      expect.objectContaining({
        id: 'registry:audit-blocked-evidence-resource',
        reasons: ['missing-evidence-instrumentation'],
      }),
    ]));
  });

  it('validates and projects bounded media source manifests without path promotion', () => {
    const videoManifest: ResourceMediaSourceManifest = {
      sourceId: 'yong-wei/videos:bode-intro',
      sourcePath: 'yong-wei/videos/bode-intro.mp4',
      mediaType: 'video',
      sourceVersionRef: 'git:f1cf001',
      contentHash: 'sha256:video',
      privacyScope: 'student-visible',
      transcriptRef: 'transcripts/bode-intro.vtt',
      segments: [
        {
          id: 'intro-120-180',
          anchorRef: 'bode-intro@120-180',
          startSeconds: 120,
          endSeconds: 180,
          graphNodeRefs: {
            knowledge: ['kn-bode'],
            capability: ['frequencyResponseAnalysis'],
            quality: [],
          },
          sceneAvailability: {
            konling: { allowed: true, reason: null },
            report: { allowed: true, reason: null },
          },
          citationPolicy: 'verified-citation-required',
          aiUsePermission: 'allowed',
          evidenceInstrumentationRefs: ['media_segment_view'],
        },
      ],
    };

    expect(validateResourceMediaSourceManifest(videoManifest)).toEqual({
      verifiedCitationReady: true,
      issues: [],
    });
    expect(buildMediaSourceManifestSemanticProjection(videoManifest)).toMatchObject({
      resource: {
        id: 'media-source:yong-wei/videos:bode-intro',
        resourceNodeId: 'media-source:yong-wei/videos:bode-intro',
        type: 'video',
        contentHash: 'sha256:video',
        projectionStatus: {
          retrieval: 'mapped',
          planning: 'blocked',
        },
      graphProfile: {
        citationReadiness: {
          status: 'verified',
          verified: true,
        },
        stableSegmentRefs: ['media-segment:yong-wei/videos:bode-intro:intro-120-180'],
      },
        sourceRefs: expect.arrayContaining([
          { kind: 'media_source_manifest', ref: 'yong-wei/videos:bode-intro' },
          { kind: 'media_source_manifest', ref: 'version:git:f1cf001' },
        ]),
      },
      segments: [
        {
          id: 'media-segment:yong-wei/videos:bode-intro:intro-120-180',
          anchor: {
            kind: 'media',
            ref: 'bode-intro@120-180',
            startSeconds: 120,
            endSeconds: 180,
          },
          citationReadiness: {
            verified: true,
          },
          evidenceCapability: {
            instrumentationRefs: ['media_segment_view'],
            terminalValidationRole: 'supporting',
          },
        },
      ],
      citationTargets: [
        {
          id: 'media-citation-target:yong-wei/videos:bode-intro:intro-120-180',
          target: 'bode-intro@120-180',
          status: 'resolvable',
        },
      ],
      retrievalChunks: [
        {
          id: 'media-retrieval-chunk:yong-wei/videos:bode-intro:intro-120-180',
          projectionStatus: 'mapped',
          pathEligibility: {
            eligible: false,
            reason: 'resource-node-planning-audit-required',
          },
        },
      ],
      planningUnit: null,
    });

    expect(validateResourceMediaSourceManifest({
      sourceId: 'yong-wei/videos:bode-intro',
      sourcePath: 'yong-wei/videos/bode-intro.mp4',
      mediaType: 'video',
      privacyScope: 'student-visible',
      segments: [
        {
          id: 'intro',
          graphNodeRefs: {
            knowledge: ['kn-bode'],
            capability: [],
            quality: [],
          },
          sceneAvailability: {
            konling: { allowed: true, reason: null },
          },
          aiUsePermission: 'restricted',
        },
      ],
    })).toMatchObject({
      verifiedCitationReady: false,
      issues: expect.arrayContaining([
        'segments.0.missing-anchor',
        'segments.0.missing-citation-policy',
        'segments.0.missing-transcript-or-timecode-anchor',
      ]),
    });
  });

  it('validates audio slides and image manifests with segment-level limitations', () => {
    const audioProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'yong-wei/videos:pid-audio',
      sourcePath: 'yong-wei/videos/pid-audio.mp3',
      mediaType: 'audio',
      sourceVersionRef: 'git:audio',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/pid-audio.vtt',
      segments: [
        {
          id: 'pid-audio-main',
          anchorRef: 'pid-audio@0-45',
          startSeconds: 0,
          endSeconds: 45,
          graphNodeRefs: { knowledge: ['kn-pid'], capability: [], quality: [] },
          sceneAvailability: { konling: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    });
    expect(audioProjection.resource.type).toBe('audio');
    expect(audioProjection.resource.governance.privacyLevel).toBe('teacher-scoped');
    expect(audioProjection.resource.graphProfile.citationReadiness.status).toBe('resolvable');
    expect(audioProjection.planningUnit).toBeNull();

    const slidesProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/slides:root-locus',
      sourcePath: 'course-content/authoring/slides/root-locus.pdf',
      mediaType: 'slides',
      sourceVersionRef: 'slides.v1',
      privacyScope: 'student-visible',
      segments: [
        {
          id: 'slide-03',
          anchorRef: 'slide:3',
          page: 3,
          textRef: 'slides/root-locus/slide-03.md',
          graphNodeRefs: { knowledge: ['kn-root-locus'], capability: ['rootLocusSketch'], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'verified-citation-required',
          aiUsePermission: 'allowed',
        },
      ],
    });
    expect(slidesProjection.segments[0].anchor).toMatchObject({ kind: 'page', page: 3 });
    expect(slidesProjection.retrievalChunks[0].projectionStatus).toBe('mapped');

    const imageProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/images:bode-map',
      sourcePath: 'course-content/authoring/images/bode-map.png',
      mediaType: 'image',
      privacyScope: 'student-visible',
      segments: [
        {
          id: 'image',
          anchorRef: 'image:bode-map',
          graphNodeRefs: { knowledge: [], capability: [], quality: [] },
          sceneAvailability: {},
          citationPolicy: 'verified-citation-required',
          aiUsePermission: 'blocked',
        },
      ],
    });
    expect(imageProjection.resource.type).toBe('external_resource');
    expect(imageProjection.segments[0].kind).toBe('image');
    expect(imageProjection.resource.graphProfile.citationReadiness).toMatchObject({
      status: 'missing-transcript-or-anchor',
      verified: false,
      limitations: expect.arrayContaining([
        'segments.0.missing-description',
        'segments.0.missing-graph-bindings',
        'segments.0.missing-scene-availability',
        'segments.0.blocked-ai-use',
      ]),
    });
    expect(imageProjection.citationTargets[0].status).toBe('missing-target');
    expect(imageProjection.retrievalChunks[0].projectionStatus).toBe('blocked');
    expect(imageProjection.planningUnit).toBeNull();
  });

  it('blocks media projection when AI-use permission or safe source metadata is missing', () => {
    const missingAiUseProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/images:nyquist',
      sourcePath: 'course-content/authoring/images/nyquist.png',
      mediaType: 'image',
      sourceVersionRef: 'image.v1',
      privacyScope: 'student-visible',
      descriptionRef: 'images/nyquist.md',
      segments: [
        {
          id: 'image',
          anchorRef: 'image:nyquist',
          graphNodeRefs: { knowledge: ['kn-nyquist'], capability: [], quality: [] },
          sceneAvailability: { konling: { allowed: true, reason: null } },
          citationPolicy: 'verified-citation-required',
        },
      ],
    });

    expect(missingAiUseProjection.resource.graphProfile.citationReadiness).toMatchObject({
      verified: false,
      limitations: expect.arrayContaining(['segments.0.missing-ai-use-permission']),
    });
    expect(missingAiUseProjection.segments[0].sceneAvailability.konling).toEqual({
      allowed: false,
      reason: 'missing-ai-use-permission',
    });
    expect(missingAiUseProjection.citationTargets[0].status).toBe('missing-target');
    expect(missingAiUseProjection.retrievalChunks[0].projectionStatus).toBe('blocked');

    for (const sourcePath of [
      'file:///etc/passwd',
      'data:text/plain,hello',
      'C:/Windows/win.ini',
      '~/secret.mp4',
      '//cdn.example.com/video.mp4',
      'course-content\\authoring\\media\\video.mp4',
      'course-content/authoring/../secret.mp4',
    ]) {
      expect(validateResourceMediaSourceManifest({
        sourceId: `unsafe:${sourcePath}`,
        sourcePath,
        mediaType: 'video',
        sourceVersionRef: 'unsafe.v1',
        privacyScope: 'teacher-scoped',
        transcriptRef: 'transcripts/unsafe.vtt',
        segments: [
          {
            id: 'segment',
            anchorRef: 'segment',
            graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
            sceneAvailability: { report: { allowed: true, reason: null } },
            citationPolicy: 'source-reference-only',
            aiUsePermission: 'restricted',
          },
        ],
      }).issues).toContain('unsafe-source-path');
    }

    const freshnessProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/slides:freshness-only',
      sourcePath: 'course-content/authoring/slides/freshness-only.pdf',
      mediaType: 'slides',
      freshnessRef: 'checked:2026-06-22',
      privacyScope: 'student-visible',
      descriptionRef: 'slides/freshness-only.md',
      segments: [
        {
          id: 'slide-01',
          anchorRef: 'slide:1',
          page: 1,
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'verified-citation-required',
          aiUsePermission: 'allowed',
        },
      ],
    });
    expect(freshnessProjection.resource.sourceRefs).toEqual(expect.arrayContaining([
      { kind: 'media_source_manifest', ref: 'freshness:checked:2026-06-22' },
    ]));

    const restrictedSegmentProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:restricted-segment',
      sourcePath: 'course-content/authoring/videos/restricted-segment.mp4',
      mediaType: 'video',
      sourceVersionRef: 'restricted.v1',
      privacyScope: 'student-visible',
      transcriptRef: 'transcripts/restricted-segment.vtt',
      segments: [
        {
          id: 'teacher-only',
          anchorRef: 'teacher-only',
          privacyScope: 'teacher-scoped',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    });
    expect(restrictedSegmentProjection.resource.governance.privacyLevel).toBe('teacher-scoped');
    expect(restrictedSegmentProjection.segments[0].privacyScope).toBe('teacher-scoped');
    expect(restrictedSegmentProjection.citationTargets[0].privacyScope).toBe('teacher-scoped');
    expect(restrictedSegmentProjection.retrievalChunks[0].privacyScope).toBe('teacher-scoped');

    const segmentScopedValidation = validateResourceMediaSourceManifest({
      sourceId: 'authoring/video:segment-scoped',
      sourcePath: 'course-content/authoring/videos/segment-scoped.mp4',
      mediaType: 'video',
      sourceVersionRef: 'segment-scoped.v1',
      transcriptRef: 'transcripts/segment-scoped.vtt',
      segments: [
        {
          id: 'student-visible',
          anchorRef: 'student-visible',
          privacyScope: 'student-visible',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    });
    expect(segmentScopedValidation.issues).not.toContain('missing-privacy-scope');
    expect(segmentScopedValidation.issues).not.toContain('segments.0.missing-privacy-scope');

    const adminScopedSegmentProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:admin-scoped',
      sourcePath: 'course-content/authoring/videos/admin-scoped.mp4',
      mediaType: 'video',
      sourceVersionRef: 'admin-scoped.v1',
      transcriptRef: 'transcripts/admin-scoped.vtt',
      segments: [
        {
          id: 'admin-only',
          anchorRef: 'admin-only',
          privacyScope: 'admin-scoped',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: {
            konling: { allowed: true, reason: null },
            diagnosis: { allowed: true, reason: null },
            report: { allowed: true, reason: null },
          },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    });
    expect(adminScopedSegmentProjection.resource.governance.privacyLevel).toBe('admin-scoped');
    expect(adminScopedSegmentProjection.segments[0].sceneAvailability).toMatchObject({
      konling: { allowed: false, reason: 'admin-scoped-resource' },
      diagnosis: { allowed: false, reason: 'admin-scoped-resource' },
      report: { allowed: false, reason: 'admin-scoped-resource' },
    });

    const adminScopedManifestProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:admin-manifest',
      sourcePath: 'course-content/authoring/videos/admin-manifest.mp4',
      mediaType: 'video',
      sourceVersionRef: 'admin-manifest.v1',
      privacyScope: 'admin-scoped',
      transcriptRef: 'transcripts/admin-manifest.vtt',
      segments: [
        {
          id: 'student-declared',
          anchorRef: 'student-declared',
          privacyScope: 'student-visible',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: {
            konling: { allowed: true, reason: null },
            diagnosis: { allowed: true, reason: null },
            report: { allowed: true, reason: null },
          },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    });
    expect(adminScopedManifestProjection.resource.governance.privacyLevel).toBe('admin-scoped');
    expect(adminScopedManifestProjection.segments[0].privacyScope).toBe('admin-scoped');
    expect(adminScopedManifestProjection.segments[0].sceneAvailability).toMatchObject({
      konling: { allowed: false, reason: 'admin-scoped-resource' },
      diagnosis: { allowed: false, reason: 'admin-scoped-resource' },
      report: { allowed: false, reason: 'admin-scoped-resource' },
    });

    const adminMissingAiUseProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:admin-missing-ai-use',
      sourcePath: 'course-content/authoring/videos/admin-missing-ai-use.mp4',
      mediaType: 'video',
      sourceVersionRef: 'admin-missing-ai-use.v1',
      privacyScope: 'admin-scoped',
      transcriptRef: 'transcripts/admin-missing-ai-use.vtt',
      segments: [
        {
          id: 'admin-segment',
          anchorRef: 'admin-segment',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
        },
      ],
    });
    expect(adminMissingAiUseProjection.segments[0].sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'admin-scoped-resource',
    });

    const invalidPrivacyProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:invalid-privacy',
      sourcePath: 'course-content/authoring/videos/invalid-privacy.mp4',
      mediaType: 'video',
      sourceVersionRef: 'invalid-privacy.v1',
      transcriptRef: 'transcripts/invalid-privacy.vtt',
      segments: [
        {
          id: 'invalid',
          anchorRef: 'invalid',
          privacyScope: 'classroom-visible',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
        {
          id: 'student',
          anchorRef: 'student',
          privacyScope: 'student-visible',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    } as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);
    expect(invalidPrivacyProjection.segments.map((segment) => segment.privacyScope)).toEqual([
      'teacher-scoped',
      'student-visible',
    ]);
    expect(invalidPrivacyProjection.resource.governance.privacyLevel).toBe('teacher-scoped');
    expect(invalidPrivacyProjection.resource.governance.auditIssueCodes).toContain('segments.0.invalid-privacy-scope');
    expect(invalidPrivacyProjection.citationTargets[0].status).toBe('missing-target');
    expect(invalidPrivacyProjection.retrievalChunks[0].projectionStatus).toBe('blocked');
    expect(invalidPrivacyProjection.segments[0].sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'invalid-privacy-scope',
    });

    const blankPrivacyProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:blank-privacy',
      sourcePath: 'course-content/authoring/videos/blank-privacy.mp4',
      mediaType: 'video',
      sourceVersionRef: 'blank-privacy.v1',
      privacyScope: 'student-visible',
      transcriptRef: 'transcripts/blank-privacy.vtt',
      segments: [
        {
          id: 'blank-privacy',
          anchorRef: 'blank-privacy',
          privacyScope: '',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    } as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);
    expect(blankPrivacyProjection.resource.governance.auditIssueCodes).toContain(
      'segments.0.invalid-privacy-scope',
    );
    expect(blankPrivacyProjection.segments[0].privacyScope).toBe('teacher-scoped');
    expect(blankPrivacyProjection.citationTargets[0].status).toBe('missing-target');
    expect(blankPrivacyProjection.retrievalChunks[0].projectionStatus).toBe('blocked');
    expect(blankPrivacyProjection.segments[0].sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'invalid-privacy-scope',
    });

    const nonStringPrivacyProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:non-string-privacy',
      sourcePath: 'course-content/authoring/videos/non-string-privacy.mp4',
      mediaType: 'video',
      sourceVersionRef: 'non-string-privacy.v1',
      privacyScope: 'admin-scoped',
      transcriptRef: 'transcripts/non-string-privacy.vtt',
      segments: [
        {
          id: 'non-string-privacy',
          anchorRef: 'non-string-privacy',
          privacyScope: false,
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    } as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);
    expect(nonStringPrivacyProjection.resource.governance.auditIssueCodes).toContain(
      'segments.0.invalid-privacy-scope',
    );
    expect(nonStringPrivacyProjection.segments[0].privacyScope).toBe('admin-scoped');
    expect(nonStringPrivacyProjection.segments[0].sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'admin-scoped-resource',
    });

    expect(validateResourceMediaSourceManifest({
      sourceId: 'authoring/video:bad-source-path',
      sourcePath: { path: 'course-content/authoring/videos/bad.mp4' },
      mediaType: 'video',
      sourceVersionRef: 'bad-source-path.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/bad.vtt',
      segments: [
        {
          id: 'segment',
          anchorRef: 'segment',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    } as unknown as Parameters<typeof validateResourceMediaSourceManifest>[0]).issues).toContain('missing-source-path');

    const invalidPolicyProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:invalid-policy',
      sourcePath: 'course-content/authoring/videos/invalid-policy.mp4',
      mediaType: 'video',
      sourceVersionRef: 'invalid-policy.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/invalid-policy.vtt',
      segments: [
        {
          id: 'segment',
          anchorRef: 'segment',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'none',
          aiUsePermission: 'denied',
        },
      ],
    } as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);
    expect(invalidPolicyProjection.resource.governance.auditIssueCodes).toEqual(expect.arrayContaining([
      'segments.0.invalid-citation-policy',
      'segments.0.invalid-ai-use-permission',
    ]));
    expect(invalidPolicyProjection.segments[0].citationReadiness.limitations).toEqual(expect.arrayContaining([
      'invalid-citation-policy',
      'invalid-ai-use-permission',
    ]));
    expect(invalidPolicyProjection.citationTargets[0].status).toBe('missing-target');
    expect(invalidPolicyProjection.retrievalChunks[0].projectionStatus).toBe('blocked');
    expect(invalidPolicyProjection.segments[0].sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'invalid-ai-use-permission',
    });
    expect(invalidPolicyProjection.resource.graphProfile.sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'no-segment-available',
    });

    const duplicateSegmentProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:duplicate-segment',
      sourcePath: 'course-content/authoring/videos/duplicate-segment.mp4',
      mediaType: 'video',
      sourceVersionRef: 'duplicate-segment.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/duplicate-segment.vtt',
      segments: [
        {
          id: 'duplicate',
          anchorRef: 'duplicate-a',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
        {
          id: 'duplicate',
          anchorRef: 'duplicate-b',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
        {
          id: 'duplicate:0',
          anchorRef: 'duplicate-c',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
        {
          id: 'duplicate#duplicate:0',
          anchorRef: 'duplicate-d',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    });
    expect(duplicateSegmentProjection.resource.governance.auditIssueCodes).toEqual(expect.arrayContaining([
      'segments.0.duplicate-id',
      'segments.1.duplicate-id',
    ]));
    expect(new Set(duplicateSegmentProjection.segments.map((segment) => segment.id)).size).toBe(4);
    expect(new Set(duplicateSegmentProjection.citationTargets.map((target) => target.id)).size).toBe(4);
    expect(new Set(duplicateSegmentProjection.retrievalChunks.map((chunk) => chunk.id)).size).toBe(4);
    expect(duplicateSegmentProjection.segments[2].id).toBe(
      'media-segment:authoring/video:duplicate-segment:duplicate:0',
    );
    expect(duplicateSegmentProjection.segments[3].id).toBe(
      'media-segment:authoring/video:duplicate-segment:duplicate#duplicate:0',
    );
    expect(duplicateSegmentProjection.citationTargets.map((target) => target.status)).toEqual([
      'missing-target',
      'missing-target',
      'resolvable',
      'resolvable',
    ]);
    expect(duplicateSegmentProjection.retrievalChunks.map((chunk) => chunk.projectionStatus)).toEqual([
      'blocked',
      'blocked',
      'mapped',
      'mapped',
    ]);
    expect(duplicateSegmentProjection.segments[0].sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'invalid-segment-contract',
    });
    expect(duplicateSegmentProjection.segments[1].sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'invalid-segment-contract',
    });

    const missingIdCollisionProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:id-collision',
      sourcePath: 'course-content/authoring/videos/id-collision.mp4',
      mediaType: 'video',
      sourceVersionRef: 'id-collision.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/id-collision.vtt',
      segments: [
        {
          id: '',
          anchorRef: 'missing-id',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
        {
          id: 'segment:0',
          anchorRef: 'segment-zero',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    });
    expect(missingIdCollisionProjection.segments[1].id).toBe(
      'media-segment:authoring/video:id-collision:segment:0',
    );
    expect(new Set(missingIdCollisionProjection.segments.map((segment) => segment.id)).size).toBe(2);
    expect(missingIdCollisionProjection.segments[0].sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'invalid-segment-contract',
    });

    const blankSegmentIdProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:blank-segment-id',
      sourcePath: 'course-content/authoring/videos/blank-segment-id.mp4',
      mediaType: 'video',
      sourceVersionRef: 'blank-segment-id.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/blank-segment-id.vtt',
      segments: [
        {
          id: '   ',
          anchorRef: 'blank',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    });
    expect(blankSegmentIdProjection.resource.governance.auditIssueCodes).toContain('segments.0.missing-id');
    expect(blankSegmentIdProjection.citationTargets[0].status).toBe('missing-target');
    expect(blankSegmentIdProjection.retrievalChunks[0].projectionStatus).toBe('blocked');
    expect(blankSegmentIdProjection.segments[0].sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'invalid-segment-contract',
    });

    const invalidMediaTypeProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/media:invalid-type',
      sourcePath: 'course-content/authoring/media/invalid-type.pdf',
      mediaType: 'pdf',
      sourceVersionRef: 'invalid-type.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/invalid-type.vtt',
      segments: [
        {
          id: 'segment',
          anchorRef: 'segment',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    } as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);
    expect(invalidMediaTypeProjection.resource.governance.auditIssueCodes).toContain('invalid-media-type');
    expect(invalidMediaTypeProjection.resource.type).toBe('external_resource');
    expect(invalidMediaTypeProjection.segments[0].kind).toBe('image');
    expect(invalidMediaTypeProjection.citationTargets[0].status).toBe('missing-target');
    expect(invalidMediaTypeProjection.retrievalChunks[0].projectionStatus).toBe('blocked');
    expect(invalidMediaTypeProjection.segments[0].sceneAvailability.report).toEqual({
      allowed: false,
      reason: 'invalid-segment-contract',
    });

    const invalidVersionProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:invalid-version',
      sourcePath: 'course-content/authoring/videos/invalid-version.mp4',
      mediaType: 'video',
      sourceVersionRef: { sha: 'abc123' },
      freshnessRef: ['checked'],
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/invalid-version.vtt',
      segments: [
        {
          id: 'segment',
          anchorRef: 'segment',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    } as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);
    expect(invalidVersionProjection.resource.governance.auditIssueCodes).toContain(
      'missing-source-version-or-freshness',
    );
    expect(invalidVersionProjection.resource.sourceRefs).toEqual([
      { kind: 'media_source_manifest', ref: 'authoring/video:invalid-version' },
      { kind: 'media_source_manifest', ref: 'transcript:transcripts/invalid-version.vtt' },
    ]);
    expect(invalidVersionProjection.citationTargets[0].status).toBe('missing-target');
    expect(invalidVersionProjection.retrievalChunks[0].projectionStatus).toBe('blocked');

    const blankGraphRefProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:blank-graph-ref',
      sourcePath: 'course-content/authoring/videos/blank-graph-ref.mp4',
      mediaType: 'video',
      sourceVersionRef: 'blank-graph-ref.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/blank-graph-ref.vtt',
      segments: [
        {
          id: 'segment',
          anchorRef: 'segment',
          graphNodeRefs: { knowledge: ['', '   '], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    });
    expect(blankGraphRefProjection.resource.governance.auditIssueCodes).toContain(
      'segments.0.missing-graph-bindings',
    );
    expect(blankGraphRefProjection.segments[0].graphNodeRefs).toEqual({
      knowledge: [],
      capability: [],
      quality: [],
    });
    expect(blankGraphRefProjection.citationTargets[0].status).toBe('missing-target');
    expect(blankGraphRefProjection.retrievalChunks[0].projectionStatus).toBe('blocked');

    const malformedProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:malformed-empty-segments',
      sourcePath: 'course-content/authoring/videos/malformed.mp4',
      mediaType: 'video',
      sourceVersionRef: 'malformed.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/malformed-scene.vtt',
      segments: [],
    });

    expect(malformedProjection.resource.governance.auditIssueCodes).toContain('missing-segments');
    expect(malformedProjection.resource.projectionStatus).toMatchObject({
      retrieval: 'blocked',
      planning: 'blocked',
    });
    expect(malformedProjection.segments).toEqual([]);
    expect(malformedProjection.citationTargets).toEqual([]);
    expect(malformedProjection.retrievalChunks).toEqual([]);
    expect(malformedProjection.planningUnit).toBeNull();

    const malformedSegmentProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:malformed-segment',
      sourcePath: 'course-content/authoring/videos/malformed-segment.mp4',
      mediaType: 'video',
      sourceVersionRef: 'malformed-segment.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/malformed-segment.vtt',
      segments: [null, 'not-an-object'],
    } as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);
    expect(malformedSegmentProjection.resource.governance.auditIssueCodes).toEqual(expect.arrayContaining([
      'segments.0.invalid-segment',
      'segments.1.invalid-segment',
    ]));
    expect(malformedSegmentProjection.segments).toHaveLength(2);
    expect(malformedSegmentProjection.citationTargets.map((target) => target.status)).toEqual([
      'missing-target',
      'missing-target',
    ]);
    expect(malformedSegmentProjection.retrievalChunks.map((chunk) => chunk.projectionStatus)).toEqual([
      'blocked',
      'blocked',
    ]);

    const malformedGraphProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:malformed-graph',
      sourcePath: 'course-content/authoring/videos/malformed-graph.mp4',
      mediaType: 'video',
      sourceVersionRef: 'malformed-graph.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/malformed-graph.vtt',
      segments: [
        {
          id: 'segment',
          anchorRef: 'segment',
          graphNodeRefs: {
            knowledge: [],
            capability: [],
            quality: [],
          },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    } as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);
    expect(malformedGraphProjection.segments[0].graphNodeRefs).toEqual({
      knowledge: [],
      capability: [],
      quality: [],
    });
    expect(malformedGraphProjection.resource.governance.auditIssueCodes).toEqual(expect.arrayContaining([
      'segments.0.missing-graph-bindings',
    ]));

    const malformedSceneProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/video:malformed-scene-empty-availability',
      sourcePath: 'course-content/authoring/videos/malformed-scene.mp4',
      mediaType: 'video',
      sourceVersionRef: 'malformed-scene.v1',
      privacyScope: 'teacher-scoped',
      transcriptRef: 'transcripts/malformed.vtt',
      segments: [
        {
          id: 'segment',
          anchorRef: 'segment',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: {},
          citationPolicy: 'source-reference-only',
          aiUsePermission: 'restricted',
        },
      ],
    });

    expect(malformedSceneProjection.resource.governance.auditIssueCodes).toContain('segments.0.missing-scene-availability');
    expect(malformedSceneProjection.segments[0].sceneAvailability.konling).toEqual({
      allowed: false,
      reason: 'not-declared',
    });
    expect(malformedSceneProjection.segments[0].governanceLimitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-scene-availability' }),
    ]));

    expect(validateResourceSemanticProjection({
      sourceKind: 'media_source_manifest',
      rawMedia: 'base64',
      transcript: 'hidden transcript',
      descriptionBody: 'hidden description',
    })).toEqual(expect.arrayContaining(['rawMedia', 'transcript', 'descriptionBody']));
  });

  it('returns a blocked media projection for malformed segment lists', () => {
    const missingSegmentsProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/media:missing-segments',
      sourcePath: 'course-content/authoring/media/missing-segments.mp4',
      mediaType: 'video',
      sourceVersionRef: 'media.v1',
      privacyScope: 'teacher-scoped',
    } as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);

    expect(missingSegmentsProjection).toMatchObject({
      resource: {
        projectionStatus: {
          retrieval: 'blocked',
          planning: 'blocked',
        },
        graphProfile: {
          stableSegmentRefs: [],
          citationReadiness: {
            status: 'missing-transcript-or-anchor',
            verified: false,
            limitations: expect.arrayContaining(['missing-segments']),
          },
        },
        governance: {
          auditIssueCodes: expect.arrayContaining(['missing-segments']),
        },
      },
      segments: [],
      citationTargets: [],
      retrievalChunks: [],
      planningUnit: null,
    });

    const nonArraySegmentsProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/media:bad-segments',
      sourcePath: 'course-content/authoring/media/bad-segments.mp4',
      mediaType: 'video',
      sourceVersionRef: 'media.v1',
      privacyScope: 'teacher-scoped',
      segments: 'not-an-array',
    } as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);

    expect(nonArraySegmentsProjection.resource.governance.auditIssueCodes).toContain('missing-segments');
    expect(nonArraySegmentsProjection.retrievalChunks).toEqual([]);

    const missingSceneProjection = buildMediaSourceManifestSemanticProjection({
      sourceId: 'authoring/media:missing-scene',
      sourcePath: 'course-content/authoring/media/missing-scene.png',
      mediaType: 'image',
      sourceVersionRef: 'media.v1',
      privacyScope: 'student-visible',
      descriptionRef: 'media/missing-scene.md',
      segments: [
        {
          id: 'image',
          anchorRef: 'image:missing-scene',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          citationPolicy: 'verified-citation-required',
          aiUsePermission: 'allowed',
        },
      ],
    } as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0]);

    expect(missingSceneProjection.segments[0].citationReadiness.limitations).toContain('missing-scene-availability');
    expect(missingSceneProjection.segments[0].sceneAvailability.konling).toEqual({
      allowed: false,
      reason: 'not-declared',
    });
    expect(missingSceneProjection.resource.graphProfile.governanceLimitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'segments.0.missing-scene-availability' }),
    ]));

    for (const manifest of [
      {
        sourceId: 'authoring/media:image-start-seconds',
        sourcePath: 'course-content/authoring/media/image-start-seconds.png',
        mediaType: 'image',
        sourceVersionRef: 'media.v1',
        privacyScope: 'student-visible',
        descriptionRef: 'media/image-start-seconds.md',
        segments: [
          {
            id: 'image',
            startSeconds: 10,
            graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
            sceneAvailability: { report: { allowed: true, reason: null } },
            citationPolicy: 'verified-citation-required',
            aiUsePermission: 'allowed',
          },
        ],
      },
      {
        sourceId: 'authoring/media:slides-start-seconds',
        sourcePath: 'course-content/authoring/media/slides-start-seconds.pdf',
        mediaType: 'slides',
        sourceVersionRef: 'media.v1',
        privacyScope: 'student-visible',
        descriptionRef: 'media/slides-start-seconds.md',
        segments: [
          {
            id: 'slide',
            startSeconds: 10,
            textRef: 'media/slides-start-seconds.md',
            graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
            sceneAvailability: { report: { allowed: true, reason: null } },
            citationPolicy: 'verified-citation-required',
            aiUsePermission: 'allowed',
          },
        ],
      },
      {
        sourceId: 'authoring/media:slides-null-page',
        sourcePath: 'course-content/authoring/media/slides-null-page.pdf',
        mediaType: 'slides',
        sourceVersionRef: 'media.v1',
        privacyScope: 'student-visible',
        descriptionRef: 'media/slides-null-page.md',
        segments: [
          {
            id: 'slide',
            page: null,
            textRef: 'media/slides-null-page.md',
            graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
            sceneAvailability: { report: { allowed: true, reason: null } },
            citationPolicy: 'verified-citation-required',
            aiUsePermission: 'allowed',
          },
        ],
      },
      {
        sourceId: 'authoring/media:video-null-timecode',
        sourcePath: 'course-content/authoring/media/video-null-timecode.mp4',
        mediaType: 'video',
        sourceVersionRef: 'media.v1',
        privacyScope: 'student-visible',
        segments: [
          {
            id: 'video',
            startSeconds: null,
            graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
            sceneAvailability: { report: { allowed: true, reason: null } },
            citationPolicy: 'source-reference-only',
            aiUsePermission: 'allowed',
          },
        ],
      },
    ] as const) {
      const projection = buildMediaSourceManifestSemanticProjection(
        manifest as unknown as Parameters<typeof buildMediaSourceManifestSemanticProjection>[0],
      );
      expect(validateResourceMediaSourceManifest(
        manifest as unknown as Parameters<typeof validateResourceMediaSourceManifest>[0],
      ).issues).toContain('segments.0.missing-anchor');
      expect(projection.citationTargets[0].status).toBe('missing-target');
      expect(projection.retrievalChunks[0].projectionStatus).toBe('blocked');
    }

    expect(validateResourceMediaSourceManifest({
      sourceId: 'authoring/media:video-zero-timecode',
      sourcePath: 'course-content/authoring/media/video-zero-timecode.mp4',
      mediaType: 'video',
      sourceVersionRef: 'media.v1',
      privacyScope: 'student-visible',
      transcriptRef: 'media/video-zero-timecode.vtt',
      segments: [
        {
          id: 'video',
          startSeconds: 0,
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'verified-citation-required',
          aiUsePermission: 'allowed',
        },
      ],
    }).issues).toEqual([]);

    expect(validateResourceMediaSourceManifest({
      sourceId: 'authoring/media:slides-valid-page',
      sourcePath: 'course-content/authoring/media/slides-valid-page.pdf',
      mediaType: 'slides',
      sourceVersionRef: 'media.v1',
      privacyScope: 'student-visible',
      descriptionRef: 'media/slides-valid-page.md',
      segments: [
        {
          id: 'slide',
          page: 1,
          textRef: 'media/slides-valid-page.md',
          graphNodeRefs: { knowledge: ['kn'], capability: [], quality: [] },
          sceneAvailability: { report: { allowed: true, reason: null } },
          citationPolicy: 'verified-citation-required',
          aiUsePermission: 'allowed',
        },
      ],
    }).issues).toEqual([]);
  });

  it('blocks admin-scoped resources from learner-facing resource segment scenes', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'admin-only-diagnostic-source',
          label: '管理范围诊断源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/admin-only-diagnostic-source',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: {
            privacyLevel: 'admin-scoped',
          },
        },
      ],
      knowledgeNodes: [
        { id: 'kn-bode', name: '伯德图' },
      ],
    });
    const adminScopedResource = registry.nodes.find((node) =>
      node.id === 'registry:admin-only-diagnostic-source'
    ) as ResourceNode;
    const projection = buildResourceSemanticProjection(adminScopedResource);

    expect(projection.resource.graphProfile.sceneAvailability).toMatchObject({
      konling: { allowed: false, reason: 'admin-scoped-resource' },
      diagnosis: { allowed: false, reason: 'admin-scoped-resource' },
      grading: { allowed: false, reason: 'admin-scoped-resource' },
      'prep-pack': { allowed: false, reason: 'admin-scoped-resource' },
      report: { allowed: false, reason: 'admin-scoped-resource' },
    });
    expect(projection.resource.graphProfile.governanceLimitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'scene:diagnosis:admin-scoped-resource' }),
      expect.objectContaining({ code: 'scene:prep-pack:admin-scoped-resource' }),
    ]));
  });

  it('builds deterministic edges and payloads for unchanged source resources', () => {
    const first = sampleRegistry();
    const second = sampleRegistry();

    expect(first).toEqual(second);
    expect(first.edges).toEqual([
      {
        id: 'arena-task:task-second-order-lead-pid->project:bode-project:prerequisite',
        fromNodeId: 'arena-task:task-second-order-lead-pid',
        toNodeId: 'project:bode-project',
        kind: 'prerequisite',
        source: 'declared-prerequisite',
      },
      {
        id: 'simulation:cruise->arena-task:task-second-order-lead-pid:prerequisite',
        fromNodeId: 'simulation:cruise',
        toNodeId: 'arena-task:task-second-order-lead-pid',
        kind: 'prerequisite',
        source: 'declared-prerequisite',
      },
    ]);
  });

  it('marks incomplete resources as path-ineligible with teacher-facing reasons', () => {
    const registry = buildResourceNodeRegistry({
      teachingResources: [
        {
          id: 'broken',
          title: '缺失资源',
          type: 'STATIC_TEXT',
        },
      ],
    });

    expect(registry.audit.ineligibleNodes).toEqual([
      {
        id: 'teaching-resource:broken',
        title: '缺失资源',
        type: 'lesson_step',
        reasons: [
          'missing-knowledge-mapping',
          'missing-render-or-launch-target',
        ],
      },
    ]);
  });

  it('does not fabricate a launch route for registry-only components', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'lesson12-bode-post-quiz',
          label: '伯德图后测',
          type: 'INTERACTIVE_COMP',
          knowledgeNodeIds: ['kn-bode'],
        },
      ],
    });

    const node = registry.nodes[0];

    expect(node).toMatchObject({
      id: 'registry:lesson12-bode-post-quiz',
      renderTarget: null,
      launchTarget: null,
      eligibility: {
        pathEligible: false,
        reasons: ['missing-render-or-launch-target'],
      },
    });
    expect(JSON.stringify(node)).not.toContain('/interactive-learning/resources/lesson12-bode-post-quiz');
  });

  it('does not infer registry-only knowledge coverage from ids', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'lesson12-bode-post-quiz',
          label: '伯德图后测',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/teacher/resources',
        },
      ],
    });

    const node = registry.nodes[0];

    expect(node.planningMetadata.knowledgeCoverage).toEqual([]);
    expect(node.eligibility).toMatchObject({
      pathEligible: false,
      reasons: ['missing-knowledge-mapping'],
    });
  });

  it('does not fabricate routes for knowledge graph nodes or runtime lesson steps', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeNodes: [
        { id: 'kn-bode', name: '伯德图' },
      ],
      runtimeLessons: [
        {
          lessonId: 'unit-2-3-frequency-response-bode-intro',
          title: '频率响应入门',
          steps: [
            {
              id: 'step-01',
              title: '频域入口',
              knowledgeNodeIds: ['kn-bode'],
            },
          ],
        },
      ],
    });

    const knowledgeNode = registry.nodes.find((node) => node.id === 'knowledge-node:kn-bode');
    const knowledgeCard = registry.nodes.find((node) => node.id === 'knowledge-card:kn-bode');
    const lessonStep = registry.nodes.find(
      (node) => node.id === 'lesson-step:unit-2-3-frequency-response-bode-intro:step-01',
    );

    expect(knowledgeNode).toMatchObject({
      renderTarget: null,
      launchTarget: null,
      eligibility: {
        pathEligible: false,
        reasons: ['missing-render-or-launch-target'],
      },
    });
    expect(knowledgeCard).toMatchObject({
      renderTarget: null,
      launchTarget: null,
      eligibility: {
        pathEligible: false,
        reasons: ['missing-render-or-launch-target'],
      },
    });
    expect(lessonStep).toMatchObject({
      renderTarget: null,
      launchTarget: null,
      eligibility: {
        pathEligible: false,
        reasons: ['missing-render-or-launch-target'],
      },
    });
    expect(JSON.stringify(registry.nodes)).not.toContain('/knowledge?node=');
    expect(JSON.stringify(registry.nodes)).not.toContain('/knowledge?card=');
    expect(JSON.stringify(registry.nodes)).not.toContain('#step-01');
  });

  it('audits invalid prerequisites without hiding other metadata', () => {
    const registry = sampleRegistry();
    const project = registry.nodes.find((node) => node.id === 'project:bode-project') as ResourceNode;
    const eligibility = auditResourceNode({
      ...project,
      planningMetadata: {
        ...project.planningMetadata,
        prerequisites: ['missing-node'],
      },
    }, new Map(registry.nodes.map((node) => [node.id, node])));

    expect(eligibility.pathEligible).toBe(false);
    expect(eligibility.auditIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-prerequisite',
          message: expect.stringContaining('missing-node'),
        }),
      ]),
    );
  });

  it('does not expose graph edges that point to missing prerequisite nodes', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'cruise',
          title: '邮轮舒适度仿真',
          launchTarget: '/simulations/cruise',
          knowledgeNodeIds: ['kn-bode'],
          prerequisiteNodeIds: ['missing-node'],
        },
      ],
    });

    expect(registry.edges).toEqual([]);
    expect(registry.audit.ineligibleNodes).toEqual([
      {
        id: 'simulation:cruise',
        title: '邮轮舒适度仿真',
        type: 'simulation',
        reasons: ['invalid-prerequisite'],
      },
    ]);
  });
});
