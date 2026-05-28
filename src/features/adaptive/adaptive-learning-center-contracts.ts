import type {
  PlatformConfidenceStatus,
  PlatformPrivacyStatus,
  PlatformReadinessStatus,
  PlatformRole,
  PlatformSourceCoverageStatus,
  PlatformStatusDetail,
  PlatformStatusDomain,
  PlatformStatusPayload,
} from '@/components/platform/platform-ui-contracts';
import type { AdaptiveLearningPathPlan } from '@/lib/adaptive-learning-path-planner';
import type { AdaptiveLearnerState } from '@/lib/data-governance/adaptive-learner-state-service';

export type AdaptiveLearningCenterRegion =
  | 'overview'
  | 'learner-state'
  | 'mastery'
  | 'current-path'
  | 'path-map'
  | 'timeline'
  | 'evidence'
  | 'practice'
  | 'konling';

export type AdaptiveLearningCenterMode = 'legacy-compatible' | 'adaptive-learning-center';

export type AdaptiveLearningCompatibilityIntent =
  | 'personal-learning-center'
  | 'konling-conversation'
  | 'adaptive-practice'
  | 'profile-adaptive-cards';

export type AdaptiveLearningCompatibilityMigrationMode = 'legacy-surface' | 'center-alias';

export interface AdaptiveLearningCenterStateInput {
  featureFlags: readonly string[];
  learnerState?: AdaptiveLearnerState | null;
}

export interface AdaptiveLearningCenterState {
  mode: AdaptiveLearningCenterMode;
  activeFeatureFlag: string;
  regions: AdaptiveLearningCenterRegion[];
  status: PlatformStatusPayload;
}

export interface AdaptiveLearningCompatibilityRoute {
  href: '/ai' | '/ai/copilot' | '/assessment/adaptive-practice' | '/profile';
  routeFile: string;
  preservedIntent: AdaptiveLearningCompatibilityIntent;
  centerRegion: AdaptiveLearningCenterRegion;
  migrationMode: AdaptiveLearningCompatibilityMigrationMode;
}

export interface AdaptiveLearningCenterPanel {
  id: string;
  region: AdaptiveLearningCenterRegion;
  title: string;
  status: PlatformStatusPayload;
  payload?: unknown;
}

export interface AdaptiveLearningCenterKonlingPayload {
  contextSource: 'none' | 'learner-state' | 'path' | 'learner-state-and-path';
  interventionBasis: string | null;
  cooldown: {
    active: boolean;
    until: string | null;
  };
  feedback: {
    state: 'unavailable' | 'pending' | 'accepted' | 'dismissed' | 'rated';
  };
}

export interface AdaptiveLearningCenterViewInput {
  featureFlags: readonly string[];
  learnerState?: AdaptiveLearnerState | null;
  pathPlan?: AdaptiveLearningPathPlan | null;
  konling?: AdaptiveLearningCenterKonlingPayload | null;
  clientProfileHints?: Record<string, unknown>;
}

export interface AdaptiveLearningCenterView extends AdaptiveLearningCenterState {
  authority: 'server-owned' | 'unavailable';
  role: PlatformRole;
  panels: AdaptiveLearningCenterPanel[];
  excludedPolicyFamilies: string[];
}

export interface AdaptiveClaimStatusInput {
  id: string;
  label: string;
  domain: PlatformStatusDomain;
  capability?: string;
  confidence: PlatformConfidenceStatus;
  sourceCoverage: PlatformSourceCoverageStatus;
  privacy: PlatformPrivacyStatus;
  readiness: PlatformReadinessStatus;
  fallbackReason?: string | null;
  details?: readonly PlatformStatusDetail[];
}

export const ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG = 'adaptive.learningCenter';

export const ADAPTIVE_LEARNING_CENTER_REGIONS: AdaptiveLearningCenterRegion[] = [
  'overview',
  'learner-state',
  'mastery',
  'current-path',
  'path-map',
  'timeline',
  'evidence',
  'practice',
  'konling',
];

const LEGACY_COMPATIBLE_REGIONS: AdaptiveLearningCenterRegion[] = ['overview', 'practice', 'konling'];

const ADAPTIVE_LEARNING_CENTER_ROUTES: AdaptiveLearningCompatibilityRoute[] = [
  {
    href: '/ai',
    routeFile: 'src/app/ai/page.tsx',
    preservedIntent: 'personal-learning-center',
    centerRegion: 'overview',
    migrationMode: 'legacy-surface',
  },
  {
    href: '/ai/copilot',
    routeFile: 'src/app/ai/copilot/page.tsx',
    preservedIntent: 'konling-conversation',
    centerRegion: 'konling',
    migrationMode: 'legacy-surface',
  },
  {
    href: '/assessment/adaptive-practice',
    routeFile: 'src/app/assessment/adaptive-practice/page.tsx',
    preservedIntent: 'adaptive-practice',
    centerRegion: 'practice',
    migrationMode: 'legacy-surface',
  },
  {
    href: '/profile',
    routeFile: 'src/app/(main)/profile/page.tsx',
    preservedIntent: 'profile-adaptive-cards',
    centerRegion: 'learner-state',
    migrationMode: 'legacy-surface',
  },
];

