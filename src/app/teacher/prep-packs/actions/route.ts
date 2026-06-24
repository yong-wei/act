import { UserRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  activatePersistedCourseEnhancementPack,
  archivePersistedCourseEnhancementPack,
  loadCourseEnhancementPack,
  persistCourseEnhancementPack,
  recordCourseEnhancementPackImpactEvidence,
  rollbackPersistedCourseEnhancementPack,
  type CourseEnhancementPack,
  type CourseEnhancementRuntimeContext,
} from '@/lib/data-governance/teacher-prep-pack-generation';
import { prisma } from '@/lib/prisma';

type PrepPackAction = 'preview' | 'activate' | 'rollback' | 'archive' | 'impact-evidence';

export async function POST(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return redirectToReview(request, 'unauthorized');
  }
  if (session.user.role !== UserRole.TEACHER) {
    return redirectToReview(request, 'forbidden');
  }

  const formData = await request.formData();
  const packId = formString(formData, 'packId');
  const action = formString(formData, 'action') as PrepPackAction;
  if (!packId || !isPrepPackAction(action)) {
    return redirectToReview(request, 'invalid-action');
  }

  const pack = await loadCourseEnhancementPack(prisma, packId);
  if (!pack || pack.teacherId !== session.user.id) {
    return redirectToReview(request, 'not-found');
  }

  try {
    if (action === 'activate') {
      await activatePersistedCourseEnhancementPack({
        client: prisma,
        packId,
        teacherId: session.user.id,
        runtimeContext: await loadRuntimeContextForPack(pack),
      });
    } else if (action === 'rollback') {
      if (!hasActiveOverlay(pack)) {
        return redirectToReview(request, 'invalid-lifecycle', packId);
      }
      await rollbackPersistedCourseEnhancementPack({
        client: prisma,
        packId,
        teacherId: session.user.id,
        reason: formString(formData, 'reason') || 'Teacher rolled back prep-pack overlay',
      });
    } else if (action === 'archive') {
      if (pack.status === 'archived') {
        return redirectToReview(request, 'invalid-lifecycle', packId);
      }
      await archivePersistedCourseEnhancementPack({
        client: prisma,
        packId,
        teacherId: session.user.id,
        reason: formString(formData, 'reason') || 'Teacher archived prep-pack overlay',
      });
    } else if (action === 'impact-evidence') {
      const itemId = formString(formData, 'itemId') || pack.items[0]?.id || '';
      if (!isActiveOverlayItem(pack, itemId)) {
        return redirectToReview(request, 'invalid-lifecycle', packId);
      }
      await persistCourseEnhancementPack(prisma, recordCourseEnhancementPackImpactEvidence({
        pack,
        itemId,
        evidenceRef: {
          sourceType: 'teacher-observation',
          sourceId: `teacher-prep-pack:${packId}:impact:${Date.now()}`,
          displayTitle: '教师课前包影响观察',
          collectedAt: new Date().toISOString(),
          safeForTeacherReport: true,
        },
        teacherFeedback: {
          teacherId: session.user.id,
          note: formString(formData, 'reason') || 'Teacher recorded prep-pack impact evidence',
          recordedAt: new Date().toISOString(),
        },
      }));
    }
  } catch (error) {
    return redirectToReview(request, 'action-failed', packId, error);
  }

  revalidatePath('/teacher/prep-packs');
  return redirectToReview(request, action, packId);
}

async function loadRuntimeContextForPack(pack: CourseEnhancementPack): Promise<CourseEnhancementRuntimeContext> {
  const [lessonPlan, sessions] = await Promise.all([
    prisma.lessonPlan.findUnique({
      where: { id: pack.lessonId },
      select: {
        id: true,
        items: {
          select: {
            id: true,
            stage: true,
            resourceId: true,
            knowledgeNodeId: true,
            resource: { select: { registryId: true } },
          },
        },
      },
    }),
    prisma.classSession.findMany({
      where: { classId: pack.classId, planId: pack.lessonId },
      select: { id: true, currentItemId: true },
    }),
  ]);

  const stageById = new Map<string, CourseEnhancementRuntimeContext['stages'][number]>();
  const lessonStepIds = new Set<string>();
  const resourceNodeIds = new Set<string>();
  const classSessionIds = new Set<string>();

  for (const item of lessonPlan?.items ?? []) {
    lessonStepIds.add(item.id);
    if (item.resourceId) resourceNodeIds.add(item.resourceId);
    if (item.knowledgeNodeId) resourceNodeIds.add(item.knowledgeNodeId);
    if (item.resource?.registryId) resourceNodeIds.add(item.resource.registryId);
    const stage = item.stage as CourseEnhancementRuntimeContext['stages'][number]['stage'];
    const existing = stageById.get(String(item.stage));
    stageById.set(String(item.stage), {
      id: String(item.stage),
      stage,
      stepIds: [...(existing?.stepIds ?? []), item.id],
    });
  }

  for (const session of sessions) {
    classSessionIds.add(session.id);
    if (session.currentItemId) lessonStepIds.add(session.currentItemId);
  }

  return {
    classId: pack.classId,
    lessonId: pack.lessonId,
    stages: Array.from(stageById.values()),
    lessonStepIds: Array.from(lessonStepIds),
    resourceNodeIds: Array.from(resourceNodeIds),
    classSessionIds: Array.from(classSessionIds),
  };
}

function hasActiveOverlay(pack: CourseEnhancementPack): boolean {
  return pack.status === 'active' && pack.items.some((item) => isActiveOverlayItem(pack, item.id));
}

function isActiveOverlayItem(pack: CourseEnhancementPack, itemId: string): boolean {
  const item = pack.items.find((candidate) => candidate.id === itemId);
  return pack.status === 'active' &&
    Boolean(item?.activation.activatedAt) &&
    !item?.activation.rolledBackAt;
}

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function isPrepPackAction(action: string): action is PrepPackAction {
  return action === 'preview' ||
    action === 'activate' ||
    action === 'rollback' ||
    action === 'archive' ||
    action === 'impact-evidence';
}

function redirectToReview(
  request: NextRequest,
  status: string,
  packId?: string,
  error?: unknown,
) {
  const url = new URL('/teacher/prep-packs', request.url);
  url.searchParams.set('status', status);
  if (packId) url.searchParams.set('packId', packId);
  if (error instanceof Error) url.searchParams.set('error', error.message);
  return NextResponse.redirect(url, 303);
}
