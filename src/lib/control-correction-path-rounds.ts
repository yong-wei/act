import {
  serializeLearningPathPlan,
  type AdaptiveLearningPathPlan,
  type AdaptiveLearningPathPlanNode,
} from './adaptive-learning-path-planner';

export const CONTROL_CORRECTION_PATH_ROUND_GOAL_ID = 'control-correction';
export const CONTROL_CORRECTION_PATH_ROUND_PLANNER_VERSION = 'stage-1-rules-graph';

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

export interface PathDeviationInput {
  pathId: string;
  userId: string;
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
  interventionKind: 'diagnosis' | 'hint' | 'rollback' | 'fallback-path' | 'reflection-prompt';
  citedEvidence?: unknown[];
  suggestedAction: string;
  studentOutcome?: 'pending' | 'accepted' | 'ignored' | 'rejected' | 'partially-accepted' | 'dismissed' | 'completed';
  privacySafeSummary: string;
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
  const record = serializeLearningPathPlan(input.plan);
  const existing = await db.learningPath.findFirst({
    where: { id: record.id },
    select: { id: true, userId: true, goalId: true },
  });
  if (existing && (existing.userId !== record.userId || existing.goalId !== CONTROL_CORRECTION_PATH_ROUND_GOAL_ID)) {
    throw new ControlCorrectionPathRoundConflictError();
  }
  const terminalValidation = resolveTerminalValidation(input.plan.mainPath);
  const pathPayload = {
    status: record.payload.status,
    mainPathNodeIds: input.plan.mainPath.map((node) => node.nodeId),
    planNodes: record.payload.planNodes,
    score: record.payload.score,
    confidence: record.payload.confidence,
    visualization: record.payload.visualization,
  };
  const explanationPayload = {
    explanations: record.payload.explanations,
    selectedReasons: record.payload.explanations.selectedReasons,
    fallbackReasons: record.payload.explanations.fallbackReasons,
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
      !['knowledge_card', 'simulation', 'arena_task', 'intervention', 'reflection'].includes(node.type) ||
      node.privacyLevel !== 'student-visible' ||
      node.teacherPolicy !== 'allowed' ||
      typeof node.target !== 'string' ||
      node.target.length === 0 ||
      !Number.isFinite(node.estimatedTimeMinutes) ||
      !Number.isFinite(node.score) ||
      !['completed', 'current', 'next', 'blocked'].includes(node.status)
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
  const nextNodeId = input.status === 'completed' && currentIndex >= 0
    ? mainPathNodeIds[currentIndex + 1] ?? input.nodeId
    : input.nodeId;
  const metadata = toRecord(path.lastExecutionMetadata);
  const completedNodeIds = new Set(arrayOfStrings(metadata.completedNodeIds));
  const failedNodeIds = new Set(arrayOfStrings(metadata.failedNodeIds));
  if (input.status === 'completed') completedNodeIds.add(input.nodeId);
  if (input.status === 'failed') failedNodeIds.add(input.nodeId);

  const terminalValidation = updateTerminalValidationState(path.terminalValidation, input);
  const terminalNodeId = typeof terminalValidation.nodeId === 'string' ? terminalValidation.nodeId : null;
  const isTerminalCompleted = input.status === 'completed' && terminalNodeId === input.nodeId;

  return db.learningPath.update({
    where: { id: input.pathId },
    data: {
      currentNodeId: nextNodeId,
      pathStatus: isTerminalCompleted ? 'completed' : path.pathStatus ?? 'active',
      terminalValidation,
      lastExecutionMetadata: {
        ...metadata,
        activeNodeId: nextNodeId,
        completedNodeIds: [...completedNodeIds],
        failedNodeIds: [...failedNodeIds],
        lastExecution: {
          nodeId: input.nodeId,
          status: input.status,
          completedAt: normalizeDate(input.completedAt)?.toISOString() ?? null,
          failedAt: normalizeDate(input.failedAt)?.toISOString() ?? null,
        },
        updatedAt: new Date().toISOString(),
      },
    },
  });
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
    pathPayload: path.pathPayload,
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

function resolveTerminalValidation(nodes: AdaptiveLearningPathPlanNode[]) {
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
        state: 'missing',
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
  return {
    ...terminalValidation,
    state: input.status === 'completed'
      ? 'completed'
      : input.status === 'failed'
        ? 'failed'
        : terminalValidation.state ?? 'pending',
  };
}

type PathEvidenceEventKind = 'execution' | 'deviation' | 'intervention';

async function emitPathEvidenceEvent(
  db: ControlCorrectionPathRoundDb,
  kind: PathEvidenceEventKind,
  row: any,
  input: { pathId: string; userId: string; idempotencyKey?: string | null; actorUserId?: string | null; actorRole?: string | null },
): Promise<void> {
  if (!db.evidenceOutbox?.createMany) return;
  const rowId = typeof row?.id === 'string' ? row.id : input.idempotencyKey ?? input.pathId;
  const eventType = `control_correction_path.${kind}_recorded`;
  const sourceType = kind === 'execution'
    ? 'LearningPathExecution'
    : kind === 'deviation'
      ? 'LearningPathDeviation'
      : 'LearningPathIntervention';
  const dedupeKey = `control-correction-path:${kind}:${input.pathId}:${input.idempotencyKey ?? rowId}`;
  const occurredAt = resolvePathEvidenceOccurredAt(kind, row);
  const payload = {
    eventType,
    actor: {
      userId: input.actorUserId ?? input.userId,
      role: input.actorRole ?? 'student',
    },
    subject: {
      userId: input.userId,
    },
    sourceCapability: 'connect-path-execution-to-evidence-cache',
    payloadVersion: 'control-correction-path-evidence.v1',
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