export function getAdaptiveLearningCenterCompatibilityRoutes(): AdaptiveLearningCompatibilityRoute[] {
  return ADAPTIVE_LEARNING_CENTER_ROUTES.map((route) => ({ ...route }));
}

export function buildAdaptiveClaimStatus(input: AdaptiveClaimStatusInput): PlatformStatusPayload {
  return {
    id: input.id,
    label: input.label,
    source: {
      domain: input.domain,
      capability: input.capability ?? 'adaptive-center',
    },
    summary: adaptiveStatusSummary(input),
    categories: {
      confidence: input.confidence,
      sourceCoverage: input.sourceCoverage,
      privacy: input.privacy,
      replay: 'ready',
      protocol: 'current',
      evaluation: 'preview',
      readiness: input.readiness,
      fallback: input.fallbackReason ? 'fallback-missing-context' : 'none',
    },
    details: input.details,
    fallbackReason: input.fallbackReason ?? undefined,
  };
}

export function buildAdaptiveLearningCenterState(input: AdaptiveLearningCenterStateInput): AdaptiveLearningCenterState {
  const enabled = input.featureFlags.includes(ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG);

  if (!enabled) {
    const status = buildAdaptiveClaimStatus({
      id: 'adaptive-center-legacy-compatible',
      label: '自适应学习兼容模式',
      domain: 'learner-state',
      confidence: 'medium',
      sourceCoverage: 'partial',
      privacy: 'classroom',
      readiness: 'ready',
      fallbackReason: 'adaptive-learning-center-flag-disabled',
      details: [
        {
          label: '兼容入口',
          value: '/ai, /ai/copilot, /assessment/adaptive-practice, /profile',
          roleScope: 'student-visible',
        },
      ],
    });

    return {
      mode: 'legacy-compatible',
      activeFeatureFlag: ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG,
      regions: LEGACY_COMPATIBLE_REGIONS,
      status: {
        ...status,
        categories: {
          ...status.categories,
          fallback: 'fallback-active',
        },
      },
    };
  }

  return {
    mode: 'adaptive-learning-center',
    activeFeatureFlag: ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG,
    regions: ADAPTIVE_LEARNING_CENTER_REGIONS,
    status: learnerStateStatus(input.learnerState ?? null),
  };
}

export function buildAdaptiveLearningCenterView(input: AdaptiveLearningCenterViewInput): AdaptiveLearningCenterView {
  const state = buildAdaptiveLearningCenterState(input);
  const learnerState = isServerOwnedLearnerState(input.learnerState) ? input.learnerState : null;
  const panels: AdaptiveLearningCenterPanel[] = [
    overviewPanel(state.status),
    learnerStatePanel(learnerState, Boolean(input.clientProfileHints)),
    masteryPanel(learnerState),
    currentPathPanel(input.pathPlan ?? null),
    practicePanel(learnerState),
    konlingPanel(input.konling ?? null),
  ];

  if (input.pathPlan?.visualization) {
    panels.splice(
      4,
      0,
      pathPanel('adaptive-center-path-map', 'path-map', '路径地图', input.pathPlan.visualization.map, input.pathPlan),
      pathPanel('adaptive-center-timeline', 'timeline', '路径时间线', input.pathPlan.visualization.timeline, input.pathPlan),
      pathPanel('adaptive-center-evidence', 'evidence', '证据解释', input.pathPlan.visualization.evidence, input.pathPlan),
    );
  } else {
    panels.splice(4, 0, fallbackPanel('path-map'), fallbackPanel('timeline'), fallbackPanel('evidence'));
  }

  return {
    ...state,
    status: learnerState ? learnerStateStatus(learnerState, Boolean(input.clientProfileHints)) : state.status,
    authority: learnerState ? 'server-owned' : 'unavailable',
    role: roleFromLearnerState(learnerState),
    panels: panels.filter((panel) => state.regions.includes(panel.region)),
    excludedPolicyFamilies: [...(input.pathPlan?.excludedPolicyFamilies ?? [])],
  };
}

function adaptiveStatusSummary(input: AdaptiveClaimStatusInput): string {
  const limits = [
    input.confidence === 'low' || input.confidence === 'unknown' ? '低置信' : null,
    input.sourceCoverage !== 'complete' ? '证据覆盖受限' : null,
    input.privacy === 'restricted' || input.privacy === 'private' ? '隐私范围受限' : null,
    input.readiness !== 'ready' ? '降级或未就绪' : null,
    input.fallbackReason ? `回退原因:${input.fallbackReason}` : null,
  ].filter(Boolean);

  return limits.length > 0 ? limits.join('；') : '自适应声明证据完整且可展示。';
}

