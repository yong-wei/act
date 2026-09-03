import { createHash } from 'node:crypto';

type EvaluationDb = Record<string, any>;

export interface HiddenBatchCreationContext {
  splitId: string;
  configId: string;
  hiddenSampleIds: string[];
}

export interface StartTeacherAiGradingHiddenAcceptanceInput {
  db: EvaluationDb;
  acceptanceId: string;
  configId: string;
  startKey: string;
  request: Readonly<Record<string, unknown>>;
  createBatch: (db: EvaluationDb, context: HiddenBatchCreationContext) => Promise<{ id: string }>;
  now?: Date;
}

export interface RevealTeacherAiGradingHiddenAcceptanceInput<Result> {
  db: EvaluationDb;
  acceptanceId: string;
  configId: string;
  loadRevealed: (db: EvaluationDb, context: { acceptanceId: string; splitId: string; batchId: string }) => Promise<Result>;
  now?: Date;
}

export async function getTeacherAiGradingHiddenProjection(db: EvaluationDb, splitId: string): Promise<{
  splitId: string;
  datasetId: string;
  datasetVersion: string;
  splitVersion: number;
  sampleCount: number;
  tuningCount: number;
  hiddenCount: number;
  acceptanceId: string;
  state: 'SEALED' | 'RUNNING' | 'CONSUMED';
  startedAt: Date | null;
  consumedAt: Date | null;
}> {
  requireToken(splitId, 'grading-lab-hidden-split-id-missing');
  const split = await db.teacherAiGradingLabSplit.findUnique({
    where: { id: splitId },
    select: {
      id: true,
      datasetId: true,
      datasetVersion: true,
      version: true,
      sampleCount: true,
      tuningCount: true,
      hiddenCount: true,
      hiddenAcceptance: {
        select: { id: true, state: true, startedAt: true, consumedAt: true },
      },
    },
  });
  if (!split?.hiddenAcceptance) throw new Error('grading-lab-hidden-acceptance-not-found');
  return {
    splitId: split.id,
    datasetId: split.datasetId,
    datasetVersion: split.datasetVersion,
    splitVersion: split.version,
    sampleCount: split.sampleCount,
    tuningCount: split.tuningCount,
    hiddenCount: split.hiddenCount,
    acceptanceId: split.hiddenAcceptance.id,
    state: split.hiddenAcceptance.state,
    startedAt: split.hiddenAcceptance.startedAt,
    consumedAt: split.hiddenAcceptance.consumedAt,
  };
}

