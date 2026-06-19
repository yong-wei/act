import type {
  ResourceNode,
  ResourceNodeAvailability,
  ResourceNodeCognitiveLoad,
  ResourceNodePrivacyLevel,
  ResourceNodeReadinessMetadata,
  ResourceNodeTeacherPolicy,
  ResourceNodeType,
} from './resource-node-registry';

export type TeacherResourceNodeRole = 'TEACHER' | 'ADMIN';
export type ResourceNodeKnowledgeMappingFilter = 'all' | 'mapped' | 'unmapped';
export type ResourceNodePathEligibilityFilter = 'all' | 'eligible' | 'excluded';

export interface TeacherResourceNodeScope {
  role: TeacherResourceNodeRole;
  teacherId: string;
  readableSourceRefs: ReadonlySet<string>;
  editableSourceRefs: ReadonlySet<string>;
}

export interface TeacherResourceNodeFilters {
  query?: string | null;
  nodeType?: ResourceNodeType | 'all' | null;
  courseModule?: string | null;
  knowledge?: string | null;
  knowledgeMapping?: ResourceNodeKnowledgeMappingFilter | null;
  availability?: ResourceNodeAvailability | 'all' | null;
  teacherPolicy?: ResourceNodeTeacherPolicy | 'all' | null;
  privacyLevel?: ResourceNodePrivacyLevel | 'all' | null;
  pathEligibility?: ResourceNodePathEligibilityFilter | null;
}

export interface TeacherResourceNodeWarningView {
  code: string;
  message: string;
  severity: 'blocking' | 'warning';
}

export interface TeacherResourceNodeAuditView {
  knowledgeCoveragePresent: boolean;
  capabilityMappingPresent: boolean;
  citationTargetReady: boolean;
  evidenceCapabilityConfigured: boolean;
  pathEligible: boolean;
  exclusionReasons: string[];
  sourceOwnership: {
    content: ResourceNode['sourceOfRecord']['content'];
    catalogMetadata: ResourceNode['sourceOfRecord']['catalogMetadata'];
    planningMetadata: ResourceNode['sourceOfRecord']['planningMetadata'];
  };
}

export interface TeacherResourceNodeView {
  id: string;
  title: string;
  description: string | null;
  type: ResourceNodeType;
  courseModule: string | null;
  sourceKind: ResourceNode['sourceKind'];
  sourceRefs: Array<{ kind: string; ref: string }>;
  renderTarget: string | null;
  launchTarget: string | null;
  knowledgeCoverage: string[];
  prerequisites: string[];
  estimatedTimeMinutes: number | null;
  cognitiveLoad: ResourceNodeCognitiveLoad;
  availability: ResourceNodeAvailability;
  teacherPolicy: ResourceNodeTeacherPolicy;
  privacyLevel: ResourceNodePrivacyLevel;
  readiness: ResourceNodeReadinessMetadata | null;
  audit: TeacherResourceNodeAuditView;
  evidenceInstrumentationConfigured: boolean;
  pathEligible: boolean;
  pathExclusionReasons: string[];
  warnings: TeacherResourceNodeWarningView[];
  editable: boolean;
}

export interface TeacherResourceNodeSummary {
  totalNodes: number;
  pathEligibleNodes: number;
  warningNodes: number;
  excludedNodes: number;
  mappedNodes: number;
  unmappedNodes: number;
  capabilityMappedNodes: number;
  citationReadyNodes: number;
  evidenceCapabilityNodes: number;
  blockedNodes: number;
}

export interface TeacherResourceNodeBulkPatchInput {
  nodes: readonly ResourceNode[];
  scope: TeacherResourceNodeScope;
  patch: TeacherResourceNodePatch;
  nodeIds: string[];
  reason: string;
  maxBatchSize?: number;
}

export interface TeacherResourceNodeBulkPatchResult {
  requestedCount: number;
  updatedCount: number;
  rejectedCount: number;
  reason: string;
  results: Array<{
    nodeId: string;
    ok: boolean;
    status: 200 | 400 | 403 | 404;
    code?: TeacherResourceNodePatchErrorCode;
    error?: string;
    persistablePatch?: TeacherResourceNodePersistablePatch;
  }>;
}

