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
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';

import { emptyAiLedger, isAiUsageLedger, recordAiCall, type AiUsageLedger } from './ai-data';
import { buildAuditTelemetry, maskOriginId, type VesselAuditTelemetry } from './telemetry-redaction';
import type { IlabGrantPayload } from './grant-cookie';
import { recognizeSketch } from './sketch-recognition';
import { ILAB_PROJECT_TITLE, buildIlabUploadBody, type IlabUploadBody, type StoredIlabStep } from './payload';
import { assertIlabRunOpen, IlabServiceError, toIlabHttpError, withIlabRunLock } from './run-lock';
import { buildSafeStepWindow, ilabConfig, safeUploadWithAutoRefresh } from './session-shared';
import type { IlabAuthUserSummary } from './adapters/ilab-account-service';
import { syncPlatformReportForIlabRun } from './adapters/ilab-report-sync';
import {
  assertIlabRunAccess,
  openIlabRun,
  mergeStepDrafts,
  parseStepDrafts,
  resolveIlabUploadMode,
  resolveUnifiedSessionActor,
} from './adapters/ilab-session-lifecycle';

export { toIlabHttpError, maskOriginId, type VesselAuditTelemetry };

export interface VesselSessionView {
  userId: string | null;
  experimentVersion: string;
  originId: string;
  displayName: string;
  status: number;
  score: number;
  uploadStatus: string;
  uploadMode: 'local-only' | 'dev-bypass' | 'ilab-remote';
  retryableUpload: boolean;
  currentSeq: number;
  draftActiveSeq?: number;
  reportReady: boolean;
  reportId: string | null;
  reportClientRef?: string;
  reportHtml: string | null;
  auditTelemetry: VesselAuditTelemetry;
  stepDrafts: Record<string, Record<string, string>>;
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
  id: string;
  userId: string | null;
  reportId: string | null;
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
  stepDrafts: Prisma.JsonValue;
  aiLedger: Prisma.JsonValue;
  reportHtml: string | null;
  uploadStatus: string;
  experimentVersion?: string;
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
  const drafts = parseStepDrafts(run.stepDrafts);
  const uploadMode = resolveIlabUploadMode(run);
  return {
    userId: run.userId,
    experimentVersion: run.experimentVersion ?? 'legacy-v1',
    originId: run.originId,
    displayName: run.displayName,
    status: run.status,
    score: run.score,
    uploadStatus: run.uploadStatus,
    uploadMode,
    retryableUpload: uploadMode === 'ilab-remote' && (run.uploadStatus === 'failed' || run.uploadStatus === 'score-uploaded'),
    currentSeq: currentSeq(experiment, steps),
    ...(drafts.activeSeq !== undefined ? { draftActiveSeq: drafts.activeSeq } : {}),
    reportReady: Boolean(run.reportHtml),
    reportId: run.reportId,
    reportHtml: run.reportHtml,
    auditTelemetry: buildAuditTelemetry({
      originId: run.originId,
      uploadMode,
      uploadStatus: run.uploadStatus,
      completedStepCount: steps.length,
      totalSamplePoints: steps.reduce((sum, step) => sum + step.samples.length, 0),
      ledgerValue: run.aiLedger,
    }),
    stepDrafts: drafts.bySeq,
    ...(typeof drafts.courseState?.reportClientRef === 'string' ? { reportClientRef: drafts.courseState.reportClientRef } : {}),
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
  | {
      connected: true;
      resumed: boolean;
      session: VesselSessionView;
      grantToSet: IlabGrantPayload | null;
      user: IlabAuthUserSummary | null;
    };

export async function openVesselSession(input: {
  ticket?: string;
  grant?: IlabGrantPayload | null;
  experimentKey: string;
  forceNew?: boolean;
  experimentVersion?: string;
  platformUser?: { id: string; name?: string | null } | null;
}): Promise<OpenVesselSessionResult> {
  const experiment = findVesselExperiment(input.experimentKey);
  if (!experiment) throw new IlabServiceError('实验不存在。', 404);
  if (input.experimentVersion && !['legacy-v1', VESSEL_COURSE_VERSION].includes(input.experimentVersion)) {
    throw new IlabServiceError('实验课程版本不存在。', 400);
  }
  const actor = await resolveUnifiedSessionActor({
    ticket: input.ticket,
    grant: input.grant,
    platformUser: input.platformUser,
  });
  if (!actor) {
    return { connected: false };
  }

  const { run, resumed } = await openIlabRun({
    actor,
    vesselId: experiment.vesselId,
    originPrefix: experiment.originPrefix,
    experimentVersion: input.experimentVersion ?? 'legacy-v1',
    forceNew: input.forceNew,
  });
  return {
    connected: true,
    resumed,
    session: viewOf(experiment, run),
    grantToSet: actor.grantToSet,
    user: actor.user,
  };
}

export async function readVesselSession(
  originId: string,
  actor?: { userId?: string | null; grant?: IlabGrantPayload | null },
): Promise<VesselSessionView> {
  const { experiment, run } = await findRun(originId);
  if (actor) {
    await assertIlabRunAccess(run, actor);
  }
  const view = viewOf(experiment, run);
  if (run.experimentVersion === VESSEL_COURSE_VERSION && run.userId) {
    const drafts = parseStepDrafts(run.stepDrafts);
    const clientRef = drafts.courseState?.reportClientRef;
    const report = run.reportId || typeof clientRef === 'string'
      ? await prisma.virtualSimulationReport.findFirst({
        where: {userId: run.userId, experimentKey: experiment.route.split('/').at(-1),
          experimentVersion: VESSEL_COURSE_VERSION,
          ...(run.reportId ? {id: run.reportId} : {clientRef: String(clientRef)})},
        select: {id: true, clientRef: true, experimentKey: true},
      }) : null;
    const [recordedRuns, attempts] = report ? await Promise.all([
      prisma.simulationRun.findMany({where: {ownerUserId: run.userId, sourceDomain: 'ilab-course',
        summary: {path: ['reportId'], equals: report.id}}, select: {summary: true}}),
      prisma.stepSubmissionAttempt.findMany({where: {userId: run.userId,
        experimentKey: `${report.experimentKey}:${report.clientRef}`,
        status: {notIn: ['invalid_run', 'model_mismatch']}}, select: {stepKey: true}, distinct: ['stepKey']}),
    ]) : [[], []];
    const totals = recordedRuns.reduce((sum, record) => {
      const summary = record.summary as {controlCount: number; chunkCount: number};
      return {points: sum.points + summary.controlCount, chunks: sum.chunks + summary.chunkCount};
    }, {points: 0, chunks: 0});
    view.auditTelemetry = {
      ...view.auditTelemetry,
      completedStepCount: attempts.length,
      totalSamplePoints: totals.points,
      persistedChunkCount: totals.chunks,
      controlSampleCadenceS: .05,
    };
  }
  return view;
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
    const nextDrafts = mergeStepDrafts(run.stepDrafts, {
      removeSeq: input.seq,
      activeSeq: currentSeq(experiment, nextSteps),
    });
    const ledger = recognition?.ok ? recordAiCall(readLedger(run.aiLedger), recognition.call) : readLedger(run.aiLedger);
    return tx.ilabExperimentRun.update({
      where: { originId },
      data: {
        steps: nextSteps as unknown as Prisma.InputJsonValue,
        stepDrafts: nextDrafts as unknown as Prisma.InputJsonValue,
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
  reportSaved: boolean;
  reportId: string | null;
  retryableUpload: boolean;
}> {
  const { experiment, run } = await findRun(originId);
  const uploadMode = resolveIlabUploadMode(run);
  if (
    run.status === 1
    && run.reportHtml
    && (run.uploadStatus === 'uploaded' || run.uploadStatus === 'local-only' || run.uploadStatus === 'skipped')
  ) {
    return {
      session: viewOf(experiment, run),
      upload: null,
      remote: {
        message: run.uploadStatus === 'local-only' ? '实验报告已保存到本平台账号。' : '实验成绩和报告已经回传。',
      },
      refreshedGrant: null,
      reportSaved: Boolean(run.reportId),
      reportId: run.reportId,
      retryableUpload: false,
    };
  }
  const steps = readSteps(run.steps);
  const done = new Set(steps.map((step) => step.seq));
  for (const step of experiment.steps) {
    if (!done.has(step.seq)) throw new IlabServiceError('请先完成全部实验步骤。', 422);
  }
  const maxPointsTotal = vesselMaxPoints(experiment.steps);
  const earnedTotal = steps.reduce((sum, item) => sum + item.earnedPoints, 0);
  const reportHtml = buildVesselReportHtml(experiment, {
    displayName: run.displayName,
    steps,
  });
  const stepScores = steps.map((item) => ({
    seq: item.seq,
    title: item.title,
    earnedPoints: item.earnedPoints,
    maxPoints: item.maxPoints,
    evaluation: item.evaluation,
    remarks: item.remarks,
  }));

  const { reportId } = await syncPlatformReportForIlabRun({
    runId: run.id,
    userId: run.userId,
    experimentKey: experiment.key,
    experimentVersion: 'legacy-v1',
    title: experiment.title,
    score: earnedTotal,
    maxScore: maxPointsTotal,
    reportHtml,
    stepScores,
  });

  if (uploadMode === 'local-only') {
    const endTimeMs = Date.now();
    const timeUsedSeconds = Math.max(1, Math.floor((endTimeMs - Number(run.startTimeMs)) / 1000));
    const saved = await prisma.ilabExperimentRun.update({
      where: { originId },
      data: {
        status: 1,
        score: Math.round((earnedTotal / maxPointsTotal) * 100),
        endTimeMs: BigInt(endTimeMs),
        timeUsedSeconds,
        reportHtml,
        uploadStatus: 'local-only',
        ...(reportId ? { reportId } : {}),
      },
    });
    return {
      session: viewOf(experiment, saved),
      upload: null,
      remote: { message: reportId ? '实验报告已保存到本平台账号。' : '报告已在本机生成。' },
      refreshedGrant: null,
      reportSaved: Boolean(reportId),
      reportId,
      retryableUpload: false,
    };
  }

  const bypass = uploadMode === 'dev-bypass';
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
    pointTotal: maxPointsTotal,
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
        ...(reportId ? { reportId } : {}),
      },
    });
    return {
      session: viewOf(experiment, saved),
      upload,
      remote: { message: reportId ? '本地演示没有回传实验空间。报告已保存到账号。' : '本地演示没有回传实验空间。报告已生成。' },
      refreshedGrant: null,
      reportSaved: Boolean(reportId),
      reportId,
      retryableUpload: false,
    };
  }

  const uploadOutcome = await safeUploadWithAutoRefresh<RunRecord>({
    run: reportId ? { ...run, reportId } : run,
    config,
    upload,
    reportFilename: `${experiment.key}-report.html`,
    reportTitle: `${experiment.title}实验报告`,
    reportHtml,
  });

  if (!uploadOutcome.ok) {
    return {
      session: viewOf(experiment, { ...uploadOutcome.saved, reportId: uploadOutcome.saved.reportId ?? reportId }),
      upload,
      remote: {
        message: `实验记录与报告已保存到本平台，但实验空间回传暂未成功（${uploadOutcome.errorMessage}），请点击“重新回传实验空间”重试。`,
      },
      refreshedGrant: null,
      reportSaved: Boolean(reportId),
      reportId,
      retryableUpload: true,
    };
  }

  return {
    session: viewOf(experiment, { ...uploadOutcome.saved, reportId: uploadOutcome.saved.reportId ?? reportId }),
    upload,
    remote: { message: reportId ? '成绩和实验报告已回传，并已同步保存到本平台账号。' : '成绩和实验报告已回传。' },
    refreshedGrant: uploadOutcome.refreshedGrant,
    reportSaved: Boolean(reportId),
    reportId,
    retryableUpload: false,
  };
}
