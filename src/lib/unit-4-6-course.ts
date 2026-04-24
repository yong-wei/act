import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import {
  normalizeInteractiveRuntimeManifest,
  type InteractiveRuntimeManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';
import rawInteractiveManifest from '../../course-content/runtime/lessons/4-6/interactive-manifest.json';

export type UNIT_4_6StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_4_6TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only';
export type UNIT_4_6PageType = 'display' | 'summary' | 'quiz_group' | 'activity_card_set' | 'teacher_reveal_only';

export interface UNIT_4_6PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_4_6PageContract {
  layout: {
    template: string;
    regions: UNIT_4_6PageRegionContract[];
  };
  interactionKind: 'none' | 'quiz_group' | 'activity_card_set' | 'teacher_reveal_only';
  teacherControls: {
    releaseActivity: UNIT_4_6TeacherControlMode;
    openBrowse: UNIT_4_6TeacherControlMode;
    teacherStepReveal: UNIT_4_6TeacherControlMode;
    revealReferenceAnswer: UNIT_4_6TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiPageGoal: string;
  previewDemoPath: string;
}

export interface UNIT_4_6StepDefinition {
  id: string;
  stage: UNIT_4_6StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_4_6PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_4_6StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_4_6StudentCourseState {
  kind: 'unit46_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_4_6StepResponse>;
}

export interface UNIT_4_6TeacherCourseSyncState {
  kind: 'teacher_sync_unit46';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_4_6TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_4_6_ROUTE_SEGMENT = 'unit-4-6-fixed-structure-boundary-structural-encoding';
export const UNIT_4_6_PRESET_KEY = 'unit-4-6-fixed-structure-boundary-structural-encoding-v1';
export const UNIT_4_6_RESOURCE_KEY = UNIT_4_6_ROUTE_SEGMENT;
export const UNIT_4_6_LESSON_KEY = UNIT_4_6_PRESET_KEY;
export const UNIT_4_6_STUDENT_ITEM_ID = 'student:unit46:state';
export const UNIT_4_6_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_4_6_STUDENT_STATE_KEY = 'course';
export const UNIT_4_6_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_4_6_COURSE_TITLE = '4-6：场景迁移与方案比较：固定结构优化边界与结构编码入口';
export const UNIT_4_6_COURSE_SUBTITLE = 'Structural Encoding Boundary';
export const UNIT_4_6_COURSE_DESCRIPTION =
  '围绕驱逐舰任务迁移、固定结构失配、专用代价函数、统一结构编码、四类方案比较和专项验证，把固定结构优化边界推进到结构编码入口。';

export const UNIT_4_6_RUNTIME_MANIFEST = normalizeInteractiveRuntimeManifest(
  rawInteractiveManifest,
) as InteractiveRuntimeManifest;

export const UNIT_4_6_STAGE_LABEL: Record<UNIT_4_6StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测前证据',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_4_6_STAGE_MAP: Record<UNIT_4_6StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function preview(stepId: string) {
  return `/interactive-learning/courses/${UNIT_4_6_ROUTE_SEGMENT}/student/demo?step=${stepId}`;
}

export const UNIT_4_6_LESSON_STEPS: readonly UNIT_4_6StepDefinition[] = [
  { id: 'step-01', stage: 'B', title: '从场景配置对比到迁移问题：为什么这次不能只说“再调一调参数”', hint: '用表 1、旧解回收和失配图钉住问题写法失效。', duration: '8 min', pageType: 'display' },
  { id: 'step-02', stage: 'O', title: '本次课程目标：完成这轮迁移判断后应能做到什么', hint: '独立呈现本课布鲁姆能力目标。', duration: '5 min', pageType: 'display' },
  { id: 'step-03', stage: 'P1', title: '迁移场景任务重排：客船与驱逐舰到底换了什么', hint: '固定对象、参考、筛选线与优先判断的重排。', duration: '8 min', pageType: 'activity_card_set' },
  { id: 'step-04', stage: 'P2', title: '固定结构迁移后的失配信号：拖尾、航迹偏离与职责过载如何同时出现', hint: '失配图与三类信号共同说明旧问题写法失效。', duration: '10 min', pageType: 'teacher_reveal_only' },
  { id: 'step-05', stage: 'P2', title: '驱逐舰专用代价函数：为什么比较对象必须重写', hint: '把五项比较对象及其职责拆开写清。', duration: '9 min', pageType: 'activity_card_set' },
  { id: 'step-06', stage: 'P2', title: '何时把结构选择正式抬成问题本身', hint: '判断结构搜索是在什么条件下才成为合理入口。', duration: '8 min', pageType: 'teacher_reveal_only' },
  { id: 'step-07', stage: 'P2', title: '五类结构的统一编码：先判结构，再解释参数', hint: '承载六维编码、五类结构卡与两组解码示例。', duration: '12 min', pageType: 'teacher_reveal_only' },
  { id: 'step-08', stage: 'P2', title: '四类方案比较矩阵：先问目标是否对题，再问结构是否够用', hint: '把目标错位和结构边界拆成两道判断。', duration: '10 min', pageType: 'teacher_reveal_only' },
  { id: 'step-09', stage: 'P2', title: '结构搜索证据与专项验证：总代价更低为什么仍不自动等于可交付', hint: '把专项验证的真正结论固定为边界判断。', duration: '10 min', pageType: 'teacher_reveal_only' },
  { id: 'step-10', stage: 'P3', title: '后测：目标错位、结构边界与统一编码是否已经连成链', hint: '后测与总结彻底分离。', duration: '5 min', pageType: 'quiz_group' },
  { id: 'step-11', stage: 'S', title: '总结：从任务重排到结构编码入口的完整判断链', hint: '收束本课并移交 4-7。', duration: '5 min', pageType: 'summary' },
] as const;

export const UNIT_4_6_PAGE_CONTRACTS_REVIEW: Record<string, UNIT_4_6PageContract> = {
  'step-01': {
    layout: { template: 'migration_boundary_hero_board', regions: [{ id: 'evidence', width: 'full', order: 1 }, { id: 'comparison', width: 'full', order: 2 }, { id: 'figure', width: 'half', order: 3 }, { id: 'bridge', width: 'full', order: 4 }] },
    interactionKind: 'none',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'not_applicable', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['view_count', 'sync_status'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    misconceptionTags: [],
    aiPageGoal: '用表 1、旧解回收和新证据钉住“问题写法失效”的入口。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-01',
  },
  'step-02': {
    layout: { template: 'objective_chain_board', regions: [{ id: 'header', width: 'full', order: 1 }, { id: 'goals', width: 'full', order: 2 }, { id: 'bridge', width: 'full', order: 3 }] },
    interactionKind: 'none',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'not_applicable', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    misconceptionTags: [],
    aiPageGoal: '独立呈现本课布鲁姆能力目标。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-02',
  },
  'step-03': {
    layout: { template: 'scenario_reorder_compare_board', regions: [{ id: 'formula', width: 'full', order: 1 }, { id: 'comparison', width: 'full', order: 2 }, { id: 'summary', width: 'full', order: 3 }, { id: 'interaction', width: 'full', order: 4 }] },
    interactionKind: 'activity_card_set',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['card_completion_rate', 'error_bucket_distribution'],
    telemetrySummaryFields: ['cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['migration_as_speedup_only'],
    aiPageGoal: '把对象、任务和筛选线的重排写实。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-03',
  },
  'step-04': {
    layout: { template: 'mismatch_evidence_board', regions: [{ id: 'formula', width: 'full', order: 1 }, { id: 'figure', width: 'half', order: 2 }, { id: 'reveal', width: 'half', order: 3 }, { id: 'summary', width: 'full', order: 4 }] },
    interactionKind: 'teacher_reveal_only',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'not_applicable', teacherStepReveal: 'teacher_only', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['step_reveal_progress'],
    telemetrySummaryFields: ['stepRevealCount', 'timeOnStep'],
    misconceptionTags: ['parameter_tuning_is_enough'],
    aiPageGoal: '把三类失配信号落成可读可见的证据链。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-04',
  },
  'step-05': {
    layout: { template: 'objective_rewrite_board', regions: [{ id: 'formula', width: 'full', order: 1 }, { id: 'table', width: 'full', order: 2 }, { id: 'interaction', width: 'full', order: 3 }, { id: 'summary', width: 'full', order: 4 }] },
    interactionKind: 'activity_card_set',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['card_completion_rate', 'response_bucket_distribution'],
    telemetrySummaryFields: ['cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['metric_rename_only'],
    aiPageGoal: '把五项比较对象写成清楚的职责表。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-05',
  },
  'step-06': {
    layout: { template: 'structure_entry_board', regions: [{ id: 'chain', width: 'full', order: 1 }, { id: 'reveal', width: 'full', order: 2 }, { id: 'structures', width: 'full', order: 3 }, { id: 'summary', width: 'full', order: 4 }] },
    interactionKind: 'teacher_reveal_only',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'not_applicable', teacherStepReveal: 'teacher_only', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['step_reveal_progress'],
    telemetrySummaryFields: ['stepRevealCount', 'timeOnStep'],
    misconceptionTags: ['structure_search_as_algorithm_upgrade'],
    aiPageGoal: '把结构搜索引入条件钉成显性判断链。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-06',
  },
  'step-07': {
    layout: { template: 'structural_encoding_workspace', regions: [{ id: 'encoding', width: 'full', order: 1 }, { id: 'codebook', width: 'full', order: 2 }, { id: 'examples', width: 'full', order: 3 }, { id: 'interaction', width: 'full', order: 4 }] },
    interactionKind: 'teacher_reveal_only',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'not_applicable', teacherStepReveal: 'teacher_only', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate'],
    telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['all_slots_active', 'decode_order_confusion'],
    aiPageGoal: '把统一编码稳定落成“结构优先”的解码链。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-07',
  },
  'step-08': {
    layout: { template: 'four_scheme_compare_board', regions: [{ id: 'matrix', width: 'full', order: 1 }, { id: 'figure', width: 'full', order: 2 }, { id: 'table', width: 'full', order: 3 }, { id: 'summary', width: 'full', order: 4 }] },
    interactionKind: 'teacher_reveal_only',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'not_applicable', teacherStepReveal: 'teacher_only', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['step_reveal_progress'],
    telemetrySummaryFields: ['stepRevealCount', 'timeOnStep'],
    misconceptionTags: ['just_pick_best_row'],
    aiPageGoal: '把目标错位和结构边界拆成两道判断。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-08',
  },
  'step-09': {
    layout: { template: 'boundary_probe_board', regions: [{ id: 'convergence', width: 'full', order: 1 }, { id: 'probe', width: 'full', order: 2 }, { id: 'control', width: 'full', order: 3 }, { id: 'summary', width: 'full', order: 4 }, { id: 'interaction', width: 'full', order: 5 }] },
    interactionKind: 'teacher_reveal_only',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'not_applicable', teacherStepReveal: 'teacher_only', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['step_reveal_progress', 'card_completion_rate'],
    telemetrySummaryFields: ['stepRevealCount', 'cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['lower_cost_equals_delivery'],
    aiPageGoal: '把专项验证的真正结论固定为边界判断。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-09',
  },
  'step-10': {
    layout: { template: 'posttest_board', regions: [{ id: 'header', width: 'full', order: 1 }, { id: 'quiz', width: 'full', order: 2 }, { id: 'note', width: 'full', order: 3 }] },
    interactionKind: 'quiz_group',
    teacherControls: { releaseActivity: 'teacher_toggle', openBrowse: 'page_load_open', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'teacher_toggle' },
    teacherInsightWidgets: ['card_completion_rate', 'response_bucket_distribution'],
    telemetrySummaryFields: ['cardSubmitted', 'timeOnStep'],
    misconceptionTags: ['algorithm_name_over_chain'],
    aiPageGoal: '检查学生是否已把目标、结构与编码连成链。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-10',
  },
  'step-11': {
    layout: { template: 'summary_exit_board', regions: [{ id: 'summary', width: 'full', order: 1 }, { id: 'info', width: 'full', order: 2 }, { id: 'chain', width: 'full', order: 3 }, { id: 'next', width: 'full', order: 4 }] },
    interactionKind: 'none',
    teacherControls: { releaseActivity: 'not_applicable', openBrowse: 'not_applicable', teacherStepReveal: 'not_applicable', revealReferenceAnswer: 'not_applicable' },
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    misconceptionTags: [],
    aiPageGoal: '收束本课并移交 4-7。',
    previewDemoPath: '/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/demo?step=step-11',
  },
};

export const UNIT_4_6_PAGE_CONTRACTS = UNIT_4_6_PAGE_CONTRACTS_REVIEW;

export function getUNIT_4_6Step(stepId: string) {
  return UNIT_4_6_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_4_6_LESSON_STEPS[0];
}

export function getUNIT_4_6ManifestStep(stepId: string) {
  return UNIT_4_6_RUNTIME_MANIFEST.steps.find((step) => step.id === stepId) ?? UNIT_4_6_RUNTIME_MANIFEST.steps[0];
}

export function getUNIT_4_6PageContract(stepId: string) {
  return UNIT_4_6_PAGE_CONTRACTS[stepId] ?? UNIT_4_6_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_4_6InteractivePageType(pageType: UNIT_4_6PageType) {
  return pageType === 'activity_card_set' || pageType === 'teacher_reveal_only' || pageType === 'quiz_group';
}

export function isUNIT_4_6StepReleasedByDefault(stepId: string) {
  const contract = getUNIT_4_6PageContract(stepId);
  return (
    contract.teacherControls.releaseActivity === 'page_load_open' ||
    contract.teacherControls.releaseActivity === 'not_applicable'
  );
}

export function createEmptyUNIT_4_6StudentState(studentName: string): UNIT_4_6StudentCourseState {
  return {
    kind: 'unit46_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_4_6_PREMIUM_LESSON_CARD = {
  id: UNIT_4_6_RESOURCE_KEY,
  title: UNIT_4_6_COURSE_TITLE,
  description: '精品互动课：把任务迁移、固定结构失配、目标重写和统一结构编码接成一条结构边界判断链。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_4_6_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_4_6StudentState(value: unknown): value is UNIT_4_6StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_6StudentCourseState>;
  return data.kind === 'unit46_student_state' && data.version === 1;
}

export function isUNIT_4_6TeacherSyncState(value: unknown): value is UNIT_4_6TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_6TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit46' && typeof data.activeStepId === 'string';
}

export const UNIT_4_6_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_4_6StudentCourseState,
  UNIT_4_6TeacherCourseSyncState,
  UNIT_4_6TeacherSyncInput
> = {
  lessonKey: UNIT_4_6_LESSON_KEY,
  studentItemId: UNIT_4_6_STUDENT_ITEM_ID,
  teacherItemId: UNIT_4_6_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_4_6_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_4_6_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_4_6StudentState,
  isStudentState: isUNIT_4_6StudentState,
  isTeacherSyncState: isUNIT_4_6TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit46',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_4_6TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_4_6TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_4_6TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_4_6TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await input.finishSession();
  input.trackSessionFinalize({ currentStepId: input.currentStepId });
}
