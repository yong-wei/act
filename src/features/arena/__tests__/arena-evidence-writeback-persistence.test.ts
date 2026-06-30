import { describe, expect, it, vi } from 'vitest';

import {
  persistArenaSubmissionEvidenceWriteback,
  readArenaSubmissionEvidenceWritebacks,
} from '../evidence-writeback-persistence';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';

function submission(overrides: Partial<ArenaSubmissionRecord> = {}): ArenaSubmissionRecord {
  const artifact = {
    id: 'artifact-arena-writeback',
    taskId: 'task-second-order-lead-pid',
    method: 'pid' as const,
    params: { kp: 2.4, ki: 0.8, kd: 0.35 },
    createdAt: '2026-05-16T08:00:00.000Z',
  };
  return {
    id: 'submission-arena-writeback',
    taskId: 'task-second-order-lead-pid',
    userId: 'student-a',
    classId: 'class-a',
    publicationId: 'publication-a',
    studentLabel: '学生甲',
    artifactHash: 'artifact-hash-arena-writeback',
    artifact,
    evaluation: {
      taskId: 'task-second-order-lead-pid',
      artifact,
      valid: true,
      score: 88,
      metrics: { settlingTime: 2.8 },
      satisfaction: { settlingTime: 0.86 },
      hardConstraintResults: [{ id: 'closed_loop_stable', label: '闭环稳定', passed: true }],
      penalties: [],
      explanation: ['官方评测完成'],
    },
    submittedAt: '2026-05-16T08:20:00.000Z',
    reusedEvaluation: false,
    ...overrides,
  };
}

