import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

const { state, mocks } = vi.hoisted(() => {
  const hoistedState = {
    users: new Map<string, Record<string, unknown>>(),
    profiles: new Map<string, Record<string, unknown>>(),
    accounts: new Map<string, Record<string, unknown>>(),
    ilabRuns: new Map<string, Record<string, unknown>>(),
    reports: new Map<string, Record<string, unknown>>(),
    attempts: new Array<Record<string, unknown>>(),
    seqCounter: 0,
  };

  function nextId(prefix: string): string {
    hoistedState.seqCounter += 1;
    return `${prefix}-${hoistedState.seqCounter}`;
  }

  const tx = {
    $queryRaw: vi.fn(async () => Array.from(hoistedState.ilabRuns.values(), (run) => ({ id: run.id }))),
    account: {
      findUnique: vi.fn(async ({ where }: { where: { provider_providerAccountId?: { provider: string; providerAccountId: string } } }) => {
        const key = `${where.provider_providerAccountId?.provider}:${where.provider_providerAccountId?.providerAccountId}`;
        const acc = hoistedState.accounts.get(key);
        if (!acc) return null;
        const user = hoistedState.users.get(String(acc.userId));
        if (!user) return null;
        const profile = Array.from(hoistedState.profiles.values()).find((p) => p.userId === user.id) ?? null;
        return { ...acc, user: { ...user, profile } };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        for (const [k, acc] of hoistedState.accounts.entries()) {
          if (acc.id === where.id) {
            const updated = { ...acc, ...data };
            hoistedState.accounts.set(k, updated);
            return updated;
          }
        }
        return null;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return hoistedState.users.get(where.id) ?? null;
        if (where.email) {
          return Array.from(hoistedState.users.values()).find((u) => u.email === where.email) ?? null;
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const cur = hoistedState.users.get(where.id)!;
        const updated = { ...cur, ...data };
        hoistedState.users.set(where.id, updated);
        return updated;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = nextId('user');
        const profileInput = (data.profile as { create?: Record<string, unknown> } | undefined)?.create;
        const accountInput = (data.accounts as { create?: Record<string, unknown> } | undefined)?.create;
        const userRecord = {
          id,
          name: data.name ?? null,
          email: data.email ?? null,
          role: data.role ?? 'STUDENT',
          accountSource: data.accountSource ?? 'PLATFORM',
        };
        hoistedState.users.set(id, userRecord);
        if (profileInput) {
          const profileId = nextId('prof');
          hoistedState.profiles.set(profileId, { id: profileId, userId: id, ...profileInput });
        }
        if (accountInput) {
          const accountId = nextId('acc');
          const key = `${accountInput.provider}:${accountInput.providerAccountId}`;
          hoistedState.accounts.set(key, { id: accountId, userId: id, ...accountInput });
        }
        return userRecord;
      }),
    },
    studentProfile: {
      findFirst: vi.fn(async ({ where }: { where: { studentNumber?: string; userId?: string } }) => {
        return Array.from(hoistedState.profiles.values()).find(
          (p) => (where.studentNumber && p.studentNumber === where.studentNumber)
            || (where.userId && p.userId === where.userId),
        ) ?? null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { studentNumber?: string; userId?: string } }) => {
        return Array.from(hoistedState.profiles.values()).find(
          (p) => (where.studentNumber && p.studentNumber === where.studentNumber)
            || (where.userId && p.userId === where.userId),
        ) ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const cur = hoistedState.profiles.get(where.id)!;
        const updated = { ...cur, ...data };
        hoistedState.profiles.set(where.id, updated);
        return updated;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = nextId('prof');
        const created = { id, ...data };
        hoistedState.profiles.set(id, created);
        return created;
      }),
    },
    ilabExperimentRun: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return Array.from(hoistedState.ilabRuns.values()).find((r) => {
          if (where.userId && r.userId !== where.userId) return false;
          if (where.vesselId && r.vesselId !== where.vesselId) return false;
          if (where.status !== undefined && r.status !== where.status) return false;
          if (where.appId && r.appId !== where.appId) return false;
          if (where.ilabUsername && r.ilabUsername !== where.ilabUsername) return false;
          if (where.reportId && r.reportId !== where.reportId) return false;
          if (where.experimentVersion && r.experimentVersion !== where.experimentVersion) return false;
          if (Array.isArray(where.OR)) {
            return where.OR.some((clause: Record<string, unknown>) => {
              if (clause.status !== undefined && r.status === clause.status) return true;
              const us = clause.uploadStatus as { in?: string[] } | undefined;
              if (us?.in && us.in.includes(String(r.uploadStatus))) return true;
              return false;
            });
          }
          return true;
        }) ?? null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id?: string; originId?: string } }) => {
        if (where.id) return hoistedState.ilabRuns.get(where.id) ?? null;
        if (where.originId) {
          return Array.from(hoistedState.ilabRuns.values()).find((r) => r.originId === where.originId) ?? null;
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id?: string; originId?: string }; data: Record<string, unknown> }) => {
        const target = where.id
          ? hoistedState.ilabRuns.get(where.id)
          : Array.from(hoistedState.ilabRuns.values()).find((r) => r.originId === where.originId);
        if (!target) return null;
        const updated = { ...target, ...data, updatedAt: new Date() };
        hoistedState.ilabRuns.set(String(target.id), updated);
        return updated;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    virtualSimulationReport: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string } }) => {
        if (where.id) return hoistedState.reports.get(where.id) ?? null;
        return null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const cur = hoistedState.reports.get(where.id)!;
        const updated = { ...cur, ...data };
        hoistedState.reports.set(where.id, updated);
        return updated;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = nextId('rep');
        const created = { id, revision: 1, createdAt: new Date(), updatedAt: new Date(), ...data };
        hoistedState.reports.set(id, created);
        return created;
      }),
    },
    stepSubmissionAttempt: {
      findMany: vi.fn(async ({ where }: { where: { userId: string; experimentKey: string } }) => {
        return hoistedState.attempts.filter(
          (a) => a.userId === where.userId && a.experimentKey === where.experimentKey,
        );
      }),
    },
  };

  return {
    state: hoistedState,
    mocks: {
      prisma: {
        ...tx,
        $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      },
      getServerAuthSession: vi.fn(async () => null),
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/user-sync', () => ({
  initializeUserProgress: vi.fn(async () => undefined),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/lru-cache', () => ({
  sessionProfileCache: new Map(),
}));

