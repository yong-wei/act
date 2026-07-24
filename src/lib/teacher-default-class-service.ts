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

type TeacherDefaultClassDb = PrismaClient;

export function createTeacherDefaultClassService(
  db: TeacherDefaultClassDb = prisma,
  transactionAttempts = DEFAULT_TRANSACTION_ATTEMPTS,
) {
  if (!Number.isInteger(transactionAttempts) || transactionAttempts < 1) {
    throw new TypeError('transactionAttempts must be a positive integer');
  }

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
      return withSerializableRetry(db, transactionAttempts, async (tx) => {
        await requireTeacher(tx, teacherId);
        await findOwnedClass(tx, teacherId, classId);
        const activated = await tx.class.update({
          where: { id: classId },
          data: { isActive: true },
        });
        await assignCandidateWhenDefaultInvalid(tx, teacherId, classId);
        return activated;
      });
    },

    deactivateClass(teacherId: string, classId: string) {
      return withSerializableRetry(db, transactionAttempts, async (tx) => {
        await requireTeacher(tx, teacherId);
        await lockClassSessionBinding(tx, classId);
        await findOwnedClass(tx, teacherId, classId);
        const deactivated = await tx.class.update({
          where: { id: classId },
          data: { isActive: false },
        });
        await replaceDefaultWhenInvalid(tx, teacherId, classId);
        return deactivated;
      });
    },

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
