import { Prisma } from '@prisma/client';

import type { PortfolioReflectionDraftInput } from '@/lib/ai-task-boundary-contracts';

const draftSelect = {
  id: true,
  source: true,
  assignment: true,
  intent: true,
  title: true,
  content: true,
  status: true,
  idempotencyKey: true,
  createdAt: true,
  updatedAt: true,
} as const;

type DraftRecord = {
  id: string;
  source: string;
  assignment: string | null;
  intent: string;
  title: string;
  content: string;
  status: 'DRAFT' | 'DISCARDED';
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
};

type DraftDatabase = {
  $transaction<T>(
    callback: (transaction: DraftDatabase) => Promise<T>,
    options: { isolationLevel: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
  portfolioReflectionDraft: {
    findUnique(args: {
      where: { userId_idempotencyKey: { userId: string; idempotencyKey: string } };
      select: { id: true; status: true };
    }): Promise<{ id: string; status: 'DRAFT' | 'DISCARDED' } | null>;
    findUniqueOrThrow(args: {
      where: { id: string };
      select: typeof draftSelect;
    }): Promise<DraftRecord>;
    create(args: {
      data: {
        userId: string;
        source: string;
        assignment: string | null;
        intent: string;
        title: string;
        content: string;
        status: 'DRAFT';
        idempotencyKey: string;
      };
      select: typeof draftSelect;
    }): Promise<DraftRecord>;
  };
};

export class DiscardedDraftReplayError extends Error {
  constructor() {
    super('discarded portfolio reflection draft replay');
  }
}

export async function savePortfolioReflectionDraft(
  database: DraftDatabase,
  userId: string,
  input: PortfolioReflectionDraftInput,
): Promise<DraftRecord> {
  try {
    return await withSerializableRetry(() => database.$transaction(async (tx) => {
      const existing = await tx.portfolioReflectionDraft.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        select: { id: true, status: true },
      });

      if (existing?.status === 'DISCARDED') {
        throw new DiscardedDraftReplayError();
      }

      if (existing) {
        return tx.portfolioReflectionDraft.findUniqueOrThrow({
          where: { id: existing.id },
          select: draftSelect,
        });
      }

      return tx.portfolioReflectionDraft.create({
        data: {
          userId,
          source: input.source,
          assignment: input.assignment,
          intent: input.intent,
          title: input.title,
          content: input.content,
          status: 'DRAFT',
          idempotencyKey: input.idempotencyKey,
        },
        select: draftSelect,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  } catch (error) {
    if (!isRetryableDraftWriteError(error)) throw error;

    // A concurrent transaction may have committed the unique identity while
    // this transaction was retrying. Resolve that identity outside the failed
    // transaction so a safe replay returns the same draft instead of 500.
    const existing = await database.portfolioReflectionDraft.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      select: { id: true, status: true },
    });
    if (existing?.status === 'DISCARDED') {
      throw new DiscardedDraftReplayError();
    }
    if (existing) {
      return database.portfolioReflectionDraft.findUniqueOrThrow({
        where: { id: existing.id },
        select: draftSelect,
      });
    }

    throw error;
  }
}

async function withSerializableRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !isRetryableDraftWriteError(error)) throw error;
    }
  }
}

function isRetryableDraftWriteError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = String((error as { code: unknown }).code);
  return code === 'P2002' || code === 'P2034';
}