function createMockDb() {
  return {
    learningFact: {
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    evidenceOutbox: {
      upsert: vi.fn(async ({ create }: any) => ({
        id: 'outbox-arena-writeback',
        ...create,
        createdAt: new Date('2026-05-16T08:20:00.000Z'),
        updatedAt: new Date('2026-05-16T08:20:00.000Z'),
      })),
      findMany: vi.fn(async () => []),
    },
  };
}

describe('Arena evidence writeback persistence', () => {
  it('materializes accepted official submissions as idempotent LearningFacts and shared outbox outcomes', async () => {
    const db = createMockDb();

    const outcome = await persistArenaSubmissionEvidenceWriteback(db, submission());

    expect(outcome.evidenceWriteback).toMatchObject({
      status: 'accepted',
      sourceRef: { kind: 'ArenaSubmission', id: 'submission-arena-writeback' },
      visibilityState: 'materialized',
      terminalValidationAccepted: true,
    });
    expect(outcome.learningFactCreated).toBe(true);
    expect(db.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          userId: 'student-a',
          factType: 'design',
          moduleId: 'task-second-order-lead-pid',
          sourceEventId: expect.stringMatching(/^arena-official:.*submission-arena-writeback/),
          sourceLogId: 'submission-arena-writeback',
          outcome: 'success',
          score: 88,
        }),
      ],
    }));
    expect(db.evidenceOutbox.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        dedupeKey: expect.stringMatching(/^arena-official:.*submission-arena-writeback/),
      },
      create: expect.objectContaining({
        eventType: 'arena.kaq_evidence_writeback',
        causationId: 'submission-arena-writeback',
        ownerUserId: 'student-a',
        status: 'processed',
      }),
    }));
    expect(db.learningFact.createMany.mock.invocationCallOrder[0]).toBeLessThan(
      db.evidenceOutbox.upsert.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('records blocked attempts without creating positive mastery LearningFacts', async () => {
    const db = createMockDb();

    const outcome = await persistArenaSubmissionEvidenceWriteback(db, submission({
      id: 'submission-late',
      isLate: true,
      evaluation: {
        ...submission().evaluation,
        score: 92,
      },
    }));

    expect(outcome.evidenceWriteback).toMatchObject({
      status: 'blocked',
      attemptStatus: 'late',
      visibilityState: 'diagnostic-only',
      terminalValidationAccepted: false,
    });
    expect(outcome.learningFactCreated).toBe(false);
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
    expect(db.evidenceOutbox.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        eventType: 'arena.kaq_evidence_writeback',
        causationId: 'submission-late',
        ownerUserId: 'student-a',
        status: 'blocked',
      }),
    }));
  });

  it('treats duplicate-only evaluation reuse as blocked shared outcome without LearningFact materialization', async () => {
    const db = createMockDb();

    const outcome = await persistArenaSubmissionEvidenceWriteback(db, submission({
      id: 'submission-duplicate',
      reusedEvaluation: true,
    }));

    expect(outcome.evidenceWriteback).toMatchObject({
      status: 'blocked',
      attemptStatus: 'duplicate-only',
      visibilityState: 'diagnostic-only',
      terminalValidationAccepted: false,
    });
    expect(outcome.learningFactCreated).toBe(false);
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
    expect(db.evidenceOutbox.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        causationId: 'submission-duplicate',
        ownerUserId: 'student-a',
        status: 'blocked',
      }),
    }));
  });

  it('does not publish an accepted outbox outcome when LearningFact persistence fails', async () => {
    const db = createMockDb();
    db.learningFact.createMany.mockRejectedValueOnce(new Error('learning fact write failed'));

    await expect(persistArenaSubmissionEvidenceWriteback(db, submission())).rejects.toThrow('learning fact write failed');
    expect(db.evidenceOutbox.upsert).not.toHaveBeenCalled();
  });

  it('rejects accepted writeback when required persistence delegates are unavailable', async () => {
    const db = createMockDb();

    await expect(persistArenaSubmissionEvidenceWriteback({
      evidenceOutbox: db.evidenceOutbox,
    }, submission())).rejects.toThrow('LearningFact persistence');
    expect(db.evidenceOutbox.upsert).not.toHaveBeenCalled();
    await expect(persistArenaSubmissionEvidenceWriteback({
      learningFact: db.learningFact,
    }, submission())).rejects.toThrow('EvidenceOutbox persistence');
  });

  it('reads persisted writeback outcomes by Arena submission id for downstream consumers', async () => {
    const db = createMockDb();
    db.evidenceOutbox.findMany.mockResolvedValueOnce([
      {
        causationId: 'submission-a',
        status: 'processed',
        payload: {
          evidenceWriteback: {
            status: 'accepted',
            sourceRef: { kind: 'ArenaSubmission', id: 'submission-a' },
            attemptStatus: 'effective',
            visibilityState: 'materialized',
            targetLabel: '控制校正 Arena 官方迁移验证',
            summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
            recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
            limitationCodes: ['service-only-code'],
            overlayCount: 1,
            terminalValidationAccepted: true,
          },
        },
      },
    ]);

    const outcomes = await readArenaSubmissionEvidenceWritebacks(db, ['submission-a', 'submission-missing'], 'teacher');

    expect(db.evidenceOutbox.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        eventType: 'arena.kaq_evidence_writeback',
        causationId: { in: ['submission-a', 'submission-missing'] },
      }),
    }));
    expect(outcomes.get('submission-a')).toMatchObject({
      status: 'accepted',
      sourceRef: { kind: 'ArenaSubmission', id: 'submission-a' },
      limitationCodes: ['service-only-code'],
    });
    expect(outcomes.has('submission-missing')).toBe(false);
  });

  it('redacts student persisted projections while preserving the visible submission reference', async () => {
    const db = createMockDb();
    db.evidenceOutbox.findMany.mockResolvedValueOnce([
      {
        causationId: 'submission-a',
        status: 'processed',
        payload: {
          evidenceWriteback: {
            status: 'accepted',
            sourceRef: { kind: 'ArenaSubmission', id: 'submission-a' },
            attemptStatus: 'effective',
            visibilityState: 'materialized',
            targetLabel: '控制校正 Arena 官方迁移验证',
            summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
            recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
            limitationCodes: ['service-only-code'],
            overlayCount: 1,
            terminalValidationAccepted: true,
            projected: {
              status: 'accepted',
              overlayUpdates: [
                {
                  targetRef: { learningGoalId: 'control-correction' },
                  sourceId: 'submission-a',
                  sourceRef: { kind: 'ArenaSubmission', id: 'submission-a' },
                  citationRefs: [{ id: 'citation-a' }],
                  terminalValidationAccepted: true,
                },
              ],
              audit: {
                confidence: 0.88,
                limitationCodes: ['service-only-code'],
              },
            },
          },
        },
      },
    ]);

    const outcomes = await readArenaSubmissionEvidenceWritebacks(db, ['submission-a'], 'student');
    const studentProjection = outcomes.get('submission-a');

    expect(studentProjection).toMatchObject({
      status: 'accepted',
      sourceRef: { kind: 'ArenaSubmission', id: 'submission-a' },
      limitationCodes: [],
      projected: {
        audit: null,
        overlayUpdates: [
          expect.objectContaining({
            sourceId: null,
            sourceRef: null,
            citationRefs: null,
          }),
        ],
      },
    });
  });

  it('ignores accepted outbox payloads that are not marked processed', async () => {
    const db = createMockDb();
    db.evidenceOutbox.findMany.mockResolvedValueOnce([
      {
        causationId: 'submission-a',
        status: 'pending',
        payload: {
          evidenceWriteback: {
            status: 'accepted',
            sourceRef: { kind: 'ArenaSubmission', id: 'submission-a' },
            attemptStatus: 'effective',
            visibilityState: 'materialized',
            targetLabel: '控制校正 Arena 官方迁移验证',
            summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
            recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
            limitationCodes: [],
            overlayCount: 1,
            terminalValidationAccepted: true,
          },
        },
      },
    ]);

    const outcomes = await readArenaSubmissionEvidenceWritebacks(db, ['submission-a'], 'teacher');

    expect(outcomes.has('submission-a')).toBe(false);
  });
});
