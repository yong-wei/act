import { sha256, stableStringify } from './math-document-grading-contracts';
import {
  assertPipelineActorScope,
  questionContractFromRow,
  type PipelineActor,
} from './math-document-grading-persistence';
import {
  createQuestionScopedGradingBatch,
  processQuestionGradingBatch,
  type BatchRequest,
} from './math-document-grading-batch';
import {
  createTeacherAssignmentReview,
  resolveTeacherAssignmentReviewAuthorization,
} from './teacher-assignment-review';

type GradingDb = Record<string, any>;

function normalizeStudentIds(studentIds?: string[]) {
  return [...new Set((studentIds ?? []).map((value) => value.trim()).filter(Boolean))].sort();
}

async function loadPublishedRevision(db: GradingDb, assignmentId: string, revisionId?: string) {
  const revision = await db.assignmentRevision.findFirst({
    where: { assignmentId, ...(revisionId ? { id: revisionId } : {}), state: 'PUBLISHED' },
    include: {
      assignment: { include: { reviewGrants: true } },
      questions: { orderBy: { orderIndex: 'asc' } },
      audiences: { include: { class: true } },
    },
  });
  if (!revision) throw new Error('assignment-grading-revision-not-found');
  return revision;
}

function authorizedAudienceClassIds(revision: any, actor: PipelineActor, now: Date): string[] | null {
  if (actor.role === 'ADMIN' || revision.assignment?.authorId === actor.id) return null;
  const grant = revision.assignment?.reviewGrants?.some((row: any) => row.teacherId === actor.id
    && row.revokedAt == null && (row.expiresAt == null || new Date(row.expiresAt) > now));
  if (grant) return null;
  const classIds = (revision.audiences ?? [])
    .filter((audience: any) => audience.class?.teacherId === actor.id && audience.class?.isActive === true)
    .map((audience: any) => audience.classId)
    .sort();
  if (classIds.length === 0) {
    throw new Error('assignment-grading-forbidden');
  }
  return classIds;
}

function policyCoversClass(policy: { classScope?: unknown }, classId: string) {
  return Array.isArray(policy.classScope)
    && policy.classScope.some((scope) => scope === '*' || scope === classId);
}

async function resolveDefaultRubricPolicyId(db: GradingDb, classId: string) {
  if (!db.gradingProviderPolicy?.findMany) return undefined;
  const policies = await db.gradingProviderPolicy.findMany({
    where: { purpose: 'rubric-grading', enabled: true, disabledAt: null },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    select: { id: true, classScope: true },
  });
  const policy = policies.find((candidate: { id: string; classScope?: unknown }) => policyCoversClass(candidate, classId));
  if (!policy) throw new Error('grading-provider-policy-not-configured');
  return policy.id;
}

