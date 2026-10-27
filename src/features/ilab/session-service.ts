import { randomBytes } from 'node:crypto';

import type { IlabExperimentRun, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { emptyAiLedger, isAiUsageLedger, recordAiCall, type AiUsageLedger } from './ai-data';
import { ilabAiScenario, reviewIlabStep } from './ai-review';
import { recognizeSketch, type SketchRecognition } from './sketch-recognition';
import { exchangeIlabTicket, uploadIlabReport, uploadIlabScore } from './ilab-client';
import { buildIlabUploadBody, experimentScore, type IlabUploadBody, type StoredIlabStep } from './payload';
import { buildIlabReportHtml } from './report';
import { ilabExpectTime, scoreIlabStep } from './scoring';
import { ILAB_EXPERIMENT_TITLE, ILAB_STEP_BY_SEQ } from './steps';
import { ILAB_VESSELS, isIlabVesselId, type IlabVesselId } from './vessels';

export class IlabServiceError extends Error {
  constructor(message: string, readonly status: number, readonly retryReport = false) {
    super(message);
    this.name = 'IlabServiceError';
  }
}

export function toIlabHttpError(error: unknown): { status: number; message: string; retryReport: boolean } {
  if (error instanceof IlabServiceError) {
    return { status: error.status, message: error.message, retryReport: error.retryReport };
  }
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (code === 'P2021' || code === 'P2022') {
    return { status: 503, message: '实验记录表尚未迁移，暂时不能开始实验。', retryReport: false };
  }
  return { status: 500, message: '实验服务暂时不可用。', retryReport: false };
}

export function assertIlabRunOpen(run: { status: number; uploadStatus: string }): void {
  if (run.uploadStatus === 'score-uploaded') {
    throw new IlabServiceError('实验成绩已回传，请重试实验报告。', 409, true);
  }
  if (run.status === 1) {
    throw new IlabServiceError('实验已完成，不能再修改步骤。', 409);
  }
}

export async function withIlabRunLock<T>(
  originId: string,
  action: (run: IlabExperimentRun, tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "IlabExperimentRun" WHERE "originId" = ${originId} FOR UPDATE
    `;
    if (locked.length === 0) throw new IlabServiceError('实验记录不存在。', 404);
    const run = await tx.ilabExperimentRun.findUnique({ where: { originId } });
    if (!run) throw new IlabServiceError('实验记录不存在。', 404);
    return action(run, tx);
  });
}

export interface IlabSessionView {
  originId: string;
  displayName: string;
  username: string;
  status: number;
  score: number;
  vesselId: string;
  uploadStatus: string;
  steps: Array<Pick<StoredIlabStep, 'seq' | 'title' | 'earnedPoints' | 'maxPoints' | 'evaluation' | 'remarks' | 'repeatCount'>>;
  reportReady: boolean;
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
  uploadResult: Prisma.JsonValue | null;
  attachmentResult: Prisma.JsonValue | null;
}

function readSteps(value: Prisma.JsonValue): StoredIlabStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as unknown as StoredIlabStep;
    if (typeof record.seq !== 'number') return [];
    return [record];
  });
}

function readLedger(value: Prisma.JsonValue): AiUsageLedger {
  return isAiUsageLedger(value) ? value : emptyAiLedger();
}

function viewOf(run: RunRecord): IlabSessionView {
  return {
    originId: run.originId,
    displayName: run.displayName,
    username: run.ilabUsername,
    status: run.status,
    score: run.score,
    vesselId: run.vesselId,
    uploadStatus: run.uploadStatus,
    steps: readSteps(run.steps).map((step) => ({
      seq: step.seq,
      title: step.title,
      earnedPoints: step.earnedPoints,
      maxPoints: step.maxPoints,
      evaluation: step.evaluation,
      remarks: step.remarks,
      repeatCount: step.repeatCount,
    })),
    reportReady: Boolean(run.reportHtml),
  };
}

function ilabConfig() {
  return {
    appId: process.env.ILAB_APP_ID?.trim() || '',
    secret: process.env.ILAB_SECRET?.trim() || '',
    baseUrl: process.env.ILAB_BASE_URL?.trim() || 'https://www.ilab-x.com',
    devBypass: process.env.ILAB_DEV_BYPASS === '1',
  };
}

function stepWindow(startedAtMs: number, now: number): { startTime: number; endTime: number; timeUsed: number } {
  const requested = Number.isFinite(startedAtMs) ? Math.floor(startedAtMs) : now - 1000;
  const startTime = Math.min(requested, now - 1000);
  const timeUsed = Math.max(1, Math.round((now - startTime) / 1000));
  return { startTime, endTime: startTime + timeUsed * 1000, timeUsed };
}

async function findRun(originId: string): Promise<RunRecord> {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(originId)) {
    throw new IlabServiceError('实验记录编号无效。', 400);
  }
  const run = await prisma.ilabExperimentRun.findUnique({ where: { originId } });
  if (!run) throw new IlabServiceError('实验记录不存在。', 404);
  return run;
}

export async function openIlabSession(ticket: string): Promise<IlabSessionView> {
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
  const originId = `dsc_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
  const run = await prisma.ilabExperimentRun.create({
    data: {
      originId,
      appId: token.bypass ? 'dev' : config.appId,
      ilabUsername: token.username,
      displayName: token.displayName,
      accessToken: token.accessToken,
      tokenExpiresAt: token.expiresAtMs ? new Date(token.expiresAtMs) : null,
      startTimeMs: BigInt(Date.now()),
      steps: [],
      aiLedger: emptyAiLedger() as unknown as Prisma.InputJsonValue,
    },
  });
  return viewOf(run);
}

export async function readIlabSession(originId: string): Promise<IlabSessionView> {
  return viewOf(await findRun(originId));
}

export async function readIlabReport(originId: string): Promise<string> {
  const run = await findRun(originId);
  if (!run.reportHtml) throw new IlabServiceError('实验报告尚未生成。', 404);
  return run.reportHtml;
}

export async function submitIlabStep(originId: string, input: {
  seq: number;
  payload: Record<string, unknown>;
  startedAtMs: number;
}): Promise<IlabSessionView> {
  const definition = ILAB_STEP_BY_SEQ.get(input.seq);
  if (!definition) throw new IlabServiceError('实验步骤不存在。', 400);
  const payload = { ...input.payload };
  const sketchImage = typeof payload.sketchImage === 'string' ? payload.sketchImage : '';
  delete payload.sketchImage;
  let vision: Extract<SketchRecognition, { ok: true }> | null = null;
  if (input.seq === 10 || input.seq === 11) {
    const recognized = await recognizeSketch({ image: sketchImage });
    if (!recognized.ok) throw new IlabServiceError(recognized.message, 422);
    const expected = input.seq === 10 ? 'nyquist' : 'bode';
    if (recognized.verdict.blank || recognized.verdict.plotKind === 'other') {
      throw new IlabServiceError('画布是空的或看不出是哪一种图，请按本步要求重画。', 422);
    }
    if (recognized.verdict.plotKind !== expected) {
      throw new IlabServiceError(input.seq === 10 ? '这张图不像奈奎斯特图，请重画。' : '这张图不像伯德图，请重画。', 422);
    }
    vision = recognized;
  }
  const preview = await findRun(originId);
  const vesselId = isIlabVesselId(preview.vesselId) ? preview.vesselId : null;
  const scored = scoreIlabStep(input.seq === 1 ? null : vesselId, input.seq, payload);
  if (!scored.ok) throw new IlabServiceError(scored.message, 422);
  const review = vision || !ilabAiScenario(input.seq)
    ? null
    : await reviewIlabStep({
      ledger: emptyAiLedger(),
      seq: input.seq,
      summary: `${definition.title}：${JSON.stringify(payload).slice(0, 800)}`,
    });
  const window = stepWindow(input.startedAtMs, Date.now());
  const saved = await withIlabRunLock(originId, async (run, tx) => {
    assertIlabRunOpen(run);
    const steps = readSteps(run.steps);
    const previous = steps.find((step) => step.seq === input.seq);
    const freshLedger = readLedger(run.aiLedger);
    const ledger = vision
      ? recordAiCall(freshLedger, vision.call)
      : review?.call
        ? recordAiCall(freshLedger, review.call)
        : freshLedger;
    const remarks = vision
      ? `${scored.score.remarks} 手绘评价：${vision.verdict.evaluation || '图种与本步要求一致。'}`
      : review
        ? `${scored.score.remarks} 模型建议：${review.note}`
        : ilabAiScenario(input.seq)
          ? `${scored.score.remarks} 模型服务未配置或调用失败，本次没有计入 ai_data。`
          : scored.score.remarks;
    const stored: StoredIlabStep = {
      ...scored.score,
      remarks,
      startTime: window.startTime,
      endTime: window.endTime,
      timeUsed: window.timeUsed,
      expectTime: ilabExpectTime(input.seq),
      repeatCount: (previous?.repeatCount ?? 0) + 1,
    };
    const nextSteps = [...steps.filter((step) => step.seq !== input.seq), stored];
    const nextVessel: IlabVesselId | '' = input.seq === 1 && isIlabVesselId(String(input.payload.vesselId))
      ? input.payload.vesselId as IlabVesselId
      : isIlabVesselId(run.vesselId) ? run.vesselId : '';
    return tx.ilabExperimentRun.update({
      where: { originId },
      data: {
        steps: nextSteps as unknown as Prisma.InputJsonValue,
        aiLedger: ledger as unknown as Prisma.InputJsonValue,
        vesselId: nextVessel,
        score: experimentScore(nextSteps),
      },
    });
  });
  return viewOf(saved);
}

function clipSupplement(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
}

export async function completeIlabSession(originId: string, reflection: string, supplements?: {
  pretestNote?: string;
  paperNote?: string;
}): Promise<{
  session: IlabSessionView;
  upload: IlabUploadBody | null;
  remote: { scoreCode: number | null; reportCode: number | null; message: string };
}> {
  const run = await findRun(originId);
  const config = ilabConfig();
  const steps = readSteps(run.steps);
  const ledger = readLedger(run.aiLedger);
  const vesselName = isIlabVesselId(run.vesselId) ? ILAB_VESSELS[run.vesselId].name : '';
  const bypass = run.accessToken === 'dev-bypass-token';

  if (run.status === 1 && run.reportHtml && run.uploadStatus === 'uploaded') {
    return { session: viewOf(run), upload: null, remote: { scoreCode: 0, reportCode: 0, message: '实验成绩和报告已经回传。' } };
  }

  const completedSeqs = new Set(steps.map((step) => step.seq));
  if (Array.from({ length: 24 }, (_, index) => index + 1).some((seq) => !completedSeqs.has(seq))) {
    throw new IlabServiceError('请先完成全部 24 个实验步骤。', 422);
  }

  const reportHtml = run.reportHtml ?? buildIlabReportHtml({
    displayName: run.displayName,
    vesselName,
    steps,
    ledger,
    reflection,
    pretestNote: clipSupplement(supplements?.pretestNote),
    paperNote: clipSupplement(supplements?.paperNote),
  });
  const upload = buildIlabUploadBody({
    username: run.ilabUsername,
    appId: bypass ? 'dev' : run.appId,
    originId: run.originId,
    childProjectTitle: vesselName || ILAB_EXPERIMENT_TITLE,
    status: 1,
    steps,
    ledger,
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
    return { session: viewOf(saved), upload, remote: { scoreCode: null, reportCode: null, message: '本地演示没有回传实验空间。' } };
  }

  let scoreCode = run.uploadStatus === 'score-uploaded' || run.uploadStatus === 'uploaded' ? 0 : null;
  if (scoreCode !== 0) {
    const scoreResult = await uploadIlabScore({
      baseUrl: config.baseUrl,
      accessToken: run.accessToken,
      payload: upload,
    });
    scoreCode = scoreResult.code;
    if (scoreResult.code !== 0) {
      await prisma.ilabExperimentRun.update({
        where: { originId },
        data: {
          reportHtml,
          uploadStatus: 'failed',
          uploadResult: scoreResult.body as Prisma.InputJsonValue,
        },
      });
      throw new IlabServiceError(scoreResult.message || `成绩回传失败（code ${scoreResult.code}）。`, 502);
    }
    await prisma.ilabExperimentRun.update({
      where: { originId },
      data: { reportHtml, uploadStatus: 'score-uploaded', uploadResult: { code: scoreCode } },
    });
  }

  const reportResult = await uploadIlabReport({
    baseUrl: config.baseUrl,
    accessToken: run.accessToken,
    appId: run.appId,
    originId: run.originId,
    filename: 'experiment-report.html',
    title: `${ILAB_EXPERIMENT_TITLE}实验报告`,
    html: reportHtml,
  });
  if (reportResult.code !== 0) {
    await prisma.ilabExperimentRun.update({
      where: { originId },
      data: {
        score: upload.score,
        endTimeMs: BigInt(upload.endTime),
        timeUsedSeconds: upload.timeUsed,
        reportHtml,
        uploadStatus: 'score-uploaded',
        uploadResult: { code: scoreCode },
        attachmentResult: reportResult.body as Prisma.InputJsonValue,
      },
    });
    throw new IlabServiceError(reportResult.message || `实验报告回传失败（code ${reportResult.code}）。成绩已回传，可再次提交以重试报告。`, 502);
  }
  const saved = await prisma.ilabExperimentRun.update({
    where: { originId },
    data: {
      status: 1,
      score: upload.score,
      endTimeMs: BigInt(upload.endTime),
      timeUsedSeconds: upload.timeUsed,
      reportHtml,
      uploadStatus: 'uploaded',
      uploadResult: { code: scoreCode },
      attachmentResult: reportResult.body as Prisma.InputJsonValue,
    },
  });
  return { session: viewOf(saved), upload, remote: { scoreCode, reportCode: reportResult.code, message: '成绩和实验报告已回传。' } };
}
