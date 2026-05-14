import { describe, it, expect } from 'vitest';
import { buildArenaArtifactFromMultiRepresentationState } from '../workbench/artifact-mappers';
import type { CorrectionState } from '@/features/interactive/multi-representation-linkage/model';
import type { ChallengeTask } from '../types';

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

describe('buildArenaArtifactFromMultiRepresentationState — gain equivalence', () => {
  it('PID: gain=1 returns raw kp/ki/kd', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: pidState });
    expect(result.artifact).not.toBeNull();
    expect(result.artifact!.params).toMatchObject({ kp: 2, ki: 0.5, kd: 0.1 });
  });

  it('PID: gain=2 scales kp/ki/kd by 2x', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: pidState, gain: 2 });
    expect(result.artifact!.params).toMatchObject({ kp: 4, ki: 1, kd: 0.2 });
  });

  it('PID: gain=0.5 scales kp/ki/kd by 0.5x', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: pidState, gain: 0.5 });
    expect(result.artifact!.params).toMatchObject({ kp: 1, ki: 0.25, kd: 0.05 });
  });

  it('PI: kd=0 regardless of gain', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: piState, gain: 2 });
    expect(result.artifact!.params).toMatchObject({ kp: 4, ki: 1, kd: 0 });
  });

  it('PD: ki=0 regardless of gain', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: pdState, gain: 3 });
    expect(result.artifact!.params.kp).toBe(6);
    expect(result.artifact!.params.ki).toBe(0);
    expect(result.artifact!.params.kd).toBeCloseTo(0.3, 10);
  });

  it('lead: serial gain = poleFreq/zeroFreq * gain (k=1 in preview)', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: leadState, gain: 1 });
    expect(result.artifact!.method).toBe('serial-compensator');
    expect(result.artifact!.params.gain).toBeCloseTo(4, 5); // 8/2 = 4
    expect(result.artifact!.params.zero).toBe(2);
    expect(result.artifact!.params.pole).toBe(8);
  });

  it('lead: with gain=2, serial gain doubles', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: leadState, gain: 2 });
    expect(result.artifact!.params.gain).toBeCloseTo(8, 5);
  });

  it('lag: serial gain = poleFreq/zeroFreq * gain', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: lagState, gain: 1 });
    expect(result.artifact!.method).toBe('serial-compensator');
    expect(result.artifact!.params.gain).toBeCloseTo(0.25, 5); // 0.125/0.5 = 0.25
    expect(result.artifact!.params.zero).toBe(0.5);
    expect(result.artifact!.params.pole).toBe(0.125);
  });

  it('lag: with gain=4, serial gain quadruples', () => {
    const result = buildArenaArtifactFromMultiRepresentationState({ task: baseTask, correctionState: lagState, gain: 4 });
    expect(result.artifact!.params.gain).toBeCloseTo(1, 5);
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
