import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  GOVERNED_PATH_NODE_TYPES,
  PATH_NODE_SEMANTICS,
  RESOURCE_NODE_TYPES,
  auditResourceNode,
  buildResourceSemanticProjection,
  buildResourceNodeRegistry,
  validateResourceSemanticProjection,
  RESOURCE_SEMANTIC_SOURCE_OWNERSHIP,
  type Resource,
  type ResourceNode,
} from '../resource-node-registry';
import { getRegisteredResourceMetadata } from '../resource-registry-metadata';
import {
  CONTROL_CORRECTION_RESOURCE_GRAPH_VERSION,
  buildControlCorrectionResourceNodeRegistry,
} from '../control-correction-resource-seed';

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
        ],
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
        id: 'roll-control',
        title: '横摇控制 Arena',
        launchTarget: '/arena/challenges/roll-control',
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
        prerequisiteNodeIds: ['arena-task:roll-control'],
      },
    ],
  });
}

describe('resource node registry', () => {
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
        id: 'demo-arena',
        title: 'Arena 挑战',
        launchTarget: '/arena/challenges/demo',
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
    });

    expect(GOVERNED_PATH_NODE_TYPES).toEqual([
      'interactive_lesson',
      'knowledge_card',
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
    const runtimeVideo = registry.nodes.find((node) =>
      node.id === 'runtime-media:unit-2-3-frequency-response-bode-intro:intro-video'
    ) as ResourceNode;

    const teachingQuizProjection = buildResourceSemanticProjection(teachingQuiz);
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
        auditIssueCodes: [],
      },
    };
    expect(validateResourceSemanticProjection({
      ...gradingArtifactResource,
      rawSubmission: 'student private answer',
    } as any)).toEqual(['rawSubmission']);
  });

  it('maps path-eligible ResourceNodes into PlanningUnits through audited planning metadata', () => {
    const registry = sampleRegistry();
    const arenaTask = registry.nodes.find((node) => node.id === 'arena-task:roll-control') as ResourceNode;
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
      id: 'planning-unit:arena-task:roll-control',
      resourceNodeId: 'arena-task:roll-control',
      pathEligible: true,
      target: '/arena/challenges/roll-control',
      prerequisites: ['simulation:cruise'],
      knowledgeCoverage: ['kn-bode'],
      evidenceInstrumentation: ['arena_evaluation_complete'],
      privacyLevel: 'student-visible',
      teacherPolicy: 'allowed',
      pathSemantics: {
        type: 'arena_task',
        evidenceBehavior: 'judged_submission',
      },
    });
    expect(projection.citationTargets).toContainEqual(expect.objectContaining({
      id: 'citation-target:arena-task:roll-control:primary',
      resourceSegmentId: 'resource-segment:arena-task:roll-control:primary',
      target: '/arena/challenges/roll-control',
      status: 'resolvable',
    }));
    expect(projection.retrievalChunks).toContainEqual(expect.objectContaining({
      id: 'retrieval-chunk:arena-task:roll-control:primary',
      resourceSegmentId: 'resource-segment:arena-task:roll-control:primary',
      citationTargetId: 'citation-target:arena-task:roll-control:primary',
      projectionStatus: 'not-indexed',
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
    expect(lockedProjection.planningUnit).toBeNull();
    expect(lockedProjection.resource.projectionStatus).toMatchObject({
      retrieval: 'mapped',
      planning: 'blocked',
    });
    expect(auditBlockedResource.eligibility.pathEligible).toBe(true);
    expect(auditBlockedProjection.planningUnit).toBeNull();
    expect(auditBlockedProjection.resource).toMatchObject({
      capabilityTargetIds: [],
      projectionStatus: {
        retrieval: 'mapped',
        planning: 'blocked',
      },
    });
    expect(auditBlockedEvidenceResource.eligibility.pathEligible).toBe(true);
    expect(auditBlockedEvidenceProjection.planningUnit).toBeNull();
    expect(auditBlockedEvidenceProjection.resource.projectionStatus).toMatchObject({
      retrieval: 'mapped',
      planning: 'blocked',
    });
  });

  it('builds deterministic edges and payloads for unchanged source resources', () => {
    const first = sampleRegistry();
    const second = sampleRegistry();

    expect(first).toEqual(second);
    expect(first.edges).toEqual([
      {
        id: 'arena-task:roll-control->project:bode-project:prerequisite',
        fromNodeId: 'arena-task:roll-control',
        toNodeId: 'project:bode-project',
        kind: 'prerequisite',
        source: 'declared-prerequisite',
      },
      {
        id: 'simulation:cruise->arena-task:roll-control:prerequisite',
        fromNodeId: 'simulation:cruise',
        toNodeId: 'arena-task:roll-control',
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
          'missing-render-or-launch-target',
          'missing-knowledge-mapping',
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
