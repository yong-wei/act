import type { ClassroomStateMutationInput } from '@/lib/classroom-analytics/types';
import {
  buildClassroomLifecycleEvidenceFields,
  normalizeClassroomLifecycleClientEventAt,
} from '@/lib/classroom-lifecycle-contract';
import {
  authorizeClassroomSessionAccess,
  isClassroomTeacherOrAdmin,
  normalizeClassroomActorRole,
  type ClassroomSessionAccessRecord,
} from '../access-policy';
import { ClassroomSessionError } from '../errors';
import type { ClassroomSessionActor } from '../types';

export interface ClassroomStateRow {
  itemId: string | null;
  stateKey: string;
  lessonKey: string | null;
  submittedAt: Date;
  data: unknown;
  userId?: string;
  user?: { id: string; name: string | null; email: string | null } | null;
}

export interface ClassroomTeacherViewSession extends ClassroomSessionAccessRecord {
  id: string;
  joinCode: string;
  status: string;
  currentItemId: string | null;
  currentStage: string | null;
  plan: { title: string };
  class: {
    name: string | null;
    students: Array<{
      user: { id: string; name: string | null; email: string | null };
    }>;
  } | null;
}

export interface ClassroomStateRuntime {
  loadUser(id: string): Promise<{
    id: string;
    role: string;
    profile: { classId: string | null } | null;
  } | null>;
  loadSessionAccess(sessionId: string): Promise<ClassroomSessionAccessRecord | null>;
  loadTeacherViewSession(sessionId: string): Promise<ClassroomTeacherViewSession | null>;
  listCourseStates(sessionId: string): Promise<ClassroomStateRow[]>;
  listTeacherStates(sessionId: string): Promise<ClassroomStateRow[]>;
  loadSelfState(sessionId: string, userId: string): Promise<ClassroomStateRow | null>;
  loadLatestTeacherSync(sessionId: string): Promise<ClassroomStateRow | null>;
  upsertStudentState(input: {
    sessionId: string;
    userId: string;
    stateKey: string;
    lessonKey: string | null;
    itemId: string | null | undefined;
    data: unknown;
    lastClientEventAt: Date | null;
  }): Promise<unknown>;
  buildIdentity(session: ClassroomTeacherViewSession): unknown;
  logState(payload: Record<string, unknown>): void;
}

export interface WriteClassroomSessionStateInput {
  actor: ClassroomSessionActor;
  sessionId: string;
  body: ClassroomStateMutationInput;
}

export interface ReadClassroomSessionStateInput {
  actor: ClassroomSessionActor;
  sessionId: string;
  scope: string | null;
}

function toDateTime(value: number | string | null | undefined): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function resolveStateKey(itemId: string | null | undefined, explicitStateKey: string | null | undefined) {
  if (explicitStateKey && explicitStateKey.trim().length > 0) {
    return explicitStateKey;
  }
  if (itemId === 'teacher:course-sync') {
    return 'teacher-sync';
  }
  return 'course';
}

function resolveWriteStateKey(
  itemId: string | null | undefined,
  explicitStateKey: string | null | undefined,
  lifecycleEvent: { clientEventId: string } | null,
) {
  const baseStateKey = resolveStateKey(itemId, explicitStateKey);
  if (baseStateKey === 'teacher-sync' && lifecycleEvent) {
    return `classroom-event:${lifecycleEvent.clientEventId}`;
  }
  return baseStateKey;
}

function readLifecycleClientEventId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readLifecycleClientEventAt(value: unknown): number | string | null {
  return normalizeClassroomLifecycleClientEventAt(value);
}

function appendLifecycleEvent(data: unknown, event: unknown | null): unknown {
  if (!event || typeof data !== 'object' || data === null || Array.isArray(data)) {
    return data;
  }
  return {
    ...(data as Record<string, unknown>),
    classroomEvent: event,
  };
}

function toStudentTeacherSyncRecord(state: ClassroomStateRow) {
  return {
    itemId: state.itemId,
    stateKey: state.stateKey,
    lessonKey: state.lessonKey,
    submittedAt: state.submittedAt,
    data: state.data,
  };
}

export function buildClassroomEvidenceWriteback() {
  return {
    mode: 'live-state-and-event-materialization',
    explanation:
      '本接口保存课堂运行态 StudentState；互动提交由 /api/interactive/events 写入 InteractionLog、StudentStepResponse 并实时物化 LearningFact，课堂结束后的 finalization 刷新教师复盘与学生证据页。',
    requiredEventFields: [
      'eventType',
      'actorRole',
      'sessionId',
      'stepId',
      'cardId',
      'clientEventId',
      'sourceLogId',
      'clientEventAt',
      'dedupeIdentity',
    ],
    dedupeRule: '具备 attemptKey、submissionIdentity、submissionId 或 attemptId 的课堂提交，会在互动事件入口按 userId、sessionId、lessonKey、stepId、cardId 和提交身份做应用层串行归并；cardId 是去重键的一部分，不能单独作为提交身份。重复提交不保留 raw InteractionLog，数据库级并发幂等仍未关闭。',
  };
}

