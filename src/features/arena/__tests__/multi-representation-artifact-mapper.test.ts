import { describe, it, expect } from 'vitest';
import { buildArenaArtifactFromMultiRepresentationState } from '../workbench/artifact-mappers';
import { buildArenaControlAnalysisRequest } from '../evaluation/controller-to-analysis-request';
import { summarizeController } from '../evaluation/whitebox-evaluator';
import type { CorrectionState } from '@/features/interactive/multi-representation-linkage/model';
import type { ChallengeObject, ChallengeTask } from '../types';

const baseTask: ChallengeTask = {
  id: 'task-second-order-lead-pid',
  objectId: 'plant-second-order-underdamped',
  title: '二阶对象快速稳定挑战',
  goal: '缩短调节时间',
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

const pidState: CorrectionState = {
  enabled: true,
  kind: 'pid',
  kp: 2,
  ki: 0.5,
  kd: 0.1,
  ti: 4,
  td: 0.05,
  derivativeFilterEnabled: false,
  tf: 0.03,
  leadZeroFrequency: 1,
  leadPoleFrequency: 5,
  lagZeroFrequency: 0.2,
  lagPoleFrequency: 0.05,
  controllerGain: 1,
};

const piState: CorrectionState = { ...pidState, kind: 'pi' };
const pdState: CorrectionState = { ...pidState, kind: 'pd' };
const leadState: CorrectionState = {
  ...pidState, kind: 'lead', kp: 1, ki: 0, kd: 0,
  leadZeroFrequency: 2, leadPoleFrequency: 8,
};
const lagState: CorrectionState = {
  ...pidState, kind: 'lag', kp: 1, ki: 0, kd: 0,
  lagZeroFrequency: 0.5, lagPoleFrequency: 0.125,
};
const leadLagState: CorrectionState = { ...pidState, kind: 'lead_lag' };

const baseObject: ChallengeObject = {
  id: 'plant-second-order-underdamped',
  name: '二阶欠阻尼对象',
  source: 'typical',
  visibility: 'white-box',
  chapter: '3',
  tags: ['二阶系统'],
  relatedKnowledge: [],
  model: {
    display: '1/(s^2+2s+4)',
    numerator: [1],
    denominator: [1, 2, 4],
  },
};

describe('buildArenaArtifactFromMultiRepresentationState — gain equivalence', () => {
  it('PID: gain=1 returns raw kp/ki/kd', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: pidState });
    expect(result.artifact).not.toBeNull();
    expect(result.artifact!.params).toMatchObject({ kp: 2, ki: 0.5, kd: 0.1 });
  });

  it('PID: controller gain is represented inside correction state and does not double-scale through open-loop gain', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({
      task: baseTask,
      correctionState: { ...pidState, controllerGain: 2 },
      gain: 9,
    });
    expect(result.artifact!.params).toMatchObject({ kp: 4, ki: 1, kd: 0.2 });
  });

  it('PI: kd=0 and controller gain is read from correction state', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({
      task: baseTask,
      correctionState: { ...piState, controllerGain: 2 },
      gain: 9,
    });
    expect(result.artifact!.params).toMatchObject({ kp: 4, ki: 1, kd: 0 });
  });

  it('PD: ki=0 and controller gain is read from correction state', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({
      task: baseTask,
      correctionState: { ...pdState, controllerGain: 3 },
      gain: 9,
    });
    expect(result.artifact!.params.kp).toBe(6);
    expect(result.artifact!.params.ki).toBe(0);
    expect(result.artifact!.params.kd).toBeCloseTo(0.3, 10);
  });

  it('lead: serial gain defaults to correction-state controller gain', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: leadState, gain: 9 });
    expect(result.artifact!.method).toBe('serial-compensator');
    expect(result.artifact!.params.gain).toBeCloseTo(1, 5);
    expect(result.artifact!.params.zero).toBe(2);
    expect(result.artifact!.params.pole).toBe(8);
  });

  it('lead: serial compensator preserves controller gain from correction state', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({
      task: baseTask,
      correctionState: { ...leadState, controllerGain: 2.5 },
      gain: 9,
    });
    expect(result.artifact!.params.gain).toBeCloseTo(2.5, 5);
  });

  it('lead: official analysis interprets serial gain as the same controller gain shown in the workbench', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({
      task: baseTask,
      correctionState: { ...leadState, controllerGain: 2.5 },
    });
    const request = buildArenaControlAnalysisRequest({
      task: baseTask,
      object: baseObject,
      artifact: result.artifact!,
    });
    const controller = summarizeController(result.artifact!, baseObject.model!);

    expect(request.structures).toEqual([
      { kind: 'gain', enabled: true, params: { k: 2.5 }, label: 'K' },
      { kind: 'lead', enabled: true, params: { k: 1, tau: 0.5, alpha: 0.25, beta: 0.25 }, label: 'C(s)' },
    ]);
    expect(request.rootLocus.currentGain).toBeCloseTo(2.5, 10);
    expect(controller.effectiveGain).toBeCloseTo(0.625, 10);
  });

  it('lag: serial gain defaults to correction-state controller gain', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: lagState, gain: 9 });
    expect(result.artifact!.method).toBe('serial-compensator');
    expect(result.artifact!.params.gain).toBeCloseTo(1, 5);
    expect(result.artifact!.params.zero).toBe(0.5);
    expect(result.artifact!.params.pole).toBe(0.125);
  });

  it('lag: serial compensator preserves controller gain from correction state', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({
      task: baseTask,
      correctionState: { ...lagState, controllerGain: 0.4 },
      gain: 9,
    });
    expect(result.artifact!.params.gain).toBeCloseTo(0.4, 5);
  });

  it('lead_lag: still blocked from official submission', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: leadLagState });
    expect(result.artifact).toBeNull();
    expect(result.unsupportedMethod).toBe('lead_lag');
  });

  it('disabled correction returns error', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({
      task: baseTask,
      correctionState: { ...pidState, enabled: false },
    });
    expect(result.artifact).toBeNull();
    expect(result.error).toContain('启用校正器');
  });

  it('rejects method not in allowedMethods', () => {
    const pidOnlyTask = { ...baseTask, allowedMethods: ['pid'] as const };
    const result = buildArenaArtifactFromMultiRepresentationState({
      task: pidOnlyTask,
      correctionState: leadState,
    });
    expect(result.artifact).toBeNull();
    expect(result.error).toContain('不允许');
  });
});
