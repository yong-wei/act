import { describe, expect, it, vi } from 'vitest';

import { hashControllerArtifact } from '../submissions/artifact-hash';
import { createArenaSubmission } from '../submissions/submission-service';
import { createPersistedArenaSubmission } from '../submissions/persistence';
import type { StoredArenaEvaluation } from '../submissions/persistence';
import { buildArenaLeaderboard } from '../leaderboards/leaderboard';
import { getChallengeLeaderboardBrowserViewModel } from '../leaderboards/leaderboard-service';
import { buildArenaTaskStats, filterArenaSubmissionsForHallStats } from '../stats';
import { ARENA_CORE_EVENT_TYPES, buildArenaCoreEvent, buildArenaInteractionEvent } from '../telemetry';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import type { ControllerArtifact } from '../types';

const pidArtifact: ControllerArtifact = {
  id: 'artifact-a',
  taskId: 'task-second-order-lead-pid',
  method: 'pid',
  params: { kp: 2.4, ki: 0.8, kd: 0.35 },
  createdAt: '2026-05-10T10:00:00.000Z',
};

describe('arena submissions and leaderboards', () => {
  it('hashes controller artifacts independent of parameter key order', async () => {
    const reordered: ControllerArtifact = {
      ...pidArtifact,
      params: { kd: 0.35, kp: 2.4, ki: 0.8 },
    };

    expect(hashControllerArtifact(pidArtifact)).toBe(hashControllerArtifact(reordered));
    expect(hashControllerArtifact(pidArtifact)).toMatch(/^artifact-[a-f0-9]{64}$/);
  });

  it('reuses duplicate evaluation results for identical task and controller artifact', async () => {
    const first = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const second = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: { ...pidArtifact, id: 'artifact-b' },
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [first],
    });

    expect(second.reusedEvaluation).toBe(true);
    expect(second.evaluation.score).toBe(first.evaluation.score);
    expect(second.artifactHash).toBe(first.artifactHash);
  });

  it('orders main and method leaderboards by score and stable tie breakers', async () => {
    const good = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const weaker = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-c',
        params: { kp: 0.8, ki: 0.1, kd: 0 },
      },
      studentLabel: '学生乙',
      submittedAt: '2026-05-10T10:03:00.000Z',
      existingSubmissions: [good],
    });

    const main = buildArenaLeaderboard([weaker, good], { taskId: 'task-second-order-lead-pid', type: 'main' });
    const method = buildArenaLeaderboard([weaker, good], { taskId: 'task-second-order-lead-pid', type: 'method', method: 'pid' });

    expect(main.entries[0]?.studentLabel).toBe('学生甲');
    expect(main.entries[0]?.rank).toBe(1);
    expect(method.entries).toHaveLength(2);
    expect(method.entries.every((entry) => entry.method === 'pid')).toBe(true);
  });

  it('uses leaderboard policy metric tie breakers before submitted time', async () => {
    const first = await createArenaSubmission({
      taskId: 'task-integrator-low-frequency-balance',
      artifact: {
        ...pidArtifact,
        id: 'artifact-tie-a',
        taskId: 'task-integrator-low-frequency-balance',
        params: { kp: 1.6, ki: 0.4, kd: 0.12 },
      },
      studentLabel: '误差较大',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const second = await createArenaSubmission({
      taskId: 'task-integrator-low-frequency-balance',
      artifact: {
        ...pidArtifact,
        id: 'artifact-tie-b',
        taskId: 'task-integrator-low-frequency-balance',
        params: { kp: 1.8, ki: 0.6, kd: 0.12 },
      },
      studentLabel: '误差较小',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [first],
    });
    first.evaluation.score = 80;
    second.evaluation.score = 80;
    first.evaluation.metrics.steadyStateError = 0.08;
    second.evaluation.metrics.steadyStateError = 0.03;

    const leaderboard = buildArenaLeaderboard([first, second], {
      taskId: 'task-integrator-low-frequency-balance',
      type: 'main',
    });

    expect(leaderboard.entries[0]?.studentLabel).toBe('误差较小');
  });

  it('keeps only each student best submission on the main leaderboard', async () => {
    const first = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-repeat-a',
        params: { kp: 0.8, ki: 0.1, kd: 0 },
      },
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const improved = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [first],
    });
    const other = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-repeat-b',
        params: { kp: 1.2, ki: 0.2, kd: 0.05 },
      },
      studentLabel: '学生乙',
      submittedAt: '2026-05-10T10:03:00.000Z',
      existingSubmissions: [first, improved],
    });

    const leaderboard = buildArenaLeaderboard([
      { ...first, userId: 'student-a' },
      { ...improved, userId: 'student-a' },
      { ...first, userId: 'student-a' },
      { ...other, userId: 'student-b' },
    ], { taskId: 'task-second-order-lead-pid', type: 'main' });

    expect(leaderboard.entries).toHaveLength(2);
    expect(leaderboard.entries.map((entry) => entry.studentLabel)).toContain('学生甲');
    expect(leaderboard.entries.find((entry) => entry.studentLabel === '学生甲')?.submissionId).toBe(improved.id);
  });

  it('orders metric leaderboards by the selected metric instead of main score', async () => {
    const highScoreHighEnergy = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '高分高能耗',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const lowScoreLowEnergy = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-metric-low-energy',
        params: { kp: 1.1, ki: 0.2, kd: 0.05 },
      },
      studentLabel: '低能耗',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [highScoreHighEnergy],
    });
    highScoreHighEnergy.evaluation.score = 95;
    highScoreHighEnergy.evaluation.metrics.controlEnergy = 14;
    lowScoreLowEnergy.evaluation.score = 78;
    lowScoreLowEnergy.evaluation.metrics.controlEnergy = 3;

    const leaderboard = buildArenaLeaderboard([highScoreHighEnergy, lowScoreLowEnergy], {
      taskId: 'task-second-order-lead-pid',
      type: 'metric',
      metricId: 'controlEnergy',
    } as any);

    expect(leaderboard.entries[0]).toMatchObject({
      studentLabel: '低能耗',
      metricId: 'controlEnergy',
      metricValue: 3,
    });
  });

  it('excludes hard-constraint failures from official leaderboards', async () => {
    const valid = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '有效方案',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const invalid = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-invalid-low-energy',
        params: { kp: 0, ki: 0, kd: 0 },
      },
      studentLabel: '无效低能耗方案',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [valid],
    });
    valid.evaluation.valid = true;
    valid.evaluation.metrics.controlEnergy = 8;
    invalid.evaluation.valid = false;
    invalid.evaluation.metrics.controlEnergy = 0.1;

    const leaderboard = buildArenaLeaderboard([invalid, valid], {
      taskId: 'task-second-order-lead-pid',
      type: 'metric',
      metricId: 'controlEnergy',
    } as any);

    expect(leaderboard.entries.map((entry) => entry.studentLabel)).toEqual(['有效方案']);
  });

  it('classifies Pareto front entries and records dominance evidence', async () => {
    const fast = await createArenaSubmission({
      taskId: 'task-delay-robust-pareto',
      artifact: {
        ...pidArtifact,
        id: 'artifact-pareto-fast',
        taskId: 'task-delay-robust-pareto',
        params: { kp: 2.6, ki: 0.5, kd: 0.25 },
      },
      studentLabel: '快速方案',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const efficient = await createArenaSubmission({
      taskId: 'task-delay-robust-pareto',
      artifact: {
        ...pidArtifact,
        id: 'artifact-pareto-efficient',
        taskId: 'task-delay-robust-pareto',
        params: { kp: 1.2, ki: 0.25, kd: 0.05 },
      },
      studentLabel: '低能耗方案',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [fast],
    });
    const dominated = await createArenaSubmission({
      taskId: 'task-delay-robust-pareto',
      artifact: {
        ...pidArtifact,
        id: 'artifact-pareto-dominated',
        taskId: 'task-delay-robust-pareto',
        params: { kp: 0.7, ki: 0.05, kd: 0 },
      },
      studentLabel: '被支配方案',
      submittedAt: '2026-05-10T10:03:00.000Z',
      existingSubmissions: [fast, efficient],
    });
    fast.evaluation.metrics = { settlingTime: 2, overshoot: 9, steadyStateError: 0.02, itae: 3, controlEnergy: 12 };
    efficient.evaluation.metrics = { settlingTime: 4, overshoot: 8, steadyStateError: 0.02, itae: 4, controlEnergy: 3 };
    dominated.evaluation.metrics = { settlingTime: 6, overshoot: 20, steadyStateError: 0.08, itae: 8, controlEnergy: 18 };
    fast.evaluation.valid = true;
    efficient.evaluation.valid = true;
    dominated.evaluation.valid = true;
    dominated.evaluation.score = 99;

    const leaderboard = buildArenaLeaderboard([dominated, fast, efficient], {
      taskId: 'task-delay-robust-pareto',
      type: 'pareto',
      metricIds: ['settlingTime', 'overshoot', 'steadyStateError', 'controlEnergy'],
    } as any);

    expect(leaderboard.entries.slice(0, 2).map((entry) => entry.paretoTier)).toEqual([1, 1]);
    expect(leaderboard.entries.slice(0, 2).map((entry) => entry.studentLabel)).toEqual(expect.arrayContaining([
      '快速方案',
      '低能耗方案',
    ]));
    expect(leaderboard.entries.find((entry) => entry.studentLabel === '被支配方案')).toMatchObject({
      paretoTier: 2,
      dominanceCount: 2,
    });
    expect(leaderboard.entries.find((entry) => entry.studentLabel === '被支配方案')?.dominatedBySubmissionIds).toEqual(
      expect.arrayContaining([fast.id, efficient.id]),
    );
  });

  it('filters class and season leaderboards by persisted submission scope', async () => {
    const classA = {
      ...(await createArenaSubmission({
        taskId: 'task-integrator-low-frequency-balance',
        artifact: {
          ...pidArtifact,
          id: 'artifact-class-a',
          taskId: 'task-integrator-low-frequency-balance',
        },
        studentLabel: '甲班学生',
        submittedAt: '2026-05-10T10:01:00.000Z',
        existingSubmissions: [],
      })),
      classId: 'class-a',
      seasonId: 'spring-2026',
    };
    const classB = {
      ...(await createArenaSubmission({
        taskId: 'task-integrator-low-frequency-balance',
        artifact: {
          ...pidArtifact,
          id: 'artifact-class-b',
          taskId: 'task-integrator-low-frequency-balance',
          params: { kp: 1.4, ki: 0.2, kd: 0.05 },
        },
        studentLabel: '乙班学生',
        submittedAt: '2026-05-10T10:02:00.000Z',
        existingSubmissions: [classA],
      })),
      classId: 'class-b',
      seasonId: 'spring-2026',
    };
    const otherSeason = {
      ...classA,
      id: 'submission-other-season',
      studentLabel: '旧赛季学生',
      seasonId: 'winter-2025',
    };

    expect(buildArenaLeaderboard([classA, classB, otherSeason], {
      taskId: 'task-integrator-low-frequency-balance',
      type: 'class',
      classId: 'class-a',
    } as any).entries.map((entry) => entry.studentLabel)).toEqual(['甲班学生', '旧赛季学生']);

    expect(buildArenaLeaderboard([classA, classB, otherSeason], {
      taskId: 'task-integrator-low-frequency-balance',
      type: 'season',
      seasonId: 'spring-2026',
    } as any).entries.map((entry) => entry.studentLabel)).toEqual(expect.arrayContaining([
      '甲班学生',
      '乙班学生',
    ]));
    expect(buildArenaLeaderboard([classA, classB, otherSeason], {
      taskId: 'task-integrator-low-frequency-balance',
      type: 'season',
      seasonId: 'spring-2026',
    } as any).entries.map((entry) => entry.studentLabel)).not.toContain('旧赛季学生');

    expect(buildArenaLeaderboard([classA, classB], {
      taskId: 'task-integrator-low-frequency-balance',
      type: 'class',
    } as any).entries).toEqual([]);
    expect(buildArenaLeaderboard([classA, classB], {
      taskId: 'task-integrator-low-frequency-balance',
      type: 'season',
    } as any).entries).toEqual([]);
  });

  it('requires an explicit method for method leaderboard filtering', async () => {
    const pid = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: 'PID 学生',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const serial = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-serial-method',
        method: 'serial-compensator',
        params: { gain: 2, zero: 1, pole: 4 },
      },
      studentLabel: '串联校正学生',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [pid],
    });
    const composite = await createArenaSubmission({
      taskId: 'task-third-order-block-diagram',
      artifact: {
        id: 'artifact-composite-leaderboard',
        taskId: 'task-third-order-block-diagram',
        method: 'composite-compensation',
        params: {
          structure: 'prefilter-forward-local-feedback-disturbance',
          prefilterGain: 0.9,
          forwardGain: 2.2,
          localFeedbackGain: 0.7,
          disturbanceCompensation: 0.4,
        },
        createdAt: '2026-05-10T10:00:00.000Z',
      },
      studentLabel: '复合校正学生',
      submittedAt: '2026-05-10T10:03:00.000Z',
      existingSubmissions: [],
    });

    expect(buildArenaLeaderboard([pid, serial], {
      taskId: 'task-second-order-lead-pid',
      type: 'method',
    } as any).entries).toEqual([]);
    expect(buildArenaLeaderboard([pid, serial], {
      taskId: 'task-second-order-lead-pid',
      type: 'method',
      method: 'pid',
    }).entries.map((entry) => entry.studentLabel)).toEqual(['PID 学生']);
    expect(buildArenaLeaderboard([composite], {
      taskId: 'task-third-order-block-diagram',
      type: 'method',
      method: 'composite-compensation',
    }).entries.map((entry) => entry.studentLabel)).toEqual(['复合校正学生']);
  });

  it('builds challenge-detail leaderboard groups with student numbers and selected metrics', async () => {
    const pid = {
      ...(await createArenaSubmission({
        taskId: 'task-second-order-lead-pid',
        artifact: pidArtifact,
        studentLabel: '学生甲',
        submittedAt: '2026-05-10T10:01:00.000Z',
        existingSubmissions: [],
      })),
      userId: 'student-a',
      studentNumber: '2026001',
    };
    const serial = {
      ...(await createArenaSubmission({
        taskId: 'task-second-order-lead-pid',
        artifact: {
          ...pidArtifact,
          id: 'artifact-browser-serial',
          method: 'serial-compensator',
          params: { gain: 2, zero: 1, pole: 4 },
        },
        studentLabel: '学生乙',
        submittedAt: '2026-05-10T10:02:00.000Z',
        existingSubmissions: [pid],
      })),
      userId: 'student-b',
    };
    const invalid = {
      ...serial,
      id: 'invalid-browser-row',
      studentLabel: '无效学生',
      evaluation: {
        ...serial.evaluation,
        valid: false,
      },
    };
    pid.evaluation.score = 80;
    serial.evaluation.score = 70;
    pid.evaluation.metrics.itae = 8;
    serial.evaluation.metrics.itae = 3;

    const methodView = getChallengeLeaderboardBrowserViewModel({
      taskId: 'task-second-order-lead-pid',
      submissions: [invalid, serial, pid],
      selectedType: 'method',
      selectedMethod: 'pid',
    });
    const metricView = getChallengeLeaderboardBrowserViewModel({
      taskId: 'task-second-order-lead-pid',
      submissions: [invalid, serial, pid],
      selectedType: 'metric',
      selectedMetricId: 'itae',
    });

    expect(methodView.categories.map((category) => category.type)).toEqual(['main', 'method', 'metric']);
    expect(methodView.methodOptions.map((option) => option.id)).toContain('pid');
    expect(methodView.metricOptions.map((option) => option.id)).toContain('itae');
    expect(methodView.current.entries).toHaveLength(1);
    expect(methodView.current.entries[0]).toMatchObject({
      studentName: '学生甲',
      studentNumber: '2026001',
      studentNumberLabel: '2026001',
      methodLabel: 'PID',
      score: 80,
    });
    expect(methodView.current.showMethodColumn).toBe(false);
    expect(methodView.current.entries[0]?.metrics.map((metric) => metric.id)).toEqual([
      'settlingTime',
      'overshoot',
      'steadyStateError',
    ]);
    expect(metricView.current.selectedSubId).toBe('itae');
    expect(metricView.current.showMethodColumn).toBe(true);
    expect(metricView.current.entries.map((entry) => entry.studentName)).toEqual(['学生乙', '学生甲']);
    expect(metricView.current.entries[0]?.metrics).toEqual([
      expect.objectContaining({ id: 'itae', value: 3 }),
    ]);
    expect(metricView.current.entries.map((entry) => entry.studentName)).not.toContain('无效学生');
  });

  it('defines core Arena telemetry events compatible with the L0 event boundary', async () => {
    expect(ARENA_CORE_EVENT_TYPES).toEqual([
      'arena_challenge_open',
      'arena_workspace_start',
      'arena_simulation_run',
      'arena_controller_save',
      'arena_identification_model_save',
      'arena_virtual_simulation_import',
      'arena_submit',
      'arena_evaluation_complete',
      'arena_result_view',
      'arena_leaderboard_view',
      'arena_feedback_view',
    ]);

    expect(buildArenaCoreEvent('arena_submit', {
      taskId: 'task-second-order-lead-pid',
      score: 88.6,
    })).toMatchObject({
      type: 'arena_submit',
      resourceKey: 'arena:task-second-order-lead-pid',
      priority: 'core',
    });
    for (const eventType of ARENA_CORE_EVENT_TYPES) {
      expect(isCoreEvent(eventType)).toBe(true);
    }

    expect(buildArenaInteractionEvent('arena_evaluation_complete', {
      taskId: 'task-second-order-lead-pid',
      score: 88.6,
      valid: true,
      method: 'pid',
      originPath: '/arena/challenges/task-second-order-lead-pid',
    }, 1770000000000)).toMatchObject({
      id: 'arena_evaluation_complete:task-second-order-lead-pid:1770000000000',
      type: 'arena_evaluation_complete',
      resourceKey: 'arena:task-second-order-lead-pid',
      timestamp: 1770000000000,
      data: {
        eventType: 'arena_evaluation_complete',
        taskId: 'task-second-order-lead-pid',
        score: 88.6,
        valid: true,
        method: 'pid',
        originPath: '/arena/challenges/task-second-order-lead-pid',
        pageType: 'workspace',
      },
    });
  });

  it('reuses official evaluations from the persistence store instead of route-local memory', async () => {
    const calls: string[] = [];
    const evaluationRows = new Map<string, StoredArenaEvaluation>();
    const artifactHash = hashControllerArtifact(pidArtifact);
    evaluationRows.set(`${pidArtifact.taskId}:${artifactHash}:template-whitebox-v1`, {
      id: 'eval-legacy-template',
      taskId: pidArtifact.taskId,
      artifactHash,
      protocolVersion: 'template-whitebox-v1',
      result: {
        taskId: pidArtifact.taskId,
        artifact: pidArtifact,
        valid: true,
        score: 12,
        metrics: { settlingTime: 8, overshoot: 20, steadyStateError: 0.08, itae: 9 },
        satisfaction: {},
        hardConstraintResults: [],
        penalties: [],
        explanation: ['legacy template cache'],
      },
      completedAt: '2026-05-10T09:00:00.000Z',
    });
    const store = {
      findEvaluationByHash: vi.fn(async (taskId: string, hash: string, protocolVersion: string) =>
        evaluationRows.get(`${taskId}:${hash}:${protocolVersion}`) ?? null,
      ),
      createEvaluation: vi.fn(async (evaluation: Omit<StoredArenaEvaluation, 'id'>) => {
        calls.push('createEvaluation');
        const row = { ...evaluation, id: 'eval-created' };
        evaluationRows.set(`${evaluation.taskId}:${evaluation.artifactHash}:${evaluation.protocolVersion}`, row);
        return row;
      }),
      upsertArtifact: vi.fn(async (artifact) => {
        calls.push('upsertArtifact');
        return { ...artifact, id: 'artifact-row' };
      }),
      createSubmission: vi.fn(async (submission) => {
        calls.push('createSubmission');
        return { ...submission, id: `stored-${calls.length}` };
      }),
    };

    const first = await createPersistedArenaSubmission({
      taskId: pidArtifact.taskId,
      artifact: pidArtifact,
      userId: 'student-1',
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:01:00.000Z',
      store,
    });
    const second = await createPersistedArenaSubmission({
      taskId: pidArtifact.taskId,
      artifact: { ...pidArtifact, id: 'artifact-duplicate' },
      userId: 'student-1',
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:02:00.000Z',
      store,
    });

    expect(first.reusedEvaluation).toBe(false);
    expect(second.reusedEvaluation).toBe(true);
    expect(store.findEvaluationByHash).toHaveBeenCalledWith(pidArtifact.taskId, artifactHash, 'analysis-whitebox-v1');
    expect(store.createEvaluation).toHaveBeenCalledTimes(1);
    expect(store.createEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      protocolVersion: 'analysis-whitebox-v1',
    }));
    expect(store.createSubmission).toHaveBeenCalledTimes(2);
  });

  it('builds task stats from real submissions and leaves empty tasks without fake scores', async () => {
    const first = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const second = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: { ...pidArtifact, id: 'artifact-stats-b', params: { kp: 1.1, ki: 0.2, kd: 0.08 } },
      studentLabel: '学生乙',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [first],
    });

    const stats = buildArenaTaskStats([first, second], [
      'task-second-order-lead-pid',
      'task-ship-roll-comfort',
    ]);

    expect(stats['task-second-order-lead-pid']).toMatchObject({
      participantCount: 2,
      submissionCount: 2,
    });
    expect(stats['task-second-order-lead-pid']?.topScore).toBe(Math.max(first.evaluation.score, second.evaluation.score));
    expect(stats['task-ship-roll-comfort']).toEqual({
      participantCount: 0,
      submissionCount: 0,
      topScore: null,
    });
  });

  it('excludes hidden publication submissions from hall stats before the deadline', async () => {
    const hidden = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '学生甲',
      publicationId: 'publication-hidden',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const open = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: { ...pidArtifact, id: 'artifact-visible', params: { kp: 1.1, ki: 0.2, kd: 0.08 } },
      studentLabel: '学生乙',
      publicationId: 'publication-open',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [hidden],
    });

    const visible = filterArenaSubmissionsForHallStats([hidden, open], [
      {
        id: 'publication-hidden',
        deadline: '2026-06-01T15:00:00.000Z',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      },
      {
        id: 'publication-open',
        deadline: '2026-06-01T15:00:00.000Z',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: false },
      },
    ], new Date('2026-05-15T10:00:00.000Z'));

    const stats = buildArenaTaskStats(visible, ['task-second-order-lead-pid']);

    expect(visible.map((submission) => submission.id)).toEqual([open.id]);
    expect(stats['task-second-order-lead-pid']).toMatchObject({
      participantCount: 1,
      submissionCount: 1,
    });
  });
});
