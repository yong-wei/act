import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_6StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_3_6PageType =
  | 'display'
  | 'single_choice'
  | 'quiz_group'
  | 'categorize_and_confirm'
  | 'workspace_builder'
  | 'parameter_workspace'
  | 'structured_compare'
  | 'decision_submit'
  | 'exit_reflection';

export interface UNIT_3_6PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_6PageContract {
  layout: {
    template: string;
    regions: UNIT_3_6PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_3_6PageType, 'display'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export interface UNIT_3_6StepDefinition {
  id: string;
  stage: UNIT_3_6StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_6PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_3_6StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_6StudentCourseState {
  kind: 'unit36_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_6StepResponse>;
}

export interface UNIT_3_6TeacherCourseSyncState {
  kind: 'teacher_sync_unit36';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_3_6TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_6TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_6TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_6_ROUTE_SEGMENT = 'unit-3-6-zero-design-workshop';
export const UNIT_3_6_PRESET_KEY = 'unit-3-6-zero-design-workshop-v1';
export const UNIT_3_6_RESOURCE_KEY = 'unit-3-6-zero-design-workshop';
export const UNIT_3_6_LESSON_KEY = UNIT_3_6_PRESET_KEY;
export const UNIT_3_6_STUDENT_ITEM_ID = 'student:unit36:state';
export const UNIT_3_6_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_6_STUDENT_STATE_KEY = 'course';
export const UNIT_3_6_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_6_COURSE_TITLE = '3-6：零点作用与动态改善实验——从性能目标到校正设计';
export const UNIT_3_6_COURSE_SUBTITLE = 'Zero Design Workshop';
export const UNIT_3_6_COURSE_DESCRIPTION =
  '围绕“目标分类 -> 指标翻译 -> 时域 PD / 测速反馈设计 -> 频域超前 / PD 对照 -> 非最小相边界选择”这条链，把零点相关结构正式推进到目标驱动设计。';

export const UNIT_3_6_STAGE_LABEL: Record<UNIT_3_6StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_3_6_STAGE_MAP: Record<UNIT_3_6StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_3_6_PAGE_CONTRACTS: Record<string, UNIT_3_6PageContract> = {
  'step-01': {
    layout: {
      template: 'binary_choice_illustration',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'question', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'single_choice',
    teacherInsightWidgets: ['option_distribution', 'goal_entry_confusion_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['tool_before_goal'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-01',
  },
  'step-02': {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'goal_chain_slide',
      regions: [
        { id: 'goals', width: 'full', order: 1 },
        { id: 'chain', width: 'full', order: 2 },
        { id: 'outputs', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'question_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'record', width: 'full', order: 2 },
        { id: 'ai-gate', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket', 'reasonTextSubmitted'],
    misconceptionTags: [
      'time_domain_goal_entry_confusion',
      'frequency_domain_goal_entry_confusion',
      'nmp_boundary_confusion',
    ],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'table_plus_prompt',
      regions: [
        { id: 'object', width: 'full', order: 1 },
        { id: 'targets', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'categorize_and_confirm',
    teacherInsightWidgets: ['goal_bucket_distribution', 'misbucket_rate'],
    telemetrySummaryFields: ['bucketAssignment', 'attemptCount', 'timeOnStep'],
    misconceptionTags: ['goal_misbucket'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'constraint_translation_workspace',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'workspace_builder',
    teacherInsightWidgets: ['overlay_accuracy', 'pure_gain_failure_tags'],
    telemetrySummaryFields: ['constraintOverlayState', 'recordSubmitted', 'attemptCount'],
    misconceptionTags: ['constraint_translation_error', 'pure_gain_can_pass'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'tri_panel_design_workspace',
      regions: [
        { id: 'task-chain', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_workspace',
    teacherInsightWidgets: ['final_parameter_distribution', 'validation_pass_rate'],
    telemetrySummaryFields: ['parameterTrail', 'validationState', 'recordSubmitted'],
    misconceptionTags: ['skip_design_point', 'memorize_pd_answer_only'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'structure_formula_workspace',
      regions: [
        { id: 'structure', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_workspace',
    teacherInsightWidgets: ['adjustment_order_distribution', 'pd_rate_confusion_rate'],
    telemetrySummaryFields: ['parameterTrail', 'adjustmentOrder', 'recordSubmitted'],
    misconceptionTags: ['pd_equals_rate_feedback'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'bode_design_workspace',
      regions: [
        { id: 'goal', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_workspace',
    teacherInsightWidgets: ['lead_parameter_distribution', 'margin_recovery_rate'],
    telemetrySummaryFields: ['parameterTrail', 'marginState', 'recordSubmitted'],
    misconceptionTags: ['gain_only_is_enough', 'skip_lead_order'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'dual_solution_compare_workspace',
      regions: [
        { id: 'goal', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'compare', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_compare',
    teacherInsightWidgets: ['difference_tag_distribution', 'empty_comparison_rate'],
    telemetrySummaryFields: ['comparisonSubmitted', 'differenceTags', 'validationState'],
    misconceptionTags: ['frequency_pass_equals_all_pass', 'empty_compare'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'boundary_decision_workspace',
      regions: [
        { id: 'boundary-object', width: 'full', order: 1 },
        { id: 'risk', width: 'full', order: 2 },
        { id: 'decision', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'decision_submit',
    teacherInsightWidgets: ['structure_choice_distribution', 'boundary_skip_rate'],
    telemetrySummaryFields: ['feasibilityChoice', 'structureChoice', 'reasonSubmitted'],
    misconceptionTags: ['skip_goal_review', 'nmp_still_push_bandwidth'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'post_quiz_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'explain', width: 'full', order: 2 },
        { id: 'ai-compare', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['posttest_distribution', 'remaining_confusion_tags'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'reasonTextSubmitted', 'aiCompareOpened'],
    misconceptionTags: [
      'shared_goal_purpose_confusion',
      'rate_feedback_entry_confusion',
      'nmp_goal_review_confusion',
    ],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'summary_infographic',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'exit', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'exit_reflection',
    teacherInsightWidgets: ['reflection_word_cloud', 'completion_rate'],
    telemetrySummaryFields: ['reflectionSubmitted', 'reflectionLength'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-13',
  },
};

export const UNIT_3_6_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_6PageType>([
  'single_choice',
  'quiz_group',
  'categorize_and_confirm',
  'workspace_builder',
  'parameter_workspace',
  'structured_compare',
  'decision_submit',
  'exit_reflection',
]);

export const UNIT_3_6_LESSON_STEPS: UNIT_3_6StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '封面导入：为什么今天必须先定目标',
    hint: '先回答“入口应该先看什么”，教师可稍后揭示答案。',
    duration: '4 min',
    pageType: 'single_choice',
  },
  {
    id: 'step-02',
    stage: 'O',
    title: '回到地图：从零点机理切到校正设计',
    hint: '只阅读，不提交。',
    duration: '2 min',
    pageType: 'display',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '本节目标与五任务设计链',
    hint: '确认本课三项目标、五任务链与固定交付物。',
    duration: '2 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测：你会怎样从指标进入设计',
    hint: '完成三题前测和一句理由，提交后再打开 AI 对照。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '任务书：固定对象、两类目标与交付记录',
    hint: '把时域 / 频域 / 边界问题拖入正确入口栏。',
    duration: '6 min',
    pageType: 'categorize_and_confirm',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '工作区 A：把时域指标翻译成设计可行域',
    hint: '填写时域指标翻译结果，并记录纯增益为什么不能直接达标。',
    duration: '8 min',
    pageType: 'workspace_builder',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '工作区 B：PD 时域设计',
    hint: '记录设计点、参数链与验收结果。',
    duration: '12 min',
    pageType: 'parameter_workspace',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '工作区 C：测速反馈时域设计',
    hint: '先定等效极点，再求 Kt 和 K。',
    duration: '10 min',
    pageType: 'parameter_workspace',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '工作区 D：超前频域设计',
    hint: '先补角，再布置截止频率，最后回查时域代价。',
    duration: '10 min',
    pageType: 'parameter_workspace',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '工作区 E：同一频域指标下的 PD 设计',
    hint: '在相同频域目标下比较 PD 与超前的差异标签。',
    duration: '8 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '工作区 F：非最小相边界与结构选择',
    hint: '先重审目标，再提交结构选择与理由。',
    duration: '6 min',
    pageType: 'decision_submit',
  },
  {
    id: 'step-12',
    stage: 'P3',
    title: '后测：设计链和边界是否分清',
    hint: '完成后测与一句解释，提交后可查看 AI 对照。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-13',
    stage: 'S',
    title: '收束：从指标走到结构选择',
    hint: '写一句你要带走的设计判断。',
    duration: '4 min',
    pageType: 'exit_reflection',
  },
] as const;

export function getUNIT_3_6Step(stepId: string) {
  return UNIT_3_6_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_6_LESSON_STEPS[0];
}

export function getUNIT_3_6PageContract(stepId: string) {
  return UNIT_3_6_PAGE_CONTRACTS[stepId] ?? UNIT_3_6_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_6InteractivePageType(pageType: UNIT_3_6PageType) {
  return UNIT_3_6_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_6AiPageType(_pageType: UNIT_3_6PageType) {
  return true;
}

export function createEmptyUNIT_3_6StudentState(studentName: string): UNIT_3_6StudentCourseState {
  return {
    kind: 'unit36_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_6_PREMIUM_LESSON_CARD = {
  id: 'unit-3-6-zero-design-workshop',
  title: UNIT_3_6_COURSE_TITLE,
  description: '精品互动课：目标分类、时域 / 频域校正设计与非最小相边界选择。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_6_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_6_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/3-6/media/3-6-cover-comic.png',
  'step-05': '/course-runtime/lessons/3-6/media/3-6-design-map.png',
  'step-07': '/course-runtime/lessons/3-6/media/3-6-pd-design.png',
  'step-08': '/course-runtime/lessons/3-6/media/3-6-rate-feedback-design.png',
  'step-09': '/course-runtime/lessons/3-6/media/3-6-lead-design.png',
  'step-10': '/course-runtime/lessons/3-6/media/3-6-pd-frequency-design.png',
  'step-11': '/course-runtime/lessons/3-6/media/3-6-rhp-boundary.png',
  'step-13': '/course-runtime/lessons/3-6/media/3-6-info.png',
};

export function getUNIT_3_6MediaSrc(stepId: string) {
  return UNIT_3_6_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_6StudentState(value: unknown): value is UNIT_3_6StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_6StudentCourseState>;
  return data.kind === 'unit36_student_state' && data.version === 1;
}

export function isUNIT_3_6TeacherSyncState(value: unknown): value is UNIT_3_6TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_6TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit36' && typeof data.activeStepId === 'string';
}

export const UNIT_3_6_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_6StudentCourseState,
  UNIT_3_6TeacherCourseSyncState,
  UNIT_3_6TeacherSyncInput
> = {
  lessonKey: UNIT_3_6_LESSON_KEY,
  studentItemId: UNIT_3_6_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_6_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_6_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_6_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_6StudentState,
  isStudentState: isUNIT_3_6StudentState,
  isTeacherSyncState: isUNIT_3_6TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit36',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_6TeacherSync(input: UNIT_3_6TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_6TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_3_6TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_6TeacherSession(input: UNIT_3_6TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
