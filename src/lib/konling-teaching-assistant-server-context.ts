import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  resolveAdaptiveDiagnosisContext,
} from '@/features/assessment/adaptive-diagnosis-context';

import {
  parsePersistedDocumentRubricGradingDraft,
  validateDocumentRubricGradingDraftInvariants,
  type PersistedDocumentRubricGradingDraft,
} from '@/lib/data-governance/document-rubric-grading-workbench';
import {
  CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION,
} from '@/lib/data-governance/control-correction-diagnosis-profile';
import {
  normalizeKonlingRole,
  resolveKonlingTeachingAssistantMode,
  type KonlingRuntimeContext,
  type KonlingRuntimeScope,
  type KonlingSmartPrepSessionBinding,
  type KonlingSmartPreparationAmbiguity,
  type KonlingSmartPreparationConfirmedDecision,
  type KonlingTeachingAssistantServerModeContext,
} from '@/lib/konling-agent-runtime';
import {
  loadTextbookCoachContext,
  type StructuredTextbookUnitIdentity,
} from '@/lib/textbook-resource-coach';

interface SignedModeContextPayload {
  mode: string;
  classId?: string;
  courseId?: string;
  pageId?: string;
  resourceId?: string;
  teacherId?: string;
  goalId?: string;
  graphNodeId?: string;
  classReportId?: string;
  prepPackId?: string;
  issuedAt?: string;
  expiresAt?: string;
  context: KonlingTeachingAssistantServerModeContext;
}

type VerifiedModeContextPayload = SignedModeContextPayload & {
  classId: string;
  expiresAt: string;
};

interface LearningEvidenceDraftReader {
  findFirst(input: {
    where: {
      id: string;
      sourceType: 'document_rubric_grading';
    };
  }): Promise<unknown | null>;
}

interface ClassReader {
  findUnique(input: {
    where: { id: string };
    select: { teacherId: true };
  }): Promise<{ teacherId: string | null } | null>;
}

interface TeachingResourceReader {
  findUnique(input: {
    where: { id: string };
    select: { id: true; teacherOnly: true; type: true };
  }): Promise<{ id: string; teacherOnly: boolean; type: string } | null>;
}

interface CourseEnhancementPackReader {
  findFirst(input: {
    where: {
      classId: string;
      teacherId: string;
      goalId: string;
      OR: Array<{ id: string } | { sourcePrepPackId: string }>;
    };
  }): Promise<{ id: string; sourcePrepPackId: string; classId: string; teacherId: string; goalId: string; status?: string | null } | null>;
}

interface SmartLessonTaskContextReader {
  findFirst(input: any): Promise<unknown | null>;
}

interface CourseBasisContextReader {
  findMany(input: any): Promise<unknown[]>;
}

interface DiagnosisReportSnapshotReader {
  findMany(input: {
    where: {
      goalId: string;
      subjectKind: 'class';
      classId: string;
      materializerVersion: typeof CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION;
    };
    orderBy?: { generatedAt: 'desc' };
    take?: number;
  }): Promise<Array<{ id: string; goalId: string; classId: string | null }>>;
}

export interface KonlingTeachingAssistantServerContextDb {
  learningEvidenceDraft?: LearningEvidenceDraftReader;
  class?: ClassReader;
  teachingResource?: TeachingResourceReader;
  courseEnhancementPack?: CourseEnhancementPackReader;
  smartLessonTask?: SmartLessonTaskContextReader;
  courseBasis?: CourseBasisContextReader;
  diagnosisReportSnapshot?: DiagnosisReportSnapshotReader;
  adaptiveAssessmentAnswer?: any;
  wrongAnswerAttribution?: any;
  adaptivePathCandidateBatch?: {
    findFirst(input: any): Promise<{
      id: string;
      userId: string;
      goalId: string;
      classId: string | null;
      sourcePathId: string;
      status: string;
    } | null>;
  };
}

export class KonlingAdaptiveAttemptContextError extends Error {
  readonly status = 409;

  constructor() {
    super('KONLING_ADAPTIVE_ATTEMPT_CONTEXT_UNAVAILABLE');
    this.name = 'KonlingAdaptiveAttemptContextError';
  }
}

