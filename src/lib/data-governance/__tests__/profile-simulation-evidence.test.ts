import { describe, expect, it, vi } from 'vitest';

import {
  PROFILE_SIMULATION_RECENT_LIMIT,
  readProfileSimulationEvidence,
} from '@/lib/data-governance/profile-simulation-evidence';
import { sceneTraceSourceRefId } from '@/lib/data-governance/simulation-scene-run-persistence';
import {
  PRACTICE_DISPLAY_BOUNDARY,
  PREVIEW_DISPLAY_BOUNDARY,
} from '@/lib/practice-lab-run-contract/types';

function runRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    ownerUserId: 'student-1',
    runKind: 'scene_simulation',
    sourceDomain: 'simulation_scene',
    sourceRefId: 'scene-trace:abc',
    resourceId: null,
    status: 'completed',
    summary: {
      metrics: { score: 88, duration: 120, valid: true },
      evaluation: { passed: true, meetsQualityTarget: true },
      qualityTargetMet: true,
      // 与持久化层同源的显示边界：场景/工作台运行写入的是 practice 合同。
      runContract: {
        evaluationVisibility: PRACTICE_DISPLAY_BOUNDARY.evaluationVisibility,
        officialEligible: PRACTICE_DISPLAY_BOUNDARY.officialEligible,
      },
    },
    completedAt: new Date('2026-09-01T00:00:00.000Z'),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

function logRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    userId: 'student-1',
    controlMode: 'PID',
    inputParams: { kp: 1.2 },
    score: 90,
    duration: 600,
    isEthicalViolation: false,
    odysseyRunId: null,
    odysseyCompletedAt: null,
    createdAt: new Date('2026-08-20T00:00:00.000Z'),
    ...overrides,
  };
}

function makeDb(runs: unknown[] = [], logs: unknown[] = []) {
  return {
    simulationRun: { findMany: vi.fn().mockResolvedValue(runs) },
    simulationLog: { findMany: vi.fn().mockResolvedValue(logs) },
  };
}

