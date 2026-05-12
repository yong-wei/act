import type { Prisma } from '@prisma/client';

import {
  buildUNIT44SubmissionTelemetry,
  type Unit44StepResponseLike,
} from './unit-4-4-submission-telemetry';
import type { InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';

export const UNIT_4_4_LESSON_KEY = 'unit-4-4-fixed-structure-optimization-modeling-v1';

function choiceOptions(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

function backfillManifestStep(input: {
  id: string;
  title: string;
  interactionKind: InteractiveRuntimeStepManifest['interactionSpec']['interactionKind'];
  cards: NonNullable<InteractiveRuntimeStepManifest['interactionSpec']['activityCards']>;
}): InteractiveRuntimeStepManifest {
  return {
    id: input.id,
    title: input.title,
    modules: [],
    contentBlocks: {},
    evidenceSequence: [],
    layout: { template: input.interactionKind, regions: [] },
    interactionSpec: {
      interactionKind: input.interactionKind,
      activityCards: input.cards,
    },
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
    },
    studentAccess: {},
    teacherInsightSpec: { widgets: [] },
    telemetrySpec: { summaryFields: [], misconceptionTags: [] },
    aiContextSpec: { pageGoal: 'unit 4-4 historical backfill', deliveryMode: 'hidden_page_context' },
    interactiveFigureSpec: {},
    previewContract: { demoPath: '' },
    acceptanceChecks: [],
  };
}

const BACKFILL_STEP_MANIFESTS: Record<string, InteractiveRuntimeStepManifest> = {
  'step-08': backfillManifestStep({
    id: 'step-08',
    title: '主案例总表：起始方案与三组无约束权重方案如何分化',
    interactionKind: 'single_choice',
    cards: [
      {
        id: 'weight-preference',
        prompt: '若更担心动作代价继续抬高，更应优先保留哪一组偏好？',
        responseKind: 'single_choice',
        submitScope: 'step',
        layoutSpan: 'full',
        options: choiceOptions(['A', 'B', 'C']),
        referenceAnswer: 'C',
      },
    ],
  }),
  'step-10': backfillManifestStep({
    id: 'step-10',
    title: 'Pareto front：为什么会出现一族同样值得保留的设计',
    interactionKind: 'single_choice',
    cards: [
      {
        id: 'pareto-meaning',
        prompt: '为什么 Pareto front 上会保留一族候选？',
        responseKind: 'single_choice',
        submitScope: 'step',
        layoutSpan: 'full',
        options: choiceOptions(['A', 'B', 'C']),
        referenceAnswer: '因为它保留的是一组非支配候选',
      },
    ],
  }),
  'step-13': backfillManifestStep({
    id: 'step-13',
    title: '后测：判断链是否已经形成',
    interactionKind: 'quiz_group',
    cards: [
      {
        id: 'post-quiz-1',
        prompt: '为什么本课得到的无约束候选还不能直接视为最终工程方案？',
        responseKind: 'single_choice',
        submitScope: 'step',
        layoutSpan: 'full',
        options: [],
        referenceAnswer: '因为还没有经过 4-5 的工程复核',
      },
      {
        id: 'post-quiz-2',
        prompt: '为什么 Pareto front 上会保留一族候选？',
        responseKind: 'single_choice',
        submitScope: 'step',
        layoutSpan: 'full',
        options: [],
        referenceAnswer: '因为它保留的是一组非支配候选',
      },
      {
        id: 'post-quiz-3',
        prompt: '横摇通道迁移时，为什么目标函数必须改写？',
        responseKind: 'single_choice',
        submitScope: 'step',
        layoutSpan: 'full',
        options: [],
        referenceAnswer: '因为任务通道变了，收益项和代价项必须跟着改写',
      },
    ],
  }),
};

export interface Unit44BackfillState {
  userId: string;
  data: unknown;
}

export interface Unit44BackfillLog {
  id: string;
  userId: string;
  stepId: string | null;
  lessonKey: string | null;
  clientEventId: string | null;
  attemptKey: string | null;
  clientEventAt: Date | null;
  createdAt: Date;
  eventData: unknown;
}

export interface Unit44BackfillRow {
  userId: string;
  sessionId: string;
  lessonKey: string;
  stepId: string;
  attemptKey: string | null;
  sourceLogId: string;
  clientEventId: string | null;
  submittedAt: Date;
  responseData: Prisma.InputJsonValue;
  eventData: Prisma.InputJsonValue;
  moduleId: string;
  score: number;
  outcome: 'success' | 'partial' | 'failure';
  competencyContribution: Prisma.InputJsonValue;
}

export interface Unit44BackfillPlan {
  rows: Unit44BackfillRow[];
  summary: {
    states: number;
    responses: number;
    rows: number;
    missingLog: number;
    skippedExisting: number;
    unsupportedTelemetry: number;
    incompleteResponse: number;
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readAnswers(value: unknown): Record<string, string> | null {
  const record = readRecord(value);
  const entries = Object.entries(record)
    .filter(([, answer]) => typeof answer === 'string' && answer.trim().length > 0)
    .map(([key, answer]) => [key, (answer as string).trim()]);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function readUnit44Responses(stateData: unknown): Record<string, Unit44StepResponseLike> {
  const data = readRecord(stateData);
  if (data.kind !== 'unit44_student_state') {
    return {};
  }

  const responses = readRecord(data.responses);
  return Object.fromEntries(Object.entries(responses).flatMap(([stepId, value]) => {
    const response = readRecord(value);
    const responseStepId = readString(response.stepId) ?? stepId;
    const submittedAt = readNumber(response.submittedAt);
    const answers = readAnswers(response.answers);

    if (!submittedAt || !answers) {
      return [];
    }

    return [[responseStepId, { stepId: responseStepId, submittedAt, answers }]];
  }));
}

function isSubmissionLog(log: Unit44BackfillLog): boolean {
  const eventData = readRecord(log.eventData);
  const eventType = readString(eventData.eventType);
  return eventType === 'lesson_submit' || eventType === 'lesson_resubmit';
}

function logSubmittedAt(log: Unit44BackfillLog): number | null {
  const eventData = readRecord(log.eventData);
  const eventDataTime = readNumber(eventData.clientEventAt);
  if (eventDataTime) return eventDataTime;
  return log.clientEventAt?.getTime() ?? null;
}

function findMatchingLog(
  logs: Unit44BackfillLog[],
  userId: string,
  response: Unit44StepResponseLike,
): Unit44BackfillLog | null {
  const attemptKey = `${response.stepId}:response:${response.submittedAt}`;
  return logs.find((log) =>
    log.userId === userId &&
    log.stepId === response.stepId &&
    isSubmissionLog(log) &&
    (
      log.attemptKey === attemptKey ||
      readString(readRecord(log.eventData).attemptKey) === attemptKey ||
      logSubmittedAt(log) === response.submittedAt
    )
  ) ?? null;
}

function hasCompleteAnswers(
  response: Unit44StepResponseLike,
  stepManifest: InteractiveRuntimeStepManifest,
): boolean {
  const cards = stepManifest.interactionSpec.activityCards ?? [];
  return cards.length > 0 && cards.every((card) => {
    const answer = response.answers[card.id];
    return typeof answer === 'string' && answer.trim().length > 0;
  });
}

export function buildUnit44BackfillPlan(input: {
  sessionId?: string;
  states: Unit44BackfillState[];
  logs: Unit44BackfillLog[];
  existingSourceLogIds: Set<string>;
}): Unit44BackfillPlan {
  const sessionId = input.sessionId ?? '';
  const rows: Unit44BackfillRow[] = [];
  let responses = 0;
  let missingLog = 0;
  let skippedExisting = 0;
  let unsupportedTelemetry = 0;
  let incompleteResponse = 0;

  for (const state of input.states) {
    const stateResponses = readUnit44Responses(state.data);
    for (const response of Object.values(stateResponses)) {
      responses += 1;
      const log = findMatchingLog(input.logs, state.userId, response);
      if (!log) {
        missingLog += 1;
        continue;
      }
      if (input.existingSourceLogIds.has(log.id)) {
        skippedExisting += 1;
        continue;
      }

      const stepManifest = BACKFILL_STEP_MANIFESTS[response.stepId];
      if (!stepManifest) {
        unsupportedTelemetry += 1;
        continue;
      }
      if (!hasCompleteAnswers(response, stepManifest)) {
        incompleteResponse += 1;
        continue;
      }
      const telemetry = buildUNIT44SubmissionTelemetry(response, stepManifest);
      if (!telemetry) {
        unsupportedTelemetry += 1;
        continue;
      }

      const eventData = readRecord(log.eventData);
      const clientEventId = log.clientEventId ?? readString(eventData.clientEventId);
      const attemptKey = log.attemptKey ?? readString(eventData.attemptKey);
      const submittedAt = new Date(response.submittedAt);
      const evidencePayload = {
        ...eventData,
        eventType: readString(eventData.eventType) ?? 'lesson_submit',
        sourceLogId: log.id,
        clientEventId,
        attemptKey,
        stepId: response.stepId,
        lessonKey: log.lessonKey ?? UNIT_4_4_LESSON_KEY,
        backfillSource: 'student_state_final_response',
        ...(telemetry as unknown as Record<string, Prisma.InputJsonValue>),
      };

      rows.push({
        userId: state.userId,
        sessionId,
        lessonKey: log.lessonKey ?? UNIT_4_4_LESSON_KEY,
        stepId: response.stepId,
        attemptKey,
        sourceLogId: log.id,
        clientEventId,
        submittedAt,
        responseData: evidencePayload as unknown as Prisma.InputJsonValue,
        eventData: evidencePayload as unknown as Prisma.InputJsonValue,
        moduleId: telemetry.moduleId,
        score: telemetry.score,
        outcome: telemetry.outcome,
        competencyContribution: telemetry.competencyContribution as Prisma.InputJsonValue,
      });
    }
  }

  return {
    rows,
    summary: {
      states: input.states.length,
      responses,
      rows: rows.length,
      missingLog,
      skippedExisting,
      unsupportedTelemetry,
      incompleteResponse,
    },
  };
}
