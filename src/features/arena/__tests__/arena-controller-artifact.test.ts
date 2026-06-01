import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildCodeControllerArtifactFromManifest,
  buildControllerArtifactFromParams,
  getEvaluableControllerMethods,
} from '../submissions/controller-artifact-builder';
import { buildArenaWorkbenchPreview } from '../submissions/workbench-preview';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import type { ChallengeTask } from '../types';

const baseTraining: ChallengeTask['training'] = {
  stage: 'foundation',
  capabilityTags: ['time-domain-shaping', 'steady-state-accuracy'],
  prerequisiteCapabilityTags: [],
  goal: '用二阶对象建立调节时间、超调量和稳态误差的第一轮控制设计直觉。',
  estimatedEffortMinutes: 25,
  hiddenTestSignal: 'none',
  commonFailurePoints: ['只追求调节时间导致超调过大', '忽略稳态误差是否已经进入目标范围'],
};

const baseTask: ChallengeTask = {
  id: 'task-second-order-lead-pid',
  objectId: 'plant-second-order-underdamped',
  title: '二阶对象快速稳定挑战',
  goal: '缩短调节时间，同时限制超调量和稳态误差。',
  difficulty: '基础',
  allowedMethods: ['serial-compensator', 'pid'],
  metricProfileId: 'metric-whitebox-time-domain-balanced',
  leaderboardPolicyId: 'leaderboard-whitebox-default',
  leaderboardTypes: ['main', 'method', 'metric'],
  primaryMetrics: ['settlingTime', 'overshoot', 'steadyStateError', 'itae'],
  workspaceMode: 'multi-representation-linkage',
  homeworkPolicy: '可作为作业挑战',
  homeworkEligible: true,
  practiceMode: 'open',
  training: baseTraining,
};

const compositeTask: ChallengeTask = {
  ...baseTask,
  id: 'task-third-order-block-diagram',
  objectId: 'plant-third-order-pure-pole',
  allowedMethods: ['composite-compensation', 'serial-compensator'],
  workspaceMode: 'block-diagram-workbench',
};

const mpcTask: ChallengeTask = {
  ...baseTask,
  id: 'task-ship-roll-mpc-hidden-scenarios',
  objectId: 'plant-ship-roll-whitebox',
  allowedMethods: ['mpc'],
  workspaceMode: 'predictive-control',
  primaryMetrics: ['hiddenScenarioWorst', 'settlingTime', 'controlEnergy', 'overshoot'],
};

const optimizedPidTask: ChallengeTask = {
  ...baseTask,
  id: 'task-ship-roll-optimized-pid-robust',
  objectId: 'plant-ship-roll-whitebox',
  allowedMethods: ['optimized-pid'],
  workspaceMode: 'predictive-control',
  primaryMetrics: ['hiddenScenarioWorst', 'settlingTime', 'controlEnergy', 'overshoot'],
};

const codeControllerTask: ChallengeTask = {
  ...baseTask,
  id: 'task-frontier-code-controller-safety',
  objectId: 'plant-ship-roll-whitebox',
  allowedMethods: ['code-controller'],
  workspaceMode: 'predictive-control',
  practiceMode: 'project',
};
const sourceHash = `sha256:${'1'.repeat(64)}`;
const dependencyLockHash = `sha256:${'2'.repeat(64)}`;

