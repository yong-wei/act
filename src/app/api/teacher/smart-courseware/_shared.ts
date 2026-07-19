import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';

import { getServerAuthSession } from '@/lib/auth';
import {
  coursewareCompositionInputSchema,
  SmartCoursewareError,
  type SmartCoursewareActor,
} from '@/lib/smart-courseware';

export const coursewareIdSchema = z.string().trim().min(1).max(200);
export const coursewareIdempotencySchema = z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/);
export const createCoursewareDraftSchema = z.object({
  planRevisionId: coursewareIdSchema,
  idempotencyKey: coursewareIdempotencySchema,
}).strict();
export const updateCoursewareDraftSchema = coursewareCompositionInputSchema;
export const coursewareJobActionSchema = z.object({
  action: z.enum(['resume', 'retry', 'cancel']),
  idempotencyKey: coursewareIdempotencySchema,
}).strict();

export async function requireSmartCoursewareActor(): Promise<
  { actor: SmartCoursewareActor } | { response: NextResponse }
> {
  const session = await getServerAuthSession();
  if (!session?.user) return { response: NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 }) };
  if (session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN) {
    return { response: NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 }) };
  }
  return { actor: { id: session.user.id, role: session.user.role } };
}

export async function readCoursewareJson(request: Request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(length) && length > 1_000_000) throw new SmartCoursewareError('request-too-large', 413);
  return request.json();
}

export function smartCoursewareErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: 'invalid-input', issues: error.issues } }, { status: 400 });
  }
  if (error instanceof SmartCoursewareError) {
    return NextResponse.json({ error: { code: error.code } }, { status: error.status });
  }
  if (error instanceof SyntaxError) return NextResponse.json({ error: { code: 'invalid-json' } }, { status: 400 });
  throw error;
}

export function publicCoursewareDraft(value: unknown) {
  const draft = record(value);
  return compact({
    id: draft.id,
    planRevisionId: draft.planRevisionId,
    planRevisionNumber: draft.planRevisionNumber,
    planContentHash: draft.planContentHash,
    state: draft.state,
    version: draft.version,
    runtimeManifest: draft.runtimeManifest,
    contentHash: draft.contentHash,
    validationSnapshot: draft.validationSnapshot,
    createdAt: iso(draft.createdAt),
    updatedAt: iso(draft.updatedAt),
  });
}

export function publicCoursewareTeacherPreview(value: unknown) {
  const projection = record(value);
  return compact({
    schemaVersion: projection.schemaVersion,
    draftId: projection.draftId,
    version: projection.version,
    planRevisionId: projection.planRevisionId,
    planContentHash: projection.planContentHash,
    runtimeManifest: projection.runtimeManifest,
    moduleMetadata: projection.moduleMetadata,
    planLimitations: projection.planLimitations,
    aiReview: projection.aiReview,
    generationAudit: projection.generationAudit,
    validation: projection.validation,
  });
}

export function publicCoursewareStudentPreview(value: unknown) {
  const projection = record(value);
  return compact({
    schemaVersion: projection.schemaVersion,
    draftId: projection.draftId,
    version: projection.version,
    runtimeManifest: projection.runtimeManifest,
    notice: projection.notice,
  });
}

export function publicCoursewareJob(value: unknown) {
  const job = record(value);
  return compact({
    id: job.id,
    draftId: job.draftId,
    mode: job.mode,
    state: job.state,
    targetModuleId: job.targetModuleId,
    targetModuleHash: job.targetModuleHash,
    candidateRuntimeModule: job.candidateRuntimeModule,
    candidateModuleMetadata: job.candidateModuleMetadata,
    candidateHash: job.candidateHash,
    acceptedAt: iso(job.acceptedAt),
    firstIncompleteUnitKey: job.firstIncompleteUnitKey,
    failureCode: job.failureCode,
    deliveryGeneration: job.deliveryGeneration,
    startedAt: iso(job.startedAt),
    completedAt: iso(job.completedAt),
    cancelledAt: iso(job.cancelledAt),
    updatedAt: iso(job.updatedAt),
    units: Array.isArray(job.units) ? job.units.map((value) => {
      const unit = record(value);
      return compact({
        id: unit.id,
        unitKey: unit.unitKey,
        orderIndex: unit.orderIndex,
        state: unit.state,
        failureCode: unit.failureCode,
        startedAt: iso(unit.startedAt),
        completedAt: iso(unit.completedAt),
      });
    }) : [],
  });
}

export function publicCoursewareRevision(value: unknown) {
  const revision = record(value);
  return compact({
    id: revision.id,
    draftId: revision.draftId,
    revisionNumber: revision.revisionNumber,
    planRevisionId: revision.planRevisionId,
    planRevisionNumber: revision.planRevisionNumber,
    planContentHash: revision.planContentHash,
    manifestHash: revision.manifestHash,
    moduleMetadataHash: revision.moduleMetadataHash,
    gapsSnapshot: revision.gapsSnapshot,
    validationSnapshot: revision.validationSnapshot,
    contentHash: revision.contentHash,
    approvedAt: iso(revision.approvedAt),
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined));
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}
