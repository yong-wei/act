import { prisma } from '@/lib/prisma';

import {
  createArenaChallengePublication,
  type ArenaChallengePublication,
  type ArenaPublicationVisibility,
} from './configuration';
import {
  buildArenaPublicationReport,
  type ArenaPublicationReport,
  type ArenaPublicationReportRosterStudent,
} from './publication-report';
import { prismaArenaSubmissionStore, type ArenaSubmissionListOptions } from '../submissions/prisma-store';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';

export type { ArenaPublicationVisibility, ArenaTelemetryLevel } from './configuration';

export type ArenaPublicationStatus = 'draft' | 'active' | 'paused' | 'archived' | 'closed';
export type ArenaActorRole = 'TEACHER' | 'ADMIN' | 'STUDENT';

export interface ArenaPublicationActor {
  id: string;
  role: ArenaActorRole;
}

export interface ArenaPublicationGradingPolicy {
  hideFullLeaderboardBeforeDeadline?: boolean;
  allowLateSubmissions?: boolean;
  seasonId?: string;
  [key: string]: unknown;
}

export interface ArenaPublicationRecord extends ArenaChallengePublication {
  id: string;
  teacherId: string;
  visibility: ArenaPublicationVisibility;
  status: ArenaPublicationStatus;
  gradingPolicy: ArenaPublicationGradingPolicy;
  createdAt: string;
  updatedAt: string;
}

export interface ArenaResolvedSubmissionContext {
  id: string;
  taskId: string;
  visibility: ArenaPublicationVisibility;
  classId?: string;
  seasonId?: string;
  isLate: boolean;
  deadline: string;
  leaderboardPolicyId: string;
  gradingPolicy: ArenaPublicationGradingPolicy;
}

export class ArenaPublicationPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArenaPublicationPermissionError';
  }
}

export class ArenaPublicationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArenaPublicationAccessError';
  }
}

type ArenaPublicationDb = {
  class: {
    findUnique(args: unknown): Promise<{ id: string; teacherId: string } | null>;
  };
  arenaChallengePublication: {
    create(args: unknown): Promise<Record<string, unknown>>;
    findUnique(args: unknown): Promise<Record<string, unknown> | null>;
    findMany?: (args: unknown) => Promise<Record<string, unknown>[]>;
    update(args: unknown): Promise<Record<string, unknown>>;
  };
  studentProfile?: {
    findUnique(args: unknown): Promise<{ userId: string; classId: string | null } | null>;
    findMany?: (args: unknown) => Promise<Array<{
      userId: string;
      user?: {
        name?: string | null;
        email?: string | null;
      } | null;
    }>>;
  };
};

export interface CreateArenaPublicationRecordInput {
  actor: ArenaPublicationActor;
  taskId: string;
  classId: string;
  visibility: ArenaPublicationVisibility;
  deadline: string;
  leaderboardPolicyId: string;
  homeworkBinding: boolean;
  gradingPolicy?: ArenaPublicationGradingPolicy;
  status?: ArenaPublicationStatus;
  templateId?: string;
  targetSignal?: string;
  disturbance?: string;
  initialCondition?: string;
  allowedMethods?: ArenaChallengePublication['allowedMethods'];
  hardConstraints?: string[];
  scoringMetricWeights?: Record<string, number>;
  paretoEnabled?: boolean;
  hiddenTestEnabled?: boolean;
  publicLeaderboard?: boolean;
  telemetryLevel?: ArenaChallengePublication['telemetryLevel'];
}

export interface ResolveAccessibleArenaPublicationInput {
  publicationId: string;
  studentId: string;
  taskId: string;
  now?: Date;
  allowAfterDeadline?: boolean;
}

export interface ListArenaPublicationsForStudentInput {
  studentId: string;
  now?: Date;
}

export interface UpdateArenaPublicationStatusInput {
  actor: ArenaPublicationActor;
  publicationId: string;
  status: ArenaPublicationStatus;
}

export interface LoadArenaPublicationReportForActorInput {
  actor: ArenaPublicationActor;
  publicationId: string;
  listSubmissions?: (options: ArenaSubmissionListOptions) => Promise<ArenaSubmissionRecord[]>;
}