export async function startTeacherAiGradingHiddenAcceptance(
  input: StartTeacherAiGradingHiddenAcceptanceInput,
): Promise<{ acceptanceId: string; splitId: string; batchId: string; replay: boolean }> {
  const acceptanceId = requireToken(input.acceptanceId, 'grading-lab-hidden-acceptance-id-missing');
  const configId = requireToken(input.configId, 'grading-lab-hidden-config-id-missing');
  const startKey = requireToken(input.startKey, 'grading-lab-hidden-start-key-missing');
  const requestHash = hashJson({ acceptanceId, configId, request: input.request });
  const now = input.now ?? new Date();

  const start = async (db: EvaluationDb) => {
    await lockAcceptance(db, acceptanceId);
    const acceptance = await db.teacherAiGradingHiddenAcceptance.findUnique({
      where: { id: acceptanceId },
      select: {
        id: true,
        splitId: true,
        state: true,
        configId: true,
        batchId: true,
        startKey: true,
        startRequestHash: true,
      },
    });
    if (!acceptance) throw new Error('grading-lab-hidden-acceptance-not-found');
    if (acceptance.state !== 'SEALED') {
      if (acceptance.startKey === startKey && acceptance.startRequestHash === requestHash && acceptance.batchId) {
        return { acceptanceId, splitId: acceptance.splitId, batchId: acceptance.batchId, replay: true };
      }
      throw new Error(acceptance.state === 'CONSUMED'
        ? 'grading-lab-hidden-acceptance-consumed'
        : 'grading-lab-hidden-acceptance-already-running');
    }

    const config = await db.teacherAiGradingExperimentConfig.findUnique({
      where: { id: configId },
      select: { id: true, splitId: true },
    });
    if (!config) throw new Error('grading-lab-hidden-configuration-not-frozen');
    if (config.splitId !== acceptance.splitId) throw new Error('grading-lab-hidden-configuration-split-mismatch');

    const split = await db.teacherAiGradingLabSplit.findUnique({
      where: { id: acceptance.splitId },
      select: {
        datasetId: true,
        datasetVersion: true,
        members: {
          where: { partition: 'HIDDEN' },
          select: { sampleId: true },
          orderBy: { sampleId: 'asc' },
        },
      },
    });
    if (!split || split.members.length === 0) throw new Error('grading-lab-hidden-members-missing');
    const hiddenSampleIds: string[] = (split.members as Array<{ sampleId: string }>)
      .map((member) => member.sampleId);
    const started = await db.teacherAiGradingHiddenAcceptance.updateMany({
      where: { id: acceptanceId, state: 'SEALED' },
      data: {
        state: 'RUNNING',
        configId,
        startKey,
        startRequestHash: requestHash,
        startedAt: now,
        updatedAt: now,
      },
    });
    if (started.count !== 1) throw new Error('grading-lab-hidden-acceptance-fenced');
    const batch = await input.createBatch(db, { splitId: acceptance.splitId, configId, hiddenSampleIds });
    const batchId = requireToken(batch?.id, 'grading-lab-hidden-batch-id-missing');
    const persistedBatch = await db.teacherAiGradingExperimentBatch.findUnique({
      where: { id: batchId },
      select: { id: true, configId: true, splitId: true, sampleSetSnapshot: true },
    });
    if (!persistedBatch) throw new Error('grading-lab-hidden-batch-not-persisted');
    if (persistedBatch.configId !== configId || persistedBatch.splitId !== acceptance.splitId) {
      throw new Error('grading-lab-hidden-batch-scope-mismatch');
    }
    const batchSampleIds = Array.isArray(persistedBatch.sampleSetSnapshot)
      ? persistedBatch.sampleSetSnapshot.map((sample: any) => sample?.sampleId).filter((sampleId: unknown): sampleId is string => typeof sampleId === 'string')
      : [];
    if (!sameStringSet(batchSampleIds, hiddenSampleIds)) {
      throw new Error('grading-lab-hidden-batch-sample-set-mismatch');
    }

    try {
      await db.teacherAiGradingHiddenSampleLedger.createMany({
        data: hiddenSampleIds.map((sampleId) => ({
          id: `grading-lab-hidden-ledger:${hashText(`${split.datasetId}:${split.datasetVersion}:${sampleId}`).slice(7, 39)}`,
          datasetId: split.datasetId,
          datasetVersion: split.datasetVersion,
          sampleId,
          splitId: acceptance.splitId,
          acceptanceId,
          firstRunAt: now,
          createdAt: now,
        })),
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw new Error('grading-lab-hidden-sample-previously-used');
      throw error;
    }

    const updated = await db.teacherAiGradingHiddenAcceptance.updateMany({
      where: { id: acceptanceId, state: 'RUNNING', configId, batchId: null },
      data: { batchId, updatedAt: now },
    });
    if (updated.count !== 1) throw new Error('grading-lab-hidden-acceptance-fenced');
    return { acceptanceId, splitId: acceptance.splitId, batchId, replay: false };
  };

  try {
    return input.db.$transaction
      ? await input.db.$transaction(start, { isolationLevel: 'Serializable' })
      : await start(input.db);
  } catch (error) {
    const recovered = await input.db.teacherAiGradingHiddenAcceptance.findUnique({
      where: { id: acceptanceId },
      select: { splitId: true, state: true, batchId: true, startKey: true, startRequestHash: true },
    });
    if (recovered?.startKey === startKey && recovered.startRequestHash === requestHash && recovered.batchId) {
      return { acceptanceId, splitId: recovered.splitId, batchId: recovered.batchId, replay: true };
    }
    if (isTransactionConflict(error)) throw new Error('grading-lab-hidden-acceptance-already-running');
    throw error;
  }
}

export async function revealTeacherAiGradingHiddenAcceptance<Result>(
  input: RevealTeacherAiGradingHiddenAcceptanceInput<Result>,
): Promise<{ result: Result; replay: boolean }> {
  const acceptanceId = requireToken(input.acceptanceId, 'grading-lab-hidden-acceptance-id-missing');
  const configId = requireToken(input.configId, 'grading-lab-hidden-config-id-missing');
  const now = input.now ?? new Date();
  const consume = async (db: EvaluationDb) => {
    await lockAcceptance(db, acceptanceId);
    const acceptance = await db.teacherAiGradingHiddenAcceptance.findUnique({
      where: { id: acceptanceId },
      select: { id: true, splitId: true, state: true, configId: true, batchId: true },
    });
    if (!acceptance) throw new Error('grading-lab-hidden-acceptance-not-found');
    if (acceptance.state === 'SEALED') throw new Error('grading-lab-hidden-configuration-not-frozen');
    if (acceptance.configId !== configId) throw new Error('grading-lab-hidden-configuration-mismatch');
    if (!acceptance.batchId) throw new Error('grading-lab-hidden-batch-missing');
    if (acceptance.state === 'CONSUMED') {
      return { splitId: acceptance.splitId, batchId: acceptance.batchId, replay: true };
    }
    const batch = await db.teacherAiGradingExperimentBatch.findUnique({
      where: { id: acceptance.batchId },
      select: { state: true },
    });
    if (!batch || !['SUCCEEDED', 'PARTIAL', 'FAILED'].includes(batch.state)) {
      throw new Error('grading-lab-hidden-batch-not-terminal');
    }
    const updated = await db.teacherAiGradingHiddenAcceptance.updateMany({
      where: { id: acceptanceId, state: 'RUNNING', configId, batchId: acceptance.batchId },
      data: { state: 'CONSUMED', consumedAt: now, updatedAt: now },
    });
    if (updated.count !== 1) throw new Error('grading-lab-hidden-acceptance-fenced');
    return { splitId: acceptance.splitId, batchId: acceptance.batchId, replay: false };
  };

  const consumed = input.db.$transaction
    ? await input.db.$transaction(consume, { isolationLevel: 'Serializable' })
    : await consume(input.db);
  const result = await input.loadRevealed(input.db, { acceptanceId, splitId: consumed.splitId, batchId: consumed.batchId });
  return { result, replay: consumed.replay };
}

async function lockAcceptance(db: EvaluationDb, acceptanceId: string): Promise<void> {
  if (db.$queryRawUnsafe) {
    await db.$queryRawUnsafe(
      'SELECT "id" FROM "TeacherAiGradingHiddenAcceptance" WHERE "id" = $1 FOR UPDATE',
      acceptanceId,
    );
  }
}

function requireToken(value: string, errorCode: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function hashJson(value: unknown): string {
  return hashText(JSON.stringify(canonicalize(value)));
}

function hashText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function sameStringSet(left: string[], right: string[]): boolean {
  return left.length === right.length
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.every((value) => right.includes(value));
}

function isUniqueConstraint(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}

function isTransactionConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2034');
}
