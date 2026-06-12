import type { Prisma } from '@prisma/client';
import type { ResourceNode } from '@/lib/resource-node-registry';
import type { KonlingTeachingAssistantEntryPoint } from '@/lib/konling-agent-runtime';
import { createKonlingTeachingAssistantServerContextToken } from '@/lib/konling-teaching-assistant-server-context';

import type {
  ControlCorrectionTeacherReport,
  ControlCorrectionReportMetric,
} from './control-correction-teacher-report';
import type {
  LearningEvidenceCitationChipPayload,
  LearningEvidenceConfidence,
  LearningEvidenceCorpusChunk,
  LearningEvidenceCorpusSourceType,
} from './learning-evidence-rag-corpus';
import type {
  RoleBasedLearningDiagnosis,
  RoleBasedLearningDiagnosisRootCauseCluster,
} from './role-based-learning-diagnosis';

export const TEACHER_PREP_PACK_GENERATION_VERSION = 'teacher-prep-pack-generation.v1';
export const COURSE_ENHANCEMENT_PACK_VERSION = 'course-enhancement-pack.v1';

export type TeacherPrepPackCandidateType =
  | 'interactive-question'
  | 'knowledge-card'
  | 'micro-simulation'
  | 'arena-task'
  | 'reflection-prompt'
  | 'konling-prompt'
  | 'teacher-note';

export type TeacherPrepPackReviewState = 'draft' | 'edited' | 'approved' | 'rejected' | 'exported';

export type TeacherPrepPackTargetType =
  | 'lesson-stage'
  | 'lesson-step'
  | 'resource-node'
  | 'class-session'
  | 'teacher-export'
  | 'draft-resource-request';

export interface TeacherPrepPackEvidenceBasis {
  sourceType: LearningEvidenceCorpusSourceType | 'role-diagnosis' | 'teacher-report' | 'path-outcome' | 'grading-summary';
  sourceId: string;
  displayTitle: string;
  capsule: string;
  confidence: LearningEvidenceConfidence;
  privacy: 'aggregate' | 'scoped-summary' | 'stable-reference' | 'redacted-capsule';
  citationChip: LearningEvidenceCitationChipPayload;
}

export interface TeacherPrepPackAffectedGroup {
  kind: 'class' | 'cluster' | 'subset';
  label: string;
  count: number;
  denominator: number;
  dimensionId?: string;
}

export interface TeacherPrepPackInsertionTarget {
  type: TeacherPrepPackTargetType;
  lessonId?: string;
  lessonStage?: 'bridge-in' | 'objective' | 'pre-assessment' | 'participatory-learning' | 'post-assessment' | 'summary';
  lessonStepId?: string;
  resourceNodeId?: string;
  classSessionId?: string;
  draftRequestReason?: string;
}

export interface TeacherPrepPackCandidateItem {
  id: string;
  itemType: TeacherPrepPackCandidateType;
  title: string;
  rationale: string;
  affectedGroup: TeacherPrepPackAffectedGroup;
  evidenceBasis: TeacherPrepPackEvidenceBasis[];
  insertionTarget: TeacherPrepPackInsertionTarget;
  estimatedTimeMinutes: number;
  confidence: {
    state: LearningEvidenceConfidence;
    score: number;
    limitations: string[];
  };
  methodologyNotes: string[];
  review: {
    state: TeacherPrepPackReviewState;
    reviewerId: string | null;
    reviewedAt: string | null;
    notes: string | null;
  };
  linkedResource?: {
    nodeId: string;
    title: string;
    type: ResourceNode['type'];
    launchTarget: string | null;
  };
  draftResourceRequest?: {
    reason: string;
    requiredReview: true;
  };
  privacyMetadata: {
    rawStudentData: 'omitted';
    privateKonlingMemory: 'omitted';
    hiddenArenaInternals: 'omitted';
    rawTraces: 'omitted';
  };
}

export interface TeacherPrepPack {
  version: typeof TEACHER_PREP_PACK_GENERATION_VERSION;
  id: string;
  teacherId: string;
  classId: string;
  goalId: string;
  nextLesson: {
    lessonId: string;
    title: string;
    plannedAt: string | null;
  };
  generatedAt: string;
  status: 'draft' | 'partially-approved' | 'approved' | 'exported';
  candidates: TeacherPrepPackCandidateItem[];
  methodology: {
    inputs: string[];
    candidatePolicy: 'resource-linked-or-draft-request';
    teacherReviewRequired: true;
  };
  privacyPolicy: {
    ordinaryPayload: 'aggregate-and-redacted-only';
    forbiddenContent: string[];
  };
  konlingEntryPoint: KonlingTeachingAssistantEntryPoint & { mode: 'prep-coauthor' };
}

export interface TeacherPrepPackInput {
  teacherId: string;
  classId: string;
  goalId: string;
  nextLesson: TeacherPrepPack['nextLesson'] & {
    stages?: Array<{ id: string; stage: TeacherPrepPackInsertionTarget['lessonStage']; title: string }>;
  };
  diagnosis?: RoleBasedLearningDiagnosis | null;
  teacherReport?: ControlCorrectionTeacherReport | null;
  pathOutcomes?: Array<Record<string, unknown>>;
  gradingSummaries?: Array<Record<string, unknown>>;
  resourceNodes?: ResourceNode[];
  evidenceCorpus?: LearningEvidenceCorpusChunk[];
  now?: Date;
}

export interface TeacherPrepPackExportPayload {
  prepPackId: string;
  classId: string;
  goalId: string;
  exportedAt: string;
  items: Array<{
    id: string;
    itemType: TeacherPrepPackCandidateType;
    title: string;
    insertionTarget: TeacherPrepPackInsertionTarget;
    estimatedTimeMinutes: number;
    evidenceBasis: TeacherPrepPackEvidenceBasis[];
  }>;
  redactionPolicy: TeacherPrepPack['privacyPolicy'];
}

export interface TeacherPrepPackInsertionPayload {
  prepPackId: string;
  classId: string;
  goalId: string;
  generatedAt: string;
  items: Array<{
    id: string;
    itemType: TeacherPrepPackCandidateType;
    title: string;
    insertionTarget: TeacherPrepPackInsertionTarget;
    linkedResource: NonNullable<TeacherPrepPackCandidateItem['linkedResource']>;
    estimatedTimeMinutes: number;
  }>;
}

export type CourseEnhancementPackStatus = 'review-ready' | 'active' | 'rolled-back' | 'archived';

export interface CourseEnhancementRuntimeContext {
  lessonId: string;
  classId: string;
  stages: Array<{
    id: string;
    stage: NonNullable<TeacherPrepPackInsertionTarget['lessonStage']>;
    stepIds?: string[];
  }>;
  lessonStepIds?: string[];
  resourceNodeIds?: string[];
  classSessionIds?: string[];
}

export interface CourseEnhancementImpactEvidenceRef {
  sourceType: 'learning-fact' | 'path-outcome' | 'grading-result' | 'teacher-observation';
  sourceId: string;
  displayTitle: string;
  collectedAt: string;
  safeForTeacherReport: boolean;
}

export interface CourseEnhancementPackItem {
  id: string;
  prepPackItemId: string;
  itemType: TeacherPrepPackCandidateType;
  title: string;
  insertionTarget: TeacherPrepPackInsertionTarget;
  linkedResource: NonNullable<TeacherPrepPackCandidateItem['linkedResource']>;
  estimatedTimeMinutes: number;
  evidenceBasis: TeacherPrepPackEvidenceBasis[];
  methodologyNotes: string[];
  privacyScope: 'aggregate-and-redacted-only';
  lifecycle: {
    state: 'approved';
    reviewedBy: string;
    reviewedAt: string;
  };
  activation: {
    activatedBy: string | null;
    activatedAt: string | null;
    rolledBackBy: string | null;
    rolledBackAt: string | null;
    rollbackReason: string | null;
  };
  impactEvidence: CourseEnhancementImpactEvidenceRef[];
}

