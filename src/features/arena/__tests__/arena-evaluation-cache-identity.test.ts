import { describe, expect, it } from 'vitest';

import { runtimeIdentity } from '@/lib/control-engine';
import { getArenaChallengeTask, getArenaMetricProfile } from '../data/seed-challenges';
import {
  arenaEvaluationCacheBindingConflicts,
  isCompleteArenaEvaluationCacheIdentity,
  resolveArenaEvaluationCacheBinding,
  withArenaEvaluationCacheBinding,
} from '../submissions/evaluation-cache-identity';

describe('arena evaluation cache identity', () => {
  it('requires task, artifact, and protocol identity together', () => {
    expect(isCompleteArenaEvaluationCacheIdentity({
      taskId: 'task-1',
      artifactHash: 'hash-1',
      protocolVersion: 'analysis-whitebox-v1',
    })).toBe(true);
    expect(isCompleteArenaEvaluationCacheIdentity({
      taskId: 'task-1',
      artifactHash: 'hash-1',
      protocolVersion: '',
    })).toBe(false);
    expect(isCompleteArenaEvaluationCacheIdentity({
      taskId: 'task-1',
      artifactHash: '',
      protocolVersion: 'analysis-whitebox-v1',
    })).toBe(false);
    expect(isCompleteArenaEvaluationCacheIdentity({
      taskId: null,
      artifactHash: 'hash-1',
      protocolVersion: 'analysis-whitebox-v1',
    })).toBe(false);
  });

  it('does not treat historical rows without runtime/model/spec metadata as a conflict', () => {
    const current = resolveArenaEvaluationCacheBinding('task-second-order-lead-pid');
    expect(arenaEvaluationCacheBindingConflicts({}, current)).toBe(false);
    expect(arenaEvaluationCacheBindingConflicts({ protocolVersion: 'analysis-whitebox-v1' }, current)).toBe(false);
  });

  it('treats a stored runtime, model, or spec binding mismatch as a cache miss', () => {
    const current = resolveArenaEvaluationCacheBinding('task-second-order-lead-pid');
    const identity = runtimeIdentity();
    expect(current.runtimeBuildHash).toBe(identity.buildHash);
    expect(arenaEvaluationCacheBindingConflicts(
      withArenaEvaluationCacheBinding(undefined, current),
      current,
    )).toBe(false);
    expect(arenaEvaluationCacheBindingConflicts(
      withArenaEvaluationCacheBinding(undefined, {
        ...current,
        runtimeBuildHash: 'stale-control-engine-build',
      }),
      current,
    )).toBe(true);
    expect(arenaEvaluationCacheBindingConflicts(
      withArenaEvaluationCacheBinding(undefined, {
        ...current,
        modelIdentity: 'different-plant-model',
      }),
      current,
    )).toBe(true);
    expect(arenaEvaluationCacheBindingConflicts(
      withArenaEvaluationCacheBinding(undefined, {
        ...current,
        specIdentity: 'different-task-spec',
      }),
      current,
    )).toBe(true);
  });

  it('binds the actual metric profile constraints and ranking thresholds into spec identity', () => {
    const task = getArenaChallengeTask('task-second-order-lead-pid');
    const profile = task ? getArenaMetricProfile(task.metricProfileId) : undefined;
    expect(task).toBeDefined();
    expect(profile).toBeDefined();
    const specIdentity = resolveArenaEvaluationCacheBinding('task-second-order-lead-pid').specIdentity;
    expect(specIdentity).toContain(profile!.hardConstraints[0]);
    expect(specIdentity).toContain(String(profile!.rankingMetrics[0].idealValue));
    expect(specIdentity).toContain(String(profile!.rankingMetrics[0].unacceptableValue));
    expect(specIdentity).not.toContain('cruise-roll-hidden-official-v1');
  });

  it('binds the official hidden scenario set into black-box spec identity', () => {
    const specIdentity = resolveArenaEvaluationCacheBinding(
      'task-cruise-roll-blackbox-identification',
    ).specIdentity;
    expect(specIdentity).toContain('cruise-roll-hidden-official-v1');
    expect(specIdentity).toContain('official-hidden-2');
    expect(specIdentity).toContain('0.085');
  });
});
