import { prisma } from '@/lib/prisma';

import { getArenaEvaluationProtocolVersion } from '../evaluation/evaluator';
import type { ArenaEvaluationResult } from '../evaluation/types';
import type { ControllerArtifact } from '../types';
import type { ArenaSubmissionRecord } from './submission-service';
import type {
  ArenaSubmissionStore,
  StoredArenaArtifact,
  StoredArenaEvaluation,
  StoredArenaSubmission,
} from './persistence';

type PrismaJson = Record<string, unknown> | unknown[];

export interface ArenaSubmissionListOptions {
  taskId?: string;
  taskIds?: string[];
  userId?: string;
  classId?: string;
  seasonId?: string;
  publicationId?: string;
  includeLegacyProtocols?: boolean;
}

function isMissingArenaSubmissionSchema(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const prismaError = error as {
    code?: unknown;
    meta?: {
      modelName?: unknown;
    };
  };
  return prismaError.code === 'P2021' ||
    (
      process.env.NODE_ENV !== 'production' &&
      prismaError.code === 'P2022' &&
      prismaError.meta?.modelName === 'ArenaSubmission'
    );
}

function isLocalDatabaseUrlMissing(error: unknown): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Environment variable not found: DATABASE_URL') ||
    message.includes('env("DATABASE_URL")');
}

