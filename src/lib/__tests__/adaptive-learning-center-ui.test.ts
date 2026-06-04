import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG,
  ADAPTIVE_LEARNING_CENTER_REGIONS,
  type AdaptiveLearningCompatibilityRoute,
  buildAdaptiveClaimStatus,
  buildAdaptiveLearningCenterState,
  buildAdaptiveLearningCenterView,
  getAdaptiveLearningCenterCompatibilityRoutes,
} from '@/features/adaptive/adaptive-learning-center-contracts';
import { buildPlatformStatusViewModel } from '@/components/platform/platform-ui-contracts';
import type { AdaptiveLearnerState } from '@/lib/data-governance/adaptive-learner-state-service';
import type { AdaptiveLearningPathPlan } from '@/lib/adaptive-learning-path-planner';

const repoRoot = process.cwd();

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
    excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
    status: 'ready',
    currentNodeId: 'node-1',
    mainPath: [
      {
        nodeId: 'node-1',
        title: '相位裕度映射练习',
        type: 'quiz',
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
    expect(currentPath?.status.fallbackReason).toBe('learner-state-missing');
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
        interventionBasis: 'low-mastery-target',
        cooldown: { active: true, until: '2026-05-28T07:00:00.000Z' },
        feedback: { state: 'pending' },
      },
    });
    expect(konlingPanel?.status.details).toEqual(
      expect.arrayContaining([
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
