import { randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  assertVesselStepOrder,
  chooseBetterVesselAttempt,
  buildVesselReportHtml,
  readVesselSamples,
  thinVesselSamples,
  vesselMaxPoints,
  type VesselExperiment,
  type VesselReadings,
  type VesselSample,
} from '@/resources/simulations/simulations/vessel-experiment';
import { findVesselExperiment, VESSEL_EXPERIMENTS } from '@/resources/simulations/simulations/vessel-experiments';

import { emptyAiLedger, isAiUsageLedger, type AiUsageLedger } from './ai-data';
import { exchangeIlabTicket, uploadIlabReport, uploadIlabScore } from './ilab-client';
import { buildIlabUploadBody, type IlabUploadBody, type StoredIlabStep } from './payload';
import { IlabServiceError, toIlabHttpError } from './session-service';

export { toIlabHttpError };

export interface VesselSessionView {
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
    readings: VesselReadings;
    samples: VesselSample[];
  }>;
}

interface RunRecord {
  originId: string;
  appId: string;
  ilabUsername: string;
  displayName: string;
  accessToken: string;
  status: number;
  score: number;
  vesselId: string;
  steps: Prisma.JsonValue;
  aiLedger: Prisma.JsonValue;
  reportHtml: string | null;
  uploadStatus: string;
}

interface StoredVesselStep extends StoredIlabStep {
  samples: VesselSample[];
  readings: VesselReadings;
}

function ilabConfig() {
  return {
    appId: process.env.ILAB_APP_ID?.trim() || '',
    secret: process.env.ILAB_SECRET?.trim() || '',
    baseUrl: process.env.ILAB_BASE_URL?.trim() || 'https://www.ilab-x.com',
    devBypass: process.env.ILAB_DEV_BYPASS === '1',
  };
}

function readReadings(value: unknown): VesselReadings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const readings: VesselReadings = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') readings[key] = item.slice(0, 400);
    else if (typeof item === 'number' && Number.isFinite(item)) readings[key] = String(item);
  }
  return readings;
}

function readSteps(value: Prisma.JsonValue): StoredVesselStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as unknown as StoredVesselStep;
    if (typeof record.seq !== 'number') return [];
    return [{
      ...record,
      samples: readVesselSamples(record.samples),
      readings: readReadings(record.readings),
    }];
  });
}

function readLedger(value: Prisma.JsonValue): AiUsageLedger {
  return isAiUsageLedger(value) ? value : emptyAiLedger();
}

function experimentFromOrigin(originId: string): VesselExperiment {
  const experiment = VESSEL_EXPERIMENTS.find((item) => new RegExp(`^${item.originPrefix}[A-Za-z0-9_]{1,48}$`).test(originId));
  if (!experiment) throw new IlabServiceError('实验记录编号无效。', 400);
  return experiment;
}

function currentSeq(experiment: VesselExperiment, steps: StoredVesselStep[]): number {
  const done = new Set(steps.map((step) => step.seq));
  for (const step of experiment.steps) {
    if (!done.has(step.seq)) return step.seq;
  }
  return experiment.steps.length;
}