export interface CourseEnhancementPack {
  version: typeof COURSE_ENHANCEMENT_PACK_VERSION;
  id: string;
  teacherId: string;
  classId: string;
  goalId: string;
  lessonId: string;
  source: {
    prepPackId: string;
    diagnosisSnapshotId: string | null;
    sourceEvidenceRefs: string[];
  };
  status: CourseEnhancementPackStatus;
  createdAt: string;
  updatedAt: string;
  items: CourseEnhancementPackItem[];
  auditLog: Array<{
    action: 'create' | 'activate' | 'rollback' | 'archive' | 'impact-evidence';
    actorId: string;
    at: string;
    detail: string;
  }>;
  teacherFeedback: Array<{
    teacherId: string;
    note: string;
    recordedAt: string;
  }>;
}

export interface CourseEnhancementPackPersistenceRecord {
  id: string;
  teacherId: string;
  classId: string;
  goalId: string;
  lessonId: string;
  sourcePrepPackId: string;
  diagnosisSnapshotId: string | null;
  status: string;
  source: Prisma.JsonValue;
  items: Prisma.JsonValue;
  auditLog: Prisma.JsonValue;
  teacherFeedback: Prisma.JsonValue;
  activatedAt: Date | null;
  rolledBackAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseEnhancementPackPersistenceClient {
  courseEnhancementPack: {
    upsert(args: {
      where: { sourcePrepPackId: string };
      create: {
        id: string;
        teacherId: string;
        classId: string;
        goalId: string;
        lessonId: string;
        sourcePrepPackId: string;
        diagnosisSnapshotId: string | null;
        status: string;
        source: Prisma.InputJsonValue;
        items: Prisma.InputJsonValue;
        auditLog: Prisma.InputJsonValue;
        teacherFeedback: Prisma.InputJsonValue;
        activatedAt: Date | null;
        rolledBackAt: Date | null;
        archivedAt: Date | null;
      };
      update: {
        status: string;
        diagnosisSnapshotId: string | null;
        source: Prisma.InputJsonValue;
        items: Prisma.InputJsonValue;
        auditLog: Prisma.InputJsonValue;
        teacherFeedback: Prisma.InputJsonValue;
        activatedAt: Date | null;
        rolledBackAt: Date | null;
        archivedAt: Date | null;
      };
    }): Promise<CourseEnhancementPackPersistenceRecord>;
    findUnique(args: { where: { id: string } }): Promise<CourseEnhancementPackPersistenceRecord | null>;
    update(args: {
      where: { id: string };
      data: {
        status: string;
        diagnosisSnapshotId: string | null;
        source: Prisma.InputJsonValue;
        items: Prisma.InputJsonValue;
        auditLog: Prisma.InputJsonValue;
        teacherFeedback: Prisma.InputJsonValue;
        activatedAt: Date | null;
        rolledBackAt: Date | null;
        archivedAt: Date | null;
      };
    }): Promise<CourseEnhancementPackPersistenceRecord>;
  };
}

export interface CourseEnhancementPackPreview {
  packId: string;
  publishState: 'preview-only';
  insertionIssues: Array<{ itemId: string; errors: string[] }>;
  diff: {
    addedOverlayItems: Array<{
      packId: string;
      itemId: string;
      title: string;
      insertionTarget: TeacherPrepPackInsertionTarget;
      linkedResource: CourseEnhancementPackItem['linkedResource'];
      evidenceBasis: TeacherPrepPackEvidenceBasis[];
      estimatedTimeMinutes: number;
      privacyScope: CourseEnhancementPackItem['privacyScope'];
    }>;
  };
}

export function generateTeacherPrepPack(input: TeacherPrepPackInput): TeacherPrepPack {
  const now = input.now ?? new Date();
  const prepPackId = `prep-pack:${input.teacherId}:${input.classId}:${input.goalId}:${input.nextLesson.lessonId}:${dateKey(now)}`;
  const modeContextToken = createKonlingTeachingAssistantServerContextToken({
    mode: 'prep-coauthor',
    classId: input.classId,
    context: {
      'prep-pack': true,
      'diagnosis-view': true,
      'teacher-review-state': true,
    },
  });
  const candidates = [
    ...candidatesFromDiagnosis(input),
    ...candidatesFromTeacherNotes(input),
    ...candidatesFromTeacherReport(input),
    ...candidatesFromPathOutcomes(input),
    ...candidatesFromGradingSummaries(input),
  ];
  const deduped = dedupeCandidates(candidates)
    .map((item, index) => ({ ...item, id: `${input.goalId}:prep:${index + 1}:${item.itemType}` }));

  return {
    version: TEACHER_PREP_PACK_GENERATION_VERSION,
    id: prepPackId,
    teacherId: input.teacherId,
    classId: input.classId,
    goalId: input.goalId,
    nextLesson: {
      lessonId: input.nextLesson.lessonId,
      title: input.nextLesson.title,
      plannedAt: input.nextLesson.plannedAt,
    },
    generatedAt: now.toISOString(),
    status: 'draft',
    candidates: deduped,
    methodology: {
      inputs: materializationInputs(input),
      candidatePolicy: 'resource-linked-or-draft-request',
      teacherReviewRequired: true,
    },
    privacyPolicy: {
      ordinaryPayload: 'aggregate-and-redacted-only',
      forbiddenContent: [
        'raw-answer-body',
        'private-konling-memory',
        'hidden-arena-internals',
        'raw-high-frequency-trace',
        'secret',
      ],
    },
    konlingEntryPoint: {
      mode: 'prep-coauthor',
      promptContext: `prep-pack:${input.classId}:${input.goalId}:${input.nextLesson.lessonId}`,
      serverContext: {
        ...(modeContextToken ? { modeContextToken } : {}),
        prepPackId,
        classId: input.classId,
        goalId: input.goalId,
      },
    },
  };
}

export function reviewTeacherPrepPackItem(input: {
  item: TeacherPrepPackCandidateItem;
  reviewerId: string;
  teacherId: string;
  authorizedReviewerIds?: string[];
  decision: 'approve' | 'reject' | 'edit';
  notes?: string;
  patch?: Partial<Pick<TeacherPrepPackCandidateItem, 'title' | 'rationale' | 'estimatedTimeMinutes' | 'insertionTarget'>>;
  now?: Date;
}): TeacherPrepPackCandidateItem {
  const reviewedAt = (input.now ?? new Date()).toISOString();
  const reviewerId = sanitizeReviewerId(input.reviewerId);
  const patched = applyCandidatePatch(input.item, input.patch);
  const authorizedReviewerIds = input.authorizedReviewerIds ?? [input.teacherId];
  const canReview = Boolean(reviewerId) && authorizedReviewerIds.includes(reviewerId);
  const canApprove = input.decision === 'approve' && canReview && validateTeacherPrepPackItem({
    ...patched,
    review: {
      state: 'approved',
      reviewerId,
      reviewedAt,
      notes: input.notes ?? null,
    },
  }).length === 0;
  const state: TeacherPrepPackReviewState =
    canApprove ? 'approved' :
      input.decision === 'reject' ? 'rejected' : 'edited';
  return {
    ...patched,
    review: {
      state,
      reviewerId,
      reviewedAt,
      notes: input.notes ?? null,
    },
  };
}

export function buildTeacherPrepPackExportPayload(input: {
  pack: TeacherPrepPack;
  authorizedReviewerIds?: string[];
  now?: Date;
}): TeacherPrepPackExportPayload {
  const approved = input.pack.candidates.filter((item) =>
    isTeacherPrepPackItemApprovedByAuthorizedReviewer(item, input.pack, input.authorizedReviewerIds)
  );
  return {
    prepPackId: input.pack.id,
    classId: input.pack.classId,
    goalId: input.pack.goalId,
    exportedAt: (input.now ?? new Date()).toISOString(),
    items: approved.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      title: item.title,
      insertionTarget: item.insertionTarget,
      estimatedTimeMinutes: item.estimatedTimeMinutes,
      evidenceBasis: item.evidenceBasis,
    })),
    redactionPolicy: input.pack.privacyPolicy,
  };
}

