export type TeacherEvidenceInterventionKind =
  | 'feedback'
  | 'grading-writeback'
  | 'reinforcement-task'
  | 'remedial-path';

export type TeacherEvidenceInterventionStatus =
  | 'recorded'
  | 'student-visible'
  | 'reduced-personalization'
  | 'pending'
  | 'blocked';

export type TeacherEvidenceInterventionSurface =
  | 'report-ledger'
  | 'grading-workbench'
  | 'teacher-evidence'
  | 'classroom-review';

export interface TeacherEvidenceInterventionInput {
  kind: TeacherEvidenceInterventionKind;
  surface: TeacherEvidenceInterventionSurface;
  teacherId?: string | null;
  actorRole?: string | null;
  studentId?: string | null;
  classId?: string | null;
  sessionId?: string | null;
  lessonId?: string | null;
  reportId?: string | null;
  gradingRunId?: string | null;
  source?: string | null;
  sourceEvidenceRefs?: string[];
  pathId?: string | null;
  learnerState?: 'ready' | 'partial' | 'missing';
  writebackState?: 'pending' | 'recorded' | 'student-visible';
  now?: Date;
}

export interface TeacherEvidenceInterventionActionRecord {
  id: string;
  idempotencyKey: string;
  kind: TeacherEvidenceInterventionKind;
  surface: TeacherEvidenceInterventionSurface;
  teacherId: string | null;
  actorRole: string;
  studentId: string | null;
  classId: string | null;
  sessionId: string | null;
  lessonId: string | null;
  reportId: string | null;
  gradingRunId: string | null;
  source: string | null;
  sourceEvidenceRefs: string[];
  status: TeacherEvidenceInterventionStatus;
  persistenceTarget: 'EvidenceOutbox' | 'LearningPathIntervention' | 'none';
  failureReason: string | null;
  recoveryAction: string | null;
  studentFacingTarget: {
    surface: 'feedback-task' | 'evidence-timeline' | 'mission-task' | 'adaptive-path' | 'none';
    href: string | null;
    label: string;
  };
  privacySafeSummary: string;
  createdAt: string;
}

export interface TeacherEvidenceInterventionOutboxRow {
  eventType: string;
  correlationId: string;
  causationId: string;
  ownerUserId: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  createdAt: string;
}

const ACTION_LABELS: Record<TeacherEvidenceInterventionKind, string> = {
  feedback: '教师反馈',
  'grading-writeback': '评分写回',
  'reinforcement-task': '补强任务',
  'remedial-path': '补练路径',
};

