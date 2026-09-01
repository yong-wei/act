import { getAdaptiveQuestionById } from '@/features/assessment/adaptive-engine';
import { createHash } from 'node:crypto';
import type { CrossDomainQuestion } from '@/features/assessment/adaptive-question-bank';
import { canonicalMicroTutoringQuestionId } from '@/features/assessment/micro-tutoring-validation-registry';
import { getCheckpointAuthoredQuestionRecordByRuntimeId } from '@/features/assessment/learning-goal-checkpoint-question-sets';
import {
  REMEDIATION_MANUAL_PRACTICE_PATH,
  readAvailableRemediationInterventionSource,
  type AvailableRemediationInterventionSource,
  type RemediationOrchestrationDb,
  type RemediationTaskSnapshot,
} from '@/features/assessment/remediation-orchestration';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import type { ResourceNode } from '@/lib/resource-node-registry';
import { buildResourceNodeRegistryFromTeachingResources } from '@/lib/teacher-resource-node-data';
import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE,
} from '@/lib/data-governance/autocontrol-kaq-graph-catalog';

const MAX_DURATION_SECONDS = 3600;
const SOURCE_SNAPSHOT_VERSION = 'micro-intervention-source.v2';

export type MicroInterventionEventType = 'RESOURCE_USED' | 'HINT_REQUESTED' | 'COMPLETED';

export type MicroInterventionUnavailableReason = 'REFERENCE_DRIFT' | 'ACCESS_REVOKED';

export type MicroInterventionRecommendation =
  | {
    kind: 'TRANSFER_PRACTICE';
    basisSummary: string;
    actions: Array<{ title: string; actionPath: string }>;
  }
  | {
    kind: 'TRANSFER_PRACTICE_UNAVAILABLE';
    basisSummary: string;
    actions: [];
  }
  | {
    kind: 'PREREQUISITE_SPLIT';
    basisSummary: string;
    prerequisiteNodes: Array<{ name: string }>;
  }
  | {
    kind: 'ADJUST_TUTORING_STRATEGY';
    basisSummary: string;
    manualPracticePath: string;
  };

export type MicroInterventionProjection = {
  id: string;
  status: 'STARTED' | 'COMPLETED' | 'VALIDATED';
  startedAt: string;
  progress: {
    resourceUseCount: number;
    hintCount: number;
    completedAt: string | null;
    durationSeconds: number | null;
  };
  validation: {
    isCorrect: boolean;
    submittedAt: string;
  } | null;
  recommendation: MicroInterventionRecommendation | null;
};

export type MicroInterventionReadResult = MicroInterventionProjection | {
  id: string;
  status: 'UNAVAILABLE';
  unavailableReason: MicroInterventionUnavailableReason;
};

export type MicroInterventionValidationQuestionProjection = {
  id: string;
  prompt: string;
  options: Array<{
    label: string;
    text: string;
  }>;
};

export type MicroInterventionValidationQuestionReadResult =
  | MicroInterventionValidationQuestionProjection
  | Extract<MicroInterventionReadResult, { status: 'UNAVAILABLE' }>;

interface InterventionRow {
  id: string;
  remediationOrchestrationResultId: string;
  userId: string;
  learnerSessionId: string;
  startEventKey: string;
  sourceSnapshot: unknown;
  startedAt: Date;
  createdAt: Date;
  events?: InterventionEventRow[];
  validation?: InterventionValidationRow | null;
}

interface InterventionEventRow {
  id: string;
  eventKey: string;
  eventType: string;
  resourceId: string | null;
  durationSeconds: number | null;
  occurredAt: Date;
  createdAt: Date;
}

interface InterventionValidationRow {
  id: string;
  eventKey: string;
  selectedOptionKey: string;
  isCorrect: boolean;
  durationSeconds: number;
  questionId: string;
  questionContentHash: string;
  questionVersion: string;
  recommendationSnapshot: unknown;
  submittedAt: Date;
  createdAt: Date;
}

interface TransferResourceRow {
  id: string;
  title: string;
  displayName: string | null;
  description: string | null;
  type: string;
  registryId: string | null;
  content: string | null;
  category: string | null;
  teacherOnly: boolean;
  config: unknown;
  knowledgeNodes: Array<{
    id: string;
    name: string;
    resources: unknown;
    tags: string[];
  }>;
}