export function buildTeacherPrepPackInsertionPayload(input: {
  pack: TeacherPrepPack;
  authorizedReviewerIds?: string[];
  now?: Date;
}): TeacherPrepPackInsertionPayload {
  const insertable = input.pack.candidates.filter((item) =>
    isTeacherPrepPackInsertionEligible(item, input.pack, input.authorizedReviewerIds)
  );
  return {
    prepPackId: input.pack.id,
    classId: input.pack.classId,
    goalId: input.pack.goalId,
    generatedAt: (input.now ?? new Date()).toISOString(),
    items: insertable.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      title: item.title,
      insertionTarget: item.insertionTarget,
      linkedResource: item.linkedResource!,
      estimatedTimeMinutes: item.estimatedTimeMinutes,
    })),
  };
}

export function createCourseEnhancementPackFromPrepPack(input: {
  prepPack: TeacherPrepPack;
  teacherId: string;
  authorizedReviewerIds?: string[];
  diagnosisSnapshotId?: string | null;
  sourceEvidenceRefs?: string[];
  now?: Date;
}): CourseEnhancementPack {
  assertEnhancementPackActor(input.teacherId, input.prepPack.teacherId, 'create');
  const createdAt = (input.now ?? new Date()).toISOString();
  const approvedItems = input.prepPack.candidates.filter((item) =>
    isTeacherPrepPackInsertionEligible(item, input.prepPack, input.authorizedReviewerIds) &&
    isRuntimeCourseEnhancementTarget(item.insertionTarget)
  );
  const evidenceRefs = new Set(input.sourceEvidenceRefs ?? []);
  for (const item of approvedItems) {
    for (const evidence of item.evidenceBasis) {
      evidenceRefs.add(`${evidence.sourceType}:${evidence.sourceId}`);
    }
  }

  return {
    version: COURSE_ENHANCEMENT_PACK_VERSION,
    id: `course-enhancement-pack:${stableHash([
      input.teacherId,
      input.prepPack.id,
    ].join('|'))}`,
    teacherId: input.teacherId,
    classId: input.prepPack.classId,
    goalId: input.prepPack.goalId,
    lessonId: input.prepPack.nextLesson.lessonId,
    source: {
      prepPackId: input.prepPack.id,
      diagnosisSnapshotId: input.diagnosisSnapshotId ?? null,
      sourceEvidenceRefs: Array.from(evidenceRefs),
    },
    status: 'review-ready',
    createdAt,
    updatedAt: createdAt,
    items: approvedItems.map((item) => ({
      id: `${item.id}:overlay`,
      prepPackItemId: item.id,
      itemType: item.itemType,
      title: item.title,
      insertionTarget: item.insertionTarget,
      linkedResource: item.linkedResource!,
      estimatedTimeMinutes: item.estimatedTimeMinutes,
      evidenceBasis: item.evidenceBasis,
      methodologyNotes: item.methodologyNotes,
      privacyScope: 'aggregate-and-redacted-only',
      lifecycle: {
        state: 'approved',
        reviewedBy: item.review.reviewerId!,
        reviewedAt: item.review.reviewedAt!,
      },
      activation: {
        activatedBy: null,
        activatedAt: null,
        rolledBackBy: null,
        rolledBackAt: null,
        rollbackReason: null,
      },
      impactEvidence: [],
    })),
    auditLog: [{
      action: 'create',
      actorId: input.teacherId,
      at: createdAt,
      detail: `Created from prep pack ${input.prepPack.id}`,
    }],
    teacherFeedback: [],
  };
}

export function buildCourseEnhancementPackPreview(input: {
  pack: CourseEnhancementPack;
  runtimeContext: CourseEnhancementRuntimeContext;
}): CourseEnhancementPackPreview {
  const insertionIssues = input.pack.items
    .map((item) => ({ itemId: item.id, errors: validateCourseEnhancementInsertionTarget(item.insertionTarget, input.runtimeContext) }))
    .filter((issue) => issue.errors.length > 0);

  return {
    packId: input.pack.id,
    publishState: 'preview-only',
    insertionIssues,
    diff: {
      addedOverlayItems: input.pack.items.map((item) => ({
        packId: input.pack.id,
        itemId: item.id,
        title: item.title,
        insertionTarget: item.insertionTarget,
        linkedResource: item.linkedResource,
        evidenceBasis: item.evidenceBasis,
        estimatedTimeMinutes: item.estimatedTimeMinutes,
        privacyScope: item.privacyScope,
      })),
    },
  };
}

export function activateCourseEnhancementPack(input: {
  pack: CourseEnhancementPack;
  teacherId: string;
  runtimeContext: CourseEnhancementRuntimeContext;
  now?: Date;
}): CourseEnhancementPack {
  if (input.teacherId !== input.pack.teacherId) {
    throw new Error('unauthorized enhancement pack activation');
  }
  if (input.runtimeContext.classId !== input.pack.classId) {
    throw new Error('invalid enhancement pack class context');
  }
  if (input.runtimeContext.lessonId !== input.pack.lessonId) {
    throw new Error('invalid enhancement pack lesson context');
  }
  if (input.pack.status === 'archived') {
    throw new Error('archived enhancement pack cannot be activated');
  }
  const invalid = input.pack.items
    .map((item) => ({ item, errors: validateCourseEnhancementInsertionTarget(item.insertionTarget, input.runtimeContext) }))
    .filter(({ errors }) => errors.length > 0);
  if (invalid.length > 0) {
    throw new Error(`invalid insertion target: ${invalid.map(({ item, errors }) => `${item.id}:${errors.join(',')}`).join(';')}`);
  }
  const activatedAt = (input.now ?? new Date()).toISOString();
  return {
    ...input.pack,
    status: 'active',
    updatedAt: activatedAt,
    items: input.pack.items.map((item) => ({
      ...item,
      activation: {
        activatedBy: input.teacherId,
        activatedAt,
        rolledBackBy: null,
        rolledBackAt: null,
        rollbackReason: null,
      },
    })),
    auditLog: [
      ...input.pack.auditLog,
      { action: 'activate', actorId: input.teacherId, at: activatedAt, detail: 'Activated runtime overlay' },
    ],
  };
}

export function rollbackCourseEnhancementPack(input: {
  pack: CourseEnhancementPack;
  teacherId: string;
  reason: string;
  now?: Date;
}): CourseEnhancementPack {
  assertEnhancementPackActor(input.teacherId, input.pack.teacherId, 'rollback');
  if (input.pack.status === 'archived') {
    throw new Error('archived enhancement pack cannot be rolled back');
  }
  const rolledBackAt = (input.now ?? new Date()).toISOString();
  return {
    ...input.pack,
    status: 'rolled-back',
    updatedAt: rolledBackAt,
    items: input.pack.items.map((item) => ({
      ...item,
      activation: {
        ...item.activation,
        rolledBackBy: input.teacherId,
        rolledBackAt,
        rollbackReason: input.reason,
      },
    })),
    auditLog: [
      ...input.pack.auditLog,
      { action: 'rollback', actorId: input.teacherId, at: rolledBackAt, detail: input.reason },
    ],
  };
}

export function archiveCourseEnhancementPack(input: {
  pack: CourseEnhancementPack;
  teacherId: string;
  reason: string;
  now?: Date;
}): CourseEnhancementPack {
  assertEnhancementPackActor(input.teacherId, input.pack.teacherId, 'archive');
  const archivedAt = (input.now ?? new Date()).toISOString();
  return {
    ...input.pack,
    status: 'archived',
    updatedAt: archivedAt,
    auditLog: [
      ...input.pack.auditLog,
      { action: 'archive', actorId: input.teacherId, at: archivedAt, detail: input.reason },
    ],
  };
}

