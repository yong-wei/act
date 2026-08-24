import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { AssignmentDomainError, createQuestionSnapshot, signCatalogSelectionIdentity, stableHash } from '../assignments/assignment-domain';
import { buildRubricBackedSubjectiveAssignmentFixture } from '../assignments/assignment-fixtures';
import { assignmentPublicationIdempotencyKey, createAssignmentDraft, createNextDraftRevision, deleteDraftRevision, publishAssignmentRevision, updateAssignmentDraft } from '../assignments/assignment-service';

process.env.NEXTAUTH_SECRET ??= 'assignment-test-lineage-secret';

function questionRow(points = 20, rubricPoints = 20, legacy = false) {
  const fixture = createQuestionSnapshot(buildRubricBackedSubjectiveAssignmentFixture().questions[0]);
  const criterion = fixture.rubric.criteria[0];
  return {
    id: 'question-1', assignmentRevisionId: 'revision-1', stableQuestionId: fixture.stableQuestionId,
    orderIndex: 0, responseType: fixture.responseType, points,
    promptSnapshot: { text: fixture.prompt }, answerSnapshot: { text: fixture.referenceAnswer },
    rubricSnapshot: legacy
      ? { ...fixture.rubric, criteria: [{ ...criterion, maxPoints: rubricPoints, levels: [{ id: 'valid', label: '有效', minPoints: 0, maxPoints: rubricPoints, description: '可复核。' }] }] }
      : {
          schemaVersion: 'assignment-scoring-rubric.v2',
          criteria: [{
            id: criterion.id,
            label: criterion.label,
            goalDimension: 'engineeringDecision',
            maxPoints: rubricPoints,
            scoringStandard: criterion.evidenceDescription,
            detailedRubricEnabled: false,
            evidenceDescription: criterion.evidenceDescription,
            feedbackGuidance: criterion.feedbackGuidance,
            studentVisibleGuidance: criterion.studentVisibleGuidance,
            levels: [],
          }],
        },
    sourceFamily: 'MANUAL', sourceId: null, sourceVersion: null,
    sourceHash: stableHash(fixture.source), sourceReviewState: 'author-owned', sourceLineage: { marker: 'assignment-authoring' },
    contentHash: fixture.contentHash,
  };
}