export interface TeacherResourceNodeOperationsReadiness {
  bulkMappingEnabled: boolean;
  policyReviewRequiredCount: number;
  coverage: {
    totalNodes: number;
    mappedNodes: number;
    pathEligibleNodes: number;
    coverageRatio: number;
  };
  systemIssues: TeacherResourceNodeWarningView[];
}

export interface TeacherResourceNodePatch {
  displayName?: string;
  description?: string;
  planningMetadata?: unknown;
}

interface TeacherResourceNodePlanningPatch {
    prerequisites?: string[];
    knowledgeCoverage?: string[];
    estimatedTimeMinutes?: number | null;
    cognitiveLoad?: ResourceNodeCognitiveLoad;
    availability?: ResourceNodeAvailability;
    teacherPolicy?: ResourceNodeTeacherPolicy;
    privacyLevel?: ResourceNodePrivacyLevel;
    readiness?: unknown;
    pathEligible?: boolean;
}

export interface TeacherResourceNodePersistablePatch {
  displayName?: string;
  description?: string;
  resourceNodePlanning: TeacherResourceNodePlanningPatch;
}

export type TeacherResourceNodePatchErrorCode =
  | 'IMMUTABLE_RESOURCE_NODE_FIELDS'
  | 'RESOURCE_NODE_FORBIDDEN'
  | 'UNSUPPORTED_RESOURCE_NODE_SOURCE';

export type TeacherResourceNodePatchResult =
  | {
      ok: true;
      status: 200;
      persistablePatch: TeacherResourceNodePersistablePatch;
    }
  | {
      ok: false;
      status: 400 | 403;
      code: TeacherResourceNodePatchErrorCode;
      error: string;
      persistablePatch?: undefined;
    };

export const TEACHER_RESOURCE_NODE_PERMITTED_EDIT_FIELDS = [
  'displayName',
  'description',
  'planningMetadata.prerequisites',
  'planningMetadata.knowledgeCoverage',
  'planningMetadata.estimatedTimeMinutes',
  'planningMetadata.cognitiveLoad',
  'planningMetadata.availability',
  'planningMetadata.teacherPolicy',
  'planningMetadata.privacyLevel',
  'planningMetadata.readiness',
  'planningMetadata.pathEligible',
] as const;

export const TEACHER_RESOURCE_NODE_IMMUTABLE_FIELDS = [
  'id',
  'sourceKind',
  'sourceRef',
  'sourceRefs',
  'sourceOfRecord',
  'eligibility',
  'evidenceInstrumentation',
  'abilityImpact',
  'terminalConstraints',
  'hiddenEvaluationInternals',
  'privateLearnerEvidence',
  'konlingMemory',
  'protocolVersion',
] as const;

const IMMUTABLE_PLANNING_FIELDS = [
  'evidenceInstrumentation',
  'abilityImpact',
  'terminalConstraints',
];

export function filterTeacherResourceNodes(
  nodes: readonly ResourceNode[],
  filters: TeacherResourceNodeFilters = {},
): ResourceNode[] {
  const query = filters.query?.trim().toLowerCase();
  const courseModule = filters.courseModule?.trim().toLowerCase();
  const knowledge = filters.knowledge?.trim().toLowerCase();

  return nodes.filter((node) => {
    if (query && !textMatchesNode(node, query)) return false;
    if (filters.nodeType && filters.nodeType !== 'all' && node.type !== filters.nodeType) return false;
    if (courseModule && !node.courseModule?.toLowerCase().includes(courseModule)) return false;
    if (knowledge && !node.planningMetadata.knowledgeCoverage.some((item) => item.toLowerCase().includes(knowledge))) {
      return false;
    }
    if (filters.knowledgeMapping === 'mapped' && node.planningMetadata.knowledgeCoverage.length === 0) return false;
    if (filters.knowledgeMapping === 'unmapped' && node.planningMetadata.knowledgeCoverage.length > 0) return false;
    if (filters.availability && filters.availability !== 'all' && node.planningMetadata.availability !== filters.availability) {
      return false;
    }
    if (filters.teacherPolicy && filters.teacherPolicy !== 'all' && node.planningMetadata.teacherPolicy !== filters.teacherPolicy) {
      return false;
    }
    if (filters.privacyLevel && filters.privacyLevel !== 'all' && node.planningMetadata.privacyLevel !== filters.privacyLevel) {
      return false;
    }
    if (filters.pathEligibility === 'eligible' && !buildTeacherResourceNodeAudit(node).pathEligible) return false;
    if (filters.pathEligibility === 'excluded' && buildTeacherResourceNodeAudit(node).pathEligible) return false;
    return true;
  });
}

