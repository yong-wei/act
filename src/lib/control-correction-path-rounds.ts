import {
  getRegisteredAdaptiveLearningPathGoal,
  serializeLearningPathPlan,
  type AdaptiveLearningPathPlan,
  type AdaptiveLearningPathPlanNode,
} from './adaptive-learning-path-planner';

export const CONTROL_CORRECTION_PATH_ROUND_GOAL_ID = 'control-correction';
export const CONTROL_CORRECTION_PATH_ROUND_PLANNER_VERSION = 'stage-1-rules-graph';
export const CONTROL_CORRECTION_TERMINAL_VALIDATION_POLICY_VERSION = 'control-correction-terminal-validation.v1';

const DEFAULT_TERMINAL_VALIDATION_POLICY = {
  version: CONTROL_CORRECTION_TERMINAL_VALIDATION_POLICY_VERSION,
  mustIncludeSimulation: true,
  mustEndWithArena: true,
  allowPreviewValidation: false,
  minimumReplayConfidence: 0.7,
  requireOfficialArenaEvidence: true,
};

export interface ControlCorrectionPathRoundDb {
  learningPath: {
    upsert: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any | null>;
    update?: (args: any) => Promise<any>;
  };
  learningPathExecution: AppendOnlyDelegate;
  learningPathDeviation: AppendOnlyDelegate;
  learningPathIntervention: AppendOnlyDelegate;
  evidenceOutbox?: {
    createMany: (args: { data: any[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
  };
  learningFact?: {
    createMany: (args: { data: any[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
  };
}

interface AppendOnlyDelegate {
  findFirst: (args: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
}

export interface PersistControlCorrectionPathRoundInput {
  plan: AdaptiveLearningPathPlan;
  learnerStateRef?: string | null;
  inputSnapshot?: Record<string, unknown> | null;
  classId?: string | null;
}

export interface PathNodeExecutionInput {
  pathId: string;
  userId: string;
  goalId?: string | null;
  nodeId: string;
  resourceType: string;
  status: 'started' | 'completed' | 'failed' | 'abandoned';
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  failedAt?: Date | string | null;
  evidenceRefs?: unknown[];
  liftMetadata?: Record<string, unknown>;
  simulationRef?: Record<string, unknown> | null;
  arenaRef?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
}

export interface PathExecutionResultSummary {
  state: 'available' | 'pending';
  kind: 'adaptive-assessment' | 'simulation' | 'control-workbench' | 'arena';
  label: string;
  outcomeId?: string;
  evidenceSource: string;
  reviewState: 'ready' | 'pending-sync';
  primaryMetric?: string;
  occurredAt?: string;
}

export interface PathDeviationInput {
  pathId: string;
  userId: string;
  goalId?: string | null;
  deviationType: 'skip' | 'timeout' | 'manual-jump' | 'resource-failure' | 'abandonment' | 'help-request';
  priorNodeId?: string | null;
  targetNodeId?: string | null;
  context?: Record<string, unknown>;
  evidenceConfidence?: 'low' | 'medium' | 'high' | 'unknown';
  idempotencyKey?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
}

export interface PathInterventionInput {
  pathId: string;
  userId: string;
  goalId?: string | null;
  interventionKind: 'diagnosis' | 'hint' | 'rollback' | 'fallback-path' | 'reflection-prompt';
  citedEvidence?: unknown[];
  suggestedAction: string;
  studentOutcome?: 'pending' | 'accepted' | 'ignored' | 'rejected' | 'partially-accepted' | 'dismissed' | 'completed';
  privacySafeSummary: string;
  idempotencyKey?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
}

export type PathChoiceEvidenceAction = 'selection' | 'rejection' | 'switch' | 'helpfulness';

export interface PathChoiceEvidenceInput {
  pathId: string;
  userId: string;
  goalId?: string | null;
  action: PathChoiceEvidenceAction;
  selectedStyleId?: string | null;
  selectedPolicyFamily?: string | null;
  rejectedStyleIds?: string[];
  previousStyleId?: string | null;
  diagnosisSnapshotRef?: string | null;
  resourceMix?: Record<string, number>;
  rationaleMetadata?: Record<string, unknown>;
  helpful?: boolean | null;
  eventId?: string | null;
  idempotencyKey?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
}

export interface LegacyLearningPathSummary {
  id: string;
  title: string;
  description: string | null;
  estimatedTime: number;
  nodeIds: unknown;
  isAiGenerated: boolean;
  pathStatus?: string | null;
  currentNodeId?: string | null;
}

export class ControlCorrectionPathRoundConflictError extends Error {
  constructor(message = 'control-correction path round id conflicts with an existing path') {
    super(message);
    this.name = 'ControlCorrectionPathRoundConflictError';
  }
}

export class ControlCorrectionPathRoundValidationError extends Error {
  constructor(message = 'control-correction path plan failed persistence validation') {
    super(message);
    this.name = 'ControlCorrectionPathRoundValidationError';
  }
}

export function isControlCorrectionPathRoundPersistenceEnabled(): boolean {
  return process.env.CONTROL_CORRECTION_PATH_ROUNDS_ENABLED !== 'false';
}

export async function persistControlCorrectionPathRound(
  db: ControlCorrectionPathRoundDb,
  input: PersistControlCorrectionPathRoundInput,
): Promise<any> {
  validateControlCorrectionPathPlanForPersistence(input.plan);
  return persistLearningPathRound(db, input);
}

export async function persistLearningPathRound(
  db: ControlCorrectionPathRoundDb,
  input: PersistControlCorrectionPathRoundInput,
): Promise<any> {
  validateLearningPathPlanForPersistence(input.plan);
  const record = serializeLearningPathPlan(input.plan);
  const existing = await db.learningPath.findFirst({
    where: { id: record.id },
    select: { id: true, userId: true, goalId: true, pathPayload: true },
  });
  if (existing && (existing.userId !== record.userId || existing.goalId !== input.plan.goal.id)) {
    throw new ControlCorrectionPathRoundConflictError();
  }
  const existingPathPayload = toRecord(existing?.pathPayload);
  const selectionHistory = mergePathPayloadEntries(
    existingPathPayload.selectionHistory,
    buildPathSelectionHistory(record.payload.feedbackEvents),
  );
  const activity = mergePathPayloadEntries(
    existingPathPayload.activity,
    buildGenericPathActivity(input.plan),
  );
  const terminalValidation = resolveTerminalValidation(
    input.plan.mainPath,
    getRegisteredAdaptiveLearningPathGoal(input.plan.goal.id)?.checkpointPolicy.requiresTerminalValidation ?? false,
  );
  const pathPayload = {
    goalId: input.plan.goal.id,
    plannerVersion: input.plan.stage,
    status: record.payload.status,
    mainPathNodeIds: input.plan.mainPath.map((node) => node.nodeId),
    planNodes: record.payload.planNodes,
    score: record.payload.score,
    confidence: record.payload.confidence,
    policyBundle: record.payload.policyBundle ?? null,
    feedbackEvents: record.payload.feedbackEvents,
    selectionHistory,
    activity,
    visualization: record.payload.visualization,
  };
  const explanationPayload = {
    explanations: record.payload.explanations,
    selectedReasons: record.payload.explanations.selectedReasons,
    fallbackReasons: record.payload.explanations.fallbackReasons,
    studentFacing: record.payload.studentFacing,
  };
  const alternativePayload = record.payload.alternatives;
  const data = {
    userId: record.userId,
    title: record.title,
    description: record.description,
    estimatedTime: record.estimatedTime,
    nodeIds: record.nodeIds,
    isAiGenerated: true,
    goalId: input.plan.goal.id,
    plannerVersion: input.plan.stage,
    pathStatus: input.plan.status === 'ready' ? 'active' : 'fallback',
    currentNodeId: input.plan.currentNodeId,
    learnerStateRef: input.learnerStateRef ?? null,
    classId: input.classId ?? null,
    inputSnapshot: input.inputSnapshot ?? null,
    pathPayload,
    explanationPayload,
    alternativePayload,
    entryNodeId: input.plan.mainPath[0]?.nodeId ?? null,
    terminalValidation,
    lastExecutionMetadata: input.plan.executionStatus,
    legacySummaryPayload: toLegacyLearningPathSummary({
      id: record.id,
      title: record.title,
      description: record.description,
      estimatedTime: record.estimatedTime,
      nodeIds: record.nodeIds,
      isAiGenerated: true,
      pathStatus: input.plan.status === 'ready' ? 'active' : 'fallback',
      currentNodeId: input.plan.currentNodeId,
    }),
  };

  return db.learningPath.upsert({
    where: { id: record.id },
    create: { id: record.id, ...data },
    update: data,
  });
}

function buildPathSelectionHistory(
  feedbackEvents: AdaptiveLearningPathPlan['feedbackEvents'],
): Array<Record<string, unknown>> {
  return feedbackEvents
    .filter((event) => event.type === 'selection' || event.type === 'rejection' || event.type === 'switch' || event.type === 'helpfulness')
    .map((event) => {
      const context = toRecord(event.context);
      return {
        id: event.id,
        type: event.type,
        nodeId: event.nodeId,
        createdAt: event.createdAt,
        selectedStyleId: firstString(context.selectedStyleId) ?? null,
        previousStyleId: firstString(context.previousStyleId) ?? null,
        rejectedStyleIds: arrayOfStrings(context.rejectedStyleIds),
        helpful: typeof context.helpful === 'boolean'
          ? context.helpful
          : typeof event.helpful === 'boolean' ? event.helpful : null,
      };
    });
}

function buildGenericPathActivity(plan: AdaptiveLearningPathPlan): Array<Record<string, unknown>> {
  return [
    {
      id: `${plan.id}:generation`,
      type: 'generation',
      nodeId: null,
      createdAt: plan.executionStatus.updatedAt,
      goalId: plan.goal.id,
      plannerVersion: plan.stage,
    },
    ...plan.feedbackEvents.map((event) => ({
      id: event.id,
      type: event.type,
      nodeId: event.nodeId,
      createdAt: event.createdAt,
    })),
    ...plan.deviations.map((deviation) => ({
      id: deviation.id,
      type: 'deviation',
      nodeId: deviation.nodeId,
      createdAt: deviation.createdAt,
    })),
    ...plan.corrections.map((correction) => ({
      id: correction.id,
      type: 'konling-adjustment',
      nodeIds: correction.nodeIds,
      createdAt: plan.executionStatus.updatedAt,
    })),
  ];
}

function mergePathPayloadEntries(
  existingValue: unknown,
  nextEntries: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const merged: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const entry of [
    ...arrayOfRecords(existingValue),
    ...nextEntries,
  ]) {
    const id = typeof entry.id === 'string' ? entry.id : null;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    merged.push(entry);
  }
  return merged;
}

export function validateLearningPathPlanForPersistence(plan: AdaptiveLearningPathPlan): void {
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(plan.goal.id);
  if (
    !plan.id ||
    plan.userId.length === 0 ||
    !registeredGoal ||
    plan.stage !== CONTROL_CORRECTION_PATH_ROUND_PLANNER_VERSION ||
    !plan.id.includes(plan.userId) ||
    !plan.id.includes(plan.goal.id) ||
    plan.mainPath.length === 0
  ) {
    throw new ControlCorrectionPathRoundValidationError();
  }
  const seen = new Set<string>();
  for (const node of plan.mainPath) {
    if (
      !node.nodeId ||
      seen.has(node.nodeId) ||
      ![
        'lesson_step',
        'knowledge_node',
        'knowledge_card',
        'video',
        'audio',
        'slides',
        'handout',
        'quiz',
        'adaptive_quiz',
        'control_workbench',
        'simulation',
        'arena_task',
        'external_resource',
        'reflection',
        'checkpoint',
        'ai_intervention',
        'konling',
        'project',
      ].includes(node.type) ||
      !registeredGoal.allowedResourceMix.includes(node.type) ||
      node.privacyLevel !== 'student-visible' ||
      node.teacherPolicy !== 'allowed' ||
      typeof node.target !== 'string' ||
      node.target.length === 0 ||
      (node.type === 'external_resource'
        ? !isGovernedExternalPathNode(node, plan.goal.id)
        : !isStudentVisiblePathTarget(node.target)) ||
      !Number.isFinite(node.estimatedTimeMinutes) ||
      !Number.isFinite(node.score) ||
      !['completed', 'current', 'next', 'blocked', 'locked'].includes(node.status)
    ) {
      throw new ControlCorrectionPathRoundValidationError();
    }
    seen.add(node.nodeId);
  }
  if (plan.currentNodeId && !seen.has(plan.currentNodeId)) {
    throw new ControlCorrectionPathRoundValidationError();
  }
  if (
    plan.currentNodeId &&
    plan.mainPath.some((node) =>
      node.nodeId === plan.currentNodeId &&
      (node.status === 'locked' || (node.readiness?.state ?? 'ready') !== 'ready')
    )
  ) {
    throw new ControlCorrectionPathRoundValidationError();
  }
}

function isGovernedExternalPathNode(node: AdaptiveLearningPathPlanNode, goalId: string): boolean {
  const metadata = node.externalResource;
  return node.pathNodeType === 'external_resource' &&
    node.evidenceBehavior === 'explicit_access' &&
    node.evidenceStatus === 'explicit-access-required' &&
    Boolean(metadata) &&
    typeof metadata?.source === 'string' &&
    metadata.source.trim().length > 0 &&
    typeof metadata.url === 'string' &&
    metadata.url === node.target &&
    isSafeExternalPathTarget(metadata.url) &&
    node.estimatedTimeMinutes > 0 &&
    typeof metadata.estimatedTimeMinutes === 'number' &&
    Number.isFinite(metadata.estimatedTimeMinutes) &&
    metadata.estimatedTimeMinutes > 0 &&
    metadata.knowledgeCoverage.length > 0 &&
    typeof metadata.applicableGoalId === 'string' &&
    metadata.applicableGoalId === goalId &&
    metadata.evidenceUseStatus === 'explicit-access-required' &&
    metadata.privacyPolicy === node.privacyLevel;
}

function isSafeExternalPathTarget(target: string): boolean {
  try {
    const url = new URL(target);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isStudentVisiblePathTarget(target: string): boolean {
  const normalized = target.trim();
  if (normalized.length === 0 || normalized !== target) return false;
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(normalized)) return false;
  const pathname = normalized.split(/[?#]/, 1)[0] ?? normalized;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => ['admin', 'api', 'teacher', '_next', 'data-center'].includes(segment))) {
    return false;
  }
  if (!pathname.startsWith('/')) {
    return pathname.startsWith('course-content/runtime/');
  }
  return STUDENT_VISIBLE_PATH_TARGET_PREFIXES.some((prefix) => (
    pathname === prefix.slice(0, -1) || pathname.startsWith(prefix)
  ));
}

const STUDENT_VISIBLE_PATH_TARGET_PREFIXES = [
  '/adaptive-learning/',
  '/arena/',
  '/assessment/',
  '/classroom/student/',
  '/course-runtime/',
  '/dashboard/',
  '/interactive-learning/',
  '/knowledge/',
  '/playlists/',
  '/profile/',
  '/simulations/',
] as const;

export function validateControlCorrectionPathPlanForPersistence(plan: AdaptiveLearningPathPlan): void {
  if (
    !plan.id ||
    plan.userId.length === 0 ||
    plan.goal.id !== CONTROL_CORRECTION_PATH_ROUND_GOAL_ID ||
    plan.stage !== CONTROL_CORRECTION_PATH_ROUND_PLANNER_VERSION ||
    plan.policyFamily !== 'rules-plus-graph-search' ||
    !plan.id.includes(plan.userId) ||
    plan.mainPath.length === 0
  ) {
    throw new ControlCorrectionPathRoundValidationError();
  }
  const seen = new Set<string>();
  for (const node of plan.mainPath) {
    if (
      !node.nodeId ||
      seen.has(node.nodeId) ||
      ![
        'knowledge_card',
        'quiz',
        'adaptive_quiz',
        'control_workbench',
        'simulation',
        'arena_task',
        'external_resource',
        'intervention',
        'reflection',
        'checkpoint',
        'ai_intervention',
        'konling',
      ].includes(node.type) ||
      node.privacyLevel !== 'student-visible' ||
      node.teacherPolicy !== 'allowed' ||
      typeof node.target !== 'string' ||
      node.target.length === 0 ||
      (node.type === 'external_resource'
        ? !isGovernedExternalPathNode(node, plan.goal.id)
        : !isStudentVisiblePathTarget(node.target)) ||
      !Number.isFinite(node.estimatedTimeMinutes) ||
      !Number.isFinite(node.score) ||
      !['completed', 'current', 'next', 'blocked', 'locked'].includes(node.status)
    ) {
      throw new ControlCorrectionPathRoundValidationError();
    }
    seen.add(node.nodeId);
  }
  const terminal = plan.mainPath[plan.mainPath.length - 1];
  if (
    !terminal.terminalConstraints.includes('terminal-validation') ||
    (terminal.type !== 'simulation' && terminal.type !== 'arena_task')
  ) {
    throw new ControlCorrectionPathRoundValidationError();
  }
  if (plan.currentNodeId && !seen.has(plan.currentNodeId)) {
    throw new ControlCorrectionPathRoundValidationError();
  }
  if (
    plan.currentNodeId &&
    plan.mainPath.some((node) =>
      node.nodeId === plan.currentNodeId &&
      (node.status === 'locked' || (node.readiness?.state ?? 'ready') !== 'ready')
    )
  ) {
    throw new ControlCorrectionPathRoundValidationError();
  }
}

export async function readControlCorrectionPathRound(
  db: ControlCorrectionPathRoundDb,
  input: { pathId: string; userId: string },
): Promise<any | null> {
  return db.learningPath.findFirst({
    where: { id: input.pathId, userId: input.userId },
    include: {
      executions: { orderBy: { createdAt: 'asc' } },
      deviations: { orderBy: { createdAt: 'asc' } },
      interventions: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function recordPathNodeExecution(
  db: ControlCorrectionPathRoundDb,
  input: PathNodeExecutionInput,
): Promise<any> {
  const existing = await findExistingAppendOnly(db.learningPathExecution, input);
  if (existing) {
    await emitPathEvidenceEvent(db, 'execution', existing, input);
    return existing;
  }
  const execution = await createAppendOnly(db.learningPathExecution, input, {
    pathId: input.pathId,
    userId: input.userId,
    nodeId: input.nodeId,
    resourceType: input.resourceType,
    status: input.status,
    startedAt: normalizeDate(input.startedAt),
    completedAt: normalizeDate(input.completedAt),
    failedAt: normalizeDate(input.failedAt),
    evidenceRefs: input.evidenceRefs ?? [],
    liftMetadata: input.liftMetadata ?? {},
    simulationRef: input.simulationRef ?? null,
    arenaRef: input.arenaRef ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
  });
  await emitPathEvidenceEvent(db, 'execution', execution, input);
  return execution;
}

export async function updateControlCorrectionPathRoundAfterExecution(
  db: ControlCorrectionPathRoundDb,
  path: any,
  input: PathNodeExecutionInput,
): Promise<any | null> {
  if (!db.learningPath.update) return null;

  const mainPathNodeIds = readMainPathNodeIds(path);
  const currentIndex = mainPathNodeIds.indexOf(input.nodeId);
  const pathCurrentNodeId = typeof path.currentNodeId === 'string' ? path.currentNodeId : null;
  const activityKind = readPathActivityKind(input.liftMetadata);
  const isHistoricalActivity = Boolean(pathCurrentNodeId && pathCurrentNodeId !== input.nodeId);
  const metadata = toRecord(path.lastExecutionMetadata);
  const completedNodeIds = new Set(arrayOfStrings(metadata.completedNodeIds));
  const failedNodeIds = new Set(arrayOfStrings(metadata.failedNodeIds));
  const skippedNodeIds = new Set(arrayOfStrings(metadata.skippedNodeIds));
  const nonCompletionPathActivity = isNonCompletionPathActivity(activityKind);
  const availableOutcomeRefs = new Set(arrayOfStrings(metadata.availableOutcomeRefs));
  const wasCompleted = completedNodeIds.has(input.nodeId);
  const evidenceReadinessDelta = input.status === 'completed' && !nonCompletionPathActivity && !wasCompleted ? 1 : 0;
  const evidenceReadinessSourceNodeId = evidenceReadinessDelta > 0 ? input.nodeId : null;
  const evidenceReadinessCanSatisfyCompetencies = evidenceReadinessDelta > 0 &&
    isPassingPathCompletionResult(input.liftMetadata);
  const availableEvidenceCount = readNonNegativeNumber(metadata.availableEvidenceCount) + evidenceReadinessDelta;
  if (input.status === 'completed' && !nonCompletionPathActivity) completedNodeIds.add(input.nodeId);
  if (input.status === 'completed' && !nonCompletionPathActivity) {
    for (const outcomeRef of collectExecutionOutcomeRefs(input)) availableOutcomeRefs.add(outcomeRef);
  }
  if (input.status === 'failed') failedNodeIds.add(input.nodeId);
  const refreshedPlanNodes = refreshPlanNodesForExecution(
    toRecord(path.pathPayload).planNodes,
    completedNodeIds,
    failedNodeIds,
    null,
    availableOutcomeRefs,
    evidenceReadinessDelta,
    evidenceReadinessSourceNodeId,
    evidenceReadinessCanSatisfyCompetencies,
  );
  const nextNodeId = isHistoricalActivity && activityKind !== 'return-to-skipped'
    ? pathCurrentNodeId
    : input.status === 'completed' && currentIndex >= 0
      ? findNextPendingMainPathNodeId(mainPathNodeIds, currentIndex, completedNodeIds, skippedNodeIds, refreshedPlanNodes) ?? input.nodeId
      : input.nodeId;

  const terminalValidation = nonCompletionPathActivity
    ? toRecord(path.terminalValidation)
    : updateTerminalValidationState(path.terminalValidation, input);
  const terminalNodeId = typeof terminalValidation.nodeId === 'string' ? terminalValidation.nodeId : null;
  const isTerminalExecution = terminalNodeId === input.nodeId;
  const terminalState = typeof terminalValidation.state === 'string' ? terminalValidation.state : null;
  const terminalFailureReasons = arrayOfStrings(terminalValidation.failureReasons);
  const terminalLowConfidenceMarkers = arrayOfStrings(terminalValidation.lowConfidenceMarkers);
  const terminalFallbackReasons = terminalFailureReasons.concat(terminalLowConfidenceMarkers);
  const nextPathStatus = isTerminalExecution
    ? terminalState === 'completed'
      ? 'completed'
      : terminalState === 'failed' || terminalState === 'low-confidence'
        ? 'fallback'
        : path.pathStatus ?? 'active'
    : path.pathStatus ?? 'active';

  return db.learningPath.update({
    where: { id: input.pathId },
    data: {
      currentNodeId: nextNodeId,
      pathStatus: nextPathStatus,
      terminalValidation,
      pathPayload: derivePathPayloadExecutionState({
        ...path,
        currentNodeId: nextNodeId,
        lastExecutionMetadata: {
          ...metadata,
          completedNodeIds: [...completedNodeIds],
          failedNodeIds: [...failedNodeIds],
          availableOutcomeRefs: [...availableOutcomeRefs],
          availableEvidenceCount,
        },
        pathPayload: {
          ...toRecord(path.pathPayload),
          planNodes: refreshedPlanNodes,
        },
      }),
      lastExecutionMetadata: {
        ...metadata,
        activeNodeId: nextNodeId,
        completedNodeIds: [...completedNodeIds],
        failedNodeIds: [...failedNodeIds],
        availableOutcomeRefs: [...availableOutcomeRefs],
        availableEvidenceCount,
        lastExecution: {
          nodeId: input.nodeId,
          status: input.status,
          completedAt: normalizeDate(input.completedAt)?.toISOString() ?? null,
          failedAt: normalizeDate(input.failedAt)?.toISOString() ?? null,
        },
        ...(isTerminalExecution ? {
          terminalValidationState: terminalState,
          failureReasons: terminalFailureReasons,
          lowConfidenceMarkers: terminalLowConfidenceMarkers,
          fallbackReasons: terminalFallbackReasons,
        } : {}),
        updatedAt: new Date().toISOString(),
      },
    },
  });
}

function findNextPendingMainPathNodeId(
  mainPathNodeIds: string[],
  currentIndex: number,
  completedNodeIds: Set<string>,
  skippedNodeIds: Set<string>,
  planNodes: Array<Record<string, unknown>>,
): string | null {
  for (const nodeId of mainPathNodeIds.slice(currentIndex + 1)) {
    if (completedNodeIds.has(nodeId) || skippedNodeIds.has(nodeId)) continue;
    const node = planNodes.find((item) => item.nodeId === nodeId);
    if (node && isLockedPlanNodeRecord(node)) return null;
    return nodeId;
  }
  return null;
}

function isNonCompletionPathActivity(activityKind: string | undefined): boolean {
  return activityKind === 'review' ||
    activityKind === 'continued-interaction' ||
    activityKind === 'return-to-skipped' ||
    activityKind === 'external-resource-reference' ||
    activityKind === 'konling-support';
}

export async function recordPathDeviation(
  db: ControlCorrectionPathRoundDb,
  input: PathDeviationInput,
): Promise<any> {
  const existing = await findExistingAppendOnly(db.learningPathDeviation, input);
  if (existing) {
    await emitPathEvidenceEvent(db, 'deviation', existing, input);
    return existing;
  }
  const deviation = await createAppendOnly(db.learningPathDeviation, input, {
    pathId: input.pathId,
    userId: input.userId,
    deviationType: input.deviationType,
    priorNodeId: input.priorNodeId ?? null,
    targetNodeId: input.targetNodeId ?? null,
    context: input.context ?? {},
    evidenceConfidence: input.evidenceConfidence ?? 'unknown',
    idempotencyKey: input.idempotencyKey ?? null,
  });
  await emitPathEvidenceEvent(db, 'deviation', deviation, input);
  return deviation;
}

export async function recordPathIntervention(
  db: ControlCorrectionPathRoundDb,
  input: PathInterventionInput,
): Promise<any> {
  const existing = await findExistingAppendOnly(db.learningPathIntervention, input);
  if (existing) {
    await emitPathEvidenceEvent(db, 'intervention', existing, input);
    return existing;
  }
  const intervention = await createAppendOnly(db.learningPathIntervention, input, {
    pathId: input.pathId,
    userId: input.userId,
    interventionKind: input.interventionKind,
    citedEvidence: input.citedEvidence ?? [],
    suggestedAction: input.suggestedAction,
    studentOutcome: input.studentOutcome ?? 'pending',
    privacySafeSummary: input.privacySafeSummary,
    idempotencyKey: input.idempotencyKey ?? null,
  });
  await emitPathEvidenceEvent(db, 'intervention', intervention, input);
  return intervention;
}

export async function recordPathChoiceEvidence(
  db: ControlCorrectionPathRoundDb,
  input: PathChoiceEvidenceInput,
): Promise<{ emitted: boolean; dedupeKey: string }> {
  const eventKey = input.idempotencyKey ?? input.eventId ?? `${input.action}:${new Date().toISOString()}:${Math.random().toString(36).slice(2)}`;
  const namespace = resolvePathEventNamespace(input.goalId);
  const dedupeKey = `${namespace.dedupePrefix}:choice:${input.pathId}:${eventKey}`;
  const eventType = `${namespace.eventPrefix}.${input.action}_recorded`;
  const occurredAt = new Date();
  const occurredAtIso = occurredAt.toISOString();
  const payload = {
    eventType,
    goalId: input.goalId ?? null,
    actor: {
      userId: input.actorUserId ?? input.userId,
      role: input.actorRole ?? 'student',
    },
    subject: {
      userId: input.userId,
    },
    sourceCapability: namespace.choiceSourceCapability,
    payloadVersion: `${namespace.payloadPrefix}-choice-evidence.v1`,
    occurredAt: occurredAtIso,
    privacyLevel: 'student-visible',
    confidence: input.action === 'helpfulness' ? 'low' : 'medium',
    relatedRefs: compactObject({
      pathId: input.pathId,
      selectedStyleId: input.selectedStyleId ?? undefined,
      selectedPolicyFamily: input.selectedPolicyFamily ?? undefined,
      previousStyleId: input.previousStyleId ?? undefined,
      diagnosisSnapshotRef: input.diagnosisSnapshotRef ?? undefined,
      rejectedStyleIds: input.rejectedStyleIds,
    }),
    preferenceEvidence: compactObject({
      action: input.action,
      resourceMix: sanitizeResourceMix(input.resourceMix),
      helpful: input.helpful ?? undefined,
      rationaleMetadata: sanitizeRationaleMetadata(input.rationaleMetadata),
    }),
  };

  if (db.evidenceOutbox?.createMany) {
    const result = await db.evidenceOutbox.createMany({
      data: [{
        eventType,
        correlationId: input.pathId,
        causationId: `LearningPathChoice:${eventKey}`,
        ownerUserId: input.userId,
        payload,
        dedupeKey,
        createdAt: occurredAtIso,
      }],
      skipDuplicates: true,
    });
    if (typeof result?.count === 'number' && result.count === 0) {
      return { emitted: false, dedupeKey };
    }
  }
  if (db.learningFact?.createMany) {
    const result = await db.learningFact.createMany({
      data: [{
        userId: input.userId,
        factType: eventType,
        moduleId: namespace.moduleId,
        sessionId: null,
        startedAt: occurredAt,
        finishedAt: occurredAt,
        outcome: 'success',
        score: null,
        timeSpent: 0,
        competencyContribution: {},
        sourceEventId: dedupeKey,
        sourceLogId: input.eventId ?? input.idempotencyKey ?? null,
        courseId: null,
        lessonId: null,
        contextJson: payload,
      }],
      skipDuplicates: true,
    });
    if (!db.evidenceOutbox?.createMany && typeof result?.count === 'number' && result.count === 0) {
      return { emitted: false, dedupeKey };
    }
  }
  if (db.learningPath.update) {
    const path = await db.learningPath.findFirst({
      where: {
        id: input.pathId,
        userId: input.userId,
      },
    });
    if (path) {
      const pathPayload = toRecord(path.pathPayload);
      const existingHistory = Array.isArray(pathPayload.selectionHistory)
        ? pathPayload.selectionHistory
        : [];
      const existingActivity = Array.isArray(pathPayload.activity)
        ? pathPayload.activity
        : [];
      const hasHistoryEntry = existingHistory.some((entry) => toRecord(entry).id === dedupeKey);
      if (hasHistoryEntry) return { emitted: false, dedupeKey };
      if (!hasHistoryEntry) {
        const historyEntry = buildPathChoiceSelectionHistoryEntry(input, payload, dedupeKey);
        await db.learningPath.update({
          where: { id: input.pathId },
          data: {
            pathPayload: {
              ...pathPayload,
              selectionHistory: [
                ...existingHistory,
                historyEntry,
              ],
              activity: [
                ...existingActivity,
                {
                  ...historyEntry,
                  goalId: input.goalId ?? null,
                  type: `choice:${input.action}`,
                },
              ],
            },
          },
        });
      }
    }
  }
  return { emitted: true, dedupeKey };
}

function buildPathChoiceSelectionHistoryEntry(
  input: PathChoiceEvidenceInput,
  payload: Record<string, unknown>,
  dedupeKey: string,
): Record<string, unknown> {
  return {
    id: dedupeKey,
    type: input.action,
    nodeId: null,
    createdAt: firstString(payload.occurredAt) ?? new Date().toISOString(),
    selectedStyleId: input.selectedStyleId ?? null,
    selectedPolicyFamily: input.selectedPolicyFamily ?? null,
    previousStyleId: input.previousStyleId ?? null,
    rejectedStyleIds: input.rejectedStyleIds ?? [],
    diagnosisSnapshotRef: input.diagnosisSnapshotRef ?? null,
    helpful: input.helpful ?? null,
  };
}

export function toLegacyLearningPathSummary(path: LegacyLearningPathSummary) {
  return {
    id: path.id,
    title: path.title,
    description: path.description,
    estimatedTime: path.estimatedTime,
    nodeIds: path.nodeIds,
    isAiGenerated: path.isAiGenerated,
    status: path.pathStatus ?? 'legacy',
    currentNodeId: path.currentNodeId ?? null,
  };
}

export function toControlCorrectionPathRoundView(path: any) {
  if (!path) return null;
  return {
    id: path.id,
    userId: path.userId,
    title: path.title,
    description: path.description,
    estimatedTime: path.estimatedTime,
    nodeIds: path.nodeIds,
    isAiGenerated: path.isAiGenerated,
    goalId: path.goalId,
    plannerVersion: path.plannerVersion,
    pathStatus: path.pathStatus,
    currentNodeId: path.currentNodeId,
    classId: path.classId,
    pathPayload: derivePathPayloadExecutionState(path),
    explanationPayload: path.explanationPayload,
    alternativePayload: path.alternativePayload,
    entryNodeId: path.entryNodeId,
    terminalValidation: path.terminalValidation,
    lastExecutionMetadata: path.lastExecutionMetadata,
    createdAt: path.createdAt,
    updatedAt: path.updatedAt,
    executions: Array.isArray(path.executions)
      ? path.executions.map((execution: any) => ({
          id: execution.id,
          nodeId: execution.nodeId,
          resourceType: execution.resourceType,
          status: execution.status,
          activityKind: readPathActivityKind(execution.liftMetadata),
          resultSummary: buildExecutionResultSummary(execution),
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          failedAt: execution.failedAt,
          createdAt: execution.createdAt,
        }))
      : [],
    deviations: Array.isArray(path.deviations)
      ? path.deviations.map((deviation: any) => ({
          id: deviation.id,
          deviationType: deviation.deviationType,
          priorNodeId: deviation.priorNodeId,
          targetNodeId: deviation.targetNodeId,
          evidenceConfidence: deviation.evidenceConfidence,
          createdAt: deviation.createdAt,
        }))
      : [],
    interventions: Array.isArray(path.interventions)
      ? path.interventions.map((intervention: any) => ({
          id: intervention.id,
          interventionKind: intervention.interventionKind,
          studentOutcome: intervention.studentOutcome,
          privacySafeSummary: intervention.privacySafeSummary,
          createdAt: intervention.createdAt,
        }))
      : [],
  };
}

function derivePathPayloadExecutionState(path: any): unknown {
  const payload = toRecord(path.pathPayload);
  const planNodes = Array.isArray(payload.planNodes) ? payload.planNodes : null;
  if (!planNodes) return path.pathPayload;

  const currentNodeId = typeof path.currentNodeId === 'string' ? path.currentNodeId : null;
  const metadata = toRecord(path.lastExecutionMetadata);
  const completedNodeIds = new Set(arrayOfStrings(metadata.completedNodeIds));
  const failedNodeIds = new Set(arrayOfStrings(metadata.failedNodeIds));
  const availableOutcomeRefs = new Set(arrayOfStrings(metadata.availableOutcomeRefs));
  const availableEvidenceCount = readNonNegativeNumber(metadata.availableEvidenceCount);
  const refreshedPlanNodes = refreshPlanNodesForExecution(
    planNodes,
    completedNodeIds,
    failedNodeIds,
    currentNodeId,
    availableOutcomeRefs,
  );

  return {
    ...payload,
    planNodes: refreshedPlanNodes,
    executionStatus: {
      ...toRecord(payload.executionStatus),
      activeNodeId: currentNodeId,
      completedNodeIds: [...completedNodeIds],
      failedNodeIds: [...failedNodeIds],
      availableOutcomeRefs: [...availableOutcomeRefs],
      availableEvidenceCount,
    },
    visualization: derivePathVisualizationExecutionState(payload.visualization, currentNodeId, completedNodeIds),
  };
}

function refreshPlanNodesForExecution(
  planNodes: unknown,
  completedNodeIds: Set<string>,
  failedNodeIds: Set<string>,
  currentNodeId: string | null,
  availableOutcomeRefs: Set<string> = new Set(),
  evidenceReadinessDelta = 0,
  evidenceReadinessSourceNodeId: string | null = null,
  evidenceReadinessCanSatisfyCompetencies = false,
): Array<Record<string, unknown>> {
  if (!Array.isArray(planNodes)) return [];
  return planNodes.map((node) => {
    const record = toRecord(node);
    const nodeId = typeof record.nodeId === 'string' ? record.nodeId : null;
    if (!nodeId) return record;
    const readiness = refreshReadinessRecord(
      toRecord(record.readiness),
      completedNodeIds,
      availableOutcomeRefs,
      evidenceReadinessDelta,
      evidenceReadinessSourceNodeId,
      evidenceReadinessCanSatisfyCompetencies,
    );
    const readinessState = typeof readiness.state === 'string' ? readiness.state : null;
    if (completedNodeIds.has(nodeId)) return { ...record, readiness, status: 'completed' };
    if (failedNodeIds.has(nodeId)) return { ...record, readiness, status: 'blocked' };
    if (currentNodeId === nodeId && readinessState !== 'locked' && readinessState !== 'evidence-needed' && readinessState !== 'needs-preparation') {
      return { ...record, readiness, status: 'current' };
    }
    if (readinessState === 'locked' || readinessState === 'evidence-needed' || readinessState === 'needs-preparation') {
      return { ...record, readiness, status: 'locked' };
    }
    if (record.status === 'current' || record.status === 'locked') return { ...record, readiness, status: 'next' };
    return { ...record, readiness };
  });
}

function refreshReadinessRecord(
  readiness: Record<string, unknown>,
  completedNodeIds: Set<string>,
  availableOutcomeRefs: Set<string>,
  evidenceReadinessDelta: number,
  evidenceReadinessSourceNodeId: string | null,
  evidenceReadinessCanSatisfyCompetencies: boolean,
): Record<string, unknown> {
  const state = typeof readiness.state === 'string' ? readiness.state : null;
  if (!state || state === 'ready') return readiness;
  const missingCompletedNodeIds = arrayOfStrings(readiness.missingCompletedNodeIds)
    .filter((nodeId) => !completedNodeIds.has(nodeId));
  const competencyEvidenceSourceMatched = evidenceReadinessCanSatisfyCompetencies &&
    Boolean(evidenceReadinessSourceNodeId) &&
    arrayOfStrings(readiness.fallbackNodeIds).includes(evidenceReadinessSourceNodeId as string);
  const rawMissingCompetencies = arrayOfStrings(readiness.missingCompetencies);
  const missingOutcomeRefs = arrayOfStrings(readiness.missingOutcomeRefs)
    .filter((outcomeRef) => !availableOutcomeRefs.has(outcomeRef));
  const missingEvidenceCount = typeof readiness.missingEvidenceCount === 'number'
    ? Math.max(0, readiness.missingEvidenceCount - evidenceReadinessDelta)
    : 0;
  const missingCompetencies = competencyEvidenceSourceMatched &&
    missingEvidenceCount === 0 &&
    missingCompletedNodeIds.length === 0 &&
    missingOutcomeRefs.length === 0
      ? []
      : rawMissingCompetencies;
  const ready = missingCompletedNodeIds.length === 0 &&
    missingCompetencies.length === 0 &&
    missingOutcomeRefs.length === 0 &&
    missingEvidenceCount === 0;
  if (ready) {
    return {
      state: 'ready',
      message: '可以开始。',
      unlockMessage: null,
      reasonCodes: [],
      fallbackNodeIds: [],
      missingCompetencies: [],
      missingEvidenceCount: 0,
      missingCompletedNodeIds: [],
      missingOutcomeRefs: [],
    };
  }
  return {
    ...readiness,
    missingCompletedNodeIds,
    missingCompetencies,
    missingOutcomeRefs,
    missingEvidenceCount,
  };
}

function isPassingPathCompletionResult(value: unknown): boolean {
  const metadata = toRecord(value);
  const result = toRecord(metadata.completionResult);
  if (typeof result.success === 'boolean') return result.success;
  const score = readNumber(result.score);
  if (score !== undefined) return score <= 1 ? score >= 0.6 : score >= 60;
  const data = toRecord(result.data);
  const correct = readNumber(data.correct);
  const total = readNumber(data.total);
  return correct !== undefined && total !== undefined && total > 0 && correct / total >= 0.6;
}

function collectExecutionOutcomeRefs(input: PathNodeExecutionInput): string[] {
  const refs = new Set<string>();
  for (const ref of input.evidenceRefs ?? []) {
    addTrustedOutcomeRef(refs, ref);
  }
  addTrustedOutcomeRef(refs, input.simulationRef);
  addTrustedOutcomeRef(refs, input.arenaRef);
  const liftMetadata = toRecord(input.liftMetadata);
  const adaptiveAssessmentRef = toRecord(liftMetadata.adaptiveAssessmentRef);
  const controlWorkbenchRef = toRecord(liftMetadata.controlWorkbenchRef);
  addTrustedOutcomeRef(refs, adaptiveAssessmentRef);
  addTrustedOutcomeRef(refs, controlWorkbenchRef);

  if (input.resourceType === 'adaptive_quiz' && isTrustedAdaptiveAssessmentOutcomeRef(adaptiveAssessmentRef)) {
    const assessmentId = firstString(
      adaptiveAssessmentRef.id,
      adaptiveAssessmentRef.answerId,
      adaptiveAssessmentRef.sourceId,
    );
    if (assessmentId) refs.add(`adaptive_assessment:${normalizeValidationRef(assessmentId)}`);
  }

  if (input.resourceType === 'simulation' && isTrustedSimulationOutcomeRef(input.simulationRef)) {
    const simulationId = firstString(
      input.simulationRef?.sourceRefId,
      input.simulationRef?.resourceId,
      input.simulationRef?.taskSpecId,
      input.simulationRef?.id,
      input.simulationRef?.ref,
      input.simulationRef?.runId,
      input.simulationRef?.sourceId,
    );
    if (simulationId) refs.add(`simulation_run:${normalizeValidationRef(simulationId)}`);
  }

  if (input.resourceType === 'control_workbench' && isTrustedControlWorkbenchOutcomeRef(controlWorkbenchRef)) {
    const workbenchId = firstString(
      controlWorkbenchRef.sourceRefId,
      controlWorkbenchRef.resourceId,
      controlWorkbenchRef.taskSpecId,
      controlWorkbenchRef.simulationRunId,
      controlWorkbenchRef.id,
      controlWorkbenchRef.ref,
      controlWorkbenchRef.runId,
      controlWorkbenchRef.sourceId,
    );
    if (workbenchId) refs.add(`control_workbench:${normalizeValidationRef(workbenchId)}`);
  }

  if (input.resourceType === 'arena_task' && isTrustedArenaOutcomeRef(input.arenaRef)) {
    const arenaId = firstString(
      input.arenaRef?.id,
      input.arenaRef?.ref,
      input.arenaRef?.submissionId,
      input.arenaRef?.runId,
      input.arenaRef?.sourceId,
    );
    if (arenaId) refs.add(`arena_submission:${normalizeValidationRef(arenaId)}`);
  }

  return [...refs];
}

function addTrustedOutcomeRef(refs: Set<string>, value: unknown): void {
  if (
    !isTrustedSimulationOutcomeRef(value) &&
    !isTrustedArenaOutcomeRef(value) &&
    !isTrustedAdaptiveAssessmentOutcomeRef(value) &&
    !isTrustedControlWorkbenchOutcomeRef(value)
  ) return;
  const record = toRecord(value);
  const ref = firstString(record.ref, record.id, record.runId, record.submissionId, record.sourceId, record.sourceEventId);
  if (ref) refs.add(ref);
}

function isTrustedAdaptiveAssessmentOutcomeRef(value: unknown): boolean {
  const record = toRecord(value);
  const kind = firstString(record.kind, record.sourceType);
  const provenance = readProvenance(record);
  return kind === 'AdaptiveAssessmentAnswer' &&
    provenance === 'official' &&
    firstString(record.id, record.answerId, record.sourceId) !== undefined &&
    firstString(record.mismatchReason) === undefined;
}

function isTrustedControlWorkbenchOutcomeRef(value: unknown): boolean {
  const record = toRecord(value);
  const kind = firstString(record.kind, record.sourceType);
  const provenance = readProvenance(record);
  return kind === 'ControlWorkbenchOutcome' &&
    (provenance === 'official' || provenance === 'preview') &&
    firstString(record.mismatchReason) === undefined &&
    firstString(record.status, record.outcome) === 'completed';
}

function isTrustedSimulationOutcomeRef(value: unknown): boolean {
  const record = toRecord(value);
  const kind = firstString(record.kind, record.sourceType);
  const provenance = readProvenance(record);
  return kind === 'SimulationRun' &&
    (provenance === 'official' || provenance === 'preview') &&
    firstString(record.mismatchReason) === undefined &&
    firstString(record.status, record.outcome) === 'completed';
}

function isTrustedArenaOutcomeRef(value: unknown): boolean {
  const record = toRecord(value);
  const kind = firstString(record.kind, record.sourceType);
  const provenance = readProvenance(record);
  return (kind === 'ArenaSubmission' || kind === 'ArenaVirtualSimulationRun') &&
    (provenance === 'official' || provenance === 'preview') &&
    firstString(record.mismatchReason) === undefined &&
    readBoolean(record.valid) !== false;
}

function isLockedPlanNodeRecord(node: Record<string, unknown>): boolean {
  const readiness = toRecord(node.readiness);
  const readinessState = typeof readiness.state === 'string' ? readiness.state : null;
  return node.status === 'locked' ||
    readinessState === 'locked' ||
    readinessState === 'evidence-needed' ||
    readinessState === 'needs-preparation';
}

function derivePathVisualizationExecutionState(
  visualization: unknown,
  currentNodeId: string | null,
  completedNodeIds: Set<string>,
): unknown {
  const visualizationRecord = toRecord(visualization);
  const mapRecord = toRecord(visualizationRecord.map);
  if (Object.keys(visualizationRecord).length === 0 || Object.keys(mapRecord).length === 0) return visualization;
  return {
    ...visualizationRecord,
    map: {
      ...mapRecord,
      currentNodeId,
      completedNodeIds: [...completedNodeIds],
    },
  };
}

function buildExecutionResultSummary(execution: any): PathExecutionResultSummary | null {
  if (execution?.status !== 'completed') return null;
  const resourceType = typeof execution.resourceType === 'string' ? execution.resourceType : '';
  const metadata = toRecord(execution.liftMetadata);
  if (resourceType === 'adaptive_quiz') {
    const ref = toRecord(metadata.adaptiveAssessmentRef);
    if (!isTrustedAdaptiveAssessmentOutcomeRef(ref)) return pendingResultSummary('adaptive-assessment', '自适应练习结果');
    return compactObject({
      state: 'available',
      kind: 'adaptive-assessment',
      label: '自适应练习结果',
      outcomeId: firstString(ref.id, ref.answerId, ref.sourceId),
      evidenceSource: 'AdaptiveAssessmentAnswer',
      reviewState: 'ready',
      primaryMetric: formatResultMetric('得分', readNumber(ref.score)),
      occurredAt: firstString(ref.answeredAt, ref.completedAt, ref.createdAt),
    }) as unknown as PathExecutionResultSummary;
  }
  if (resourceType === 'control_workbench') {
    const ref = toRecord(metadata.controlWorkbenchRef);
    if (!isTrustedControlWorkbenchOutcomeRef(ref)) return pendingResultSummary('control-workbench', '控制工作台结果');
    return compactObject({
      state: 'available',
      kind: 'control-workbench',
      label: '控制工作台结果',
      outcomeId: firstString(ref.id, ref.simulationRunId, ref.runId, ref.sourceId),
      evidenceSource: 'ControlWorkbenchOutcome',
      reviewState: 'ready',
      primaryMetric: formatResultMetric('回放可信度', readConfidence(ref.replayConfidence ?? ref.confidence)),
      occurredAt: firstString(ref.completedAt, ref.createdAt),
    }) as unknown as PathExecutionResultSummary;
  }
  if (resourceType === 'simulation') {
    const ref = toRecord(execution.simulationRef);
    if (!isTrustedSimulationOutcomeRef(ref)) return pendingResultSummary('simulation', '仿真结果');
    return compactObject({
      state: 'available',
      kind: 'simulation',
      label: '仿真结果',
      outcomeId: firstString(ref.id, ref.runId, ref.sourceId),
      evidenceSource: 'SimulationRun',
      reviewState: 'ready',
      primaryMetric: formatResultMetric('回放可信度', readConfidence(ref.replayConfidence ?? ref.confidence)),
      occurredAt: firstString(ref.completedAt, ref.createdAt),
    }) as unknown as PathExecutionResultSummary;
  }
  if (resourceType === 'arena_task') {
    const ref = toRecord(execution.arenaRef);
    if (!isTrustedArenaOutcomeRef(ref)) return pendingResultSummary('arena', 'Arena 结果');
    return compactObject({
      state: 'available',
      kind: 'arena',
      label: 'Arena 结果',
      outcomeId: firstString(ref.id, ref.submissionId, ref.runId, ref.sourceId),
      evidenceSource: firstString(ref.kind, ref.sourceType) ?? 'ArenaSubmission',
      reviewState: 'ready',
      primaryMetric: formatResultMetric('得分', readNumber(ref.score)),
      occurredAt: firstString(ref.submittedAt, ref.completedAt, ref.createdAt),
    }) as unknown as PathExecutionResultSummary;
  }
  return null;
}

function pendingResultSummary(
  kind: PathExecutionResultSummary['kind'],
  label: string,
): PathExecutionResultSummary {
  return {
    state: 'pending',
    kind,
    label,
    evidenceSource: 'learning-path-execution',
    reviewState: 'pending-sync',
  };
}

function formatResultMetric(label: string, value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value >= 0 && value <= 1) return `${label} ${Math.round(value * 100)}%`;
  return `${label} ${Math.round(value)}`;
}

function resolveTerminalValidation(nodes: AdaptiveLearningPathPlanNode[], required = true) {
  let terminal: AdaptiveLearningPathPlanNode | undefined;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (
      (node.type === 'simulation' || node.type === 'arena_task') &&
      node.terminalConstraints.includes('terminal-validation')
    ) {
      terminal = node;
      break;
    }
  }
  return terminal
    ? {
        nodeId: terminal.nodeId,
        resourceType: terminal.type,
        state: terminal.status === 'completed' ? 'completed' : 'pending',
        target: terminal.target,
      }
    : {
        nodeId: null,
        resourceType: null,
        state: required ? 'missing' : 'not-required',
      };
}

async function createAppendOnly<T extends { pathId: string; idempotencyKey?: string | null }>(
  delegate: AppendOnlyDelegate,
  input: T,
  data: Record<string, unknown>,
): Promise<any> {
  if (input.idempotencyKey) {
    const existing = await delegate.findFirst({
      where: {
        pathId: input.pathId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (existing) return existing;
  }
  try {
    return await delegate.create({ data });
  } catch (error) {
    if (!input.idempotencyKey || !isPrismaUniqueConstraintError(error)) {
      throw error;
    }
    const existing = await delegate.findFirst({
      where: {
        pathId: input.pathId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (existing) return existing;
    throw error;
  }
}

async function findExistingAppendOnly<T extends { pathId: string; idempotencyKey?: string | null }>(
  delegate: AppendOnlyDelegate,
  input: T,
): Promise<any | null> {
  if (!input.idempotencyKey) return null;
  return delegate.findFirst({
    where: {
      pathId: input.pathId,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

function normalizeDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}

function readMainPathNodeIds(path: any): string[] {
  const nodeIds = Array.isArray(path.nodeIds) ? path.nodeIds : [];
  const payload = toRecord(path.pathPayload);
  const payloadNodeIds = Array.isArray(payload.mainPathNodeIds) ? payload.mainPathNodeIds : [];
  return [...new Set([...nodeIds, ...payloadNodeIds].filter((value): value is string => typeof value === 'string'))];
}

function updateTerminalValidationState(value: unknown, input: PathNodeExecutionInput): Record<string, unknown> {
  const terminalValidation = toRecord(value);
  if (terminalValidation.nodeId !== input.nodeId) return terminalValidation;
  const policy = readTerminalValidationPolicy(terminalValidation.policy);
  const evidence = buildTerminalValidationEvidence(input);
  const failureReasons: string[] = [];
  const lowConfidenceMarkers: string[] = [];

  if (input.status === 'started') {
    return {
      ...terminalValidation,
      policy,
      evidence,
      state: 'in-progress',
      fallbackRequired: false,
      failureReasons,
      lowConfidenceMarkers,
    };
  }

  if (input.status === 'failed' || input.status === 'abandoned') {
    failureReasons.push(input.resourceType === 'simulation' ? 'simulation-failed' : 'terminal-validation-failed');
    return {
      ...terminalValidation,
      policy,
      evidence,
      state: 'failed',
      fallbackRequired: true,
      failureReasons,
      lowConfidenceMarkers,
    };
  }

  if (input.status !== 'completed') {
    return {
      ...terminalValidation,
      policy,
      evidence,
      state: terminalValidation.state ?? 'pending',
      fallbackRequired: false,
      failureReasons,
      lowConfidenceMarkers,
    };
  }

  if (policy.mustIncludeSimulation && !evidence.simulation) {
    lowConfidenceMarkers.push('simulation-evidence-missing');
  }
  if (policy.mustEndWithArena && input.resourceType !== 'arena_task') {
    lowConfidenceMarkers.push('arena-terminal-evidence-missing');
  }
  if (input.resourceType === 'arena_task' && !evidence.arena) {
    lowConfidenceMarkers.push('arena-evidence-missing');
  }

  if (evidence.simulation) {
    collectReplayConfidenceMarkers('simulation', evidence.simulation.replayConfidence, policy.minimumReplayConfidence, lowConfidenceMarkers);
    if (evidence.simulation.status === 'failed') {
      failureReasons.push('simulation-failed');
    }
  }

  if (evidence.arena) {
    collectReplayConfidenceMarkers('arena', evidence.arena.replayConfidence, policy.minimumReplayConfidence, lowConfidenceMarkers);
    const expectedArenaTaskId = readExpectedArenaTaskId(terminalValidation, input.nodeId);
    if (expectedArenaTaskId && evidence.arena.taskId && evidence.arena.taskId !== expectedArenaTaskId) {
      lowConfidenceMarkers.push('arena-task-mismatch');
    }
    if (evidence.arena.provenance === 'preview' && !policy.allowPreviewValidation) {
      lowConfidenceMarkers.push('arena-preview-only');
    }
    if (policy.requireOfficialArenaEvidence && !evidence.arena.official) {
      lowConfidenceMarkers.push('arena-official-evidence-missing');
    }
    if (evidence.arena.valid === false) {
      failureReasons.push('arena-submission-invalid');
    }
  }

  const state = failureReasons.length > 0
    ? 'failed'
    : lowConfidenceMarkers.length > 0
      ? 'low-confidence'
      : 'completed';

  return {
    ...terminalValidation,
    policy,
    evidence,
    state,
    fallbackRequired: state === 'failed' || state === 'low-confidence',
    failureReasons,
    lowConfidenceMarkers,
  };
}

function readExpectedArenaTaskId(terminalValidation: Record<string, unknown>, nodeId: string): string | null {
  const value = firstString(
    terminalValidation.sourceRef,
    terminalValidation.taskId,
    terminalValidation.target,
    typeof nodeId === 'string' && nodeId.startsWith('arena-task:') ? nodeId.slice('arena-task:'.length) : null,
  );
  return value ? normalizeValidationRef(value) : null;
}

function readTerminalValidationPolicy(value: unknown) {
  const policy = toRecord(value);
  return {
    version: typeof policy.version === 'string' ? policy.version : DEFAULT_TERMINAL_VALIDATION_POLICY.version,
    mustIncludeSimulation: typeof policy.mustIncludeSimulation === 'boolean'
      ? policy.mustIncludeSimulation
      : DEFAULT_TERMINAL_VALIDATION_POLICY.mustIncludeSimulation,
    mustEndWithArena: typeof policy.mustEndWithArena === 'boolean'
      ? policy.mustEndWithArena
      : DEFAULT_TERMINAL_VALIDATION_POLICY.mustEndWithArena,
    allowPreviewValidation: typeof policy.allowPreviewValidation === 'boolean'
      ? policy.allowPreviewValidation
      : DEFAULT_TERMINAL_VALIDATION_POLICY.allowPreviewValidation,
    minimumReplayConfidence: typeof policy.minimumReplayConfidence === 'number' && Number.isFinite(policy.minimumReplayConfidence)
      ? policy.minimumReplayConfidence
      : DEFAULT_TERMINAL_VALIDATION_POLICY.minimumReplayConfidence,
    requireOfficialArenaEvidence: typeof policy.requireOfficialArenaEvidence === 'boolean'
      ? policy.requireOfficialArenaEvidence
      : DEFAULT_TERMINAL_VALIDATION_POLICY.requireOfficialArenaEvidence,
  };
}

interface TerminalValidationEvidence {
  simulation?: Record<string, unknown>;
  arena?: Record<string, unknown>;
  citedRefs: Array<Record<string, unknown>>;
}

function buildTerminalValidationEvidence(input: PathNodeExecutionInput): TerminalValidationEvidence {
  const simulation = sanitizeSimulationValidationEvidence(input.simulationRef ?? findEvidenceRef(input.evidenceRefs, ['SimulationRun', 'simulation-run']));
  const arena = sanitizeArenaValidationEvidence(input.arenaRef ?? findEvidenceRef(input.evidenceRefs, [
      'ArenaSubmission',
      'arena-submission',
      'ArenaVirtualSimulationRun',
      'arena-preview',
  ]));
  return {
    ...(simulation ? { simulation } : {}),
    ...(arena ? { arena } : {}),
    citedRefs: sanitizeValidationRefs(input.evidenceRefs),
  };
}

function sanitizeSimulationValidationEvidence(value: unknown): Record<string, unknown> | undefined {
  const record = toRecord(value);
  const id = firstString(record.id, record.ref, record.runId, record.sourceId);
  if (!id) return undefined;
  const provenance = readProvenance(record);
  return compactObject({
    kind: firstString(record.kind, record.sourceType) ?? 'SimulationRun',
    id,
    provenance,
    official: provenance === 'official',
    status: firstString(record.status, record.outcome),
    replayConfidence: readConfidence(record.replayConfidence ?? record.confidence ?? toRecord(record.replay).confidence),
    summaryMetrics: sanitizeMetricRecord(record.summaryMetrics ?? record.metrics ?? record.summary),
  });
}

function sanitizeArenaValidationEvidence(value: unknown): Record<string, unknown> | undefined {
  const record = toRecord(value);
  const id = firstString(record.id, record.ref, record.submissionId, record.runId, record.sourceId);
  if (!id) return undefined;
  const provenance = readProvenance(record);
  const evaluation = toRecord(record.evaluation);
  return compactObject({
    kind: firstString(record.kind, record.sourceType) ?? (provenance === 'preview' ? 'ArenaVirtualSimulationRun' : 'ArenaSubmission'),
    id,
    taskId: firstString(record.taskId, evaluation.taskId),
    provenance,
    official: provenance === 'official',
    valid: readBoolean(record.valid ?? evaluation.valid),
    score: readNumber(record.score ?? evaluation.score),
    replayConfidence: readConfidence(record.replayConfidence ?? record.confidence ?? toRecord(record.replay).confidence),
    summaryMetrics: sanitizeMetricRecord(record.summaryMetrics ?? record.metrics ?? evaluation.metrics),
  });
}

function findEvidenceRef(refs: unknown[] | undefined, kinds: string[]): unknown | undefined {
  if (!Array.isArray(refs)) return undefined;
  const accepted = new Set(kinds);
  return refs.find((item) => {
    const record = toRecord(item);
    return accepted.has(firstString(record.kind, record.sourceType) ?? '');
  });
}

function sanitizeValidationRefs(refs: unknown[] | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(refs)) return [];
  const safeKinds = new Set(['LearningFact', 'SimulationRun', 'ArenaSubmission', 'ArenaVirtualSimulationRun']);
  return refs
    .map((item) => {
      const record = toRecord(item);
      const kind = firstString(record.kind, record.sourceType);
      const id = firstString(record.id, record.ref, record.sourceId);
      if (!kind || !id || !safeKinds.has(kind)) return null;
      return compactObject({ kind, id });
    })
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function collectReplayConfidenceMarkers(
  prefix: 'simulation' | 'arena',
  value: unknown,
  minimum: number,
  markers: string[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    markers.push(`${prefix}-replay-confidence-missing`);
    return;
  }
  if (value < minimum) {
    markers.push(`${prefix}-replay-confidence-low`);
  }
}

function readProvenance(record: Record<string, unknown>): 'official' | 'preview' | 'unknown' {
  const raw = firstString(record.provenance, record.evaluationVisibility, record.visibility, record.sourceKind);
  if (raw === 'official') return 'official';
  if (raw === 'preview') return 'preview';
  if (record.official === true) return 'official';
  if (record.official === false || record.officialEligible === false) return 'preview';
  return 'unknown';
}

function sanitizeMetricRecord(value: unknown): Record<string, number> | undefined {
  const record = toRecord(value);
  const entries = Object.entries(record).filter(([key, entry]) => {
    const lower = key.toLowerCase();
    return (
      typeof entry === 'number' &&
      Number.isFinite(entry) &&
      !lower.includes('trace') &&
      !lower.includes('hidden') &&
      !lower.includes('raw')
    );
  });
  return entries.length ? Object.fromEntries(entries) as Record<string, number> : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}

function normalizeValidationRef(value: string): string {
  const withoutPrefix = value.startsWith('simulation:')
    ? value.slice('simulation:'.length)
    : value.startsWith('arena-task:')
      ? value.slice('arena-task:'.length)
      : value;
  const normalized = withoutPrefix.trim().replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readNonNegativeNumber(value: unknown): number {
  const number = readNumber(value);
  return number === undefined ? 0 : Math.max(0, number);
}

function readConfidence(value: unknown): number | undefined {
  const number = readNumber(value);
  if (number === undefined) return undefined;
  return Math.max(0, Math.min(1, number));
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

type PathEvidenceEventKind = 'execution' | 'deviation' | 'intervention';

async function emitPathEvidenceEvent(
  db: ControlCorrectionPathRoundDb,
  kind: PathEvidenceEventKind,
  row: any,
  input: { pathId: string; userId: string; goalId?: string | null; idempotencyKey?: string | null; actorUserId?: string | null; actorRole?: string | null },
): Promise<void> {
  if (!db.evidenceOutbox?.createMany) return;
  const rowId = typeof row?.id === 'string' ? row.id : input.idempotencyKey ?? input.pathId;
  const namespace = resolvePathEventNamespace(input.goalId);
  const eventType = `${namespace.eventPrefix}.${kind}_recorded`;
  const sourceType = kind === 'execution'
    ? 'LearningPathExecution'
    : kind === 'deviation'
      ? 'LearningPathDeviation'
      : 'LearningPathIntervention';
  const dedupeKey = `${namespace.dedupePrefix}:${kind}:${input.pathId}:${input.idempotencyKey ?? rowId}`;
  const occurredAt = resolvePathEvidenceOccurredAt(kind, row);
  const payload = {
    eventType,
    goalId: input.goalId ?? null,
    actor: {
      userId: input.actorUserId ?? input.userId,
      role: input.actorRole ?? 'student',
    },
    subject: {
      userId: input.userId,
    },
    sourceCapability: namespace.evidenceSourceCapability,
    payloadVersion: `${namespace.payloadPrefix}-evidence.v1`,
    occurredAt,
    privacyLevel: kind === 'intervention' ? 'teacher-scoped' : 'student-visible',
    confidence: kind === 'deviation' ? readPathEvidenceConfidence(row?.evidenceConfidence) : 'medium',
    relatedRefs: compactObject({
      pathId: input.pathId,
      sourceType,
      sourceId: rowId,
      nodeId: typeof row?.nodeId === 'string' ? row.nodeId : typeof row?.priorNodeId === 'string' ? row.priorNodeId : undefined,
      targetNodeId: typeof row?.targetNodeId === 'string' ? row.targetNodeId : undefined,
      resourceType: typeof row?.resourceType === 'string' ? row.resourceType : undefined,
      status: typeof row?.status === 'string' ? row.status : undefined,
      activityKind: readPathActivityKind(row?.liftMetadata),
      deviationType: typeof row?.deviationType === 'string' ? row.deviationType : undefined,
      interventionKind: typeof row?.interventionKind === 'string' ? row.interventionKind : undefined,
      studentOutcome: typeof row?.studentOutcome === 'string' ? row.studentOutcome : undefined,
    }),
  };

  await db.evidenceOutbox.createMany({
    data: [{
      eventType,
      correlationId: input.pathId,
      causationId: `${sourceType}:${rowId}`,
      ownerUserId: input.userId,
      payload,
      dedupeKey,
      createdAt: new Date().toISOString(),
    }],
    skipDuplicates: true,
  });
}

function readPathActivityKind(value: unknown): string | undefined {
  const metadata = toRecord(value);
  const activityKind = metadata.pathActivityKind ?? metadata.activityKind;
  return typeof activityKind === 'string' ? activityKind : undefined;
}

function resolvePathEvidenceOccurredAt(kind: PathEvidenceEventKind, row: any): string {
  const value = kind === 'execution'
    ? row?.completedAt ?? row?.failedAt ?? row?.startedAt ?? row?.createdAt
    : row?.createdAt;
  const date = normalizeDate(value);
  return date?.toISOString() ?? new Date().toISOString();
}

function readPathEvidenceConfidence(value: unknown): 'low' | 'medium' | 'high' | 'unknown' {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'unknown'
    ? value
    : 'unknown';
}

function resolvePathEventNamespace(goalId?: string | null) {
  if (!goalId || goalId === CONTROL_CORRECTION_PATH_ROUND_GOAL_ID) {
    return {
      eventPrefix: 'control_correction_path',
      dedupePrefix: 'control-correction-path',
      payloadPrefix: 'control-correction-path',
      moduleId: 'control-correction-path-advisor',
      choiceSourceCapability: 'three-style-learning-path-loop',
      evidenceSourceCapability: 'connect-path-execution-to-evidence-cache',
    };
  }
  const safeGoalId = goalId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return {
    eventPrefix: 'learning_path',
    dedupePrefix: 'learning-path',
    payloadPrefix: 'learning-path',
    moduleId: `${safeGoalId}-path-advisor`,
    choiceSourceCapability: 'generic-learning-path-loop',
    evidenceSourceCapability: 'generic-path-execution-evidence-cache',
  };
}

function sanitizeResourceMix(value: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value)
    .filter(([key, entry]) => (
      key.length > 0 &&
      typeof entry === 'number' &&
      Number.isFinite(entry) &&
      entry >= 0
    ));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function sanitizeRationaleMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value)
    .filter(([key, entry]) => {
      const lower = key.toLowerCase();
      return !lower.includes('secret') &&
        !lower.includes('raw') &&
        !lower.includes('trace') &&
        entry !== undefined;
    })
    .map(([key, entry]) => [key, typeof entry === 'object' && entry !== null ? '[redacted-object]' : entry]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function toRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    )
    : [];
}
