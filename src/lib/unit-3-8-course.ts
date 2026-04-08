import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_8StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3';
export type UNIT_3_8PageType =
  | 'display'
  | 'binary_choice'
  | 'quiz_group'
  | 'triple_match'
  | 'reason_check'
  | 'card_sort'
  | 'hotspot_labeling'
  | 'ai_compare_workspace'
  | 'structured_compare';

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
  interactionKind: Exclude<UNIT_3_8PageType, 'display'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
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
  updatedAt: number;
}

export interface UNIT_3_8TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
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
  '围绕结构变化的频域指纹、Nyquist 与 Bode 的统一判稳链、三频段分工和工程案例读回，把模块 3 的动态线与稳态线收成同一张频域判断地图。';

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
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'comparison_gallery_with_prompt',
      regions: [
        { id: 'gallery', width: 'full', order: 1 },
        { id: 'questions', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'misconception_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState'],
    misconceptionTags: ['only_watch_magnitude'],
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-02',
  },
  'step-03': {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-03',
  },
  'step-04': {
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
    misconceptionTags: ['band_before_conclusion', 'nyquist_skip_p', 'wc_equals_bw', 'nmp_unlimited_bandwidth'],
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'formula_table_match',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['common_mismatch_pairs'],
    telemetrySummaryFields: ['matchAttempted', 'matchCorrected'],
    misconceptionTags: ['cannot_locate_frequency_band'],
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'formula_media_compare',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['confusion_matrix'],
    telemetrySummaryFields: ['selectionState', 'resultState'],
    misconceptionTags: ['nyquist_memorize_without_chain'],
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'comparison_panel_with_sort',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'card_sort',
    teacherInsightWidgets: ['misclassified_cards'],
    telemetrySummaryFields: ['sortAttempted', 'sortCorrected'],
    misconceptionTags: ['rhp_zero_equals_unstable'],
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'dual_graph_indicator_locator',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'table', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'hotspot_labeling',
    teacherInsightWidgets: ['common_mislabels'],
    telemetrySummaryFields: ['labelAttempted', 'labelCorrected'],
    misconceptionTags: ['wc_equals_bw', 'bode_is_another_rule'],
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'compare_then_ai',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'prompt', width: 'full', order: 2 },
        { id: 'ai', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'ai_compare_workspace',
    teacherInsightWidgets: ['initial_band_choice', 'revision_rate'],
    telemetrySummaryFields: ['draftSubmitted', 'aiViewed', 'revisionState'],
    misconceptionTags: ['cannot_switch_goal_to_band'],
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'design_compare_workspace',
      regions: [
        { id: 'left-example', width: 'full', order: 1 },
        { id: 'right-example', width: 'full', order: 2 },
        { id: 'comparison', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_compare',
    teacherInsightWidgets: ['common_compare_gaps'],
    telemetrySummaryFields: ['fieldsCompleted', 'compareBucket'],
    misconceptionTags: ['cannot_link_margin_to_time_domain'],
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'design_compare_workspace',
      regions: [
        { id: 'left-example', width: 'full', order: 1 },
        { id: 'right-example', width: 'full', order: 2 },
        { id: 'comparison', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_compare',
    teacherInsightWidgets: ['common_compare_gaps'],
    telemetrySummaryFields: ['fieldsCompleted', 'compareBucket'],
    misconceptionTags: ['lower_gain_is_always_better'],
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'summary_quiz_board',
      regions: [
        { id: 'quiz', width: 'full', order: 1 },
        { id: 'summary', width: 'full', order: 2 },
        { id: 'next', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket'],
    misconceptionTags: ['pnz_order', 'wc_vs_bw', 'goal_to_band', 'nmp_bandwidth'],
    previewDemoPath: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-12',
  },
};

export const UNIT_3_8_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_8PageType>([
  'binary_choice',
  'quiz_group',
  'triple_match',
  'reason_check',
  'card_sort',
  'hotspot_labeling',
  'ai_compare_workspace',
  'structured_compare',
]);

export const UNIT_3_8_LESSON_STEPS: UNIT_3_8StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图：把 3-5 与 3-7 收成同一个频域问题',
    hint: '先把 3-5 的动态改善线和 3-7 的稳态改善线收束成 3-8 的统一频域判断问题。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入：为什么同样是结构变了，频域里看起来完全不同',
    hint: '先纠正“只看幅值就够了”的第一层频域误判。',
    duration: '6 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '学习目标与边界：本课统一翻译，不重开新章',
    hint: '四项目标与课堂边界一次钉死，本课负责统一翻译、判稳和工程读回。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测：四类典型误判先暴露出来',
    hint: '先暴露频段、P/N/Z 顺序、截止频率与带宽、非最小相边界四类起点误判。',
    duration: '8 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '频域翻译总表：增益、零点、积分与非最小相各改哪一段',
    hint: '把结构变化、首要频带和收益代价一一对齐，先看频带再谈结论。',
    duration: '8 min',
    pageType: 'triple_match',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '从 F(s)=1+L(s) 到 (-1,0)：Nyquist 判稳为什么成立',
    hint: '把辅助函数、幅角原理、临界点和 Z=P-N 读成一条固定逻辑链。',
    duration: '8 min',
    pageType: 'reason_check',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '快速判稳：先数 P，再数 N，最后算 Z',
    hint: 'Nyquist 快判不靠感觉，固定顺序永远是 P -> N -> Z。',
    duration: '8 min',
    pageType: 'card_sort',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: 'Bode 判稳：截止频率、相角裕度、增益裕度不是另一套规则',
    hint: 'Bode 判稳是在对数坐标上读同一临界边界，不能把截止频率和带宽混成一项。',
    duration: '8 min',
    pageType: 'hotspot_labeling',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '三频段分工：精度、速度和代价该分开看',
    hint: '先独立判断目标对应的频带，再用 AI 对照，不倒置顺序。',
    duration: '8 min',
    pageType: 'ai_compare_workspace',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '航向控制案例：中频超前为什么能同时更快且更稳',
    hint: '把航向控制案例读成中频定向改写，而不是低频补偿。',
    duration: '10 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '稳定平台案例：只降增益为什么不如中频定向校正',
    hint: '把“只降增益”和“中频定向补角”严格区分开，不把更稳直接等于更好。',
    duration: '10 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-12',
    stage: 'P3',
    title: '后测与收束：频域不是新章，而是模块 3 的统一判断地图',
    hint: '后测只检查判断顺序、边界和目标切换，小结把 3-8 接到 3-9 与 4-1。',
    duration: '10 min',
    pageType: 'quiz_group',
  },
] as const;

export function getUNIT_3_8Step(stepId: string) {
  return UNIT_3_8_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_8_LESSON_STEPS[0];
}

export function getUNIT_3_8PageContract(stepId: string) {
  return UNIT_3_8_PAGE_CONTRACTS[stepId] ?? UNIT_3_8_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_8InteractivePageType(pageType: UNIT_3_8PageType) {
  return UNIT_3_8_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_8AiPageType(pageType: UNIT_3_8PageType) {
  return pageType === 'ai_compare_workspace';
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
  description: '精品互动课：结构变化的频域指纹、Nyquist/Bode 统一判稳与三频段工程读回。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_8_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_8_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/3-8/media/3-8-cover-comic.png',
  'step-02': '/course-runtime/lessons/3-8/media/3-8-gain-effect.png',
  'step-05': '/course-runtime/lessons/3-8/media/3-8-zero-effect.png',
  'step-06': '/course-runtime/lessons/3-8/media/3-8-nyquist-example-check.png',
  'step-07': '/course-runtime/lessons/3-8/media/3-8-nyquist-quickcheck.png',
  'step-08': '/course-runtime/lessons/3-8/media/3-8-bode-example.png',
  'step-09': '/course-runtime/lessons/3-8/media/3-8-three-band-overview.png',
  'step-10': '/course-runtime/lessons/3-8/media/3-8-heading-case.png',
  'step-11': '/course-runtime/lessons/3-8/media/3-8-platform-case.png',
  'step-12': '/course-runtime/lessons/3-8/media/3-8-info.png',
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
  teacherSyncState: UNIT_3_8TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_8TeacherSession(input: UNIT_3_8TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
