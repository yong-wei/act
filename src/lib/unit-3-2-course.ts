import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_2StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_3_2PageType =
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'quiz_group'
  | 'short_response'
  | 'interval_input'
  | 'triple_match'
  | 'classification_drag'
  | 'formula_completion'
  | 'reason_check'
  | 'parameter_workspace'
  | 'tab_switch'
  | 'comparison_workspace'
  | 'ai_compare_workspace'
  | 'formula_pair_check';

export interface UNIT_3_2PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_2PageContract {
  layout: {
    template: string;
    regions: UNIT_3_2PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_3_2PageType, 'display' | 'summary'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export type Unit32WorkspaceKind = 'interval' | 'boundary' | 'constraint' | 'none';

export interface UNIT_3_2StepDefinition {
  id: string;
  stage: UNIT_3_2StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_2PageType;
  workspaceKind?: Unit32WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_3_2StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_2StudentCourseState {
  kind: 'unit32_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_2StepResponse>;
}

export interface UNIT_3_2TeacherCourseSyncState {
  kind: 'teacher_sync_unit32';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_3_2TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_2TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_2TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_2_ROUTE_SEGMENT = 'unit-3-2-routh-stability-boundary';
export const UNIT_3_2_PRESET_KEY = 'unit-3-2-routh-stability-boundary-v1';
export const UNIT_3_2_RESOURCE_KEY = 'unit-3-2-routh-stability-boundary';
export const UNIT_3_2_LESSON_KEY = UNIT_3_2_PRESET_KEY;
export const UNIT_3_2_STUDENT_ITEM_ID = 'student:unit32:state';
export const UNIT_3_2_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_2_STUDENT_STATE_KEY = 'course';
export const UNIT_3_2_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_2_COURSE_TITLE = '3-2：劳斯判据——从高阶系统稳定判定到参数可行域';
export const UNIT_3_2_COURSE_SUBTITLE = 'Routh Stability Boundary';
export const UNIT_3_2_COURSE_DESCRIPTION =
  '围绕普通劳斯判稳、带参数区间、两类特殊情况、三域翻译与变量平移，把高阶系统的稳定底线推进到参数可行域语言。';

export const UNIT_3_2_STAGE_LABEL: Record<UNIT_3_2StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_3_2_STAGE_MAP: Record<UNIT_3_2StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_3_2_PAGE_CONTRACTS: Record<string, UNIT_3_2PageContract> = {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'figure_question_vote',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'questions', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'misconception_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['visual_boundary_is_enough'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'goal_boundary_slide',
      regions: [
        { id: 'goals', width: 'full', order: 1 },
        { id: 'chain', width: 'full', order: 2 },
        { id: 'boundary', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-03',
  },
  'step-04': {
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
    misconceptionTags: ['routh_equals_root_solving', 'zero_head_equals_zero_row', 'stable_equals_ready_for_optimization'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'table_construction_workspace',
      regions: [
        { id: 'object', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'short_response',
    teacherInsightWidgets: ['response_word_cloud', 'common_reason_tags'],
    telemetrySummaryFields: ['responseSubmitted', 'responseLength', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'interval_workflow_workspace',
      regions: [
        { id: 'equation', width: 'full', order: 1 },
        { id: 'conditions', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'interval_input',
    teacherInsightWidgets: ['range_distribution', 'missing_condition_rate'],
    telemetrySummaryFields: ['submittedRange', 'resultState', 'errorBucket'],
    misconceptionTags: ['missing_s0_condition', 'fraction_chain_error', 'treating_routh_as_root_solver'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'boundary_mapping_board',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'cards', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['match_accuracy', 'boundary_confusion_tags'],
    telemetrySummaryFields: ['matchAttempts', 'resultState', 'timeOnStep'],
    misconceptionTags: ['origin_root_equals_pure_imaginary_pair'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'case_split_match',
      regions: [
        { id: 'examples', width: 'full', order: 1 },
        { id: 'method-card', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'classification_drag',
    teacherInsightWidgets: ['case_split_distribution', 'confusion_rate'],
    telemetrySummaryFields: ['selectedBucket', 'resultState', 'retryCount'],
    misconceptionTags: ['zero_head_equals_zero_row'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'method_card_with_completion',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'workflow', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'formula_completion',
    teacherInsightWidgets: ['formula_error_hotspots', 'method_completion_rate'],
    telemetrySummaryFields: ['completionState', 'resultState', 'timeOnStep'],
    misconceptionTags: ['missing_upper_row_source', 'forget_derivative_replace'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'response_compare_board',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'translation', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['state_match_accuracy', 'critical_state_confusion'],
    telemetrySummaryFields: ['matchAttempts', 'resultState', 'timeOnStep'],
    misconceptionTags: ['critical_equals_slow'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'frequency_warning_board',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'conclusion', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['reason_accuracy', 'boundary_to_frequency_confusion'],
    telemetrySummaryFields: ['selectionState', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['frequency_view_becomes_stability_criterion'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'constraint_transform_workspace',
      regions: [
        { id: 'constraint', width: 'full', order: 1 },
        { id: 'workflow', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_workspace',
    teacherInsightWidgets: ['range_accuracy', 'constraint_reason_distribution'],
    telemetrySummaryFields: ['submittedRange', 'reasonTag', 'resultState'],
    misconceptionTags: ['constraint_shift_is_new_topic', 'forget_interval_shrink_reason'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'post_quiz_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'submit-bar', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_accuracy', 'explanation_keywords'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'revisionCount'],
    misconceptionTags: ['can_compute_but_cannot_explain_boundary'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'summary_infographic',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'cheatsheet', width: 'full', order: 2 },
        { id: 'next-step', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-14',
  },
};

export const UNIT_3_2_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_2PageType>([
  'binary_choice',
  'quiz_group',
  'short_response',
  'interval_input',
  'triple_match',
  'classification_drag',
  'formula_completion',
  'reason_check',
  'parameter_workspace',
]);

export const UNIT_3_2_LESSON_STEPS: UNIT_3_2StepDefinition[] = [
  { id: 'step-01', stage: 'B', title: '回到地图——从纯极点语言走向稳定边界', hint: '从 3-1 接续到 3-2，先立住本课位于模块 3 的位置。', duration: '3 min', pageType: 'display' },
  { id: 'step-02', stage: 'B', title: '情境引入——看到极点逼近边界还不够吗', hint: '先暴露“只看图就够了”的误判，再引出系数规则。', duration: '5 min', pageType: 'binary_choice' },
  { id: 'step-03', stage: 'O', title: '学习目标——本课要建立哪套边界语言', hint: '明确本课目标、主线和边界，不越界进根轨迹。', duration: '4 min', pageType: 'display' },
  { id: 'step-04', stage: 'P1', title: '前测——高阶系统不求根也能判稳吗', hint: '用三题前测暴露“劳斯等于求根法”等常见混淆。', duration: '8 min', pageType: 'quiz_group' },
  { id: 'step-05', stage: 'P2', title: '普通劳斯表：第一列为何足以回答稳定性', hint: '建立“判稳不等于求根”的第一条规则意识。', duration: '8 min', pageType: 'short_response' },
  { id: 'step-06', stage: 'P2', title: '带参数劳斯表：稳定区间怎样直接读出', hint: '把第一列条件链推进到参数区间表达。', duration: '10 min', pageType: 'interval_input', workspaceKind: 'interval' },
  { id: 'step-07', stage: 'P2', title: '边界回看：代数区间怎样落到极点迁移图', hint: '把代数边界翻译成几何边界与根结构差异。', duration: '7 min', pageType: 'triple_match', workspaceKind: 'boundary' },
  { id: 'step-08', stage: 'P2', title: '特殊情况辨识：先分清首位为 0 还是全零行', hint: '先辨识，再处理，不能把两类特殊情况混为一谈。', duration: '7 min', pageType: 'classification_drag' },
  { id: 'step-09', stage: 'P2', title: '处理动作：ε 延拓与辅助方程', hint: '把特殊情况处理链和根结构含义绑定起来。', duration: '7 min', pageType: 'formula_completion' },
  { id: 'step-10', stage: 'P2', title: '三域对照一：稳定、临界、失稳的时域差异', hint: '把稳定状态、时域曲线和极点结构建立第一轮翻译。', duration: '6 min', pageType: 'triple_match' },
  { id: 'step-11', stage: 'P2', title: '三域对照二：边界附近为何先出现频域峰值', hint: '频域在本课只做辅助观察，不升级成判据课。', duration: '5 min', pageType: 'reason_check' },
  { id: 'step-12', stage: 'P2', title: '区域约束：变量平移如何把竖线约束转成普通判稳', hint: '把判稳推进到更强约束下的参数可行域表达。', duration: '8 min', pageType: 'parameter_workspace', workspaceKind: 'constraint' },
  { id: 'step-13', stage: 'P3', title: '后测——会算表，更要会解释边界语言', hint: '检查学生是否真正建立了边界语言而不只是会算表。', duration: '8 min', pageType: 'quiz_group' },
  { id: 'step-14', stage: 'S', title: '总结与后续预告——从判稳走向迁移机制', hint: '用五条结论收束 3-2，并把视角推到 3-3 与 4-1。', duration: '4 min', pageType: 'summary' },
] as const;

export function getUNIT_3_2Step(stepId: string) {
  return UNIT_3_2_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_2_LESSON_STEPS[0];
}

export function getUNIT_3_2PageContract(stepId: string) {
  return UNIT_3_2_PAGE_CONTRACTS[stepId] ?? UNIT_3_2_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_2InteractivePageType(pageType: UNIT_3_2PageType) {
  return UNIT_3_2_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_2AiPageType(_pageType: UNIT_3_2PageType) {
  return true;
}

export function createEmptyUNIT_3_2StudentState(studentName: string): UNIT_3_2StudentCourseState {
  return {
    kind: 'unit32_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_2_PREMIUM_LESSON_CARD = {
  id: 'unit-3-2-routh-stability-boundary',
  title: UNIT_3_2_COURSE_TITLE,
  description: '精品互动课：把高阶系统稳定底线推进到参数可行域、特殊情况处理和三域翻译。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_2_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_2_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/3-2/media/3-2-pole-migration.png',
  'step-08': '/course-runtime/lessons/3-2/media/3-2-special-cases-card.png',
  'step-09': '/course-runtime/lessons/3-2/media/3-2-special-cases-card.svg',
  'step-10': '/course-runtime/lessons/3-2/media/3-2-step-comparison.png',
  'step-11': '/course-runtime/lessons/3-2/media/3-2-bode-magnitude.png',
  'step-12': '/course-runtime/lessons/3-2/media/3-2-parameter-range-flow.png',
  'step-14': '/course-runtime/lessons/3-2/media/3-2-info.png',
};

export function getUNIT_3_2MediaSrc(stepId: string) {
  return UNIT_3_2_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_2StudentState(value: unknown): value is UNIT_3_2StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_2StudentCourseState>;
  return data.kind === 'unit32_student_state' && data.version === 1;
}

export function isUNIT_3_2TeacherSyncState(value: unknown): value is UNIT_3_2TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_2TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit32' && typeof data.activeStepId === 'string';
}

export const UNIT_3_2_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_2StudentCourseState,
  UNIT_3_2TeacherCourseSyncState,
  UNIT_3_2TeacherSyncInput
> = {
  lessonKey: UNIT_3_2_LESSON_KEY,
  studentItemId: UNIT_3_2_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_2_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_2_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_2_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_2StudentState,
  isStudentState: isUNIT_3_2StudentState,
  isTeacherSyncState: isUNIT_3_2TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit32',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_2TeacherSync(input: UNIT_3_2TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_2TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_3_2TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_2TeacherSession(input: UNIT_3_2TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
