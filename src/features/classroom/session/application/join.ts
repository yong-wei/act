import { ClassroomSessionError } from '../errors';
import type { JoinClassroomSessionInput } from '../types';
import { isClassroomTeacherOrAdmin } from '../access-policy';

export type ClassroomJoinState =
  | 'invalid-code'
  | 'not-found'
  | 'finished'
  | 'forbidden'
  | 'ready-to-enter';

export interface ClassroomJoinRecord {
  id: string;
  joinCode: string;
  status: string;
  currentStage: string | null;
  currentItemId: string | null;
  classId: string | null;
  plan: { id: string; title: string };
  teacher: { name: string | null };
  class: { name: string | null } | null;
  courseBundleRevisionId: string | null;
  courseBundleRevision: { canonicalLessonId: string | null } | null;
}

export interface ClassroomJoinRuntime {
  findByJoinCode(code: string): Promise<ClassroomJoinRecord | null>;
  getStudentClassId(userId: string): Promise<string | null>;
  resolveRoute(input: {
    bundleCanonicalLessonId: string | null;
    bundleBound: boolean;
    planTitle: string;
    sessionId: string;
  }): {
    routeSegment: string | null;
    studentHref: string;
    teacherHref: string;
  };
  logJoin(payload: Record<string, unknown>): void;
}

function buildJoinState(state: ClassroomJoinState, recoveryAction: string) {
  return {
    state,
    recoveryAction,
    evidenceWriteback:
      state === 'ready-to-enter'
        ? '课堂状态由 session state 保存；课堂提交由互动事件入口写入提交记录，并按会话、步骤、卡片和提交身份做应用层串行去重，重复提交不保留 raw InteractionLog，结束后进入教师复盘和学生证据页。数据库级并发幂等仍未关闭。'
        : '未进入课堂时不会写入课堂作答证据。',
  };
}

export async function joinClassroomSession(
  runtime: ClassroomJoinRuntime,
  input: JoinClassroomSessionInput,
): Promise<Record<string, unknown>> {
  if (!input.joinCode || !/^\d{6}$/.test(input.joinCode)) {
    throw new ClassroomSessionError('invalid-join-code', '请输入有效的6位入会码', {
      joinState: buildJoinState('invalid-code', '请核对教师投屏或二维码中的 6 位数字课堂码。'),
    });
  }

  const classSession = await runtime.findByJoinCode(input.joinCode);
  if (!classSession) {
    throw new ClassroomSessionError('not-found', '未找到该入会码对应的课堂', {
      joinState: buildJoinState('not-found', '请确认课堂码仍在当前课堂中使用，或返回学习首页等待教师重新发放。'),
    });
  }

  if (classSession.status === 'FINISHED') {
    throw new ClassroomSessionError('session-finished', '该课堂已结束', {
      joinState: buildJoinState('finished', '请进入个人证据页查看本次课堂记录，或加入新的课堂。'),
      reviewHref: '/profile/evidence',
    });
  }

  if (classSession.classId && !isClassroomTeacherOrAdmin(input.actor.role)) {
    const studentClassId = await runtime.getStudentClassId(input.actor.id);
    if (!studentClassId || studentClassId !== classSession.classId) {
      throw new ClassroomSessionError('forbidden', '您不是该班级的学生，无法加入此课堂', {
        className: classSession.class?.name,
        joinState: buildJoinState('forbidden', '请确认当前登录账号属于该班级，或联系教师更新班级绑定。'),
      });
    }
  }

  const routeInfo = runtime.resolveRoute({
    bundleCanonicalLessonId: classSession.courseBundleRevision?.canonicalLessonId ?? null,
    bundleBound: classSession.courseBundleRevisionId !== null,
    planTitle: classSession.plan.title,
    sessionId: classSession.id,
  });

  runtime.logJoin({
    sessionId: classSession.id,
    userId: input.actor.id,
    role: input.actor.role,
    joinCode: input.joinCode,
    routeSegment: routeInfo.routeSegment,
    classId: classSession.classId,
    planTitle: classSession.plan.title,
  });

  return {
    ...classSession,
    joinState: buildJoinState('ready-to-enter', classSession.classId && isClassroomTeacherOrAdmin(input.actor.role)
      ? '教师或管理员可直接进入课堂或复盘入口。'
      : '可进入课堂；提交后会在课堂状态、教师复盘和学生证据页中串联。'),
    routeSegment: routeInfo.routeSegment,
    studentHref: routeInfo.studentHref,
    teacherHref: routeInfo.teacherHref,
  };
}
