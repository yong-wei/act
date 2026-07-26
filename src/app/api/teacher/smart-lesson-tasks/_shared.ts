import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { getServerAuthSession } from '@/lib/auth';
import {
  SmartLessonPlanError,
  projectSmartPreparationTask,
  type SmartLessonActor,
} from '@/lib/smart-lesson-plan';

export {
  createTaskSchema,
  idempotencySchema,
  idSchema,
  sourceStateInputSchema,
  updateTaskSchema,
} from '@/lib/smart-lesson-plan/task-input-schema';

export async function requireSmartLessonActor(): Promise<
  { actor: SmartLessonActor } | { response: NextResponse }
> {
  const session = await getServerAuthSession();
  if (!session?.user) return { response: NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 }) };
  if (session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN) {
    return { response: NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 }) };
  }
  return { actor: { id: session.user.id, role: session.user.role } };
}

export async function readStrictJson(request: Request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(length) && length > 1_000_000) throw new SmartLessonPlanError('request-too-large', 413);
  return request.json();
}

export function smartLessonErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: 'invalid-input', issues: error.issues } }, { status: 400 });
  }
  if (error instanceof SmartLessonPlanError) {
    return NextResponse.json({ error: { code: error.code } }, { status: error.status });
  }
  if (error instanceof SyntaxError) return NextResponse.json({ error: { code: 'invalid-json' } }, { status: 400 });
  throw error;
}

export function publicTask(task: Record<string, unknown>) {
  const drafts = optionalArray(task.drafts, (draft) => publicDraft(recordValue(draft)));
  const projected = compact({
    id: task.id,
    courseBasisId: task.courseBasisId,
    lineageId: task.lineageId,
    topic: task.topic,
    audience: task.audience,
    prerequisites: task.prerequisites,
    durationMinutes: task.durationMinutes,
    outlineConfirmationRequired: task.outlineConfirmationRequired,
    scopeConfirmedAt: task.scopeConfirmedAt,
    goalsConfirmedAt: task.goalsConfirmedAt,
    aggregateClassContextRef: task.aggregateClassContextRef,
    revision: task.revision,
    archivedAt: task.archivedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    sources: optionalArray(task.sources, (source) => {
      const item = recordValue(source);
      const sourceVersion = recordValue(item.sourceVersion);
      return compact({
        id: item.id,
        sourceVersionId: item.sourceVersionId,
        state: item.state,
        sourceValid: sourceVersion.reviewState === undefined
          ? true
          : sourceVersion.reviewState === 'CONFIRMED' && !sourceVersion.retiredAt,
        selectedAt: item.selectedAt,
        removedAt: item.removedAt,
      });
    }),
    knowledgePoints: optionalArray(task.knowledgePoints, publicKnowledgePoint),
    goals: optionalArray(task.goals, publicGoal),
    drafts,
    revisions: optionalArray(task.revisions, (revision) => publicRevision(recordValue(revision))),
    coursewarePublicationSeries: publicPublicationSeries(task.coursewarePublicationSeries),
  });
  return { ...projected, workspace: projectSmartPreparationTask(projected) };
}

export function publicTaskSummary(task: Record<string, unknown>) {
  const workspace = projectSmartPreparationTask({
    ...task,
    sources: optionalArray(task.sources, (source) => {
      const item = recordValue(source);
      const sourceVersion = recordValue(item.sourceVersion);
      return {
        state: item.state,
        sourceValid: sourceVersion.reviewState === undefined
          ? true
          : sourceVersion.reviewState === 'CONFIRMED' && !sourceVersion.retiredAt,
      };
    }),
  });
  const currentStage = workspace.stages.find((stage) => stage.id === workspace.currentStage);
  return compact({
    id: task.id,
    courseBasisId: task.courseBasisId,
    topic: task.topic,
    audience: task.audience,
    durationMinutes: task.durationMinutes,
    revision: task.revision,
    archivedAt: task.archivedAt,
    updatedAt: task.updatedAt,
    currentStage: workspace.currentStage,
    currentStageTitle: currentStage?.title,
    statusLabel: workspace.statusLabel,
    nextAction: currentStage?.nextAction,
    blockingReason: currentStage?.blockingReason,
    complete: workspace.stages.every((stage) => stage.complete),
  });
}

