import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { STEP_SCORE_DISTRIBUTION, type ExperimentStep } from '@/resources/simulations/contracts/experiment-step';
import { CONTAINER_COURSE_STEPS } from '@/resources/simulations/experiments/container-course';
import { findVesselCourse, type VesselCourseKey } from '@/resources/simulations/experiments/course-catalog';
import { CRUISE_COURSE_STEPS } from '@/resources/simulations/experiments/cruise-course';
import { DESTROYER_COURSE_STEPS } from '@/resources/simulations/experiments/destroyer-course';
import { DREDGER_COURSE_STEPS } from '@/resources/simulations/experiments/dredger-course';
import { DRILLING_COURSE_STEPS } from '@/resources/simulations/experiments/drilling-course';
import { ICEBREAKER_COURSE_STEPS } from '@/resources/simulations/experiments/icebreaker-course';
import { LNG_COURSE_STEPS } from '@/resources/simulations/experiments/lng-course';

import { emptyAiLedger, isAiUsageLedger } from '../ai-data';
import { vesselExperimentKey } from '../course-artifact-service';
import { summarizeVesselReview, type VesselStepReview } from '../course-report-review-contract';
import type { IlabGrantPayload } from '../grant-cookie';
import {
  ILAB_VESSEL_SHORT_LABEL,
  buildIlabUploadBody,
  formatIlabProjectTitle,
  formatIlabStepTitle,
  type StoredIlabStep,
} from '../payload';
import { IlabServiceError } from '../run-lock';
import { ilabConfig, safeUploadWithAutoRefresh } from '../session-shared';
import { parseStepDrafts, resolveIlabUploadMode } from './ilab-session-lifecycle';

const VESSEL_ID_BY_COURSE_KEY: Record<VesselCourseKey, string> = {
  destroyer: 'destroyer-055',
  lng: 'fleet-lng-changheng',
  container: 'fleet-container-msc',
  cruise: 'fleet-cruise-adora',
  drilling: 'fleet-drill-hysy981',
  icebreaker: 'fleet-icebreaker-xuelong',
  dredger: 'fleet-dredger-tianjing',
};

const COURSE_STEPS_BY_KEY: Record<VesselCourseKey, readonly ExperimentStep[]> = {
  destroyer: DESTROYER_COURSE_STEPS,
  lng: LNG_COURSE_STEPS,
  container: CONTAINER_COURSE_STEPS,
  cruise: CRUISE_COURSE_STEPS,
  drilling: DRILLING_COURSE_STEPS,
  icebreaker: ICEBREAKER_COURSE_STEPS,
  dredger: DREDGER_COURSE_STEPS,
};

function parseStepSeq(stepKey: string): number | null {
  const match = /-step-(\d+)$/.exec(stepKey);
  if (!match) return null;
  const seq = Number(match[1]);
  return Number.isInteger(seq) && seq >= 1 && seq <= 20 ? seq : null;
}

export function stepMetaForCourse(courseKey: VesselCourseKey, seq: number): {
  title: string;
  expectTime: number;
  scoringModel: string;
} {
  const step = COURSE_STEPS_BY_KEY[courseKey]?.[seq - 1];
  const rawTitle = findVesselCourse(courseKey)?.steps[seq - 1]?.title ?? step?.title ?? `第 ${seq} 步`;
  const title = formatIlabStepTitle(ILAB_VESSEL_SHORT_LABEL[courseKey], rawTitle);
  const runDuration = step?.runDurationS;
  const expectTime = typeof runDuration === 'number' && Number.isFinite(runDuration) && runDuration > 0
    ? Math.max(60, Math.round(runDuration))
    : seq === 20
      ? 300
      : 180;
  const isDesignOrAnalysis = step?.rubric.kind === 'design' || step?.stepKind === 'analysis' || seq === 20;
  const scoringModel = isDesignOrAnalysis
    ? '预测与模型辨识+设计性能控制+证据推理'
    : '预测+仿真采样+因果解释';
  return {
    title,
    expectTime,
    scoringModel,
  };
}

export interface StepAttemptTimestamp {
  createdAt: Date;
  updatedAt: Date;
}

export interface ComputedStepWindow {
  startTime: number;
  endTime: number;
  timeUsed: number;
}

/**
 * 根据实验启动时间与各步骤不可变创建时间 `createdAt` 计算不重叠、无挤压且绝不超出当前时刻的起止时间窗口。
 * 忽略会被教师复核 `@updatedAt` 覆盖的 `updatedAt`，若中间存在超过 1800 秒的长时间停顿则把空闲停顿留在两步之间，
 * 并在所有情况下将每步结束时间严格钳制在 `nowMs - 2000` 以内。
 */
