import { z } from 'zod';
import { tool } from 'ai';

import { getStepAIContext } from '@/lib/course-ai-contexts';
import {
  ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
  isAdaptiveLearnerStateServiceEnabled,
  readAdaptiveLearnerState,
  type AdaptiveLearnerState,
  type AdaptiveLearnerStatePrivacyScope,
  type AdaptiveLearnerStateRole,
} from '@/lib/data-governance/adaptive-learner-state-service';
import type { PageContext, UserProfile, AbilityVector } from '@/types/ai-context';
import type { InterventionDecision, StudentState } from '@/features/ai/companion/intervention-engine';
import { generateIntervention, shouldIntervene } from '@/features/ai/companion/intervention-engine';
import { getSimulationStatusTool, type SimulationStateStore } from '@/lib/ai-tools';

export const KONLING_SEMANTIC_MEMORY_FEATURE_FLAG = 'KONLING_SEMANTIC_MEMORY_ENABLED';
export const KONLING_STRATEGY_MEMORY_FEATURE_FLAG = 'KONLING_STRATEGY_MEMORY_ENABLED';

export type KonlingToolName =
  | 'get_page_context'
  | 'get_learner_state'
  | 'get_plan_context'
  | 'search_learning_memory'
  | 'search_knowledge_graph'
  | 'recommend_next_action'
  | 'get_simulation_status'
  | 'record_intervention_result'
  | 'analyze_attempt';

export type KonlingMemoryType = 'working-summary' | 'session-summary' | 'episodic' | 'intervention-outcome';
export type KonlingInterventionFeedback = 'accepted' | 'dismissed' | 'rated';

export interface KonlingRuntimeScope {
  authenticatedUserId: string;
  targetUserId: string;
  role: AdaptiveLearnerStateRole;
  classId?: string | null;
  courseId: string;
  pageId: string;
  resourceId?: string | null;
  pathNodeId?: string | null;
  privacyScopes: AdaptiveLearnerStatePrivacyScope[];
}

export interface KonlingRuntimeContext {
  pageContext: PageContext;
  userProfile: UserProfile;
  learnerState: AdaptiveLearnerState | null;
  planContext: KonlingPlanContext;
  memory: KonlingMemoryView[];
  permittedTools: KonlingToolName[];
  missingContext: string[];
  featureFlags: {
    learnerState: boolean;
    semanticMemory: boolean;
    strategyMemory: boolean;
  };
}

export interface KonlingPlanContext {
  currentPathId: string | null;
  activeNodeId: string | null;
  nextNodeIds: string[];
  recentPathIds: string[];
  completedNodeIds: string[];
  status: 'available' | 'missing';
}

export interface KonlingMemoryView {
  id: string;
  memoryType: KonlingMemoryType | string;
  privacyScope: AdaptiveLearnerStatePrivacyScope | string;
  summary: string;
  evidenceRefs: unknown[];
  createdAt: string;
}

export interface KonlingInterventionRecord {
  id: string;
  shouldIntervene: boolean;
  reason: string;
  interventionType: string;
  content: string;
  whyNow: string;
  evidence: unknown[];
  alternatives: string[];
  relatedConcepts: string[];
  highlightParams: string[];
  showTrendPrediction: boolean;
  cooldownUntil: string | null;
}

interface KonlingRuntimeInput {
  authenticatedUserId: string;
  authenticatedUserName?: string | null;
  role: string | undefined;
  targetUserId?: string | null;
  classId?: string | null;
  courseId?: string | null;
  pageId?: string | null;
  resourceId?: string | null;
  pathNodeId?: string | null;
  pageContextHint?: Partial<PageContext> | null;
  now?: Date;
}

interface KonlingMemoryCreateInput {
  userId: string;
  sessionId?: string | null;
  classId?: string | null;
  courseId?: string | null;
  pageId?: string | null;
  resourceId?: string | null;
  pathNodeId?: string | null;
  memoryType: KonlingMemoryType;
  privacyScope?: AdaptiveLearnerStatePrivacyScope;
  summary: string;
  evidenceRefs?: unknown[];
  metadata?: Record<string, unknown>;
  expiresAt?: Date | null;
}

interface KonlingInterventionInput {
  scope: KonlingRuntimeScope;
  studentState: StudentState;
  now?: Date;
}

interface KonlingToolRuntimeInput {
  db: KonlingRuntimeDb;
  scope: KonlingRuntimeScope;
  context: KonlingRuntimeContext;
  scopedSimulationState?: Partial<SimulationStateStore> | null;
}

