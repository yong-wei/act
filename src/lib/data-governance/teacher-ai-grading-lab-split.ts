import { createHash } from 'node:crypto';

type SplitDb = Record<string, any>;

export const TEACHER_AI_GRADING_LAB_SPLIT_ALGORITHM_VERSION = 'compound-stratified-largest-remainder.v1' as const;

export interface TeacherAiGradingLabSplitSample {
  sampleId: string;
  scoreBand: string;
  primaryErrorType: string;
}

export interface CreateTeacherAiGradingLabSplitInput {
  db: SplitDb;
  datasetId: string;
  datasetVersion: string;
  randomSeed: string;
  tuningRatio: number;
  samples: TeacherAiGradingLabSplitSample[];
  createHiddenAcceptance?: boolean;
  now?: Date;
}

export interface TeacherAiGradingLabSplitMemberAllocation extends TeacherAiGradingLabSplitSample {
  stratumKey: string;
  partition: 'TUNING' | 'HIDDEN';
  allocationRank: number;
}

export interface TeacherAiGradingLabSplitAllocation {
  algorithmVersion: typeof TEACHER_AI_GRADING_LAB_SPLIT_ALGORITHM_VERSION;
  seed: string;
  tuningRatioBasisPoints: number;
  contentHash: string;
  sampleCount: number;
  tuningCount: number;
  hiddenCount: number;
  members: TeacherAiGradingLabSplitMemberAllocation[];
}

export interface TeacherAiGradingLabSplitReference {
  id: string;
  datasetId: string;
  datasetVersion: string;
  version: number;
  algorithmVersion: string;
  contentHash: string;
  sampleCount: number;
  tuningCount: number;
  hiddenCount: number;
  hiddenState: 'SEALED' | 'RUNNING' | 'CONSUMED' | null;
  preflight: boolean;
}

export function stratifyTeacherAiGradingLabSamples(input: Omit<CreateTeacherAiGradingLabSplitInput, 'db' | 'now'>): TeacherAiGradingLabSplitAllocation {
  const datasetId = requireToken(input.datasetId, 'grading-lab-split-dataset-id-missing');
  const datasetVersion = requireToken(input.datasetVersion, 'grading-lab-split-dataset-version-missing');
  const seed = requireToken(input.randomSeed, 'grading-lab-split-seed-missing');
  const tuningRatioBasisPoints = toBasisPoints(input.tuningRatio);
  if (input.samples.length < 2) throw new Error('grading-lab-split-samples-insufficient');

  const sampleIds = new Set<string>();
  const strata = new Map<string, TeacherAiGradingLabSplitSample[]>();
  for (const source of input.samples) {
    const sampleId = requireToken(source.sampleId, 'grading-lab-split-sample-id-missing');
    const scoreBand = requireToken(source.scoreBand, 'grading-lab-split-score-band-missing');
    const primaryErrorType = requireToken(source.primaryErrorType, 'grading-lab-split-primary-error-type-missing');
    if (sampleIds.has(sampleId)) throw new Error('grading-lab-split-sample-duplicate');
    sampleIds.add(sampleId);
    const sample = { sampleId, scoreBand, primaryErrorType };
    const stratumKey = JSON.stringify([scoreBand, primaryErrorType]);
    const stratum = strata.get(stratumKey) ?? [];
    stratum.push(sample);
    strata.set(stratumKey, stratum);
  }

  const sampleCount = input.samples.length;
  const hiddenCount = input.createHiddenAcceptance === false ? 0 : Math.min(
    sampleCount - 1,
    Math.max(1, Math.round(sampleCount * (10_000 - tuningRatioBasisPoints) / 10_000)),
  );
  const allocations = allocateHiddenByLargestRemainder(strata, hiddenCount, seed);
  const members = [...strata.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([stratumKey, samples]) => {
      const ranked = samples
        .map((sample) => ({
          sample,
          rankHash: hashText(JSON.stringify([
            TEACHER_AI_GRADING_LAB_SPLIT_ALGORITHM_VERSION,
            seed,
            datasetId,
            datasetVersion,
            stratumKey,
            sample.sampleId,
          ])),
        }))
        .sort((left, right) => left.rankHash.localeCompare(right.rankHash) || left.sample.sampleId.localeCompare(right.sample.sampleId));
      const stratumHiddenCount = allocations.get(stratumKey) ?? 0;
      return ranked.map(({ sample }, index): TeacherAiGradingLabSplitMemberAllocation => ({
        ...sample,
        stratumKey,
        partition: index < stratumHiddenCount ? 'HIDDEN' : 'TUNING',
        allocationRank: index + 1,
      }));
    })
    .sort((left, right) => left.sampleId.localeCompare(right.sampleId));
  const contentHash = hashJson({
    algorithmVersion: TEACHER_AI_GRADING_LAB_SPLIT_ALGORITHM_VERSION,
    datasetId,
    datasetVersion,
    seed,
    tuningRatioBasisPoints,
    createHiddenAcceptance: input.createHiddenAcceptance !== false,
    members,
  });

  return {
    algorithmVersion: TEACHER_AI_GRADING_LAB_SPLIT_ALGORITHM_VERSION,
    seed,
    tuningRatioBasisPoints,
    contentHash,
    sampleCount,
    tuningCount: sampleCount - hiddenCount,
    hiddenCount,
    members,
  };
}

