import 'server-only';

import { type Class, Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { lockClassSessionBinding } from '@/lib/class-session-binding-lock';

const DEFAULT_TRANSACTION_ATTEMPTS = 3;

export type TeacherDefaultClassServiceErrorCode =
  | 'teacher-not-found'
  | 'class-not-found'
  | 'class-not-active'
  | 'class-has-sessions'
  | 'transaction-conflict-retryable';

export class TeacherDefaultClassServiceError extends Error {
  constructor(public readonly code: TeacherDefaultClassServiceErrorCode) {
    super(code);
    this.name = 'TeacherDefaultClassServiceError';
  }
}

export interface CreateTeacherClassInput {
  teacherId: string;
  name: string;
  code: string;
  description?: string | null;
  year?: string | null;
  semester?: string | null;
}

export interface UpdateTeacherClassInput {
  name?: string;
  description?: string | null;
  year?: string | null;
  semester?: string | null;
  isActive?: boolean;
}

type TeacherDefaultClassDb = PrismaClient;

export function createTeacherDefaultClassService(
  db: TeacherDefaultClassDb = prisma,
  transactionAttempts = DEFAULT_TRANSACTION_ATTEMPTS,
) {
  if (!Number.isInteger(transactionAttempts) || transactionAttempts < 1) {
    throw new TypeError('transactionAttempts must be a positive integer');
  }

  const updateClass = (
    teacherId: string,
    classId: string,
    input: UpdateTeacherClassInput,
  ) => withSerializableRetry(db, transactionAttempts, async (tx) => {
    await requireTeacher(tx, teacherId);
    if (input.isActive === false) {
      await lockClassSessionBinding(tx, classId);
    }
    await findOwnedClass(tx, teacherId, classId);
    const updated = await tx.class.update({
      where: { id: classId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.year !== undefined && { year: input.year }),
        ...(input.semester !== undefined && { semester: input.semester }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    if (input.isActive === true) {
      await assignCandidateWhenDefaultInvalid(tx, teacherId, classId);
    } else if (input.isActive === false) {
      await replaceDefaultWhenInvalid(tx, teacherId, classId);
    }
    return updated;
  });

  return {
    createClass(input: CreateTeacherClassInput) {
      return withSerializableRetry(db, transactionAttempts, async (tx) => {
        await requireTeacher(tx, input.teacherId);
        const created = await tx.class.create({
          data: {
            teacherId: input.teacherId,
            name: input.name,
            code: input.code,
            description: input.description ?? null,
            year: input.year ?? null,
            semester: input.semester ?? null,
          },
        });
        await assignCandidateWhenDefaultInvalid(tx, input.teacherId, created.id);
        return created;
      });
    },

    setDefaultClass(teacherId: string, classId: string) {
      return withSerializableRetry(db, transactionAttempts, async (tx) => {
        await requireTeacher(tx, teacherId);
        const target = await findOwnedClass(tx, teacherId, classId);
        if (!target.isActive) {
          throw new TeacherDefaultClassServiceError('class-not-active');
        }
        await tx.user.update({
          where: { id: teacherId },
          data: { defaultTeachingClassId: classId },
        });
        return target;
      });
    },

    activateClass(teacherId: string, classId: string) {
      return updateClass(teacherId, classId, { isActive: true });
    },

    deactivateClass(teacherId: string, classId: string) {
      return updateClass(teacherId, classId, { isActive: false });
    },

    updateClass,

    deleteClass(teacherId: string, classId: string) {
      return withSerializableRetry(db, transactionAttempts, async (tx) => {
        await requireTeacher(tx, teacherId);
        await lockClassSessionBinding(tx, classId);
        await findOwnedClass(tx, teacherId, classId);
        const referencedSession = await tx.classSession.findFirst({
          where: { classId },
          select: { id: true },
        });
        if (referencedSession) {
          throw new TeacherDefaultClassServiceError('class-has-sessions');
        }
        const teacher = await tx.user.findUnique({
          where: { id: teacherId },
          select: { defaultTeachingClassId: true },
        });
        await detachSmartLessonTasksForDeletedClass(tx, teacherId, classId);
        await tx.studentProfile.updateMany({
          where: { classId },
          data: { classId: null },
        });
        let deleted: Class;
        try {
          deleted = await tx.class.delete({ where: { id: classId } });
        } catch (error) {
          if (hasPrismaCode(error, 'P2003')) {
            throw new TeacherDefaultClassServiceError('class-has-sessions');
          }
          throw error;
        }
        await replaceDefaultWhenInvalid(
          tx,
          teacherId,
          teacher?.defaultTeachingClassId === classId ? classId : undefined,
        );
        return deleted;
      });
    },
  };
}

export const teacherDefaultClassService = createTeacherDefaultClassService();

export async function detachSmartLessonTasksForDeletedClass(
  tx: Prisma.TransactionClient,
  teacherId: string,
  classId: string,
) {
  const tasks = await tx.smartLessonTask.findMany({
    where: { ownerId: teacherId, selectedClassId: classId },
    select: {
      id: true,
      revision: true,
      drafts: {
        select: {
          contentHash: true,
          jobs: { select: { stages: { select: { outputHash: true } } } },
        },
      },
    },
  });
  const now = new Date();
  for (const task of tasks) {
    const hasGeneratedContent = task.drafts.some((draft) => (
      Boolean(draft.contentHash)
      || draft.jobs.some((job) => job.stages.some((stage) => Boolean(stage.outputHash)))
    ));
    const updated = await tx.smartLessonTask.updateMany({
      where: {
        id: task.id,
        ownerId: teacherId,
        selectedClassId: classId,
        revision: task.revision,
      },
      data: {
        selectedClassId: null,
        revision: { increment: 1 },
        ...(hasGeneratedContent ? {
          classContextStaleAt: now,
          classContextStaleReason: 'CLASS_REMOVED',
        } : {
          aggregateClassContext: Prisma.JsonNull,
          aggregateClassContextRef: null,
          classContextStaleAt: null,
          classContextStaleReason: null,
        }),
      },
    });
    if (updated.count !== 1) {
      throw Object.assign(new Error('smart lesson task revision changed'), { code: 'P2034' });
    }
    if (hasGeneratedContent) {
      await tx.smartLessonDraft.updateMany({
        where: { taskId: task.id, state: { not: 'APPROVED' } },
        data: { staleDownstreamAt: now },
      });
    }
  }
}

async function withSerializableRetry<T>(
  db: TeacherDefaultClassDb,
  attempts: number,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!hasPrismaCode(error, 'P2034')) throw error;
      if (attempt === attempts - 1) {
        throw new TeacherDefaultClassServiceError('transaction-conflict-retryable');
      }
    }
  }
  throw new TeacherDefaultClassServiceError('transaction-conflict-retryable');
}

async function requireTeacher(tx: Prisma.TransactionClient, teacherId: string) {
  const teacher = await tx.user.findFirst({
    where: { id: teacherId, role: 'TEACHER' },
    select: { id: true },
  });
  if (!teacher) throw new TeacherDefaultClassServiceError('teacher-not-found');
}

async function findOwnedClass(
  tx: Prisma.TransactionClient,
  teacherId: string,
  classId: string,
): Promise<Class> {
  const target = await tx.class.findFirst({
    where: { id: classId, teacherId },
  });
  if (!target) throw new TeacherDefaultClassServiceError('class-not-found');
  return target;
}

async function assignCandidateWhenDefaultInvalid(
  tx: Prisma.TransactionClient,
  teacherId: string,
  candidateClassId: string,
) {
  if (await hasValidDefault(tx, teacherId)) return;
  await tx.user.update({
    where: { id: teacherId },
    data: { defaultTeachingClassId: candidateClassId },
  });
}

async function replaceDefaultWhenInvalid(
  tx: Prisma.TransactionClient,
  teacherId: string,
  knownInvalidClassId?: string,
) {
  const teacher = await tx.user.findUnique({
    where: { id: teacherId },
    select: { defaultTeachingClassId: true },
  });
  const currentId = teacher?.defaultTeachingClassId ?? null;
  if (
    currentId
    && currentId !== knownInvalidClassId
    && await isOwnedActiveClass(tx, teacherId, currentId)
  ) {
    return;
  }
  const replacement = await tx.class.findFirst({
    where: { teacherId, isActive: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  await tx.user.update({
    where: { id: teacherId },
    data: { defaultTeachingClassId: replacement?.id ?? null },
  });
}

async function hasValidDefault(tx: Prisma.TransactionClient, teacherId: string) {
  const teacher = await tx.user.findUnique({
    where: { id: teacherId },
    select: { defaultTeachingClassId: true },
  });
  return teacher?.defaultTeachingClassId
    ? isOwnedActiveClass(tx, teacherId, teacher.defaultTeachingClassId)
    : false;
}

async function isOwnedActiveClass(
  tx: Prisma.TransactionClient,
  teacherId: string,
  classId: string,
) {
  return Boolean(await tx.class.findFirst({
    where: { id: classId, teacherId, isActive: true },
    select: { id: true },
  }));
}

function hasPrismaCode(error: unknown, code: string) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: unknown }).code === code,
  );
}
