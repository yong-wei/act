import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG,
  ADAPTIVE_LEARNING_CENTER_REGIONS,
  LEARNER_DATA_SHELL_SEMANTICS,
  buildControlCorrectionLearningCenterView,
  buildAdaptivePathLaunchContext,
  buildAdaptivePathCompletionRequest,
  buildLearnerDataRouteShell,
  buildPracticeEntryRouteNodes,
  buildRecommendedPathNodeView,
  isSimpleAdaptivePathCompletionResource,
  resolveAdaptivePathLaunchReturnContext,
  type AdaptiveLearningCompatibilityRoute,
  buildAdaptiveClaimStatus,
  buildAdaptiveLearningCenterState,
  buildAdaptiveLearningCenterView,
  getControlCorrectionCenterEntryRoutes,
  getLearnerDataSurfaceRoutes,
  getAdaptiveLearningCenterCompatibilityRoutes,
} from '@/features/adaptive/adaptive-learning-center-contracts';
import { buildPlatformStatusViewModel } from '@/components/platform/platform-ui-contracts';
import type { AdaptiveLearnerState } from '@/lib/data-governance/adaptive-learner-state-service';
import { createEmptyCompetencyVector } from '@/lib/data-governance/competency-model';
import {
  derivePortraitV2Compatibility,
  projectPortraitV2ForConsumer,
} from '@/lib/data-governance/portrait-v2-model';
import { ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES } from '@/lib/adaptive-learning-path-planner';
import type { AdaptiveLearningPathPlan } from '@/lib/adaptive-learning-path-planner';
import {
  buildAdaptivePathOptionDisplays,
  type AdaptivePathOptionWriteOption,
} from '@/lib/adaptive-path-option-display';
import {
  buildPathGenerationGoalHref,
  defaultPathGenerationPanel,
  pathGenerationPanelFromSearchParams,
} from '@/lib/adaptive-path-generation-panel';
import { restoreAdaptiveLearningPathPlanFromRound } from '@/lib/adaptive-path-round-restore';
import { getAdaptivePracticeGoalOptions } from '@/lib/adaptive-path-goal-options';
import { PLATFORM_PRIMARY_ROUTE_INVENTORY } from '@/lib/platform-role-navigation';
import {
  getPathNodeSemanticsForResourceType,
  type ResourceNodeType,
} from '@/lib/resource-node-registry';

const repoRoot = process.cwd();

function pathNodeSemantics(type: ResourceNodeType) {
  const semantics = getPathNodeSemanticsForResourceType(type);
  return {
    pathNodeType: semantics.type,
    displayName: semantics.displayName,
    iconKey: semantics.iconKey,
    shapeHint: semantics.shapeHint,
    evidenceBehavior: semantics.evidenceBehavior,
    evidenceStatus: 'instrumented' as const,
    externalResource: null,
    checkpoint: null,
  };
}

function learnerState(overrides: Partial<AdaptiveLearnerState> = {}): AdaptiveLearnerState {
  return {
    userId: 'student-1',
    payloadVersion: 'adaptive-learner-state.v1',
    generatedAt: '2026-05-28T06:00:00.000Z',
    authority: 'server-owned',
    roleScope: {
      role: 'student',
      classId: 'class-1',
      privacyScopes: ['student-visible'],
    },
    featureFlag: {
      name: 'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED',
      enabled: true,
      fallback: 'none',
    },
    clientHints: {
      received: true,
      authoritative: false,
      reason: 'client-hints-non-authoritative',
    },
    primaryPortrait: projectPortraitV2ForConsumer(
      derivePortraitV2Compatibility({
        userId: 'student-1',
        snapshotAt: '2026-05-28T06:00:00.000Z',
        vector: createEmptyCompetencyVector(),
      }),
      'student',
    ),
    primaryPortraitState: 'SNAPSHOT',
    primaryPortraitAvailability: 'available',
    primaryCompetencies: {
      authority: 'legacy-compatibility-only',
      source: 'latest-snapshot',
      vector: {} as AdaptiveLearnerState['primaryCompetencies']['vector'],
    },
    secondaryDimensions: {} as AdaptiveLearnerState['secondaryDimensions'],
    knowledgeMastery: {
      coverage: 'partial',
      tags: {
        'phase-margin': {
          posteriorMastery: 0.42,
          confidence: 0.6,
          evidenceCount: 3,
          source: 'adaptive-assessment',
          algorithmVersion: 'adaptive-assessment-bkt-v1',
          lastUpdatedAt: '2026-05-28T05:00:00.000Z',
        },
      },
    },
    resourcePreference: {
      preferredModalities: ['simulation'],
      sourceCounts: { simulation: 2 },
      confidence: 'low',
    },
    mediaAbsorption: {
      mediaFactCount: 1,
      averageCompletion: 0.5,
      confidence: 'low',
    },
    pathContext: {
      activePathCount: 1,
      bookmarkedPathCount: 0,
      recentPathIds: ['path-1'],
      activeControlCorrectionPath: {
        state: 'none',
        pathId: null,
        status: null,
        currentNodeId: null,
        terminalValidationState: null,
        lowConfidenceMarkers: [],
      },
      statusMarkers: ['available'],
    },
    risks: {
      riskLevel: 'low',
      activeFlags: [],
    },
    assessmentState: {
      latestAbilityEstimate: {
        theta: 0.3,
        confidenceInterval: [0.1, 0.5],
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        estimatedAt: '2026-05-28T05:30:00.000Z',
      },
    },
    evidence: {
      readState: 'ready',
      evidenceWindow: {
        firstStartedAt: '2026-05-01T00:00:00.000Z',
        lastStartedAt: '2026-05-28T05:00:00.000Z',
        daysCovered: 28,
      },
      sourceCounts: { LearningFact: 9 },
      sourceCoverage: {
        primaryCompetencies: 'available',
        knowledgeMastery: 'partial',
        resourcePreference: 'partial',
      },
      confidence: {
        level: 'low',
        score: 0.36,
        evidenceCount: 9,
        sourceCompleteness: 0.5,
      },
      statusMarkers: ['low-confidence'],
    },
    prerequisiteFeatureGroups: {
      simulationArena: { available: true },
      pathExecution: null,
    },
    fieldContracts: {} as AdaptiveLearnerState['fieldContracts'],
    missingEvidence: ['knowledgeMastery'],
    ...overrides,
  };
}

