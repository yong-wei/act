import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_2StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_3_2TeacherControlMode =
  | 'not_applicable'
  | 'separate_toggle'
  | 'teacher_only'
  | 'page_load_open'
  | 'always_on';

export type UNIT_3_2PageType = 'display' | 'summary' | 'binary_choice' | 'quiz_group' | 'activity_cards';

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
  interactionKind: UNIT_3_2PageType | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  teacherControls: {
    releaseActivity: UNIT_3_2TeacherControlMode;
    openBrowse: UNIT_3_2TeacherControlMode;
    teacherStepReveal: UNIT_3_2TeacherControlMode;
    revealReferenceAnswer: UNIT_3_2TeacherControlMode;
  };
  previewDemoPath: string;
}

export interface UNIT_3_2StepDefinition {
  id: string;
  stage: UNIT_3_2StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_2PageType;
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
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_3_2TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
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
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'figure_question_board',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'questions', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'misconception_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['visual_boundary_is_enough'],
    teacherControls: {
      releaseActivity: 'page_load_open',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'question_stack',
      regions: [
        { id: 'title', width: 'full', order: 1 },
        { id: 'question-stack', width: 'full', order: 2 },
        { id: 'submit-bar', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['routh_equals_root_solving', 'zero_head_equals_zero_row', 'stability_equals_stronger_region'],
    teacherControls: {
      releaseActivity: 'page_load_open',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'worked_example_reveal',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
        { id: 'reference', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['card_accuracy_distribution', 'step_reveal_usage'],
    telemetrySummaryFields: ['cardResultStates', 'stepRevealCount', 'timeOnStep'],
    misconceptionTags: ['stable_equals_all_roots_solved', 'first_column_role_missing'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'worked_example_reveal',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
        { id: 'reference', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['interval_accuracy_distribution', 'top_missing_conditions'],
    telemetrySummaryFields: ['cardResultStates', 'stepRevealCount', 'attemptCount'],
    misconceptionTags: ['missing_s0_condition', 'fraction_sign_chain_error'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'figure_mapping_workspace',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
        { id: 'reference', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['match_accuracy_distribution', 'boundary_confusion_tags'],
    telemetrySummaryFields: ['cardResultStates', 'timeOnStep'],
    misconceptionTags: ['origin_root_equals_pure_imaginary_pair', 'boundary_only_memorized_as_number'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'worked_example_reveal',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
        { id: 'reference', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['card_accuracy_distribution', 'epsilon_misconception_rate'],
    telemetrySummaryFields: ['cardResultStates', 'stepRevealCount'],
    misconceptionTags: ['epsilon_as_real_parameter', 'zero_head_means_boundary'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'worked_example_reveal',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'rule', width: 'full', order: 2 },
        { id: 'derivation', width: 'full', order: 3 },
        { id: 'activity', width: 'full', order: 4 },
        { id: 'reference', width: 'full', order: 5 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['auxiliary_equation_accuracy', 'root_structure_confusion_tags'],
    telemetrySummaryFields: ['cardResultStates', 'stepRevealCount'],
    misconceptionTags: ['full_zero_row_equals_add_epsilon', 'full_zero_row_means_only_pure_imaginary'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'table_figure_workspace',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
        { id: 'reference', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['match_accuracy_distribution', 'time_response_confusion_tags'],
    telemetrySummaryFields: ['cardResultStates', 'timeOnStep'],
    misconceptionTags: ['origin_root_equals_pure_imaginary_time_response', 'unstable_only_seen_as_graph'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'figure_table_workspace',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'table', width: 'full', order: 3 },
        { id: 'activity', width: 'full', order: 4 },
        { id: 'reference', width: 'full', order: 5 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['frequency_confusion_distribution', 'explanation_keyword_hits'],
    telemetrySummaryFields: ['cardResultStates', 'timeOnStep'],
    misconceptionTags: ['origin_root_equals_resonance_peak', 'frequency_view_detached_from_poles'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'worked_example_reveal',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
        { id: 'reference', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['interval_accuracy_distribution', 'boundary_point_confusion_rate'],
    telemetrySummaryFields: ['cardResultStates', 'stepRevealCount'],
    misconceptionTags: ['region_shift_as_new_method', 'stronger_constraint_no_shrink'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'post_quiz_stack',
      regions: [
        { id: 'title', width: 'full', order: 1 },
        { id: 'question-stack', width: 'full', order: 2 },
        { id: 'submit-bar', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'keyword_hit_rate'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'keywordCoverage'],
    misconceptionTags: ['sign_change_not_counted', 'full_zero_row_without_auxiliary_equation', 'stronger_region_not_understood'],
    teacherControls: {
      releaseActivity: 'page_load_open',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'summary_infographic',
      regions: [
        { id: 'summary-table', width: 'full', order: 1 },
        { id: 'infographic', width: 'full', order: 2 },
        { id: 'exit-note', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-13',
  },
};

export const UNIT_3_2_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_2PageType>([
  'binary_choice',
  'quiz_group',
  'activity_cards',
]);

export const UNIT_3_2_LESSON_STEPS: UNIT_3_2StepDefinition[] = [
  { id: 'step-01', stage: 'B', title: '回到地图——从纯极点语言走向稳定边界', hint: '先把 3-2 放回模块 3 主线，明确本课处理高阶特征方程的稳定边界。', duration: '3 min', pageType: 'display' },
  { id: 'step-02', stage: 'B', title: '先看主对象——极点迁移图提出了哪三个问题', hint: '先暴露“只看图就够了”的误判，再把问题收回到系数规则。', duration: '4 min', pageType: 'binary_choice' },
  { id: 'step-03', stage: 'P1', title: '前测——不求根判稳、特殊情况与区域收紧', hint: '用三题前测把普通判稳、特殊情况与区域约束的起点误区先暴露出来。', duration: '6 min', pageType: 'quiz_group' },
  { id: 'step-04', stage: 'P2', title: '普通劳斯表——固定 k=4 时怎样从第一列读出稳定性', hint: '题面常显、步骤显影、双卡独立提交，建立“判稳不等于求根”的第一条规则。', duration: '8 min', pageType: 'activity_cards' },
  { id: 'step-05', stage: 'P2', title: '带参数劳斯表——稳定区间怎样从第一列条件链中写出', hint: '把第一列条件链推进到稳定区间，并显式防止漏掉 s^0 行条件。', duration: '10 min', pageType: 'activity_cards' },
  { id: 'step-06', stage: 'P2', title: '边界点回到复平面——k=-2、18、22 分别对应什么根结构', hint: '把参数点、根结构和极点迁移图放回同一页，避免只记边界数字。', duration: '7 min', pageType: 'activity_cards' },
  { id: 'step-07', stage: 'P2', title: '首位为 0——ε 连续化为什么只服务于符号判断', hint: '固定题面先行，再逐步显影 epsilon 连续化的判断链，不把 epsilon 当真实参数。', duration: '8 min', pageType: 'activity_cards' },
  { id: 'step-08', stage: 'P2', title: '全零行——辅助方程怎样把对称根结构重新写出来', hint: '显式区分全零行与首位为 0，保留规则卡、推导链和双作答卡。', duration: '8 min', pageType: 'activity_cards' },
  { id: 'step-09', stage: 'P2', title: '劳斯现象到时域——极点结构怎样改写响应形态', hint: '先表后图，再用双卡把极点结构翻译到时域响应。', duration: '6 min', pageType: 'activity_cards' },
  { id: 'step-10', stage: 'P2', title: '劳斯现象到频域——峰值抬高、理想共振与低频抬升如何区分', hint: '把频域观察固定在本课的辅助证据地位，不升级成新的主判据。', duration: '6 min', pageType: 'activity_cards' },
  { id: 'step-11', stage: 'P2', title: '变量平移——把 Re(s)<-0.5 转成普通劳斯判定', hint: '题面、平移链、区间对比和几何解释保持同页，不能压成一个区间输入框。', duration: '9 min', pageType: 'activity_cards' },
  { id: 'step-12', stage: 'P3', title: '后测——判稳、特殊情况与区域约束能否连成一条链', hint: '后测单独成页，检查学生是否真的把判稳、特殊情况与区域约束连成一条边界语言链。', duration: '6 min', pageType: 'quiz_group' },
  { id: 'step-13', stage: 'S', title: '收束——从稳定判定走向参数设计入口', hint: '只做收束与去向，不再把后测和总结混在同一页。', duration: '4 min', pageType: 'summary' },
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
  return false;
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
  'step-13': '/course-runtime/lessons/3-2/media/3-2-info.png',
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
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
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
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_3_2TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_3_2TeacherSession(input: UNIT_3_2TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
