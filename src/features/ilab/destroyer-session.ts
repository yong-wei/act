import { randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  assertDestroyerStepOrder,
  chooseBetterDestroyerAttempt,
  buildDestroyerReportHtml,
  DESTROYER_EXPERIMENT_TITLE,
  DESTROYER_MAX_POINTS,
  DESTROYER_STEP_BY_SEQ,
  readDestroyerSamples,
  scoreDestroyerStep,
  thinDestroyerSamples,
  type DestroyerReadings,
  type DestroyerSample,
} from '@/resources/simulations/simulations/destroyer-experiment';

import { emptyAiLedger, isAiUsageLedger, recordAiCall, type AiUsageLedger } from './ai-data';
import type { IlabGrantPayload } from './grant-cookie';
import { recognizeSketch } from './sketch-recognition';
import { ILAB_PROJECT_TITLE, buildIlabUploadBody, type IlabUploadBody, type StoredIlabStep } from './payload';
import { assertIlabRunOpen, IlabServiceError, toIlabHttpError, withIlabRunLock } from './run-lock';
import { buildSafeStepWindow, ilabConfig, resolveSessionAuth, uploadWithAutoRefresh } from './session-shared';

export { toIlabHttpError };

export interface DestroyerSessionView {
  originId: string;
  displayName: string;
  status: number;
  score: number;
  uploadStatus: string;
  currentSeq: number;
  reportReady: boolean;
  steps: Array<{
    seq: number;
    title: string;
    earnedPoints: number;
    maxPoints: number;
    evaluation: string;
    remarks: string;
    readings: DestroyerReadings;
    samples: DestroyerSample[];
  }>;
}

interface RunRecord {
  originId: string;
  appId: string;
  ilabUsername: string;
  displayName: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
  startTimeMs: bigint;
  status: number;
  score: number;
  steps: Prisma.JsonValue;
  aiLedger: Prisma.JsonValue;
  reportHtml: string | null;
  uploadStatus: string;
}

interface StoredDestroyerStep extends StoredIlabStep {
  samples: DestroyerSample[];
  readings: DestroyerReadings;
}

function readReadings(value: unknown): DestroyerReadings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const readings: DestroyerReadings = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') readings[key] = item.slice(0, 400);
    else if (typeof item === 'number' && Number.isFinite(item)) readings[key] = String(item);
  }
  return readings;
}

function readSteps(value: Prisma.JsonValue): StoredDestroyerStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as unknown as StoredDestroyerStep;
    if (typeof record.seq !== 'number') return [];
    return [{
      ...record,
      samples: readDestroyerSamples(record.samples),
      readings: readReadings(record.readings),
    }];
  });
}

function readLedger(value: Prisma.JsonValue): AiUsageLedger {
  return isAiUsageLedger(value) ? value : emptyAiLedger();
}

function currentSeq(steps: StoredDestroyerStep[]): number {
  const done = new Set(steps.map((step) => step.seq));
  for (let seq = 1; seq <= DESTROYER_STEP_BY_SEQ.size; seq += 1) {
    if (!done.has(seq)) return seq;
  }
  return DESTROYER_STEP_BY_SEQ.size;
}

function viewOf(run: RunRecord): DestroyerSessionView {
  const steps = readSteps(run.steps);
  return {
    originId: run.originId,
    displayName: run.displayName,
    status: run.status,
    score: run.score,
    uploadStatus: run.uploadStatus,
    currentSeq: currentSeq(steps),
    reportReady: Boolean(run.reportHtml),
    steps: steps.map((step) => ({
      seq: step.seq,
      title: step.title,
      earnedPoints: step.earnedPoints,
      maxPoints: step.maxPoints,
      evaluation: step.evaluation,
      remarks: step.remarks,
      readings: step.readings,
      samples: step.samples,
    })),
  };
}

async function findRun(originId: string): Promise<RunRecord> {
  if (!/^dds_[A-Za-z0-9_]{1,48}$/.test(originId)) {
    throw new IlabServiceError('实验记录编号无效。', 400);
  }
  const run = await prisma.ilabExperimentRun.findUnique({ where: { originId } });
  if (!run) throw new IlabServiceError('实验记录不存在。', 404);
  return run;
}

export type OpenDestroyerSessionResult =
  | { connected: false }
  | { connected: true; session: DestroyerSessionView; grantToSet: IlabGrantPayload };

