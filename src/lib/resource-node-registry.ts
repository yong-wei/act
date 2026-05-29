export const RESOURCE_NODE_TYPES = [
  'lesson_step',
  'knowledge_node',
  'knowledge_card',
  'video',
  'audio',
  'handout',
  'quiz',
  'simulation',
  'arena_task',
  'reflection',
  'ai_intervention',
  'project',
] as const;

export type ResourceNodeType = typeof RESOURCE_NODE_TYPES[number];

export type ResourceNodeSourceKind =
  | 'teaching_resource'
  | 'resource_registry'
  | 'knowledge_graph'
  | 'runtime_lesson_step'
  | 'runtime_lesson_media'
  | 'runtime_handout'
  | 'simulation_resource'
  | 'arena_task'
  | 'reflection_prompt'
  | 'ai_intervention'
  | 'project';

export type ResourceNodeEdgeKind =
  | 'prerequisite'
  | 'remedial'
  | 'extension'
  | 'alternative'
  | 'related';

export type ResourceNodeAvailability = 'available' | 'draft' | 'archived' | 'teacher_only';
export type ResourceNodePrivacyLevel = 'student-visible' | 'teacher-scoped' | 'admin-scoped';
export type ResourceNodeTeacherPolicy = 'allowed' | 'teacher-assigned' | 'teacher-only' | 'blocked';
export type ResourceNodeCognitiveLoad = 'low' | 'medium' | 'high';
export type ResourceNodeSourceOwner =
  | 'TeachingResource'
  | 'runtime_lesson_media'
  | 'resource_registry'
  | 'knowledge_graph'
  | 'simulation'
  | 'arena'
  | 'ResourceNode';

export interface ResourceNodeSourceReference {
  kind: ResourceNodeSourceKind;
  ref: string;
}

export interface ResourceNodePlanningMetadata {
  prerequisites: string[];
  estimatedTimeMinutes: number | null;
  cognitiveLoad: ResourceNodeCognitiveLoad;
  knowledgeCoverage: string[];
  abilityImpact: Record<string, number>;
  cost: {
    effort: 'low' | 'medium' | 'high';
    requiresTeacherReview: boolean;
  };
  availability: ResourceNodeAvailability;
  teacherPolicy: ResourceNodeTeacherPolicy;
  privacyLevel: ResourceNodePrivacyLevel;
  terminalConstraints: string[];
  evidenceInstrumentation: string[];
}

export interface ResourceNodeAuditIssue {
  code:
    | 'missing-render-or-launch-target'
    | 'missing-knowledge-mapping'
    | 'invalid-prerequisite'
    | 'unavailable-resource'
    | 'teacher-policy-blocked'
    | 'missing-privacy-policy'
    | 'missing-evidence-instrumentation';
  message: string;
  severity: 'blocking' | 'warning';
}

export interface ResourceNodeEligibility {
  pathEligible: boolean;
  reasons: string[];
  auditIssues: ResourceNodeAuditIssue[];
}

export interface ResourceNodeSourceOfRecord {
  content: ResourceNodeSourceOwner;
  catalogMetadata: ResourceNodeSourceOwner;
  planningMetadata: 'ResourceNode';
}

export interface ResourceNode {
  id: string;
  title: string;
  description: string | null;
  type: ResourceNodeType;
  courseModule: string | null;
  sourceKind: ResourceNodeSourceKind;
  sourceRef: string;
  sourceRefs: ResourceNodeSourceReference[];
  renderTarget: string | null;
  launchTarget: string | null;
  planningMetadata: ResourceNodePlanningMetadata;
  sourceOfRecord: ResourceNodeSourceOfRecord;
  eligibility: ResourceNodeEligibility;
}

export interface ResourceNodeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  kind: ResourceNodeEdgeKind;
  source: 'declared-prerequisite' | 'knowledge-link' | 'manual';
}

export interface ResourceNodeRegistry {
  nodes: ResourceNode[];
  edges: ResourceNodeEdge[];
  supportedTypes: readonly ResourceNodeType[];
  audit: {
    totalNodes: number;
    pathEligibleNodes: number;
    ineligibleNodes: Array<Pick<ResourceNode, 'id' | 'title' | 'type'> & { reasons: string[] }>;
  };
}

