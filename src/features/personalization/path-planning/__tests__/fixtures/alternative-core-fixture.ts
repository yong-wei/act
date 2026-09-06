import type { PortraitV2DimensionId } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  createPortraitV2Payload,
  projectPortraitV2ForConsumer,
} from '@/lib/data-governance/portrait-v2-model';
import {
  buildResourceNodeRegistry,
  type ResourceNodeRegistry,
} from '@/lib/resource-node-registry';
import type { AdaptiveLearningPathPlannerInput } from '@/features/personalization/path-planning/public-api';

/**
 * #2033 共享三族幸存 fixture：从 assemble-plan.test.ts 的 policy-bundle 多样性
 * 场景提取，供跨文件对照测试（单变量偏好/画像切换）复用。
 */

function withLegalSimulationDestinations(registry: ResourceNodeRegistry): ResourceNodeRegistry {
  return {
    ...registry,
    nodes: registry.nodes.map((node) => node.type === 'simulation' && node.launchTarget?.startsWith('/interactive-learning/courses/')
      ? {
          ...node,
          launchTarget: `/simulations/${node.sourceRef}`,
        }
      : node),
  };
}

function withLegalReflectionDestinations(registry: ResourceNodeRegistry): ResourceNodeRegistry {
  return {
    ...registry,
    nodes: registry.nodes.map((node) => node.type === 'reflection' && node.renderTarget?.startsWith('/profile/growth')
      ? {
          ...node,
          renderTarget: '/assessment/adaptive-practice',
        }
      : node),
  };
}

export function withLegalAdaptiveDestinations(registry: ResourceNodeRegistry): ResourceNodeRegistry {
  const normalized = withLegalReflectionDestinations(withLegalSimulationDestinations(registry));
  return {
    ...normalized,
    nodes: normalized.nodes.map((node) => {
      const target = node.launchTarget ?? node.renderTarget ?? '';
      if (node.type === 'ai_intervention' && node.renderTarget?.startsWith('/ai/')) {
        return { ...node, renderTarget: '/assessment/adaptive-practice', launchTarget: '/assessment/adaptive-practice' };
      }
      if (node.type === 'checkpoint' && node.launchTarget?.startsWith('/assessment/checkpoints/')) {
        return { ...node, launchTarget: '/assessment/adaptive-practice', renderTarget: '/assessment/adaptive-practice' };
      }
      if (node.type === 'adaptive_quiz' && target.startsWith('/interactive-learning/resources/')) {
        return { ...node, launchTarget: '/assessment/adaptive-practice', renderTarget: '/assessment/adaptive-practice' };
      }
      if (node.type === 'knowledge_card' && target.startsWith('/interactive-learning/resources/')) {
        return { ...node, launchTarget: '/knowledge', renderTarget: '/knowledge' };
      }
      return node;
    }),
  };
}

