import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import {
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_4_4StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_4_4TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_direct'
  | 'teacher_only';

export type UNIT_4_4PageType =
  | 'display'
  | 'quiz_group'
  | 'activity_card_set'
  | 'single_choice'
  | 'teacher_reveal_only'
  | 'task_card_workspace';

export type UNIT_4_4InteractionKind =
  | 'none'
  | 'quiz_group'
  | 'activity_card_set'
  | 'single_choice'
  | 'teacher_reveal_only'
  | 'task_card_workspace';

export interface UNIT_4_4PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_4_4PageContract {
  layout: {
    template: string;
    regions: UNIT_4_4PageRegionContract[];
  };
  interactionKind: UNIT_4_4InteractionKind;
  teacherControls: {
    releaseActivity: UNIT_4_4TeacherControlMode;
    openBrowse: UNIT_4_4TeacherControlMode;
    teacherStepReveal: UNIT_4_4TeacherControlMode;
    revealReferenceAnswer: UNIT_4_4TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiPageGoal: string;
  previewDemoPath: string;
}

export interface UNIT_4_4StepDefinition {
  id: string;
  stage: UNIT_4_4StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_4_4PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_4_4StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_4_4StudentCourseState {
  kind: 'unit44_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_4_4StepResponse>;
}

export interface UNIT_4_4TeacherCourseSyncState {
  kind: 'teacher_sync_unit44';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_4_4TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_4_4TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_4_4TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_4_4_ROUTE_SEGMENT = 'unit-4-4-fixed-structure-optimization-modeling';
export const UNIT_4_4_PRESET_KEY = 'unit-4-4-fixed-structure-optimization-modeling-v1';
export const UNIT_4_4_RESOURCE_KEY = 'unit-4-4-fixed-structure-optimization-modeling';
export const UNIT_4_4_LESSON_KEY = UNIT_4_4_PRESET_KEY;
export const UNIT_4_4_STUDENT_ITEM_ID = 'student:unit44:state';
export const UNIT_4_4_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_4_4_STUDENT_STATE_KEY = 'course';
export const UNIT_4_4_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_4_4_COURSE_TITLE = '4-4：多目标权衡与控制器优化设计';
export const UNIT_4_4_COURSE_SUBTITLE = 'Fixed-Structure Optimization Modeling';
export const UNIT_4_4_COURSE_DESCRIPTION =
  '围绕固定结构下的多目标拉扯、自由目标表达、无约束候选族与 Pareto 最小取舍，把 4-3 的首轮证据推进成 4-5 可复核的候选族。';

export const UNIT_4_4_STAGE_LABEL: Record<UNIT_4_4StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_4_4_STAGE_MAP: Record<UNIT_4_4StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function preview(stepId: string) {
  return `/interactive-learning/courses/${UNIT_4_4_ROUTE_SEGMENT}/student/demo?step=${stepId}`;
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_4_4PageContract {
  return {
    layout: {
      template: step.layout.template,
      regions: step.layout.regions.map((region) => ({
        id: region.id,
        width: region.width,
        order: region.order,
      })),
    },
    interactionKind: step.interactionSpec.interactionKind as UNIT_4_4InteractionKind,
    teacherControls: step.teacherControls,
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    aiPageGoal: step.aiContextSpec.pageGoal,
    previewDemoPath: step.previewContract.demoPath || preview(step.id),
  };
}

export const UNIT_4_4_PAGE_CONTRACTS: Record<string, UNIT_4_4PageContract> = {
  'step-01': {
    layout: { template: 'map_goal_boundary_slide', regions: [{ id: 'object', width: 'full', order: 1 }, { id: 'route', width: 'full', order: 2 }, { id: 'question', width: 'full', order: 3 }] },
    interactionKind: 'none',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'not_applicable', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['view_count', 'sync_status'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    misconceptionTags: [],
    aiPageGoal: '先交代对象与拉扯，再固定本课只产出无约束候选族。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-01',
  },
  'step-02': {
    layout: { template: 'goal_statement_board', regions: [{ id: 'header', width: 'full', order: 1 }, { id: 'goals', width: 'full', order: 2 }] },
    interactionKind: 'none',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'not_applicable', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    misconceptionTags: [],
    aiPageGoal: '显式呈现本课课程目标，不提前放入证据表和图片。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-02',
  },
  'step-03': {
    layout: { template: 'evidence_table_plus_chart_with_quiz', regions: [{ id: 'table', width: 'full', order: 1 }, { id: 'media', width: 'full', order: 2 }, { id: 'reading', width: 'full', order: 3 }, { id: 'quiz', width: 'full', order: 4 }] },
    interactionKind: 'quiz_group',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions', 'completion_rate'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'cardSubmitted'],
    misconceptionTags: ['candidate_equals_delivery', 'range_equals_boundary', 'objective_reuse'],
    aiPageGoal: '先用四组证据固定多目标拉扯，再把前测放到页面最后。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-03',
  },
  'step-04': {
    layout: { template: 'parameterization_board', regions: [{ id: 'formula', width: 'full', order: 1 }, { id: 'evidence', width: 'full', order: 2 }, { id: 'table', width: 'full', order: 3 }, { id: 'interaction', width: 'full', order: 4 }] },
    interactionKind: 'activity_card_set',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['card_completion_rate', 'error_bucket_distribution'],
    telemetrySummaryFields: ['cardSubmitted', 'errorBucket'],
    misconceptionTags: ['random_restart', 'range_equals_boundary'],
    aiPageGoal: '固定参数化入口与参数范围的职责边界。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-04',
  },
  'step-05': {
    layout: { template: 'formula_workspace_board', regions: [{ id: 'targets', width: 'full', order: 1 }, { id: 'formula', width: 'full', order: 2 }, { id: 'normalization', width: 'full', order: 3 }, { id: 'meaning', width: 'full', order: 4 }, { id: 'interaction', width: 'full', order: 5 }] },
    interactionKind: 'activity_card_set',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['card_completion_rate', 'error_bucket_distribution'],
    telemetrySummaryFields: ['cardSubmitted', 'errorBucket'],
    misconceptionTags: ['no_normalization', 'energy_as_gain'],
    aiPageGoal: '固定自由目标与归一化来源，不在本页引入罚项。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-05',
  },
  'step-06': {
    layout: { template: 'method_explanation_board', regions: [{ id: 'problem', width: 'full', order: 1 }, { id: 'steps', width: 'full', order: 2 }, { id: 'closing', width: 'full', order: 3 }] },
    interactionKind: 'none',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'not_applicable', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    misconceptionTags: [],
    aiPageGoal: '解释本课数值优化的真实职责，而不是罗列算法名词。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-06',
  },
  'step-07': {
    layout: { template: 'worked_example_reveal_board', regions: [{ id: 'problem', width: 'full', order: 1 }, { id: 'figure', width: 'half', order: 2 }, { id: 'reveal', width: 'half', order: 3 }] },
    interactionKind: 'teacher_reveal_only',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'teacher_only', teacherStepReveal: 'teacher_toggle', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['view_count', 'teacher_reveal_sync'],
    telemetrySummaryFields: ['viewed', 'teacherRevealCount'],
    misconceptionTags: [],
    aiPageGoal: '给出梯度下降的最小直观印象，不把它误写成主案例求解过程。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-07',
  },
  'step-08': {
    layout: { template: 'results_evidence_board', regions: [{ id: 'formula', width: 'full', order: 1 }, { id: 'weights', width: 'full', order: 2 }, { id: 'table', width: 'full', order: 3 }, { id: 'interaction', width: 'full', order: 4 }] },
    interactionKind: 'single_choice',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['weights_as_constants', 'candidate_is_unique'],
    aiPageGoal: '固定三组权重、三类控制器与时域总表，不再退回单一旧候选。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-08',
  },
  'step-09': {
    layout: { template: 'curve_evidence_board', regions: [{ id: 'figure', width: 'full', order: 1 }, { id: 'reading', width: 'full', order: 2 }, { id: 'table', width: 'full', order: 3 }, { id: 'interaction', width: 'full', order: 4 }] },
    interactionKind: 'activity_card_set',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['card_completion_rate', 'error_bucket_distribution'],
    telemetrySummaryFields: ['cardSubmitted', 'errorBucket'],
    misconceptionTags: ['single_direction_change', 'ignore_peak_cost'],
    aiPageGoal: '把三组候选放回时域与频域证据重新阅读。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-09',
  },
  'step-10': {
    layout: { template: 'curve_evidence_board', regions: [{ id: 'definition', width: 'full', order: 1 }, { id: 'figure', width: 'half', order: 2 }, { id: 'reading', width: 'half', order: 3 }, { id: 'interaction', width: 'full', order: 4 }] },
    interactionKind: 'single_choice',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['pareto_equals_single_best', 'front_as_weight_table'],
    aiPageGoal: '固定 Pareto front 的可视化意义，而不是退回最小例题。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-10',
  },
  'step-11': {
    layout: { template: 'comparison_decision_board', regions: [{ id: 'formula', width: 'full', order: 1 }, { id: 'table', width: 'full', order: 2 }, { id: 'figure', width: 'full', order: 3 }, { id: 'meaning', width: 'full', order: 4 }, { id: 'interaction', width: 'full', order: 5 }] },
    interactionKind: 'single_choice',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['front_equals_delivery', 'same_good_equals_same_value'],
    aiPageGoal: '用参数表、响应图和工程意义卡固定典型前沿点的判断价值。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-11',
  },
  'step-12': {
    layout: { template: 'boundary_case_board', regions: [{ id: 'formula', width: 'full', order: 1 }, { id: 'table', width: 'full', order: 2 }, { id: 'figure', width: 'full', order: 3 }, { id: 'interaction', width: 'full', order: 4 }] },
    interactionKind: 'task_card_workspace',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['field_completion_rate', 'error_bucket_distribution'],
    telemetrySummaryFields: ['fieldCompletion', 'cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['reuse_tracking_language', 'ignore_numeric_validation'],
    aiPageGoal: '把横摇边界案例从目标语言改写推进到数值响应验证。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-12',
  },
  'step-13': {
    layout: { template: 'quiz_group_board', regions: [{ id: 'header', width: 'full', order: 1 }, { id: 'quiz', width: 'full', order: 2 }, { id: 'closing', width: 'full', order: 3 }] },
    interactionKind: 'quiz_group',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions', 'completion_rate'],
    telemetrySummaryFields: ['attemptCount', 'cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['candidate_equals_delivery', 'pareto_equals_single_best'],
    aiPageGoal: '用后测固定本课核心判断链。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-13',
  },
  'step-14': {
    layout: { template: 'summary_handoff_board', regions: [{ id: 'summary', width: 'full', order: 1 }, { id: 'next', width: 'full', order: 2 }] },
    interactionKind: 'none',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'not_applicable', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    misconceptionTags: [],
    aiPageGoal: '完成总结与移交，不在本页提前展开罚函数细节。',
    previewDemoPath: '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/demo?step=step-14',
  },
};

const UNIT_4_4_INTERACTIVE_PAGE_TYPES = new Set<UNIT_4_4PageType>([
  'quiz_group',
  'activity_card_set',
  'single_choice',
  'teacher_reveal_only',
  'task_card_workspace',
]);

const UNIT_4_4_PER_CARD_QUIZ_STEPS = new Set(['step-03', 'step-13']);
const UNIT_4_4_PER_CARD_TEXT_STEPS = new Set(['step-12']);

export const UNIT_4_4_PARETO_FRONT_READING_BULLETS = [
  '越往左走，控制能量更小，但 ITAE 会明显变差。',
  '越往上走，拖尾改善有限，但动作代价更容易被压低。',
  'Pareto front 不是绝对最优点，而是一族可继续保留的候选。',
] as const;

export const UNIT_4_4_PARETO_POINT_READING_BULLETS = [
  '从 P_3 走向 P_1，可以显著压低 ITAE，但必须接受更高控制能量。',
  '从 P_1 回到 P_3，可以大幅节省动作代价，但必须接受更长拖尾。',
  'P_2 夹在中间，没有把另一边彻底碾压掉。',
] as const;

export const UNIT_4_4_LESSON_STEPS: readonly UNIT_4_4StepDefinition[] = [
  { id: 'step-01', stage: 'B', title: '客船航向保持对象与多目标拉扯：为什么经典试凑会停住', hint: '先交代对象与拉扯，再固定本课只产出无约束候选族。', duration: '5 min', pageType: 'display' },
  { id: 'step-02', stage: 'O', title: '本次课程目标：这一课要把哪些判断写实', hint: '显式呈现本课课程目标，不提前放入证据表和图片。', duration: '4 min', pageType: 'display' },
  { id: 'step-03', stage: 'P1', title: '四组经典试凑结果：多目标拉扯先被证据看见', hint: '先用四组证据固定多目标拉扯，再把前测放到页面最后。', duration: '7 min', pageType: 'quiz_group' },
  { id: 'step-04', stage: 'P2', title: '参数化入口：起点、参数向量与参数范围从哪里来', hint: '固定参数化入口与参数范围的职责边界。', duration: '6 min', pageType: 'activity_card_set' },
  { id: 'step-05', stage: 'P2', title: '自由目标与归一化：怎样把偏好写成同一套比较语言', hint: '固定自由目标与归一化来源，不在本页引入罚项。', duration: '7 min', pageType: 'activity_card_set' },
  { id: 'step-06', stage: 'P2', title: '数值优化到底在这门课里做什么', hint: '解释本课数值优化的真实职责，而不是罗列算法名词。', duration: '6 min', pageType: 'display' },
  { id: 'step-07', stage: 'P2', title: '梯度下降最小例子：搜索为什么会沿代价面下滑', hint: '给出梯度下降的最小直观印象，不把它误写成主案例求解过程。', duration: '7 min', pageType: 'teacher_reveal_only' },
  { id: 'step-08', stage: 'P2', title: '主案例总表：起始方案与三组无约束权重方案如何分化', hint: '固定三组权重、三类控制器与时域总表，不再退回单一旧候选。', duration: '7 min', pageType: 'single_choice' },
  { id: 'step-09', stage: 'P2', title: '时域与频域对比：三组候选到底换来了什么', hint: '把三组候选放回时域与频域证据重新阅读。', duration: '8 min', pageType: 'activity_card_set' },
  { id: 'step-10', stage: 'P2', title: 'Pareto front：为什么会出现一族同样值得保留的设计', hint: '固定 Pareto front 的可视化意义，而不是退回最小例题。', duration: '6 min', pageType: 'single_choice' },
  { id: 'step-11', stage: 'P2', title: '三个典型前沿点：它们为什么在 Pareto 意义下同样好', hint: '用参数表、响应图和工程意义卡固定典型前沿点的判断价值。', duration: '7 min', pageType: 'single_choice' },
  { id: 'step-12', stage: 'P2', title: '横摇边界案例：目标语言一变，数值响应也必须跟着变', hint: '把横摇边界案例从目标语言改写推进到数值响应验证。', duration: '9 min', pageType: 'task_card_workspace' },
  { id: 'step-13', stage: 'P3', title: '后测：判断链是否已经形成', hint: '用后测固定本课核心判断链。', duration: '5 min', pageType: 'quiz_group' },
  { id: 'step-14', stage: 'S', title: '总结与移交：把候选族交给 4-5 做工程复核', hint: '完成总结与移交，不在本页提前展开罚函数细节。', duration: '4 min', pageType: 'display' },
] as const;

function fallbackManifestStep(step: UNIT_4_4StepDefinition): InteractiveRuntimeStepManifest {
  const contract = UNIT_4_4_PAGE_CONTRACTS[step.id];
  return {
    id: step.id,
    title: step.title,
    layout: contract.layout,
    modules: [],
    contentBlocks: {},
    evidenceSequence: [],
    interactionSpec: {
      interactionKind: contract.interactionKind,
    },
    teacherControls: contract.teacherControls,
    studentAccess: {},
    teacherInsightSpec: { widgets: contract.teacherInsightWidgets },
    telemetrySpec: {
      summaryFields: contract.telemetrySummaryFields,
      misconceptionTags: contract.misconceptionTags ?? [],
    },
    aiContextSpec: {
      pageGoal: contract.aiPageGoal,
      deliveryMode: 'hidden_page_context',
    },
    interactiveFigureSpec: {},
    previewContract: { demoPath: contract.previewDemoPath },
    acceptanceChecks: [],
  };
}

export const UNIT_4_4_RUNTIME_MANIFEST: InteractiveRuntimeManifest = {
  lessonId: '4-4',
  courseTitle: UNIT_4_4_COURSE_TITLE,
  courseRouteSegment: UNIT_4_4_ROUTE_SEGMENT,
  previewMode: {},
  mediaPolicy: {},
  telemetryStrategy: 'runtime_externalized',
  teacherInsightStrategy: 'runtime_externalized',
  requiredStepFields: [],
  stepOrder: UNIT_4_4_LESSON_STEPS.map((step) => step.id),
  steps: UNIT_4_4_LESSON_STEPS.map(fallbackManifestStep),
};

export function getUNIT_4_4ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  const activeManifest = manifest ?? UNIT_4_4_RUNTIME_MANIFEST;
  return activeManifest.steps.find((step) => step.id === stepId) ?? activeManifest.steps[0];
}

export function getUNIT_4_4PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_4_4ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_4_4Step(stepId: string) {
  return UNIT_4_4_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_4_4_LESSON_STEPS[0];
}

export function getUNIT_4_4PageContract(stepId: string) {
  return UNIT_4_4_PAGE_CONTRACTS[stepId] ?? UNIT_4_4_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_4_4InteractivePageType(pageType: UNIT_4_4PageType) {
  return UNIT_4_4_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_4_4AiPageType(_pageType: UNIT_4_4PageType) {
  return false;
}

export function isUNIT_4_4StepReleasedByDefault(
  stepId: string,
  manifest?: InteractiveRuntimeManifest | null,
) {
  const contract = manifest
    ? getUNIT_4_4PageContractFromManifest(manifest, stepId)
    : getUNIT_4_4PageContract(stepId);
  return (
    contract.teacherControls.releaseActivity === 'page_load_open' ||
    contract.teacherControls.releaseActivity === 'not_applicable'
  );
}

export function isUNIT_4_4PerCardQuizStep(stepId: string) {
  return UNIT_4_4_PER_CARD_QUIZ_STEPS.has(stepId);
}

export function isUNIT_4_4PerCardTextStep(stepId: string) {
  return UNIT_4_4_PER_CARD_TEXT_STEPS.has(stepId);
}

export function createEmptyUNIT_4_4StudentState(studentName: string): UNIT_4_4StudentCourseState {
  return {
    kind: 'unit44_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_4_4_PREMIUM_LESSON_CARD = {
  id: 'unit-4-4-fixed-structure-optimization-modeling',
  title: UNIT_4_4_COURSE_TITLE,
  description: '精品互动课：把固定结构的多目标拉扯、无约束候选族与 Pareto 最小取舍落成可审阅课堂。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_4_4_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_4_4_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-03': '/course-runtime/lessons/4-4/media/4-4-ship-heading-diagnosis-compare.png',
  'step-04': '/course-runtime/lessons/4-4/media/4-4-ship-heading-optimization-compare.png',
  'step-09': '/course-runtime/lessons/4-4/media/4-4-ship-heading-unconstrained-weight-compare.png',
  'step-11': '/course-runtime/lessons/4-4/media/4-4-pareto-response-compare.png',
  'step-12': '/course-runtime/lessons/4-4/media/4-4-roll-optimization-compare.png',
  'step-14': '/course-runtime/lessons/4-4/media/4-4-info.png',
};

export function getUNIT_4_4MediaSrc(stepId: string) {
  return UNIT_4_4_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_4_4StudentState(value: unknown): value is UNIT_4_4StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_4StudentCourseState>;
  return data.kind === 'unit44_student_state' && data.version === 1;
}

export function isUNIT_4_4TeacherSyncState(value: unknown): value is UNIT_4_4TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_4TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit44' && typeof data.activeStepId === 'string';
}

export const UNIT_4_4_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_4_4StudentCourseState,
  UNIT_4_4TeacherCourseSyncState,
  UNIT_4_4TeacherSyncInput
> = {
  lessonKey: UNIT_4_4_LESSON_KEY,
  studentItemId: UNIT_4_4_STUDENT_ITEM_ID,
  teacherItemId: UNIT_4_4_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_4_4_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_4_4_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_4_4StudentState,
  isStudentState: isUNIT_4_4StudentState,
  isTeacherSyncState: isUNIT_4_4TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit44',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_4_4TeacherSync(input: UNIT_4_4TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_4_4TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_4_4TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_4_4TeacherSession(input: UNIT_4_4TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_4_4_LESSON_STEPS,
  }));
}