export function normalizeSourceStatesForService(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSourceStatesForService);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => {
    if (key !== 'sourceState') return [key, normalizeSourceStatesForService(child)];
    if (child === 'verified') return [key, 'VERIFIED'];
    if (child === 'ai_generated_source_pending') return [key, 'AI_GENERATED_SOURCE_PENDING'];
    if (child === 'teacher_created_source_pending') return [key, 'TEACHER_CREATED_SOURCE_PENDING'];
    throw new SmartLessonPlanError('invalid-public-source-state', 400);
  }));
}

function publicJson(value: unknown, maximumBytes = 512_000): unknown {
  if (value === undefined) return undefined;
  const redacted = redactPrivateFields(value);
  try {
    return JSON.stringify(redacted).length <= maximumBytes ? redacted : null;
  } catch {
    return null;
  }
}

function redactPrivateFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPrivateFields);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const forbidden = new Set(['providerAudit', 'request', 'resultSnapshot', 'aggregateClassContext']);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !forbidden.has(key))
      .map(([key, child]) => [key, key === 'sourceState' ? publicSourceState(child) : redactPrivateFields(child)]),
  );
}

function publicSourceState(value: unknown) {
  if (value === 'VERIFIED') return 'verified';
  if (value === 'AI_GENERATED_SOURCE_PENDING') return 'ai_generated_source_pending';
  if (value === 'TEACHER_CREATED_SOURCE_PENDING') return 'teacher_created_source_pending';
  return value;
}

export function publicJob(job: Record<string, unknown>) {
  const failureCode = publicGenerationFailureCode(job.failureCode);
  return compact({
    id: job.id,
    draftId: job.draftId,
    state: job.state,
    outlineConfirmation: job.outlineConfirmation,
    firstIncompleteStage: job.firstIncompleteStage,
    failureCode,
    failureMessage: typeof job.failureCode === 'string'
      ? localizedGenerationFailure(failureCode ?? 'unknown-generation-failure')
      : undefined,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
    supersededAt: job.supersededAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    stages: optionalArray(job.stages, (stage) => publicStage(recordValue(stage))),
  });
}

const PUBLIC_GENERATION_FAILURE_CODES = new Set([
  'provider-timeout',
  'provider-output-invalid-after-correction',
  'queue-unavailable',
  'governed-source-evidence-unavailable',
]);

function publicGenerationFailureCode(value: unknown) {
  return typeof value === 'string' && PUBLIC_GENERATION_FAILURE_CODES.has(value)
    ? value
    : undefined;
}

export function publicDraft(draft: Record<string, unknown>) {
  return compact({
    id: draft.id,
    taskId: draft.taskId,
    state: draft.state,
    version: draft.version,
    content: publicJson(draft.content),
    contentHash: draft.contentHash,
    basedOnRevisionId: draft.basedOnRevisionId,
    approvedRevisionNumber: draft.approvedRevisionNumber,
    staleDownstreamAt: draft.staleDownstreamAt,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    jobs: optionalArray(draft.jobs, (job) => publicJob(recordValue(job))),
    reviews: optionalArray(draft.reviews, (review) => {
      const item = recordValue(review);
      return compact({ id: item.id, contentHash: item.contentHash, state: item.state, failureCode: item.failureCode, report: publicJson(item.report, 128_000), advisoryOnly: item.advisoryOnly, createdAt: item.createdAt, completedAt: item.completedAt });
    }),
  });
}

export function publicRevision(revision: Record<string, unknown>) {
  return compact({
    id: revision.id,
    taskId: revision.taskId,
    draftId: revision.draftId,
    revisionNumber: revision.revisionNumber,
    displayName: revision.displayName,
    content: publicJson(revision.content),
    contentHash: revision.contentHash,
    approvedById: revision.approvedById,
    approvedAt: revision.approvedAt,
  });
}

