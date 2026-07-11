import { Prisma, type PrismaClient } from '@prisma/client';

import {
  AssignmentDomainError,
  assignmentDraftSchema,
  createQuestionSnapshot,
  stableHash,
  verifyCatalogSelectionIdentity,
  validatePublicationSchedule,
  validatePublicationScores,
  type AssignmentAudienceInput,
  type AssignmentDraftInput,
  type AssignmentQuestionSnapshot,
} from './assignment-domain';

type AssignmentDb = PrismaClient;
type Actor = { id: string; role: 'TEACHER' | 'ADMIN' };

export async function createAssignmentDraft(db: AssignmentDb, input: {
  actor: Actor;
  courseContext?: string;
  draft: AssignmentDraftInput;
}) {
  const draft = assignmentDraftSchema.parse(input.draft);
  return db.$transaction(async (tx) => {
    const snapshots = await createServerQuestionSnapshots(tx, draft.questions);
    const assignment = await tx.assignment.create({
      data: {
        authorId: input.actor.id,
        courseContext: input.courseContext,
        revisions: {
          create: revisionCreateData(draft, snapshots, 1),
        },
      },
      include: { revisions: { include: { questions: { orderBy: { orderIndex: 'asc' } } } } },
    });
    return assignment;
  });
}

export async function updateAssignmentDraft(db: AssignmentDb, input: {
  actor: Actor;
  assignmentId: string;
  revisionId: string;
  expectedVersion: number;
  draft: AssignmentDraftInput;
}) {
  const draft = assignmentDraftSchema.parse(input.draft);
  return db.$transaction(async (tx) => {
    await assertAssignmentOwner(tx, input.assignmentId, input.actor);
    const snapshots = await createServerQuestionSnapshots(tx, draft.questions);
    const revision = await tx.assignmentRevision.findUnique({ where: { id: input.revisionId } });
    if (!revision || revision.assignmentId !== input.assignmentId) throw new AssignmentDomainError('draft-not-found');
    if (revision.state !== 'DRAFT' || revision.frozenAt) throw new AssignmentDomainError('published-revision-immutable');
    const updated = await tx.assignmentRevision.updateMany({
      where: { id: input.revisionId, assignmentId: input.assignmentId, state: 'DRAFT', version: input.expectedVersion },
      data: {
        title: draft.title,
        instructions: draft.instructions,
        totalPoints: draft.totalPoints,
        latePolicy: draft.latePolicy,
        responsePolicy: draft.responsePolicy,
        resubmissionPolicy: draft.resubmissionPolicy,
        solutionReleasePolicy: draft.solutionReleasePolicy,
        contentHash: stableHash(draftWithSnapshots(draft, snapshots)),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new AssignmentDomainError('version-conflict');
    await tx.assignmentQuestion.deleteMany({ where: { assignmentRevisionId: input.revisionId } });
    await tx.assignmentQuestion.createMany({ data: snapshots.map((question, index) => questionCreateManyData(input.revisionId, question, index)) });
    return tx.assignmentRevision.findUniqueOrThrow({
      where: { id: input.revisionId },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });
  });
}

export async function deleteDraftRevision(db: AssignmentDb, input: {
  actor: Actor;
  assignmentId: string;
  revisionId: string;
  expectedVersion: number;
}) {
  return db.$transaction(async (tx) => {
    await assertAssignmentOwner(tx, input.assignmentId, input.actor);
    const revision = await tx.assignmentRevision.findUnique({
      where: { id: input.revisionId },
      include: { audiences: { select: { id: true } }, historicalOwnerships: { select: { id: true } } },
    });
    if (!revision || revision.assignmentId !== input.assignmentId) throw new AssignmentDomainError('draft-not-found');
    if (revision.state !== 'DRAFT' || revision.version !== input.expectedVersion || revision.audiences.length || revision.historicalOwnerships.length) {
      throw new AssignmentDomainError('draft-delete-restricted');
    }
    await tx.assignmentQuestion.deleteMany({ where: { assignmentRevisionId: input.revisionId } });
    await tx.assignmentRevision.delete({ where: { id: input.revisionId } });
  });
}

export async function createNextDraftRevision(db: AssignmentDb, input: {
  actor: Actor;
  assignmentId: string;
}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await assertAssignmentOwner(tx, input.assignmentId, input.actor);
        const existingDraft = await tx.assignmentRevision.findFirst({ where: { assignmentId: input.assignmentId, state: 'DRAFT' }, include: { questions: { orderBy: { orderIndex: 'asc' } } } });
        if (existingDraft) return existingDraft;
        const latest = await tx.assignmentRevision.findFirst({
      where: { assignmentId: input.assignmentId, state: 'PUBLISHED' },
      orderBy: { revisionNumber: 'desc' },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
        });
        if (!latest) throw new AssignmentDomainError('published-revision-not-found');
        return tx.assignmentRevision.create({
      data: {
        assignmentId: input.assignmentId,
        revisionNumber: latest.revisionNumber + 1,
        title: latest.title,
        instructions: latest.instructions,
        totalPoints: latest.totalPoints,
        latePolicy: latest.latePolicy ?? {},
        responsePolicy: latest.responsePolicy ?? {},
        resubmissionPolicy: latest.resubmissionPolicy ?? {},
        solutionReleasePolicy: latest.solutionReleasePolicy ?? {},
        contentHash: latest.contentHash,
        questions: {
          create: latest.questions.map((question) => ({
            stableQuestionId: question.stableQuestionId,
            orderIndex: question.orderIndex,
            responseType: question.responseType,
            points: question.points,
            promptSnapshot: question.promptSnapshot as Prisma.InputJsonValue,
            answerSnapshot: question.answerSnapshot as Prisma.InputJsonValue,
            rubricSnapshot: question.rubricSnapshot as Prisma.InputJsonValue,
            sourceFamily: question.sourceFamily,
            sourceId: question.sourceId,
            sourceVersion: question.sourceVersion,
            sourceHash: question.sourceHash,
            sourceReviewState: question.sourceReviewState,
            sourceCatalogItemId: question.sourceCatalogItemId,
            sourceOriginalFamily: question.sourceOriginalFamily,
            sourceSelectionProof: question.sourceSelectionProof,
            sourceLineage: question.sourceLineage as Prisma.InputJsonValue,
            contentHash: question.contentHash,
          })),
        },
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
        });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isRecoverableNextDraftRace(error)) throw error;
      const existing = await db.assignmentRevision.findFirst({ where: { assignmentId: input.assignmentId, state: 'DRAFT' }, include: { questions: { orderBy: { orderIndex: 'asc' } } } });
      if (existing) return existing;
      if (attempt === 1) throw new AssignmentDomainError('next-draft-conflict-retryable');
    }
  }
  throw new AssignmentDomainError('next-draft-conflict-retryable');
}

function isRecoverableNextDraftRace(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034');
}

export async function publishAssignmentRevision(db: AssignmentDb, input: {
  actor: Actor;
  assignmentId: string;
  revisionId: string;
  expectedVersion: number;
  idempotencyKey: string;
  audiences: AssignmentAudienceInput[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const requestHash = stableHash({
    assignmentId: input.assignmentId,
    revisionId: input.revisionId,
    expectedVersion: input.expectedVersion,
    audiences: input.audiences,
  });
  return db.$transaction(async (tx) => {
    await assertAssignmentOwner(tx, input.assignmentId, input.actor);
    const replay = await tx.assignmentPublicationOperation.findUnique({
      where: { assignmentId_idempotencyKey: { assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey } },
    });
    if (replay) {
      if (replay.requestHash !== requestHash) throw new AssignmentDomainError('idempotency-key-reused');
      return tx.assignmentRevision.findUniqueOrThrow({ where: { id: replay.revisionId }, include: { audiences: true, questions: true } });
    }
    const revision = await tx.assignmentRevision.findUnique({
      where: { id: input.revisionId },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!revision || revision.assignmentId !== input.assignmentId) throw new AssignmentDomainError('draft-not-found');
    if (revision.state !== 'DRAFT' || revision.frozenAt) throw new AssignmentDomainError('published-revision-immutable');
    if (revision.version !== input.expectedVersion) throw new AssignmentDomainError('version-conflict');
    const draft = assignmentDraftSchema.parse({
      title: revision.title,
      instructions: revision.instructions,
      totalPoints: Number(revision.totalPoints),
      latePolicy: revision.latePolicy,
      responsePolicy: revision.responsePolicy,
      resubmissionPolicy: revision.resubmissionPolicy,
      solutionReleasePolicy: revision.solutionReleasePolicy,
      questions: revision.questions.map(questionFromRow),
    });
    const issues = [...validatePublicationScores(draft), ...validatePublicationSchedule(input.audiences, now)];
    if (draft.solutionReleasePolicy.mode === 'AT_TIME') {
      const publicationAudienceIds = new Set(input.audiences.map((audience) => audience.classId));
      for (const classId of draft.solutionReleasePolicy.audienceClassIds) {
        if (!publicationAudienceIds.has(classId)) issues.push(`solution-release-audience-not-published:${classId}`);
      }
    }
    if (draft.questions.length === 0) issues.push('assignment-has-no-questions');
    const managedClasses = await tx.class.findMany({
      where: input.actor.role === 'ADMIN' ? { id: { in: input.audiences.map((item) => item.classId) } } : {
        id: { in: input.audiences.map((item) => item.classId) }, teacherId: input.actor.id, isActive: true,
      },
      select: { id: true },
    });
    const managedIds = new Set(managedClasses.map((item) => item.id));
    for (const audience of input.audiences) if (!managedIds.has(audience.classId)) issues.push(`unauthorized-audience:${audience.classId}`);
    if (issues.length) throw new AssignmentDomainError('publication-blocked', issues);
    const contentHash = stableHash(draft);
    await tx.assignmentRevision.update({
      where: { id: input.revisionId },
      data: { state: 'PUBLISHED', frozenAt: now, publishedAt: now, contentHash, version: { increment: 1 } },
    });
    await tx.assignmentAudience.createMany({ data: input.audiences.map((audience) => ({
      assignmentRevisionId: input.revisionId,
      classId: audience.classId,
      availableAt: new Date(audience.availableAt),
      dueAt: new Date(audience.dueAt),
      policySnapshot: {
        latePolicy: draft.latePolicy,
        responsePolicy: draft.responsePolicy,
        resubmissionPolicy: draft.resubmissionPolicy,
        solutionReleasePolicy: draft.solutionReleasePolicy,
      },
    })) });
    await tx.assignment.update({ where: { id: input.assignmentId }, data: { state: 'PUBLISHED' } });
    await tx.assignmentPublicationOperation.create({ data: {
      assignmentId: input.assignmentId,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      revisionId: input.revisionId,
    } });
    return tx.assignmentRevision.findUniqueOrThrow({ where: { id: input.revisionId }, include: { audiences: true, questions: true } });
  }, { isolationLevel: 'Serializable' });
}

async function assertAssignmentOwner(tx: Omit<AssignmentDb, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>, assignmentId: string, actor: Actor) {
  const assignment = await tx.assignment.findUnique({ where: { id: assignmentId }, select: { authorId: true, archivedAt: true } });
  if (!assignment) throw new AssignmentDomainError('assignment-not-found');
  if (actor.role !== 'ADMIN' && assignment.authorId !== actor.id) throw new AssignmentDomainError('assignment-forbidden');
  if (assignment.archivedAt) throw new AssignmentDomainError('assignment-archived');
}

async function createServerQuestionSnapshots(
  tx: Omit<AssignmentDb, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  questions: readonly AssignmentDraftInput['questions'][number][],
): Promise<AssignmentQuestionSnapshot[]> {
  const directCatalog = questions.filter((question) => question.source.family === 'ADAPTIVE_ASSESSMENT_CATALOG');
  if (directCatalog.length) throw new AssignmentDomainError('direct-catalog-snapshot-not-accepted', directCatalog.map((question) => question.stableQuestionId));
  const derivatives = questions.filter((question) => question.source.family === 'ASSIGNMENT_DERIVATIVE');
  const refs = derivatives.length ? await tx.adaptiveAssessmentItemRef.findMany({
    where: { id: { in: derivatives.map((question) => question.source.family === 'ASSIGNMENT_DERIVATIVE' ? question.source.parentSourceId : '') } },
    select: { id: true, contentHash: true, algorithmVersion: true },
  }) : [];
  const byId = new Map(refs.map((ref) => [ref.id, ref]));
  return questions.map((question) => {
    if (question.source.family !== 'ASSIGNMENT_DERIVATIVE') return createQuestionSnapshot(question);
    const ref = byId.get(question.source.parentSourceId);
    const canonicalParentHash = ref?.contentHash.startsWith('sha256:') ? ref.contentHash : ref ? `sha256:${ref.contentHash}` : null;
    const identity = { parentSourceId: question.source.parentSourceId, parentSourceVersion: question.source.parentSourceVersion, parentSourceHash: question.source.parentSourceHash, catalogItemId: question.source.catalogItemId, originalSourceFamily: question.source.originalSourceFamily, reviewState: question.source.reviewState, eligibilityState: question.source.eligibilityState, allowedStages: [...question.source.allowedStages], limitations: [...question.source.limitations] };
    const secret = process.env.ASSIGNMENT_CATALOG_LINEAGE_SECRET ?? process.env.NEXTAUTH_SECRET;
    const eligible = question.source.reviewState === 'path-eligible'
      && question.source.eligibilityState === 'path-eligible'
      && question.source.allowedStages.includes('low-stakes-practice')
      && question.source.limitations.length === 0;
    if (!ref || canonicalParentHash !== question.source.parentSourceHash || ref.algorithmVersion !== question.source.parentSourceVersion || !secret || !verifyCatalogSelectionIdentity(identity, question.source.selectionProof, secret) || !eligible) {
      throw new AssignmentDomainError('governed-source-mismatch', [question.stableQuestionId, question.source.parentSourceId]);
    }
    const derivativeHash = stableHash({ responseType: question.responseType, points: question.points, prompt: question.prompt, referenceAnswer: question.referenceAnswer, rubric: question.rubric });
    return createQuestionSnapshot({ ...question, source: { ...question.source, contentHash: derivativeHash } });
  });
}

function revisionCreateData(draft: AssignmentDraftInput, snapshots: AssignmentQuestionSnapshot[], revisionNumber: number) {
  return {
    revisionNumber,
    title: draft.title,
    instructions: draft.instructions,
    totalPoints: draft.totalPoints,
    latePolicy: draft.latePolicy,
    responsePolicy: draft.responsePolicy,
    resubmissionPolicy: draft.resubmissionPolicy,
    solutionReleasePolicy: draft.solutionReleasePolicy,
    contentHash: stableHash(draftWithSnapshots(draft, snapshots)),
    questions: { create: snapshots.map((question, index) => questionCreateData(undefined, question, index)) },
  };
}

function draftWithSnapshots(draft: AssignmentDraftInput, snapshots: AssignmentQuestionSnapshot[]): AssignmentDraftInput {
  return { ...draft, questions: snapshots.map(({ contentHash: _contentHash, ...question }) => question) };
}

function questionCreateData(revisionId: string | undefined, question: AssignmentQuestionSnapshot, orderIndex: number) {
  return {
    ...(revisionId ? { assignmentRevisionId: revisionId } : {}),
    stableQuestionId: question.stableQuestionId,
    orderIndex,
    responseType: question.responseType,
    points: question.points,
    promptSnapshot: { text: question.prompt },
    answerSnapshot: { text: question.referenceAnswer },
    rubricSnapshot: question.rubric,
    sourceFamily: question.source.family,
    sourceId: question.source.family === 'ADAPTIVE_ASSESSMENT_CATALOG' ? question.source.sourceId : question.source.family === 'ASSIGNMENT_DERIVATIVE' ? question.source.parentSourceId : null,
    sourceVersion: question.source.family === 'ADAPTIVE_ASSESSMENT_CATALOG' ? question.source.sourceVersion : question.source.family === 'ASSIGNMENT_DERIVATIVE' ? question.source.parentSourceVersion : null,
    sourceHash: question.source.family === 'ADAPTIVE_ASSESSMENT_CATALOG' ? question.source.sourceHash : question.source.family === 'ASSIGNMENT_DERIVATIVE' ? question.source.contentHash : stableHash(question.source),
    sourceReviewState: question.source.family === 'ADAPTIVE_ASSESSMENT_CATALOG' || question.source.family === 'ASSIGNMENT_DERIVATIVE' ? question.source.reviewState : 'author-owned',
    sourceCatalogItemId: question.source.family === 'ASSIGNMENT_DERIVATIVE' ? question.source.catalogItemId : null,
    sourceOriginalFamily: question.source.family === 'ASSIGNMENT_DERIVATIVE' ? question.source.originalSourceFamily : null,
    sourceSelectionProof: question.source.family === 'ASSIGNMENT_DERIVATIVE' ? question.source.selectionProof : null,
    sourceLineage: question.source.family === 'ADAPTIVE_ASSESSMENT_CATALOG' ? question.source.lineage : question.source.family === 'ASSIGNMENT_DERIVATIVE' ? { marker: question.source.authoringMarker, parentSourceId: question.source.parentSourceId, parentSourceVersion: question.source.parentSourceVersion, parentSourceHash: question.source.parentSourceHash, catalogItemId: question.source.catalogItemId, originalSourceFamily: question.source.originalSourceFamily, reviewState: question.source.reviewState, eligibilityState: question.source.eligibilityState, allowedStages: question.source.allowedStages, limitations: question.source.limitations } : { marker: question.source.authoringMarker },
    contentHash: question.contentHash,
  };
}

function questionCreateManyData(revisionId: string, question: AssignmentQuestionSnapshot, orderIndex: number) {
  return { ...questionCreateData(revisionId, question, orderIndex), assignmentRevisionId: revisionId };
}

function questionFromRow(row: Record<string, unknown>) {
  const prompt = row.promptSnapshot as { text?: unknown };
  const answer = row.answerSnapshot as { text?: unknown };
  const sourceFamily = row.sourceFamily;
  const lineage = row.sourceLineage as Record<string, unknown> | null;
  return {
    stableQuestionId: row.stableQuestionId,
    responseType: row.responseType,
    points: Number(row.points),
    prompt: prompt.text,
    referenceAnswer: answer.text,
    rubric: row.rubricSnapshot,
    source: sourceFamily === 'ADAPTIVE_ASSESSMENT_CATALOG' ? {
      family: sourceFamily,
      sourceId: row.sourceId,
      sourceVersion: row.sourceVersion,
      sourceHash: row.sourceHash,
      reviewState: row.sourceReviewState,
      lineage: row.sourceLineage,
    } : sourceFamily === 'ASSIGNMENT_DERIVATIVE' ? {
      family: sourceFamily,
      parentSourceId: lineage?.parentSourceId,
      parentSourceVersion: lineage?.parentSourceVersion,
      parentSourceHash: lineage?.parentSourceHash,
      catalogItemId: row.sourceCatalogItemId,
      originalSourceFamily: row.sourceOriginalFamily,
      reviewState: row.sourceReviewState,
      eligibilityState: lineage?.eligibilityState,
      allowedStages: lineage?.allowedStages,
      limitations: lineage?.limitations,
      selectionProof: row.sourceSelectionProof,
      contentHash: row.sourceHash,
      authoringMarker: 'assignment-authoring',
    } : { family: 'MANUAL', authoringMarker: 'assignment-authoring' },
  };
}
