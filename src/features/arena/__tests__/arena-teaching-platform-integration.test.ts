import { describe, expect, it, vi } from 'vitest';

import { buildArenaClassInsightAggregation } from '@/lib/data-governance/arena-insights';
import { eventToLearningFactInput } from '@/lib/data-governance/learning-fact-materialization';
import { buildOdysseyArenaArtifact, bridgeOdysseyRunToArenaSubmission } from '../odyssey/bridge';
import {
  buildArenaPublicationLeaderboardView,
  isArenaPublicationLate,
} from '../leaderboards/publication-leaderboard';
import {
  createArenaPublicationRecord,
  listArenaPublicationsForStudent,
  resolveAccessibleArenaPublicationForStudent,
  updateArenaPublicationStatus,
} from '../teacher/publication-store';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';

const future = '2026-06-01T15:00:00.000Z';
const past = '2026-05-01T15:00:00.000Z';

function createMockDb() {
  const classes = new Map<string, { id: string; teacherId: string }>([
    ['class-a', { id: 'class-a', teacherId: 'teacher-a' }],
    ['class-b', { id: 'class-b', teacherId: 'teacher-b' }],
  ]);
  const publications = new Map<string, any>();
  const profiles = new Map<string, { userId: string; classId: string | null }>([
    ['student-a', { userId: 'student-a', classId: 'class-a' }],
    ['student-b', { userId: 'student-b', classId: 'class-b' }],
  ]);

  return {
    class: {
      findUnique: vi.fn(async ({ where }: any) => classes.get(where.id) ?? null),
    },
    arenaChallengePublication: {
      create: vi.fn(async ({ data }: any) => {
        const id = data.id ?? `publication-${publications.size + 1}`;
        const record = {
          id,
          ...data,
          createdAt: new Date('2026-05-15T10:00:00.000Z'),
          updatedAt: new Date('2026-05-15T10:00:00.000Z'),
        };
        publications.set(id, record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }: any) => publications.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const current = publications.get(where.id);
        const next = { ...current, ...data, updatedAt: new Date('2026-05-15T10:05:00.000Z') };
        publications.set(where.id, next);
        return next;
      }),
    },
    studentProfile: {
      findUnique: vi.fn(async ({ where }: any) => profiles.get(where.userId) ?? null),
    },
  };
}

function submission(overrides: Partial<ArenaSubmissionRecord>): ArenaSubmissionRecord {
  return {
    id: 'submission-a',
    taskId: 'task-integrator-low-frequency-balance',
    userId: 'student-a',
    publicationId: 'publication-1',
    classId: 'class-a',
    seasonId: undefined,
    studentLabel: '学生甲',
    artifactHash: 'artifact-a',
    artifact: {
      id: 'artifact-a',
      taskId: 'task-integrator-low-frequency-balance',
      method: 'pid',
      params: { kp: 2, ki: 0.5, kd: 0.1 },
      createdAt: '2026-05-15T10:00:00.000Z',
    },
    evaluation: {
      taskId: 'task-integrator-low-frequency-balance',
      artifact: {
        id: 'artifact-a',
        taskId: 'task-integrator-low-frequency-balance',
        method: 'pid',
        params: { kp: 2, ki: 0.5, kd: 0.1 },
        createdAt: '2026-05-15T10:00:00.000Z',
      },
      valid: true,
      score: 88,
      metrics: { settlingTime: 2.6, overshoot: 8, steadyStateError: 0.02, controlEnergy: 6 },
      satisfaction: { settlingTime: 0.82, overshoot: 0.78, steadyStateError: 0.9, controlEnergy: 0.7 },
      hardConstraintResults: [{ id: 'closed_loop_stable', label: '闭环稳定', passed: true }],
      penalties: [],
      explanation: [],
    },
    submittedAt: '2026-05-15T10:00:00.000Z',
    reusedEvaluation: false,
    ...overrides,
  };
}

