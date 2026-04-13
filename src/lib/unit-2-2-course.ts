import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_2_2StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_2_2PageType =
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'quiz_group'
  | 'short_response'
  | 'parameter_slider'
  | 'triple_match'
  | 'tab_switch'
  | 'metric_overlay'
  | 'reason_check'
  | 'formula_pair_check'
  | 'parameter_workspace'
  | 'worked_example_workspace'
  | 'ai_compare_workspace'
  | 'mapping_highlight';

export interface UNIT_2_2PageRegionContract {
  id: string;
  width: 'full' | '1/2';
  order: number;
}

export interface UNIT_2_2PageContract {
  layout: {
    template: string;
    regions: UNIT_2_2PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_2_2PageType, 'display' | 'summary'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}
export type Unit22WorkspaceKind =
  | 'time-constant'
  | 'second-order-parameter-map'
  | 'response-family'
  | 'metric-overview'
  | 'settling-band'
  | 'worked-example'
  | 'pole-region'
  | 'none';

export interface UNIT_2_2StepDefinition {
  id: string;
  stage: UNIT_2_2StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_2_2PageType;
  workspaceKind?: Unit22WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_2_2StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_2_2StudentCourseState {
  kind: 'unit22_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_2_2StepResponse>;
}

export interface UNIT_2_2TeacherCourseSyncState {
  kind: 'teacher_sync_unit22';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_2_2TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_2_2TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_2_2TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_2_2_ROUTE_SEGMENT = 'unit-2-2-time-domain-response';
export const UNIT_2_2_PRESET_KEY = 'unit-2-2-time-domain-response-v1';
export const UNIT_2_2_RESOURCE_KEY = 'unit-2-2-time-domain-response';
export const UNIT_2_2_LESSON_KEY = UNIT_2_2_PRESET_KEY;
export const UNIT_2_2_STUDENT_ITEM_ID = 'student:unit22:state';
export const UNIT_2_2_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_2_2_STUDENT_STATE_KEY = 'course';
export const UNIT_2_2_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_2_2_COURSE_TITLE = '2-2：时域响应基础——从响应曲线到动态性能指标';
export const UNIT_2_2_COURSE_SUBTITLE = 'Time-Domain Response';
export const UNIT_2_2_COURSE_DESCRIPTION =
  '围绕单位阶跃响应、一阶与二阶系统标准型、上升时间、峰值时间、超调量与调节时间，建立从闭环传递函数到动态性能语言的第一套分析框架。';

export const UNIT_2_2_STAGE_LABEL: Record<UNIT_2_2StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_2_2_STAGE_MAP: Record<UNIT_2_2StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_2_2_PAGE_CONTRACTS: Record<string, UNIT_2_2PageContract> = {
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
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'dual_response_vote',
      regions: [
        { id: 'chart', width: 'full', order: 1 },
        { id: 'questions', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'reveal_correction_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen', 'timeOnStep'],
    misconceptionTags: ['stability_equals_good_performance'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'goal_chain_slide',
      regions: [
        { id: 'goals', width: 'full', order: 1 },
        { id: 'chain', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-03',
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
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket', 'teacherRevealSeen'],
    misconceptionTags: ['time_constant_direction_confusion', 'overshoot_metric_confusion', 'stability_vs_no_overshoot'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'table_plus_formula_plus_short_response',
      regions: [
        { id: 'formula-strip', width: 'full', order: 1 },
        { id: 'contrast-table', width: 'full', order: 2 },
        { id: 'reflection', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'short_response',
    teacherInsightWidgets: ['response_word_cloud', 'common_reason_tags'],
    telemetrySummaryFields: ['responseSubmitted', 'responseLength', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'courseware_top_slider_bottom',
      regions: [
        { id: 'formula-card', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_slider',
    teacherInsightWidgets: ['time_constant_distribution', 'prediction_summary'],
    telemetrySummaryFields: ['sliderChanged', 'anchorViewed', 'predictionSubmitted'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'parameter_role_match',
      regions: [
        { id: 'formula-card', width: 'full', order: 1 },
        { id: 'role-table', width: 'full', order: 2 },
        { id: 'match-zone', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['common_mismatch_pairs', 'completion_rate'],
    telemetrySummaryFields: ['matchAttempted', 'matchCorrected', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'family_compare_switcher',
      regions: [
        { id: 'family-summary', width: 'full', order: 1 },
        { id: 'shared-chart', width: 'full', order: 2 },
        { id: 'switcher', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'tab_switch',
    teacherInsightWidgets: ['family_focus_distribution'],
    telemetrySummaryFields: ['familySwitched', 'compareViewToggled'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'metric_overview_overlay',
      regions: [
        { id: 'summary-table', width: 'full', order: 1 },
        { id: 'overlay-chart', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'metric_overlay',
    teacherInsightWidgets: ['metric_attention_distribution'],
    telemetrySummaryFields: ['metricToggled', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'formula_explain_checklist',
      regions: [
        { id: 'definition-card', width: 'full', order: 1 },
        { id: 'formula-card', width: 'full', order: 2 },
        { id: 'reason-check', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['prediction_distribution', 'reason_tag_cloud'],
    telemetrySummaryFields: ['predictionSubmitted', 'reasonLength', 'teacherRevealSeen'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'dual_formula_reason_check',
      regions: [
        { id: 'formula-pair', width: 'full', order: 1 },
        { id: 'key-claim', width: 'full', order: 2 },
        { id: 'check-zone', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'formula_pair_check',
    teacherInsightWidgets: ['formula_confusion_rate'],
    telemetrySummaryFields: ['formulaMatched', 'claimViewed'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'error_band_workspace',
      regions: [
        { id: 'definition-card', width: 'full', order: 1 },
        { id: 'formula-card', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
        { id: 'summary', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'parameter_workspace',
    teacherInsightWidgets: ['band_selection_distribution', 'common_reason_tags'],
    telemetrySummaryFields: ['bandChanged', 'parameterChanged', 'teacherRevealAdvanced'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'worked_example_workspace',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'method', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
        { id: 'chart', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['wrong_step_distribution', 'common_error_fields'],
    telemetrySummaryFields: ['methodCompleted', 'intermediateValueEdited', 'resultChecked'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'compare_then_ai',
      regions: [
        { id: 'method', width: 'full', order: 1 },
        { id: 'constraints', width: 'full', order: 2 },
        { id: 'ai-panel', width: 'full', order: 3 },
        { id: 'pole-region', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'ai_compare_workspace',
    teacherInsightWidgets: ['draft_completion_rate', 'ai_usage_rate', 'common_logic_gaps'],
    telemetrySummaryFields: ['draftSubmitted', 'aiOpened', 'aiRoundCompleted', 'revisionConfirmed'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'mapping_table_with_plane',
      regions: [
        { id: 'method-links', width: 'full', order: 1 },
        { id: 'mapping-table', width: 'full', order: 2 },
        { id: 'highlight-plane', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'mapping_highlight',
    teacherInsightWidgets: ['mapping_focus_distribution'],
    telemetrySummaryFields: ['mappingRowSelected', 'hoverFormula'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-15',
  },
  'step-16': {
    layout: {
      template: 'post_quiz_stack',
      regions: [
        { id: 'quiz-stack', width: 'full', order: 1 },
        { id: 'submit-bar', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'explanation_tag_summary'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'teacherRevealSeen'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-16',
  },
  'step-17': {
    layout: {
      template: 'summary_infographic',
      regions: [
        { id: 'takeaways', width: 'full', order: 1 },
        { id: 'cheatsheet', width: 'full', order: 2 },
        { id: 'next-links', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['quick_reference_open_rate'],
    telemetrySummaryFields: ['viewed', 'quickReferenceOpened'],
    previewDemoPath: '/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-17',
  },
};

export const UNIT_2_2_INTERACTIVE_PAGE_TYPES = new Set<UNIT_2_2PageType>([
  'binary_choice',
  'quiz_group',
  'short_response',
  'parameter_slider',
  'triple_match',
  'tab_switch',
  'metric_overlay',
  'reason_check',
  'formula_pair_check',
  'parameter_workspace',
  'worked_example_workspace',
  'ai_compare_workspace',
  'mapping_highlight',
]);

export const UNIT_2_2_LESSON_STEPS: UNIT_2_2StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图——从传函走向响应曲线',
    hint: '前两课解决系统怎么写出来，这一课开始解决系统会怎样表现。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入——稳定并不等于表现一样',
    hint: '比较两条都稳定的曲线，先建立“动态过程也要评价”的意识。',
    duration: '4 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '学习目标——本课要建立哪套语言',
    hint: '明确会看、会算、会连这三类目标。',
    duration: '2 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测——快、稳、冲分别看什么',
    hint: '用三道速测题暴露“稳定、快速、超调”之间的混淆。',
    duration: '5 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '时域分析对象与典型输入',
    hint: '区分脉冲、阶跃、斜坡，但把单位阶跃确立为本课默认场景。',
    duration: '5 min',
    pageType: 'short_response',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '一阶系统阶跃响应与时间常数',
    hint: '抓住 t=T 时达到终值 63.2% 这一锚点，理解时间尺度。',
    duration: '10 min',
    pageType: 'parameter_slider',
    workspaceKind: 'time-constant',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '二阶系统标准型：ωn、ζ、ωd',
    hint: '把自然频率、阻尼比和阻尼振荡频率三者各自负责的现象说清楚。',
    duration: '7 min',
    pageType: 'triple_match',
    workspaceKind: 'second-order-parameter-map',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '四种响应家族对比',
    hint: '把无阻尼、欠阻尼、临界阻尼、过阻尼看成阻尼比连续变化的一条谱。',
    duration: '6 min',
    pageType: 'tab_switch',
    workspaceKind: 'response-family',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '动态性能指标总览',
    hint: '先把上升时间、峰值时间、超调量、调节时间的语言全景搭起来。',
    duration: '4 min',
    pageType: 'metric_overlay',
    workspaceKind: 'metric-overview',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '上升时间的定义与推导',
    hint: '理解“第一次到达终值”的含义，并判断 wn 变化对 tr 的影响。',
    duration: '6 min',
    pageType: 'reason_check',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '峰值时间与超调量',
    hint: '明确 Mp 主要由 zeta 决定，而不是由 wn 决定。',
    duration: '7 min',
    pageType: 'formula_pair_check',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '调节时间与误差带',
    hint: '区分严格定义与工程近似，并把注意力转到极点实部。',
    duration: '7 min',
    pageType: 'parameter_workspace',
    workspaceKind: 'settling-band',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '例题一——已知参数求指标',
    hint: '按“读 wn、zeta -> 求 wd -> 顺推四指标”的三步法组织解题。',
    duration: '8 min',
    pageType: 'worked_example_workspace',
    workspaceKind: 'worked-example',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '例题二——由指标反推参数区域 + AI 对照',
    hint: '先独立判断参数约束，再让 AI 帮你核对推理链。',
    duration: '10 min',
    pageType: 'ai_compare_workspace',
  },
  {
    id: 'step-15',
    stage: 'P2',
    title: '方法总结与轻量桥接——从时域指标走向参数与极点趋势',
    hint: '把“更快、更稳、更小超调”翻译成复平面中的极点区域语言。',
    duration: '5 min',
    pageType: 'mapping_highlight',
    workspaceKind: 'pole-region',
  },
  {
    id: 'step-16',
    stage: 'P3',
    title: '后测——公式会算，更要会解释',
    hint: '检验你是否能把公式结果翻译回系统品质语言。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-17',
    stage: 'S',
    title: '总结与后续预告',
    hint: '用关键词收束时域分析，并把视角推进到极点与性能映射。',
    duration: '5 min',
    pageType: 'summary',
  },
] as const;

export function getUNIT_2_2Step(stepId: string) {
  return UNIT_2_2_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_2_2_LESSON_STEPS[0];
}

export function getUNIT_2_2PageContract(stepId: string) {
  return UNIT_2_2_PAGE_CONTRACTS[stepId] ?? UNIT_2_2_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_2_2InteractivePageType(pageType: UNIT_2_2PageType) {
  return UNIT_2_2_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_2_2AiPageType(pageType: UNIT_2_2PageType) {
  return pageType === 'ai_compare_workspace';
}

export function createEmptyUNIT_2_2StudentState(studentName: string): UNIT_2_2StudentCourseState {
  return {
    kind: 'unit22_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_2_2_PREMIUM_LESSON_CARD = {
  id: 'unit-2-2-time-domain-response',
  title: UNIT_2_2_COURSE_TITLE,
  description: '精品互动课：把闭环传递函数翻译成响应曲线与动态性能指标。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_2_2_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_2_2_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/2-2/media/2-2-td-04-time-domain-indices-annotated.svg',
  'step-05': '/course-runtime/lessons/2-2/media/2-2-td-01-time-domain-input-response-overview.svg',
  'step-06': '/course-runtime/lessons/2-2/media/2-2-td-02-first-order-step-time-constant.svg',
  'step-08': '/course-runtime/lessons/2-2/media/2-2-td-03-second-order-response-families.svg',
  'step-09': '/course-runtime/lessons/2-2/media/2-2-td-04-time-domain-indices-annotated.svg',
  'step-13': '/course-runtime/lessons/2-2/media/2-2-td-05-example-response-with-indices.svg',
  'step-15': '/course-runtime/lessons/2-2/media/2-2-td-06-time-spec-to-pole-region.svg',
};

export function getUNIT_2_2MediaSrc(stepId: string) {
  return UNIT_2_2_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_2_2StudentState(value: unknown): value is UNIT_2_2StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_2_2StudentCourseState>;
  return data.kind === 'unit22_student_state' && data.version === 1;
}

export function isUNIT_2_2TeacherSyncState(value: unknown): value is UNIT_2_2TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_2_2TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit22' && typeof data.activeStepId === 'string';
}

export const UNIT_2_2_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_2_2StudentCourseState,
  UNIT_2_2TeacherCourseSyncState,
  UNIT_2_2TeacherSyncInput
> = {
  lessonKey: UNIT_2_2_LESSON_KEY,
  studentItemId: UNIT_2_2_STUDENT_ITEM_ID,
  teacherItemId: UNIT_2_2_TEACHER_SYNC_ITEM_ID,
  studentStateKey: 'course',
  teacherStateKey: 'teacher-sync',
  createEmptyStudentState: createEmptyUNIT_2_2StudentState,
  isStudentState: isUNIT_2_2StudentState,
  isTeacherSyncState: isUNIT_2_2TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit22',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_2_2TeacherSync(input: UNIT_2_2TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_2_2TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_2_2TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_2_2TeacherSession(input: UNIT_2_2TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