export interface KonlingRuntimeDb {
  studentProfile?: {
    findFirst?: (args: any) => Promise<unknown | null>;
  };
  class?: {
    findUnique?: (args: any) => Promise<unknown | null>;
  };
  learningPath?: {
    findMany?: (args: any) => Promise<unknown[]>;
  };
  konlingMemory?: {
    findMany?: (args: any) => Promise<unknown[]>;
    create?: (args: any) => Promise<unknown>;
  };
  aIIntervention?: {
    findFirst?: (args: any) => Promise<unknown | null>;
    create?: (args: any) => Promise<unknown>;
    updateMany?: (args: any) => Promise<unknown>;
  };
  knowledgeNode?: {
    findMany?: (args: any) => Promise<unknown[]>;
  };
  studentCompetencySnapshot?: {
    findFirst?: (args: any) => Promise<unknown | null>;
  };
  studentProfileSummary?: {
    findUnique?: (args: any) => Promise<unknown | null>;
  };
  learningFact?: {
    findMany?: (args: any) => Promise<unknown[]>;
  };
  adaptiveMasteryUpdate?: {
    findMany?: (args: any) => Promise<unknown[]>;
  };
  adaptiveAssessmentAbilityEstimate?: {
    findFirst?: (args: any) => Promise<unknown | null>;
  };
  studentRiskFlag?: {
    findMany?: (args: any) => Promise<unknown[]>;
  };
  studentEvidenceFeatureCache?: {
    findUnique?: (args: any) => Promise<unknown | null>;
  };
}

const DEFAULT_TOOLS: KonlingToolName[] = [
  'get_page_context',
  'get_learner_state',
  'get_plan_context',
  'search_learning_memory',
  'search_knowledge_graph',
  'recommend_next_action',
  'get_simulation_status',
  'record_intervention_result',
  'analyze_attempt',
];

export async function verifyKonlingRuntimeScope(
  db: KonlingRuntimeDb,
  input: KonlingRuntimeInput,
): Promise<{ ok: true; scope: KonlingRuntimeScope } | { ok: false; status: 400 | 403 | 404; error: string }> {
  const role = normalizeKonlingRole(input.role);
  const targetUserId = input.targetUserId || input.authenticatedUserId;
  const courseId = input.courseId || input.pageContextHint?.courseId || 'unknown-course';
  const pageId = input.pageId || input.pageContextHint?.stepId || 'unknown-page';

  if (role === 'student' && targetUserId !== input.authenticatedUserId) {
    return { ok: false, status: 403, error: '学生只能访问自己的 Konling 运行时上下文。' };
  }

  if (role === 'student' && input.classId) {
    const studentProfile = await db.studentProfile?.findFirst?.({
      where: { userId: targetUserId, classId: input.classId },
      select: { userId: true, classId: true },
    });
    if (!studentProfile) return { ok: false, status: 404, error: '学生不在该班级中。' };
  }

  if (role === 'teacher' && targetUserId !== input.authenticatedUserId) {
    if (!input.classId) {
      return { ok: false, status: 400, error: '教师访问学生 Konling 运行时必须提供 classId。' };
    }

    const classData = await db.class?.findUnique?.({
      where: { id: input.classId },
      select: { id: true, teacherId: true },
    });
    if (!classData) return { ok: false, status: 404, error: '班级不存在。' };
    if (getString(classData, 'teacherId') !== input.authenticatedUserId) {
      return { ok: false, status: 403, error: '无权访问该班级的 Konling 运行时。' };
    }

    const studentProfile = await db.studentProfile?.findFirst?.({
      where: { userId: targetUserId, classId: input.classId },
      select: { userId: true, classId: true },
    });
    if (!studentProfile) return { ok: false, status: 404, error: '学生不在该班级中。' };
  }

  return {
    ok: true,
    scope: {
      authenticatedUserId: input.authenticatedUserId,
      targetUserId,
      role,
      classId: input.classId ?? null,
      courseId,
      pageId,
      resourceId: input.resourceId ?? null,
      pathNodeId: input.pathNodeId ?? null,
      privacyScopes: privacyScopesForRole(role),
    },
  };
}

