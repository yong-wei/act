import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import {
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_4_1StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_4_1PageType =
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'quiz_group'
  | 'parameter_slider'
  | 'triple_match'
  | 'card_sort'
  | 'structured_compare'
  | 'task_card_workspace';
export type UNIT_4_1TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct';

export interface UNIT_4_1PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_4_1PageContract {
  layout: {
    template: string;
    regions: UNIT_4_1PageRegionContract[];
    readingOrder: string[];
  };
  interactionKind: Exclude<UNIT_4_1PageType, 'display'> | 'none';
  interactionArchetype: string;
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiDeliveryMode: 'hidden_page_context';
  teacherControls?: {
    releaseActivity: UNIT_4_1TeacherControlMode;
    openBrowse: UNIT_4_1TeacherControlMode;
    teacherStepReveal: UNIT_4_1TeacherControlMode;
    revealReferenceAnswer: UNIT_4_1TeacherControlMode;
  };
  figureLayoutMirror?: string;
  controlsPlacement?: 'below_figure';
  controlsCollapsedByDefault?: boolean;
  previewDemoPath: string;
}

export interface UNIT_4_1StepDefinition {
  id: string;
  stage: UNIT_4_1StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_4_1PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_4_1StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_4_1StudentCourseState {
  kind: 'unit41_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_4_1StepResponse>;
  viewedStepIds?: string[];
  controlParameterSnapshots?: Record<string, Record<string, string>>;
}

export interface UNIT_4_1TeacherCourseSyncState {
  kind: 'teacher_sync_unit41';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_4_1TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_4_1TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_4_1TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_4_1_ROUTE_SEGMENT = 'unit-4-1-design-task-expression';
export const UNIT_4_1_PRESET_KEY = 'unit-4-1-design-task-expression-v1';
export const UNIT_4_1_RESOURCE_KEY = 'unit-4-1-design-task-expression';
export const UNIT_4_1_LESSON_KEY = UNIT_4_1_PRESET_KEY;
export const UNIT_4_1_STUDENT_ITEM_ID = 'student:unit41:state';
export const UNIT_4_1_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_4_1_STUDENT_STATE_KEY = 'course';
export const UNIT_4_1_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_4_1_COURSE_TITLE = '4-1：设计起点：性能指标体系、工程约束与可行域表达';
export const UNIT_4_1_COURSE_SUBTITLE = 'Design Task Expression';
export const UNIT_4_1_COURSE_DESCRIPTION =
  '围绕性能指标角色、硬约束/软目标/观察指标、可行域分层和双案例联读，把模块 3 的分析证据收束成可交给 4-2/4-3 的任务表达卡。';

export const UNIT_4_1_STAGE_LABEL: Record<UNIT_4_1StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_4_1_STAGE_MAP: Record<UNIT_4_1StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_4_1_PAGE_CONTRACTS: Record<string, UNIT_4_1PageContract> = {
  'step-01': {
    layout: {
      template: 'map_hero_slide',
      regions: [
        { id: 'header', width: 'full', order: 1 },
        { id: 'lead', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
      ],
      readingOrder: ['封面情境图', '课程信息图', '导入问题'],
    },
    interactionKind: 'none',
    interactionArchetype: 'entry_overview',
    teacherInsightWidgets: ['view_count', 'sync_status'],
    telemetrySummaryFields: ['viewed', 'timeOnStep', 'teacherFollowSync'],
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'goal_boundary_slide',
      regions: [
        { id: 'goals', width: 'full', order: 1 },
      ],
      readingOrder: ['本次课程目标'],
    },
    interactionKind: 'none',
    interactionArchetype: 'objective_alignment',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'question_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'submit-bar', width: 'full', order: 2 },
      ],
      readingOrder: ['前测基本知识点', '三题预判'],
    },
    interactionKind: 'quiz_group',
    interactionArchetype: 'diagnostic_quiz',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket', 'teacherRevealSeen'],
    misconceptionTags: ['stable_equals_done', 'same_sort_for_all_scenarios', 'all_metrics_same_priority'],
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'case_study_dashboard',
      regions: [
        { id: 'object', width: 'full', order: 1 },
        { id: 'evidence', width: 'full', order: 2 },
        { id: 'analysis', width: 'full', order: 3 },
      ],
      readingOrder: ['对象/背景', '模型与公式', '图像与曲线', '指标/边界', '判断与任务卡'],
    },
    interactionKind: 'parameter_slider',
    interactionArchetype: 'parametric_sim',
    teacherInsightWidgets: ['field_completion_rate', 'top_error_buckets'],
    telemetrySummaryFields: ['fieldCompletion', 'errorBucket', 'timeOnStep'],
    misconceptionTags: ['ship_speed_first', 'ignored_margin_boundary'],
    aiDeliveryMode: 'hidden_page_context',
    figureLayoutMirror: '2x2',
    controlsPlacement: 'below_figure',
    controlsCollapsedByDefault: true,
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'case_study_dashboard',
      regions: [
        { id: 'object', width: 'full', order: 1 },
        { id: 'evidence', width: 'full', order: 2 },
        { id: 'analysis', width: 'full', order: 3 },
      ],
      readingOrder: ['对象/背景', '模型与公式', '图像与曲线', '指标/边界', '判断与任务卡'],
    },
    interactionKind: 'parameter_slider',
    interactionArchetype: 'parametric_sim',
    teacherInsightWidgets: ['field_completion_rate', 'top_error_buckets'],
    telemetrySummaryFields: ['fieldCompletion', 'errorBucket', 'timeOnStep'],
    misconceptionTags: ['platform_can_relax_margin', 'speed_only_no_boundary'],
    aiDeliveryMode: 'hidden_page_context',
    figureLayoutMirror: 'custom-grid',
    controlsPlacement: 'below_figure',
    controlsCollapsedByDefault: true,
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'contrast_summary_board',
      regions: [
        { id: 'matrix', width: 'full', order: 1 },
        { id: 'sorting', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
      ],
      readingOrder: ['对照矩阵', '排序结果', '一句话收束'],
    },
    interactionKind: 'card_sort',
    interactionArchetype: 'evidence_reorder',
    teacherInsightWidgets: ['sorting_distribution', 'completion_rate'],
    telemetrySummaryFields: ['sortAttempted', 'sortCorrected', 'timeOnStep'],
    misconceptionTags: ['same_sort_for_all_scenarios'],
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'formula_table_match',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'tables', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
      readingOrder: ['问题分工', '公式与指标', '角色映射'],
    },
    interactionKind: 'triple_match',
    interactionArchetype: 'concept_role_mapping',
    teacherInsightWidgets: ['common_mismatch_pairs', 'completion_rate'],
    telemetrySummaryFields: ['matchAttempted', 'matchCorrected', 'timeOnStep'],
    misconceptionTags: ['integral_index_as_hard_constraint', 'time_freq_mixup'],
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'comparison_panel_with_sort',
      regions: [
        { id: 'rules', width: 'full', order: 1 },
        { id: 'card-bank', width: 'full', order: 2 },
        { id: 'sort-area', width: 'full', order: 3 },
      ],
      readingOrder: ['分类规则', '指标卡组', '角色归类'],
    },
    interactionKind: 'card_sort',
    interactionArchetype: 'role_classification',
    teacherInsightWidgets: ['bucket_distribution', 'common_sort_errors'],
    telemetrySummaryFields: ['attemptCount', 'sortBucket', 'timeOnStep'],
    misconceptionTags: ['observation_as_constraint', 'soft_target_as_hard_constraint'],
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'task_card_workspace',
      regions: [
        { id: 'template', width: 'full', order: 1 },
        { id: 'evidence', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
      readingOrder: ['模板字段', '证据来源', '任务表达卡填写'],
    },
    interactionKind: 'task_card_workspace',
    interactionArchetype: 'task_card_workspace',
    teacherInsightWidgets: ['field_completion_rate', 'submission_overview', 'top_missing_fields'],
    telemetrySummaryFields: ['fieldCompletion', 'submissionState', 'timeOnStep'],
    misconceptionTags: ['missing_priority', 'missing_evidence_source'],
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'layered_region_board',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'diagram', width: 'full', order: 2 },
        { id: 'decision', width: 'full', order: 3 },
      ],
      readingOrder: ['集合关系', '分层图示', '边界判断'],
    },
    interactionKind: 'binary_choice',
    interactionArchetype: 'layer_judgement',
    teacherInsightWidgets: ['option_distribution', 'misconception_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'errorBucket'],
    misconceptionTags: ['stable_equals_acceptable', 'acceptable_equals_optimal'],
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'misconception_board',
      regions: [
        { id: 'cards', width: 'full', order: 1 },
        { id: 'checklist', width: 'full', order: 2 },
        { id: 'decision', width: 'full', order: 3 },
      ],
      readingOrder: ['误判卡', '五步清单', '纠偏判断'],
    },
    interactionKind: 'binary_choice',
    interactionArchetype: 'misconception_diagnosis',
    teacherInsightWidgets: ['misconception_distribution', 'top_error_buckets'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'errorBucket'],
    misconceptionTags: ['stable_equals_done', 'all_metrics_same_priority', 'single_graph_conclusion'],
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'summary_quiz_board',
      regions: [
        { id: 'quiz', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'next-step', width: 'full', order: 3 },
      ],
      readingOrder: ['后测题组', '四句带走', '后续去向'],
    },
    interactionKind: 'quiz_group',
    interactionArchetype: 'summary_quiz',
    teacherInsightWidgets: ['question_distribution', 'completion_rate', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'timeOnStep'],
    misconceptionTags: ['stable_equals_done', 'missing_task_card_input'],
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-12',
  },
};

