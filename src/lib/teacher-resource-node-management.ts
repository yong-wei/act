import type {
  ResourceNode,
  ResourceNodeAvailability,
  ResourceNodeCognitiveLoad,
  ResourceNodePrivacyLevel,
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
}

export interface TeacherResourceNodePatch {
  displayName?: string;
  description?: string;
  planningMetadata?: {
    prerequisites?: string[];
    knowledgeCoverage?: string[];
    estimatedTimeMinutes?: number | null;
    cognitiveLoad?: ResourceNodeCognitiveLoad;
    availability?: ResourceNodeAvailability;
    teacherPolicy?: ResourceNodeTeacherPolicy;
    privacyLevel?: ResourceNodePrivacyLevel;
    pathEligible?: boolean;
  };
}

export interface TeacherResourceNodePersistablePatch {
  displayName?: string;
  description?: string;
  resourceNodePlanning: NonNullable<TeacherResourceNodePatch['planningMetadata']>;
}

export type TeacherResourceNodePatchResult =
  | {
      ok: true;
      status: 200;
      persistablePatch: TeacherResourceNodePersistablePatch;
    }
  | {
      ok: false;
      status: 400 | 403;
      code: 'IMMUTABLE_RESOURCE_NODE_FIELDS' | 'RESOURCE_NODE_FORBIDDEN' | 'UNSUPPORTED_RESOURCE_NODE_SOURCE';
      error: string;
      persistablePatch?: undefined;
    };

const IMMUTABLE_PATCH_FIELDS = [
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
];

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
    if (filters.pathEligibility === 'eligible' && !node.eligibility.pathEligible) return false;
    if (filters.pathEligibility === 'excluded' && node.eligibility.pathEligible) return false;
    return true;
  });
}

export function createTeacherResourceNodeView(
  node: ResourceNode,
  scope: TeacherResourceNodeScope,
): TeacherResourceNodeView {
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
    evidenceInstrumentationConfigured: node.planningMetadata.evidenceInstrumentation.length > 0,
    pathEligible: node.eligibility.pathEligible,
    pathExclusionReasons: [...node.eligibility.reasons],
    warnings: node.eligibility.auditIssues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      severity: issue.severity,
    })),
    editable: canEditNode(node, scope),
  };
}

export function buildTeacherResourceNodeManagementSummary(
  nodes: readonly ResourceNode[],
): TeacherResourceNodeSummary {
  return {
    totalNodes: nodes.length,
    pathEligibleNodes: nodes.filter((node) => node.eligibility.pathEligible).length,
    warningNodes: nodes.filter((node) => node.eligibility.auditIssues.length > 0).length,
    excludedNodes: nodes.filter((node) => !node.eligibility.pathEligible).length,
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

export function canReadNode(node: ResourceNode, scope: TeacherResourceNodeScope): boolean {
  if (scope.role === 'ADMIN') return true;
  return node.sourceRefs.some((source) => scope.readableSourceRefs.has(source.ref));
}

export function canEditNode(node: ResourceNode, scope: TeacherResourceNodeScope): boolean {
  if (scope.role === 'ADMIN') return true;
  return node.sourceKind === 'teaching_resource' && scope.editableSourceRefs.has(node.sourceRef);
}

function sanitizePlanningPatch(
  patch: NonNullable<TeacherResourceNodePatch['planningMetadata']>,
): NonNullable<TeacherResourceNodePatch['planningMetadata']> {
  const result: NonNullable<TeacherResourceNodePatch['planningMetadata']> = {};
  if (patch.prerequisites) result.prerequisites = uniqueSorted(patch.prerequisites);
  if (patch.knowledgeCoverage) result.knowledgeCoverage = uniqueSorted(patch.knowledgeCoverage);
  if (patch.estimatedTimeMinutes !== undefined) result.estimatedTimeMinutes = patch.estimatedTimeMinutes;
  if (patch.cognitiveLoad) result.cognitiveLoad = patch.cognitiveLoad;
  if (patch.availability) result.availability = patch.availability;
  if (patch.teacherPolicy) result.teacherPolicy = patch.teacherPolicy;
  if (patch.privacyLevel) result.privacyLevel = patch.privacyLevel;
  if (patch.pathEligible === false) result.teacherPolicy = 'blocked';
  if (patch.pathEligible === true) result.teacherPolicy = result.teacherPolicy === 'blocked'
    ? 'allowed'
    : result.teacherPolicy ?? 'allowed';
  return result;
}

function containsImmutablePatchField(patch: unknown): boolean {
  if (!patch || typeof patch !== 'object') return false;
  const record = patch as Record<string, unknown>;
  if (IMMUTABLE_PATCH_FIELDS.some((field) => field in record)) return true;
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

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}