export function createTeacherResourceNodeView(
  node: ResourceNode,
  scope: TeacherResourceNodeScope,
): TeacherResourceNodeView {
  const audit = buildTeacherResourceNodeAudit(node);
  return {
    id: node.id,
    title: node.title,
    description: node.description,
    type: node.type,
    courseModule: node.courseModule,
    sourceKind: node.sourceKind,
    sourceRefs: node.sourceRefs.map((source) => ({ kind: source.kind, ref: source.ref })),
    renderTarget: node.renderTarget,
    launchTarget: node.launchTarget,
    knowledgeCoverage: [...node.planningMetadata.knowledgeCoverage],
    prerequisites: [...node.planningMetadata.prerequisites],
    estimatedTimeMinutes: node.planningMetadata.estimatedTimeMinutes,
    cognitiveLoad: node.planningMetadata.cognitiveLoad,
    availability: node.planningMetadata.availability,
    teacherPolicy: node.planningMetadata.teacherPolicy,
    privacyLevel: node.planningMetadata.privacyLevel,
    readiness: copyReadinessMetadata(node.planningMetadata.readiness),
    audit,
    evidenceInstrumentationConfigured: node.planningMetadata.evidenceInstrumentation.length > 0,
    pathEligible: node.eligibility.pathEligible,
    pathExclusionReasons: [...node.eligibility.reasons],
    warnings: buildTeacherResourceNodeAuditWarnings(node, audit),
    editable: canEditNode(node, scope),
  };
}

export function buildTeacherResourceNodeManagementSummary(
  nodes: readonly ResourceNode[],
): TeacherResourceNodeSummary {
  return {
    totalNodes: nodes.length,
    pathEligibleNodes: nodes.filter((node) => buildTeacherResourceNodeAudit(node).pathEligible).length,
    warningNodes: nodes.filter((node) => buildTeacherResourceNodeAuditWarnings(node, buildTeacherResourceNodeAudit(node)).length > 0).length,
    excludedNodes: nodes.filter((node) => !buildTeacherResourceNodeAudit(node).pathEligible).length,
    mappedNodes: nodes.filter((node) => node.planningMetadata.knowledgeCoverage.length > 0).length,
    unmappedNodes: nodes.filter((node) => node.planningMetadata.knowledgeCoverage.length === 0).length,
    capabilityMappedNodes: nodes.filter((node) => Object.keys(node.planningMetadata.abilityImpact).length > 0).length,
    citationReadyNodes: nodes.filter(hasCitationTarget).length,
    evidenceCapabilityNodes: nodes.filter((node) => node.planningMetadata.evidenceInstrumentation.length > 0).length,
    blockedNodes: nodes.filter((node) => !buildTeacherResourceNodeAudit(node).pathEligible).length,
  };
}