export async function createAssignmentAiGradingBatches(input: {
  db: GradingDb;
  assignmentId: string;
  revisionId?: string;
  actor: PipelineActor;
  idempotencyKey: string;
  studentIds?: string[];
  excludedStudentIds?: string[];
  batchOptions?: Omit<BatchRequest, 'assignmentRevisionId' | 'questionId' | 'classId' | 'actor' | 'idempotencyKey' | 'studentIds' | 'now'>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const revision = await loadPublishedRevision(input.db, input.assignmentId, input.revisionId);
  const authorizedClassIds = authorizedAudienceClassIds(revision, input.actor, now);
  const requestedStudentIds = normalizeStudentIds(input.studentIds);
  const excludedStudentIds = new Set(normalizeStudentIds(input.excludedStudentIds));
  const submissions = await input.db.assignmentSubmission.findMany({
    where: {
      assignmentRevisionId: revision.id,
      state: { in: ['SUBMITTED', 'IN_PROGRESS'] },
      ...(authorizedClassIds ? { frozenAudienceClassId: { in: authorizedClassIds } } : {}),
      ...(requestedStudentIds.length ? { studentId: { in: requestedStudentIds } } : {}),
    },
    include: {
      answers: { include: { attempts: true } },
      gradingSnapshots: { include: { items: true, grade: true } },
    },
  });
  const scopedSubmissions = submissions.filter((submission: any) => !authorizedClassIds || authorizedClassIds.includes(submission.frozenAudienceClassId));
  const frozenSelection: Array<{ submissionId: string; frozenAudienceClassId: string; attemptVectorHash: string }> = scopedSubmissions
    .filter((submission: any) => !excludedStudentIds.has(submission.studentId)
      && now > new Date(submission.frozenAudienceDueAt)
      && submissionHasCurrentAttempt(submission, revision.questions))
    .map((submission: any) => {
      const snapshot = assignmentSubmissionSnapshotData({ operationId: 'assignment-grading-request', source: 'AI', submission, questions: revision.questions, now });
      return {
        submissionId: submission.id,
        frozenAudienceClassId: submission.frozenAudienceClassId,
        attemptVectorHash: snapshot.attemptVectorHash,
      };
    })
    .sort((left: { submissionId: string }, right: { submissionId: string }) => left.submissionId.localeCompare(right.submissionId));
  const eligibleSubmissions = scopedSubmissions.filter((submission: any) => !excludedStudentIds.has(submission.studentId)
    && now > new Date(submission.frozenAudienceDueAt)
    && submissionRequiresIncrementalGrading(submission, revision.questions));
  if (eligibleSubmissions.length === 0 && !input.db.assignmentGradingOperation) {
    throw new Error('assignment-grading-before-deadline');
  }

  const requestHash = sha256(stableStringify({
    assignmentId: input.assignmentId,
    revisionId: revision.id,
    actorId: input.actor.id,
    requestedStudentIds,
    excludedStudentIds: [...excludedStudentIds].sort(),
    frozenSelection,
    batchOptions: input.batchOptions ?? {},
  }));
  const operation = await createOrReplayAssignmentGradingOperation({
    db: input.db,
    assignmentId: input.assignmentId,
    revision,
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    requestHash,
    requestedStudentIds,
    excludedStudentIds: [...excludedStudentIds].sort(),
    submissions: eligibleSubmissions,
    now,
  });

  const batches: any[] = [];
  const snapshotsByClass = new Map<string, any[]>();
  for (const snapshot of operation.snapshots) {
    const rows = snapshotsByClass.get(snapshot.frozenAudienceClassId) ?? [];
    rows.push(snapshot);
    snapshotsByClass.set(snapshot.frozenAudienceClassId, rows);
  }
  for (const [classId, snapshots] of snapshotsByClass) {
    const policyId = input.batchOptions?.policyId ?? await resolveDefaultRubricPolicyId(input.db, classId);
    for (const question of revision.questions) {
      const attemptIds = snapshots.flatMap((snapshot: any) => snapshot.items
        .filter((item: any) => item.questionId === question.id && item.attemptId)
        .map((item: any) => item.attemptId));
      const studentIds = normalizeStudentIds(snapshots.map((snapshot: any) => snapshot.submission.studentId));
      const request: BatchRequest = {
        assignmentRevisionId: revision.id,
        questionId: question.id,
        classId,
        actor: input.actor,
        idempotencyKey: `${operation.id}:${classId}:${question.id}`,
        studentIds,
        attemptIds,
        assignmentGradingOperationId: operation.id,
        now,
        ...input.batchOptions,
        policyId,
      };
      const result = await createQuestionScopedGradingBatch({ db: input.db, request });
      batches.push({ classId, questionId: question.id, operationId: operation.id, ...result });
    }
  }
  return {
    revisionId: revision.id,
    operation,
    batches,
    replay: operation.replay && batches.every((batch) => batch.replay),
    submittedStudentIds: normalizeStudentIds(operation.snapshots.map((snapshot: any) => snapshot.submission.studentId)),
  };
}

async function createOrReplayAssignmentGradingOperation(input: {
  db: GradingDb;
  assignmentId: string;
  revision: any;
  actor: PipelineActor;
  idempotencyKey: string;
  requestHash: string;
  requestedStudentIds: string[];
  excludedStudentIds: string[];
  submissions: any[];
  now: Date;
}) {
  const dedupeKey = `assignment-grading-operation:${input.actor.id}:${input.idempotencyKey}`;
  const include = { snapshots: { include: { items: true, submission: { select: { studentId: true } } } } };
  const load = async () => input.db.assignmentGradingOperation.findUnique({
    where: { requesterUserId_idempotencyKey: { requesterUserId: input.actor.id, idempotencyKey: input.idempotencyKey } },
    include,
  });
  const existing = await load();
  if (existing) return assertAssignmentGradingOperationReplay(existing, input.requestHash);
  if (input.submissions.length === 0) throw new Error('assignment-grading-before-deadline');
  const snapshotRows = input.submissions.map((submission: any) => assignmentSubmissionSnapshotData({
    operationId: `assignment-grading-operation:${sha256(dedupeKey).slice(-32)}`,
    source: 'AI',
    submission,
    questions: input.revision.questions,
    now: input.now,
  }));
  const data = {
    id: `assignment-grading-operation:${sha256(dedupeKey).slice(-32)}`,
    assignmentId: input.assignmentId,
    assignmentRevisionId: input.revision.id,
    requesterUserId: input.actor.id,
    idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash,
    dedupeKey,
    selectionSnapshot: {
      version: 'assignment-grading-operation.v1',
      requestedStudentIds: input.requestedStudentIds,
      excludedStudentIds: input.excludedStudentIds,
      requestedAt: input.now.toISOString(),
    },
    state: 'QUEUED',
    createdAt: input.now,
    updatedAt: input.now,
    snapshots: { create: snapshotRows },
  };
  try {
    const created = await input.db.assignmentGradingOperation.create({ data, include });
    return { ...created, replay: false };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const winner = await load();
    if (!winner) throw new Error('assignment-grading-operation-conflict');
    return assertAssignmentGradingOperationReplay(winner, input.requestHash);
  }
}

function assignmentSubmissionSnapshotData(input: { operationId: string; source: 'AI' | 'MANUAL'; submission: any; questions: any[]; now: Date }) {
  const items = [...input.questions].sort((left: any, right: any) => left.orderIndex - right.orderIndex || left.id.localeCompare(right.id)).map((question) => {
    const answer = input.submission.answers.find((row: any) => row.assignmentQuestionId === question.id);
    const attempt = answer?.attempts.find((row: any) => row.attemptNumber === answer.currentAttemptNumber) ?? null;
    return {
      id: `assignment-submission-snapshot-item:${sha256(`${input.operationId}:${input.submission.id}:${question.id}`).slice(-32)}`,
      questionId: question.id,
      answerId: answer?.id ?? null,
      attemptId: attempt?.id ?? null,
      attemptNumber: attempt?.attemptNumber ?? null,
      answerVersion: attempt?.answerVersion ?? null,
      questionSnapshotHash: question.contentHash,
      createdAt: input.now,
    };
  });
  return {
    id: `assignment-submission-snapshot:${sha256(`${input.operationId}:${input.submission.id}`).slice(-32)}`,
    operationId: input.operationId,
    submissionId: input.submission.id,
    assignmentRevisionId: input.submission.assignmentRevisionId,
    frozenAudienceId: input.submission.audienceId,
    frozenAudienceClassId: input.submission.frozenAudienceClassId,
    originalDueAt: input.submission.frozenAudienceDueAt,
    submissionState: input.submission.state,
    attemptVectorHash: sha256(stableStringify(items.map((item) => ({
      questionId: item.questionId,
      answerId: item.answerId,
      attemptId: item.attemptId,
      attemptNumber: item.attemptNumber,
      answerVersion: item.answerVersion,
      questionSnapshotHash: item.questionSnapshotHash,
    })))),
    source: input.source,
    createdAt: input.now,
    items: { create: items },
  };
}

export function submissionRequiresIncrementalGrading(submission: any, questions: any[]) {
  const currentAttemptIds = questions.map((question: any) => {
    const answer = (submission.answers ?? []).find((row: any) => row.assignmentQuestionId === question.id);
    return answer?.attempts?.find((row: any) => row.attemptNumber === answer.currentAttemptNumber)?.id ?? null;
  });
  if (!currentAttemptIds.some(Boolean)) return false;
  return !(submission.gradingSnapshots ?? []).some((snapshot: any) => {
    const snapshotAttemptIds = questions.map((question: any) => snapshot.items?.find((item: any) => item.questionId === question.id)?.attemptId ?? null);
    const matchesCurrentAttemptVector = snapshotAttemptIds.every((attemptId: string | null, index: number) => attemptId === currentAttemptIds[index]);
    if (!matchesCurrentAttemptVector) return false;
    return snapshot.source !== 'MANUAL' || ['CONFIRMED', 'RELEASED'].includes(snapshot.grade?.state);
  });
}

export async function ensureAssignmentAiResultSnapshot(input: {
  db: GradingDb;
  assignmentId: string;
  submissionId: string;
  actor: PipelineActor;
  snapshotVersion?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const snapshotVersion = input.snapshotVersion?.trim() || null;
  const revision = await loadPublishedRevision(input.db, input.assignmentId);
  const submission = await input.db.assignmentSubmission.findUnique({
    where: { id: input.submissionId },
    include: {
      audience: { include: { class: true } },
      answers: { include: { attempts: true } },
    },
  });
  if (!submission || submission.assignmentRevisionId !== revision.id) throw new Error('assignment-result-submission-not-found');
  if (!['SUBMITTED', 'IN_PROGRESS'].includes(submission.state) || now <= new Date(submission.frozenAudienceDueAt)) throw new Error('assignment-result-before-deadline');
  if (submission.audience?.class?.isActive !== true) throw new Error('assignment-result-class-unavailable');
  await assertPipelineActorScope({
    db: input.db,
    actor: input.actor,
    assignmentRevisionId: revision.id,
    classId: submission.frozenAudienceClassId,
    classTeacherId: submission.audience.class.teacherId,
    ownerStudentId: submission.frozenStudentId,
    requestedStudentId: submission.frozenStudentId,
    purpose: 'teacher-review',
    now,
  });
  const snapshot = assignmentSubmissionSnapshotData({
    operationId: `assignment-teacher-confirmation:${sha256(snapshotVersion ? `${input.actor.id}:${submission.id}:${snapshotVersion}` : `${input.actor.id}:${submission.id}`).slice(-32)}`,
    source: 'AI',
    submission,
    questions: revision.questions,
    now,
  });
  const operation = await input.db.assignmentGradingOperation.findUnique({
    where: { id: snapshot.operationId },
    include: { snapshots: true },
  });
  if (operation?.snapshots?.[0]) return operation.snapshots[0];
  const currentAttemptIds = snapshot.items.create.map((item: any) => item.attemptId).filter(Boolean);
  const approved = await input.db.teacherAssignmentApprovalSnapshot.findMany({
    where: { submissionId: submission.id, attemptId: { in: currentAttemptIds } },
    select: { questionId: true, attemptId: true },
  });
  const approvedKeys = new Set(approved.map((row: any) => `${row.questionId}:${row.attemptId}`));
  if (snapshot.items.create.some((item: any) => item.attemptId && !approvedKeys.has(`${item.questionId}:${item.attemptId}`))) {
    throw new Error('assignment-result-approval-incomplete');
  }
  const requestHash = sha256(stableStringify({ assignmentId: input.assignmentId, submissionId: submission.id, attemptVectorHash: snapshot.attemptVectorHash, snapshotVersion }));
  try {
    const { operationId: _operationId, ...snapshotData } = snapshot;
    const created = await input.db.assignmentGradingOperation.create({
      data: {
        id: snapshot.operationId,
        assignmentId: input.assignmentId,
        assignmentRevisionId: revision.id,
        requesterUserId: input.actor.id,
        idempotencyKey: snapshotVersion ? `teacher-confirmation:${submission.id}:${snapshotVersion}` : `teacher-confirmation:${submission.id}`,
        requestHash,
        dedupeKey: snapshotVersion ? `assignment-teacher-confirmation:${input.actor.id}:${submission.id}:${snapshotVersion}` : `assignment-teacher-confirmation:${input.actor.id}:${submission.id}`,
        selectionSnapshot: { version: 'assignment-teacher-confirmation-projection.v1', submissionId: submission.id, attemptVectorHash: snapshot.attemptVectorHash, ...(snapshotVersion ? { snapshotVersion } : {}), requestedAt: now.toISOString() },
        state: 'SUCCEEDED',
        startedAt: now,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
        snapshots: { create: snapshotData },
      },
      include: { snapshots: true },
    });
    return created.snapshots[0];
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const winner = await input.db.assignmentGradingOperation.findUnique({ where: { id: snapshot.operationId }, include: { snapshots: true } });
    if (winner?.snapshots?.[0]) return winner.snapshots[0];
    throw new Error('assignment-result-snapshot-conflict');
  }
}

function submissionHasCurrentAttempt(submission: any, questions: any[]) {
  return questions.some((question: any) => {
    const answer = (submission.answers ?? []).find((row: any) => row.assignmentQuestionId === question.id);
    return Boolean(answer?.attempts?.some((row: any) => row.attemptNumber === answer.currentAttemptNumber));
  });
}

function assertAssignmentGradingOperationReplay(operation: any, requestHash: string) {
  if (operation.requestHash !== requestHash) throw new Error('assignment-grading-operation-conflict');
  return { ...operation, replay: true };
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}

export async function executeAssignmentAiGradingBatches(input: {
  db: GradingDb;
  batches: Array<{ batch: any }>;
  now?: Date;
  provider?: any;
  store?: any;
  mathpix?: any;
  local?: any;
}) {
  const now = input.now ?? new Date();
  const operationIds = [...new Set(input.batches.map((entry: any) => entry.operationId).filter(Boolean))];
  if (operationIds.length && input.db.assignmentGradingOperation?.updateMany) {
    await input.db.assignmentGradingOperation.updateMany({
      where: { id: { in: operationIds }, state: 'QUEUED' },
      data: { state: 'RUNNING', startedAt: now, updatedAt: now },
    });
  }
  const results = [];
  for (const entry of input.batches) {
    results.push(await processQuestionGradingBatch({
      db: input.db,
      batchId: entry.batch.id,
      provider: input.provider,
      store: input.store,
      mathpix: input.mathpix,
      local: input.local,
      now,
    }));
  }
  if (operationIds.length && input.db.assignmentGradingOperation?.updateMany) {
    const itemStates = results.flatMap((result: any) => result.itemResults.map((item: any) => item.state));
    const state = itemStates.length > 0 && itemStates.every((item: string) => item === 'BLOCKED') ? 'BLOCKED'
      : itemStates.length > 0 && itemStates.every((item: string) => item === 'FAILED') ? 'FAILED'
        : itemStates.some((item: string) => ['FAILED', 'BLOCKED', 'RETRYABLE'].includes(item)) ? 'PARTIAL' : 'SUCCEEDED';
    await input.db.assignmentGradingOperation.updateMany({
      where: { id: { in: operationIds }, state: 'RUNNING' },
      data: { state, completedAt: now, updatedAt: now },
    });
  }
  return results;
}

export async function refreshAssignmentAiGradingOperation(input: { db: GradingDb; batchId: string; now?: Date }) {
  if (!input.db.gradingBatch?.findUnique || !input.db.gradingBatch?.findMany || !input.db.assignmentGradingOperation?.updateMany) return;
  const now = input.now ?? new Date();
  const batch = await input.db.gradingBatch.findUnique({
    where: { id: input.batchId },
    select: { assignmentGradingOperationId: true },
  });
  const operationId = batch?.assignmentGradingOperationId;
  if (!operationId) return;
  const batches = await input.db.gradingBatch.findMany({
    where: { assignmentGradingOperationId: operationId },
    select: { state: true },
  });
  if (batches.length === 0) return;
  const terminalStates = new Set(['SUCCEEDED', 'PARTIAL', 'FAILED', 'BLOCKED', 'CANCELLED', 'CONTENT_UNAVAILABLE']);
  const terminal = batches.every((entry: any) => terminalStates.has(entry.state));
  const state = !terminal ? 'RUNNING'
    : batches.every((entry: any) => entry.state === 'SUCCEEDED') ? 'SUCCEEDED'
      : batches.every((entry: any) => ['BLOCKED', 'CONTENT_UNAVAILABLE'].includes(entry.state)) ? 'BLOCKED'
        : batches.every((entry: any) => ['FAILED', 'CANCELLED'].includes(entry.state)) ? 'FAILED'
          : 'PARTIAL';
  if (state === 'RUNNING') {
    await input.db.assignmentGradingOperation.updateMany({
      where: { id: operationId, state: { not: 'SUCCEEDED' } },
      data: { state, completedAt: null, updatedAt: now },
    });
    return;
  }
  await input.db.assignmentGradingOperation.updateMany({
    where: { id: operationId, state: { not: 'SUCCEEDED' } },
    data: { state, startedAt: now, completedAt: now, updatedAt: now },
  });
}

export async function createManualQuestionGradingReview(input: {
  db: GradingDb;
  assignmentId: string;
  submissionId: string;
  questionId: string;
  actor: { id: string; role: 'TEACHER' | 'ADMIN' };
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const submission = await input.db.assignmentSubmission.findUnique({
    where: { id: input.submissionId },
    include: {
      audience: { include: { class: true } },
      student: { include: { profile: true } },
      revision: { include: { assignment: { include: { reviewGrants: true } }, questions: { orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }] } } },
      answers: { include: { attempts: { orderBy: { attemptNumber: 'desc' }, take: 1 } } },
    },
  });
  const question = submission?.revision?.questions?.find((row: any) => row.id === input.questionId);
  const answer = submission?.answers?.find((row: any) => row.assignmentQuestionId === input.questionId);
  const attempt = answer?.attempts?.[0];
  if (!submission || submission.revision.assignmentId !== input.assignmentId || !question || !answer || !attempt) {
    throw new Error('manual-grading-submission-not-ready');
  }
  if (!['SUBMITTED', 'IN_PROGRESS'].includes(submission.state) || now <= new Date(submission.frozenAudienceDueAt)) throw new Error('manual-grading-before-deadline');
  if (submission.audience?.class?.isActive !== true) throw new Error('manual-grading-class-unavailable');
  await assertPipelineActorScope({
    db: input.db,
    actor: input.actor,
    assignmentRevisionId: submission.assignmentRevisionId,
    classId: submission.frozenAudienceClassId,
    classTeacherId: submission.audience.class.teacherId,
    ownerStudentId: submission.frozenStudentId,
    requestedStudentId: submission.frozenStudentId,
    purpose: 'teacher-review',
    now,
  });
  const evidence = await input.db.answerEvidence.findFirst({ where: { attemptId: attempt.id }, orderBy: { version: 'desc' } });
  await ensureManualAssignmentGradingSnapshot({
    db: input.db,
    assignmentId: input.assignmentId,
    actor: input.actor,
    submission,
    questions: submission.revision.questions,
    now,
  });
  const frozenQuestion = questionContractFromRow(question);
  const dedupeKey = `manual-grading:${attempt.id}:${input.idempotencyKey}`;
  let run = await input.db.gradingRun.findUnique({ where: { dedupeKey } });
  if (!run) {
    const inputHash = sha256(stableStringify({ attemptId: attempt.id, answerVersion: attempt.answerVersion, question: frozenQuestion }));
    const assessments = frozenQuestion.rubric.criteria.map((criterion: any) => ({
      criterionId: criterion.id,
      levelId: criterion.detailedRubricEnabled
        ? [...criterion.levels].sort((left: any, right: any) => left.maxPoints - right.maxPoints)[0]?.id ?? null
        : null,
      score: 0,
      rationale: '待教师人工评分',
      confidence: 1,
      limitationState: 'none',
      createdAt: now,
      updatedAt: now,
    }));
    run = await input.db.gradingRun.create({
      data: {
        id: `manual-grading-run:${sha256(dedupeKey).slice(-32)}`,
        answerAttemptId: attempt.id,
        ...(evidence?.readiness === 'READY' ? { answerEvidenceId: evidence.id } : {}),
        questionId: question.id,
        idempotencyKey: input.idempotencyKey,
        dedupeKey,
        inputHash,
        questionSnapshotHash: frozenQuestion.contentHash,
        rubricId: frozenQuestion.rubric.id,
        rubricVersion: frozenQuestion.rubric.version,
        evaluatorId: 'manual-teacher',
        evaluatorVersion: 'manual.v1',
        questionSnapshot: frozenQuestion,
        rubricSnapshot: frozenQuestion.rubric,
        referenceAnswer: frozenQuestion.referenceAnswer,
        source: 'MANUAL',
        state: 'AWAITING_REVIEW',
        assessments: { create: assessments },
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  const review = await createTeacherAssignmentReview(input.db, {
    actor: input.actor,
    assignmentId: input.assignmentId,
    submissionId: input.submissionId,
    gradingRunId: run.id,
    now,
  });
  resolveTeacherAssignmentReviewAuthorization({ actor: input.actor, review: review.review, now });
  return { run, review: review.review, replay: review.replay };
}

async function ensureManualAssignmentGradingSnapshot(input: {
  db: GradingDb;
  assignmentId: string;
  actor: { id: string; role: 'TEACHER' | 'ADMIN' };
  submission: any;
  questions: any[];
  now: Date;
}) {
  const provisionalSnapshot = assignmentSubmissionSnapshotData({ operationId: 'manual-assignment-grading-operation', source: 'MANUAL', submission: input.submission, questions: input.questions, now: input.now });
  const operationId = `manual-assignment-grading-operation:${sha256(`${input.actor.id}:${input.submission.id}:${provisionalSnapshot.attemptVectorHash}`).slice(-32)}`;
  const snapshot = assignmentSubmissionSnapshotData({ operationId, source: 'MANUAL', submission: input.submission, questions: input.questions, now: input.now });
  const existing = await input.db.assignmentSubmissionSnapshot?.findUnique?.({
    where: { id: snapshot.id },
  });
  if (existing) return existing;
  const idempotencyKey = `manual-vector:${input.submission.id}:${snapshot.attemptVectorHash}`;
  const requestHash = sha256(stableStringify({ assignmentId: input.assignmentId, submissionId: input.submission.id, attemptVectorHash: snapshot.attemptVectorHash }));
  try {
    const operation = await input.db.assignmentGradingOperation.create({
      data: {
        id: operationId,
        assignmentId: input.assignmentId,
        assignmentRevisionId: input.submission.assignmentRevisionId,
        requesterUserId: input.actor.id,
        idempotencyKey,
        requestHash,
        dedupeKey: `manual-assignment-grading:${input.actor.id}:${input.submission.id}:${snapshot.attemptVectorHash}`,
        selectionSnapshot: { version: 'assignment-manual-grading.v1', submissionId: input.submission.id, attemptVectorHash: snapshot.attemptVectorHash, requestedAt: input.now.toISOString() },
        state: 'SUCCEEDED',
        completedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
        snapshots: { create: snapshot },
      },
      include: { snapshots: true },
    });
    return operation.snapshots[0];
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const concurrent = await input.db.assignmentSubmissionSnapshot?.findUnique?.({
      where: { id: snapshot.id },
    });
    if (concurrent) return concurrent;
    throw new Error('assignment-grading-operation-conflict');
  }
}
