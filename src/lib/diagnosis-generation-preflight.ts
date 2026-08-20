import { createHash } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import {
  assertTeacherClassScope,
  DIAGNOSIS_REPORT_GENERATOR_VERSION,
} from '@/lib/diagnosis-persistence';
import { CURRENT_RISK_FLAG_TYPES } from '@/lib/risk-scanner';

export const DIAGNOSIS_PREFLIGHT_RULE_VERSION = 'teacher-diagnosis-preflight.v1';

export type DiagnosisPreflightStatus =
  | 'FIRST_GENERATION'
  | 'NEW_EVIDENCE'
  | 'VERSION_CHANGE'
  | 'NO_EFFECTIVE_CHANGE'
  | 'ACTIVE_JOB'
  | 'UNAVAILABLE';

export type DiagnosisGenerationReason =
  | 'first-generation'
  | 'new-evidence'
  | 'version-change'
  | 'teacher-forced';

type CategoryName = 'assignment' | 'assessment' | 'learningBehavior' | 'risk' | 'eligibility';
type CategoryAvailability = 'available' | 'unavailable';

interface StoredCategorySummary extends Prisma.JsonObject {
  availability: CategoryAvailability;
  currentCount: number | null;
  itemDigests: string[];
}

interface StoredCategories extends Prisma.JsonObject {
  assignment: StoredCategorySummary;
  assessment: StoredCategorySummary;
  learningBehavior: StoredCategorySummary;
  risk: StoredCategorySummary;
  eligibility: StoredCategorySummary;
}

export interface DiagnosisInputSummary extends Prisma.JsonObject {
  schemaVersion: 'teacher-diagnosis-input-summary.v1';
  categories: StoredCategories;
}

export interface DiagnosisGovernedInput extends Prisma.JsonObject {
  schemaVersion: 'teacher-diagnosis-governed-input.v1';
  classId: string;
  studentIds: string[];
  riskFlags: Prisma.JsonArray;
  competencySnapshots: Prisma.JsonArray;
  knowledgeProgress: Prisma.JsonArray;
}

export interface DiagnosisPreflightCategory {
  availability: CategoryAvailability;
  currentCount: number | null;
  changedCount: number | null;
}

export interface DiagnosisGenerationPreflight {
  status: DiagnosisPreflightStatus;
  canGenerate: boolean;
  canForce: boolean;
  evidenceCutoff: Date;
  generatorVersion: string;
  ruleVersion: string;
  previousReport: {
    id: string;
    evidenceCutoff: Date;
    generatedAt: Date;
  } | null;
  activeJob: {
    id: string;
    state: string;
    evidenceCutoff: Date;
  } | null;
  categories: Record<CategoryName, DiagnosisPreflightCategory>;
  inputSummary: DiagnosisInputSummary;
  governedInput: DiagnosisGovernedInput;
  inputDigest: string;
  ordinaryGenerationIdentity: string;
  generationReason: Exclude<DiagnosisGenerationReason, 'teacher-forced'> | null;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalizeJson(child)]));
}

export function digestDiagnosisGovernedInput(value: unknown) {
  return sha256(JSON.stringify(canonicalizeJson(value)));
}

function itemDigests(rows: unknown[]) {
  return rows.map((row) => sha256(JSON.stringify(row))).sort();
}

function differenceCount(current: string[], previous: string[]) {
  const currentSet = new Set(current);
  const previousSet = new Set(previous);
  return current.filter((item) => !previousSet.has(item)).length
    + previous.filter((item) => !currentSet.has(item)).length;
}

function readPreviousSummary(value: Prisma.JsonValue | null): DiagnosisInputSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 'teacher-diagnosis-input-summary.v1') return null;
  const categories = record.categories;
  if (!categories || typeof categories !== 'object' || Array.isArray(categories)) return null;
  for (const name of ['assignment', 'assessment', 'learningBehavior', 'risk', 'eligibility'] as const) {
    const category = (categories as Record<string, unknown>)[name];
    if (!category || typeof category !== 'object' || Array.isArray(category)) return null;
    const itemValues = (category as Record<string, unknown>).itemDigests;
    if (!Array.isArray(itemValues) || itemValues.some((item) => typeof item !== 'string')) return null;
  }
  return value as DiagnosisInputSummary;
}