import { emptyAiLedger, isAiUsageLedger } from '@/features/ilab/ai-data';
import {
  ACCOUNT_SOURCE_ILAB,
  applyIlabNextAuthSessionCookie,
  ensureIlabPlatformUser,
} from '@/features/ilab/adapters/ilab-account-service';
import { uploadCourseReportToIlab } from '@/features/ilab/adapters/ilab-course-upload';
import {
  findRecoverableIlabRun,
  assertIlabRunAccess,
  mergeStepDrafts,
  saveIlabRunDraft,
} from '@/features/ilab/adapters/ilab-session-lifecycle';
import { syncPlatformReportForIlabRun } from '@/features/ilab/adapters/ilab-report-sync';
import { recordSimulationKonlingAiUsage } from '@/features/ilab/adapters/konling-ai-ledger';
import { extractIlabUserProfileClaims } from '@/features/ilab/ilab-client';
import { resolveServerOwnedChatPageContext } from '@/lib/ai/chat-context-boundary';
import { getStepAIContext } from '@/lib/course-ai-contexts';
import { summarizeVesselReview, vesselCourseStepReviewLimits } from '../course-report-review-contract';

function encodeUnsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

describe('iLab auth, Konling AI registration/ledger, and state recovery', () => {
  beforeEach(() => {
    state.users.clear();
    state.profiles.clear();
    state.accounts.clear();
    state.ilabRuns.clear();
    state.reports.clear();
    state.attempts.length = 0;
    state.seqCounter = 0;
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'test-ilab-auth-secret-1234567890';
    process.env.ILAB_APP_ID = 'app-test-1';
    process.env.ILAB_SECRET = 'secret-test-1';
    process.env.ILAB_BASE_URL = 'https://ilab.example.test';
    delete process.env.ILAB_DEV_BYPASS;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires the active account to own iLab records and rejects a stale grant from another account', async () => {
    const run = { userId: 'ilab-owner', appId: 'app-test-1', ilabUsername: 'ilab_u1' };
    const grant = { v: 1 as const, appId: run.appId, username: run.ilabUsername,
      displayName: '实验空间同学', accessToken: 'test-token', issuedAtMs: Date.now(), bypass: false };
    await expect(assertIlabRunAccess(run, { userId: run.userId, grant })).resolves.toBeUndefined();
    await expect(assertIlabRunAccess(run, {})).rejects.toMatchObject({ status: 403 });
    await expect(assertIlabRunAccess(run, { userId: 'another-account', grant })).rejects.toMatchObject({ status: 403 });
    await expect(assertIlabRunAccess({ ...run, userId: null }, { grant })).resolves.toBeUndefined();
  });

  it('extracts comprehensive claims across envelope, nested user/data, JWT accessToken and ticket while ignoring status envelope code', () => {
    const ticketJwt = encodeUnsignedJwt({
      college: '自动化学院',
      enrollYear: '2024',
      phone: '13800138000',
    });
    const accessJwt = encodeUnsignedJwt({
      sub: 'u_jwt',
      majorName: '自动化',
      sex: '女',
    });

    const claims = extractIlabUserProfileClaims(
      {
        code: 0,
        msg: '成功',
        status: 'ok',
        un: 'ilab_2024001',
        dis: '陈航',
        user: {
          studentNo: '202401001',
          email: 'ChenHang@Example.EDU.CN',
        },
        data: {
          schoolName: '江苏科技大学',
          className: '控制2401',
        },
      },
      accessJwt,
      ticketJwt,
    );

    expect(claims.username).toBe('ilab_2024001');
    expect(claims.displayName).toBe('陈航');
    expect(claims.studentNumber).toBe('202401001');
    expect(claims.email).toBe('chenhang@example.edu.cn');
    expect(claims.school).toBe('江苏科技大学');
    expect(claims.department).toBe('自动化学院');
    expect(claims.major).toBe('自动化');
    expect(claims.className).toBe('控制2401');
    expect(claims.year).toBe(2024);
    expect(claims.phone).toBe('13800138000');
    expect(claims.gender).toBe('女');
    expect(claims.rawAttributes.code).toBeUndefined();
    expect(claims.rawAttributes.status).toBeUndefined();
  });

  it('idempotently provisions ILAB user + StudentProfile + Account and avoids conflicting email/studentNumber', async () => {
    const first = await ensureIlabPlatformUser({
      appId: 'app-test-1',
      token: {
        accessToken: 'tok-1',
        username: 'ilab_s1',
        displayName: '王海洋',
        expiresAtMs: Date.now() + 3600_000,
        bypass: false,
        profileClaims: {
          username: 'ilab_s1',
          displayName: '王海洋',
          studentNumber: 'S2026001',
          email: 'why@just.edu.cn',
          className: '海工2401',
          major: '船舶控制',
          year: 2024,
          rawAttributes: {},
        },
      },
    });

    expect(first.created).toBe(true);
    expect(first.user.accountSource).toBe(ACCOUNT_SOURCE_ILAB);
    expect(first.user.email).toBe('why@just.edu.cn');
    expect(state.profiles.size).toBe(1);
    expect(Array.from(state.profiles.values())[0]).toMatchObject({
      studentNumber: 'S2026001',
      className: '海工2401',
      major: '船舶控制',
      year: '2024',
    });

    const repeat = await ensureIlabPlatformUser({
      appId: 'app-test-1',
      token: {
        accessToken: 'tok-2',
        username: 'ilab_s1',
        displayName: '王海洋（更新）',
        expiresAtMs: Date.now() + 3600_000,
        bypass: false,
      },
    });
    expect(repeat.created).toBe(false);
    expect(repeat.user.id).toBe(first.user.id);
    expect(state.users.size).toBe(1);

    // 另一名学生误带相同 email 与 studentNumber 时安全避让不冲突
    const second = await ensureIlabPlatformUser({
      appId: 'app-test-1',
      token: {
        accessToken: 'tok-3',
        username: 'ilab_s2',
        displayName: '李航',
        expiresAtMs: Date.now() + 3600_000,
        bypass: false,
        profileClaims: {
          username: 'ilab_s2',
          displayName: '李航',
          studentNumber: 'S2026001',
          email: 'why@just.edu.cn',
          rawAttributes: {},
        },
      },
    });
    expect(second.created).toBe(true);
    expect(second.user.id).not.toBe(first.user.id);
    expect(second.user.email).toBeNull();
    const secondProfile = Array.from(state.profiles.values()).find((p) => p.userId === second.user.id);
    expect(secondProfile?.studentNumber).toBe('ilab_s2');
  });

  it('mints a NextAuth JWT session cookie decodable with exact user id and role', async () => {
    const response = NextResponse.json({ ok: true });
    await applyIlabNextAuthSessionCookie(
      response,
      { id: 'user-ilab-99', name: '张海工', email: 'zhang@just.edu.cn', role: 'STUDENT' },
      new Request('http://localhost:3000/api/ilab/grant'),
    );

    const cookie = response.cookies.get('next-auth.session-token');
    expect(cookie?.value).toBeTruthy();

    const decoded = await decode({
      token: cookie!.value,
      secret: process.env.NEXTAUTH_SECRET!,
    });
    expect(decoded).toMatchObject({
      sub: 'user-ilab-99',
      id: 'user-ilab-99',
      name: '张海工',
      email: 'zhang@just.edu.cn',
      role: 'STUDENT',
    });
  });

  it('registers all 7 simulation courses (20 steps each) in AI context & records Konling usage into active run ledger', async () => {
    const simulationCourses: Array<{ courseId: string; stepPrefix: string; expectedVessel: string }> = [
      { courseId: 'destroyer-heading-experiment', stepPrefix: 'destroyer-step', expectedVessel: 'destroyer-055' },
      { courseId: 'lng-berthing-experiment', stepPrefix: 'lng-berthing-step', expectedVessel: 'fleet-lng-changheng' },
      { courseId: 'container-voyage-experiment', stepPrefix: 'container-voyage-step', expectedVessel: 'fleet-container-msc' },
      { courseId: 'cruise-comfort-experiment', stepPrefix: 'cruise-comfort-step', expectedVessel: 'fleet-cruise-adora' },
      { courseId: 'drilling-dp-experiment', stepPrefix: 'drilling-dp-step', expectedVessel: 'fleet-drill-hysy981' },
      { courseId: 'icebreaker-ice-experiment', stepPrefix: 'icebreaker-ice-step', expectedVessel: 'fleet-icebreaker-xuelong' },
      { courseId: 'dredger-mode-experiment', stepPrefix: 'dredger-mode-step', expectedVessel: 'fleet-dredger-tianjing' },
    ];

    for (const course of simulationCourses) {
      for (let seq = 1; seq <= 20; seq += 1) {
        const stepId = `${course.stepPrefix}-${seq}`;
        expect(getStepAIContext(course.courseId, stepId)).not.toBeNull();
        const serverOwned = resolveServerOwnedChatPageContext({ courseId: course.courseId, stepId });
        expect(serverOwned.ok).toBe(true);
      }
    }

    state.ilabRuns.set('run-lng-1', {
      id: 'run-lng-1',
      originId: 'ves_lng_1',
      userId: 'user-1',
      vesselId: 'fleet-lng-changheng',
      status: 2,
      aiLedger: emptyAiLedger(),
      updatedAt: new Date(),
    });

    await recordSimulationKonlingAiUsage({
      userId: 'user-1',
      courseId: 'lng-berthing-experiment',
      stepId: 'lng-berthing-step-3',
      model: 'Qwen/Qwen3-235B-A22B',
      provider: 'siliconflow',
      endpoint: 'https://api.siliconflow.cn/v1',
      inputTokens: 420,
      outputTokens: 185,
    });

    const updated = state.ilabRuns.get('run-lng-1')!;
    expect(isAiUsageLedger(updated.aiLedger)).toBe(true);
    const ledger = updated.aiLedger as ReturnType<typeof emptyAiLedger>;
    expect(ledger.callCount).toBe(1);
    expect(ledger.inputTokens).toBe(420);
    expect(ledger.outputTokens).toBe(185);
    expect(ledger.models?.[0]?.model).toBe('Qwen/Qwen3-235B-A22B');
  });

  it('recovers unfinished runs with stepDrafts across fresh iLab ticket re-entry', async () => {
    state.ilabRuns.set('run-1', {
      id: 'run-1',
      originId: 'dds_rec_1',
      userId: 'user-ilab-1',
      vesselId: 'destroyer-055',
      experimentVersion: 'seven-vessel-2026.11.14',
      appId: 'app-test-1',
      ilabUsername: 'ilab_u1',
      displayName: '陈海',
      accessToken: 'old-token',
      tokenExpiresAt: new Date(Date.now() + 600_000),
      status: 2,
      uploadStatus: 'pending',
      stepDrafts: mergeStepDrafts(null, { activeSeq: 7, seq: 7, readings: { prediction: '超调小于10%' } }),
      updatedAt: new Date(),
    });

    const saved = await saveIlabRunDraft({
      originId: 'dds_rec_1',
      expectedVesselId: 'destroyer-055',
      actor: { userId: 'user-ilab-1', grant: null },
      activeSeq: 8,
      seq: 8,
      readings: { prediction: '加入积分限幅抑制饱和' },
    });
    expect(saved.activeSeq).toBe(8);
    expect(saved.bySeq['8']?.prediction).toBe('加入积分限幅抑制饱和');

    const recovered = await findRecoverableIlabRun({
      vesselId: 'destroyer-055',
      experimentVersion: 'seven-vessel-2026.11.14',
      actor: {
        kind: 'ilab',
        userId: 'user-ilab-1',
        displayName: '陈海',
        user: {
          id: 'user-ilab-1',
          name: '陈海',
          email: null,
          role: 'STUDENT',
          accountSource: ACCOUNT_SOURCE_ILAB,
        },
        grantToSet: {
          v: 1,
          appId: 'app-test-1',
          username: 'ilab_u1',
          displayName: '陈海',
          accessToken: 'fresh-ticket-token',
          issuedAtMs: Date.now(),
          expiresAtMs: Date.now() + 7200_000,
          bypass: false,
          userId: 'user-ilab-1',
        },
      },
    });

    expect(recovered?.originId).toBe('dds_rec_1');
    expect(recovered?.accessToken).toBe('fresh-ticket-token');
  });

  it('preserves VirtualSimulationReport on upload failure and completes idempotently on retry', async () => {
    const runId = 'run-upload-1';
    state.ilabRuns.set(runId, {
      id: runId,
      originId: 'dds_up_1',
      userId: 'user-1',
      reportId: null,
      vesselId: 'destroyer-055',
      experimentVersion: 'seven-vessel-2026.11.14',
      appId: 'app-test-1',
      ilabUsername: 'ilab_u1',
      displayName: '赵帆',
      accessToken: 'valid-token',
      tokenExpiresAt: new Date(Date.now() + 3600_000),
      startTimeMs: BigInt(1_700_000_000_000),
      status: 2,
      score: 0,
      uploadStatus: 'pending',
      aiLedger: emptyAiLedger(),
      reportHtml: null,
      updatedAt: new Date(),
    });

    const synced = await syncPlatformReportForIlabRun({
      runId,
      userId: 'user-1',
      experimentKey: 'destroyer',
      experimentVersion: 'seven-vessel-2026.11.14',
      title: '055型驱逐舰航向控制实验',
      score: 92,
      maxScore: 100,
      reportHtml: '<html><body><p>完整课程实验报告</p></body></html>',
      stepScores: [],
    });
    expect(synced.reportId).toBeTruthy();

    state.reports.set(synced.reportId!, {
      ...state.reports.get(synced.reportId!)!,
      clientRef: '11111111-1111-4111-8111-111111111111',
      status: 'submitted',
    });

    for (let seq = 1; seq <= 20; seq += 1) {
      state.attempts.push({
        id: `att-${seq}`,
        userId: 'user-1',
        experimentKey: 'destroyer:11111111-1111-4111-8111-111111111111',
        stepKey: `destroyer-step-${seq}`,
        attemptSeq: 1,
        status: 'submitted',
        selectedFinalAt: null,
        explanation: `步骤 ${seq} 完成`,
        updatedAt: new Date(1_700_000_000_000 + seq * 3_000),
      });
    }

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ETIMEDOUT')));

    const pendingOutcome = await uploadCourseReportToIlab({
      reportId: synced.reportId!, actorUserId: 'user-1', originId: 'dds_up_1',
    });
    expect(pendingOutcome).toMatchObject({ uploaded: false, retryableUpload: false });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    const reviewSteps = Array.from({ length: 20 }, (_, index) => ({
      stepSequence: index + 1, attemptId: `att-${index + 1}`, feedback: '保留未达到性能目标的结果',
      ...vesselCourseStepReviewLimits('destroyer', index + 1), performance: 0,
    }));
    const confirmedScore = summarizeVesselReview(reviewSteps).finalScore;
    state.reports.set(synced.reportId!, { ...state.reports.get(synced.reportId!)!,
      status: 'finalized', finalizedAt: new Date(), score: confirmedScore, rubric: { steps: reviewSteps } });

    const failedOutcome = await uploadCourseReportToIlab({
      reportId: synced.reportId!,
      actorUserId: 'user-1',
      originId: 'dds_up_1',
    });

    expect(failedOutcome.uploaded).toBe(false);
    expect(failedOutcome.retryableUpload).toBe(true);
    expect(state.reports.get(synced.reportId!)?.status).toBe('finalized');
    expect(state.ilabRuns.get(runId)?.uploadStatus).toBe('failed');
    expect(state.ilabRuns.get(runId)?.reportId).toBe(synced.reportId);

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => (
      new Response(JSON.stringify({ code: 0, msg: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )));

    const retryOutcome = await uploadCourseReportToIlab({
      reportId: synced.reportId!,
      actorUserId: 'user-1',
      originId: 'dds_up_1',
    });

    expect(retryOutcome.uploaded).toBe(true);
    expect(retryOutcome.retryableUpload).toBe(false);
    expect(state.ilabRuns.get(runId)?.status).toBe(1);
    expect(state.ilabRuns.get(runId)?.uploadStatus).toBe('uploaded');
    expect(state.ilabRuns.get(runId)?.score).toBe(confirmedScore);
    expect(state.reports.size).toBe(1);
  });
});