export interface TeachingResourceNodeInput {
  id: string;
  title: string;
  displayName?: string | null;
  description?: string | null;
  type: string;
  registryId?: string | null;
  content?: string | null;
  category?: string | null;
  teacherOnly?: boolean | null;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
  config?: Record<string, unknown> | null;
}

export type ResourceNodePlanningOverride = Partial<Pick<
  ResourceNodePlanningMetadata,
  | 'prerequisites'
  | 'estimatedTimeMinutes'
  | 'cognitiveLoad'
  | 'knowledgeCoverage'
  | 'availability'
  | 'teacherPolicy'
  | 'privacyLevel'
>>;

export interface RegisteredResourceNodeInput {
  id: string;
  label: string;
  type: 'INTERACTIVE_COMP' | 'SIMULATION_APP' | string;
  renderTarget?: string | null;
  launchTarget?: string | null;
  knowledgeNodeIds?: string[];
}

export interface KnowledgeNodeResourceInput {
  id: string;
  name: string;
  resources?: unknown[];
  tags?: string[];
}

export interface RuntimeLessonNodeInput {
  lessonId: string;
  title: string;
  steps?: Array<{
    id: string;
    title: string;
    knowledgeNodeIds?: string[];
    prerequisiteNodeIds?: string[];
    renderTarget?: string | null;
  }>;
  mediaResources?: Array<{
    id: string;
    title: string;
    kind: 'video' | 'audio' | 'pdf' | 'other' | string;
    url?: string | null;
    filename?: string | null;
    teachingResourceId?: string | null;
  }>;
  handoutPath?: string | null;
  handoutPdfPath?: string | null;
}

export interface SimulationResourceNodeInput {
  id: string;
  title: string;
  launchTarget: string;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
}

export interface ArenaTaskResourceNodeInput {
  id: string;
  title: string;
  launchTarget: string;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
  official?: boolean;
}

export interface LightweightResourceNodeInput {
  id: string;
  title: string;
  sourceRef?: string;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
  launchTarget?: string | null;
  renderTarget?: string | null;
  teacherOnly?: boolean;
}

export interface ResourceNodeRegistryInput {
  teachingResources?: TeachingResourceNodeInput[];
  registeredResources?: RegisteredResourceNodeInput[];
  knowledgeNodes?: KnowledgeNodeResourceInput[];
  runtimeLessons?: RuntimeLessonNodeInput[];
  simulations?: SimulationResourceNodeInput[];
  arenaTasks?: ArenaTaskResourceNodeInput[];
  reflectionPrompts?: LightweightResourceNodeInput[];
  aiInterventions?: LightweightResourceNodeInput[];
  projects?: LightweightResourceNodeInput[];
}

