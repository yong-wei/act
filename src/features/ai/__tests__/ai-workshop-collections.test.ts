import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('server-only', () => ({}));

const { studentListAssignments } = vi.hoisted(() => ({
  studentListAssignments: vi.fn(),
}));

vi.mock('@/lib/assignments/public-api', () => ({ studentListAssignments }));

import {
  assembleAiWorkshopCollections,
} from '@/features/ai/ai-workshop-collections.server';
import { orderByOccurrence } from '@/features/ai/ai-workshop-collections';
import { sceneTraceSourceRefId } from '@/lib/data-governance/simulation-scene-run-persistence';

function createDb() {
  return {
    learningPath: { findFirst: vi.fn().mockResolvedValue(null) },
    knowledgeNode: { findMany: vi.fn().mockResolvedValue([]) },
    growthRecord: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    simulationRun: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    simulationLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    arenaSubmission: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    ethicalLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  };
}

describe('assembleAiWorkshopCollections', () => {
  beforeEach(() => {
    studentListAssignments.mockReset();
  });

  it('projects mixed source states independently with student-safe items', async () => {
    studentListAssignments.mockResolvedValue([
      {
        id: 'assignment-1', title: '时域分析作业', contextStatus: 'CURRENT', state: 'IN_PROGRESS',
        submittedRequiredCount: 1, requiredQuestionCount: 2,
      },
      {
        id: 'assignment-2', title: '历史作业', contextStatus: 'HISTORICAL', state: 'REVIEWED',
        submittedRequiredCount: 3, requiredQuestionCount: 3,
      },
    ]);
    const db = createDb();
    db.learningPath.findFirst.mockResolvedValue({
      id: 'path-1', title: '控制矫正路径', nodeIds: ['node-a', 'node-b', 'node-c'], currentNodeId: 'node-b',
      lastExecutionMetadata: { completedNodeIds: ['node-a'] },
    });
    db.knowledgeNode.findMany.mockResolvedValue([
      { id: 'node-a', name: '根轨迹' },
      { id: 'node-b', name: '频域分析' },
      { id: 'node-c', name: '校正设计' },
    ]);
    db.simulationLog.findMany.mockResolvedValue([{
      id: 'sim-1', controlMode: 'PID', inputParams: { kp: 1.2, ki: 0.3, kd: 0.05, raw: 'x' },
      score: 86, isEthicalViolation: false, odysseyRunId: null,
      odysseyCompletedAt: new Date('2026-08-20T08:00:00Z'),
      createdAt: new Date('2026-08-20T08:00:00Z'),
    }]);
    db.simulationLog.count.mockResolvedValue(1);
    db.arenaSubmission.findMany.mockResolvedValue([{
      id: 'arena-1', taskId: 'task-1', method: 'PID', score: 42, valid: false, submittedAt: new Date('2026-08-21T08:00:00Z'),
      controllerArtifact: { payload: {} },
    }]);
    db.arenaSubmission.count.mockResolvedValue(1);
    db.growthRecord.findMany.mockImplementation(({ where }: { where: { recordType: { in: string[] } } }) => (
      where.recordType.in.includes('reflection')
        ? [{
          id: 'growth-j1', recordType: 'reflection', title: '反思一',
          description: '本周复盘了根轨迹绘制。', occurredAt: new Date('2026-08-22T08:00:00Z'),
        }]
        : []
    ));
    db.growthRecord.count.mockImplementation(({ where }: { where: { recordType: { in: string[] } } }) => (
      where.recordType.in.includes('reflection') ? 1 : 0
    ));
    db.ethicalLog.findMany.mockResolvedValue([{
      id: 'ethics-1', violationType: 'SPEED_LIMIT', studentJustification: '已调整舵角速率。',
      resolvedAt: new Date('2026-08-23T08:00:00Z'), createdAt: new Date('2026-08-19T08:00:00Z'),
    }]);
    db.ethicalLog.count.mockResolvedValue(1);

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(collections.authority).toBe('server-owned');
    // 历史作业不属于当前发布范围；已采用路径的任务一并投影并携带真实目标地址。
    expect(collections.tasks.state).toBe('available');
    expect(collections.tasks.items).toHaveLength(3);
    expect(collections.tasks.items[0]).toMatchObject({
      id: 'assignment:assignment-1',
      status: 'in_progress',
      progress: 50,
      sourceKind: 'assignment',
      href: '/missions/assignments/assignment-1',
    });
    expect(collections.tasks.items.filter((item) => item.sourceKind === 'path')).toEqual([
      expect.objectContaining({
        id: 'path:path-1:node-b', status: 'in_progress', title: '频域分析',
        href: '/assessment/adaptive-practice?pathId=path-1',
      }),
      expect.objectContaining({ id: 'path:path-1:node-c', status: 'locked', title: '校正设计' }),
    ]);
    // 里程碑以执行记录的完成集合为权威，保留路径身份与当前节点。
    expect(collections.milestones.state).toBe('available');
    expect(collections.milestones.items.map((item) => item.status)).toEqual(['COMPLETED', 'CURRENT', 'PENDING']);
    expect(collections.milestones.items[1]?.title).toBe('频域分析');
    // 成就为空是权威空态，total 为 0 而非未知。
    expect(collections.achievements).toMatchObject({ state: 'empty', total: 0 });
    // 实验：无效 Arena 结果不得表示为正式分数；原始载荷字段被白名单裁掉。
    expect(collections.experiments.state).toBe('available');
    expect(collections.experiments.total).toBe(2);
    const arena = collections.experiments.items.find((item) => item.id === 'arena:arena-1');
    expect(arena).toMatchObject({ resultAuthority: 'preview', score: null, type: 'ARENA_SUBMISSION' });
    const simulation = collections.experiments.items.find((item) => item.id === 'simulation:sim-1');
    expect(simulation).toMatchObject({ resultAuthority: 'official', parameters: { kp: 1.2, ki: 0.3, kd: 0.05 } });
    expect(JSON.stringify(collections.experiments.items)).not.toContain('raw');
    // 日志：反思与已整改伦理决策进入，草稿与候选没有入口。
    expect(collections.journals.state).toBe('available');
    expect(collections.journals.items.map((item) => item.entryType).sort()).toEqual(['ETHICS_DECISION', 'REFLECTION']);
  });

  it('isolates a failing source without zeroing other collections', async () => {
    studentListAssignments.mockResolvedValue([{
      id: 'assignment-1', title: '作业一', contextStatus: 'CURRENT', state: 'NOT_STARTED',
      submittedRequiredCount: 0, requiredQuestionCount: 2,
    }]);
    const db = createDb();
    db.simulationLog.findMany.mockRejectedValue(new Error('simulation source down'));

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(collections.experiments).toMatchObject({ state: 'unavailable', total: null, items: [] });
    expect(collections.experiments.limitation).toContain('暂时无法确认');
    expect(collections.tasks.state).toBe('available');
    expect(collections.journals.state).toBe('empty');
  });

  it('restricts achievements and journals to durable registered record types', async () => {
    studentListAssignments.mockResolvedValue([]);
    const db = createDb();

    await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    const growthWhere = db.growthRecord.findMany.mock.calls.map((call) => call[0].where);
    expect(growthWhere).toEqual(expect.arrayContaining([
      expect.objectContaining({ recordType: { in: ['milestone', 'breakthrough'] }, invalidations: { none: {} } }),
      expect.objectContaining({ recordType: { in: ['reflection', 'portfolio'] }, invalidations: { none: {} } }),
    ]));
    // 未整改的伦理记录不是学生确认的日志。
    expect(db.ethicalLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isResolved: true }),
    }));
  });

  it('never accepts a client-provided learner identity', async () => {
    studentListAssignments.mockResolvedValue([]);
    const db = createDb();

    await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(studentListAssignments).toHaveBeenCalledWith({ id: 'student-1' });
    expect(db.learningPath.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'student-1' }),
    }));
  });

  it('does not infer completion from node position when the execution record skips a node', async () => {
    studentListAssignments.mockResolvedValue([]);
    const db = createDb();
    // 跳过/改道：currentNodeId 移到 node-c，但执行记录只确认 node-b 完成。
    db.learningPath.findFirst.mockResolvedValue({
      id: 'path-1', title: '控制矫正路径', nodeIds: ['node-a', 'node-b', 'node-c'], currentNodeId: 'node-c',
      lastExecutionMetadata: { completedNodeIds: ['node-b'] },
    });
    db.knowledgeNode.findMany.mockResolvedValue([
      { id: 'node-a', name: '根轨迹' },
      { id: 'node-b', name: '频域分析' },
      { id: 'node-c', name: '校正设计' },
    ]);

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(collections.milestones.items.map((item) => item.status)).toEqual(['PENDING', 'COMPLETED', 'CURRENT']);
    // 被跳过的 node-a 仍作为未解锁任务保留，不得标成已完成。
    expect(collections.tasks.items.map((item) => item.id)).toEqual(['path:path-1:node-a', 'path:path-1:node-c']);
  });

  it('path-encodes assignment ids in task navigation hrefs', async () => {
    studentListAssignments.mockResolvedValue([{
      id: 'assignment/with?reserved#chars', title: '特殊 ID 作业', contextStatus: 'CURRENT', state: 'NOT_STARTED',
      submittedRequiredCount: 0, requiredQuestionCount: 1,
    }]);
    const db = createDb();

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(collections.tasks.items[0]?.href).toBe(
      `/missions/assignments/${encodeURIComponent('assignment/with?reserved#chars')}`,
    );
  });

  it('marks milestones pending when the execution record carries no completion set', async () => {
    studentListAssignments.mockResolvedValue([]);
    const db = createDb();
    db.learningPath.findFirst.mockResolvedValue({
      id: 'path-1', title: '控制矫正路径', nodeIds: ['node-a', 'node-b'], currentNodeId: 'node-a',
      lastExecutionMetadata: null,
    });

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(collections.milestones.items.map((item) => item.status)).toEqual(['CURRENT', 'PENDING']);
  });
});