function publicCategories(
  current: DiagnosisInputSummary,
  previous: DiagnosisInputSummary | null,
): Record<CategoryName, DiagnosisPreflightCategory> {
  return Object.fromEntries(
    (Object.keys(current.categories) as CategoryName[]).map((name) => {
      const category = current.categories[name];
      const prior = previous?.categories[name];
      return [name, {
        availability: category.availability,
        currentCount: category.currentCount,
        changedCount: category.availability === 'unavailable'
          ? null
          : prior
            ? differenceCount(category.itemDigests, prior.itemDigests)
            : category.currentCount,
      }];
    }),
  ) as Record<CategoryName, DiagnosisPreflightCategory>;
}

function unavailableCategory(): StoredCategorySummary {
  return { availability: 'unavailable', currentCount: null, itemDigests: [] };
}

function projectRiskEvidenceSummary(value: Prisma.JsonValue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const evidence = value as Record<string, unknown>;
  return {
    ...(typeof evidence.lowProgressNodeCount === 'number'
      ? { lowProgressNodeCount: evidence.lowProgressNodeCount }
      : {}),
    ...(typeof evidence.avgProgress === 'number'
      ? { averageProgress: evidence.avgProgress }
      : {}),
    ...(typeof evidence.stuckNodeCount === 'number'
      ? { stuckNodeCount: evidence.stuckNodeCount }
      : {}),
    ...(typeof evidence.standardDeviation === 'number'
      ? { standardDeviation: evidence.standardDeviation }
      : {}),
    ...(typeof evidence.dimensionCount === 'number'
      ? { dimensionCount: evidence.dimensionCount }
      : {}),
    ...(typeof evidence.evidenceCutoff === 'string'
      ? { evidenceCutoff: evidence.evidenceCutoff }
      : {}),
  };
}

export function projectDiagnosisGenerationPreflight(preflight: DiagnosisGenerationPreflight) {
  return {
    status: preflight.status,
    canGenerate: preflight.canGenerate,
    canForce: preflight.canForce,
    evidenceCutoff: preflight.evidenceCutoff.toISOString(),
    generatorVersion: preflight.generatorVersion,
    ruleVersion: preflight.ruleVersion,
    previousReport: preflight.previousReport
      ? {
          id: preflight.previousReport.id,
          evidenceCutoff: preflight.previousReport.evidenceCutoff.toISOString(),
          generatedAt: preflight.previousReport.generatedAt.toISOString(),
        }
      : null,
    activeJob: preflight.activeJob
      ? {
          id: preflight.activeJob.id,
          state: preflight.activeJob.state,
          evidenceCutoff: preflight.activeJob.evidenceCutoff.toISOString(),
        }
      : null,
    categories: preflight.categories,
  };
}

export type DiagnosisGenerationPreflightApiItem = ReturnType<typeof projectDiagnosisGenerationPreflight>;

