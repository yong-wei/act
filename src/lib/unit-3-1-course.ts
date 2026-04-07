import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_1StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_3_1PageType =
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'quiz_group'
  | 'reason_check'
  | 'triple_match'
  | 'tab_switch'
  | 'comparison_workspace'
  | 'short_response'
  | 'parameter_workspace'
  | 'ai_compare_workspace'
  | 'formula_pair_check';

export interface UNIT_3_1PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_1PageContract {
  layout: {
    template: string;
    regions: UNIT_3_1PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_3_1PageType, 'display' | 'summary'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export type Unit31WorkspaceKind =
  | 'pole-family'
  | 'dominant-pole-compare'
  | 'bandwidth-check'
  | 'none';

export interface UNIT_3_1StepDefinition {
  id: string;
  stage: UNIT_3_1StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_1PageType;
  workspaceKind?: Unit31WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_3_1StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_1StudentCourseState {
  kind: 'unit31_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_1StepResponse>;
}

export interface UNIT_3_1TeacherCourseSyncState {
  kind: 'teacher_sync_unit31';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_3_1TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_1TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_1TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_1_ROUTE_SEGMENT = 'unit-3-1-pure-pole-stability-and-dynamics';
export const UNIT_3_1_PRESET_KEY = 'unit-3-1-pure-pole-stability-and-dynamics-v1';
export const UNIT_3_1_RESOURCE_KEY = 'unit-3-1-pure-pole-stability-and-dynamics';
export const UNIT_3_1_LESSON_KEY = UNIT_3_1_PRESET_KEY;
export const UNIT_3_1_STUDENT_ITEM_ID = 'student:unit31:state';
export const UNIT_3_1_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_1_STUDENT_STATE_KEY = 'course';
export const UNIT_3_1_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_1_COURSE_TITLE = '3-1：纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解';
export const UNIT_3_1_COURSE_SUBTITLE = 'Pure Poles, Modes & Approximation';
export const UNIT_3_1_COURSE_DESCRIPTION =
  '围绕稳定底线、极点到模态、主导极点近似、Bode 证据与卷积收束，建立模块 3 的第一堂结构机理精品互动课。';

export const UNIT_3_1_STAGE_LABEL: Record<UNIT_3_1StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_3_1_STAGE_MAP: Record<UNIT_3_1StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_3_1_PAGE_CONTRACTS: Record<string, UNIT_3_1PageContract> = {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'triple_model_vote',
      regions: [
        { id: 'formula-strip', width: 'full', order: 1 },
        { id: 'chart', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'reveal_correction_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'goal_chain_slide',
      regions: [
        { id: 'goals', width: 'full', order: 1 },
        { id: 'chain', width: 'full', order: 2 },
        { id: 'boundary', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-03',
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
    misconceptionTags: ['stable_not_equal_good', 'dominant_not_only', 'left_more_not_absolute'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'formula_plus_plane_check',
      regions: [
        { id: 'formula-card', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['prediction_distribution', 'reason_tag_cloud'],
    telemetrySummaryFields: ['predictionSubmitted', 'reasonLength', 'teacherRevealSeen'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'formula_explain_match',
      regions: [
        { id: 'formula-card', width: 'full', order: 1 },
        { id: 'explain-strip', width: 'full', order: 2 },
        { id: 'match-zone', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'triple_match',
    teacherInsightWidgets: ['common_mismatch_pairs', 'completion_rate'],
    telemetrySummaryFields: ['matchAttempted', 'matchCorrected', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'family_compare_switcher',
      regions: [
        { id: 'family-summary', width: 'full', order: 1 },
        { id: 'shared-chart', width: 'full', order: 2 },
        { id: 'switcher', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'tab_switch',
    teacherInsightWidgets: ['tab_focus_distribution'],
    telemetrySummaryFields: ['tabVisited', 'viewDuration'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'triple_model_compare',
      regions: [
        { id: 'formula-strip', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'comparison_workspace',
    teacherInsightWidgets: ['response_word_cloud', 'common_reason_tags'],
    telemetrySummaryFields: ['responseSubmitted', 'responseLength', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'decision_table_with_reason',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'prompt', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reason_check',
    teacherInsightWidgets: ['reason_tag_cloud', 'correction_rate'],
    telemetrySummaryFields: ['predictionSubmitted', 'reasonLength', 'teacherRevealSeen'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'bridge_table_plus_prompt',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'question-list', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'short_response',
    teacherInsightWidgets: ['response_word_cloud', 'common_reason_tags'],
    telemetrySummaryFields: ['responseSubmitted', 'responseLength', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'bode_compare_workspace',
      regions: [
        { id: 'formula-strip', width: 'full', order: 1 },
        { id: 'media', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'parameter_workspace',
    teacherInsightWidgets: ['confusion_matrix', 'completion_rate'],
    telemetrySummaryFields: ['selectionState', 'resultState', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'compare_then_ai',
      regions: [
        { id: 'judge-table', width: 'full', order: 1 },
        { id: 'ai-panel', width: 'full', order: 2 },
        { id: 'evidence-strip', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'ai_compare_workspace',
    teacherInsightWidgets: ['ai_compare_rate', 'revision_summary'],
    telemetrySummaryFields: ['draftSubmitted', 'aiCompared', 'revisionCount', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'dual_media_reason_check',
      regions: [
        { id: 'formula-card', width: 'full', order: 1 },
        { id: 'media-left', width: 'half', order: 2 },
        { id: 'media-right', width: 'half', order: 3 },
        { id: 'interaction', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'formula_pair_check',
    teacherInsightWidgets: ['misconception_rate', 'evidence_distribution'],
    telemetrySummaryFields: ['selectionState', 'resultState', 'evidenceChosen'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'post_quiz_stack',
      regions: [
        { id: 'quiz-stack', width: 'full', order: 1 },
        { id: 'submit-bar', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket', 'teacherRevealSeen'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'summary_infographic',
      regions: [
        { id: 'summary-strip', width: 'full', order: 1 },
        { id: 'infographic', width: 'full', order: 2 },
        { id: 'next-step', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-15',
  },
};

export const UNIT_3_1_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_1PageType>([
  'binary_choice',
  'quiz_group',
  'reason_check',
  'triple_match',
  'tab_switch',
  'comparison_workspace',
  'short_response',
  'parameter_workspace',
  'ai_compare_workspace',
  'formula_pair_check',
]);

export const UNIT_3_1_LESSON_STEPS: UNIT_3_1StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图——从模块2的对象语言走向模块3的机理语言',
    hint: '先标定 3-1 在模块 3 里的入口位置，明确“对象语言”要走向“机理语言”。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入——同主导极点，为什么响应还会不同',
    hint: '用三模型对照把主问题压实：主导极点很重要，但不是唯一证据。',
    duration: '5 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '学习目标与课堂边界——本课负责什么，不负责什么',
    hint: '会判稳定底线、会把极点翻译成模态、会判断近似何时可靠。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测——稳定、主导极点与“可忽略”直觉判断',
    hint: '先暴露“稳定不等于够好”“更靠左不是万能判断句”等起点混淆。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '稳定底线——先回答“能不能谈近似”',
    hint: '只有先立住稳定底线，后面谈主导极点近似和双域证据才有意义。',
    duration: '7 min',
    pageType: 'reason_check',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '从极点到模态——极点为什么会直接进入响应',
    hint: '把极点、留数和响应现象连成一条“模态语言”链。',
    duration: '7 min',
    pageType: 'triple_match',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '三类极点与重根——形态为什么会完全不同',
    hint: '通过切换典型极点家族，纠正“重根只是多一个极点”这类误区。',
    duration: '6 min',
    pageType: 'tab_switch',
    workspaceKind: 'pole-family',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '三模型时域对照——主导极点近似为什么有时可靠',
    hint: '同主导极点不等于时域表现完全相同，要看附加模态退场快慢。',
    duration: '8 min',
    pageType: 'comparison_workspace',
    workspaceKind: 'dominant-pole-compare',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '时域近似边界——“更靠左”不是万能判断句',
    hint: '经验不是定理，还要同时看权重、聚集极点与重根拖尾。',
    duration: '6 min',
    pageType: 'reason_check',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '仅看时域还不够——为什么还要回到频域',
    hint: '把“时域可接受”继续翻译成“主要带宽是否被附加极点侵入”的问题。',
    duration: '5 min',
    pageType: 'short_response',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: 'Bode 对照——附加极点何时侵入主要带宽',
    hint: '固有频率、转折频率和带宽分别回答什么问题，要明确区分。',
    duration: '8 min',
    pageType: 'parameter_workspace',
    workspaceKind: 'bandwidth-check',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '双域近似判断 + AI 对照——先自判，再问 AI，再回到图上核验',
    hint: '先写双域判断，再用页内 AI 对照证据链，而不是让 AI 替你下结论。',
    duration: '9 min',
    pageType: 'ai_compare_workspace',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '卷积与模态叠加——输入激发模态，但不会改写极点结构',
    hint: '卷积解释的是输入如何激发模态，不是改变系统极点结构。',
    duration: '7 min',
    pageType: 'formula_pair_check',
  },
  {
    id: 'step-14',
    stage: 'P3',
    title: '后测——会不会发散、能不能近似、为什么能解释',
    hint: '检验稳定底线、主导极点近似与卷积/模态语言是否真正连成了一条链。',
    duration: '7 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-15',
    stage: 'S',
    title: '总结与后续预告——先守底线，再谈机制，再谈后续方法',
    hint: '用四句出口判断收束 3-1，并把视角推进到 3-2 的稳定边界可视化。',
    duration: '4 min',
    pageType: 'summary',
  },
] as const;

export function getUNIT_3_1Step(stepId: string) {
  return UNIT_3_1_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_1_LESSON_STEPS[0];
}

export function getUNIT_3_1PageContract(stepId: string) {
  return UNIT_3_1_PAGE_CONTRACTS[stepId] ?? UNIT_3_1_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_1InteractivePageType(pageType: UNIT_3_1PageType) {
  return UNIT_3_1_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_1AiPageType(pageType: UNIT_3_1PageType) {
  return pageType === 'ai_compare_workspace';
}

export function createEmptyUNIT_3_1StudentState(studentName: string): UNIT_3_1StudentCourseState {
  return {
    kind: 'unit31_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_1_PREMIUM_LESSON_CARD = {
  id: 'unit-3-1-pure-pole-stability-and-dynamics',
  title: UNIT_3_1_COURSE_TITLE,
  description: '精品互动课：从稳定底线、模态与双域证据建立高阶系统低阶近似的第一轮机理语言。',
  duration: '100 分钟',
  href: `/interactive-learning/courses/${UNIT_3_1_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_1_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/3-1/media/3-1-pp-03-dominant-pole-response-families.svg',
  'step-05': '/course-runtime/lessons/3-1/media/3-1-pp-01-stability-half-plane.svg',
  'step-07': '/course-runtime/lessons/3-1/media/3-1-pp-02-poles-and-modes.svg',
  'step-08': '/course-runtime/lessons/3-1/media/3-1-pp-03-dominant-pole-response-families.svg',
  'step-11': '/course-runtime/lessons/3-1/media/3-1-pp-05-bode-model-reduction.svg',
  'step-13': '/course-runtime/lessons/3-1/media/3-1-pp-06-convolution-step-from-impulse.svg',
  'step-15': '/course-runtime/lessons/3-1/media/3-1-info.png',
};

export function getUNIT_3_1MediaSrc(stepId: string) {
  return UNIT_3_1_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_1StudentState(value: unknown): value is UNIT_3_1StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_1StudentCourseState>;
  return data.kind === 'unit31_student_state' && data.version === 1;
}

export function isUNIT_3_1TeacherSyncState(value: unknown): value is UNIT_3_1TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_1TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit31' && typeof data.activeStepId === 'string';
}

export const UNIT_3_1_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_1StudentCourseState,
  UNIT_3_1TeacherCourseSyncState,
  UNIT_3_1TeacherSyncInput
> = {
  lessonKey: UNIT_3_1_LESSON_KEY,
  studentItemId: UNIT_3_1_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_1_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_1_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_1_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_1StudentState,
  isStudentState: isUNIT_3_1StudentState,
  isTeacherSyncState: isUNIT_3_1TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit31',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_1TeacherSync(input: UNIT_3_1TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_1TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_3_1TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_1TeacherSession(input: UNIT_3_1TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