describe('readProfileSimulationEvidence', () => {
  it('projects student-owned canonical runs into statistics and recent items', async () => {
    const projection = await readProfileSimulationEvidence(
      makeDb([runRow()], []),
      'student-1',
    );

    expect(projection.state).toBe('available');
    expect(projection.total).toBe(1);
    expect(projection.totalDurationSeconds).toBe(120);
    expect(projection.averageScore).toBe(88);
    expect(projection.items).toHaveLength(1);
    expect(projection.items[0]).toEqual(expect.objectContaining({
      id: 'simulation-run:run-1',
      sourceKind: 'canonical-run',
      title: '场景仿真实验（scene_simulation）',
      sourceLabel: '场景仿真',
      resultAuthority: 'preview',
      score: 88,
      durationSeconds: 120,
      occurredAt: '2026-09-01T00:00:00.000Z',
    }));
  });

  it('labels control workbench runs with their dedicated entry', async () => {
    const projection = await readProfileSimulationEvidence(
      makeDb([runRow({
        id: 'run-wb',
        sourceRefId: 'control-workbench:hash',
      })], []),
      'student-1',
    );

    expect(projection.items[0]).toEqual(expect.objectContaining({
      title: '控制工作台分析',
      sourceLabel: '控制工作台',
      href: '/interactive-learning/control-workbench',
    }));
  });

  it('queries canonical runs with the ownership and source whitelist filters', async () => {
    const db = makeDb();
    await readProfileSimulationEvidence(db, 'student-1');

    expect(db.simulationRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ownerUserId: 'student-1',
        runKind: 'scene_simulation',
        sourceDomain: 'simulation_scene',
        status: 'completed',
      }),
    }));
    expect(db.simulationLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1' },
    }));
  });

  it('excludes canonical runs without an explicit non-official boundary or metrics', async () => {
    const officialBoundary = (id: string) => runRow({
      id,
      summary: {
        metrics: { score: 1 },
        runContract: { evaluationVisibility: 'official', officialEligible: true },
      },
    });
    const projection = await readProfileSimulationEvidence(
      makeDb([
        officialBoundary('official'),
        runRow({ id: 'no-contract', summary: { metrics: { score: 1 } } }),
        runRow({ id: 'no-metrics', summary: { runContract: { evaluationVisibility: PREVIEW_DISPLAY_BOUNDARY.evaluationVisibility, officialEligible: false } } }),
        runRow({ id: 'still-running', status: 'running' }),
        runRow({ id: 'foreign-kind', runKind: 'arena_preview', sourceDomain: 'arena_virtual_preview' }),
        runRow({ id: 'foreign-owner', ownerUserId: 'student-2' }),
      ], []),
      'student-1',
    );

    expect(projection.state).toBe('empty');
    expect(projection.total).toBe(0);
    expect(projection.items).toHaveLength(0);
    expect(projection.averageScore).toBeNull();
    expect(projection.totalDurationSeconds).toBeNull();
  });

  it('accepts both non-official boundary values a real producer can write', async () => {
    const projection = await readProfileSimulationEvidence(
      makeDb([
        runRow({ id: 'run-practice' }),
        runRow({
          id: 'run-preview',
          summary: {
            metrics: { score: 90 },
            runContract: { evaluationVisibility: PREVIEW_DISPLAY_BOUNDARY.evaluationVisibility, officialEligible: PREVIEW_DISPLAY_BOUNDARY.officialEligible },
          },
        }),
      ], []),
      'student-1',
    );

    expect(projection.total).toBe(2);
  });

  it('excludes pending odyssey logs until bridging completes them', async () => {
    const projection = await readProfileSimulationEvidence(
      makeDb([], [
        logRow({
          id: 'log-pending',
          controlMode: 'GAME',
          odysseyRunId: 'od-pending',
          odysseyCompletedAt: null,
        }),
        logRow({
          id: 'log-pending-legacy-shape',
          controlMode: 'GAME',
          odysseyRunId: null,
          inputParams: { runId: 'od-pending-2' },
          odysseyCompletedAt: null,
        }),
        logRow({
          id: 'log-completed',
          controlMode: 'GAME',
          odysseyRunId: 'od-done',
          odysseyCompletedAt: new Date('2026-08-21T00:00:00.000Z'),
        }),
      ]),
      'student-1',
    );

    expect(projection.total).toBe(1);
    expect(projection.items[0].id).toBe('simulation:log-completed');
    expect(projection.items[0].resultAuthority).toBe('official');
  });

  it('keeps eligible legacy logs visible with odyssey and PID labeling', async () => {
    const projection = await readProfileSimulationEvidence(
      makeDb([], [
        logRow({ id: 'log-pid' }),
        logRow({
          id: 'log-odyssey',
          controlMode: 'GAME',
          odysseyRunId: 'od-legacy-only',
          odysseyCompletedAt: new Date('2026-08-21T00:00:00.000Z'),
        }),
        logRow({ id: 'log-ethics', controlMode: 'PID', isEthicalViolation: true }),
      ]),
      'student-1',
    );

    expect(projection.total).toBe(3);
    const byId = new Map(projection.items.map((item) => [item.id, item]));
    expect(byId.get('simulation:log-pid')).toEqual(expect.objectContaining({
      title: '仿真调参（PID）',
      sourceLabel: '仿真训练',
      href: '/simulations/destroyer',
      resultAuthority: 'preview',
    }));
    expect(byId.get('simulation:log-odyssey')).toEqual(expect.objectContaining({
      title: '控制奥德赛演练',
      sourceLabel: '控制奥德赛',
      href: '/interactive-learning/control-odyssey',
      resultAuthority: 'official',
    }));
    expect(byId.get('simulation:log-ethics')).toEqual(expect.objectContaining({
      title: '伦理沙盘演练',
    }));
  });

  it('deduplicates legacy logs bridged to a canonical run by the stable identity key', async () => {
    const bridgedRefId = sceneTraceSourceRefId('student-1', 'od-1');
    const projection = await readProfileSimulationEvidence(
      makeDb(
        [runRow({ id: 'run-bridged', sourceRefId: bridgedRefId })],
        [logRow({ id: 'log-bridged', odysseyRunId: 'od-1', odysseyCompletedAt: new Date('2026-08-21T00:00:00.000Z') })],
      ),
      'student-1',
    );

    expect(projection.total).toBe(1);
    expect(projection.items).toHaveLength(1);
    expect(projection.items[0].sourceKind).toBe('canonical-run');
  });

  it('also bridges legacy logs that only carry the odyssey id inside inputParams', async () => {
    const bridgedRefId = sceneTraceSourceRefId('student-1', 'od-2');
    const projection = await readProfileSimulationEvidence(
      makeDb(
        [runRow({ id: 'run-bridged', sourceRefId: bridgedRefId })],
        [logRow({ id: 'log-bridged', odysseyRunId: null, inputParams: { runId: 'od-2' }, odysseyCompletedAt: new Date('2026-08-21T00:00:00.000Z') })],
      ),
      'student-1',
    );

    expect(projection.total).toBe(1);
    expect(projection.items[0].id).toBe('simulation-run:run-bridged');
  });

  it('does not fabricate zero aggregates when records lack score or duration', async () => {
    const projection = await readProfileSimulationEvidence(
      makeDb([], [
        logRow({ id: 'log-noscore', score: null, duration: null }),
      ]),
      'student-1',
    );

    expect(projection.state).toBe('available');
    expect(projection.total).toBe(1);
    expect(projection.averageScore).toBeNull();
    expect(projection.totalDurationSeconds).toBeNull();
  });

  it('averages scores only across records that carry one', async () => {
    const projection = await readProfileSimulationEvidence(
      makeDb([runRow({ summary: { metrics: { score: 80 }, runContract: { evaluationVisibility: PRACTICE_DISPLAY_BOUNDARY.evaluationVisibility, officialEligible: PRACTICE_DISPLAY_BOUNDARY.officialEligible } } })], [
        logRow({ id: 'log-90', score: 90 }),
        logRow({ id: 'log-noscore', score: null, duration: null }),
      ]),
      'student-1',
    );

    expect(projection.total).toBe(3);
    expect(projection.averageScore).toBe(85);
    expect(projection.totalDurationSeconds).toBe(600);
  });

  it('exposes only the whitelisted pid parameters from nested or flat inputs', async () => {
    const projection = await readProfileSimulationEvidence(
      makeDb([], [
        logRow({
          id: 'log-flat',
          inputParams: { kp: 1.2, secret: 'do-not-expose', trajectoryData: 'private-trajectory' },
        }),
        logRow({
          id: 'log-nested',
          controlMode: 'GAME',
          odysseyRunId: 'od-nested',
          odysseyCompletedAt: new Date('2026-08-21T00:00:00.000Z'),
          inputParams: { pidParams: { kp: 2.4, ki: 0.15, kd: 0.8 }, trajectoryData: 'private' },
        }),
      ]),
      'student-1',
    );

    const byId = new Map(projection.items.map((item) => [item.id, item]));
    expect(byId.get('simulation:log-flat')?.parameters).toEqual({ kp: 1.2 });
    expect(byId.get('simulation:log-nested')?.parameters).toEqual({ kp: 2.4, ki: 0.15, kd: 0.8 });
    expect(JSON.stringify(projection.items)).not.toContain('do-not-expose');
    expect(JSON.stringify(projection.items)).not.toContain('private-trajectory');
  });

  it('returns empty semantics when no displayable evidence exists', async () => {
    const projection = await readProfileSimulationEvidence(makeDb([], []), 'student-1');

    expect(projection).toEqual({
      state: 'empty',
      total: 0,
      totalDurationSeconds: null,
      averageScore: null,
      items: [],
    });
  });

  it('returns unavailable semantics without fabricated numbers when a source read fails', async () => {
    const db = {
      simulationRun: { findMany: vi.fn().mockRejectedValue(new Error('db down')) },
      simulationLog: { findMany: vi.fn().mockResolvedValue([logRow()]) },
    };
    const projection = await readProfileSimulationEvidence(db, 'student-1');

    expect(projection).toEqual({
      state: 'unavailable',
      total: null,
      totalDurationSeconds: null,
      averageScore: null,
      items: [],
    });
  });

  it('orders recent items by time descending and caps them at the recent limit', async () => {
    const runs = Array.from({ length: PROFILE_SIMULATION_RECENT_LIMIT + 5 }, (_, index) =>
      runRow({
        id: `run-${index}`,
        completedAt: new Date('2026-09-01T00:00:00.000Z'),
        createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)),
      }),
    );
    const projection = await readProfileSimulationEvidence(makeDb(runs, []), 'student-1');

    expect(projection.total).toBe(PROFILE_SIMULATION_RECENT_LIMIT + 5);
    expect(projection.items).toHaveLength(PROFILE_SIMULATION_RECENT_LIMIT);
    const times = projection.items.map((item) => Date.parse(item.occurredAt));
    expect([...times].sort((left, right) => right - left)).toEqual(times);
  });
});
