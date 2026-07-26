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
          : sourceVersion.extractionState === 'EXTRACTED'
            && sourceVersion.reviewState !== 'REJECTED'
            && !sourceVersion.retiredAt,
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
          : sourceVersion.extractionState === 'EXTRACTED'
            && sourceVersion.reviewState !== 'REJECTED'
            && !sourceVersion.retiredAt,
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
  return compact({
    id: job.id,
    draftId: job.draftId,
    state: job.state,
    outlineConfirmation: job.outlineConfirmation,
    firstIncompleteStage: job.firstIncompleteStage,
    failureCode: job.failureCode,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
    supersededAt: job.supersededAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    stages: optionalArray(job.stages, (stage) => publicStage(recordValue(stage))),
  });
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

export function publicDraftForEditing(draft: Record<string, unknown>) {
  return {
    ...publicDraft(draft),
    content: redactPrivateFields(draft.content),
  };
}

export function publicRevision(revision: Record<string, unknown>) {
  return compact({
    id: revision.id,
    taskId: revision.taskId,
    taskRevision: revision.taskRevision,
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
  const output = publicJson(stage.output, 64_000);
  return compact({
    id: stage.id,
    kind: stage.kind,
    orderIndex: stage.orderIndex,
    state: stage.state,
    output,
    outputTruncated: stage.output != null && output == null,
    startedAt: stage.startedAt,
    completedAt: stage.completedAt,
    updatedAt: stage.updatedAt,
  });
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
