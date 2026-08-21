import {
  evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority,
  type AssessmentEvidenceCatalogSnapshot,
} from '@/features/adaptive-assessment/assessment-evidence-authority';
import { findAdaptiveAssessmentCatalogSnapshot } from '@/features/adaptive-assessment/adaptive-assessment-catalog-selector';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import type { ResourceNode } from '@/lib/resource-node-registry';
import { buildResourceNodeRegistryFromTeachingResources } from '@/lib/teacher-resource-node-data';
import { AUTOCONTROL_KAQ_GRAPH_CATALOG } from '@/lib/data-governance/autocontrol-kaq-graph-catalog';
import { listMicroTutoringGovernedResources } from './micro-tutoring-resource-registry';

export const REMEDIATION_ORCHESTRATOR_VERSION = 'remediation-orchestrator.v1';
export const REMEDIATION_MANUAL_PRACTICE_PATH = '/assessment/adaptive-practice?intent=practice';
const REMEDIATION_VALIDATION_ESTIMATED_MINUTES = 2;
const REMEDIATION_VALIDATION_ACTION_PATH = '/assessment/adaptive-practice';

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
  sessionId: string;
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

export interface RemediationResourceRow {
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

export interface RemediationValidationItemRow {
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
    findMany(input: any): Promise<RemediationResourceRow[]>;
  };
  adaptiveAssessmentItemRef: {
    findMany(input: any): Promise<RemediationValidationItemRow[]>;
    findFirst(input: any): Promise<RemediationValidationItemRow | null>;
  };
  remediationOrchestrationResult: {
    upsert(input: any): Promise<PersistedResultRow>;
    findFirst(input: any): Promise<PersistedResultRow | null>;
  };
}

export interface GovernedRemediationResource {
  id: string;
  title: string;
  version: string;
  estimatedMinutes: number;
  actionPath: string;
  tier: number;
}

export interface GovernedRemediationValidationItem {
  id: string;
  questionId: string;
  contentHash: string;
  version: string;
  estimatedMinutes: number;
  actionPath: string;
}

export interface RemediationTaskSnapshot {
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
    registryId?: string;
    actionId?: string;
    actionVersion?: string;
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

interface RemediationTaskProjection {
  version: RemediationTaskSnapshot['version'];
  goal: string;
  estimatedMinutes: number;
  resources: RemediationTaskSnapshot['resources'];
  validationQuestion: RemediationTaskSnapshot['validationQuestion'];
}

export interface AvailableRemediationInterventionSource {
  remediationResultId: string;
  orchestratorVersion: string;
  learnerSessionId: string;
  task: RemediationTaskSnapshot;
}

export type RemediationOrchestrationProjection =
  | {
    id: string;
    status: 'AVAILABLE';
    orchestratorVersion: string;
    task: RemediationTaskProjection;
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

export function remediationResourceSelect() {
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
      select: {
        id: true,
        name: true,
        resources: true,
        tags: true,
      },
    },
  };
}

function parseResource(
  row: RemediationResourceRow,
  authorityNode: ResourceNode | null,
  knowledgeNodeId: string,
  misconceptionTag: string,
): GovernedRemediationResource | null {
  const remediation = record(record(row.config)?.remediation);
  const disposition = authorityNode?.planningMetadata.pathDisposition;
  const version = nonEmptyString(disposition?.sourceVersionRef);
  const estimatedMinutes = governedMinutes(authorityNode?.planningMetadata.estimatedTimeMinutes);
  const actionPath = governedActionPath(authorityNode?.launchTarget ?? authorityNode?.renderTarget);
  const misconceptionTags = stringArray(remediation?.misconceptionTags);
  const prerequisiteKnowledgeNodeIds = stringArray(remediation?.prerequisiteKnowledgeNodeIds);
  const exactNode = authorityNode?.planningMetadata.knowledgeCoverage.includes(knowledgeNodeId) ?? false;
  const exactMisconception = misconceptionTags?.includes(misconceptionTag) ?? false;
  const prerequisite = prerequisiteKnowledgeNodeIds?.includes(knowledgeNodeId) ?? false;

  if (
    row.teacherOnly ||
    !authorityNode?.eligibility.pathEligible ||
    authorityNode.planningMetadata.privacyLevel !== 'student-visible' ||
    authorityNode.planningMetadata.availability !== 'available' ||
    authorityNode.planningMetadata.teacherPolicy !== 'allowed' ||
    authorityNode.planningMetadata.evidenceInstrumentation.length === 0 ||
    disposition?.kind !== 'path-plannable' ||
    disposition.reviewStatus !== 'human-confirmed' ||
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
    title: authorityNode.title,
    version,
    estimatedMinutes,
    actionPath,
    tier: exactNode && exactMisconception ? 0 : exactNode ? 1 : 2,
  };
}

