import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ARENA_CHALLENGE_OBJECTS,
  ARENA_CHALLENGE_TASKS,
  ARENA_LEADERBOARD_POLICIES,
  ARENA_METRIC_PROFILES,
  ARENA_TRAINING_CAPABILITY_LABELS,
  ARENA_TRAINING_STAGE_LABELS,
  getArenaChallengeObject,
  getArenaChallengeTask,
} from '../data/seed-challenges';
import type { ChallengeTask } from '../types';
import {
  getArenaNextChallengeCandidates,
  getArenaTrainingCapabilityGroups,
  getArenaTrainingStageGroups,
} from '../training-map';

describe('arena domain model', () => {
  it('keeps controlled objects separate from challenge tasks', () => {
    expect(ARENA_CHALLENGE_OBJECTS.length).toBeGreaterThanOrEqual(8);
    expect(ARENA_CHALLENGE_TASKS.length).toBeGreaterThanOrEqual(2);

    for (const object of ARENA_CHALLENGE_OBJECTS) {
      expect(object).not.toHaveProperty('leaderboardPolicyId');
      expect(object).not.toHaveProperty('metricProfileId');
    }

    for (const task of ARENA_CHALLENGE_TASKS) {
      expect(getArenaChallengeObject(task.objectId)?.id).toBe(task.objectId);
      expect(task.metricProfileId).toMatch(/^metric-/);
      expect(task.leaderboardPolicyId).toMatch(/^leaderboard-/);
      expect('participantCount' in task).toBe(false);
      expect('topScore' in task).toBe(false);
    }
  });

  it('defines task methods, metric profiles, and leaderboard policies explicitly', () => {
    const methods = new Set(ARENA_CHALLENGE_TASKS.flatMap((task) => task.allowedMethods));

    expect(methods.has('serial-compensator')).toBe(true);
    expect(methods.has('pid')).toBe(true);

    for (const task of ARENA_CHALLENGE_TASKS) {
      expect(task.primaryMetrics.length).toBeGreaterThanOrEqual(4);
      expect(task.primaryMetrics.length).toBeLessThanOrEqual(6);
      expect(task.leaderboardTypes).toContain('main');
      expect(task.leaderboardTypes.length).toBeGreaterThanOrEqual(3);
      expect(typeof task.homeworkEligible).toBe('boolean');
      expect(['open', 'guided', 'project']).toContain(task.practiceMode);
    }
  });

  it('keeps task primary metrics aligned with ranking metric profiles', () => {
    for (const task of ARENA_CHALLENGE_TASKS) {
      const profile = ARENA_METRIC_PROFILES.find((item) => item.id === task.metricProfileId);
      const rankingMetricIds = new Set(profile?.rankingMetrics.map((metric) => metric.id) ?? []);

      for (const metricId of task.primaryMetrics) {
        expect(rankingMetricIds.has(metricId), `${task.id} primary metric ${metricId} must be rankable`).toBe(true);
      }
    }
  });

  it('can resolve a task by id and preserve task-first workspace routing', () => {
    const task = getArenaChallengeTask('task-second-order-lead-pid') as ChallengeTask;

    expect(task.objectId).toBe('plant-second-order-underdamped');
    expect(task.workspaceMode).toBe('multi-representation-linkage');
    expect(task.goal).toContain('调节时间');
  });

  it('covers every required object source with task and evaluation policy records', () => {
    const taskSources = new Set(
      ARENA_CHALLENGE_TASKS
        .map((task) => getArenaChallengeObject(task.objectId)?.source)
        .filter(Boolean),
    );

    expect(Array.from(taskSources)).toEqual(expect.arrayContaining([
      'typical',
      'homework',
      'control-odyssey',
      'virtual-simulation',
    ]));
    expect(ARENA_CHALLENGE_TASKS.length).toBeGreaterThanOrEqual(8);
    expect(ARENA_METRIC_PROFILES.map((profile) => profile.id)).toEqual(expect.arrayContaining([
      'metric-whitebox-time-domain-balanced',
      'metric-homework-margin-balanced',
      'metric-odyssey-growth',
      'metric-virtual-blackbox-closed-loop',
    ]));
    expect(ARENA_LEADERBOARD_POLICIES.flatMap((policy) => policy.types)).toEqual(expect.arrayContaining([
      'main',
      'method',
      'metric',
      'pareto',
      'class',
      'season',
    ]));
  });

  it('allows black-box virtual simulation objects without exposing transfer functions', () => {
    const blackBoxObject = getArenaChallengeObject('plant-cruise-roll-blackbox');
    const blackBoxTask = getArenaChallengeTask('task-cruise-roll-blackbox-identification');

    expect(blackBoxObject?.visibility).toBe('black-box');
    expect(blackBoxObject?.model).toBeUndefined();
    expect(blackBoxObject?.adapterType).toBe('virtual-simulation');
    expect(blackBoxTask?.workspaceMode).toBe('black-box-identification');
    expect(blackBoxTask?.allowedMethods).toContain('black-box-control');
  });

  it('defines a bounded MPC advanced-method task with hidden scenario ranking', () => {
    const mpcTask = getArenaChallengeTask('task-ship-roll-mpc-hidden-scenarios');

    expect(mpcTask?.allowedMethods).toEqual(['mpc']);
    expect(mpcTask?.workspaceMode).toBe('predictive-control');
    expect(mpcTask?.leaderboardTypes).toContain('method');
    expect(mpcTask?.primaryMetrics).toContain('hiddenScenarioWorst');
    expect(ARENA_METRIC_PROFILES.find((profile) => profile.id === mpcTask?.metricProfileId)?.hardConstraints)
      .toContain('hidden_scenarios_passed');
  });

  it('defines a bounded optimization-tuning task for robust PID design', () => {
    const methods = new Set(ARENA_CHALLENGE_TASKS.flatMap((task) => task.allowedMethods));
    const optimizationTask = getArenaChallengeTask('task-ship-roll-optimized-pid-robust');

    expect(methods.has('optimized-pid')).toBe(true);
    expect(optimizationTask?.allowedMethods).toEqual(['optimized-pid']);
    expect(optimizationTask?.workspaceMode).toBe('predictive-control');
    expect(optimizationTask?.primaryMetrics).toContain('hiddenScenarioWorst');
    expect(ARENA_METRIC_PROFILES.find((profile) => profile.id === optimizationTask?.metricProfileId)?.diagnosticMetrics)
      .toContain('optimizationBudget');
  });

  it('covers unstable typical plants with a stabilization challenge', () => {
    const unstableObject = getArenaChallengeObject('plant-unstable-first-order');
    const stabilizationTask = getArenaChallengeTask('task-unstable-first-order-stabilization');

    expect(unstableObject?.source).toBe('typical');
    expect(unstableObject?.visibility).toBe('white-box');
    expect(unstableObject?.model?.display).toContain('s-1');
    expect(stabilizationTask?.objectId).toBe('plant-unstable-first-order');
    expect(stabilizationTask?.title).toContain('镇定');
    expect(stabilizationTask?.allowedMethods).toEqual(expect.arrayContaining(['serial-compensator', 'pid']));
    expect(stabilizationTask?.primaryMetrics).toEqual(expect.arrayContaining(['settlingTime', 'overshoot']));
  });

  it('defines a standalone robust disturbance challenge with hidden-scenario scoring', () => {
    const robustTask = getArenaChallengeTask('task-ship-roll-robust-disturbance');
    const robustProfile = ARENA_METRIC_PROFILES.find((profile) => profile.id === robustTask?.metricProfileId);

    expect(robustTask?.objectId).toBe('plant-ship-roll-whitebox');
    expect(robustTask?.title).toContain('鲁棒');
    expect(robustTask?.allowedMethods).toEqual(expect.arrayContaining(['serial-compensator', 'pid']));
    expect(robustTask?.leaderboardTypes).toEqual(expect.arrayContaining(['main', 'method', 'metric', 'pareto']));
    expect(robustTask?.primaryMetrics).toEqual(expect.arrayContaining(['hiddenScenarioWorst', 'controlEnergy']));
    expect(robustProfile?.hardConstraints).toContain('control_not_saturated');
    expect(robustProfile?.hardConstraints).toContain('hidden_scenarios_passed');
    expect(robustProfile?.rankingMetrics.map((metric) => metric.id)).toEqual(expect.arrayContaining([
      'hiddenScenarioWorst',
      'settlingTime',
      'controlEnergy',
      'overshoot',
    ]));
  });

  it('defines complete training metadata for every challenge task', () => {
    const stageIds = new Set(Object.keys(ARENA_TRAINING_STAGE_LABELS));
    const capabilityIds = new Set(Object.keys(ARENA_TRAINING_CAPABILITY_LABELS));

    for (const task of ARENA_CHALLENGE_TASKS) {
      expect(task.training.stage, `${task.id} training stage`).toSatisfy((stage: string) => stageIds.has(stage));
      expect(task.training.estimatedEffortMinutes, `${task.id} effort`).toBeGreaterThan(0);
      expect(task.training.goal, `${task.id} training goal`).toEqual(expect.any(String));
      expect(task.training.capabilityTags.length, `${task.id} capability tags`).toBeGreaterThan(0);
      expect(task.training.commonFailurePoints.length, `${task.id} failure points`).toBeGreaterThan(0);
      expect(task.training.hiddenTestSignal, `${task.id} hidden test signal`).toEqual(expect.any(String));

      for (const capability of task.training.capabilityTags) {
        expect(capabilityIds.has(capability), `${task.id} capability ${capability} is registered`).toBe(true);
      }
      for (const prerequisite of task.training.prerequisiteCapabilityTags) {
        expect(capabilityIds.has(prerequisite), `${task.id} prerequisite ${prerequisite} is registered`).toBe(true);
      }
    }
  });

  it('derives training stage groups, capability groups, and next challenge candidates', () => {
    const stageGroups = getArenaTrainingStageGroups(ARENA_CHALLENGE_TASKS);
    const capabilityGroups = getArenaTrainingCapabilityGroups(ARENA_CHALLENGE_TASKS);
    const foundationTask = getArenaChallengeTask('task-second-order-lead-pid') as ChallengeTask;
    const nextCandidates = getArenaNextChallengeCandidates(foundationTask, ARENA_CHALLENGE_TASKS);

    expect(stageGroups.map((group) => group.stage)).toContain('foundation');
    expect(stageGroups.find((group) => group.stage === 'robust-advanced')?.tasks.map((task) => task.id)).toEqual(expect.arrayContaining([
      'task-ship-roll-mpc-hidden-scenarios',
      'task-ship-roll-optimized-pid-robust',
      'task-ship-roll-robust-disturbance',
    ]));
    expect(capabilityGroups.find((group) => group.capability === 'hidden-scenario-robustness')?.tasks.length).toBeGreaterThanOrEqual(3);
    expect(nextCandidates.map((task) => task.id)).toContain('task-integrator-low-frequency-balance');
    expect(nextCandidates.map((task) => task.id)).not.toContain('task-delay-robust-pareto');

    const delayTask = getArenaChallengeTask('task-delay-robust-pareto') as ChallengeTask;
    expect(getArenaNextChallengeCandidates(foundationTask, [foundationTask, delayTask])).toEqual([]);
  });

  it('links related knowledge to real runtime knowledge graph nodes', () => {
    const nodes = JSON.parse(
      readFileSync(join(process.cwd(), 'course-content/runtime/knowledge/graph/nodes.json'), 'utf8'),
    ) as Array<{ id: string }>;
    const nodeIds = new Set(nodes.map((node) => node.id));

    for (const object of ARENA_CHALLENGE_OBJECTS) {
      expect(object.relatedKnowledge.length, `${object.id} should declare related knowledge`).toBeGreaterThan(0);
      for (const item of object.relatedKnowledge as unknown[]) {
        expect(item, `${object.id} related knowledge must use node refs`).toEqual(expect.objectContaining({
          label: expect.any(String),
          nodeId: expect.any(String),
        }));
        expect(nodeIds.has((item as { nodeId: string }).nodeId), `${object.id} nodeId exists`).toBe(true);
      }
    }
  });

  it('provides LaTeX model expressions for every white-box transfer-function object', () => {
    const whiteBoxTransferObjects = ARENA_CHALLENGE_OBJECTS.filter((object) =>
      object.visibility === 'white-box' && object.modelType === 'transfer-function'
    );

    expect(whiteBoxTransferObjects.length).toBeGreaterThan(0);
    for (const object of whiteBoxTransferObjects) {
      expect(object.model?.latex, `${object.id} model latex`).toEqual(expect.stringContaining('\\frac'));
    }
  });
});