function isServerOwnedLearnerState(value: AdaptiveLearnerState | null | undefined): value is AdaptiveLearnerState {
  return value?.authority === 'server-owned';
}

function roleFromLearnerState(learnerState: AdaptiveLearnerState | null): PlatformRole {
  const role = learnerState?.roleScope.role;
  if (role === 'teacher' || role === 'admin' || role === 'student') return role;
  return 'student';
}

function learnerStateStatus(
  learnerState: AdaptiveLearnerState | null,
  clientHintsReceived = learnerState?.clientHints.received ?? false,
): PlatformStatusPayload {
  if (!learnerState) {
    return buildAdaptiveClaimStatus({
      id: 'adaptive-center-learner-state-empty',
      label: '学习状态待生成',
      domain: 'learner-state',
      confidence: 'unknown',
      sourceCoverage: 'missing',
      privacy: 'classroom',
      readiness: 'not-ready',
      fallbackReason: 'missing-server-owned-learner-state',
    });
  }

  return buildAdaptiveClaimStatus({
    id: 'adaptive-center-learner-state',
    label: '学习状态',
    domain: 'learner-state',
    confidence: learnerStateConfidence(learnerState),
    sourceCoverage: learnerStateCoverage(learnerState),
    privacy: learnerStatePrivacy(learnerState),
    readiness: learnerState.evidence.readState === 'ready' ? 'ready' : 'degraded',
    fallbackReason: learnerState.missingEvidence.length > 0 ? learnerState.missingEvidence.join(',') : null,
    details: [
      {
        label: '学习状态权威来源',
        value: learnerState.authority,
        roleScope: 'student-visible',
      },
      {
        label: '客户端画像提示',
        value: clientHintsReceived ? '已接收但不作为权威输入' : '未接收',
        roleScope: 'student-visible',
      },
      {
        label: '证据条数',
        value: String(learnerState.evidence.confidence.evidenceCount),
        roleScope: 'student-visible',
      },
    ],
  });
}

function learnerStateConfidence(learnerState: AdaptiveLearnerState): PlatformConfidenceStatus {
  const level = learnerState.evidence.confidence.level;
  if (level === 'none') return 'unknown';
  return level;
}

function learnerStateCoverage(learnerState: AdaptiveLearnerState): PlatformSourceCoverageStatus {
  const coverageValues = Object.values(learnerState.evidence.sourceCoverage);
  if (coverageValues.length === 0) return 'missing';
  if (coverageValues.every((value) => value === 'available')) return 'complete';
  if (coverageValues.some((value) => value === 'missing')) return 'missing';
  return 'partial';
}

function learnerStatePrivacy(learnerState: AdaptiveLearnerState): PlatformPrivacyStatus {
  if (learnerState.roleScope.privacyScopes.includes('admin-scoped')) return 'private';
  if (learnerState.roleScope.privacyScopes.includes('teacher-scoped')) return 'restricted';
  return 'classroom';
}

function overviewPanel(status: PlatformStatusPayload): AdaptiveLearningCenterPanel {
  return {
    id: 'adaptive-center-overview',
    region: 'overview',
    title: '自适应学习总览',
    status,
  };
}

function learnerStatePanel(
  learnerState: AdaptiveLearnerState | null,
  clientHintsReceived: boolean,
): AdaptiveLearningCenterPanel {
  return {
    id: 'adaptive-center-learner-state',
    region: 'learner-state',
    title: '学习状态',
    status: learnerStateStatus(learnerState, clientHintsReceived),
    payload: learnerState
      ? {
          generatedAt: learnerState.generatedAt,
          primaryCompetencies: learnerState.primaryCompetencies,
          secondaryDimensions: learnerState.secondaryDimensions,
          evidence: learnerState.evidence,
        }
      : null,
  };
}

function masteryPanel(learnerState: AdaptiveLearnerState | null): AdaptiveLearningCenterPanel {
  return {
    id: 'adaptive-center-mastery',
    region: 'mastery',
    title: '掌握度',
    status: learnerStateStatus(learnerState),
    payload: learnerState?.knowledgeMastery ?? null,
  };
}

function currentPathPanel(pathPlan: AdaptiveLearningPathPlan | null): AdaptiveLearningCenterPanel {
  return {
    id: 'adaptive-center-current-path',
    region: 'current-path',
    title: '当前路径',
    status: pathStatus(pathPlan),
    payload: pathPlan
      ? {
          id: pathPlan.id,
          stage: pathPlan.stage,
          policyFamily: pathPlan.policyFamily,
          currentNodeId: pathPlan.currentNodeId,
          mainPath: pathPlan.mainPath,
          alternatives: pathPlan.alternatives,
        }
      : null,
  };
}