function pathPlan(overrides: Partial<AdaptiveLearningPathPlan> = {}): AdaptiveLearningPathPlan {
  return {
    id: 'path-1',
    userId: 'student-1',
    goal: {
      id: 'goal-1',
      title: '补强频域到时域迁移',
      knowledgeTargets: ['phase-margin'],
    },
    stage: 'stage-1-rules-graph',
    policyFamily: 'rules-plus-graph-search',
    policyMetadata: ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES['rules-plus-graph-search'],
    pathOptions: [{
      optionId: 'path-option-1',
      nodeIds: ['node-1'],
      recommendationProvenance: {
        summary: '依据 相位裕度 的学习证据安排本路径。',
        confidence: 'low',
        entries: [{
          targetLabel: '相位裕度',
          targetKind: 'knowledge',
          confidence: 'medium',
          evidenceSummary: '掌握状态 42%，来自 3 条有效证据，置信度 60%。',
          judgment: '当前状态仍有提升空间，因此优先安排 相位裕度映射练习。',
          affectedNodeIds: ['node-1'],
          affectedResourceTitles: ['相位裕度映射练习'],
        }],
        evidenceReviewHref: '/profile/evidence',
        limitations: ['部分判断的有效证据仍然不足。'],
        nextAction: '完成诊断或练习，补充有效学习证据。',
      },
    }],
    excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
    status: 'ready',
    currentNodeId: 'node-1',
    mainPath: [
      {
        nodeId: 'node-1',
        title: '相位裕度映射练习',
        type: 'quiz',
        ...pathNodeSemantics('quiz'),
        sourceKind: 'runtime_lesson_step',
        sourceRef: 'lesson-3-8',
        target: '/assessment/adaptive-practice',
        estimatedTimeMinutes: 15,
        prerequisiteNodeIds: [],
        knowledgeCoverage: ['phase-margin'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.8,
        reasonCodes: ['low-mastery-target'],
        status: 'current',
      },
    ],
    alternatives: [],
    score: {
      total: 0.8,
      objectives: {
        learningGain: 0.8,
        engagement: 0.6,
        constraintSatisfaction: 0.9,
        diversity: 0.4,
        fatigue: 0.2,
        dropoutRisk: 0.1,
      },
    },
    confidence: {
      level: 'low',
      score: 0.4,
      sourceCoverage: 0.5,
    },
    explanations: {
      selectedReasons: ['low-mastery-target'],
      rejectedAlternatives: [],
      fallbackReasons: [],
      configurationFulfillment: [],
    },
    executionStatus: {
      adopted: true,
      completedNodeIds: [],
      activeNodeId: 'node-1',
      updatedAt: '2026-05-28T06:00:00.000Z',
    },
    deviations: [],
    corrections: [],
    feedbackEvents: [],
    visualization: {
      map: {
        mainPathNodeIds: ['node-1'],
        branchPaths: [],
        currentNodeId: 'node-1',
        completedNodeIds: [],
        riskNodeIds: [],
        blockedNodes: [],
        alternatives: [],
      },
      timeline: {
        generatedAt: '2026-05-28T06:00:00.000Z',
        windows: [{ days: 7, nodeIds: ['node-1'], estimatedMinutes: 15 }],
      },
      evidence: {
        evidenceBasis: 'adaptive-learner-state',
        confidence: {
          level: 'low',
          score: 0.4,
          sourceCoverage: 0.5,
        },
        sourceCoverage: { learnerState: 'partial' },
        learnerStateDeficits: [
          {
            targetId: 'phase-margin',
            kind: 'knowledge',
            value: 0.42,
            confidence: 0.6,
            evidenceCount: 3,
            reasonCode: 'low-mastery-target',
          },
        ],
        capabilityEvidence: [],
        prerequisiteReasons: [],
        teacherPolicy: [{ nodeId: 'node-1', policy: 'allowed' }],
        alternatives: [],
      },
    },
    ...overrides,
  };
}

describe('adaptive learning center UI contracts', () => {
  it('projects configuration fulfillment into the current-path panel', () => {
    const plan = pathPlan();
    plan.explanations.configurationFulfillment = [{
      key: 'resource-preferences',
      status: 'applied',
      source: 'request',
      effect: '已优先选择匹配的资源类型。',
      message: '已优先选择匹配的资源类型。',
      limitationCode: 'internal-only-code',
    }];
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      pathPlan: plan,
    });

    const currentPath = view.panels.find((panel) => panel.region === 'current-path');
    expect(currentPath?.payload).toMatchObject({
      configurationFulfillment: [
        expect.objectContaining({ key: 'resource-preferences', status: 'applied' }),
      ],
    });
    expect(JSON.stringify(currentPath?.payload)).not.toContain('internal-only-code');
    expect((currentPath?.payload as { configurationFulfillment?: Array<Record<string, unknown>> })
      .configurationFulfillment?.[0]).toEqual({
      key: 'resource-preferences',
      status: 'applied',
      effect: '已优先选择匹配的资源类型。',
      message: '已优先选择匹配的资源类型。',
    });
  });

  it('projects generation-time recommendation provenance without internal diagnostic fields', () => {
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      pathPlan: pathPlan(),
    });
    const currentPath = view.panels.find((panel) => panel.region === 'current-path');
    const pathOptions = (currentPath?.payload as { pathOptions?: Array<Record<string, unknown>> })?.pathOptions ?? [];
    const provenance = pathOptions[0]?.recommendationProvenance;

    expect(provenance).toEqual(expect.objectContaining({
      confidence: 'low',
      evidenceReviewHref: '/profile/evidence',
      nextAction: '完成诊断或练习，补充有效学习证据。',
      entries: [expect.objectContaining({
        evidenceSummary: '掌握状态 42%，来自 3 条有效证据，置信度 60%。',
        affectedResourceTitles: ['相位裕度映射练习'],
      })],
    }));
    expect(JSON.stringify(provenance)).not.toContain('low-mastery-target');
    expect(JSON.stringify(provenance)).not.toContain('targetId');
  });

  it('does not synthesize provenance for legacy paths that only retain learner evidence', () => {
    const legacyPlan = pathPlan();
    delete legacyPlan.pathOptions;
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      pathPlan: legacyPlan,
    });
    const currentPath = view.panels.find((panel) => panel.region === 'current-path');
    const pathOptions = (currentPath?.payload as { pathOptions?: Array<Record<string, unknown>> })?.pathOptions ?? [];

    expect(legacyPlan.visualization.evidence?.learnerStateDeficits).toHaveLength(1);
    expect(pathOptions[0]).toMatchObject({
      targetDeficits: [expect.objectContaining({ targetId: 'phase-margin' })],
    });
    expect(pathOptions[0]?.recommendationProvenance).toBeUndefined();
  });

  it('defines the unified center regions and keeps legacy surfaces available when the feature flag is disabled', () => {
    expect(ADAPTIVE_LEARNING_CENTER_REGIONS).toEqual([
      'overview',
      'learner-state',
      'mastery',
      'current-path',
      'path-map',
      'timeline',
      'evidence',
      'practice',
      'konling',
    ]);

    const state = buildAdaptiveLearningCenterState({ featureFlags: [] });

    expect(state.mode).toBe('legacy-compatible');
    expect(state.activeFeatureFlag).toBe(ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG);
    expect(state.regions).toEqual(['overview', 'practice', 'konling']);
    expect(state.status.categories.fallback).toBe('fallback-active');
    expect(buildPlatformStatusViewModel(state.status, { role: 'student' }).tone).not.toBe('danger');
  });

  it('preserves legacy fallback status when the center flag is disabled even if learner state exists', () => {
    const view = buildAdaptiveLearningCenterView({
      featureFlags: [],
      learnerState: learnerState(),
    });

    expect(view.mode).toBe('legacy-compatible');
    expect(view.authority).toBe('server-owned');
    expect(view.status.categories.fallback).toBe('fallback-active');
    expect(view.status.fallbackReason).toBe('adaptive-learning-center-flag-disabled');
    expect(view.status.source.domain).toBe('learner-state');
    expect(view.panels.map((panel) => panel.region)).toEqual(['overview', 'practice', 'konling']);
  });

  it('declares route compatibility for existing AI, adaptive practice, and profile surfaces without dead route files', () => {
    const routes = getAdaptiveLearningCenterCompatibilityRoutes();

    expect(routes.map((route) => route.href)).toEqual([
      '/ai',
      '/ai/copilot',
      '/assessment/adaptive-practice',
      '/profile',
    ]);
    expect(routes.map((route) => route.preservedIntent)).toEqual([
      'personal-learning-center',
      'konling-conversation',
      'adaptive-practice',
      'profile-adaptive-cards',
    ]);
    for (const route of routes) {
      expect(existsSync(join(repoRoot, route.routeFile))).toBe(true);
      expect(route.migrationMode).toMatch(/legacy|center/);
      expect(readRouteSource(route)).toContain(routeIntentMarker(route));
    }
  });

  it('defines one learner data shell across dashboard, profile, growth, evidence, and adaptive practice routes', () => {
    const routes = getLearnerDataSurfaceRoutes();

    expect(routes.map((route) => route.href)).toEqual([
      '/dashboard',
      '/profile',
      '/profile/growth',
      '/profile/evidence',
      '/assessment/adaptive-practice',
    ]);
    expect(LEARNER_DATA_SHELL_SEMANTICS).toEqual([
      'ability-profile',
      'current-path',
      'evidence-timeline',
      'recommendations',
      'practice',
      'next-action',
    ]);
    for (const route of routes) {
      expect(existsSync(join(repoRoot, route.routeFile))).toBe(true);
      expect(buildLearnerDataRouteShell(route.href)).toMatchObject({
        routeFamily: 'learner-data-pathway',
        routeIdentity: route.routeIdentity,
        semantics: LEARNER_DATA_SHELL_SEMANTICS,
        owningChange: 'redesign-learner-data-and-report-surfaces',
        archetype: 'learner-record-pathway',
        mobileBehavior: 'path-evidence-next-action-stack',
        dockBehavior: route.href === '/dashboard' ? 'learner-action-dock' : 'contextual-review-dock',
        visualEvidence: {
          requiredThemes: ['light', 'dark'],
          requiredWidths: [1440, 320],
        },
      });
    }
  });

  it('keeps learner data route ledger ownership, navigation layers, and shell metadata aligned', () => {
    for (const route of getLearnerDataSurfaceRoutes()) {
      expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((entry) => entry.href === route.href)).toMatchObject({
        href: route.href,
        routeFile: route.routeFile,
        frame: route.href === '/dashboard' || route.href === '/assessment/adaptive-practice'
          ? 'learning-atlas'
          : 'report-ledger',
        navigationLayers: [
          route.href === '/assessment/adaptive-practice' ? 'global-product' : 'role-cockpit',
          'contextual-workspace',
          'local-tool',
        ],
        owningChange: 'redesign-learner-data-and-report-surfaces',
      });
    }
  });

  it('binds learner data route pages to the shared shell contract', () => {
    for (const route of getLearnerDataSurfaceRoutes()) {
      const source = readFileSync(join(repoRoot, route.routeFile), 'utf8');

      if (route.href === '/dashboard') {
        expect(source).toContain("redirect('/profile')");
        expect(source).toContain('getPlatformCockpitHref');
        continue;
      }

      expect(source).toContain('buildLearnerDataRouteShell');
      expect(source).toContain(`buildLearnerDataRouteShell('${route.href}')`);
      expect(source).toContain('learnerDataShell');
      expect(source).toContain('data-learner-record-surface');
      expect(source).toContain('data-learner-record-next-action');
    }
  });

  it('binds adaptive practice to the productized path options, history, and terminal validation surface', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');

    expect(source).toContain('data-learning-path-product-surface="path-options-selection-history-terminal-validation"');
    expect(source).toContain('data-learning-path-option=');
    expect(source).toContain('data-learning-path-history="selection-history"');
    expect(source).toContain('data-learning-path-validation-timeline="checkpoint-deviation-intervention-terminal"');
    expect(source).toContain('/api/learning-paths/${encodeURIComponent(pathId)}/choices');
    expect(source).toContain("submitPathChoice('selection'");
    expect(source).toContain("submitPathChoice('rejection'");
    expect(source).toContain("submitPathGeneration('revise'");
    expect(source).toContain("submitPathGeneration('explain'");
    expect(source).toContain("submitPathChoice('helpfulness'");
    expect(source).toContain('data-adaptive-path-status-region={showSelectionWorkspace ?');
    expect(source).toContain('data-learning-path-option-feedback={option.writeOption.optionId}');
    expect(source).toContain('data-learning-path-route-preview');
    expect(source).toContain('data-learning-path-recommendation-provenance');
    expect(source).toContain('data-learning-path-recommendation-disclosure');
    expect(source).toContain('查看学习记录并复核证据');
    expect(source).toContain('min-w-0');
    expect(source).toContain('break-words');
    expect(source).toContain('data-learning-path-diversity-notice="limited"');
    expect(source).toContain('data-learning-path-example={option.isGenerated ? undefined : option.id}');
  });

  it('keeps desktop path option actions inside each comparable option module', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');

    expect(source).toContain('data-learning-path-options-layout="route-modules"');
    expect(source).toContain('data-learning-path-option-actions="attached"');
    expect(source).toContain("key={`${option.id}:mobile`}");
    expect(source).toContain("data-learning-path-option-module={option.isGenerated ? 'route' : undefined}");
    expect(source).toContain('aria-label={`选择${option.title}`');
    expect(source).toContain('aria-label={`请控灵调整${option.title}`');
    expect(source).toContain('aria-label={`解释${option.title}差异`');
    expect(source).toContain('aria-label={`暂不采用${option.title}`');
    expect(source).toContain('pathOptionFeedback[option.writeOption.optionId]');
    expect(source).not.toContain("key={`${option.id}:actions`}");
    expect(source).not.toContain('lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]');
  });

  it('captures adaptive path visual signals for attached route modules', () => {
    const source = readFileSync(join(repoRoot, 'scripts/tests/capture-adaptive-path-product-qa.ts'), 'utf8');

    expect(source).toContain('routeModulesAttached');
    expect(source).toContain('assertPathComparisonSignals');
    expect(source).toContain('missing-signal');
    expect(source).toContain("style.visibility !== 'hidden'");
    expect(source).toContain('signal.routeModuleCount < 1');
    expect(source).toContain('signal.attachedActionGroupCount !== signal.routeModuleCount');
    expect(source).toContain('[data-learning-path-options-layout="route-modules"]');
    expect(source).toContain('[data-learning-path-option-actions="attached"]');
    expect(source).not.toContain('[data-learning-path-options-layout="comparable-information-grid"]');
  });

  it('does not fall back static starter path actions to the first real option', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');

    expect(source).not.toContain('realPathOption');
    expect(source).not.toContain('pathOptions[index] ??');
    expect(source).not.toContain('pathOptions[index]');
    expect(source).toContain('buildAdaptivePathOptionDisplays(pathOptions, { diversityLimited: pathComparisonDiversityLimited })');
    expect(source).toContain('const optionForWrite = option.writeOption;');
    expect(source).toContain('disabled={!option.writeOption || Boolean(pathChoicePending)}');
    expect(source).toContain("setPathChoiceMessage('请先登录并生成路径后再记录选择。')");
  });

  it('binds displayed real path options to their own writable option payload', () => {
    const options: AdaptivePathOptionWriteOption[] = [
      {
        optionId: 'rules-plus-graph-search-route',
        label: '规则图谱推荐路线',
        lockedNodeIds: [],
        readinessSummary: [],
        targetDeficits: [{ targetId: 'phase-margin' }],
        evidenceBasis: ['adaptive-learner-state'],
        resourceMix: { knowledge_card: 1, arena_task: 1 },
        effort: { estimatedMinutes: 42, relative: 'medium' },
        terminalValidationNodeIds: ['arena-task:terminal'],
        terminalValidationStrategy: { summary: 'official Arena validation' },
        limitations: [],
        recommendationProvenance: {
          summary: '依据相位裕度的学习证据安排本路径。',
          confidence: 'medium',
          entries: [{
            targetLabel: '相位裕度',
            targetKind: 'knowledge',
            confidence: 'medium',
            evidenceSummary: '掌握状态 42%，来自 3 条有效证据，置信度 60%。',
            judgment: '当前状态仍有提升空间，因此优先安排相位裕度知识卡。',
            affectedNodeIds: ['card:phase-margin'],
            affectedResourceTitles: ['相位裕度知识卡'],
          }],
          evidenceReviewHref: '/profile/evidence',
          limitations: [],
          nextAction: null,
        },
      },
      {
        optionId: 'foundation-remediation-route',
        label: '基础补救路线',
        lockedNodeIds: ['simulation:locked-later'],
        readinessSummary: [
          {
            nodeId: 'simulation:locked-later',
            state: 'locked',
            message: '完成前置练习后解锁。',
          },
        ],
        targetDeficits: [],
        evidenceBasis: ['LearningFact'],
        resourceMix: { adaptive_quiz: 1 },
        effort: { estimatedMinutes: 18, relative: 'short' },
        terminalValidationNodeIds: [],
        terminalValidationStrategy: {},
        limitations: [],
      },
    ];

    const displays = buildAdaptivePathOptionDisplays(options);
    const preview = buildAdaptivePathOptionDisplays([]);

    expect(displays.map((option) => option.title)).toEqual(['规则图谱推荐路线', '基础补救路线']);
    expect(displays[0].writeOption).toBe(options[0]);
    expect(displays[1].writeOption).toBe(options[1]);
    expect(displays[0].id).toBe('rules-plus-graph-search-route');
    expect(displays[0].resources.map((resource) => resource.label)).toEqual(['知识卡', 'Arena']);
    expect(displays[0].recommendationProvenance).toBe(options[0].recommendationProvenance);
    expect(displays[1].recommendationProvenance).toBeUndefined();
    expect(displays[1].readiness).toBe('包含后续解锁节点');
    expect(preview).toHaveLength(3);
    expect(preview.every((option) => option.writeOption === undefined)).toBe(true);
  });

  it('preserves ordered nodes, readiness, and cross-option resource differences for generated path comparison', () => {
    const options: AdaptivePathOptionWriteOption[] = [
      {
        optionId: 'foundation-route',
        label: '基础路径',
        nodeIds: ['card:shared', 'quiz:locked', 'simulation:unique', 'checkpoint:review', 'arena:final', 'textbook:unique'],
        nodeSummaries: [
          { nodeId: 'card:shared', title: '相位裕度知识卡', pathNodeType: 'knowledge_card', estimatedTimeMinutes: 8, status: 'current' },
          { nodeId: 'quiz:locked', title: '相位裕度练习', pathNodeType: 'adaptive_quiz', estimatedTimeMinutes: 12, status: 'locked' },
          { nodeId: 'simulation:unique', title: '校正仿真', pathNodeType: 'simulation', estimatedTimeMinutes: 18, status: 'next' },
          { nodeId: 'checkpoint:review', title: '阶段检查', pathNodeType: 'checkpoint', estimatedTimeMinutes: 6, status: 'next' },
          { nodeId: 'arena:final', title: 'Arena 验证', pathNodeType: 'arena_task', estimatedTimeMinutes: 25, status: 'next' },
          { nodeId: 'textbook:unique', title: '相位裕度教材节', pathNodeType: 'textbook_section', estimatedTimeMinutes: 10, status: 'next' },
        ],
        lockedNodeIds: ['quiz:locked'],
        readinessSummary: [{ nodeId: 'quiz:locked', state: 'locked', message: '完成知识卡后解锁。' }],
        targetDeficits: [],
        evidenceBasis: ['近期练习记录'],
        resourceMix: { knowledge_card: 1, adaptive_quiz: 1, simulation: 1, checkpoint: 1, arena_task: 1, textbook_section: 1 },
        effort: { estimatedMinutes: 69, relative: 'medium' },
        expectedTargetLift: 1.2,
        terminalValidationNodeIds: ['arena:final'],
        terminalValidationStrategy: { summary: 'Arena 验证' },
        limitations: [],
      },
      {
        optionId: 'practice-route',
        label: '实践路径',
        nodeIds: ['card:shared', 'workbench:unique', 'slides:unique'],
        nodeSummaries: [
          { nodeId: 'card:shared', title: '相位裕度知识卡', pathNodeType: 'knowledge_card', estimatedTimeMinutes: 8, status: 'current' },
          { nodeId: 'workbench:unique', title: '控制工作台', pathNodeType: 'control_workbench', estimatedTimeMinutes: 20, status: 'next' },
          { nodeId: 'slides:unique', title: '频域课件', pathNodeType: 'slides', estimatedTimeMinutes: 15, status: 'next' },
        ],
        lockedNodeIds: [],
        readinessSummary: [],
        targetDeficits: [],
        evidenceBasis: ['近期练习记录'],
        resourceMix: { knowledge_card: 1, control_workbench: 1, slides: 1 },
        effort: { estimatedMinutes: 28, relative: 'short' },
        terminalValidationNodeIds: [],
        terminalValidationStrategy: {},
        limitations: [],
      },
    ];

    const displays = buildAdaptivePathOptionDisplays(options, { diversityLimited: true });
    const foundationNodes = displays[0].orderedNodes;

    expect(displays.every((option) => option.isGenerated)).toBe(true);
    expect(displays[0].diversityLimited).toBe(true);
    expect(displays[0].expectedAbilityImprovement).toBe('约 +1.2');
    expect(foundationNodes?.map((node) => node.title)).toEqual([
      '相位裕度知识卡',
      '相位裕度练习',
      '校正仿真',
      '阶段检查',
      'Arena 验证',
      '相位裕度教材节',
    ]);
    expect(foundationNodes?.[0]).toMatchObject({ comparisonLabel: '所有方案均包含', statusLabel: '建议从这里开始' });
    expect(foundationNodes?.[1]).toMatchObject({ statusLabel: '稍后解锁', unlockMessage: '完成知识卡后解锁。', comparisonLabel: '本方案特有' });
    expect(foundationNodes?.[2]).toMatchObject({ comparisonLabel: '本方案特有', resourceLabel: '虚拟仿真' });
    expect(foundationNodes?.[5]).toMatchObject({ kind: 'external_resource', resourceLabel: '教材节' });
    expect(displays[1].orderedNodes?.[2]).toMatchObject({ kind: 'external_resource', resourceLabel: '课件' });

    const examples = buildAdaptivePathOptionDisplays([]);
    expect(examples.every((option) => !option.isGenerated && option.orderedNodes === undefined)).toBe(true);
  });

  it('uses Planner display names for unclassified path node types', () => {
    const [display] = buildAdaptivePathOptionDisplays([{
      optionId: 'legacy-resource-route',
      label: '自定义资源路径',
      nodeIds: ['resource:legacy'],
      nodeSummaries: [{
        nodeId: 'resource:legacy',
        title: '复习根轨迹与超调关系',
        pathNodeType: 'resource',
        displayName: '知识卡',
        estimatedTimeMinutes: 25,
        status: 'current',
      }],
      lockedNodeIds: [],
      readinessSummary: [],
      targetDeficits: [],
      evidenceBasis: [],
      resourceMix: {},
      effort: {},
      terminalValidationNodeIds: [],
      terminalValidationStrategy: {},
      limitations: [],
    }]);

    expect(display.orderedNodes?.[0]).toMatchObject({
      kind: 'external_resource',
      resourceLabel: '知识卡',
    });
  });

  it('keeps productized path option writes compatible with server style evidence', () => {
    const routeSource = readFileSync(join(repoRoot, 'src/app/api/learning-paths/[id]/choices/route.ts'), 'utf8');

    expect(routeSource).toContain('selectedOptionId');
    expect(routeSource).toContain('rejectedOptionIds');
    expect(routeSource).toContain('resolveChoiceOption');
    expect(routeSource).toContain('path-option-${index + 1}');
    expect(routeSource).toContain('selectedStyleId');
    expect(routeSource).toContain('selectedPolicyFamily');
    expect(routeSource).toContain('rejectedStyleIds');
  });

  it('prioritizes current path, next action, evidence confidence, and missing source on profile', () => {
    const dashboard = readFileSync(join(repoRoot, 'src/app/(main)/dashboard/page.tsx'), 'utf8');
    const profile = readFileSync(join(repoRoot, 'src/app/(main)/profile/page.tsx'), 'utf8');

    expect(dashboard).toContain("redirect('/profile')");

    for (const source of [profile]) {
      expect(source).toContain('data-learner-record-priority="current-path"');
      expect(source).toContain('data-learner-record-next-action');
      expect(source).toContain('data-learner-record-evidence-confidence');
      expect(source).toContain('data-learner-record-missing-source');
    }

    expect(profile.indexOf('data-learner-record-priority="current-path"')).toBeLessThan(
      profile.indexOf('<h3 className="text-lg font-semibold text-foreground">能力画像</h3>'),
    );
  });

  it('declares control-correction entry routes with preserved goal and route intent', () => {
    const routes = getControlCorrectionCenterEntryRoutes();

    expect(routes.map((route) => [route.href, route.source, route.routeIntent])).toEqual([
      ['/', 'homepage', 'practice'],
      ['/dashboard', 'student-cockpit', 'learner-state-review'],
      ['/profile', 'profile', 'learner-state-review'],
      ['/profile/growth', 'profile', 'evidence-review'],
      ['/profile/evidence', 'profile', 'evidence-review'],
      ['/profile/growth', 'contextual-recommendation', 'contextual-recommendation'],
      ['/assessment/adaptive-practice', 'adaptive-practice', 'practice'],
    ]);
    expect(routes.every((route) => route.preservedQuery.goal === 'control-correction')).toBe(true);
    expect(routes.every((route) => route.preservedQuery.intent === route.routeIntent)).toBe(true);
  });

  it('binds the evidence browser to grouped timeline metadata and actionable empty states', () => {
    const source = readFileSync(join(repoRoot, 'src/features/data-governance/evidence-timeline-browser.tsx'), 'utf8');
    const legacyTeacherEvidence = readFileSync(join(repoRoot, 'src/app/(main)/teacher/students/[studentId]/evidence/page.tsx'), 'utf8');
    const teacherClassEvidence = readFileSync(join(repoRoot, 'src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx'), 'utf8');

    expect(source).toContain('item.groupedCount');
    expect(source).toContain('item.displayPriority');
    expect(source).toContain('重置筛选条件');
    expect(source).toContain('emptyBackLabel');
    expect(source).toContain('返回成长中心');
    expect(source).toContain('缺失来源');
    expect(source).toContain('formatLearnerRecordMissingSource');
    expect(source).toContain('缺少官方 Arena 结果');
    expect(source).toContain('受限详情已隐藏');
    expect(legacyTeacherEvidence).toContain('/teacher/classes');
    expect(legacyTeacherEvidence).toContain('/students/');
    expect(teacherClassEvidence).toContain('emptyBackLabel="返回学生详情"');
  });

  it('binds adaptive practice entry states to learner route-node view models', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');

    expect(source).toContain('buildPracticeEntryRouteNodes');
    expect(source).toContain('practiceRouteNodes');
    expect(source).toContain('证据覆盖');
    expect(source).toContain('缺失证据');
    expect(source).toContain('formatCompletedPathLearningTime');
    expect(source).toContain('已完成节点时长');
    expect(source).not.toContain("diagnostic ? '42 分钟' : '尚未开始'");
    expect(source).toContain('data-adaptive-path-current-node-actions="launch-complete"');
    expect(source).toContain('onClick={launchNextAction}');
    expect(source).toContain('onClick={completeNextAction}');
    expect(source).toContain("const canOpenNextPathAction = nextPathAction?.method === 'GET';");
    expect(source).toContain('当前节点暂不可启动');
  });

  it('keeps adaptive practice failures recoverable from the resource card', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');

    expect(source).toContain('data-adaptive-practice-error-state="recoverable"');
    expect(source).toContain('练习加载未完成');
    expect(source).toContain('onClick={bootstrapPractice}');
    expect(source).toContain('const retryNextQuestion = useCallback(async () =>');
    expect(source).toContain('onClick={retryNextQuestion}');
    expect(source).not.toContain('onClick={loadNextQuestion}');
  });

  it('renders catalog goal cards on the no-goal landing entry', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');
    const options = getAdaptivePracticeGoalOptions();

    expect(options).toHaveLength(9);
    expect(options.map((option) => option.id)).toEqual(expect.arrayContaining([
      'feedback-loop-concept-foundations',
      'time-domain-response-analysis',
      'simulation-validation-practice',
      'ship-ocean-transfer-application',
    ]));
    expect(source).toContain('const generationGoalOptions = getAdaptivePracticeGoalOptions();');
    expect(source).toContain('{generationGoalOptions.map((goal) => (');
    expect(source).toContain('{generationGoalOptions.length} 个目标');
    expect(source).toContain('{generationGoalOptions.map((goal, index) => {');
    expect(source).toContain('data-adaptive-path-generation-ready="catalog"');
    expect(source).toContain('withFeedbackTaskHref(goal.hrefs.generation)');
    expect(source).toContain("const genericPathGenerationHref = '/assessment/adaptive-practice?intent=contextual-recommendation';");
    expect(source).toContain('const isPresetGoalLanding = showLandingWorkspace && !hasInvalidRequestedGoal && !explicitGoal;');
    expect(source).toContain('useGlobalAI');
    expect(source).toContain('openPathGenerationAdvisor');
    expect(source).toContain('const hasInvalidRequestedGoal = requestedGoal !== null && !explicitGoal');
    expect(source).toContain('const pathAdvisorContextGoal = hasInvalidRequestedGoal');
    expect(source).toContain('disabled={pathGenerationPending !== null || hasInvalidRequestedGoal || !canSubmitPathGeneration}');
    expect(source).toContain('pathAdvisorContextGoal || isDemoMode');
    expect(source).toContain("data-adaptive-path-generation-action=\"open-in-page-path-advisor\"");
    expect(source).toContain("data-adaptive-path-generation-action=\"choose-generation-goal\"");
    expect(source).toContain('data-adaptive-path-workspace-intent={workspaceIntent}');
    expect(source).toContain("showGenerationWorkspace ? (");
    expect(source).toContain('value={pathGenerationPanel.goalId}');
    expect(source).toContain('onChange={(event) => handlePathGenerationGoalChange(event.target.value)}');
    expect(source).toContain('window.location.assign(buildPathGenerationGoalHref(nextGoal, nextPanel))');
    expect(source).toContain('请控灵生成路径');
    expect(source).toContain('生成学习路径');
    expect(source).toContain('路径顾问准备中');
    expect(source).toContain('选择目标和可用时间，系统会生成可比较的学习路径。');
    expect(source).not.toContain('data-adaptive-path-generation-action="enter-control-correction-context"');
    expect(source).not.toContain('review-frequency-response-evidence');
    expect(source).not.toContain('/ai/copilot?mode=path-advisor');
    expect(source).not.toContain("setPathChoiceMessage('控灵已准备好根据你的目标生成路径。')");
  });

  it('builds editable path generation requests from panel controls', () => {
    const pageSource = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');
    const routeSource = readFileSync(join(repoRoot, 'src/app/api/adaptive/path-advisor-tool/route.ts'), 'utf8');
    const sidebarSource = readFileSync(join(repoRoot, 'src/components/ai/global-ai-sidebar.tsx'), 'utf8');
    const helperSource = readFileSync(join(repoRoot, 'src/lib/adaptive-path-generation-panel.ts'), 'utf8');

    expect(pageSource).toContain('data-adaptive-path-generation-panel="editable"');
    expect(pageSource).toContain('data-adaptive-path-generation-mobile-sheet="bottom-sheet"');
    expect(pageSource).toContain('data-adaptive-path-generation-request="structured-panel"');
    expect(pageSource).toContain('value={pathGenerationPanel.goalId}');
    expect(pageSource).toContain('value={pathGenerationPanel.timeBudgetMinutes}');
    expect(pageSource).toContain('difficultyRhythm: pathGenerationPanel.difficultyRhythm');
    expect(pageSource).toContain('resourcePreference: pathGenerationPanel.resourcePreference');
    expect(readFileSync(join(repoRoot, 'src/lib/konling-agent-runtime.ts'), 'utf8'))
      .toContain('if (value.length === 0) return [];');
    expect(pageSource).toContain('checkpointPreference: pathGenerationPanel.checkpointPreference');
    expect(pageSource).toContain('allowExternalResources: pathGenerationPanel.allowExternalResources');
    expect(pageSource).toContain('naturalLanguageIntent: pathGenerationPanel.naturalLanguageIntent');
    expect(pageSource).not.toContain('`优先围绕图谱节点 ${graphNodeId} 生成或调整路径。`');
    expect(pageSource).toContain("const activeGraphNodeId = searchParams.get('graphNodeId')");
    expect(pageSource).toContain("if (activeGoalQuery && activeGraphNodeId) activeGoalQuery.set('graphNodeId', activeGraphNodeId)");
    expect(pageSource).toContain("if (activeGraphNodeId) contextQuery.set('graphNodeId', activeGraphNodeId)");
    expect(pageSource).not.toContain("if (activeNodeId) contextQuery.set('nodeId', activeNodeId)");
    expect(pageSource).toContain('...(payload.graphNodeId ? { graphNodeId: payload.graphNodeId } : {})');
    expect(pageSource).toContain('const graphNodeId = assistantEntryPoint?.mode ===');
    expect(pageSource).toContain('graphNodeId,');
    expect(pageSource).toContain('excludedNodeIds: operation ===');
    expect(pageSource).toContain('preferredOptionId: operation !==');
    expect(pageSource).toContain('requestedAt: new Date().toISOString()');
    expect(pageSource).toContain('generationRequestId,');
    expect(pageSource).toContain('type PathGenerationRequestStatus,');
    expect(pageSource).toContain('const startPathGenerationFromAdvisor = useCallback');
    expect(pageSource).toContain('onClick={startPathGenerationFromAdvisor}');
    expect(pageSource).toContain('claimPathGenerationRequest(');
    expect(pageSource).toContain('pathGenerationRequestLifecycleRef.current = claim.lifecycle');
    expect(pageSource).toContain("if (payload.generationRequest?.status === 'failed')");
    expect(pageSource).not.toContain('window.location.assign(withFeedbackTaskHref(`/assessment/adaptive-practice?${selectionQuery.toString()}`))');
    expect(pageSource).toContain("disabled={pathGenerationRequestStatus === 'pending' || pathGenerationRequestStatus === 'running'}");
    expect(pageSource).toContain("window.dispatchEvent(new CustomEvent('konling:path-generation-status'");
    expect(sidebarSource).toContain("window.addEventListener('konling:path-generation-status'");
    expect(sidebarSource).toContain("if (assistantEntryPoint?.mode !== 'path-advisor') return");
    expect(pageSource).toContain('setPathAdvisorAgentSessionId(null)');
    expect(pageSource).toContain('const handlePathGenerationGoalChange = useCallback');
    expect(pageSource).toContain('pathGenerationPanelFromSearchParams(new URLSearchParams(searchParamsKey), activeGoal)');
    expect(pageSource).toContain('window.location.assign(buildPathGenerationGoalHref(nextGoal, nextPanel))');
    expect(pageSource).toContain('storePathGenerationPanelForGoal(nextGoal, nextPanel)');
    expect(pageSource).toContain('takeStoredPathGenerationPanel(activeGoal) ?? restoredPathGenerationPanel');
    expect(helperSource).toContain('pathTime: String(panel.timeBudgetMinutes)');
    expect(helperSource).toContain('pathResources: panel.resourcePreference.join');
    expect(helperSource).toContain("query.set('pathExternal', '1')");
    expect(helperSource).not.toContain('pathIntent');
    expect(pageSource).not.toContain("window.location.assign(`/assessment/adaptive-practice?goal=${nextGoal}&intent=contextual-recommendation`)");
    expect(pageSource).toContain('onChange={(event) => handlePathGenerationGoalChange(event.target.value)}');
    expect(pageSource).toContain("fetch('/api/adaptive/path-advisor-tool'");
    expect(pageSource).toContain('data-adaptive-path-generation-intent="editable"');
    expect(pageSource).toContain("submitPathGeneration('revise', optionForWrite)");
    expect(pageSource).toContain("payload.result?.generationStatus === 'blocked'");
    expect(pageSource).toContain('setPathChoiceMessage(blockedMessage)');
    expect(pageSource).toContain('selectedOptionId');
    expect(pageSource).toContain('rejectedOptionIds');
    expect(pageSource).not.toContain('Konling parameters');

    expect(routeSource).toContain('runtime.generateLearningPath(toolInput)');
    expect(routeSource).toContain('path-generation-request:${generationRequestId}');
    expect(routeSource).toContain('readPathGenerationRequestStatus(result)');
    expect(routeSource).toContain('runtime.reviseLearningPathOptions(toolInput)');
    expect(routeSource).toContain('runtime.explainLearningPathTradeoff(toolInput)');
    expect(routeSource).toContain('modeContextToken');
    expect(routeSource).toContain('const graphNodeId = typeof body.graphNodeId');
    expect(routeSource).toContain('? body.naturalLanguageIntent.trim()');
    expect(routeSource).not.toContain('`优先围绕图谱节点 ${graphNodeId} 生成或调整路径。');
    expect(routeSource).toContain("...(toolInput.graphNodeId ? { graphNodeId: toolInput.graphNodeId } : {})");
    expect(routeSource).toContain('resolveKonlingTeachingAssistantSignedGraphNodeId');
    expect(routeSource).toContain('const signedGraphNodeId = resolveKonlingTeachingAssistantSignedGraphNodeId');
    expect(routeSource).toContain('if (requestedToolInput.graphNodeId && !signedGraphNodeId)');
    expect(routeSource).toContain("return readinessError('图谱节点上下文未签名或已失效'");
    expect(routeSource).toContain("reason: 'advisor-forbidden'");
    expect(routeSource).toContain('graphNodeId: signedGraphNodeId');
    expect(routeSource).toContain('readPathOptionStyleLookup');
    expect(routeSource).not.toContain('.filter(({ option }) => readStringArray(option.nodeIds).length > 0)');
    expect(routeSource).toContain('resolveOptionalCurrentPathStyleId(pathOptionLookup');
    expect(routeSource).toContain('throw new KonlingRuntimeScopeError(403, `路径选项不属于当前学习路径: ${fieldName}`)');
    expect(routeSource).toContain('requestedAt: typeof body.requestedAt');
    expect(routeSource).toContain('const pathPlanContext = toolInput.pathId');
    expect(routeSource).toContain('readPathAdvisorPlanContext(toolInput.pathId, goalId, session.user.id, classId)');
    expect(routeSource).toContain('const graphRuntimeContext = pathPlanContext');
    expect(routeSource).toContain('citationContext: buildPathAwareCitationContext(');
    expect(routeSource).toContain('graphContext: buildKonlingRuntimeGraphContext');
    expect(routeSource).toContain('runtimeContext: graphRuntimeContext');
    expect(routeSource).toContain('clientHints: clientContextHints');
    expect(routeSource).toContain('const baseCitationContext = citationContext ?? createMissingPathAdvisorCitationContext()');
    expect(routeSource).toContain("missingCitationClasses: baseCitationContext.missingCitationClasses.filter((item) => item !== 'path-execution')");
    expect(routeSource).toContain("lowConfidenceReasons: baseCitationContext.lowConfidenceReasons.filter((item) => item !== 'missing-path-execution')");
    expect(routeSource).toContain('lastExecutionMetadata: true');
    expect(routeSource).toContain('...readStringArray(executionMetadata.completedNodeIds)');
    expect(readFileSync(join(repoRoot, 'src/lib/konling-agent-runtime.ts'), 'utf8'))
      .toContain('currentNodeId: input.context.planContext?.activeNodeId ?? null');
    expect(readFileSync(join(repoRoot, 'src/lib/konling-agent-runtime.ts'), 'utf8'))
      .toContain('selectedGraphNodeIds: normalizeAdaptivePathSelectedGraphNodeIds');
  });

  it('renders server-owned path difference facts and invalidates stale explanations', () => {
    const pageSource = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');
    const runtimeSource = readFileSync(join(repoRoot, 'src/lib/konling-agent-runtime.ts'), 'utf8');

    expect(pageSource).toContain('readPathDifferenceExplanation(payload.result?.comparison)');
    expect(pageSource).toContain('data-learning-path-difference-explanation={explanation.pathId}');
    expect(pageSource).toContain('正在比较：{left.label} ↔ {right.label}');
    expect(pageSource).toContain('共同节点');
    expect(pageSource).toContain('独有节点');
    expect(pageSource).toContain('顺序差异');
    expect(pageSource).toContain('方案取舍');
    expect(pageSource).toContain('比较限制');
    expect(pageSource).toContain('const pathOptionVersionKey = useMemo');
    expect(pageSource).toContain('const pathOptionVersionKeyRef = useRef(pathOptionVersionKey)');
    expect(pageSource).toContain('explanationRequestVersionKey !== pathOptionVersionKeyRef.current');
    expect(pageSource).toContain('differenceExplanation.pathId !== currentPathId');
    expect(pageSource).toContain('setPathDifferenceExplanations({})');
    expect(pageSource).toContain('准备度明细');
    expect(pageSource).toContain('terminalValidationNodeIds: getStringArray(metrics.terminalValidationNodeIds)');
    expect(pageSource).toContain('min-w-0 space-y-3');
    expect(pageSource).toContain('break-words');
    expect(runtimeSource).toContain('buildAdaptivePathDifferenceExplanation(path.id, selectedOption, comparedOption)');
    expect(runtimeSource).toContain("'insufficient-data'");
    expect(runtimeSource).toContain("'no-material-difference'");
    expect(runtimeSource).not.toContain('路径差异主要来自学习时间、资源类型、检查点密度和当前证据覆盖。');
  });

  it('preserves empty path generation resource preference through goal-change URLs', () => {
    const panel = {
      ...defaultPathGenerationPanel,
      goalId: 'control-correction' as const,
      timeBudgetMinutes: 45,
      resourcePreference: [],
      allowExternalResources: true,
      naturalLanguageIntent: '先补频域证据',
    };
    const href = buildPathGenerationGoalHref('frequency-response-foundations', panel);
    const query = new URLSearchParams(href.split('?')[1] ?? '');

    expect(query.get('pathTime')).toBe('45');
    expect(query.has('pathResources')).toBe(true);
    expect(query.get('pathResources')).toBe('');
    expect(query.get('pathExternal')).toBe('1');
    expect(query.has('pathIntent')).toBe(false);
    expect(pathGenerationPanelFromSearchParams(query, 'frequency-response-foundations')).toMatchObject({
      goalId: 'frequency-response-foundations',
      timeBudgetMinutes: 45,
      resourcePreference: [],
      allowExternalResources: true,
      naturalLanguageIntent: '',
    });
  });

  it('registers path-advisor entry point for every explicit catalog goal', () => {
    const source = readFileSync(join(repoRoot, 'src/features/adaptive/path-advisor-entrypoint-bridge.tsx'), 'utf8');
    const layoutSource = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/layout.tsx'), 'utf8');

    expect(source).toContain("import { useSearchParams } from 'next/navigation';");
    expect(source).toContain('isAdaptivePracticeGoalId(requestedGoal)');
    expect(source).toContain("const activeGraphNodeId = searchParams.get('graphNodeId')");
    expect(source).toContain('if (activeGraphNodeId) {');
    expect(source).toContain('const modeContextToken = explicitGoal ? modeContextTokens[explicitGoal] ?? null : null;');
    expect(source).toContain('if (!explicitGoal || !classId || !modeContextToken) {');
    expect(source).toContain('goalContexts[explicitGoal]');
    expect(source).toContain('updatePageContext({ assistantEntryPoint: null });');
    expect(source).toContain('return () => updatePageContext({ assistantEntryPoint: null });');
    expect(source).toContain('`student-path-center:${explicitGoal}:adaptive-path-center`');
    expect(source).toContain('candidateBatchId ? { candidateBatchId } : {}');
    expect(source).toContain('goalId: explicitGoal');
    expect(layoutSource).toContain('const goalOptions = getAdaptivePracticeGoalOptions();');
    expect(layoutSource).toContain('Object.fromEntries(goalOptions.map((goal) => [');
    expect(layoutSource).toContain('courseId: goal.id');
  });

  it('renders adaptive path execution, skip warning, and evidence history in student-facing language', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');
    const timelineSource = readFileSync(join(repoRoot, 'src/features/adaptive/adaptive-path-timeline.tsx'), 'utf8');
    const moduleSource = readFileSync(join(repoRoot, 'src/features/adaptive/path-workspace-module.tsx'), 'utf8');
    const journeyControlSource = readFileSync(join(repoRoot, 'src/features/adaptive/adaptive-path-journey-control.tsx'), 'utf8');

    expect(source).toContain('data-adaptive-path-execution-surface="active-route"');
    expect(source).toContain("? 'avoid-learning-record' : undefined");
    expect(source).toContain('{!showPathContextRecovery && (showSelectionWorkspace || showExecutionWorkspace || showRecoveredExecutionWorkspace || showEvidenceWorkspace) && pathExecutionNodes.length > 0 ? (');
    expect(source).toContain('{showExecutionWorkspace || showRecoveredExecutionWorkspace ||');
    expect(source).toContain('data-adaptive-path-route-map="compact"');
    expect(source).toContain('data-adaptive-path-progress-summary="essential"');
    expect(source).toContain('<AdaptivePathTimeline');
    expect(timelineSource).toContain('data-adaptive-path-node-detail="inline"');
    expect(source).toContain('data-adaptive-path-skip-warning="visible"');
    expect(source).toContain('data-adaptive-path-history-surface="timeline-evidence"');
    expect(source).toContain('data-adaptive-path-history-timeline="governed-activity"');
    expect(source).toContain('当前学习路径');
    expect(source).toContain('当前节点');
    expect(source).toContain('预计剩余');
    expect(source).toContain('完成节点');
    expect(source).toContain('检查点通过');
    expect(source).toContain('data-adaptive-path-node-selection-basis=');
    expect(source).toContain('data-adaptive-path-node-latest-adjustment=');
    expect(source).toContain('data-adaptive-path-node-current-lock="governed"');
    expect(source).toContain('入选依据');
    expect(source).toContain('最近调整');
    expect(source).toContain('当前锁定原因');
    expect(source).toContain('该路径生成时尚未记录节点级入选依据');
    expect(source).toContain('节点安排说明');
    expect(source).toContain('将收集的学习证据');
    expect(source).toContain('检查标准');
    expect(source).toContain('回顾');
    expect(source).toContain('继续互动');
    expect(source).toContain('查看证据');
    expect(journeyControlSource).toContain('开始学习');
    expect(source).toContain('跳过');
    expect(source).toContain('跳过后该资源不会计入完成进度，但会记录为路径偏离，可稍后返回。');
    expect(source).toContain('title="学习记录"');
    expect(source).toContain('moduleId="current-path"');
    expect(source).toContain('moduleId="learning-record"');
    expect(moduleSource).toContain('data-adaptive-path-module={moduleId}');
    expect(moduleSource).toContain('data-adaptive-path-module-state={isOpen ? \'expanded\' : \'collapsed\'}');
    expect(moduleSource).toContain('data-adaptive-path-module-header="responsive"');
    expect(source).toContain('setOpenPathModuleId((current) => (current === moduleId ? null : moduleId))');
    expect(timelineSource).toContain('data-adaptive-path-route-flow="connected"');
    expect(timelineSource).toContain('data-adaptive-path-route-connector="adaptive"');
    expect(timelineSource).toContain('data-adaptive-path-node-selectable="true"');
    expect(timelineSource).toContain('aria-pressed={focused}');
    expect(source).toContain('activeExecutionPathId');
    expect(source).toContain('intent=path-execution&pathId=');
    expect(source).toContain('currentPathNode?.title');
    expect(source).toContain('promotedCurrentNode');
    expect(source).toContain('findNextPromotableExecutionNode(nodes, currentIndex)');
    expect(source).toContain("node.status === 'locked' || node.status === 'blocked'");
    expect(source).toContain('return null');
    expect(source).toContain("? { ...node, status: 'current' }");
    expect(source).toContain('resolveAdaptivePathExecutionNodeStatus({');
    expect(source).toContain("['locked', 'evidence-needed', 'needs-preparation'].includes(node.readinessState)");
    expect(source).toContain("node.status !== 'completed' && node.status !== 'skipped'");
    expect(source).not.toContain("selectedNode?.status === 'skipped'");
    expect(source).not.toContain('setSelectedPathNodeId(currentPathNode.nodeId)');
    expect(source).toContain('查看节点');
    expect(source).toContain('等待前置节点');
    expect(source).toContain('data-adaptive-path-evidence-sources="complete"');
    expect(source).toContain('data-adaptive-path-evidence-states="student-safe"');
    expect(source).toContain('检查点未通过');
    expect(source).toContain('外部资源引用');
    expect(source).toContain('控灵干预');
    expect(timelineSource).toContain('互动课程');
    expect(timelineSource).toContain('自适应练习');
    expect(timelineSource).toContain('控制工作台');
    expect(timelineSource).toContain('虚拟仿真');
    expect(timelineSource).toContain('Arena');
    expect(timelineSource).toContain('外部资源');
    expect(timelineSource).toContain('控灵建议');
    expect(timelineSource).toContain('知识卡');
    expect(source).toContain('已记录');
    expect(source).toContain('待复核');
    expect(source).toContain('可用于推荐');
    expect(source).toContain('仅作参考');
    expect(source).toContain('function getPathActivityStateLabel');
    expect(source).toContain("activityKind === 'checkpoint-fail'");
    expect(source).toContain("status === 'low-confidence'");
    expect(source).toContain("resourceType === 'external_resource'");
    expect(source).toContain("return '待复核'");
    expect(source).toContain("return '仅作参考'");
    expect(source).not.toContain("node.resourceLabel === '知识卡' ? '互动课程'");
    expect(source).toContain("'continued-interaction'");
    expect(source).toContain("pathActivityKind: activityKind");
    expect(source).toContain("deviationType: 'skip'");
    expect(source).toContain('function formatPathNodeReason');
    expect(source).toContain("'matches-knowledge-deficit': '针对当前薄弱知识点安排。'");
    expect(source).toContain("'matches-competency-deficit': '针对当前能力短板安排。'");
    expect(source).toContain("'risk-intervention-fit': '适合用于处理当前学习风险。'");
    expect(source).toContain("'policy-simulation-driven': '优先通过仿真验证理解。'");
    expect(source).toContain('reason: formatPathNodeReason(reasonCodes)');
    expect(source).not.toContain("reasonCodes.length > 0 ? reasonCodes.join('、')");
    expect(source).toContain('): Promise<boolean> =>');
    expect(source).toContain('const activityWritten = await writePathNodeActivity');
    expect(source).toContain('if (!activityWritten) return;');
    expect(source).toContain('window.location.assign(withFeedbackTaskHref(pathNodeContextHref');
    expect(source).toContain("goalId: AdaptivePracticeGoalId");
    expect(source).toContain('function resolveAdaptivePracticeGoalId');
    expect(source).toContain('goalId: resolveAdaptivePracticeGoalId');
    expect(source).toContain('activePathPlan?.goal.id ?? activePathRound?.goalId ?? activeGoal');
    expect(source).toContain("new URLSearchParams({ goal: goalId, intent: 'path-execution', nodeId: node.nodeId })");
    expect(source).not.toContain("new URLSearchParams({ goal: 'control-correction', intent: 'path-execution', nodeId: node.nodeId })");
    expect(source).not.toContain('Readiness Gate');
    expect(source).not.toContain('入口意图：');
    expect(source).not.toContain('terminal-validation-unavailable');
  });

  it('binds growth center to grouped learner timeline and stable chart containers', () => {
    const source = readFileSync(join(repoRoot, 'src/app/(main)/profile/growth/page.tsx'), 'utf8');

    expect(source).toContain("fetch('/api/student/competency-snapshot')");
    expect(source).not.toContain('timeRange');
    expect(source).not.toContain("'7d'");
    expect(source).not.toContain("'30d'");
    expect(source).not.toContain("'90d'");
    expect(source).not.toContain('learning_activity');
    expect(source).not.toContain('本周学习热度');
    expect(source).not.toContain('本周进步');
    expect(source).not.toContain('Date.now()');
    expect(source).not.toContain('ai_misuse');
    expect(source).not.toContain('participation');
    expect(source).toContain('累计能力达成、证据覆盖与成长记录');
    expect(source).toContain('累计画像生成时间');
    expect(source).toContain('累计证据截止');
    expect(source).toContain("if (outcome === 'cumulative') return '累计'");
    expect(source).toContain('data-portrait-evidence-as-of');
    expect(source).toContain('currentSnapshot.evidenceAsOf');
    expect(source).toContain('最后能力趋势');
    expect(source).toContain('snapshot?.lastTrend');
    expect(source).toContain('最后证据风险');
    expect(source).toContain('七维证据覆盖');
    expect(source).toContain('这些维度不参与累计总分，也不会显示为零分');
    expect(source).toContain('data-portrait-availability');
    expect(source).toContain('尚无持久、有效的累计成长事件');
    expect(source).toContain('groupGrowthTimelineRecords');
    expect(source).toContain('groupedGrowthRecords');
    expect(source).toContain('重复记录');
    expect(source).toContain('while (nextIndex < records.length && lowSignalGrowthRecordKey(records[nextIndex]) === key)');
    expect(source).not.toContain('const emittedGroups = new Set<string>();');
    expect(source).toContain('min-h-[320px]');
    expect(source).toContain('min-w-0');
    expect(source).toContain('hasCompetencyChartData');
    expect(source).toContain('开始练习');
  });

  it('reserves a safe area for learner route floating controls on mobile', () => {
    const source = readFileSync(join(repoRoot, 'src/app/globals.css'), 'utf8');

    expect(source).toContain('--learner-floating-dock-safe-inline');
    expect(source).toContain('[data-route-family="learner-data-pathway"]');
    expect(source).toContain('padding-right: var(--learner-floating-dock-safe-inline)');
  });

  it('builds learner-state and mastery panels from server-owned learner state instead of client profile hints', () => {
    const view = buildAdaptiveLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      clientProfileHints: {
        overallScore: 100,
        preferredModality: 'text-only',
      },
    });

    expect(view.mode).toBe('adaptive-learning-center');
    expect(view.panels.map((panel) => panel.region)).toEqual(expect.arrayContaining(['learner-state', 'mastery']));
    expect(view.authority).toBe('server-owned');
    expect(view.status.source.domain).toBe('learner-state');
    expect(
      buildAdaptiveLearningCenterView({
        featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
        learnerState: learnerState({
          evidence: {
            ...learnerState().evidence,
            sourceCoverage: {
              primaryCompetencies: 'available',
              knowledgeMastery: 'available',
              resourcePreference: 'available',
            },
          },
          missingEvidence: [],
        }),
      }).status.categories.sourceCoverage,
    ).toBe('complete');
    expect(
      buildAdaptiveLearningCenterView({
        featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
        learnerState: learnerState({
          evidence: {
            ...learnerState().evidence,
            readState: 'stale',
            sourceCoverage: {
              primaryCompetencies: 'available',
              knowledgeMastery: 'available',
              resourcePreference: 'available',
            },
          },
          missingEvidence: [],
        }),
      }).status.categories.sourceCoverage,
    ).toBe('stale');
    expect(view.status.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '学习状态权威来源', value: 'server-owned' }),
        expect.objectContaining({ label: '客户端画像提示', value: '已接收但不作为权威输入' }),
      ]),
    );
    expect(view.panels.map((panel) => panel.id)).not.toContain('client-profile-hints');
  });

  it('renders rules-plus-graph path map, timeline, and evidence payloads without requiring Stage 2 optimization', () => {
    const view = buildAdaptiveLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      pathPlan: pathPlan(),
    });

    const pathPanels = view.panels.filter((panel) => ['path-map', 'timeline', 'evidence'].includes(panel.region));

    expect(pathPanels.map((panel) => panel.region)).toEqual(['path-map', 'timeline', 'evidence']);
    expect(pathPanels.map((panel) => panel.status.source.domain)).toEqual(['path', 'path', 'path']);
    expect(pathPanels[0].payload).toMatchObject({ currentNodeId: 'node-1', mainPathNodeIds: ['node-1'] });
    expect(pathPanels[1].payload).toMatchObject({ windows: [{ days: 7, nodeIds: ['node-1'], estimatedMinutes: 15 }] });
    expect(pathPanels[2].payload).toMatchObject({
      evidenceBasis: 'adaptive-learner-state',
      learnerStateDeficits: [expect.objectContaining({ targetId: 'phase-margin' })],
    });
    expect(view.excludedPolicyFamilies).toEqual(['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid']);
  });

  it('renders recommended path nodes as staged learner route nodes with action and evidence state', () => {
    const node = buildRecommendedPathNodeView(pathPlan()).nodes[0];

    expect(node).toMatchObject({
      stage: 'stage-1-rules-graph',
      nodeId: 'node-1',
      title: '相位裕度映射练习',
      priority: 1,
      confidence: 'low',
      evidenceLimitation: 'partial',
      expectedEffort: '15 分钟',
      sourceContext: 'runtime_lesson_step:lesson-3-8',
      action: {
        href: '/assessment/adaptive-practice',
        label: '继续当前节点',
      },
      state: 'current',
    });
  });

  it('keeps locked recommended path nodes visible without a launch action', () => {
    const baseNode = pathPlan().mainPath[0];
    const nodes = buildRecommendedPathNodeView(pathPlan({
      mainPath: [
        baseNode,
        {
          ...baseNode,
          nodeId: 'arena-task:task-second-order-lead-pid',
          title: '二阶对象超前校正 Arena',
          type: 'arena_task',
          ...pathNodeSemantics('arena_task'),
          sourceKind: 'arena_task',
          sourceRef: 'task-second-order-lead-pid',
          target: '/arena/challenges/task-second-order-lead-pid',
          estimatedTimeMinutes: 18,
          prerequisiteNodeIds: ['simulation:control-correction-step-response-lab'],
          terminalConstraints: ['terminal-node', 'terminal-validation'],
          status: 'locked',
          readiness: {
            state: 'locked',
            message: 'Arena 暂未解锁，完成仿真验证后会自动进入。',
            unlockMessage: 'Arena 暂未解锁，完成仿真验证后会自动进入。',
            reasonCodes: ['readiness-minimum-competency'],
            fallbackNodeIds: ['simulation:control-correction-step-response-lab'],
            missingCompetencies: ['controlModeling'],
            missingEvidenceCount: 0,
            missingCompletedNodeIds: [],
            missingOutcomeRefs: [],
          },
        },
      ],
    })).nodes;

    expect(nodes[1]).toMatchObject({
      nodeId: 'arena-task:task-second-order-lead-pid',
      state: 'locked',
      statusLabel: '稍后解锁',
      unlockMessage: 'Arena 暂未解锁，完成仿真验证后会自动进入。',
    });
    expect(nodes[1].action).toBeUndefined();
  });

  it('keeps completed recommended path nodes completed when stale readiness is locked', () => {
    const baseNode = pathPlan().mainPath[0];
    const node = buildRecommendedPathNodeView(pathPlan({
      currentNodeId: null,
      mainPath: [
        {
          ...baseNode,
          status: 'completed',
          readiness: {
            state: 'locked',
            message: '旧 readiness 尚未刷新。',
            unlockMessage: '旧 readiness 尚未刷新。',
            reasonCodes: ['readiness-required-outcome'],
            fallbackNodeIds: [],
            missingCompetencies: [],
            missingEvidenceCount: 0,
            missingCompletedNodeIds: [],
            missingOutcomeRefs: ['simulation_run:control-correction-step-response-lab'],
          },
        },
      ],
    })).nodes[0];

    expect(node).toMatchObject({
      nodeId: 'node-1',
      state: 'completed',
      statusLabel: undefined,
    });
    expect(node.action).toBeDefined();
  });

  it('does not launch next recommended nodes when readiness is stale locked', () => {
    const baseNode = pathPlan().mainPath[0];
    const node = buildRecommendedPathNodeView(pathPlan({
      currentNodeId: null,
      mainPath: [
        {
          ...baseNode,
          status: 'next',
          readiness: {
            state: 'locked',
            message: '等待仿真证据。',
            unlockMessage: '等待仿真证据。',
            reasonCodes: ['readiness-required-outcome'],
            fallbackNodeIds: [],
            missingCompetencies: [],
            missingEvidenceCount: 0,
            missingCompletedNodeIds: [],
            missingOutcomeRefs: ['simulation_run:control-correction-step-response-lab'],
          },
        },
      ],
    })).nodes[0];

    expect(node).toMatchObject({
      nodeId: 'node-1',
      state: 'locked',
      statusLabel: '稍后解锁',
    });
    expect(node.action).toBeUndefined();
  });

  it('does not select a ready node after a locked gate as the control-correction next action', () => {
    const baseNode = pathPlan().mainPath[0];
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      pathPlan: pathPlan({
        currentNodeId: 'registry:lesson09-correction-precheck',
        mainPath: [
          {
            ...baseNode,
            nodeId: 'registry:lesson09-correction-precheck',
            title: '控制校正目标前测',
            type: 'quiz',
            ...pathNodeSemantics('quiz'),
            sourceKind: 'resource_registry',
            sourceRef: 'lesson09-correction-precheck',
            target: '/interactive-learning/resources/lesson09-correction-precheck',
            status: 'completed',
          },
          {
            ...baseNode,
            nodeId: 'simulation:control-correction-step-response-lab',
            title: '控制校正阶跃响应验证实验',
            type: 'simulation',
            ...pathNodeSemantics('simulation'),
            sourceKind: 'simulation_resource',
            sourceRef: 'control-correction-step-response-lab',
            target: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11',
            status: 'locked',
            readiness: {
              state: 'locked',
              message: '完成控制校正目标前测后进入仿真验证。',
              unlockMessage: '完成控制校正目标前测后进入仿真验证。',
              reasonCodes: ['readiness-required-completion'],
              fallbackNodeIds: ['registry:lesson09-correction-precheck'],
              missingCompetencies: [],
              missingEvidenceCount: 0,
              missingCompletedNodeIds: ['registry:lesson09-correction-precheck'],
              missingOutcomeRefs: [],
            },
          },
          {
            ...baseNode,
            nodeId: 'registry:later-ready-practice',
            title: '后续就绪练习',
            type: 'quiz',
            ...pathNodeSemantics('quiz'),
            sourceKind: 'resource_registry',
            sourceRef: 'later-ready-practice',
            target: '/interactive-learning/resources/later-ready-practice',
            status: 'next',
          },
        ],
      }),
    });

    expect(view.nextAction.nodeId).toBeNull();
    expect(view.nextAction.href).not.toContain('later-ready-practice');
  });

  it('surfaces three-style path options and selection history for diagnosis panels', () => {
    const mainPathNode = pathPlan().mainPath[0];
    const policyOptionNodes: AdaptiveLearningPathPlan['mainPath'] = [
      {
        ...mainPathNode,
        nodeId: 'knowledge-card:targets',
        title: '目标知识卡',
      },
      {
        ...mainPathNode,
        nodeId: 'arena-task:terminal',
        title: '终端 Arena',
        prerequisiteNodeIds: ['knowledge-card:targets'],
        status: 'locked',
        readiness: {
          state: 'locked',
          message: '完成目标知识卡后解锁。',
          unlockMessage: '完成目标知识卡后解锁。',
          reasonCodes: ['readiness-required-completion'],
          fallbackNodeIds: [],
          missingCompetencies: [],
          missingEvidenceCount: 0,
          missingCompletedNodeIds: ['knowledge-card:targets'],
          missingOutcomeRefs: [],
        },
      },
    ];
    const view = buildAdaptiveLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      pathPlan: pathPlan({
        policyBundle: {
          families: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
          overlapThreshold: 0.6,
          status: 'ready',
          paths: [
            {
              styleId: 'preference-matched-route',
              policyFamily: 'preference-matched',
              label: '空资源方案',
              nodeIds: [],
              activeNodeIds: [],
              lockedNodeIds: [],
              readinessSummary: [],
              unlockMessages: [],
              nodeSummaries: [],
              targetDeficits: [],
              evidenceBasis: ['adaptive-learner-state'],
              estimatedMinutes: 0,
              modalityMix: {},
              resourceMix: {},
              overlap: { maxWithOtherOptions: 1 },
              effort: { estimatedMinutes: 0, relative: 'short' },
              expectedTargetLift: 0,
              terminalValidationNodeIds: [],
              terminalValidationStrategy: { nodeIds: [], summary: 'terminal validation unavailable' },
              checkpointNodeIds: [],
              limitations: ['policy-path-resource-missing'],
            },
            {
              styleId: 'foundation-remediation',
              policyFamily: 'foundation-remediation',
              label: '基础补救',
              nodeIds: ['knowledge-card:targets', 'arena-task:terminal'],
              activeNodeIds: ['knowledge-card:targets'],
              lockedNodeIds: ['arena-task:terminal'],
              readinessSummary: [
                {
                  nodeId: 'arena-task:terminal',
                  state: 'locked',
                  message: '完成目标知识卡后解锁。',
                },
              ],
              unlockMessages: [],
              planNodes: policyOptionNodes,
              nodeSummaries: [
                {
                  nodeId: 'knowledge-card:targets',
                  title: '目标知识卡',
                  pathNodeType: 'knowledge_card',
                  displayName: '知识卡',
                  iconKey: 'knowledge-card',
                  shapeHint: 'card',
                  evidenceBehavior: 'view',
                  evidenceStatus: 'instrumented',
                  estimatedTimeMinutes: 10,
                  status: 'current',
                },
                {
                  nodeId: 'arena-task:terminal',
                  title: '终端 Arena',
                  pathNodeType: 'arena_task',
                  displayName: 'Arena 挑战',
                  iconKey: 'arena',
                  shapeHint: 'challenge',
                  evidenceBehavior: 'judged_submission',
                  evidenceStatus: 'instrumented',
                  estimatedTimeMinutes: 28,
                  status: 'next',
                },
              ],
              targetDeficits: [{ targetId: 'phase-margin', kind: 'knowledge', value: 0.42, confidence: 0.6, evidenceCount: 3, reasonCode: 'low-mastery-target' }],
              evidenceBasis: ['adaptive-learner-state', 'LearningFact'],
              estimatedMinutes: 38,
              modalityMix: { knowledge_card: 1, arena_task: 1 },
              resourceMix: { knowledge_card: 1, arena_task: 1 },
              overlap: { maxWithOtherOptions: 0.4 },
              effort: { estimatedMinutes: 38, relative: 'medium' },
              expectedTargetLift: 1.2,
              terminalValidationNodeIds: ['arena-task:terminal'],
              terminalValidationStrategy: { nodeIds: ['arena-task:terminal'], summary: 'official Arena validation' },
              checkpointNodeIds: ['arena-task:terminal'],
              limitations: ['some-targets-have-no-direct-evidence'],
            },
          ],
          diversity: {
            maxResourceOverlap: 0.4,
            minModalityDistance: 0.5,
            minEstimatedEffortDifference: 0.2,
            minTerminalValidationDifference: 0,
            pairwiseResourceOverlap: [],
            pairwiseModalityDistance: [],
            pairwiseEstimatedEffortDifference: [],
            pairwiseTerminalValidationDifference: [],
            modalityMixByPolicy: { 'foundation-remediation': { knowledge_card: 1, arena_task: 1 } },
            estimatedEffortByPolicy: { 'foundation-remediation': 38 },
            terminalValidationDifference: 0,
          },
          fallbackReasons: [],
        },
        feedbackEvents: [
          {
            id: 'feedback-selection-1',
            type: 'selection',
            nodeId: null,
            createdAt: '2026-05-28T06:05:00.000Z',
            context: {
              selectedStyleId: 'foundation-remediation',
              rejectedStyleIds: ['arena-simulation-sprint'],
            },
          },
          {
            id: 'feedback-helpfulness-1',
            type: 'helpfulness',
            nodeId: null,
            createdAt: '2026-05-28T06:07:00.000Z',
            helpful: true,
            context: {
              selectedStyleId: 'foundation-remediation',
            },
          },
        ],
      }),
    });

    const currentPath = view.panels.find((panel) => panel.region === 'current-path');
    expect(currentPath?.payload).toMatchObject({
      pathOptions: [
        {
          optionId: 'path-option-2',
          label: '基础补救',
          nodeSummaries: [
            expect.objectContaining({
              nodeId: 'knowledge-card:targets',
              pathNodeType: 'knowledge_card',
              iconKey: 'knowledge-card',
              shapeHint: 'card',
            }),
            expect.objectContaining({
              nodeId: 'arena-task:terminal',
              pathNodeType: 'arena_task',
              iconKey: 'arena',
              shapeHint: 'challenge',
            }),
          ],
          evidenceBasis: ['学习证据', '练习记录'],
          lockedNodeIds: ['arena-task:terminal'],
          readinessSummary: [
            {
              nodeId: 'arena-task:terminal',
              state: 'locked',
              message: '完成目标知识卡后解锁。',
            },
          ],
          readinessDetails: expect.arrayContaining([
            expect.objectContaining({
              nodeId: 'arena-task:terminal',
              prerequisiteNodeIds: ['knowledge-card:targets'],
              readiness: expect.objectContaining({
                missingCompletedNodeIds: ['knowledge-card:targets'],
              }),
            }),
          ]),
          terminalValidationNodeIds: ['arena-task:terminal'],
          limitations: ['部分目标还缺少直接证据'],
        },
      ],
      selectionHistory: [
        {
          type: 'selection',
          selectedOptionLabel: '基础补救',
          rejectedOptionLabels: ['未采用路径'],
        },
        {
          type: 'helpfulness',
          selectedOptionLabel: '基础补救',
          helpful: true,
        },
      ],
    });

    const pathOptions = (currentPath?.payload as { pathOptions?: AdaptivePathOptionWriteOption[] } | null)
      ?.pathOptions ?? [];
    const [optionDisplay] = buildAdaptivePathOptionDisplays(pathOptions);
    expect(optionDisplay?.orderedNodes?.find((node) => node.nodeId === 'arena-task:terminal')?.unlockChain)
      .toMatchObject({
        canExplain: true,
        missingConditions: [expect.objectContaining({ title: '完成「目标知识卡」' })],
      });

    const mastery = view.panels.find((panel) => panel.region === 'mastery');
    expect(mastery?.payload).toEqual(learnerState().knowledgeMastery);
    expect(JSON.stringify(mastery?.payload)).not.toContain('selectionHistory');
    expect(JSON.stringify(mastery?.payload)).not.toContain('foundation-remediation');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('rules-plus-graph-search');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('stage-1-rules-graph');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('foundation-remediation');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('arena-simulation-sprint');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('some-targets-have-no-direct-evidence');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('terminal-validation-');
  });

  it('exposes governed fallback path options while keeping fallback limitations visible', () => {
    const view = buildAdaptiveLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      pathPlan: pathPlan({
        policyBundle: {
          families: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
          overlapThreshold: 0.6,
          status: 'low-resource-fallback',
          paths: [
            {
              styleId: 'foundation-remediation',
              policyFamily: 'foundation-remediation',
              label: '基础补救',
              nodeIds: ['node-1'],
              activeNodeIds: ['node-1'],
              lockedNodeIds: [],
              readinessSummary: [],
              unlockMessages: [],
              nodeSummaries: [{
                nodeId: 'node-1',
                title: '相位裕度映射练习',
                pathNodeType: 'adaptive_quiz',
                displayName: '自适应练习',
                iconKey: 'adaptive-quiz',
                shapeHint: 'task',
                evidenceBehavior: 'assessment',
                evidenceStatus: 'instrumented',
                estimatedTimeMinutes: 15,
                status: 'current',
              }],
              targetDeficits: [],
              evidenceBasis: ['adaptive-learner-state'],
              estimatedMinutes: 15,
              modalityMix: { quiz: 1 },
              resourceMix: { quiz: 1 },
              overlap: { maxWithOtherOptions: 1 },
              effort: { estimatedMinutes: 15, relative: 'short' },
              expectedTargetLift: 0.8,
              terminalValidationNodeIds: [],
              terminalValidationStrategy: { nodeIds: [], summary: 'terminal validation unavailable' },
              checkpointNodeIds: ['node-1'],
              limitations: ['terminal-validation-missing'],
            },
          ],
          diversity: {
            maxResourceOverlap: 1,
            minModalityDistance: 0,
            minEstimatedEffortDifference: 0,
            minTerminalValidationDifference: 0,
            pairwiseResourceOverlap: [],
            pairwiseModalityDistance: [],
            pairwiseEstimatedEffortDifference: [],
            pairwiseTerminalValidationDifference: [],
            modalityMixByPolicy: { 'foundation-remediation': { quiz: 1 } },
            estimatedEffortByPolicy: { 'foundation-remediation': 15 },
            terminalValidationDifference: 0,
          },
          fallbackReasons: [
            'path-diversity-insufficient',
            'terminal-validation-diversity-insufficient',
            'policy-option-diversity-unavailable',
          ],
        },
        feedbackEvents: [
          {
            id: 'feedback-switch-fallback',
            type: 'switch',
            nodeId: null,
            createdAt: '2026-05-28T06:08:00.000Z',
            context: {
              selectedStyleId: 'foundation-remediation',
              rejectedStyleIds: ['arena-simulation-sprint'],
            },
          },
        ],
      }),
    });

    const currentPath = view.panels.find((panel) => panel.region === 'current-path');
    expect(currentPath?.payload).toMatchObject({
      pathOptions: [
        {
          optionId: 'path-option-1',
          label: '基础补救',
          evidenceBasis: ['学习证据'],
          terminalValidationNodeIds: [],
          limitations: ['需要完成终点检验'],
        },
      ],
      pathOptionFallback: {
        status: 'low-resource-fallback',
        fallbackReasons: ['路径差异不足', '终点检验差异不足', '当前资源只能形成单一推荐方案'],
        diversity: {
          resourceOverlap: 1,
          modalityDistance: 0,
          effortDifference: 0,
        },
      },
    });
    expect(JSON.stringify(currentPath?.payload)).not.toContain('rules-plus-graph-search');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('空资源方案');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('policy-path-resource-missing');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('foundation-remediation');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('arena-simulation-sprint');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('terminal-validation-diversity-insufficient');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('terminal-validation-missing');
    expect(JSON.stringify(currentPath?.payload)).not.toContain('terminal-validation-');
  });

  it('launches control-correction path nodes with path, node, goal, and route intent context', () => {
    const node = buildRecommendedPathNodeView(pathPlan(), {
      goalId: 'control-correction',
      pathId: 'path-1',
      routeIntent: 'path-execution',
    }).nodes[0];

    const query = new URLSearchParams(node.action?.href.split('?')[1] ?? '');
    expect(query.get('source')).toBe('adaptive-path-center');
    expect(query.get('goal')).toBe('control-correction');
    expect(query.get('goalId')).toBe('control-correction');
    expect(query.get('pathId')).toBe('path-1');
    expect(query.get('nodeId')).toBe('node-1');
    expect(query.get('intent')).toBe('path-execution');
    expect(query.get('resourceType')).toBe('quiz');
    expect(query.get('returnHref')).toBe(
      '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1&nodeId=node-1',
    );
    expect(node.action?.href).toBe(
      '/assessment/adaptive-practice?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=path-1&nodeId=node-1&intent=path-execution&returnHref=%2Fassessment%2Fadaptive-practice%3Fgoal%3Dcontrol-correction%26intent%3Dpath-execution%26pathId%3Dpath-1%26nodeId%3Dnode-1&resourceType=quiz',
    );
  });

  it('parses valid path launch return hrefs and rejects non-path launches', () => {
    const launchContext = buildAdaptivePathLaunchContext({
      goalId: 'control-correction',
      pathId: 'path-1',
      nodeId: 'node-1',
      routeIntent: 'path-execution',
      resourceType: 'quiz',
    });
    const params = new URLSearchParams({
      source: launchContext.source,
      goal: launchContext.goalId,
      goalId: launchContext.goalId,
      pathId: launchContext.pathId,
      nodeId: launchContext.nodeId,
      intent: launchContext.routeIntent,
      returnHref: launchContext.returnHref,
      resourceType: launchContext.resourceType,
    });

    expect(resolveAdaptivePathLaunchReturnContext(params)).toEqual({
      source: 'adaptive-path-center',
      goalId: 'control-correction',
      pathId: 'path-1',
      nodeId: 'node-1',
      routeIntent: 'path-execution',
      returnHref: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1&nodeId=node-1',
      resourceType: 'quiz',
    });
    expect(resolveAdaptivePathLaunchReturnContext(new URLSearchParams({
      source: 'chapter-components',
      category: 'time-domain',
      returnHref: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1&nodeId=node-1',
    }))).toBeNull();
    expect(resolveAdaptivePathLaunchReturnContext(new URLSearchParams({
      source: 'adaptive-path-center',
      goal: 'control-correction',
      pathId: 'path-1',
      nodeId: 'node-1',
      intent: 'path-execution',
      resourceType: 'quiz',
      returnHref: 'https://example.com/assessment/adaptive-practice',
    }))).toBeNull();
  });

  it('builds simple path resource completion write-back requests and keeps complex nodes pending', () => {
    const launchContext = buildAdaptivePathLaunchContext({
      goalId: 'control-correction',
      pathId: 'path-1',
      nodeId: 'registry:lesson09-correction-precheck',
      routeIntent: 'path-execution',
      resourceType: 'quiz',
    });
    const request = buildAdaptivePathCompletionRequest({
      launchContext,
      completedAt: '2026-06-18T11:40:00.000Z',
      completionResult: { score: 100, success: true },
    });

    expect(isSimpleAdaptivePathCompletionResource('quiz')).toBe(true);
    expect(request).toEqual({
      href: '/api/learning-paths/path-1/execute',
      method: 'POST',
      body: {
        nodeId: 'registry:lesson09-correction-precheck',
        resourceType: 'quiz',
        status: 'completed',
        completedAt: '2026-06-18T11:40:00.000Z',
        idempotencyKey: 'path-resource-completion:path-1:registry:lesson09-correction-precheck:quiz',
        liftMetadata: {
          pathActivityKind: 'initial-completion',
          completionSource: 'interactive-resource',
          completionResult: { score: 100, success: true },
        },
      },
    });
    expect(isSimpleAdaptivePathCompletionResource('simulation')).toBe(false);
    expect(buildAdaptivePathCompletionRequest({
      launchContext: { ...launchContext, resourceType: 'simulation' },
      completedAt: '2026-06-18T11:40:00.000Z',
    })).toBeNull();
  });

  it('launches external resource path nodes through governed access recording', () => {
    const node = buildRecommendedPathNodeView(pathPlan({
      mainPath: [
        {
          ...pathPlan().mainPath[0],
          nodeId: 'external-resource:ocw-bode',
          title: '外部伯德图资料',
          type: 'external_resource',
          ...pathNodeSemantics('external_resource'),
          sourceKind: 'external_resource',
          sourceRef: 'ocw-bode',
          target: 'https://ocw.mit.edu/control/bode',
          externalResource: {
            source: 'MIT OCW',
            url: 'https://ocw.mit.edu/control/bode',
            estimatedTimeMinutes: 15,
            knowledgeCoverage: ['phase-margin'],
            applicableGoalId: 'control-correction',
            evidenceUseStatus: 'explicit-access-required',
            privacyPolicy: 'student-visible',
          },
          evidenceStatus: 'explicit-access-required',
        },
      ],
      currentNodeId: 'external-resource:ocw-bode',
    }), {
      goalId: 'control-correction',
      pathId: 'path-1',
      routeIntent: 'path-execution',
    }).nodes[0];

    expect(node.action).toMatchObject({
      href: '/api/learning-paths/path-1/execute',
      method: 'POST',
      redirectHref: 'https://ocw.mit.edu/control/bode',
      body: {
        nodeId: 'external-resource:ocw-bode',
        resourceType: 'external_resource',
        status: 'started',
        idempotencyKey: 'external-resource-access:path-1:external-resource:ocw-bode',
        liftMetadata: {
          launchIntent: 'path-execution',
        },
      },
      completionAction: {
        href: '/api/learning-paths/path-1/execute',
        label: '已学习该资料，继续路径',
        method: 'POST',
        body: {
          nodeId: 'external-resource:ocw-bode',
          resourceType: 'external_resource',
          status: 'completed',
          idempotencyKey: 'external-resource-completion:path-1:external-resource:ocw-bode',
          liftMetadata: {
            launchIntent: 'path-execution',
            completionIntent: 'learner-confirmed-external-resource',
          },
        },
      },
    });
    expect(node.action?.href).not.toContain('https://ocw.mit.edu/control/bode');
  });

  it('normalizes persisted knowledge card targets before adding control-correction launch context', () => {
    const node = buildRecommendedPathNodeView(pathPlan({
      goal: {
        id: 'control-correction',
        title: '控制校正路径',
        knowledgeTargets: ['phase-margin'],
      },
      mainPath: [
        {
          ...pathPlan().mainPath[0],
          target: 'course-content/runtime/knowledge/cards/nodes/时域指标到目标极点区域_3_36001.md',
        },
      ],
    }), {
      goalId: 'control-correction',
      pathId: 'path-1',
      routeIntent: 'path-execution',
    }).nodes[0];

    expect(node.action?.href).toBe(
      '/course-runtime/knowledge/cards/nodes/时域指标到目标极点区域_3_36001.md?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=path-1&nodeId=node-1&intent=path-execution&returnHref=%2Fassessment%2Fadaptive-practice%3Fgoal%3Dcontrol-correction%26intent%3Dpath-execution%26pathId%3Dpath-1%26nodeId%3Dnode-1&resourceType=quiz',
    );
  });

  it('builds the control-correction center with hero, next action, readiness, citations, and Konling dock', () => {
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState({ missingEvidence: [] }),
      pathPlan: pathPlan({
        goal: {
          id: 'control-correction',
          title: '控制校正路径',
          knowledgeTargets: ['phase-margin'],
        },
        confidence: {
          level: 'medium',
          score: 0.72,
          sourceCoverage: 0.8,
        },
      }),
      konling: {
        contextSource: 'learner-state-and-path',
        teachingAssistantModes: {
          diagnosisExplainer: 'diagnosis-explainer',
          pathAdvisor: 'path-advisor',
          resourceCoach: 'resource-coach',
        },
        interventionBasis: 'control-correction-next-node',
        cooldown: { active: false, until: null },
        feedback: { state: 'pending' },
      },
      entrySource: 'student-cockpit',
      routeIntent: 'path-execution',
    });

    expect(view.goalId).toBe('control-correction');
    expect(view.entry).toEqual({ source: 'student-cockpit', routeIntent: 'path-execution' });
    expect(view.competencyHero).toMatchObject({
      id: 'control-correction-competency-hero',
      region: 'mastery',
      title: '控制校正能力状态',
    });
    expect(view.nextAction).toMatchObject({
      nodeId: 'node-1',
      href: '/assessment/adaptive-practice?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=path-1&nodeId=node-1&intent=path-execution&returnHref=%2Fassessment%2Fadaptive-practice%3Fgoal%3Dcontrol-correction%26intent%3Dpath-execution%26pathId%3Dpath-1%26nodeId%3Dnode-1&resourceType=quiz',
      confidence: 'medium',
      evidenceLimitation: 'complete',
    });
    expect(view.readinessGate.ready).toBe(true);
    expect(view.readinessGate.missing).toEqual([]);
    expect(view.citationAccess.id).toBe('control-correction-citation-drawer');
    expect(view.konlingDock.id).toBe('control-correction-konling-dock');
    expect(view.launchContexts).toEqual([
      {
        goalId: 'control-correction',
        pathId: 'path-1',
        nodeId: 'node-1',
        routeIntent: 'path-execution',
        source: 'adaptive-path-center',
        returnHref: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1&nodeId=node-1',
        resourceType: 'quiz',
      },
    ]);
  });

  it('keeps path node launches returnable to path execution from non-execution entries', () => {
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState({ missingEvidence: [] }),
      pathPlan: pathPlan({
        goal: {
          id: 'control-correction',
          title: '控制校正路径',
          knowledgeTargets: ['phase-margin'],
        },
      }),
      routeIntent: 'practice',
    });
    const query = new URLSearchParams(view.nextAction.href.split('?')[1] ?? '');
    const returnContext = resolveAdaptivePathLaunchReturnContext(query);

    expect(view.entry.routeIntent).toBe('practice');
    expect(query.get('intent')).toBe('path-execution');
    expect(returnContext).toMatchObject({
      source: 'adaptive-path-center',
      goalId: 'control-correction',
      pathId: 'path-1',
      nodeId: 'node-1',
      routeIntent: 'path-execution',
      resourceType: 'quiz',
    });
    expect(returnContext?.returnHref).toBe(
      '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1&nodeId=node-1',
    );
  });

  it('overwrites stale goal and intent query keys on path node launch targets', () => {
    const node = buildRecommendedPathNodeView(pathPlan({
      goal: {
        id: 'control-correction',
        title: '控制校正路径',
        knowledgeTargets: ['phase-margin'],
      },
      mainPath: [
        {
          ...pathPlan().mainPath[0],
          target: '/assessment/adaptive-practice?goal=frequency-response-foundations&intent=practice&focus=diagnostic',
        },
      ],
    }), {
      goalId: 'control-correction',
      pathId: 'path-1',
      routeIntent: 'path-execution',
    }).nodes[0];
    const query = new URLSearchParams(node.action?.href.split('?')[1] ?? '');

    expect(query.getAll('goal')).toEqual(['control-correction']);
    expect(query.getAll('intent')).toEqual(['path-execution']);
    expect(query.get('focus')).toBe('diagnostic');
    expect(resolveAdaptivePathLaunchReturnContext(query)).toMatchObject({
      goalId: 'control-correction',
      pathId: 'path-1',
      nodeId: 'node-1',
      routeIntent: 'path-execution',
    });
  });

  it('exposes external resource completion on the control-correction next action', () => {
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState({ missingEvidence: [] }),
      pathPlan: pathPlan({
        goal: {
          id: 'control-correction',
          title: '控制校正路径',
          knowledgeTargets: ['phase-margin'],
        },
        mainPath: [
          {
            ...pathPlan().mainPath[0],
            nodeId: 'external-resource:ocw-bode',
            title: '外部伯德图资料',
            type: 'external_resource',
            ...pathNodeSemantics('external_resource'),
            sourceKind: 'external_resource',
            sourceRef: 'ocw-bode',
            target: 'https://ocw.mit.edu/control/bode',
            externalResource: {
              source: 'MIT OCW',
              url: 'https://ocw.mit.edu/control/bode',
              estimatedTimeMinutes: 15,
              knowledgeCoverage: ['phase-margin'],
              applicableGoalId: 'control-correction',
              evidenceUseStatus: 'explicit-access-required',
              privacyPolicy: 'student-visible',
            },
            evidenceStatus: 'explicit-access-required',
          },
        ],
        currentNodeId: 'external-resource:ocw-bode',
      }),
      routeIntent: 'path-execution',
    });

    expect(view.nextAction).toMatchObject({
      nodeId: 'external-resource:ocw-bode',
      href: '/api/learning-paths/path-1/execute',
      method: 'POST',
      redirectHref: 'https://ocw.mit.edu/control/bode',
      body: {
        nodeId: 'external-resource:ocw-bode',
        resourceType: 'external_resource',
        status: 'started',
      },
      completionAction: {
        href: '/api/learning-paths/path-1/execute',
        label: '已学习该资料，继续路径',
        method: 'POST',
        body: {
          nodeId: 'external-resource:ocw-bode',
          resourceType: 'external_resource',
          status: 'completed',
          idempotencyKey: 'external-resource-completion:path-1:external-resource:ocw-bode',
        },
      },
    });
  });

  it('renders actionable control-correction fallback states without private internals', () => {
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [],
      learnerState: learnerState({
        evidence: {
          ...learnerState().evidence,
          readState: 'stale',
        },
      }),
      pathPlan: null,
      networkError: true,
      questionAvailable: false,
      routeIntent: 'practice',
    });

    expect(view.readinessGate.ready).toBe(false);
    expect(view.fallbackStates.map((state) => state.state)).toEqual([
      'feature-flag-disabled',
      'network-error',
      'loading',
      'low-evidence',
      'no-path',
    ]);
    expect(view.fallbackStates.every((state) => state.actions.length >= 2)).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/rawTrace|hiddenArena|rawAnswer|privateKonlingMemory|secret/i);
  });

  it('surfaces no-question state when a control-correction path has no available practice item', () => {
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState({ missingEvidence: [] }),
      pathPlan: pathPlan({
        goal: {
          id: 'control-correction',
          title: '控制校正路径',
          knowledgeTargets: ['phase-margin'],
        },
        currentNodeId: null,
      }),
      questionAvailable: false,
    });

    expect(view.fallbackStates.map((state) => state.state)).toEqual(['no-question', 'path-ready']);
    expect(view.readinessGate.ready).toBe(false);
    expect(view.fallbackStates.find((state) => state.state === 'no-question')?.actions).toEqual(
      expect.arrayContaining([
        {
          href: '/interactive-learning?goal=control-correction',
          label: '打开互动学习',
        },
      ]),
    );
  });

  it('keeps registered non-control paths visible without relabeling launch contexts', () => {
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState({ missingEvidence: [] }),
      pathPlan: pathPlan({
        goal: {
          id: 'frequency-response-foundations',
          title: '频率响应基础',
          knowledgeTargets: ['kn-bode'],
        },
      }),
    });

    expect(view.goalId).toBe('frequency-response-foundations');
    expect(view.launchContexts).toEqual([
      expect.objectContaining({
        goalId: 'frequency-response-foundations',
        pathId: 'path-1',
        nodeId: 'node-1',
      }),
    ]);
    expect(view.nextAction.nodeId).toBe('node-1');
    expect(view.nextAction.href).toContain('goal=frequency-response-foundations');
    expect(JSON.stringify(view.fallbackStates)).toContain('goal=frequency-response-foundations');
    expect(JSON.stringify(view.fallbackStates)).not.toContain('goal=control-correction');
    expect(view.readinessGate.missing).not.toContain('no-path');
  });

  it('keeps explicit registered goal context when no path is loaded yet', () => {
    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      goalId: 'frequency-response-foundations',
      goalLabel: '频率响应基础',
      learnerState: null,
      pathPlan: null,
    });

    expect(view.goalId).toBe('frequency-response-foundations');
    expect(view.nextAction.href).toContain('goal=frequency-response-foundations');
    expect(JSON.stringify(view.fallbackStates)).toContain('goal=frequency-response-foundations');
    expect(JSON.stringify(view.fallbackStates)).not.toContain('goal=control-correction');
  });

  it('binds the adaptive practice page to catalog-backed goal query context', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');

    expect(source).toContain('buildControlCorrectionLearningCenterView');
    expect(source).toContain("searchParams.get('goal')");
    expect(source).toContain('const hasInvalidRequestedGoal = requestedGoal !== null && !explicitGoal');
    expect(source).toContain('const shouldRecoverDefaultPath = !hasInvalidRequestedGoal &&');
    expect(source).toContain("shouldRecoverDefaultPath ? 'control-correction' : null");
    expect(source).toContain('isAdaptivePracticeGoalId');
    expect(source).toContain('restoreAdaptiveLearningPathPlanFromRound(payload.path ?? null)');
    expect(source).toContain('getAdaptivePracticeGoalOptions');
    expect(source).toContain("searchParams.get('intent')");
    expect(source).toContain("searchParams.get('pathId')");
    expect(source).toContain("searchParams.get('nodeId')");
    expect(source).toContain('new URLSearchParams({ goal: activeGoal, intent: routeIntent })');
    expect(source).toContain("if (activeGoalQuery && activePathId) activeGoalQuery.set('pathId', activePathId)");
    expect(source).toContain("if (activeGoalQuery && activeNodeId) activeGoalQuery.set('nodeId', activeNodeId)");
    expect(source).toContain('data-control-correction-center="adaptive-practice"');
    expect(source).toContain('fetch(`/api/adaptive/learner-state?goal=${encodeURIComponent(goalToLoad)}`)');
    expect(source).toContain("authStatus === 'loading'");
    expect(source).toContain("authStatus === 'unauthenticated'");
    expect(source).toContain("setActiveLearnerState(null)");
    expect(source).toContain("setActivePathPlan(null)");
    expect(source).toContain("goalToLoad === 'control-correction'");
    expect(source).toContain('learnerState?.pathContext.activeControlCorrectionPath.pathId');
    expect(source).toContain('learnerState?.pathContext.recentPathIds ?? []');
    expect(source).toContain('const pathIdsToTry = activePathId');
    expect(source).toContain('? uniquePathIds([activePathId])');
    expect(source).toContain('uniquePathIds(fallbackPathIds)');
    expect(source).toContain('loadedPathContextKey === requestedPathContextKey');
    expect(source).toContain('setLoadedPathContextKey(null)');
    expect(source).toContain('fetchLearningPathRound(pathIdToLoad, goalToLoad)');
    expect(source).toContain('fetchLatestLearningPathRound(goalToLoad)');
    expect(source).toContain('showRecoveredExecutionWorkspace');
    expect(source).toContain('data-adaptive-path-completed-summary="latest-restored"');
    expect(source).toContain('formatPathCompletionTime(activePathRound)');
    expect(source).toContain('fetchLatestLearningPathRound(activeGoal)');
    const generationRefreshBlock = source.slice(
      source.indexOf('const refreshLatestLearningPathAfterKonling = useCallback'),
      source.indexOf('useEffect(() => {\n    const handleAdaptivePathUpdated'),
    );
    expect(generationRefreshBlock.indexOf('const latest = await fetchLatestLearningPathRound(activeGoal)'))
      .toBeLessThan(generationRefreshBlock.indexOf('const pathIdsToTry = uniquePathIds(fallbackPathIds)'));
    expect(source).toContain('fetch(`/api/learning-paths/${encodeURIComponent(pathId)}`)');
    expect(source).toContain('fetch(`/api/learning-paths/latest?goal=${encodeURIComponent(goalId)}`)');
    expect(source).toContain('restoreAdaptiveLearningPathPlanFromRound(payload.path ?? null)');
    expect(source).toContain('data-control-correction-alternative-count');
    expect(source).toContain('goalId: activeGoal');
    expect(source).toContain('routeIntent: activeGoal ? routeIntent : null');
    expect(source).toContain('fetch(`/api/learning-paths/${encodeURIComponent(pathId)}/choices`');
    expect(source).toContain("submitPathChoice('helpfulness'");
    expect(source).toContain('selectedOptionId');
    expect(source).toContain('rejectedOptionIds');
    expect(source).toContain('option.optionId');
    expect(source).toContain("setPathChoiceMessage('请先登录并生成路径后再记录选择。')");
  });

  it('keeps next main-path nodes distinct from optional alternatives', () => {
    const nodes = buildRecommendedPathNodeView(pathPlan({
      mainPath: [
        pathPlan().mainPath[0],
        {
          ...pathPlan().mainPath[0],
          nodeId: 'node-2',
          title: '扰动抑制补强',
          status: 'next',
          target: '/assessment/adaptive-practice?node=node-2',
        },
      ],
    })).nodes;

    expect(nodes.map((node) => [node.nodeId, node.state])).toEqual([
      ['node-1', 'current'],
      ['node-2', 'next'],
    ]);
  });

  it('maps adaptive practice diagnostics into the same route-node status language', () => {
    const nodes = buildPracticeEntryRouteNodes({
      recommendedFocus: [
        '优先练习“相位裕度-超调量”映射题',
        '补强扰动抑制与鲁棒性分析',
      ],
      weakAreas: ['phase-margin', 'disturbance-rejection'],
      estimatedAbility: 0.54,
      confidenceInterval: [0.31, 0.77],
      actionHref: '/assessment/adaptive-practice',
    });

    expect(nodes).toEqual([
      {
        nodeId: 'practice-focus-1',
        title: '优先练习“相位裕度-超调量”映射题',
        state: 'current',
        confidence: 'medium',
        evidenceLimitation: 'partial',
        missingEvidence: ['phase-margin', 'disturbance-rejection'],
        action: {
          href: '/assessment/adaptive-practice?focus=practice-focus-1',
          label: '开始当前训练',
          method: 'GET',
        },
      },
      {
        nodeId: 'practice-focus-2',
        title: '补强扰动抑制与鲁棒性分析',
        state: 'optional',
        confidence: 'medium',
        evidenceLimitation: 'partial',
        missingEvidence: ['phase-margin', 'disturbance-rejection'],
        action: {
          href: '/assessment/adaptive-practice?focus=practice-focus-2',
          label: '查看训练节点',
          method: 'GET',
        },
      },
    ]);
  });

  it('reports zero path source coverage as missing instead of partial', () => {
    const view = buildAdaptiveLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      pathPlan: pathPlan({
        status: 'fallback',
        confidence: {
          level: 'low',
          score: 0,
          sourceCoverage: 0,
        },
        explanations: {
          selectedReasons: [],
          rejectedAlternatives: [],
          fallbackReasons: ['learner-state-missing'],
          configurationFulfillment: [],
        },
      }),
    });

    const currentPath = view.panels.find((panel) => panel.region === 'current-path');

    expect(currentPath?.status.categories.sourceCoverage).toBe('missing');
    expect(currentPath?.status.fallbackReason).toBe('学习证据待补充');
  });

  it('does not crash when restored diagnostic fixture paths lack plan payload details', () => {
    const restoredPlan = restoreAdaptiveLearningPathPlanFromRound({
      id: 'yangfan-fixture-control-correction-path',
      userId: 'student-yangfan',
      title: 'Yang Fan diagnostic control-correction path',
      goalId: 'control-correction',
      pathStatus: 'diagnostic-fixture',
      currentNodeId: '根轨迹_1_1',
      pathPayload: { fixtureScope: 'yangfan-diagnostic-fixture.v1' },
      explanationPayload: {
        fixtureScope: 'yangfan-diagnostic-fixture.v1',
        citationRefs: ['LearningFact:yangfan-diagnostic-fixture:fact-resource'],
        privacy: 'minimized',
      },
      alternativePayload: [],
    });

    const view = buildControlCorrectionLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState({ missingEvidence: [] }),
      pathPlan: restoredPlan,
      goalId: 'control-correction',
      questionAvailable: false,
    });

    const currentPath = view.panels.find((panel) => panel.region === 'current-path');
    expect(currentPath?.status.categories.sourceCoverage).toBe('missing');
    expect(currentPath?.status.fallbackReason).toBe('路径待生成');
    expect(view.nextAction.title).toContain('生成');
  });

  it('surfaces low-confidence, stale, privacy, fallback, and partial-coverage limits for adaptive claims', () => {
    const status = buildAdaptiveClaimStatus({
      id: 'path-low-confidence',
      label: '路径个性化证据',
      domain: 'path',
      confidence: 'low',
      sourceCoverage: 'stale',
      privacy: 'restricted',
      readiness: 'degraded',
      fallbackReason: 'missing-recent-learning-facts',
      details: [
        { label: '缺口', value: '最近学习事实不足', roleScope: 'student-visible' },
        { label: '内部规则', value: 'path-policy-debug', roleScope: 'system-internal' },
      ],
    });

    const studentView = buildPlatformStatusViewModel(status, { role: 'student' });
    const adminView = buildPlatformStatusViewModel(status, { role: 'admin' });

    expect(status.categories).toMatchObject({
      confidence: 'low',
      sourceCoverage: 'stale',
      privacy: 'restricted',
      readiness: 'degraded',
      fallback: 'fallback-missing-context',
    });
    expect(status.fallbackReason).toBe('missing-recent-learning-facts');
    expect(studentView.tone).toBe('warning');
    expect(studentView.details.map((detail) => detail.label)).toEqual(['缺口']);
    expect(adminView.details.find((detail) => detail.label === '内部规则')).toMatchObject({
      restricted: true,
      value: '受限内容不可在当前界面展示',
    });
  });

  it('displays Konling context, intervention basis, cooldown, and feedback state when available', () => {
    const view = buildAdaptiveLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      konling: {
        contextSource: 'learner-state-and-path',
        teachingAssistantModes: {
          diagnosisExplainer: 'diagnosis-explainer',
          pathAdvisor: 'path-advisor',
          resourceCoach: 'resource-coach',
        },
        interventionBasis: 'low-mastery-target',
        cooldown: { active: true, until: '2026-05-28T07:00:00.000Z' },
        feedback: { state: 'pending' },
      },
    });

    const konlingPanel = view.panels.find((panel) => panel.region === 'konling');

    expect(konlingPanel).toMatchObject({
      id: 'adaptive-center-konling',
      status: {
        source: { domain: 'konling', capability: 'adaptive-center' },
      },
      payload: {
        contextSource: 'learner-state-and-path',
        teachingAssistantModes: {
          diagnosisExplainer: 'diagnosis-explainer',
          pathAdvisor: 'path-advisor',
          resourceCoach: 'resource-coach',
        },
        interventionBasis: 'low-mastery-target',
        cooldown: { active: true, until: '2026-05-28T07:00:00.000Z' },
        feedback: { state: 'pending' },
      },
    });
    expect(konlingPanel?.status.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '助理模式', value: 'diagnosis-explainer, path-advisor, resource-coach' }),
        expect.objectContaining({ label: '干预依据', value: 'low-mastery-target' }),
        expect.objectContaining({ label: '冷却状态', value: 'active until 2026-05-28T07:00:00.000Z' }),
        expect.objectContaining({ label: '反馈状态', value: 'pending' }),
      ]),
    );
  });

  it('treats an empty Konling payload as missing context', () => {
    const view = buildAdaptiveLearningCenterView({
      featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
      learnerState: learnerState(),
      konling: {
        contextSource: 'none',
        teachingAssistantModes: {
          diagnosisExplainer: 'diagnosis-explainer',
          pathAdvisor: 'path-advisor',
          resourceCoach: 'resource-coach',
        },
        interventionBasis: null,
        cooldown: { active: false, until: null },
        feedback: { state: 'unavailable' },
      },
    });

    const konlingPanel = view.panels.find((panel) => panel.region === 'konling');

    expect(konlingPanel?.status.categories).toMatchObject({
      confidence: 'unknown',
      sourceCoverage: 'missing',
      readiness: 'not-ready',
      fallback: 'fallback-missing-context',
    });
    expect(konlingPanel?.status.fallbackReason).toBe('missing-konling-context');
  });

  it('sorts adaptive practice path history by raw timestamps before formatting labels', () => {
    const routeSource = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');

    expect(routeSource).toContain('sortTime: number;');
    expect(routeSource).toContain('const timelineTime = readTimelineTime(record.createdAt ?? record.completedAt ?? record.startedAt);');
    expect(routeSource).toContain('return items.sort((left, right) => left.sortTime - right.sortTime);');
    expect(routeSource).not.toContain('left.createdAt.localeCompare(right.createdAt)');
  });
});

function readRouteSource(route: AdaptiveLearningCompatibilityRoute) {
  return readFileSync(join(repoRoot, route.routeFile), 'utf8');
}

function routeIntentMarker(route: AdaptiveLearningCompatibilityRoute) {
  switch (route.preservedIntent) {
    case 'personal-learning-center':
      return 'PersonalLearningCenter';
    case 'konling-conversation':
      return '/api/ai/chat';
    case 'adaptive-practice':
      return '/api/assessment/next-question';
    case 'profile-adaptive-cards':
      return 'personalizedReinforcement';
  }
}
