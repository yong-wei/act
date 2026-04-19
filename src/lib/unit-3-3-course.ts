import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_3StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_3_3PageType =
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'interval_input'
  | 'short_response'
  | 'reason_check'
  | 'region_highlight'
  | 'triple_match'
  | 'activity_cards'
  | 'sequence_sort'
  | 'classification_cards'
  | 'classification_drag'
  | 'formula_completion'
  | 'worked_example_workspace'
  | 'formula_ordering'
  | 'tab_switch'
  | 'mapping_highlight'
  | 'parameter_workspace'
  | 'comparison_workspace'
  | 'ai_compare_workspace'
  | 'formula_pair_check'
  | 'quiz_group';

export interface UNIT_3_3PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_3PageContract {
  layout: {
    template: string;
    regions: UNIT_3_3PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_3_3PageType, 'display' | 'summary'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export type Unit33WorkspaceKind =
  | 'region-highlight'
  | 'worked-example'
  | 'formula-ordering'
  | 'mapping-highlight'
  | 'none';

export interface UNIT_3_3StepDefinition {
  id: string;
  stage: UNIT_3_3StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_3PageType;
  workspaceKind?: Unit33WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_3_3StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_3StudentCourseState {
  kind: 'unit33_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_3StepResponse>;
}

export interface UNIT_3_3TeacherCourseSyncState {
  kind: 'teacher_sync_unit33';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_3_3TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_3TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_3TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_3_ROUTE_SEGMENT = 'unit-3-3-root-locus-rules';
export const UNIT_3_3_PRESET_KEY = 'unit-3-3-root-locus-rules-v1';
export const UNIT_3_3_RESOURCE_KEY = 'unit-3-3-root-locus-rules';
export const UNIT_3_3_LESSON_KEY = UNIT_3_3_PRESET_KEY;
export const UNIT_3_3_STUDENT_ITEM_ID = 'student:unit33:state';
export const UNIT_3_3_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_3_STUDENT_STATE_KEY = 'course';
export const UNIT_3_3_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_3_COURSE_TITLE = '3-3：根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移';
export const UNIT_3_3_COURSE_SUBTITLE = 'Root Locus Rules';
export const UNIT_3_3_COURSE_DESCRIPTION =
  '围绕闭环特征方程到 GH=-1 的入口、根轨迹完整法则、广义根轨迹与动态翻译，建立模块 3 的迁移机制主线。';

export const UNIT_3_3_STAGE_LABEL: Record<UNIT_3_3StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_3_3_STAGE_MAP: Record<UNIT_3_3StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_3_3_PAGE_CONTRACTS: Record<string, UNIT_3_3PageContract> = {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-01',
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
    teacherInsightWidgets: ['option_distribution', 'reveal_correction_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen', 'timeOnStep'],
    misconceptionTags: ['boundary_is_enough'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-02',
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
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'definition_formula_figure',
      regions: [
        { id: 'definition', width: 'full', order: 1 },
        { id: 'example', width: 'full', order: 2 },
        { id: 'reflection', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'short_response',
    teacherInsightWidgets: ['response_word_cloud', 'common_reason_tags'],
    telemetrySummaryFields: ['responseSubmitted', 'responseLength', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'equation_condition_workspace',
      regions: [
        { id: 'equation', width: 'full', order: 1 },
        { id: 'geometry', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['reason_distribution'],
    telemetrySummaryFields: ['selectedReason', 'attemptCount', 'teacherRevealSeen'],
    misconceptionTags: ['magnitude_before_angle'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'rules_overview_board',
      regions: [
        { id: 'main-figure', width: 'full', order: 1 },
        { id: 'rule-cards', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'region_highlight',
    teacherInsightWidgets: ['rule_confusion_heatmap'],
    telemetrySummaryFields: ['highlightChoice', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['jump_to_keypoints_too_early'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'worked_example_workspace',
      regions: [
        { id: 'principle', width: 'full', order: 1 },
        { id: 'problem', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['activity_completion_rate', 'top_missing_steps'],
    telemetrySummaryFields: ['cardResultStates', 'stepRevealCount', 'completedCards'],
    misconceptionTags: ['real_axis_segment_error', 'asymptote_formula_missing'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'keypoint_framework_board',
      regions: [
        { id: 'cards', width: 'full', order: 1 },
        { id: 'formulas', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['keypoint_mismatch_pairs'],
    telemetrySummaryFields: ['matchAttempted', 'matchCorrected', 'teacherRevealSeen'],
    misconceptionTags: ['keypoint_role_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'worked_example_workspace',
      regions: [
        { id: 'principle', width: 'full', order: 1 },
        { id: 'problem', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['activity_completion_rate', 'top_missing_steps'],
    telemetrySummaryFields: ['cardResultStates', 'stepRevealCount', 'completedCards'],
    misconceptionTags: ['candidate_point_unscreened', 'routh_boundary_misread'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'worked_example_workspace',
      regions: [
        { id: 'principle', width: 'full', order: 1 },
        { id: 'problem', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['activity_completion_rate', 'top_missing_steps'],
    telemetrySummaryFields: ['cardResultStates', 'stepRevealCount', 'completedCards'],
    misconceptionTags: ['departure_angle_only', 'root_sum_ignored'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'workflow_sort_board',
      regions: [
        { id: 'workflow', width: 'full', order: 1 },
        { id: 'interaction', width: 'full', order: 2 },
        { id: 'feedback', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'sequence_sort',
    teacherInsightWidgets: ['workflow_error_heatmap'],
    telemetrySummaryFields: ['sortAttemptCount', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['workflow_order_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'pole_type_compare_board',
      regions: [
        { id: 'cards', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'classification_cards',
    teacherInsightWidgets: ['classification_accuracy_distribution'],
    telemetrySummaryFields: ['cardResultStates', 'teacherRevealSeen'],
    misconceptionTags: ['pole_type_trend_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'equivalent_open_loop_chain',
      regions: [
        { id: 'rewrite', width: 'full', order: 1 },
        { id: 'equivalent', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'formula_ordering',
    teacherInsightWidgets: ['ordering_error_patterns'],
    telemetrySummaryFields: ['sortAttemptCount', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['generalized_as_new_algorithm'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'compare_dual_root_locus',
      regions: [
        { id: 'example', width: 'full', order: 1 },
        { id: 'compare', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'tab_switch',
    teacherInsightWidgets: ['tab_attention_distribution'],
    telemetrySummaryFields: ['tabVisited', 'timeOnTab'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'dynamic_translation_panel',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'mapping_highlight',
    teacherInsightWidgets: ['translation_error_map'],
    telemetrySummaryFields: ['mappingChoice', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['geometry_without_dynamics'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-15',
  },
  'step-16': {
    layout: {
      template: 'posttest_board',
      regions: [
        { id: 'intro', width: 'full', order: 1 },
        { id: 'quiz', width: 'full', order: 2 },
        { id: 'review', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['post_quiz_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket', 'teacherRevealSeen'],
    misconceptionTags: ['condition_order_error', 'workflow_flattened', 'generalized_translation_weak'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-16',
  },
  'step-17': {
    layout: {
      template: 'summary_exit_board',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'infographic', width: 'full', order: 2 },
        { id: 'next-step', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-17',
  },
};

export const UNIT_3_3_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_3PageType>([
  'binary_choice',
  'short_response',
  'reason_check',
  'region_highlight',
  'triple_match',
  'activity_cards',
  'sequence_sort',
  'classification_cards',
  'worked_example_workspace',
  'formula_ordering',
  'tab_switch',
  'mapping_highlight',
  'quiz_group',
]);

export const UNIT_3_3_LESSON_STEPS: UNIT_3_3StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图：为什么稳定边界还不等于迁移机制',
    hint: '先把 3-3 放回 3-2 与 3-4 之间的模块位置，说明为什么只知道稳定边界还不够。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'P1',
    title: '问题引入：知道稳定区间为什么仍然不够',
    hint: '用主图和四问暴露“只知道边界点就够了”的误判。',
    duration: '5 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '本课目标与研究对象：我们要跟踪的是谁',
    hint: '明确本课研究对象、主线链和不负责的边界。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '根轨迹定义：参数变化下的闭环根集合',
    hint: '把根轨迹从“单点求根”切换成“闭环根集合”的连续迁移视角。',
    duration: '8 min',
    pageType: 'short_response',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '从 `1+L(s)=0` 到相角条件与幅值条件',
    hint: '把方程链、几何图与两大判据放回同一页，并稳住先资格后参数的顺序。',
    duration: '10 min',
    pageType: 'reason_check',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '骨架法则板：起点终点、实轴区段与渐近线',
    hint: '先用骨架法则搭出整张图的大势，不提前跳进关键节点。',
    duration: '12 min',
    pageType: 'region_highlight',
    workspaceKind: 'region-highlight',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '例题 1：只用骨架法则先判断整体走向',
    hint: '先把骨架法则压到完整题面里，再做双卡作答。',
    duration: '10 min',
    pageType: 'worked_example_workspace',
    workspaceKind: 'worked-example',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '关键节点与局部方向：分离点、虚轴交点、出射角、入射角、根之和',
    hint: '把不同关键节点的职责拆开，并说明它们各自回答什么问题。',
    duration: '10 min',
    pageType: 'triple_match',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '例题 2：用 `dK/ds` 与劳斯判据找关键节点',
    hint: '在同一题里区分实轴关键点与稳定边界的不同判断职责。',
    duration: '12 min',
    pageType: 'worked_example_workspace',
    workspaceKind: 'worked-example',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '例题 3：复极点附近怎样离开，整张图怎样自洽',
    hint: '把局部出射角与整图根和守恒放到同一道题里打通。',
    duration: '7 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '读图顺序：先骨架，再关键点，最后补局部方向',
    hint: '把法则清单重组为真实可执行的七步读图顺序。',
    duration: '6 min',
    pageType: 'sequence_sort',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '三类开环极点：原点极点、实轴极点、共轭复极点',
    hint: '把对象类型与轨迹趋势线索直接对应起来。',
    duration: '5 min',
    pageType: 'classification_cards',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '广义根轨迹：一般参数如何改写成标准问题',
    hint: '说明法则没有变，变化的是参数被送入等效开环的方式。',
    duration: '6 min',
    pageType: 'formula_ordering',
    workspaceKind: 'formula-ordering',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '时间常数例子与 `0^\\circ / 180^\\circ` 根轨迹对照',
    hint: '把时间常数例子与 0° / 180° 对照放回统一的广义根轨迹视角。',
    duration: '6 min',
    pageType: 'tab_switch',
  },
  {
    id: 'step-15',
    stage: 'P2',
    title: '动态翻译：怎样把根轨迹重新读回稳定性、快慢与振荡',
    hint: '把图上的迁移重新翻译成稳定性、快慢、拖尾与振荡趋势。',
    duration: '6 min',
    pageType: 'mapping_highlight',
    workspaceKind: 'mapping-highlight',
  },
  {
    id: 'step-16',
    stage: 'P3',
    title: '后测：条件、法则、改写与读图顺序是否已经成链',
    hint: '用三题后测检查条件入口、法则层次、广义改写与动态翻译是否已经连成链。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-17',
    stage: 'S',
    title: '收束与去向：九项法则带走什么，`3-4` 从哪里接走',
    hint: '用五条结论和下一课去向卡收束本课。',
    duration: '4 min',
    pageType: 'display',
  },
] as const;

export function getUNIT_3_3Step(stepId: string) {
  return UNIT_3_3_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_3_LESSON_STEPS[0];
}

export function getUNIT_3_3PageContract(stepId: string) {
  return UNIT_3_3_PAGE_CONTRACTS[stepId] ?? UNIT_3_3_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_3InteractivePageType(pageType: UNIT_3_3PageType) {
  return UNIT_3_3_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_3AiPageType(_pageType: UNIT_3_3PageType) {
  return true;
}

export function createEmptyUNIT_3_3StudentState(studentName: string): UNIT_3_3StudentCourseState {
  return {
    kind: 'unit33_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_3_PREMIUM_LESSON_CARD = {
  id: 'unit-3-3-root-locus-rules',
  title: UNIT_3_3_COURSE_TITLE,
  description: '精品互动课：把稳定边界推进成极点迁移机制、完整法则、广义视角与动态翻译。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_3_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_3_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/3-3/media/3-3-pp-04-complete-rules-example.svg',
  'step-05': '/course-runtime/lessons/3-3/media/3-3-pp-03-angle-and-magnitude-geometry.svg',
  'step-06': '/course-runtime/lessons/3-3/media/3-3-pp-04-complete-rules-example.svg',
  'step-07': '/course-runtime/lessons/3-3/media/3-3-example-01-skeleton.svg',
  'step-08': '/course-runtime/lessons/3-3/media/3-3-pp-06-departure-arrival-angle.svg',
  'step-09': '/course-runtime/lessons/3-3/media/3-3-example-02-breakaway-crossing.svg',
  'step-10': '/course-runtime/lessons/3-3/media/3-3-example-03-departure-sum.svg',
  'step-14': '/course-runtime/lessons/3-3/media/3-3-pp-07-generalized-time-constant-example.svg',
  'step-15': '/course-runtime/lessons/3-3/media/3-3-pp-08-dynamics-translation.svg',
  'step-17': '/course-runtime/lessons/3-3/media/3-3-info.png',
};

export function getUNIT_3_3MediaSrc(stepId: string) {
  return UNIT_3_3_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_3StudentState(value: unknown): value is UNIT_3_3StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_3StudentCourseState>;
  return data.kind === 'unit33_student_state' && data.version === 1;
}

export function isUNIT_3_3TeacherSyncState(value: unknown): value is UNIT_3_3TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_3TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit33' && typeof data.activeStepId === 'string';
}

export const UNIT_3_3_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_3StudentCourseState,
  UNIT_3_3TeacherCourseSyncState,
  UNIT_3_3TeacherSyncInput
> = {
  lessonKey: UNIT_3_3_LESSON_KEY,
  studentItemId: UNIT_3_3_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_3_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_3_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_3_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_3StudentState,
  isStudentState: isUNIT_3_3StudentState,
  isTeacherSyncState: isUNIT_3_3TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit33',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_3TeacherSync(input: UNIT_3_3TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_3TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_3_3TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_3TeacherSession(input: UNIT_3_3TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
