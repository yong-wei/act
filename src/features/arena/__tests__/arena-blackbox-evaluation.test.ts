import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { evaluateArenaSubmission, getArenaEvaluationProtocolVersion } from '../evaluation/evaluator';
import { buildBlackBoxControlArtifactFromParams } from '../submissions/blackbox-artifact-builder';
import { createPersistedArenaSubmission } from '../submissions/persistence';

describe('arena black-box identification evaluation', () => {
  it('builds black-box control artifacts from identification workspace parameters', () => {
    const artifact = buildBlackBoxControlArtifactFromParams({
      taskId: 'task-cruise-roll-blackbox-identification',
      values: {
        identificationQuality: '0.82',
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      now: '2026-05-11T09:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: 'task-cruise-roll-blackbox-identification',
      method: 'black-box-control',
      params: {
        representation: 'identified-model-controller',
        identificationQuality: 0.82,
        experimentCount: 6,
        controllerGain: 1.6,
        dampingCompensation: 0.72,
        energyBudget: 12,
      },
      createdAt: '2026-05-11T09:00:00.000Z',
    });
  });

  it('rejects malformed black-box artifacts before official evaluation', () => {
    expect(() => buildBlackBoxControlArtifactFromParams({
      taskId: 'task-cruise-roll-blackbox-identification',
      values: {
        identificationQuality: 'bad',
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      now: '2026-05-11T09:00:00.000Z',
    })).toThrow('identificationQuality 必须是有限数字');
  });

  it('evaluates valid black-box control artifacts without exposing a transfer function', () => {
    const artifact = buildBlackBoxControlArtifactFromParams({
      taskId: 'task-cruise-roll-blackbox-identification',
      values: {
        identificationQuality: '0.82',
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      now: '2026-05-11T09:00:00.000Z',
    });

    const result = evaluateArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact,
    });

    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics.trackingError).toBeGreaterThan(0);
    expect(result.metrics.identificationFit).toBeGreaterThan(0);
    expect(result.metrics.identificationFit).not.toBe(0.82);
    expect(result.explanation.join(' ')).not.toContain('G(s)');
  });

  it('does not trust client-claimed identification quality for official metrics', () => {
    const lowClaim = evaluateArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact: {
        id: 'artifact-blackbox-low-claim',
        taskId: 'task-cruise-roll-blackbox-identification',
        method: 'black-box-control',
        params: {
          representation: 'identified-model-controller',
          identificationQuality: 0.1,
          experimentCount: 6,
          controllerGain: 1.6,
          dampingCompensation: 0.72,
          energyBudget: 12,
        },
        createdAt: '2026-05-11T09:00:00.000Z',
      },
    });
    const highClaim = evaluateArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact: {
        id: 'artifact-blackbox-high-claim',
        taskId: 'task-cruise-roll-blackbox-identification',
        method: 'black-box-control',
        params: {
          representation: 'identified-model-controller',
          identificationQuality: 1,
          experimentCount: 6,
          controllerGain: 1.6,
          dampingCompensation: 0.72,
          energyBudget: 12,
        },
        createdAt: '2026-05-11T09:00:00.000Z',
      },
    });

    expect(highClaim.metrics.identificationFit).toBe(lowClaim.metrics.identificationFit);
    expect(highClaim.score).toBe(lowClaim.score);
  });

  it('rejects out-of-range black-box artifacts before ranking', () => {
    const result = evaluateArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact: {
        id: 'artifact-blackbox-adversarial',
        taskId: 'task-cruise-roll-blackbox-identification',
        method: 'black-box-control',
        params: {
          representation: 'identified-model-controller',
          identificationQuality: 1,
          experimentCount: 99,
          controllerGain: 30,
          dampingCompensation: 0.2,
          energyBudget: 4,
        },
        createdAt: '2026-05-11T09:00:00.000Z',
      },
    });

    expect(result.valid).toBe(false);
    expect(result.score).toBe(0);
    expect(result.explanation.join(' ')).toContain('experimentCount 不能超过 20');
    expect(result.explanation.join(' ')).toContain('controllerGain 不能超过 8');
  });

  it('keeps white-box and black-box official protocols separate', () => {
    expect(getArenaEvaluationProtocolVersion('task-second-order-lead-pid')).toBe('whitebox-v1');
    expect(getArenaEvaluationProtocolVersion('task-cruise-roll-blackbox-identification')).toBe('blackbox-v1');
  });

  it('persists black-box official evaluations with the black-box protocol version', async () => {
    const artifact = buildBlackBoxControlArtifactFromParams({
      taskId: 'task-cruise-roll-blackbox-identification',
      values: {
        identificationQuality: '0.82',
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      now: '2026-05-11T09:00:00.000Z',
    });
    const store = {
      findEvaluationByHash: vi.fn().mockResolvedValue(null),
      createEvaluation: vi.fn(async (evaluation) => ({ ...evaluation, id: 'blackbox-eval-row' })),
      upsertArtifact: vi.fn(async (storedArtifact) => ({ ...storedArtifact, id: 'blackbox-artifact-row' })),
      createSubmission: vi.fn(async (submission) => ({ ...submission, id: 'blackbox-submission-row' })),
    };

    const submission = await createPersistedArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact,
      userId: 'student-blackbox',
      studentLabel: '黑箱学生',
      submittedAt: '2026-05-11T09:01:00.000Z',
      store,
    });

    expect(submission.evaluation.valid).toBe(true);
    expect(store.findEvaluationByHash).toHaveBeenCalledWith(
      'task-cruise-roll-blackbox-identification',
      submission.artifactHash,
      'blackbox-v1',
    );
    expect(store.createEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      protocolVersion: 'blackbox-v1',
    }));
  });

  it('mounts black-box submission UI and sends identification model telemetry', () => {
    const detailSource = readFileSync(
      join(process.cwd(), 'src/features/arena/challenge-detail.tsx'),
      'utf8',
    );
    const panelSource = readFileSync(
      join(process.cwd(), 'src/features/arena/submissions/arena-blackbox-submission-panel.tsx'),
      'utf8',
    );

    expect(detailSource).toContain('<ArenaBlackBoxSubmissionPanel task={task} initialSubmissions={submissions} />');
    expect(panelSource).toContain('buildBlackBoxControlArtifactFromParams');
    expect(panelSource).toContain("'arena_identification_model_save'");
    expect(panelSource).toContain("'arena_controller_save'");
    expect(panelSource).toContain("'arena_submit'");
    expect(panelSource).toContain("'arena_evaluation_complete'");
    expect(panelSource).toContain('JSON.stringify({ taskId: task.id, artifact })');
  });

  it('mounts black-box submission UI only for virtual-simulation black-box tasks', () => {
    const detailSource = readFileSync(
      join(process.cwd(), 'src/features/arena/challenge-detail.tsx'),
      'utf8',
    );

    expect(detailSource).toContain("object.adapterType === 'virtual-simulation'");
  });

  it('lists persisted submissions through the current protocol for each task type', () => {
    const storeSource = readFileSync(
      join(process.cwd(), 'src/features/arena/submissions/prisma-store.ts'),
      'utf8',
    );

    expect(storeSource).toContain('getArenaEvaluationProtocolVersion(String(row.taskId))');
    expect(storeSource).not.toContain('protocolVersion: ARENA_EVALUATION_PROTOCOL_VERSION');
  });
});
