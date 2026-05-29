import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type { ArenaBlackBoxExperimentDataset, ArenaBlackBoxExperimentInput } from './experiment';
import { runArenaBlackBoxExperiment } from './experiment';

export const ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET = 20;
export const ARENA_IDENTIFICATION_MODEL_PROTOCOL_VERSION = 'arena-identification-model-v1';

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

export interface ArenaIdentificationModelValidationSummary {
  validationFit: number;
  dataQuality: number;
  sampleCount: number;
  signalType: string;
}

export interface StoredArenaIdentificationModel {
  id: string;
  userId: string;
  taskId: string;
  datasetHash: string;
  sourceExperimentId: string;
  modelType: 'second-order-fit';
  validationSummary: ArenaIdentificationModelValidationSummary;
  protocolVersion: typeof ARENA_IDENTIFICATION_MODEL_PROTOCOL_VERSION;
  createdAt: string;
}

export interface ArenaBlackBoxExperimentStore {
  findOwnedExperiment(input: {
    userId: string;
    taskId: string;
    datasetHash: string;
    experimentId?: string;
  }): Promise<StoredArenaBlackBoxExperiment | null>;
  countOwnedExperiments?(input: {
    userId: string;
    taskId: string;
    since?: string;
    atOrBefore?: string;
  }): Promise<number>;
  createExperimentWithinBudget(
    input: Omit<StoredArenaBlackBoxExperiment, 'id'> & {
      since: Date;
      dailyBudget: number;
    },
  ): Promise<{
    experiment: StoredArenaBlackBoxExperiment | null;
    registeredModel: StoredArenaIdentificationModel | null;
    usedBefore: number;
  }>;
}

export interface ArenaIdentificationModelStore {
  createOrResolveIdentificationModel(
    input: Omit<StoredArenaIdentificationModel, 'id'>,
  ): Promise<StoredArenaIdentificationModel>;
  findOwnedIdentificationModel(input: {
    userId: string;
    taskId: string;
    modelId: string;
  }): Promise<StoredArenaIdentificationModel | null>;
}

export interface CreateArenaBlackBoxExperimentInput {
  userId: string;
  taskId: string;
  experimentInput: ArenaBlackBoxExperimentInput;
  now?: string;
  store: ArenaBlackBoxExperimentStore;
  identificationModelStore: ArenaIdentificationModelStore;
}

export interface CreateArenaBlackBoxExperimentResult {
  dataset: ArenaBlackBoxExperimentDataset & {
    id: string;
    registeredModel: StoredArenaIdentificationModel;
  };
  budget: {
    limit: number;
    used: number;
    remaining: number;
  };
}

