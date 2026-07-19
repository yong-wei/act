import { createHash } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import {
  SmartCoursewareEditor,
  SmartCoursewareProjectionEditor,
} from '@/features/teacher/smart-courseware-editor';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createSmartCoursewareDraft,
  getCoursewareGenerationJob,
  getSmartCoursewareDraft,
  getSmartCoursewareStudentProjection,
  getSmartCoursewareTeacherProjection,
} from '@/lib/smart-courseware';

export const dynamic = 'force-dynamic';

export default async function SmartCoursewareEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ planRevisionId?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect('/login');
  if (session.user.role !== UserRole.TEACHER) redirect(session.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');

  const [{ draftId }, query] = await Promise.all([params, searchParams]);
  const actor = { id: session.user.id, role: 'TEACHER' as const };
  const planRevisionId = query.planRevisionId?.trim() || null;
  if (draftId === 'new') {
    if (!planRevisionId) redirect('/teacher/smart-prep');
    const draft = await createSmartCoursewareDraft(prisma, {
      actor,
      planRevisionId,
      idempotencyKey: `courseware-editor:${createHash('sha256').update(planRevisionId).digest('hex')}`,
    });
    redirect(`/teacher/smart-prep/courseware/${encodeURIComponent(draft.id)}`);
  }

  const draft = await getSmartCoursewareDraft(prisma, { actor, draftId });
  const latestJobReference = await prisma.smartCoursewareGenerationJob.findFirst({
    where: { draftId: draft.id, ownerId: actor.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const initialJob = latestJobReference
    ? toInitialJob(await getCoursewareGenerationJob(prisma, { actor, jobId: latestJobReference.id }))
    : undefined;
  const latestApprovedRevision = await prisma.smartLessonRevision.findFirst({
    where: { ownerId: actor.id, taskId: draft.planRevision.taskId },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true, contentHash: true },
  });
  const stalePlan = Boolean(latestApprovedRevision && (
    draft.planRevisionNumber !== latestApprovedRevision.revisionNumber
    || draft.planContentHash !== latestApprovedRevision.contentHash
  ));
  if (!draft.runtimeManifest) {
    const initialEnvelope = {
      draftId: draft.id,
      planRevisionId: draft.planRevisionId,
      version: draft.version,
      state: draft.state === 'GENERATING' ? 'generating' as const : 'waiting-for-generation' as const,
      manifest: null,
      stalePlan,
      teacherModules: {},
      compositionMetadata: [],
      planLimitations: [],
      aiReview: null,
      generationAudit: [],
    };
    return <SmartCoursewareEditor initialEnvelope={initialEnvelope} initialJob={initialJob} />;
  }

  const [teacherProjection, studentProjection] = await Promise.all([
    getSmartCoursewareTeacherProjection(prisma, { actor, draftId }),
    getSmartCoursewareStudentProjection(prisma, { actor, draftId }),
  ]);
  return (
    <SmartCoursewareProjectionEditor
      teacherProjection={teacherProjection}
      studentProjection={studentProjection}
      state={draft.state === 'ACCEPTED' ? 'accepted' : 'ready'}
      stalePlan={stalePlan}
      initialJob={initialJob}
    />
  );
}

function toInitialJob(job: Awaited<ReturnType<typeof getCoursewareGenerationJob>>) {
  return {
    id: job.id,
    draftId: job.draftId,
    state: job.state,
    mode: job.mode,
    targetModuleId: job.targetModuleId ?? undefined,
    targetModuleHash: job.targetModuleHash ?? undefined,
    candidateRuntimeModule: job.candidateRuntimeModule ?? undefined,
    candidateModuleMetadata: job.candidateModuleMetadata ?? undefined,
    candidateHash: job.candidateHash ?? undefined,
    acceptedAt: job.acceptedAt?.toISOString() ?? null,
    firstIncompleteUnitKey: job.firstIncompleteUnitKey ?? undefined,
    failureCode: job.failureCode,
    units: job.units.map((unit) => ({
      id: unit.id,
      unitKey: unit.unitKey,
      orderIndex: unit.orderIndex,
      state: unit.state,
    })),
  };
}
