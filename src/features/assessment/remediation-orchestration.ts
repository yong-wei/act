export const REMEDIATION_ORCHESTRATOR_VERSION = 'remediation-orchestrator.v1';
export const REMEDIATION_MANUAL_PRACTICE_PATH = '/student/practice';

export type RemediationUnavailableReason =
  | 'ATTRIBUTION_UNCERTAIN'
  | 'RESOURCE_UNAVAILABLE'
  | 'VALIDATION_QUESTION_UNAVAILABLE'
  | 'TIME_BUDGET_UNAVAILABLE'
  | 'ACCESS_REVOKED'
  | 'REFERENCE_DRIFT';

interface AttributionRow {
  id: string;
  userId: string;
  questionId: string;
  state: string;
  knowledgeNodeIds: string[];
  misconceptionTags: string[];
}

interface KnowledgeNodeRow {
  id: string;
  name: string;
  isActive: boolean;
}

interface ResourceRow {
  id: string;
  title: string;
  teacherOnly: boolean;
  config: unknown;
  knowledgeNodes: Array<{ id: string }>;
}

interface ValidationItemRow {
  id: string;
  questionId: string;
  contentHash: string;
  metadata: unknown;
}

interface PersistedResultRow {
  id: string;
  wrongAnswerAttributionId: string;
  orchestratorVersion: string;
  userId: string;
  status: string;
  unavailableReason: string | null;
  manualPracticePath: string | null;
  taskSnapshot: unknown;
  createdAt: Date;
}

export interface RemediationOrchestrationDb {
  wrongAnswerAttribution: {
    findFirst(input: any): Promise<AttributionRow | null>;
  };
  knowledgeNode: {
    findFirst(input: any): Promise<KnowledgeNodeRow | null>;
  };
  teachingResource: {
    findMany(input: any): Promise<ResourceRow[]>;
  };
  adaptiveAssessmentItemRef: {
    findMany(input: any): Promise<ValidationItemRow[]>;
    findFirst(input: any): Promise<ValidationItemRow | null>;
  };
  remediationOrchestrationResult: {
    upsert(input: any): Promise<PersistedResultRow>;
    findFirst(input: any): Promise<PersistedResultRow | null>;
  };
}

interface GovernedResource {
  id: string;
  title: string;
  version: string;
  estimatedMinutes: number;
  actionPath: string;
  tier: number;
}

interface GovernedValidationItem {
  id: string;
  questionId: string;
  contentHash: string;
  version: string;
  estimatedMinutes: number;
  actionPath: string;
}

interface RemediationTaskSnapshot {
  version: 'remediation-task-snapshot.v1';
  goal: string;
  estimatedMinutes: number;
  sourceQuestionId: string;
  knowledgeNodeId: string;
  misconceptionTag: string;
  resources: Array<{
    id: string;
    title: string;
    version: string;
    estimatedMinutes: number;
    actionPath: string;
  }>;
  validationQuestion: {
    itemRefId: string;
    questionId: string;
    contentHash: string;
    version: string;
    estimatedMinutes: number;
    actionPath: string;
  };
}

export type RemediationOrchestrationProjection =
  | {
    id: string;
    status: 'AVAILABLE';
    orchestratorVersion: string;
    task: RemediationTaskSnapshot;
    createdAt: string;
  }
  | {
    id: string;
    status: 'UNAVAILABLE';
    orchestratorVersion: string;
    unavailableReason: RemediationUnavailableReason;
    manualPracticePath: string;
    createdAt: string;
  };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.map(nonEmptyString);
  return strings.some((value) => value === null) ? null : strings as string[];
}

function governedMinutes(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 10
    ? value
    : null;
}

function governedActionPath(value: unknown): string | null {
  const path = nonEmptyString(value);
  return path?.startsWith('/') && !path.startsWith('//') ? path : null;
}

