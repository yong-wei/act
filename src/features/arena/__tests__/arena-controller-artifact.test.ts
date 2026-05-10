import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildCodeControllerArtifactFromManifest,
  buildControllerArtifactFromParams,
  getEvaluableControllerMethods,
} from '../submissions/controller-artifact-builder';
import type { ChallengeTask } from '../types';

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

    expect(source).toContain('buildControllerArtifactFromParams');
    expect(source).toContain('getEvaluableControllerMethods');
    expect(source).toContain('sendArenaCoreEvent');
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
  });

  it('mounts the submission panel based on current evaluator-supported methods', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/arena/challenge-detail.tsx'),
      'utf8',
    );

    expect(source).toContain('getEvaluableControllerMethods(task).length > 0');
    expect(source).toContain('<ArenaChallengeTelemetry');
    expect(source).toContain('<ArenaWorkspaceLink');
    expect(source).toContain('<ArenaSubmissionPanel task={task} initialSubmissions={submissions} />');
  });
});
