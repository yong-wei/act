import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';

import { getServerAuthSession } from '@/lib/auth';
import { aggregateClassContextRefSchema, SmartLessonPlanError, sourceBindingSchema, type SmartLessonActor } from '@/lib/smart-lesson-plan';

export const idSchema = z.string().trim().min(1).max(200);
export const idempotencySchema = z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/);

export const sourceStateInputSchema = z.enum([
  'verified',
  'ai_generated_source_pending',
  'teacher_created_source_pending',
]).transform((value) => {
  // VERIFIED is server-owned. Accept the round-tripped public value for edits,
  // but treat it only as a pending hint until service-side evidence validation.
  if (value === 'verified') return 'AI_GENERATED_SOURCE_PENDING' as const;
  if (value === 'ai_generated_source_pending') return 'AI_GENERATED_SOURCE_PENDING' as const;
  if (value === 'teacher_created_source_pending') return 'TEACHER_CREATED_SOURCE_PENDING' as const;
  return 'TEACHER_CREATED_SOURCE_PENDING' as const;
});

const canonicalItemSchema = z.object({
  id: idSchema.optional(),
  lineageId: idSchema.optional(),
  content: z.string().trim().min(1).max(2000),
  sourceState: sourceStateInputSchema,
  sourceBindings: z.array(sourceBindingSchema).max(100),
}).strict();

export const createTaskSchema = z.object({
  courseBasisId: idSchema,
  topic: z.string().trim().min(1).max(500),
  audience: z.string().trim().min(1).max(1000),
  prerequisites: z.string().trim().max(5000).optional(),
  durationMinutes: z.number().int().min(30).max(120).refine((value) => value % 5 === 0),
  outlineConfirmationRequired: z.boolean().optional(),
  sourceVersionIds: z.array(idSchema).min(1).max(500),
  knowledgePoints: z.array(canonicalItemSchema.extend({
    title: z.string().trim().min(1).max(500).optional(),
    origin: z.enum(['SUGGESTED', 'TEACHER_CREATED']),
    supersedesIds: z.array(idSchema).max(100).optional(),
  }).strict()).min(1).max(100),
  goals: z.array(canonicalItemSchema.extend({
    standardsMappings: z.array(z.object({ standardId: idSchema, label: z.string().trim().min(1).max(500) }).strict()).max(100).optional(),
  }).strict()).min(1).max(100),
  aggregateClassContextRef: aggregateClassContextRefSchema.optional(),
  confirmScope: z.boolean().optional(),
  confirmGoals: z.boolean().optional(),
}).strict();

export const updateTaskSchema = createTaskSchema.extend({
  courseBasisId: idSchema.optional(),
  aggregateClassContextRef: aggregateClassContextRefSchema.nullable().optional(),
  expectedRevision: z.number().int().min(1),
  confirmingTurnId: idSchema,
  agentSessionId: idSchema.optional(),
}).strict();

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
  return compact({
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
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    sources: optionalArray(task.sources, (source) => {
      const item = recordValue(source);
      return compact({ id: item.id, sourceVersionId: item.sourceVersionId, state: item.state, selectedAt: item.selectedAt, removedAt: item.removedAt });
    }),
    knowledgePoints: optionalArray(task.knowledgePoints, publicKnowledgePoint),
    goals: optionalArray(task.goals, publicGoal),
    drafts,
    revisions: optionalArray(task.revisions, (revision) => publicRevision(recordValue(revision))),
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

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function optionalArray<T>(value: unknown, project: (item: unknown) => T): T[] | undefined {
  return Array.isArray(value) ? value.map(project) : undefined;
}

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined));
}
