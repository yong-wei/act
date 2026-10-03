import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OdysseyExecution } from '@/resources/interactive-learning/control-odyssey/engine/run-execution';
import { computeControlOdysseyServerStep } from '@/lib/control-engine/server';
import type { OdysseyRunConfig } from '@/resources/interactive-learning/control-odyssey/engine/input-trace';

const state = vi.hoisted(() => ({ db: null as any, userId: '' }));
vi.mock('next-auth', () => ({ getServerSession: async () => ({ user: { id: state.userId, name: '合成账户', role: 'STUDENT' } }) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, {
  get: (_target, key) => {
    const value = state.db[key];
    return typeof value === 'function' ? value.bind(state.db) : value;
  },
}) }));
vi.mock('@/lib/data-governance/simulation-task-learning-fact', () => ({ persistAcceptedSimulationTaskEvidence: async () => false }));

import { getControlProfile, getLevelLeaderboard, purchaseController, redeemControlAICredits, submitGameScore, upgradeController } from '../actions/control-odyssey';

const databaseUrl = process.env.ODYSSEY_TEST_DATABASE_URL;
const levels = { P: 5, PI: 0, PD: 0, PID: 0, VFB: 0, FF: 0, SMITH: 0 };
const config: OdysseyRunConfig = {
  controlMode: 'AUTO', controllerId: 'P', pidParams: { kp: 1.6, ki: 0, kd: 0 },
  extraParams: { speedFeedbackTau: 0.05, feedforwardGain: 0.05, smithDelay: 0.1 },
  enableSpeedFeedback: false, enableFeedforward: false, enableSmithPredictor: false,
  difficultyScale: 1, outputLevels: levels,
};
const prefix = 'odyssey-test-' + randomUUID();
let db: PrismaClient;

