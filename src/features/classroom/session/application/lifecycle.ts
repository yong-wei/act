import { authorizeClassroomSessionAccess, normalizeClassroomActorRole } from '../access-policy';
import { ClassroomSessionError } from '../errors';
import {
  buildClassroomLifecycleEvidenceFields,
  normalizeClassroomLifecycleClientEventAt,
} from '@/lib/classroom-lifecycle-contract';
import {
  BOPPPS_STAGES,
  SESSION_STATUSES,
  type AdvanceClassroomSessionInput,
  type EndClassroomSessionInput,
  type ReadClassroomSessionInput,
  type StreamClassroomSessionInput,
} from '../types';

export interface ClassroomLifecycleAccessSession {
  id?: string;
  teacherId: string;
  classId?: string | null;
  status?: string;
  planId?: string;
  coursewarePublicationRevisionId?: string | null;
  coursewareDisplayName?: string | null;
  coursewareRevisionNumber?: number | null;
  coursewarePlanRevisionNumber?: number | null;
  manifestHash?: string | null;
}

export interface ClassroomReadableSession {
  id: string;
  joinCode: string;
  status: string;
  classId: string | null;
  currentItemId: string | null;
  currentStage: string | null;
  updatedAt: Date | null;
  plan: { title: string };
  class: { name: string | null } | null;
}

export interface ClassroomStreamSession {
  id: string;
  status: string;
  currentItemId: string | null;
  currentStage: string | null;
  updatedAt: Date | null;
  teacherId: string;
  classId: string | null;
}

export interface ClassroomLifecycleRuntime {
  now(): Date;
  loadAccessActor(actorId: string): Promise<{
    id: string;
    role: string;
    profile: { classId: string | null } | null;
  } | null>;
  loadAccessSession(sessionId: string): Promise<ClassroomLifecycleAccessSession | null>;
  resolveGeneratedBinding(session: ClassroomLifecycleAccessSession): Promise<
    | { ok: true; identity: Record<string, unknown> | null }
    | { ok: false; recovery: Record<string, unknown> }
  >;
  readCachedState(
    sessionId: string,
    identity: Record<string, unknown> | null,
  ): Promise<Record<string, unknown> | null>;
  loadReadableSession(sessionId: string): Promise<ClassroomReadableSession | null>;
  writeCachedState(
    sessionId: string,
    session: ClassroomReadableSession,
    identity: Record<string, unknown> | null,
  ): Promise<void>;
  buildIdentity(session: ClassroomReadableSession): unknown;
  persistAdvance(input: {
    sessionId: string;
    currentItemId?: string;
    currentStage?: string | null;
    status?: string;
    endTime?: Date;
    updatedAt: Date;
  }): Promise<ClassroomReadableSession & Record<string, unknown>>;
  /**
   * 闭课专用事务：与提交接受共享同一会话锁，在同一事务内写 status/endTime/
   * acceptedSubmissionWatermark/closureRevision 并 stage 恰好一条闭包 outbox。
   * 重复 end 幂等返回既有水位。FINISHED 转移必须走此边界，不得使用 persistAdvance。
   */
  persistSessionEnd(input: {
    sessionId: string;
    endTime: Date;
    updatedAt: Date;
  }): Promise<{
    outcome: 'ended' | 'already-ended';
    closureRevision: number;
    acceptedSubmissionWatermark: bigint | null;
    session: ClassroomReadableSession & Record<string, unknown>;
  }>;
  publishSessionState(
    sessionId: string,
    session: ClassroomReadableSession,
    identity: Record<string, unknown> | null,
  ): Promise<void>;
  logPatch(payload: Record<string, unknown>): void;
  finalizeEndedSession(sessionId: string): Promise<void>;
  loadStreamSession(sessionId: string): Promise<ClassroomStreamSession | null>;
  loadActorClassId(actorId: string): Promise<string | null>;
  generateJoinCode(): Promise<string>;
  persistJoinCode(sessionId: string, joinCode: string): Promise<{ joinCode: string }>;
}