function pathPanel(
  id: string,
  region: Extract<AdaptiveLearningCenterRegion, 'path-map' | 'timeline' | 'evidence'>,
  title: string,
  payload: unknown,
  pathPlan: AdaptiveLearningPathPlan,
): AdaptiveLearningCenterPanel {
  return {
    id,
    region,
    title,
    status: pathStatus(pathPlan),
    payload,
  };
}

function fallbackPanel(region: Extract<AdaptiveLearningCenterRegion, 'path-map' | 'timeline' | 'evidence'>): AdaptiveLearningCenterPanel {
  return {
    id: `adaptive-center-${region}`,
    region,
    title: region,
    status: buildAdaptiveClaimStatus({
      id: `adaptive-center-${region}-fallback`,
      label: '路径视图待生成',
      domain: 'path',
      confidence: 'unknown',
      sourceCoverage: 'missing',
      privacy: 'classroom',
      readiness: 'not-ready',
      fallbackReason: 'missing-rules-graph-path-payload',
    }),
    payload: null,
  };
}

function pathStatus(pathPlan: AdaptiveLearningPathPlan | null): PlatformStatusPayload {
  if (!pathPlan) {
    return buildAdaptiveClaimStatus({
      id: 'adaptive-center-path-empty',
      label: '路径待生成',
      domain: 'path',
      confidence: 'unknown',
      sourceCoverage: 'missing',
      privacy: 'classroom',
      readiness: 'not-ready',
      fallbackReason: 'missing-rules-graph-path-payload',
    });
  }

  return buildAdaptiveClaimStatus({
    id: 'adaptive-center-path',
    label: '规则图学习路径',
    domain: 'path',
    confidence: pathPlan.confidence.level,
    sourceCoverage: pathPlan.confidence.sourceCoverage >= 0.75 ? 'complete' : 'partial',
    privacy: 'classroom',
    readiness: pathPlan.status === 'ready' ? 'ready' : 'degraded',
    fallbackReason: pathPlan.explanations.fallbackReasons[0] ?? null,
    details: [
      {
        label: '策略族',
        value: pathPlan.policyFamily,
        roleScope: 'student-visible',
      },
      {
        label: '优化阶段',
        value: pathPlan.stage,
        roleScope: 'student-visible',
      },
    ],
  });
}

function practicePanel(learnerState: AdaptiveLearnerState | null): AdaptiveLearningCenterPanel {
  return {
    id: 'adaptive-center-practice',
    region: 'practice',
    title: '自适应练习',
    status: buildAdaptiveClaimStatus({
      id: 'adaptive-center-practice-status',
      label: '自适应练习',
      domain: 'learner-state',
      confidence: learnerState ? learnerStateConfidence(learnerState) : 'unknown',
      sourceCoverage: learnerState ? learnerStateCoverage(learnerState) : 'missing',
      privacy: 'classroom',
      readiness: 'ready',
      fallbackReason: learnerState ? null : 'missing-server-owned-learner-state',
    }),
    payload: {
      route: '/assessment/adaptive-practice',
      assessmentState: learnerState?.assessmentState ?? null,
    },
  };
}

function konlingPanel(konling: AdaptiveLearningCenterKonlingPayload | null): AdaptiveLearningCenterPanel {
  const cooldownValue = konling?.cooldown.active
    ? `active until ${konling.cooldown.until ?? 'unknown'}`
    : 'inactive';

  return {
    id: 'adaptive-center-konling',
    region: 'konling',
    title: 'Konling 支持',
    status: buildAdaptiveClaimStatus({
      id: 'adaptive-center-konling-status',
      label: 'Konling 自适应支持',
      domain: 'konling',
      confidence: konling ? 'medium' : 'unknown',
      sourceCoverage: konling ? 'partial' : 'missing',
      privacy: 'private',
      readiness: konling ? 'degraded' : 'not-ready',
      fallbackReason: konling ? null : 'missing-konling-context',
      details: [
        {
          label: '上下文来源',
          value: konling?.contextSource ?? 'none',
          roleScope: 'student-visible',
        },
        {
          label: '干预依据',
          value: konling?.interventionBasis ?? 'unavailable',
          roleScope: 'student-visible',
        },
        {
          label: '冷却状态',
          value: cooldownValue,
          roleScope: 'student-visible',
        },
        {
          label: '反馈状态',
          value: konling?.feedback.state ?? 'unavailable',
          roleScope: 'student-visible',
        },
      ],
    }),
    payload: konling ?? {
      contextSource: 'none',
      interventionBasis: null,
      cooldown: { active: false, until: null },
      feedback: { state: 'unavailable' },
    },
  };
}