function denyIfUnauthorized(auth: { allowed: boolean }) {
  if (!auth.allowed) throw new ClassroomSessionError('forbidden', 'Forbidden');
}

export async function writeClassroomSessionState(
  runtime: ClassroomStateRuntime,
  input: WriteClassroomSessionStateInput,
) {
  const user = await runtime.loadUser(input.actor.id);
  if (!user) throw new ClassroomSessionError('user-not-found', 'User not found');

  const body = input.body;
  const { itemId, data, lessonKey } = body;
  const lastClientEventAt = toDateTime(body.clientEventAt);
  const actorRole = normalizeClassroomActorRole(user.role);
  const sessionRecord = await runtime.loadSessionAccess(input.sessionId);
  if (!sessionRecord) throw new ClassroomSessionError('not-found', 'Session not found');

  const accessUser = {
    id: user.id,
    role: user.role,
    profile: user.profile ?? input.actor.profile ?? null,
  };
  denyIfUnauthorized(authorizeClassroomSessionAccess({
    session: sessionRecord,
    actor: accessUser,
    operation: 'read',
  }));

  const lifecycleClientEventId = readLifecycleClientEventId(body.clientEventId);
  const lifecycleClientEventAt = readLifecycleClientEventAt(body.clientEventAt);
  if (body.eventType && (!lifecycleClientEventId || lifecycleClientEventAt === null)) {
    throw new ClassroomSessionError('invalid-input', 'Lifecycle event requires clientEventId and clientEventAt');
  }

  let lifecycleEvent: ReturnType<typeof buildClassroomLifecycleEvidenceFields> | null = null;
  if (body.eventType && lifecycleClientEventId && lifecycleClientEventAt !== null) {
    lifecycleEvent = buildClassroomLifecycleEvidenceFields({
      eventType: body.eventType,
      actorRole,
      sessionId: input.sessionId,
      stepId: body.stepId ?? itemId ?? null,
      cardId: body.cardId ?? null,
      clientEventId: lifecycleClientEventId,
      sourceLogId: body.sourceLogId ?? null,
      clientEventAt: lifecycleClientEventAt,
    });
  }
  const stateKey = resolveWriteStateKey(itemId, body.stateKey, lifecycleEvent);
  const isTeacherSyncWrite = resolveStateKey(itemId, body.stateKey) === 'teacher-sync';

  if (!data) {
    throw new ClassroomSessionError('invalid-input', 'Data is required');
  }

  if (isTeacherSyncWrite && !isClassroomTeacherOrAdmin(user.role)) {
    throw new ClassroomSessionError('forbidden', 'Forbidden');
  }
  if (isTeacherSyncWrite) {
    denyIfUnauthorized(authorizeClassroomSessionAccess({
      session: sessionRecord,
      actor: accessUser,
      operation: 'manage',
    }));
  }

  const studentState = await runtime.upsertStudentState({
    sessionId: input.sessionId,
    userId: user.id,
    stateKey,
    lessonKey: lessonKey || null,
    itemId,
    data: appendLifecycleEvent(data, lifecycleEvent),
    lastClientEventAt,
  });

  if (itemId === 'student:presence' || itemId === 'teacher:course-sync' || lifecycleEvent) {
    runtime.logState({
      sessionId: input.sessionId,
      userId: user.id,
      itemId,
      lifecycleEvent,
    });
  }

  return studentState;
}