export function recordCourseEnhancementPackImpactEvidence(input: {
  pack: CourseEnhancementPack;
  itemId: string;
  evidenceRef: CourseEnhancementImpactEvidenceRef;
  teacherFeedback?: { teacherId: string; note: string; recordedAt: string };
}): CourseEnhancementPack {
  if (!input.pack.items.some((item) => item.id === input.itemId)) {
    throw new Error(`unknown enhancement pack item: ${input.itemId}`);
  }
  return {
    ...input.pack,
    updatedAt: input.evidenceRef.collectedAt,
    items: input.pack.items.map((item) => item.id === input.itemId ? {
      ...item,
      impactEvidence: [...item.impactEvidence, input.evidenceRef],
    } : item),
    teacherFeedback: input.teacherFeedback ? [...input.pack.teacherFeedback, input.teacherFeedback] : input.pack.teacherFeedback,
    auditLog: [
      ...input.pack.auditLog,
      {
        action: 'impact-evidence',
        actorId: input.teacherFeedback?.teacherId ?? input.pack.teacherId,
        at: input.evidenceRef.collectedAt,
        detail: input.evidenceRef.sourceId,
      },
    ],
  };
}

export function mergeCourseEnhancementPackOverlay<TBaseRuntime extends Record<string, unknown>>(input: {
  baseRuntime: TBaseRuntime;
  classId: string;
  sessionId?: string;
  includeAuditRefs?: boolean;
  packs: CourseEnhancementPack[];
}): TBaseRuntime & { enhancementOverlays: Array<Record<string, unknown>> } {
  const merged = deepClone(input.baseRuntime) as TBaseRuntime & {
    lessonId?: string;
    stages?: Array<Record<string, unknown>>;
    resources?: Array<Record<string, unknown>>;
    enhancementOverlays: Array<Record<string, unknown>>;
  };
  merged.enhancementOverlays = [];
  if (Array.isArray(merged.stages)) {
    merged.stages = merged.stages.map((stage) => ({ ...stage, overlayItems: Array.isArray(stage.overlayItems) ? stage.overlayItems : [] }));
  }
  if (Array.isArray(merged.resources)) {
    merged.resources = merged.resources.map((resource) => ({ ...resource, overlayItems: Array.isArray(resource.overlayItems) ? resource.overlayItems : [] }));
  }

  for (const pack of input.packs) {
    if (pack.status !== 'active' || pack.classId !== input.classId) continue;
    if (typeof merged.lessonId === 'string' && pack.lessonId !== merged.lessonId) continue;
    for (const item of pack.items) {
      if (!item.activation.activatedAt || item.activation.rolledBackAt) continue;
      if (item.insertionTarget.classSessionId && item.insertionTarget.classSessionId !== input.sessionId) continue;
      if (item.insertionTarget.type === 'class-session' &&
        !item.insertionTarget.classSessionId &&
        !item.insertionTarget.lessonStepId &&
        !item.insertionTarget.resourceNodeId) continue;
      if (item.insertionTarget.type === 'class-session' && !input.sessionId) continue;
      const overlayItem = {
        packId: pack.id,
        itemId: item.id,
        title: item.title,
        insertionTarget: item.insertionTarget,
        linkedResource: item.linkedResource,
        activation: {
          activatedAt: item.activation.activatedAt,
          activatedBy: item.activation.activatedBy,
        },
      };
      const runtimeOverlayItem = input.includeAuditRefs ? {
        ...overlayItem,
        prepPackId: pack.source.prepPackId,
        prepPackItemId: item.prepPackItemId,
        sourceEvidenceRefs: pack.source.sourceEvidenceRefs,
      } : overlayItem;
      merged.enhancementOverlays.push(runtimeOverlayItem);
      attachOverlayItem(merged, item.insertionTarget, runtimeOverlayItem);
    }
  }

  return merged;
}

export function validateCourseEnhancementPack(pack: CourseEnhancementPack): string[] {
  const errors: string[] = [];
  if (pack.version !== COURSE_ENHANCEMENT_PACK_VERSION) errors.push('invalid-enhancement-version');
  if (!pack.id) errors.push('missing-pack-id');
  if (!pack.teacherId) errors.push('missing-teacher-id');
  if (!pack.classId) errors.push('missing-class-id');
  if (!pack.goalId) errors.push('missing-goal-id');
  if (!pack.lessonId) errors.push('missing-lesson-id');
  if (!pack.source.prepPackId) errors.push('missing-source-prep-pack');
  if (!Array.isArray(pack.items) || pack.items.length === 0) errors.push('missing-enhancement-items');
  for (const item of pack.items) {
    if (!item.id) errors.push('item-missing-id');
    if (!item.prepPackItemId) errors.push('item-missing-prep-pack-item-id');
    if (!item.linkedResource?.nodeId) errors.push('item-missing-linked-resource');
    if (item.lifecycle.state !== 'approved') errors.push('item-not-approved');
    if (!item.lifecycle.reviewedBy || !item.lifecycle.reviewedAt) errors.push('item-missing-review-audit');
    if (!Array.isArray(item.evidenceBasis) || item.evidenceBasis.length === 0) errors.push('item-missing-evidence');
  }
  return Array.from(new Set(errors));
}

export async function persistCourseEnhancementPack(
  client: CourseEnhancementPackPersistenceClient,
  pack: CourseEnhancementPack,
): Promise<CourseEnhancementPack> {
  const data = courseEnhancementPackPersistenceData(pack);
  const record = await client.courseEnhancementPack.upsert({
    where: { sourcePrepPackId: pack.source.prepPackId },
    create: data.create,
    update: data.update,
  });
  return courseEnhancementPackFromPersistenceRecord(record);
}

export async function loadCourseEnhancementPack(
  client: CourseEnhancementPackPersistenceClient,
  packId: string,
): Promise<CourseEnhancementPack | null> {
  const record = await client.courseEnhancementPack.findUnique({ where: { id: packId } });
  return record ? courseEnhancementPackFromPersistenceRecord(record) : null;
}

export async function activatePersistedCourseEnhancementPack(input: {
  client: CourseEnhancementPackPersistenceClient;
  packId: string;
  teacherId: string;
  runtimeContext: CourseEnhancementRuntimeContext;
  now?: Date;
}): Promise<CourseEnhancementPack> {
  const pack = await loadRequiredCourseEnhancementPack(input.client, input.packId);
  return persistCourseEnhancementPack(input.client, activateCourseEnhancementPack({
    pack,
    teacherId: input.teacherId,
    runtimeContext: input.runtimeContext,
    now: input.now,
  }));
}

export async function rollbackPersistedCourseEnhancementPack(input: {
  client: CourseEnhancementPackPersistenceClient;
  packId: string;
  teacherId: string;
  reason: string;
  now?: Date;
}): Promise<CourseEnhancementPack> {
  const pack = await loadRequiredCourseEnhancementPack(input.client, input.packId);
  return persistCourseEnhancementPack(input.client, rollbackCourseEnhancementPack({
    pack,
    teacherId: input.teacherId,
    reason: input.reason,
    now: input.now,
  }));
}

export async function archivePersistedCourseEnhancementPack(input: {
  client: CourseEnhancementPackPersistenceClient;
  packId: string;
  teacherId: string;
  reason: string;
  now?: Date;
}): Promise<CourseEnhancementPack> {
  const pack = await loadRequiredCourseEnhancementPack(input.client, input.packId);
  return persistCourseEnhancementPack(input.client, archiveCourseEnhancementPack({
    pack,
    teacherId: input.teacherId,
    reason: input.reason,
    now: input.now,
  }));
}

export function isTeacherPrepPackInsertionEligible(
  item: TeacherPrepPackCandidateItem,
  pack: Pick<TeacherPrepPack, 'teacherId'>,
  authorizedReviewerIds?: string[],
): boolean {
  return isTeacherPrepPackItemApprovedByAuthorizedReviewer(item, pack, authorizedReviewerIds) &&
    Boolean(item.linkedResource) &&
    item.insertionTarget.type !== 'draft-resource-request';
}

