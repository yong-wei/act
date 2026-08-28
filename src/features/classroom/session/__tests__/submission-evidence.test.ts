import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acceptClassifiedSubmissionCommand,
  persistSessionEndTransactionCommand,
} from '../adapters/submission-evidence-commands';
import {
  CLASSROOM_SUBMISSION_IDENTITY_VERSION,
  buildCanonicalSubmissionIdentity,
  createReadOnlySubmissionEvidencePort,
  type ClassifiedSubmissionWriteInput,
} from '../submission-evidence';
import { createReadOnlyClassroomStateRuntime } from '../application/state';
import type { ClassroomStateRuntime } from '../application/state';

function buildInput(overrides: Partial<ClassifiedSubmissionWriteInput> = {}): ClassifiedSubmissionWriteInput {
  return {
    userId: 'student-1',
    submissionIdentity: 'student-1|session-1|lesson-v1|step-08|card|attempt-1',
    identityVersion: CLASSROOM_SUBMISSION_IDENTITY_VERSION,
    sourceEvent: {
      resourceId: null,
      resourceKey: 'resource-key',
      sessionId: 'session-1',
      lessonKey: 'lesson-v1',
      stepId: 'step-08',
      actorRole: 'student',
      eventType: 'submit',
      clientEventId: 'client-event-1',
      learningContext: 'classroom_live',
      invalidContextReason: null,
      eventData: { eventType: 'lesson_submit', score: 100 },
      clientEventAt: new Date('2026-05-12T01:46:42.900Z'),
    },
    response: {
      lessonKey: 'lesson-v1',
      stepId: 'step-08',
      attemptKey: 'attempt-1',
      clientEventId: 'client-event-1',
      submittedAt: new Date('2026-05-12T01:46:42.900Z'),
      buildResponseData: (sourceLogId: string) => ({
        eventType: 'lesson_submit',
        score: 100,
        sourceLogId,
      }),
    },
    ...overrides,
  };
}

function createTx(sessionOverrides: Record<string, unknown> = {}) {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    classSession: {
      findUnique: vi.fn().mockResolvedValue({
        status: 'ACTIVE',
        submissionSequence: 2n,
        closureRevision: 0,
        acceptedSubmissionWatermark: null,
        ...sessionOverrides,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    interactionLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
    },
    studentStepResponse: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'resp-1',
        sourceLogId: 'log-1',
        submissionIdentity: data.submissionIdentity,
        identityVersion: data.identityVersion,
        submissionSequence: (data.submissionSequence as bigint | null) ?? null,
        evidenceStatus: data.evidenceStatus,
        session: { status: sessionOverrides.status ?? 'ACTIVE' },
      })),
    },
    sessionClosureOutbox: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return tx;
}

function createDb(tx: ReturnType<typeof createTx>) {
  return {
    ...tx,
    $transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(tx)),
  };
}

describe('buildCanonicalSubmissionIdentity', () => {
  it('derives a deterministic non-empty identity with a recorded normalization version', () => {
    const identity = buildCanonicalSubmissionIdentity({
      sessionId: 'session-1',
      userId: 'student-1',
      lessonKey: 'lesson-v1',
      stepId: 'step-08',
      cardId: 'card-1',
      attemptKey: 'attempt-1',
    });
    expect(identity).toEqual({
      identity: 'student-1|session-1|lesson-v1|step-08|card-1|attempt-1',
      identityVersion: 'classroom-submission-identity-v1',
    });
    const retried = buildCanonicalSubmissionIdentity({
      sessionId: ' session-1 ',
      userId: 'student-1',
      lessonKey: 'lesson-v1',
      stepId: 'step-08',
      cardId: 'card-1',
      clientEventId: 'attempt-1',
    });
    expect(retried?.identity).toBe(identity?.identity);
  });

  it('falls back to the client event identity and rejects inputs that cannot be classified', () => {
    expect(
      buildCanonicalSubmissionIdentity({
        sessionId: 'session-1',
        userId: 'student-1',
        stepId: 'step-08',
        clientEventId: 'client-1',
      })?.identity,
    ).toBe('student-1|session-1||step-08|step|client-1');
    expect(
      buildCanonicalSubmissionIdentity({
        sessionId: 'session-1',
        userId: 'student-1',
        stepId: 'step-08',
      }),
    ).toBeNull();
    expect(
      buildCanonicalSubmissionIdentity({
        sessionId: '',
        userId: 'student-1',
        stepId: 'step-08',
        attemptKey: 'attempt-1',
      }),
    ).toBeNull();
  });
});