export function applyTeacherResourceNodePatch(input: {
  node: ResourceNode;
  scope: TeacherResourceNodeScope;
  patch: TeacherResourceNodePatch;
}): TeacherResourceNodePatchResult {
  if (containsImmutablePatchField(input.patch)) {
    return {
      ok: false,
      status: 400,
      code: 'IMMUTABLE_RESOURCE_NODE_FIELDS',
      error: 'ResourceNode 系统字段、私有证据或隐藏评测字段不可修改。',
    };
  }

  if (!canEditNode(input.node, input.scope)) {
    return {
      ok: false,
      status: 403,
      code: 'RESOURCE_NODE_FORBIDDEN',
      error: '资源不存在或无权管理。',
    };
  }

  if (input.node.sourceKind !== 'teaching_resource') {
    return {
      ok: false,
      status: 400,
      code: 'UNSUPPORTED_RESOURCE_NODE_SOURCE',
      error: '当前阶段仅支持 TeachingResource 来源节点的规划元数据编辑。',
    };
  }

  const planningMetadata = sanitizePlanningPatch(input.patch.planningMetadata ?? {});
  return {
    ok: true,
    status: 200,
    persistablePatch: {
      ...(input.patch.displayName !== undefined ? { displayName: input.patch.displayName } : {}),
      ...(input.patch.description !== undefined ? { description: input.patch.description } : {}),
      resourceNodePlanning: planningMetadata,
    },
  };
}

export function applyTeacherResourceNodeBulkPatch(
  input: TeacherResourceNodeBulkPatchInput,
): TeacherResourceNodeBulkPatchResult {
  const maxBatchSize = input.maxBatchSize ?? 50;
  const requestedIds = uniqueSorted(input.nodeIds).slice(0, maxBatchSize);
  const nodesById = new Map(input.nodes.map((node) => [node.id, node]));
  const results: TeacherResourceNodeBulkPatchResult['results'] = requestedIds.map((nodeId) => {
    const node = nodesById.get(nodeId);
    if (!node) {
      return {
        nodeId,
        ok: false,
        status: 404,
        code: 'RESOURCE_NODE_FORBIDDEN',
        error: '资源不存在或无权管理。',
      };
    }
    const result = applyTeacherResourceNodePatch({
      node,
      scope: input.scope,
      patch: input.patch,
    });
    return result.ok
      ? {
          nodeId,
          ok: true,
          status: result.status,
          persistablePatch: result.persistablePatch,
        }
      : {
          nodeId,
          ok: false,
          status: result.status,
          code: result.code,
          error: result.error,
        };
  });

  return {
    requestedCount: input.nodeIds.length,
    updatedCount: results.filter((item) => item.ok).length,
    rejectedCount: results.filter((item) => !item.ok).length + Math.max(0, input.nodeIds.length - requestedIds.length),
    reason: input.reason,
    results,
  };
}

export function buildTeacherResourceNodeOperationsReadiness(
  nodes: readonly ResourceNode[],
  options: { bulkMappingEnabled?: boolean } = {},
): TeacherResourceNodeOperationsReadiness {
  const mappedNodes = nodes.filter((node) => node.planningMetadata.knowledgeCoverage.length > 0).length;
  const totalNodes = nodes.length;
  const auditByNodeId = new Map(nodes.map((node) => [node.id, buildTeacherResourceNodeAudit(node)]));
  const warningsByNodeId = new Map(nodes.map((node) => [
    node.id,
    buildTeacherResourceNodeAuditWarnings(node, auditByNodeId.get(node.id)!),
  ]));
  const policyReviewRequired = nodes.filter((node) =>
    node.planningMetadata.teacherPolicy === 'blocked' ||
    node.planningMetadata.teacherPolicy === 'teacher-only' ||
    warningsByNodeId.get(node.id)!.some((issue) => issue.severity === 'blocking')
  );
  const systemIssues = nodes.flatMap((node) =>
    warningsByNodeId.get(node.id)!.map((issue) => ({
      code: `${node.id}:${issue.code}`,
      message: issue.message,
      severity: issue.severity,
    }))
  );

  return {
    bulkMappingEnabled: options.bulkMappingEnabled === true,
    policyReviewRequiredCount: policyReviewRequired.length,
    coverage: {
      totalNodes,
      mappedNodes,
      pathEligibleNodes: nodes.filter((node) => auditByNodeId.get(node.id)!.pathEligible).length,
      coverageRatio: totalNodes > 0 ? round(mappedNodes / totalNodes, 4) : 0,
    },
    systemIssues,
  };
}

export function canReadNode(node: ResourceNode, scope: TeacherResourceNodeScope): boolean {
  if (scope.role === 'ADMIN') return true;
  return node.sourceRefs.some((source) => scope.readableSourceRefs.has(source.ref));
}

