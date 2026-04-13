import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_2_3StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_2_3PageType =
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'quiz_group'
  | 'short_response'
  | 'parameter_slider'
  | 'reason_check'
  | 'tab_switch'
  | 'triple_match'
  | 'single_choice'
  | 'highlight_toggle'
  | 'card_sort'
  | 'workspace_builder'
  | 'worked_example_workspace'
  | 'ai_compare_workspace';

export interface UNIT_2_3PageRegionContract {
  id: string;
  width: 'full' | '1/2';
  order: number;
}

export interface UNIT_2_3PageContract {
  layout: {
    template: string;
    regions: UNIT_2_3PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_2_3PageType, 'display' | 'summary'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export type Unit23WorkspaceKind =
  | 'reconstruction-lab'
  | 'wave-inspector'
  | 'bode-card-sort'
  | 'skeleton-builder'
  | 'worked-example'
  | 'multi-tone-compare'
  | 'none';

export interface UNIT_2_3StepDefinition {
  id: string;
  stage: UNIT_2_3StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_2_3PageType;
  workspaceKind?: Unit23WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_2_3StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_2_3StudentCourseState {
  kind: 'unit23_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_2_3StepResponse>;
}

export interface UNIT_2_3TeacherCourseSyncState {
  kind: 'teacher_sync_unit23';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_2_3TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_2_3TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_2_3TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_2_3_ROUTE_SEGMENT = 'unit-2-3-frequency-response-bode-intro';
export const UNIT_2_3_PRESET_KEY = 'unit-2-3-frequency-response-bode-intro-v1';
export const UNIT_2_3_RESOURCE_KEY = 'unit-2-3-frequency-response-bode-intro';
export const UNIT_2_3_LESSON_KEY = UNIT_2_3_PRESET_KEY;
export const UNIT_2_3_STUDENT_ITEM_ID = 'student:unit23:state';
export const UNIT_2_3_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_2_3_STUDENT_STATE_KEY = 'course';
export const UNIT_2_3_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_2_3_COURSE_TITLE = '2-3：频率响应基础与 Bode 图初步——从时域现象到频域图形入口';
export const UNIT_2_3_COURSE_SUBTITLE = 'Frequency Response & Bode Intro';
export const UNIT_2_3_COURSE_DESCRIPTION =
  '围绕频率分量思想、正弦稳态响应、G(jω)、幅频/相频语言与 Bode 首轮骨架，完成从时域现象到频域图形对象的第一轮切换。';

export const UNIT_2_3_STAGE_LABEL: Record<UNIT_2_3StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_2_3_STAGE_MAP: Record<UNIT_2_3StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_2_3_PAGE_CONTRACTS: Record<string, UNIT_2_3PageContract> = {
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
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'binary_choice_illustration',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'questions', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'misconception_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['same_sensitivity_for_all_frequencies'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-02',
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
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-03',
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
      'same_response_to_low_and_high_frequency',
      'same_frequency_same_amplitude',
      'waveform_smoothing_confusion',
    ],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'table_plus_prompt',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'prompt', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'short_response',
    teacherInsightWidgets: ['response_word_cloud', 'common_reason_tags'],
    telemetrySummaryFields: ['responseSubmitted', 'responseLength', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'media_plus_reconstruction_lab',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'logic', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_slider',
    teacherInsightWidgets: ['parameter_distribution', 'final_shape_tags'],
    telemetrySummaryFields: ['sliderChanged', 'stateSnapshot', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'formula_walkthrough_with_check',
      regions: [
        { id: 'formula-card', width: 'full', order: 1 },
        { id: 'explain-strip', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['confusion_matrix', 'correction_rate'],
    telemetrySummaryFields: ['selectionState', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['frequency_changes_with_output', 'amplitude_phase_not_distinguished'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'dual_wave_inspector',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'meaning-table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'tab_switch',
    teacherInsightWidgets: ['tab_heatmap'],
    telemetrySummaryFields: ['tabVisited', 'viewDuration'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-08',
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
    misconceptionTags: ['frequency_vs_amplitude_vs_phase_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'concept_bridge_card',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'bridge', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'single_choice',
    teacherInsightWidgets: ['misconception_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState'],
    misconceptionTags: ['abandon_laplace_method'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'axis_compare_slide',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'reasons', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'highlight_toggle',
    teacherInsightWidgets: ['reason_focus_heatmap'],
    telemetrySummaryFields: ['toggleVisited', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'card_sort_with_reference',
      regions: [
        { id: 'reference', width: 'full', order: 1 },
        { id: 'cards', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'card_sort',
    teacherInsightWidgets: ['common_sort_errors'],
    telemetrySummaryFields: ['sortAttempted', 'sortCorrected', 'timeOnStep'],
    misconceptionTags: ['typical_element_first_judgment_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'sketch_workflow_workspace',
      regions: [
        { id: 'workflow', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'workspace_builder',
    teacherInsightWidgets: ['missing_break_frequency_rate', 'slope_error_rate'],
    telemetrySummaryFields: ['checkpointSaved', 'errorBucket', 'teacherRevealSeen'],
    misconceptionTags: ['missing_break_frequency', 'wrong_slope_direction'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-13',
  },
  'step-14': {
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
    misconceptionTags: ['modulus_phase_calculation_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'compare_then_ai',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'method', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
        { id: 'ai-panel', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'ai_compare_workspace',
    teacherInsightWidgets: ['ai_usage_rate', 'common_reason_gaps'],
    telemetrySummaryFields: ['workspaceSubmitted', 'aiCheckRequested', 'revisionCount'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-15',
  },
  'step-16': {
    layout: {
      template: 'post_quiz_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'explain-box', width: 'full', order: 2 },
        { id: 'submit-bar', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'concept_transfer_rate'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'explainQualityTag'],
    misconceptionTags: ['post_assessment_transfer_gap'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-16',
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
    teacherInsightWidgets: ['resource_click_rate'],
    telemetrySummaryFields: ['viewed', 'resourceClicked'],
    previewDemoPath: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-17',
  },
};

export const UNIT_2_3_INTERACTIVE_PAGE_TYPES = new Set<UNIT_2_3PageType>([
  'binary_choice',
  'quiz_group',
  'short_response',
  'parameter_slider',
  'reason_check',
  'tab_switch',
  'triple_match',
  'single_choice',
  'highlight_toggle',
  'card_sort',
  'workspace_builder',
  'worked_example_workspace',
  'ai_compare_workspace',
]);

export const UNIT_2_3_LESSON_STEPS: UNIT_2_3StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图——从时域对象走向频域对象',
    hint: '把 2-2 的时间响应语言推进到 2-3 的频率对象语言。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入——系统为什么会挑节奏',
    hint: '先建立“系统会区分低频命令和高频扰动”的直觉。',
    duration: '4 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '学习目标——这节课要建立哪套频域语言',
    hint: '明确频率分量、正弦稳态响应和 Bode 首轮骨架三件事。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测——低频、高频与正弦输入判断',
    hint: '用三题暴露“同频不等于同幅、滤高频会更平滑”等起点误区。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '从时域问题走向频域问题',
    hint: '完成观察视角切换：时域看整体，频域看规则。',
    duration: '5 min',
    pageType: 'short_response',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '方波、频率分量与重构直觉',
    hint: '用谐波个数与高频衰减双滑块理解“分量分别响应，再叠加重构”。',
    duration: '8 min',
    pageType: 'parameter_slider',
    workspaceKind: 'reconstruction-lab',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '正弦输入为什么会导向同频输出',
    hint: '抓住“频率不变，幅值改变，相位改变”这三条结论。',
    duration: '6 min',
    pageType: 'reason_check',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '幅值变化与相位变化的物理意义',
    hint: '把波形差异翻译成“放大/衰减、提前/滞后”的工程语言。',
    duration: '5 min',
    pageType: 'tab_switch',
    workspaceKind: 'wave-inspector',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '频率特性：G(jω)、幅频与相频',
    hint: '把对象、数学定义与回答问题三件事一一对应起来。',
    duration: '6 min',
    pageType: 'triple_match',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '为什么可以令 s=jω',
    hint: '说明这不是抛弃拉氏方法，而是沿虚轴观察正弦稳态。',
    duration: '4 min',
    pageType: 'single_choice',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '为什么要画 Bode 图',
    hint: '线性坐标、对数坐标和分贝表达各自解决不同可读性问题。',
    duration: '6 min',
    pageType: 'highlight_toggle',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '典型环节 Bode 第一判断',
    hint: '先认对象，再按“易通过/易抑制/相位滞后”做第一轮分类。',
    duration: '7 min',
    pageType: 'card_sort',
    workspaceKind: 'bode-card-sort',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '基础手绘骨架：标准型、转折频率与趋势',
    hint: '四步法只做第一轮骨架：写标准型、列转折点、判低频、画趋势。',
    duration: '8 min',
    pageType: 'workspace_builder',
    workspaceKind: 'skeleton-builder',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '例题一——单一正弦输入下的稳态输出',
    hint: '顺着题面、模值、相位、最终表达式四步链完成例题。',
    duration: '8 min',
    pageType: 'worked_example_workspace',
    workspaceKind: 'worked-example',
  },
  {
    id: 'step-15',
    stage: 'P2',
    title: '例题二——多频输入的重塑过程与 AI 对照',
    hint: '先独立写出分量处理顺序，再用页内 AI 核对推理链。',
    duration: '9 min',
    pageType: 'ai_compare_workspace',
    workspaceKind: 'multi-tone-compare',
  },
  {
    id: 'step-16',
    stage: 'P3',
    title: '后测——对象会读，更要会画',
    hint: '检验你是否既会读频域对象，也会解释骨架趋势和工程含义。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-17',
    stage: 'S',
    title: '总结与后续预告——走向 Nyquist 与频域指标',
    hint: '用五条结论收束本课，并把视角推进到 2-4 的判稳与指标。',
    duration: '4 min',
    pageType: 'summary',
  },
] as const;

export function getUNIT_2_3Step(stepId: string) {
  return UNIT_2_3_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_2_3_LESSON_STEPS[0];
}

export function getUNIT_2_3PageContract(stepId: string) {
  return UNIT_2_3_PAGE_CONTRACTS[stepId] ?? UNIT_2_3_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_2_3InteractivePageType(pageType: UNIT_2_3PageType) {
  return UNIT_2_3_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_2_3AiPageType(pageType: UNIT_2_3PageType) {
  return pageType === 'ai_compare_workspace';
}

export function createEmptyUNIT_2_3StudentState(studentName: string): UNIT_2_3StudentCourseState {
  return {
    kind: 'unit23_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_2_3_PREMIUM_LESSON_CARD = {
  id: 'unit-2-3-frequency-response-bode-intro',
  title: UNIT_2_3_COURSE_TITLE,
  description: '精品互动课：把时域现象翻译成频率响应、幅相语言与 Bode 首轮骨架。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_2_3_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_2_3_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/2-3/media/2-3-fr-01-command-vs-disturbance.svg',
  'step-06': '/course-runtime/lessons/2-3/media/2-3-fr-02-square-wave-harmonics.svg',
  'step-08': '/course-runtime/lessons/2-3/media/2-3-fr-03-sine-in-sine-out.svg',
  'step-11': '/course-runtime/lessons/2-3/media/2-3-fr-04-linear-vs-log-frequency.svg',
  'step-12': '/course-runtime/lessons/2-3/media/2-3-fr-05-bode-axes-and-typical-cards.svg',
  'step-13': '/course-runtime/lessons/2-3/media/2-3-fr-06-bode-skeleton-workflow.svg',
  'step-15': '/course-runtime/lessons/2-3/media/2-3-fr-02-square-wave-harmonics.svg',
  'step-17': '/course-runtime/lessons/2-3/media/2-3-info.png',
};

export function getUNIT_2_3MediaSrc(stepId: string) {
  return UNIT_2_3_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_2_3StudentState(value: unknown): value is UNIT_2_3StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_2_3StudentCourseState>;
  return data.kind === 'unit23_student_state' && data.version === 1;
}

export function isUNIT_2_3TeacherSyncState(value: unknown): value is UNIT_2_3TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_2_3TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit23' && typeof data.activeStepId === 'string';
}

export const UNIT_2_3_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_2_3StudentCourseState,
  UNIT_2_3TeacherCourseSyncState,
  UNIT_2_3TeacherSyncInput
> = {
  lessonKey: UNIT_2_3_LESSON_KEY,
  studentItemId: UNIT_2_3_STUDENT_ITEM_ID,
  teacherItemId: UNIT_2_3_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_2_3_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_2_3_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_2_3StudentState,
  isStudentState: isUNIT_2_3StudentState,
  isTeacherSyncState: isUNIT_2_3TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit23',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_2_3TeacherSync(input: UNIT_2_3TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_2_3TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_2_3TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_2_3TeacherSession(input: UNIT_2_3TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
