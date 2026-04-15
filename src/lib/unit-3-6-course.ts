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
  | 'sequenced_reveal'
  | 'structured_response'
  | 'structured_compare'
  | 'decision_submit'
  | 'quiz_group+exit_reflection';

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
        { id: 'chain', width: 'half', order: 1 },
        { id: 'outputs', width: 'half', order: 2 },
        { id: 'rules', width: 'full', order: 3 },
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
      template: 'evidence_board',
      regions: [
        { id: 'object', width: 'full', order: 1 },
        { id: 'expressions', width: 'full', order: 2 },
        { id: 'tasks', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'categorize_and_confirm',
    teacherInsightWidgets: ['goal_bucket_distribution', 'misbucket_rate'],
    telemetrySummaryFields: ['bucketAssignment', 'attemptCount', 'timeOnStep'],
    misconceptionTags: ['misbucket_goal_entry'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'derivation_reveal_board',
      regions: [
        { id: 'derivation', width: 'full', order: 1 },
        { id: 'figure', width: 'half', order: 2 },
        { id: 'record', width: 'half', order: 3 },
      ],
    },
    interactionKind: 'workspace_builder',
    teacherInsightWidgets: ['overlay_accuracy', 'pure_gain_failure_tags'],
    telemetrySummaryFields: ['constraintOverlayState', 'recordSubmitted', 'attemptCount'],
    misconceptionTags: ['pure_gain_failure_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'parametric_sim_board',
      regions: [
        { id: 'evidence', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_workspace',
    teacherInsightWidgets: ['final_parameter_distribution', 'validation_pass_rate'],
    telemetrySummaryFields: ['parameterTrail', 'validationState', 'recordSubmitted'],
    misconceptionTags: ['skip_design_point', 'pd_only_memorize_answer'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'structure_evidence_board',
      regions: [
        { id: 'structure', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'compare', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'parametric_sim_board',
      regions: [
        { id: 'evidence', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_workspace',
    teacherInsightWidgets: ['adjustment_order_distribution', 'rate_validation_pass_rate'],
    telemetrySummaryFields: ['parameterTrail', 'adjustmentOrder', 'recordSubmitted'],
    misconceptionTags: ['guess_zero_first_in_rate_feedback'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'derivation_reveal_board',
      regions: [
        { id: 'goal', width: 'full', order: 1 },
        { id: 'evidence', width: 'full', order: 2 },
        { id: 'derivation', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_response',
    teacherInsightWidgets: ['keyword_coverage_distribution'],
    telemetrySummaryFields: ['responseSubmitted', 'keywordCoverage'],
    misconceptionTags: ['skip_gain_only_check'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'frequency_design_workspace',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_workspace',
    teacherInsightWidgets: ['lead_parameter_distribution', 'margin_recovery_rate'],
    telemetrySummaryFields: ['parameterTrail', 'marginState', 'recordSubmitted'],
    misconceptionTags: ['stop_after_frequency_pass'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'compare_reveal_board',
      regions: [
        { id: 'goal', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'compare', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_response',
    teacherInsightWidgets: ['reason_tag_distribution', 'empty_reason_rate'],
    telemetrySummaryFields: ['reasonTags', 'completedState'],
    misconceptionTags: ['no_same_goal_compare_intent'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'comparison_lab_board',
      regions: [
        { id: 'workspace', width: 'full', order: 1 },
        { id: 'compare', width: 'full', order: 2 },
        { id: 'submit', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_compare',
    teacherInsightWidgets: ['difference_tag_distribution', 'empty_comparison_rate'],
    telemetrySummaryFields: ['comparisonSubmitted', 'differenceTags', 'validationState'],
    misconceptionTags: ['both_pass_then_stop'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-13',
  },
  'step-14': {
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
    misconceptionTags: ['boundary_skip_then_choose_structure'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'summary_assessment_board',
      regions: [
        { id: 'quiz', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'close', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group+exit_reflection',
    teacherInsightWidgets: ['posttest_distribution', 'reflection_keyword_cloud'],
    telemetrySummaryFields: ['posttestAccuracy', 'reflectionSubmitted'],
    misconceptionTags: ['still_choose_tool_before_goal'],
    previewDemoPath: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-15',
  },
};

export const UNIT_3_6_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_6PageType>([
  'single_choice',
  'quiz_group',
  'categorize_and_confirm',
  'workspace_builder',
  'parameter_workspace',
  'sequenced_reveal',
  'structured_response',
  'structured_compare',
  'decision_submit',
  'quiz_group+exit_reflection',
]);

export const UNIT_3_6_LESSON_STEPS: UNIT_3_6StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '封面导入：目标必须先于工具',
    hint: '先判断入口原则，再进入后续设计链。',
    duration: '2 min',
    pageType: 'single_choice',
  },
  {
    id: 'step-02',
    stage: 'O',
    title: '回到地图：从 3-5 的机理走向 3-6 的设计',
    hint: '只阅读，不提交。',
    duration: '2 min',
    pageType: 'display',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '五任务设计链与提交物总览',
    hint: '确认五任务、固定交付物与实践规则。',
    duration: '2 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测：三类目标分别从哪里进入',
    hint: '先独立完成三题前测与一句理由，再进入错因对照。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '任务书：统一对象、三类装置与五任务入口',
    hint: '先读对象与三类装置，再完成入口分类。',
    duration: '5 min',
    pageType: 'categorize_and_confirm',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '时域指标如何变成设计可行域',
    hint: '先点击显影翻译公式，再拖动增益观察纯增益失败原因。',
    duration: '8 min',
    pageType: 'workspace_builder',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '任务 A：PD 时域设计',
    hint: '按设计点、相角条件、模值条件完成时域 PD 设计。',
    duration: '12 min',
    pageType: 'parameter_workspace',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '任务 B 的证据板：测速反馈为何不是“换位置的 PD”',
    hint: '先读原生结构图、等效方程与对照表，再进入测速反馈设计。',
    duration: '5 min',
    pageType: 'display',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '任务 B：测速反馈时域设计',
    hint: '先定等效极点，再调 Kt 与 K 并完成验收。',
    duration: '10 min',
    pageType: 'parameter_workspace',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '推导显影 B：频域目标如何进入超前设计',
    hint: '先看只调增益为何失败，再写出超前四步链的理由。',
    duration: '6 min',
    pageType: 'structured_response',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '任务 C：超前频域设计',
    hint: '完成超前设计，并记录为何频域通过后仍要回查时域。',
    duration: '10 min',
    pageType: 'parameter_workspace',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '推导显影 C：为何同一频域指标下还要再做一次 PD',
    hint: '勾选同指标比较的理由标签，压实比较意图。',
    duration: '5 min',
    pageType: 'structured_response',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '任务 D：同指标下的 PD 频域设计与并排比较',
    hint: '完成 PD 频域设计，并填写与超前方案的结构化比较表。',
    duration: '8 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '任务 E：右半平面零点下的边界与结构选择',
    hint: '先判断原目标是否仍可行，再提交结构选择与理由。',
    duration: '8 min',
    pageType: 'decision_submit',
  },
  {
    id: 'step-15',
    stage: 'P3',
    title: '后测与收束：从指标走到结构选择',
    hint: '完成三题后测、三句结论阅读与一句反思。',
    duration: '5 min',
    pageType: 'quiz_group+exit_reflection',
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
  return false;
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
  'step-02': '/course-runtime/lessons/3-6/media/3-6-design-map.png',
  'step-07': '/course-runtime/lessons/3-6/media/3-6-pd-design.png',
  'step-09': '/course-runtime/lessons/3-6/media/3-6-rate-feedback-design.png',
  'step-11': '/course-runtime/lessons/3-6/media/3-6-lead-design.png',
  'step-13': '/course-runtime/lessons/3-6/media/3-6-pd-frequency-design.png',
  'step-14': '/course-runtime/lessons/3-6/media/3-6-rhp-boundary.png',
  'step-15': '/course-runtime/lessons/3-6/media/3-6-info.png',
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
