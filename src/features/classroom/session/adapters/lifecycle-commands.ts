import { BopppsStage, Prisma, SessionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ClassroomSessionError } from '../errors';
import {
  enqueueSessionFinalizationEvidenceFeatureCacheRefresh,
  enqueueSessionFinalizationEventIngestion,
  enqueueSessionSummaryReportRefresh,
} from '@/lib/data-governance/session-finalization-snapshots';
import { generateSessionSummaryReports } from '@/lib/data-governance/session-reports';
import { logClassroomEvent } from '@/lib/classroom-observability';
import { redisClient } from '@/lib/redis-client';
import { buildClassroomIdentityPayload } from '@/lib/classroom-lifecycle-contract';
import {
  generatedCoursewareRedisFields,
  generatedCoursewareRedisIdentityMatches,
  resolveGeneratedCoursewareSessionBinding,
} from '@/lib/smart-courseware/classroom-runtime';
import { generateUniqueJoinCode } from '@/lib/join-code';
import {
  advanceClassroomSession,
  endClassroomSession,
  openClassroomSessionStream,
  readClassroomSession,
  regenerateClassroomSessionJoinCode,
  type ClassroomLifecycleRuntime,
  type ClassroomReadableSession,
} from '../application/lifecycle';
import { persistSessionEndTransactionCommand } from './submission-evidence-commands';
import type { AdvanceClassroomSessionInput, EndClassroomSessionInput, ReadClassroomSessionInput, StreamClassroomSessionInput } from '../types';

async function generateSessionSummaryReportsSafely(sessionId: string) {
  try {
    return await generateSessionSummaryReports(prisma, sessionId);
  } catch (error) {
    console.error('[SessionReports] Failed to generate session reports:', error);
    return { classReports: 0, studentReports: 0, skipped: true };
  }
}

function asReadableSession(session: {
  id: string;
  joinCode: string;
  status: string;
  classId: string | null;
  currentItemId: string | null;
  currentStage: string | null;
  updatedAt: Date | null;
  plan: { title: string };
  class: { name: string | null } | null;
}): ClassroomReadableSession {
  return session;
}

