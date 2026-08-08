import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  createPersistedArenaSubmission: vi.fn(),
  persistArenaSubmissionEvidenceWriteback: vi.fn(),
  requestRealtimeSimulationTaskReconciliation: vi.fn(),
  getArenaPlantAdapterForOfficialEvaluationTaskId: vi.fn(),
  resolveAccessibleArenaPublicationForStudent: vi.fn(),
  listSubmissions: vi.fn(),
  createArenaOfficialKonlingFollowup: vi.fn(),
  readArenaOfficialRevisit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/features/arena/submissions/persistence', () => ({
  createPersistedArenaSubmission: mocks.createPersistedArenaSubmission,
  ArenaSubmissionInputError: class ArenaSubmissionInputError extends Error {},
}));

vi.mock('@/features/arena/submissions/prisma-store', () => ({
  prismaArenaSubmissionStore: { marker: 'store' },
}));

vi.mock('@/features/arena/student/konling-official-followup', () => ({
  createArenaOfficialKonlingFollowup: mocks.createArenaOfficialKonlingFollowup,
  readArenaOfficialRevisit: mocks.readArenaOfficialRevisit,
}));

vi.mock('@/features/arena/evidence-writeback-persistence', () => ({
  persistArenaSubmissionEvidenceWriteback: mocks.persistArenaSubmissionEvidenceWriteback,
}));

vi.mock('@/lib/data-governance/simulation-task-reconciliation', () => ({
  requestRealtimeSimulationTaskReconciliation: mocks.requestRealtimeSimulationTaskReconciliation,
}));

vi.mock('@/features/arena/teacher/publication-store', () => ({
  resolveAccessibleArenaPublicationForStudent: mocks.resolveAccessibleArenaPublicationForStudent,
  ArenaPublicationAccessError: class ArenaPublicationAccessError extends Error {},
}));

vi.mock('@/features/arena/blackbox/experiment-service', () => ({
  prismaArenaBlackBoxExperimentStore: { marker: 'blackbox-store' },
}));

vi.mock('@/features/arena/adapters/registry', () => ({
  getArenaPlantAdapterForOfficialEvaluationTaskId: mocks.getArenaPlantAdapterForOfficialEvaluationTaskId,
  ArenaPlantAdapterSelectionError: class ArenaPlantAdapterSelectionError extends Error {},
}));

import { POST } from '../route';
import type { ControllerArtifact } from '@/features/arena/types';

const artifact: ControllerArtifact = {
  id: 'artifact-route-a',
  taskId: 'task-second-order-lead-pid',
  method: 'pid',
  params: { kp: 2.4, ki: 0.8, kd: 0.35 },
  createdAt: '2026-05-10T10:00:00.000Z',
};

function acceptedWriteback(submissionId: string) {
  return {
    status: 'accepted' as const,
    sourceRef: { kind: 'ArenaSubmission' as const, id: submissionId },
    attemptStatus: 'effective' as const,
    visibilityState: 'materialized' as const,
    targetLabel: '控制校正 Arena 官方迁移验证',
    summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
    recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
    limitationCodes: [],
    overlayCount: 1,
    terminalValidationAccepted: true,
  };
}

function duplicateOnlyWriteback(submissionId: string) {
  return {
    status: 'blocked' as const,
    sourceRef: { kind: 'ArenaSubmission' as const, id: submissionId },
    attemptStatus: 'duplicate-only' as const,
    visibilityState: 'diagnostic-only' as const,
    targetLabel: '控制校正 Arena 官方迁移验证',
    summary: '重复官方提交复用既有评测，只保留诊断记录，不新增终端掌握判定。',
    recoveryAction: '重新提交一次截止前、有效且非零分的官方 Arena 结果；若仍无法写回，请由教师在报告中复核证据绑定。',
    limitationCodes: [],
    overlayCount: 0,
    terminalValidationAccepted: false,
  };
}