function viewOf(experiment: VesselExperiment, run: RunRecord): VesselSessionView {
  const steps = readSteps(run.steps);
  return {
    originId: run.originId,
    displayName: run.displayName,
    status: run.status,
    score: run.score,
    uploadStatus: run.uploadStatus,
    currentSeq: currentSeq(experiment, steps),
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

async function findRun(originId: string): Promise<{ experiment: VesselExperiment; run: RunRecord }> {
  const experiment = experimentFromOrigin(originId);
  const run = await prisma.ilabExperimentRun.findUnique({ where: { originId } });
  if (!run || run.vesselId !== experiment.vesselId) throw new IlabServiceError('实验记录不存在。', 404);
  return { experiment, run };
}

function stepWindow(startedAtMs: number, now: number): { startTime: number; endTime: number; timeUsed: number } {
  const requested = Number.isFinite(startedAtMs) ? Math.floor(startedAtMs) : now - 1000;
  const startTime = Math.min(requested, now - 1000);
  const timeUsed = Math.max(1, Math.round((now - startTime) / 1000));
  return { startTime, endTime: startTime + timeUsed * 1000, timeUsed };
}

function clip(value: string): string {
  return value.length <= 200 ? value : value.slice(0, 200);
}

export async function openVesselSession(ticket: string, experimentKey: string): Promise<VesselSessionView> {
  const experiment = findVesselExperiment(experimentKey);
  if (!experiment) throw new IlabServiceError('实验不存在。', 404);
  const trimmed = ticket.trim();
  if (!trimmed) throw new IlabServiceError('缺少 ticket。', 400);
  const config = ilabConfig();
  const token = await exchangeIlabTicket({
    ticket: trimmed,
    appId: config.appId,
    secret: config.secret,
    baseUrl: config.baseUrl,
    devBypass: config.devBypass,
  }).catch((error: unknown) => {
    throw new IlabServiceError(error instanceof Error ? error.message : '票据校验失败。', 401);
  });
  const originId = `${experiment.originPrefix}${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
  const run = await prisma.ilabExperimentRun.create({
    data: {
      originId,
      appId: token.bypass ? 'dev' : config.appId,
      ilabUsername: token.username,
      displayName: token.displayName,
      accessToken: token.accessToken,
      tokenExpiresAt: token.expiresAtMs ? new Date(token.expiresAtMs) : null,
      startTimeMs: BigInt(Date.now()),
      vesselId: experiment.vesselId,
      steps: [],
      aiLedger: emptyAiLedger() as unknown as Prisma.InputJsonValue,
    },
  });
  return viewOf(experiment, run);
}

export async function submitVesselStep(originId: string, input: {
  experimentKey: string;
  seq: number;
  readings: VesselReadings;
  samples: VesselSample[];
  startedAtMs: number;
}): Promise<VesselSessionView> {
  const { experiment, run } = await findRun(originId);
  if (input.experimentKey !== experiment.key) throw new IlabServiceError('实验记录和当前实验对不上。', 400);
  if (run.status === 1) throw new IlabServiceError('实验已完成，不能再修改步骤。', 409);
  const steps = readSteps(run.steps);
  const order = assertVesselStepOrder(experiment.steps, steps.map((step) => step.seq), input.seq);
  if (order) throw new IlabServiceError(order, 422);
  const definition = experiment.steps.find((step) => step.seq === input.seq);
  if (!definition) throw new IlabServiceError('实验步骤不存在。', 400);
  const samples = thinVesselSamples(readVesselSamples(input.samples));
  const scored = experiment.score(definition, samples, input.readings);
  if (!scored.ok) throw new IlabServiceError(scored.message, 422);
  const existing = steps.find((step) => step.seq === input.seq);
  if (existing && chooseBetterVesselAttempt({ earnedPoints: existing.earnedPoints }, { earnedPoints: scored.earnedPoints }).keptPrevious) {
    return viewOf(experiment, run);
  }
  const window = stepWindow(input.startedAtMs, Date.now());
  const stored: StoredVesselStep = {
    seq: definition.seq,
    title: definition.title,
    startTime: window.startTime,
    endTime: window.endTime,
    timeUsed: window.timeUsed,
    expectTime: definition.expectTime,
    earnedPoints: scored.earnedPoints,
    maxPoints: scored.maxPoints,
    repeatCount: 1,
    evaluation: clip(scored.evaluation),
    scoringModel: '对照曲线读数',
    remarks: clip(scored.remarks),
    samples,
    readings: input.readings,
  };
  const nextSteps = [...steps.filter((step) => step.seq !== input.seq), stored];
  const saved = await prisma.ilabExperimentRun.update({
    where: { originId },
    data: {
      steps: nextSteps as unknown as Prisma.InputJsonValue,
      score: Math.round(nextSteps.reduce((sum, step) => sum + step.earnedPoints, 0) / vesselMaxPoints(experiment.steps) * 100),
    },
  });
  return viewOf(experiment, saved);
}

export async function completeVesselSession(originId: string): Promise<{
  session: VesselSessionView;
  upload: IlabUploadBody | null;
  remote: { message: string };
}> {
  const { experiment, run } = await findRun(originId);
  if (run.status === 1 && run.reportHtml && run.uploadStatus === 'uploaded') {
    return { session: viewOf(experiment, run), upload: null, remote: { message: '实验成绩和报告已经回传。' } };
  }
  const steps = readSteps(run.steps);
  const done = new Set(steps.map((step) => step.seq));
  for (const step of experiment.steps) {
    if (!done.has(step.seq)) throw new IlabServiceError('请先完成全部实验步骤。', 422);
  }
  const reportHtml = buildVesselReportHtml(experiment, {
    displayName: run.displayName,
    steps,
  });
  const bypass = run.accessToken === 'dev-bypass-token';
  const config = ilabConfig();
  const upload = buildIlabUploadBody({
    username: run.ilabUsername,
    appId: bypass ? 'dev' : run.appId,
    originId: run.originId,
    title: experiment.title,
    childProjectTitle: experiment.title,
    status: 1,
    steps,
    ledger: readLedger(run.aiLedger),
    pointTotal: vesselMaxPoints(experiment.steps),
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
    return { session: viewOf(experiment, saved), upload, remote: { message: '本地演示没有回传实验空间。报告已生成。' } };
  }
  const scoreResult = await uploadIlabScore({
    baseUrl: config.baseUrl,
    accessToken: run.accessToken,
    payload: upload,
  });
  if (scoreResult.code !== 0) {
    await prisma.ilabExperimentRun.update({
      where: { originId },
      data: { reportHtml, uploadStatus: 'failed', uploadResult: scoreResult.body as Prisma.InputJsonValue },
    });
    throw new IlabServiceError(scoreResult.message || `成绩回传失败（code ${scoreResult.code}）。`, 502);
  }
  const reportResult = await uploadIlabReport({
    baseUrl: config.baseUrl,
    accessToken: run.accessToken,
    appId: run.appId,
    originId: run.originId,
    filename: `${experiment.key}-report.html`,
    title: `${experiment.title}实验报告`,
    html: reportHtml,
  });
  const saved = await prisma.ilabExperimentRun.update({
    where: { originId },
    data: {
      status: 1,
      score: upload.score,
      endTimeMs: BigInt(upload.endTime),
      timeUsedSeconds: upload.timeUsed,
      reportHtml,
      uploadStatus: reportResult.code === 0 ? 'uploaded' : 'score-uploaded',
      uploadResult: { code: scoreResult.code },
      attachmentResult: reportResult.body as Prisma.InputJsonValue,
    },
  });
  if (reportResult.code !== 0) {
    throw new IlabServiceError(reportResult.message || `实验报告回传失败（code ${reportResult.code}）。`, 502);
  }
  return { session: viewOf(experiment, saved), upload, remote: { message: '成绩和实验报告已回传。' } };
}
