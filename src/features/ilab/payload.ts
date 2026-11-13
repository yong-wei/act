import { assertAiDataKeys, buildAiData, type AiUsageLedger, type IlabAiData } from './ai-data';

/**
 * 上传包默认标题与总分：历史上来自旧 24 步综合课程定义，
 * 七船上传时通过入参覆盖标题与 pointTotal；保留原值以兼容既有记录。
 */
export const ILAB_PROJECT_TITLE = '面向深远海作业的船舶智能航行与动力定位控制虚拟仿真实验';
const ILAB_EXPERIMENT_TITLE = '船舶智能航行与动力定位控制';
const ILAB_MAX_POINTS = 106;

export interface StoredIlabStep {
  seq: number;
  title: string;
  startTime: number;
  endTime: number;
  timeUsed: number;
  expectTime: number;
  earnedPoints: number;
  maxPoints: number;
  repeatCount: number;
  evaluation: string;
  scoringModel: string;
  remarks: string;
}

export interface IlabUploadBody {
  username: string;
  title: string;
  childProjectTitle: string;
  status: 1 | 2;
  score: number;
  startTime: number;
  endTime: number;
  timeUsed: number;
  appid: string;
  originId: string;
  steps: Array<{
    seq: number;
    title: string;
    startTime: number;
    endTime: number;
    timeUsed: number;
    expectTime: number;
    maxScore: number;
    score: number;
    repeatCount: number;
    evaluation: string;
    scoringModel: string;
    remarks: string;
  }>;
  ai_data: IlabAiData;
}

export class IlabPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IlabPayloadError';
  }
}

function clip(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= max ? normalized : normalized.slice(0, max);
}

function percent(earned: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((earned / max) * 100)));
}

export function experimentScore(steps: StoredIlabStep[], pointTotal = ILAB_MAX_POINTS): number {
  const earned = steps.reduce((sum, step) => sum + step.earnedPoints, 0);
  return percent(earned, pointTotal);
}

export function buildIlabUploadBody(input: {
  username: string;
  appId: string;
  originId: string;
  childProjectTitle: string;
  status: 1 | 2;
  steps: StoredIlabStep[];
  ledger: AiUsageLedger;
  title?: string;
  pointTotal?: number;
  runStartTimeMs?: number;
}): IlabUploadBody {
  if (!/^[A-Za-z0-9_]+$/.test(input.originId)) {
    throw new IlabPayloadError('originId 只能包含字母、数字和下划线。');
  }
  if (!input.username.trim()) throw new IlabPayloadError('缺少实验空间用户名。');
  if (!input.appId.trim()) throw new IlabPayloadError('缺少实验空间 APPID。');
  const steps = [...input.steps].sort((left, right) => left.seq - right.seq);
  if (input.status === 1 && steps.length < 10) {
    throw new IlabPayloadError('已完成实验至少需要 10 个步骤。');
  }
  if (input.status === 1) {
    const seqs = steps.map((step) => step.seq);
    for (let index = 0; index < seqs.length; index += 1) {
      if (seqs[index] !== index + 1) throw new IlabPayloadError('已完成实验的步骤序号必须从 1 连续排列。');
    }
  }

  const uploadSteps = steps.map((step) => {
    if (!Number.isInteger(step.timeUsed) || step.timeUsed < 1) {
      throw new IlabPayloadError(`步骤 ${step.seq} 的用时必须是正整数秒。`);
    }
    if (step.endTime - step.startTime !== step.timeUsed * 1000) {
      throw new IlabPayloadError(`步骤 ${step.seq} 的结束时间减开始时间必须等于用时。`);
    }
    return {
      seq: step.seq,
      title: clip(step.title, 100),
      startTime: step.startTime,
      endTime: step.endTime,
      timeUsed: step.timeUsed,
      expectTime: step.expectTime,
      maxScore: 100,
      score: percent(step.earnedPoints, step.maxPoints),
      repeatCount: Math.max(1, step.repeatCount),
      evaluation: clip(step.evaluation, 200),
      scoringModel: clip(step.scoringModel, 200),
      remarks: clip(step.remarks, 200),
    };
  });

  let startTime: number;
  let endTime: number;
  let timeUsed: number;
  if (uploadSteps.length > 0) {
    const minStepStart = uploadSteps.reduce((min, step) => Math.min(min, step.startTime), uploadSteps[0].startTime);
    const maxStepEnd = uploadSteps.reduce((max, step) => Math.max(max, step.endTime), uploadSteps[0].endTime);
    const hasRunStart = typeof input.runStartTimeMs === 'number' && Number.isFinite(input.runStartTimeMs);
    const runStart = hasRunStart ? Math.floor(input.runStartTimeMs!) : minStepStart;
    const baseStart = Math.min(runStart, minStepStart);
    const rawSpanMs = Math.max(1000, maxStepEnd - baseStart);
    timeUsed = Math.max(1, Math.ceil(rawSpanMs / 1000));
    const anchoredStart = maxStepEnd - timeUsed * 1000;
    if (hasRunStart && anchoredStart < runStart) {
      startTime = runStart;
      endTime = startTime + timeUsed * 1000;
    } else {
      endTime = maxStepEnd;
      startTime = anchoredStart;
    }
  } else {
    startTime = typeof input.runStartTimeMs === 'number' && Number.isFinite(input.runStartTimeMs)
      ? Math.floor(input.runStartTimeMs)
      : Date.now() - 1000;
    timeUsed = 1;
    endTime = startTime + 1000;
  }

  for (const step of uploadSteps) {
    if (
      step.startTime < startTime
      || step.endTime > endTime
      || step.endTime - step.startTime !== step.timeUsed * 1000
      || step.timeUsed < 1
    ) {
      throw new IlabPayloadError(`步骤 ${step.seq} 的起止时间未落在实验总起止时间窗口内。`);
    }
  }

  const aiData = buildAiData(input.ledger);
  assertAiDataKeys(aiData);

  return {
    username: clip(input.username, 100),
    title: clip(input.title || ILAB_EXPERIMENT_TITLE, 100),
    childProjectTitle: clip(input.childProjectTitle || input.title || ILAB_EXPERIMENT_TITLE, 100),
    status: input.status,
    score: experimentScore(steps, input.pointTotal ?? ILAB_MAX_POINTS),
    startTime,
    endTime,
    timeUsed,
    appid: input.appId,
    originId: input.originId,
    steps: uploadSteps,
    ai_data: aiData,
  };
}