export async function openDestroyerSession(input: {
  ticket?: string;
  grant?: IlabGrantPayload | null;
}): Promise<OpenDestroyerSessionResult> {
  const auth = await resolveSessionAuth(input.ticket ?? '', input.grant ?? null);
  if (!auth) {
    return { connected: false };
  }
  const { grant } = auth;
  const originId = `dds_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
  const runStartTimeMs = Math.max(Date.now(), grant.issuedAtMs);
  const run = await prisma.ilabExperimentRun.create({
    data: {
      originId,
      appId: grant.appId,
      ilabUsername: grant.username,
      displayName: grant.displayName,
      accessToken: grant.accessToken,
      tokenExpiresAt: grant.expiresAtMs ? new Date(grant.expiresAtMs) : null,
      startTimeMs: BigInt(runStartTimeMs),
      vesselId: 'destroyer-055',
      steps: [],
      aiLedger: emptyAiLedger() as unknown as Prisma.InputJsonValue,
    },
  });
  return { connected: true, session: viewOf(run), grantToSet: grant };
}

export async function readDestroyerSession(originId: string): Promise<DestroyerSessionView> {
  return viewOf(await findRun(originId));
}

export async function submitDestroyerStep(originId: string, input: {
  seq: number;
  readings: DestroyerReadings;
  samples: DestroyerSample[];
  startedAtMs: number;
  sketchImage?: string;
}): Promise<DestroyerSessionView> {
  if (!/^dds_[A-Za-z0-9_]{1,48}$/.test(originId)) {
    throw new IlabServiceError('实验记录编号无效。', 400);
  }
  const definition = DESTROYER_STEP_BY_SEQ.get(input.seq);
  if (!definition) throw new IlabServiceError('实验步骤不存在。', 400);
  const samples = thinDestroyerSamples(readDestroyerSamples(input.samples));
  const readings = { ...input.readings };
  delete readings.sketchImage;
  const recognition = definition.fields.some((field) => field.kind === 'sketch')
    ? await recognizeSketch({ image: input.sketchImage ?? '' })
    : null;
  if (recognition && !recognition.ok) throw new IlabServiceError(recognition.message, 422);
  if (recognition?.ok) Object.assign(readings, recognition.fields);
  const scored = scoreDestroyerStep(input.seq, samples, readings);
  if (!scored.ok) throw new IlabServiceError(scored.message, 422);
  const saved = await withIlabRunLock(originId, async (run, tx) => {
    if (!run.originId.startsWith('dds_')) throw new IlabServiceError('实验记录不存在。', 404);
    assertIlabRunOpen(run);
    const steps = readSteps(run.steps);
    const order = assertDestroyerStepOrder(steps.map((step) => step.seq), input.seq);
    if (order) throw new IlabServiceError(order, 422);
    const existing = steps.find((step) => step.seq === input.seq);
    if (existing && chooseBetterDestroyerAttempt({ earnedPoints: existing.earnedPoints }, { earnedPoints: scored.earnedPoints }).keptPrevious) {
      return run;
    }
    const window = buildSafeStepWindow({
      startedAtMs: input.startedAtMs,
      runStartTimeMs: run.startTimeMs,
      existingSteps: steps,
      seq: definition.seq,
    });
    const stored: StoredDestroyerStep = {
      seq: definition.seq,
      title: definition.title,
      startTime: window.startTime,
      endTime: window.endTime,
      timeUsed: window.timeUsed,
      expectTime: definition.expectTime,
      earnedPoints: scored.earnedPoints,
      maxPoints: scored.maxPoints,
      repeatCount: (existing?.repeatCount ?? 0) + 1,
      evaluation: scored.evaluation,
      scoringModel: '对照曲线读数',
      remarks: scored.remarks,
      samples,
      readings,
    };
    const nextSteps = [...steps.filter((step) => step.seq !== input.seq), stored];
    const ledger = recognition?.ok ? recordAiCall(readLedger(run.aiLedger), recognition.call) : readLedger(run.aiLedger);
    return tx.ilabExperimentRun.update({
      where: { originId },
      data: {
        steps: nextSteps as unknown as Prisma.InputJsonValue,
        aiLedger: ledger as unknown as Prisma.InputJsonValue,
        score: Math.round(nextSteps.reduce((sum, step) => sum + step.earnedPoints, 0) / DESTROYER_MAX_POINTS * 100),
      },
    });
  });
  return viewOf(saved);
}

export async function completeDestroyerSession(originId: string): Promise<{
  session: DestroyerSessionView;
  upload: IlabUploadBody | null;
  remote: { message: string };
  refreshedGrant: IlabGrantPayload | null;
}> {
  const run = await findRun(originId);
  if (run.status === 1 && run.reportHtml && run.uploadStatus === 'uploaded') {
    return { session: viewOf(run), upload: null, remote: { message: '实验成绩和报告已经回传。' }, refreshedGrant: null };
  }
  const steps = readSteps(run.steps);
  const done = new Set(steps.map((step) => step.seq));
  for (let seq = 1; seq <= DESTROYER_STEP_BY_SEQ.size; seq += 1) {
    if (!done.has(seq)) throw new IlabServiceError('请先完成全部实验步骤。', 422);
  }
  const ledger = readLedger(run.aiLedger);
  const reportHtml = buildDestroyerReportHtml({
    displayName: run.displayName,
    steps,
  });
  const bypass = run.accessToken === 'dev-bypass-token';
  const config = ilabConfig();
  const upload = buildIlabUploadBody({
    username: run.ilabUsername,
    appId: bypass ? 'dev' : run.appId,
    originId: run.originId,
    title: ILAB_PROJECT_TITLE,
    childProjectTitle: DESTROYER_EXPERIMENT_TITLE,
    status: 1,
    steps,
    ledger,
    pointTotal: DESTROYER_MAX_POINTS,
    runStartTimeMs: Number(run.startTimeMs),
  });
  if (bypass) {
    const saved = await prisma.ilabExperimentRun.update({
      where: { originId },
      data: {
        status: 1,
        score: upload.score,
        endTimeMs: BigInt(upload.endTime),
        timeUsedSeconds: upload.timeUsed,
        reportHtml,
        uploadStatus: 'skipped',
        uploadResult: { skipped: true, reason: 'dev-bypass' },
      },
    });
    return {
      session: viewOf(saved),
      upload,
      remote: { message: '本地演示没有回传实验空间。报告已生成。' },
      refreshedGrant: null,
    };
  }
  const { saved, refreshedGrant } = await uploadWithAutoRefresh<RunRecord>({
    run,
    config,
    upload,
    reportFilename: 'destroyer-experiment-report.html',
    reportTitle: `${DESTROYER_EXPERIMENT_TITLE}实验报告`,
    reportHtml,
  });
  return {
    session: viewOf(saved),
    upload,
    remote: { message: '成绩和实验报告已回传。' },
    refreshedGrant,
  };
}