function parseResource(
  row: ResourceRow,
  knowledgeNodeId: string,
  misconceptionTag: string,
): GovernedResource | null {
  const remediation = record(record(row.config)?.remediation);
  const version = nonEmptyString(remediation?.version);
  const estimatedMinutes = governedMinutes(remediation?.estimatedMinutes);
  const actionPath = governedActionPath(remediation?.actionPath);
  const misconceptionTags = stringArray(remediation?.misconceptionTags);
  const prerequisiteKnowledgeNodeIds = stringArray(remediation?.prerequisiteKnowledgeNodeIds);
  const exactNode = row.knowledgeNodes.some((node) => node.id === knowledgeNodeId);
  const exactMisconception = misconceptionTags?.includes(misconceptionTag) ?? false;
  const prerequisite = prerequisiteKnowledgeNodeIds?.includes(knowledgeNodeId) ?? false;

  if (
    row.teacherOnly ||
    remediation?.learnerVisible !== true ||
    !version ||
    !estimatedMinutes ||
    !actionPath ||
    !misconceptionTags ||
    !prerequisiteKnowledgeNodeIds ||
    (!exactNode && !prerequisite)
  ) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    version,
    estimatedMinutes,
    actionPath,
    tier: exactNode && exactMisconception ? 0 : exactNode ? 1 : 2,
  };
}

function parseValidationItem(
  row: ValidationItemRow,
  sourceQuestionId: string,
  knowledgeNodeId: string,
  misconceptionTag: string,
): GovernedValidationItem | null {
  const metadata = record(row.metadata);
  const validation = record(metadata?.remediationValidation);
  const relationship = record(validation?.relationship);
  const version = nonEmptyString(validation?.version);
  const estimatedMinutes = governedMinutes(validation?.estimatedMinutes);
  const actionPath = governedActionPath(validation?.actionPath);
  const graphNodeIds = stringArray(validation?.graphNodeIds);
  const misconceptionTags = stringArray(validation?.misconceptionTags);
  const sourceQuestionIds = stringArray(relationship?.sourceQuestionIds);
  const relationshipKind = nonEmptyString(relationship?.kind);
  const relationshipMatches = (
    relationshipKind === 'isomorphic' || relationshipKind === 'variant'
  ) && (sourceQuestionIds?.includes(sourceQuestionId) ?? false);
  const misconceptionMatches = misconceptionTags?.includes(misconceptionTag) ?? false;

  if (
    row.questionId === sourceQuestionId ||
    validation?.learnerVisible !== true ||
    !version ||
    !estimatedMinutes ||
    !actionPath ||
    !graphNodeIds?.includes(knowledgeNodeId) ||
    !misconceptionTags ||
    !sourceQuestionIds ||
    (!relationshipMatches && !misconceptionMatches) ||
    !/^[a-f0-9]{64}$/.test(row.contentHash)
  ) {
    return null;
  }

  return {
    id: row.id,
    questionId: row.questionId,
    contentHash: row.contentHash,
    version,
    estimatedMinutes,
    actionPath,
  };
}

function orderedResources(resources: GovernedResource[]): GovernedResource[] {
  return [...resources].sort((left, right) =>
    left.tier - right.tier ||
    left.version.localeCompare(right.version) ||
    left.id.localeCompare(right.id));
}

function orderedValidationItems(items: GovernedValidationItem[]): GovernedValidationItem[] {
  return [...items].sort((left, right) =>
    left.version.localeCompare(right.version) || left.id.localeCompare(right.id));
}

function selectMinimalResourceSet(
  resources: GovernedResource[],
  validationMinutes: number,
): GovernedResource[] | null {
  const minimumResourceMinutes = Math.max(1, 5 - validationMinutes);
  const maximumResourceMinutes = 10 - validationMinutes;
  if (maximumResourceMinutes < minimumResourceMinutes) return null;

  const bestByMinutes = new Map<number, number[]>();
  bestByMinutes.set(0, []);
  resources.forEach((resource, index) => {
    const current = [...bestByMinutes.entries()].sort(([left], [right]) => right - left);
    for (const [minutes, indexes] of current) {
      const nextMinutes = minutes + resource.estimatedMinutes;
      if (nextMinutes > maximumResourceMinutes) continue;
      const candidate = [...indexes, index];
      const existing = bestByMinutes.get(nextMinutes);
      if (!existing || candidate.length < existing.length) {
        bestByMinutes.set(nextMinutes, candidate);
      }
    }
  });

  const valid = [...bestByMinutes.entries()]
    .filter(([minutes]) => minutes >= minimumResourceMinutes && minutes <= maximumResourceMinutes)
    .sort((left, right) => left[1].length - right[1].length || compareIndexes(left[1], right[1]));
  return valid[0]?.[1].map((index) => resources[index]) ?? null;
}

