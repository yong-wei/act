import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_1_1StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_1_1PageType =
  | 'display'
  | 'binary_choice'
  | 'quiz_group'
  | 'matching_pairs';

export interface UNIT_1_1PageRegionContract {
  id: string;
  width: 'full' | '1/2';
  order: number;
}

export interface UNIT_1_1PageContract {
  layout: {
    template: string;
    regions: UNIT_1_1PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_1_1PageType, 'display'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}
export type Unit11WorkspaceKind = 'none';

export interface UNIT_1_1StepDefinition {
  id: string;
  stage: UNIT_1_1StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_1_1PageType;
  workspaceKind?: Unit11WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_1_1MediaItem {
  src: string;
  caption: string;
  alt?: string;
}

export interface UNIT_1_1StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_1_1StudentCourseState {
  kind: 'unit11_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_1_1StepResponse>;
}

export interface UNIT_1_1TeacherCourseSyncState {
  kind: 'teacher_sync_unit11';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_1_1TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedWaitingList?: Record<string, boolean>;
  clearReleasedActivities?: boolean;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_1_1TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_1_1TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_1_1_ROUTE_SEGMENT = 'unit-1-1-see-the-full-picture';
export const UNIT_1_1_RESOURCE_KEY = 'unit-1-1-see-the-full-picture';
export const UNIT_1_1_LESSON_KEY = 'unit-1-1';
export const UNIT_1_1_PRESET_KEY = 'unit-1-1-see-the-full-picture-v1';
export const UNIT_1_1_STUDENT_ITEM_ID = 'student:unit11:state';
export const UNIT_1_1_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_1_1_STUDENT_STATE_KEY = 'course';
export const UNIT_1_1_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_1_1_COURSE_TITLE = '1-1：看见整门课——从反馈思想到控制全景';
export const UNIT_1_1_COURSE_SUBTITLE = 'A Lightning Tour of Control';
export const UNIT_1_1_COURSE_DESCRIPTION =
  '用一条船为贯穿对象，90分钟闪电遍历自动控制原理全部核心主题——从建模、时域响应、稳定性、根轨迹、频域分析到反馈与校正，走完诊断-校正-验证的完整闭环。';

export const UNIT_1_1_STAGE_LABEL: Record<UNIT_1_1StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_1_1_STAGE_MAP: Record<UNIT_1_1StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_1_1_PAGE_CONTRACTS: Record<string, UNIT_1_1PageContract> = {
  'step-01': {
    layout: {
      template: 'map_hero_slide',
      regions: [
        { id: 'cover', width: 'full', order: 1 },
        { id: 'lead', width: 'full', order: 2 },
        { id: 'stage-map', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count', 'sync_status'],
    telemetrySummaryFields: ['viewed', 'timeOnStep', 'teacherFollowSync'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'goal_cards',
      regions: [
        { id: 'goals', width: 'full', order: 1 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'question_stack',
      regions: [
        { id: 'quiz-stack', width: 'full', order: 1 },
        { id: 'submit-bar', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket', 'teacherRevealSeen'],
    misconceptionTags: ['open_loop_intuition_confusion', 'feedback_intuition_gap', 'derivative_concept_weakness'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'roadmap_with_cards',
      regions: [
        { id: 'roadmap', width: 'full', order: 1 },
        { id: 'cards', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'content_with_figure',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'code', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'evidence_with_cards',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'cards', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'content_with_figure',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'code', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'evidence_with_cards',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'code', width: 'full', order: 2 },
        { id: 'cards', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'guided_reveal_with_quiz',
      regions: [
        { id: 'content', width: 'full', order: 1 },
        { id: 'reveal', width: 'full', order: 2 },
        { id: 'quiz', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'reveal_correction_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen', 'timeOnStep'],
    misconceptionTags: ['feedback_misunderstood_as_faster', 'closed_loop_eliminates_all_disturbances'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'figure_and_table',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'table_with_cards',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'cards', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'code_walkthrough',
      regions: [
        { id: 'code', width: 'full', order: 1 },
        { id: 'figures', width: 'full', order: 2 },
        { id: 'captions', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'guided_reveal',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'reveal', width: 'full', order: 2 },
        { id: 'milestone', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['reveal_progress_rate'],
    telemetrySummaryFields: ['viewed', 'timeOnStep', 'teacherRevealAdvanced'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'post_quiz_stack',
      regions: [
        { id: 'quiz-stack', width: 'full', order: 1 },
        { id: 'submit-bar', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'matching_pairs',
    teacherInsightWidgets: ['question_distribution', 'explanation_tag_summary'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'teacherRevealSeen'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'summary_infographic',
      regions: [
        { id: 'takeaways', width: 'full', order: 1 },
        { id: 'infographic', width: 'full', order: 2 },
        { id: 'statistics', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['quick_reference_open_rate'],
    telemetrySummaryFields: ['viewed', 'quickReferenceOpened'],
    previewDemoPath: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-15',
  },
};

export const UNIT_1_1_INTERACTIVE_PAGE_TYPES = new Set<UNIT_1_1PageType>([
  'binary_choice',
  'quiz_group',
  'matching_pairs',
]);

export const UNIT_1_1_LESSON_STEPS: UNIT_1_1StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '看见整门课',
    hint: '用一条船贯穿全部八个问题，90分钟把自动控制原理全部核心主题走一遍。',
    duration: '5 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'O',
    title: '本次课程目标',
    hint: '五条布鲁姆能力目标：能用一条船说出全部核心主题，解释反馈是什么，说出六个核心函数名称和用途。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-03',
    stage: 'P1',
    title: '前测——基础概念与数学准备',
    hint: '三道题目检查反馈直觉、开环局限和变化率概念，不涉及控制理论术语。',
    duration: '5 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '开环诊断的七个问题',
    hint: '先看清对象，再讨论怎样干预它。模型、结构、时域、指标、稳定、根轨迹、频域构成一条诊断路线。',
    duration: '5 min',
    pageType: 'display',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '闪电速通——建模与结构表达',
    hint: '从一阶电机最小模型进入传递函数，再迁移到船舶航向对象的结构表达。',
    duration: '8 min',
    pageType: 'display',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '闪电速通——时域响应与性能指标',
    hint: 'step(G)看响应，Mp/ts/tr给系统表现打分。',
    duration: '7 min',
    pageType: 'display',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '闪电速通——稳定性与根轨迹',
    hint: '全部极点在左半平面→稳定；调大增益K，极点往哪跑？',
    duration: '7 min',
    pageType: 'display',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '频域视角与诊断流程收束',
    hint: '系统对不同频率的扰动态度不同——bode/margin给出另一种观察视角。',
    duration: '7 min',
    pageType: 'display',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '反馈与校正——从诊断到干预',
    hint: '把输出信息送回比较端，再用控制器改写闭环行为。',
    duration: '10 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '三域对比与诊断循环',
    hint: '反馈到底改变了什么？同一组证据，三张图，一张对照表。',
    duration: '6 min',
    pageType: 'display',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '课程地图与学习习惯',
    hint: '五个追问对应五个模块，以及四个让学习更有效率的习惯。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '完整代码走通——开环诊断',
    hint: '用一个真实二阶对象，把tf/step/rlocus/bode/margin全部跑一遍。',
    duration: '8 min',
    pageType: 'display',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '闭环校正与里程碑',
    hint: '加入比例反馈，见证诊断→校正→验证的完整闭环。',
    duration: '8 min',
    pageType: 'display',
  },
  {
    id: 'step-14',
    stage: 'P3',
    title: '后测——核心概念检验',
    hint: '检验反馈概念、函数功能和校正循环的掌握情况。',
    duration: '6 min',
    pageType: 'matching_pairs',
  },
  {
    id: 'step-15',
    stage: 'S',
    title: '总结——信息图与拓展思考',
    hint: '信息图复习三条核心判断，带着拓展思考去下一站。',
    duration: '5 min',
    pageType: 'display',
  },
] as const;

export function getUNIT_1_1Step(stepId: string) {
  return UNIT_1_1_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_1_1_LESSON_STEPS[0];
}

export function getUNIT_1_1PageContract(stepId: string) {
  return UNIT_1_1_PAGE_CONTRACTS[stepId] ?? UNIT_1_1_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_1_1InteractivePageType(pageType: UNIT_1_1PageType) {
  return UNIT_1_1_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_1_1AiPageType(_pageType: UNIT_1_1PageType) {
  return false;
}

export function createEmptyUNIT_1_1StudentState(studentName: string): UNIT_1_1StudentCourseState {
  return {
    kind: 'unit11_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_1_1_PREMIUM_LESSON_CARD = {
  id: 'unit-1-1-see-the-full-picture',
  lessonId: '1-1',
  title: '看见整门课：从反馈思想到控制全景',
  description: '用一条船为贯穿对象，90分钟闪电遍历自动控制原理全部核心主题——从建模、时域、稳定性、根轨迹、频域到反馈与校正，走通诊断-校正-验证的完整闭环。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_1_1_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_1_1_MEDIA_BY_STEP_ID: Record<string, UNIT_1_1MediaItem[]> = {
  'step-01': [
    {
      src: '/course-runtime/lessons/1-1/media/1-1-cover-comic.png',
      caption: '封面图提示本课主线：用一条船串联反馈、建模、诊断与校正。',
    },
  ],
  'step-05': [
    {
      src: '/course-runtime/lessons/1-1/media/1-1-block-diagram-basic.png',
      caption: '图示呈现控制系统的五个基本环节：比较、决策、执行、对象与测量。',
    },
  ],
  'step-06': [
    {
      src: '/course-runtime/lessons/1-1/media/1-1-step-response-first-order.png',
      caption: '阶跃响应曲线展示一阶对象从起步到稳态的完整动态过程。',
    },
  ],
  'step-07': [
    {
      src: '/course-runtime/lessons/1-1/media/1-1-root-locus-example.png',
      caption: '根轨迹图展示增益变化时极点沿实轴移动的方向。',
    },
  ],
  'step-08': [
    {
      src: '/course-runtime/lessons/1-1/media/1-1-bode-example.png',
      caption: 'Bode 图把同一对象对不同频率输入的幅值变化和相位滞后放在一起观察。',
    },
  ],
  'step-09': [
    {
      src: '/course-runtime/lessons/1-1/media/1-1-open-loop-block.png',
      caption: '开环结构中，输入指令直接作用于对象，输出信息不会回到比较端。',
    },
    {
      src: '/course-runtime/lessons/1-1/media/1-1-feedback-loop-block.png',
      caption: '反馈结构把输出测量送回比较端，使系统能够根据偏差修正动作。',
    },
    {
      src: '/course-runtime/lessons/1-1/media/1-1-closed-loop-block.png',
      caption: '单位负反馈结构展示控制器、对象与反馈通道如何构成闭环。',
    },
  ],
  'step-10': [
    {
      src: '/course-runtime/lessons/1-1/media/1-1-gain-comparison.png',
      caption: '三域对比展示比例反馈同时改变时域响应、极点位置与频域曲线。',
    },
  ],
  'step-12': [
    {
      src: '/course-runtime/lessons/1-1/media/1-1-example-openloop-step.png',
      caption: '开环阶跃响应显示示例对象不能收敛到有限稳态值。',
    },
    {
      src: '/course-runtime/lessons/1-1/media/1-1-example-root-locus.png',
      caption: '示例对象的根轨迹展示极点从 0 和 -2 出发，并在 -1 附近会合后离开实轴。',
    },
    {
      src: '/course-runtime/lessons/1-1/media/1-1-example-bode.png',
      caption: '开环 Bode 图展示积分环节与惯性环节共同形成的幅频衰减和相位滞后。',
    },
  ],
  'step-13': [
    {
      src: '/course-runtime/lessons/1-1/media/1-1-example-correction-triptych.png',
      caption: '校正前三域对比说明：加入反馈后，响应收敛、极点迁移，频域裕度随之变化。',
    },
  ],
  'step-15': [
    {
      src: '/course-runtime/lessons/1-1/media/1-1-info.png',
      caption: '信息图把本课的核心工具和后续学习路线收束为一张全景图。',
    },
  ],
};

export function getUNIT_1_1MediaItems(stepId: string): UNIT_1_1MediaItem[] {
  return UNIT_1_1_MEDIA_BY_STEP_ID[stepId] ?? [];
}

export function getUNIT_1_1MediaSrc(stepId: string) {
  return UNIT_1_1_MEDIA_BY_STEP_ID[stepId]?.[0]?.src ?? null;
}

export function isUNIT_1_1StudentState(value: unknown): value is UNIT_1_1StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_1_1StudentCourseState>;
  return data.kind === 'unit11_student_state' && data.version === 1;
}

export function isUNIT_1_1TeacherSyncState(value: unknown): value is UNIT_1_1TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_1_1TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit11' && typeof data.activeStepId === 'string';
}

export const UNIT_1_1_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_1_1StudentCourseState,
  UNIT_1_1TeacherCourseSyncState,
  UNIT_1_1TeacherSyncInput
> = {
  lessonKey: UNIT_1_1_LESSON_KEY,
  studentItemId: UNIT_1_1_STUDENT_ITEM_ID,
  teacherItemId: UNIT_1_1_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_1_1_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_1_1_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_1_1StudentState,
  isStudentState: isUNIT_1_1StudentState,
  isTeacherSyncState: isUNIT_1_1TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit11',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_1_1TeacherSync(input: UNIT_1_1TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_1_1TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_1_1TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_1_1TeacherSession(input: UNIT_1_1TeacherFinalizeInput) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_1_1_LESSON_STEPS,
  });
}
