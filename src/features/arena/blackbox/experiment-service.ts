import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type { ArenaBlackBoxExperimentDataset, ArenaBlackBoxExperimentInput } from './experiment';
import { runArenaBlackBoxExperiment } from './experiment';

export const ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET = 20;

export class ArenaBlackBoxExperimentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArenaBlackBoxExperimentInputError';
  }
}

export interface StoredArenaBlackBoxExperiment {
  id: string;
  userId: string;
  taskId: string;
  datasetHash: string;
  signalType: string;
  dataset: ArenaBlackBoxExperimentDataset;
  budgetCost: number;
  createdAt: string;
}

export interface ArenaBlackBoxExperimentStore {
  findOwnedExperiment(input: {
    userId: string;
    taskId: string;
    datasetHash: string;
  }): Promise<StoredArenaBlackBoxExperiment | null>;
  createExperimentWithinBudget(
    input: Omit<StoredArenaBlackBoxExperiment, 'id'> & {
      since: Date;
      dailyBudget: number;
    },
  ): Promise<{ experiment: StoredArenaBlackBoxExperiment | null; usedBefore: number }>;
}

export interface CreateArenaBlackBoxExperimentInput {
  userId: string;
  taskId: string;
  experimentInput: ArenaBlackBoxExperimentInput;
  now?: string;
  store: ArenaBlackBoxExperimentStore;
}

export interface CreateArenaBlackBoxExperimentResult {
  dataset: ArenaBlackBoxExperimentDataset & { id: string };
  budget: {
    limit: number;
    used: number;
    remaining: number;
  };
}

function startOfUtcDay(isoDate: string): Date {
  const date = new Date(isoDate);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function createArenaBlackBoxExperiment(
  input: CreateArenaBlackBoxExperimentInput,
): Promise<CreateArenaBlackBoxExperimentResult> {
  const now = input.now ?? new Date().toISOString();
  let dataset: ArenaBlackBoxExperimentDataset;

  try {
    dataset = runArenaBlackBoxExperiment({
      taskId: input.taskId,
      input: input.experimentInput,
      now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid black-box experiment';
    throw new ArenaBlackBoxExperimentInputError(message);
  }

  const reservation = await input.store.createExperimentWithinBudget({
    userId: input.userId,
    taskId: input.taskId,
    datasetHash: dataset.datasetHash,
    signalType: dataset.signalType,
    dataset,
    budgetCost: dataset.budgetCost,
    createdAt: now,
    since: startOfUtcDay(now),
    dailyBudget: ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET,
  });

  if (!reservation.experiment) {
    throw new ArenaBlackBoxExperimentInputError('Daily black-box experiment budget exceeded.');
  }

  const budgetUsed = reservation.usedBefore + dataset.budgetCost;

  return {
    dataset: {
      ...reservation.experiment.dataset,
      id: reservation.experiment.id,
    },
    budget: {
      limit: ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET,
      used: budgetUsed,
      remaining: Math.max(0, ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET - budgetUsed),
    },
  };
}

export const prismaArenaBlackBoxExperimentStore: ArenaBlackBoxExperimentStore = {
  async findOwnedExperiment(input) {
    const row = await prisma.arenaBlackBoxExperiment.findFirst({
      where: {
        userId: input.userId,
        taskId: input.taskId,
        datasetHash: input.datasetHash,
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      taskId: row.taskId,
      datasetHash: row.datasetHash,
      signalType: row.signalType,
      dataset: row.payload as unknown as ArenaBlackBoxExperimentDataset,
      budgetCost: row.budgetCost,
      createdAt: row.createdAt.toISOString(),
    };
  },

  async createExperimentWithinBudget(input) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.arenaBlackBoxExperiment.findMany({
        where: {
          userId: input.userId,
          taskId: input.taskId,
          createdAt: { gte: input.since },
        },
        select: { budgetCost: true },
      });
      const usedBefore = rows.reduce((sum, row) => sum + row.budgetCost, 0);

      if (usedBefore + input.budgetCost > input.dailyBudget) {
        return { experiment: null, usedBefore };
      }

      const row = await tx.arenaBlackBoxExperiment.create({
        data: {
          userId: input.userId,
          taskId: input.taskId,
          datasetHash: input.datasetHash,
          signalType: input.signalType,
          payload: input.dataset as unknown as Prisma.InputJsonValue,
          budgetCost: input.budgetCost,
          createdAt: new Date(input.createdAt),
        },
      });

      return {
        usedBefore,
        experiment: {
          id: row.id,
          userId: row.userId,
          taskId: row.taskId,
          datasetHash: row.datasetHash,
          signalType: row.signalType,
          dataset: row.payload as unknown as ArenaBlackBoxExperimentDataset,
          budgetCost: row.budgetCost,
          createdAt: row.createdAt.toISOString(),
        },
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  },
};