function normalizeClassroomEvent(
  input: unknown,
  sessionId: string,
  fallbackItemId: string | null | undefined,
  actorRole: 'teacher' | 'student',
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { event: null, error: null };
  }
  const event = input as Record<string, unknown>;
  if (typeof event.eventType !== 'string' || event.eventType.trim().length === 0) {
    return { event: null, error: null };
  }
  const clientEventId = typeof event.clientEventId === 'string' ? event.clientEventId.trim() : '';
  const clientEventAt = normalizeClassroomLifecycleClientEventAt(event.clientEventAt);
  if (clientEventId.length === 0 || clientEventAt === null) {
    return { event: null, error: 'Lifecycle event requires clientEventId and clientEventAt' };
  }
  return {
    event: buildClassroomLifecycleEvidenceFields({
      eventType: event.eventType,
      actorRole,
      sessionId,
      stepId: typeof event.stepId === 'string' ? event.stepId : fallbackItemId ?? null,
      cardId: typeof event.cardId === 'string' ? event.cardId : null,
      clientEventId,
      sourceLogId: typeof event.sourceLogId === 'string' ? event.sourceLogId : null,
      clientEventAt,
    }),
    error: null,
  };
}

export async function readClassroomSession(
  runtime: ClassroomLifecycleRuntime,
  input: ReadClassroomSessionInput,
): Promise<Record<string, unknown>> {
  const [accessUser, sessionAccess] = await Promise.all([
    runtime.loadAccessActor(input.actor.id),
    runtime.loadAccessSession(input.sessionId),
  ]);
  if (!accessUser) throw new ClassroomSessionError('user-not-found', 'User not found');
  if (!sessionAccess) throw new ClassroomSessionError('not-found', 'Not found');
  const auth = authorizeClassroomSessionAccess({
    session: sessionAccess,
    actor: {
      id: accessUser.id,
      role: accessUser.role,
      profile: accessUser.profile ?? input.actor.profile ?? null,
    },
    operation: 'read',
  });
  if (!auth.allowed) throw new ClassroomSessionError('forbidden', 'Forbidden');

  const generatedResolution = await runtime.resolveGeneratedBinding(sessionAccess);
  if (!generatedResolution.ok) {
    throw new ClassroomSessionError(
      'conflict',
      'generated-courseware',
      generatedResolution.recovery,
    );
  }

  const cached = await runtime.readCachedState(input.sessionId, generatedResolution.identity);
  if (cached) return cached;

  const session = await runtime.loadReadableSession(input.sessionId);
  if (!session) throw new ClassroomSessionError('not-found', 'Not found');
  await runtime.writeCachedState(input.sessionId, session, generatedResolution.identity);
  return {
    ...session,
    planTitle: session.plan.title,
    classroomIdentity: runtime.buildIdentity(session),
  };
}