export function createPrismaClassroomLifecycleRuntime(): ClassroomLifecycleRuntime {
  return {
    now: () => new Date(),
    loadAccessActor: async (actorId) => prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, profile: { select: { classId: true } } },
    }),
    loadAccessSession: async (sessionId) => prisma.classSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        planId: true,
        teacherId: true,
        status: true,
        classId: true,
        coursewarePublicationRevisionId: true,
        coursewareDisplayName: true,
        coursewareRevisionNumber: true,
        coursewarePlanRevisionNumber: true,
        manifestHash: true,
      },
    }),
    resolveGeneratedBinding: async (session) => {
      const generatedResolution = await resolveGeneratedCoursewareSessionBinding(prisma, {
        id: session.id ?? '',
        planId: session.planId ?? '',
        coursewarePublicationRevisionId: session.coursewarePublicationRevisionId ?? null,
        coursewareDisplayName: session.coursewareDisplayName ?? null,
        coursewareRevisionNumber: session.coursewareRevisionNumber ?? null,
        coursewarePlanRevisionNumber: session.coursewarePlanRevisionNumber ?? null,
        manifestHash: session.manifestHash ?? null,
      });
      if (!generatedResolution.ok) {
        return { ok: false, recovery: generatedResolution.recovery as Record<string, unknown> };
      }
      return {
        ok: true,
        identity: generatedResolution.identity
          ? { ...generatedResolution.identity }
          : null,
      };
    },
    readCachedState: async (sessionId, identity) => {
      if (!redisClient.isReady()) return null;
      const cachedState = await redisClient.getSessionState(sessionId);
      const cacheHasExactGeneratedIdentity = !identity
        || generatedCoursewareRedisIdentityMatches(cachedState ?? {}, identity as never);
      if (!cachedState || !cacheHasExactGeneratedIdentity) return null;
      return {
        id: sessionId,
        joinCode: typeof cachedState.joinCode === 'string' ? cachedState.joinCode : '',
        classId: typeof cachedState.classId === 'string' ? cachedState.classId : null,
        class: typeof cachedState.className === 'string' ? { name: cachedState.className } : null,
        currentItemId: cachedState.currentItemId ?? null,
        currentStage: cachedState.currentStage ?? null,
        status: cachedState.status ?? 'ACTIVE',
        updatedAt: cachedState.updatedAt ?? Date.now(),
        planTitle: typeof cachedState.planTitle === 'string' ? cachedState.planTitle : '',
        ...generatedCoursewareRedisFields(identity as never),
        classroomIdentity: buildClassroomIdentityPayload({
          id: sessionId,
          joinCode: typeof cachedState.joinCode === 'string' ? cachedState.joinCode : '',
          classId: typeof cachedState.classId === 'string' ? cachedState.classId : null,
          class: typeof cachedState.className === 'string' ? { name: cachedState.className } : null,
          planTitle: typeof cachedState.planTitle === 'string' ? cachedState.planTitle : '',
        }),
      };
    },
    loadReadableSession: async (sessionId) => {
      const session = await prisma.classSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          joinCode: true,
          status: true,
          classId: true,
          currentItemId: true,
          currentStage: true,
          updatedAt: true,
          planId: true,
          manifestHash: true,
          coursewarePublicationRevisionId: true,
          coursewareDisplayName: true,
          coursewareRevisionNumber: true,
          coursewarePlanRevisionNumber: true,
          plan: { select: { title: true } },
          class: { select: { name: true } },
        },
      });
      return session ? asReadableSession(session) : null;
    },
    writeCachedState: async (sessionId, session, identity) => {
      if (!redisClient.isReady()) return;
      await redisClient.setSessionState(sessionId, {
        joinCode: session.joinCode,
        classId: session.classId,
        className: session.class?.name ?? null,
        currentItemId: session.currentItemId,
        currentStage: session.currentStage,
        status: session.status,
        planTitle: session.plan.title,
        ...generatedCoursewareRedisFields(identity as never),
        updatedAt: session.updatedAt?.getTime() || Date.now(),
      });
    },
    buildIdentity: (session) => buildClassroomIdentityPayload(session),
    persistAdvance: async (input) => {
      const updateData: {
        currentItemId?: string;
        currentStage?: BopppsStage | null;
        status?: SessionStatus;
        endTime?: Date;
        updatedAt?: Date;
      } = { updatedAt: input.updatedAt };
      if (input.currentItemId !== undefined) updateData.currentItemId = input.currentItemId;
      if (input.currentStage !== undefined) {
        updateData.currentStage = input.currentStage as BopppsStage | null;
      }
      if (input.status !== undefined) {
        updateData.status = input.status as SessionStatus;
        if (input.endTime) updateData.endTime = input.endTime;
      }
      if (input.status !== undefined) {
        // 状态转移与写入合并为同一条件更新：禁止任何路径把已闭课会话改回
        // 课前状态，防止闭课后新提交分配高于已固化水位的 ACCEPTED 序列。
        // 不允许 CAS 之后再做第二次无条件写——那会在并发闭课提交后覆盖回课前状态。
        const cas = await prisma.classSession.updateMany({
          where: { id: input.sessionId, status: { not: SessionStatus.FINISHED } },
          data: updateData,
        });
        if (cas.count === 0) {
          throw new ClassroomSessionError('session-finished', 'Session is finished; status transitions are closed');
        }
        const updatedSession = await prisma.classSession.findUnique({
          where: { id: input.sessionId },
          include: {
            plan: { select: { title: true } },
            class: { select: { name: true } },
          },
        });
        if (!updatedSession) {
          throw new ClassroomSessionError('not-found', '课堂不存在');
        }
        return updatedSession;
      }
      const updatedSession = await prisma.classSession.update({
        where: { id: input.sessionId },
        data: updateData,
        include: {
          plan: { select: { title: true } },
          class: { select: { name: true } },
        },
      });
      return updatedSession;
    },
    persistSessionEnd: async (input) => {
      const outcome = await persistSessionEndTransactionCommand(prisma, {
        sessionId: input.sessionId,
        endTime: input.endTime,
      });
      const session = await prisma.classSession.findUnique({
        where: { id: input.sessionId },
        select: {
          id: true,
          joinCode: true,
          status: true,
          classId: true,
          currentItemId: true,
          currentStage: true,
          updatedAt: true,
          planId: true,
          manifestHash: true,
          coursewarePublicationRevisionId: true,
          coursewareDisplayName: true,
          coursewareRevisionNumber: true,
          coursewarePlanRevisionNumber: true,
          plan: { select: { title: true } },
          class: { select: { name: true } },
        },
      });
      if (!session) {
        // 结束事务刚校验过会话存在；此分支仅为类型完备兜底
        throw new Error(`Session ${input.sessionId} disappeared during end transaction`);
      }
      return {
        outcome: outcome.outcome,
        closureRevision: outcome.closureRevision,
        acceptedSubmissionWatermark: outcome.acceptedSubmissionWatermark,
        session: { ...asReadableSession(session) } as ClassroomReadableSession & Record<string, unknown>,
      };
    },
    publishSessionState: async (sessionId, session, identity) => {
      if (!redisClient.isReady()) return;
      const redisState = {
        joinCode: session.joinCode,
        classId: session.classId,
        className: session.class?.name ?? null,
        currentItemId: session.currentItemId,
        currentStage: session.currentStage,
        status: session.status,
        planTitle: session.plan.title,
        ...generatedCoursewareRedisFields(identity as never),
        updatedAt: session.updatedAt?.getTime() || Date.now(),
      };
      await redisClient.setSessionState(sessionId, redisState);
      await redisClient.publishStateChange(sessionId, {
        type: 'update',
        data: redisState,
        timestamp: Date.now(),
      });
    },
    logPatch: (payload) => {
      logClassroomEvent('session_patch', payload);
    },
    finalizeEndedSession: async (sessionId) => {
      await Promise.all([
        enqueueSessionFinalizationEventIngestion(sessionId),
        enqueueSessionFinalizationEvidenceFeatureCacheRefresh(sessionId),
        enqueueSessionSummaryReportRefresh(sessionId),
        generateSessionSummaryReportsSafely(sessionId),
      ]);
    },
    loadStreamSession: async (sessionId) => prisma.classSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        currentItemId: true,
        currentStage: true,
        updatedAt: true,
        teacherId: true,
        classId: true,
      },
    }),
    loadActorClassId: async (actorId) => {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: actorId },
        select: { classId: true },
      });
      return profile?.classId ?? null;
    },
    generateJoinCode: () => generateUniqueJoinCode(prisma),
    persistJoinCode: async (sessionId, joinCode) => prisma.classSession.update({
      where: { id: sessionId },
      data: { joinCode },
      select: { joinCode: true },
    }),
  };
}

export async function readClassroomSessionCommand(input: ReadClassroomSessionInput) {
  return readClassroomSession(createPrismaClassroomLifecycleRuntime(), input);
}

export async function advanceClassroomSessionCommand(input: AdvanceClassroomSessionInput) {
  return advanceClassroomSession(createPrismaClassroomLifecycleRuntime(), input);
}

export async function endClassroomSessionCommand(input: EndClassroomSessionInput) {
  return endClassroomSession(createPrismaClassroomLifecycleRuntime(), input);
}

export async function loadStreamSessionCommand(input: StreamClassroomSessionInput) {
  return openClassroomSessionStream(createPrismaClassroomLifecycleRuntime(), input);
}

export async function regenerateJoinCodeCommand(input: ReadClassroomSessionInput) {
  return regenerateClassroomSessionJoinCode(createPrismaClassroomLifecycleRuntime(), input);
}