describe('acceptClassifiedSubmissionCommand', () => {
  let tx: ReturnType<typeof createTx>;
  let db: ReturnType<typeof createDb>;

  beforeEach(() => {
    tx = createTx();
    db = createDb(tx);
  });

  it('accepts an ACTIVE submission with a monotonic sequence in one transaction', async () => {
    const receipt = await acceptClassifiedSubmissionCommand(db as never, buildInput());

    expect(receipt.status).toBe('ACCEPTED');
    expect(receipt.submissionSequence).toBe(3n);
    expect(receipt.evidenceStatus).toBe('ACCEPTED');
    expect(receipt.sourceLogId).toBe('log-1');
    // 会话锁与序列分配在同一事务内
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.classSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { submissionSequence: 3n },
    });
    expect(tx.interactionLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        submissionIdentity: 'student-1|session-1|lesson-v1|step-08|card|attempt-1',
        clientEventId: 'client-event-1',
      }),
    }));
    expect(tx.studentStepResponse.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        submissionSequence: 3n,
        evidenceStatus: 'ACCEPTED',
        sourceLogId: 'log-1',
      }),
    }));
  });

  it('retains a late submission as POST_SESSION_REVIEW without a sequence or watermark movement', async () => {
    tx.classSession.findUnique.mockResolvedValue({
      status: 'FINISHED',
      submissionSequence: 7n,
      closureRevision: 1,
      acceptedSubmissionWatermark: 7n,
    });

    const receipt = await acceptClassifiedSubmissionCommand(db as never, buildInput());

    expect(receipt.status).toBe('POST_SESSION_REVIEW');
    expect(receipt.evidenceStatus).toBe('POST_SESSION_REVIEW');
    expect(receipt.submissionSequence).toBeNull();
    expect(tx.classSession.update).not.toHaveBeenCalled();
    expect(tx.studentStepResponse.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        submissionSequence: null,
        evidenceStatus: 'POST_SESSION_REVIEW',
      }),
    }));
  });

  it('returns the original receipt for an idempotent retry of the same identity', async () => {
    tx.studentStepResponse.findFirst.mockResolvedValue({
      id: 'resp-original',
      sourceLogId: 'log-original',
      submissionIdentity: 'student-1|session-1|lesson-v1|step-08|card|attempt-1',
      identityVersion: CLASSROOM_SUBMISSION_IDENTITY_VERSION,
      submissionSequence: 1n,
      evidenceStatus: 'ACCEPTED',
      session: { status: 'ACTIVE' },
    });

    const receipt = await acceptClassifiedSubmissionCommand(db as never, buildInput());

    expect(receipt).toMatchObject({
      status: 'DUPLICATE',
      evidenceStatus: 'ACCEPTED',
      evidenceId: 'resp-original',
      sourceLogId: 'log-original',
      submissionSequence: 1n,
    });
    expect(tx.interactionLog.create).not.toHaveBeenCalled();
    expect(tx.studentStepResponse.create).not.toHaveBeenCalled();
    expect(tx.classSession.update).not.toHaveBeenCalled();
  });

  it('returns the durable receipt when a concurrent identical submission wins the unique constraint', async () => {
    const conflictError = new Prisma.PrismaClientKnownRequestError('unique constraint', {
      code: 'P2002',
      clientVersion: 'test',
    });
    tx.studentStepResponse.create.mockRejectedValueOnce(conflictError);
    // 事务回滚后从数据库重读赢家回执
    db.studentStepResponse.findFirst = tx.studentStepResponse.findFirst.mockResolvedValue({
      id: 'resp-winner',
      sourceLogId: 'log-winner',
      submissionIdentity: 'student-1|session-1|lesson-v1|step-08|card|attempt-1',
      identityVersion: CLASSROOM_SUBMISSION_IDENTITY_VERSION,
      submissionSequence: 3n,
      evidenceStatus: 'ACCEPTED',
      session: { status: 'ACTIVE' },
    });

    const receipt = await acceptClassifiedSubmissionCommand(db as never, buildInput());

    expect(receipt).toMatchObject({
      status: 'DUPLICATE',
      evidenceId: 'resp-winner',
      sourceLogId: 'log-winner',
    });
  });
});

describe('persistSessionEndTransactionCommand', () => {
  let tx: ReturnType<typeof createTx>;
  let db: ReturnType<typeof createDb>;

  beforeEach(() => {
    tx = createTx();
    db = createDb(tx);
  });

  it('locks the session, fixes the watermark, and stages exactly one closure outbox record', async () => {
    const endTime = new Date('2026-05-12T02:00:00.000Z');
    const outcome = await persistSessionEndTransactionCommand(db as never, {
      sessionId: 'session-1',
      endTime,
    });

    expect(outcome).toEqual({
      outcome: 'ended',
      closureRevision: 1,
      acceptedSubmissionWatermark: 2n,
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.classSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        status: 'FINISHED',
        endTime,
        acceptedSubmissionWatermark: 2n,
        closureRevision: 1,
      },
    });
    expect(tx.sessionClosureOutbox.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        closureRevision: 1,
        acceptedSubmissionWatermark: 2n,
      },
    });
  });

  it('is idempotent for a repeated end and never stages a second closure', async () => {
    tx.classSession.findUnique.mockResolvedValue({
      status: 'FINISHED',
      submissionSequence: 5n,
      closureRevision: 3,
      acceptedSubmissionWatermark: 5n,
    });

    const outcome = await persistSessionEndTransactionCommand(db as never, {
      sessionId: 'session-1',
      endTime: new Date('2026-05-12T02:00:00.000Z'),
    });

    expect(outcome).toEqual({
      outcome: 'already-ended',
      closureRevision: 3,
      acceptedSubmissionWatermark: 5n,
    });
    expect(tx.classSession.update).not.toHaveBeenCalled();
    expect(tx.sessionClosureOutbox.create).not.toHaveBeenCalled();
  });
});

describe('preview read-only contexts', () => {
  it('rejects submissions through the read-only evidence port with an observable reason', async () => {
    const port = createReadOnlySubmissionEvidencePort();
    await expect(port.acceptClassifiedSubmission(buildInput())).rejects.toMatchObject({
      code: 'preview-read-only',
    });
  });

  it('rejects live-state writes through the read-only classroom state runtime', async () => {
    const base = {
      upsertStudentState: vi.fn(),
    } as unknown as ClassroomStateRuntime & { upsertStudentState: ReturnType<typeof vi.fn> };
    const readOnly = createReadOnlyClassroomStateRuntime(base);

    await expect(readOnly.upsertStudentState({
      sessionId: 'session-1',
      userId: 'student-1',
      stateKey: 'course',
      lessonKey: null,
      itemId: null,
      data: {},
      lastClientEventAt: null,
    })).rejects.toMatchObject({ code: 'preview-read-only' });
    expect(base.upsertStudentState).not.toHaveBeenCalled();
  });
});