export function canEditNode(node: ResourceNode, scope: TeacherResourceNodeScope): boolean {
  if (scope.role === 'ADMIN') return true;
  return node.sourceKind === 'teaching_resource' && scope.editableSourceRefs.has(node.sourceRef);
}

function sanitizePlanningPatch(
  patch: unknown,
): TeacherResourceNodePlanningPatch {
  const result: TeacherResourceNodePlanningPatch = {};
  if (!isRecord(patch)) return result;
  if (Array.isArray(patch.prerequisites)) result.prerequisites = uniqueSorted(patch.prerequisites.filter(isString));
  if (Array.isArray(patch.knowledgeCoverage)) result.knowledgeCoverage = uniqueSorted(patch.knowledgeCoverage.filter(isString));
  if (typeof patch.estimatedTimeMinutes === 'number' || patch.estimatedTimeMinutes === null) {
    result.estimatedTimeMinutes = patch.estimatedTimeMinutes;
  }
  if (patch.cognitiveLoad === 'low' || patch.cognitiveLoad === 'medium' || patch.cognitiveLoad === 'high') {
    result.cognitiveLoad = patch.cognitiveLoad;
  }
  if (
    patch.availability === 'available' ||
    patch.availability === 'draft' ||
    patch.availability === 'archived' ||
    patch.availability === 'teacher_only'
  ) {
    result.availability = patch.availability;
  }
  if (
    patch.teacherPolicy === 'allowed' ||
    patch.teacherPolicy === 'teacher-assigned' ||
    patch.teacherPolicy === 'teacher-only' ||
    patch.teacherPolicy === 'blocked'
  ) {
    result.teacherPolicy = patch.teacherPolicy;
  }
  if (
    patch.privacyLevel === 'student-visible' ||
    patch.privacyLevel === 'teacher-scoped' ||
    patch.privacyLevel === 'admin-scoped'
  ) {
    result.privacyLevel = patch.privacyLevel;
  }
  if ('readiness' in patch) result.readiness = sanitizeReadinessPatch(patch.readiness);
  if (patch.pathEligible === false) result.teacherPolicy = 'blocked';
  if (patch.pathEligible === true) result.teacherPolicy = result.teacherPolicy === 'blocked'
    ? 'allowed'
    : result.teacherPolicy ?? 'allowed';
  return result;
}

function containsImmutablePatchField(patch: unknown): boolean {
  if (!patch || typeof patch !== 'object') return false;
  const record = patch as Record<string, unknown>;
  if (TEACHER_RESOURCE_NODE_IMMUTABLE_FIELDS.some((field) => field in record)) return true;
  const planning = record.planningMetadata;
  if (!planning || typeof planning !== 'object' || Array.isArray(planning)) return false;
  const planningRecord = planning as Record<string, unknown>;
  return IMMUTABLE_PLANNING_FIELDS.some((field) => field in planningRecord);
}

function textMatchesNode(node: ResourceNode, query: string): boolean {
  const haystack = [
    node.id,
    node.title,
    node.type,
    node.courseModule ?? '',
    node.sourceKind,
    node.sourceRef,
    ...node.sourceRefs.flatMap((source) => [source.kind, source.ref]),
    ...node.planningMetadata.knowledgeCoverage,
  ].join(' ').toLowerCase();
  return haystack.includes(query);
}

function buildTeacherResourceNodeAudit(node: ResourceNode): TeacherResourceNodeAuditView {
  const knowledgeCoveragePresent = node.planningMetadata.knowledgeCoverage.length > 0;
  const capabilityMappingPresent = Object.keys(node.planningMetadata.abilityImpact).length > 0;
  const citationTargetReady = hasCitationTarget(node);
  const evidenceCapabilityConfigured = node.planningMetadata.evidenceInstrumentation.length > 0;
  const exclusionReasons = uniqueSorted([
    ...node.eligibility.reasons,
    ...(!capabilityMappingPresent ? ['missing-capability-mapping'] : []),
    ...(!evidenceCapabilityConfigured ? ['missing-evidence-instrumentation'] : []),
  ]);
  return {
    knowledgeCoveragePresent,
    capabilityMappingPresent,
    citationTargetReady,
    evidenceCapabilityConfigured,
    pathEligible: node.eligibility.pathEligible && capabilityMappingPresent && evidenceCapabilityConfigured,
    exclusionReasons,
    sourceOwnership: {
      content: node.sourceOfRecord.content,
      catalogMetadata: node.sourceOfRecord.catalogMetadata,
      planningMetadata: node.sourceOfRecord.planningMetadata,
    },
  };
}