function toEvaluationResult(row: Record<string, unknown>): ArenaEvaluationResult {
  return {
    taskId: String(row.taskId),
    artifact: row.artifactPayload as ControllerArtifact,
    valid: Boolean(row.valid),
    score: Number(row.score),
    metrics: row.metrics as Record<string, number>,
    satisfaction: row.satisfaction as Record<string, number>,
    hardConstraintResults: row.hardConstraintResults as ArenaEvaluationResult['hardConstraintResults'],
    penalties: row.penalties as ArenaEvaluationResult['penalties'],
    explanation: row.explanation as string[],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

function toStoredEvaluation(row: Record<string, unknown>): StoredArenaEvaluation {
  return {
    id: String(row.id),
    taskId: String(row.taskId),
    artifactHash: String(row.artifactHash),
    protocolVersion: String(row.protocolVersion),
    result: toEvaluationResult(row),
    completedAt: (row.completedAt as Date).toISOString(),
  };
}

function toSubmissionRecord(row: Record<string, unknown>): ArenaSubmissionRecord {
  const artifactRow = row.controllerArtifact as Record<string, unknown>;
  const evaluationRow = row.evaluationRun as Record<string, unknown>;

  return {
    id: String(row.id),
    taskId: String(row.taskId),
    userId: String(row.userId),
    classId: typeof row.classId === 'string' ? row.classId : undefined,
    seasonId: typeof row.seasonId === 'string' ? row.seasonId : undefined,
    publicationId: typeof row.publicationId === 'string' ? row.publicationId : undefined,
    isLate: Boolean(row.isLate),
    studentLabel: String(row.studentLabel),
    artifactHash: String(row.artifactHash),
    artifact: artifactRow.payload as ControllerArtifact,
    evaluation: toEvaluationResult(evaluationRow),
    evaluationProtocolVersion: String(evaluationRow.protocolVersion),
    submittedAt: (row.submittedAt as Date).toISOString(),
    reusedEvaluation: false,
  };
}

export const prismaArenaSubmissionStore: ArenaSubmissionStore & {
  listSubmissions(options?: ArenaSubmissionListOptions): Promise<ArenaSubmissionRecord[]>;
} = {
  async findEvaluationByHash(taskId, artifactHash, protocolVersion) {
    const row = await (prisma as any).arenaEvaluationRun.findUnique({
      where: {
        taskId_artifactHash_protocolVersion: {
          taskId,
          artifactHash,
          protocolVersion,
        },
      },
    });

    return row ? toStoredEvaluation(row) : null;
  },

  async createEvaluation(input) {
    const result = input.result;
    const data = {
      taskId: input.taskId,
      artifactHash: input.artifactHash,
      protocolVersion: input.protocolVersion,
      artifactPayload: result.artifact as unknown as PrismaJson,
      valid: result.valid,
      score: result.score,
      metrics: result.metrics as unknown as PrismaJson,
      satisfaction: result.satisfaction as unknown as PrismaJson,
      hardConstraintResults: result.hardConstraintResults as unknown as PrismaJson,
      penalties: result.penalties as unknown as PrismaJson,
      explanation: result.explanation as unknown as PrismaJson,
      metadata: (result.metadata ?? {}) as unknown as PrismaJson,
      completedAt: new Date(input.completedAt),
    };
    const row = await (prisma as any).arenaEvaluationRun.upsert({
      where: {
        taskId_artifactHash_protocolVersion: {
          taskId: input.taskId,
          artifactHash: input.artifactHash,
          protocolVersion: input.protocolVersion,
        },
      },
      update: {},
      create: data,
    });

    return toStoredEvaluation(row);
  },

  async upsertArtifact(input) {
    const row = await (prisma as any).arenaControllerArtifact.upsert({
      where: {
        ownerId_taskId_artifactHash: {
          ownerId: input.ownerId,
          taskId: input.taskId,
          artifactHash: input.artifactHash,
        },
      },
      update: {
        payload: input.artifact as unknown as PrismaJson,
        method: input.artifact.method,
      },
      create: {
        ownerId: input.ownerId,
        taskId: input.taskId,
        artifactHash: input.artifactHash,
        method: input.artifact.method,
        payload: input.artifact as unknown as PrismaJson,
      },
    });

    return {
      id: String(row.id),
      ownerId: String(row.ownerId),
      taskId: String(row.taskId),
      artifactHash: String(row.artifactHash),
      artifact: row.payload as ControllerArtifact,
    } satisfies StoredArenaArtifact;
  },

  async createSubmission(input) {
    const row = await (prisma as any).arenaSubmission.create({
      data: {
        taskId: input.taskId,
        userId: input.userId,
        classId: input.classId ?? null,
        seasonId: input.seasonId ?? null,
        publicationId: input.publicationId ?? null,
        isLate: input.isLate ?? false,
        studentLabel: input.studentLabel,
        artifactHash: input.artifactHash,
        method: input.artifact.method,
        score: input.evaluation.score,
        valid: input.evaluation.valid,
        submittedAt: new Date(input.submittedAt),
        controllerArtifactId: input.artifactId,
        evaluationRunId: input.evaluationId,
      },
      include: {
        controllerArtifact: true,
        evaluationRun: true,
      },
    });

    return {
      id: String(row.id),
      taskId: String(row.taskId),
      userId: String(row.userId),
      classId: typeof row.classId === 'string' ? row.classId : undefined,
      seasonId: typeof row.seasonId === 'string' ? row.seasonId : undefined,
      publicationId: typeof row.publicationId === 'string' ? row.publicationId : undefined,
      isLate: Boolean(row.isLate),
      studentLabel: String(row.studentLabel),
      artifactHash: String(row.artifactHash),
      artifact: (row.controllerArtifact as Record<string, unknown>).payload as ControllerArtifact,
      evaluation: toEvaluationResult(row.evaluationRun as Record<string, unknown>),
      submittedAt: (row.submittedAt as Date).toISOString(),
    } satisfies StoredArenaSubmission;
  },

  async listSubmissions(options) {
    if (!(prisma as any).arenaSubmission?.findMany) {
      return [];
    }
    const taskFilter = options?.taskId
      ? { taskId: options.taskId }
      : options?.taskIds?.length
        ? { taskId: { in: options.taskIds } }
        : {};
    const arenaSubmissionDelegate = (prisma as any).arenaSubmission as
      | { findMany?: (args: unknown) => Promise<Array<Record<string, unknown>>> }
      | undefined;
    if (typeof arenaSubmissionDelegate?.findMany !== 'function') {
      if (process.env.NODE_ENV !== 'production') {
        return [];
      }
      throw new Error('ArenaSubmission Prisma delegate is not available.');
    }

    let rows: Array<Record<string, unknown>>;
    try {
      rows = await arenaSubmissionDelegate.findMany({
        where: {
          ...taskFilter,
          ...(options?.userId ? { userId: options.userId } : {}),
          ...(options?.classId ? { classId: options.classId } : {}),
          ...(options?.seasonId ? { seasonId: options.seasonId } : {}),
          ...(options?.publicationId ? { publicationId: options.publicationId } : {}),
        },
        include: {
          controllerArtifact: true,
          evaluationRun: true,
        },
        orderBy: {
          submittedAt: 'asc',
        },
      });
    } catch (error) {
      if (isMissingArenaSubmissionSchema(error) || isLocalDatabaseUrlMissing(error)) {
        return [];
      }
      throw error;
    }

    return rows
      .filter((row: Record<string, unknown>) => {
        const evaluationRun = row.evaluationRun as Record<string, unknown>;
        const storedVersion = String(evaluationRun.protocolVersion);
        const controllerArtifact = row.controllerArtifact as Record<string, unknown> | undefined;
        const method = (controllerArtifact?.payload as Record<string, unknown>)?.method as string | undefined;
        const expectedVersion = getArenaEvaluationProtocolVersion({ taskId: String(row.taskId), method: method as any });
        return storedVersion === expectedVersion ||
          (options?.includeLegacyProtocols === true && storedVersion === 'whitebox-v1');
      })
      .map((row: Record<string, unknown>) => toSubmissionRecord(row));
  },
};