export function buildCourseStepWindows(input: {
  runStartMs: number;
  attemptsBySeq: ReadonlyMap<number, readonly StepAttemptTimestamp[]>;
  nowMs?: number;
}): ComputedStepWindow[] {
  const ceilingMs = Math.floor((input.nowMs ?? Date.now()) - 2000);
  const effectiveStartMs = Math.min(Math.floor(input.runStartMs), ceilingMs - 20 * 2000);
  let maxAttemptMs = effectiveStartMs + 20 * 2000;
  for (const list of input.attemptsBySeq.values()) {
    for (const item of list) {
      const ms = Math.floor(item.createdAt.getTime());
      if (ms > maxAttemptMs) maxAttemptMs = ms;
    }
  }
  const effectiveEndMs = Math.min(ceilingMs, maxAttemptMs);

  let cursorMs = effectiveStartMs;
  let prevActualEndMs = effectiveStartMs;
  const windows: ComputedStepWindow[] = [];

  for (let seq = 1; seq <= 20; seq += 1) {
    const remainingSteps = 20 - seq;
    const maxAllowedEndMs = effectiveEndMs - remainingSteps * 2000;
    const maxDurationHere = Math.max(1, Math.min(1800, Math.floor((maxAllowedEndMs - cursorMs) / 1000)));
    const seqAttempts = input.attemptsBySeq.get(seq) ?? [];
    if (seqAttempts.length > 0) {
      const sortedCreatedMs = seqAttempts.map((item) => Math.floor(item.createdAt.getTime())).sort((a, b) => a - b);
      const firstCreatedMs = sortedCreatedMs[0]!;
      const lastCreatedMs = sortedCreatedMs[sortedCreatedMs.length - 1]!;
      const clampedEndMs = Math.max(cursorMs + 1000, Math.min(maxAllowedEndMs, lastCreatedMs));
      const baselineStartMs = Math.max(cursorMs, prevActualEndMs);
      let rawSeconds = Math.round((clampedEndMs - baselineStartMs) / 1000);
      if (rawSeconds <= 0) {
        rawSeconds = Math.round((lastCreatedMs - firstCreatedMs) / 1000);
      }
      const timeUsed = Math.max(1, Math.min(maxDurationHere, rawSeconds > 0 ? rawSeconds : 5));
      const anchoredStartMs = clampedEndMs - timeUsed * 1000;
      const startTime = anchoredStartMs >= cursorMs ? anchoredStartMs : cursorMs;
      const endTime = startTime + timeUsed * 1000;
      prevActualEndMs = Math.max(prevActualEndMs, clampedEndMs);
      cursorMs = endTime + 1000;
      windows.push({ startTime, endTime, timeUsed });
    } else {
      const startTime = cursorMs;
      const timeUsed = 1;
      const endTime = startTime + 1000;
      cursorMs = endTime + 1000;
      windows.push({ startTime, endTime, timeUsed });
    }
  }

  return windows;
}

function stepEvaluationLabel(status: string): string {
  if (status === 'submitted' || status === 'scored') return '已完成并提交本步实验证据与推理';
  if (status === 'below_target') return '已提交，部分指标尚待进一步优化';
  if (status === 'model_mismatch') return '已提交，模型与实际运行条件存在偏差';
  if (status === 'invalid_run') return '已提交，需补充有效数值运行采样';
  return '暂未提交本步有效记录';
}

export interface CourseIlabUploadOutcome {
  uploaded: boolean;
  retryableUpload: boolean;
  uploadMode: 'local-only' | 'dev-bypass' | 'ilab-remote';
  originId: string | null;
  message: string;
  refreshedGrant: IlabGrantPayload | null;
}

/**
 * 将新版 course-v1 课程报告及其 20 步提交尝试、真实 AiLedger 账本与 HTML 报告
 * 同步关联到 IlabExperimentRun 并按需回传实验空间；回传失败时保留全部本平台数据以支持重试。
 */
