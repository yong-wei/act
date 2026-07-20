import { describe, expect, it, vi } from 'vitest';

import { hashControllerArtifact } from '../submissions/artifact-hash';
import { createArenaSubmission as createArenaSubmissionRecord } from '../submissions/submission-service';
import type { CreateArenaSubmissionInput } from '../submissions/submission-service';
import { createPersistedArenaSubmission } from '../submissions/persistence';
import type { StoredArenaEvaluation } from '../submissions/persistence';
import { buildArenaSubmissionEvidenceWriteback } from '../evidence-writeback';
import { buildArenaLeaderboard } from '../leaderboards/leaderboard';
import { getChallengeLeaderboardBrowserViewModel } from '../leaderboards/leaderboard-service';
import { buildArenaLeaderboardHonors, buildArenaShowcaseSummaries } from '../leaderboards/honors-showcase';
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

async function createArenaSubmission(input: CreateArenaSubmissionInput) {
  const submission = await createArenaSubmissionRecord(input);
  return {
    ...submission,
    evidenceWriteback: testEvidenceWriteback(submission),
  };
}

function acceptedTestWriteback(submission: Awaited<ReturnType<typeof createArenaSubmissionRecord>>) {
  return {
    status: 'accepted' as const,
    sourceRef: { kind: 'ArenaSubmission' as const, id: submission.id },
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

function testEvidenceWriteback(submission: Awaited<ReturnType<typeof createArenaSubmissionRecord>>) {
  if (
    !submission.isLate &&
    !submission.reusedEvaluation
  ) {
    return acceptedTestWriteback(submission);
  }
  return buildArenaSubmissionEvidenceWriteback({
    ...submission,
    userId: submission.userId ?? 'student-test',
  });
}

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
    good.evaluation.valid = true;
    good.evaluation.score = 90;
    weaker.evaluation.valid = true;
    weaker.evaluation.score = 70;

    const main = buildArenaLeaderboard([weaker, good], { taskId: 'task-second-order-lead-pid', type: 'main' });
    const method = buildArenaLeaderboard([weaker, good], { taskId: 'task-second-order-lead-pid', type: 'method', method: 'pid' });

    expect(main.entries[0]?.studentLabel).toBe('学生甲');
    expect(main.entries[0]?.rank).toBe(1);
    expect(method.entries).toHaveLength(2);
    expect(method.entries.every((entry) => entry.method === 'pid')).toBe(true);
  });

  it('keeps legacy effective submissions without persisted writeback on leaderboards', async () => {
    const legacy = await createArenaSubmissionRecord({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '历史有效成绩',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    legacy.evaluation.valid = true;
    legacy.evaluation.score = 82;

    const leaderboard = buildArenaLeaderboard([legacy], {
      taskId: 'task-second-order-lead-pid',
      type: 'main',
    });
    const stats = buildArenaTaskStats([legacy], ['task-second-order-lead-pid']);

    expect(leaderboard.entries).toHaveLength(1);
    expect(leaderboard.entries[0]?.studentLabel).toBe('历史有效成绩');
    expect(stats['task-second-order-lead-pid']).toMatchObject({
      participantCount: 1,
      submissionCount: 1,
      topScore: 82,
    });
  });

  it('keeps effective non-KAQ-bound task submissions ranked while leaving writeback degraded', async () => {
    const unboundTaskSubmission = await createArenaSubmissionRecord({
      taskId: 'task-integrator-low-frequency-balance',
      artifact: {
        ...pidArtifact,
        id: 'artifact-unbound-task',
        taskId: 'task-integrator-low-frequency-balance',
        params: { kp: 1.8, ki: 0.6, kd: 0.12 },
      },
      studentLabel: '未绑定 KAQ 任务有效成绩',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [],
    });
    unboundTaskSubmission.evaluation.valid = true;
    unboundTaskSubmission.evaluation.score = 84;
    const evidenceWriteback = buildArenaSubmissionEvidenceWriteback({
      ...unboundTaskSubmission,
      userId: 'student-unbound-task',
    }, { consumer: 'service' });

    const leaderboard = buildArenaLeaderboard([{
      ...unboundTaskSubmission,
      evidenceWriteback,
    }], {
      taskId: 'task-integrator-low-frequency-balance',
      type: 'main',
    });

    expect(evidenceWriteback).toMatchObject({
      status: 'degraded',
      visibilityState: 'diagnostic-only',
      limitationCodes: ['missing-target-binding'],
      terminalValidationAccepted: false,
    });
    expect(leaderboard.entries).toHaveLength(1);
    expect(leaderboard.entries[0]?.score).toBe(84);
  });

  it('excludes intrinsically effective submissions with blocked persisted writeback', async () => {
    const blocked = await createArenaSubmissionRecord({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '阻塞写回成绩',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    blocked.evaluation.valid = true;
    blocked.evaluation.score = 86;

    const leaderboard = buildArenaLeaderboard([{
      ...blocked,
      evidenceWriteback: {
        status: 'blocked',
        sourceRef: { kind: 'ArenaSubmission', id: blocked.id },
        attemptStatus: 'effective',
        visibilityState: 'unavailable',
        targetLabel: '控制校正 Arena 官方迁移验证',
        summary: '官方提交尚未读取到持久化证据回流结果，暂不作为掌握证据。',
        recoveryAction: '等待证据回流完成。',
        limitationCodes: ['missing-persisted-writeback'],
        overlayCount: 0,
        terminalValidationAccepted: false,
      },
    }], {
      taskId: 'task-second-order-lead-pid',
      type: 'main',
    });

    expect(leaderboard.entries).toHaveLength(0);
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
    first.evaluation.valid = true;
    first.evaluation.score = 55;
    improved.evaluation.valid = true;
    improved.evaluation.score = 88;
    other.evaluation.valid = true;
    other.evaluation.score = 72;

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
    highScoreHighEnergy.evaluation.valid = true;
    highScoreHighEnergy.evaluation.metrics.controlEnergy = 14;
    lowScoreLowEnergy.evaluation.score = 78;
    lowScoreLowEnergy.evaluation.valid = true;
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
    valid.evaluation.score = 80;
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

  it('excludes late and zero-score submissions from official leaderboards', async () => {
    const effective = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '有效排名方案',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const zeroScore = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-zero-score',
        params: { kp: 0.8, ki: 0.1, kd: 0 },
      },
      studentLabel: '零分有效方案',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [effective],
    });
    const lateHighScore = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-late-high-score',
        params: { kp: 3.1, ki: 1.1, kd: 0.5 },
      },
      studentLabel: '迟交高分方案',
      submittedAt: '2026-05-10T10:03:00.000Z',
      existingSubmissions: [effective, zeroScore],
    });
    effective.evaluation.valid = true;
    effective.evaluation.score = 82;
    zeroScore.evaluation.valid = true;
    zeroScore.evaluation.score = 0;
    lateHighScore.evaluation.valid = true;
    lateHighScore.evaluation.score = 99;
    lateHighScore.isLate = true;

    const leaderboard = buildArenaLeaderboard([lateHighScore, zeroScore, effective], {
      taskId: 'task-second-order-lead-pid',
      type: 'main',
    });

    expect(leaderboard.entries.map((entry) => entry.studentLabel)).toEqual(['有效排名方案']);
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
    fast.evaluation.score = 92;
    efficient.evaluation.score = 90;
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
    classA.evaluation.valid = true;
    classA.evaluation.score = 82;
    classB.evaluation.valid = true;
    classB.evaluation.score = 78;

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
    pid.evaluation.valid = true;
    pid.evaluation.score = 80;
    serial.evaluation.valid = true;
    serial.evaluation.score = 76;
    composite.evaluation.valid = true;
    composite.evaluation.score = 84;

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

  it('builds challenge-detail browser views for Pareto, class, and season contexts', async () => {
    const paretoFront = {
      id: 'submission-browser-pareto-front',
      taskId: 'task-delay-robust-pareto',
      studentLabel: 'Pareto 前沿',
      artifactHash: 'artifact-hash-pareto-front',
      artifact: {
        ...pidArtifact,
        id: 'artifact-browser-pareto-front',
        taskId: 'task-delay-robust-pareto',
        params: { kp: 2.4, ki: 0.4, kd: 0.2 },
      },
      submittedAt: '2026-05-10T10:01:00.000Z',
      reusedEvaluation: false,
      evidenceWriteback: {
        status: 'accepted' as const,
        sourceRef: { kind: 'ArenaSubmission' as const, id: 'submission-browser-pareto-front' },
        attemptStatus: 'effective' as const,
        visibilityState: 'materialized' as const,
        targetLabel: '控制校正 Arena 官方迁移验证',
        summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
        recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
        limitationCodes: [],
        overlayCount: 1,
        terminalValidationAccepted: true,
      },
      evaluation: {
        taskId: 'task-delay-robust-pareto',
        artifact: pidArtifact,
        valid: true,
        score: 80,
        metrics: { settlingTime: 2, overshoot: 8, steadyStateError: 0.02, itae: 3, controlEnergy: 6 },
        satisfaction: {},
        hardConstraintResults: [],
        penalties: [],
        explanation: [],
      },
    };
    const dominated = {
      ...paretoFront,
      id: 'submission-browser-pareto-dominated',
      studentLabel: '被支配',
      artifactHash: 'artifact-hash-pareto-dominated',
      artifact: {
        ...pidArtifact,
        id: 'artifact-browser-pareto-dominated',
        taskId: 'task-delay-robust-pareto',
        params: { kp: 0.6, ki: 0.05, kd: 0 },
      },
      submittedAt: '2026-05-10T10:02:00.000Z',
      evaluation: {
        ...paretoFront.evaluation,
        score: 99,
        metrics: { settlingTime: 7, overshoot: 18, steadyStateError: 0.08, itae: 9, controlEnergy: 16 },
      },
    };

    const paretoView = getChallengeLeaderboardBrowserViewModel({
      taskId: 'task-delay-robust-pareto',
      submissions: [dominated, paretoFront],
      selectedType: 'pareto',
    });

    const classA = {
      ...(await createArenaSubmission({
        taskId: 'task-integrator-low-frequency-balance',
        artifact: {
          ...pidArtifact,
          id: 'artifact-browser-class-a',
          taskId: 'task-integrator-low-frequency-balance',
        },
        studentLabel: '甲班学生',
        classId: 'class-a',
        submittedAt: '2026-05-10T10:01:00.000Z',
        existingSubmissions: [],
      })),
      classId: 'class-a',
    };
    const classB = {
      ...(await createArenaSubmission({
        taskId: 'task-integrator-low-frequency-balance',
        artifact: {
          ...pidArtifact,
          id: 'artifact-browser-class-b',
          taskId: 'task-integrator-low-frequency-balance',
          params: { kp: 1.4, ki: 0.2, kd: 0.05 },
        },
        studentLabel: '乙班学生',
        classId: 'class-b',
        submittedAt: '2026-05-10T10:02:00.000Z',
        existingSubmissions: [classA],
      })),
      classId: 'class-b',
    };
    const classView = getChallengeLeaderboardBrowserViewModel({
      taskId: 'task-integrator-low-frequency-balance',
      submissions: [classA, classB],
      selectedType: 'class',
      classId: 'class-a',
    });

    const spring = {
      ...classA,
      id: 'submission-browser-season-spring',
      taskId: 'task-odyssey-level-one-growth',
      artifact: {
        ...classA.artifact,
        id: 'artifact-browser-season-spring',
        taskId: 'task-odyssey-level-one-growth',
      },
      studentLabel: '春季学生',
      seasonId: 'spring-2026',
    };
    const winter = { ...spring, id: 'submission-browser-season-winter', studentLabel: '冬季学生', seasonId: 'winter-2025' };
    const seasonView = getChallengeLeaderboardBrowserViewModel({
      taskId: 'task-odyssey-level-one-growth',
      submissions: [spring, winter],
      selectedType: 'season',
      seasonId: 'spring-2026',
    });

    expect(paretoView.categories.map((category) => category.type)).toContain('pareto');
    expect(paretoView.current.type).toBe('pareto');
    expect(paretoView.current.entries[0]).toMatchObject({ studentName: 'Pareto 前沿', paretoTier: 1 });
    expect(classView.categories.map((category) => category.type)).toContain('class');
    expect(classView.current.entries.map((entry) => entry.studentName)).toEqual(['甲班学生']);
    expect(seasonView.categories.map((category) => category.type)).toContain('season');
    expect(seasonView.current.entries.map((entry) => entry.studentName)).toEqual(['春季学生']);
  });

  it('derives honors only from official effective submission evidence', async () => {
    const firstPass = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '首个通过',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const lowEnergy = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-honor-low-energy',
        params: { kp: 1.1, ki: 0.2, kd: 0.05 },
      },
      studentLabel: '低能耗',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [firstPass],
    });
    const draft = {
      ...lowEnergy,
      id: 'submission-draft-low-energy',
      studentLabel: '草稿低能耗',
      official: false,
      evaluation: {
        ...lowEnergy.evaluation,
        metrics: { ...lowEnergy.evaluation.metrics, controlEnergy: 0.1, settlingTime: 1.2 },
      },
    };
    const late = {
      ...lowEnergy,
      id: 'submission-late-low-energy',
      studentLabel: '迟交低能耗',
      isLate: true,
      evaluation: {
        ...lowEnergy.evaluation,
        score: 99,
        metrics: { ...lowEnergy.evaluation.metrics, controlEnergy: 0.05, settlingTime: 1.1 },
      },
    };
    const zero = {
      ...lowEnergy,
      id: 'submission-zero-fast',
      studentLabel: '零分快响应',
      evaluation: {
        ...lowEnergy.evaluation,
        valid: true,
        score: 0,
        metrics: { ...lowEnergy.evaluation.metrics, controlEnergy: 0.2, settlingTime: 0.9 },
      },
    };
    firstPass.evaluation.metrics.controlEnergy = 8;
    firstPass.evaluation.metrics.settlingTime = 4.5;
    firstPass.evaluation.score = 82;
    firstPass.evaluation.valid = true;
    lowEnergy.evaluation.metrics.controlEnergy = 2.4;
    lowEnergy.evaluation.metrics.settlingTime = 3.2;
    lowEnergy.evaluation.score = 88;
    lowEnergy.evaluation.valid = true;

    const honors = buildArenaLeaderboardHonors([draft, late, zero, lowEnergy, firstPass], {
      taskId: 'task-second-order-lead-pid',
    });

    expect(honors.find((honor) => honor.id === 'first-pass')).toMatchObject({
      submissionId: firstPass.id,
      studentLabel: '首个通过',
    });
    expect(honors.find((honor) => honor.id === 'low-energy')).toMatchObject({
      submissionId: lowEnergy.id,
      evidenceMetricId: 'controlEnergy',
      evidenceValue: 2.4,
    });
    expect(honors.map((honor) => honor.studentLabel)).not.toContain('草稿低能耗');
    expect(honors.map((honor) => honor.studentLabel)).not.toContain('迟交低能耗');
    expect(honors.map((honor) => honor.studentLabel)).not.toContain('零分快响应');
  });

  it('builds excellent-solution showcase summaries without private controller payloads by default', async () => {
    const showcased = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '展示学生',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    showcased.evaluation.score = 96;
    showcased.evaluation.explanation = ['调节时间和控制能量保持了较好平衡。'];

    const defaultShowcase = buildArenaShowcaseSummaries([showcased], {
      taskId: 'task-second-order-lead-pid',
    });
    const detailedShowcase = buildArenaShowcaseSummaries([showcased], {
      taskId: 'task-second-order-lead-pid',
      includePrivatePayload: true,
    });

    expect(defaultShowcase[0]).toMatchObject({
      submissionId: showcased.id,
      studentLabel: '展示学生',
      method: 'pid',
      score: 96,
      explanationSummary: '调节时间和控制能量保持了较好平衡。',
    });
    expect(defaultShowcase[0]).not.toHaveProperty('privateControllerPayload');
    expect(detailedShowcase[0]?.privateControllerPayload).toEqual(showcased.artifact);
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
    const submissionRows: Array<{
      taskId: string;
      userId: string;
      publicationId?: string;
      artifactHash: string;
      evaluationId: string;
    }> = [];
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
      findDuplicateSubmissionByArtifact: vi.fn(async (input) => {
        const duplicate = submissionRows.find((submission) => {
          const evaluation = [...evaluationRows.values()].find((row) => row.id === submission.evaluationId);
          return submission.taskId === input.taskId &&
            submission.userId === input.userId &&
            submission.publicationId === input.publicationId &&
            submission.artifactHash === input.artifactHash &&
            evaluation?.protocolVersion === input.protocolVersion;
        });
        return duplicate ? {
          id: 'duplicate-submission-row',
          taskId: duplicate.taskId,
          userId: duplicate.userId,
          publicationId: duplicate.publicationId,
          studentLabel: 'existing',
          artifactHash: duplicate.artifactHash,
          artifact: pidArtifact,
          evaluation: evaluationRows.get(`${duplicate.taskId}:${duplicate.artifactHash}:analysis-whitebox-v1`)?.result ?? {
            taskId: duplicate.taskId,
            artifact: pidArtifact,
            valid: true,
            score: 12,
            metrics: {},
            satisfaction: {},
            hardConstraintResults: [],
            penalties: [],
            explanation: [],
          },
          submittedAt: '2026-05-10T10:01:00.000Z',
        } : null;
      }),
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
        submissionRows.push({
          taskId: submission.taskId,
          userId: submission.userId,
          publicationId: submission.publicationId,
          artifactHash: submission.artifactHash,
          evaluationId: submission.evaluationId,
        });
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
    const peer = await createPersistedArenaSubmission({
      taskId: pidArtifact.taskId,
      artifact: { ...pidArtifact, id: 'artifact-peer' },
      userId: 'student-2',
      studentLabel: '学生乙',
      submittedAt: '2026-05-10T10:03:00.000Z',
      store,
    });

    expect(first.reusedEvaluation).toBe(false);
    expect(second.reusedEvaluation).toBe(true);
    expect(peer.reusedEvaluation).toBe(false);
    expect(store.findEvaluationByHash).toHaveBeenCalledWith(pidArtifact.taskId, artifactHash, 'analysis-whitebox-v1');
    expect(store.createEvaluation).toHaveBeenCalledTimes(1);
    expect(store.createEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      protocolVersion: 'analysis-whitebox-v1',
    }));
    expect(store.createSubmission).toHaveBeenCalledTimes(3);
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
    first.evaluation.valid = true;
    first.evaluation.score = 81;
    second.evaluation.valid = true;
    second.evaluation.score = 73;

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

  it('builds task top score from effective ranking submissions only', async () => {
    const effective = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '有效方案',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const lateHighScore = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: { ...pidArtifact, id: 'artifact-stats-late', params: { kp: 3.5, ki: 1.2, kd: 0.6 } },
      studentLabel: '迟交高分',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [effective],
    });
    const zeroScore = await createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: { ...pidArtifact, id: 'artifact-stats-zero', params: { kp: 0.7, ki: 0.1, kd: 0 } },
      studentLabel: '零分有效',
      submittedAt: '2026-05-10T10:03:00.000Z',
      existingSubmissions: [effective, lateHighScore],
    });
    effective.evaluation.valid = true;
    effective.evaluation.score = 76;
    lateHighScore.evaluation.valid = true;
    lateHighScore.evaluation.score = 99;
    lateHighScore.isLate = true;
    zeroScore.evaluation.valid = true;
    zeroScore.evaluation.score = 0;

    const stats = buildArenaTaskStats([lateHighScore, zeroScore, effective], ['task-second-order-lead-pid']);

    expect(stats['task-second-order-lead-pid']).toMatchObject({
      participantCount: 3,
      submissionCount: 3,
      topScore: 76,
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
