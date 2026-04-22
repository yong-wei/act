import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_4StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_3_4TeacherControlMode =
  | 'not_applicable'
  | 'separate_toggle'
  | 'teacher_toggle'
  | 'page_load_open'
  | 'teacher_only'
  | 'always_on';

export type UNIT_3_4PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'sequence_sort'
  | 'hotspot_labeling'
  | 'activity_cards'
  | 'worked_example_workspace'
  | 'triple_match'
  | 'binary_choice';

export interface UNIT_3_4PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_4PageContract {
  layout: {
    template: string;
    regions: UNIT_3_4PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_3_4PageType, 'display' | 'summary'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  teacherControls: {
    releaseActivity: UNIT_3_4TeacherControlMode;
    openBrowse: UNIT_3_4TeacherControlMode;
    teacherStepReveal: UNIT_3_4TeacherControlMode;
    revealReferenceAnswer: UNIT_3_4TeacherControlMode;
    instructorDemoTools: string[];
  };
  aiDeliveryMode: 'hidden_page_context';
  previewDemoPath: string;
}

export interface UNIT_3_4StepDefinition {
  id: string;
  stage: UNIT_3_4StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_4PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_3_4StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_4StudentCourseState {
  kind: 'unit34_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_4StepResponse>;
}

export interface UNIT_3_4TeacherCourseSyncState {
  kind: 'teacher_sync_unit34';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_3_4TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_4TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_4TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_4_ROUTE_SEGMENT = 'unit-3-4-root-locus-reading-validation';
export const UNIT_3_4_PRESET_KEY = 'unit-3-4-root-locus-reading-validation-v1';
export const UNIT_3_4_RESOURCE_KEY = 'unit-3-4-root-locus-reading-validation';
export const UNIT_3_4_LESSON_KEY = UNIT_3_4_PRESET_KEY;
export const UNIT_3_4_STUDENT_ITEM_ID = 'student:unit34:state';
export const UNIT_3_4_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_4_STUDENT_STATE_KEY = 'course';
export const UNIT_3_4_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_4_COURSE_TITLE = '3-4：根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上';
export const UNIT_3_4_COURSE_SUBTITLE = 'Root Locus Reading Validation';
export const UNIT_3_4_COURSE_DESCRIPTION =
  '围绕关键节点读图、参数窗口判断、根轨迹增益换算、对象化三域验证与广义根轨迹改写，把 3-3 的根轨迹法则压成真正可执行的工程判断动作链。';

export const UNIT_3_4_STAGE_LABEL: Record<UNIT_3_4StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_3_4_STAGE_MAP: Record<UNIT_3_4StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_3_4_PAGE_CONTRACTS: Record<string, UNIT_3_4PageContract> = {
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
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
      instructorDemoTools: ['highlight_path_node'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'goal_chain_slide',
      regions: [
        { id: 'question', width: 'full', order: 1 },
        { id: 'outputs', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
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
      instructorDemoTools: ['highlight_output_chain'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'version_overview_quiz',
      regions: [
        { id: 'object', width: 'full', order: 1 },
        { id: 'versions', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'timeOnStep'],
    misconceptionTags: ['stable_means_usable', 'ignore_object_formula', 'no_version_context'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['show_option_distribution'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'workflow_sort_board',
      regions: [
        { id: 'workflow', width: 'full', order: 1 },
        { id: 'interaction', width: 'full', order: 2 },
        { id: 'feedback', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'sequence_sort',
    teacherInsightWidgets: ['sort_success_rate'],
    telemetrySummaryFields: ['attemptCount', 'resultState'],
    misconceptionTags: ['judge_before_read', 'skip_keynodes'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['show_sort_heatmap'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'evidence_reading_board',
      regions: [
        { id: 'evidence', width: 'full', order: 1 },
        { id: 'interaction', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'hotspot_labeling',
    teacherInsightWidgets: ['hotspot_accuracy', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['separation_equals_boundary', 'cannot_locate_B', 'node_name_only'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['highlight_key_nodes'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'record_workspace',
      regions: [
        { id: 'record', width: 'full', order: 1 },
        { id: 'interaction', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['error_bucket_distribution', 'card_completion_rate'],
    telemetrySummaryFields: ['cardSubmitted', 'errorBucket', 'timeOnStep'],
    misconceptionTags: ['position_without_consequence', 'adjective_only'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['show_submission_examples'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'comparison_judgement_board',
      regions: [
        { id: 'definition', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['cardSubmitted', 'resultState', 'errorBucket'],
    misconceptionTags: ['stable_equals_acceptable', 'no_cost_language'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['show_window_confusions'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'worked_example_reveal',
      regions: [
        { id: 'principle', width: 'full', order: 1 },
        { id: 'problem', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
        { id: 'reference', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate'],
    telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['copy_result_only', 'k_equals_K'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'teacher_toggle',
      teacherStepReveal: 'teacher_toggle',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['advance_derivation'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'evidence_matrix_slide',
      regions: [
        { id: 'roles', width: 'full', order: 1 },
        { id: 'matrix', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['match_success_rate'],
    telemetrySummaryFields: ['attemptCount', 'resultState'],
    misconceptionTags: ['new_course_branch', 'no_domain_role'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['show_role_mapping'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'comparison_panel_with_toggle',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'analysis', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['error_bucket_distribution', 'card_completion_rate'],
    telemetrySummaryFields: ['cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['B_is_best_without_cost', 'graph_only_no_explanation'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['toggle_time_domain_focus'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'table_figure_workspace',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['error_bucket_distribution'],
    telemetrySummaryFields: ['cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['faster_only_no_cost', 'frequency_cost_omitted'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['show_frequency_readings'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'dual_evidence_compare_workspace',
      regions: [
        { id: 'track-b', width: 'full', order: 1 },
        { id: 'track-c', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['cardSubmitted', 'resultState'],
    misconceptionTags: ['track_gain_without_cost', 'window_misjudge'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['toggle_dual_evidence'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'worked_example_reveal',
      regions: [
        { id: 'principle', width: 'full', order: 1 },
        { id: 'problem', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
        { id: 'reference', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate'],
    telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted'],
    misconceptionTags: ['a_equals_gain', 'no_rewrite_needed', 'wrong_locus_type'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'teacher_toggle',
      teacherStepReveal: 'teacher_toggle',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['advance_derivation'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'parameter_window_compare_board',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['question_distribution', 'error_bucket_distribution'],
    telemetrySummaryFields: ['cardSubmitted', 'resultState'],
    misconceptionTags: ['bigger_a_is_better', 'no_window_language'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['compare_parameter_windows'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'posttest_board',
      regions: [
        { id: 'title', width: 'full', order: 1 },
        { id: 'questions', width: 'full', order: 2 },
        { id: 'feedback', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'accuracy_summary', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'timeOnStep'],
    misconceptionTags: ['stable_is_enough', 'k_not_converted', 'a_as_gain'],
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
      instructorDemoTools: ['show_posttest_gaps'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-15',
  },
  'step-16': {
    layout: {
      template: 'summary_exit_board',
      regions: [
        { id: 'takeaways', width: 'full', order: 1 },
        { id: 'final', width: 'full', order: 2 },
        { id: 'boundary', width: 'full', order: 3 },
        { id: 'next', width: 'full', order: 4 },
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
      instructorDemoTools: ['highlight_next_unit'],
    },
    aiDeliveryMode: 'hidden_page_context',
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-16',
  },
};

export const UNIT_3_4_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_4PageType>([
  'quiz_group',
  'sequence_sort',
  'hotspot_labeling',
  'activity_cards',
  'worked_example_workspace',
  'triple_match',
  'binary_choice',
]);

export const UNIT_3_4_LESSON_STEPS: UNIT_3_4StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图：从 `3-3` 法则走向 `3-4` 判断',
    hint: '先标定本课在模块 3 里的位置，不重讲法则证明，只负责按图判断。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'O',
    title: '问题提出与三张记录表：稳定之后还要回答什么',
    hint: '把关键节点、参数窗口、三域验证与广义参数记录成完整判断链。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-03',
    stage: 'P1',
    title: '固定对象与三个版本：先暴露“稳定=可用”的第一误判',
    hint: '对象、版本和误判要同页出现，不能先把证据链抽空。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '固定读图顺序：先骨架，再关键节点，再窗口，再后果',
    hint: '先定住读图动作链，后续版本判断才不会串层。',
    duration: '6 min',
    pageType: 'sequence_sort',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '关键节点证据板：分离点、虚轴交点与参考工作点 `B`',
    hint: '关键节点必须回到主图证据和工程问题，不只是会背名称。',
    duration: '7 min',
    pageType: 'hotspot_labeling',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '关键节点读图记录：把主图证据写成一句工程判断',
    hint: '关键节点、版本位置和工程后果要写成完整句，而不是碎片词。',
    duration: '7 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '稳定窗口与可接受窗口：`A/B/C` 各自处在哪一侧',
    hint: '稳定窗口不等于可接受窗口，必须保留代价语言。',
    duration: '7 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '增益换算链：从图上的 `k` 落回工程参数 `K`',
    hint: '题面常显、步骤显影，先完成 k 到 K 的完整换算链。',
    duration: '8 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '为什么必须三域互证：主图、时域、频域先并排对齐',
    hint: '先认清三域各回答什么，再进入局部验证。',
    duration: '6 min',
    pageType: 'triple_match',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '时域验证：版本 `B` 为什么能够作为参考工作点',
    hint: '图后继续读近似说明与局限，不把时域图当作单独结论。',
    duration: '7 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '频域代价：版本 `C` 为什么不能只看跟踪收益',
    hint: '按 4.5 的频域比较表和 Bode 对照，把收益与代价同时写出来。',
    duration: '7 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '斜坡响应与航迹对照：连续跟踪中的收益与代价',
    hint: '按 4.6 同时保留 B/C 两张图，把连续跟踪中的收益和风险写成完整句。',
    duration: '7 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '广义根轨迹与等效改写：局部反馈系数 `a` 为什么不是“再调一次 `K`”',
    hint: '对象先改写，再继续用根轨迹条件；本页必须保留完整显影链。',
    duration: '6 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '非增益参数窗口记录：`a` 从 `0` 到 `1` 怎样改写主导极点',
    hint: '要同时写出比较基线、窗口建议与边界提醒。',
    duration: '7 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-15',
    stage: 'P3',
    title: '后测：读图、换算、三域与广义参数是否已经成链',
    hint: '后测只检查是否形成完整判断链，不混入新的设计任务。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-16',
    stage: 'S',
    title: '收束与去向：沿既有结构分析的能力与边界',
    hint: '把本课能力边界收束到 3-5 的结构改变入口。',
    duration: '4 min',
    pageType: 'summary',
  },
] as const;

export function getUNIT_3_4Step(stepId: string) {
  return UNIT_3_4_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_4_LESSON_STEPS[0];
}

export function getUNIT_3_4PageContract(stepId: string) {
  return UNIT_3_4_PAGE_CONTRACTS[stepId] ?? UNIT_3_4_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_4InteractivePageType(pageType: UNIT_3_4PageType) {
  return UNIT_3_4_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_4AiPageType(_pageType: UNIT_3_4PageType) {
  return false;
}

export function createEmptyUNIT_3_4StudentState(studentName: string): UNIT_3_4StudentCourseState {
  return {
    kind: 'unit34_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_4_PREMIUM_LESSON_CARD = {
  id: 'unit-3-4-root-locus-reading-validation',
  title: UNIT_3_4_COURSE_TITLE,
  description: '精品互动课：关键节点、参数窗口、增益换算、三域互证与广义根轨迹。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_4_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_4_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-10': '/course-runtime/lessons/3-4/media/3-4-step-compare.png',
  'step-11': '/course-runtime/lessons/3-4/media/3-4-bode-compare.png',
  'step-13': '/course-runtime/lessons/3-4/media/3-4-local-feedback-block.png',
  'step-14': '/course-runtime/lessons/3-4/media/3-4-generalized-root-locus.png',
  'step-16': '/course-runtime/lessons/3-4/media/3-4-info.png',
};

export function getUNIT_3_4MediaSrc(stepId: string) {
  return UNIT_3_4_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_4StudentState(value: unknown): value is UNIT_3_4StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_4StudentCourseState>;
  return data.kind === 'unit34_student_state' && data.version === 1;
}

export function isUNIT_3_4TeacherSyncState(value: unknown): value is UNIT_3_4TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_4TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit34' && typeof data.activeStepId === 'string';
}

export const UNIT_3_4_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_4StudentCourseState,
  UNIT_3_4TeacherCourseSyncState,
  UNIT_3_4TeacherSyncInput
> = {
  lessonKey: UNIT_3_4_LESSON_KEY,
  studentItemId: UNIT_3_4_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_4_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_4_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_4_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_4StudentState,
  isStudentState: isUNIT_3_4StudentState,
  isTeacherSyncState: isUNIT_3_4TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit34',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_4TeacherSync(input: UNIT_3_4TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_4TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_3_4TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_3_4TeacherSession(input: UNIT_3_4TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