export function buildResourceNodeRegistry(input: ResourceNodeRegistryInput): ResourceNodeRegistry {
  const nodeCandidates = [
    ...buildTeachingResourceNodes(input.teachingResources ?? []),
    ...buildRegisteredResourceNodes(input.registeredResources ?? []),
    ...buildKnowledgeResourceNodes(input.knowledgeNodes ?? []),
    ...buildRuntimeLessonNodes(input.runtimeLessons ?? []),
    ...buildSimulationNodes(input.simulations ?? []),
    ...buildArenaTaskNodes(input.arenaTasks ?? []),
    ...buildLightweightNodes(input.reflectionPrompts ?? [], 'reflection', 'reflection_prompt'),
    ...buildLightweightNodes(input.aiInterventions ?? [], 'ai_intervention', 'ai_intervention'),
    ...buildLightweightNodes(input.projects ?? [], 'project', 'project'),
  ];
  const nodesById = mergeOverlappingSources(nodeCandidates);
  const edges = buildResourceNodeEdges(nodesById);
  const auditedNodes = Array.from(nodesById.values())
    .map((node) => ({ ...node, eligibility: auditResourceNode(node, nodesById) }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    nodes: auditedNodes,
    edges,
    supportedTypes: RESOURCE_NODE_TYPES,
    audit: {
      totalNodes: auditedNodes.length,
      pathEligibleNodes: auditedNodes.filter((node) => node.eligibility.pathEligible).length,
      ineligibleNodes: auditedNodes
        .filter((node) => !node.eligibility.pathEligible)
        .map((node) => ({
          id: node.id,
          title: node.title,
          type: node.type,
          reasons: node.eligibility.reasons,
        })),
    },
  };
}

export function auditResourceNode(
  node: ResourceNode,
  nodesById: Map<string, ResourceNode> = new Map([[node.id, node]]),
): ResourceNodeEligibility {
  const issues: ResourceNodeAuditIssue[] = [];
  if (!node.renderTarget && !node.launchTarget) {
    issues.push({
      code: 'missing-render-or-launch-target',
      severity: 'blocking',
      message: 'ResourceNode lacks a render target or launch target.',
    });
  }
  if (node.planningMetadata.knowledgeCoverage.length === 0) {
    issues.push({
      code: 'missing-knowledge-mapping',
      severity: 'blocking',
      message: 'ResourceNode has no knowledge mapping for path planning.',
    });
  }
  const invalidPrerequisites = node.planningMetadata.prerequisites.filter((id) => !nodesById.has(id));
  if (invalidPrerequisites.length > 0) {
    issues.push({
      code: 'invalid-prerequisite',
      severity: 'blocking',
      message: `ResourceNode references missing prerequisites: ${invalidPrerequisites.join(', ')}`,
    });
  }
  if (node.planningMetadata.availability !== 'available') {
    issues.push({
      code: 'unavailable-resource',
      severity: 'blocking',
      message: `ResourceNode availability is ${node.planningMetadata.availability}.`,
    });
  }
  if (node.planningMetadata.teacherPolicy === 'blocked') {
    issues.push({
      code: 'teacher-policy-blocked',
      severity: 'blocking',
      message: 'ResourceNode is excluded by teacher policy.',
    });
  }
  if (!node.planningMetadata.privacyLevel) {
    issues.push({
      code: 'missing-privacy-policy',
      severity: 'blocking',
      message: 'ResourceNode has no privacy policy.',
    });
  }
  if (node.planningMetadata.evidenceInstrumentation.length === 0) {
    issues.push({
      code: 'missing-evidence-instrumentation',
      severity: 'warning',
      message: 'ResourceNode has no evidence instrumentation mapping.',
    });
  }

  const blockingIssues = issues.filter((issue) => issue.severity === 'blocking');
  return {
    pathEligible: blockingIssues.length === 0,
    reasons: issues.map((issue) => issue.code),
    auditIssues: issues,
  };
}

function buildTeachingResourceNodes(resources: TeachingResourceNodeInput[]): ResourceNode[] {
  return resources.map((resource) => {
    const planningOverride = parsePlanningOverride(resource.config);
    const registryLaunch = resource.registryId ? `/interactive-learning/resources/${resource.id}` : null;
    const contentRender = resource.content ? `/interactive-learning/resources/${resource.id}` : null;
    const nodeType = resource.type === 'STATIC_MEDIA'
      ? inferMediaNodeType(resource.content ?? resource.title)
      : resource.type === 'SIMULATION_APP'
        ? 'simulation'
        : resource.type === 'INTERACTIVE_COMP'
          ? inferRegisteredNodeType(resource.registryId ?? resource.title)
          : 'lesson_step';
    return createNode({
      id: `teaching-resource:${resource.id}`,
      title: resource.displayName ?? resource.title,
      description: resource.description ?? null,
      type: nodeType,
      courseModule: resource.category ?? null,
      sourceKind: 'teaching_resource',
      sourceRef: resource.id,
      sourceRefs: [
        { kind: 'teaching_resource', ref: resource.id },
        ...(resource.registryId ? [{ kind: 'resource_registry' as const, ref: resource.registryId }] : []),
      ],
      renderTarget: contentRender,
      launchTarget: registryLaunch,
      knowledgeCoverage: resource.knowledgeNodeIds ?? [],
      sourceOfRecord: {
        content: 'TeachingResource',
        catalogMetadata: 'TeachingResource',
        planningMetadata: 'ResourceNode',
      },
      teacherOnly: Boolean(resource.teacherOnly),
      prerequisites: resource.prerequisiteNodeIds ?? [],
      evidenceInstrumentation: ['TeachingResource.interactionLogs'],
      planningOverride,
    });
  });
}

function buildRegisteredResourceNodes(resources: RegisteredResourceNodeInput[]): ResourceNode[] {
  return resources.map((resource) => createNode({
    id: `registry:${resource.id}`,
    title: resource.label,
    type: resource.type === 'SIMULATION_APP' ? 'simulation' : inferRegisteredNodeType(resource.id),
    sourceKind: 'resource_registry',
    sourceRef: resource.id,
    renderTarget: resource.renderTarget ?? null,
    launchTarget: resource.launchTarget ?? null,
    knowledgeCoverage: resource.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'resource_registry',
      catalogMetadata: 'resource_registry',
      planningMetadata: 'ResourceNode',
    },
    evidenceInstrumentation: ['InteractionLog'],
  }));
}

