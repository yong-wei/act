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

import { emptyAiLedger, isAiUsageLedger, recordAiCall, type AiUsageLedger } from './ai-data';
import type { IlabGrantPayload } from './grant-cookie';
import { recognizeSketch } from './sketch-recognition';
import { ILAB_PROJECT_TITLE, buildIlabUploadBody, type IlabUploadBody, type StoredIlabStep } from './payload';
import { assertIlabRunOpen, IlabServiceError, toIlabHttpError, withIlabRunLock } from './run-lock';
import { buildSafeStepWindow, ilabConfig, resolveSessionAuth, uploadWithAutoRefresh } from './session-shared';

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
  tokenExpiresAt: Date | null;
  startTimeMs: bigint;
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

function clip(value: string): string {
  return value.length <= 200 ? value : value.slice(0, 200);
}

export type OpenVesselSessionResult =
  | { connected: false }
  | { connected: true; session: VesselSessionView; grantToSet: IlabGrantPayload };

export async function openVesselSession(input: {
  ticket?: string;
  grant?: IlabGrantPayload | null;
  experimentKey: string;
}): Promise<OpenVesselSessionResult> {
  const experiment = findVesselExperiment(input.experimentKey);
  if (!experiment) throw new IlabServiceError('实验不存在。', 404);
  const auth = await resolveSessionAuth(input.ticket ?? '', input.grant ?? null);
  if (!auth) {
    return { connected: false };
  }
  const { grant } = auth;
  const originId = `${experiment.originPrefix}${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
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
      vesselId: experiment.vesselId,
      steps: [],
      aiLedger: emptyAiLedger() as unknown as Prisma.InputJsonValue,
    },
  });
  return { connected: true, session: viewOf(experiment, run), grantToSet: grant };
}

export async function readVesselSession(originId: string): Promise<VesselSessionView> {
  const { experiment, run } = await findRun(originId);
  return viewOf(experiment, run);
}

export async function submitVesselStep(originId: string, input: {
  experimentKey: string;
  seq: number;
  readings: VesselReadings;
  samples: VesselSample[];
  startedAtMs: number;
  sketchImage?: string;
}): Promise<VesselSessionView> {
  const experiment = experimentFromOrigin(originId);
  if (input.experimentKey !== experiment.key) throw new IlabServiceError('实验记录和当前实验对不上。', 400);
  const definition = experiment.steps.find((step) => step.seq === input.seq);
  if (!definition) throw new IlabServiceError('实验步骤不存在。', 400);
  const samples = thinVesselSamples(readVesselSamples(input.samples));
  const readings = { ...input.readings };
  delete readings.sketchImage;
  const recognition = definition.fields.some((field) => field.kind === 'sketch')
    ? await recognizeSketch({ image: input.sketchImage ?? '' })
    : null;
  if (recognition && !recognition.ok) throw new IlabServiceError(recognition.message, 422);
  if (recognition?.ok) Object.assign(readings, recognition.fields);
  const scored = experiment.score(definition, samples, readings);
  if (!scored.ok) throw new IlabServiceError(scored.message, 422);
  const saved = await withIlabRunLock(originId, async (run, tx) => {
    if (run.vesselId !== experiment.vesselId) throw new IlabServiceError('实验记录不存在。', 404);
    assertIlabRunOpen(run);
    const steps = readSteps(run.steps);
    const order = assertVesselStepOrder(experiment.steps, steps.map((step) => step.seq), input.seq);
    if (order) throw new IlabServiceError(order, 422);
    const existing = steps.find((step) => step.seq === input.seq);
    if (existing && chooseBetterVesselAttempt({ earnedPoints: existing.earnedPoints }, { earnedPoints: scored.earnedPoints }).keptPrevious) {
      return run;
    }
    const window = buildSafeStepWindow({
      startedAtMs: input.startedAtMs,
      runStartTimeMs: run.startTimeMs,
      existingSteps: steps,
      seq: definition.seq,
    });
    const stored: StoredVesselStep = {
      seq: definition.seq,
      title: definition.title,
      startTime: window.startTime,
      endTime: window.endTime,
      timeUsed: window.timeUsed,
      expectTime: definition.expectTime,
      earnedPoints: scored.earnedPoints,
      maxPoints: scored.maxPoints,
      repeatCount: (existing?.repeatCount ?? 0) + 1,
      evaluation: clip(scored.evaluation),
      scoringModel: '对照曲线读数',
      remarks: clip(scored.remarks),
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
        score: Math.round(nextSteps.reduce((sum, step) => sum + step.earnedPoints, 0) / vesselMaxPoints(experiment.steps) * 100),
      },
    });
  });
  return viewOf(experiment, saved);
}

export async function completeVesselSession(originId: string): Promise<{
  session: VesselSessionView;
  upload: IlabUploadBody | null;
  remote: { message: string };
  refreshedGrant: IlabGrantPayload | null;
}> {
  const { experiment, run } = await findRun(originId);
  if (run.status === 1 && run.reportHtml && run.uploadStatus === 'uploaded') {
    return { session: viewOf(experiment, run), upload: null, remote: { message: '实验成绩和报告已经回传。' }, refreshedGrant: null };
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
    title: ILAB_PROJECT_TITLE,
    childProjectTitle: experiment.title,
    status: 1,
    steps,
    ledger: readLedger(run.aiLedger),
    pointTotal: vesselMaxPoints(experiment.steps),
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
      session: viewOf(experiment, saved),
      upload,
      remote: { message: '本地演示没有回传实验空间。报告已生成。' },
      refreshedGrant: null,
    };
  }
  const { saved, refreshedGrant } = await uploadWithAutoRefresh<RunRecord>({
    run,
    config,
    upload,
    reportFilename: `${experiment.key}-report.html`,
    reportTitle: `${experiment.title}实验报告`,
    reportHtml,
  });
  return {
    session: viewOf(experiment, saved),
    upload,
    remote: { message: '成绩和实验报告已回传。' },
    refreshedGrant,
  };
}