export async function preflightDiagnosisGeneration(
  db: PrismaClient,
  input: {
    teacherId: string;
    classId: string;
    targetStudentId?: string | null;
    now?: Date;
  },
): Promise<DiagnosisGenerationPreflight> {
  await assertTeacherClassScope(db as never, {
    teacherId: input.teacherId,
    classId: input.classId,
    targetStudentId: input.targetStudentId,
    requireActive: true,
  });
  const evidenceCutoff = input.now ?? new Date();
  const scopeType = input.targetStudentId ? 'student' : 'class';
  const scopeId = input.targetStudentId ?? input.classId;
  const activeScopeKey = `${input.teacherId}:${input.classId}:${input.targetStudentId ?? 'class'}`;
  const [activeJob, previousReport, members] = await Promise.all([
    db.diagnosisGenerationJob.findUnique({
      where: { activeScopeKey },
      select: { id: true, state: true, evidenceCutoff: true },
    }),
    db.diagnosisReport.findFirst({
      where: {
        classId: input.classId,
        ...(input.targetStudentId
          ? { targetUserId: input.targetStudentId }
          : { targetUserId: null }),
      },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        evidenceCutoff: true,
        generatedAt: true,
        generatorVersion: true,
        ruleVersion: true,
        inputSummary: true,
        inputDigest: true,
      },
    }),
    input.targetStudentId
      ? Promise.resolve([{ userId: input.targetStudentId }])
      : db.studentProfile.findMany({
          where: { classId: input.classId },
          orderBy: { userId: 'asc' },
          take: 501,
          select: { userId: true },
        }),
  ]);
  const studentIds = members.map((member) => member.userId);
  const [riskRows, progressRows, competencyRows] = studentIds.length === 0
    ? [[], [], []]
    : await Promise.all([
        db.studentRiskFlag.findMany({
          where: {
            userId: { in: studentIds },
            isResolved: false,
            flagType: { in: [...CURRENT_RISK_FLAG_TYPES] },
            evidenceObservedAt: { lte: evidenceCutoff },
          },
          orderBy: [{ triggeredAt: 'desc' }, { id: 'asc' }],
          take: 500,
          select: {
            id: true,
            userId: true,
            flagType: true,
            severity: true,
            description: true,
            evidenceJson: true,
            triggeredAt: true,
            evidenceObservedAt: true,
          },
        }),
        db.knowledgeProgress.findMany({
          where: { userId: { in: studentIds }, lastVisited: { lte: evidenceCutoff } },
          orderBy: [{ userId: 'asc' }, { lastVisited: 'desc' }, { id: 'asc' }],
          take: 1_000,
          select: {
            id: true,
            userId: true,
            nodeId: true,
            status: true,
            progress: true,
            timeSpent: true,
            lastVisited: true,
          },
        }),
        input.targetStudentId
          ? Promise.resolve([])
          : db.studentCompetencySnapshot.findMany({
              // portrait-v2-legacy-compatibility-adapter: mirror the current
              // provider's non-sovereign compatibility input until it migrates.
              where: { userId: { in: studentIds }, snapshotAt: { lte: evidenceCutoff } },
              orderBy: [{ userId: 'asc' }, { snapshotAt: 'desc' }, { id: 'asc' }],
              distinct: ['userId'],
              take: Math.max(studentIds.length, 1),
              select: {
                id: true,
                userId: true,
                snapshotAt: true,
                // portrait-v2-legacy-compatibility-adapter: non-sovereign field.
                competencyVector: true,
                calculationVersion: true,
              },
            }),
      ]);
  const riskInput = riskRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    type: row.flagType,
    severity: row.severity,
    description: row.description,
    evidenceSummary: projectRiskEvidenceSummary(row.evidenceJson),
    triggeredAt: row.triggeredAt.toISOString(),
    observedAt: row.evidenceObservedAt.toISOString(),
  })).sort((left, right) => right.triggeredAt.localeCompare(left.triggeredAt)
    || left.id.localeCompare(right.id));
  const progressInput = progressRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    nodeId: row.nodeId,
    status: row.status,
    progress: row.progress,
    timeSpent: row.timeSpent,
    lastVisited: row.lastVisited.toISOString(),
  })).sort((left, right) => left.userId.localeCompare(right.userId)
    || right.lastVisited.localeCompare(left.lastVisited)
    || left.id.localeCompare(right.id));
  const competencyInput = competencyRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    snapshotAt: row.snapshotAt.toISOString(),
    // portrait-v2-legacy-compatibility-adapter: frozen non-sovereign provider input.
    competencyVector: row.competencyVector,
    calculationVersion: row.calculationVersion,
  })).sort((left, right) => left.userId.localeCompare(right.userId)
    || right.snapshotAt.localeCompare(left.snapshotAt)
    || left.id.localeCompare(right.id));
  const governedInput: DiagnosisGovernedInput = {
    schemaVersion: 'teacher-diagnosis-governed-input.v1',
    classId: input.classId,
    studentIds,
    riskFlags: riskInput,
    competencySnapshots: competencyInput,
    knowledgeProgress: progressInput,
  };
  const riskItems = itemDigests(riskInput);
  const progressItems = itemDigests(progressInput);
  const competencyByStudent = new Map(competencyRows.map((row) => [row.userId, row]));
  const eligibilityItems = itemDigests(studentIds.map((userId) => {
    const row = competencyByStudent.get(userId);
    return {
      userId,
      competency: row
        ? {
            id: row.id,
            snapshotAt: row.snapshotAt.toISOString(),
            calculationVersion: row.calculationVersion,
            // portrait-v2-legacy-compatibility-adapter: audit identity only;
            // this vector never becomes a primary learner portrait.
            competencyVector: row.competencyVector,
          }
        : null,
    };
  }));
  const inputSummary: DiagnosisInputSummary = {
    schemaVersion: 'teacher-diagnosis-input-summary.v1',
    categories: {
      assignment: unavailableCategory(),
      assessment: unavailableCategory(),
      learningBehavior: {
        availability: 'available',
        currentCount: progressItems.length,
        itemDigests: progressItems,
      },
      risk: {
        availability: 'available',
        currentCount: riskItems.length,
        itemDigests: riskItems,
      },
      eligibility: {
        availability: 'available',
        currentCount: studentIds.length,
        itemDigests: eligibilityItems,
      },
    },
  };
  const inputDigest = digestDiagnosisGovernedInput(governedInput);
  const ordinaryGenerationIdentity = sha256(JSON.stringify({
    teacherId: input.teacherId,
    classId: input.classId,
    scopeType,
    scopeId,
    inputDigest,
    generatorVersion: DIAGNOSIS_REPORT_GENERATOR_VERSION,
    ruleVersion: DIAGNOSIS_PREFLIGHT_RULE_VERSION,
  }));
  const previousSummary = readPreviousSummary(previousReport?.inputSummary ?? null);
  const hasEligibleInput = riskItems.length + progressItems.length + competencyRows.length > 0;
  let status: DiagnosisPreflightStatus;
  let generationReason: DiagnosisGenerationPreflight['generationReason'] = null;
  if (activeJob) {
    status = 'ACTIVE_JOB';
  } else if (!hasEligibleInput) {
    status = 'UNAVAILABLE';
  } else if (!previousReport) {
    status = 'FIRST_GENERATION';
    generationReason = 'first-generation';
  } else if (
    previousReport.generatorVersion !== DIAGNOSIS_REPORT_GENERATOR_VERSION
    || previousReport.ruleVersion !== DIAGNOSIS_PREFLIGHT_RULE_VERSION
    || !previousReport.inputDigest
    || !previousSummary
  ) {
    status = 'VERSION_CHANGE';
    generationReason = 'version-change';
  } else if (previousReport.inputDigest !== inputDigest) {
    status = 'NEW_EVIDENCE';
    generationReason = 'new-evidence';
  } else {
    status = 'NO_EFFECTIVE_CHANGE';
  }
  return {
    status,
    canGenerate: ['FIRST_GENERATION', 'NEW_EVIDENCE', 'VERSION_CHANGE'].includes(status),
    canForce: status === 'NO_EFFECTIVE_CHANGE',
    evidenceCutoff,
    generatorVersion: DIAGNOSIS_REPORT_GENERATOR_VERSION,
    ruleVersion: DIAGNOSIS_PREFLIGHT_RULE_VERSION,
    previousReport: previousReport
      ? {
          id: previousReport.id,
          evidenceCutoff: previousReport.evidenceCutoff,
          generatedAt: previousReport.generatedAt,
        }
      : null,
    activeJob,
    categories: publicCategories(inputSummary, previousSummary),
    inputSummary,
    governedInput,
    inputDigest,
    ordinaryGenerationIdentity,
    generationReason,
  };
}