function buildKnowledgeResourceNodes(nodes: KnowledgeNodeResourceInput[]): ResourceNode[] {
  return nodes.flatMap((node) => [
    createNode({
      id: `knowledge-node:${node.id}`,
      title: node.name,
      courseModule: node.tags?.[0] ?? null,
      type: 'knowledge_node',
      sourceKind: 'knowledge_graph',
      sourceRef: node.id,
      renderTarget: null,
      knowledgeCoverage: [node.id],
      sourceOfRecord: {
        content: 'knowledge_graph',
        catalogMetadata: 'knowledge_graph',
        planningMetadata: 'ResourceNode',
      },
      evidenceInstrumentation: ['knowledge_graph_node_focus'],
    }),
    createNode({
      id: `knowledge-card:${node.id}`,
      title: `${node.name}知识卡`,
      courseModule: node.tags?.[0] ?? null,
      type: 'knowledge_card',
      sourceKind: 'knowledge_graph',
      sourceRef: `${node.id}:card`,
      renderTarget: null,
      knowledgeCoverage: [node.id],
      sourceOfRecord: {
        content: 'knowledge_graph',
        catalogMetadata: 'knowledge_graph',
        planningMetadata: 'ResourceNode',
      },
      evidenceInstrumentation: ['knowledge_card_open'],
    }),
  ]);
}

function buildRuntimeLessonNodes(lessons: RuntimeLessonNodeInput[]): ResourceNode[] {
  return lessons.flatMap((lesson) => {
    const nodes: ResourceNode[] = [];
    for (const step of lesson.steps ?? []) {
      nodes.push(createNode({
        id: `lesson-step:${lesson.lessonId}:${step.id}`,
        title: step.title,
        courseModule: lesson.lessonId,
        type: 'lesson_step',
        sourceKind: 'runtime_lesson_step',
        sourceRef: `${lesson.lessonId}:${step.id}`,
        renderTarget: step.renderTarget ?? null,
        knowledgeCoverage: step.knowledgeNodeIds ?? [],
        sourceOfRecord: {
          content: 'runtime_lesson_media',
          catalogMetadata: 'ResourceNode',
        planningMetadata: 'ResourceNode',
      },
      prerequisites: step.prerequisiteNodeIds ?? [],
      evidenceInstrumentation: ['lesson_submit', 'lesson_step_view'],
    }));
    }
    if (lesson.handoutPath || lesson.handoutPdfPath) {
      nodes.push(createNode({
        id: `runtime-handout:${lesson.lessonId}`,
        title: `${lesson.title}讲义`,
        courseModule: lesson.lessonId,
        type: 'handout',
        sourceKind: 'runtime_handout',
        sourceRef: lesson.lessonId,
        renderTarget: lesson.handoutPdfPath ?? lesson.handoutPath,
        knowledgeCoverage: collectLessonKnowledgeCoverage(lesson),
        sourceOfRecord: {
          content: 'runtime_lesson_media',
          catalogMetadata: 'runtime_lesson_media',
          planningMetadata: 'ResourceNode',
        },
        evidenceInstrumentation: ['runtime_handout_open'],
      }));
    }
    for (const media of lesson.mediaResources ?? []) {
      const sourceRefs: ResourceNodeSourceReference[] = [
        { kind: 'runtime_lesson_media', ref: `${lesson.lessonId}:${media.id}` },
      ];
      if (media.teachingResourceId) {
        sourceRefs.push({ kind: 'teaching_resource', ref: media.teachingResourceId });
      }
      nodes.push(createNode({
        id: `runtime-media:${lesson.lessonId}:${media.id}`,
        title: media.title,
        courseModule: lesson.lessonId,
        type: media.kind === 'video' || media.kind === 'audio' ? media.kind : 'handout',
        sourceKind: 'runtime_lesson_media',
        sourceRef: `${lesson.lessonId}:${media.id}`,
        sourceRefs,
        renderTarget: media.url,
        knowledgeCoverage: collectLessonKnowledgeCoverage(lesson),
        sourceOfRecord: {
          content: 'runtime_lesson_media',
          catalogMetadata: media.teachingResourceId ? 'TeachingResource' : 'runtime_lesson_media',
          planningMetadata: 'ResourceNode',
        },
        evidenceInstrumentation: [`runtime_media_${media.kind}`],
      }));
    }
    return nodes;
  });
}