export async function createTeacherAiGradingLabSplit(
  input: CreateTeacherAiGradingLabSplitInput,
): Promise<TeacherAiGradingLabSplitReference> {
  const allocation = stratifyTeacherAiGradingLabSamples(input);
  const existing = await findSplitByContent(input.db, input.datasetId.trim(), input.datasetVersion.trim(), allocation.contentHash);
  if (existing) return loadSplitReference(input.db, existing.id);

  const now = input.now ?? new Date();
  const create = async (db: SplitDb) => {
    const replay = await findSplitByContent(db, input.datasetId.trim(), input.datasetVersion.trim(), allocation.contentHash);
    if (replay) return replay;
    const versions = await db.teacherAiGradingLabSplit.aggregate({
      where: { datasetId: input.datasetId.trim(), datasetVersion: input.datasetVersion.trim() },
      _max: { version: true },
    });
    const version = (versions?._max?.version ?? 0) + 1;
    const splitId = `grading-lab-split:${allocation.contentHash.slice(7, 39)}`;
    const split = await db.teacherAiGradingLabSplit.create({
      data: {
        id: splitId,
        datasetId: input.datasetId.trim(),
        datasetVersion: input.datasetVersion.trim(),
        version,
        algorithmVersion: allocation.algorithmVersion,
        seed: allocation.seed,
        tuningRatioBasisPoints: allocation.tuningRatioBasisPoints,
        contentHash: allocation.contentHash,
        sampleCount: allocation.sampleCount,
        tuningCount: allocation.tuningCount,
        hiddenCount: allocation.hiddenCount,
        preflight: input.createHiddenAcceptance === false,
        createdAt: now,
      },
    });
    await db.teacherAiGradingLabSplitMember.createMany({
      data: allocation.members.map((member) => ({ splitId, ...member, createdAt: now })),
    });
    if (input.createHiddenAcceptance !== false) {
      await db.teacherAiGradingHiddenAcceptance.create({
        data: {
          id: `grading-lab-hidden:${allocation.contentHash.slice(7, 39)}`,
          splitId,
          state: 'SEALED',
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    return split;
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const split = input.db.$transaction
        ? await input.db.$transaction(create, { isolationLevel: 'Serializable' })
        : await create(input.db);
      return loadSplitReference(input.db, split.id);
    } catch (error) {
      const replay = await findSplitByContent(input.db, input.datasetId.trim(), input.datasetVersion.trim(), allocation.contentHash);
      if (replay) return loadSplitReference(input.db, replay.id);
      if ((!isUniqueConstraint(error) && !isTransactionConflict(error)) || attempt === 2) throw error;
    }
  }
  throw new Error('grading-lab-split-version-allocation-failed');
}

async function loadSplitReference(db: SplitDb, splitId: string): Promise<TeacherAiGradingLabSplitReference> {
  const split = await db.teacherAiGradingLabSplit.findUnique({
    where: { id: splitId },
    select: {
      id: true,
      datasetId: true,
      datasetVersion: true,
      version: true,
      algorithmVersion: true,
      contentHash: true,
      sampleCount: true,
      tuningCount: true,
      hiddenCount: true,
      preflight: true,
      hiddenAcceptance: { select: { state: true } },
    },
  });
  if (!split) throw new Error('grading-lab-split-not-found');
  return {
    id: split.id,
    datasetId: split.datasetId,
    datasetVersion: split.datasetVersion,
    version: split.version,
    algorithmVersion: split.algorithmVersion,
    contentHash: split.contentHash,
    sampleCount: split.sampleCount,
    tuningCount: split.tuningCount,
    hiddenCount: split.hiddenCount,
    hiddenState: split.hiddenAcceptance?.state ?? null,
    preflight: split.preflight,
  };
}

async function findSplitByContent(db: SplitDb, datasetId: string, datasetVersion: string, contentHash: string): Promise<any> {
  return db.teacherAiGradingLabSplit.findFirst({ where: { datasetId, datasetVersion, contentHash } });
}

function allocateHiddenByLargestRemainder(
  strata: Map<string, TeacherAiGradingLabSplitSample[]>,
  hiddenCount: number,
  seed: string,
): Map<string, number> {
  const total = [...strata.values()].reduce((sum, samples) => sum + samples.length, 0);
  const quotas = [...strata.entries()].map(([stratumKey, samples]) => {
    const numerator = samples.length * hiddenCount;
    return {
      stratumKey,
      base: Math.floor(numerator / total),
      remainder: numerator % total,
      tieBreak: hashText(JSON.stringify([TEACHER_AI_GRADING_LAB_SPLIT_ALGORITHM_VERSION, seed, stratumKey])),
    };
  });
  const assigned = quotas.reduce((sum, quota) => sum + quota.base, 0);
  const remainderWinners = new Set(quotas
    .sort((left, right) => right.remainder - left.remainder
      || left.tieBreak.localeCompare(right.tieBreak)
      || left.stratumKey.localeCompare(right.stratumKey))
    .slice(0, hiddenCount - assigned)
    .map((quota) => quota.stratumKey));
  return new Map(quotas.map((quota) => [quota.stratumKey, quota.base + (remainderWinners.has(quota.stratumKey) ? 1 : 0)]));
}

function toBasisPoints(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) throw new Error('grading-lab-split-tuning-ratio-invalid');
  const basisPoints = Math.round(ratio * 10_000);
  if (Math.abs(ratio - basisPoints / 10_000) > Number.EPSILON * 8) {
    throw new Error('grading-lab-split-tuning-ratio-precision-invalid');
  }
  return basisPoints;
}

function requireToken(value: string, errorCode: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function hashJson(value: unknown): string {
  return hashText(JSON.stringify(value));
}

function hashText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function isUniqueConstraint(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}

function isTransactionConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2034');
}
