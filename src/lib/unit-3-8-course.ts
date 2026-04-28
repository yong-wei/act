import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { InteractiveRuntimeManifest, InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_8StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3';
export type UNIT_3_8TeacherControlMode =
  | 'not_applicable'
  | 'separate_toggle'
  | 'teacher_only'
  | 'always_on';

export type UNIT_3_8PageType =
  | 'none'
  | 'quiz_group'
  | 'row_focus_toggle'
  | 'curve_compare_panel'
  | 'activity_cards'
  | 'step_reveal'
  | 'reason_chain'
  | 'matrix_choice_cards'
  | 'card_sort'
  | 'hotspot_labeling'
  | 'band_focus_panel'
  | 'goal_cards_plus_ai'
  | 'evidence_mark_cards'
  | 'structured_compare'
  | 'scheme_vote_cards'
  | 'reflection_card';

export interface UNIT_3_8PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_8PageContract {
  layout: {
    template: string;
    regions: UNIT_3_8PageRegionContract[];
  };
  interactionKind: UNIT_3_8PageType;
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  teacherControls: {
    releaseActivity: UNIT_3_8TeacherControlMode;
    openBrowse: UNIT_3_8TeacherControlMode;
    teacherStepReveal: UNIT_3_8TeacherControlMode;
    revealReferenceAnswer: UNIT_3_8TeacherControlMode;
    instructorDemoTools: string[];
  };
  previewDemoPath: string;
}

export interface UNIT_3_8StepDefinition {
  id: string;
  stage: UNIT_3_8StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_8PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_3_8StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_8StudentCourseState {
  kind: 'unit38_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_8StepResponse>;
}

export interface UNIT_3_8TeacherCourseSyncState {
  kind: 'teacher_sync_unit38';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_3_8TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_8TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_8TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_8_ROUTE_SEGMENT = 'unit-3-8-frequency-domain-translation-judgment';
export const UNIT_3_8_PRESET_KEY = 'unit-3-8-frequency-domain-translation-judgment-v1';
export const UNIT_3_8_RESOURCE_KEY = 'unit-3-8-frequency-domain-translation-judgment';
export const UNIT_3_8_LESSON_KEY = UNIT_3_8_PRESET_KEY;
export const UNIT_3_8_STUDENT_ITEM_ID = 'student:unit38:state';
export const UNIT_3_8_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_8_STUDENT_STATE_KEY = 'course';
export const UNIT_3_8_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_8_COURSE_TITLE = '3-8：频域判别与跨域综合语言';
export const UNIT_3_8_COURSE_SUBTITLE = 'Frequency-Domain Translation And Judgment';
export const UNIT_3_8_COURSE_DESCRIPTION =
  '围绕结构变化的频域指纹、Nyquist 与 Bode 统一判稳链、三频段分工和双工程案例读回，把模块 3 的动态线与稳态线收成同一张频域判断地图。';

export const UNIT_3_8_STAGE_LABEL: Record<UNIT_3_8StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测与收束',
};

export const UNIT_3_8_STAGE_MAP: Record<UNIT_3_8StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
};

export const UNIT_3_8_PAGE_CONTRACTS: Record<string, UNIT_3_8PageContract> = {
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
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
      instructorDemoTools: ['highlight_path_node'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'translation_chain_board',
      regions: [
        { id: 'chain', width: 'full', order: 1 },
        { id: 'method', width: 'full', order: 2 },
        { id: 'objective', width: 'full', order: 3 },
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
      instructorDemoTools: ['highlight_chain_node'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-02',
  },
  'step-03': {
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
    misconceptionTags: ['only_watch_magnitude', 'nyquist_skip_p', 'wc_equals_everything', 'nmp_push_bandwidth'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['show_misconception_distribution'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'table_explain_board',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'notes', width: 'full', order: 2 },
        { id: 'focus', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'row_focus_toggle',
    teacherInsightWidgets: ['focus_row_heatmap'],
    telemetrySummaryFields: ['viewed', 'focusedRow'],
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
      instructorDemoTools: ['highlight_selected_row'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'curve_compare_lab',
      regions: [
        { id: 'selector', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'cards', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'curve_compare_panel',
    teacherInsightWidgets: ['variant_distribution', 'band_error_heatmap'],
    telemetrySummaryFields: ['selectedVariant', 'selectedBand', 'cardResultStates'],
    misconceptionTags: ['cannot_locate_frequency_band', 'ignore_phase_cost'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'always_on',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['lock_change_variant', 'toggle_band_overlay'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'worked_example_lab',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'reveal', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['card_accuracy_distribution', 'step_reveal_usage'],
    telemetrySummaryFields: ['cardResultStates', 'stepRevealCount'],
    misconceptionTags: ['band_before_conclusion_missing', 'benefit_cost_mismatch'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['reveal_next_step', 'show_reference_answer'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'formula_story_board',
      regions: [
        { id: 'question', width: 'full', order: 1 },
        { id: 'formula', width: 'full', order: 2 },
        { id: 'note', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'step_reveal',
    teacherInsightWidgets: ['reveal_completion_rate'],
    telemetrySummaryFields: ['viewed', 'revealProgress'],
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'not_applicable',
      instructorDemoTools: ['reveal_symbol_meaning'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'derivation_compare_board',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'geometry', width: 'full', order: 2 },
        { id: 'chain', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_chain',
    teacherInsightWidgets: ['chain_breakpoint_distribution'],
    telemetrySummaryFields: ['sortResultState', 'revealProgress'],
    misconceptionTags: ['nyquist_memorize_without_reason', 'critical_point_origin_confusion'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['reveal_next_formula_link'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'worked_example_quadrant',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'matrix_choice_cards',
    teacherInsightWidgets: ['object_accuracy_distribution', 'common_wrong_reasons'],
    telemetrySummaryFields: ['cardResultStates', 'selectedStabilityLabels'],
    misconceptionTags: ['rhp_zero_equals_unstable', 'skip_pnz_sequence'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['show_pnz_table_row'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'boundary_compare_board',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'compare', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'card_sort',
    teacherInsightWidgets: ['boundary_confusion_rate', 'gain_interval_distribution'],
    telemetrySummaryFields: ['sortResultState', 'selectedGainInterval'],
    misconceptionTags: ['borderline_equals_unstable', 'higher_gain_always_better'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['highlight_boundary_region'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'dual_graph_indicator_locator',
      regions: [
        { id: 'graph', width: 'full', order: 1 },
        { id: 'formula', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'hotspot_labeling',
    teacherInsightWidgets: ['common_mislabels', 'anchor_error_heatmap'],
    telemetrySummaryFields: ['labelResultStates', 'selectedHotspots'],
    misconceptionTags: ['wc_equals_bandwidth', 'bode_as_another_rule'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'always_on',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['show_correct_anchors'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'worked_example_locator',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'reveal', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_cards',
    teacherInsightWidgets: ['margin_sign_distribution', 'correction_direction_distribution'],
    telemetrySummaryFields: ['cardResultStates', 'selectedCorrectionDirection'],
    misconceptionTags: ['negative_margin_not_detected', 'continue_push_wc'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['reveal_reading_order'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'band_focus_board',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'focus', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'band_focus_panel',
    teacherInsightWidgets: ['band_focus_distribution'],
    telemetrySummaryFields: ['focusedBand', 'timeOnStep'],
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'always_on',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
      instructorDemoTools: ['lock_band_focus'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'goal_switch_workspace',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'cards', width: 'full', order: 2 },
        { id: 'ai', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'goal_cards_plus_ai',
    teacherInsightWidgets: ['goal_choice_distribution', 'ai_revision_rate'],
    telemetrySummaryFields: ['cardResultStates', 'aiViewed', 'revisionState'],
    misconceptionTags: ['ask_ai_before_judging', 'goal_band_mapping_confusion'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['open_ai_compare'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'case_baseline_board',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'evidence_mark_cards',
    teacherInsightWidgets: ['evidence_selection_distribution', 'reason_keyword_cloud'],
    telemetrySummaryFields: ['selectedEvidence', 'textResponseLength'],
    misconceptionTags: ['treat_as_low_frequency_problem', 'see_only_time_response'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'always_on',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['highlight_mid_frequency_evidence'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-15',
  },
  'step-16': {
    layout: {
      template: 'case_translation_compare',
      regions: [
        { id: 'translation', width: 'full', order: 1 },
        { id: 'compare', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_compare',
    teacherInsightWidgets: ['focus_band_distribution', 'metric_selection_heatmap'],
    telemetrySummaryFields: ['selectedFocusBand', 'selectedMetrics', 'textResponseLength'],
    misconceptionTags: ['only_repeat_result', 'ignore_mid_frequency_reason'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['reveal_translation_chain', 'toggle_case_overlay'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-16',
  },
  'step-17': {
    layout: {
      template: 'scheme_problem_board',
      regions: [
        { id: 'structure', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'scheme_vote_cards',
    teacherInsightWidgets: ['scheme_choice_distribution', 'tradeoff_selection_heatmap'],
    telemetrySummaryFields: ['selectedScheme', 'selectedTradeoff'],
    misconceptionTags: ['gain_reduction_is_enough', 'only_watch_overshoot'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'always_on',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['highlight_scheme_difference'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-17',
  },
  'step-18': {
    layout: {
      template: 'scheme_compare_lab',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_compare',
    teacherInsightWidgets: ['best_scheme_distribution', 'focus_band_distribution'],
    telemetrySummaryFields: ['selectedScheme', 'selectedFocusBand', 'textResponseLength'],
    misconceptionTags: ['still_choose_gain_only', 'cannot_read_mid_frequency_correction'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'separate_toggle',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['toggle_three_scheme_overlay'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-18',
  },
  'step-19': {
    layout: {
      template: 'posttest_board',
      regions: [
        { id: 'questions', width: 'full', order: 1 },
        { id: 'review', width: 'full', order: 2 },
        { id: 'class', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['posttest_distribution', 'top_remaining_confusions'],
    telemetrySummaryFields: ['cardResultStates', 'exitReflection'],
    misconceptionTags: ['remaining_order_confusion', 'remaining_band_confusion'],
    teacherControls: {
      releaseActivity: 'separate_toggle',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'separate_toggle',
      instructorDemoTools: ['show_remaining_confusions'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-19',
  },
  'step-20': {
    layout: {
      template: 'summary_exit_board',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'info', width: 'full', order: 2 },
        { id: 'next', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reflection_card',
    teacherInsightWidgets: ['reflection_keyword_cloud'],
    telemetrySummaryFields: ['reflectionSubmitted'],
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'always_on',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
      instructorDemoTools: ['toggle_reflection_card'],
    },
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-20',
  },
};

export const UNIT_3_8_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_8PageType>([
  'quiz_group',
  'row_focus_toggle',
  'curve_compare_panel',
  'activity_cards',
  'step_reveal',
  'reason_chain',
  'matrix_choice_cards',
  'card_sort',
  'hotspot_labeling',
  'band_focus_panel',
  'goal_cards_plus_ai',
  'evidence_mark_cards',
  'structured_compare',
  'scheme_vote_cards',
  'reflection_card',
]);

export const UNIT_3_8_LESSON_STEPS: UNIT_3_8StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '路径定位：`3-8` 为什么不是新章',
    hint: '先把 3-5、3-7、3-8、3-9 的路径位置和课程主问题钉住。',
    duration: '4 min',
    pageType: 'none',
  },
  {
    id: 'step-02',
    stage: 'O',
    title: '统一翻译器：结构变化如何接到稳定边界与闭环后果',
    hint: '先建立“结构变化 -> 频域指纹 -> 边界变化 -> 闭环后果”的统一判断链。',
    duration: '4 min',
    pageType: 'none',
  },
  {
    id: 'step-03',
    stage: 'P1',
    title: '前测：四类典型误判先暴露出来',
    hint: '先暴露幅值独读、跳过 P、截止频率混带宽和非最小相越推越快四类误判。',
    duration: '8 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '四类结构变化总表：先看哪一段频带，再谈收益与代价',
    hint: '总表先给频带归位，再解释收益与代价，不提前把结论压成单句口诀。',
    duration: '4 min',
    pageType: 'row_focus_toggle',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '曲线互动页：四类结构变化为什么留下不同频域指纹',
    hint: '通过同一对象的四种结构变化，直接观察频域曲线怎样被改写。',
    duration: '6 min',
    pageType: 'curve_compare_panel',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '例题 1：先从哪一段频带开始判断结构变化',
    hint: '例题先做频带定位，再读收益与代价，不能把结果卡代替判断链。',
    duration: '5 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '幅角原理：总转角、`P` 与 `Z` 在说什么',
    hint: '把幅角原理拆成可显影的阅读链，学生不得跨页继承显影状态。',
    duration: '4 min',
    pageType: 'step_reveal',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '为什么取 `F(s)=1+L(s)`，为什么盯住 `(-1,0)`',
    hint: '辅助函数、临界点和判稳结论必须构成同一条推导链。',
    duration: '5 min',
    pageType: 'reason_chain',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '例题 2：第一组 Nyquist 快速判稳题',
    hint: '对象、P、N、Z 和稳定结论必须一一对应，不能把右半平面零点当极点。',
    duration: '5 min',
    pageType: 'matrix_choice_cards',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '例题 3：靠近边界与越过边界有什么本质不同',
    hint: '比较“临界附近”和“越过边界”不是排序游戏，而是风险层级判断。',
    duration: '5 min',
    pageType: 'card_sort',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: 'Bode 判稳：截止频率、相角裕度和增益裕度',
    hint: '开环读余量、闭环看带宽，Bode 与 Nyquist 必须读成同一条边界语言。',
    duration: '5 min',
    pageType: 'hotspot_labeling',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '例题 4：由 Bode 图直接判断系统在边界哪一侧',
    hint: '由 Bode 图直接判断边界位置时，先确认读图顺序，再决定修正方向。',
    duration: '5 min',
    pageType: 'activity_cards',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '三频段分工：精度、速度与代价不能混读',
    hint: '低频、中频、高频必须对应不同任务，不得把三个频段压成一句总口号。',
    duration: '4 min',
    pageType: 'band_focus_panel',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '例题 5：目标切换时，先改哪一段频带',
    hint: '只有这一页允许学生先独立判断，再用页内 AI 对照目标到频带的映射。',
    duration: '5 min',
    pageType: 'goal_cards_plus_ai',
  },
  {
    id: 'step-15',
    stage: 'P2',
    title: '航向控制案例：先把基线方案的问题读清楚',
    hint: '航向控制案例先识别基线问题，不直接把案例压成“超前最好”的总结卡。',
    duration: '4 min',
    pageType: 'evidence_mark_cards',
  },
  {
    id: 'step-16',
    stage: 'P2',
    title: '航向控制案例：把时域指标翻译成频域目标，再看超前校正',
    hint: '同一案例内先做时域到频域的翻译，再比较超前校正如何回应目标。',
    duration: '5 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-17',
    stage: 'P2',
    title: '稳定平台案例：为什么“只改增益”会左右为难',
    hint: '稳定平台案例必须让学生看见“更稳但更慢”的真实代价，而不是只记结论。',
    duration: '4 min',
    pageType: 'scheme_vote_cards',
  },
  {
    id: 'step-18',
    stage: 'P2',
    title: '稳定平台案例：超前校正怎样兼顾速度和平稳',
    hint: '比较三方案时，必须显式读回中频定向校正为何能兼顾速度与平稳。',
    duration: '5 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-19',
    stage: 'P3',
    title: '后测：把完整判断链独立走一遍',
    hint: '后测只检查顺序、边界和目标切换，不再引入新的方法点。',
    duration: '5 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-20',
    stage: 'P3',
    title: '总结与去向：`3-9` 和模块 4 从哪里接走本课',
    hint: '收束必须把 3-8 的输出平滑接到 3-9 和 4-1，而不是停在本课自我总结。',
    duration: '3 min',
    pageType: 'reflection_card',
  },
] as const;

export function getUNIT_3_8Step(stepId: string) {
  return UNIT_3_8_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_8_LESSON_STEPS[0];
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_3_8PageContract {
  return {
    layout: {
      template: step.layout.template,
      regions: step.layout.regions.map((region) => ({
        id: region.id,
        width: region.width,
        order: region.order,
      })),
    },
    interactionKind: step.interactionSpec.interactionKind as UNIT_3_8PageType,
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_3_8TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_3_8TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_3_8TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_3_8TeacherControlMode,
      instructorDemoTools: [],
    },
    previewDemoPath: step.previewContract.demoPath || `/interactive-learning/courses/${UNIT_3_8_ROUTE_SEGMENT}/student/demo?step=${step.id}`,
  };
}

function fallbackManifestStep(step: UNIT_3_8StepDefinition): InteractiveRuntimeStepManifest {
  return {
    id: step.id,
    title: step.title,
    layout: {
      template: UNIT_3_8_PAGE_CONTRACTS[step.id]?.layout.template ?? 'stacked_regions',
      regions: UNIT_3_8_PAGE_CONTRACTS[step.id]?.layout.regions ?? [{ id: 'main', width: 'full', order: 1 }],
    },
    modules: [],
    contentBlocks: {},
    evidenceSequence: [],
    interactionSpec: {
      interactionKind: step.pageType === 'none' ? 'none' : step.pageType,
    },
    teacherControls: {
      releaseActivity: (UNIT_3_8_PAGE_CONTRACTS[step.id]?.teacherControls.releaseActivity ?? 'not_applicable') as InteractiveRuntimeStepManifest['teacherControls']['releaseActivity'],
      openBrowse: (UNIT_3_8_PAGE_CONTRACTS[step.id]?.teacherControls.openBrowse ?? 'not_applicable') as InteractiveRuntimeStepManifest['teacherControls']['openBrowse'],
      teacherStepReveal: (UNIT_3_8_PAGE_CONTRACTS[step.id]?.teacherControls.teacherStepReveal ?? 'not_applicable') as InteractiveRuntimeStepManifest['teacherControls']['teacherStepReveal'],
      revealReferenceAnswer: (UNIT_3_8_PAGE_CONTRACTS[step.id]?.teacherControls.revealReferenceAnswer ?? 'not_applicable') as InteractiveRuntimeStepManifest['teacherControls']['revealReferenceAnswer'],
    },
    studentAccess: {},
    teacherInsightSpec: { widgets: UNIT_3_8_PAGE_CONTRACTS[step.id]?.teacherInsightWidgets ?? [] },
    telemetrySpec: {
      summaryFields: UNIT_3_8_PAGE_CONTRACTS[step.id]?.telemetrySummaryFields ?? [],
      misconceptionTags: UNIT_3_8_PAGE_CONTRACTS[step.id]?.misconceptionTags ?? [],
    },
    aiContextSpec: {
      pageGoal: step.hint,
      deliveryMode: isUNIT_3_8AiPageType(step.pageType) ? 'visible_ai_panel' : 'hidden_page_context',
    },
    interactiveFigureSpec: {},
    previewContract: {
      demoPath: UNIT_3_8_PAGE_CONTRACTS[step.id]?.previewDemoPath ?? `/interactive-learning/courses/${UNIT_3_8_ROUTE_SEGMENT}/student/demo?step=${step.id}`,
    },
    acceptanceChecks: [],
  };
}

export const UNIT_3_8_RUNTIME_MANIFEST: InteractiveRuntimeManifest = {
  lessonId: '3-8',
  courseTitle: UNIT_3_8_COURSE_TITLE,
  courseRouteSegment: UNIT_3_8_ROUTE_SEGMENT,
  previewMode: {},
  mediaPolicy: {},
  telemetryStrategy: 'runtime_externalized',
  teacherInsightStrategy: 'runtime_externalized',
  requiredStepFields: [],
  stepOrder: UNIT_3_8_LESSON_STEPS.map((step) => step.id),
  steps: UNIT_3_8_LESSON_STEPS.map(fallbackManifestStep),
};

export function getUNIT_3_8ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  const activeManifest = manifest ?? UNIT_3_8_RUNTIME_MANIFEST;
  return activeManifest.steps.find((step) => step.id === stepId) ?? activeManifest.steps[0];
}

export function getUNIT_3_8PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_3_8ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_3_8PageContract(stepId: string) {
  return UNIT_3_8_PAGE_CONTRACTS[stepId] ?? UNIT_3_8_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_8InteractivePageType(pageType: UNIT_3_8PageType) {
  return UNIT_3_8_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_8AiPageType(pageType: UNIT_3_8PageType) {
  return pageType === 'goal_cards_plus_ai';
}

export function createEmptyUNIT_3_8StudentState(studentName: string): UNIT_3_8StudentCourseState {
  return {
    kind: 'unit38_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_8_PREMIUM_LESSON_CARD = {
  id: 'unit-3-8-frequency-domain-translation-judgment',
  title: UNIT_3_8_COURSE_TITLE,
  description: '精品互动课：频域统一翻译、Nyquist/Bode 判稳、三频段分工与工程案例读回。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_8_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_8_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/3-8/media/3-8-cover-comic.png',
  'step-05': '/course-runtime/lessons/3-8/media/3-8-zero-effect.png',
  'step-09': '/course-runtime/lessons/3-8/media/3-8-nyquist-quickcheck.png',
  'step-10': '/course-runtime/lessons/3-8/media/3-8-nyquist-example.png',
  'step-11': '/course-runtime/lessons/3-8/media/3-8-bode-example.png',
  'step-13': '/course-runtime/lessons/3-8/media/3-8-three-band-overview.png',
  'step-15': '/course-runtime/lessons/3-8/media/3-8-heading-baseline.png',
  'step-16': '/course-runtime/lessons/3-8/media/3-8-heading-case.png',
  'step-17': '/course-runtime/lessons/3-8/media/3-8-platform-block-diagram.png',
  'step-18': '/course-runtime/lessons/3-8/media/3-8-platform-case.png',
  'step-20': '/course-runtime/lessons/3-8/media/3-8-info.png',
};

export function getUNIT_3_8MediaSrc(stepId: string) {
  return UNIT_3_8_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_8StudentState(value: unknown): value is UNIT_3_8StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_8StudentCourseState>;
  return data.kind === 'unit38_student_state' && data.version === 1;
}

export function isUNIT_3_8TeacherSyncState(value: unknown): value is UNIT_3_8TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_8TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit38' && typeof data.activeStepId === 'string';
}

export const UNIT_3_8_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_8StudentCourseState,
  UNIT_3_8TeacherCourseSyncState,
  UNIT_3_8TeacherSyncInput
> = {
  lessonKey: UNIT_3_8_LESSON_KEY,
  studentItemId: UNIT_3_8_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_8_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_8_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_8_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_8StudentState,
  isStudentState: isUNIT_3_8StudentState,
  isTeacherSyncState: isUNIT_3_8TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit38',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_8TeacherSync(input: UNIT_3_8TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_8TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_3_8TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_3_8TeacherSession(input: UNIT_3_8TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_3_8_LESSON_STEPS,
  }));
}
