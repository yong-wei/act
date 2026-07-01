import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { getServerAuthSession } from '@/lib/auth';
import { recordPathIntervention } from '@/lib/control-correction-path-rounds';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  buildTeacherEvidenceInterventionAction,
  buildTeacherEvidenceInterventionOutboxRow,
  type TeacherEvidenceInterventionOutboxRow,
  type TeacherEvidenceInterventionInput,
  type TeacherEvidenceInterventionKind,
  type TeacherEvidenceInterventionSurface,
} from '@/lib/teacher-evidence-intervention-contract';

export const dynamic = 'force-dynamic';

const INTERVENTION_KINDS = new Set<TeacherEvidenceInterventionKind>([
  'feedback',
  'grading-writeback',
  'reinforcement-task',
  'remedial-path',
]);
const INTERVENTION_SURFACES = new Set<TeacherEvidenceInterventionSurface>([
  'report-ledger',
  'grading-workbench',
  'teacher-evidence',
  'classroom-review',
]);

function toEvidenceOutboxCreateManyRow(
  row: TeacherEvidenceInterventionOutboxRow,
): Prisma.EvidenceOutboxCreateManyInput {
  return {
    ...row,
    payload: row.payload as Prisma.InputJsonValue,
  };
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '只有教师或管理员可以创建证据处置' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = parseTeacherEvidenceInterventionBody(body);
    if (!parsed) {
      return NextResponse.json({ error: '教师证据处置参数无效' }, { status: 400 });
    }
    const scopeDenied = await assertTeacherCanWriteInterventionScope(parsed, session.user.id, session.user.role);
    if (scopeDenied) return scopeDenied;

    const draftAction = buildTeacherEvidenceInterventionAction({
      ...parsed,
      teacherId: session.user.id,
      actorRole: session.user.role,
    });
    if (draftAction.status === 'blocked') {
      return NextResponse.json({ action: draftAction }, { status: 422 });
    }
    if (!parsed.studentId) {
      return NextResponse.json({
        action: draftAction,
        outbox: 'non-writeback',
        error: '班级级报告处置需要先选择学生，不能创建学生证据写回记录',
      }, { status: 422 });
    }

    if (draftAction.persistenceTarget === 'LearningPathIntervention' && parsed.pathId) {
      const path = await prisma.learningPath.findFirst({
        where: {
          id: parsed.pathId,
          userId: parsed.studentId ?? undefined,
        },
        select: {
          id: true,
          userId: true,
          goalId: true,
        },
      });
      if (!path) {
        const reduced = buildTeacherEvidenceInterventionAction({
          ...parsed,
          teacherId: session.user.id,
          actorRole: session.user.role,
          pathId: null,
          writebackState: 'pending',
        });
        const outboxRow = buildTeacherEvidenceInterventionOutboxRow(reduced);
        if (outboxRow) {
          await prisma.evidenceOutbox.createMany({ data: [toEvidenceOutboxCreateManyRow(outboxRow)], skipDuplicates: true });
        }
        return NextResponse.json({ action: reduced, outbox: outboxRow ? 'recorded' : 'skipped' }, { status: 202 });
      }
      const recordedPath = await recordPathIntervention(prisma as any, {
        pathId: path.id,
        userId: path.userId,
        goalId: path.goalId ?? null,
        interventionKind: 'fallback-path',
        citedEvidence: parsed.sourceEvidenceRefs ?? [],
        suggestedAction: '教师从证据页创建补练路径处置。',
        studentOutcome: 'pending',
        privacySafeSummary: draftAction.privacySafeSummary,
        idempotencyKey: draftAction.idempotencyKey,
        actorUserId: session.user.id,
        actorRole: session.user.role,
      });
      const recorded = buildTeacherEvidenceInterventionAction({
        ...parsed,
        teacherId: session.user.id,
        actorRole: session.user.role,
        writebackState: 'recorded',
      });
      return NextResponse.json({ action: recorded, interventionId: recordedPath.id });
    }

    const recorded = buildTeacherEvidenceInterventionAction({
      ...parsed,
      teacherId: session.user.id,
      actorRole: session.user.role,
      writebackState: 'recorded',
    });
    const outboxRow = buildTeacherEvidenceInterventionOutboxRow(recorded);
    if (!outboxRow) return NextResponse.json({ action: draftAction, outbox: 'non-writeback' }, { status: 422 });
    const result = await prisma.evidenceOutbox.createMany({ data: [toEvidenceOutboxCreateManyRow(outboxRow)], skipDuplicates: true });
    return NextResponse.json({
      action: recorded,
      outbox: typeof result?.count === 'number' && result.count === 0 ? 'duplicate' : 'recorded',
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[TeacherEvidenceIntervention] Error:', error);
    return NextResponse.json({ error: '创建教师证据处置失败' }, { status: 500 });
  }
}

async function assertTeacherCanWriteInterventionScope(
  input: TeacherEvidenceInterventionInput,
  actorId: string,
  actorRole: string,
): Promise<NextResponse | null> {
  if (actorRole === 'ADMIN') return null;

  if (input.classId) {
    const classRecord = await prisma.class.findUnique({
      where: { id: input.classId },
      select: { teacherId: true },
    });
    if (!classRecord) return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    if (classRecord.teacherId !== actorId) return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  if (input.studentId) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: input.studentId },
      select: {
        classId: true,
        class: {
          select: { teacherId: true },
        },
      },
    });
    if (!studentProfile?.class) return NextResponse.json({ error: '学生不在可诊断班级中' }, { status: 404 });
    if (input.classId && studentProfile.classId !== input.classId) {
      return NextResponse.json({ error: '学生不属于目标班级' }, { status: 403 });
    }
    if (studentProfile.class.teacherId !== actorId) return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  if (input.pathId) {
    const path = await prisma.learningPath.findFirst({
      where: {
        id: input.pathId,
        userId: input.studentId ?? undefined,
      },
      select: {
        classId: true,
      },
    });
    if (path?.classId) {
      const classRecord = await prisma.class.findUnique({
        where: { id: path.classId },
        select: { teacherId: true },
      });
      if (!classRecord) return NextResponse.json({ error: '路径班级不存在' }, { status: 404 });
      if (classRecord.teacherId !== actorId) return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
  }

  return null;
}

function parseTeacherEvidenceInterventionBody(value: unknown): TeacherEvidenceInterventionInput | null {
  const body = toRecord(value);
  const kind = readString(body.kind);
  const surface = readString(body.surface);
  if (!kind || !INTERVENTION_KINDS.has(kind as TeacherEvidenceInterventionKind)) return null;
  if (!surface || !INTERVENTION_SURFACES.has(surface as TeacherEvidenceInterventionSurface)) return null;
  const refs = Array.isArray(body.sourceEvidenceRefs)
    ? body.sourceEvidenceRefs.filter((ref): ref is string => typeof ref === 'string')
    : [];
  return {
    kind: kind as TeacherEvidenceInterventionKind,
    surface: surface as TeacherEvidenceInterventionSurface,
    studentId: readString(body.studentId),
    classId: readString(body.classId),
    sessionId: readString(body.sessionId),
    lessonId: readString(body.lessonId),
    reportId: readString(body.reportId),
    gradingRunId: readString(body.gradingRunId),
    source: readString(body.source),
    sourceEvidenceRefs: refs,
    pathId: readString(body.pathId),
    learnerState: readLearnerState(body.learnerState),
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readLearnerState(value: unknown): TeacherEvidenceInterventionInput['learnerState'] {
  return value === 'ready' || value === 'partial' || value === 'missing' ? value : undefined;
}