interface KnowledgeLinkRow {
  sourceId: string;
  targetId: string;
  relation: string;
  sourceNode?: { id: string; name: string; isActive: boolean } | null;
  targetNode?: { id: string; name: string; isActive: boolean } | null;
}

export interface MicroInterventionDb extends RemediationOrchestrationDb {
  microInterventionOutcome: {
    upsert(input: any): Promise<InterventionRow>;
    findFirst(input: any): Promise<InterventionRow | null>;
  };
  microInterventionEvent: {
    findFirst(input: any): Promise<InterventionEventRow | null>;
    upsert(input: any): Promise<InterventionEventRow>;
  };
  microInterventionValidation: {
    findFirst(input: any): Promise<InterventionValidationRow | null>;
    upsert(input: any): Promise<InterventionValidationRow>;
  };
  knowledgeLink: {
    findMany(input: any): Promise<KnowledgeLinkRow[]>;
  };
}

interface InterventionSourceSnapshot {
  version: typeof SOURCE_SNAPSHOT_VERSION;
  remediationResultId: string;
  orchestratorVersion: string;
  learnerSessionId: string;
  validationRuntimeHash: string | null;
  task: RemediationTaskSnapshot;
}

export class MicroInterventionRequestError extends Error {
  constructor(readonly code: 'EVENT_INVALID' | 'IDEMPOTENCY_CONFLICT' | 'VALIDATION_INVALID' | 'VALIDATION_UNAVAILABLE') {
    super(code);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nonNegativeDuration(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_DURATION_SECONDS
    ? value
    : null;
}

function positiveDuration(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_DURATION_SECONDS
    ? value
    : null;
}

function actionPath(value: unknown): string | null {
  const path = nonEmptyString(value);
  return path?.startsWith('/') && !path.startsWith('//') ? path : null;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

function validationRuntimeHash(question: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(question))).digest('hex');
}

function sameValidationQuestionId(left: string, right: string): boolean {
  if (left === right) return true;
  const canonical = canonicalMicroTutoringQuestionId(left);
  return canonical === canonicalMicroTutoringQuestionId(right) &&
    getCheckpointAuthoredQuestionRecordByRuntimeId(canonical) !== null;
}

function resolvedRuntimeQuestion(
  questionId: string,
  question: CrossDomainQuestion | null,
): CrossDomainQuestion | null {
  return question && sameValidationQuestionId(question.id, questionId) ? question : null;
}

function taskSnapshot(value: unknown): RemediationTaskSnapshot | null {
  const task = record(value);
  const validation = record(task?.validationQuestion);
  const resources = Array.isArray(task?.resources) ? task.resources : null;
  const sourceQuestionId = nonEmptyString(task?.sourceQuestionId);
  const knowledgeNodeId = nonEmptyString(task?.knowledgeNodeId);
  const misconceptionTag = nonEmptyString(task?.misconceptionTag);
  const questionId = nonEmptyString(validation?.questionId);
  const contentHash = nonEmptyString(validation?.contentHash);
  const version = nonEmptyString(validation?.version);
  const itemRefId = nonEmptyString(validation?.itemRefId);
  if (
    task?.version !== 'remediation-task-snapshot.v1' || !sourceQuestionId || !knowledgeNodeId ||
    !misconceptionTag || !questionId || !contentHash || !version || !itemRefId || !resources
  ) {
    return null;
  }
  return task as unknown as RemediationTaskSnapshot;
}

function sourceSnapshot(value: unknown): InterventionSourceSnapshot | null {
  const source = record(value);
  const remediationResultId = nonEmptyString(source?.remediationResultId);
  const orchestratorVersion = nonEmptyString(source?.orchestratorVersion);
  const learnerSessionId = nonEmptyString(source?.learnerSessionId);
  const rawRuntimeHash = source?.validationRuntimeHash;
  const runtimeHash = rawRuntimeHash === null
    ? null
    : nonEmptyString(rawRuntimeHash);
  const task = taskSnapshot(source?.task);
  if (
    source?.version !== SOURCE_SNAPSHOT_VERSION || !remediationResultId || !orchestratorVersion || !learnerSessionId ||
    (rawRuntimeHash !== null && !runtimeHash) || !task
  ) {
    return null;
  }
  return {
    version: SOURCE_SNAPSHOT_VERSION,
    remediationResultId,
    orchestratorVersion,
    learnerSessionId,
    validationRuntimeHash: runtimeHash,
    task,
  };
}

function sourceFromAvailableTask(
  source: AvailableRemediationInterventionSource,
  question: CrossDomainQuestion | null,
): InterventionSourceSnapshot {
  const resolved = resolvedRuntimeQuestion(source.task.validationQuestion.questionId, question);
  const task = structuredClone(source.task);
  if (resolved) {
    task.validationQuestion = {
      ...task.validationQuestion,
      questionId: resolved.id,
    };
  }
  return {
    version: SOURCE_SNAPSHOT_VERSION,
    remediationResultId: source.remediationResultId,
    orchestratorVersion: source.orchestratorVersion,
    learnerSessionId: source.learnerSessionId,
    validationRuntimeHash: resolved ? validationRuntimeHash(resolved) : null,
    task,
  };
}

function sameSource(
  snapshot: InterventionSourceSnapshot,
  current: AvailableRemediationInterventionSource,
): boolean {
  const storedTask = snapshot.task;
  const currentTask = current.task;
  return snapshot.remediationResultId === current.remediationResultId &&
    snapshot.orchestratorVersion === current.orchestratorVersion &&
    snapshot.learnerSessionId === current.learnerSessionId &&
    storedTask.sourceQuestionId === currentTask.sourceQuestionId &&
    storedTask.knowledgeNodeId === currentTask.knowledgeNodeId &&
    storedTask.misconceptionTag === currentTask.misconceptionTag &&
    storedTask.validationQuestion.itemRefId === currentTask.validationQuestion.itemRefId &&
    sameValidationQuestionId(
      storedTask.validationQuestion.questionId,
      currentTask.validationQuestion.questionId,
    ) &&
    storedTask.validationQuestion.contentHash === currentTask.validationQuestion.contentHash &&
    storedTask.validationQuestion.version === currentTask.validationQuestion.version &&
    JSON.stringify(canonicalize(storedTask.resources)) === JSON.stringify(canonicalize(currentTask.resources));
}

function unavailable(
  row: InterventionRow,
  unavailableReason: MicroInterventionUnavailableReason,
): Extract<MicroInterventionReadResult, { status: 'UNAVAILABLE' }> {
  return { id: row.id, status: 'UNAVAILABLE', unavailableReason };
}

function recommendation(value: unknown): MicroInterventionRecommendation | null {
  const snapshot = record(value);
  const kind = nonEmptyString(snapshot?.kind);
  const basisSummary = nonEmptyString(snapshot?.basisSummary);
  if (!kind || !basisSummary) return null;
  if (kind === 'TRANSFER_PRACTICE_UNAVAILABLE') {
    return { kind, basisSummary, actions: [] };
  }
  if (kind === 'ADJUST_TUTORING_STRATEGY') {
    const manualPracticePath = actionPath(snapshot?.manualPracticePath);
    return manualPracticePath === REMEDIATION_MANUAL_PRACTICE_PATH || manualPracticePath === '/student/practice'
      ? { kind, basisSummary, manualPracticePath: REMEDIATION_MANUAL_PRACTICE_PATH }
      : null;
  }
  if (kind === 'TRANSFER_PRACTICE') {
    const actions = Array.isArray(snapshot?.actions) ? snapshot.actions.map((entry) => {
      const item = record(entry);
      const title = nonEmptyString(item?.title);
      const target = actionPath(item?.actionPath);
      return title && target ? { title, actionPath: target } : null;
    }) : [];
    return actions.length > 0 && actions.every(Boolean)
      ? { kind, basisSummary, actions: actions as Array<{ title: string; actionPath: string }> }
      : null;
  }
  if (kind === 'PREREQUISITE_SPLIT') {
    const prerequisiteNodes = Array.isArray(snapshot?.prerequisiteNodes) ? snapshot.prerequisiteNodes.map((entry) => {
      const item = record(entry);
      const name = nonEmptyString(item?.name);
      return name ? { name } : null;
    }) : [];
    return prerequisiteNodes.length > 0 && prerequisiteNodes.every(Boolean)
      ? { kind, basisSummary, prerequisiteNodes: prerequisiteNodes as Array<{ name: string }> }
      : null;
  }
  return null;
}

function projection(row: InterventionRow): MicroInterventionProjection | null {
  const events = row.events ?? [];
  const completed = events
    .filter((event) => event.eventType === 'COMPLETED')
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())[0] ?? null;
  const validation = row.validation ?? null;
  const parsedRecommendation = validation ? recommendation(validation.recommendationSnapshot) : null;
  if (validation && !parsedRecommendation) return null;
  return {
    id: row.id,
    status: validation ? 'VALIDATED' : completed ? 'COMPLETED' : 'STARTED',
    startedAt: row.startedAt.toISOString(),
    progress: {
      resourceUseCount: events.filter((event) => event.eventType === 'RESOURCE_USED').length,
      hintCount: events.filter((event) => event.eventType === 'HINT_REQUESTED').length,
      completedAt: completed?.occurredAt.toISOString() ?? null,
      durationSeconds: completed?.durationSeconds ?? null,
    },
    validation: validation ? {
      isCorrect: validation.isCorrect,
      submittedAt: validation.submittedAt.toISOString(),
    } : null,
    recommendation: parsedRecommendation,
  };
}

