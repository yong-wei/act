import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { STEP_SCORE_DISTRIBUTION } from '@/resources/simulations/contracts/experiment-step';
import { findVesselCourse, type VesselCourseKey } from '@/resources/simulations/experiments/course-catalog';
import { DESTROYER_COURSE_STEPS } from '@/resources/simulations/experiments/destroyer-course';
import { findVesselExperiment } from '@/resources/simulations/simulations/vessel-experiments';

import { emptyAiLedger, isAiUsageLedger } from '../ai-data';
import { vesselExperimentKey } from '../course-artifact-service';
import { summarizeVesselReview, type VesselStepReview } from '../course-report-review-contract';
import type { IlabGrantPayload } from '../grant-cookie';
import { ILAB_PROJECT_TITLE, buildIlabUploadBody, type StoredIlabStep } from '../payload';
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

function parseStepSeq(stepKey: string): number | null {
  const match = /-step-(\d+)$/.exec(stepKey);
  if (!match) return null;
  const seq = Number(match[1]);
  return Number.isInteger(seq) && seq >= 1 && seq <= 20 ? seq : null;
}

function stepMetaForCourse(courseKey: VesselCourseKey, seq: number): {
  title: string;
  expectTime: number;
  scoringModel: string;
} {
  if (courseKey === 'destroyer') {
    const step = DESTROYER_COURSE_STEPS[seq - 1];
    return {
      title: step?.title ?? `第 ${seq} 步`,
      expectTime: step?.runDurationS ?? 300,
      scoringModel: step?.rubric.kind === 'design' ? '预测与模型辨识+设计性能控制+证据推理' : '预测+仿真采样+因果解释',
    };
  }
  const vesselId = VESSEL_ID_BY_COURSE_KEY[courseKey];
  const experiment = findVesselExperiment(vesselId);
  const step = experiment?.steps[seq - 1];
  return {
    title: findVesselCourse(courseKey)?.steps[seq - 1]?.title ?? step?.title ?? `第 ${seq} 步`,
    expectTime: step?.expectTime ?? 300,
    scoringModel: '预测+仿真采样+因果解释',
  };
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
  let cursorMs = runStartMs;
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

    const startTime = cursorMs;
    const timeUsed = Math.max(
      1,
      Math.min(1800, seqAttempts.length > 0 ? Math.max(1, Math.round((seqAttempts.at(-1)!.updatedAt.getTime() - startTime) / 1000)) || 5 : 1),
    );
    const endTime = startTime + timeUsed * 1000;
    cursorMs = endTime + 1000;

    storedSteps.push({
      seq,
      title: meta.title,
      startTime,
      endTime,
      timeUsed,
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
    title: ILAB_PROJECT_TITLE,
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