function buildTeacherResourceNodeAuditWarnings(
  node: ResourceNode,
  audit: TeacherResourceNodeAuditView,
): TeacherResourceNodeWarningView[] {
  const warnings: TeacherResourceNodeWarningView[] = node.eligibility.auditIssues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
  }));
  if (!audit.capabilityMappingPresent && !warnings.some((warning) => warning.code === 'missing-capability-mapping')) {
    warnings.push({
      code: 'missing-capability-mapping',
      message: 'ResourceNode has no capability target mapping for high-confidence path planning.',
      severity: 'blocking',
    });
  }
  const evidenceWarning = warnings.find((warning) => warning.code === 'missing-evidence-instrumentation');
  if (evidenceWarning) {
    evidenceWarning.severity = 'blocking';
  } else if (!audit.evidenceCapabilityConfigured) {
    warnings.push({
      code: 'missing-evidence-instrumentation',
      message: 'ResourceNode has no evidence instrumentation mapping.',
      severity: 'blocking',
    });
  }
  return warnings;
}

function hasCitationTarget(node: ResourceNode): boolean {
  return Boolean(node.launchTarget || node.renderTarget);
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function copyReadinessMetadata(readiness: ResourceNodeReadinessMetadata | null): ResourceNodeReadinessMetadata | null {
  if (!readiness) return null;
  return {
    minimumCompetency: { ...readiness.minimumCompetency },
    minimumEvidenceCount: readiness.minimumEvidenceCount,
    requiredCompletedNodeIds: [...readiness.requiredCompletedNodeIds],
    requiredOutcomeRefs: [...readiness.requiredOutcomeRefs],
    unlockMessage: readiness.unlockMessage,
    fallbackNodeIds: [...readiness.fallbackNodeIds],
  };
}

function sanitizeReadinessPatch(
  readiness: unknown,
): ResourceNodeReadinessMetadata | null {
  if (!readiness || typeof readiness !== 'object' || Array.isArray(readiness)) return null;
  const record = readiness as Record<string, unknown>;
  const minimumCompetency = Object.fromEntries(
    Object.entries(isRecord(record.minimumCompetency) ? record.minimumCompetency : {})
      .filter((entry): entry is [string, number] => entry[0].trim().length > 0 && Number.isFinite(entry[1]))
      .map(([key, value]): [string, number] => [key.trim(), Math.max(0, Math.min(1, value))])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const minimumEvidenceCount = typeof record.minimumEvidenceCount === 'number' && Number.isFinite(record.minimumEvidenceCount)
    ? Math.max(0, record.minimumEvidenceCount)
    : 0;
  const requiredCompletedNodeIds = uniqueSorted(readStringArray(record.requiredCompletedNodeIds));
  const requiredOutcomeRefs = uniqueSorted(readStringArray(record.requiredOutcomeRefs));
  const fallbackNodeIds = uniqueSorted(readStringArray(record.fallbackNodeIds));
  const hasGate = Object.keys(minimumCompetency).length > 0 ||
    minimumEvidenceCount > 0 ||
    requiredCompletedNodeIds.length > 0 ||
    requiredOutcomeRefs.length > 0;
  if (!hasGate) return null;
  const unlockMessage = typeof record.unlockMessage === 'string' && record.unlockMessage.trim().length > 0
    ? record.unlockMessage.trim()
    : '完成准备节点后会自动解锁。';
  return {
    minimumCompetency,
    minimumEvidenceCount,
    requiredCompletedNodeIds,
    requiredOutcomeRefs,
    unlockMessage,
    fallbackNodeIds,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