interface ResolvedDocumentGradingDraft {
  parsed: ReturnType<typeof parsePersistedDocumentRubricGradingDraft> & {};
}

export function createKonlingTeachingAssistantServerContextToken(payload: SignedModeContextPayload): string | null {
  const secret = resolveModeContextSigningSecret();
  if (!secret) {
    return null;
  }
  const issuedAt = payload.issuedAt ?? new Date().toISOString();
  const expiresAt = payload.expiresAt ?? new Date(Date.parse(issuedAt) + 8 * 60 * 60 * 1000).toISOString();
  const encoded = Buffer.from(JSON.stringify({ ...payload, issuedAt, expiresAt }), 'utf8').toString('base64url');
  return `${encoded}.${signModeContext(encoded, secret)}`;
}

export async function resolveKonlingTeachingAssistantServerModeContext(input: {
  db: KonlingTeachingAssistantServerContextDb;
  modeId?: string | null;
  scope: KonlingRuntimeScope;
  runtimeContext?: KonlingRuntimeContext | null;
  clientContextHints?: Record<string, unknown> | null;
  pinnedTextbookIdentity?: StructuredTextbookUnitIdentity | null;
}): Promise<KonlingTeachingAssistantServerModeContext> {
  const mode = resolveKonlingTeachingAssistantMode(input.modeId);
  const signedPayload = verifySignedModeContext(input.clientContextHints, {
    modeId: mode.id,
    scope: input.scope,
    hints: input.clientContextHints,
  });
  const verifiedHints = signedPayload ? {
    ...input.clientContextHints,
    ...(signedPayload.goalId ? { goalId: signedPayload.goalId } : {}),
    ...(signedPayload.graphNodeId ? { graphNodeId: signedPayload.graphNodeId } : {}),
    ...(signedPayload.classReportId ? { classReportId: signedPayload.classReportId } : {}),
    ...(signedPayload.prepPackId ? { prepPackId: signedPayload.prepPackId } : {}),
  } : input.clientContextHints;

  if (mode.id === 'resource-coach') {
    return resolveResourceCoachModeContext({
      ...input,
      clientContextHints: input.clientContextHints,
      pinnedTextbookIdentity: input.pinnedTextbookIdentity ?? null,
    });
  }
  const adaptiveAttemptAnswerId = stringHint(input.clientContextHints, 'answerId');
  if (mode.id === 'diagnosis-explainer' && adaptiveAttemptAnswerId) {
    if (
      input.scope.role !== 'student' ||
      input.scope.authenticatedUserId !== input.scope.targetUserId ||
      !input.db.adaptiveAssessmentAnswer
    ) {
      throw new KonlingAdaptiveAttemptContextError();
    }
    const adaptiveDiagnosisContext = await resolveAdaptiveDiagnosisContext({
      db: {
        adaptiveAssessmentAnswer: input.db.adaptiveAssessmentAnswer,
        wrongAnswerAttribution: input.db.wrongAnswerAttribution,
      },
      authenticatedUserId: input.scope.authenticatedUserId,
      answerId: adaptiveAttemptAnswerId,
    });
    if (!adaptiveDiagnosisContext) throw new KonlingAdaptiveAttemptContextError();
    return {
      'adaptive-attempt': true,
      adaptiveAttempt: adaptiveDiagnosisContext.adaptiveAttempt,
      ...(adaptiveDiagnosisContext.wrongAnswerAttribution
        ? { wrongAnswerAttribution: adaptiveDiagnosisContext.wrongAnswerAttribution }
        : {}),
    };
  }
  if (mode.id === 'path-advisor') {
    return resolvePathAdvisorModeContext({
      ...input,
      signedPayload,
    });
  }
  if (mode.id === 'grading-assistant') {
    return resolveDocumentGradingModeContext(input, 'teacher');
  }
  if (mode.id === 'feedback-explainer') {
    return resolveDocumentGradingModeContext(input, 'student');
  }
  if (mode.id === 'class-summarizer') {
    if (signedPayload) {
      if (input.scope.role !== 'teacher' && input.scope.role !== 'admin') return {};
      if (input.scope.role === 'teacher' && !await teacherOwnsClass(input.db, signedPayload.classId, input.scope.authenticatedUserId)) {
        return {};
      }
      return signedPayload.context;
    }
    return resolveClassSummarizerModeContext({ ...input, clientContextHints: verifiedHints });
  }
  if (mode.id === 'prep-coauthor') {
    return resolvePrepCoauthorModeContext({ ...input, clientContextHints: verifiedHints });
  }
  return {};
}