export const UNIT_4_1_INTERACTIVE_PAGE_TYPES = new Set<UNIT_4_1PageType>([
  'binary_choice',
  'quiz_group',
  'parameter_slider',
  'triple_match',
  'card_sort',
  'structured_compare',
  'task_card_workspace',
]);

export const UNIT_4_1_LESSON_STEPS: UNIT_4_1StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '任务表达入口：从跨域证据写出设计任务',
    hint: '用封面情境图、课程信息图和导入问题进入任务表达。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'O',
    title: '本次课程目标',
    hint: '列出四项布鲁姆动词驱动的课程目标。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-03',
    stage: 'P1',
    title: '同图异读预判：为什么同一套证据会写出两张任务书',
    hint: '考察稳定性判断、时域与频域指标含义、积分误差指标含义，以及指标角色与优先级基础。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '主场景 A：客船航向控制先保什么',
    hint: '围绕对象框图、四联图和任务卡，把客船场景压实成“平顺与储备优先，再谈提速”。',
    duration: '9 min',
    pageType: 'parameter_slider',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '对照案例 B：稳定平台为什么把速度排得更前',
    hint: '围绕特殊布局综合图，区分“速度前移”与“边界失效”不是一回事。',
    duration: '8 min',
    pageType: 'parameter_slider',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '双案例对照：排序变化来自哪里',
    hint: '把双案例读回同一套语言，并通过排序任务压实“语言相同，排序不同”。',
    duration: '7 min',
    pageType: 'card_sort',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '指标角色重组：时域、频域、积分误差各自回答什么',
    hint: '把时域、频域、积分误差三类指标重新配回“过程接受度 / 储备边界 / 累计代价”。',
    duration: '7 min',
    pageType: 'triple_match',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '任务分类：硬约束、软目标、观察指标',
    hint: '把指标名称改写成任务角色，明确哪些是底线、哪些是继续争取、哪些只是解释后果。',
    duration: '7 min',
    pageType: 'card_sort',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '任务表达卡工作区：把后续设计输入写全',
    hint: '选择一个案例，把对象、目标、硬约束、软目标、观察指标与证据来源写完整。',
    duration: '10 min',
    pageType: 'task_card_workspace',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '区域分层：可行域、满意域、最优域不是一步',
    hint: '把“能做、可接受、当前最优”分层写清，明确 4-1 先到可行与满意，不求最优。',
    duration: '6 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '误判检查：稳定不等于完成，可行不等于最优',
    hint: '核对任务表达中指标排序、区域层级和证据来源的判断。',
    duration: '6 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-12',
    stage: 'P3',
    title: '后测：先写任务，再谈方法',
    hint: '三道后测题检查任务表达、区域分层与同图异读判断。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-13',
    stage: 'S',
    title: '总结：任务表达卡成为后续设计输入',
    hint: '用信息图、四句带走和课堂表现统计完成收束。',
    duration: '4 min',
    pageType: 'summary',
  },
] as const;

function pageTypeFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_4_1PageType {
  const kind = step.interactionSpec.interactionKind;
  if (kind === 'none' || kind === 'display' || kind === 'summary') {
    return step.id === 'step-13' ? 'summary' : 'display';
  }
  if (
    kind === 'binary_choice' ||
    kind === 'quiz_group' ||
    kind === 'parameter_slider' ||
    kind === 'triple_match' ||
    kind === 'card_sort' ||
    kind === 'structured_compare' ||
    kind === 'task_card_workspace'
  ) {
    return kind;
  }
  return 'display';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_4_1PageContract {
  const pageType = pageTypeFromManifestStep(step);
  return {
    layout: {
      template: step.layout.template,
      regions: step.layout.regions,
      readingOrder: [],
    },
    interactionKind: pageType === 'display' || pageType === 'summary' ? 'none' : pageType,
    interactionArchetype: step.interactionSpec.interactionKind,
    teacherControls: step.teacherControls,
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    aiDeliveryMode: 'hidden_page_context',
    figureLayoutMirror: step.interactiveFigureSpec.layoutMirror,
    controlsPlacement: step.interactiveFigureSpec.controlsPlacement === 'below_figure' ? 'below_figure' : undefined,
    controlsCollapsedByDefault: step.interactiveFigureSpec.controlsCollapsedByDefault,
    previewDemoPath: step.previewContract.demoPath,
  };
}

export function getUNIT_4_1ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('4-1 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_4_1PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_4_1ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_4_1Step(stepId: string) {
  return UNIT_4_1_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_4_1_LESSON_STEPS[0];
}

export function getUNIT_4_1PageContract(stepId: string) {
  return UNIT_4_1_PAGE_CONTRACTS[stepId] ?? UNIT_4_1_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_4_1InteractivePageType(pageType: UNIT_4_1PageType) {
  return pageType !== 'display' && pageType !== 'summary' && UNIT_4_1_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_4_1AiPageType(_pageType: UNIT_4_1PageType) {
  return false;
}

export function createEmptyUNIT_4_1StudentState(studentName: string): UNIT_4_1StudentCourseState {
  return {
    kind: 'unit41_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
    viewedStepIds: [],
    controlParameterSnapshots: {},
  };
}

export const UNIT_4_1_PREMIUM_LESSON_CARD = {
  id: 'unit-4-1-design-task-expression',
  title: UNIT_4_1_COURSE_TITLE,
  description: '精品互动课：把性能指标、工程约束、可行域分层与双案例证据收束成任务表达卡。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_4_1_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_4_1_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/4-1/media/4-1-cover-comic.png',
  'step-04': '/course-runtime/lessons/4-1/media/4-1-ship-heading-quad.png',
  'step-05': '/course-runtime/lessons/4-1/media/4-1-platform-pitch-quad.png',
  'step-13': '/course-runtime/lessons/4-1/media/4-1-info.png',
};

export function getUNIT_4_1MediaSrc(stepId: string) {
  return UNIT_4_1_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_4_1StudentState(value: unknown): value is UNIT_4_1StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_4_1StudentCourseState>;
  return data.kind === 'unit41_student_state' && data.version === 1;
}

export function isUNIT_4_1TeacherSyncState(value: unknown): value is UNIT_4_1TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_4_1TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit41' && typeof data.activeStepId === 'string';
}

export const UNIT_4_1_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_4_1StudentCourseState,
  UNIT_4_1TeacherCourseSyncState,
  UNIT_4_1TeacherSyncInput
> = {
  lessonKey: UNIT_4_1_LESSON_KEY,
  studentItemId: UNIT_4_1_STUDENT_ITEM_ID,
  teacherItemId: UNIT_4_1_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_4_1_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_4_1_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_4_1StudentState,
  isStudentState: isUNIT_4_1StudentState,
  isTeacherSyncState: isUNIT_4_1TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit41',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_4_1TeacherSync(input: UNIT_4_1TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_4_1TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled?: Record<string, boolean> | null;
  localTeacherRevealProgress?: Record<string, number> | null;
  teacherSyncState: UNIT_4_1TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_4_1TeacherSession(input: UNIT_4_1TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_4_1_LESSON_STEPS,
  }));
}
