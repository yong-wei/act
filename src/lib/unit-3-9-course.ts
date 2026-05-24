import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import {
  getInteractiveRuntimeStep,
  isInteractiveRuntimePageType,
  type InteractiveInteractionKind,
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';

export type UNIT_3_9StageCode = 'B' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_3_9PageType = InteractiveInteractionKind;

export interface UNIT_3_9StepDefinition {
  id: string;
  stage: UNIT_3_9StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_9PageType;
}

export interface UNIT_3_9StepRuntimeMeta {
  stage: UNIT_3_9StageCode;
  duration: string;
}

export interface UNIT_3_9StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_9SubmissionTelemetry extends Record<string, unknown> {
  stepId: string;
  submittedAt: number;
  assessmentKind: 'pretest' | 'activity' | 'posttest';
  responseKind: 'draft' | 'submitted';
  answerKeys: Record<string, string>;
  answerCount: number;
  outcome: 'partial' | 'success';
}

export interface UNIT_3_9StudentCourseState {
  kind: 'unit39_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_9StepResponse>;
}

export interface UNIT_3_9TeacherCourseSyncState {
  kind: 'teacher_sync_unit39';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_3_9TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_9TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_9TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_9_ROUTE_SEGMENT = 'unit-3-9-cross-domain-mapping-lab';
export const UNIT_3_9_PRESET_KEY = 'unit-3-9-cross-domain-mapping-lab-v1';
export const UNIT_3_9_RESOURCE_KEY = 'unit-3-9-cross-domain-mapping-lab';
export const UNIT_3_9_LESSON_KEY = UNIT_3_9_PRESET_KEY;
export const UNIT_3_9_STUDENT_ITEM_ID = 'student:unit39:state';
export const UNIT_3_9_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_9_STUDENT_STATE_KEY = 'course';
export const UNIT_3_9_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_9_COURSE_TITLE = '3-9：稳定—动态—稳态综合映射实验';
export const UNIT_3_9_COURSE_SUBTITLE = 'Cross-Domain Mapping Lab';
export const UNIT_3_9_COURSE_DESCRIPTION =
  '围绕同一航向控制对象，把基准、超前、积分与滞后校正放进同一套四联图与综合映射表，形成进入后续设计的任务表达。';

export const UNIT_3_9_STAGE_LABEL: Record<UNIT_3_9StageCode, string> = {
  B: 'B · 导入',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_3_9_STAGE_MAP: Record<UNIT_3_9StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_3_9_STEP_RUNTIME_META: Record<string, UNIT_3_9StepRuntimeMeta> = {
  'step-01': { stage: 'B', duration: '5 min' },
  'step-02': { stage: 'B', duration: '4 min' },
  'step-03': { stage: 'P1', duration: '8 min' },
  'step-04': { stage: 'P2', duration: '7 min' },
  'step-05': { stage: 'P2', duration: '12 min' },
  'step-06': { stage: 'P2', duration: '12 min' },
  'step-07': { stage: 'P2', duration: '12 min' },
  'step-08': { stage: 'P2', duration: '10 min' },
  'step-09': { stage: 'P2', duration: '10 min' },
  'step-10': { stage: 'P3', duration: '10 min' },
  'step-11': { stage: 'S', duration: '4 min' },
};

export const UNIT_3_9_LESSON_STEPS: UNIT_3_9StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '导入：同一艘船的三种改进诉求',
    hint: '用场景问题导入同一对象下的跨域比较。',
    duration: '5 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '课程目标：跨域证据与任务标签',
    hint: '阅读本单元课程目标。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-03',
    stage: 'P1',
    title: '前测：任务标签与机制线判断',
    hint: '先选出任务标签，再判断可能的机制线。',
    duration: '8 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '控制对象：本次课比较的同一艘船',
    hint: '明确本次课的控制对象和主要任务。',
    duration: '7 min',
    pageType: 'display',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '基准版本：从四联图读出性能指标',
    hint: '从四联图读出基准版本指标。',
    duration: '12 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '超前校正的动态改善调节',
    hint: '调节超前校正参数，观察动态改善与相位裕度变化。',
    duration: '12 min',
    pageType: 'parameter_slider',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '积分校正的稳态误差调节',
    hint: '调节增益和积分零点，观察误差下降与相角代价。',
    duration: '12 min',
    pageType: 'parameter_slider',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '积分补偿后的中频相位整理',
    hint: '调节中频校正零点和极点，回收相位裕度和动态品质。',
    duration: '10 min',
    pageType: 'parameter_slider',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '滞后校正的低频收益调节',
    hint: '提高低频增益，观察稳态误差、响应速度和相角余量。',
    duration: '10 min',
    pageType: 'parameter_slider',
  },
  {
    id: 'step-10',
    stage: 'P3',
    title: '后测：填写四个版本的综合映射表',
    hint: '用表格填空完成综合映射。',
    duration: '10 min',
    pageType: 'table_builder',
  },
  {
    id: 'step-11',
    stage: 'S',
    title: '总结：从读图比较走向设计任务表达',
    hint: '总结跨域比较语言。',
    duration: '4 min',
    pageType: 'summary',
  },
];

export function buildUNIT_3_9RuntimeSteps(
  manifest: InteractiveRuntimeManifest | null,
): UNIT_3_9StepDefinition[] {
  if (!manifest) {
    return UNIT_3_9_LESSON_STEPS;
  }

  return manifest.steps.map((step) => {
    const meta = UNIT_3_9_STEP_RUNTIME_META[step.id] ?? { stage: 'P2' as const, duration: '6 min' };
    const pageType =
      step.interactionSpec.interactionKind === 'none'
        ? 'display'
        : step.interactionSpec.interactionKind;

    return {
      id: step.id,
      stage: meta.stage,
      title: step.title,
      hint: step.aiContextSpec.pageGoal || step.interactionSpec.studentTask || step.title,
      duration: meta.duration,
      pageType,
    };
  });
}

export function getUNIT_3_9StepManifest(
  manifest: InteractiveRuntimeManifest,
  stepId: string,
): InteractiveRuntimeStepManifest {
  return getInteractiveRuntimeStep(manifest, stepId) ?? manifest.steps[0];
}

export function getUNIT_3_9Step(stepId: string) {
  return UNIT_3_9_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_9_LESSON_STEPS[0];
}

export function isUNIT_3_9InteractivePageType(pageType: string) {
  return isInteractiveRuntimePageType(pageType);
}

export function isUNIT_3_9AiPageType(_pageType: string) {
  return false;
}

export function createEmptyUNIT_3_9StudentState(studentName: string): UNIT_3_9StudentCourseState {
  return {
    kind: 'unit39_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

function getUNIT_3_9AssessmentKind(stepId: string): UNIT_3_9SubmissionTelemetry['assessmentKind'] {
  if (stepId === 'step-03') return 'pretest';
  if (stepId === 'step-10') return 'posttest';
  return 'activity';
}

function summarizeUNIT_3_9AnswerKeys(answers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(answers).filter(([key, value]) => !key.startsWith('__') && value.trim().length > 0),
  );
}

export function buildUNIT_3_9SubmissionTelemetry(
  response: UNIT_3_9StepResponse,
): UNIT_3_9SubmissionTelemetry {
  const answerKeys = summarizeUNIT_3_9AnswerKeys(response.answers);
  const responseKind = response.answers.__draft === 'true' ? 'draft' : 'submitted';

  return {
    stepId: response.stepId,
    submittedAt: response.submittedAt,
    assessmentKind: getUNIT_3_9AssessmentKind(response.stepId),
    responseKind,
    answerKeys,
    answerCount: Object.keys(answerKeys).length,
    outcome: responseKind === 'draft' || Object.keys(answerKeys).length === 0 ? 'partial' : 'success',
  };
}

export const UNIT_3_9_PREMIUM_LESSON_CARD = {
  id: 'unit-3-9-cross-domain-mapping-lab',
  title: UNIT_3_9_COURSE_TITLE,
  description: '精品互动课：用 Rust/WASM 四联图和综合映射表完成稳定、动态与稳态的跨域比较。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_9_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_3_9StudentState(value: unknown): value is UNIT_3_9StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_3_9StudentCourseState>;
  return data.kind === 'unit39_student_state' && data.version === 1;
}

export function isUNIT_3_9TeacherSyncState(value: unknown): value is UNIT_3_9TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_3_9TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit39' && typeof data.activeStepId === 'string';
}

export const UNIT_3_9_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_9StudentCourseState,
  UNIT_3_9TeacherCourseSyncState,
  UNIT_3_9TeacherSyncInput
> = {
  lessonKey: UNIT_3_9_LESSON_KEY,
  studentItemId: UNIT_3_9_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_9_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_9_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_9_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_9StudentState,
  isStudentState: isUNIT_3_9StudentState,
  isTeacherSyncState: isUNIT_3_9TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit39',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_9TeacherSync(input: UNIT_3_9TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_9TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_3_9TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_3_9TeacherSession(input: UNIT_3_9TeacherFinalizeInput) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_3_9_LESSON_STEPS,
  });
}
