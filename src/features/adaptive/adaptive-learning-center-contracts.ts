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
import type {
  AdaptiveLearningPathDeficit,
  AdaptiveLearningPathPlan,
} from '@/lib/adaptive-learning-path-planner';
import { studentVisibleCandidateLimitation } from '@/lib/adaptive-path-candidate-limitation-copy';
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
export type ControlCorrectionCenterRouteIntent =
  | 'practice'
  | 'learner-state-review'
  | 'path-selection'
  | 'path-execution'
  | 'evidence-review'
  | 'contextual-recommendation';
export type ControlCorrectionCenterEntrySource =
  | 'homepage'
  | 'student-cockpit'
  | 'profile'
  | 'adaptive-practice'
  | 'contextual-recommendation';
export const ADAPTIVE_PATH_LAUNCH_SOURCE = 'adaptive-path-center';
export const ADAPTIVE_PATH_EXECUTION_RETURN_PATH = '/assessment/adaptive-practice';
export type ControlCorrectionCenterStateKind =
  | 'path-ready'
  | 'loading'
  | 'low-evidence'
  | 'no-path'
  | 'no-question'
  | 'feature-flag-disabled'
  | 'network-error';
export type LearnerDataShellSemantic =
  | 'ability-profile'
  | 'current-path'
  | 'evidence-timeline'
  | 'recommendations'
  | 'practice'
  | 'next-action';
export type LearnerDataRouteIdentity =
  | 'student-cockpit'
  | 'profile-overview'
  | 'growth-center'
  | 'evidence-browser'
  | 'adaptive-practice';
export type RecommendedPathNodeState = 'current' | 'completed' | 'blocked' | 'next' | 'optional' | 'locked';

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

export interface LearnerDataSurfaceRoute {
  href: '/dashboard' | '/profile' | '/profile/growth' | '/profile/evidence' | '/assessment/adaptive-practice';
  routeFile: string;
  routeIdentity: LearnerDataRouteIdentity;
  primaryRegion: AdaptiveLearningCenterRegion;
}