function buildSimulationNodes(simulations: SimulationResourceNodeInput[]): ResourceNode[] {
  return simulations.map((simulation) => createNode({
    id: `simulation:${simulation.id}`,
    title: simulation.title,
    courseModule: null,
    type: 'simulation',
    sourceKind: 'simulation_resource',
    sourceRef: simulation.id,
    launchTarget: simulation.launchTarget,
    knowledgeCoverage: simulation.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'simulation',
      catalogMetadata: 'simulation',
      planningMetadata: 'ResourceNode',
    },
    prerequisites: simulation.prerequisiteNodeIds ?? [],
    evidenceInstrumentation: ['simulation_run'],
  }));
}

function buildArenaTaskNodes(tasks: ArenaTaskResourceNodeInput[]): ResourceNode[] {
  return tasks.map((task) => createNode({
    id: `arena-task:${task.id}`,
    title: task.title,
    courseModule: null,
    type: 'arena_task',
    sourceKind: 'arena_task',
    sourceRef: task.id,
    launchTarget: task.launchTarget,
    knowledgeCoverage: task.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'arena',
      catalogMetadata: 'arena',
      planningMetadata: 'ResourceNode',
    },
    prerequisites: task.prerequisiteNodeIds ?? [],
    evidenceInstrumentation: [task.official ? 'arena_evaluation_complete' : 'arena_simulation_run'],
  }));
}

function buildLightweightNodes(
  entries: LightweightResourceNodeInput[],
  type: Extract<ResourceNodeType, 'reflection' | 'ai_intervention' | 'project'>,
  sourceKind: Extract<ResourceNodeSourceKind, 'reflection_prompt' | 'ai_intervention' | 'project'>,
): ResourceNode[] {
  return entries.map((entry) => createNode({
    id: `${sourceKind}:${entry.id}`,
    title: entry.title,
    courseModule: null,
    type,
    sourceKind,
    sourceRef: entry.sourceRef ?? entry.id,
    renderTarget: entry.renderTarget ?? null,
    launchTarget: entry.launchTarget ?? null,
    knowledgeCoverage: entry.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'ResourceNode',
      catalogMetadata: 'ResourceNode',
      planningMetadata: 'ResourceNode',
    },
    teacherOnly: Boolean(entry.teacherOnly),
    prerequisites: entry.prerequisiteNodeIds ?? [],
    evidenceInstrumentation: [`${sourceKind}_complete`],
  }));
}