function isArenaPublicationStatus(value: unknown): value is ArenaPublicationStatus {
  return value === 'draft' || value === 'active' || value === 'paused' || value === 'archived' || value === 'closed';
}

function isArenaPublicationVisibility(value: unknown): value is ArenaPublicationVisibility {
  return value === 'class' || value === 'course' || value === 'public';
}

function readDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return new Date(0).toISOString();
}

function readGradingPolicy(value: unknown): ArenaPublicationGradingPolicy {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ArenaPublicationGradingPolicy
    : {};
}

function toRecord(row: Record<string, unknown>): ArenaPublicationRecord {
  const config = row.config && typeof row.config === 'object' && !Array.isArray(row.config)
    ? row.config as Partial<ArenaChallengePublication>
    : {};
  const visibility = isArenaPublicationVisibility(row.visibility) ? row.visibility : 'class';
  const status = isArenaPublicationStatus(row.status) ? row.status : 'active';

  return {
    id: String(row.id),
    taskId: String(row.taskId),
    classId: String(row.classId),
    teacherId: String(row.teacherId),
    studentVisibility: visibility,
    visibility,
    deadline: readDate(row.deadline),
    leaderboardPolicyId: String(row.leaderboardPolicyId),
    homeworkBinding: Boolean(row.homeworkBinding),
    templateId: typeof config.templateId === 'string' ? config.templateId : undefined,
    targetSignal: typeof config.targetSignal === 'string' ? config.targetSignal : '单位阶跃参考输入',
    disturbance: typeof config.disturbance === 'string' ? config.disturbance : '无外加扰动',
    initialCondition: typeof config.initialCondition === 'string' ? config.initialCondition : '零初始状态',
    allowedMethods: Array.isArray(config.allowedMethods) ? config.allowedMethods as ArenaChallengePublication['allowedMethods'] : [],
    hardConstraints: Array.isArray(config.hardConstraints) ? config.hardConstraints as string[] : [],
    scoringMetricWeights: config.scoringMetricWeights && typeof config.scoringMetricWeights === 'object'
      ? config.scoringMetricWeights as Record<string, number>
      : {},
    paretoEnabled: Boolean(config.paretoEnabled),
    hiddenTestEnabled: Boolean(config.hiddenTestEnabled),
    gradeBinding: Boolean(row.homeworkBinding),
    publicLeaderboard: Boolean(config.publicLeaderboard),
    telemetryLevel: config.telemetryLevel === 'L1' || config.telemetryLevel === 'L2' || config.telemetryLevel === 'L3'
      ? config.telemetryLevel
      : 'L0',
    status,
    gradingPolicy: readGradingPolicy(row.gradingPolicy),
    createdAt: readDate(row.createdAt),
    updatedAt: readDate(row.updatedAt),
  };
}

async function assertTeacherCanUseClass(
  db: ArenaPublicationDb,
  actor: ArenaPublicationActor,
  classId: string,
): Promise<{ id: string; teacherId: string }> {
  const targetClass = await db.class.findUnique({
    where: { id: classId },
    select: { id: true, teacherId: true },
  });
  if (!targetClass) {
    throw new ArenaPublicationPermissionError('Arena publication class was not found.');
  }
  if (actor.role !== 'ADMIN' && targetClass.teacherId !== actor.id) {
    throw new ArenaPublicationPermissionError('Teacher is not allowed to manage this class.');
  }
  return targetClass;
}

async function assertActorCanManagePublication(
  db: ArenaPublicationDb,
  actor: ArenaPublicationActor,
  publication: Record<string, unknown>,
) {
  if (actor.role === 'ADMIN') return;
  await assertTeacherCanUseClass(db, actor, String(publication.classId));
}