export function startOfUtcDay(isoDate: string): Date {
  const date = new Date(isoDate);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildValidationSummary(
  experiment: StoredArenaBlackBoxExperiment,
): ArenaIdentificationModelValidationSummary {
  return {
    validationFit: experiment.dataset.summary.dataQuality,
    dataQuality: experiment.dataset.summary.dataQuality,
    sampleCount: experiment.dataset.samples.length,
    signalType: experiment.signalType,
  };
}

function mapIdentificationModelRow(row: {
  id: string;
  userId: string;
  taskId: string;
  datasetHash: string;
  sourceExperimentId: string;
  modelType: string;
  validationSummary: Prisma.JsonValue;
  protocolVersion: string;
  createdAt: Date;
}): StoredArenaIdentificationModel {
  return {
    id: row.id,
    userId: row.userId,
    taskId: row.taskId,
    datasetHash: row.datasetHash,
    sourceExperimentId: row.sourceExperimentId,
    modelType: row.modelType as StoredArenaIdentificationModel['modelType'],
    validationSummary: row.validationSummary as unknown as ArenaIdentificationModelValidationSummary,
    protocolVersion: row.protocolVersion as StoredArenaIdentificationModel['protocolVersion'],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createOrResolveArenaIdentificationModel({
  experiment,
  now = new Date().toISOString(),
  store,
}: {
  experiment: StoredArenaBlackBoxExperiment;
  now?: string;
  store: ArenaIdentificationModelStore;
}): Promise<StoredArenaIdentificationModel> {
  return store.createOrResolveIdentificationModel({
    userId: experiment.userId,
    taskId: experiment.taskId,
    datasetHash: experiment.datasetHash,
    sourceExperimentId: experiment.id,
    modelType: 'second-order-fit',
    validationSummary: buildValidationSummary(experiment),
    protocolVersion: ARENA_IDENTIFICATION_MODEL_PROTOCOL_VERSION,
    createdAt: now,
  });
}

function mapExperimentRow(row: {
  id: string;
  userId: string;
  taskId: string;
  datasetHash: string;
  signalType: string;
  payload: Prisma.JsonValue;
  budgetCost: number;
  createdAt: Date;
}): StoredArenaBlackBoxExperiment {
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
  if (!reservation.registeredModel) {
    throw new ArenaBlackBoxExperimentInputError('Arena identification model registration failed.');
  }

  const budgetUsed = reservation.usedBefore + dataset.budgetCost;

  return {
    dataset: {
      ...reservation.experiment.dataset,
      id: reservation.experiment.id,
      registeredModel: reservation.registeredModel,
    },
    budget: {
      limit: ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET,
      used: budgetUsed,
      remaining: Math.max(0, ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET - budgetUsed),
    },
  };
}

export const prismaArenaBlackBoxExperimentStore: ArenaBlackBoxExperimentStore & ArenaIdentificationModelStore = {
  async findOwnedExperiment(input) {
    const row = await prisma.arenaBlackBoxExperiment.findFirst({
      where: {
        userId: input.userId,
        taskId: input.taskId,
        datasetHash: input.datasetHash,
        ...(input.experimentId ? { id: input.experimentId } : {}),
      },
    });

    if (!row) return null;

    return mapExperimentRow(row);
  },

  async countOwnedExperiments(input) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (input.since) createdAt.gte = new Date(input.since);
    if (input.atOrBefore) createdAt.lte = new Date(input.atOrBefore);
    const aggregate = await prisma.arenaBlackBoxExperiment.aggregate({
      where: {
        userId: input.userId,
        taskId: input.taskId,
        ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
      },
      _sum: { budgetCost: true },
    });
    return aggregate._sum.budgetCost ?? 0;
  },

  async createExperimentWithinBudget(input) {
    return prisma.$transaction(async (tx) => {
      const existingToday = await tx.arenaBlackBoxExperiment.findFirst({
        where: {
          userId: input.userId,
          taskId: input.taskId,
          datasetHash: input.datasetHash,
          createdAt: { gte: input.since },
        },
      });
      const rows = await tx.arenaBlackBoxExperiment.findMany({
        where: {
          userId: input.userId,
          taskId: input.taskId,
          createdAt: { gte: input.since },
        },
        select: { id: true, budgetCost: true },
      });
      const usedBefore = rows.reduce((sum, row) => (
        existingToday?.id === row.id ? sum : sum + row.budgetCost
      ), 0);

      if (existingToday) {
        const experiment = mapExperimentRow(existingToday);
        const registeredModel = await tx.arenaIdentificationModel.upsert({
          where: {
            userId_taskId_sourceExperimentId: {
              userId: experiment.userId,
              taskId: experiment.taskId,
              sourceExperimentId: experiment.id,
            },
          },
          create: {
            userId: experiment.userId,
            taskId: experiment.taskId,
            datasetHash: experiment.datasetHash,
            sourceExperimentId: experiment.id,
            modelType: 'second-order-fit',
            validationSummary: buildValidationSummary(experiment) as unknown as Prisma.InputJsonValue,
            protocolVersion: ARENA_IDENTIFICATION_MODEL_PROTOCOL_VERSION,
            createdAt: new Date(input.createdAt),
          },
          update: {
            datasetHash: experiment.datasetHash,
            modelType: 'second-order-fit',
            validationSummary: buildValidationSummary(experiment) as unknown as Prisma.InputJsonValue,
            protocolVersion: ARENA_IDENTIFICATION_MODEL_PROTOCOL_VERSION,
          },
        });
        return {
          usedBefore,
          experiment,
          registeredModel: mapIdentificationModelRow(registeredModel),
        };
      }

      if (usedBefore + input.budgetCost > input.dailyBudget) {
        return { experiment: null, registeredModel: null, usedBefore };
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
      const experiment = mapExperimentRow(row);
      const registeredModel = await tx.arenaIdentificationModel.upsert({
        where: {
          userId_taskId_sourceExperimentId: {
            userId: experiment.userId,
            taskId: experiment.taskId,
            sourceExperimentId: experiment.id,
          },
        },
        create: {
          userId: experiment.userId,
          taskId: experiment.taskId,
          datasetHash: experiment.datasetHash,
          sourceExperimentId: experiment.id,
          modelType: 'second-order-fit',
          validationSummary: buildValidationSummary(experiment) as unknown as Prisma.InputJsonValue,
          protocolVersion: ARENA_IDENTIFICATION_MODEL_PROTOCOL_VERSION,
          createdAt: new Date(input.createdAt),
        },
        update: {
          datasetHash: experiment.datasetHash,
          modelType: 'second-order-fit',
          validationSummary: buildValidationSummary(experiment) as unknown as Prisma.InputJsonValue,
          protocolVersion: ARENA_IDENTIFICATION_MODEL_PROTOCOL_VERSION,
        },
      });

      return {
        usedBefore,
        experiment,
        registeredModel: mapIdentificationModelRow(registeredModel),
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  },

  async createOrResolveIdentificationModel(input) {
    const row = await prisma.arenaIdentificationModel.upsert({
      where: {
        userId_taskId_sourceExperimentId: {
          userId: input.userId,
          taskId: input.taskId,
          sourceExperimentId: input.sourceExperimentId,
        },
      },
      create: {
        userId: input.userId,
        taskId: input.taskId,
        datasetHash: input.datasetHash,
        sourceExperimentId: input.sourceExperimentId,
        modelType: input.modelType,
        validationSummary: input.validationSummary as unknown as Prisma.InputJsonValue,
        protocolVersion: input.protocolVersion,
        createdAt: new Date(input.createdAt),
      },
      update: {
        datasetHash: input.datasetHash,
        modelType: input.modelType,
        validationSummary: input.validationSummary as unknown as Prisma.InputJsonValue,
        protocolVersion: input.protocolVersion,
      },
    });

    return mapIdentificationModelRow(row);
  },

  async findOwnedIdentificationModel(input) {
    const row = await prisma.arenaIdentificationModel.findFirst({
      where: {
        id: input.modelId,
        userId: input.userId,
        taskId: input.taskId,
      },
    });

    if (!row) return null;

    return mapIdentificationModelRow(row);
  },
};