function createNode(input: {
  id: string;
  title: string;
  description?: string | null;
  type: ResourceNodeType;
  courseModule?: string | null;
  sourceKind: ResourceNodeSourceKind;
  sourceRef: string;
  sourceRefs?: ResourceNodeSourceReference[];
  renderTarget?: string | null;
  launchTarget?: string | null;
  knowledgeCoverage: string[];
  sourceOfRecord: ResourceNodeSourceOfRecord;
  teacherOnly?: boolean;
  prerequisites?: string[];
  evidenceInstrumentation: string[];
  planningOverride?: ResourceNodePlanningOverride;
}): ResourceNode {
  const privacyLevel: ResourceNodePrivacyLevel = input.teacherOnly ? 'teacher-scoped' : 'student-visible';
  const planningOverride = input.planningOverride ?? {};
  return {
    id: input.id,
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    courseModule: input.courseModule ?? null,
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    sourceRefs: uniqueSourceRefs(input.sourceRefs ?? [{ kind: input.sourceKind, ref: input.sourceRef }]),
    renderTarget: input.renderTarget ?? null,
    launchTarget: input.launchTarget ?? null,
    planningMetadata: {
      prerequisites: uniqueSorted(planningOverride.prerequisites ?? input.prerequisites ?? []),
      estimatedTimeMinutes: planningOverride.estimatedTimeMinutes ?? defaultEstimatedTime(input.type),
      cognitiveLoad: planningOverride.cognitiveLoad ?? defaultCognitiveLoad(input.type),
      knowledgeCoverage: uniqueSorted(planningOverride.knowledgeCoverage ?? input.knowledgeCoverage),
      abilityImpact: defaultAbilityImpact(input.type),
      cost: {
        effort: input.type === 'project' || input.type === 'arena_task' ? 'high' : 'medium',
        requiresTeacherReview: input.teacherOnly === true || input.type === 'project',
      },
      availability: planningOverride.availability ?? (input.teacherOnly ? 'teacher_only' : 'available'),
      teacherPolicy: planningOverride.teacherPolicy ?? (input.teacherOnly ? 'teacher-only' : 'allowed'),
      privacyLevel: planningOverride.privacyLevel ?? privacyLevel,
      terminalConstraints: input.type === 'project' ? ['terminal-node'] : [],
      evidenceInstrumentation: input.evidenceInstrumentation,
    },
    sourceOfRecord: input.sourceOfRecord,
    eligibility: {
      pathEligible: false,
      reasons: [],
      auditIssues: [],
    },
  };
}

function parsePlanningOverride(config?: Record<string, unknown> | null): ResourceNodePlanningOverride | undefined {
  const value = config?.resourceNodePlanning;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const override: ResourceNodePlanningOverride = {};
  if (Array.isArray(raw.prerequisites)) {
    override.prerequisites = raw.prerequisites.filter((item): item is string => typeof item === 'string');
  }
  if (Array.isArray(raw.knowledgeCoverage)) {
    override.knowledgeCoverage = raw.knowledgeCoverage.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw.estimatedTimeMinutes === 'number' || raw.estimatedTimeMinutes === null) {
    override.estimatedTimeMinutes = raw.estimatedTimeMinutes;
  }
  if (raw.cognitiveLoad === 'low' || raw.cognitiveLoad === 'medium' || raw.cognitiveLoad === 'high') {
    override.cognitiveLoad = raw.cognitiveLoad;
  }
  if (
    raw.availability === 'available' ||
    raw.availability === 'draft' ||
    raw.availability === 'archived' ||
    raw.availability === 'teacher_only'
  ) {
    override.availability = raw.availability;
  }
  if (
    raw.teacherPolicy === 'allowed' ||
    raw.teacherPolicy === 'teacher-assigned' ||
    raw.teacherPolicy === 'teacher-only' ||
    raw.teacherPolicy === 'blocked'
  ) {
    override.teacherPolicy = raw.teacherPolicy;
  }
  if (
    raw.privacyLevel === 'student-visible' ||
    raw.privacyLevel === 'teacher-scoped' ||
    raw.privacyLevel === 'admin-scoped'
  ) {
    override.privacyLevel = raw.privacyLevel;
  }

  return Object.keys(override).length > 0 ? override : undefined;
}

