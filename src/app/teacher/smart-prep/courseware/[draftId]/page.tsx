import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import {
  SmartCoursewareEditor,
  SmartCoursewareProjectionEditor,
} from '@/features/teacher/smart-courseware-editor';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildSmartCoursewareDraftCreationKey,
  createSmartCoursewareDraft,
  getCoursewareGenerationJob,
  getSmartCoursewareDraft,
  getSmartCoursewareStudentProjection,
  getSmartCoursewareTeacherProjection,
  SmartCoursewareError,
} from '@/lib/smart-courseware';
import { resolveSmartCoursewareOrderingSecret } from '@/lib/smart-courseware/student-projection-secret';

export const dynamic = 'force-dynamic';

export default async function SmartCoursewareEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ planRevisionId?: string; creationIntentId?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect('/login');
  if (session.user.role !== UserRole.TEACHER) redirect(session.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');

  const [{ draftId }, query] = await Promise.all([params, searchParams]);
  const actor = { id: session.user.id, role: 'TEACHER' as const };
  const planRevisionId = query.planRevisionId?.trim() || null;
  if (draftId === 'new') {
    const creationIntentId = query.creationIntentId?.trim() || null;
    if (!planRevisionId || !creationIntentId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creationIntentId)) {
      redirect('/teacher/smart-prep');
    }
    const draft = await createSmartCoursewareDraft(prisma, {
      actor,
      planRevisionId,
      idempotencyKey: buildSmartCoursewareDraftCreationKey(planRevisionId, creationIntentId),
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
  const approvedCoursewareRevision = draft.state === 'ACCEPTED'
    ? await prisma.smartCoursewareRevision.findFirst({
        where: { ownerId: actor.id, draftId: draft.id },
        select: { id: true },
      })
    : null;
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

  const teacherProjection = await getSmartCoursewareTeacherProjection(prisma, { actor, draftId });
  let studentProjection = null;
  try {
    studentProjection = await getSmartCoursewareStudentProjection(
      prisma,
      { actor, draftId },
      { orderingPermutationSecret: resolveSmartCoursewareOrderingSecret() },
    );
  } catch (error) {
    if (!(error instanceof SmartCoursewareError && error.code === 'courseware-ordering-secret-unavailable')) throw error;
  }
  return (
    <SmartCoursewareProjectionEditor
      teacherProjection={teacherProjection}
      studentProjection={studentProjection}
      state={draft.state === 'ACCEPTED' ? 'accepted' : 'ready'}
      stalePlan={stalePlan}
      initialJob={initialJob}
      sourceRevisionId={approvedCoursewareRevision?.id ?? null}
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