export async function readClassroomSessionState(
  runtime: ClassroomStateRuntime,
  input: ReadClassroomSessionStateInput,
) {
  const scope = input.scope;
  const courseStateKey = 'course';
  const teacherStateKey = 'teacher-sync';
  const evidenceWriteback = buildClassroomEvidenceWriteback();

  if (scope === 'teacher-view' || scope == null) {
    if (!isClassroomTeacherOrAdmin(input.actor.role)) {
      throw new ClassroomSessionError('forbidden', 'Forbidden');
    }
  }

  if (scope === 'teacher-view') {
    const sessionRecord = await runtime.loadTeacherViewSession(input.sessionId);
    if (!sessionRecord) throw new ClassroomSessionError('not-found', 'Session not found');
    denyIfUnauthorized(authorizeClassroomSessionAccess({
      session: sessionRecord,
      actor: input.actor,
      operation: 'manage',
    }));

    const [courseStates, teacherStates] = await Promise.all([
      runtime.listCourseStates(input.sessionId),
      runtime.listTeacherStates(input.sessionId),
    ]);

    const latestUpdate = courseStates[0]?.submittedAt || teacherStates[0]?.submittedAt || null;
    const currentItemId = sessionRecord.currentItemId ?? null;
    const expectedRoster = sessionRecord.class?.students.map((student) => student.user) ?? [];
    const observedRoster = courseStates
      .map((state) => state.user)
      .filter((user): user is NonNullable<typeof user> => Boolean(user));
    const roster = expectedRoster.length > 0 ? expectedRoster : observedRoster;
    const submittedCurrentStep = currentItemId
      ? courseStates.filter((state) => state.itemId === currentItemId)
      : courseStates;
    const onlineUserIds = new Set(observedRoster.map((user) => user.id));
    const submittedUserIds = new Set(
      submittedCurrentStep
        .map((state) => state.userId)
        .filter((userId): userId is string => Boolean(userId)),
    );
    const notSubmitted = roster.filter((user) => !submittedUserIds.has(user.id));

    return {
      states: courseStates,
      courseStates,
      teacherStates,
      classroom: {
        identity: runtime.buildIdentity(sessionRecord),
        currentStepId: currentItemId,
        currentStage: sessionRecord.currentStage ?? null,
        status: sessionRecord.status ?? null,
      },
      presence: {
        roster: roster.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          online: onlineUserIds.has(user.id),
          submitted: submittedUserIds.has(user.id),
        })),
        onlineCount: onlineUserIds.size,
        expectedCount: roster.length,
        latestUpdate,
      },
      delivery: {
        releasedStepId: currentItemId,
        submittedCount: submittedUserIds.size,
        inProgressCount: Math.max(onlineUserIds.size - submittedUserIds.size, 0),
        notStartedCount: Math.max(roster.length - onlineUserIds.size, 0),
        notSubmitted,
        latestUpdate,
      },
      evidenceWriteback,
      summary: {
        totalStudents: courseStates.length,
        latestUpdate,
      },
    };
  }

  if (scope === 'self') {
    const sessionRecord = await runtime.loadSessionAccess(input.sessionId);
    if (!sessionRecord) throw new ClassroomSessionError('not-found', 'Session not found');
    denyIfUnauthorized(authorizeClassroomSessionAccess({
      session: sessionRecord,
      actor: input.actor,
      operation: 'read',
    }));
    const state = await runtime.loadSelfState(input.sessionId, input.actor.id);
    return {
      states: state ? [state] : [],
      courseStates: state ? [state] : [],
      teacherStates: [],
      evidenceWriteback,
      summary: {
        totalStudents: state ? 1 : 0,
        latestUpdate: state?.submittedAt || null,
      },
    };
  }

  if (scope === 'student-view') {
    const sessionRecord = await runtime.loadSessionAccess(input.sessionId);
    if (!sessionRecord) throw new ClassroomSessionError('not-found', 'Session not found');
    denyIfUnauthorized(authorizeClassroomSessionAccess({
      session: sessionRecord,
      actor: input.actor,
      operation: 'read',
    }));
    const [selfState, teacherSyncState] = await Promise.all([
      runtime.loadSelfState(input.sessionId, input.actor.id),
      runtime.loadLatestTeacherSync(input.sessionId),
    ]);
    const studentTeacherSyncState = teacherSyncState ? toStudentTeacherSyncRecord(teacherSyncState) : null;
    const states = [studentTeacherSyncState, selfState].filter(Boolean);
    return {
      states,
      courseStates: selfState ? [selfState] : [],
      teacherStates: studentTeacherSyncState ? [studentTeacherSyncState] : [],
      evidenceWriteback,
      summary: {
        latestUpdate: teacherSyncState?.submittedAt || selfState?.submittedAt || null,
      },
    };
  }

  const sessionRecord = await runtime.loadSessionAccess(input.sessionId);
  if (!sessionRecord) throw new ClassroomSessionError('not-found', 'Session not found');
  denyIfUnauthorized(authorizeClassroomSessionAccess({
    session: sessionRecord,
    actor: input.actor,
    operation: 'manage',
  }));
  const [states, teacherStates] = await Promise.all([
    runtime.listCourseStates(input.sessionId),
    runtime.listTeacherStates(input.sessionId),
  ]);
  return {
    states,
    courseStates: states,
    teacherStates,
    evidenceWriteback,
    summary: {
      totalStudents: states.length,
      latestUpdate: states[0]?.submittedAt || teacherStates[0]?.submittedAt || null,
    },
  };
}