function interventionInclude() {
  return {
    events: {
      select: {
        id: true,
        eventKey: true,
        eventType: true,
        resourceId: true,
        durationSeconds: true,
        occurredAt: true,
        createdAt: true,
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    },
    validation: {
      select: {
        id: true,
        eventKey: true,
        selectedOptionKey: true,
        isCorrect: true,
        durationSeconds: true,
        questionId: true,
        questionContentHash: true,
        questionVersion: true,
        recommendationSnapshot: true,
        submittedAt: true,
        createdAt: true,
      },
    },
  };
}

async function findOwnedIntervention(input: {
  db: MicroInterventionDb;
  authenticatedUserId: string;
  interventionId: string;
}): Promise<InterventionRow | null> {
  return input.db.microInterventionOutcome.findFirst({
    where: { id: input.interventionId, userId: input.authenticatedUserId },
    include: interventionInclude(),
  });
}

async function currentIntervention(input: {
  db: MicroInterventionDb;
  authenticatedUserId: string;
  interventionId: string;
}): Promise<{
  row: InterventionRow;
  source: InterventionSourceSnapshot;
} | Extract<MicroInterventionReadResult, { status: 'UNAVAILABLE' }> | null> {
  const row = await findOwnedIntervention(input);
  if (!row) return null;
  const snapshot = sourceSnapshot(row.sourceSnapshot);
  if (!snapshot) return unavailable(row, 'REFERENCE_DRIFT');
  const current = await readAvailableRemediationInterventionSource({
    db: input.db,
    authenticatedUserId: input.authenticatedUserId,
    resultId: snapshot.remediationResultId,
  });
  if (!current) return unavailable(row, 'ACCESS_REVOKED');
  if (!sameSource(snapshot, current)) return unavailable(row, 'REFERENCE_DRIFT');
  return { row, source: snapshot };
}

function resourceSelect() {
  return {
    id: true,
    title: true,
    displayName: true,
    description: true,
    type: true,
    registryId: true,
    content: true,
    category: true,
    teacherOnly: true,
    config: true,
    knowledgeNodes: {
      select: { id: true, name: true, resources: true, tags: true },
    },
  };
}

function learnerTransferAction(row: TransferResourceRow, node: ResourceNode | null) {
  const disposition = node?.planningMetadata.pathDisposition;
  const target = actionPath(node?.launchTarget ?? node?.renderTarget);
  if (
    row.teacherOnly || !node?.eligibility.pathEligible ||
    node.planningMetadata.privacyLevel !== 'student-visible' ||
    node.planningMetadata.availability !== 'available' ||
    node.planningMetadata.teacherPolicy !== 'allowed' ||
    (node.planningMetadata.abilityImpact.crossDomainTransfer ?? 0) <= 0 ||
    node.planningMetadata.evidenceInstrumentation.length === 0 ||
    disposition?.kind !== 'path-plannable' || disposition.reviewStatus !== 'human-confirmed' || !target
  ) {
    return null;
  }
  return { title: node.title, actionPath: target };
}

function governedTransferTargetKnowledgeRefs(sourceKnowledgeRef: string): string[] {
  const activeKnowledgeNodeIds = new Set(AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes
    .filter((node) => node.domain === 'knowledge' && node.status === 'active')
    .map((node) => node.id));
  const sourceNodeIds = new Set(AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE
    .filter((coverage) => (
      coverage.graphNodeId === sourceKnowledgeRef ||
      coverage.runtimeKnowledgeRefs.includes(sourceKnowledgeRef)
    ))
    .map((coverage) => coverage.graphNodeId)
    .filter((nodeId) => activeKnowledgeNodeIds.has(nodeId)));
  if (activeKnowledgeNodeIds.has(sourceKnowledgeRef)) sourceNodeIds.add(sourceKnowledgeRef);
  const targetNodeIds = new Set(AUTOCONTROL_KAQ_GRAPH_CATALOG.edges
    .filter((edge) => (
      edge.domain === 'knowledge' &&
      edge.relation === 'transfers-to' &&
      sourceNodeIds.has(edge.sourceNodeId) &&
      activeKnowledgeNodeIds.has(edge.targetNodeId)
    ))
    .map((edge) => edge.targetNodeId));
  return [...new Set(AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE
    .filter((coverage) => targetNodeIds.has(coverage.graphNodeId))
    .flatMap((coverage) => coverage.runtimeKnowledgeRefs))]
    .sort((left, right) => left.localeCompare(right));
}

async function recommendationForPass(
  db: MicroInterventionDb,
  source: InterventionSourceSnapshot,
): Promise<MicroInterventionRecommendation> {
  const targetIds = governedTransferTargetKnowledgeRefs(source.task.knowledgeNodeId);
  if (targetIds.length === 0) {
    return {
      kind: 'TRANSFER_PRACTICE_UNAVAILABLE',
      basisSummary: '本次验证通过；当前没有仍可访问的受治理迁移练习。',
      actions: [],
    };
  }

  const resources = await db.teachingResource.findMany({
    where: { teacherOnly: false, knowledgeNodes: { some: { id: { in: targetIds } } } },
    select: resourceSelect(),
  }) as TransferResourceRow[];
  const registry = buildResourceNodeRegistryFromTeachingResources(resources, getAllRegisteredResourceMetadata());
  const nodeByResourceId = new Map(registry.nodes
    .filter((node) => node.sourceKind === 'teaching_resource')
    .map((node) => [node.sourceRef, node]));
  const actions = resources
    .map((resource) => learnerTransferAction(resource, nodeByResourceId.get(resource.id) ?? null))
    .filter((item): item is { title: string; actionPath: string } => item !== null)
    .sort((left, right) => left.actionPath.localeCompare(right.actionPath));
  return actions.length > 0
    ? {
      kind: 'TRANSFER_PRACTICE',
      basisSummary: '本次验证通过；后续练习来自当前有效的“迁移到”关系和受治理资源。',
      actions,
    }
    : {
      kind: 'TRANSFER_PRACTICE_UNAVAILABLE',
      basisSummary: '本次验证通过；当前没有仍可访问的受治理迁移练习。',
      actions: [],
    };
}

async function recommendationForFailure(
  db: MicroInterventionDb,
  source: InterventionSourceSnapshot,
): Promise<MicroInterventionRecommendation> {
  const prerequisiteLinks = await db.knowledgeLink.findMany({
    where: {
      targetId: source.task.knowledgeNodeId,
      relation: { in: ['prerequisite', 'provides_foundation'] },
      sourceNode: { isActive: true },
    },
    select: {
      sourceId: true,
      targetId: true,
      relation: true,
      sourceNode: { select: { id: true, name: true, isActive: true } },
    },
    orderBy: [{ sourceId: 'asc' }, { targetId: 'asc' }],
  });
  const prerequisiteNodes = prerequisiteLinks
    .map((link) => link.sourceNode)
    .filter((node): node is { id: string; name: string; isActive: boolean } => Boolean(node?.isActive))
    .map((node) => ({ name: node.name }));
  if (prerequisiteNodes.length > 0) {
    return {
      kind: 'PREREQUISITE_SPLIT',
      basisSummary: '本次验证未通过；建议先处理当前有效前置知识关系中的基础节点，正式学习路径未被修改。',
      prerequisiteNodes,
    };
  }
  return {
    kind: 'ADJUST_TUTORING_STRATEGY',
    basisSummary: '本次验证未通过；当前没有可用的受治理前置节点，请调整辅导策略后进入人工练习。',
    manualPracticePath: REMEDIATION_MANUAL_PRACTICE_PATH,
  };
}

async function recommendationForValidation(
  db: MicroInterventionDb,
  source: InterventionSourceSnapshot,
  isCorrect: boolean,
): Promise<MicroInterventionRecommendation> {
  return isCorrect ? recommendationForPass(db, source) : recommendationForFailure(db, source);
}

export async function startMicroIntervention(input: {
  db: MicroInterventionDb;
  authenticatedUserId: string;
  remediationResultId: string;
  startEventKey: string;
}): Promise<MicroInterventionReadResult | null> {
  const source = await readAvailableRemediationInterventionSource({
    db: input.db,
    authenticatedUserId: input.authenticatedUserId,
    resultId: input.remediationResultId,
  });
  if (!source) return null;
  const question = getAdaptiveQuestionById(source.task.validationQuestion.questionId);
  const persisted = await input.db.microInterventionOutcome.upsert({
    where: {
      remediationOrchestrationResultId_userId_learnerSessionId_startEventKey: {
        remediationOrchestrationResultId: source.remediationResultId,
        userId: input.authenticatedUserId,
        learnerSessionId: source.learnerSessionId,
        startEventKey: input.startEventKey,
      },
    },
    update: {},
    create: {
      remediationOrchestrationResultId: source.remediationResultId,
      userId: input.authenticatedUserId,
      learnerSessionId: source.learnerSessionId,
      startEventKey: input.startEventKey,
      sourceSnapshot: sourceFromAvailableTask(source, question),
    },
  });
  return readMicroIntervention({
    db: input.db,
    authenticatedUserId: input.authenticatedUserId,
    interventionId: persisted.id,
  });
}

export async function readMicroIntervention(input: {
  db: MicroInterventionDb;
  authenticatedUserId: string;
  interventionId: string;
}): Promise<MicroInterventionReadResult | null> {
  const current = await currentIntervention(input);
  if (!current || 'status' in current) return current;
  return projection(current.row) ?? unavailable(current.row, 'REFERENCE_DRIFT');
}

export async function readMicroInterventionValidationQuestion(input: {
  db: MicroInterventionDb;
  authenticatedUserId: string;
  interventionId: string;
}): Promise<MicroInterventionValidationQuestionReadResult | null> {
  const current = await currentIntervention(input);
  if (!current) return null;
  if (!('row' in current)) {
    return {
      id: current.id,
      status: 'UNAVAILABLE',
      unavailableReason: current.unavailableReason,
    };
  }
  const question = getAdaptiveQuestionById(current.source.task.validationQuestion.questionId);
  const resolved = resolvedRuntimeQuestion(current.source.task.validationQuestion.questionId, question);
  if (
    !resolved ||
    !current.source.validationRuntimeHash ||
    validationRuntimeHash(resolved) !== current.source.validationRuntimeHash
  ) {
    return {
      id: current.row.id,
      status: 'UNAVAILABLE',
      unavailableReason: 'REFERENCE_DRIFT',
    };
  }
  return {
    id: resolved.id,
    prompt: resolved.stem,
    options: resolved.options.map(({ label, text }) => ({ label, text })),
  };
}

export async function recordMicroInterventionEvent(input: {
  db: MicroInterventionDb;
  authenticatedUserId: string;
  interventionId: string;
  eventKey: string;
  eventType: MicroInterventionEventType;
  resourceId?: string;
  durationSeconds?: number;
}): Promise<MicroInterventionReadResult | null> {
  const current = await currentIntervention(input);
  if (!current || 'status' in current) return current;
  const resourceId = input.resourceId?.trim() || null;
  const durationSeconds = input.durationSeconds === undefined ? null : nonNegativeDuration(input.durationSeconds);
  if (input.durationSeconds !== undefined && durationSeconds === null) {
    throw new MicroInterventionRequestError('EVENT_INVALID');
  }
  if (input.eventType === 'RESOURCE_USED') {
    const boundResource = current.source.task.resources.find((resource) => resource.id === resourceId);
    if (!resourceId || !boundResource?.actionId || !boundResource.actionVersion) {
      throw new MicroInterventionRequestError('EVENT_INVALID');
    }
  } else if (resourceId) {
    throw new MicroInterventionRequestError('EVENT_INVALID');
  }
  if (input.eventType === 'COMPLETED' && durationSeconds === null) {
    throw new MicroInterventionRequestError('EVENT_INVALID');
  }

  const sameEvent = (event: InterventionEventRow) => (
    event.eventType === input.eventType && event.resourceId === resourceId && event.durationSeconds === durationSeconds
  );
  const existing = await input.db.microInterventionEvent.findFirst({
    where: { interventionId: current.row.id, eventKey: input.eventKey },
  });
  if (existing) {
    if (!sameEvent(existing)) throw new MicroInterventionRequestError('IDEMPOTENCY_CONFLICT');
    return readMicroIntervention(input);
  }

  const persisted = await input.db.microInterventionEvent.upsert({
    where: {
      interventionId_eventKey: {
        interventionId: current.row.id,
        eventKey: input.eventKey,
      },
    },
    update: {},
    create: {
      interventionId: current.row.id,
      eventKey: input.eventKey,
      eventType: input.eventType,
      resourceId,
      durationSeconds,
      occurredAt: new Date(),
    },
  });
  if (!sameEvent(persisted)) throw new MicroInterventionRequestError('IDEMPOTENCY_CONFLICT');
  return readMicroIntervention(input);
}

export async function submitMicroInterventionValidation(input: {
  db: MicroInterventionDb;
  authenticatedUserId: string;
  interventionId: string;
  eventKey: string;
  questionId: string;
  selectedOption: string;
  durationSeconds: number;
}): Promise<MicroInterventionReadResult | null> {
  const current = await currentIntervention(input);
  if (!current || 'status' in current) return current;
  const durationSeconds = positiveDuration(input.durationSeconds);
  if (!durationSeconds || !sameValidationQuestionId(input.questionId, current.source.task.validationQuestion.questionId)) {
    throw new MicroInterventionRequestError('VALIDATION_INVALID');
  }
  const question = resolvedRuntimeQuestion(
    current.source.task.validationQuestion.questionId,
    getAdaptiveQuestionById(current.source.task.validationQuestion.questionId),
  );
  if (!question) {
    throw new MicroInterventionRequestError('VALIDATION_UNAVAILABLE');
  }
  if (!current.source.validationRuntimeHash || validationRuntimeHash(question) !== current.source.validationRuntimeHash) {
    throw new MicroInterventionRequestError('VALIDATION_UNAVAILABLE');
  }
  const selectedIndex = question.options.findIndex((option) => (
    option.label === input.selectedOption || option.text === input.selectedOption
  ));
  if (selectedIndex < 0) throw new MicroInterventionRequestError('VALIDATION_INVALID');
  const isCorrect = Boolean(question.options[selectedIndex]?.isCorrect);
  const selectedOptionKey = String.fromCharCode(65 + selectedIndex);
  const sameValidation = (validation: InterventionValidationRow) => (
    validation.eventKey === input.eventKey &&
    validation.selectedOptionKey === selectedOptionKey &&
    validation.isCorrect === isCorrect &&
    validation.durationSeconds === durationSeconds &&
    validation.questionId === current.source.task.validationQuestion.questionId &&
    validation.questionContentHash === current.source.task.validationQuestion.contentHash &&
    validation.questionVersion === current.source.task.validationQuestion.version
  );
  const existing = await input.db.microInterventionValidation.findFirst({
    where: { interventionId: current.row.id },
  });
  if (existing) {
    if (!sameValidation(existing)) throw new MicroInterventionRequestError('IDEMPOTENCY_CONFLICT');
    return readMicroIntervention(input);
  }

  const nextStep = await recommendationForValidation(input.db, current.source, isCorrect);
  const persisted = await input.db.microInterventionValidation.upsert({
    where: { interventionId: current.row.id },
    update: {},
    create: {
      interventionId: current.row.id,
      eventKey: input.eventKey,
      selectedOptionKey,
      isCorrect,
      durationSeconds,
      questionId: current.source.task.validationQuestion.questionId,
      questionContentHash: current.source.task.validationQuestion.contentHash,
      questionVersion: current.source.task.validationQuestion.version,
      recommendationSnapshot: nextStep,
    },
  });
  if (!sameValidation(persisted)) throw new MicroInterventionRequestError('IDEMPOTENCY_CONFLICT');
  return readMicroIntervention(input);
}