export function buildTeacherEvidenceInterventionAction(
  input: TeacherEvidenceInterventionInput,
): TeacherEvidenceInterventionActionRecord {
  const sourceEvidenceRefs = normalizeEvidenceRefs(input.sourceEvidenceRefs);
  const status = resolveInterventionStatus(input, sourceEvidenceRefs);
  const failureReason = resolveInterventionFailureReason(input, sourceEvidenceRefs);
  const actionSeed = [
    input.surface,
    input.kind,
    input.classId ?? 'missing-class',
    input.studentId ?? 'missing-student',
    input.sessionId ?? 'missing-session',
    input.lessonId ?? 'missing-lesson',
    input.gradingRunId ?? 'missing-grading-run',
    input.reportId ?? 'control-correction',
    input.source ?? 'teacher-evidence',
    sourceEvidenceRefs.join('|') || 'no-evidence',
  ].join(':');
  const id = `teacher-intervention:${input.kind}:${opaqueRef(actionSeed)}`;

  return {
    id,
    idempotencyKey: `teacher-intervention-idempotency:${opaqueRef(actionSeed)}`,
    kind: input.kind,
    surface: input.surface,
    teacherId: input.teacherId ?? null,
    actorRole: input.actorRole ?? 'teacher',
    studentId: input.studentId ?? null,
    classId: input.classId ?? null,
    sessionId: input.sessionId ?? null,
    lessonId: input.lessonId ?? null,
    reportId: input.reportId ?? null,
    gradingRunId: input.gradingRunId ?? null,
    source: input.source ?? null,
    sourceEvidenceRefs,
    status,
    persistenceTarget: resolvePersistenceTarget(input, status),
    failureReason,
    recoveryAction: resolveInterventionRecoveryAction(input, sourceEvidenceRefs, failureReason),
    studentFacingTarget: buildStudentFacingTarget(input, id, status),
    privacySafeSummary: buildInterventionSummary(input, status, failureReason),
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}

export function buildStudentVisibleTeacherIntervention(input: {
  assignmentId: string;
  status: string;
  source?: string | null;
  teacherInterventionId?: string | null;
}) {
  const isTeacherVisible = input.status === 'teacher-visible' || input.status === 'written-back';
  if (!isTeacherVisible || !input.teacherInterventionId) return null;

  return {
    id: input.teacherInterventionId ?? `student-visible-teacher-intervention:${opaqueRef(input.assignmentId)}`,
    status: 'student-visible' as const,
    label: '教师处置已对学生可见',
    source: input.source ?? 'teacher-intervention',
  };
}

export function buildTeacherEvidenceInterventionOutboxRow(
  action: TeacherEvidenceInterventionActionRecord,
): TeacherEvidenceInterventionOutboxRow | null {
  if (action.status === 'blocked' || !action.studentId) return null;
  const eventType = `teacher_evidence_intervention.${action.kind}_recorded`;
  return {
    eventType,
    correlationId: action.gradingRunId ?? action.reportId ?? action.classId ?? action.id,
    causationId: action.id,
    ownerUserId: action.studentId,
    payload: {
      eventType,
      payloadVersion: 'teacher-evidence-intervention.v1',
      actor: {
        userId: action.teacherId,
        role: action.actorRole,
      },
      subject: {
        userId: action.studentId,
        classId: action.classId,
      },
      sourceCapability: 'audit-remediation-teacher-evidence-intervention-closure',
      intervention: {
        id: action.id,
        kind: action.kind,
        surface: action.surface,
        status: action.status,
        persistenceTarget: action.persistenceTarget,
        studentFacingTarget: action.studentFacingTarget,
      },
      relatedRefs: {
        sessionId: action.sessionId,
        lessonId: action.lessonId,
        reportId: action.reportId,
        gradingRunId: action.gradingRunId,
        source: action.source,
        sourceEvidenceRefs: action.sourceEvidenceRefs,
      },
      privacySafeSummary: action.privacySafeSummary,
      failureReason: action.failureReason,
      recoveryAction: action.recoveryAction,
    },
    dedupeKey: action.idempotencyKey,
    createdAt: action.createdAt,
  };
}

function resolveInterventionStatus(
  input: TeacherEvidenceInterventionInput,
  sourceEvidenceRefs: string[],
): TeacherEvidenceInterventionStatus {
  if (!hasValidStudentTarget(input) && !isClassReportLedgerAction(input)) return 'blocked';
  if (sourceEvidenceRefs.length === 0) return 'blocked';
  if (input.learnerState === 'missing' || (input.kind === 'remedial-path' && !input.pathId)) {
    return 'reduced-personalization';
  }
  if (input.writebackState === 'student-visible') return 'student-visible';
  if (input.writebackState === 'recorded') return 'recorded';
  return 'pending';
}

function resolvePersistenceTarget(
  input: TeacherEvidenceInterventionInput,
  status: TeacherEvidenceInterventionStatus,
): TeacherEvidenceInterventionActionRecord['persistenceTarget'] {
  if (status === 'blocked') return 'none';
  if (input.kind === 'remedial-path' && input.pathId) return 'LearningPathIntervention';
  return 'EvidenceOutbox';
}

function resolveInterventionFailureReason(
  input: TeacherEvidenceInterventionInput,
  sourceEvidenceRefs: string[],
) {
  if (!hasValidStudentTarget(input) && !isClassReportLedgerAction(input)) return 'missing-student';
  if (sourceEvidenceRefs.length === 0) return 'missing-source-evidence';
  if (input.kind === 'remedial-path' && !input.pathId) return 'missing-learning-path';
  if (input.learnerState === 'missing') return 'missing-learner-state';
  return null;
}

function resolveInterventionRecoveryAction(
  input: TeacherEvidenceInterventionInput,
  sourceEvidenceRefs: string[],
  failureReason: string | null,
) {
  if (failureReason === 'missing-student') return '从班级学生列表选择有效学生后再创建处置';
  if (failureReason === 'missing-source-evidence') return '至少选择一条学生可见证据后再创建处置';
  if (failureReason === 'missing-learning-path') return '先生成或选择学生补练路径；当前可发送反馈或补强任务';
  if (failureReason === 'missing-learner-state') return '保留证据引用并以低个性化置信度发送反馈';
  if (input.kind === 'remedial-path' && !input.pathId) return '补练路径缺失时使用补强任务或反馈任务继续';
  if (sourceEvidenceRefs.length > 0) return null;
  return '回到报告或学生证据页重新选择来源证据';
}

function buildStudentFacingTarget(
  input: TeacherEvidenceInterventionInput,
  id: string,
  status: TeacherEvidenceInterventionStatus,
): TeacherEvidenceInterventionActionRecord['studentFacingTarget'] {
  if (!hasValidStudentTarget(input) || status === 'blocked') {
    return { surface: 'none', href: null, label: '学生侧不可见' };
  }
  if (status !== 'student-visible') {
    return { surface: 'none', href: null, label: '学生侧等待写回' };
  }
  const statusParam = 'teacher-visible';
  const common = new URLSearchParams({
    assignment: 'report-control-design',
    status: statusParam,
    source: 'teacher-intervention',
    teacherInterventionId: id,
  });
  if (input.reportId) common.set('reportId', input.reportId);
  if (input.gradingRunId) common.set('gradingRunId', input.gradingRunId);

  if (input.kind === 'feedback') {
    return { surface: 'feedback-task', href: `/assessment/document-feedback?${common.toString()}`, label: '学生报告反馈' };
  }
  if (input.kind === 'grading-writeback') {
    return { surface: 'evidence-timeline', href: `/profile/evidence?${common.toString()}`, label: '学生证据时间线' };
  }
  if (input.kind === 'reinforcement-task') {
    common.set('intent', 'start');
    return { surface: 'mission-task', href: `/missions?${common.toString()}`, label: '学生补强任务' };
  }
  if (!input.pathId) {
    return { surface: 'none', href: null, label: '补练路径待选择' };
  }
  common.set('intent', 'document-feedback');
  return { surface: 'adaptive-path', href: `/assessment/adaptive-practice?${common.toString()}`, label: '学生补练路径' };
}

function buildInterventionSummary(
  input: TeacherEvidenceInterventionInput,
  status: TeacherEvidenceInterventionStatus,
  failureReason: string | null,
) {
  const label = ACTION_LABELS[input.kind];
  if (status === 'student-visible') return `${label}已写回，学生侧目标为${buildTargetLabel(input.kind)}。`;
  if (status === 'recorded') return `${label}已创建持久处置记录，等待学生侧写回完成。`;
  if (status === 'pending') return `${label}可创建持久处置记录，当前尚未写回。`;
  if (status === 'reduced-personalization') return `${label}保留证据引用，但因${failureReason ?? '上下文不足'}降低个性化置信度。`;
  return `${label}未写回：${failureReason ?? '缺少必要上下文'}。`;
}

function buildTargetLabel(kind: TeacherEvidenceInterventionKind) {
  if (kind === 'feedback') return '报告反馈';
  if (kind === 'grading-writeback') return '证据时间线';
  if (kind === 'reinforcement-task') return '任务大厅';
  return '自适应补练路径';
}

function normalizeEvidenceRefs(refs: string[] | undefined): string[] {
  return Array.from(new Set((refs ?? []).map((ref) => ref.trim()).filter(Boolean)));
}

function hasValidStudentTarget(input: TeacherEvidenceInterventionInput) {
  return Boolean(input.studentId && !isMissingIdentifier(input.studentId));
}

function isClassReportLedgerAction(input: TeacherEvidenceInterventionInput) {
  return input.surface === 'report-ledger'
    && !input.studentId
    && Boolean(input.classId && !isMissingIdentifier(input.classId));
}

function isMissingIdentifier(value: string | null | undefined) {
  return typeof value === 'string' && value.toLowerCase().startsWith('missing');
}

function opaqueRef(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ref-${(hash >>> 0).toString(36).padStart(7, '0')}`;
}