export async function uploadCourseReportToIlab(input: {
  reportId: string;
  actorUserId: string;
  originId?: string | null;
  grant?: IlabGrantPayload | null;
  allowTeacherFinalize?: boolean;
}): Promise<CourseIlabUploadOutcome> {
  const report = await prisma.virtualSimulationReport.findUnique({
    where: { id: input.reportId },
  });
  if (!report) {
    throw new IlabServiceError('实验报告不存在。', 404);
  }
  if (!input.allowTeacherFinalize && report.userId !== input.actorUserId) {
    throw new IlabServiceError('无权上传该实验报告。', 403);
  }
  if (!report.reportHtml.trim()) {
    throw new IlabServiceError('请先保存或提交实验报告后再同步到实验空间。', 400);
  }

  const course = findVesselCourse(report.experimentKey);
  const courseKey: VesselCourseKey = course?.key ?? 'destroyer';
  const vesselId = VESSEL_ID_BY_COURSE_KEY[courseKey];
  const courseTitle = course?.title || report.title;

  let run = input.originId
    ? await prisma.ilabExperimentRun.findUnique({ where: { originId: input.originId } })
    : null;

  if (run) {
    const ownedByReportUser = run.userId === report.userId;
    const ownedByGrant = Boolean(
      input.grant
      && run.appId === input.grant.appId
      && run.ilabUsername === input.grant.username,
    );
    const roundRef = parseStepDrafts(run.stepDrafts).courseState?.reportClientRef;
    if ((!ownedByReportUser && !ownedByGrant) || run.vesselId !== vesselId
      || (run.reportId && run.reportId !== report.id)
      || (typeof roundRef === 'string' && roundRef !== report.clientRef)
      || (report.experimentVersion && run.experimentVersion !== report.experimentVersion)) {
      run = null;
    }
  }

  if (!run) {
    run = await prisma.ilabExperimentRun.findFirst({
      where: {
        userId: report.userId,
        reportId: report.id,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  if (!run && report.clientRef) {
    run = await prisma.ilabExperimentRun.findFirst({
      where: {
        userId: report.userId,
        vesselId,
        reportId: null,
        stepDrafts: { path: ['courseState', 'reportClientRef'], equals: report.clientRef },
        ...(report.experimentVersion ? { experimentVersion: report.experimentVersion } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  if (!run && report.clientRef && input.grant && report.userId === input.actorUserId) {
    run = await prisma.ilabExperimentRun.findFirst({
      where: {
        appId: input.grant.appId,
        ilabUsername: input.grant.username,
        vesselId,
        reportId: null,
        stepDrafts: { path: ['courseState', 'reportClientRef'], equals: report.clientRef },
        ...(report.experimentVersion ? { experimentVersion: report.experimentVersion } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  if (!run) {
    return {
      uploaded: false,
      retryableUpload: false,
      uploadMode: 'local-only',
      originId: null,
      message: '实验结果与报告已按本平台规范保存。',
      refreshedGrant: null,
    };
  }

  if (run.reportId !== report.id || !run.userId) {
    run = await prisma.ilabExperimentRun.update({
      where: { id: run.id },
      data: {
        reportId: report.id,
        ...(run.userId ? {} : { userId: report.userId }),
      },
    });
  }

  const uploadMode = resolveIlabUploadMode(run);
  if (report.status !== 'finalized' || !report.finalizedAt) {
    return { uploaded: false, retryableUpload: false, uploadMode, originId: run.originId,
      message: '报告与实验证据已保存，等待教师确认最终成绩后回传实验空间。', refreshedGrant: null };
  }
  const rubricSteps = Array.isArray((report.rubric as { steps?: unknown } | null)?.steps)
    ? ((report.rubric as { steps: VesselStepReview[] }).steps)
    : [];
  const reviewSummary = summarizeVesselReview(rubricSteps);
  if (!reviewSummary.complete || reviewSummary.finalScore !== report.score) {
    throw new IlabServiceError('最终量规评分与报告成绩不一致，请核验教师复核记录。', 409);
  }
  if (uploadMode === 'local-only') {
    const nowMs = Date.now();
    await prisma.ilabExperimentRun.update({
      where: { id: run.id },
      data: {
        status: 1,
        score: report.score,
        endTimeMs: BigInt(nowMs),
        timeUsedSeconds: Math.max(1, Math.floor((nowMs - Number(run.startTimeMs)) / 1000)),
        reportHtml: report.reportHtml,
        uploadStatus: 'local-only',
        reportId: report.id,
      },
    });
    return {
      uploaded: false,
      retryableUpload: false,
      uploadMode: 'local-only',
      originId: run.originId,
      message: '实验结果与报告已按本平台规范保存。',
      refreshedGrant: null,
    };
  }

  if (run.uploadStatus === 'uploaded') {
    return {
      uploaded: true,
      retryableUpload: false,
      uploadMode,
      originId: run.originId,
      message: '成绩与实验报告已完成实验空间回传。',
      refreshedGrant: null,
    };
  }

  const attempts = report.clientRef
    ? await prisma.stepSubmissionAttempt.findMany({
        where: {
          userId: report.userId,
          experimentKey: vesselExperimentKey(report),
        },
        orderBy: [{ stepKey: 'asc' }, { attemptSeq: 'asc' }],
      })
    : [];

  const attemptsBySeq = new Map<number, typeof attempts>();
  for (const attempt of attempts) {
    const seq = parseStepSeq(attempt.stepKey);
    if (!seq) continue;
    const list = attemptsBySeq.get(seq) ?? [];
    list.push(attempt);
    attemptsBySeq.set(seq, list);
  }

  const reviewBySeq = new Map<number, VesselStepReview>(
    rubricSteps.map((step) => [step.stepSequence, step]),
  );

  const runStartMs = Number(run.startTimeMs);
  const stepWindows = buildCourseStepWindows({ runStartMs, attemptsBySeq });
  const storedSteps: StoredIlabStep[] = [];

  for (let seq = 1; seq <= 20; seq += 1) {
    const meta = stepMetaForCourse(courseKey, seq);
    const maxPoints = STEP_SCORE_DISTRIBUTION[seq - 1] ?? 5;
    const seqAttempts = attemptsBySeq.get(seq) ?? [];
    const selectedAttempt = seqAttempts.find((item) => item.selectedFinalAt !== null) ?? seqAttempts.at(-1) ?? null;
    const review = reviewBySeq.get(seq) ?? null;

    let earnedPoints = 0;
    if (review) {
      const sum = (review.prediction ?? 0) + (review.operation ?? 0) + (review.performance ?? 0) + (review.interpretation ?? 0);
      earnedPoints = Math.max(0, Math.min(maxPoints, sum));
    }

    const window = stepWindows[seq - 1]!;

    storedSteps.push({
      seq,
      title: meta.title,
      startTime: window.startTime,
      endTime: window.endTime,
      timeUsed: window.timeUsed,
      expectTime: meta.expectTime,
      earnedPoints,
      maxPoints,
      repeatCount: Math.max(1, seqAttempts.length),
      evaluation: review?.feedback?.trim() || (selectedAttempt ? stepEvaluationLabel(selectedAttempt.status) : '未产生有效提交'),
      scoringModel: meta.scoringModel,
      remarks: selectedAttempt?.explanation?.trim()
        || (selectedAttempt ? `共记录 ${seqAttempts.length} 次尝试` : '本步暂无提交记录'),
    });
  }

  const bypass = uploadMode === 'dev-bypass';
  const ledger = isAiUsageLedger(run.aiLedger) ? run.aiLedger : emptyAiLedger();
  const upload = buildIlabUploadBody({
    username: run.ilabUsername,
    appId: bypass ? 'dev' : run.appId,
    originId: run.originId,
    title: formatIlabProjectTitle(courseTitle),
    childProjectTitle: courseTitle,
    status: 1,
    steps: storedSteps,
    ledger,
    pointTotal: 100,
    runStartTimeMs: runStartMs,
  });

  if (bypass) {
    await prisma.ilabExperimentRun.update({
      where: { id: run.id },
      data: {
        status: 1,
        score: upload.score,
        endTimeMs: BigInt(upload.endTime),
        timeUsedSeconds: upload.timeUsed,
        reportHtml: report.reportHtml,
        uploadStatus: 'skipped',
        uploadResult: { skipped: true, reason: 'dev-bypass' } as Prisma.InputJsonValue,
        reportId: report.id,
      },
    });
    return {
      uploaded: false,
      retryableUpload: false,
      uploadMode: 'dev-bypass',
      originId: run.originId,
      message: '本地演示模式下已保存实验报告到账号，未触发外部实验空间回传。',
      refreshedGrant: null,
    };
  }

  const uploadOutcome = await safeUploadWithAutoRefresh<typeof run>({
    run,
    config: ilabConfig(),
    upload,
    reportFilename: `${courseKey}-course-report.html`,
    reportTitle: `${courseTitle}实验报告`,
    reportHtml: report.reportHtml,
  });

  if (!uploadOutcome.ok) {
    return {
      uploaded: false,
      retryableUpload: true,
      uploadMode: 'ilab-remote',
      originId: run.originId,
      message: `实验记录与报告已保存到本平台，但实验空间回传暂未成功（${uploadOutcome.errorMessage}），请点击“重新回传实验空间”重试。`,
      refreshedGrant: null,
    };
  }

  return {
    uploaded: true,
    retryableUpload: false,
    uploadMode: 'ilab-remote',
    originId: run.originId,
    message: '实验成绩、控灵 AI 账本与课程报告已同步回传至实验空间并保存本平台副本。',
    refreshedGrant: uploadOutcome.refreshedGrant,
  };
}
