import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_7StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3';
export type UNIT_3_7PageType =
  | 'display'
  | 'binary_choice'
  | 'quiz_group'
  | 'hotspot_labeling'
  | 'worked_example_workspace'
  | 'triple_match'
  | 'card_sort'
  | 'structured_compare';

export interface UNIT_3_7PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_7PageContract {
  layout: {
    template: string;
    regions: UNIT_3_7PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_3_7PageType, 'display'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export interface UNIT_3_7StepDefinition {
  id: string;
  stage: UNIT_3_7StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_7PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_3_7StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_7StudentCourseState {
  kind: 'unit37_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_7StepResponse>;
}

export interface UNIT_3_7TeacherCourseSyncState {
  kind: 'teacher_sync_unit37';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_3_7TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_7TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_7TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_7_ROUTE_SEGMENT = 'unit-3-7-steady-error-low-frequency-compensation';
export const UNIT_3_7_PRESET_KEY = 'unit-3-7-steady-error-low-frequency-compensation-v1';
export const UNIT_3_7_RESOURCE_KEY = 'unit-3-7-steady-error-low-frequency-compensation';
export const UNIT_3_7_LESSON_KEY = UNIT_3_7_PRESET_KEY;
export const UNIT_3_7_STUDENT_ITEM_ID = 'student:unit37:state';
export const UNIT_3_7_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_7_STUDENT_STATE_KEY = 'course';
export const UNIT_3_7_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_7_COURSE_TITLE = '3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理';
export const UNIT_3_7_COURSE_SUBTITLE = 'Steady Error And Low-Frequency Compensation';
export const UNIT_3_7_COURSE_DESCRIPTION =
  '围绕给定/扰动双通道、终值定理与型别快判、PI/滞后低频补偿比较，把“为什么更准”推进成一条可执行的稳态误差分析与补偿路径。';

export const UNIT_3_7_STAGE_LABEL: Record<UNIT_3_7StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测与收束',
};

export const UNIT_3_7_STAGE_MAP: Record<UNIT_3_7StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
};

export const UNIT_3_7_PAGE_CONTRACTS: Record<string, UNIT_3_7PageContract> = {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'goal_boundary_slide',
      regions: [
        { id: 'goals', width: 'full', order: 1 },
        { id: 'boundary', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'question_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'submit-bar', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['disturbance_is_input_type', 'gain_equals_type_raise', 'lag_is_weaker_integral'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'formula_media_compare',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'formula', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'hotspot_labeling',
    teacherInsightWidgets: ['common_mislabels', 'completion_rate'],
    telemetrySummaryFields: ['labelAttempted', 'labelCorrected', 'timeOnStep'],
    misconceptionTags: ['channel_position_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'worked_example_workspace',
      regions: [
        { id: 'workflow', width: 'full', order: 1 },
        { id: 'problem', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['stuck_step_distribution'],
    telemetrySummaryFields: ['stepCompletion', 'errorBucket', 'timeOnStep'],
    misconceptionTags: ['skipped_error_expression', 'final_value_without_stability_check'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'formula_table_match',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'tables', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['common_mismatch_pairs'],
    telemetrySummaryFields: ['matchAttempted', 'matchCorrected'],
    misconceptionTags: ['all_disturbance_use_static_coefficients'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'worked_example_workspace',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['missing_term_distribution'],
    telemetrySummaryFields: ['stepCompletion', 'errorBucket'],
    misconceptionTags: ['forgot_disturbance_term', 'wrong_total_error_definition'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'contrast_summary_board',
      regions: [
        { id: 'compare', width: 'full', order: 1 },
        { id: 'interaction', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution'],
    telemetrySummaryFields: ['selectedOption', 'resultState'],
    misconceptionTags: ['gain_equals_type_raise'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'comparison_panel_with_sort',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'card_sort',
    teacherInsightWidgets: ['misclassified_cards'],
    telemetrySummaryFields: ['sortAttempted', 'sortCorrected'],
    misconceptionTags: ['lag_is_weaker_integral', 'pi_has_no_cost'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'design_compare_workspace',
      regions: [
        { id: 'left-example', width: 'full', order: 1 },
        { id: 'right-example', width: 'full', order: 2 },
        { id: 'comparison', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_compare',
    teacherInsightWidgets: ['common_compare_gaps'],
    telemetrySummaryFields: ['fieldsCompleted', 'compareBucket'],
    misconceptionTags: ['only_memorized_metrics_without_mechanism'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'formula_media_compare',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['common_mismatch_pairs'],
    telemetrySummaryFields: ['matchAttempted', 'matchCorrected'],
    misconceptionTags: ['pi_and_pd_same_design_goal'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'summary_quiz_board',
      regions: [
        { id: 'quiz', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'next', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'summary_completion_rate'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['wrong_path_selection', 'cannot_identify_cost_location'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-12',
  },
};

export const UNIT_3_7_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_7PageType>([
  'binary_choice',
  'quiz_group',
  'hotspot_labeling',
  'worked_example_workspace',
  'triple_match',
  'card_sort',
  'structured_compare',
]);

export const UNIT_3_7_LESSON_STEPS: UNIT_3_7StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图：为什么动态改善之后还可能不够准',
    hint: '先把 3-7 放回 3-6 到 3-8 之间，明确“更快更稳”还没有回答“为什么更准”。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'O',
    title: '学习目标与边界：本课先回答“为什么更准”',
    hint: '四项目标与课堂边界一次钉死，本课不提前滑进 Nyquist 判据和完整整定。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-03',
    stage: 'P1',
    title: '前测：给定、扰动、型别三类混淆',
    hint: '先暴露“扰动也能套表”“增益变大等于型别提高”“滞后只是弱积分”三类误判。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '双通道骨架：先分给定与扰动，再写总输出与总误差',
    hint: '用统一结构图把输入/扰动两类误差通道钉住，先分通道再谈稳态误差。',
    duration: '8 min',
    pageType: 'hotspot_labeling',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '终值定理直接求：稳态误差的通用路径',
    hint: '三步法必须稳定、列式、取极限全链路保留，不能直接背结果。',
    duration: '10 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '型别与静态误差系数：什么时候能快速判断',
    hint: '把快判的适用边界说清，只在标准给定输入时才优先用型别和误差系数。',
    duration: '8 min',
    pageType: 'triple_match',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '复合例题：给定与扰动共同作用时为什么不能只套表',
    hint: '显式双输入问题必须先分通道列总误差式，再用终值定理求结果。',
    duration: '8 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '增益变大 vs 型别提高：哪一种才会改变误差阶次',
    hint: '把“压小有限误差”和“结构性归零”彻底分开，先判断是否必须引入积分。',
    duration: '6 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '稳态改善路径比较：PI 与滞后都站在低频补偿线上',
    hint: '同样是低频补偿，PI 改型别，滞后重分配低频增益，收益和代价不一样。',
    duration: '8 min',
    pageType: 'card_sort',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '时域设计工作区：PI 改型别，滞后抬低频',
    hint: '把时域图、指标卡和结构抓手放到同一页，对比 PI 与滞后两种设计链。',
    duration: '10 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '频域过渡：为什么 PI 更准、PD 更快',
    hint: '把 3-7 收束到低频收益和中频代价的频域语言，为 3-8 做准备。',
    duration: '8 min',
    pageType: 'triple_match',
  },
  {
    id: 'step-12',
    stage: 'P3',
    title: '后测与收束：先选路径，再认代价，最后接到 3-8',
    hint: '后测只检查路径选择和代价识别，小结必须把 3-7 平滑接到 3-8。',
    duration: '10 min',
    pageType: 'quiz_group',
  },
] as const;

export function getUNIT_3_7Step(stepId: string) {
  return UNIT_3_7_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_7_LESSON_STEPS[0];
}

export function getUNIT_3_7PageContract(stepId: string) {
  return UNIT_3_7_PAGE_CONTRACTS[stepId] ?? UNIT_3_7_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_7InteractivePageType(pageType: UNIT_3_7PageType) {
  return UNIT_3_7_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_7AiPageType(_pageType: UNIT_3_7PageType) {
  return true;
}

export function createEmptyUNIT_3_7StudentState(studentName: string): UNIT_3_7StudentCourseState {
  return {
    kind: 'unit37_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_7_PREMIUM_LESSON_CARD = {
  id: 'unit-3-7-steady-error-low-frequency-compensation',
  title: UNIT_3_7_COURSE_TITLE,
  description: '精品互动课：双通道误差、终值定理与型别快判、PI/滞后低频补偿比较。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_7_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_7_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/3-7/media/3-7-cover-comic.png',
  'step-04': '/course-runtime/lessons/3-7/media/3-7-error-dual-channel.png',
  'step-07': '/course-runtime/lessons/3-7/media/3-7-example2-structure.png',
  'step-09': '/course-runtime/lessons/3-7/media/3-7-low-frequency-compensators.png',
  'step-10': '/course-runtime/lessons/3-7/media/3-7-pi-time-domain-design.png',
  'step-11': '/course-runtime/lessons/3-7/media/3-7-pi-frequency-design.png',
  'step-12': '/course-runtime/lessons/3-7/media/3-7-info.png',
};

export function getUNIT_3_7MediaSrc(stepId: string) {
  return UNIT_3_7_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_7StudentState(value: unknown): value is UNIT_3_7StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_7StudentCourseState>;
  return data.kind === 'unit37_student_state' && data.version === 1;
}

export function isUNIT_3_7TeacherSyncState(value: unknown): value is UNIT_3_7TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_7TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit37' && typeof data.activeStepId === 'string';
}

export const UNIT_3_7_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_7StudentCourseState,
  UNIT_3_7TeacherCourseSyncState,
  UNIT_3_7TeacherSyncInput
> = {
  lessonKey: UNIT_3_7_LESSON_KEY,
  studentItemId: UNIT_3_7_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_7_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_7_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_7_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_7StudentState,
  isStudentState: isUNIT_3_7StudentState,
  isTeacherSyncState: isUNIT_3_7TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit37',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_7TeacherSync(input: UNIT_3_7TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_7TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_3_7TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_7TeacherSession(input: UNIT_3_7TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