export function validateTeacherPrepPack(pack: TeacherPrepPack): string[] {
  const errors: string[] = [];
  if (pack.version !== TEACHER_PREP_PACK_GENERATION_VERSION) errors.push('invalid-version');
  if (!pack.teacherId) errors.push('missing-teacher-id');
  if (!pack.classId) errors.push('missing-class-id');
  if (!pack.goalId) errors.push('missing-goal-id');
  if (!pack.nextLesson.lessonId) errors.push('missing-next-lesson');
  for (const item of pack.candidates) {
    errors.push(...validateTeacherPrepPackItem(item));
  }
  if (containsForbiddenPayload(pack.candidates)) errors.push('ordinary-payload-contains-private-content');
  return Array.from(new Set(errors));
}

export function validateTeacherPrepPackItem(item: TeacherPrepPackCandidateItem): string[] {
  const errors: string[] = [];
  if (!item.id) errors.push('item-missing-id');
  if (!item.title) errors.push('item-missing-title');
  if (!item.itemType) errors.push('item-missing-type');
  if (!item.rationale) errors.push('item-missing-rationale');
  if (!item.affectedGroup || item.affectedGroup.denominator <= 0) errors.push('item-missing-affected-group');
  if (item.affectedGroup && (item.affectedGroup.count < 0 || item.affectedGroup.count > item.affectedGroup.denominator)) {
    errors.push('item-invalid-affected-group');
  }
  if (!Array.isArray(item.evidenceBasis) || item.evidenceBasis.length === 0) errors.push('item-missing-evidence');
  if (item.evidenceBasis?.some((evidence) => !evidence.citationChip)) errors.push('item-missing-citation-chip');
  if (!item.insertionTarget?.type) errors.push('item-missing-insertion-target');
  if (item.estimatedTimeMinutes <= 0) errors.push('item-missing-estimated-time');
  if (!item.confidence?.state) errors.push('item-missing-confidence');
  if (item.confidence && (item.confidence.score < 0 || item.confidence.score > 1)) errors.push('item-invalid-confidence-score');
  if (!Array.isArray(item.methodologyNotes) || item.methodologyNotes.length === 0) errors.push('item-missing-methodology');
  if (!item.review?.state) errors.push('item-missing-review-state');
  if (item.review?.state === 'approved' && (!item.review.reviewerId || !item.review.reviewedAt)) {
    errors.push('approved-item-missing-reviewer');
  }
  if (!item.linkedResource && item.insertionTarget.type !== 'draft-resource-request') {
    errors.push('item-without-source-support');
  }
  if (item.insertionTarget.type === 'draft-resource-request' && !item.draftResourceRequest?.requiredReview) {
    errors.push('draft-request-missing-review');
  }
  if (containsForbiddenPayload(item)) errors.push('item-contains-private-content');
  return errors;
}

function candidatesFromDiagnosis(input: TeacherPrepPackInput): TeacherPrepPackCandidateItem[] {
  const diagnosis = input.diagnosis;
  if (!diagnosis || diagnosis.view !== 'teacher-class') return [];
  return diagnosis.rootCauseClusters
    .filter((cluster) => cluster.interventionPriority !== 'low')
    .map((cluster) => {
      const resource = matchResource(input, cluster.dimensionId, ['quiz', 'knowledge_card', 'lesson_step']);
      return candidate({
        input,
        itemType: resource?.type === 'knowledge_card' ? 'knowledge-card' : 'interactive-question',
        title: `${cluster.label} 针对性课堂补强`,
        rationale: `${cluster.affectedPopulation}/${cluster.denominator} 名学生在 ${cluster.label} 上需要关注。`,
        affectedGroup: affectedGroupFromCluster(cluster),
        evidenceBasis: [
          evidenceFromDiagnosisCluster(cluster),
          ...evidenceFromDiagnosisRefs(diagnosis).slice(0, 2),
        ],
        resource,
        target: targetForResource(resource, input, 'participatory-learning'),
        estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 8,
        confidence: confidenceScore(cluster.confidence, cluster.affectedPopulation, cluster.denominator),
        methodologyNotes: [
          'Generated from teacher-class diagnosis root-cause clusters.',
          'Candidate remains draft until teacher approval.',
        ],
      });
    });
}

function candidatesFromTeacherNotes(input: TeacherPrepPackInput): TeacherPrepPackCandidateItem[] {
  const diagnosis = input.diagnosis;
  if (!diagnosis || diagnosis.view !== 'teacher-class') return [];
  const clusters = diagnosis.rootCauseClusters.filter((cluster) => cluster.interventionPriority !== 'low');
  if (clusters.length === 0) return [];
  const topCluster = clusters[0];
  const resource = matchResource(input, `${topCluster.dimensionId} teacher note`, ['lesson_step', 'handout', 'knowledge_card']);
  return [candidate({
    input,
    itemType: 'teacher-note',
    title: `${input.nextLesson.title} 教师备课提示`,
    rationale: `下一课需要优先关注 ${topCluster.label}，并保留课堂观察记录。`,
    affectedGroup: {
      kind: 'class',
      label: '下一课教师备课关注点',
      count: Math.max(...clusters.map((cluster) => cluster.affectedPopulation)),
      denominator: Math.max(...clusters.map((cluster) => cluster.denominator)),
      dimensionId: topCluster.dimensionId,
    },
    evidenceBasis: clusters.slice(0, 3).map(evidenceFromDiagnosisCluster),
    resource,
    target: targetForResource(resource, input, 'bridge-in'),
    estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 4,
    confidence: confidenceScore(topCluster.confidence, topCluster.affectedPopulation, topCluster.denominator),
    methodologyNotes: [
      'Generated as a teacher-facing prep note from class diagnosis clusters.',
      'Teacher note is not automatically inserted unless a governed resource is linked and approved.',
    ],
  })];
}

function candidatesFromTeacherReport(input: TeacherPrepPackInput): TeacherPrepPackCandidateItem[] {
  const report = input.teacherReport;
  if (!report) return [];
  const items: TeacherPrepPackCandidateItem[] = [];
  const simulationMetric = report.metrics.simulationPassRate;
  if (isWeakMetric(simulationMetric)) {
    const resource = matchResource(input, 'simulation', ['simulation']);
    items.push(candidate({
      input,
      itemType: 'micro-simulation',
      title: '终端仿真验证微实验',
      rationale: `${simulationMetric.label} 偏低，下一课需要用短时仿真复核校正效果。`,
      affectedGroup: affectedGroupFromMetric(simulationMetric),
      evidenceBasis: [evidenceFromMetric(simulationMetric)],
      resource,
      target: targetForResource(resource, input, 'participatory-learning'),
      estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 12,
      confidence: confidenceScore(simulationMetric.confidence, simulationMetric.includedPopulation, simulationMetric.denominator),
      methodologyNotes: ['Generated from governed teacher report metrics.'],
    }));
  }
  const arenaMetric = report.metrics.arenaValidSubmissionRate;
  if (isWeakMetric(arenaMetric)) {
    const resource = matchResource(input, 'arena', ['arena_task']);
    items.push(candidate({
      input,
      itemType: 'arena-task',
      title: 'Arena 有效提交复盘任务',
      rationale: `${arenaMetric.label} 偏低，安排一个可控范围内的提交复盘。`,
      affectedGroup: affectedGroupFromMetric(arenaMetric),
      evidenceBasis: [evidenceFromMetric(arenaMetric)],
      resource,
      target: targetForResource(resource, input, 'post-assessment'),
      estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 10,
      confidence: confidenceScore(arenaMetric.confidence, arenaMetric.includedPopulation, arenaMetric.denominator),
      methodologyNotes: ['Generated from Arena-valid submission metric with explicit denominator.'],
    }));
  }
  return items;
}