function publicStage(stage: Record<string, unknown>) {
  const completed = stage.state === 'COMPLETED';
  const output = completed ? publicJson(stage.output, 64_000) : undefined;
  const actionState = generationActionState(stage.actionState, stage.state);
  return compact({
    id: stage.id,
    kind: stage.kind,
    orderIndex: stage.orderIndex,
    state: stage.state,
    title: GENERATION_STAGE_TITLES[String(stage.kind)] ?? '未知阶段',
    actionState,
    actionLabel: GENERATION_ACTION_LABELS[actionState],
    output,
    outputTruncated: completed && stage.output != null && output == null,
    startedAt: stage.startedAt,
    completedAt: stage.completedAt,
    updatedAt: stage.updatedAt,
  });
}

const GENERATION_STAGE_TITLES: Record<string, string> = {
  OUTLINE: '提纲',
  BRIDGE_IN: '导入',
  OBJECTIVES: '学习目标',
  PRE_ASSESSMENT: '前测',
  PARTICIPATORY_LEARNING: '参与式学习',
  POST_ASSESSMENT: '后测',
  SUMMARY: '总结',
};

const GENERATION_ACTION_LABELS: Record<string, string> = {
  WAITING: '等待开始',
  PREPARING_EVIDENCE: '正在准备依据',
  GENERATING: '正在生成',
  VALIDATING: '正在校验',
  AUTO_FIXING: '正在自动修正',
  WAITING_CONFIRMATION: '等待教师确认',
  RETRYABLE: '可重试',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

function generationActionState(actionState: unknown, stageState: unknown) {
  if (typeof actionState === 'string' && GENERATION_ACTION_LABELS[actionState]) return actionState;
  if (stageState === 'RUNNING') return 'GENERATING';
  if (stageState === 'PAUSED') return 'WAITING_CONFIRMATION';
  if (stageState === 'RETRYABLE' || stageState === 'FAILED') return 'RETRYABLE';
  if (stageState === 'COMPLETED') return 'COMPLETED';
  if (stageState === 'CANCELLED') return 'CANCELLED';
  return 'WAITING';
}

function localizedGenerationFailure(code: string | undefined) {
  if (!code) return undefined;
  if (code === 'provider-timeout') return '生成服务响应超时，请重试当前阶段。';
  if (code === 'provider-output-invalid-after-correction') return '自动修正后内容仍未通过校验，请重试当前阶段。';
  if (code === 'queue-unavailable') return '生成队列暂不可用，请稍后重试。';
  if (code === 'governed-source-evidence-unavailable') return '当前课程依据不可用，请检查依据后重试。';
  return '当前阶段未能完成，请重试；若问题持续存在，请联系管理员。';
}

function publicKnowledgePoint(value: unknown) {
  const item = recordValue(value);
  return compact({
    id: item.id, lineageId: item.lineageId, state: item.state, title: item.title,
    sourceState: publicSourceState(item.sourceState), sourceBindings: publicJson(item.sourceBindings, 64_000),
    gapIdentity: item.gapIdentity, origin: item.origin, supersedesIds: item.supersedesIds,
    confirmedAt: item.confirmedAt, removedAt: item.removedAt, createdAt: item.createdAt, updatedAt: item.updatedAt,
  });
}

function publicGoal(value: unknown) {
  const item = recordValue(value);
  return compact({
    id: item.id, lineageId: item.lineageId, state: item.state, content: item.content,
    sourceState: publicSourceState(item.sourceState), sourceBindings: publicJson(item.sourceBindings, 64_000),
    gapIdentity: item.gapIdentity, standardsMappings: publicJson(item.standardsMappings, 64_000),
    confirmedAt: item.confirmedAt, removedAt: item.removedAt, createdAt: item.createdAt, updatedAt: item.updatedAt,
  });
}

function publicPublicationSeries(value: unknown) {
  const item = recordValue(value);
  if (!item.id && !Array.isArray(item.revisions)) return undefined;
  return compact({
    id: item.id,
    revisions: optionalArray(item.revisions, (revision) => {
      const record = recordValue(revision);
      return compact({ id: record.id, revisionNumber: record.revisionNumber, publishedAt: record.publishedAt });
    }),
  });
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function optionalArray<T>(value: unknown, project: (item: unknown) => T): T[] | undefined {
  return Array.isArray(value) ? value.map(project) : undefined;
}

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined));
}
