import { ClassroomSessionError } from '../errors';
import type { CreateClassroomSessionInput } from '../types';
import { isClassroomTeacherOrAdmin } from '../access-policy';

export interface ClassroomCreateRuntime {
  emptyLessonPlanMessage: string;
  getUser(id: string): Promise<{ id: string; role: string } | null>;
  isTeacherClassBindingEnforced(): Promise<boolean>;
  findPreset(key: string): { key: string; title: string } | undefined;
  findActiveSession(query: {
    teacherId: string;
    classId: string | null;
    planTitle?: string;
    planId?: string;
  }): Promise<Record<string, unknown> | null>;
  findPublication(id: string): Promise<{
    id: string;
    ownerId: string;
    manifestHash: string;
    displayName: string;
    revisionNumber: number;
    planRevisionNumber: number;
    contentHash: string | null;
    sourceRevisionId: string | null;
    projectedLessonPlans: Array<{ id: string; generatedCoursewareManifestHash: string | null }>;
  } | null>;
  findPlan(id: string): Promise<{
    title: string;
    authorId: string;
    isPublic: boolean;
    generatedCoursewareManifestHash: string | null;
    generatedCoursewarePublication: {
      id: string;
      ownerId: string;
      manifestHash: string;
      displayName: string;
      revisionNumber: number;
      planRevisionNumber: number;
    } | null;
    items: Array<{ overrideConfig: unknown }>;
    itemCount: number;
  } | null>;
  resolvePlanRuntimeBindings(items: Array<{ overrideConfig: unknown }>): {
    state: string;
    sourcePresetKey?: string;
    runtimeLessonId?: string;
  };
  resolveInteractiveLessonIdentity(input: { kind: string; value: string }): {
    status: string;
    record?: { canonicalId: string };
  };
  loadRuntimeLessonManifestSnapshot(id: string): { snapshot: { lessonVersion: string | null; manifestHash: string | null; totalSteps: number | null } } | null;
  loadSessionLessonSnapshot(title: string): { lessonVersion: string | null; manifestHash: string | null; totalSteps: number | null };
  captureRuntimeCourseBundleIdentity(canonicalLessonId: string): Promise<unknown>;
  generatedCoursewareBundleIdentity(input: {
    id: string;
    manifestHash: string;
    contentHash: string | null;
    sourceRevision: string | null;
  }): unknown;
  planProjectionBundleIdentity(planId: string, items: unknown[]): unknown;
  listPlanItems(planId: string): Promise<unknown[]>;
  generateJoinCode(): Promise<string>;
  persistAndCreateSession(input: {
    actorId: string;
    actorRole: string;
    classId: string | null;
    duplicateAction?: string;
    sourcePresetKey?: string;
    planId: string;
    planTitle: string;
    joinCode: string;
    lessonSnapshot: { lessonVersion: string | null; manifestHash: string | null; totalSteps: number | null };
    bundleIdentity: unknown;
    generatedBinding: {
      id: string;
      manifestHash: string;
      displayName: string;
      revisionNumber: number;
      planRevisionNumber: number;
    } | null;
  }): Promise<Record<string, unknown>>;
  buildClassroomIdentity(session: Record<string, unknown>): unknown;
  logStart(payload: Record<string, unknown>): void;
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function createClassroomSession(
  runtime: ClassroomCreateRuntime,
  input: CreateClassroomSessionInput,
): Promise<Record<string, unknown>> {
  const user = await runtime.getUser(input.actor.id);
  if (!user) throw new ClassroomSessionError('user-not-found', 'User not found');
  if (!isClassroomTeacherOrAdmin(user.role)) {
    throw new ClassroomSessionError('forbidden', '只有教师或管理员可以开始课堂');
  }

  const classId = asTrimmed(input.classId);
  if (input.classId !== undefined && !classId) {
    throw new ClassroomSessionError('invalid-input', '请选择一个已启用的班级');
  }
  if (user.role === 'TEACHER' && await runtime.isTeacherClassBindingEnforced() && !classId) {
    throw new ClassroomSessionError('invalid-input', '请选择一个已启用的班级');
  }

  const publicationRevisionId = asTrimmed(input.coursewarePublicationRevisionId);
  let planId = asTrimmed(input.planId);
  const sourcePresetKey = asTrimmed(input.sourcePresetKey);
  const duplicateAction = asTrimmed(input.duplicateAction);
  let generatedBinding: {
    id: string;
    ownerId: string;
    manifestHash: string;
    displayName: string;
    revisionNumber: number;
    planRevisionNumber: number;
    contentHash?: string | null;
    sourceRevisionId?: string | null;
    projectedLessonPlanId: string;
  } | null = null;

  if (publicationRevisionId) {
    const publication = await runtime.findPublication(publicationRevisionId);
    const projection = publication?.projectedLessonPlans[0];
    if (!publication || publication.projectedLessonPlans.length !== 1 || !projection
      || projection.generatedCoursewareManifestHash !== publication.manifestHash) {
      throw new ClassroomSessionError('conflict', '已发布互动课件投影不可用');
    }
    if (user.role !== 'ADMIN' && publication.ownerId !== user.id) {
      throw new ClassroomSessionError('forbidden', '无权启动此互动课件版本');
    }
    planId = projection.id;
    generatedBinding = { ...publication, projectedLessonPlanId: projection.id };
  }

  if (!planId && sourcePresetKey && duplicateAction !== 'new-session') {
    const preset = runtime.findPreset(sourcePresetKey);
    if (!preset) throw new ClassroomSessionError('not-found', 'Preset not found');
    const activeSession = await runtime.findActiveSession({
      teacherId: user.id,
      classId: classId || null,
      planTitle: `${preset.title} (副本)`,
    });
    if (activeSession) {
      const classroomIdentity = runtime.buildClassroomIdentity(activeSession);
      if (duplicateAction === 'reuse') {
        throw new ClassroomSessionError('reuse-session', 'reuse', {
          session: { ...activeSession, classroomIdentity, reusedExistingSession: true },
        });
      }
      throw new ClassroomSessionError(
        'duplicate-session',
        classId
          ? '该班级已有进行中的预置互动课堂，请选择进入已有课堂或确认新开课堂。'
          : '该教案已有进行中的临时课堂，请选择进入已有课堂或确认新开课堂。',
        {
          existingSessionId: activeSession.id,
          requiresExplicitChoice: true,
          allowedActions: ['reuse', 'new-session'],
          classroomIdentity,
        },
      );
    }
  }

  if (!planId) {
    throw new ClassroomSessionError('invalid-input', '请选择教案');
  }

  const plan = await runtime.findPlan(planId);
  if (!plan) throw new ClassroomSessionError('not-found', '教案不存在');
  if (user.role !== 'ADMIN' && !plan.isPublic && plan.authorId !== user.id) {
    throw new ClassroomSessionError('forbidden', '无权启动此教案');
  }
  if (plan.itemCount === 0) {
    throw new ClassroomSessionError('invalid-input', runtime.emptyLessonPlanMessage);
  }

  if (!generatedBinding && plan.generatedCoursewarePublication) {
    const publication = plan.generatedCoursewarePublication;
    if (user.role !== 'ADMIN' && publication.ownerId !== user.id) {
      throw new ClassroomSessionError('forbidden', '无权启动此互动课件版本');
    }
    if (plan.generatedCoursewareManifestHash !== publication.manifestHash) {
      throw new ClassroomSessionError('conflict', '已发布互动课件投影完整性校验失败');
    }
    generatedBinding = { ...publication, projectedLessonPlanId: planId };
  }

  if (!classId && duplicateAction !== 'new-session') {
    const activeSession = await runtime.findActiveSession({
      teacherId: user.id,
      classId: classId || null,
      ...(sourcePresetKey ? { planTitle: plan.title } : { planId }),
    });
    if (activeSession) {
      const classroomIdentity = runtime.buildClassroomIdentity(activeSession);
      if (duplicateAction === 'reuse') {
        throw new ClassroomSessionError('reuse-session', 'reuse', {
          session: { ...activeSession, classroomIdentity, reusedExistingSession: true },
        });
      }
      throw new ClassroomSessionError(
        'duplicate-session',
        classId
          ? '该班级和教案已有进行中的课堂，请选择进入已有课堂或确认新开课堂。'
          : '该教案已有进行中的临时课堂，请选择进入已有课堂或确认新开课堂。',
        {
          existingSessionId: activeSession.id,
          requiresExplicitChoice: true,
          allowedActions: ['reuse', 'new-session'],
          classroomIdentity,
        },
      );
    }
  }

  const joinCode = await runtime.generateJoinCode();
  let lessonSnapshot: { lessonVersion: string | null; manifestHash: string | null; totalSteps: number | null };
  let bundleIdentity: unknown;
  if (generatedBinding) {
    lessonSnapshot = {
      lessonVersion: generatedBinding.displayName,
      manifestHash: generatedBinding.manifestHash,
      totalSteps: plan.itemCount,
    };
    const publicationRecord = publicationRevisionId
      ? await runtime.findPublication(publicationRevisionId)
      : plan.generatedCoursewarePublication
        ? await runtime.findPublication(plan.generatedCoursewarePublication.id)
        : null;
    if (!publicationRecord) {
      throw new ClassroomSessionError('conflict', '已发布互动课件投影不可用');
    }
    bundleIdentity = runtime.generatedCoursewareBundleIdentity({
      id: publicationRecord.id,
      manifestHash: publicationRecord.manifestHash,
      contentHash: publicationRecord.contentHash,
      sourceRevision: publicationRecord.sourceRevisionId,
    });
  } else {
    const runtimeBindings = runtime.resolvePlanRuntimeBindings(plan.items ?? []);
    if (runtimeBindings.state === 'invalid') {
      throw new ClassroomSessionError('conflict', '教案互动课来源绑定无效');
    }
    if (runtimeBindings.state === 'valid') {
      const preset = runtime.findPreset(runtimeBindings.sourcePresetKey ?? '');
      const presetIdentity = runtime.resolveInteractiveLessonIdentity({
        kind: 'presetKey',
        value: runtimeBindings.sourcePresetKey ?? '',
      });
      const runtimeIdentity = runtime.resolveInteractiveLessonIdentity({
        kind: 'runtimeLessonDir',
        value: runtimeBindings.runtimeLessonId ?? '',
      });
      const runtimeSnapshot = runtime.loadRuntimeLessonManifestSnapshot(runtimeBindings.runtimeLessonId ?? '');
      if (
        !preset
        || presetIdentity.status !== 'resolved'
        || runtimeIdentity.status !== 'resolved'
        || presetIdentity.record?.canonicalId !== runtimeIdentity.record?.canonicalId
        || presetIdentity.record?.canonicalId !== runtimeBindings.runtimeLessonId
        || !runtimeSnapshot
      ) {
        throw new ClassroomSessionError('conflict', '教案互动课来源绑定不可用');
      }
      lessonSnapshot = runtimeSnapshot.snapshot;
      try {
        bundleIdentity = await runtime.captureRuntimeCourseBundleIdentity(presetIdentity.record!.canonicalId);
      } catch (error) {
        if (error instanceof Error && error.name === 'CourseBundleCaptureError') {
          throw new ClassroomSessionError('conflict', '教案互动课运行时内容不可用');
        }
        throw error;
      }
    } else {
      lessonSnapshot = runtime.loadSessionLessonSnapshot(plan.title);
      const titleIdentity = runtime.resolveInteractiveLessonIdentity({ kind: 'planTitleAlias', value: plan.title });
      if (titleIdentity.status === 'resolved' && titleIdentity.record) {
        try {
          bundleIdentity = await runtime.captureRuntimeCourseBundleIdentity(titleIdentity.record.canonicalId);
        } catch (error) {
          if (error instanceof Error && error.name === 'CourseBundleCaptureError') {
            throw new ClassroomSessionError('conflict', '教案互动课运行时内容不可用');
          }
          throw error;
        }
      } else {
        const planItems = await runtime.listPlanItems(planId);
        bundleIdentity = runtime.planProjectionBundleIdentity(planId, planItems);
      }
    }
  }

  const newSession = await runtime.persistAndCreateSession({
    actorId: user.id,
    actorRole: user.role,
    classId: classId || null,
    duplicateAction,
    sourcePresetKey,
    planId,
    planTitle: plan.title,
    joinCode,
    lessonSnapshot,
    bundleIdentity,
    generatedBinding,
  });

  const startTime = newSession.startTime;
  runtime.logStart({
    sessionId: newSession.id,
    actorUserId: user.id,
    planId,
    classId: classId || null,
    sourcePresetKey: sourcePresetKey || null,
    coursewarePublicationRevisionId: generatedBinding?.id ?? null,
    coursewareManifestHash: generatedBinding?.manifestHash ?? null,
    clientEventAt: startTime instanceof Date
      ? startTime.toISOString()
      : String(startTime ?? newSession.id),
    currentItemId: newSession.currentItemId ?? null,
  });

  return {
    ...newSession,
    classroomIdentity: runtime.buildClassroomIdentity(newSession),
  };
}
