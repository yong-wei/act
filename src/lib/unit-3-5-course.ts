import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_5StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_3_5PageType =
  | 'display'
  | 'binary_choice'
  | 'quiz_group'
  | 'annotation_choice'
  | 'compare_note'
  | 'risk_prediction_submit'
  | 'worked_example_workspace'
  | 'structured_compare'
  | 'sentence_rebuild'
  | 'frequency_band_labeling'
  | 'phase_peak_locator'
  | 'scenario_sort_matrix'
  | 'term_explainer'
  | 'exit_reflection';

export interface UNIT_3_5PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_5PageContract {
  layout: {
    template: string;
    regions: UNIT_3_5PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_3_5PageType, 'display'> | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export interface UNIT_3_5StepDefinition {
  id: string;
  stage: UNIT_3_5StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_5PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_3_5StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_5StudentCourseState {
  kind: 'unit35_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_5StepResponse>;
}

export interface UNIT_3_5TeacherCourseSyncState {
  kind: 'teacher_sync_unit35';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_3_5TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_5TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_5TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_5_ROUTE_SEGMENT = 'unit-3-5-zero-dynamic-improvement';
export const UNIT_3_5_PRESET_KEY = 'unit-3-5-zero-dynamic-improvement-v1';
export const UNIT_3_5_RESOURCE_KEY = 'unit-3-5-zero-dynamic-improvement';
export const UNIT_3_5_LESSON_KEY = UNIT_3_5_PRESET_KEY;
export const UNIT_3_5_STUDENT_ITEM_ID = 'student:unit35:state';
export const UNIT_3_5_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_5_STUDENT_STATE_KEY = 'course';
export const UNIT_3_5_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_5_COURSE_TITLE = '3-5：零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变';
export const UNIT_3_5_COURSE_SUBTITLE = 'Zero Dynamic Improvement';
export const UNIT_3_5_COURSE_DESCRIPTION =
  '围绕“只调增益为什么不够 -> 零点怎样重排根轨迹 -> PD/测速反馈与超前怎样改变三域表现 -> 非最小相边界为何需要保守带宽”这条链，把零点从概念讲成判断语言。';

export const UNIT_3_5_STAGE_LABEL: Record<UNIT_3_5StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_3_5_STAGE_MAP: Record<UNIT_3_5StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_3_5_PAGE_CONTRACTS: Record<string, UNIT_3_5PageContract> = {
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
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'goal_chain_slide',
      regions: [
        { id: 'objects', width: 'full', order: 1 },
        { id: 'outputs', width: 'full', order: 2 },
        { id: 'boundaries', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'question_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'record', width: 'full', order: 2 },
        { id: 'feedback', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket', 'intuitionTextSubmitted'],
    misconceptionTags: ['zero_equals_gain', 'pd_equals_rate_feedback', 'rhp_zero_still_helpful'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'figure_annotation_workspace',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'legend', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'annotation_choice',
    teacherInsightWidgets: ['branch_choice_distribution', 'real_axis_confusion_map'],
    telemetrySummaryFields: ['selectedBranchRegion', 'selectedRealAxisSegment', 'attemptCount'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'dual_figure_compare_workspace',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'compare', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'compare_note',
    teacherInsightWidgets: ['keyword_coverage', 'top_missing_reasoning_fields'],
    telemetrySummaryFields: ['compareNoteSubmitted', 'usedKeywords', 'attemptCount'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'contrast_summary_board',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'risk-prompt', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'risk_prediction_submit',
    teacherInsightWidgets: ['risk_prediction_distribution', 'optimistic_bias_rate'],
    telemetrySummaryFields: ['riskPredictionSubmitted', 'riskTag', 'submitTime'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'structure_compare_slide',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'notes', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['structure_misread_rate', 'option_distribution'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['rate_feedback_adds_forward_zero'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'formula_workspace',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'example', width: 'full', order: 2 },
        { id: 'workspace', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'worked_example_workspace',
    teacherInsightWidgets: ['numeric_accuracy_rate', 'missing_derivation_fields'],
    telemetrySummaryFields: ['submittedKd', 'submittedKt', 'derivationCompleteness', 'attemptCount'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'tri_domain_compare_workspace',
      regions: [
        { id: 'figure', width: 'full', order: 1 },
        { id: 'guide', width: 'full', order: 2 },
        { id: 'record', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'structured_compare',
    teacherInsightWidgets: ['single_domain_response_rate', 'difference_field_quality'],
    telemetrySummaryFields: ['compareFieldsCompleted', 'evidenceDomainCount', 'attemptCount'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'knowledge_integration_board',
      regions: [
        { id: 'summary', width: 'full', order: 1 },
        { id: 'interaction', width: 'full', order: 2 },
        { id: 'teacher-panel', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'sentence_rebuild',
    teacherInsightWidgets: ['keyword_missing_rate', 'completion_rate'],
    telemetrySummaryFields: ['tokenOrder', 'missingKeywords', 'attemptCount'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'frequency_principle_workspace',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'principle', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'frequency_band_labeling',
    teacherInsightWidgets: ['band_confusion_distribution', 'noise_risk_blind_rate'],
    telemetrySummaryFields: ['bandLabels', 'attemptCount', 'confusionTag'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'lead_phase_peak_workspace',
      regions: [
        { id: 'formula', width: 'full', order: 1 },
        { id: 'principle', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'phase_peak_locator',
    teacherInsightWidgets: ['peak_band_accuracy', 'margin_metric_confusion_rate'],
    telemetrySummaryFields: ['peakBandChoice', 'improvedMetricChoice', 'attemptCount'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'design_rule_matrix',
      regions: [
        { id: 'rules', width: 'full', order: 1 },
        { id: 'matrix', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'scenario_sort_matrix',
    teacherInsightWidgets: ['scenario_confusion_matrix', 'top_missed_constraints'],
    telemetrySummaryFields: ['scenarioPlacements', 'attemptCount', 'missedConstraintTag'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'nonminimum_phase_compare',
      regions: [
        { id: 'objects', width: 'full', order: 1 },
        { id: 'figure', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'term_explainer',
    teacherInsightWidgets: ['definition_quality', 'missing_phase_reasoning_rate'],
    telemetrySummaryFields: ['termExplanationSubmitted', 'usedKeywords', 'attemptCount'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'boundary_decision_workspace',
      regions: [
        { id: 'table', width: 'full', order: 1 },
        { id: 'quiz', width: 'full', order: 2 },
        { id: 'ai-compare', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['post_quiz_distribution', 'most_dangerous_misjudgement'],
    telemetrySummaryFields: ['postQuizScore', 'errorBucket', 'aiCompareUsed', 'dangerousMisjudgementTag'],
    misconceptionTags: ['zero_equals_gain', 'pd_equals_rate_feedback', 'lead_stronger_than_pd', 'keep_pushing_bandwidth_for_nmp'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-15',
  },
  'step-16': {
    layout: {
      template: 'summary_infographic',
      regions: [
        { id: 'infographic', width: 'full', order: 1 },
        { id: 'checklist', width: 'full', order: 2 },
        { id: 'next-step', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'exit_reflection',
    teacherInsightWidgets: ['observation_focus_distribution', 'exit_completion_rate'],
    telemetrySummaryFields: ['selectedObservationFocus', 'exitReflectionSubmitted'],
    previewDemoPath: '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-16',
  },
};

export const UNIT_3_5_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_5PageType>([
  'binary_choice',
  'quiz_group',
  'annotation_choice',
  'compare_note',
  'risk_prediction_submit',
  'worked_example_workspace',
  'structured_compare',
  'sentence_rebuild',
  'frequency_band_labeling',
  'phase_peak_locator',
  'scenario_sort_matrix',
  'term_explainer',
  'exit_reflection',
]);

export const UNIT_3_5_LESSON_STEPS: UNIT_3_5StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图：为什么只调增益很快不够',
    hint: '只阅读，不提交。',
    duration: '8 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'O',
    title: '统一对象、四个版本与三项固定产出',
    hint: '只建立比较框架，不提交。',
    duration: '4 min',
    pageType: 'display',
  },
  {
    id: 'step-03',
    stage: 'P1',
    title: '前测：先写下直觉，不让 AI 代替判断',
    hint: '完成三道前测，并提交一句自己的直觉判断。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '二阶纯极点对象接入零点：第一眼先看哪条分支被拉走',
    hint: '标记被零点拉走的分支，并勾选被重排的实轴区段。',
    duration: '6 min',
    pageType: 'annotation_choice',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '三阶对象接入零点：主导分支怎样被重新分配',
    hint: '完成一句比较判断。',
    duration: '6 min',
    pageType: 'compare_note',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '第一组结论：左半平面改善动态，右半平面先留下问号',
    hint: '在风险边界卡上写出对右半平面零点的第一判断。',
    duration: '6 min',
    pageType: 'risk_prediction_submit',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '结构辨认：PD 与测速反馈为什么不能混成一个名字',
    hint: '判断测速反馈是否在前向通道显式增加零点。',
    duration: '5 min',
    pageType: 'binary_choice',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '阻尼公式工作区：由目标阻尼反求 $K_d$ 与 $K_t$',
    hint: '填写 Kd、Kt 与代入链。',
    duration: '5 min',
    pageType: 'worked_example_workspace',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: 'PD 与测速反馈的三域对照：共同点与不同点分别落在哪里',
    hint: '分别填写共同点和不同点。',
    duration: '5 min',
    pageType: 'structured_compare',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '这一组实例真正该留下什么：提高阻尼不等于结构相同',
    hint: '把打散的关键词重组为一句完整结论。',
    duration: '5 min',
    pageType: 'sentence_rebuild',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: 'PD 单独装置的频域原理：抬中高频、推交叉、代价是高频放大',
    hint: '给低频、拐点后中高频和高频代价区打标签。',
    duration: '4 min',
    pageType: 'frequency_band_labeling',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '超前单独装置的频域原理：相位峰、补相角、作用集中在关键频带',
    hint: '定位相位峰所在频带，并判断改善的核心指标是相角裕度。',
    duration: '5 min',
    pageType: 'phase_peak_locator',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '频域设计原则：什么时候优先想 PD，什么时候优先想超前',
    hint: '把工程情境拖到优先想 PD、优先想超前或两者都不够三列。',
    duration: '5 min',
    pageType: 'scenario_sort_matrix',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '非最小相：镜像对象、逆响应与额外相位滞后',
    hint: '补全一句话“非最小相这个名字的来源是 ________”。',
    duration: '12 min',
    pageType: 'term_explainer',
  },
  {
    id: 'step-15',
    stage: 'P3',
    title: '非最小相控制边界与课后纠错：先保守带宽，再纠正危险误判',
    hint: '完成后测；后测提交后再输入一句自己最容易说错的误判。',
    duration: '6 min',
    pageType: 'quiz_group',
  },
  {
    id: 'step-16',
    stage: 'S',
    title: '收束：四个观察量、信息图与 3-6 统一对象实验预告',
    hint: '写一句“我以后先看哪一个观察量”。',
    duration: '2 min',
    pageType: 'exit_reflection',
  },
] as const;

export function getUNIT_3_5Step(stepId: string) {
  return UNIT_3_5_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_5_LESSON_STEPS[0];
}

export function getUNIT_3_5PageContract(stepId: string) {
  return UNIT_3_5_PAGE_CONTRACTS[stepId] ?? UNIT_3_5_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_5InteractivePageType(pageType: UNIT_3_5PageType) {
  return UNIT_3_5_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_5AiPageType(_pageType: UNIT_3_5PageType) {
  return true;
}

export function createEmptyUNIT_3_5StudentState(studentName: string): UNIT_3_5StudentCourseState {
  return {
    kind: 'unit35_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_5_PREMIUM_LESSON_CARD = {
  id: 'unit-3-5-zero-dynamic-improvement',
  title: UNIT_3_5_COURSE_TITLE,
  description: '精品互动课：零点重排、PD/测速反馈对照、超前频域原则与非最小相边界。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_5_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_5_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/3-5/media/3-5-cover-comic.png',
  'step-04': '/course-runtime/lessons/3-5/media/3-5-rl-01-low-order-zero-compare.png',
  'step-05': '/course-runtime/lessons/3-5/media/3-5-rl-02-high-order-zero-compare.png',
  'step-07': '/course-runtime/lessons/3-5/media/3-5-md-01-pd-rate-structure.png',
  'step-11': '/course-runtime/lessons/3-5/media/3-5-rl-03-pd-rate-compare.png',
  'step-12': '/course-runtime/lessons/3-5/media/3-5-rl-04-pd-lead-compare.png',
  'step-14': '/course-runtime/lessons/3-5/media/3-5-rl-05-nmp-compare.png',
  'step-16': '/course-runtime/lessons/3-5/media/3-5-info.png',
};

export function getUNIT_3_5MediaSrc(stepId: string) {
  return UNIT_3_5_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_5StudentState(value: unknown): value is UNIT_3_5StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_5StudentCourseState>;
  return data.kind === 'unit35_student_state' && data.version === 1;
}

export function isUNIT_3_5TeacherSyncState(value: unknown): value is UNIT_3_5TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_5TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit35' && typeof data.activeStepId === 'string';
}

export const UNIT_3_5_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_5StudentCourseState,
  UNIT_3_5TeacherCourseSyncState,
  UNIT_3_5TeacherSyncInput
> = {
  lessonKey: UNIT_3_5_LESSON_KEY,
  studentItemId: UNIT_3_5_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_5_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_5_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_5_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_5StudentState,
  isStudentState: isUNIT_3_5StudentState,
  isTeacherSyncState: isUNIT_3_5TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit35',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_5TeacherSync(input: UNIT_3_5TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_5TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_3_5TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_3_5TeacherSession(input: UNIT_3_5TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
