import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_4_2StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_4_2TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_direct';

export type UNIT_4_2PageType =
  | 'display'
  | 'quiz_group'
  | 'activity_card_set'
  | 'multi_select_matrix'
  | 'worked_example_reveal'
  | 'task_card_workspace'
  | 'quiz_card_grid';

export interface UNIT_4_2PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_4_2PageContract {
  layout: {
    template: string;
    regions: UNIT_4_2PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_4_2PageType, 'display'> | 'none';
  teacherControls: {
    releaseActivity: UNIT_4_2TeacherControlMode;
    openBrowse: UNIT_4_2TeacherControlMode;
    teacherStepReveal: UNIT_4_2TeacherControlMode;
    revealReferenceAnswer: UNIT_4_2TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  figureLayoutMirror?: string;
  controlsPlacement?: string;
  controlsCollapsedByDefault?: boolean;
  aiPageGoal: string;
  previewDemoPath: string;
}

export interface UNIT_4_2StepDefinition {
  id: string;
  stage: UNIT_4_2StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_4_2PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_4_2StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_4_2StudentCourseState {
  kind: 'unit42_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_4_2StepResponse>;
}

export interface UNIT_4_2TeacherCourseSyncState {
  kind: 'teacher_sync_unit42';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_4_2TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_4_2TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_4_2TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_4_2_ROUTE_SEGMENT = 'unit-4-2-controller-selection-first-start';
export const UNIT_4_2_PRESET_KEY = 'unit-4-2-controller-selection-first-start-v1';
export const UNIT_4_2_RESOURCE_KEY = 'unit-4-2-controller-selection-first-start';
export const UNIT_4_2_LESSON_KEY = UNIT_4_2_PRESET_KEY;
export const UNIT_4_2_STUDENT_ITEM_ID = 'student:unit42:state';
export const UNIT_4_2_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_4_2_STUDENT_STATE_KEY = 'course';
export const UNIT_4_2_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_4_2_COURSE_TITLE = '4-2：控制器选型原理：不同控制结构为何适合不同任务';
export const UNIT_4_2_COURSE_SUBTITLE = 'Controller Selection First Start';
export const UNIT_4_2_COURSE_DESCRIPTION =
  '围绕结构工具箱、双案例首轮起步与前馈补偿边界，把 4-1 的任务表达卡推进成“单结构首轮起步卡”。';

export const UNIT_4_2_STAGE_LABEL: Record<UNIT_4_2StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_4_2_STAGE_MAP: Record<UNIT_4_2StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_4_2_PAGE_CONTRACTS: Record<string, UNIT_4_2PageContract> = {
  'step-01': {
    layout: {
      template: 'map_goal_boundary_slide',
      regions: [
        { id: 'header', width: 'full', order: 1 },
        { id: 'lead', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
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
    telemetrySummaryFields: ['viewed', 'timeOnStep', 'teacherFollowSync'],
    aiPageGoal: '固定 4-2 的角色是单结构首轮起步判断。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'question_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'submit-bar', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherControls: {
      releaseActivity: 'page_load_open',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['pid_as_default', 'feedforward_replaces_feedback', 'faster_always_better'],
    aiPageGoal: '暴露入口误区。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'formula_table_reasoning',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
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
    telemetrySummaryFields: ['viewed', 'timeOnStep', 'teacherFollowSync'],
    aiPageGoal: '固定结构名称之前还有六步判断链。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'formula_table_match',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'multi_select_matrix',
    teacherControls: {
      releaseActivity: 'page_load_open',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['selection_distribution', 'completion_rate'],
    telemetrySummaryFields: ['selectionCount', 'completionRate', 'timeOnStep'],
    misconceptionTags: ['toolbox_by_name_only', 'pid_everywhere'],
    aiPageGoal: '把结构按作用机制重新组织。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'case_evidence_board',
      regions: [
        { id: 'case', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
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
    teacherInsightWidgets: ['error_bucket_distribution', 'card_completion_rate'],
    telemetrySummaryFields: ['cardSubmitted', 'errorBucket', 'timeOnStep'],
    misconceptionTags: ['ship_speed_first', 'ship_cost_missing'],
    figureLayoutMirror: 'quad_panel',
    controlsPlacement: 'below_quad_panel',
    controlsCollapsedByDefault: false,
    aiPageGoal: '固定客船案例的低频主矛盾。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'worked_example_compare',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'comparison', width: 'full', order: 2 },
        { id: 'worked-example', width: 'full', order: 3 },
        { id: 'interaction', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_reveal',
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'teacher_toggle',
      teacherStepReveal: 'teacher_direct',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate', 'top_misconceptions'],
    telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted', 'errorBucket'],
    misconceptionTags: ['ship_choose_pd', 'ship_cost_missing', 'lag_role_confusion'],
    aiPageGoal: '把客船 PI/滞后起步理由链写完整。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'case_evidence_board',
      regions: [
        { id: 'case', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
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
    teacherInsightWidgets: ['error_bucket_distribution', 'card_completion_rate'],
    telemetrySummaryFields: ['cardSubmitted', 'errorBucket', 'timeOnStep'],
    misconceptionTags: ['platform_speed_only', 'platform_low_frequency_bias'],
    figureLayoutMirror: 'quad_panel',
    controlsPlacement: 'below_quad_panel',
    controlsCollapsedByDefault: false,
    aiPageGoal: '固定平台案例的中频主矛盾。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'worked_example_compare',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'comparison', width: 'full', order: 2 },
        { id: 'worked-example', width: 'full', order: 3 },
        { id: 'interaction', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_reveal',
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'teacher_toggle',
      teacherStepReveal: 'teacher_direct',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate', 'top_misconceptions'],
    telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted', 'errorBucket'],
    misconceptionTags: ['platform_choose_pi', 'lead_role_confusion', 'speed_only_reasoning'],
    aiPageGoal: '把平台 PD/超前起步理由链写完整。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'worked_example_compare',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'comparison', width: 'full', order: 2 },
        { id: 'worked-example', width: 'full', order: 3 },
        { id: 'interaction', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_reveal',
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'teacher_toggle',
      teacherStepReveal: 'teacher_direct',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate', 'top_misconceptions'],
    telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted', 'errorBucket'],
    misconceptionTags: ['input_ff_equals_pd', 'blind_full_compensation'],
    aiPageGoal: '说明输入前馈改的是参考通道，不是把 PD 改了名字。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'feedforward_compare_board',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
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
    teacherInsightWidgets: ['error_bucket_distribution', 'card_completion_rate'],
    telemetrySummaryFields: ['cardSubmitted', 'errorBucket', 'timeOnStep'],
    misconceptionTags: ['feedforward_can_replace_feedback', 'ignore_disturbance_risks'],
    aiPageGoal: '说明扰动前馈改变的是扰动通道而非反馈保底职责。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'task_card_workspace',
      regions: [
        { id: 'template', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'task_card_workspace',
    teacherControls: {
      releaseActivity: 'teacher_toggle',
      openBrowse: 'page_load_open',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['field_completion_rate', 'error_bucket_distribution'],
    telemetrySummaryFields: ['fieldCompletion', 'errorBucket', 'timeOnStep'],
    misconceptionTags: ['missing_cost', 'missing_direction', 'pid_as_default'],
    aiPageGoal: '输出一张可交给 4-3 的最小起步卡。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'assessment_card_grid',
      regions: [
        { id: 'assessment', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'submit-bar', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_card_grid',
    teacherControls: {
      releaseActivity: 'page_load_open',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'teacher_toggle',
    },
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['wrong_main_contradiction', 'cost_missing', 'feedforward_boundary_confusion', 'task_card_incomplete'],
    aiPageGoal: '检查 4-2 的判断链是否形成。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'summary_route_board',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'next-step', width: 'full', order: 3 },
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
    aiPageGoal: '完成 4-2 收束并把学生送到 4-3。',
    previewDemoPath: '/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-13',
  },
};

export const UNIT_4_2_INTERACTIVE_PAGE_TYPES = new Set<UNIT_4_2PageType>([
  'quiz_group',
  'activity_card_set',
  'multi_select_matrix',
  'worked_example_reveal',
  'task_card_workspace',
  'quiz_card_grid',
]);

export const UNIT_4_2_LESSON_STEPS: UNIT_4_2StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图：4-1 的任务表达卡如何接到 4-2 的结构起步判断',
    hint: '先钉死 4-2 的角色：不报最终方案，只做单结构首轮起步判断。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'P1',
    title: '前测：结构名字为什么不是答案',
    hint: '先暴露把 PID 当默认答案、把前馈当替代反馈、把更快当更适合的三类误判。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-03',
    stage: 'P2',
    title: '单结构判断链：主矛盾先行，结构名称压后出现',
    hint: '本页只保留讲义中的判断链与参数方向句式，不再额外发放学生作答。',
    duration: '7 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '控制结构工具箱：按作用机制重组，而不是按名字平铺',
    hint: '上半区完整复现表 3 的前三列，下半区用多选判断结构作用语义。',
    duration: '7 min',
    pageType: 'multi_select_matrix',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '案例 A 入口：客船航向保持先看低频保持能力，而不是先追更快',
    hint: '改为 Rust/WASM 驱动的统一面板，围绕客船对象把低频主矛盾压实。',
    duration: '8 min',
    pageType: 'activity_card_set',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '案例 A 展开：为什么客船首轮更像 PI/滞后，而不是先上 PD',
    hint: '按讲义逐步显影比较链并落出表 5，作答区改为双栏卡片。',
    duration: '8 min',
    pageType: 'worked_example_reveal',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '案例 B 入口：稳定平台先整理中频动态品质与储备',
    hint: '改为 Rust/WASM 驱动的统一面板，保留平台对象与中频主矛盾。',
    duration: '8 min',
    pageType: 'activity_card_set',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '案例 B 展开：为什么稳定平台首轮更像 PD/超前，而不是先补 PI',
    hint: '按讲义逐步显影平台比较链，作答区改为双栏卡片。',
    duration: '8 min',
    pageType: 'worked_example_reveal',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '按输入补偿前馈：它先改参考通道，不等于把 PD 改写了名字',
    hint: '修正公式渲染与结构图路径，保留公式链、四联图和逐步显影。',
    duration: '8 min',
    pageType: 'worked_example_reveal',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '按扰动补偿前馈：它先削弱误差来源，不等于替代反馈保底',
    hint: '修正公式渲染与结构图路径，作答区改为双栏卡片。',
    duration: '7 min',
    pageType: 'activity_card_set',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '单结构首轮起步卡工作区：把结构、方向、收益与代价写成最小卡片',
    hint: '工作区压缩为六字段最小起步卡，保持双栏布局。',
    duration: '10 min',
    pageType: 'task_card_workspace',
  },
  {
    id: 'step-12',
    stage: 'P3',
    title: '后测：是否已经形成“先看主矛盾，再选结构”的判断链',
    hint: '后测只检查判断链和边界意识，不与总结或去向混页。',
    duration: '6 min',
    pageType: 'quiz_card_grid',
  },
  {
    id: 'step-13',
    stage: 'S',
    title: '收束与去向：4-2 的出口只交给 4-3 的复合结构骨架阶段',
    hint: '收束页只负责五句带走与去向，提醒 4-3 才进入复合结构骨架。',
    duration: '4 min',
    pageType: 'display',
  },
] as const;

export function getUNIT_4_2Step(stepId: string) {
  return UNIT_4_2_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_4_2_LESSON_STEPS[0];
}

export function getUNIT_4_2PageContract(stepId: string) {
  return UNIT_4_2_PAGE_CONTRACTS[stepId] ?? UNIT_4_2_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_4_2InteractivePageType(pageType: UNIT_4_2PageType) {
  return UNIT_4_2_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_4_2AiPageType(_pageType: UNIT_4_2PageType) {
  return false;
}

export function createEmptyUNIT_4_2StudentState(studentName: string): UNIT_4_2StudentCourseState {
  return {
    kind: 'unit42_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_4_2_PREMIUM_LESSON_CARD = {
  id: 'unit-4-2-controller-selection-first-start',
  title: UNIT_4_2_COURSE_TITLE,
  description: '精品互动课：把 4-1 的任务表达卡推进成单结构首轮起步卡，解释不同结构为何服务不同任务。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_4_2_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_4_2_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/4-2/media/4-2-cover-comic.png',
  'step-09': '/course-runtime/lessons/4-2/media/4-2-input-feedforward-quad.png',
  'step-10': '/course-runtime/lessons/4-2/media/4-2-disturbance-feedforward-quad.png',
  'step-13': '/course-runtime/lessons/4-2/media/4-2-info.png',
};

export function getUNIT_4_2MediaSrc(stepId: string) {
  return UNIT_4_2_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_4_2StudentState(value: unknown): value is UNIT_4_2StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_4_2StudentCourseState>;
  return data.kind === 'unit42_student_state' && data.version === 1;
}

export function isUNIT_4_2TeacherSyncState(value: unknown): value is UNIT_4_2TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_4_2TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit42' && typeof data.activeStepId === 'string';
}

export const UNIT_4_2_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_4_2StudentCourseState,
  UNIT_4_2TeacherCourseSyncState,
  UNIT_4_2TeacherSyncInput
> = {
  lessonKey: UNIT_4_2_LESSON_KEY,
  studentItemId: UNIT_4_2_STUDENT_ITEM_ID,
  teacherItemId: UNIT_4_2_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_4_2_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_4_2_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_4_2StudentState,
  isStudentState: isUNIT_4_2StudentState,
  isTeacherSyncState: isUNIT_4_2TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit42',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_4_2TeacherSync(input: UNIT_4_2TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_4_2TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_4_2TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_4_2TeacherSession(input: UNIT_4_2TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