export async function advanceClassroomSession(
  runtime: ClassroomLifecycleRuntime,
  input: AdvanceClassroomSessionInput,
): Promise<Record<string, unknown>> {
  const existingSession = await runtime.loadAccessSession(input.sessionId);
  if (!existingSession) throw new ClassroomSessionError('not-found', '课堂不存在');
  const auth = authorizeClassroomSessionAccess({
    session: existingSession,
    actor: input.actor,
    operation: input.status === 'FINISHED' ? 'end' : 'manage',
  });
  if (!auth.allowed) throw new ClassroomSessionError('forbidden', '无权限修改此课堂');

  const generatedResolution = await runtime.resolveGeneratedBinding(existingSession);
  if (!generatedResolution.ok) {
    throw new ClassroomSessionError(
      'conflict',
      'generated-courseware',
      generatedResolution.recovery,
    );
  }

  const normalizedClassroomEvent = normalizeClassroomEvent(
    input.classroomEvent,
    input.sessionId,
    input.currentItemId,
    normalizeClassroomActorRole(input.actor.role),
  );
  if (normalizedClassroomEvent.error) {
    throw new ClassroomSessionError('invalid-input', normalizedClassroomEvent.error);
  }

  const updatedAt = runtime.now();
  const isEndTransition = input.status === 'FINISHED';
  const persistInput: Parameters<ClassroomLifecycleRuntime['persistAdvance']>[0] = {
    sessionId: input.sessionId,
    updatedAt,
  };
  if (input.currentItemId !== undefined) persistInput.currentItemId = input.currentItemId;
  if (input.currentStage !== undefined) {
    if (input.currentStage !== null && !BOPPPS_STAGES.includes(input.currentStage as typeof BOPPPS_STAGES[number])) {
      throw new ClassroomSessionError('invalid-input', 'Invalid stage value');
    }
    persistInput.currentStage = input.currentStage;
  }
  if (input.status !== undefined) {
    if (!SESSION_STATUSES.includes(input.status as typeof SESSION_STATUSES[number])) {
      throw new ClassroomSessionError('invalid-input', 'Invalid status value');
    }
    // FINISHED 由 persistSessionEnd 事务边界负责，禁止绕过水位写入
    if (!isEndTransition) persistInput.status = input.status;
  }

  let updatedSession: ClassroomReadableSession & Record<string, unknown>;
  if (isEndTransition) {
    const endOutcome = await runtime.persistSessionEnd({
      sessionId: input.sessionId,
      endTime: updatedAt,
      updatedAt,
    });
    updatedSession = endOutcome.session;
  } else {
    updatedSession = await runtime.persistAdvance(persistInput);
  }
  await runtime.publishSessionState(input.sessionId, updatedSession, generatedResolution.identity);

  if (input.currentItemId !== undefined || input.status !== undefined) {
    runtime.logPatch({
      sessionId: input.sessionId,
      actorUserId: input.actor.id,
      currentItemId: input.currentItemId ?? null,
      currentStage: input.currentStage ?? null,
      status: input.status ?? null,
      coursewarePublicationRevisionId: generatedResolution.identity?.publicationRevisionId ?? null,
      coursewareManifestHash: generatedResolution.identity?.manifestHash ?? null,
      classroomEvent: normalizedClassroomEvent.event,
    });
  }

  if (isEndTransition) {
    await runtime.finalizeEndedSession(input.sessionId);
  }

  return updatedSession;
}

export async function endClassroomSession(
  runtime: ClassroomLifecycleRuntime,
  input: EndClassroomSessionInput,
) {
  return advanceClassroomSession(runtime, { ...input, status: 'FINISHED' });
}

export async function openClassroomSessionStream(
  runtime: ClassroomLifecycleRuntime,
  input: StreamClassroomSessionInput,
) {
  const classSession = await runtime.loadStreamSession(input.sessionId);
  if (!classSession) throw new ClassroomSessionError('not-found', 'Session not found');
  let profileClassId = input.actor.profile?.classId ?? null;
  if (!profileClassId) {
    profileClassId = await runtime.loadActorClassId(input.actor.id);
  }
  const auth = authorizeClassroomSessionAccess({
    session: classSession,
    actor: { ...input.actor, profile: { classId: profileClassId } },
    operation: 'stream',
  });
  if (!auth.allowed) throw new ClassroomSessionError('forbidden', 'Forbidden');
  return classSession;
}

export async function regenerateClassroomSessionJoinCode(
  runtime: ClassroomLifecycleRuntime,
  input: ReadClassroomSessionInput,
) {
  const existingSession = await runtime.loadAccessSession(input.sessionId);
  if (!existingSession) throw new ClassroomSessionError('not-found', '课堂不存在');
  const auth = authorizeClassroomSessionAccess({
    session: existingSession,
    actor: input.actor,
    operation: 'manage',
  });
  if (!auth.allowed) throw new ClassroomSessionError('forbidden', '无权限修改此课堂');
  if (existingSession.status !== 'ACTIVE') {
    throw new ClassroomSessionError('conflict', '课堂已结束，无法重置入会码');
  }
  const joinCode = await runtime.generateJoinCode();
  return runtime.persistJoinCode(input.sessionId, joinCode);
}
