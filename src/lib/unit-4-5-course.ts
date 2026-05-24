import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import {
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_4_5StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_4_5TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_direct'
  | 'teacher_only';

export type UNIT_4_5PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'activity_card_set'
  | 'teacher_reveal_only';

export interface UNIT_4_5PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_4_5PageContract {
  layout: {
    template: string;
    regions: UNIT_4_5PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_4_5PageType, 'display' | 'summary'> | 'none';
  teacherControls: {
    releaseActivity: UNIT_4_5TeacherControlMode;
    openBrowse: UNIT_4_5TeacherControlMode;
    teacherStepReveal: UNIT_4_5TeacherControlMode;
    revealReferenceAnswer: UNIT_4_5TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiPageGoal: string;
  previewDemoPath: string;
}

export interface UNIT_4_5StepDefinition {
  id: string;
  stage: UNIT_4_5StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_4_5PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_4_5StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_4_5StudentCourseState {
  kind: 'unit45_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_4_5StepResponse>;
}

export interface UNIT_4_5TeacherCourseSyncState {
  kind: 'teacher_sync_unit45';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_4_5TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_4_5TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_4_5TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_4_5_ROUTE_SEGMENT = 'unit-4-5-constraint-aware-parameter-optimization';
export const UNIT_4_5_PRESET_KEY = 'unit-4-5-constraint-aware-parameter-optimization-v1';
export const UNIT_4_5_RESOURCE_KEY = 'unit-4-5-constraint-aware-parameter-optimization';
export const UNIT_4_5_LESSON_KEY = UNIT_4_5_PRESET_KEY;
export const UNIT_4_5_STUDENT_ITEM_ID = 'student:unit45:state';
export const UNIT_4_5_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_4_5_STUDENT_STATE_KEY = 'course';
export const UNIT_4_5_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_4_5_COURSE_TITLE = '4-5：约束下的优化设计实践：参数约束翻译与带约束参数优化';
export const UNIT_4_5_COURSE_SUBTITLE = 'Constraint-Aware Parameter Optimization';
export const UNIT_4_5_COURSE_DESCRIPTION =
  '围绕无约束候选越界、课程目标、硬约束翻译、罚函数、求解链、权重重排、结构分化与总结信息图，把 4-4 的候选族推进成固定结构下可交付的可接受解。';

export const UNIT_4_5_STAGE_LABEL: Record<UNIT_4_5StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测前证据',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_4_5_STAGE_MAP: Record<UNIT_4_5StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function preview(stepId: string) {
  return `/interactive-learning/courses/${UNIT_4_5_ROUTE_SEGMENT}/student/demo?step=${stepId}`;
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_4_5PageContract {
  return {
    layout: {
      template: step.layout.template,
      regions: step.layout.regions.map((region) => ({
        id: region.id,
        width: region.width,
        order: region.order,
      })),
    },
    interactionKind: step.interactionSpec.interactionKind as UNIT_4_5PageContract['interactionKind'],
    teacherControls: step.teacherControls,
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    aiPageGoal: step.aiContextSpec.pageGoal,
    previewDemoPath: step.previewContract.demoPath || preview(step.id),
  };
}

function contract(
  template: string,
  regions: UNIT_4_5PageRegionContract[],
  interactionKind: UNIT_4_5PageContract['interactionKind'],
  aiPageGoal: string,
  previewDemoPath: string,
  extra?: Partial<UNIT_4_5PageContract>,
): UNIT_4_5PageContract {
  return {
    layout: { template, regions },
    interactionKind,
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
    },
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    aiPageGoal,
    previewDemoPath,
    ...extra,
  };
}

export const UNIT_4_5_PAGE_CONTRACTS: Record<string, UNIT_4_5PageContract> = {
  'step-01': contract(
    'failure_evidence_hero_board',
    [
      { id: 'evidence', width: 'half', order: 1 },
      { id: 'figure', width: 'half', order: 2 },
    ],
    'none',
    '固定“更优不等于可交付”的入口。',
    preview('step-01'),
    { teacherInsightWidgets: ['view_count', 'sync_status'] },
  ),
  'step-02': contract(
    'objective_chain_board',
    [
      { id: 'header', width: 'full', order: 1 },
      { id: 'goals', width: 'full', order: 2 },
      { id: 'bridge', width: 'full', order: 3 },
    ],
    'none',
    '独立呈现本课布鲁姆能力目标。',
    preview('step-02'),
  ),
  'step-03': contract(
    'dual_table_evidence_board',
    [
      { id: 'intro', width: 'full', order: 1 },
      { id: 'gain', width: 'half', order: 2 },
      { id: 'boundary', width: 'half', order: 3 },
      { id: 'summary', width: 'full', order: 4 },
    ],
    'none',
    '把收益列与工程复核重新对齐到讲义第三章。',
    preview('step-03'),
    {
      teacherInsightWidgets: ['view_count', 'sync_status'],
      misconceptionTags: ['free_gain_equals_delivery'],
    },
  ),
  'step-04': contract(
    'constraint_statement_board',
    [
      { id: 'formula', width: 'full', order: 1 },
      { id: 'table', width: 'full', order: 2 },
      { id: 'summary', width: 'full', order: 3 },
      { id: 'interaction', width: 'full', order: 4 },
    ],
    'activity_card_set',
    '把三条硬边界升格为交付裁决语言。',
    preview('step-04'),
    {
      teacherControls: {
        releaseActivity: 'teacher_toggle',
        openBrowse: 'page_load_open',
        teacherStepReveal: 'not_applicable',
        revealReferenceAnswer: 'teacher_toggle',
      },
      teacherInsightWidgets: ['card_completion_rate', 'error_bucket_distribution'],
      telemetrySummaryFields: ['cardSubmitted', 'timeOnStep'],
      misconceptionTags: ['range_as_constraint', 'phase_margin_as_sufficient'],
    },
  ),
  'step-05': contract(
    'constraint_role_split_board',
    [
      { id: 'top', width: 'full', order: 1 },
      { id: 'table', width: 'full', order: 2 },
      { id: 'interaction', width: 'full', order: 3 },
    ],
    'activity_card_set',
    '清楚区分结构可解释与结果可交付。',
    preview('step-05'),
    {
      teacherControls: {
        releaseActivity: 'teacher_toggle',
        openBrowse: 'page_load_open',
        teacherStepReveal: 'not_applicable',
        revealReferenceAnswer: 'teacher_toggle',
      },
      teacherInsightWidgets: ['card_completion_rate', 'response_bucket_distribution'],
      telemetrySummaryFields: ['cardSubmitted', 'timeOnStep'],
      misconceptionTags: ['range_equals_delivery', 'constraint_role_confusion'],
    },
  ),
  'step-06': contract(
    'formula_reveal_board',
    [
      { id: 'formula', width: 'full', order: 1 },
      { id: 'explain', width: 'full', order: 2 },
      { id: 'summary', width: 'full', order: 3 },
    ],
    'teacher_reveal_only',
    '固定三条公式与“偏好没变，规则变了”。',
    preview('step-06'),
    {
      teacherControls: {
        releaseActivity: 'not_applicable',
        openBrowse: 'not_applicable',
        teacherStepReveal: 'teacher_only',
        revealReferenceAnswer: 'not_applicable',
      },
      teacherInsightWidgets: ['step_reveal_progress'],
      telemetrySummaryFields: ['stepRevealCount', 'timeOnStep'],
      misconceptionTags: ['penalty_as_new_preference'],
    },
  ),
  'step-07': contract(
    'solver_chain_board',
    [
      { id: 'table', width: 'full', order: 1 },
      { id: 'chain', width: 'full', order: 2 },
      { id: 'summary', width: 'full', order: 3 },
      { id: 'interaction', width: 'full', order: 4 },
    ],
    'teacher_reveal_only',
    '把表 5 和六步求解链补足到可独立理解。',
    preview('step-07'),
    {
      teacherControls: {
        releaseActivity: 'teacher_toggle',
        openBrowse: 'not_applicable',
        teacherStepReveal: 'teacher_only',
        revealReferenceAnswer: 'teacher_toggle',
      },
      teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate'],
      telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted', 'timeOnStep'],
      misconceptionTags: ['solver_as_magic'],
    },
  ),
  'step-08': contract(
    'same_weight_compare_board',
    [
      { id: 'controllers', width: 'full', order: 1 },
      { id: 'evidence', width: 'full', order: 2 },
      { id: 'summary', width: 'full', order: 3 },
      { id: 'interaction', width: 'full', order: 4 },
    ],
    'teacher_reveal_only',
    '承载讲义6.3，解释可行域迁移。',
    preview('step-08'),
    {
      teacherControls: {
        releaseActivity: 'teacher_toggle',
        openBrowse: 'not_applicable',
        teacherStepReveal: 'teacher_only',
        revealReferenceAnswer: 'teacher_toggle',
      },
      teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate'],
      telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted', 'timeOnStep'],
      misconceptionTags: ['weight_changed', 'best_point_static'],
    },
  ),
  'step-09': contract(
    'weight_tradeoff_board',
    [
      { id: 'weights', width: 'full', order: 1 },
      { id: 'table', width: 'full', order: 2 },
      { id: 'figure', width: 'full', order: 3 },
      { id: 'summary', width: 'full', order: 4 },
    ],
    'teacher_reveal_only',
    '承载讲义6.4的权重重排证据。',
    preview('step-09'),
    {
      teacherControls: {
        releaseActivity: 'not_applicable',
        openBrowse: 'not_applicable',
        teacherStepReveal: 'teacher_only',
        revealReferenceAnswer: 'not_applicable',
      },
      teacherInsightWidgets: ['step_reveal_progress'],
      telemetrySummaryFields: ['stepRevealCount', 'timeOnStep'],
      misconceptionTags: ['weight_means_anything_goes'],
    },
  ),
  'step-10': contract(
    'structure_compare_board',
    [
      { id: 'controllers', width: 'full', order: 1 },
      { id: 'table', width: 'full', order: 2 },
      { id: 'figure', width: 'full', order: 3 },
      { id: 'summary', width: 'full', order: 4 },
    ],
    'teacher_reveal_only',
    '承载讲义6.5的结构差异，不提前展开4-6。',
    preview('step-10'),
    {
      teacherControls: {
        releaseActivity: 'not_applicable',
        openBrowse: 'page_load_open',
        teacherStepReveal: 'teacher_only',
        revealReferenceAnswer: 'not_applicable',
      },
      teacherInsightWidgets: ['view_count', 'time_distribution'],
      misconceptionTags: ['pid_is_always_better'],
    },
  ),
  'step-11': contract(
    'closure_acceptance_board',
    [
      { id: 'table', width: 'full', order: 1 },
      { id: 'criteria', width: 'full', order: 2 },
      { id: 'summary', width: 'full', order: 3 },
    ],
    'teacher_reveal_only',
    '合并讲义6.6、6.7与第七章收束。',
    preview('step-11'),
    {
      teacherControls: {
        releaseActivity: 'not_applicable',
        openBrowse: 'page_load_open',
        teacherStepReveal: 'teacher_only',
        revealReferenceAnswer: 'not_applicable',
      },
      teacherInsightWidgets: ['view_count', 'time_distribution'],
      telemetrySummaryFields: ['stepRevealCount', 'timeOnStep'],
      misconceptionTags: ['acceptable_equals_final'],
    },
  ),
  'step-12': contract(
    'posttest_board',
    [
      { id: 'intro', width: 'full', order: 1 },
      { id: 'quiz', width: 'full', order: 2 },
      { id: 'review', width: 'full', order: 3 },
    ],
    'quiz_group',
    '独立后测，不再混入总结。',
    preview('step-12'),
    {
      teacherControls: {
        releaseActivity: 'teacher_toggle',
        openBrowse: 'page_load_open',
        teacherStepReveal: 'not_applicable',
        revealReferenceAnswer: 'teacher_toggle',
      },
      teacherInsightWidgets: ['completion_rate', 'top_misconceptions'],
      telemetrySummaryFields: ['cardSubmitted', 'timeOnStep', 'errorBucket'],
      misconceptionTags: ['penalty_as_answer', 'range_equals_constraint', 'acceptable_equals_final'],
    },
  ),
  'step-13': contract(
    'summary_exit_board',
    [
      { id: 'summary', width: 'full', order: 1 },
      { id: 'infographic', width: 'full', order: 2 },
      { id: 'next-step', width: 'full', order: 3 },
    ],
    'none',
    '用总结页与信息图收束本课。',
    preview('step-13'),
    {
      teacherControls: {
        releaseActivity: 'not_applicable',
        openBrowse: 'page_load_open',
        teacherStepReveal: 'not_applicable',
        revealReferenceAnswer: 'not_applicable',
      },
    },
  ),
};

// review_lesson_content.py 的静态提取器目前只支持字面量对象，不会执行 contract()/preview()。
// 这里提供一份与运行时契约等值的静态导出，专供严格审查读取。
export const UNIT_4_5_PAGE_CONTRACTS_REVIEW: Record<string, UNIT_4_5PageContract> = {
  'step-01': {
    layout: {
      template: 'failure_evidence_hero_board',
      regions: [
        { id: 'evidence', width: 'half', order: 1 },
        { id: 'figure', width: 'half', order: 2 },
      ],
    },
    interactionKind: 'none',
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
    },
    teacherInsightWidgets: ['view_count', 'sync_status'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    aiPageGoal: '固定“更优不等于可交付”的入口。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'objective_chain_board',
      regions: [
        { id: 'header', width: 'full', order: 1 },
        { id: 'goals', width: 'full', order: 2 },
        { id: 'bridge', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
    },
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    aiPageGoal: '独立呈现本课布鲁姆能力目标。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'dual_table_evidence_board',
      regions: [
        { id: 'intro', width: 'full', order: 1 },
        { id: 'gain', width: 'half', order: 2 },
        { id: 'boundary', width: 'half', order: 3 },
        { id: 'summary', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'none',
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
    },
    teacherInsightWidgets: ['view_count', 'sync_status'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    misconceptionTags: ['free_gain_equals_delivery'],
    aiPageGoal: '把收益列与工程复核重新对齐到讲义第三章。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'constraint_statement_board',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
        { id: 'interaction', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'activity_card_set',
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['card_completion_rate', 'error_bucket_distribution'],
    telemetrySummaryFields: ['cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['range_as_constraint', 'phase_margin_as_sufficient'],
    aiPageGoal: '把三条硬边界升格为交付裁决语言。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'constraint_role_split_board',
      regions: [
        { id: 'top', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_card_set',
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['card_completion_rate', 'response_bucket_distribution'],
    telemetrySummaryFields: ['cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['range_equals_delivery', 'constraint_role_confusion'],
    aiPageGoal: '清楚区分结构可解释与结果可交付。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'formula_reveal_board',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'explain', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'teacher_reveal_only',
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'not_applicable',
    },
    teacherInsightWidgets: ['step_reveal_progress'],
    telemetrySummaryFields: ['stepRevealCount', 'timeOnStep'],
    misconceptionTags: ['penalty_as_new_preference'],
    aiPageGoal: '固定三条公式与“偏好没变，规则变了”。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'solver_chain_board',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'chain', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
        { id: 'interaction', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'teacher_reveal_only',
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate'],
    telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['solver_as_magic'],
    aiPageGoal: '把表 5 和六步求解链补足到可独立理解。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'same_weight_compare_board',
      regions: [
        { id: 'controllers', width: 'full', order: 1 },
        { id: 'evidence', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
        { id: 'interaction', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'teacher_reveal_only',
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate'],
    telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['weight_changed', 'best_point_static'],
    aiPageGoal: '承载讲义6.3，解释可行域迁移。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'weight_tradeoff_board',
      regions: [
        { id: 'weights', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'figure', width: 'full', order: 3 },
        { id: 'summary', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'teacher_reveal_only',
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'not_applicable',
    },
    teacherInsightWidgets: ['step_reveal_progress'],
    telemetrySummaryFields: ['stepRevealCount', 'timeOnStep'],
    misconceptionTags: ['weight_means_anything_goes'],
    aiPageGoal: '承载讲义6.4的权重重排证据。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'structure_compare_board',
      regions: [
        { id: 'controllers', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'figure', width: 'full', order: 3 },
        { id: 'summary', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'teacher_reveal_only',
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'not_applicable',
    },
    teacherInsightWidgets: ['view_count', 'time_distribution'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    misconceptionTags: ['pid_is_always_better'],
    aiPageGoal: '承载讲义6.5的结构差异，不提前展开4-6。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'closure_acceptance_board',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'criteria', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'teacher_reveal_only',
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'teacher_only',
      revealReferenceAnswer: 'not_applicable',
    },
    teacherInsightWidgets: ['view_count', 'time_distribution'],
    telemetrySummaryFields: ['stepRevealCount', 'timeOnStep'],
    misconceptionTags: ['acceptable_equals_final'],
    aiPageGoal: '合并讲义6.6、6.7与第七章收束。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'posttest_board',
      regions: [
        { id: 'intro', width: 'full', order: 1 },
        { id: 'quiz', width: 'full', order: 2 },
        { id: 'review', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['completion_rate', 'top_misconceptions'],
    telemetrySummaryFields: ['cardSubmitted', 'timeOnStep', 'errorBucket'],
    misconceptionTags: ['penalty_as_answer', 'range_equals_constraint', 'acceptable_equals_final'],
    aiPageGoal: '独立后测，不再混入总结。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'summary_exit_board',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'infographic', width: 'full', order: 2 },
        { id: 'next-step', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
    },
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    misconceptionTags: [],
    aiPageGoal: '用总结页与信息图收束本课。',
    previewDemoPath: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-13',
  },
};

const UNIT_4_5_INTERACTIVE_PAGE_TYPES = new Set<UNIT_4_5PageType>([
  'quiz_group',
  'activity_card_set',
  'teacher_reveal_only',
]);
const UNIT_4_5_PER_CARD_QUIZ_STEPS = new Set(['step-12']);
const UNIT_4_5_PER_CARD_TEXT_STEPS = new Set(['step-04', 'step-05', 'step-07', 'step-08']);

export const UNIT_4_5_LESSON_STEPS: readonly UNIT_4_5StepDefinition[] = [
  { id: 'step-01', stage: 'B', title: '无约束候选越界：时间指标更好，为什么仍不可交付', hint: '用对象、候选和失败图同屏固定“更优不等于可交付”。', duration: '8 min', pageType: 'display' },
  { id: 'step-02', stage: 'O', title: '本次课程目标：完成这轮实践后应能做到什么', hint: '独立呈现本课布鲁姆能力目标。', duration: '5 min', pageType: 'display' },
  { id: 'step-03', stage: 'P1', title: '自由目标收益与工程复核：更优为什么还不等于可用', hint: '把收益表与工程复核表重新对齐到讲义顺序。', duration: '9 min', pageType: 'display' },
  { id: 'step-04', stage: 'P2', title: '三条硬约束第一次被显性提出', hint: '把三条硬边界写成交付裁决语言。', duration: '8 min', pageType: 'activity_card_set' },
  { id: 'step-05', stage: 'P2', title: '参数范围与硬约束分别在回答什么', hint: '分开“结构可解释”和“结果可交付”两层职责。', duration: '8 min', pageType: 'activity_card_set' },
  { id: 'step-06', stage: 'P2', title: '罚函数把边界写进模型', hint: '固定 J_free、J_con、P(theta) 与“偏好没变，规则变了”。', duration: '8 min', pageType: 'teacher_reveal_only' },
  { id: 'step-07', stage: 'P2', title: '求解输入与六步求解链：求解器究竟在消费什么', hint: '修正表5和六步链的公式、细节与顺序。', duration: '10 min', pageType: 'teacher_reveal_only' },
  { id: 'step-08', stage: 'P2', title: '同一权重下，为什么会分出两组最优', hint: '承载讲义 6.3，解释可行域迁移。', duration: '8 min', pageType: 'teacher_reveal_only' },
  { id: 'step-09', stage: 'P2', title: '权重影响：可行域不变时，收益会怎样被重新分配', hint: '承载讲义 6.4 的权重扫掠页。', duration: '7 min', pageType: 'teacher_reveal_only' },
  { id: 'step-10', stage: 'P2', title: '同一主案例下：优化 PID 和优化超前结构为什么会分化', hint: '承载讲义 6.5 的结构差异页。', duration: '7 min', pageType: 'teacher_reveal_only' },
  { id: 'step-11', stage: 'P2', title: '三方案闭环比较：当前结果为何可接受但不是终局', hint: '把表9、可接受标准与余量告警收束到同一页。', duration: '8 min', pageType: 'teacher_reveal_only' },
  { id: 'step-12', stage: 'P3', title: '后测：边界、求解与解释是否已经成链', hint: '后测与总结彻底分离。', duration: '6 min', pageType: 'quiz_group' },
  { id: 'step-13', stage: 'S', title: '总结：把越界证据、约束翻译与结构边界连成一条链', hint: '用信息图与下一课去向收束本课。', duration: '6 min', pageType: 'summary' },
] as const;

function fallbackManifestStep(step: UNIT_4_5StepDefinition): InteractiveRuntimeStepManifest {
  const contract = UNIT_4_5_PAGE_CONTRACTS[step.id];
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

export const UNIT_4_5_RUNTIME_MANIFEST: InteractiveRuntimeManifest = {
  lessonId: '4-5',
  courseTitle: UNIT_4_5_COURSE_TITLE,
  courseRouteSegment: UNIT_4_5_ROUTE_SEGMENT,
  previewMode: {},
  mediaPolicy: {},
  telemetryStrategy: 'runtime_externalized',
  teacherInsightStrategy: 'runtime_externalized',
  requiredStepFields: [],
  stepOrder: UNIT_4_5_LESSON_STEPS.map((step) => step.id),
  steps: UNIT_4_5_LESSON_STEPS.map(fallbackManifestStep),
};

export function getUNIT_4_5ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  const activeManifest = manifest ?? UNIT_4_5_RUNTIME_MANIFEST;
  return activeManifest.steps.find((step) => step.id === stepId) ?? activeManifest.steps[0];
}

export function getUNIT_4_5PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_4_5ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_4_5Step(stepId: string) {
  return UNIT_4_5_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_4_5_LESSON_STEPS[0];
}

export function getUNIT_4_5PageContract(stepId: string) {
  return UNIT_4_5_PAGE_CONTRACTS[stepId] ?? UNIT_4_5_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_4_5InteractivePageType(pageType: UNIT_4_5PageType) {
  return UNIT_4_5_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_4_5AiPageType(_pageType: UNIT_4_5PageType) {
  return false;
}

export function isUNIT_4_5StepReleasedByDefault(
  stepId: string,
  manifest?: InteractiveRuntimeManifest | null,
) {
  const contract = manifest
    ? getUNIT_4_5PageContractFromManifest(manifest, stepId)
    : getUNIT_4_5PageContract(stepId);
  return (
    contract.teacherControls.releaseActivity === 'page_load_open' ||
    contract.teacherControls.releaseActivity === 'not_applicable'
  );
}

export function isUNIT_4_5PerCardQuizStep(stepId: string) {
  return UNIT_4_5_PER_CARD_QUIZ_STEPS.has(stepId);
}

export function isUNIT_4_5PerCardTextStep(stepId: string) {
  return UNIT_4_5_PER_CARD_TEXT_STEPS.has(stepId);
}

export function createEmptyUNIT_4_5StudentState(studentName: string): UNIT_4_5StudentCourseState {
  return {
    kind: 'unit45_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_4_5_PREMIUM_LESSON_CARD = {
  id: 'unit-4-5-constraint-aware-parameter-optimization',
  title: UNIT_4_5_COURSE_TITLE,
  description: '精品互动课：把越界证据、权重重排、结构差异和总结信息图接成一条完整课堂链。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_4_5_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_4_5_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/4-5/media/4-5-ship-heading-unconstrained-failure-compare.png',
  'step-08': '/course-runtime/lessons/4-5/media/4-5-ship-heading-same-weight-constraint-compare.png',
  'step-09': '/course-runtime/lessons/4-5/media/4-5-weight-sweep-constrained-summary.png',
  'step-10': '/course-runtime/lessons/4-5/media/4-5-ship-heading-pid-vs-leadlag-compare.png',
  'step-13': '/course-runtime/lessons/4-5/media/4-5-info.png',
};

export function getUNIT_4_5MediaSrc(stepId: string) {
  return UNIT_4_5_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_4_5StudentState(value: unknown): value is UNIT_4_5StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_5StudentCourseState>;
  return data.kind === 'unit45_student_state' && data.version === 1;
}

export function isUNIT_4_5TeacherSyncState(value: unknown): value is UNIT_4_5TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_5TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit45' && typeof data.activeStepId === 'string';
}

export const UNIT_4_5_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_4_5StudentCourseState,
  UNIT_4_5TeacherCourseSyncState,
  UNIT_4_5TeacherSyncInput
> = {
  lessonKey: UNIT_4_5_LESSON_KEY,
  studentItemId: UNIT_4_5_STUDENT_ITEM_ID,
  teacherItemId: UNIT_4_5_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_4_5_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_4_5_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_4_5StudentState,
  isStudentState: isUNIT_4_5StudentState,
  isTeacherSyncState: isUNIT_4_5TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit45',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_4_5TeacherSync(input: UNIT_4_5TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_4_5TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_4_5TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_4_5TeacherSession(input: UNIT_4_5TeacherFinalizeInput) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_4_5_LESSON_STEPS,
  });
}
