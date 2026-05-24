import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_1StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_3_1PageType =
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'quiz_group'
  | 'reason_check'
  | 'triple_match'
  | 'activity_cards'
  | 'worked_example_workspace'
  | 'curve_compare_panel'
  | 'ai_compare_workspace';

export interface UNIT_3_1PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_1PageContract {
  layout: {
    template: string;
    regions: UNIT_3_1PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_3_1PageType, 'display' | 'summary'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export type Unit31WorkspaceKind = 'pole-family' | 'worked-example-reveal' | 'curve-compare' | 'none';

export interface UNIT_3_1StepDefinition {
  id: string;
  stage: UNIT_3_1StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_1PageType;
  workspaceKind?: Unit31WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_3_1StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_1StudentCourseState {
  kind: 'unit31_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_1StepResponse>;
}

export interface UNIT_3_1TeacherCourseSyncState {
  kind: 'teacher_sync_unit31';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_3_1TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_1TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_1TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_1_ROUTE_SEGMENT = 'unit-3-1-pure-pole-stability-and-dynamics';
export const UNIT_3_1_PRESET_KEY = 'unit-3-1-pure-pole-stability-and-dynamics-v1';
export const UNIT_3_1_RESOURCE_KEY = 'unit-3-1-pure-pole-stability-and-dynamics';
export const UNIT_3_1_LESSON_KEY = UNIT_3_1_PRESET_KEY;
export const UNIT_3_1_STUDENT_ITEM_ID = 'student:unit31:state';
export const UNIT_3_1_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_1_STUDENT_STATE_KEY = 'course';
export const UNIT_3_1_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_1_COURSE_TITLE = '3-1：纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解';
export const UNIT_3_1_COURSE_SUBTITLE = 'Pure Poles, Modes & Approximation';
export const UNIT_3_1_COURSE_DESCRIPTION =
  '围绕稳定底线、极点到模态、主导极点近似、Bode 证据与卷积收束，建立模块 3 的第一堂结构机理精品互动课。';

export const UNIT_3_1_STAGE_LABEL: Record<UNIT_3_1StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_3_1_STAGE_MAP: Record<UNIT_3_1StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_3_1_PAGE_CONTRACTS: Record<string, UNIT_3_1PageContract> = {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'triple_model_conflict',
      regions: [
        { id: 'formula-strip', width: 'full', order: 1 },
        { id: 'root-locus', width: 'half', order: 2 },
        { id: 'response', width: 'half', order: 3 },
        { id: 'metrics', width: 'full', order: 4 },
        { id: 'interaction', width: 'full', order: 5 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'misconception_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'goal_boundary_slide',
      regions: [
        { id: 'goals', width: 'half', order: 1 },
        { id: 'chain', width: 'half', order: 2 },
        { id: 'boundary', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'question_stack',
      regions: [
        { id: 'prompt', width: 'full', order: 1 },
        { id: 'questions', width: 'full', order: 2 },
        { id: 'notes', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['stable_not_equal_good', 'same_dominant_not_same_response', 'left_more_not_absolute'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'formula_plane_reason',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['prediction_distribution', 'reason_tag_cloud'],
    telemetrySummaryFields: ['predictionSubmitted', 'reasonLength', 'teacherRevealSeen'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'formula_story_board',
      regions: [
        { id: 'decomposition', width: 'full', order: 1 },
        { id: 'response', width: 'full', order: 2 },
        { id: 'meaning', width: 'full', order: 3 },
        { id: 'interaction', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['common_mismatch_pairs', 'completion_rate'],
    telemetrySummaryFields: ['matchAttempted', 'matchCorrected', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'classification_board',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'compare', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['option_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['complex_pair_means_two_outputs', 'repeated_root_can_be_ignored'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'worked_example_reveal_lab',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'formulas', width: 'full', order: 2 },
        { id: 'reveal', width: 'full', order: 3 },
        { id: 'activity', width: 'full', order: 4 },
        { id: 'exploration', width: 'full', order: 5 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['reveal_completion_rate', 'answer_quality_tags'],
    telemetrySummaryFields: ['revealProgress', 'attemptCount', 'resultState'],
    misconceptionTags: ['fast_mode_effect_ignored', 'same_dominant_equals_same_response'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'evidence_table_plus_cards',
      regions: [
        { id: 'rules', width: 'full', order: 1 },
        { id: 'risks', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['reason_tag_cloud', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState'],
    misconceptionTags: ['rule_as_theorem', 'skip_visual_evidence'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'transition_question_board',
      regions: [
        { id: 'question', width: 'full', order: 1 },
        { id: 'task', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution'],
    telemetrySummaryFields: ['selectedOption', 'resultState'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'curve_compare_lab',
      regions: [
        { id: 'formulas', width: 'full', order: 1 },
        { id: 'root-locus', width: 'half', order: 2 },
        { id: 'bode', width: 'half', order: 3 },
        { id: 'metrics', width: 'full', order: 4 },
        { id: 'activity', width: 'full', order: 5 },
      ],
    },
    interactionKind: 'curve_compare_panel',
    teacherInsightWidgets: ['panel_usage_heatmap', 'top_misconceptions'],
    telemetrySummaryFields: ['panelExplored', 'markerToggled', 'resultState'],
    misconceptionTags: ['break_frequency_outside_bandwidth_ignored', 'frequency_check_skipped'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'double_domain_judgment_board',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'activity', width: 'full', order: 2 },
        { id: 'ai', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'ai_compare_workspace',
    teacherInsightWidgets: ['ai_compare_usage', 'reason_tag_cloud'],
    telemetrySummaryFields: ['attemptCount', 'aiCompareOpened', 'resultState'],
    misconceptionTags: ['ai_before_self_judgment', 'single_domain_reasoning'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'convolution_modal_board',
      regions: [
        { id: 'convolution', width: 'full', order: 1 },
        { id: 'figure-06', width: 'full', order: 2 },
        { id: 'example', width: 'full', order: 3 },
        { id: 'figure-07', width: 'full', order: 4 },
        { id: 'activity', width: 'full', order: 5 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['option_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState'],
    misconceptionTags: ['negative_residue_means_unstable', 'input_changes_poles'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'posttest_board',
      regions: [
        { id: 'header', width: 'full', order: 1 },
        { id: 'questions', width: 'full', order: 2 },
        { id: 'notes', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'reason_tag_cloud'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['rhp_can_still_approximate', 'bandwidth_intrusion_ignored', 'step_from_nothing'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'summary_exit_board',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'infographic', width: 'full', order: 2 },
        { id: 'next', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-15',
  },
};

export const UNIT_3_1_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_1PageType>([
  'binary_choice',
  'quiz_group',
  'reason_check',
  'triple_match',
  'activity_cards',
  'worked_example_workspace',
  'curve_compare_panel',
  'ai_compare_workspace',
]);

export const UNIT_3_1_LESSON_STEPS: UNIT_3_1StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到路径：从模块 2 的低阶直觉走向模块 3 的极点语言',
    hint: '先标定 3-1 在模块 3 中的位置，明确本课是从低阶直觉走向极点语言的入口。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入：同主导极点，为什么响应仍会分家',
    hint: '先用三模型冲突压实主问题，再进入主导模态和附加模态的比较。',
    duration: '5 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '学习目标与课堂边界：本课负责什么，不负责什么',
    hint: '把稳定底线、模态语言、时域筛选和频域复核串成一条本课主线。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测：稳定、主导极点与“可忽略”直觉判断',
    hint: '用三道前测题先暴露起点误解，建立后续纠偏需要。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '稳定底线：先回答“能不能谈近似”',
    hint: '先判断系统能否收敛，后面的近似和证据链才有前提。',
    duration: '6 min',
    pageType: 'reason_check',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '从极点到模态：极点为什么会直接写进响应',
    hint: '把部分分式、脉冲响应和模态含义连成一条可解释的因果链。',
    duration: '7 min',
    pageType: 'triple_match',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '三类极点与重根：响应形态为什么不止一种',
    hint: '区分极点类型与重根效应，避免把不同形态混成一句经验话。',
    duration: '6 min',
    pageType: 'activity_cards',
    workspaceKind: 'pole-family',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '最小例题：三模型时域对照与主导模态近似',
    hint: '完整比较三模型的时域证据，并用逐步显影讲清主导模态近似为何有时可靠。',
    duration: '9 min',
    pageType: 'worked_example_workspace',
    workspaceKind: 'worked-example-reveal',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '时域筛选：更靠左为什么只是第一轮判断',
    hint: '把经验句退回到筛选层，补上权重、重根与可视证据。',
    duration: '5 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '转向频域：时域相近为什么还不够',
    hint: '从“像不像”推进到“为什么像/为什么不像”，为 Bode 对照搭桥。',
    duration: '4 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: 'Bode 对照：附加极点何时侵入主要带宽',
    hint: '区分固有频率、转折频率和主要带宽，并把它们拉回近似判断。',
    duration: '8 min',
    pageType: 'curve_compare_panel',
    workspaceKind: 'curve-compare',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '双域判断表：先自判，再问 AI，再回到图上核验',
    hint: '坚持先自判再问 AI，让 AI 只核对证据链，而不是代替判断。',
    duration: '7 min',
    pageType: 'ai_compare_workspace',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '卷积与模态叠加：输入激发模态，但不改写极点结构',
    hint: '把卷积放回“输入如何激发已有模态”的解释框架，而非改变系统结构。',
    duration: '6 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-14',
    stage: 'P3',
    title: '后测：会不会发散、能不能近似、为什么能解释',
    hint: '综合检查稳定底线、主导极点近似和卷积/模态语言是否真的连成一条链。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-15',
    stage: 'S',
    title: '总结与去向：先守底线，再谈模态，再谈后续方法',
    hint: '把 3-1 的判断链收束为出口句，并把视角推进到 3-2 的稳定边界可视化。',
    duration: '4 min',
    pageType: 'summary',
  },
] as const;

export function getUNIT_3_1Step(stepId: string) {
  return UNIT_3_1_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_1_LESSON_STEPS[0];
}

export function getUNIT_3_1PageContract(stepId: string) {
  return UNIT_3_1_PAGE_CONTRACTS[stepId] ?? UNIT_3_1_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_1InteractivePageType(pageType: UNIT_3_1PageType) {
  return UNIT_3_1_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_1AiPageType(pageType: UNIT_3_1PageType) {
  return pageType === 'ai_compare_workspace';
}

export function createEmptyUNIT_3_1StudentState(studentName: string): UNIT_3_1StudentCourseState {
  return {
    kind: 'unit31_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_1_PREMIUM_LESSON_CARD = {
  id: 'unit-3-1-pure-pole-stability-and-dynamics',
  title: UNIT_3_1_COURSE_TITLE,
  description: '精品互动课：从稳定底线、模态与双域证据建立高阶系统低阶近似的第一轮机理语言。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_1_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_1_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-05': '/course-runtime/lessons/3-1/media/3-1-pp-01-stability-half-plane.svg',
  'step-07': '/course-runtime/lessons/3-1/media/3-1-pp-02-poles-and-modes.svg',
  'step-15': '/course-runtime/lessons/3-1/media/3-1-info.png',
};

export function getUNIT_3_1MediaSrc(stepId: string) {
  return UNIT_3_1_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_1StudentState(value: unknown): value is UNIT_3_1StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_1StudentCourseState>;
  return data.kind === 'unit31_student_state' && data.version === 1;
}

export function isUNIT_3_1TeacherSyncState(value: unknown): value is UNIT_3_1TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_1TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit31' && typeof data.activeStepId === 'string';
}

export const UNIT_3_1_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_1StudentCourseState,
  UNIT_3_1TeacherCourseSyncState,
  UNIT_3_1TeacherSyncInput
> = {
  lessonKey: UNIT_3_1_LESSON_KEY,
  studentItemId: UNIT_3_1_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_1_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_1_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_1_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_1StudentState,
  isStudentState: isUNIT_3_1StudentState,
  isTeacherSyncState: isUNIT_3_1TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit31',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_1TeacherSync(input: UNIT_3_1TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_1TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_3_1TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_1TeacherSession(input: UNIT_3_1TeacherFinalizeInput) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_3_1_LESSON_STEPS,
  });
}