function parseValidationItem(
  row: RemediationValidationItemRow,
  sourceQuestionId: string,
  knowledgeNodeId: string,
  _misconceptionTag: string,
): GovernedRemediationValidationItem | null {
  const metadata = record(row.metadata);
  const catalogSnapshotValue = record(metadata?.adaptiveAssessmentItemRef);
  const validation = record(metadata?.remediationValidation);
  const currentCatalogSnapshot = findAdaptiveAssessmentCatalogSnapshot(row.questionId);
  const version = nonEmptyString(
    currentCatalogSnapshot?.versionRefs.adaptiveAssessmentSnapshotVersion ??
      catalogSnapshotValue?.snapshotVersion,
  );
  const estimatedMinutes = governedMinutes(
    validation?.estimatedMinutes ?? REMEDIATION_VALIDATION_ESTIMATED_MINUTES,
  );
  const actionPath = governedActionPath(REMEDIATION_VALIDATION_ACTION_PATH);
  const graphNodeIds = currentCatalogSnapshot?.semanticRefs.graphNodeIds;
  const misconceptionTags = currentCatalogSnapshot?.semanticRefs.misconceptionTags;
  const authority = evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority(
    catalogSnapshotValue as unknown as AssessmentEvidenceCatalogSnapshot,
    currentCatalogSnapshot,
    {
      requestedStage: 'remediation',
      knownGraphNodeIds: [knowledgeNodeId],
    },
  );

  if (
    row.questionId === sourceQuestionId ||
    validation?.learnerVisible === false ||
    !authority.remediation ||
    !version ||
    !estimatedMinutes ||
    !actionPath ||
    !graphNodeIds?.includes(knowledgeNodeId) ||
    !misconceptionTags ||
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

function orderedResources(resources: GovernedRemediationResource[]): GovernedRemediationResource[] {
  return [...resources].sort((left, right) =>
    left.tier - right.tier ||
    left.version.localeCompare(right.version) ||
    left.id.localeCompare(right.id));
}

function orderedValidationItems(items: GovernedRemediationValidationItem[]): GovernedRemediationValidationItem[] {
  return [...items].sort((left, right) =>
    left.version.localeCompare(right.version) || left.id.localeCompare(right.id));
}

function resourceAuthorityByTeachingResourceId(rows: RemediationResourceRow[]): Map<string, ResourceNode> {
  const registry = buildResourceNodeRegistryFromTeachingResources(
    rows,
    getAllRegisteredResourceMetadata(),
  );
  return new Map(registry.nodes
    .filter((node) => node.sourceKind === 'teaching_resource')
    .map((node) => [node.sourceRef, node]));
}

function selectMinimalResourceSet(
  resources: GovernedRemediationResource[],
  validationMinutes: number,
): GovernedRemediationResource[] | null {
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

export function listGovernedRemediationResources(input: {
  rows: RemediationResourceRow[];
  knowledgeNodeId: string;
  misconceptionTag: string;
}): GovernedRemediationResource[] {
  const authorityById = resourceAuthorityByTeachingResourceId(input.rows);
  return orderedResources(input.rows
    .map((row) => parseResource(
      row,
      authorityById.get(row.id) ?? null,
      input.knowledgeNodeId,
      input.misconceptionTag,
    ))
    .filter((resource): resource is GovernedRemediationResource => resource !== null));
}

export function listGovernedRemediationValidationItems(input: {
  rows: RemediationValidationItemRow[];
  sourceQuestionId: string;
  knowledgeNodeId: string;
  misconceptionTag: string;
}): GovernedRemediationValidationItem[] {
  return orderedValidationItems(input.rows
    .map((row) => parseValidationItem(
      row,
      input.sourceQuestionId,
      input.knowledgeNodeId,
      input.misconceptionTag,
    ))
    .filter((item): item is GovernedRemediationValidationItem => item !== null));
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
  orchestratorVersion: string;
}): Promise<PersistedResultRow> {
  return input.db.remediationOrchestrationResult.upsert({
    where: {
      wrongAnswerAttributionId_orchestratorVersion: {
        wrongAnswerAttributionId: input.attribution.id,
        orchestratorVersion: input.orchestratorVersion,
      },
    },
    update: {},
    create: {
      wrongAnswerAttributionId: input.attribution.id,
      orchestratorVersion: input.orchestratorVersion,
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
    manualPracticePath: row.manualPracticePath === REMEDIATION_MANUAL_PRACTICE_PATH
      ? row.manualPracticePath
      : REMEDIATION_MANUAL_PRACTICE_PATH,
    createdAt: row.createdAt.toISOString(),
  };
}

function learnerTaskProjection(task: RemediationTaskSnapshot): RemediationTaskProjection {
  return {
    version: task.version,
    goal: task.goal,
    estimatedMinutes: task.estimatedMinutes,
    resources: task.resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      version: resource.version,
      estimatedMinutes: resource.estimatedMinutes,
      actionPath: resource.actionPath,
    })),
    validationQuestion: { ...task.validationQuestion },
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
    const registryId = nonEmptyString(resource?.registryId) ?? undefined;
    const actionId = nonEmptyString(resource?.actionId) ?? undefined;
    const actionVersion = nonEmptyString(resource?.actionVersion) ?? undefined;
    return id && title && version && minutes && actionPath
      ? {
        id,
        title,
        version,
        estimatedMinutes: minutes,
        actionPath,
        ...(registryId ? { registryId } : {}),
        ...(actionId ? { actionId } : {}),
        ...(actionVersion ? { actionVersion } : {}),
      }
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
    select: remediationResourceSelect(),
  });
  if (resources.length !== task.resources.length) return unavailableProjection(row, 'REFERENCE_DRIFT');
  const authorityById = resourceAuthorityByTeachingResourceId(resources);
  for (const stored of task.resources) {
    const current = resources.find((resource) => resource.id === stored.id);
    const authorityNode = authorityById.get(stored.id) ?? null;
    const parsed = current && parseResource(current, authorityNode, task.knowledgeNodeId, task.misconceptionTag);
    if (
      current?.teacherOnly ||
      (authorityNode && authorityNode.planningMetadata.privacyLevel !== 'student-visible')
    ) {
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
  if (record(validationMetadata)?.learnerVisible === false) {
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
    task: learnerTaskProjection(task),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function readAvailableRemediationInterventionSource(input: {
  db: RemediationOrchestrationDb;
  authenticatedUserId: string;
  resultId: string;
}): Promise<AvailableRemediationInterventionSource | null> {
  const row = await input.db.remediationOrchestrationResult.findFirst({
    where: {
      id: input.resultId,
      userId: input.authenticatedUserId,
    },
  });
  if (!row) return null;

  const attribution = await input.db.wrongAnswerAttribution.findFirst({
    where: {
      id: row.wrongAnswerAttributionId,
      userId: input.authenticatedUserId,
    },
    select: { id: true, userId: true, sessionId: true },
  });
  if (!attribution?.sessionId) return null;

  const projection = await projectResult(input.db, row);
  if (projection.status !== 'AVAILABLE') return null;
  const task = parseTaskSnapshot(row.taskSnapshot);
  if (!task) return null;

  return {
    remediationResultId: row.id,
    orchestratorVersion: row.orchestratorVersion,
    learnerSessionId: attribution.sessionId,
    task,
  };
}

export async function orchestrateRemediation(input: {
  db: RemediationOrchestrationDb;
  authenticatedUserId: string;
  attributionId: string;
}): Promise<RemediationOrchestrationProjection | null> {
  return orchestrateRemediationVersion({
    ...input,
    orchestratorVersion: REMEDIATION_ORCHESTRATOR_VERSION,
  });
}

export async function refreshRemediationOrchestration(input: {
  db: RemediationOrchestrationDb;
  authenticatedUserId: string;
  attributionId: string;
  refreshKey: string;
}): Promise<RemediationOrchestrationProjection | null> {
  const existing = await input.db.remediationOrchestrationResult.findFirst({
    where: {
      wrongAnswerAttributionId: input.attributionId,
      orchestratorVersion: REMEDIATION_ORCHESTRATOR_VERSION,
      userId: input.authenticatedUserId,
    },
  });
  if (!existing) return null;
  const projection = await projectResult(input.db, existing);
  if (projection.status !== 'UNAVAILABLE' || projection.unavailableReason !== 'REFERENCE_DRIFT') {
    return projection;
  }
  return orchestrateRemediationVersion({
    ...input,
    orchestratorVersion: `${REMEDIATION_ORCHESTRATOR_VERSION}:refresh:${input.refreshKey}`,
  });
}

async function orchestrateRemediationVersion(input: {
  db: RemediationOrchestrationDb;
  authenticatedUserId: string;
  attributionId: string;
  orchestratorVersion: string;
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
      orchestratorVersion: input.orchestratorVersion,
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
      orchestratorVersion: input.orchestratorVersion,
    }));
  }

  const knowledgeNodeId = attribution.knowledgeNodeIds[0];
  const misconceptionTag = attribution.misconceptionTags[0];
  const persistedKnowledgeNode = await input.db.knowledgeNode.findFirst({
    where: { id: knowledgeNodeId, isActive: true },
    select: { id: true, name: true, isActive: true },
  });
  const canonicalGraphNode = AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.find((node) => (
    node.id === knowledgeNodeId && node.status === 'active'
  ));
  const knowledgeNode = persistedKnowledgeNode ?? (canonicalGraphNode
    ? { id: canonicalGraphNode.id, name: canonicalGraphNode.title, isActive: true }
    : null);
  if (!knowledgeNode) {
    return unavailableProjection(await persistUnavailable({
      db: input.db,
      attribution,
      reason: 'RESOURCE_UNAVAILABLE',
      orchestratorVersion: input.orchestratorVersion,
    }));
  }

  const projectedResources = listMicroTutoringGovernedResources({
    knowledgeNodeId,
    misconceptionTag,
  });
  if (projectedResources.length === 0) {
    return unavailableProjection(await persistUnavailable({
      db: input.db,
      attribution,
      reason: 'RESOURCE_UNAVAILABLE',
      orchestratorVersion: input.orchestratorVersion,
    }));
  }
  const projectedKeys = new Set(projectedResources.flatMap((resource) => [resource.id, resource.registryId]));
  const resourceRows = await input.db.teachingResource.findMany({
    where: {
      teacherOnly: false,
      OR: [
        { knowledgeNodes: { some: { id: knowledgeNodeId } } },
        { config: { path: ['remediation', 'prerequisiteKnowledgeNodeIds'], array_contains: [knowledgeNodeId] } },
      ],
    },
    select: remediationResourceSelect(),
  });
  const matchingRows = resourceRows.filter((row) =>
    projectedKeys.has(row.id) || (row.registryId !== null && projectedKeys.has(row.registryId)));
  const resources = listGovernedRemediationResources({
    rows: matchingRows,
    knowledgeNodeId,
    misconceptionTag,
  });
  if (resources.length === 0) {
    return unavailableProjection(await persistUnavailable({
      db: input.db,
      attribution,
      reason: 'RESOURCE_UNAVAILABLE',
      orchestratorVersion: input.orchestratorVersion,
    }));
  }

  const validationRows = await input.db.adaptiveAssessmentItemRef.findMany({
    where: {
      NOT: { questionId: attribution.questionId },
      metadata: {
        path: ['adaptiveAssessmentItemRef', 'semanticRefs', 'graphNodeIds'],
        array_contains: [knowledgeNodeId],
      },
    },
    select: { id: true, questionId: true, contentHash: true, metadata: true },
  });
  const validations = listGovernedRemediationValidationItems({
    rows: validationRows,
    sourceQuestionId: attribution.questionId,
    knowledgeNodeId,
    misconceptionTag,
  });
  if (validations.length === 0) {
    return unavailableProjection(await persistUnavailable({
      db: input.db,
      attribution,
      reason: 'VALIDATION_QUESTION_UNAVAILABLE',
      orchestratorVersion: input.orchestratorVersion,
    }));
  }

  let selection: {
    resources: GovernedRemediationResource[];
    validation: GovernedRemediationValidationItem;
  } | null = null;
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
      orchestratorVersion: input.orchestratorVersion,
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
    resources: selection.resources.map(({ tier: _tier, ...resource }) => {
      const projected = projectedResources.find((candidate) =>
        candidate.registryId === resource.id || candidate.id === resource.id);
      return {
        ...resource,
        ...(projected ? {
          registryId: projected.registryId,
          actionId: projected.actionId,
          actionVersion: projected.actionVersion,
        } : {}),
      };
    }),
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
        orchestratorVersion: input.orchestratorVersion,
      },
    },
    update: {},
    create: {
      wrongAnswerAttributionId: attribution.id,
      orchestratorVersion: input.orchestratorVersion,
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
