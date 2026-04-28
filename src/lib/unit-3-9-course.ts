import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_9StageCode = 'B' | 'P1' | 'P2' | 'P3';
export type UNIT_3_9PageType =
  | 'display'
  | 'quiz_group'
  | 'structured_compare'
  | 'matrix_workspace'
  | 'reason_check'
  | 'table_builder';

export interface UNIT_3_9PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_9PageContract {
  layout: {
    template: string;
    regions: UNIT_3_9PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_3_9PageType, 'display'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export interface UNIT_3_9StepDefinition {
  id: string;
  stage: UNIT_3_9StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_9PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_3_9StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
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
  updatedAt: number;
}

export interface UNIT_3_9TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
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
  '围绕同一航向控制对象，把基准、零点线补强、积分家族与滞后对照收成一张稳定—动态—稳态综合映射表，并把模块 3 的出口判断接到 4-1 的任务表达入口。';

export const UNIT_3_9_STAGE_LABEL: Record<UNIT_3_9StageCode, string> = {
  B: 'B · 导入',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测与收束',
};

export const UNIT_3_9_STAGE_MAP: Record<UNIT_3_9StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
};

export const UNIT_3_9_PAGE_CONTRACTS: Record<string, UNIT_3_9PageContract> = {
  'step-01': {
    layout: {
      template: 'map_hero_slide',
      regions: [
        { id: 'header', width: 'full', order: 1 },
        { id: 'lead', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count', 'sync_status'],
    telemetrySummaryFields: ['viewed', 'timeOnStep', 'teacherFollowSync'],
    previewDemoPath: '/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'question_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'tag-card', width: 'full', order: 2 },
        { id: 'submit-bar', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'task_label_confusion'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['name_controller_first', 'ignore_task_label', 'bandwidth_equals_better'],
    previewDemoPath: '/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'design_compare_workspace',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_compare',
    teacherInsightWidgets: ['tag_distribution', 'risk_distribution'],
    telemetrySummaryFields: ['draftSubmitted', 'tagChoice', 'riskChoice'],
    misconceptionTags: ['skip_baseline_anchor'],
    previewDemoPath: '/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'design_compare_workspace',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_compare',
    teacherInsightWidgets: ['benefit_domain_distribution', 'cost_domain_distribution'],
    telemetrySummaryFields: ['draftSubmitted', 'benefitDomain', 'costDomain'],
    misconceptionTags: ['dynamic_without_cost'],
    previewDemoPath: '/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'matrix_lab_board',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'matrix_workspace',
    teacherInsightWidgets: ['completion_rate', 'common_misjudgments'],
    telemetrySummaryFields: ['matrixUpdated', 'versionCompared', 'submissionState'],
    misconceptionTags: ['only_watch_low_frequency', 'ignore_mid_frequency_cost'],
    previewDemoPath: '/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'comparison_panel_with_reason',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['option_distribution', 'integral_lag_confusion'],
    telemetrySummaryFields: ['selectedOption', 'resultState'],
    misconceptionTags: ['lag_equals_integral'],
    previewDemoPath: '/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'mapping_workspace',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'risk', width: 'full', order: 2 },
        { id: 'submit', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'table_builder',
    teacherInsightWidgets: ['row_completion_heatmap', 'missing_field_toplist'],
    telemetrySummaryFields: ['rowCompleted', 'submissionState', 'revisionCount'],
    misconceptionTags: ['write_benefit_without_cost', 'single_domain_judgment'],
    previewDemoPath: '/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'summary_quiz_board',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'quiz', width: 'full', order: 2 },
        { id: 'next-step', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['posttest_distribution', 'module4_ready_rate'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['jump_to_final_design', 'bandwidth_is_everything'],
    previewDemoPath: '/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-08',
  },
};

export const UNIT_3_9_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_9PageType>([
  'quiz_group',
  'structured_compare',
  'matrix_workspace',
  'reason_check',
  'table_builder',
]);

export const UNIT_3_9_LESSON_STEPS: UNIT_3_9StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图：固定统一对象与比较顺序',
    hint: '先固定统一对象、比较链和模块 3 到模块 4 的路径，不在起步页提前排优劣。',
    duration: '6 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'P1',
    title: '前测：先贴任务标签，不先报控制器名称',
    hint: '先暴露“先报控制器名称”的误区，把任务标签放在机制名称之前。',
    duration: '8 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-03',
    stage: 'P2',
    title: '基准版本：把它判成什么标签',
    hint: '先读基准对象，再写任务标签、第一风险点和首先观察的域。',
    duration: '12 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '零点线补强：更偏动态改善的样例',
    hint: '压实零点线更偏动态改善，但不把它写成通吃一切的最优方案。',
    duration: '10 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '积分家族：低频收益与中频代价如何一起暴露',
    hint: '把弱积分、强积分与积分校正放进同一张矩阵，先看收益域，再看代价域。',
    duration: '16 min',
    pageType: 'matrix_workspace',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '滞后对照：稳态改善的另一条路径',
    hint: '滞后能压小误差，但不等于像积分那样直接把误差结构性压到零。',
    duration: '10 min',
    pageType: 'reason_check',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '综合映射工作区：把收益和代价写回同一张表',
    hint: '把基准、零点线、积分校正与滞后四条路线压成统一的收益/代价/任务标签输出。',
    duration: '14 min',
    pageType: 'table_builder',
  },
  {
    id: 'step-08',
    stage: 'P3',
    title: '模块 4 入口：只做首轮任务判断',
    hint: '后测只检查入口判断与边界意识，3-9 不进入完整选型和整定。',
    duration: '10 min',
    pageType: 'quiz_group',
  },
] as const;

export function getUNIT_3_9Step(stepId: string) {
  return UNIT_3_9_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_9_LESSON_STEPS[0];
}

export function getUNIT_3_9PageContract(stepId: string) {
  return UNIT_3_9_PAGE_CONTRACTS[stepId] ?? UNIT_3_9_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_9InteractivePageType(pageType: UNIT_3_9PageType) {
  return UNIT_3_9_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_9AiPageType(pageType: UNIT_3_9PageType) {
  return isUNIT_3_9InteractivePageType(pageType);
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

export const UNIT_3_9_PREMIUM_LESSON_CARD = {
  id: 'unit-3-9-cross-domain-mapping-lab',
  title: UNIT_3_9_COURSE_TITLE,
  description: '精品互动课：用同一对象把稳定、动态与稳态三条机制线收束为模块 4 可直接调用的综合映射表。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_9_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_9_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/3-9/media/3-9-cover-comic.png',
  'step-03': '/course-runtime/lessons/3-9/media/3-9-baseline-quad.png',
  'step-04': '/course-runtime/lessons/3-9/media/3-9-zero-line-quad.png',
  'step-05': '/course-runtime/lessons/3-9/media/3-9-integral-weak-quad.png',
  'step-06': '/course-runtime/lessons/3-9/media/3-9-lag-quad.png',
  'step-08': '/course-runtime/lessons/3-9/media/3-9-info.png',
};

export function getUNIT_3_9MediaSrc(stepId: string) {
  return UNIT_3_9_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_9StudentState(value: unknown): value is UNIT_3_9StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_9StudentCourseState>;
  return data.kind === 'unit39_student_state' && data.version === 1;
}

export function isUNIT_3_9TeacherSyncState(value: unknown): value is UNIT_3_9TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
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
  teacherSyncState: UNIT_3_9TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_9TeacherSession(input: UNIT_3_9TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_3_9_LESSON_STEPS,
  }));
}