function candidatesFromPathOutcomes(input: TeacherPrepPackInput): TeacherPrepPackCandidateItem[] {
  const deviations = input.pathOutcomes?.filter((path) => numberValue(path.deviationCount) > 0) ?? [];
  if (deviations.length === 0) return [];
  const resource = matchResource(input, 'reflection', ['reflection']);
  return [candidate({
    input,
    itemType: 'reflection-prompt',
    title: '学习路径偏离反思提示',
    rationale: `${deviations.length} 条路径存在偏离，需要课堂内短反思明确下一步。`,
    affectedGroup: {
      kind: 'subset',
      label: '路径偏离学生',
      count: deviations.length,
      denominator: Math.max(input.pathOutcomes?.length ?? deviations.length, deviations.length),
    },
    evidenceBasis: [{
      sourceType: 'path-outcome',
      sourceId: 'path-outcome-summary',
      displayTitle: '路径偏离摘要',
      capsule: `${deviations.length} 条路径存在偏离。`,
      confidence: 'medium',
      privacy: 'aggregate',
      citationChip: prepCitationChip({
        chunkId: 'path-outcome-summary',
        displayTitle: '路径偏离摘要',
        sourceType: 'path-summary',
        authorityLevel: 'learner-evidence',
        confidence: 'medium',
        privacyVisibility: 'redacted',
      }),
    }],
    resource,
    target: targetForResource(resource, input, 'summary'),
    estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 5,
    confidence: confidenceScore('medium', deviations.length, Math.max(input.pathOutcomes?.length ?? deviations.length, deviations.length)),
    methodologyNotes: ['Generated from aggregate path outcome counts.'],
  })];
}

function candidatesFromGradingSummaries(input: TeacherPrepPackInput): TeacherPrepPackCandidateItem[] {
  const weak = input.gradingSummaries?.filter((summary) => numberValue(summary.averageScore) < numberValue(summary.maxScore, 1) * 0.7) ?? [];
  if (weak.length === 0) return [];
  const resource = matchResource(input, 'konling', ['ai_intervention']);
  return [candidate({
    input,
    itemType: 'konling-prompt',
    title: '批改反馈后的控灵追问',
    rationale: '文档评分显示部分量规项需要下一课前的追问与澄清。',
    affectedGroup: {
      kind: 'subset',
      label: '批改低分学生',
      count: weak.length,
      denominator: Math.max(input.gradingSummaries?.length ?? weak.length, weak.length),
    },
    evidenceBasis: weak.slice(0, 3).map((summary, index) => ({
      sourceType: 'grading-summary' as const,
      sourceId: stringValue(summary.id) ?? `grading-summary-${index + 1}`,
      displayTitle: stringValue(summary.title) ?? '文档批改摘要',
      capsule: stringValue(summary.redactedSummary) ?? '量规项存在待改进表现。',
      confidence: confidenceValue(summary.confidence) ?? 'medium',
      privacy: 'redacted-capsule' as const,
      citationChip: prepCitationChip({
        chunkId: stringValue(summary.id) ?? `grading-summary-${index + 1}`,
        displayTitle: stringValue(summary.title) ?? '文档批改摘要',
        sourceType: 'grading-artifact',
        authorityLevel: 'teacher-authored',
        confidence: confidenceValue(summary.confidence) ?? 'medium',
        privacyVisibility: 'redacted',
      }),
    })),
    resource,
    target: targetForResource(resource, input, 'bridge-in'),
    estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 6,
    confidence: confidenceScore('medium', weak.length, Math.max(input.gradingSummaries?.length ?? weak.length, weak.length)),
    methodologyNotes: ['Generated from redacted document grading summaries.'],
  })];
}

function candidate(input: {
  input: TeacherPrepPackInput;
  itemType: TeacherPrepPackCandidateType;
  title: string;
  rationale: string;
  affectedGroup: TeacherPrepPackAffectedGroup;
  evidenceBasis: TeacherPrepPackEvidenceBasis[];
  resource: ResourceNode | null;
  target: TeacherPrepPackInsertionTarget;
  estimatedTimeMinutes: number;
  confidence: TeacherPrepPackCandidateItem['confidence'];
  methodologyNotes: string[];
}): TeacherPrepPackCandidateItem {
  const draftRequest = input.resource ? undefined : {
    reason: 'No governed ResourceNode matched this candidate; teacher review is required before creating a draft resource.',
    requiredReview: true as const,
  };
  return {
    id: 'pending',
    itemType: input.itemType,
    title: sanitizeText(input.title),
    rationale: sanitizeText(input.rationale),
    affectedGroup: input.affectedGroup,
    evidenceBasis: input.evidenceBasis.map(sanitizeEvidence),
    insertionTarget: input.resource ? input.target : {
      type: 'draft-resource-request',
      lessonId: input.input.nextLesson.lessonId,
      lessonStage: input.target.lessonStage,
      draftRequestReason: draftRequest!.reason,
    },
    estimatedTimeMinutes: input.estimatedTimeMinutes,
    confidence: input.confidence,
    methodologyNotes: input.methodologyNotes,
    review: {
      state: 'draft',
      reviewerId: null,
      reviewedAt: null,
      notes: null,
    },
    ...(input.resource ? {
      linkedResource: {
        nodeId: input.resource.id,
        title: input.resource.title,
        type: input.resource.type,
        launchTarget: input.resource.launchTarget,
      },
    } : {}),
    ...(draftRequest ? { draftResourceRequest: draftRequest } : {}),
    privacyMetadata: {
      rawStudentData: 'omitted',
      privateKonlingMemory: 'omitted',
      hiddenArenaInternals: 'omitted',
      rawTraces: 'omitted',
    },
  };
}

function matchResource(input: TeacherPrepPackInput, dimensionOrNeedle: string, preferredTypes: Array<ResourceNode['type']>): ResourceNode | null {
  const normalizedNeedle = dimensionOrNeedle.toLowerCase();
  return (input.resourceNodes ?? []).find((node) =>
    preferredTypes.includes(node.type) &&
    (node.courseModule === null || node.courseModule === input.goalId) &&
    node.planningMetadata.availability === 'available' &&
    node.planningMetadata.teacherPolicy !== 'blocked' &&
    node.planningMetadata.privacyLevel !== 'admin-scoped' &&
    node.eligibility.pathEligible &&
    !node.eligibility.auditIssues.some((issue) => issue.severity === 'blocking') &&
    (node.planningMetadata.knowledgeCoverage.some((item) => item.toLowerCase().includes(normalizedNeedle)) ||
      node.title.toLowerCase().includes(normalizedNeedle) ||
      Object.keys(node.planningMetadata.abilityImpact).some((key) => key.toLowerCase().includes(normalizedNeedle)))
  ) ?? null;
}

function targetForResource(
  resource: ResourceNode | null,
  input: TeacherPrepPackInput,
  lessonStage: TeacherPrepPackInsertionTarget['lessonStage'],
): TeacherPrepPackInsertionTarget {
  if (!resource) {
    return { type: 'draft-resource-request', lessonId: input.nextLesson.lessonId, lessonStage };
  }
  return {
    type: resource.type === 'lesson_step' ? 'lesson-step' : 'resource-node',
    lessonId: input.nextLesson.lessonId,
    lessonStage,
    resourceNodeId: resource.id,
    lessonStepId: resource.type === 'lesson_step' ? normalizeLessonStepId(resource.sourceRef) : undefined,
  };
}

function affectedGroupFromCluster(cluster: RoleBasedLearningDiagnosisRootCauseCluster): TeacherPrepPackAffectedGroup {
  return {
    kind: 'cluster',
    label: sanitizeText(cluster.label),
    count: cluster.affectedPopulation,
    denominator: cluster.denominator,
    dimensionId: cluster.dimensionId,
  };
}

function isRuntimeCourseEnhancementTarget(target: TeacherPrepPackInsertionTarget): boolean {
  return target.type === 'lesson-stage' ||
    target.type === 'lesson-step' ||
    target.type === 'resource-node' ||
    target.type === 'class-session';
}

function affectedGroupFromMetric(metric: ControlCorrectionReportMetric): TeacherPrepPackAffectedGroup {
  return {
    kind: 'class',
    label: sanitizeText(metric.label),
    count: metric.denominator - metric.includedPopulation,
    denominator: metric.denominator,
  };
}

