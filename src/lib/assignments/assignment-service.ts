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
import { migrateLegacyAssignmentDraftToRubricV2 } from './assignment-rubric-migration';

type AssignmentDb = PrismaClient;
type Actor = { id: string; role: 'TEACHER' | 'ADMIN' };

export async function listTeacherAssignments(db: AssignmentDb, actor: Actor, now = new Date()) {
  const assignments = await db.assignment.findMany({
    where: actor.role === 'ADMIN' ? {} : {
      OR: [
        { authorId: actor.id },
        { reviewGrants: { some: { teacherId: actor.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } },
        { revisions: { some: { submissions: { some: { audience: { archivedAt: null, class: { teacherId: actor.id, isActive: true } } } } } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      reviewGrants: true,
      revisions: {
        orderBy: { revisionNumber: 'desc' },
        take: 1,
        include: {
          audiences: {
            select: {
              classId: true,
              availableAt: true,
              dueAt: true,
              class: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (assignments.length === 0) return [];

  const submissions = await db.assignmentSubmission.findMany({
    where: { revision: { assignmentId: { in: assignments.map((assignment) => assignment.id) } } },
    include: {
      revision: { select: { assignmentId: true } },
      audience: { include: { class: { select: { id: true, teacherId: true, isActive: true } } } },
      student: { include: { profile: { select: { classId: true } } } },
      answers: {
        include: {
          attempts: {
            include: {
              gradingRuns: {
                include: {
                  teacherAssignmentReview: { select: { id: true, state: true } },
                  approvalSnapshot: { select: { id: true } },
                  question: { select: { orderIndex: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
  });

  return assignments.map((assignment) => {
    const assignmentWide = actor.role === 'ADMIN'
      || assignment.authorId === actor.id
      || assignment.reviewGrants.some((grant) => grant.teacherId === actor.id
        && grant.revokedAt == null && (grant.expiresAt == null || grant.expiresAt > now));
    const visibleSubmissions = submissions.filter((submission) => {
      if (submission.revision.assignmentId !== assignment.id
        || submission.studentId !== submission.frozenStudentId
        || submission.audience.classId !== submission.frozenAudienceClassId) return false;
      if (assignmentWide) return true;
      return submission.audience.archivedAt == null
        && submission.audience.class.isActive
        && submission.audience.class.teacherId === actor.id
        && submission.student.profile?.classId === submission.frozenAudienceClassId;
    });
    const reviewItems = visibleSubmissions.flatMap((submission) => latestReviewRuns(submission).map((run) => ({ submission, run })));
    const pending = reviewItems.filter(({ run }) => run.teacherAssignmentReview?.state === 'WORKING'
      || (run.state === 'AWAITING_REVIEW' && run.teacherReviewedAt == null && !run.approvalSnapshot && !run.teacherAssignmentReview));
    const reviewedCount = reviewItems.filter(({ run }) => Boolean(run.approvalSnapshot) || run.state === 'APPROVED').length;
    const next = pending.sort((left, right) => {
      const submissionOrder = new Date(left.submission.updatedAt).getTime() - new Date(right.submission.updatedAt).getTime()
        || String(left.submission.id).localeCompare(String(right.submission.id));
      return submissionOrder || Number(left.run.question?.orderIndex ?? 0) - Number(right.run.question?.orderIndex ?? 0)
        || String(left.run.questionId).localeCompare(String(right.run.questionId));
    })[0];
    const { reviewGrants: _reviewGrants, ...publicAssignment } = assignment;
    return {
      ...publicAssignment,
      reviewSummary: {
        submissionCount: visibleSubmissions.length,
        pendingReviewCount: pending.length,
        reviewedCount,
        nextReview: next ? {
          submissionId: next.submission.id,
          questionId: next.run.questionId,
          reviewId: next.run.teacherAssignmentReview?.id ?? null,
          gradingRunId: next.run.id,
        } : null,
      },
    };
  });
}

function latestReviewRuns(submission: any) {
  const byQuestion = new Map<string, any>();
  for (const run of submission.answers.flatMap((answer: any) => answer.attempts.flatMap((attempt: any) => attempt.gradingRuns))) {
    const current = byQuestion.get(run.questionId);
    if (!current || new Date(run.updatedAt ?? run.createdAt).getTime() > new Date(current.updatedAt ?? current.createdAt).getTime()
      || (new Date(run.updatedAt ?? run.createdAt).getTime() === new Date(current.updatedAt ?? current.createdAt).getTime()
        && String(run.id).localeCompare(String(current.id)) > 0)) byQuestion.set(run.questionId, run);
  }
  return [...byQuestion.values()];
}

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
        if (existingDraft) {
          const hasLegacyRubric = existingDraft.questions.some((question) =>
            (question.rubricSnapshot as { schemaVersion?: unknown } | null)?.schemaVersion === 'assignment-analytic-rubric.v1'
          );
          if (!hasLegacyRubric) return existingDraft;
          const legacyDraft = assignmentDraftSchema.parse({
            title: existingDraft.title,
            instructions: existingDraft.instructions,
            totalPoints: Number(existingDraft.totalPoints),
            questions: existingDraft.questions.map((question) => questionFromRow(question as unknown as Record<string, unknown>)),
            latePolicy: existingDraft.latePolicy,
            responsePolicy: existingDraft.responsePolicy,
            resubmissionPolicy: existingDraft.resubmissionPolicy,
            solutionReleasePolicy: existingDraft.solutionReleasePolicy,
          });
          const migratedDraft = requireMigratedDraft(legacyDraft);
          const migratedSnapshots = migratedQuestionSnapshots(migratedDraft);
          const updated = await tx.assignmentRevision.updateMany({
            where: {
              id: existingDraft.id,
              assignmentId: input.assignmentId,
              state: 'DRAFT',
              version: existingDraft.version,
            },
            data: {
              title: migratedDraft.title,
              instructions: migratedDraft.instructions,
              totalPoints: migratedDraft.totalPoints,
              latePolicy: migratedDraft.latePolicy,
              responsePolicy: migratedDraft.responsePolicy,
              resubmissionPolicy: migratedDraft.resubmissionPolicy,
              solutionReleasePolicy: migratedDraft.solutionReleasePolicy,
              contentHash: stableHash(draftWithSnapshots(migratedDraft, migratedSnapshots)),
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) throw new AssignmentDomainError('version-conflict');
          await tx.assignmentQuestion.deleteMany({ where: { assignmentRevisionId: existingDraft.id } });
          await tx.assignmentQuestion.createMany({
            data: migratedSnapshots.map((question, index) =>
              questionCreateManyData(existingDraft.id, question, index)
            ),
          });
          return tx.assignmentRevision.findUniqueOrThrow({
            where: { id: existingDraft.id },
            include: { questions: { orderBy: { orderIndex: 'asc' } } },
          });
        }
        const latest = await tx.assignmentRevision.findFirst({
      where: { assignmentId: input.assignmentId, state: 'PUBLISHED' },
      orderBy: { revisionNumber: 'desc' },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
        });
        if (!latest) throw new AssignmentDomainError('published-revision-not-found');
        const legacyDraft = assignmentDraftSchema.parse({
          title: latest.title,
          instructions: latest.instructions,
          totalPoints: Number(latest.totalPoints),
          questions: latest.questions.map((question) => questionFromRow(question as unknown as Record<string, unknown>)),
          latePolicy: latest.latePolicy,
          responsePolicy: latest.responsePolicy,
          resubmissionPolicy: latest.resubmissionPolicy,
          solutionReleasePolicy: latest.solutionReleasePolicy,
        });
        const nextDraft = requireMigratedDraft(legacyDraft);
        const nextSnapshots = migratedQuestionSnapshots(nextDraft);
        return tx.assignmentRevision.create({
      data: {
        assignmentId: input.assignmentId,
        ...revisionCreateData(nextDraft, nextSnapshots, latest.revisionNumber + 1),
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

function requireMigratedDraft(legacyDraft: AssignmentDraftInput): AssignmentDraftInput {
  const result = assignmentDraftSchema.safeParse(
    migrateLegacyAssignmentDraftToRubricV2(legacyDraft),
  );
  if (!result.success) {
    throw new AssignmentDomainError(
      'legacy-rubric-v2-migration-required',
      result.error.issues.map((issue) => `${issue.path.join('.')}:${issue.message}`),
    );
  }
  return result.data;
}

function migratedQuestionSnapshots(draft: AssignmentDraftInput): AssignmentQuestionSnapshot[] {
  return draft.questions.map((question) => {
    if (question.source.family !== 'ASSIGNMENT_DERIVATIVE') return createQuestionSnapshot(question);
    const contentHash = stableHash({
      responseType: question.responseType,
      points: question.points,
      prompt: question.prompt,
      referenceAnswer: question.referenceAnswer,
      rubric: question.rubric,
    });
    return createQuestionSnapshot({
      ...question,
      source: { ...question.source, contentHash },
    });
  });
}

export async function publishAssignmentRevision(db: AssignmentDb, input: {
  actor: Actor;
  assignmentId: string;
  revisionId: string;
  expectedVersion: number;
  contentDigest: string;
  idempotencyKey: string;
  audiences: AssignmentAudienceInput[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.idempotencyKey !== assignmentPublicationIdempotencyKey(input)) {
    throw new AssignmentDomainError('invalid-publication-idempotency-key');
  }
  const requestHash = stableHash({
    assignmentId: input.assignmentId,
    revisionId: input.revisionId,
    expectedVersion: input.expectedVersion,
    contentDigest: input.contentDigest,
    audiences: input.audiences,
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await assertAssignmentOwner(tx, input.assignmentId, input.actor);
        const baselineReplay = await tx.assignmentPublicationOperation.findUnique({
          where: { revisionId: input.revisionId },
        });
        if (baselineReplay) {
          if (baselineReplay.requestHash !== requestHash) {
            throw new AssignmentDomainError('publication-baseline-already-published');
          }
          return publicationCompletion(tx, input.assignmentId, baselineReplay.revisionId, true);
        }
        const keyReplay = await tx.assignmentPublicationOperation.findUnique({
          where: { assignmentId_idempotencyKey: { assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey } },
        });
        if (keyReplay) {
          if (keyReplay.requestHash !== requestHash) throw new AssignmentDomainError('idempotency-key-reused');
          return publicationCompletion(tx, input.assignmentId, keyReplay.revisionId, true);
        }
        const revision = await tx.assignmentRevision.findUnique({
          where: { id: input.revisionId },
          include: { questions: { orderBy: { orderIndex: 'asc' } } },
        });
        if (!revision || revision.assignmentId !== input.assignmentId) throw new AssignmentDomainError('draft-not-found');
        if (revision.state !== 'DRAFT' || revision.frozenAt) throw new AssignmentDomainError('published-revision-immutable');
        if (revision.version !== input.expectedVersion) throw new AssignmentDomainError('version-conflict');
        if (!revision.contentHash || revision.contentHash !== input.contentDigest) {
          throw new AssignmentDomainError('publication-content-digest-mismatch');
        }
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
        if (draft.questions.some((question) =>
          question.rubric.schemaVersion !== 'assignment-scoring-rubric.v2'
        )) {
          issues.push('legacy-rubric-v2-migration-required');
        }
        for (const question of draft.questions) {
          if (question.rubric.schemaVersion !== 'assignment-scoring-rubric.v2') continue;
          for (const criterion of question.rubric.criteria) {
            if (!criterion.goalDimension) {
              issues.push(`rubric-goal-dimension-required:${question.stableQuestionId}:${criterion.id}`);
            }
          }
        }
        if (draft.solutionReleasePolicy.mode === 'AT_TIME') {
          const publicationAudienceIds = new Set(input.audiences.map((audience) => audience.classId));
          for (const classId of draft.solutionReleasePolicy.audienceClassIds) {
            if (!publicationAudienceIds.has(classId)) issues.push(`solution-release-audience-not-published:${classId}`);
          }
        }
        if (draft.questions.length === 0) issues.push('assignment-has-no-questions');
        const managedClasses = await tx.class.findMany({
          where: input.actor.role === 'ADMIN' ? { id: { in: input.audiences.map((item) => item.classId) }, isActive: true } : {
            id: { in: input.audiences.map((item) => item.classId) }, teacherId: input.actor.id, isActive: true,
          },
          select: { id: true },
        });
        const managedIds = new Set(managedClasses.map((item) => item.id));
        for (const audience of input.audiences) if (!managedIds.has(audience.classId)) issues.push(`unauthorized-audience:${audience.classId}`);
        if (issues.length) throw new AssignmentDomainError('publication-blocked', issues);
        if (stableHash(draft) !== input.contentDigest) {
          throw new AssignmentDomainError('publication-content-digest-mismatch');
        }
        const frozen = await tx.assignmentRevision.updateMany({
          where: {
            id: input.revisionId,
            assignmentId: input.assignmentId,
            state: 'DRAFT',
            frozenAt: null,
            version: input.expectedVersion,
            contentHash: input.contentDigest,
          },
          data: { state: 'PUBLISHED', frozenAt: now, publishedAt: now, version: { increment: 1 } },
        });
        if (frozen.count !== 1) throw new AssignmentDomainError('version-conflict');
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
        return publicationCompletion(tx, input.assignmentId, input.revisionId, false);
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isRecoverablePublicationRace(error)) throw error;
      const replay = await db.assignmentPublicationOperation.findUnique({
        where: { revisionId: input.revisionId },
      });
      if (replay) {
        if (replay.requestHash !== requestHash) {
          throw new AssignmentDomainError('publication-baseline-already-published');
        }
        return publicationCompletion(db, input.assignmentId, replay.revisionId, true);
      }
      if (attempt === 2) throw new AssignmentDomainError('publication-conflict-retryable');
    }
  }
  throw new AssignmentDomainError('publication-conflict-retryable');
}

export function assignmentPublicationIdempotencyKey(input: {
  assignmentId: string;
  revisionId: string;
  expectedVersion: number;
}) {
  return `assignment-ui:${input.assignmentId}:${input.revisionId}:${input.expectedVersion}`;
}

function isRecoverablePublicationRace(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034');
}

async function publicationCompletion(
  db: Pick<AssignmentDb, 'assignmentRevision'>,
  assignmentId: string,
  revisionId: string,
  idempotentReplay: boolean,
) {
  const revision = await db.assignmentRevision.findUniqueOrThrow({
    where: { id: revisionId },
    include: {
      audiences: {
        include: { class: { select: { id: true, name: true } } },
      },
      questions: true,
    },
  });
  return {
    revision,
    publication: {
      assignmentId,
      publishedRevisionId: revision.id,
      location: { assignmentId },
      classes: revision.audiences.map((audience) => ({
        id: audience.class.id,
        name: audience.class.name,
      })),
    },
    idempotentReplay,
  };
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
