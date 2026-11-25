import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';
import {
  assertDestroyerStepOrder,
  chooseBetterDestroyerAttempt,
  buildDestroyerReportHtml,
  DESTROYER_EXPERIMENT_KEY,
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
import {
  ILAB_VESSEL_SHORT_LABEL,
  buildIlabUploadBody,
  formatIlabProjectTitle,
  formatIlabStepTitle,
  type IlabUploadBody,
  type StoredIlabStep,
} from './payload';
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

export { toIlabHttpError };

export interface DestroyerSessionView {
  experimentVersion: string;
  userId: string | null;
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
  stepDrafts: Record<string, Record<string, string>>;
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
  id: string;
  userId: string | null;
  reportId: string | null;
  experimentVersion: string;
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
  stepDrafts: Prisma.JsonValue;
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
  const drafts = parseStepDrafts(run.stepDrafts);
  const uploadMode = resolveIlabUploadMode(run);
  return {
    experimentVersion: run.experimentVersion,
    userId: run.userId,
    originId: run.originId,
    displayName: run.displayName,
    status: run.status,
    score: run.score,
    uploadStatus: run.uploadStatus,
    uploadMode,
    retryableUpload: uploadMode === 'ilab-remote' && (run.uploadStatus === 'failed' || run.uploadStatus === 'score-uploaded'),
    currentSeq: currentSeq(steps),
    ...(drafts.activeSeq !== undefined ? { draftActiveSeq: drafts.activeSeq } : {}),
    reportReady: Boolean(run.reportHtml),
    reportId: run.reportId,
    reportHtml: run.reportHtml,
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
  | {
      connected: true;
      resumed: boolean;
      session: DestroyerSessionView;
      grantToSet: IlabGrantPayload | null;
      user: IlabAuthUserSummary | null;
    };

export async function openDestroyerSession(input: {
  ticket?: string;
  grant?: IlabGrantPayload | null;
  experimentVersion?: string;
  forceNew?: boolean;
  platformUser?: { id: string; name?: string | null } | null;
}): Promise<OpenDestroyerSessionResult> {
  const experimentVersion = input.experimentVersion ?? 'legacy-v1';
  if (experimentVersion !== 'legacy-v1' && experimentVersion !== VESSEL_COURSE_VERSION) {
    throw new IlabServiceError('实验步骤版本无效。', 400);
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
    vesselId: 'destroyer-055',
    originPrefix: 'dds_',
    experimentVersion,
    forceNew: input.forceNew,
  });
  return {
    connected: true,
    resumed,
    session: viewOf(run),
    grantToSet: actor.grantToSet,
    user: actor.user,
  };
}

export async function readDestroyerSession(
  originId: string,
  actor?: { userId?: string | null; grant?: IlabGrantPayload | null },
): Promise<DestroyerSessionView> {
  const run = await findRun(originId);
  if (actor) {
    await assertIlabRunAccess(run, actor);
  }
  return viewOf(run);
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
  if ((await findRun(originId)).experimentVersion !== 'legacy-v1') {
    throw new IlabServiceError('请通过本次实验的证据提交入口提交新版步骤。', 409);
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
    const nextDrafts = mergeStepDrafts(run.stepDrafts, {
      removeSeq: input.seq,
      activeSeq: currentSeq(nextSteps),
    });
    const ledger = recognition?.ok ? recordAiCall(readLedger(run.aiLedger), recognition.call) : readLedger(run.aiLedger);
    return tx.ilabExperimentRun.update({
      where: { originId },
      data: {
        steps: nextSteps as unknown as Prisma.InputJsonValue,
        stepDrafts: nextDrafts as unknown as Prisma.InputJsonValue,
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
  reportSaved: boolean;
  reportId: string | null;
  retryableUpload: boolean;
}> {
  const run = await findRun(originId);
  if (run.experimentVersion !== 'legacy-v1') {
    throw new IlabServiceError('新版实验需通过课程报告提交流程同步至实验空间。', 409);
  }
  const uploadMode = resolveIlabUploadMode(run);
  if (
    run.status === 1
    && run.reportHtml
    && (run.uploadStatus === 'uploaded' || run.uploadStatus === 'local-only' || run.uploadStatus === 'skipped')
  ) {
    return {
      session: viewOf(run),
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
  for (let seq = 1; seq <= DESTROYER_STEP_BY_SEQ.size; seq += 1) {
    if (!done.has(seq)) throw new IlabServiceError('请先完成全部实验步骤。', 422);
  }
  const ledger = readLedger(run.aiLedger);
  const earnedTotal = steps.reduce((sum, item) => sum + item.earnedPoints, 0);
  const reportHtml = buildDestroyerReportHtml({
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
    experimentKey: DESTROYER_EXPERIMENT_KEY,
    experimentVersion: 'legacy-v1',
    title: DESTROYER_EXPERIMENT_TITLE,
    score: earnedTotal,
    maxScore: DESTROYER_MAX_POINTS,
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
        score: Math.round((earnedTotal / DESTROYER_MAX_POINTS) * 100),
        endTimeMs: BigInt(endTimeMs),
        timeUsedSeconds,
        reportHtml,
        uploadStatus: 'local-only',
        ...(reportId ? { reportId } : {}),
      },
    });
    return {
      session: viewOf(saved),
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
  const shortLabel = ILAB_VESSEL_SHORT_LABEL.destroyer;
  const labeledSteps = steps.map((step) => ({
    ...step,
    title: formatIlabStepTitle(shortLabel, step.title),
  }));
  const upload = buildIlabUploadBody({
    username: run.ilabUsername,
    appId: bypass ? 'dev' : run.appId,
    originId: run.originId,
    title: formatIlabProjectTitle(DESTROYER_EXPERIMENT_TITLE),
    childProjectTitle: DESTROYER_EXPERIMENT_TITLE,
    status: 1,
    steps: labeledSteps,
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
        ...(reportId ? { reportId } : {}),
      },
    });
    return {
      session: viewOf(saved),
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
    reportFilename: 'destroyer-experiment-report.html',
    reportTitle: `${DESTROYER_EXPERIMENT_TITLE}实验报告`,
    reportHtml,
  });

  if (!uploadOutcome.ok) {
    return {
      session: viewOf({ ...uploadOutcome.saved, reportId: uploadOutcome.saved.reportId ?? reportId }),
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
    session: viewOf({ ...uploadOutcome.saved, reportId: uploadOutcome.saved.reportId ?? reportId }),
    upload,
    remote: { message: reportId ? '成绩和实验报告已回传，并已同步保存到本平台账号。' : '成绩和实验报告已回传。' },
    refreshedGrant: uploadOutcome.refreshedGrant,
    reportSaved: Boolean(reportId),
    reportId,
    retryableUpload: false,
  };
}
