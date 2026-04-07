import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_4StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_3_4PageType =
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'quiz_group'
  | 'sequence_sort'
  | 'preset_prediction_submit'
  | 'annotation_submit'
  | 'window_tagging'
  | 'formula_workspace'
  | 'ai_compare_workspace'
  | 'panel_toggle_compare'
  | 'exit_reflection';

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
  updatedAt: number;
}

export interface UNIT_3_4TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
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
  '围绕关键节点读图、参数窗口判断、根轨迹增益换算与对象化三域验证，把 3-3 的根轨迹法则压成真正可用的判断动作链。';

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
    telemetrySummaryFields: ['viewed', 'timeOnStep', 'teacherFollowSync'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'binary_choice_illustration',
      regions: [
        { id: 'media', width: 'full', order: 1 },
        { id: 'questions', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'misconception_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['stability_equals_enough'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'goal_chain_slide',
      regions: [
        { id: 'goals', width: 'full', order: 1 },
        { id: 'outputs', width: 'full', order: 2 },
        { id: 'boundaries', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-03',
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
    misconceptionTags: ['single_domain_judgement', 'stability_equals_acceptability', 'k_equals_K'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'workflow_sort_board',
      regions: [
        { id: 'workflow', width: 'full', order: 1 },
        { id: 'interaction', width: 'full', order: 2 },
        { id: 'feedback', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'sequence_sort',
    teacherInsightWidgets: ['common_wrong_orders', 'completion_rate'],
    telemetrySummaryFields: ['sortOrder', 'attemptCount', 'resultState'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'version_prediction_workspace',
      regions: [
        { id: 'task', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'preset_prediction_submit',
    teacherInsightWidgets: ['first_impression_distribution', 'switch_path_heatmap'],
    telemetrySummaryFields: ['presetSwitchOrder', 'predictionLabels', 'submitTime'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'keynode_annotation_workspace',
      regions: [
        { id: 'task', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'annotation_submit',
    teacherInsightWidgets: ['annotation_heatmap', 'node_type_error_rate'],
    telemetrySummaryFields: ['annotationPoints', 'editCount', 'submitTime'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'window_judgement_workspace',
      regions: [
        { id: 'task', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'window_tagging',
    teacherInsightWidgets: ['window_label_distribution', 'high_risk_confusions'],
    telemetrySummaryFields: ['windowTags', 'revisionCount', 'submitState'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'gain_conversion_workspace',
      regions: [
        { id: 'task', width: 'full', order: 1 },
        { id: 'formula', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'formula_workspace',
    teacherInsightWidgets: ['kK_confusion_rate', 'formula_chain_completeness'],
    telemetrySummaryFields: ['formulaInputs', 'mistakeType', 'submitState'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'compare_then_ai',
      regions: [
        { id: 'self-work', width: 'full', order: 1 },
        { id: 'ai-panel', width: 'full', order: 2 },
        { id: 'revision', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'ai_compare_workspace',
    teacherInsightWidgets: ['common_chain_gaps', 'ai_helpfulness_tags'],
    telemetrySummaryFields: ['aiRequestSent', 'revisionDelta', 'finalSubmitState'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'step_compare_workspace',
      regions: [
        { id: 'task', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'panel_toggle_compare',
    teacherInsightWidgets: ['time_domain_choice_distribution', 'late_revision_rate'],
    telemetrySummaryFields: ['panelTogglePath', 'dwellTimeByVersion', 'revisionFlag'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'bode_compare_workspace',
      regions: [
        { id: 'task', width: 'full', order: 1 },
        { id: 'workspace', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'panel_toggle_compare',
    teacherInsightWidgets: ['final_ranking_distribution', 'single_domain_overuse_rate'],
    telemetrySummaryFields: ['panelTogglePath', 'finalRanking', 'evidenceDomainCount'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'post_quiz_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'submit-bar', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['correct_rate', 'missing_keyword_distribution'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'keywordCoverage'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'summary_infographic',
      regions: [
        { id: 'summary-grid', width: 'full', order: 1 },
        { id: 'exit-card', width: 'full', order: 2 },
        { id: 'next-step', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'exit_reflection',
    teacherInsightWidgets: ['exit_keyword_cloud', 'boundary_understanding_tags'],
    telemetrySummaryFields: ['reflectionSubmitted', 'reflectionKeywords', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-14',
  },
};

export const UNIT_3_4_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_4PageType>([
  'binary_choice',
  'quiz_group',
  'sequence_sort',
  'preset_prediction_submit',
  'annotation_submit',
  'window_tagging',
  'formula_workspace',
  'ai_compare_workspace',
  'panel_toggle_compare',
  'exit_reflection',
]);

export const UNIT_3_4_LESSON_STEPS: UNIT_3_4StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图——从 3-3 法则走向 3-4 判断',
    hint: '明确 3-4 不再重复法则证明，而是把法则压成可执行的读图动作与证据链。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入——稳定了，是否就已经够好',
    hint: '先打破“稳定就够”的直觉闭合，再进入窗口、换算与三域验证。',
    duration: '5 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '本节目标——三项固定产出与课堂边界',
    hint: '把本课的三项产出和不越界边界一次钉死。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测——你会先看哪个域来判断版本优劣',
    hint: '暴露“只看一域、稳定=可接受、k 直接等于 K”的起点误区。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '固定读图顺序：先骨架，再关键节点，再窗口',
    hint: '先把读图顺序定住，否则后面的版本判断会不断串层。',
    duration: '6 min',
    pageType: 'sequence_sort',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '工作区 A：A/B/C 三版本第一眼预测',
    hint: '先做第一轮排序，再用后续节点、窗口和三域证据修正。',
    duration: '8 min',
    pageType: 'preset_prediction_submit',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '工作区 B：关键节点标注与读图记录',
    hint: '把“会说法则名”推进成“会抓图上真正决定后续判断的节点”。',
    duration: '8 min',
    pageType: 'annotation_submit',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '工作区 C：稳定窗口与可接受窗口',
    hint: '稳定窗口回答还能不能工作，可接受窗口回答值不值得继续用。',
    duration: '8 min',
    pageType: 'window_tagging',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '工作区 D：根轨迹增益 k 到控制器增益 K 的换算',
    hint: '图上先读的是根轨迹增益，工程上最终要落到控制器增益语言。',
    duration: '7 min',
    pageType: 'formula_workspace',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: 'AI 对照——检查换算链而不是代做判断',
    hint: '让 AI 做链条校对器，不做版本排序代答器。',
    duration: '6 min',
    pageType: 'ai_compare_workspace',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '工作区 E：时域回查，谁慢、谁平衡、谁开始冒险',
    hint: '先用时域证据回查主图直觉，再判断哪一步最值得修正。',
    duration: '7 min',
    pageType: 'panel_toggle_compare',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '工作区 F：频域回查，风险为什么会先暴露',
    hint: '把主图、时域和频域真正闭合成最终工程判断。',
    duration: '7 min',
    pageType: 'panel_toggle_compare',
  },
  {
    id: 'step-13',
    stage: 'P3',
    title: '后测——完整工程判断要包含哪些证据',
    hint: '检查是否真正形成“关键节点 / 窗口 / 换算 / 三域”的完整判断链。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-14',
    stage: 'S',
    title: '收束——只调增益为什么很快会到边界',
    hint: '把“只调增益”的边界语言收束成下一课的结构改变入口。',
    duration: '4 min',
    pageType: 'exit_reflection',
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
  return true;
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
  description: '精品互动课：关键节点、参数窗口、增益换算与三域证据闭环。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_4_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_4_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/3-4/media/3-4-cover-comic.png',
  'step-05': '/course-runtime/lessons/3-4/media/3-4-root-locus-summary.png',
  'step-06': '/course-runtime/lessons/3-4/media/3-4-root-locus-summary.png',
  'step-07': '/course-runtime/lessons/3-4/media/3-4-root-locus-keynodes.png',
  'step-08': '/course-runtime/lessons/3-4/media/3-4-conditional-stability-window.png',
  'step-09': '/course-runtime/lessons/3-4/media/3-4-gain-conversion-card.png',
  'step-11': '/course-runtime/lessons/3-4/media/3-4-step-compare.png',
  'step-12': '/course-runtime/lessons/3-4/media/3-4-bode-compare.png',
  'step-14': '/course-runtime/lessons/3-4/media/3-4-info.png',
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
  teacherSyncState: UNIT_3_4TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_4TeacherSession(input: UNIT_3_4TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