function compareIndexes(left: number[], right: number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function unavailableReason(value: string | null): RemediationUnavailableReason {
  const allowed = new Set<RemediationUnavailableReason>([
    'ATTRIBUTION_UNCERTAIN',
    'RESOURCE_UNAVAILABLE',
    'VALIDATION_QUESTION_UNAVAILABLE',
    'TIME_BUDGET_UNAVAILABLE',
    'ACCESS_REVOKED',
    'REFERENCE_DRIFT',
  ]);
  return allowed.has(value as RemediationUnavailableReason)
    ? value as RemediationUnavailableReason
    : 'REFERENCE_DRIFT';
}

async function persistUnavailable(input: {
  db: RemediationOrchestrationDb;
  attribution: AttributionRow;
  reason: RemediationUnavailableReason;
}): Promise<PersistedResultRow> {
  return input.db.remediationOrchestrationResult.upsert({
    where: {
      wrongAnswerAttributionId_orchestratorVersion: {
        wrongAnswerAttributionId: input.attribution.id,
        orchestratorVersion: REMEDIATION_ORCHESTRATOR_VERSION,
      },
    },
    update: {},
    create: {
      wrongAnswerAttributionId: input.attribution.id,
      orchestratorVersion: REMEDIATION_ORCHESTRATOR_VERSION,
      userId: input.attribution.userId,
      status: 'UNAVAILABLE',
      unavailableReason: input.reason,
      manualPracticePath: REMEDIATION_MANUAL_PRACTICE_PATH,
    },
  });
}

function unavailableProjection(
  row: PersistedResultRow,
  reason = unavailableReason(row.unavailableReason),
): RemediationOrchestrationProjection {
  return {
    id: row.id,
    status: 'UNAVAILABLE',
    orchestratorVersion: row.orchestratorVersion,
    unavailableReason: reason,
    manualPracticePath: row.manualPracticePath ?? REMEDIATION_MANUAL_PRACTICE_PATH,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseTaskSnapshot(value: unknown): RemediationTaskSnapshot | null {
  const snapshot = record(value);
  if (snapshot?.version !== 'remediation-task-snapshot.v1') return null;
  const goal = nonEmptyString(snapshot.goal);
  const sourceQuestionId = nonEmptyString(snapshot.sourceQuestionId);
  const knowledgeNodeId = nonEmptyString(snapshot.knowledgeNodeId);
  const misconceptionTag = nonEmptyString(snapshot.misconceptionTag);
  const estimatedMinutes = governedMinutes(snapshot.estimatedMinutes);
  const validation = record(snapshot.validationQuestion);
  if (!goal || !sourceQuestionId || !knowledgeNodeId || !misconceptionTag || !estimatedMinutes || !Array.isArray(snapshot.resources) || !validation) {
    return null;
  }

  const resources = snapshot.resources.map((value) => {
    const resource = record(value);
    const id = nonEmptyString(resource?.id);
    const title = nonEmptyString(resource?.title);
    const version = nonEmptyString(resource?.version);
    const minutes = governedMinutes(resource?.estimatedMinutes);
    const actionPath = governedActionPath(resource?.actionPath);
    return id && title && version && minutes && actionPath
      ? { id, title, version, estimatedMinutes: minutes, actionPath }
      : null;
  });
  const itemRefId = nonEmptyString(validation.itemRefId);
  const questionId = nonEmptyString(validation.questionId);
  const contentHash = nonEmptyString(validation.contentHash);
  const version = nonEmptyString(validation.version);
  const validationMinutes = governedMinutes(validation.estimatedMinutes);
  const actionPath = governedActionPath(validation.actionPath);
  if (
    resources.length === 0 || resources.some((resource) => resource === null) ||
    !itemRefId || !questionId || !contentHash || !version || !validationMinutes || !actionPath
  ) {
    return null;
  }

  const typedResources = resources as RemediationTaskSnapshot['resources'];
  const computedMinutes = typedResources.reduce((sum, resource) => sum + resource.estimatedMinutes, 0) +
    validationMinutes;
  if (estimatedMinutes < 5 || computedMinutes !== estimatedMinutes) return null;

  return {
    version: 'remediation-task-snapshot.v1',
    goal,
    estimatedMinutes,
    sourceQuestionId,
    knowledgeNodeId,
    misconceptionTag,
    resources: typedResources,
    validationQuestion: {
      itemRefId,
      questionId,
      contentHash,
      version,
      estimatedMinutes: validationMinutes,
      actionPath,
    },
  };
}

async function projectResult(
  db: RemediationOrchestrationDb,
  row: PersistedResultRow,
): Promise<RemediationOrchestrationProjection> {
  if (row.status !== 'AVAILABLE') return unavailableProjection(row);
  const task = parseTaskSnapshot(row.taskSnapshot);
  if (!task) return unavailableProjection(row, 'REFERENCE_DRIFT');

  const resources = await db.teachingResource.findMany({
    where: { id: { in: task.resources.map((resource) => resource.id) } },
    select: { id: true, title: true, teacherOnly: true, config: true, knowledgeNodes: { select: { id: true } } },
  });
  if (resources.length !== task.resources.length) return unavailableProjection(row, 'REFERENCE_DRIFT');
  for (const stored of task.resources) {
    const current = resources.find((resource) => resource.id === stored.id);
    const parsed = current && parseResource(current, task.knowledgeNodeId, task.misconceptionTag);
    if (current?.teacherOnly || record(record(current?.config)?.remediation)?.learnerVisible !== true) {
      return unavailableProjection(row, 'ACCESS_REVOKED');
    }
    if (
      !parsed ||
      parsed.version !== stored.version ||
      parsed.estimatedMinutes !== stored.estimatedMinutes ||
      parsed.actionPath !== stored.actionPath
    ) {
      return unavailableProjection(row, 'REFERENCE_DRIFT');
    }
  }

  const validation = await db.adaptiveAssessmentItemRef.findFirst({
    where: { id: task.validationQuestion.itemRefId },
    select: { id: true, questionId: true, contentHash: true, metadata: true },
  });
  if (!validation) return unavailableProjection(row, 'REFERENCE_DRIFT');
  const validationMetadata = record(validation?.metadata)?.remediationValidation;
  if (record(validationMetadata)?.learnerVisible !== true) {
    return unavailableProjection(row, 'ACCESS_REVOKED');
  }
  const parsedValidation = validation && parseValidationItem(
    validation,
    task.sourceQuestionId,
    task.knowledgeNodeId,
    task.misconceptionTag,
  );
  if (
    !parsedValidation ||
    parsedValidation.contentHash !== task.validationQuestion.contentHash ||
    parsedValidation.version !== task.validationQuestion.version ||
    parsedValidation.estimatedMinutes !== task.validationQuestion.estimatedMinutes ||
    parsedValidation.actionPath !== task.validationQuestion.actionPath
  ) {
    return unavailableProjection(row, 'REFERENCE_DRIFT');
  }

  return {
    id: row.id,
    status: 'AVAILABLE',
    orchestratorVersion: row.orchestratorVersion,
    task,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function orchestrateRemediation(input: {
  db: RemediationOrchestrationDb;
  authenticatedUserId: string;
  attributionId: string;
}): Promise<RemediationOrchestrationProjection | null> {
  const attribution = await input.db.wrongAnswerAttribution.findFirst({
    where: { id: input.attributionId, userId: input.authenticatedUserId },
    select: {
      id: true,
      userId: true,
      questionId: true,
      state: true,
      knowledgeNodeIds: true,
      misconceptionTags: true,
    },
  });
  if (!attribution) return null;

  const existing = await input.db.remediationOrchestrationResult.findFirst({
    where: {
      wrongAnswerAttributionId: attribution.id,
      orchestratorVersion: REMEDIATION_ORCHESTRATOR_VERSION,
      userId: input.authenticatedUserId,
    },
  });
  if (existing) return projectResult(input.db, existing);

  if (
    attribution.state !== 'ATTRIBUTED' ||
    attribution.knowledgeNodeIds.length !== 1 ||
    attribution.misconceptionTags.length !== 1
  ) {
    return unavailableProjection(await persistUnavailable({
      db: input.db,
      attribution,
      reason: 'ATTRIBUTION_UNCERTAIN',
    }));
  }

  const knowledgeNodeId = attribution.knowledgeNodeIds[0];
  const misconceptionTag = attribution.misconceptionTags[0];
  const knowledgeNode = await input.db.knowledgeNode.findFirst({
    where: { id: knowledgeNodeId, isActive: true },
    select: { id: true, name: true, isActive: true },
  });
  if (!knowledgeNode) {
    return unavailableProjection(await persistUnavailable({
      db: input.db,
      attribution,
      reason: 'RESOURCE_UNAVAILABLE',
    }));
  }

  const resourceRows = await input.db.teachingResource.findMany({
    where: {
      teacherOnly: false,
      OR: [
        { knowledgeNodes: { some: { id: knowledgeNodeId } } },
        { config: { path: ['remediation', 'prerequisiteKnowledgeNodeIds'], array_contains: [knowledgeNodeId] } },
      ],
    },
    select: { id: true, title: true, teacherOnly: true, config: true, knowledgeNodes: { select: { id: true } } },
  });
  const resources = orderedResources(resourceRows
    .map((row) => parseResource(row, knowledgeNodeId, misconceptionTag))
    .filter((resource): resource is GovernedResource => resource !== null));
  if (resources.length === 0) {
    return unavailableProjection(await persistUnavailable({
      db: input.db,
      attribution,
      reason: 'RESOURCE_UNAVAILABLE',
    }));
  }

  const validationRows = await input.db.adaptiveAssessmentItemRef.findMany({
    where: {
      NOT: { questionId: attribution.questionId },
      metadata: { path: ['remediationValidation', 'graphNodeIds'], array_contains: [knowledgeNodeId] },
    },
    select: { id: true, questionId: true, contentHash: true, metadata: true },
  });
  const validations = orderedValidationItems(validationRows
    .map((row) => parseValidationItem(row, attribution.questionId, knowledgeNodeId, misconceptionTag))
    .filter((item): item is GovernedValidationItem => item !== null));
  if (validations.length === 0) {
    return unavailableProjection(await persistUnavailable({
      db: input.db,
      attribution,
      reason: 'VALIDATION_QUESTION_UNAVAILABLE',
    }));
  }

  let selection: { resources: GovernedResource[]; validation: GovernedValidationItem } | null = null;
  for (const validation of validations) {
    const selectedResources = selectMinimalResourceSet(resources, validation.estimatedMinutes);
    if (selectedResources) {
      selection = { resources: selectedResources, validation };
      break;
    }
  }
  if (!selection) {
    return unavailableProjection(await persistUnavailable({
      db: input.db,
      attribution,
      reason: 'TIME_BUDGET_UNAVAILABLE',
    }));
  }

  const taskSnapshot: RemediationTaskSnapshot = {
    version: 'remediation-task-snapshot.v1',
    goal: `巩固“${knowledgeNode.name}”的关键概念`,
    estimatedMinutes: selection.resources.reduce((sum, resource) => sum + resource.estimatedMinutes, 0) +
      selection.validation.estimatedMinutes,
    sourceQuestionId: attribution.questionId,
    knowledgeNodeId,
    misconceptionTag,
    resources: selection.resources.map(({ tier: _tier, ...resource }) => resource),
    validationQuestion: {
      itemRefId: selection.validation.id,
      questionId: selection.validation.questionId,
      contentHash: selection.validation.contentHash,
      version: selection.validation.version,
      estimatedMinutes: selection.validation.estimatedMinutes,
      actionPath: selection.validation.actionPath,
    },
  };
  const persisted = await input.db.remediationOrchestrationResult.upsert({
    where: {
      wrongAnswerAttributionId_orchestratorVersion: {
        wrongAnswerAttributionId: attribution.id,
        orchestratorVersion: REMEDIATION_ORCHESTRATOR_VERSION,
      },
    },
    update: {},
    create: {
      wrongAnswerAttributionId: attribution.id,
      orchestratorVersion: REMEDIATION_ORCHESTRATOR_VERSION,
      userId: attribution.userId,
      status: 'AVAILABLE',
      taskSnapshot,
    },
  });
  return projectResult(input.db, persisted);
}

export async function readRemediationOrchestration(input: {
  db: RemediationOrchestrationDb;
  authenticatedUserId: string;
  resultId: string;
}): Promise<RemediationOrchestrationProjection | null> {
  const row = await input.db.remediationOrchestrationResult.findFirst({
    where: { id: input.resultId, userId: input.authenticatedUserId },
  });
  return row ? projectResult(input.db, row) : null;
}
