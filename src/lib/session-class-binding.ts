import { Prisma, UserRole, type PrismaClient } from '@prisma/client';

import { lockClassSessionBinding } from '@/lib/class-session-binding-lock';

const DEFAULT_TRANSACTION_ATTEMPTS = 3;

type SessionClassBindingDb = Pick<PrismaClient, '$transaction'>;

export type SessionClassBindingErrorCode =
  | 'class-not-found'
  | 'class-not-active'
  | 'class-not-owned'
  | 'transaction-conflict-retryable';

export class SessionClassBindingError extends Error {
  constructor(public readonly code: SessionClassBindingErrorCode) {
    super(code);
    this.name = 'SessionClassBindingError';
  }
}

export async function createClassBoundSession<T>(
  db: SessionClassBindingDb,
  input: {
    actorId: string;
    actorRole: UserRole;
    classId: string;
    create: (tx: Prisma.TransactionClient) => Promise<T>;
  },
  transactionAttempts = DEFAULT_TRANSACTION_ATTEMPTS,
): Promise<T> {
  if (!Number.isInteger(transactionAttempts) || transactionAttempts < 1) {
    throw new TypeError('transactionAttempts must be a positive integer');
  }

  for (let attempt = 0; attempt < transactionAttempts; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await lockClassSessionBinding(tx, input.classId);
        const classData = await tx.class.findUnique({
          where: { id: input.classId },
          select: { id: true, teacherId: true, isActive: true },
        });
        if (!classData) throw new SessionClassBindingError('class-not-found');
        if (!classData.isActive) throw new SessionClassBindingError('class-not-active');
        if (input.actorRole === UserRole.TEACHER && classData.teacherId !== input.actorId) {
          throw new SessionClassBindingError('class-not-owned');
        }
        return input.create(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!hasPrismaCode(error, 'P2034')) throw error;
      if (attempt === transactionAttempts - 1) {
        throw new SessionClassBindingError('transaction-conflict-retryable');
      }
    }
  }
  throw new SessionClassBindingError('transaction-conflict-retryable');
}

function hasPrismaCode(error: unknown, code: string) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: unknown }).code === code,
  );
}