describe('arena controller artifact builder', () => {
  it('builds PID controller artifacts from string inputs', () => {
    const artifact = buildControllerArtifactFromParams({
      task: baseTask,
      method: 'pid',
      values: { kp: '2.4', ki: '0.8', kd: '0.35' },
      now: '2026-05-10T10:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: baseTask.id,
      method: 'pid',
      params: { kp: 2.4, ki: 0.8, kd: 0.35 },
      createdAt: '2026-05-10T10:00:00.000Z',
    });
  });

  it('builds serial compensator artifacts from gain-zero-pole inputs', () => {
    const artifact = buildControllerArtifactFromParams({
      task: baseTask,
      method: 'serial-compensator',
      values: { gain: '3', zero: '1.2', pole: '6' },
      now: '2026-05-10T10:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: baseTask.id,
      method: 'serial-compensator',
      params: { gain: 3, zero: 1.2, pole: 6 },
    });
  });

  it('builds local workbench previews without creating official submissions', async () => {
    const previousSubmission: ArenaSubmissionRecord = {
      id: 'submission-previous',
      taskId: baseTask.id,
      userId: 'student-a',
      studentLabel: '学生甲',
      artifactHash: 'hash-previous',
      artifact: {
        id: 'artifact-previous',
        taskId: baseTask.id,
        method: 'pid',
        params: { kp: 1.2, ki: 0.2, kd: 0.05 },
        createdAt: '2026-05-11T09:00:00.000Z',
      },
      evaluation: {
        taskId: baseTask.id,
        artifact: {
          id: 'artifact-previous',
          taskId: baseTask.id,
          method: 'pid',
          params: { kp: 1.2, ki: 0.2, kd: 0.05 },
          createdAt: '2026-05-11T09:00:00.000Z',
        },
        valid: true,
        score: 40,
        metrics: { settlingTime: 7, overshoot: 28, steadyStateError: 0.08, itae: 9 },
        satisfaction: { settlingTime: 0.2, overshoot: 0.25, steadyStateError: 0.4, itae: 0.3 },
        hardConstraintResults: [],
        penalties: [],
        explanation: ['previous'],
      },
      submittedAt: '2026-05-11T09:00:00.000Z',
      reusedEvaluation: false,
    };

    const preview = await buildArenaWorkbenchPreview({
      task: baseTask,
      method: 'pid',
      values: { kp: '2.4', ki: '0.8', kd: '0.35' },
      previousSubmission,
      now: '2026-05-11T10:00:00.000Z',
    });

    expect(preview.artifact).toMatchObject({
      taskId: baseTask.id,
      method: 'pid',
      createdAt: '2026-05-11T10:00:00.000Z',
    });
    expect(preview.evaluation.taskId).toBe(baseTask.id);
    expect(preview.evaluation.score).toBeGreaterThan(0);
    expect(preview.comparison?.scoreDelta).toBeCloseTo(preview.evaluation.score - previousSubmission.evaluation.score, 5);
    expect(preview.comparison?.metricDeltas.map((delta) => delta.metricId)).toEqual(baseTask.primaryMetrics);
    expect(preview).not.toHaveProperty('submission');
  });

  it('rejects non-finite parameters before calling the official evaluator', () => {
    expect(() => buildControllerArtifactFromParams({
      task: baseTask,
      method: 'serial-compensator',
      values: { gain: '3', zero: 'bad', pole: '6' },
      now: '2026-05-10T10:00:00.000Z',
    })).toThrow('zero 必须是有限数字');
  });

  it('builds composite compensation artifacts from block-diagram parameters', () => {
    const artifact = buildControllerArtifactFromParams({
      task: compositeTask,
      method: 'composite-compensation',
      values: {
        prefilterGain: '0.9',
        forwardGain: '2.2',
        localFeedbackGain: '0.7',
        disturbanceCompensation: '0.4',
      },
      now: '2026-05-10T10:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: compositeTask.id,
      method: 'composite-compensation',
      params: {
        structure: 'prefilter-forward-local-feedback-disturbance',
        prefilterGain: 0.9,
        forwardGain: 2.2,
        localFeedbackGain: 0.7,
        disturbanceCompensation: 0.4,
      },
    });
  });

  it('rejects malformed composite compensation parameters before official evaluation', () => {
    expect(() => buildControllerArtifactFromParams({
      task: compositeTask,
      method: 'composite-compensation',
      values: {
        prefilterGain: '0.9',
        forwardGain: 'bad',
        localFeedbackGain: '0.7',
        disturbanceCompensation: '0.4',
      },
      now: '2026-05-10T10:00:00.000Z',
    })).toThrow('forwardGain 必须是有限数字');
  });

  it('builds parameterized MPC artifacts from template inputs', () => {
    const artifact = buildControllerArtifactFromParams({
      task: mpcTask,
      method: 'mpc',
      values: {
        predictionHorizon: '18',
        controlHorizon: '5',
        outputWeight: '1.4',
        controlWeight: '0.32',
        terminalWeight: '2',
        inputLimit: '4.5',
        sampleTime: '0.1',
      },
      now: '2026-05-10T10:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: mpcTask.id,
      method: 'mpc',
      params: {
        template: 'bounded-linear-mpc',
        predictionHorizon: 18,
        controlHorizon: 5,
        outputWeight: 1.4,
        controlWeight: 0.32,
        terminalWeight: 2,
        inputLimit: 4.5,
        sampleTime: 0.1,
      },
    });
  });

  it('rejects malformed MPC template parameters before official evaluation', () => {
    expect(() => buildControllerArtifactFromParams({
      task: mpcTask,
      method: 'mpc',
      values: {
        predictionHorizon: '18',
        controlHorizon: 'bad',
        outputWeight: '1.4',
        controlWeight: '0.32',
        terminalWeight: '2',
        inputLimit: '4.5',
        sampleTime: '0.1',
      },
      now: '2026-05-10T10:00:00.000Z',
    })).toThrow('controlHorizon 必须是有限数字');
  });

  it('builds optimization-assisted PID artifacts from objective weights', () => {
    const artifact = buildControllerArtifactFromParams({
      task: optimizedPidTask,
      method: 'optimized-pid',
      values: {
        speedWeight: '1.2',
        energyWeight: '0.7',
        robustnessWeight: '1.4',
        overshootWeight: '0.9',
        searchBudget: '80',
      },
      now: '2026-05-10T10:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: optimizedPidTask.id,
      method: 'optimized-pid',
      params: {
        template: 'bounded-optimized-pid',
        speedWeight: 1.2,
        energyWeight: 0.7,
        robustnessWeight: 1.4,
        overshootWeight: 0.9,
        searchBudget: 80,
      },
    });
  });

  it('rejects malformed optimization tuning parameters before official evaluation', () => {
    expect(() => buildControllerArtifactFromParams({
      task: optimizedPidTask,
      method: 'optimized-pid',
      values: {
        speedWeight: '1.2',
        energyWeight: 'bad',
        robustnessWeight: '1.4',
        overshootWeight: '0.9',
        searchBudget: '80',
      },
      now: '2026-05-10T10:00:00.000Z',
    })).toThrow('energyWeight 必须是有限数字');
  });

  it('only exposes methods supported by the current official evaluator', () => {
    expect(getEvaluableControllerMethods({
      ...baseTask,
      allowedMethods: ['composite-compensation', 'serial-compensator'],
    })).toEqual(['serial-compensator', 'composite-compensation']);
    expect(getEvaluableControllerMethods(mpcTask)).toEqual(['mpc']);
    expect(getEvaluableControllerMethods(optimizedPidTask)).toEqual(['optimized-pid']);
    expect(getEvaluableControllerMethods({
      ...baseTask,
      allowedMethods: ['black-box-control'],
    })).toEqual([]);
    expect(getEvaluableControllerMethods(codeControllerTask)).toEqual([]);
  });

  it('builds code controller artifacts from sandbox metadata without inline source', () => {
    const artifact = buildCodeControllerArtifactFromManifest({
      task: codeControllerTask,
      manifest: {
        language: 'typescript',
        sourceHash,
        entryPoint: 'controller.step',
        deterministicSeed: 'arena-seed-2026',
        dependencyLockHash,
        runtimeLimitMs: 50,
        memoryLimitMb: 32,
      },
      now: '2026-05-11T10:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: codeControllerTask.id,
      method: 'code-controller',
      params: {
        language: 'typescript',
        sourceHash,
        entryPoint: 'controller.step',
        deterministicSeed: 'arena-seed-2026',
        dependencyLockHash,
        runtimeLimitMs: 50,
        memoryLimitMb: 32,
      },
      createdAt: '2026-05-11T10:00:00.000Z',
    });
    expect(artifact.params).not.toHaveProperty('sourceCode');
  });

  it('rejects code controller artifacts that include inline source or missing sandbox metadata', () => {
    expect(() => buildCodeControllerArtifactFromManifest({
      task: codeControllerTask,
      manifest: {
        language: 'javascript',
        sourceCode: 'export function step() { return 0; }',
        sourceHash,
        entryPoint: 'controller.step',
        deterministicSeed: 'arena-seed-2026',
        dependencyLockHash,
        runtimeLimitMs: 50,
        memoryLimitMb: 32,
      },
      now: '2026-05-11T10:00:00.000Z',
    })).toThrow('代码型控制器不能携带内联源码');

    expect(() => buildCodeControllerArtifactFromManifest({
      task: codeControllerTask,
      manifest: {
        language: 'javascript',
        sourceHash,
        entryPoint: '',
        deterministicSeed: 'arena-seed-2026',
        dependencyLockHash,
        runtimeLimitMs: 50,
        memoryLimitMb: 32,
      },
      now: '2026-05-11T10:00:00.000Z',
    })).toThrow('entryPoint 是必填沙箱元数据');
  });

  it('rejects unsupported code languages and malformed dependency hashes', () => {
    expect(() => buildCodeControllerArtifactFromManifest({
      task: codeControllerTask,
      manifest: {
        language: 'ruby' as 'javascript',
        sourceHash,
        entryPoint: 'controller.step',
        deterministicSeed: 'arena-seed-2026',
        dependencyLockHash,
        runtimeLimitMs: 50,
        memoryLimitMb: 32,
      },
      now: '2026-05-11T10:00:00.000Z',
    })).toThrow('language 必须是 javascript、typescript 或 python');

    expect(() => buildCodeControllerArtifactFromManifest({
      task: codeControllerTask,
      manifest: {
        language: 'javascript',
        sourceHash,
        entryPoint: 'controller.step',
        deterministicSeed: 'arena-seed-2026',
        dependencyLockHash: 'sha256:not-a-real-hash',
        runtimeLimitMs: 50,
        memoryLimitMb: 32,
      },
      now: '2026-05-11T10:00:00.000Z',
    })).toThrow('dependencyLockHash 必须使用 sha256');
  });

  it('keeps the submission panel wired through the controller artifact builder', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/arena/submissions/arena-submission-panel.tsx'),
      'utf8',
    );
    const detailSource = readFileSync(
      join(process.cwd(), 'src/features/arena/challenge-detail.tsx'),
      'utf8',
    );

    expect(source).toContain('buildControllerArtifactFromParams');
    expect(source).toContain('buildArenaWorkbenchPreview');
    expect(source).toContain('getEvaluableControllerMethods');
    expect(source).toContain('sendArenaCoreEvent');
    expect(source).toContain('运行工作台仿真');
    expect(source).toContain('方案比较');
    expect(source).toContain('metricDeltas');
    expect(source).toContain('formatMetricDelta');
    expect(source).toContain("'arena_controller_save'");
    expect(source).toContain("'arena_submit'");
    expect(source).toContain("'arena_evaluation_complete'");
    expect(source).toContain('prefilterGain');
    expect(source).toContain('disturbanceCompensation');
    expect(source).toContain('predictionHorizon');
    expect(source).toContain('controlWeight');
    expect(source).toContain('speedWeight');
    expect(source).toContain('robustnessWeight');
    expect(source).toContain('JSON.stringify({ taskId: task.id, artifact })');
    expect(source).not.toContain('提交 PID 控制器');
    expect(detailSource).not.toContain('当前阶段只建立任务入口');
  });

  it('keeps challenge detail read-only and routes submission to the workbench', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/arena/challenge-detail.tsx'),
      'utf8',
    );

    expect(source).not.toContain('getEvaluableControllerMethods(task).length > 0');
    expect(source).not.toContain('<ArenaSubmissionPanel');
    expect(source).not.toContain('<ArenaBlackBoxSubmissionPanel');
    expect(source).toContain('<ArenaChallengeTelemetry');
    expect(source).toContain('<ArenaWorkspaceLink');
    expect(source).toContain('仿真调试与方案提交均在控制工作台内完成');
  });
});