export function resolveKonlingSmartPrepSessionBinding(
  context: KonlingTeachingAssistantServerModeContext,
): KonlingSmartPrepSessionBinding | null {
  const task = context.smartPreparation;
  if (!task?.taskId?.trim() || !task.taskRevision?.trim()) return null;
  return {
    taskId: task.taskId,
    taskRevision: task.taskRevision,
  };
}

export function resolveKonlingTeachingAssistantSignedGraphNodeId(input: {
  modeId?: string | null;
  scope: KonlingRuntimeScope;
  clientContextHints?: Record<string, unknown> | null;
}): string | null {
  const mode = resolveKonlingTeachingAssistantMode(input.modeId);
  const signedPayload = verifySignedModeContext(input.clientContextHints, {
    modeId: mode.id,
    scope: input.scope,
    hints: input.clientContextHints,
  });
  return signedPayload?.graphNodeId ?? null;
}

export async function resolveKonlingTeachingAssistantScopeOverride(input: {
  db: KonlingTeachingAssistantServerContextDb;
  modeId?: string | null;
  authenticatedUserId: string;
  role?: string | null;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<{ targetUserId?: string; classId?: string }> {
  const mode = resolveKonlingTeachingAssistantMode(input.modeId);
  if (mode.id === 'path-advisor') {
    const payload = verifySignedModeContextSignature(input.clientContextHints);
    const role = normalizeKonlingRole(input.role?.toUpperCase());
    if (
      role === 'student' &&
      payload?.mode === 'path-advisor' &&
      payload.classId &&
      payload.context['student-path-center'] === true &&
      (!payload.courseId || payload.courseId === stringHint(input.clientContextHints, 'courseId')) &&
      (!payload.pageId || payload.pageId === 'adaptive-path-center' || payload.pageId === 'student-path-center') &&
      (!payload.goalId || payload.goalId === stringHint(input.clientContextHints, 'goalId')) &&
      (!payload.graphNodeId || payload.graphNodeId === stringHint(input.clientContextHints, 'graphNodeId'))
    ) {
      return { classId: payload.classId };
    }
    return {};
  }
  if (mode.id !== 'grading-assistant' && mode.id !== 'feedback-explainer') return {};

  const resolved = await resolveDocumentGradingDraft(input);
  if (!resolved) return {};
  const role = normalizeKonlingRole(input.role?.toUpperCase());

  if (mode.id === 'grading-assistant') {
    if (role !== 'teacher' && role !== 'admin') return {};
    if (role === 'teacher' && !await teacherOwnsClass(input.db, resolved.parsed.goalContext.classId, input.authenticatedUserId)) {
      return {};
    }
    return {
      targetUserId: resolved.parsed.asset.studentId,
      classId: resolved.parsed.goalContext.classId,
    };
  }

  if (role !== 'student' || input.authenticatedUserId !== resolved.parsed.asset.studentId) return {};
  return {
    targetUserId: resolved.parsed.asset.studentId,
    classId: resolved.parsed.goalContext.classId,
  };
}

async function resolveDocumentGradingModeContext(
  input: {
    db: KonlingTeachingAssistantServerContextDb;
    scope: KonlingRuntimeScope;
    clientContextHints?: Record<string, unknown> | null;
  },
  surface: 'teacher' | 'student',
): Promise<KonlingTeachingAssistantServerModeContext> {
  const resolved = await resolveDocumentGradingDraft(input);
  if (!resolved) return {};

  if (surface === 'teacher') {
    if (input.scope.role !== 'teacher' && input.scope.role !== 'admin') return {};
    if (input.scope.classId !== resolved.parsed.goalContext.classId) return {};
    if (input.scope.targetUserId !== resolved.parsed.asset.studentId) return {};
    if (input.scope.role === 'teacher' && !await teacherOwnsClass(input.db, resolved.parsed.goalContext.classId, input.scope.authenticatedUserId)) {
      return {};
    }
    return {
      rubric: true,
      'converted-document': true,
      'draft-grading-state': true,
      'teacher-review-state': true,
    };
  }

  if (input.scope.role !== 'student') return {};
  if (input.scope.authenticatedUserId !== resolved.parsed.asset.studentId) return {};
  if (input.scope.targetUserId !== resolved.parsed.asset.studentId) return {};
  return {
    'student-feedback': resolved.parsed.run.status === 'returned' || resolved.parsed.run.status === 'approved',
    rubric: true,
  };
}

async function resolveDocumentGradingDraft(input: {
  db: KonlingTeachingAssistantServerContextDb;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<ResolvedDocumentGradingDraft | null> {
  const gradingRunId = stringHint(input.clientContextHints, 'gradingRunId');
  if (!gradingRunId || !input.db.learningEvidenceDraft) return null;

  const draft = await input.db.learningEvidenceDraft.findFirst({
    where: {
      id: gradingRunId,
      sourceType: 'document_rubric_grading',
    },
  });
  if (!draft) return null;

  const persistedDraft = draft as PersistedDocumentRubricGradingDraft;
  const parsed = parsePersistedDocumentRubricGradingDraft(persistedDraft);
  if (!parsed) return null;

  const invariants = validateDocumentRubricGradingDraftInvariants({
    draft: persistedDraft,
    parsed,
  });
  return invariants.valid ? { parsed } : null;
}

async function teacherOwnsClass(
  db: KonlingTeachingAssistantServerContextDb,
  classId: string,
  teacherId: string,
): Promise<boolean> {
  const classData = await db.class?.findUnique({
    where: { id: classId },
    select: { teacherId: true },
  });
  return Boolean(classData && classData.teacherId === teacherId);
}

async function resolveClassSummarizerModeContext(input: {
  db: KonlingTeachingAssistantServerContextDb;
  scope: KonlingRuntimeScope;
  runtimeContext?: KonlingRuntimeContext | null;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<KonlingTeachingAssistantServerModeContext> {
  if (input.scope.role !== 'teacher' && input.scope.role !== 'admin') return {};
  if (!input.scope.classId || !input.db.diagnosisReportSnapshot) return {};
  if (input.scope.role === 'teacher' && !await teacherOwnsClass(input.db, input.scope.classId, input.scope.authenticatedUserId)) {
    return {};
  }
  const goalId = stringHint(input.clientContextHints, 'goalId') ?? 'control-correction';
  const classReportId = stringHint(input.clientContextHints, 'classReportId');
  const rows = await input.db.diagnosisReportSnapshot.findMany({
    where: {
      goalId,
      subjectKind: 'class',
      classId: input.scope.classId,
      materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION,
    },
    orderBy: { generatedAt: 'desc' },
    take: 1,
  });
  const snapshot = rows[0];
  if (!snapshot) return {};
  if (classReportId && classReportId !== snapshot.id && classReportId !== `${input.scope.classId}:${snapshot.goalId}`) return {};
  return {
    'class-report': true,
    'diagnosis-view': true,
  };
}

async function resolvePrepCoauthorModeContext(input: {
  db: KonlingTeachingAssistantServerContextDb;
  scope: KonlingRuntimeScope;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<KonlingTeachingAssistantServerModeContext> {
  const smartTaskId = stringHint(input.clientContextHints, 'smartTaskId');
  if (smartTaskId || isSmartPrepPage(input.scope.pageId)) {
    if (
      input.scope.role !== 'teacher' ||
      input.scope.authenticatedUserId !== input.scope.targetUserId ||
      !isSmartPrepPage(input.scope.pageId) ||
      (smartTaskId && !input.db.smartLessonTask)
    ) return {};
    if (!smartTaskId) {
      const courseBases = await input.db.courseBasis?.findMany({
        where: { ownerId: input.scope.authenticatedUserId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          documents: {
            select: {
              id: true,
              title: true,
              versions: {
                where: { reviewState: 'CONFIRMED', retiredAt: null },
                orderBy: { versionNumber: 'desc' },
                take: 5,
                select: { id: true, versionNumber: true },
              },
            },
          },
        },
      }) ?? [];
      return {
        'prep-pack': true,
        'task-ambiguities': true,
        'teacher-review-state': true,
        'clarification-readiness': true,
        smartPreparation: {
          taskId: null,
          taskRevision: null,
          bootstrap: true,
          currentTask: { availableCourseBases: courseBases },
          selectedCourseBasisVersions: [],
          unresolvedAmbiguities: [],
          confirmedDecisions: [],
          citationState: 'unselected',
          reviewState: 'draft',
          clarificationReadiness: {
            status: 'clarification-required',
            canGenerate: false,
            unresolvedAmbiguityIds: [],
          },
          updatePolicy: {
            suggestionStatus: 'draft',
            requiresExplicitTeacherConfirmation: true,
            expectedTaskRevision: null,
          },
        },
      };
    }
    const taskRow = await input.db.smartLessonTask!.findFirst({
      where: {
        id: smartTaskId,
        ownerId: input.scope.authenticatedUserId,
      },
      include: {
        sources: {
          where: { state: 'SELECTED' },
          include: { sourceVersion: { select: { reviewState: true, retiredAt: true } } },
        },
        knowledgePoints: { where: { state: { not: 'REMOVED' } }, select: { id: true, lineageId: true, state: true, title: true, origin: true, sourceState: true, sourceBindings: true, supersedesIds: true } },
        goals: { where: { state: { not: 'REMOVED' } }, select: { id: true, lineageId: true, state: true, content: true, sourceState: true, sourceBindings: true, standardsMappings: true } },
      },
    });
    const task = projectSmartLessonTaskContext(taskRow, input.scope.authenticatedUserId);
    if (!task || task.taskId !== smartTaskId) return {};
    const unresolvedAmbiguityIds = task.unresolvedAmbiguities.map((ambiguity) => ambiguity.id);
    return {
      'prep-pack': true,
      'smart-task': true,
      'selected-course-basis-versions': true,
      'task-ambiguities': true,
      'confirmed-task-decisions': true,
      'citation-state': true,
      'teacher-review-state': true,
      'clarification-readiness': true,
      smartPreparation: {
        taskId: task.taskId,
        taskRevision: task.taskRevision,
        bootstrap: false,
        currentTask: task.currentTask,
        selectedCourseBasisVersions: task.selectedCourseBasisVersions,
        unresolvedAmbiguities: task.unresolvedAmbiguities,
        confirmedDecisions: task.confirmedDecisions,
        citationState: task.citationState,
        reviewState: task.reviewState,
        clarificationReadiness: {
          status: unresolvedAmbiguityIds.length > 0 ? 'clarification-required' : 'ready',
          canGenerate: unresolvedAmbiguityIds.length === 0,
          unresolvedAmbiguityIds,
        },
        updatePolicy: {
          suggestionStatus: 'draft',
          requiresExplicitTeacherConfirmation: true,
          expectedTaskRevision: task.taskRevision,
        },
      },
    };
  }

  if (input.scope.role !== 'teacher' && input.scope.role !== 'admin') return {};
  if (!input.scope.classId || !input.db.courseEnhancementPack) return {};
  const prepPackId = stringHint(input.clientContextHints, 'prepPackId');
  const goalId = stringHint(input.clientContextHints, 'goalId');
  if (!prepPackId || !goalId) return {};
  const pack = await input.db.courseEnhancementPack.findFirst({
    where: {
      classId: input.scope.classId,
      teacherId: input.scope.authenticatedUserId,
      goalId,
      OR: [
        { id: prepPackId },
        { sourcePrepPackId: prepPackId },
      ],
    },
  });
  if (!pack) return {};
  if (pack.status === 'archived' || pack.status === 'rolled-back') return {};
  return {
    'prep-pack': true,
    'diagnosis-view': true,
    'teacher-review-state': true,
  };
}

function isSmartPrepPage(pageId: string) {
  return pageId === '/teacher/smart-prep' || pageId === 'teacher-smart-prep' || pageId === 'smart-prep';
}

function projectSmartLessonTaskContext(value: unknown, ownerUserId: string) {
  const task = recordValue(value);
  if (!task) return null;
  const taskId = recordString(task, 'id');
  const storedOwnerId = recordString(task, 'ownerId') || recordString(task, 'ownerUserId');
  const taskRevision = String(task.revision ?? '');
  if (!taskId || storedOwnerId !== ownerUserId || !taskRevision) return null;

  if (Array.isArray(task.selectedCourseBasisVersions)) {
    return {
      taskId,
      taskRevision,
      currentTask: recordValue(task.currentTask) ?? {},
      selectedCourseBasisVersions: task.selectedCourseBasisVersions as Array<{ versionId: string; citationState: string; reviewState: string }>,
      unresolvedAmbiguities: Array.isArray(task.unresolvedAmbiguities) ? task.unresolvedAmbiguities as KonlingSmartPreparationAmbiguity[] : [],
      confirmedDecisions: Array.isArray(task.confirmedDecisions) ? task.confirmedDecisions as KonlingSmartPreparationConfirmedDecision[] : [],
      citationState: recordString(task, 'citationState') || 'missing',
      reviewState: recordString(task, 'reviewState') || 'draft',
    };
  }

  const sources = recordArray(task.sources);
  const selectedCourseBasisVersions = sources.map((value) => {
    const source = recordValue(value) ?? {};
    const version = recordValue(source.sourceVersion) ?? {};
    const reviewState = recordString(version, 'reviewState') || 'UNKNOWN';
    const retired = version.retiredAt !== null && version.retiredAt !== undefined;
    return {
      versionId: recordString(source, 'sourceVersionId'),
      citationState: reviewState === 'CONFIRMED' && !retired ? 'verified' : 'review-required',
      reviewState: retired ? `${reviewState}:RETIRED` : reviewState,
    };
  }).filter((source) => source.versionId);
  const knowledgePoints = recordArray(task.knowledgePoints).map(recordValue).filter((item): item is Record<string, unknown> => Boolean(item));
  const goals = recordArray(task.goals).map(recordValue).filter((item): item is Record<string, unknown> => Boolean(item));
  const scopeConfirmedAt = isoString(task.scopeConfirmedAt);
  const goalsConfirmedAt = isoString(task.goalsConfirmedAt);
  const unresolvedAmbiguities: KonlingSmartPreparationAmbiguity[] = [
    ...(!scopeConfirmedAt ? [{
      id: 'confirm-lesson-scope',
      field: 'scope',
      question: '请确认本课主题、对象、时长、知识点与来源范围。',
      alternatives: [{ id: 'confirm-current-scope', label: '确认当前范围' }],
    }] : []),
    ...(!goalsConfirmedAt ? [{
      id: 'confirm-lesson-goals',
      field: 'goals',
      question: '请确认本课教学目标。',
      alternatives: [{ id: 'confirm-current-goals', label: '确认当前目标' }],
    }] : []),
  ];
  const confirmedDecisions: KonlingSmartPreparationConfirmedDecision[] = [
    ...(scopeConfirmedAt ? [{
      id: `scope:${taskRevision}`,
      field: 'scope',
      value: [
        recordString(task, 'topic'),
        recordString(task, 'audience'),
        String(task.durationMinutes ?? ''),
        ...knowledgePoints.map((item) => recordString(item, 'id')),
        ...selectedCourseBasisVersions.map((source) => source.versionId),
      ].filter(Boolean),
      confirmedAt: scopeConfirmedAt,
      confirmedBy: ownerUserId,
    }] : []),
    ...(goalsConfirmedAt ? [{
      id: `goals:${taskRevision}`,
      field: 'goals',
      value: goals.map((goal) => recordString(goal, 'id')).filter(Boolean),
      confirmedAt: goalsConfirmedAt,
      confirmedBy: ownerUserId,
    }] : []),
  ];
  return {
    taskId,
    taskRevision,
    currentTask: {
      courseBasisId: recordString(task, 'courseBasisId'),
      topic: recordString(task, 'topic'),
      audience: recordString(task, 'audience'),
      prerequisites: recordString(task, 'prerequisites'),
      durationMinutes: task.durationMinutes,
      outlineConfirmationRequired: task.outlineConfirmationRequired === true,
      sourceVersionIds: selectedCourseBasisVersions.map((source) => source.versionId),
      textbookRanges: recordArray(task.textbookRanges),
      selectedClassId: recordString(task, 'selectedClassId') || null,
      knowledgePoints: knowledgePoints.map((item) => ({
        id: recordString(item, 'id'), lineageId: recordString(item, 'lineageId'), title: recordString(item, 'title'), content: recordString(item, 'title'),
        origin: recordString(item, 'origin'), sourceState: publicSmartLessonSourceState(recordString(item, 'sourceState')),
        sourceBindings: item.sourceBindings ?? [], supersedesIds: Array.isArray(item.supersedesIds) ? item.supersedesIds : [],
      })),
      goals: goals.map((item) => ({
        id: recordString(item, 'id'), lineageId: recordString(item, 'lineageId'), content: recordString(item, 'content'),
        sourceState: publicSmartLessonSourceState(recordString(item, 'sourceState')), sourceBindings: item.sourceBindings ?? [],
        standardsMappings: item.standardsMappings ?? [],
      })),
      confirmScope: Boolean(scopeConfirmedAt),
      confirmGoals: Boolean(goalsConfirmedAt),
    },
    selectedCourseBasisVersions,
    unresolvedAmbiguities,
    confirmedDecisions,
    citationState: selectedCourseBasisVersions.length > 0 && selectedCourseBasisVersions.every((source) => source.citationState === 'verified')
      ? 'verified'
      : selectedCourseBasisVersions.length > 0 ? 'review-required' : 'missing',
    reviewState: scopeConfirmedAt && goalsConfirmedAt ? 'confirmed' : 'draft',
  };
}

function publicSmartLessonSourceState(value: string) {
  if (value === 'VERIFIED') return 'verified';
  if (value === 'NO_RELIABLE_SOURCE') return 'no_reliable_source';
  if (value === 'AI_GENERATED_SOURCE_PENDING') return 'ai_generated_source_pending';
  return 'teacher_created_source_pending';
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function recordArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function isoString(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function stringHint(hints: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = hints?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function resolveResourceCoachModeContext(input: {
  db: KonlingTeachingAssistantServerContextDb;
  scope: KonlingRuntimeScope;
  clientContextHints?: Record<string, unknown> | null;
  pinnedTextbookIdentity?: StructuredTextbookUnitIdentity | null;
}): Promise<KonlingTeachingAssistantServerModeContext> {
  const declaredKind = stringHint(input.clientContextHints, 'resourceKind');
  const wantsTextbook = Boolean(
    input.pinnedTextbookIdentity
    || declaredKind === 'structured-textbook-unit'
    || stringHint(input.clientContextHints, 'sourceRevision')
    || stringHint(input.clientContextHints, 'unitId')
    || stringHint(input.clientContextHints, 'contentHash'),
  );
  if (wantsTextbook) {
    const loaded = await loadTextbookCoachContext({
      actorUserId: input.scope.authenticatedUserId,
      declared: input.clientContextHints,
      pinned: input.pinnedTextbookIdentity ?? null,
      selectionHint: input.clientContextHints?.selectionHint,
    });
    if (loaded.status !== 'ready') {
      return { textbookCoachFailure: loaded.reason } as KonlingTeachingAssistantServerModeContext;
    }
    return {
      'resource-node': true,
      structuredTextbook: loaded,
    } as KonlingTeachingAssistantServerModeContext;
  }
  if (!input.scope.resourceId || !input.db.teachingResource) return {};
  const resource = await input.db.teachingResource.findUnique({
    where: { id: input.scope.resourceId },
    select: { id: true, teacherOnly: true, type: true },
  });
  if (!resource) return {};
  if (resource.teacherOnly && input.scope.role !== 'teacher' && input.scope.role !== 'admin') return {};
  return {
    'resource-node': true,
    ...(resource.type === 'STATIC_MEDIA' ? { 'media-resource': true } : {}),
  };
}

async function resolvePathAdvisorModeContext(input: {
  db: KonlingTeachingAssistantServerContextDb;
  scope: KonlingRuntimeScope;
  signedPayload: VerifiedModeContextPayload | null;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<KonlingTeachingAssistantServerModeContext> {
  if (!input.signedPayload) return {};
  if (input.scope.role !== 'student') return {};
  if (input.scope.authenticatedUserId !== input.scope.targetUserId) return {};
  if (input.signedPayload.context['student-path-center'] !== true) return {};
  const candidateBatchId = stringHint(input.clientContextHints, 'candidateBatchId');
  const candidateBatch = candidateBatchId && input.db.adaptivePathCandidateBatch
    ? await input.db.adaptivePathCandidateBatch.findFirst({
        where: {
          id: candidateBatchId,
          userId: input.scope.targetUserId,
          goalId: input.scope.courseId,
          classId: input.scope.classId ?? null,
          status: 'succeeded',
        },
        select: { id: true, userId: true, goalId: true, classId: true, sourcePathId: true, status: true },
      })
    : null;
  return {
    ...input.signedPayload.context,
    'student-path-center': true,
    ...(candidateBatch ? {
      authorizedCandidateBatch: {
        batchId: candidateBatch.id,
        pathId: candidateBatch.sourcePathId,
        goalId: candidateBatch.goalId,
        classId: candidateBatch.classId,
      },
    } : {}),
  };
}

function verifySignedModeContext(
  hints: Record<string, unknown> | null | undefined,
  input: {
    modeId: string;
    scope: KonlingRuntimeScope;
    hints?: Record<string, unknown> | null;
  },
): VerifiedModeContextPayload | null {
  const token = stringHint(hints, 'modeContextToken');
  if (!token) return null;

  const payload = verifySignedModeContextSignature(hints);
  if (!payload) return null;
  if (payload.mode !== input.modeId) return null;
  if (!payload.classId || payload.classId !== input.scope.classId) return null;
  if (payload.courseId && payload.courseId !== input.scope.courseId) return null;
  if (payload.pageId && payload.pageId !== input.scope.pageId) return null;
  if (payload.resourceId && payload.resourceId !== input.scope.resourceId) return null;
  if (input.modeId === 'prep-coauthor') {
    if (!payload.teacherId || payload.teacherId !== input.scope.authenticatedUserId) return null;
    if (!payload.goalId || !payload.prepPackId) return null;
  }
  if (input.modeId === 'class-summarizer') {
    if (!payload.goalId || !payload.classReportId) return null;
  }
  if (payload.goalId && stringHint(input.hints, 'goalId') && payload.goalId !== stringHint(input.hints, 'goalId')) return null;
  if (payload.graphNodeId && stringHint(input.hints, 'graphNodeId') && payload.graphNodeId !== stringHint(input.hints, 'graphNodeId')) return null;
  if (payload.classReportId && stringHint(input.hints, 'classReportId') && payload.classReportId !== stringHint(input.hints, 'classReportId')) return null;
  if (payload.prepPackId && stringHint(input.hints, 'prepPackId') && payload.prepPackId !== stringHint(input.hints, 'prepPackId')) return null;
  if (!payload.expiresAt) return null;
  const expiresAt = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return payload as VerifiedModeContextPayload;
}

function verifySignedModeContextSignature(
  hints: Record<string, unknown> | null | undefined,
): SignedModeContextPayload | null {
  const token = stringHint(hints, 'modeContextToken');
  if (!token) return null;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const secret = resolveModeContextSigningSecret();
  if (!secret) return null;
  const expectedSignature = signModeContext(encoded, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload: SignedModeContextPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedModeContextPayload;
  } catch {
    return null;
  }
  if (!payload.expiresAt) return null;
  const expiresAt = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return payload;
}

function resolveModeContextSigningSecret(): string | null {
  const secret = process.env.KONLING_SERVER_MODE_CONTEXT_SECRET ||
    process.env.KONLING_MODE_CONTEXT_SECRET ||
    '';
  const trimmed = secret.trim();
  if (!trimmed || isPlaceholderSigningSecret(trimmed)) return null;
  return trimmed;
}

function isPlaceholderSigningSecret(secret: string): boolean {
  const normalized = secret.toLowerCase();
  return normalized === 'konling-mode-context-development-secret' ||
    normalized === 'replace-with-strong-konling-context-secret' ||
    normalized === 'development-secret' ||
    normalized === 'your-secret-key' ||
    normalized === 'changeme' ||
    normalized === 'secret';
}

function signModeContext(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}
