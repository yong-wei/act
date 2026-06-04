import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isControlCorrectionPathRoundPersistenceEnabled } from '@/lib/control-correction-path-rounds';

export type LearningPathRequesterRole = 'student' | 'teacher' | 'admin';

export interface LearningPathRequester {
  userId: string;
  role: LearningPathRequesterRole;
}

export async function getLearningPathRequester(): Promise<LearningPathRequester | NextResponse> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  return {
    userId: session.user.id,
    role: normalizeRole(session.user.role),
  };
}

export async function readPathForAccess(pathId: string): Promise<any | NextResponse> {
  const featureDisabled = ensureControlCorrectionPathRoutesEnabled();
  if (featureDisabled) return featureDisabled;

  const path = await prisma.learningPath.findUnique({
    where: { id: pathId },
    select: {
      id: true,
      userId: true,
      classId: true,
      goalId: true,
      pathStatus: true,
      nodeIds: true,
      pathPayload: true,
    },
  });
  if (!path) {
    return NextResponse.json({ error: '学习路径不存在' }, { status: 404 });
  }
  const invalidGoal = ensureControlCorrectionPath(path);
  if (invalidGoal) return invalidGoal;
  return path;
}

export function ensureControlCorrectionPathRoutesEnabled(): NextResponse | null {
  if (isControlCorrectionPathRoundPersistenceEnabled()) return null;
  return NextResponse.json({
    error: 'CONTROL_CORRECTION_PATH_ROUNDS_DISABLED',
    fallback: 'legacy-recommendation-consumers',
  }, { status: 503 });
}

export function ensureControlCorrectionPath(path: { goalId?: string | null }): NextResponse | null {
  if (path.goalId === 'control-correction') return null;
  return NextResponse.json({ error: '该接口仅支持 control-correction 学习路径' }, { status: 404 });
}

export async function assertPathRoundIdAvailable(
  input: { pathId: string; studentUserId: string },
): Promise<NextResponse | null> {
  const existing = await prisma.learningPath.findUnique({
    where: { id: input.pathId },
    select: { id: true, userId: true, goalId: true },
  });
  if (!existing) return null;
  if (existing.userId === input.studentUserId && existing.goalId === 'control-correction') {
    return null;
  }
  return NextResponse.json({ error: '学习路径 id 已被其他路径占用' }, { status: 409 });
}

export async function assertCanReadPath(
  requester: LearningPathRequester,
  path: { userId: string; classId?: string | null },
): Promise<NextResponse | null> {
  if (requester.role === 'admin' || requester.userId === path.userId) return null;
  if (requester.role !== 'teacher') {
    return NextResponse.json({ error: '无权访问该学习路径' }, { status: 403 });
  }
  if (!path.classId) {
    return NextResponse.json({ error: '该学习路径缺少班级授权范围' }, { status: 403 });
  }
  const classData = await prisma.class.findUnique({
    where: { id: path.classId },
    select: { id: true, teacherId: true },
  });
  if (!classData || classData.teacherId !== requester.userId) {
    return NextResponse.json({ error: '无权访问该班级学习路径' }, { status: 403 });
  }
  return null;
}

export async function assertCanUseClassScope(
  requester: LearningPathRequester,
  classId?: string | null,
): Promise<NextResponse | null> {
  if (requester.role === 'admin' || requester.role === 'student') return null;
  if (!classId) {
    return NextResponse.json({ error: '教师创建学习路径需要班级授权范围' }, { status: 403 });
  }
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, teacherId: true },
  });
  if (!classData || classData.teacherId !== requester.userId) {
    return NextResponse.json({ error: '无权为该班级创建学习路径' }, { status: 403 });
  }
  return null;
}

export async function resolvePathRoundClassScope(
  requester: LearningPathRequester,
  input: { studentUserId: string; requestedClassId?: string | null },
): Promise<string | null | NextResponse> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: input.studentUserId },
    select: { userId: true, classId: true },
  });
  const studentClassId = profile?.classId ?? null;

  if (requester.role === 'student') {
    if (requester.userId !== input.studentUserId) {
      return NextResponse.json({ error: '无权为其他学生创建学习路径' }, { status: 403 });
    }
    if (input.requestedClassId && input.requestedClassId !== studentClassId) {
      return NextResponse.json({ error: '无权指定该班级学习路径' }, { status: 403 });
    }
    return studentClassId;
  }

  if (requester.role === 'teacher') {
    if (!input.requestedClassId) {
      return NextResponse.json({ error: '教师创建学习路径需要班级授权范围' }, { status: 403 });
    }
    if (studentClassId !== input.requestedClassId) {
      return NextResponse.json({ error: '目标学生不属于该班级' }, { status: 403 });
    }
    const denied = await assertCanUseClassScope(requester, input.requestedClassId);
    return denied ?? input.requestedClassId;
  }

  if (input.requestedClassId && studentClassId !== input.requestedClassId) {
    return NextResponse.json({ error: '目标学生不属于该班级' }, { status: 403 });
  }
  return input.requestedClassId ?? studentClassId;
}

export function assertCanWriteStudentPath(
  requester: LearningPathRequester,
  path: { userId: string },
): NextResponse | null {
  if (requester.role === 'admin' || requester.userId === path.userId) return null;
  return NextResponse.json({ error: '无权写入该学习路径' }, { status: 403 });
}

function normalizeRole(role: string | undefined): LearningPathRequesterRole {
  if (role === 'ADMIN') return 'admin';
  if (role === 'TEACHER') return 'teacher';
  return 'student';
}