describe.skipIf(!databaseUrl)('Odyssey isolated PostgreSQL concurrency and aggregation', () => {
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port === '5432' || url.username !== 'odyssey_test') {
      throw new Error('此测试只允许显式提供的隔离 PostgreSQL 合成数据库。');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl!, max: 12 }) });
    state.db = db;
  });
  beforeEach(async () => {
    state.userId = prefix + '-' + randomUUID();
    await db.user.create({ data: { id: state.userId, email: state.userId + '@example.invalid', name: '合成账户' } });
  });
  afterAll(async () => {
    if (!db) return;
    await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.mission.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.$disconnect();
  });

  it('initializes one missing profile under concurrent calls', async () => {
    const profiles = await Promise.all(Array.from({ length: 8 }, () => getControlProfile()));
    expect(profiles.every(profile => profile?.credits === 0 && profile.controllerLevels.P === 1)).toBe(true);
    expect(await db.studentProfile.count({ where: { userId: state.userId } })).toBe(1);
  });

  it('serializes purchases and charges one duplicate unlock once', async () => {
    await db.studentProfile.create({ data: { userId: state.userId, controlCredits: 1200, controlUnlocks: ['P'], controlControllerLevels: { ...levels, P: 1 } } });
    await Promise.all([purchaseController('PI'), purchaseController('PI')]);
    const profile = await getControlProfile();
    expect(profile?.credits).toBe(0);
    expect(profile?.unlocks.filter(id => id === 'PI')).toHaveLength(1);
    expect(profile?.controllerLevels.PI).toBe(1);
  });

  it('prevents competing unlocks from spending the same balance', async () => {
    await db.studentProfile.create({ data: { userId: state.userId, controlCredits: 1200, controlUnlocks: ['P'], controlControllerLevels: { ...levels, P: 1 } } });
    const results = await Promise.allSettled([purchaseController('PI'), purchaseController('PD')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await getControlProfile())?.credits).toBe(0);
  });

  it('serializes AI redemption against upgrades without overspending', async () => {
    await db.studentProfile.create({ data: { userId: state.userId, controlCredits: 210, controlUnlocks: ['P'], controlControllerLevels: { ...levels, P: 1 } } });
    const results = await Promise.allSettled([upgradeController('P'), redeemControlAICredits()]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const profile = await getControlProfile();
    expect([10, 190]).toContain(profile?.credits);
    expect(profile?.controllerLevels.P).toBe(profile?.credits === 10 ? 2 : 1);
  });

  it('reads the new level and its price for a concurrent second upgrade', async () => {
    await db.studentProfile.create({ data: { userId: state.userId, controlCredits: 600, controlUnlocks: ['P'], controlControllerLevels: { ...levels, P: 1 } } });
    await Promise.all([upgradeController('P'), upgradeController('P')]);
    const profile = await getControlProfile();
    expect(profile).toMatchObject({ credits: 0, controllerLevels: { P: 3 } });
  });

  it('preserves an upgrade, both level completions and exactly one reward per run', async () => {
    await db.studentProfile.create({ data: { userId: state.userId, controlCredits: 5000, controlUnlocks: ['P'], controlControllerLevels: levels, controlOdysseyProgress: { 'level-1': 'silver' } } });
    const traces = ['level-1', 'level-2'].map(levelId => {
      const runtime = new OdysseyExecution(levelId, 'bronze', levels);
      while (!runtime.terminal) runtime.advance(config, 0, computeControlOdysseyServerStep);
      expect(runtime.terminal, levelId).toBe('VICTORY');
      return runtime.trace;
    });
    const contexts = traces.map((inputTrace, index) => ({ ...config, tier: 'bronze', runId: prefix + '-run-' + index, inputTrace }));
    const [upgrade, first, second] = await Promise.all([
      upgradeController('P'), submitGameScore('level-1', 1e9, {}, contexts[0]), submitGameScore('level-2', -1, {}, contexts[1]),
    ]);
    expect(upgrade?.controllerLevels.P).toBe(6);
    expect(first).toHaveProperty('score');
    expect(second).toHaveProperty('score');
    const a = first as { score: number };
    const b = second as { score: number };
    const expectedCredits = 5000 - 3200 + Math.floor(a.score / 100) + Math.floor(b.score / 100);
    const beforeRetry = await getControlProfile();
    expect(beforeRetry).toMatchObject({ credits: expectedCredits, controllerLevels: { P: 6 }, tierProgress: { 'level-1': 'silver', 'level-2': 'silver' } });
    await Promise.all([
      submitGameScore('level-1', 1e9, {}, { ...contexts[0], inputTrace: { version: 1, totalSteps: 1, changes: [] } }),
      submitGameScore('level-2', 1e9, {}, contexts[1]),
    ]);
    expect((await getControlProfile())?.credits).toBe(expectedCredits);
    expect(await db.simulationLog.count({ where: { userId: state.userId } })).toBe(2);
  }, 20_000);

  it('aggregates each user before limiting fifty and keeps GAME and legacy filters', async () => {
    const otherIds = Array.from({ length: 60 }, (_, i) => prefix + '-rank-' + i);
    await db.user.createMany({ data: otherIds.map(id => ({ id, email: id + '@example.invalid', name: id })) });
    await db.simulationLog.createMany({ data: [
      ...Array.from({ length: 250 }, () => ({ userId: state.userId, controlMode: 'GAME', inputParams: { levelId: 'level-1', tier: 'silver' }, metrics: {}, score: 10000 })),
      ...otherIds.map((userId, index) => ({ userId, controlMode: 'GAME', inputParams: { levelId: 'level-1', tier: 'bronze' }, metrics: {}, score: 9999 - index })),
      { userId: otherIds[59], controlMode: 'GAME', missionId: null, inputParams: { levelId: 'level-1', tier: 'gold' }, metrics: {}, score: 10001 },
      { userId: otherIds[58], controlMode: 'PID', inputParams: { levelId: 'level-1' }, metrics: {}, score: 1e9 },
    ] });
    const legacyMissionId = prefix + '-legacy';
    await db.mission.create({ data: { id: legacyMissionId, title: '合成旧记录' } });
    await db.simulationLog.create({ data: { userId: state.userId, controlMode: 'GAME', missionId: legacyMissionId, inputParams: { tier: 'gold' }, metrics: {}, score: 777 } });
    expect(await getLevelLeaderboard(legacyMissionId)).toMatchObject([{ score: 777, tier: 'gold' }]);
    expect((await getControlProfile())?.bestScores?.[legacyMissionId]).toEqual({ overall: 777, tiers: { gold: 777 } });
    const result = await getLevelLeaderboard('level-1');
    expect(result).toHaveLength(50);
    expect(result[0].userName).toBe(otherIds[59]);
    expect(result.filter(row => row.userName === '合成账户')).toHaveLength(1);
    expect(result.every(row => row.score < 1e9)).toBe(true);
    expect(await getLevelLeaderboard("level-1' OR TRUE --")).toEqual([]);
    expect((await getControlProfile())?.bestScores?.['level-1']).toEqual({ overall: 10000, tiers: { silver: 10000 } });
  });
});