export function buildAlternativeCoreFixtureRegistry(): ResourceNodeRegistry {
  return buildResourceNodeRegistry({
    registeredResources: [
      {
        id: 'correction-precheck',
        label: '校正目标前测',
        type: 'ADAPTIVE_QUIZ',
        renderTarget: '/interactive-learning/resources/lesson09-correction-precheck',
        knowledgeNodeIds: ['control-correction:root-locus-design'],
        planningOverride: {
          estimatedTimeMinutes: 5,
          evidenceInstrumentation: ['answer_submit'],
          abilityImpact: { parameterDesign: 0.15 },
        },
      },
    ],
    knowledgeCards: [
      {
        id: 'core-card',
        title: '校正核心知识卡',
        sourceRef: 'correction-card',
        renderTarget: '/interactive-learning/resources/correction-card',
        knowledgeNodeIds: ['control-correction:time-domain-targets'],
        prerequisiteNodeIds: ['registry:correction-precheck'],
        planningOverride: {
          estimatedTimeMinutes: 24,
          cognitiveLoad: 'low',
          evidenceInstrumentation: ['knowledge_card_open'],
          abilityImpact: { controlModeling: 0.2, parameterDesign: 0.2 },
        },
      },
      {
        id: 'preference-card',
        title: '偏好匹配知识卡',
        sourceRef: 'preference-card',
        renderTarget: '/interactive-learning/resources/preference-card',
        knowledgeNodeIds: ['control-correction:time-domain-targets'],
        prerequisiteNodeIds: ['registry:correction-precheck'],
        planningOverride: {
          estimatedTimeMinutes: 24,
          cognitiveLoad: 'low',
          evidenceInstrumentation: ['knowledge_card_open'],
          abilityImpact: { controlModeling: 0.2, parameterDesign: 0.2 },
        },
      },
    ],
    textbookSections: [
      {
        bookId: 'dorf-modern-control-systems',
        sectionId: 'correction-textbook',
        title: '校正教材章节',
        citationHref: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/correction-textbook.md',
        knowledgeNodeIds: ['control-correction:time-domain-targets'],
        prerequisiteNodeIds: ['registry:correction-precheck'],
        estimatedTimeMinutes: 24,
        planningOverride: {
          cognitiveLoad: 'medium',
          evidenceInstrumentation: ['textbook_section_open'],
          abilityImpact: { controlModeling: 0.2, parameterDesign: 0.2 },
        },
      },
    ],
    simulations: [
      {
        id: 'correction-sim',
        title: '校正仿真验证',
        launchTarget: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11',
        knowledgeNodeIds: [
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
        ],
        prerequisiteNodeIds: ['registry:correction-precheck'],
        planningOverride: {
          estimatedTimeMinutes: 20,
          cognitiveLoad: 'high',
          terminalConstraints: ['transfer-validation'],
          evidenceInstrumentation: ['simulation_run'],
          abilityImpact: { parameterDesign: 0.35, engineeringDecision: 0.25 },
          readiness: {
            minimumCompetency: {},
            minimumEvidenceCount: 0,
            requiredCompletedNodeIds: ['registry:correction-precheck'],
            requiredOutcomeRefs: [],
            unlockMessage: '完成前测后进入仿真验证',
            fallbackNodeIds: ['registry:correction-precheck'],
          },
        },
      },
    ],
    arenaTasks: [
      {
        id: 'task-second-order-lead-pid',
        title: '校正 Arena',
        launchTarget: '/arena/challenges/task-second-order-lead-pid',
        knowledgeNodeIds: [
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        prerequisiteNodeIds: ['registry:correction-precheck'],
        official: true,
        planningOverride: {
          estimatedTimeMinutes: 18,
          cognitiveLoad: 'high',
          terminalConstraints: ['terminal-node', 'terminal-validation'],
          evidenceInstrumentation: ['arena_evaluation_complete'],
          abilityImpact: {
            parameterDesign: 0.35,
            engineeringDecision: 0.25,
            crossDomainTransfer: 0.2,
          },
          readiness: {
            minimumCompetency: {},
            minimumEvidenceCount: 0,
            requiredCompletedNodeIds: ['registry:correction-precheck'],
            requiredOutcomeRefs: [],
            unlockMessage: '完成前测后进入 Arena',
            fallbackNodeIds: ['registry:correction-precheck'],
          },
        },
      },
    ],
  });
}

export type PlannerPortraitScoreOverrides = Partial<Record<PortraitV2DimensionId, number>>;

export function buildPlannerPortrait(
  now: Date,
  userId: string,
  scoreOverrides: PlannerPortraitScoreOverrides = {},
) {
  return projectPortraitV2ForConsumer(createPortraitV2Payload({
    userId,
    generatedAt: now.toISOString(),
    now,
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id: PortraitV2DimensionId) => ({
      id,
      score: scoreOverrides[id] ?? 0.4,
      confidence: 0.7,
      trend: 'stable' as const,
      freshness: {
        state: 'current' as const,
        asOf: now.toISOString(),
        evidenceAgeDays: 0,
      },
      evidenceSummary: {
        totalCount: 4,
        sourceFamilyCounts: { LearningFact: 4 },
      },
      lastPositiveEvidenceAt: now.toISOString(),
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [{
        kind: 'evidence-family' as const,
        ref: 'LearningFact',
        privacyScope: 'student-visible' as const,
      }],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  }), 'planner', { now });
}

type DiversityInputOverrides = Partial<Pick<
  AdaptiveLearningPathPlannerInput,
  'resourcePreferences' | 'resourcePreferenceSource' | 'policyBundle' | 'learnerState'
>>;

export function buildAlternativeCoreDiversityInput(
  overrides: DiversityInputOverrides = {},
): AdaptiveLearningPathPlannerInput {
  const now = new Date('2026-05-27T08:00:00.000Z');
  return {
    studentId: 'student-1',
    goal: {
      id: 'control-correction',
      title: '控制系统校正设计',
      knowledgeTargets: [
        'control-correction:time-domain-targets',
        'control-correction:root-locus-design',
        'control-correction:simulation-validation',
        'control-correction:arena-transfer',
      ],
      competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
    },
    learnerState: overrides.learnerState ?? {
      primaryPortraitState: 'SNAPSHOT' as const,
      primaryPortraitAvailability: 'available',
      primaryPortrait: buildPlannerPortrait(now, 'student-1'),
      knowledgeMastery: {
        tags: {
          'control-correction:time-domain-targets': {
            posteriorMastery: 0.3,
            confidence: 0.7,
            evidenceCount: 2,
          },
          'control-correction:root-locus-design': {
            posteriorMastery: 0.25,
            confidence: 0.65,
            evidenceCount: 2,
          },
          'control-correction:simulation-validation': {
            posteriorMastery: 0.2,
            confidence: 0.6,
            evidenceCount: 1,
          },
          'control-correction:arena-transfer': {
            posteriorMastery: 0.1,
            confidence: 0.5,
            evidenceCount: 0,
          },
        },
      },
      evidence: {
        confidence: { level: 'medium', score: 0.68, evidenceCount: 8, sourceCompleteness: 0.7 },
        sourceCoverage: { LearningFact: 'available', ArenaSubmission: 'partial' },
      },
    },
    registry: withLegalAdaptiveDestinations(buildAlternativeCoreFixtureRegistry()),
    constraints: {
      timeBudgetMinutes: 180,
      privacyScopes: ['student-visible'],
      device: 'desktop',
      timelineWindowDays: 7,
    },
    policyFamily: 'foundation-remediation',
    policyBundle: {
      families: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
      overlapThreshold: 0.6,
      ...(overrides.policyBundle ?? {}),
    },
    resourcePreferences: overrides.resourcePreferences,
    resourcePreferenceSource: overrides.resourcePreferenceSource,
    now,
  };
}