export interface LearnerDataRouteShell {
  routeFamily: 'learner-data-pathway';
  routeIdentity: LearnerDataRouteIdentity;
  owningChange: 'redesign-learner-data-and-report-surfaces';
  archetype: 'learner-record-pathway';
  mobileBehavior: 'path-evidence-next-action-stack';
  dockBehavior: 'learner-action-dock' | 'contextual-review-dock';
  visualEvidence: {
    requiredThemes: readonly ['light', 'dark'];
    requiredWidths: readonly [1440, 320];
  };
  semantics: readonly LearnerDataShellSemantic[];
  statusVocabulary: readonly string[];
  nextActions: readonly string[];
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
  teachingAssistantModes: {
    diagnosisExplainer: 'diagnosis-explainer';
    pathAdvisor: 'path-advisor';
    resourceCoach: 'resource-coach';
  };
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

export interface ControlCorrectionCenterEntryRoute {
  href: '/' | '/assessment/adaptive-practice' | '/dashboard' | '/profile' | '/profile/growth' | '/profile/evidence';
  source: ControlCorrectionCenterEntrySource;
  routeIntent: ControlCorrectionCenterRouteIntent;
  preservedQuery: {
    goal: 'control-correction';
    intent: ControlCorrectionCenterRouteIntent;
  };
}

export interface ControlCorrectionCenterRecoveryAction {
  href: string;
  label: string;
}

export interface ControlCorrectionCenterFallbackState {
  state: ControlCorrectionCenterStateKind;
  title: string;
  status: PlatformStatusPayload;
  actions: readonly ControlCorrectionCenterRecoveryAction[];
}

export interface ControlCorrectionCenterNextAction {
  nodeId: string | null;
  title: string;
  href: string;
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
  redirectHref?: string;
  completionAction?: {
    href: string;
    label: string;
    method: 'POST';
    body: Record<string, unknown>;
  };
  confidence: PlatformConfidenceStatus;
  evidenceLimitation: PlatformSourceCoverageStatus;
}

export interface ControlCorrectionCenterReadinessGate {
  ready: boolean;
  status: PlatformStatusPayload;
  missing: readonly string[];
}

export interface ControlCorrectionCenterLaunchContext {
  source: typeof ADAPTIVE_PATH_LAUNCH_SOURCE;
  goalId: string;
  pathId: string;
  nodeId: string;
  routeIntent: ControlCorrectionCenterRouteIntent;
  returnHref: string;
  resourceType: string;
}

export interface ControlCorrectionLearningCenterView extends AdaptiveLearningCenterView {
  goalId: string;
  entry: {
    source: ControlCorrectionCenterEntrySource;
    routeIntent: ControlCorrectionCenterRouteIntent;
  };
  competencyHero: AdaptiveLearningCenterPanel;
  nextAction: ControlCorrectionCenterNextAction;
  readinessGate: ControlCorrectionCenterReadinessGate;
  citationAccess: AdaptiveLearningCenterPanel;
  konlingDock: AdaptiveLearningCenterPanel;
  fallbackStates: readonly ControlCorrectionCenterFallbackState[];
  launchContexts: readonly ControlCorrectionCenterLaunchContext[];
}

export interface ControlCorrectionLearningCenterInput extends AdaptiveLearningCenterViewInput {
  goalId?: string;
  goalLabel?: string;
  entrySource?: ControlCorrectionCenterEntrySource;
  routeIntent?: ControlCorrectionCenterRouteIntent;
  networkError?: boolean;
  questionAvailable?: boolean;
}

export interface RecommendedPathNodeView {
  stage: string;
  nodeId: string;
  title: string;
  priority: number;
  confidence: PlatformConfidenceStatus;
  evidenceLimitation: PlatformSourceCoverageStatus;
  expectedEffort: string;
  sourceContext: string;
  statusLabel?: string;
  unlockMessage?: string;
  action?: {
    href: string;
    label: string;
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
    redirectHref?: string;
    completionAction?: {
      href: string;
      label: string;
      method: 'POST';
      body: Record<string, unknown>;
    };
  };
  state: RecommendedPathNodeState;
}

export interface RecommendedPathNodeViewModel {
  pathId: string;
  nodes: RecommendedPathNodeView[];
}

export interface RecommendedPathLaunchContext {
  goalId: string;
  pathId: string;
  routeIntent: ControlCorrectionCenterRouteIntent;
}

export interface AdaptivePathLaunchContextInput {
  goalId: string;
  pathId: string;
  nodeId: string;
  routeIntent: ControlCorrectionCenterRouteIntent;
  resourceType: string;
}

export interface AdaptivePathLaunchContext extends AdaptivePathLaunchContextInput {
  source: typeof ADAPTIVE_PATH_LAUNCH_SOURCE;
  returnHref: string;
}

export interface AdaptivePathCompletionRequestInput {
  launchContext: AdaptivePathLaunchContext;
  completedAt: string;
  evidenceRefs?: readonly Record<string, unknown>[];
  completionResult?: Record<string, unknown>;
}

export interface AdaptivePathCompletionRequest {
  href: string;
  method: 'POST';
  body: {
    nodeId: string;
    resourceType: string;
    status: 'completed';
    completedAt: string;
    idempotencyKey: string;
    evidenceRefs?: readonly Record<string, unknown>[];
    liftMetadata: Record<string, unknown>;
  };
}

export interface PracticeEntryRouteNodeInput {
  recommendedFocus: readonly string[];
  weakAreas: readonly string[];
  estimatedAbility?: number | null;
  confidenceInterval?: readonly [number, number] | null;
  actionHref: string;
}

export interface PracticeEntryRouteNode {
  nodeId: string;
  title: string;
  state: RecommendedPathNodeState;
  confidence: PlatformConfidenceStatus;
  evidenceLimitation: PlatformSourceCoverageStatus;
  missingEvidence: readonly string[];
  action: {
    href: string;
    label: string;
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
    redirectHref?: string;
    completionAction?: {
      href: string;
      label: string;
      method: 'POST';
      body: Record<string, unknown>;
    };
  };
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

export const LEARNER_DATA_SHELL_SEMANTICS: LearnerDataShellSemantic[] = [
  'ability-profile',
  'current-path',
  'evidence-timeline',
  'recommendations',
  'practice',
  'next-action',
];

const LEARNER_DATA_STATUS_VOCABULARY = [
  'confidence',
  'sourceCoverage',
  'readiness',
  'fallback',
] as const;

const LEARNER_DATA_NEXT_ACTIONS = [
  'start-practice',
  'review-evidence',
  'open-interactive-learning',
  'enter-simulation-or-arena',
] as const;

const LEGACY_COMPATIBLE_REGIONS: AdaptiveLearningCenterRegion[] = ['overview', 'practice', 'konling'];

const LEARNER_DATA_SURFACE_ROUTES: LearnerDataSurfaceRoute[] = [
  {
    href: '/dashboard',
    routeFile: 'src/app/(main)/dashboard/page.tsx',
    routeIdentity: 'student-cockpit',
    primaryRegion: 'overview',
  },
  {
    href: '/profile',
    routeFile: 'src/app/(main)/profile/page.tsx',
    routeIdentity: 'profile-overview',
    primaryRegion: 'learner-state',
  },
  {
    href: '/profile/growth',
    routeFile: 'src/app/(main)/profile/growth/page.tsx',
    routeIdentity: 'growth-center',
    primaryRegion: 'mastery',
  },
  {
    href: '/profile/evidence',
    routeFile: 'src/app/(main)/profile/evidence/page.tsx',
    routeIdentity: 'evidence-browser',
    primaryRegion: 'evidence',
  },
  {
    href: '/assessment/adaptive-practice',
    routeFile: 'src/app/assessment/adaptive-practice/page.tsx',
    routeIdentity: 'adaptive-practice',
    primaryRegion: 'practice',
  },
] as const;

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

const CONTROL_CORRECTION_CENTER_ENTRY_ROUTES: ControlCorrectionCenterEntryRoute[] = [
  {
    href: '/',
    source: 'homepage',
    routeIntent: 'practice',
    preservedQuery: { goal: 'control-correction', intent: 'practice' },
  },
  {
    href: '/dashboard',
    source: 'student-cockpit',
    routeIntent: 'learner-state-review',
    preservedQuery: { goal: 'control-correction', intent: 'learner-state-review' },
  },
  {
    href: '/profile',
    source: 'profile',
    routeIntent: 'learner-state-review',
    preservedQuery: { goal: 'control-correction', intent: 'learner-state-review' },
  },
  {
    href: '/profile/growth',
    source: 'profile',
    routeIntent: 'evidence-review',
    preservedQuery: { goal: 'control-correction', intent: 'evidence-review' },
  },
  {
    href: '/profile/evidence',
    source: 'profile',
    routeIntent: 'evidence-review',
    preservedQuery: { goal: 'control-correction', intent: 'evidence-review' },
  },
  {
    href: '/profile/growth',
    source: 'contextual-recommendation',
    routeIntent: 'contextual-recommendation',
    preservedQuery: { goal: 'control-correction', intent: 'contextual-recommendation' },
  },
  {
    href: '/assessment/adaptive-practice',
    source: 'adaptive-practice',
    routeIntent: 'practice',
    preservedQuery: { goal: 'control-correction', intent: 'practice' },
  },
];

export function getAdaptiveLearningCenterCompatibilityRoutes(): AdaptiveLearningCompatibilityRoute[] {
  return ADAPTIVE_LEARNING_CENTER_ROUTES.map((route) => ({ ...route }));
}

export function getLearnerDataSurfaceRoutes(): LearnerDataSurfaceRoute[] {
  return LEARNER_DATA_SURFACE_ROUTES.map((route) => ({ ...route }));
}

export function getControlCorrectionCenterEntryRoutes(): ControlCorrectionCenterEntryRoute[] {
  return CONTROL_CORRECTION_CENTER_ENTRY_ROUTES.map((route) => ({
    ...route,
    preservedQuery: { ...route.preservedQuery },
  }));
}

export function buildLearnerDataRouteShell(href: LearnerDataSurfaceRoute['href']): LearnerDataRouteShell {
  const route = LEARNER_DATA_SURFACE_ROUTES.find((entry) => entry.href === href);
  if (!route) {
    throw new Error(`Unsupported learner data route: ${href}`);
  }

  return {
    routeFamily: 'learner-data-pathway',
    routeIdentity: route.routeIdentity,
    owningChange: 'redesign-learner-data-and-report-surfaces',
    archetype: 'learner-record-pathway',
    mobileBehavior: 'path-evidence-next-action-stack',
    dockBehavior: route.href === '/dashboard' ? 'learner-action-dock' : 'contextual-review-dock',
    visualEvidence: {
      requiredThemes: ['light', 'dark'],
      requiredWidths: [1440, 320],
    },
    semantics: LEARNER_DATA_SHELL_SEMANTICS,
    statusVocabulary: LEARNER_DATA_STATUS_VOCABULARY,
    nextActions: LEARNER_DATA_NEXT_ACTIONS,
  };
}

export function buildAdaptivePathLaunchContext(input: AdaptivePathLaunchContextInput): AdaptivePathLaunchContext {
  const returnQuery = new URLSearchParams({
    goal: input.goalId,
    intent: input.routeIntent,
    pathId: input.pathId,
    nodeId: input.nodeId,
  });
  return {
    source: ADAPTIVE_PATH_LAUNCH_SOURCE,
    goalId: input.goalId,
    pathId: input.pathId,
    nodeId: input.nodeId,
    routeIntent: input.routeIntent,
    returnHref: `${ADAPTIVE_PATH_EXECUTION_RETURN_PATH}?${returnQuery.toString()}`,
    resourceType: input.resourceType,
  };
}

export function buildAdaptivePathLaunchHref(
  targetHref: string,
  input: AdaptivePathLaunchContextInput,
): string {
  const context = buildAdaptivePathLaunchContext(input);
  const hashIndex = targetHref.indexOf('#');
  const hrefWithoutHash = hashIndex >= 0 ? targetHref.slice(0, hashIndex) : targetHref;
  const hash = hashIndex >= 0 ? targetHref.slice(hashIndex) : '';
  const queryIndex = hrefWithoutHash.indexOf('?');
  const targetPath = queryIndex >= 0 ? hrefWithoutHash.slice(0, queryIndex) : hrefWithoutHash;
  const params = new URLSearchParams(queryIndex >= 0 ? hrefWithoutHash.slice(queryIndex + 1) : '');
  for (const key of ['source', 'goal', 'goalId', 'pathId', 'nodeId', 'intent', 'returnHref', 'resourceType']) {
    params.delete(key);
  }
  params.set('source', context.source);
  params.set('goal', context.goalId);
  params.set('goalId', context.goalId);
  params.set('pathId', context.pathId);
  params.set('nodeId', context.nodeId);
  params.set('intent', context.routeIntent);
  params.set('returnHref', context.returnHref);
  params.set('resourceType', context.resourceType);

  return `${targetPath}?${params.toString()}${hash}`;
}

export function resolveAdaptivePathLaunchReturnContext(
  searchParams: Pick<URLSearchParams, 'get'>,
): AdaptivePathLaunchContext | null {
  const source = searchParams.get('source');
  const goalId = searchParams.get('goalId') ?? searchParams.get('goal');
  const pathId = searchParams.get('pathId');
  const nodeId = searchParams.get('nodeId');
  const routeIntent = searchParams.get('intent');
  const returnHref = searchParams.get('returnHref');
  const resourceType = searchParams.get('resourceType');

  if (source !== ADAPTIVE_PATH_LAUNCH_SOURCE) return null;
  if (!goalId || !pathId || !nodeId || !returnHref || !resourceType) return null;
  if (routeIntent !== 'path-execution') return null;

  const normalizedReturnHref = normalizeAdaptivePathReturnHref(returnHref, {
    goalId,
    pathId,
    nodeId,
    routeIntent,
  });
  if (!normalizedReturnHref) return null;

  return {
    source: ADAPTIVE_PATH_LAUNCH_SOURCE,
    goalId,
    pathId,
    nodeId,
    routeIntent,
    returnHref: normalizedReturnHref,
    resourceType,
  };
}

export function isSimpleAdaptivePathCompletionResource(resourceType: string): boolean {
  return [
    'lesson_step',
    'knowledge_node',
    'knowledge_card',
    'textbook_section',
    'video',
    'audio',
    'slides',
    'handout',
    'quiz',
    'reflection',
    'project',
  ].includes(resourceType);
}

export function buildAdaptivePathCompletionRequest(
  input: AdaptivePathCompletionRequestInput,
): AdaptivePathCompletionRequest | null {
  const { launchContext } = input;
  if (!isSimpleAdaptivePathCompletionResource(launchContext.resourceType)) return null;

  return {
    href: `/api/learning-paths/${encodeURIComponent(launchContext.pathId)}/execute`,
    method: 'POST',
    body: {
      nodeId: launchContext.nodeId,
      resourceType: launchContext.resourceType,
      status: 'completed',
      completedAt: input.completedAt,
      idempotencyKey: `path-resource-completion:${launchContext.pathId}:${launchContext.nodeId}:${launchContext.resourceType}`,
      ...(input.evidenceRefs?.length ? { evidenceRefs: input.evidenceRefs } : {}),
      liftMetadata: {
        pathActivityKind: 'initial-completion',
        completionSource: 'interactive-resource',
        ...(input.completionResult ? { completionResult: input.completionResult } : {}),
      },
    },
  };
}

export function buildRecommendedPathNodeView(
  pathPlan: AdaptiveLearningPathPlan,
  launchContext?: RecommendedPathLaunchContext,
): RecommendedPathNodeViewModel {
  return {
    pathId: pathPlan.id,
    nodes: pathPlan.mainPath.map((node, index) => {
      const state = recommendedNodeState(node.status, node.readiness?.state);
      return {
        stage: pathPlan.stage,
        nodeId: node.nodeId,
        title: node.title,
        priority: index + 1,
        confidence: pathPlan.confidence.level,
        evidenceLimitation: pathPlan.confidence.sourceCoverage <= 0
          ? 'missing'
          : pathPlan.confidence.sourceCoverage >= 0.75
            ? 'complete'
            : 'partial',
        expectedEffort: `${node.estimatedTimeMinutes} 分钟`,
        sourceContext: `${node.sourceKind}:${node.sourceRef}`,
        statusLabel: state === 'locked' ? '稍后解锁' : undefined,
        unlockMessage: node.readiness?.unlockMessage ?? undefined,
        action: state === 'locked'
          ? undefined
          : {
              ...pathNodeLaunchAction(node.target, node.nodeId, node.type, launchContext),
              label: pathPlan.currentNodeId === node.nodeId ? '继续当前节点' : '打开路径节点',
            },
        state,
      };
    }),
  };
}

export function buildControlCorrectionLearningCenterView(
  input: ControlCorrectionLearningCenterInput,
): ControlCorrectionLearningCenterView {
  const pathPlan = input.pathPlan ?? null;
  const goalId = pathPlan?.goal.id ?? input.goalId ?? 'control-correction';
  const goalLabel = pathPlan?.goal.title ?? input.goalLabel ?? formatAdaptivePathGoalLabel(goalId);
  const baseView = buildAdaptiveLearningCenterView({ ...input, pathPlan });
  const routeIntent = input.routeIntent ?? 'practice';
  const entrySource = input.entrySource ?? 'adaptive-practice';
  const learnerState = isServerOwnedLearnerState(input.learnerState) ? input.learnerState : null;
  const pathNodes = pathPlan
    ? buildRecommendedPathNodeView(pathPlan, {
        goalId,
        pathId: pathPlan.id,
        routeIntent: 'path-execution',
      }).nodes
    : [];
  const nextNode = selectNextRecommendedPathActionNode(pathNodes);
  const evidencePanel = baseView.panels.find((panel) => panel.region === 'evidence') ?? fallbackPanel('evidence');
  const konlingDock = baseView.panels.find((panel) => panel.region === 'konling') ?? konlingPanel(input.konling ?? null);
  const currentPath = baseView.panels.find((panel) => panel.region === 'current-path') ?? currentPathPanel(pathPlan);
  const fallbackStates = buildControlCorrectionFallbackStates({
    featureEnabled: baseView.mode === 'adaptive-learning-center',
    learnerState,
    pathPlan,
    networkError: input.networkError ?? false,
    questionAvailable: input.questionAvailable ?? true,
    goalId,
    goalLabel,
  });
  const blockingStates = fallbackStates.filter((state) => state.state !== 'path-ready');

  return {
    ...baseView,
    goalId,
    entry: {
      source: entrySource,
      routeIntent,
    },
    competencyHero: {
      id: 'control-correction-competency-hero',
      region: 'mastery',
      title: '控制校正能力状态',
      status: learnerStateStatus(learnerState),
      payload: {
        goalId,
        competencies: learnerState?.primaryCompetencies ?? null,
        knowledgeMastery: learnerState?.knowledgeMastery ?? null,
      },
    },
    nextAction: {
      nodeId: nextNode?.nodeId ?? null,
      title: nextNode?.title ?? `生成${goalLabel}学习路径`,
      href: nextNode?.action?.href ?? `/assessment/adaptive-practice?goal=${encodeURIComponent(goalId)}&intent=${routeIntent}`,
      method: nextNode?.action?.method ?? 'GET',
      body: nextNode?.action?.body,
      redirectHref: nextNode?.action?.redirectHref,
      completionAction: nextNode?.action?.completionAction,
      confidence: nextNode?.confidence ?? 'unknown',
      evidenceLimitation: nextNode?.evidenceLimitation ?? 'missing',
    },
    readinessGate: {
      ready: blockingStates.length === 0,
      status: currentPath.status,
      missing: blockingStates.map((state) => state.state),
    },
    citationAccess: {
      ...evidencePanel,
      id: 'control-correction-citation-drawer',
      title: '证据与引用',
    },
    konlingDock: {
      ...konlingDock,
      id: 'control-correction-konling-dock',
      title: 'Konling 校正支持',
    },
    fallbackStates,
    launchContexts: pathPlan
      ? pathPlan.mainPath.map((node) => buildAdaptivePathLaunchContext({
          goalId,
          pathId: pathPlan.id,
          nodeId: node.nodeId,
          routeIntent: 'path-execution',
          resourceType: node.type,
        }))
      : [],
  };
}

function selectNextRecommendedPathActionNode(
  nodes: RecommendedPathNodeView[],
): RecommendedPathNodeView | null {
  for (const node of nodes) {
    if (node.state === 'completed') continue;
    if (node.state === 'locked' || node.state === 'blocked') return null;
    if (node.action) return node;
  }
  return null;
}

function formatAdaptivePathGoalLabel(goalId: string): string {
  if (goalId === 'frequency-response-foundations') return '频率响应基础';
  return '控制校正';
}

export function buildPracticeEntryRouteNodes(input: PracticeEntryRouteNodeInput): PracticeEntryRouteNode[] {
  const confidence = practiceConfidence(input.estimatedAbility, input.confidenceInterval);
  const evidenceLimitation: PlatformSourceCoverageStatus = input.weakAreas.length > 0 ? 'partial' : 'complete';

  return input.recommendedFocus.map((title, index) => ({
    nodeId: `practice-focus-${index + 1}`,
    title,
    state: index === 0 ? 'current' : 'optional',
    confidence,
    evidenceLimitation,
    missingEvidence: [...input.weakAreas],
    action: {
      href: practiceRouteNodeHref(input.actionHref, index + 1),
      label: index === 0 ? '开始当前训练' : '查看训练节点',
      method: 'GET',
    },
  }));
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
    status: state.mode === 'adaptive-learning-center' && learnerState
      ? learnerStateStatus(learnerState, Boolean(input.clientProfileHints))
      : state.status,
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

function recommendedNodeState(
  status: AdaptiveLearningPathPlan['mainPath'][number]['status'],
  readinessState?: string,
): RecommendedPathNodeState {
  if (status === 'completed' || status === 'blocked' || status === 'locked') {
    return status;
  }
  if (readinessState && readinessState !== 'ready') return 'locked';
  if (status === 'current' || status === 'next') return status;
  return 'optional';
}

function practiceConfidence(
  estimatedAbility?: number | null,
  confidenceInterval?: readonly [number, number] | null
): PlatformConfidenceStatus {
  if (typeof estimatedAbility !== 'number' || !confidenceInterval) return 'low';
  const intervalWidth = Math.abs(confidenceInterval[1] - confidenceInterval[0]);
  if (intervalWidth <= 0.3) return 'high';
  if (intervalWidth <= 0.6) return 'medium';
  return 'low';
}

function practiceRouteNodeHref(actionHref: string, priority: number): string {
  const separator = actionHref.includes('?') ? '&' : '?';
  return `${actionHref}${separator}focus=practice-focus-${priority}`;
}

function pathNodeLaunchAction(
  target: string,
  nodeId: string,
  resourceType: string,
  launchContext?: RecommendedPathLaunchContext,
): Omit<NonNullable<RecommendedPathNodeView['action']>, 'label'> {
  const href = normalizePathNodeTarget(target);
  if (!launchContext) return { href, method: 'GET' };
  if (resourceType === 'external_resource') {
    return {
      href: `/api/learning-paths/${encodeURIComponent(launchContext.pathId)}/execute`,
      method: 'POST',
      redirectHref: href,
      body: {
        nodeId,
        resourceType: 'external_resource',
        status: 'started',
        idempotencyKey: `external-resource-access:${launchContext.pathId}:${nodeId}`,
        liftMetadata: {
          launchIntent: launchContext.routeIntent,
        },
      },
      completionAction: {
        href: `/api/learning-paths/${encodeURIComponent(launchContext.pathId)}/execute`,
        label: '已学习该资料，继续路径',
        method: 'POST',
        body: {
          nodeId,
          resourceType: 'external_resource',
          status: 'completed',
          idempotencyKey: `external-resource-completion:${launchContext.pathId}:${nodeId}`,
          liftMetadata: {
            launchIntent: launchContext.routeIntent,
            completionIntent: 'learner-confirmed-external-resource',
          },
        },
      },
    };
  }

  return {
    href: buildAdaptivePathLaunchHref(href, {
      goalId: launchContext.goalId,
      pathId: launchContext.pathId,
      nodeId,
      routeIntent: launchContext.routeIntent,
      resourceType,
    }),
    method: 'GET',
  };
}

function normalizeAdaptivePathReturnHref(
  returnHref: string,
  expected: Pick<AdaptivePathLaunchContext, 'goalId' | 'pathId' | 'nodeId' | 'routeIntent'>,
): string | null {
  if (!returnHref.startsWith('/') || returnHref.startsWith('//')) return null;

  let parsed: URL;
  try {
    parsed = new URL(returnHref, 'https://act.local');
  } catch {
    return null;
  }

  if (parsed.pathname !== ADAPTIVE_PATH_EXECUTION_RETURN_PATH) return null;
  const goal = parsed.searchParams.get('goal') ?? parsed.searchParams.get('goalId');
  if (goal !== expected.goalId) return null;
  if (parsed.searchParams.get('pathId') !== expected.pathId) return null;
  if (parsed.searchParams.get('nodeId') !== expected.nodeId) return null;
  if (parsed.searchParams.get('intent') !== expected.routeIntent) return null;

  return `${parsed.pathname}${parsed.search}`;
}

function normalizePathNodeTarget(target: string): string {
  if (target.startsWith('course-content/runtime/knowledge/')) {
    return target.replace('course-content/runtime/knowledge/', '/course-runtime/knowledge/');
  }
  return target;
}

function buildControlCorrectionFallbackStates(input: {
  featureEnabled: boolean;
  learnerState: AdaptiveLearnerState | null;
  pathPlan: AdaptiveLearningPathPlan | null;
  networkError: boolean;
  questionAvailable: boolean;
  goalId: string;
  goalLabel: string;
}): ControlCorrectionCenterFallbackState[] {
  const goalQuery = encodeURIComponent(input.goalId);
  const evidenceHref = `/profile/evidence?goal=${goalQuery}`;
  return [
    !input.featureEnabled
      ? controlCorrectionFallbackState(
          'feature-flag-disabled',
          `${input.goalLabel}中心暂未启用`,
          'adaptive-learning-center-flag-disabled',
          'not-ready',
          `/assessment/adaptive-practice?goal=${goalQuery}`,
          '进入兼容练习',
          evidenceHref,
        )
      : null,
    input.networkError
      ? controlCorrectionFallbackState(
          'network-error',
          `${input.goalLabel}数据暂时无法加载`,
          'network-error',
          'degraded',
          `/assessment/adaptive-practice?goal=${goalQuery}`,
          '重试加载',
          evidenceHref,
        )
      : null,
    input.learnerState && input.learnerState.evidence.readState === 'stale'
      ? controlCorrectionFallbackState(
          'loading',
          '正在刷新学习证据',
          'stale-learner-state',
          'degraded',
          `/profile/evidence?goal=${goalQuery}`,
          '查看证据',
          evidenceHref,
        )
      : null,
    !input.learnerState || input.learnerState.missingEvidence.length > 0
      ? controlCorrectionFallbackState(
          'low-evidence',
          `${input.goalLabel}证据不足`,
          `missing-${input.goalId}-evidence`,
          'degraded',
          `/assessment/adaptive-practice?goal=${goalQuery}`,
          '先完成诊断练习',
          evidenceHref,
        )
      : null,
    !input.pathPlan
      ? controlCorrectionFallbackState(
          'no-path',
          `尚未生成${input.goalLabel}路径`,
          `missing-${input.goalId}-path`,
          'not-ready',
          `/profile/growth?goal=${goalQuery}`,
          '查看成长状态',
          evidenceHref,
        )
      : null,
    input.pathPlan && !input.questionAvailable && !input.pathPlan.currentNodeId
      ? controlCorrectionFallbackState(
          'no-question',
          '当前路径暂无可用题目',
          `missing-${input.goalId}-question`,
          'degraded',
          `/interactive-learning?goal=${goalQuery}`,
          '打开互动学习',
          evidenceHref,
        )
      : null,
    input.pathPlan && input.pathPlan.status === 'ready'
      ? controlCorrectionFallbackState(
          'path-ready',
          `${input.goalLabel}路径已就绪`,
          null,
          'ready',
          `/assessment/adaptive-practice?goal=${goalQuery}`,
          '继续当前节点',
          evidenceHref,
        )
      : null,
  ].filter((state): state is ControlCorrectionCenterFallbackState => Boolean(state));
}

function controlCorrectionFallbackState(
  state: ControlCorrectionCenterStateKind,
  title: string,
  fallbackReason: string | null,
  readiness: PlatformReadinessStatus,
  href: string,
  label: string,
  evidenceHref: string,
): ControlCorrectionCenterFallbackState {
  return {
    state,
    title,
    status: buildAdaptiveClaimStatus({
      id: `control-correction-center-${state}`,
      label: title,
      domain: 'path',
      confidence: state === 'path-ready' ? 'medium' : 'unknown',
      sourceCoverage: state === 'path-ready' ? 'partial' : 'missing',
      privacy: 'classroom',
      readiness,
      fallbackReason,
    }),
    actions: [
      {
        href,
        label,
      },
      {
        href: evidenceHref,
        label: '查看证据来源',
      },
    ],
  };
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
  if (learnerState.evidence.readState === 'stale') return 'stale';
  if (learnerState.evidence.readState === 'missing') return 'missing';
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
          currentNodeId: pathPlan.currentNodeId,
          mainPath: pathPlan.mainPath.map(toStudentPathNode),
          alternatives: pathPlan.alternatives.map(toStudentPathAlternative),
          pathOptions: buildPathOptionSummaries(pathPlan),
          pathOptionFallback: buildPathOptionFallback(pathPlan),
          configurationFulfillment: (pathPlan.explanations.configurationFulfillment ?? []).map(
            toStudentConfigurationFulfillment,
          ),
          selectionHistory: buildPathSelectionHistory(pathPlan),
        }
      : null,
  };
}

function toStudentConfigurationFulfillment(
  fulfillment: AdaptiveLearningPathPlan['explanations']['configurationFulfillment'][number],
) {
  return {
    key: fulfillment.key,
    status: fulfillment.status,
    effect: fulfillment.effect,
    message: fulfillment.message,
  };
}

function pathReadinessDetails(nodes: AdaptiveLearningPathPlan['mainPath']) {
  return nodes.map((node) => ({
    nodeId: node.nodeId,
    title: node.title,
    target: node.target,
    prerequisiteNodeIds: node.prerequisiteNodeIds,
    readiness: node.readiness,
  }));
}

function buildPathOptionSummaries(pathPlan: AdaptiveLearningPathPlan) {
  const actionablePaths = pathPlan.policyBundle?.paths
    .map((path, index) => ({ path, index }))
    .filter(({ path }) => path.nodeIds.length > 0) ?? [];
  if (!actionablePaths.length && pathPlan.mainPath.length > 0) {
    const estimatedMinutes = pathPlan.mainPath.reduce((sum, node) => sum + node.estimatedTimeMinutes, 0);
    const terminalValidationNodeIds = pathPlan.mainPath
      .filter((node) => node.terminalConstraints.includes('terminal-validation'))
      .map((node) => node.nodeId);
    const generationEvidenceDeficits = pathPlan.visualization?.evidence?.learnerStateDeficits;
    const persistedProvenance = pathPlan.pathOptions?.[0]?.recommendationProvenance;
    return [{
      optionId: 'path-option-1',
      label: '推荐学习路径',
      nodeIds: pathPlan.mainPath.map((node) => node.nodeId),
      nodeSummaries: pathPlan.mainPath.map((node) => ({
        nodeId: node.nodeId,
        title: node.title,
        pathNodeType: node.pathNodeType,
        displayName: node.displayName,
        iconKey: node.iconKey,
        shapeHint: node.shapeHint,
        evidenceBehavior: node.evidenceBehavior,
        evidenceStatus: node.evidenceStatus,
        estimatedTimeMinutes: node.estimatedTimeMinutes,
        status: node.status,
      })),
      lockedNodeIds: pathPlan.mainPath
        .filter((node) => node.readiness?.state !== 'ready')
        .map((node) => node.nodeId),
      readinessSummary: pathPlan.mainPath.map((node) => ({
        nodeId: node.nodeId,
        state: node.readiness?.state ?? 'unknown',
        message: node.readiness?.message ?? '准备条件待确认。',
      })),
      readinessDetails: pathReadinessDetails(pathPlan.mainPath),
      targetDeficits: generationEvidenceDeficits?.map(toStudentDeficit) ?? [],
      ...(persistedProvenance ? { recommendationProvenance: persistedProvenance } : {}),
      evidenceBasis: pathPlan.confidence.level === 'low'
        ? ['当前证据较少，路径会从基础资源开始。']
        : ['路径已结合你的近期学习证据。'],
      resourceMix: pathPlan.mainPath.reduce<Record<string, number>>((mix, node) => {
        mix[node.type] = (mix[node.type] ?? 0) + 1;
        return mix;
      }, {}),
      effort: {
        estimatedMinutes,
        relative: 'standard',
      },
      expectedTargetLift: pathPlan.score.objectives.learningGain,
      terminalValidationNodeIds,
      terminalValidationStrategy: {
        nodeIds: terminalValidationNodeIds,
        summary: terminalValidationIsIncludedButUnverifiable(pathPlan.mainPath, terminalValidationNodeIds)
          ? '终点已纳入但当前不可验证'
          : terminalValidationNodeIds.length > 0
            ? `terminal validation through ${terminalValidationNodeIds.join(', ')}`
            : '阶段检查点用于学习反馈',
      },
      limitations: [
        ...(pathPlan.status === 'fallback'
          ? pathPlan.explanations.fallbackReasons.map(toStudentPathReason)
          : []),
        ...(terminalValidationIsIncludedButUnverifiable(pathPlan.mainPath, terminalValidationNodeIds)
          ? ['终点已纳入但当前不可验证']
          : []),
      ],
    }];
  }
  if (!actionablePaths.length) {
    return [];
  }
  return actionablePaths.map(({ path, index }) => ({
    optionId: `path-option-${index + 1}`,
    label: path.label,
    nodeIds: path.nodeIds,
    nodeSummaries: path.nodeSummaries,
    lockedNodeIds: path.lockedNodeIds,
    readinessSummary: path.readinessSummary,
    readinessDetails: pathReadinessDetails(path.planNodes?.length ? path.planNodes : pathPlan.mainPath),
    targetDeficits: path.targetDeficits.map(toStudentDeficit),
    recommendationProvenance: path.recommendationProvenance,
    decisionEvidence: path.decisionEvidence,
    evidenceBasis: path.evidenceBasis.map(toStudentPathReason),
    resourceMix: path.resourceMix,
    overlap: path.overlap,
    effort: path.effort,
    expectedTargetLift: path.expectedTargetLift,
    terminalValidationNodeIds: path.terminalValidationNodeIds,
    terminalValidationStrategy: path.terminalValidationStrategy,
    limitations: path.limitations.map(toStudentPathReason),
  })) ?? [];
}

function buildPathOptionFallback(pathPlan: AdaptiveLearningPathPlan) {
  if (!pathPlan.policyBundle || pathPlan.policyBundle.status === 'ready') {
    return null;
  }
  return {
    status: pathPlan.policyBundle.status,
    fallbackReasons: pathPlan.policyBundle.fallbackReasons.map(toStudentPathReason),
    diversity: {
      resourceOverlap: pathPlan.policyBundle.diversity.maxResourceOverlap,
      modalityDistance: pathPlan.policyBundle.diversity.minModalityDistance,
      effortDifference: pathPlan.policyBundle.diversity.minEstimatedEffortDifference,
      terminalValidationDifference: pathPlan.policyBundle.diversity.terminalValidationDifference,
    },
  };
}

function buildPathSelectionHistory(pathPlan: AdaptiveLearningPathPlan) {
  const optionLabels = buildPathOptionLabelMap(pathPlan);
  return pathPlan.feedbackEvents
    .filter((event) => event.type === 'selection' || event.type === 'rejection' || event.type === 'switch' || event.type === 'helpfulness')
    .map((event) => {
      const context = event.context && typeof event.context === 'object' && !Array.isArray(event.context)
        ? event.context as Record<string, unknown>
        : {};
      return {
        type: event.type,
        nodeId: event.nodeId,
        createdAt: event.createdAt,
        selectedOptionLabel: typeof context.selectedStyleId === 'string'
          ? optionLabels.get(context.selectedStyleId) ?? '已选路径'
          : null,
        previousOptionLabel: typeof context.previousStyleId === 'string'
          ? optionLabels.get(context.previousStyleId) ?? '上一条路径'
          : null,
        rejectedOptionLabels: Array.isArray(context.rejectedStyleIds)
          ? context.rejectedStyleIds
              .filter((item): item is string => typeof item === 'string')
              .map((item) => optionLabels.get(item) ?? '未采用路径')
          : [],
        helpful: typeof context.helpful === 'boolean'
          ? context.helpful
          : typeof event.helpful === 'boolean' ? event.helpful : null,
      };
    });
}

function buildPathOptionLabelMap(pathPlan: AdaptiveLearningPathPlan): Map<string, string> {
  return new Map(pathPlan.policyBundle?.paths.map((path) => [path.styleId, path.label]) ?? []);
}

function toStudentPathNode(node: AdaptiveLearningPathPlan['mainPath'][number]) {
  return {
    nodeId: node.nodeId,
    title: node.title,
    type: node.type,
    pathNodeType: node.pathNodeType,
    displayName: node.displayName,
    iconKey: node.iconKey,
    shapeHint: node.shapeHint,
    evidenceBehavior: node.evidenceBehavior,
    evidenceStatus: node.evidenceStatus,
    externalResource: node.externalResource,
    checkpointContract: node.checkpoint,
    target: node.target,
    estimatedTimeMinutes: node.estimatedTimeMinutes,
    prerequisiteNodeIds: node.prerequisiteNodeIds,
    knowledgeCoverage: node.knowledgeCoverage,
    status: node.status,
    score: node.score,
    checkpoint: node.terminalConstraints.length > 0,
  };
}

function toStudentPathAlternative(alternative: AdaptiveLearningPathPlan['alternatives'][number]) {
  return {
    nodeId: alternative.nodeId,
    nodeIds: alternative.nodeIds,
    title: alternative.title,
    score: alternative.score,
    blocked: alternative.blocked,
  };
}

function toStudentDeficit(deficit: AdaptiveLearningPathDeficit) {
  return {
    targetId: deficit.targetId,
    kind: deficit.kind,
    value: deficit.value,
    confidence: deficit.confidence,
    evidenceCount: deficit.evidenceCount,
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

  const fallbackReasons = Array.isArray(pathPlan.explanations?.fallbackReasons)
    ? pathPlan.explanations.fallbackReasons
    : [];

  return buildAdaptiveClaimStatus({
    id: 'adaptive-center-path',
    label: '规则图学习路径',
    domain: 'path',
    confidence: pathPlan.confidence.level,
    sourceCoverage: pathPlan.confidence.sourceCoverage <= 0
      ? 'missing'
      : pathPlan.confidence.sourceCoverage >= 0.75
        ? 'complete'
        : 'partial',
    privacy: 'classroom',
    readiness: pathPlan.status === 'ready' ? 'ready' : 'degraded',
    fallbackReason: fallbackReasons[0]
      ? toStudentPathReason(fallbackReasons[0])
      : null,
  });
}

function terminalValidationIsIncludedButUnverifiable(
  path: AdaptiveLearningPathPlan['mainPath'],
  terminalValidationNodeIds: string[],
): boolean {
  if (terminalValidationNodeIds.length === 0) return false;
  const terminals = path.filter((node) => terminalValidationNodeIds.includes(node.nodeId));
  if (terminals.length === 0) return true;
  return terminals.every((node) =>
    node.status === 'locked'
    || node.status === 'blocked'
    || (node.readiness?.state ?? 'ready') !== 'ready');
}

function toStudentPathReason(reason: string): string {
  const reasons: Record<string, string> = {
    'adaptive-learner-state': '学习证据',
    LearningFact: '练习记录',
    SimulationRun: '仿真记录',
    ArenaSubmission: '挑战记录',
    'low-confidence-learner-state': '证据较少',
    'learner-state-missing': '学习证据待补充',
    'learner-evidence-low-confidence': '当前证据较少',
    'resource-mapping-insufficient': '可用学习资源不足',
    'feasible-goal-path-missing': '暂未形成完整路径',
    'missing-rules-graph-path-payload': '路径待生成',
    'time-budget-insufficient': '当前时间预算不足',
    'risk-intervention-resource-missing': '需要补充支持资源',
    'teacher-assignment-resource-missing': '教师指定资源待补充',
    'terminal-validation-resource-missing': '终点检验资源待补充',
    'path-diversity-insufficient': '路径差异不足',
    'path-modality-diversity-insufficient': '资源形式差异不足',
    'path-effort-diversity-insufficient': '学习时长差异不足',
    'terminal-validation-diversity-insufficient': '终点检验差异不足',
    'policy-option-diversity-unavailable': '当前资源只能形成单一推荐方案',
    'title-or-score-only-duplicates-removed': studentVisibleCandidateLimitation('title-or-score-only-duplicates-removed'),
    'insufficient-distinct-resources': studentVisibleCandidateLimitation('insufficient-distinct-resources'),
    'policy-path-resource-missing': '路径资源不足',
    'policy-paths-identical': '路径选项过于接近',
    'terminal-validation-missing': '需要完成终点检验',
    'some-targets-have-no-direct-evidence': '部分目标还缺少直接证据',
    'low-learner-state-confidence': '当前证据较少',
    '终点已纳入但当前不可验证': '终点已纳入但当前不可验证',
  };
  return reasons[reason] ?? '路径状态待确认';
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
  const hasKonlingContext = Boolean(
    konling && (konling.contextSource !== 'none' || konling.interventionBasis),
  );
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
      confidence: hasKonlingContext ? 'medium' : 'unknown',
      sourceCoverage: hasKonlingContext ? 'partial' : 'missing',
      privacy: 'private',
      readiness: hasKonlingContext ? 'degraded' : 'not-ready',
      fallbackReason: hasKonlingContext ? null : 'missing-konling-context',
      details: [
        {
          label: '上下文来源',
          value: konling?.contextSource ?? 'none',
          roleScope: 'student-visible',
        },
        {
          label: '助理模式',
          value: [
            konling?.teachingAssistantModes.diagnosisExplainer ?? 'diagnosis-explainer',
            konling?.teachingAssistantModes.pathAdvisor ?? 'path-advisor',
            konling?.teachingAssistantModes.resourceCoach ?? 'resource-coach',
          ].join(', '),
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
      teachingAssistantModes: {
        diagnosisExplainer: 'diagnosis-explainer',
        pathAdvisor: 'path-advisor',
        resourceCoach: 'resource-coach',
      },
      interventionBasis: null,
      cooldown: { active: false, until: null },
      feedback: { state: 'unavailable' },
    },
  };
}