export async function buildKonlingRuntimeContext(
  db: KonlingRuntimeDb,
  input: KonlingRuntimeInput,
): Promise<KonlingRuntimeContext> {
  const scopeResult = await verifyKonlingRuntimeScope(db, input);
  if (!scopeResult.ok) {
    throw new KonlingRuntimeScopeError(scopeResult.status, scopeResult.error);
  }

  const scope = scopeResult.scope;
  const learnerStateEnabled = isAdaptiveLearnerStateServiceEnabled();
  const learnerState = learnerStateEnabled
    ? await readAdaptiveLearnerState(db, {
        userId: scope.targetUserId,
        role: scope.role,
        classId: scope.classId,
        clientHints: input.pageContextHint ? { pageContext: input.pageContextHint } : undefined,
        now: input.now,
      }).catch(() => null)
    : null;

  const [planContext, memory] = await Promise.all([
    readPlanContext(db, scope),
    searchKonlingMemory(db, {
      scope,
      query: '',
      limit: 6,
    }),
  ]);
  const pageContext = buildServerOwnedPageContext(scope, input.pageContextHint);
  const userProfile = buildServerOwnedUserProfile({
    userId: scope.targetUserId,
    name: input.authenticatedUserName || '同学',
    learnerState,
  });

  return {
    pageContext,
    userProfile,
    learnerState,
    planContext,
    memory,
    permittedTools: DEFAULT_TOOLS,
    missingContext: buildMissingContext({ learnerStateEnabled, learnerState, planContext, memory }),
    featureFlags: {
      learnerState: learnerStateEnabled,
      semanticMemory: process.env.KONLING_SEMANTIC_MEMORY_ENABLED === 'true',
      strategyMemory: process.env.KONLING_STRATEGY_MEMORY_ENABLED === 'true',
    },
  };
}

export function buildKonlingToolRuntime(input: KonlingToolRuntimeInput) {
  return {
    getPageContext: async () => assertToolResult(input.scope, 'get_page_context', input.context.pageContext),
    getLearnerState: async () => assertToolResult(input.scope, 'get_learner_state', input.context.learnerState),
    getPlanContext: async () => assertToolResult(input.scope, 'get_plan_context', input.context.planContext),
    searchLearningMemory: async (args: { query?: string; limit?: number } = {}) =>
      assertToolResult(input.scope, 'search_learning_memory', await searchKonlingMemory(input.db, {
        scope: input.scope,
        query: args.query ?? '',
        limit: args.limit ?? 5,
      })),
    searchKnowledgeGraph: async (args: { query?: string; limit?: number } = {}) =>
      assertToolResult(input.scope, 'search_knowledge_graph', await searchKnowledgeGraph(input.db, args.query ?? '', args.limit ?? 5)),
    recommendNextAction: async () => assertToolResult(input.scope, 'recommend_next_action', recommendNextAction(input.context)),
    getSimulationStatus: async (args: { resourceId?: string | null } = {}) => {
      if (args.resourceId && input.scope.resourceId && args.resourceId !== input.scope.resourceId) {
        throw new KonlingRuntimeScopeError(403, '无权读取当前资源范围外的仿真状态。');
      }
      const status = input.scopedSimulationState
        ? formatSimulationStatus(input.scopedSimulationState)
        : formatUnavailableSimulationStatus(input.scope);
      return assertToolResult(input.scope, 'get_simulation_status', status);
    },
    recordInterventionResult: async (args: {
      interventionId: string;
      feedback: KonlingInterventionFeedback;
      helpful?: boolean;
      studentResponse?: string;
    }) => assertToolResult(input.scope, 'record_intervention_result', await recordKonlingInterventionFeedback(input.db, {
      scope: input.scope,
      interventionId: args.interventionId,
      feedback: args.feedback,
      helpful: args.helpful,
      studentResponse: args.studentResponse,
    })),
    analyzeAttempt: async (args: { studentState: StudentState }) =>
      assertToolResult(input.scope, 'analyze_attempt', analyzeKonlingAttempt(args.studentState)),
  };
}