describe('arena teaching platform integration', () => {
  it('returns an empty student publication list when Arena publication tables have not been migrated yet', async () => {
    const db = {
      arenaChallengePublication: {
        findMany: vi.fn().mockRejectedValueOnce(Object.assign(new Error('missing ArenaChallengePublication table'), {
          code: 'P2021',
        })),
      },
      studentProfile: {
        findUnique: vi.fn(async () => ({ userId: 'student-a', classId: 'class-a' })),
      },
    };

    await expect(listArenaPublicationsForStudent(db as any, {
      studentId: 'student-a',
    })).resolves.toEqual([]);
  });

  it('persists publications only for the teacher owning the target class or an admin', async () => {
    const db = createMockDb();

    const publication = await createArenaPublicationRecord(db as any, {
      actor: { id: 'teacher-a', role: 'TEACHER' },
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-a',
      visibility: 'class',
      deadline: future,
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: true,
      gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
    });

    expect(publication).toMatchObject({
      id: 'publication-1',
      teacherId: 'teacher-a',
      classId: 'class-a',
      status: 'active',
      homeworkBinding: true,
    });
    await expect(createArenaPublicationRecord(db as any, {
      actor: { id: 'teacher-a', role: 'TEACHER' },
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-b',
      visibility: 'class',
      deadline: future,
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: false,
    })).rejects.toThrow(/not allowed/i);

    await expect(updateArenaPublicationStatus(db as any, {
      actor: { id: 'admin-1', role: 'ADMIN' },
      publicationId: publication.id,
      status: 'paused',
    })).resolves.toMatchObject({ status: 'paused' });

    await expect(createArenaPublicationRecord(db as any, {
      actor: { id: 'admin-1', role: 'ADMIN' },
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-b',
      visibility: 'class',
      deadline: future,
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: false,
    })).resolves.toMatchObject({
      teacherId: 'teacher-b',
      classId: 'class-b',
    });
  });

  it('resolves student access only for active visible publications and rejects other-class submissions', async () => {
    const db = createMockDb();
    const publication = await createArenaPublicationRecord(db as any, {
      actor: { id: 'teacher-a', role: 'TEACHER' },
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-a',
      visibility: 'class',
      deadline: future,
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: true,
    });

    await expect(resolveAccessibleArenaPublicationForStudent(db as any, {
      publicationId: publication.id,
      studentId: 'student-a',
      taskId: 'task-integrator-low-frequency-balance',
      now: new Date('2026-05-15T10:00:00.000Z'),
    })).resolves.toMatchObject({
      id: publication.id,
      classId: 'class-a',
      isLate: false,
    });
    await expect(resolveAccessibleArenaPublicationForStudent(db as any, {
      publicationId: publication.id,
      studentId: 'student-b',
      taskId: 'task-integrator-low-frequency-balance',
      now: new Date('2026-05-15T10:00:00.000Z'),
    })).rejects.toThrow(/not allowed/i);
  });

  it('scopes course-wide publication submissions to the submitting student class', async () => {
    const db = createMockDb();
    const publication = await createArenaPublicationRecord(db as any, {
      actor: { id: 'teacher-a', role: 'TEACHER' },
      taskId: 'task-second-order-lead-pid',
      classId: 'class-a',
      visibility: 'course',
      deadline: future,
      leaderboardPolicyId: 'leaderboard-whitebox-default',
      homeworkBinding: false,
    });

    await expect(resolveAccessibleArenaPublicationForStudent(db as any, {
      publicationId: publication.id,
      studentId: 'student-b',
      taskId: 'task-second-order-lead-pid',
      now: new Date('2026-05-15T10:00:00.000Z'),
    })).resolves.toMatchObject({
      id: publication.id,
      visibility: 'course',
      classId: 'class-b',
    });
  });

  it('filters publication leaderboard entries and hides class ranking before deadline', () => {
    const own = submission({ id: 'own', userId: 'student-a', publicationId: 'publication-1' });
    const other = submission({ id: 'other', userId: 'student-b', publicationId: 'publication-1', studentLabel: '学生乙' });
    const outside = submission({ id: 'outside', userId: 'student-c', publicationId: 'publication-2', studentLabel: '学生丙' });

    const beforeDeadline = buildArenaPublicationLeaderboardView({
      publication: {
        id: 'publication-1',
        taskId: 'task-integrator-low-frequency-balance',
        classId: 'class-a',
        deadline: future,
        leaderboardPolicyId: 'leaderboard-class-homework',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      },
      submissions: [other, outside, own],
      viewerUserId: 'student-a',
      now: new Date('2026-05-15T10:00:00.000Z'),
    });

    expect(beforeDeadline.entries).toEqual([]);
    expect(beforeDeadline.personalStatus?.submissionId).toBe('own');

    const afterDeadline = buildArenaPublicationLeaderboardView({
      publication: {
        id: 'publication-1',
        taskId: 'task-integrator-low-frequency-balance',
        classId: 'class-a',
        deadline: past,
        leaderboardPolicyId: 'leaderboard-class-homework',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      },
      submissions: [other, outside, own],
      viewerUserId: 'student-a',
      now: new Date('2026-05-15T10:00:00.000Z'),
    });

    expect(afterDeadline.entries.map((entry) => entry.submissionId).sort()).toEqual(['other', 'own']);
    expect(isArenaPublicationLate({ deadline: past }, new Date('2026-05-15T10:00:00.000Z'))).toBe(true);
  });

  it('preserves Arena context on high-value LearningFacts and aggregates class insight signals', () => {
    const fact = eventToLearningFactInput({
      eventId: 'arena-evaluation-ctx-001',
      userId: 'student-a',
      actionType: 'arena_evaluation_complete',
      occurredAt: '2026-05-15T10:00:00.000Z',
      payload: {
        eventType: 'arena_evaluation_complete',
        taskId: 'task-integrator-low-frequency-balance',
        classId: 'class-a',
        publicationId: 'publication-1',
        method: 'pid',
        score: 88,
        valid: true,
        artifactHash: 'artifact-a',
        metricProfileId: 'metric-whitebox-time-domain-balanced',
        leaderboardPolicyId: 'leaderboard-class-homework',
        metricsJson: JSON.stringify({ settlingTime: 2.6, steadyStateError: 0.02 }),
      },
    } as any);

    expect(fact).toMatchObject({
      factType: 'design',
      moduleId: 'task-integrator-low-frequency-balance',
      score: 88,
    });
    expect((fact as any)?.contextJson).toMatchObject({
      arena: {
        taskId: 'task-integrator-low-frequency-balance',
        publicationId: 'publication-1',
        artifactHash: 'artifact-a',
        valid: true,
        metrics: { settlingTime: 2.6, steadyStateError: 0.02 },
      },
    });

    const insight = buildArenaClassInsightAggregation({
      classId: 'class-a',
      publicationId: 'publication-1',
      submissions: [
        submission({ id: 'valid-a' }),
        submission({
          id: 'invalid-a',
          evaluation: {
            valid: false,
            score: 35,
            hardConstraintResults: [{ id: 'closed_loop_stable', label: '闭环稳定', passed: false }],
            satisfaction: { settlingTime: 0.2, steadyStateError: 0.1 },
          } as any,
        }),
      ],
    });

    expect(insight.validRate).toBe(0.5);
    expect(insight.methodDistribution.pid).toBe(2);
    expect(insight.weakMetrics.map((metric) => metric.metricId)).toContain('settlingTime');
  });

  it('builds deterministic Odyssey artifacts and reports bridge failure separately from game scoring', async () => {
    const artifact = buildOdysseyArenaArtifact({
      runId: 'run-001',
      levelId: 'level-1',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      metrics: { settlingTime: 2.8, overshoot: 7, steadyStateError: 0.03, controlEnergy: 5 },
    });

    expect(artifact).toMatchObject({
      taskId: 'task-odyssey-level-one-growth',
      method: 'pid',
      params: {
        odysseyRunId: 'run-001',
        odysseyLevelId: 'level-1',
        odysseyTier: 'gold',
      },
    });

    const result = await bridgeOdysseyRunToArenaSubmission({
      userId: 'student-a',
      studentLabel: '学生甲',
      runId: 'run-001',
      levelId: 'level-1',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      metrics: { settlingTime: 2.8, overshoot: 7, steadyStateError: 0.03, controlEnergy: 5 },
      submittedAt: '2026-05-15T10:00:00.000Z',
      store: {
        findByOdysseyRun: vi.fn(async () => null),
        markOdysseyRunSubmitted: vi.fn(async () => undefined),
      },
      createSubmission: vi.fn(async () => {
        throw new Error('official evaluation unavailable');
      }),
    });

    expect(result).toEqual({
      ok: false,
      reason: 'official evaluation unavailable',
      gameScorePreserved: true,
    });
  });
});