async function listPublicationRoster(
  db: ArenaPublicationDb,
  classId: string,
): Promise<ArenaPublicationReportRosterStudent[]> {
  if (typeof db.studentProfile?.findMany !== 'function') {
    return [];
  }

  const rows = await db.studentProfile.findMany({
    where: { classId },
    select: {
      userId: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return rows
    .map((row) => ({
      userId: row.userId,
      studentLabel: row.user?.name ?? row.user?.email ?? row.userId,
    }))
    .sort((left, right) => left.studentLabel.localeCompare(right.studentLabel, 'zh-Hans-CN'));
}

export async function createArenaPublicationRecord(
  db: ArenaPublicationDb,
  input: CreateArenaPublicationRecordInput,
): Promise<ArenaPublicationRecord> {
  const targetClass = await assertTeacherCanUseClass(db, input.actor, input.classId);
  const preview = createArenaChallengePublication({
    taskId: input.taskId,
    classId: input.classId,
    visibility: input.visibility,
    deadline: input.deadline,
    leaderboardPolicyId: input.leaderboardPolicyId,
    homeworkBinding: input.homeworkBinding,
    templateId: input.templateId,
    targetSignal: input.targetSignal,
    disturbance: input.disturbance,
    initialCondition: input.initialCondition,
    allowedMethods: input.allowedMethods,
    hardConstraints: input.hardConstraints,
    scoringMetricWeights: input.scoringMetricWeights,
    paretoEnabled: input.paretoEnabled,
    hiddenTestEnabled: input.hiddenTestEnabled,
    publicLeaderboard: input.publicLeaderboard,
    telemetryLevel: input.telemetryLevel,
  });

  const row = await db.arenaChallengePublication.create({
    data: {
      taskId: preview.taskId,
      classId: targetClass.id,
      teacherId: targetClass.teacherId,
      visibility: preview.studentVisibility,
      deadline: new Date(preview.deadline),
      leaderboardPolicyId: preview.leaderboardPolicyId,
      homeworkBinding: preview.homeworkBinding,
      gradingPolicy: input.gradingPolicy ?? {},
      status: input.status ?? 'active',
      config: preview,
    },
  });

  return toRecord(row);
}

export async function listArenaPublicationsForActor(
  db: ArenaPublicationDb,
  actor: ArenaPublicationActor,
  options?: { classId?: string; status?: ArenaPublicationStatus },
): Promise<ArenaPublicationRecord[]> {
  if (!db.arenaChallengePublication.findMany) return [];
  const rows = await db.arenaChallengePublication.findMany({
    where: {
      ...(actor.role === 'ADMIN' ? {} : { teacherId: actor.id }),
      ...(options?.classId ? { classId: options.classId } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toRecord);
}

export async function listArenaPublicationsForStudent(
  db: Pick<ArenaPublicationDb, 'arenaChallengePublication' | 'studentProfile'>,
  input: ListArenaPublicationsForStudentInput,
): Promise<ArenaPublicationRecord[]> {
  if (!db.arenaChallengePublication.findMany) return [];
  const profile = await db.studentProfile?.findUnique({
    where: { userId: input.studentId },
    select: { userId: true, classId: true },
  });
  const classId = profile?.classId ?? undefined;
  const rows = await db.arenaChallengePublication.findMany({
    where: {
      status: 'active',
      OR: [
        { visibility: { in: ['course', 'public'] } },
        ...(classId ? [{ visibility: 'class', classId }] : []),
      ],
    },
    orderBy: { deadline: 'asc' },
  });
  const now = input.now ?? new Date();
  return rows
    .map(toRecord)
    .filter((publication) => {
      if (publication.gradingPolicy.allowLateSubmissions === true) return true;
      return now.getTime() <= Date.parse(publication.deadline);
    });
}

export async function updateArenaPublicationStatus(
  db: ArenaPublicationDb,
  input: UpdateArenaPublicationStatusInput,
): Promise<ArenaPublicationRecord> {
  const existing = await db.arenaChallengePublication.findUnique({
    where: { id: input.publicationId },
  });
  if (!existing) {
    throw new ArenaPublicationPermissionError('Arena publication was not found.');
  }
  await assertActorCanManagePublication(db, input.actor, existing);
  const row = await db.arenaChallengePublication.update({
    where: { id: input.publicationId },
    data: { status: input.status },
  });
  return toRecord(row);
}

export async function loadArenaPublicationReportForActor(
  db: ArenaPublicationDb,
  input: LoadArenaPublicationReportForActorInput,
): Promise<ArenaPublicationReport> {
  const row = await db.arenaChallengePublication.findUnique({
    where: { id: input.publicationId },
  });
  if (!row) {
    throw new ArenaPublicationPermissionError('Arena publication was not found.');
  }
  await assertActorCanManagePublication(db, input.actor, row);

  const publication = toRecord(row);
  const listSubmissions = input.listSubmissions ?? prismaArenaSubmissionStore.listSubmissions;
  const [submissions, roster] = await Promise.all([
    listSubmissions({
      taskId: publication.taskId,
      publicationId: publication.id,
      ...(publication.visibility === 'class' ? { classId: publication.classId } : {}),
    }),
    publication.visibility === 'class' ? listPublicationRoster(db, publication.classId) : Promise.resolve([]),
  ]);

  return buildArenaPublicationReport({
    publication,
    submissions,
    roster,
  });
}

export async function resolveAccessibleArenaPublicationForStudent(
  db: Pick<ArenaPublicationDb, 'arenaChallengePublication' | 'studentProfile'>,
  input: ResolveAccessibleArenaPublicationInput,
): Promise<ArenaResolvedSubmissionContext> {
  const row = await db.arenaChallengePublication.findUnique({
    where: { id: input.publicationId },
  });
  if (!row) {
    throw new ArenaPublicationAccessError('Arena publication was not found.');
  }
  const publication = toRecord(row);
  if (publication.taskId !== input.taskId) {
    throw new ArenaPublicationAccessError('Arena publication does not match this task.');
  }
  if (publication.status !== 'active') {
    throw new ArenaPublicationAccessError('Arena publication is not active.');
  }

  const profile = await db.studentProfile?.findUnique({
    where: { userId: input.studentId },
    select: { userId: true, classId: true },
  });
  const studentClassId = profile?.classId ?? null;
  if (publication.visibility === 'class' && studentClassId !== publication.classId) {
    throw new ArenaPublicationAccessError('Student is not allowed to access this Arena publication.');
  }

  const now = input.now ?? new Date();
  const isLate = now.getTime() > Date.parse(publication.deadline);
  if (isLate && publication.gradingPolicy.allowLateSubmissions !== true && input.allowAfterDeadline !== true) {
    throw new ArenaPublicationAccessError('Arena publication deadline has passed.');
  }
  const submissionClassId = publication.visibility === 'class'
    ? publication.classId
    : studentClassId ?? undefined;

  return {
    id: publication.id,
    taskId: publication.taskId,
    visibility: publication.visibility,
    classId: submissionClassId,
    seasonId: typeof publication.gradingPolicy.seasonId === 'string' ? publication.gradingPolicy.seasonId : undefined,
    isLate,
    deadline: publication.deadline,
    leaderboardPolicyId: publication.leaderboardPolicyId,
    gradingPolicy: publication.gradingPolicy,
  };
}

export const prismaArenaPublicationStore = {
  create(input: CreateArenaPublicationRecordInput) {
    return createArenaPublicationRecord(prisma as unknown as ArenaPublicationDb, input);
  },
  list(actor: ArenaPublicationActor, options?: { classId?: string; status?: ArenaPublicationStatus }) {
    return listArenaPublicationsForActor(prisma as unknown as ArenaPublicationDb, actor, options);
  },
  updateStatus(input: UpdateArenaPublicationStatusInput) {
    return updateArenaPublicationStatus(prisma as unknown as ArenaPublicationDb, input);
  },
  loadReport(input: LoadArenaPublicationReportForActorInput) {
    return loadArenaPublicationReportForActor(prisma as unknown as ArenaPublicationDb, input);
  },
  resolveForStudent(input: ResolveAccessibleArenaPublicationInput) {
    return resolveAccessibleArenaPublicationForStudent(prisma as unknown as ArenaPublicationDb, input);
  },
  listForStudent(input: ListArenaPublicationsForStudentInput) {
    return listArenaPublicationsForStudent(prisma as unknown as ArenaPublicationDb, input);
  },
};
