import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG,
  ADAPTIVE_LEARNING_CENTER_REGIONS,
  LEARNER_DATA_SHELL_SEMANTICS,
  buildControlCorrectionLearningCenterView,
  buildLearnerDataRouteShell,
  buildPracticeEntryRouteNodes,
  buildRecommendedPathNodeView,
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
import { ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES } from '@/lib/adaptive-learning-path-planner';
import type { AdaptiveLearningPathPlan } from '@/lib/adaptive-learning-path-planner';
import {
  buildAdaptivePathOptionDisplays,
  type AdaptivePathOptionWriteOption,
} from '@/lib/adaptive-path-option-display';
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
    primaryCompetencies: {
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
        prerequisiteReasons: [],
        teacherPolicy: [{ nodeId: 'node-1', policy: 'allowed' }],
        alternatives: [],
      },
    },
    ...overrides,
  };
}

describe('adaptive learning center UI contracts', () => {
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
    expect(source).toContain("submitPathChoice('switch'");
    expect(source).toContain("submitPathChoice('helpfulness'");
  });

  it('does not fall back static starter path actions to the first real option', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');

    expect(source).not.toContain('realPathOption');
    expect(source).not.toContain('pathOptions[index] ??');
    expect(source).not.toContain('pathOptions[index]');
    expect(source).toContain('const visiblePathOptions = useMemo(() => buildAdaptivePathOptionDisplays(pathOptions), [pathOptions]);');
    expect(source).toContain('const optionForWrite = option.writeOption;');
    expect(source).toContain('disabled={!option.writeOption || Boolean(pathChoicePending)}');
    expect(source).toContain("setPathChoiceMessage('请先登录并生成路径后再记录选择。')");
  });

  it('binds displayed real path options to their own writable option payload', () => {
    const options: AdaptivePathOptionWriteOption[] = [
      {
        optionId: 'rules-plus-graph-search-route',
        label: '规则图谱推荐路线',
        targetDeficits: [{ targetId: 'phase-margin' }],
        evidenceBasis: ['adaptive-learner-state'],
        resourceMix: { knowledge_card: 1, arena_task: 1 },
        effort: { estimatedMinutes: 42, relative: 'medium' },
        terminalValidationNodeIds: ['arena-task:terminal'],
        terminalValidationStrategy: { summary: 'official Arena validation' },
        limitations: [],
      },
      {
        optionId: 'foundation-remediation-route',
        label: '基础补救路线',
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
    expect(preview).toHaveLength(3);
    expect(preview.every((option) => option.writeOption === undefined)).toBe(true);
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

  it('prioritizes current path, next action, evidence confidence, and missing source on dashboard and profile', () => {
    const dashboard = readFileSync(join(repoRoot, 'src/app/(main)/dashboard/page.tsx'), 'utf8');
    const profile = readFileSync(join(repoRoot, 'src/app/(main)/profile/page.tsx'), 'utf8');

    for (const source of [dashboard, profile]) {
      expect(source).toContain('data-learner-record-priority="current-path"');
      expect(source).toContain('data-learner-record-next-action');
      expect(source).toContain('data-learner-record-evidence-confidence');
      expect(source).toContain('data-learner-record-missing-source');
    }

    expect(dashboard.indexOf('data-learner-record-priority="current-path"')).toBeLessThan(
      dashboard.indexOf('欢迎回来'),
    );
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

  it('keeps default adaptive path generation generic before entering a registered goal context', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');

    expect(source).toContain("const controlCorrectionGenerationHref = '/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation';");
    expect(source).toContain("const frequencyResponseGenerationHref = '/assessment/adaptive-practice?goal=frequency-response-foundations&intent=contextual-recommendation';");
    expect(source).toContain("const genericPathGenerationHref = '#adaptive-path-generation-goals';");
    expect(source).toContain('useGlobalAI');
    expect(source).toContain('openPathGenerationAdvisor');
    expect(source).toContain("data-adaptive-path-generation-action=\"open-in-page-path-advisor\"");
    expect(source).toContain("data-adaptive-path-generation-action=\"choose-generation-goal\"");
    expect(source).toContain('data-adaptive-path-generation-goal-list="generic"');
    expect(source).toContain('data-adaptive-path-generation-goal="control-correction"');
    expect(source).toContain('data-adaptive-path-generation-goal="frequency-response-foundations"');
    expect(source).toContain("data-adaptive-path-generation-action=\"enter-registered-goal-context\"");
    expect(source).toContain('请控灵生成路径');
    expect(source).toContain('生成学习路径');
    expect(source).toContain('生成该目标路径');
    expect(source).toContain('路径顾问准备中');
    expect(source).not.toContain('data-adaptive-path-generation-action="enter-control-correction-context"');
    expect(source).not.toContain('review-frequency-response-evidence');
    expect(source).not.toContain('/ai/copilot?mode=path-advisor');
    expect(source).not.toContain("setPathChoiceMessage('控灵已准备好根据你的目标生成路径。')");
  });

  it('registers path-advisor entry point only after an explicit control-correction goal is selected', () => {
    const source = readFileSync(join(repoRoot, 'src/features/adaptive/path-advisor-entrypoint-bridge.tsx'), 'utf8');
    const layoutSource = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/layout.tsx'), 'utf8');

    expect(source).toContain("import { useSearchParams } from 'next/navigation';");
    expect(source).toContain("value === 'control-correction' || value === 'frequency-response-foundations'");
    expect(source).toContain('const modeContextToken = explicitGoal ? modeContextTokens[explicitGoal] ?? null : null;');
    expect(source).toContain('if (!explicitGoal || !classId || !modeContextToken) {');
    expect(source).toContain('updatePageContext({ assistantEntryPoint: null });');
    expect(source).toContain('return () => updatePageContext({ assistantEntryPoint: null });');
    expect(source).toContain('promptContext: `student-path-center:${explicitGoal}:adaptive-path-center`');
    expect(source).toContain('goalId: explicitGoal');
    expect(layoutSource).toContain("'frequency-response-foundations': createKonlingTeachingAssistantServerContextToken");
  });

  it('binds growth center to grouped learner timeline and stable chart containers', () => {
    const source = readFileSync(join(repoRoot, 'src/app/(main)/profile/growth/page.tsx'), 'utf8');

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

  it('surfaces three-style path options and selection history for diagnosis panels', () => {
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
              styleId: 'foundation-remediation',
              policyFamily: 'foundation-remediation',
              label: '基础补救',
              nodeIds: ['knowledge-card:targets', 'arena-task:terminal'],
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
          optionId: 'path-option-1',
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

  it('does not expose cosmetic path options when the policy bundle is low-resource fallback', () => {
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
          fallbackReasons: ['path-diversity-insufficient', 'terminal-validation-diversity-insufficient'],
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
      pathOptions: [],
      pathOptionFallback: {
        status: 'low-resource-fallback',
        fallbackReasons: ['路径差异不足', '终点检验差异不足'],
        diversity: {
          resourceOverlap: 1,
          modalityDistance: 0,
          effortDifference: 0,
        },
      },
    });
    expect(JSON.stringify(currentPath?.payload)).not.toContain('rules-plus-graph-search');
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

    expect(node.action.href).toBe(
      '/assessment/adaptive-practice?pathId=path-1&nodeId=node-1&goal=control-correction&intent=path-execution',
    );
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
    expect(node.action.href).not.toContain('https://ocw.mit.edu/control/bode');
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

    expect(node.action.href).toBe(
      '/course-runtime/knowledge/cards/nodes/时域指标到目标极点区域_3_36001.md?pathId=path-1&nodeId=node-1&goal=control-correction&intent=path-execution',
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
      href: '/assessment/adaptive-practice?pathId=path-1&nodeId=node-1&goal=control-correction&intent=path-execution',
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
      },
    ]);
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

  it('binds the adaptive practice page to control-correction query context', () => {
    const source = readFileSync(join(repoRoot, 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');

    expect(source).toContain('buildControlCorrectionLearningCenterView');
    expect(source).toContain("searchParams.get('goal')");
    expect(source).toContain('isAdaptivePracticeGoalId');
    expect(source).toContain("value === 'control-correction' || value === 'frequency-response-foundations'");
    expect(source).toContain("searchParams.get('intent')");
    expect(source).toContain("searchParams.get('pathId')");
    expect(source).toContain("searchParams.get('nodeId')");
    expect(source).toContain('new URLSearchParams({ goal: activeGoal, intent: routeIntent })');
    expect(source).toContain("controlCorrectionQuery.set('pathId', activePathId)");
    expect(source).toContain("controlCorrectionQuery.set('nodeId', activeNodeId)");
    expect(source).toContain('data-control-correction-center="adaptive-practice"');
    expect(source).toContain('fetch(`/api/adaptive/learner-state?goal=${encodeURIComponent(goalToLoad)}`)');
    expect(source).toContain("authStatus === 'loading'");
    expect(source).toContain("authStatus === 'unauthenticated'");
    expect(source).toContain("setControlCorrectionLearnerState(null)");
    expect(source).toContain("setControlCorrectionPathPlan(null)");
    expect(source).toContain("goalToLoad === 'control-correction'");
    expect(source).toContain('learnerState?.pathContext.activeControlCorrectionPath.pathId');
    expect(source).toContain('fetch(`/api/learning-paths/${encodeURIComponent(pathIdToLoad)}`)');
    expect(source).toContain("if (!round || !isAdaptivePracticeGoalId(round.goalId)) return null;");
    expect(source).toContain('id: round.goalId');
    expect(source).toContain('Array.isArray(round.alternativePayload)');
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
        },
      }),
    });

    const currentPath = view.panels.find((panel) => panel.region === 'current-path');

    expect(currentPath?.status.categories.sourceCoverage).toBe('missing');
    expect(currentPath?.status.fallbackReason).toBe('学习证据待补充');
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
