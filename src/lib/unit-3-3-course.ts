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
      template: 'equation_to_condition_chain',
      regions: [
        { id: 'equation-chain', width: 'full', order: 1 },
        { id: 'condition-intro', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'geometry_check_workspace',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'conditions', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['reason_distribution'],
    telemetrySummaryFields: ['selectedReason', 'attemptCount', 'teacherRevealSeen'],
    misconceptionTags: ['magnitude_before_angle'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-06',
  },
  'step-07': {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'keypoint_compare_board',
      regions: [
        { id: 'main-figure', width: 'full', order: 1 },
        { id: 'keypoint-cards', width: 'full', order: 2 },
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
        { id: 'problem', width: 'full', order: 1 },
        { id: 'method', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['example_bottlenecks'],
    telemetrySummaryFields: ['stepCompletion', 'attemptCount', 'errorBucket'],
    misconceptionTags: ['worked_example_order_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'equivalent_open_loop_chain',
      regions: [
        { id: 'rewrite-chain', width: 'full', order: 1 },
        { id: 'equivalent-card', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'formula_ordering',
    teacherInsightWidgets: ['ordering_error_patterns'],
    telemetrySummaryFields: ['orderAttempted', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['generalized_is_new_tool'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'compare_dual_root_locus',
      regions: [
        { id: 'example', width: 'full', order: 1 },
        { id: 'compare-table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'tab_switch',
    teacherInsightWidgets: ['tab_attention_distribution'],
    telemetrySummaryFields: ['tabVisited', 'timeOnTab'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'dynamic_translation_panel',
      regions: [
        { id: 'translation-table', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'mapping_highlight',
    teacherInsightWidgets: ['translation_error_map'],
    telemetrySummaryFields: ['mappingChoice', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['dynamic_translation_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'postcheck_quiz',
      regions: [
        { id: 'quiz', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'next-step', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['post_quiz_distribution', 'ready_for_next_lesson_rate'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket', 'teacherRevealSeen'],
    misconceptionTags: [
      'angle_magnitude_order_confusion',
      'skeleton_vs_keypoint_confusion',
      'generalized_rewrite_confusion',
    ],
    previewDemoPath: '/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-13',
  },
};

export const UNIT_3_3_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_3PageType>([
  'binary_choice',
  'short_response',
  'reason_check',
  'region_highlight',
  'triple_match',
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
    title: '回到地图：从稳定边界走向迁移机制',
    hint: '从 3-2 的边界语言回到模块主线，交代 3-3 为什么要研究极点怎样迁移。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'P1',
    title: '问题引入：知道 K=6 还不够',
    hint: '先暴露“知道边界点就够了”的误判，再提出整条迁移路径的问题。',
    duration: '5 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '本课目标与边界',
    hint: '明确本课负责迁移机制、完整法则、广义视角与动态翻译，不提前进入 3-4 的读图窗口。',
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
    title: '从闭环特征方程到 GH=-1',
    hint: '明确相角条件和幅值条件都从 GH=-1 这一步分出。',
    duration: '6 min',
    pageType: 'display',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '相角条件与幅值条件',
    hint: '稳住“先资格、后参数”的判断顺序。',
    duration: '10 min',
    pageType: 'reason_check',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '骨架法则：起点终点、实轴区段、渐近线',
    hint: '先搭整体骨架，不一上来就陷入关键节点与局部修正。',
    duration: '12 min',
    pageType: 'region_highlight',
    workspaceKind: 'region-highlight',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '关键节点：分离点、虚轴交点、起始角终止角',
    hint: '把三类关键节点的职责拆开，不混成同一类“细节点”。',
    duration: '10 min',
    pageType: 'triple_match',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '完整例题：三阶对象的根轨迹骨架与稳定范围',
    hint: '用一道主例把骨架、关键点和稳定范围重新串起来。',
    duration: '12 min',
    pageType: 'worked_example_workspace',
    workspaceKind: 'worked-example',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '广义根轨迹：一般参数怎样转回普通根轨迹',
    hint: '说明广义根轨迹没有新法则，只是换了改写入口。',
    duration: '7 min',
    pageType: 'formula_ordering',
    workspaceKind: 'formula-ordering',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '时间常数例子与 0°/180° 根轨迹',
    hint: '比较一般参数例子与 0°/180° 根轨迹的相同对象、不同相角条件。',
    duration: '6 min',
    pageType: 'tab_switch',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '动态翻译：从极点迁移到快慢和振荡',
    hint: '把图上的迁移重新翻译回稳定性、快慢和振荡趋势。',
    duration: '5 min',
    pageType: 'mapping_highlight',
    workspaceKind: 'mapping-highlight',
  },
  {
    id: 'step-13',
    stage: 'P3',
    title: '后测与收束：从法则走向读图窗口',
    hint: '用三题后测和五点总结把本课收束，并把出口推进到 3-4 的读图窗口。',
    duration: '6 min',
    pageType: 'quiz_group',
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
  'step-06': '/course-runtime/lessons/3-3/media/3-3-pp-03-angle-and-magnitude-geometry.svg',
  'step-07': '/course-runtime/lessons/3-3/media/3-3-pp-04-complete-rules-example.svg',
  'step-08': '/course-runtime/lessons/3-3/media/3-3-pp-06-departure-arrival-angle.svg',
  'step-09': '/course-runtime/lessons/3-3/media/3-3-pp-04-complete-rules-example.svg',
  'step-10': '/course-runtime/lessons/3-3/media/3-3-pp-01-root-locus-roadmap.svg',
  'step-11': '/course-runtime/lessons/3-3/media/3-3-pp-07-generalized-time-constant-example.svg',
  'step-12': '/course-runtime/lessons/3-3/media/3-3-pp-08-dynamics-translation.svg',
  'step-13': '/course-runtime/lessons/3-3/media/3-3-info.png',
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