describe('experiment archive lineage (Issue #1912)', () => {
  beforeEach(() => {
    studentListAssignments.mockResolvedValue([]);
  });

  it('merges one odyssey activity across canonical run, legacy log and arena submission into a single item', async () => {
    const db = createDb();
    db.simulationRun.findMany.mockResolvedValue([{
      id: 'run-1', runKind: 'scene_simulation', sourceDomain: 'simulation_scene',
      sourceRefId: sceneTraceSourceRefId('student-1', 'run-od-1'),
      resourceId: 'sim-scene-cruise', summary: { metrics: { score: 77, kp: 1.5 } },
      completedAt: new Date('2026-09-01T08:00:00Z'),
    }]);
    db.simulationRun.count.mockResolvedValue(1);
    db.simulationLog.findMany.mockResolvedValue([{
      id: 'log-bridged', controlMode: 'PID', inputParams: {}, score: 90, isEthicalViolation: false,
      odysseyRunId: 'run-od-1', odysseyCompletedAt: new Date('2026-09-01T08:00:00Z'),
      createdAt: new Date('2026-09-01T08:00:00Z'),
    }]);
    db.simulationLog.count.mockResolvedValue(1);
    db.arenaSubmission.findMany.mockResolvedValue([{
      id: 'arena-bridged', taskId: 'task-od', method: 'pid', score: 91, valid: true,
      submittedAt: new Date('2026-09-01T08:00:00Z'),
      controllerArtifact: { payload: { odysseyRunId: 'run-od-1' } },
    }]);
    db.arenaSubmission.count.mockResolvedValue(1);

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    // 同一次奥德赛活动只展示一次、只计数一次：以标准运行为代表。
    expect(collections.experiments.items).toHaveLength(1);
    expect(collections.experiments.total).toBe(1);
    const item = collections.experiments.items[0];
    expect(item).toMatchObject({
      id: 'simulation-run:run-1',
      sourceKind: 'simulation_run',
      type: 'SCENE_SIMULATION',
      resultAuthority: 'official',
      navigation: { href: '/interactive-learning/resources/sim-scene-cruise' },
    });
    // 合并不丢最高适用权威：有效 Arena 提交的正式分数成为该活动结果（Codex R1 review）。
    expect(item.score).toBe(91);
    // 被归并来源的完整已验证链路保留（Codex R2 review）：奥德赛日志与 Arena 挑战入口可达。
    expect(item.bridgedSources).toEqual([
      { sourceLabel: '控制奥德赛', navigation: { href: '/interactive-learning/control-odyssey', label: '回到控制奥德赛' } },
      { sourceLabel: 'Arena 竞技场', navigation: { href: '/arena/challenges/task-od', label: '查看挑战详情' } },
    ]);
  });

  it('keeps an odyssey log as the representative when no canonical run exists and merges its arena bridge', async () => {
    const db = createDb();
    db.simulationLog.findMany.mockResolvedValue([{
      id: 'log-od', controlMode: 'PID', inputParams: { kp: 2 }, score: 88, isEthicalViolation: false,
      odysseyRunId: 'run-od-2', odysseyCompletedAt: new Date('2026-09-01T09:00:00Z'),
      createdAt: new Date('2026-09-01T09:00:00Z'),
    }]);
    db.simulationLog.count.mockResolvedValue(1);
    db.arenaSubmission.findMany.mockResolvedValue([{
      id: 'arena-od', taskId: 'task-od-2', method: 'pid', score: 92, valid: true,
      submittedAt: new Date('2026-09-01T09:05:00Z'),
      controllerArtifact: { payload: { odysseyRunId: 'run-od-2' } },
    }]);
    db.arenaSubmission.count.mockResolvedValue(1);

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(collections.experiments.items).toHaveLength(1);
    expect(collections.experiments.items[0]).toMatchObject({
      id: 'simulation:log-od',
      type: 'ODYSSEY_RUN',
      resultAuthority: 'official',
      navigation: { href: '/interactive-learning/control-odyssey' },
    });
    expect(collections.experiments.total).toBe(1);
  });

  it('derives source type and navigation from the source contract instead of defaulting to PID', async () => {
    const db = createDb();
    db.simulationRun.findMany.mockResolvedValue([
      {
        id: 'run-cw', runKind: 'scene_simulation', sourceDomain: 'simulation_scene',
        sourceRefId: 'control-workbench:abc', resourceId: null, summary: {},
        completedAt: new Date('2026-09-01T10:00:00Z'),
      },
      {
        id: 'run-unknown', runKind: 'scene_simulation', sourceDomain: 'simulation_scene',
        sourceRefId: 'scene-trace:def', resourceId: 'not-registered-resource',
        summary: {}, completedAt: new Date('2026-09-01T11:00:00Z'),
      },
    ]);
    db.simulationRun.count.mockResolvedValue(2);
    db.simulationLog.findMany.mockResolvedValue([{
      id: 'log-mpc', controlMode: 'MPC', inputParams: {}, score: 70, isEthicalViolation: false,
      odysseyRunId: null, odysseyCompletedAt: null,
      createdAt: new Date('2026-09-01T12:00:00Z'),
    }]);

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    const byId = new Map(collections.experiments.items.map((item) => [item.id, item]));
    expect(byId.get('simulation-run:run-cw')).toMatchObject({
      type: 'CONTROL_WORKBENCH',
      navigation: { href: '/interactive-learning/control-workbench' },
    });
    // 注册表无法验证目标时受限展示，不生成死链。
    expect(byId.get('simulation-run:run-unknown')?.navigation).toBeNull();
    // 非伦理、非 PID 家族的日志按通用仿真记录表达，不再伪造 PID 类型。
    expect(byId.get('simulation:log-mpc')).toMatchObject({ type: 'SCENE_SIMULATION' });
    expect(byId.get('simulation:log-mpc')?.navigation).toBeNull();
    expect(collections.experiments.total).toBe(3);
  });


  it('projects legacy odyssey logs by inputParams.runId with odyssey typing and merges its arena bridge', async () => {
    const db = createDb();
    db.simulationLog.findMany.mockResolvedValue([{
      id: 'log-legacy', controlMode: 'PID', inputParams: { runId: 'legacy-run-1', kp: 2 },
      score: 80, isEthicalViolation: false, odysseyRunId: null, odysseyCompletedAt: null,
      createdAt: new Date('2026-09-01T07:00:00Z'),
    }]);
    db.simulationLog.count.mockResolvedValue(1);
    db.arenaSubmission.findMany.mockResolvedValue([{
      id: 'arena-legacy', taskId: 'task-legacy', method: 'pid', score: 95, valid: true,
      submittedAt: new Date('2026-09-01T07:10:00Z'),
      controllerArtifact: { payload: { odysseyRunId: 'legacy-run-1' } },
    }]);
    db.arenaSubmission.count.mockResolvedValue(1);

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(collections.experiments.items).toHaveLength(1);
    // 旧版 runId 身份同样获得奥德赛类型、安全导航，其 Arena 桥接归并并升级权威。
    expect(collections.experiments.items[0]).toMatchObject({
      id: 'simulation:log-legacy',
      type: 'ODYSSEY_RUN',
      navigation: { href: '/interactive-learning/control-odyssey' },
      resultAuthority: 'official',
      score: 95,
      bridgedSources: [
        { sourceLabel: 'Arena 竞技场', navigation: { href: '/arena/challenges/task-legacy', label: '查看挑战详情' } },
      ],
    });
    expect(collections.experiments.total).toBe(1);
  });

  it('keeps unrelated runs, logs and arena submissions separate with bounded lower-bound totals', async () => {
    const db = createDb();
    db.simulationRun.count.mockResolvedValue(20);
    db.simulationLog.count.mockResolvedValue(5);
    db.arenaSubmission.count.mockResolvedValue(2);

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    // 任一来源截断时不再声称精确总数（Codex R2 review）：null，不重复计数窗口外活动。
    expect(collections.experiments.state).toBe('empty');
    expect(collections.experiments.total).toBe(0);
    expect(db.simulationRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      // 来源白名单（Codex R1 review）：arena_preview / agent_experiment 不得混入。
      where: expect.objectContaining({
        ownerUserId: 'student-1', runKind: 'scene_simulation', sourceDomain: 'simulation_scene',
      }),
      take: 12,
    }));
  });
});

describe('orderByOccurrence', () => {
  it('orders by descending occurrence with id tie-breaker deterministically', () => {
    const items = [
      { id: 'b', at: '2026-08-01T00:00:00.000Z' },
      { id: 'a', at: '2026-08-01T00:00:00.000Z' },
      { id: 'c', at: '2026-08-02T00:00:00.000Z' },
    ];
    const ordered = orderByOccurrence(items, (item) => item.at);
    expect(ordered.map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(orderByOccurrence(items, (item) => item.at)).toEqual(ordered);
  });
});
