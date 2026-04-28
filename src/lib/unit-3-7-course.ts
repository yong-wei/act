import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_7StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3';
export type UNIT_3_7PageType =
  | 'display'
  | 'binary_choice'
  | 'quiz_group'
  | 'quiz_card_grid'
  | 'hotspot_labeling'
  | 'worked_example_workspace'
  | 'activity_card_set';

export interface UNIT_3_7PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_7PageContract {
  layout: {
    template: string;
    regions: UNIT_3_7PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_3_7PageType, 'display'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export interface UNIT_3_7StepDefinition {
  id: string;
  stage: UNIT_3_7StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_7PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_3_7StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_7StudentCourseState {
  kind: 'unit37_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_7StepResponse>;
}

export interface UNIT_3_7TeacherCourseSyncState {
  kind: 'teacher_sync_unit37';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_3_7TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_7TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_7TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_7_ROUTE_SEGMENT = 'unit-3-7-steady-error-low-frequency-compensation';
export const UNIT_3_7_PRESET_KEY = 'unit-3-7-steady-error-low-frequency-compensation-v1';
export const UNIT_3_7_RESOURCE_KEY = 'unit-3-7-steady-error-low-frequency-compensation';
export const UNIT_3_7_LESSON_KEY = UNIT_3_7_PRESET_KEY;
export const UNIT_3_7_STUDENT_ITEM_ID = 'student:unit37:state';
export const UNIT_3_7_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_7_STUDENT_STATE_KEY = 'course';
export const UNIT_3_7_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_7_COURSE_TITLE = '3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理';
export const UNIT_3_7_COURSE_SUBTITLE = 'Steady Error And Low-Frequency Compensation';
export const UNIT_3_7_COURSE_DESCRIPTION =
  '围绕给定/扰动双通道、终值定理与型别快判、PI/滞后低频补偿比较，把“为什么更准”推进成一条可执行的稳态误差分析与补偿路径。';

export const UNIT_3_7_STAGE_LABEL: Record<UNIT_3_7StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测与收束',
};

export const UNIT_3_7_STAGE_MAP: Record<UNIT_3_7StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
};

export const UNIT_3_7_PAGE_CONTRACTS: Record<string, UNIT_3_7PageContract> = {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-01',
  },
  'step-02': {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-02',
  },
  'step-03': {
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
    misconceptionTags: ['disturbance_is_input_type', 'gain_equals_type_raise', 'lag_is_weaker_integral'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'formula_media_compare',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'formula', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_card_set',
    teacherInsightWidgets: ['option_distribution', 'channel_confusion_rate'],
    telemetrySummaryFields: ['attemptCount', 'completedCards', 'resultState'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'worked_example_workspace',
      regions: [
        { id: 'principle', width: 'full', order: 1 },
        { id: 'problem', width: 'full', order: 2 },
        { id: 'derivation', width: 'full', order: 3 },
        { id: 'activity', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['activity_completion_rate', 'top_missing_steps'],
    telemetrySummaryFields: ['attemptCount', 'stepRevealCount', 'completedCards'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'formula_table_workspace',
      regions: [
        { id: 'formula-groups', width: 'full', order: 1 },
        { id: 'tables', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_card_set',
    teacherInsightWidgets: ['table_match_distribution', 'top_confusions'],
    telemetrySummaryFields: ['attemptCount', 'completedCards', 'errorBucket'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'worked_example_workspace',
      regions: [
        { id: 'principle', width: 'full', order: 1 },
        { id: 'problem', width: 'full', order: 2 },
        { id: 'derivation', width: 'full', order: 3 },
        { id: 'activity', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['completion_rate', 'top_formula_gaps'],
    telemetrySummaryFields: ['attemptCount', 'stepRevealCount', 'completedCards'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'contrast_summary_board',
      regions: [
        { id: 'contrast', width: 'full', order: 1 },
        { id: 'activity', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'top_misclassifications'],
    telemetrySummaryFields: ['selectedOptions', 'resultState'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'formula_figure_table_stack',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'copy', width: 'full', order: 2 },
        { id: 'figure', width: 'full', order: 3 },
        { id: 'table', width: 'full', order: 4 },
        { id: 'activity', width: 'full', order: 5 },
      ],
    },
    interactionKind: 'activity_card_set',
    teacherInsightWidgets: ['method_confusion_rate', 'top_mismatch_pairs'],
    telemetrySummaryFields: ['attemptCount', 'completedCards', 'errorBucket'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'method_reveal_page',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'validation', width: 'full', order: 3 },
        { id: 'activity', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['completion_rate', 'top_reasoning_gaps'],
    telemetrySummaryFields: ['attemptCount', 'stepRevealCount', 'completedCards'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'method_reveal_page',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'validation', width: 'full', order: 3 },
        { id: 'activity', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['completion_rate', 'top_reasoning_gaps'],
    telemetrySummaryFields: ['attemptCount', 'stepRevealCount', 'completedCards'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'comparison_board',
      regions: [
        { id: 'dimension', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_card_set',
    teacherInsightWidgets: ['comparison_choice_distribution', 'top_confusions'],
    telemetrySummaryFields: ['attemptCount', 'completedCards', 'errorBucket'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'method_reveal_page',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'validation', width: 'full', order: 3 },
        { id: 'activity', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['completion_rate', 'top_reasoning_gaps'],
    telemetrySummaryFields: ['attemptCount', 'stepRevealCount', 'completedCards'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'method_reveal_page',
      regions: [
        { id: 'problem', width: 'full', order: 1 },
        { id: 'derivation', width: 'full', order: 2 },
        { id: 'validation', width: 'full', order: 3 },
        { id: 'activity', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['completion_rate', 'top_reasoning_gaps'],
    telemetrySummaryFields: ['attemptCount', 'stepRevealCount', 'completedCards'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'comparison_board',
      regions: [
        { id: 'dimension', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'activity', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'activity_card_set',
    teacherInsightWidgets: ['comparison_choice_distribution', 'top_confusions'],
    telemetrySummaryFields: ['attemptCount', 'completedCards', 'errorBucket'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-15',
  },
  'step-16': {
    layout: {
      template: 'assessment_card_grid',
      regions: [
        { id: 'cards', width: 'full', order: 1 },
        { id: 'feedback', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'quiz_card_grid',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'completedCards', 'errorBucket'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-16',
  },
  'step-17': {
    layout: {
      template: 'summary_route_board',
      regions: [
        { id: 'engineering', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'appendix', width: 'full', order: 3 },
        { id: 'next', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-17',
  },
};

export const UNIT_3_7_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_7PageType>([
  'binary_choice',
  'quiz_group',
  'quiz_card_grid',
  'hotspot_labeling',
  'worked_example_workspace',
  'activity_card_set',
]);

export const UNIT_3_7_LESSON_STEPS: UNIT_3_7StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图：为什么动态改善之后还可能不够准',
    hint: '先把 3-7 放回 3-6 到 3-8 之间，明确“更快更稳”并没有自动回答“为什么更准”。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'O',
    title: '学习目标与边界：本课先回答“为什么更准”',
    hint: '四项目标与课堂边界一次钉死，本课不提前进入 Nyquist 判据和完整频域整定。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-03',
    stage: 'P1',
    title: '前测：给定、扰动、型别三类混淆',
    hint: '先暴露“扰动也能套表”“增益变大等于型别提高”“滞后只是弱积分”三类误判。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '双通道骨架：四类传函分卡命名',
    hint: '用统一结构图把四类传函与总输出、总误差结论一次立住，先分通道再谈稳态误差。',
    duration: '7 min',
    pageType: 'activity_card_set',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '终值定理直接求：原理模块与例题 1 分离',
    hint: '三步法必须完整保留为“稳定 -> 列式 -> 极限”，不能只背终值公式或最终结果。',
    duration: '8 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '型别与静态误差系数：双表并排快判',
    hint: '快判只服务于标准给定输入；显式扰动和双输入问题仍要优先直接求。',
    duration: '7 min',
    pageType: 'activity_card_set',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '复合例题：给定与扰动共同作用时为什么不能只套表',
    hint: '显式双输入问题必须先分通道列总误差式，再用终值定理求结果。',
    duration: '8 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '增益变大 vs 型别提高：哪一种会改变误差阶次',
    hint: '把“压小有限误差”和“结构性归零”彻底分开，先判断是否必须引入积分。',
    duration: '5 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '低频补偿总览：PI、滞后与超前的结构差别',
    hint: '先读公式和文案，再看图与表，最后再做卡片判断，不能把总览页做成只有一张排序题。',
    duration: '7 min',
    pageType: 'activity_card_set',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '时域 PI 设计：先证明纯增益不够，再改结构',
    hint: '题面、可行域换算、PI 选点与验证图必须分层出现，验证图只能放在最后。',
    duration: '8 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '时域滞后设计：型别不变时怎样抬高低频增益',
    hint: '滞后页必须独立承载“纯增益矛盾 -> 零极点相对位置 -> Kv 提升 -> 验证结果”。',
    duration: '8 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '时域两法比较：收益、代价与适用场景',
    hint: '比较页只负责归纳，不再重复承载完整求解链。',
    duration: '5 min',
    pageType: 'activity_card_set',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '频域 PI 设计：纯增益为何不能两头兼顾',
    hint: '四步设计链必须完整出现：纯增益冲突 -> 目标截止频率 -> 零点布置 -> 幅值条件求 K 并回查。',
    duration: '8 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '频域 PD 方案读取：速度优先方案的核验结果',
    hint: '本页是方案读取与核验，不是假造一条并不存在的完整整定链。',
    duration: '6 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-15',
    stage: 'P2',
    title: '频域两法比较：低频精度优先 vs 动态速度优先',
    hint: '比较页必须同时保留“更准 / 更快 / 代价落点 / 设计取向”四类判断。',
    duration: '5 min',
    pageType: 'activity_card_set',
  },
  {
    id: 'step-16',
    stage: 'P3',
    title: '后测：路径选择与方法判断',
    hint: '后测单独成页，四题独立卡片并排，不能再与总结混页。',
    duration: '6 min',
    pageType: 'quiz_card_grid',
  },
  {
    id: 'step-17',
    stage: 'P3',
    title: '收束与去向：规则表、信息图与 3-8 入口',
    hint: '本页只承载工程视角、小结、规则表、信息图和 3-8 去向，不再包含任何后测题。',
    duration: '4 min',
    pageType: 'display',
  },
] as const;

export function getUNIT_3_7Step(stepId: string) {
  return UNIT_3_7_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_7_LESSON_STEPS[0];
}

export function getUNIT_3_7PageContract(stepId: string) {
  return UNIT_3_7_PAGE_CONTRACTS[stepId] ?? UNIT_3_7_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_7InteractivePageType(pageType: UNIT_3_7PageType) {
  return UNIT_3_7_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_7AiPageType(_pageType: UNIT_3_7PageType) {
  return false;
}

export function isUNIT_3_7ActivityFirstStep(stepId: string) {
  return false;
}

export function createEmptyUNIT_3_7StudentState(studentName: string): UNIT_3_7StudentCourseState {
  return {
    kind: 'unit37_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_7_PREMIUM_LESSON_CARD = {
  id: 'unit-3-7-steady-error-low-frequency-compensation',
  title: UNIT_3_7_COURSE_TITLE,
  description: '精品互动课：双通道误差、终值定理与型别快判、PI/滞后低频补偿比较。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_7_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_7_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/3-7/media/3-7-cover-comic.png',
  'step-04': '/course-runtime/lessons/3-7/media/3-7-error-dual-channel.png',
  'step-07': '/course-runtime/lessons/3-7/media/3-7-example2-structure.png',
  'step-09': '/course-runtime/lessons/3-7/media/3-7-low-frequency-compensators.png',
  'step-10': '/course-runtime/lessons/3-7/media/3-7-pi-time-domain-design.png',
  'step-11': '/course-runtime/lessons/3-7/media/3-7-lag-time-domain-design.png',
  'step-13': '/course-runtime/lessons/3-7/media/3-7-pi-frequency-design.png',
  'step-14': '/course-runtime/lessons/3-7/media/3-7-pi-pd-comparison.png',
  'step-17': '/course-runtime/lessons/3-7/media/3-7-info.png',
};

export function getUNIT_3_7MediaSrc(stepId: string) {
  return UNIT_3_7_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_7StudentState(value: unknown): value is UNIT_3_7StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_7StudentCourseState>;
  return data.kind === 'unit37_student_state' && data.version === 1;
}

export function isUNIT_3_7TeacherSyncState(value: unknown): value is UNIT_3_7TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_7TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit37' && typeof data.activeStepId === 'string';
}

export const UNIT_3_7_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_7StudentCourseState,
  UNIT_3_7TeacherCourseSyncState,
  UNIT_3_7TeacherSyncInput
> = {
  lessonKey: UNIT_3_7_LESSON_KEY,
  studentItemId: UNIT_3_7_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_7_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_7_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_7_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_7StudentState,
  isStudentState: isUNIT_3_7StudentState,
  isTeacherSyncState: isUNIT_3_7TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit37',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_7TeacherSync(input: UNIT_3_7TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_7TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_3_7TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_7TeacherSession(input: UNIT_3_7TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_3_7_LESSON_STEPS,
  }));
}