function evidenceFromDiagnosisCluster(cluster: RoleBasedLearningDiagnosisRootCauseCluster): TeacherPrepPackEvidenceBasis {
  return {
    sourceType: 'role-diagnosis',
    sourceId: cluster.id,
    displayTitle: sanitizeText(cluster.label),
    capsule: `${cluster.affectedPopulation}/${cluster.denominator} learners affected; confidence ${cluster.confidence}.`,
    confidence: cluster.confidence,
    privacy: 'aggregate',
    citationChip: prepCitationChip({
      chunkId: cluster.id,
      displayTitle: sanitizeText(cluster.label),
      sourceType: 'diagnosis',
      authorityLevel: 'verified',
      confidence: cluster.confidence,
      privacyVisibility: 'redacted',
    }),
  };
}

function evidenceFromDiagnosisRefs(diagnosis: RoleBasedLearningDiagnosis): TeacherPrepPackEvidenceBasis[] {
  return diagnosis.claims.flatMap((claim) => claim.evidenceRefs.map((ref) => ({
    sourceType: ref.sourceType,
    sourceId: ref.chunkId,
    displayTitle: sanitizeText(ref.displayTitle),
    capsule: sanitizeText(ref.capsule),
    confidence: ref.confidence,
    privacy: 'redacted-capsule' as const,
    citationChip: ref.citationChip ?? prepCitationChip({
      chunkId: ref.chunkId,
      displayTitle: sanitizeText(ref.displayTitle),
      sourceType: ref.sourceType,
      authorityLevel: 'verified',
      confidence: ref.confidence,
      privacyVisibility: 'redacted',
    }),
  })));
}

function evidenceFromMetric(metric: ControlCorrectionReportMetric): TeacherPrepPackEvidenceBasis {
  return {
    sourceType: 'teacher-report',
    sourceId: metric.id,
    displayTitle: sanitizeText(metric.label),
    capsule: `${metric.label}: ${metric.value ?? 'n/a'} over ${metric.denominator}; confidence ${metric.confidence}.`,
    confidence: metric.confidence,
    privacy: 'aggregate',
    citationChip: prepCitationChip({
      chunkId: metric.id,
      displayTitle: sanitizeText(metric.label),
      sourceType: 'teacher-report',
      authorityLevel: 'teacher-authored',
      confidence: metric.confidence,
      privacyVisibility: 'redacted',
    }),
  };
}

function isWeakMetric(metric?: ControlCorrectionReportMetric): metric is ControlCorrectionReportMetric {
  return Boolean(metric && metric.denominator > 0 && typeof metric.value === 'number' && metric.value < 0.7);
}

function applyCandidatePatch(
  item: TeacherPrepPackCandidateItem,
  patch?: Partial<Pick<TeacherPrepPackCandidateItem, 'title' | 'rationale' | 'estimatedTimeMinutes' | 'insertionTarget'>>,
): TeacherPrepPackCandidateItem {
  if (!patch) return item;
  return {
    ...item,
    ...(patch.title !== undefined ? { title: sanitizeText(patch.title) } : {}),
    ...(patch.rationale !== undefined ? { rationale: sanitizeText(patch.rationale) } : {}),
    ...(patch.estimatedTimeMinutes !== undefined ? { estimatedTimeMinutes: patch.estimatedTimeMinutes } : {}),
    ...(patch.insertionTarget !== undefined ? { insertionTarget: patch.insertionTarget } : {}),
  };
}

function isTeacherPrepPackItemApprovedByAuthorizedReviewer(
  item: TeacherPrepPackCandidateItem,
  pack: Pick<TeacherPrepPack, 'teacherId'>,
  authorizedReviewerIds?: string[],
): boolean {
  const reviewerId = item.review.reviewerId;
  const allowed = authorizedReviewerIds ?? [pack.teacherId];
  return item.review.state === 'approved' &&
    Boolean(reviewerId) &&
    allowed.includes(reviewerId!) &&
    validateTeacherPrepPackItem(item).length === 0;
}

function sanitizeReviewerId(value: string): string {
  return sanitizeText(value).trim();
}

function confidenceScore(confidence: LearningEvidenceConfidence, count: number, denominator: number): TeacherPrepPackCandidateItem['confidence'] {
  const base = confidence === 'high' ? 0.85 : confidence === 'medium' ? 0.68 : confidence === 'low' ? 0.42 : 0.2;
  const coverage = denominator > 0 ? Math.min(1, count / denominator) : 0;
  return {
    state: confidence,
    score: round((base + coverage) / 2),
    limitations: confidence === 'low' || confidence === 'none' ? ['low-confidence-evidence'] : [],
  };
}

function materializationInputs(input: TeacherPrepPackInput): string[] {
  return [
    input.diagnosis ? 'role-based-learning-diagnosis' : null,
    input.teacherReport ? 'control-correction-teacher-report' : null,
    input.pathOutcomes?.length ? 'path-outcomes' : null,
    input.gradingSummaries?.length ? 'document-grading-summaries' : null,
    input.resourceNodes?.length ? 'resource-nodes' : null,
    input.evidenceCorpus?.length ? 'learning-evidence-corpus' : null,
    'next-lesson-context',
  ].filter((item): item is string => Boolean(item));
}

