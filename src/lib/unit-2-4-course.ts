import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_2_4StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_2_4PageType =
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'quiz_group'
  | 'triple_match'
  | 'reason_check'
  | 'parameter_slider'
  | 'card_sort'
  | 'hotspot_labeling'
  | 'workspace_builder'
  | 'path_highlight'
  | 'worked_example_workspace'
  | 'metric_overlay'
  | 'ai_compare_workspace';

export interface UNIT_2_4PageRegionContract {
  id: string;
  width: 'full' | '1/2';
  order: number;
}

export interface UNIT_2_4PageContract {
  layout: {
    template: string;
    regions: UNIT_2_4PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_2_4PageType, 'display' | 'summary'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export type Unit24WorkspaceKind =
  | 'nyquist-slider'
  | 'pole-sort'
  | 'indicator-match'
  | 'bode-sketch'
  | 'nyquist-sketch'
  | 'worked-example'
  | 'metric-overlay'
  | 'ai-compare'
  | 'none';

export interface UNIT_2_4StepDefinition {
  id: string;
  stage: UNIT_2_4StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_2_4PageType;
  workspaceKind?: Unit24WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_2_4StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_2_4StudentCourseState {
  kind: 'unit24_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_2_4StepResponse>;
}

export interface UNIT_2_4TeacherCourseSyncState {
  kind: 'teacher_sync_unit24';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_2_4TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_2_4TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_2_4TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_2_4_ROUTE_SEGMENT = 'unit-2-4-nyquist-margin-entry';
export const UNIT_2_4_PRESET_KEY = 'unit-2-4-nyquist-margin-entry-v1';
export const UNIT_2_4_RESOURCE_KEY = 'unit-2-4-nyquist-margin-entry';
export const UNIT_2_4_LESSON_KEY = UNIT_2_4_PRESET_KEY;
export const UNIT_2_4_STUDENT_ITEM_ID = 'student:unit24:state';
export const UNIT_2_4_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_2_4_STUDENT_STATE_KEY = 'course';
export const UNIT_2_4_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_2_4_COURSE_TITLE = '2-4：Nyquist 图与频域指标入口——把 Bode 图收束为轨迹、裕度与反向识别';
export const UNIT_2_4_COURSE_SUBTITLE = 'Nyquist, Margins & Reverse Reading';
export const UNIT_2_4_COURSE_DESCRIPTION =
  '围绕同一个 G(jω) 的双图表达、纯极点系统 Nyquist 读图、频域指标入口、手工绘图入口与最小反向识别，完成模块 2 的图形对象收束。';

export const UNIT_2_4_STAGE_LABEL: Record<UNIT_2_4StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_2_4_STAGE_MAP: Record<UNIT_2_4StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_2_4_PAGE_CONTRACTS: Record<string, UNIT_2_4PageContract> = {
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
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'dual_view_question_slide',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'questions', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'misconception_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['nyquist_is_new_object'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-02',
  },
  'step-03': {
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
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-03',
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
    misconceptionTags: [
      'nyquist_is_new_object',
      'wrong_start_point_reasoning',
      'margin_means_closed_loop_conclusion',
    ],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'formula_media_compare',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['common_mismatch_pairs', 'completion_rate'],
    telemetrySummaryFields: ['matchAttempted', 'matchCorrected', 'timeOnStep'],
    misconceptionTags: ['dual_graph_role_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'workflow_card_with_reason_check',
      regions: [
        { id: 'workflow', width: 'full', order: 1 },
        { id: 'meaning', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['confusion_matrix', 'correction_rate'],
    telemetrySummaryFields: ['selectionState', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['skip_endpoint_before_direction'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'courseware_top_slider_bottom',
      regions: [
        { id: 'formula-card', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_slider',
    teacherInsightWidgets: ['parameter_distribution', 'final_shape_tags'],
    telemetrySummaryFields: ['sliderChanged', 'stateSnapshot', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'comparison_panel_with_sort',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'card_sort',
    teacherInsightWidgets: ['common_sort_errors', 'misconception_rate'],
    telemetrySummaryFields: ['sortAttempted', 'sortCorrected', 'timeOnStep'],
    misconceptionTags: ['pure_pole_track_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'formula_table_match',
      regions: [
        { id: 'formula-strip', width: 'full', order: 1 },
        { id: 'definition-matrix', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['common_mismatch_pairs', 'completion_rate'],
    telemetrySummaryFields: ['matchAttempted', 'matchCorrected', 'timeOnStep'],
    misconceptionTags: ['indicator_definition_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'dual_graph_indicator_locator',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'hotspot_labeling',
    teacherInsightWidgets: ['hotspot_error_heatmap', 'completion_rate'],
    telemetrySummaryFields: ['hotspotPlaced', 'resultState', 'timeOnStep'],
    misconceptionTags: ['indicator_anchor_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'sketch_workflow_workspace',
      regions: [
        { id: 'workflow', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'workspace_builder',
    teacherInsightWidgets: ['baseline_error_rate', 'missing_break_frequency_rate'],
    telemetrySummaryFields: ['checkpointSaved', 'errorBucket', 'teacherRevealSeen'],
    misconceptionTags: ['wrong_baseline_with_integrator', 'missing_break_frequency'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'workflow_graph_workspace',
      regions: [
        { id: 'workflow', width: 'full', order: 1 },
        { id: 'rules', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'path_highlight',
    teacherInsightWidgets: ['rule_focus_heatmap', 'common_missed_anchor'],
    telemetrySummaryFields: ['highlightVisited', 'resultState', 'timeOnStep'],
    misconceptionTags: ['skip_asymptote_for_integrator'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'worked_example_workspace',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'method', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
        { id: 'result', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['stuck_step_distribution'],
    telemetrySummaryFields: ['stepCompletion', 'errorBucket', 'timeOnStep'],
    misconceptionTags: ['draw_horizontal_first', 'skip_nyquist_anchor'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'worked_example_metric_panel',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'definition', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
        { id: 'result', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'metric_overlay',
    teacherInsightWidgets: ['indicator_error_rate', 'completion_rate'],
    telemetrySummaryFields: ['indicatorLocated', 'resultState', 'timeOnStep'],
    misconceptionTags: ['jump_to_closed_loop_conclusion'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'compare_then_ai',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'logic', width: 'full', order: 2 },
        { id: 'ai-panel', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'ai_compare_workspace',
    teacherInsightWidgets: ['ai_usage_rate', 'common_reason_tags'],
    telemetrySummaryFields: ['selfAnswerSubmitted', 'aiUsed', 'compareCompleted'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-15',
  },
  'step-16': {
    layout: {
      template: 'post_quiz_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'submit-bar', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['jump_to_closed_loop_conclusion', 'wrong_phase_margin_calc'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-16',
  },
  'step-17': {
    layout: {
      template: 'summary_infographic',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'bridge', width: 'full', order: 2 },
        { id: 'resources', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-17',
  },
};

export const UNIT_2_4_INTERACTIVE_PAGE_TYPES = new Set<UNIT_2_4PageType>([
  'binary_choice',
  'quiz_group',
  'triple_match',
  'reason_check',
  'parameter_slider',
  'card_sort',
  'hotspot_labeling',
  'workspace_builder',
  'path_highlight',
  'worked_example_workspace',
  'metric_overlay',
  'ai_compare_workspace',
]);

export const UNIT_2_4_LESSON_STEPS: UNIT_2_4StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图——从 Bode 骨架走向图形对象',
    hint: '把 2-3 的 Bode 图骨架推进到 2-4 的 Nyquist、裕度与反向识别。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入——为什么同一条频率特性还要换一张图',
    hint: '先立住 Nyquist 不是新对象，而是同一频率特性的另一种图形语言。',
    duration: '4 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '学习目标与边界——本课负责什么、不负责什么',
    hint: '明确本课只到 Nyquist 入口、指标读取、绘图入口与最小反向识别。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测——起点、对象与指标三类误区',
    hint: '用三题暴露“Nyquist 是新对象”“裕度直接给闭环结论”等误区。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '同一个 G(jω)：Bode 拆开看，Nyquist 合起来看',
    hint: '把双图职责、复数表达与观察问题一一配对。',
    duration: '6 min',
    pageType: 'triple_match',
    workspaceKind: 'indicator-match',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: 'Nyquist 四步读法——起点、终点、方向、总转角',
    hint: '固定“四步读法”的观察顺序，不跳步。',
    duration: '6 min',
    pageType: 'reason_check',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '一阶惯性轨迹——从正实轴出发，向下收敛至原点',
    hint: '用参数滑块观察一阶惯性轨迹如何从正实轴向下弯向原点。',
    duration: '6 min',
    pageType: 'parameter_slider',
    workspaceKind: 'nyquist-slider',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '纯极点系统比较——极点越多，轨迹通常转得更深',
    hint: '按对象比较 Nyquist 轨迹转角深浅与拖后程度。',
    duration: '6 min',
    pageType: 'card_sort',
    workspaceKind: 'pole-sort',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '频域指标入口——ωc、ωg、γ、Kg、ωb',
    hint: '把五个指标的定义、图上锚点和回答的问题对应起来。',
    duration: '7 min',
    pageType: 'triple_match',
    workspaceKind: 'indicator-match',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '双图对照——同一指标在 Bode 和 Nyquist 上怎样找',
    hint: '把单位圆、负实轴和指标锚点连回双图对应关系。',
    duration: '6 min',
    pageType: 'hotspot_labeling',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '手工绘图入口一——Bode 基线、折点与斜率',
    hint: '只做基线、折点与斜率的第一轮骨架工作区。',
    duration: '7 min',
    pageType: 'workspace_builder',
    workspaceKind: 'bode-sketch',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '手工绘图入口二——Nyquist 端点、过轴点与渐近线',
    hint: '用关键点规则卡把 Nyquist 手工绘图入口固定下来。',
    duration: '7 min',
    pageType: 'path_highlight',
    workspaceKind: 'nyquist-sketch',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '例题一——含积分环节对象从 Bode 基线到 Nyquist 轨迹',
    hint: '按三步链完成含积分环节对象的 Bode 到 Nyquist 转换。',
    duration: '8 min',
    pageType: 'worked_example_workspace',
    workspaceKind: 'worked-example',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '例题二——读取频域指标，暂不作闭环结论',
    hint: '只读取指标并解释来源，不把本课偷渡成闭环判稳课。',
    duration: '7 min',
    pageType: 'metric_overlay',
    workspaceKind: 'metric-overlay',
  },
  {
    id: 'step-15',
    stage: 'P2',
    title: '基础反向识别——先认对象轮廓，再估参数量级',
    hint: '先独立判断对象与参数量级，再用页内 AI 核对线索链。',
    duration: '8 min',
    pageType: 'ai_compare_workspace',
    workspaceKind: 'ai-compare',
  },
  {
    id: 'step-16',
    stage: 'P3',
    title: '后测——图会看，更要会守边界',
    hint: '检验会不会读图、会不会算指标，也检验会不会守住本课边界。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-17',
    stage: 'S',
    title: '总结与后续预告——从图形对象走向结构机理',
    hint: '用五条结论收束 2-4，并把视角推进到模块 3 的结构机理。',
    duration: '4 min',
    pageType: 'summary',
  },
] as const;

export function getUNIT_2_4Step(stepId: string) {
  return UNIT_2_4_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_2_4_LESSON_STEPS[0];
}

export function getUNIT_2_4PageContract(stepId: string) {
  return UNIT_2_4_PAGE_CONTRACTS[stepId] ?? UNIT_2_4_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_2_4InteractivePageType(pageType: UNIT_2_4PageType) {
  return UNIT_2_4_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_2_4AiPageType(pageType: UNIT_2_4PageType) {
  return pageType === 'ai_compare_workspace';
}

export function createEmptyUNIT_2_4StudentState(studentName: string): UNIT_2_4StudentCourseState {
  return {
    kind: 'unit24_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_2_4_PREMIUM_LESSON_CARD = {
  id: 'unit-2-4-nyquist-margin-entry',
  title: UNIT_2_4_COURSE_TITLE,
  description: '精品互动课：把 Bode 图收束为 Nyquist 轨迹、频域指标入口与最小反向识别。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_2_4_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_2_4_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/2-4/media/2-4-fd-08-bode-nyquist-consistency-panel.svg',
  'step-05': '/course-runtime/lessons/2-4/media/2-4-fd-08-bode-nyquist-consistency-panel.svg',
  'step-07': '/course-runtime/lessons/2-4/media/2-4-fd-05-first-order-nyquist-track.svg',
  'step-08': '/course-runtime/lessons/2-4/media/2-4-fd-06-pure-pole-nyquist-comparison.svg',
  'step-10': '/course-runtime/lessons/2-4/media/2-4-fd-08-bode-nyquist-consistency-panel.svg',
  'step-11': '/course-runtime/lessons/2-4/media/2-4-fd-09-bode-sketch-checklist.png',
  'step-12': '/course-runtime/lessons/2-4/media/2-4-fd-10-nyquist-sketch-checklist.png',
  'step-14': '/course-runtime/lessons/2-4/media/2-4-fd-08-bode-nyquist-consistency-panel.svg',
  'step-15': '/course-runtime/lessons/2-4/media/2-4-fd-07-second-order-damping-bode.svg',
  'step-17': '/course-runtime/lessons/2-4/media/2-4-info.png',
};

export function getUNIT_2_4MediaSrc(stepId: string) {
  return UNIT_2_4_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_2_4StudentState(value: unknown): value is UNIT_2_4StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_2_4StudentCourseState>;
  return data.kind === 'unit24_student_state' && data.version === 1;
}

export function isUNIT_2_4TeacherSyncState(value: unknown): value is UNIT_2_4TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_2_4TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit24' && typeof data.activeStepId === 'string';
}

export const UNIT_2_4_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_2_4StudentCourseState,
  UNIT_2_4TeacherCourseSyncState,
  UNIT_2_4TeacherSyncInput
> = {
  lessonKey: UNIT_2_4_LESSON_KEY,
  studentItemId: UNIT_2_4_STUDENT_ITEM_ID,
  teacherItemId: UNIT_2_4_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_2_4_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_2_4_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_2_4StudentState,
  isStudentState: isUNIT_2_4StudentState,
  isTeacherSyncState: isUNIT_2_4TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit24',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_2_4TeacherSync(input: UNIT_2_4TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_2_4TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_2_4TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_2_4TeacherSession(input: UNIT_2_4TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_2_4_LESSON_STEPS,
  }));
}