function dbWithTransaction(tx: Record<string, unknown>) {
  const client = {
    assignmentContentAsset: {
      findMany: vi.fn(async () => []),
    },
    assignmentRevisionAssetReference: {
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    ...tx,
  };
  return { $transaction: vi.fn(async (callback: (value: typeof client) => unknown) => callback(client)) } as never;
}

const lineageSecret = process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret';
function derivativeSource(proof = true) {
  const identity = { parentSourceId: 'source-1', parentSourceVersion: 'v1', parentSourceHash: `sha256:${'a'.repeat(64)}`, catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:control-correction-checkpoint-01', originalSourceFamily: 'checkpoint-authored-question', reviewState: 'path-eligible', eligibilityState: 'path-eligible', allowedStages: ['checkpoint', 'low-stakes-practice'], limitations: [] };
  return { family: 'ASSIGNMENT_DERIVATIVE' as const, ...identity, selectionProof: proof ? signCatalogSelectionIdentity(identity, lineageSecret) : `hmac-sha256:${'0'.repeat(64)}`, contentHash: `sha256:${'b'.repeat(64)}`, authoringMarker: 'assignment-authoring' as const };
}

describe('assignment authoring persistence service', () => {
  it('uses restrictive foreign keys so assignment history cannot cascade away', () => {
    const migration = readFileSync(join(process.cwd(), 'prisma/migrations/20260711090000_establish_assignment_authoring_domain/migration.sql'), 'utf8');
    const assignmentForeignKeys = migration.split('\n').filter((line) => line.includes('Assignment') && line.includes('FOREIGN KEY'));
    expect(assignmentForeignKeys.length).toBeGreaterThanOrEqual(10);
    expect(assignmentForeignKeys.every((line) => line.includes('ON DELETE RESTRICT'))).toBe(true);
  });

  it('rejects an optimistic concurrency conflict before replacing question snapshots', async () => {
    const tx = {
      assignment: { findUnique: vi.fn(async () => ({ authorId: 'teacher-1', archivedAt: null })) },
      assignmentRevision: {
        findUnique: vi.fn(async () => ({ id: 'revision-1', assignmentId: 'assignment-1', state: 'DRAFT', frozenAt: null })),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      assignmentQuestion: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    await expect(updateAssignmentDraft(dbWithTransaction(tx), {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', revisionId: 'revision-1', expectedVersion: 7,
      draft: buildRubricBackedSubjectiveAssignmentFixture(),
    })).rejects.toMatchObject({ code: 'version-conflict' });
    expect(tx.assignmentQuestion.deleteMany).not.toHaveBeenCalled();
  });

  it('round-trips every rubric criterion instead of collapsing to the first one', async () => {
    const tx = {
      assignment: { findUnique: vi.fn(async () => ({ authorId: 'teacher-1', archivedAt: null })) },
      assignmentRevision: {
        findUnique: vi.fn(async () => ({ id: 'revision-1', assignmentId: 'assignment-1', state: 'DRAFT', frozenAt: null })),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUniqueOrThrow: vi.fn(async () => ({ id: 'revision-1', version: 2 })),
      },
      assignmentQuestion: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    await updateAssignmentDraft(dbWithTransaction(tx), { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', revisionId: 'revision-1', expectedVersion: 1, draft: buildRubricBackedSubjectiveAssignmentFixture() });
    const rows = tx.assignmentQuestion.createMany.mock.calls[0]?.[0]?.data as Array<{ rubricSnapshot: { criteria: unknown[] } }>;
    expect(rows[0].rubricSnapshot.criteria).toHaveLength(2);
  });

  it('round-trips an incomplete bounded draft through optimistic update', async () => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    const incomplete = {
      ...fixture,
      title: '',
      totalPoints: 0,
      questions: [{
        ...fixture.questions[0],
        points: 0,
        prompt: '',
        referenceAnswer: '',
        rubric: {
          schemaVersion: 'assignment-scoring-rubric.v2' as const,
          criteria: [{
            id: 'criterion:stable',
            label: '',
            maxPoints: 0,
            scoringStandard: '',
            detailedRubricEnabled: true,
            levels: [{
              id: 'level:stable',
              label: '',
              maxPoints: 0,
              guideline: '',
            }],
          }],
        },
      }],
    };
    const tx = {
      assignment: { findUnique: vi.fn(async () => ({ authorId: 'teacher-1', archivedAt: null })) },
      assignmentRevision: {
        findUnique: vi.fn(async () => ({ id: 'revision-1', assignmentId: 'assignment-1', state: 'DRAFT', frozenAt: null })),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUniqueOrThrow: vi.fn(async () => ({ id: 'revision-1', title: '', totalPoints: 0 })),
      },
      assignmentQuestion: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    await expect(updateAssignmentDraft(dbWithTransaction(tx), {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: 'assignment-1',
      revisionId: 'revision-1',
      expectedVersion: 1,
      draft: incomplete,
    })).resolves.toMatchObject({ title: '', totalPoints: 0 });
    expect(tx.assignmentQuestion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        stableQuestionId: fixture.questions[0].stableQuestionId,
        points: 0,
        promptSnapshot: { text: '' },
        answerSnapshot: { text: '' },
      })],
    });
  });

  it('rejects mutation of a frozen published revision', async () => {
    const tx = {
      assignment: { findUnique: vi.fn(async () => ({ authorId: 'teacher-1', archivedAt: null })) },
      assignmentRevision: { findUnique: vi.fn(async () => ({ id: 'revision-1', assignmentId: 'assignment-1', state: 'PUBLISHED', frozenAt: new Date() })) },
    };
    await expect(updateAssignmentDraft(dbWithTransaction(tx), {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', revisionId: 'revision-1', expectedVersion: 1,
      draft: buildRubricBackedSubjectiveAssignmentFixture(),
    })).rejects.toMatchObject({ code: 'published-revision-immutable' });
  });

  it('blocks 10/20/25 publication conflicts without creating audiences or freezing the revision', async () => {
    const tx = publicationTx({ totalPoints: 10, questionPoints: 20, rubricPoints: 25 });
    await expect(publishAssignmentRevision(dbWithTransaction(tx), publicationInput())).rejects.toMatchObject({
      code: 'publication-blocked',
      details: expect.arrayContaining(['assignment-total-mismatch:10:20', 'question-rubric-total-mismatch:control-correction-analysis:20:25']),
    });
    expect(tx.assignmentRevision.updateMany).not.toHaveBeenCalled();
    expect(tx.assignmentAudience.createMany).not.toHaveBeenCalled();
  });

  it('blocks administrators from publishing to inactive classes', async () => {
    const tx = publicationTx({ totalPoints: 20, questionPoints: 20, rubricPoints: 20 });
    tx.class.findMany.mockResolvedValueOnce([]);
    await expect(publishAssignmentRevision(dbWithTransaction(tx), {
      ...publicationInput(),
      actor: { id: 'admin-1', role: 'ADMIN' },
    })).rejects.toMatchObject({
      code: 'publication-blocked',
      details: ['unauthorized-audience:class-1'],
    });
    expect(tx.class.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['class-1'] }, isActive: true },
      select: { id: true },
    });
    expect(tx.assignmentAudience.createMany).not.toHaveBeenCalled();
  });

  it('freezes a valid revision transactionally and replays the same idempotency key without duplicate writes', async () => {
    const tx = publicationTx({ totalPoints: 20, questionPoints: 20, rubricPoints: 20 });
    await publishAssignmentRevision(dbWithTransaction(tx), publicationInput());
    expect(tx.assignmentRevision.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'PUBLISHED' }) }));
    expect(tx.assignmentAudience.createMany).toHaveBeenCalledTimes(1);
    expect(tx.assignmentPublicationOperation.create).toHaveBeenCalledTimes(1);

    const operation = (tx.assignmentPublicationOperation.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.data as Record<string, unknown>;
    tx.assignmentPublicationOperation.findUnique.mockImplementation(async () => ({ ...operation }));
    await publishAssignmentRevision(dbWithTransaction(tx), publicationInput());
    expect(tx.assignmentAudience.createMany).toHaveBeenCalledTimes(1);
  });

  it('returns the committed publication after a concurrent unique race', async () => {
    const tx = publicationTx({ totalPoints: 20, questionPoints: 20, rubricPoints: 20 });
    await publishAssignmentRevision(dbWithTransaction(tx), publicationInput());
    const operation = (tx.assignmentPublicationOperation.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.data;
    const race = new Prisma.PrismaClientKnownRequestError('publication race', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const db = {
      $transaction: vi.fn(async () => { throw race; }),
      assignmentPublicationOperation: { findUnique: vi.fn(async () => operation) },
      assignmentRevision: {
        findUniqueOrThrow: vi.fn(async () => ({ id: 'revision-1', audiences: [], questions: [] })),
      },
    } as never;

    await expect(publishAssignmentRevision(db, publicationInput())).resolves.toMatchObject({
      idempotentReplay: true,
      publication: { assignmentId: 'assignment-1', publishedRevisionId: 'revision-1' },
    });
  });

  it('rejects a stale or forged saved-content digest before freezing', async () => {
    const tx = publicationTx({ totalPoints: 20, questionPoints: 20, rubricPoints: 20 });
    const input = publicationInput();
    await expect(publishAssignmentRevision(dbWithTransaction(tx), {
      ...input,
      contentDigest: `sha256:${'f'.repeat(64)}`,
    })).rejects.toMatchObject({ code: 'publication-content-digest-mismatch' });
    expect(tx.assignmentRevision.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a second publication shape for an already published baseline', async () => {
    const tx = publicationTx({ totalPoints: 20, questionPoints: 20, rubricPoints: 20 });
    tx.assignmentPublicationOperation.findUnique.mockImplementation(async () => ({ requestHash: 'sha256:different', revisionId: 'revision-1' }));
    await expect(publishAssignmentRevision(dbWithTransaction(tx), publicationInput())).rejects.toEqual(new AssignmentDomainError('publication-baseline-already-published'));
  });

  it('returns the existing next draft instead of duplicating a revision', async () => {
    const existing = {
      id: 'revision-2',
      assignmentId: 'assignment-1',
      state: 'DRAFT',
      revisionNumber: 2,
      questions: [],
    };
    const tx = {
      assignment: { findUnique: vi.fn(async () => ({ authorId: 'teacher-1', archivedAt: null })) },
      assignmentRevision: { findFirst: vi.fn(async () => existing), create: vi.fn() },
    };
    await expect(createNextDraftRevision(dbWithTransaction(tx), { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1' })).resolves.toBe(existing);
    expect(tx.assignmentRevision.create).not.toHaveBeenCalled();
  });

  it('migrates an existing v1 draft in place before returning it for editing', async () => {
    const existing = {
      id: 'revision-2',
      assignmentId: 'assignment-1',
      state: 'DRAFT',
      revisionNumber: 2,
      version: 3,
      title: '控制系统校正分析作业',
      instructions: '依据给定系统参数说明校正目标、设计依据和验证过程。',
      totalPoints: 20,
      latePolicy: { version: 1, mode: 'CLOSED' },
      responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] },
      resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
      solutionReleasePolicy: { version: 1, mode: 'PRIVATE' },
      questions: [questionRow(20, 20, true)],
    };
    const migrated = { ...existing, version: 4, questions: [] };
    const tx = {
      assignment: { findUnique: vi.fn(async () => ({ authorId: 'teacher-1', archivedAt: null })) },
      assignmentRevision: {
        findFirst: vi.fn(async () => existing),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUniqueOrThrow: vi.fn(async () => migrated),
        create: vi.fn(),
      },
      assignmentQuestion: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    };

    await expect(createNextDraftRevision(dbWithTransaction(tx), {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: 'assignment-1',
    })).resolves.toBe(migrated);

    const rows = tx.assignmentQuestion.createMany.mock.calls[0][0].data;
    expect(rows[0].rubricSnapshot.schemaVersion).toBe('assignment-scoring-rubric.v2');
    expect(tx.assignmentRevision.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'revision-2', version: 3 }),
      data: expect.objectContaining({ version: { increment: 1 } }),
    }));
    expect(tx.assignmentRevision.create).not.toHaveBeenCalled();
  });

  it('creates a v2 next draft while preserving the published v1 snapshot', async () => {
    const publishedQuestion = questionRow(20, 20, true);
    const latest = {
      id: 'revision-1',
      assignmentId: 'assignment-1',
      state: 'PUBLISHED',
      revisionNumber: 1,
      title: '控制系统校正分析作业',
      instructions: '依据给定系统参数说明校正目标、设计依据和验证过程。',
      totalPoints: 20,
      latePolicy: { version: 1, mode: 'CLOSED' },
      responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] },
      resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
      solutionReleasePolicy: { version: 1, mode: 'PRIVATE' },
      questions: [publishedQuestion],
    };
    const tx = {
      assignment: { findUnique: vi.fn(async () => ({ authorId: 'teacher-1', archivedAt: null })) },
      assignmentRevision: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(latest),
        create: vi.fn(async (input) => ({ id: 'revision-2', ...input.data })),
      },
      assignmentRevisionAssetReference: {
        findMany: vi.fn(async () => [{
          assetId: 'asset-published',
          stableQuestionId: 'control-correction-analysis',
          field: 'PROMPT',
        }]),
        createMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    await createNextDraftRevision(dbWithTransaction(tx), {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: 'assignment-1',
    });
    const created = tx.assignmentRevision.create.mock.calls[0][0].data;
    expect(created.questions.create[0].rubricSnapshot.schemaVersion).toBe('assignment-scoring-rubric.v2');
    expect(publishedQuestion.rubricSnapshot.schemaVersion).toBe('assignment-analytic-rubric.v1');
    expect(tx.assignmentRevisionAssetReference.createMany).toHaveBeenCalledWith({
      data: [{
        revisionId: 'revision-2',
        assetId: 'asset-published',
        stableQuestionId: 'control-correction-analysis',
        field: 'PROMPT',
      }],
    });
  });

  it('returns one fully included draft to two concurrent callers after a unique race', async () => {
    const existing = { id: 'revision-2', assignmentId: 'assignment-1', state: 'DRAFT', revisionNumber: 2, questions: [{ id: 'question-2', orderIndex: 0 }] };
    const race = new Prisma.PrismaClientKnownRequestError('unique race', { code: 'P2002', clientVersion: 'test' });
    const db = {
      $transaction: vi.fn(async () => { throw race; }),
      assignmentRevision: { findFirst: vi.fn(async () => existing) },
    } as never;
    const input = { actor: { id: 'teacher-1', role: 'TEACHER' as const }, assignmentId: 'assignment-1' };
    const [left, right] = await Promise.all([createNextDraftRevision(db, input), createNextDraftRevision(db, input)]);
    expect(left).toEqual(existing);
    expect(right).toEqual(existing);
    expect(left.questions).toEqual(right.questions);
    expect((db as { assignmentRevision: { findFirst: ReturnType<typeof vi.fn> } }).assignmentRevision.findFirst).toHaveBeenCalledWith(expect.objectContaining({ include: { questions: { orderBy: { orderIndex: 'asc' } } } }));
  });

  it('deletes only draft references and leaves shared published asset blobs intact', async () => {
    const tx = {
      assignment: { findUnique: vi.fn(async () => ({ authorId: 'teacher-1', archivedAt: null })) },
      assignmentRevision: {
        findUnique: vi.fn(async () => ({
          id: 'revision-draft',
          assignmentId: 'assignment-1',
          state: 'DRAFT',
          version: 2,
          audiences: [],
          historicalOwnerships: [],
        })),
        delete: vi.fn(async () => ({})),
      },
      assignmentRevisionAssetReference: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
      assignmentQuestion: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      assignmentContentAsset: { deleteMany: vi.fn() },
    };
    await deleteDraftRevision(dbWithTransaction(tx), {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: 'assignment-1',
      revisionId: 'revision-draft',
      expectedVersion: 2,
    });
    expect(tx.assignmentRevisionAssetReference.deleteMany).toHaveBeenCalledWith({
      where: { revisionId: 'revision-draft' },
    });
    expect(tx.assignmentContentAsset.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects forged parent lineage on an assignment-owned catalog derivative', async () => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    fixture.questions[0] = { ...fixture.questions[0], source: derivativeSource(false) };
    const tx = { adaptiveAssessmentItemRef: { findMany: vi.fn(async () => [{ id: 'source-1', contentHash: 'c'.repeat(64), algorithmVersion: 'v1' }]) }, assignment: { create: vi.fn() } };
    await expect(createAssignmentDraft(dbWithTransaction(tx), { actor: { id: 'teacher-1', role: 'TEACHER' }, draft: fixture })).rejects.toMatchObject({ code: 'governed-source-mismatch' });
    expect(tx.assignment.create).not.toHaveBeenCalled();
  });

  it('recomputes an edited derivative hash server-side while preserving verified parent lineage', async () => {
    const fixture = buildRubricBackedSubjectiveAssignmentFixture();
    fixture.questions[0] = { ...fixture.questions[0], prompt: '教师编辑后的完整题面。', source: derivativeSource() };
    const tx = {
      adaptiveAssessmentItemRef: { findMany: vi.fn(async () => [{ id: 'source-1', contentHash: 'a'.repeat(64), algorithmVersion: 'v1' }]) },
      assignment: { create: vi.fn(async (input) => ({ id: 'assignment-1', input })) },
    };
    await createAssignmentDraft(dbWithTransaction(tx), { actor: { id: 'teacher-1', role: 'TEACHER' }, draft: fixture });
    const created = tx.assignment.create.mock.calls[0]?.[0]?.data.revisions.create.questions.create[0];
    expect(created.sourceFamily).toBe('ASSIGNMENT_DERIVATIVE');
    expect(created.sourceHash).not.toBe(`sha256:${'b'.repeat(64)}`);
    expect(created).toMatchObject({ sourceCatalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:control-correction-checkpoint-01', sourceOriginalFamily: 'checkpoint-authored-question', sourceReviewState: 'path-eligible' });
    expect(created.sourceLineage).toMatchObject({ parentSourceId: 'source-1', parentSourceHash: `sha256:${'a'.repeat(64)}`, originalSourceFamily: 'checkpoint-authored-question', eligibilityState: 'path-eligible', limitations: [] });
  });

  it('rejects a new publication that uses a historical time-based release policy', async () => {
    const tx = publicationTx({ totalPoints: 20, questionPoints: 20, rubricPoints: 20 });
    tx.assignmentRevision.findUnique.mockResolvedValueOnce({
      ...(await tx.assignmentRevision.findUnique()),
      solutionReleasePolicy: { version: 1, mode: 'AT_TIME', releaseAt: '2026-07-12T00:00:00Z', audienceClassIds: ['class-other'], includeReferenceAnswer: true, includeStudentVisibleGuidance: true },
    } as never);
    await expect(publishAssignmentRevision(dbWithTransaction(tx), publicationInput())).rejects.toMatchObject({
      code: 'publication-blocked', details: ['assignment-solution-release-policy-invalid:teacher-confirmed-result-required'],
    });
  });

  it('rejects a new publication that keeps answers private', async () => {
    const tx = publicationTx({ totalPoints: 20, questionPoints: 20, rubricPoints: 20 });
    tx.assignmentRevision.findUnique.mockResolvedValueOnce({
      ...(await tx.assignmentRevision.findUnique()),
      solutionReleasePolicy: { version: 1, mode: 'PRIVATE' },
    } as never);
    await expect(publishAssignmentRevision(dbWithTransaction(tx), publicationInput())).rejects.toMatchObject({
      code: 'publication-blocked', details: ['assignment-solution-release-policy-invalid:teacher-confirmed-result-required'],
    });
  });
});

function publicationInput() {
  const input = {
    actor: { id: 'teacher-1', role: 'TEACHER' as const }, assignmentId: 'assignment-1', revisionId: 'revision-1', expectedVersion: 1,
    contentDigest: publicationContentDigest(),
    idempotencyKey: '', now: new Date('2026-07-11T00:00:00Z'),
    audiences: [{ classId: 'class-1', availableAt: '2026-07-12T00:00:00Z', dueAt: '2026-07-13T00:00:00Z' }],
  };
  return { ...input, idempotencyKey: assignmentPublicationIdempotencyKey(input) };
}

function publicationTx(input: { totalPoints: number; questionPoints: number; rubricPoints: number }) {
  const row = questionRow(input.questionPoints, input.rubricPoints);
  return {
    assignment: {
      findUnique: vi.fn(async () => ({ authorId: 'teacher-1', archivedAt: null })),
      update: vi.fn(async () => ({})),
    },
    assignmentRevision: {
      findUnique: vi.fn(async () => ({
        id: 'revision-1', assignmentId: 'assignment-1', state: 'DRAFT', frozenAt: null, version: 1,
        contentHash: publicationContentDigest(),
        title: '作业', instructions: '', totalPoints: input.totalPoints, solutionReleasePolicy: { version: 1, mode: 'TEACHER_CONFIRMED_RESULT' }, questions: [row],
        latePolicy: { version: 1, mode: 'CLOSED' }, responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] },
        resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async () => ({ id: 'revision-1', audiences: [], questions: [row] })),
    },
    assignmentPublicationOperation: {
      findUnique: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
      create: vi.fn(async () => ({})),
    },
    assignmentAudience: { createMany: vi.fn(async () => ({ count: 1 })) },
    class: { findMany: vi.fn(async () => [{ id: 'class-1' }]) },
  };
}

function publicationContentDigest() {
  const row = questionRow(20, 20);
  return stableHash({
    title: '作业',
    instructions: '',
    totalPoints: 20,
    solutionReleasePolicy: { version: 1, mode: 'TEACHER_CONFIRMED_RESULT' },
    latePolicy: { version: 1, mode: 'CLOSED' },
    responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] },
    resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
    questions: [{
      stableQuestionId: row.stableQuestionId,
      responseType: row.responseType,
      points: row.points,
      prompt: (row.promptSnapshot as { text: string }).text,
      referenceAnswer: (row.answerSnapshot as { text: string }).text,
      rubric: row.rubricSnapshot,
      source: { family: 'MANUAL', authoringMarker: 'assignment-authoring' },
    }],
  });
}