function dedupeCandidates(items: TeacherPrepPackCandidateItem[]): TeacherPrepPackCandidateItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.itemType}:${item.title}:${item.insertionTarget.type}:${item.linkedResource?.nodeId ?? 'draft'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeEvidence(evidence: TeacherPrepPackEvidenceBasis): TeacherPrepPackEvidenceBasis {
  return {
    ...evidence,
    displayTitle: sanitizeText(evidence.displayTitle),
    capsule: sanitizeText(evidence.capsule),
    citationChip: {
      ...evidence.citationChip,
      displayTitle: sanitizeText(evidence.citationChip.displayTitle),
    },
  };
}

function prepCitationChip(input: {
  chunkId: string;
  displayTitle: string;
  sourceType: LearningEvidenceCitationChipPayload['sourceType'];
  authorityLevel: LearningEvidenceCitationChipPayload['authorityLevel'];
  confidence: LearningEvidenceConfidence;
  privacyVisibility: LearningEvidenceCitationChipPayload['privacyVisibility'];
}): LearningEvidenceCitationChipPayload {
  return {
    chunkId: input.chunkId,
    displayTitle: input.displayTitle,
    displayHref: null,
    sourceType: input.sourceType,
    authorityLevel: input.authorityLevel,
    confidence: input.confidence,
    freshnessBucket: 'current',
    privacyVisibility: input.privacyVisibility,
    limitationState: null,
  };
}

function sanitizeText(value: string): string {
  return value
    .replace(/raw[-\s]+answer[-\s]+body/gi, '[redacted]')
    .replace(/raw[-\s]+answer[^.;\n]*/gi, '[redacted]')
    .replace(/private[-\s]+konling[-\s]+memory/gi, '[redacted]')
    .replace(/private[-\s]+konling[-\s]+memory[^.;\n]*/gi, '[redacted]')
    .replace(/hidden[-\s]+arena[-\s]+internals/gi, '[redacted]')
    .replace(/hidden[-\s]+arena[^.;\n]*/gi, '[redacted]')
    .replace(/raw[-\s]+high[-\s]+frequency[-\s]+trace/gi, '[redacted]')
    .replace(/raw[-\s]+trace[^.;\n]*/gi, '[redacted]')
    .replace(/secret[:=][^\s,;]+/gi, 'secret=[redacted]')
    .trim();
}

function containsForbiddenPayload(value: unknown): boolean {
  return /raw[-\s]+answer[-\s]+body|private[-\s]+konling[-\s]+memory|hidden[-\s]+arena[-\s]+internals|raw[-\s]+high[-\s]+frequency[-\s]+trace|secret[:=](?!\[redacted\])[^\s,;]+/i
    .test(JSON.stringify(value));
}

function validateCourseEnhancementInsertionTarget(
  target: TeacherPrepPackInsertionTarget,
  context: CourseEnhancementRuntimeContext,
): string[] {
  const errors: string[] = [];
  if (target.lessonId && target.lessonId !== context.lessonId) errors.push('lesson-mismatch');
  if (target.type === 'lesson-stage') {
    if (!target.lessonStage || !context.stages.some((stage) => normalizeBopppsStage(stage.stage) === target.lessonStage)) {
      errors.push('missing-lesson-stage');
    }
  } else if (target.type === 'lesson-step') {
    if (!target.lessonStepId || !lessonStepIdExists(target.lessonStepId, context.lessonStepIds ?? [])) {
      errors.push('missing-lesson-step');
    }
  } else if (target.type === 'resource-node') {
    if (!target.resourceNodeId || !(context.resourceNodeIds ?? []).includes(target.resourceNodeId)) {
      errors.push('missing-resource-node');
    }
  } else if (target.type === 'class-session') {
    if (target.classSessionId && !(context.classSessionIds ?? []).includes(target.classSessionId)) {
      errors.push('missing-class-session');
    }
    if (target.lessonStepId && !lessonStepIdExists(target.lessonStepId, context.lessonStepIds ?? [])) {
      errors.push('missing-lesson-step');
    }
    if (target.resourceNodeId && !(context.resourceNodeIds ?? []).includes(target.resourceNodeId)) {
      errors.push('missing-resource-node');
    }
    if (!target.classSessionId && !target.lessonStepId && !target.resourceNodeId) {
      errors.push('missing-class-session-anchor');
    }
  } else {
    errors.push('unsupported-runtime-target');
  }
  return errors;
}

function assertEnhancementPackActor(actorId: string, ownerTeacherId: string, action: 'create' | 'rollback' | 'archive'): void {
  if (actorId !== ownerTeacherId) {
    throw new Error(`unauthorized enhancement pack ${action}`);
  }
}

async function loadRequiredCourseEnhancementPack(
  client: CourseEnhancementPackPersistenceClient,
  packId: string,
): Promise<CourseEnhancementPack> {
  const pack = await loadCourseEnhancementPack(client, packId);
  if (!pack) {
    throw new Error(`course enhancement pack not found: ${packId}`);
  }
  return pack;
}

function courseEnhancementPackPersistenceData(pack: CourseEnhancementPack): {
  create: Parameters<CourseEnhancementPackPersistenceClient['courseEnhancementPack']['upsert']>[0]['create'];
  update: Parameters<CourseEnhancementPackPersistenceClient['courseEnhancementPack']['upsert']>[0]['update'];
} {
  const activatedAt = firstDate(pack.items.map((item) => item.activation.activatedAt));
  const rolledBackAt = firstDate(pack.items.map((item) => item.activation.rolledBackAt));
  const archivedAt = pack.status === 'archived'
    ? firstDate(pack.auditLog.filter((entry) => entry.action === 'archive').map((entry) => entry.at))
    : null;
  const source = pack.source as unknown as Prisma.InputJsonValue;
  const items = pack.items as unknown as Prisma.InputJsonValue;
  const auditLog = pack.auditLog as unknown as Prisma.InputJsonValue;
  const teacherFeedback = pack.teacherFeedback as unknown as Prisma.InputJsonValue;
  return {
    create: {
      id: pack.id,
      teacherId: pack.teacherId,
      classId: pack.classId,
      goalId: pack.goalId,
      lessonId: pack.lessonId,
      sourcePrepPackId: pack.source.prepPackId,
      diagnosisSnapshotId: pack.source.diagnosisSnapshotId,
      status: pack.status,
      source,
      items,
      auditLog,
      teacherFeedback,
      activatedAt,
      rolledBackAt,
      archivedAt,
    },
    update: {
      status: pack.status,
      diagnosisSnapshotId: pack.source.diagnosisSnapshotId,
      source,
      items,
      auditLog,
      teacherFeedback,
      activatedAt,
      rolledBackAt,
      archivedAt,
    },
  };
}

function courseEnhancementPackFromPersistenceRecord(record: CourseEnhancementPackPersistenceRecord): CourseEnhancementPack {
  const source = isObject(record.source) ? record.source as unknown as CourseEnhancementPack['source'] : {
    prepPackId: record.sourcePrepPackId,
    diagnosisSnapshotId: record.diagnosisSnapshotId,
    sourceEvidenceRefs: [],
  };
  return {
    version: COURSE_ENHANCEMENT_PACK_VERSION,
    id: record.id,
    teacherId: record.teacherId,
    classId: record.classId,
    goalId: record.goalId,
    lessonId: record.lessonId,
    source,
    status: courseEnhancementPackStatus(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    items: Array.isArray(record.items) ? record.items as unknown as CourseEnhancementPackItem[] : [],
    auditLog: Array.isArray(record.auditLog) ? record.auditLog as CourseEnhancementPack['auditLog'] : [],
    teacherFeedback: Array.isArray(record.teacherFeedback) ? record.teacherFeedback as CourseEnhancementPack['teacherFeedback'] : [],
  };
}

function courseEnhancementPackStatus(status: string): CourseEnhancementPackStatus {
  return status === 'review-ready' || status === 'active' || status === 'rolled-back' || status === 'archived'
    ? status
    : 'review-ready';
}

function firstDate(values: Array<string | null>): Date | null {
  const value = values.find((entry): entry is string => Boolean(entry));
  return value ? new Date(value) : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function attachOverlayItem(
  runtime: { stages?: Array<Record<string, unknown>>; resources?: Array<Record<string, unknown>> },
  target: TeacherPrepPackInsertionTarget,
  overlayItem: Record<string, unknown>,
): void {
  if (target.type === 'lesson-stage') {
    const stage = runtime.stages?.find((entry) => normalizeBopppsStage(entry.stage) === target.lessonStage);
    pushOverlay(stage, overlayItem);
    return;
  }
  if (target.type === 'lesson-step') {
    const lessonStepId = normalizeLessonStepId(target.lessonStepId);
    const stage = runtime.stages?.find((entry) => Array.isArray(entry.stepIds) && entry.stepIds.includes(lessonStepId));
    pushOverlay(stage, overlayItem);
    return;
  }
  if (target.type === 'resource-node') {
    const resource = runtime.resources?.find((entry) => entry.nodeId === target.resourceNodeId);
    pushOverlay(resource, overlayItem);
    return;
  }
  if (target.type === 'class-session') {
    if (target.lessonStepId) {
      const lessonStepId = normalizeLessonStepId(target.lessonStepId);
      const stage = runtime.stages?.find((entry) => Array.isArray(entry.stepIds) && entry.stepIds.includes(lessonStepId));
      pushOverlay(stage, overlayItem);
    }
    if (target.resourceNodeId) {
      const resource = runtime.resources?.find((entry) => entry.nodeId === target.resourceNodeId);
      pushOverlay(resource, overlayItem);
    }
  }
}

function normalizeLessonStepId(value: string | undefined): string | undefined {
  if (!value) return value;
  const parts = value.split(':').filter(Boolean);
  return parts.at(-1) ?? value;
}

function normalizeBopppsStage(value: unknown): TeacherPrepPackInsertionTarget['lessonStage'] | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase().replaceAll('_', '-');
  if (normalized === 'participatory') return 'participatory-learning';
  if (normalized === 'pre-assessment') return 'pre-assessment';
  if (normalized === 'post-assessment') return 'post-assessment';
  if (normalized === 'bridge-in') return 'bridge-in';
  if (normalized === 'objective') return 'objective';
  if (normalized === 'summary') return 'summary';
  if (normalized === 'participatory-learning') return 'participatory-learning';
  return undefined;
}

function lessonStepIdExists(value: string, knownStepIds: string[]): boolean {
  const normalized = normalizeLessonStepId(value);
  return Boolean(normalized && knownStepIds.includes(normalized));
}

function pushOverlay(target: Record<string, unknown> | undefined, overlayItem: Record<string, unknown>): void {
  if (!target) return;
  const current = Array.isArray(target.overlayItems) ? target.overlayItems : [];
  target.overlayItems = [...current, overlayItem];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function confidenceValue(value: unknown): LearningEvidenceConfidence | null {
  return value === 'none' || value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