export function buildScopedKonlingAiTools(runtime: ReturnType<typeof buildKonlingToolRuntime>) {
  return {
    get_page_context: tool({
      description: '读取服务端确认的当前页面上下文。',
      parameters: z.object({}),
      execute: () => runtime.getPageContext(),
    }),
    get_learner_state: tool({
      description: '读取服务端学习者状态，包含能力、知识掌握、风险与证据置信度。',
      parameters: z.object({}),
      execute: () => runtime.getLearnerState(),
    }),
    get_plan_context: tool({
      description: '读取当前学习路径与下一步节点上下文。',
      parameters: z.object({}),
      execute: () => runtime.getPlanContext(),
    }),
    search_learning_memory: tool({
      description: '检索隐私范围允许的 Konling 学习记忆摘要。',
      parameters: z.object({
        query: z.string().optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: (args) => runtime.searchLearningMemory(args),
    }),
    search_knowledge_graph: tool({
      description: '按关键词检索课程知识图谱节点。',
      parameters: z.object({
        query: z.string().optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: (args) => runtime.searchKnowledgeGraph(args),
    }),
    recommend_next_action: tool({
      description: '基于学习状态、路径和记忆推荐下一步动作。',
      parameters: z.object({}),
      execute: () => runtime.recommendNextAction(),
    }),
    get_simulation_status: tool({
      description: '读取当前资源范围内的仿真状态。',
      parameters: getSimulationStatusTool.parameters,
      execute: (args) => runtime.getSimulationStatus(args),
    }),
    record_intervention_result: tool({
      description: '记录学生对 Konling 干预的接受、忽略或评分结果。',
      parameters: z.object({
        interventionId: z.string(),
        feedback: z.enum(['accepted', 'dismissed', 'rated']),
        helpful: z.boolean().optional(),
        studentResponse: z.string().optional(),
      }),
      execute: (args) => runtime.recordInterventionResult(args),
    }),
    analyze_attempt: tool({
      description: '分析最近尝试并判断是否需要纠偏或补救干预。',
      parameters: z.object({
        studentState: z.any(),
      }),
      execute: (args) => runtime.analyzeAttempt(args as { studentState: StudentState }),
    }),
  };
}

export async function createKonlingMemory(
  db: KonlingRuntimeDb,
  input: KonlingMemoryCreateInput,
): Promise<KonlingMemoryView | null> {
  const summary = sanitizeMemorySummary(input.summary);
  if (!summary) return null;
  const created = await db.konlingMemory?.create?.({
    data: {
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      classId: input.classId ?? null,
      courseId: input.courseId ?? null,
      pageId: input.pageId ?? null,
      resourceId: input.resourceId ?? null,
      pathNodeId: input.pathNodeId ?? null,
      memoryType: input.memoryType,
      privacyScope: input.privacyScope ?? 'student-visible',
      summary,
      evidenceRefs: input.evidenceRefs ?? [],
      metadata: redactSensitivePayload(input.metadata ?? {}),
      expiresAt: input.expiresAt ?? null,
    },
  });
  return created ? toMemoryView(created) : null;
}

export async function persistKonlingSessionMemories(
  db: KonlingRuntimeDb,
  input: {
    userId: string;
    sessionId: string;
    courseId: string;
    pageId: string;
    classId?: string | null;
    resourceId?: string | null;
    pathNodeId?: string | null;
    userMessage: string;
    assistantMessage: string;
  },
): Promise<KonlingMemoryView[]> {
  const summaries = buildNonVerbatimSessionSummaries(input);
  const working = await createKonlingMemory(db, {
    userId: input.userId,
    sessionId: input.sessionId,
    classId: input.classId,
    courseId: input.courseId,
    pageId: input.pageId,
    memoryType: 'working-summary',
    resourceId: input.resourceId,
    pathNodeId: input.pathNodeId,
    summary: summaries.working,
    evidenceRefs: [{ kind: 'konling-session', ref: input.sessionId }],
  });
  const session = await createKonlingMemory(db, {
    userId: input.userId,
    sessionId: input.sessionId,
    classId: input.classId,
    courseId: input.courseId,
    pageId: input.pageId,
    memoryType: 'session-summary',
    resourceId: input.resourceId,
    pathNodeId: input.pathNodeId,
    summary: summaries.session,
    evidenceRefs: [{ kind: 'konling-session', ref: input.sessionId }],
  });
  const episodic = await createKonlingMemory(db, {
    userId: input.userId,
    sessionId: input.sessionId,
    classId: input.classId,
    courseId: input.courseId,
    pageId: input.pageId,
    memoryType: 'episodic',
    resourceId: input.resourceId,
    pathNodeId: input.pathNodeId,
    summary: summaries.episodic,
    evidenceRefs: [{ kind: 'konling-user-message', ref: input.sessionId }],
  });
  return [working, session, episodic].filter((item): item is KonlingMemoryView => Boolean(item));
}

export async function createGovernedKonlingIntervention(
  db: KonlingRuntimeDb,
  input: KonlingInterventionInput,
): Promise<KonlingInterventionRecord> {
  const now = input.now ?? new Date();
  const teacherPolicy = resolveServerTeacherPolicy(input.scope);
  if (teacherPolicy === 'blocked') {
    return {
      id: '',
      shouldIntervene: false,
      reason: 'teacher-policy-blocked',
      interventionType: 'none',
      content: '',
      whyNow: '教师策略阻止本次 Konling 干预。',
      evidence: [],
      alternatives: ['继续当前任务', '请求教师帮助'],
      relatedConcepts: [],
      highlightParams: ['kp'],
      showTrendPrediction: false,
      cooldownUntil: null,
    };
  }

  const recent = await db.aIIntervention?.findFirst?.({
    where: {
      userId: input.scope.targetUserId,
      sessionId: `konling:${input.scope.courseId}:${input.scope.pageId}`,
      classId: input.scope.classId ?? null,
      resourceId: input.scope.resourceId ?? null,
      pathNodeId: input.scope.pathNodeId ?? null,
      interventionType: { not: 'feedback-only' },
      cooldownUntil: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    return {
      id: getString(recent, 'id'),
      shouldIntervene: false,
      reason: 'cooldown-active',
      interventionType: getString(recent, 'interventionType') || 'cooldown',
      content: '',
      whyNow: '最近已经触发过 Konling 干预，当前仍处于冷却期。',
      evidence: [],
      alternatives: ['继续当前路径节点', '稍后再请求帮助'],
      relatedConcepts: [],
      highlightParams: ['kp'],
      showTrendPrediction: false,
      cooldownUntil: toIsoOrNull(getValue(recent, 'cooldownUntil')),
    };
  }

  const decision = shouldIntervene(input.studentState);
  const payload = generateIntervention(decision, input.studentState);
  if (!decision.shouldIntervene) {
    return {
      id: '',
      shouldIntervene: false,
      reason: decision.reason,
      interventionType: 'none',
      content: payload.content,
      whyNow: buildWhyNow(decision, input.studentState),
      evidence: buildInterventionEvidence(input.studentState),
      alternatives: payload.suggestedNextSteps,
      relatedConcepts: payload.relatedConcepts,
      highlightParams: payload.highlightParams,
      showTrendPrediction: payload.showTrendPrediction,
      cooldownUntil: null,
    };
  }
  const cooldownUntil = new Date(now.getTime() + 20 * 60_000);
  const whyNow = buildWhyNow(decision, input.studentState);
  const evidence = buildInterventionEvidence(input.studentState);
  const alternatives = payload.suggestedNextSteps.slice(0, 3);

  const record = await db.aIIntervention?.create?.({
    data: {
      userId: input.scope.targetUserId,
      sessionId: `konling:${input.scope.courseId}:${input.scope.pageId}`,
      classId: input.scope.classId ?? null,
      resourceId: input.scope.resourceId ?? null,
      pathNodeId: input.scope.pathNodeId ?? null,
      triggerType: decision.reason,
      interventionType: payload.feedbackType,
      content: payload.content,
      whyNow,
      evidence,
      alternatives,
      privacyScope: 'student-visible',
      teacherPolicy,
      cooldownUntil,
    },
  });

  const interventionId = getString(record, 'id') || `intv-${now.getTime()}`;
  await createKonlingMemory(db, {
    userId: input.scope.targetUserId,
    sessionId: `konling:${input.scope.courseId}:${input.scope.pageId}`,
    classId: input.scope.classId ?? null,
    courseId: input.scope.courseId,
    pageId: input.scope.pageId,
    resourceId: input.scope.resourceId ?? null,
    pathNodeId: input.scope.pathNodeId ?? null,
    memoryType: 'intervention-outcome',
    privacyScope: 'teacher-scoped',
    summary: `${whyNow} 干预类型：${payload.feedbackType}`,
    evidenceRefs: [{ kind: 'ai-intervention', ref: interventionId }],
  });

  return {
    id: interventionId,
    shouldIntervene: decision.shouldIntervene,
    reason: decision.reason,
    interventionType: payload.feedbackType,
    content: payload.content,
    whyNow,
    evidence,
    alternatives,
    relatedConcepts: payload.relatedConcepts,
    highlightParams: payload.highlightParams,
    showTrendPrediction: payload.showTrendPrediction,
    cooldownUntil: cooldownUntil.toISOString(),
  };
}

export async function recordKonlingInterventionFeedback(
  db: KonlingRuntimeDb,
  input: {
    scope: KonlingRuntimeScope;
    interventionId: string;
    feedback: KonlingInterventionFeedback;
    helpful?: boolean;
    studentResponse?: string;
  },
) {
  const outcome = {
    feedback: input.feedback,
    helpful: input.helpful ?? null,
    recordedAt: new Date().toISOString(),
  };
  const updateResult = await db.aIIntervention?.updateMany?.({
    where: {
      id: input.interventionId,
      userId: input.scope.targetUserId,
      classId: input.scope.classId ?? null,
      resourceId: input.scope.resourceId ?? null,
      pathNodeId: input.scope.pathNodeId ?? null,
    },
    data: {
      wasHelpful: input.helpful ?? null,
      studentResponse: input.studentResponse ? sanitizeMemorySummary(input.studentResponse) : undefined,
      outcome,
    },
  });
  const updatedCount = typeof getValue(updateResult, 'count') === 'number' ? getValue(updateResult, 'count') as number : 0;
  if (updatedCount !== 1) {
    throw new KonlingRuntimeScopeError(404, '干预不存在或不属于当前 Konling 作用域。');
  }
  await createKonlingMemory(db, {
    userId: input.scope.targetUserId,
    sessionId: `konling:${input.scope.courseId}:${input.scope.pageId}`,
    classId: input.scope.classId ?? null,
    courseId: input.scope.courseId,
    pageId: input.scope.pageId,
    resourceId: input.scope.resourceId ?? null,
    pathNodeId: input.scope.pathNodeId ?? null,
    memoryType: 'intervention-outcome',
    privacyScope: 'teacher-scoped',
    summary: `学生对干预 ${input.interventionId} 的反馈：${input.feedback}${input.helpful === undefined ? '' : `，helpful=${input.helpful}`}`,
    evidenceRefs: [{ kind: 'ai-intervention', ref: input.interventionId }],
  });
  return { success: true, outcome };
}

export function normalizeKonlingRole(role: string | undefined): AdaptiveLearnerStateRole {
  if (role === 'ADMIN') return 'admin';
  if (role === 'TEACHER') return 'teacher';
  if (role === 'system') return 'system';
  return 'student';
}

export function privacyScopesForRole(role: AdaptiveLearnerStateRole): AdaptiveLearnerStatePrivacyScope[] {
  if (role === 'admin') return ['student-visible', 'teacher-scoped', 'admin-scoped', 'audit-only'];
  if (role === 'teacher') return ['student-visible', 'teacher-scoped'];
  if (role === 'system') return ['student-visible', 'teacher-scoped', 'admin-scoped', 'audit-only', 'system-internal'];
  return ['student-visible'];
}

function assertToolResult(scope: KonlingRuntimeScope, toolName: KonlingToolName, result: unknown) {
  if (!DEFAULT_TOOLS.includes(toolName)) {
    throw new KonlingRuntimeScopeError(403, `Konling 工具 ${toolName} 未授权。`);
  }
  return redactSensitivePayload(result, scope.privacyScopes);
}

async function readPlanContext(db: KonlingRuntimeDb, scope: KonlingRuntimeScope): Promise<KonlingPlanContext> {
  if (!scope.pathNodeId) {
    return {
      currentPathId: null,
      activeNodeId: null,
      nextNodeIds: [],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'missing',
    };
  }
  const paths = await db.learningPath?.findMany?.({
    where: { userId: scope.targetUserId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  }) ?? [];
  const scopedPaths = paths.filter((path) => arrayOfStrings(getValue(path, 'nodeIds')).includes(scope.pathNodeId as string));
  const current = scopedPaths[0];
  const nodeIds = arrayOfStrings(getValue(current, 'nodeIds'));
  return {
    currentPathId: getString(current, 'id') || null,
    activeNodeId: scope.pathNodeId || nodeIds[0] || null,
    nextNodeIds: nodeIds.slice(0, 3),
    recentPathIds: scopedPaths.map((path) => getString(path, 'id')).filter(Boolean),
    completedNodeIds: [],
    status: current ? 'available' : 'missing',
  };
}

async function searchKonlingMemory(
  db: KonlingRuntimeDb,
  input: { scope: KonlingRuntimeScope; query: string; limit: number },
): Promise<KonlingMemoryView[]> {
  const memories = await db.konlingMemory?.findMany?.({
    where: {
      userId: input.scope.targetUserId,
      privacyScope: { in: input.scope.privacyScopes },
      classId: input.scope.classId ?? null,
      courseId: input.scope.courseId,
      pageId: input.scope.pageId,
      resourceId: input.scope.resourceId ?? null,
      pathNodeId: input.scope.pathNodeId ?? null,
      ...(input.query
        ? {
            summary: {
              contains: input.query,
              mode: 'insensitive',
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit,
  }) ?? [];
  return memories.map(toMemoryView);
}

async function searchKnowledgeGraph(db: KonlingRuntimeDb, query: string, limit: number) {
  const nodes = await db.knowledgeNode?.findMany?.({
    where: query
      ? {
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { tags: { has: query } },
          ],
        }
      : { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      tags: true,
    },
    take: limit,
  }) ?? [];
  return nodes.map((node) => ({
    id: getString(node, 'id'),
    name: getString(node, 'name'),
    description: summarizeText(getString(node, 'description'), 160),
    tags: arrayOfStrings(getValue(node, 'tags')),
  }));
}

function recommendNextAction(context: KonlingRuntimeContext) {
  if (context.planContext.activeNodeId) {
    return {
      action: 'continue_path_node',
      nodeId: context.planContext.activeNodeId,
      reason: '当前学习路径已有可继续节点。',
    };
  }
  if (context.learnerState?.risks.activeFlags.length) {
    return {
      action: 'request_remedial_intervention',
      reason: '学习状态存在未解决风险，应优先补救。',
    };
  }
  return {
    action: 'ask_clarifying_question',
    reason: '路径上下文不足，先确认学生当前目标。',
  };
}

function analyzeKonlingAttempt(studentState: StudentState) {
  const decision = shouldIntervene(studentState);
  return {
    decision,
    whyNow: buildWhyNow(decision, studentState),
    evidence: buildInterventionEvidence(studentState),
    alternatives: decision.shouldIntervene
      ? ['改用更小参数步长', '回到前置知识卡', '请求教师确认约束']
      : ['继续当前探索', '记录本轮参数与指标关系'],
  };
}

function buildServerOwnedPageContext(scope: KonlingRuntimeScope, hint?: Partial<PageContext> | null): PageContext {
  const stepContext = getStepAIContext(scope.courseId, scope.pageId);
  return {
    courseId: scope.courseId,
    courseTitle: stepContext?.courseTitle || hint?.courseTitle || scope.courseId,
    pageType: stepContext?.pageType || hint?.pageType || 'theory',
    stepId: scope.pageId,
    topic: stepContext?.topic || hint?.topic || scope.pageId,
    learningObjectives: stepContext?.learningObjectives || hint?.learningObjectives || [],
    knowledgeType: stepContext?.knowledgeType || hint?.knowledgeType || 'C',
    stage: hint?.stage,
    url: hint?.url,
  };
}

function buildServerOwnedUserProfile(input: {
  userId: string;
  name: string;
  learnerState: AdaptiveLearnerState | null;
}): UserProfile {
  return {
    id: input.userId,
    name: input.name,
    learningStyle: 'INTERACTIVE',
    cognitiveLevel: inferCognitiveLevel(input.learnerState),
    abilityVector: toLegacyAbilityVector(input.learnerState),
  };
}

function inferCognitiveLevel(state: AdaptiveLearnerState | null): 1 | 2 | 3 | 4 | 5 {
  const values = Object.values(state?.primaryCompetencies.vector ?? {})
    .map((entry) => typeof entry?.score === 'number' ? entry.score : null)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return 3;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (avg >= 85) return 5;
  if (avg >= 70) return 4;
  if (avg >= 50) return 3;
  if (avg >= 30) return 2;
  return 1;
}

function toLegacyAbilityVector(state: AdaptiveLearnerState | null): AbilityVector {
  const vector = (state?.primaryCompetencies.vector ?? {}) as Record<string, { score?: number } | undefined>;
  return {
    computational: normalizeScore(vector.controlModeling?.score),
    crossDomain: normalizeScore(vector.crossDomainTransfer?.score),
    design: normalizeScore(vector.parameterDesign?.score),
    analysis: normalizeScore(vector.selfDirectedLearning?.score),
    evaluation: normalizeScore(vector.engineeringDecision?.score),
  };
}

function buildMissingContext(input: {
  learnerStateEnabled: boolean;
  learnerState: AdaptiveLearnerState | null;
  planContext: KonlingPlanContext;
  memory: KonlingMemoryView[];
}): string[] {
  return [
    !input.learnerStateEnabled ? ADAPTIVE_LEARNER_STATE_FEATURE_FLAG : null,
    input.learnerStateEnabled && !input.learnerState ? 'learner-state-read-failed' : null,
    input.planContext.status === 'missing' ? 'plan-context-missing' : null,
    input.memory.length === 0 ? 'learning-memory-empty' : null,
  ].filter((item): item is string => Boolean(item));
}

function buildWhyNow(decision: InterventionDecision, state: StudentState): string {
  if (decision.reason === 'constraint_violation') return '最近一次尝试触及约束边界，继续调参可能扩大风险。';
  if (decision.reason === 'multiple_failures') return `已经出现 ${state.attemptHistory.filter((attempt) => !attempt.isSuccessful).length} 次失败尝试，需要先重建策略。`;
  if (decision.reason === 'stagnation') return '最近几次尝试指标改善不足，学习者可能陷入低收益搜索。';
  return '当前不需要主动干预。';
}

function resolveServerTeacherPolicy(_scope: KonlingRuntimeScope): 'allowed' | 'blocked' {
  return 'allowed';
}

function buildInterventionEvidence(state: StudentState): unknown[] {
  return state.attemptHistory.slice(-3).map((attempt) => ({
    attemptNumber: attempt.attemptNumber,
    isSuccessful: attempt.isSuccessful,
    result: redactSensitivePayload(attempt.result),
  }));
}

function formatSimulationStatus(state: Partial<SimulationStateStore>) {
  return {
    status: state.isRunning ? (state.isPaused ? '已暂停' : '运行中') : '已停止',
    time: formatNumberWithUnit(state.time, '秒', 1),
    position: {
      x: formatNumberWithUnit(state.position?.x, '米', 1),
      z: formatNumberWithUnit(state.position?.z, '米', 1),
    },
    heading: formatNumberWithUnit(state.heading, '°', 1),
    targetHeading: formatNumberWithUnit(state.targetHeading, '°', 1),
    rudder: formatNumberWithUnit(state.rudder, '°', 1),
    speed: formatNumberWithUnit(state.speed, 'm/s', 1),
    pidGains: {
      Kp: state.pidGains?.kp ?? null,
      Ki: state.pidGains?.ki ?? null,
      Kd: state.pidGains?.kd ?? null,
    },
    nomotoModel: {
      K: state.nomotoParams?.K ?? null,
      T: formatNumberWithUnit(state.nomotoParams?.T, '秒', 0),
    },
    seaState: {
      level: typeof state.seaState?.level === 'number' ? `${state.seaState.level} 级` : '不可用',
      waveHeight: formatNumberWithUnit(state.seaState?.waveHeight, '米', 1),
      windSpeed: formatNumberWithUnit(state.seaState?.windSpeed, 'm/s', 1),
    },
    metrics: {
      avgError: formatNumberWithUnit(state.metrics?.avgError, '米', 1),
      maxRudderRate: formatNumberWithUnit(state.metrics?.maxRudderRate, '°/s', 2),
      currentError: formatNumberWithUnit(state.metrics?.currentError, '米', 1),
    },
  };
}

function formatUnavailableSimulationStatus(scope: KonlingRuntimeScope) {
  return {
    unavailable: true,
    reason: '当前 Konling runtime 未提供资源范围内的仿真状态。',
    resourceId: scope.resourceId ?? null,
    ...formatSimulationStatus({}),
  };
}

function formatNumberWithUnit(value: number | undefined, unit: string, digits: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '不可用';
  const separator = unit === '°' ? '' : ' ';
  return `${value.toFixed(digits)}${separator}${unit}`;
}

function redactSensitivePayload(value: unknown, _allowedScopes: readonly string[] = ['student-visible']): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitivePayload(item, _allowedScopes));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (/rawDialogue|answerData|privateLearnerEvidence|hiddenEvaluation|konlingMemory|promptContent|messages/i.test(key)) {
      continue;
    }
    redacted[key] = redactSensitivePayload(child, _allowedScopes);
  }
  return redacted;
}

function toMemoryView(memory: unknown): KonlingMemoryView {
  return {
    id: getString(memory, 'id'),
    memoryType: getString(memory, 'memoryType'),
    privacyScope: getString(memory, 'privacyScope'),
    summary: sanitizeMemorySummary(getString(memory, 'summary')),
    evidenceRefs: Array.isArray(getValue(memory, 'evidenceRefs')) ? getValue(memory, 'evidenceRefs') as unknown[] : [],
    createdAt: toIsoOrNull(getValue(memory, 'createdAt')) ?? new Date(0).toISOString(),
  };
}

function sanitizeMemorySummary(value: string): string {
  return summarizeText(
    value
      .replace(/\b(rawDialogue|answerData|privateLearnerEvidence|hiddenEvaluation|promptContent|messages)\b/gi, '[redacted]')
      .replace(/\s+/g, ' ')
      .trim(),
    500,
  );
}

function buildNonVerbatimSessionSummaries(input: {
  courseId: string;
  pageId: string;
  userMessage: string;
  assistantMessage: string;
}) {
  const userIntent = classifyLearningIntent(input.userMessage);
  const supportKind = classifyAssistantSupport(input.assistantMessage);
  const topic = `${input.courseId}/${input.pageId}`;
  return {
    working: `本轮 Konling 支持发生在 ${topic}，学习者意图为 ${userIntent}，系统支持类型为 ${supportKind}。`,
    session: `会话摘要：${topic} 中出现一次 ${userIntent} 请求，Konling 采用 ${supportKind} 方式回应。`,
    episodic: `学习片段：学习者在 ${topic} 主动请求 ${userIntent} 支持。`,
  };
}

function classifyLearningIntent(text: string): string {
  if (/错|失败|不会|不懂|卡住|why|原因|error|fail/i.test(text)) return '困惑澄清';
  if (/下一步|建议|怎么做|路径|推荐|next/i.test(text)) return '下一步规划';
  if (/公式|推导|证明|计算|算/i.test(text)) return '计算推理';
  if (/参数|仿真|超调|稳定|裕度|pid/i.test(text)) return '仿真调参';
  return '一般学习咨询';
}

function classifyAssistantSupport(text: string): string {
  if (/步骤|先|再|最后|1\.|2\./i.test(text)) return '分步脚手架';
  if (/原因|因为|证据|显示/i.test(text)) return '证据解释';
  if (/建议|可以|尝试|下一步/i.test(text)) return '行动建议';
  return '概念说明';
}

function summarizeText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function normalizeScore(value: unknown): number {
  return typeof value === 'number' ? Math.max(0, Math.min(1, value / 100)) : 0.5;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getValue(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

function getString(value: unknown, key: string): string {
  const child = getValue(value, key);
  return typeof child === 'string' ? child : '';
}

function toIsoOrNull(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }
  return null;
}

export class KonlingRuntimeScopeError extends Error {
  constructor(
    readonly status: 400 | 403 | 404,
    message: string,
  ) {
    super(message);
    this.name = 'KonlingRuntimeScopeError';
  }
}
