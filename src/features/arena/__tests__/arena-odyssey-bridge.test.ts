import { describe, expect, it, vi } from 'vitest';

import { evaluateArenaSubmission } from '../evaluation/evaluator';
import { buildOdysseyArenaArtifact, bridgeOdysseyRunToArenaSubmission } from '../odyssey/bridge';
import { createPersistedArenaSubmission } from '../submissions/persistence';

const completeTelemetry = {
  settlingTime: 2.8,
  maxOvershoot: 7,
  steadyError: 3,
  controlEnergy: 5,
  controlSmoothness: 1.2,
};

describe('Control Odyssey Arena bridge', () => {
  it('maps completed Odyssey telemetry to explicit Arena official metrics without carrying game score', () => {
    const artifact = buildOdysseyArenaArtifact({
      runId: 'run-odyssey-001',
      levelId: 'level-1',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      metrics: completeTelemetry,
    });

    expect(artifact.params).not.toHaveProperty('odysseyGameScore');
    expect(JSON.parse(String(artifact.params.odysseyOfficialMetricsJson))).toEqual({
      settlingTime: 2.8,
      overshoot: 7,
      steadyStateError: 0.03,
      controlEnergy: 5,
      controlSmoothness: 1.2,
    });
  });

  it('normalizes Odyssey undershoot steady error as a magnitude for Arena scoring', () => {
    const artifact = buildOdysseyArenaArtifact({
      runId: 'run-odyssey-undershoot',
      levelId: 'level-1',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      metrics: {
        ...completeTelemetry,
        steadyError: -12,
      },
    });

    expect(JSON.parse(String(artifact.params.odysseyOfficialMetricsJson))).toMatchObject({
      steadyStateError: 0.12,
    });
  });

  it('blocks official submission before required completion telemetry exists', async () => {
    const createSubmission = vi.fn(async () => ({
      id: 'submission-should-not-exist',
    } as any));

    const result = await bridgeOdysseyRunToArenaSubmission({
      userId: 'student-a',
      studentLabel: '学生甲',
      runId: 'run-incomplete',
      levelId: 'level-1',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      metrics: { maxOvershoot: 7, steadyError: 3 },
      submittedAt: '2026-05-17T09:00:00.000Z',
      createSubmission,
    });

    expect(result).toEqual({
      ok: false,
      reason: '缺少通关遥测：通关时间、操作强度。',
      gameScorePreserved: true,
    });
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('evaluates Odyssey official score from bridged telemetry metrics', async () => {
    const artifact = buildOdysseyArenaArtifact({
      runId: 'run-odyssey-002',
      levelId: 'level-1',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      metrics: completeTelemetry,
    });

    const result = await evaluateArenaSubmission({
      taskId: 'task-odyssey-level-one-growth',
      artifact,
    });

    expect(result.metrics).toMatchObject({
      settlingTime: 2.8,
      overshoot: 7,
      steadyStateError: 0.03,
      controlEnergy: 5,
    });
    expect(result.explanation.join('\n')).toContain('奥德赛通关遥测');
  });

  it('rejects forged Odyssey artifacts through generic Arena persistence', async () => {
    const store = {
      findEvaluationByHash: vi.fn(),
      createEvaluation: vi.fn(),
      upsertArtifact: vi.fn(),
      createSubmission: vi.fn(),
    };

    await expect(createPersistedArenaSubmission({
      taskId: 'task-odyssey-level-one-growth',
      artifact: buildOdysseyArenaArtifact({
        runId: 'run-forged',
        levelId: 'level-1',
        tier: 'gold',
        controllerId: 'PID',
        pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
        metrics: completeTelemetry,
      }),
      userId: 'student-forged',
      studentLabel: '伪造学生',
      submittedAt: '2026-05-17T09:00:00.000Z',
      store,
    })).rejects.toThrow('Control Odyssey Arena submissions must be created by the Odyssey bridge.');

    expect(store.findEvaluationByHash).not.toHaveBeenCalled();
    expect(store.createEvaluation).not.toHaveBeenCalled();
    expect(store.upsertArtifact).not.toHaveBeenCalled();
    expect(store.createSubmission).not.toHaveBeenCalled();
  });

  it('marks Odyssey bridge submissions with the trusted persistence source', async () => {
    const createSubmission = vi.fn(async (input) => ({
      id: 'submission-bridge',
      taskId: input.taskId,
      userId: input.userId,
      studentLabel: input.studentLabel,
      artifactHash: 'artifact-hash',
      artifact: input.artifact,
      evaluation: {
        taskId: input.taskId,
        artifact: input.artifact,
        valid: true,
        score: 90,
        metrics: {},
        satisfaction: {},
        hardConstraintResults: [],
        penalties: [],
        explanation: [],
      },
      submittedAt: input.submittedAt,
      reusedEvaluation: false,
    }));

    const result = await bridgeOdysseyRunToArenaSubmission({
      userId: 'student-a',
      studentLabel: '学生甲',
      runId: 'run-bridge-source',
      levelId: 'level-1',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      metrics: completeTelemetry,
      submittedAt: '2026-05-17T09:00:00.000Z',
      createSubmission,
    });

    expect(result.ok).toBe(true);
    expect(createSubmission).toHaveBeenCalledWith(expect.objectContaining({
      source: 'odyssey-bridge',
    }));
  });
});