function postJson(body: unknown) {
  return POST(new Request('http://localhost/api/arena/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/arena/evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getArenaPlantAdapterForOfficialEvaluationTaskId.mockReturnValue({
      id: 'whitebox-transfer-function',
    });
    mocks.resolveAccessibleArenaPublicationForStudent.mockImplementation(async ({ publicationId }) => ({
      id: publicationId,
      taskId: 'task-second-order-lead-pid',
      classId: 'class-a',
      seasonId: undefined,
      isLate: false,
    }));
    mocks.createPersistedArenaSubmission.mockImplementation(async (input) => ({
      id: `submission-${input.artifact.id}`,
      taskId: input.taskId,
      userId: input.userId,
      publicationId: input.publicationId,
      classId: input.classId,
      seasonId: input.seasonId,
      isLate: input.isLate,
      studentLabel: input.studentLabel,
      artifactHash: 'artifact-route-hash',
      artifact: input.artifact,
      evaluation: {
        taskId: input.taskId,
        artifact: input.artifact,
        valid: true,
        score: 88,
        metrics: {},
        satisfaction: {},
        hardConstraintResults: [],
        penalties: [],
        explanation: ['评测完成'],
      },
      submittedAt: input.submittedAt,
      reusedEvaluation: input.artifact.id === 'artifact-route-b',
    }));
    mocks.persistArenaSubmissionEvidenceWriteback.mockImplementation(async (_db, submission) => ({
      evidenceWriteback: submission.reusedEvaluation
        ? duplicateOnlyWriteback(submission.id)
        : acceptedWriteback(submission.id),
      dedupeKey: `dedupe-${submission.id}`,
      learningFactCreated: !submission.reusedEvaluation,
    }));
    mocks.requestRealtimeSimulationTaskReconciliation.mockResolvedValue(1);
    mocks.listSubmissions.mockImplementation(async () => []);
    mocks.readArenaOfficialRevisit.mockResolvedValue(null);
    mocks.createArenaOfficialKonlingFollowup.mockResolvedValue(null);
  });

  it('requires an authenticated user', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await postJson({ taskId: artifact.taskId, artifact });

    expect(response.status).toBe(401);
  });

  it('maps invalid task requests to 400 instead of 500', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const { ArenaSubmissionInputError } = await import('@/features/arena/submissions/persistence');
    mocks.createPersistedArenaSubmission.mockRejectedValueOnce(new ArenaSubmissionInputError('Unknown arena task: missing-task'));

    const response = await postJson({ taskId: 'missing-task', artifact });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Unknown arena task');
  });

  it('requests realtime reconciliation for new and duplicate accepted Arena evidence', async () => {
    mocks.persistArenaSubmissionEvidenceWriteback
      .mockResolvedValueOnce({
        evidenceWriteback: acceptedWriteback('submission-artifact-route-a'),
        dedupeKey: 'dedupe-submission-artifact-route-a',
        learningFactCreated: true,
      })
      .mockResolvedValueOnce({
        evidenceWriteback: acceptedWriteback('submission-artifact-route-b'),
        dedupeKey: 'dedupe-submission-artifact-route-b',
        learningFactCreated: false,
      });
    const first = await postJson({
      taskId: artifact.taskId,
      artifact,
      publicationId: 'publication-a',
    });
    const duplicateArtifact = { ...artifact, id: 'artifact-route-b' };
    const duplicate = await postJson({
      taskId: artifact.taskId,
      artifact: duplicateArtifact,
      publicationId: 'publication-a',
    });

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(200);
    expect(mocks.requestRealtimeSimulationTaskReconciliation).toHaveBeenCalledTimes(2);
    expect(mocks.requestRealtimeSimulationTaskReconciliation).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: 'student-1',
        classIds: ['class-a'],
        reason: 'arena-task-evidence',
      },
    );
  });

  it('retries reconciliation after an accepted Arena writeback outlives request persistence failure', async () => {
    mocks.requestRealtimeSimulationTaskReconciliation.mockRejectedValueOnce(
      new Error('reconciliation request unavailable'),
    );
    mocks.persistArenaSubmissionEvidenceWriteback
      .mockResolvedValueOnce({
        evidenceWriteback: acceptedWriteback('submission-artifact-route-a'),
        dedupeKey: 'dedupe-submission-artifact-route-a',
        learningFactCreated: true,
      })
      .mockResolvedValueOnce({
        evidenceWriteback: acceptedWriteback('submission-artifact-route-a'),
        dedupeKey: 'dedupe-submission-artifact-route-a',
        learningFactCreated: false,
      });

    const first = await postJson({ taskId: artifact.taskId, artifact });
    const retry = await postJson({ taskId: artifact.taskId, artifact });

    expect(first.status).toBe(500);
    expect(retry.status).toBe(200);
    expect(mocks.persistArenaSubmissionEvidenceWriteback).toHaveBeenCalledTimes(2);
    expect(mocks.requestRealtimeSimulationTaskReconciliation).toHaveBeenCalledTimes(2);
  });

  it('rejects non-student submissions before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', name: '教师甲', role: 'TEACHER' } });

    const response = await postJson({ taskId: artifact.taskId, artifact });

    expect(response.status).toBe(403);
    expect(mocks.createPersistedArenaSubmission).not.toHaveBeenCalled();
  });

  it('does not expose persistence errors to the client', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });
    mocks.createPersistedArenaSubmission.mockRejectedValueOnce(new Error('Prisma database connection detail'));

    const response = await postJson({ taskId: artifact.taskId, artifact });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Arena evaluation failed');
  });

  it('allows retrying the same contextual artifact after writeback persistence fails before accepted outbox publication', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });
    mocks.persistArenaSubmissionEvidenceWriteback
      .mockRejectedValueOnce(new Error('LearningFact write failed before outbox publication'))
      .mockImplementationOnce(async (_db, submission) => ({
        evidenceWriteback: acceptedWriteback(submission.id),
        dedupeKey: `dedupe-${submission.id}`,
        learningFactCreated: true,
      }));
    mocks.createPersistedArenaSubmission
      .mockImplementationOnce(async (input) => ({
        id: 'submission-orphan',
        taskId: input.taskId,
        userId: input.userId,
        publicationId: input.publicationId,
        classId: input.classId,
        seasonId: input.seasonId,
        isLate: input.isLate,
        studentLabel: input.studentLabel,
        artifactHash: 'artifact-route-hash',
        artifact: input.artifact,
        evaluation: {
          taskId: input.taskId,
          artifact: input.artifact,
          valid: true,
          score: 88,
          metrics: {},
          satisfaction: {},
          hardConstraintResults: [],
          penalties: [],
          explanation: ['评测完成'],
        },
        submittedAt: input.submittedAt,
        reusedEvaluation: false,
      }))
      .mockImplementationOnce(async (input) => ({
        id: 'submission-retry',
        taskId: input.taskId,
        userId: input.userId,
        publicationId: input.publicationId,
        classId: input.classId,
        seasonId: input.seasonId,
        isLate: input.isLate,
        studentLabel: input.studentLabel,
        artifactHash: 'artifact-route-hash',
        artifact: input.artifact,
        evaluation: {
          taskId: input.taskId,
          artifact: input.artifact,
          valid: true,
          score: 88,
          metrics: {},
          satisfaction: {},
          hardConstraintResults: [],
          penalties: [],
          explanation: ['评测完成'],
        },
        submittedAt: input.submittedAt,
        reusedEvaluation: false,
      }));

    const first = await postJson({
      taskId: artifact.taskId,
      artifact,
      publicationId: 'publication-1',
    });
    const second = await postJson({
      taskId: artifact.taskId,
      artifact: { ...artifact, id: 'artifact-route-retry' },
      publicationId: 'publication-1',
    });
    const payload = await second.json();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(payload.submission.reusedEvaluation).toBe(false);
    expect(payload.evidenceWriteback).toMatchObject({
      status: 'accepted',
      sourceRef: { kind: 'ArenaSubmission', id: 'submission-retry' },
      terminalValidationAccepted: true,
    });
  });

  it('reports pending Arena database migrations as a specific Chinese error', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });
    const migrationError = Object.assign(
      new Error('The column `ArenaEvaluationRun.metadata` does not exist in the current database.'),
      { code: 'P2022', meta: { modelName: 'ArenaEvaluationRun', column: 'ArenaEvaluationRun.metadata' } },
    );
    mocks.createPersistedArenaSubmission.mockRejectedValueOnce(migrationError);

    const response = await postJson({ taskId: artifact.taskId, artifact });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toBe('竞技场评测数据表尚未完成迁移，请先完成数据库迁移后重试。');
  });

  it('reports pending Arena table migrations from Prisma P2021 table metadata', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });
    const migrationError = Object.assign(
      new Error('The table `ArenaEvaluationRun` does not exist in the current database.'),
      { code: 'P2021', meta: { table: 'public.ArenaEvaluationRun' } },
    );
    mocks.createPersistedArenaSubmission.mockRejectedValueOnce(migrationError);

    const response = await postJson({ taskId: artifact.taskId, artifact });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toBe('竞技场评测数据表尚未完成迁移，请先完成数据库迁移后重试。');
  });

  it('persists duplicate evaluation reuse as diagnostic-only writeback without mastery evidence', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });

    const first = await postJson({ taskId: artifact.taskId, artifact });
    const second = await postJson({ taskId: artifact.taskId, artifact: { ...artifact, id: 'artifact-route-b' } });
    const payload = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(payload.submission.reusedEvaluation).toBe(true);
    expect(payload.evidenceWriteback).toMatchObject({
      status: 'blocked',
      sourceRef: { kind: 'ArenaSubmission', id: 'submission-artifact-route-b' },
      attemptStatus: 'duplicate-only',
      limitationCodes: [],
    });
    expect(payload.submission.evidenceWriteback).toMatchObject({
      status: 'blocked',
      terminalValidationAccepted: false,
    });
    expect(mocks.getArenaPlantAdapterForOfficialEvaluationTaskId).toHaveBeenCalledWith(artifact.taskId);
    expect(mocks.createPersistedArenaSubmission).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      studentLabel: '学生甲',
      store: { marker: 'store' },
      blackBoxExperimentStore: { marker: 'blackbox-store' },
      identificationModelStore: { marker: 'blackbox-store' },
    }));
  });

  it('maps unsupported official evaluation adapter modes to 400 before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });
    const { ArenaPlantAdapterSelectionError } = await import('@/features/arena/adapters/registry');
    mocks.getArenaPlantAdapterForOfficialEvaluationTaskId.mockImplementationOnce(() => {
      throw new ArenaPlantAdapterSelectionError('Official evaluation is not supported for this Arena task.');
    });

    const response = await postJson({ taskId: artifact.taskId, artifact });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Official evaluation is not supported');
    expect(mocks.createPersistedArenaSubmission).not.toHaveBeenCalled();
  });

  it('does not trust class or season scope from the request body', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });

    await postJson({
      taskId: artifact.taskId,
      artifact,
      classId: 'forged-class',
      seasonId: 'forged-season',
    });

    expect(mocks.createPersistedArenaSubmission).toHaveBeenCalledWith(expect.not.objectContaining({
      classId: 'forged-class',
      seasonId: 'forged-season',
    }));
  });

  it('validates publication context before persisting contextual submissions', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });
    mocks.resolveAccessibleArenaPublicationForStudent.mockResolvedValueOnce({
      id: 'publication-1',
      taskId: artifact.taskId,
      classId: 'class-a',
      seasonId: 'season-2026',
      isLate: false,
    });

    const response = await postJson({
      taskId: artifact.taskId,
      artifact,
      publicationId: 'publication-1',
    });

    expect(response.status).toBe(200);
    expect(mocks.resolveAccessibleArenaPublicationForStudent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      publicationId: 'publication-1',
      studentId: 'student-1',
      taskId: artifact.taskId,
    }));
    expect(mocks.createPersistedArenaSubmission).toHaveBeenCalledWith(expect.objectContaining({
      publicationId: 'publication-1',
      classId: 'class-a',
      seasonId: 'season-2026',
      isLate: false,
    }));
  });

  it('rejects unauthorized publication submissions before official evaluation', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });
    const { ArenaPublicationAccessError } = await import('@/features/arena/teacher/publication-store');
    mocks.resolveAccessibleArenaPublicationForStudent.mockRejectedValueOnce(new ArenaPublicationAccessError('Publication not allowed'));

    const response = await postJson({
      taskId: artifact.taskId,
      artifact,
      publicationId: 'publication-other',
    });

    expect(response.status).toBe(403);
    expect(mocks.createPersistedArenaSubmission).not.toHaveBeenCalled();
  });

  it('returns a persisted Konling followup derived from formal evaluation history', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.listSubmissions.mockResolvedValueOnce([]);
    mocks.readArenaOfficialRevisit.mockResolvedValueOnce('与建议触发时相比，得分变化 +10。');
    mocks.createArenaOfficialKonlingFollowup.mockResolvedValueOnce({
      id: 'intervention-1',
      suggestion: {
        kind: 'constraint-violation',
        title: '本次正式评测存在硬约束违规',
        evidence: ['稳定性：未通过'],
        nextStep: '先使当前未通过的硬约束达标。',
      },
    });

    const response = await postJson({ taskId: artifact.taskId, artifact });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.createArenaOfficialKonlingFollowup).toHaveBeenCalledWith(expect.objectContaining({
      submission: expect.objectContaining({ id: 'submission-artifact-route-a' }),
      history: [],
    }));
    expect(payload.konlingFollowup).toMatchObject({
      id: 'intervention-1',
      suggestion: { kind: 'constraint-violation', revisit: '与建议触发时相比，得分变化 +10。' },
    });
  });
});