function mergeOverlappingSources(nodes: ResourceNode[]): Map<string, ResourceNode> {
  const result = new Map<string, ResourceNode>();
  for (const node of nodes.sort((left, right) => left.id.localeCompare(right.id))) {
    const existing = result.get(node.id);
    if (!existing) {
      result.set(node.id, node);
      continue;
    }
    result.set(node.id, {
      ...existing,
      sourceRefs: uniqueSourceRefs([...existing.sourceRefs, ...node.sourceRefs]),
      renderTarget: existing.renderTarget ?? node.renderTarget,
      launchTarget: existing.launchTarget ?? node.launchTarget,
      planningMetadata: {
        ...existing.planningMetadata,
        knowledgeCoverage: uniqueSorted([
          ...existing.planningMetadata.knowledgeCoverage,
          ...node.planningMetadata.knowledgeCoverage,
        ]),
        evidenceInstrumentation: uniqueSorted([
          ...existing.planningMetadata.evidenceInstrumentation,
          ...node.planningMetadata.evidenceInstrumentation,
        ]),
      },
      sourceOfRecord: {
        content: existing.sourceOfRecord.content,
        catalogMetadata: existing.sourceRefs.some((source) => source.kind === 'teaching_resource') ||
          node.sourceRefs.some((source) => source.kind === 'teaching_resource')
          ? 'TeachingResource'
          : existing.sourceOfRecord.catalogMetadata,
        planningMetadata: 'ResourceNode',
      },
    });
  }
  return result;
}

function buildResourceNodeEdges(nodesById: Map<string, ResourceNode>): ResourceNodeEdge[] {
  const edges: ResourceNodeEdge[] = [];
  for (const node of Array.from(nodesById.values())) {
    for (const prerequisite of node.planningMetadata.prerequisites) {
      if (!nodesById.has(prerequisite)) {
        continue;
      }
      edges.push({
        id: `${prerequisite}->${node.id}:prerequisite`,
        fromNodeId: prerequisite,
        toNodeId: node.id,
        kind: 'prerequisite',
        source: 'declared-prerequisite',
      });
    }
  }
  return edges.sort((left, right) => left.id.localeCompare(right.id));
}

function inferMediaNodeType(value: string): ResourceNodeType {
  const lower = value.toLowerCase();
  if (/\.(mp4|webm|mov)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|m4a)$/.test(lower)) return 'audio';
  if (/\.(pdf|md|markdown)$/.test(lower)) return 'handout';
  return 'lesson_step';
}

function inferRegisteredNodeType(value: string): ResourceNodeType {
  const lower = value.toLowerCase();
  if (lower.includes('quiz') || lower.includes('precheck') || lower.includes('posttest') || lower.includes('assessment')) {
    return 'quiz';
  }
  if (lower.includes('simulation') || lower.includes('sim')) {
    return 'simulation';
  }
  if (lower.includes('reflection')) {
    return 'reflection';
  }
  return 'lesson_step';
}

function collectLessonKnowledgeCoverage(lesson: RuntimeLessonNodeInput): string[] {
  return uniqueSorted((lesson.steps ?? []).flatMap((step) => step.knowledgeNodeIds ?? []));
}

function defaultEstimatedTime(type: ResourceNodeType): number {
  if (type === 'video' || type === 'audio') return 8;
  if (type === 'handout' || type === 'knowledge_card') return 10;
  if (type === 'quiz' || type === 'reflection') return 12;
  if (type === 'simulation' || type === 'arena_task') return 25;
  if (type === 'project') return 60;
  return 15;
}

function defaultCognitiveLoad(type: ResourceNodeType): ResourceNodeCognitiveLoad {
  if (type === 'project' || type === 'arena_task' || type === 'simulation') return 'high';
  if (type === 'video' || type === 'audio' || type === 'knowledge_card') return 'low';
  return 'medium';
}

function defaultAbilityImpact(type: ResourceNodeType): Record<string, number> {
  if (type === 'simulation' || type === 'arena_task' || type === 'project') {
    return { parameterDesign: 0.3, engineeringDecision: 0.3, crossDomainTransfer: 0.2 };
  }
  if (type === 'reflection' || type === 'ai_intervention') {
    return { inquiryReflection: 0.3, selfDirectedLearning: 0.2 };
  }
  return { controlModeling: 0.2 };
}

function uniqueSourceRefs(refs: ResourceNodeSourceReference[]): ResourceNodeSourceReference[] {
  const seen = new Set<string>();
  return refs
    .filter((ref) => {
      const key = `${ref.kind}:${ref.ref}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => `${left.kind}:${left.ref}`.localeCompare(`${right.kind}:${right.ref}`));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}
