import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import {
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_4_7StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_4_7TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only';
export type UNIT_4_7PageType = 'display' | 'summary' | 'quiz_group' | 'activity_card_set' | 'teacher_reveal_only';

export interface UNIT_4_7PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_4_7PageContract {
  layout: {
    template: string;
    regions: UNIT_4_7PageRegionContract[];
  };
  interactionKind: 'none' | 'quiz_group' | 'activity_card_set' | 'teacher_reveal_only';
  teacherControls: {
    releaseActivity: UNIT_4_7TeacherControlMode;
    openBrowse: UNIT_4_7TeacherControlMode;
    teacherStepReveal: UNIT_4_7TeacherControlMode;
    revealReferenceAnswer: UNIT_4_7TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiPageGoal: string;
  aiDeliveryMode?: string;
  figureLayoutMirror?: string;
  controlsPlacement?: string;
  controlsCollapsedByDefault?: boolean;
  previewDemoPath: string;
}

export interface UNIT_4_7StepDefinition {
  id: string;
  stage: UNIT_4_7StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_4_7PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_4_7StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_4_7StudentCourseState {
  kind: 'unit47_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_4_7StepResponse>;
}

export interface UNIT_4_7TeacherCourseSyncState {
  kind: 'teacher_sync_unit47';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_4_7TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_4_7_ROUTE_SEGMENT = 'unit-4-7-destroyer-hifi-design-closure';
export const UNIT_4_7_PRESET_KEY = 'unit-4-7-destroyer-hifi-design-closure-v1';
export const UNIT_4_7_RESOURCE_KEY = UNIT_4_7_ROUTE_SEGMENT;
export const UNIT_4_7_LESSON_KEY = UNIT_4_7_PRESET_KEY;
export const UNIT_4_7_STUDENT_ITEM_ID = 'student:unit47:state';
export const UNIT_4_7_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_4_7_STUDENT_STATE_KEY = 'course';
export const UNIT_4_7_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_4_7_COURSE_TITLE = '4-7：高保真辨识、设计验证与扰动边界';
export const UNIT_4_7_COURSE_SUBTITLE = 'Destroyer Hifi Design Closure';
export const UNIT_4_7_COURSE_DESCRIPTION =
  '围绕高保真航向任务、分段辨识、传统设计、优化解码、跨模型验证、扰动噪声边界和前沿方法入口，完成固定低阶结构的工程设计闭环。';

export const UNIT_4_7_STAGE_LABEL: Record<UNIT_4_7StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: '前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_4_7_STAGE_MAP: Record<UNIT_4_7StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function preview(stepId: string) {
  return `/interactive-learning/courses/${UNIT_4_7_ROUTE_SEGMENT}/student/demo?step=${stepId}`;
}

export const UNIT_4_7_LESSON_STEPS: readonly UNIT_4_7StepDefinition[] = [
  { id: 'step-01', stage: 'B', title: '从固定结构设计到高保真任务边界', hint: '从已有固定结构设计链提出高保真任务边界问题。', duration: '5 min', pageType: 'display' },
  { id: 'step-02', stage: 'P1', title: '前测', hint: '回顾一阶惯性、积分关系、频域裕度和目标约束罚项区分。', duration: '7 min', pageType: 'quiz_group' },
  { id: 'step-03', stage: 'P2', title: '真实航迹任务与分段辨识模型结构', hint: '组合真实航迹任务、舵机/船体/扰动辨识与最终名义模型。', duration: '10 min', pageType: 'teacher_reveal_only' },
  { id: 'step-04', stage: 'P2', title: '指标到代价函数：航迹、舵角和裕度怎样进入同一个判断', hint: '把真实指标翻译成目标、约束、罚项和诊断量。', duration: '8 min', pageType: 'activity_card_set' },
  { id: 'step-05', stage: 'P2', title: '传统设计诊断四联图：为什么结构定型为 $PI+\\text{超前}$', hint: '用时域、根轨迹、Bode 与 Nyquist 证据完成结构选择。', duration: '8 min', pageType: 'teacher_reveal_only' },
  { id: 'step-06', stage: 'P2', title: '传统控制器参数计算与名义验证：控制值怎样落成可复核公式', hint: '给出传统控制器公式、校正四联图和跨模型验证。', duration: '9 min', pageType: 'teacher_reveal_only' },
  { id: 'step-07', stage: 'P2', title: '优化设计编码与解码：搜索结果怎样回到确定控制值', hint: '展示结构编码、搜索参数、收敛曲线、控制器符号含义和参数表。', duration: '8 min', pageType: 'activity_card_set' },
  { id: 'step-08', stage: 'P2', title: '跨模型验证：名义模型上最好是否能转成高保真可用', hint: '比较传统、辨识模型优化和高保真模型优化的任务结果。', duration: '8 min', pageType: 'teacher_reveal_only' },
  { id: 'step-09', stage: 'P2', title: '扰动边界：为什么中等扰动需要重新搜索抗扰控制器', hint: '分级扰动强度，比较名义、优化与抗扰控制器。', duration: '7 min', pageType: 'activity_card_set' },
  { id: 'step-10', stage: 'P2', title: '航向传感器噪声：噪声只进入测量通道时怎样抗噪', hint: '固定测量方程，比较无抗噪和有抗噪控制方案。', duration: '7 min', pageType: 'activity_card_set' },
  { id: 'step-11', stage: 'P3', title: '后测：参数来源、结构选择和边界判断是否已经成链', hint: '独立检查参数来源、结构选择、跨模型验证和扰动边界。', duration: '6 min', pageType: 'quiz_group' },
  { id: 'step-12', stage: 'S', title: '总结：传统控制结构的局限与前沿方法入口', hint: '收束固定低阶结构边界，连接鲁棒控制、扰动观测、增益调度、MPC 与学习型策略。', duration: '7 min', pageType: 'summary' },
] as const;

export const UNIT_4_7_AI_PAGE_GOALS: Record<string, string> = {
  'step-01': '从固定结构设计的已有知识提出高保真任务边界问题。',
  'step-02': '回顾一阶惯性、积分关系、频域裕度和约束罚项区分。',
  'step-03': '把真实航迹任务、分段辨识、最终名义模型和扰动边界放在同一证据链。',
  'step-04': '把真实任务指标翻译为可计算目标与硬边界。',
  'step-05': '从诊断四联图推导传统控制结构选择。',
  'step-06': '让传统控制器从参数计算落成可复核公式并接受跨模型验证。',
  'step-07': '把优化搜索落回可解释结构和确定控制值。',
  'step-08': '用航向和航迹两类证据审查跨模型可交付性。',
  'step-09': '分级讨论扰动，并说明为什么抗扰优化需要重新搜索。',
  'step-10': '把航向传感器噪声限定在测量通道，并解释抗噪控制。',
  'step-11': '检查参数来源、结构选择、跨模型验证和边界判断。',
  'step-12': '收束传统控制结构局限，并给出前沿方法入口。',
};

function normalizeUNIT_4_7InteractionKind(kind: string): UNIT_4_7PageContract['interactionKind'] {
  if (kind === 'quiz_group' || kind === 'activity_card_set' || kind === 'teacher_reveal_only') {
    return kind;
  }
  return 'none';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_4_7PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_4_7InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_4_7TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_4_7TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_4_7TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_4_7TeacherControlMode,
    },
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    aiPageGoal: step.aiContextSpec.pageGoal,
    aiDeliveryMode: step.aiContextSpec.deliveryMode,
    figureLayoutMirror: step.interactiveFigureSpec.layoutMirror,
    controlsPlacement: step.interactiveFigureSpec.controlsPlacement,
    controlsCollapsedByDefault: step.interactiveFigureSpec.controlsCollapsedByDefault,
    previewDemoPath: step.previewContract.demoPath,
  };
}

function fallbackManifestStep(step: UNIT_4_7StepDefinition): InteractiveRuntimeStepManifest {
  return {
    id: step.id,
    title: step.title,
    layout: {
      template: 'stacked_regions',
      regions: [{ id: 'main', width: 'full', order: 1 }],
    },
    modules: [],
    contentBlocks: {},
    evidenceSequence: [],
    interactionSpec: {
      interactionKind: step.pageType === 'display' || step.pageType === 'summary' ? 'none' : step.pageType,
    },
    teacherControls: {
      releaseActivity: step.pageType === 'activity_card_set' || step.pageType === 'quiz_group'
        ? 'teacher_toggle'
        : 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: step.pageType === 'teacher_reveal_only' ? 'teacher_toggle' : 'not_applicable',
      revealReferenceAnswer: step.pageType === 'quiz_group' ? 'teacher_toggle' : 'not_applicable',
    },
    studentAccess: {},
    teacherInsightSpec: { widgets: [] },
    telemetrySpec: { summaryFields: [], misconceptionTags: [] },
    aiContextSpec: {
      pageGoal: UNIT_4_7_AI_PAGE_GOALS[step.id] ?? step.hint,
      deliveryMode: 'hidden_page_context',
    },
    interactiveFigureSpec: {},
    previewContract: { demoPath: preview(step.id) },
    acceptanceChecks: [],
  };
}

export const UNIT_4_7_RUNTIME_MANIFEST: InteractiveRuntimeManifest = {
  lessonId: '4-7',
  courseTitle: UNIT_4_7_COURSE_TITLE,
  courseRouteSegment: UNIT_4_7_ROUTE_SEGMENT,
  previewMode: {},
  mediaPolicy: {},
  telemetryStrategy: 'runtime_externalized',
  teacherInsightStrategy: 'runtime_externalized',
  requiredStepFields: [],
  stepOrder: UNIT_4_7_LESSON_STEPS.map((step) => step.id),
  steps: UNIT_4_7_LESSON_STEPS.map(fallbackManifestStep),
};

export function getUNIT_4_7ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  const activeManifest = manifest ?? UNIT_4_7_RUNTIME_MANIFEST;
  return activeManifest.steps.find((step) => step.id === stepId) ?? activeManifest.steps[0];
}

export function getUNIT_4_7PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_4_7ManifestStepFromManifest(manifest, stepId));
}

export const UNIT_4_7_PAGE_CONTRACTS: Record<string, UNIT_4_7PageContract> = Object.fromEntries(
  UNIT_4_7_RUNTIME_MANIFEST.steps.map((step) => [step.id, pageContractFromManifestStep(step)]),
) as Record<string, UNIT_4_7PageContract>;

export const UNIT_4_7_PAGE_CONTRACTS_REVIEW = UNIT_4_7_PAGE_CONTRACTS;

export function getUNIT_4_7Step(stepId: string) {
  return UNIT_4_7_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_4_7_LESSON_STEPS[0];
}

export function getUNIT_4_7ManifestStep(stepId: string) {
  return getUNIT_4_7ManifestStepFromManifest(UNIT_4_7_RUNTIME_MANIFEST, stepId);
}

export function getUNIT_4_7PageContract(stepId: string) {
  return UNIT_4_7_PAGE_CONTRACTS[stepId] ?? UNIT_4_7_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_4_7InteractivePageType(pageType: UNIT_4_7PageType) {
  return pageType === 'activity_card_set' || pageType === 'teacher_reveal_only' || pageType === 'quiz_group';
}

export function isUNIT_4_7StepReleasedByDefault(stepId: string) {
  const contract = getUNIT_4_7PageContract(stepId);
  return (
    contract.teacherControls.releaseActivity === 'page_load_open' ||
    contract.teacherControls.releaseActivity === 'not_applicable'
  );
}

export function createEmptyUNIT_4_7StudentState(studentName: string): UNIT_4_7StudentCourseState {
  return {
    kind: 'unit47_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_4_7_PREMIUM_LESSON_CARD = {
  id: UNIT_4_7_RESOURCE_KEY,
  title: UNIT_4_7_COURSE_TITLE,
  description: '精品互动课：把高保真辨识、传统设计、优化解码、跨模型验证和扰动噪声边界接成完整工程设计闭环。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_4_7_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_4_7StudentState(value: unknown): value is UNIT_4_7StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_7StudentCourseState>;
  return data.kind === 'unit47_student_state' && data.version === 1;
}

export function isUNIT_4_7TeacherSyncState(value: unknown): value is UNIT_4_7TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_7TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit47' && typeof data.activeStepId === 'string';
}

export const UNIT_4_7_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_4_7StudentCourseState,
  UNIT_4_7TeacherCourseSyncState,
  UNIT_4_7TeacherSyncInput
> = {
  lessonKey: UNIT_4_7_LESSON_KEY,
  studentItemId: UNIT_4_7_STUDENT_ITEM_ID,
  teacherItemId: UNIT_4_7_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_4_7_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_4_7_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_4_7StudentState,
  isStudentState: isUNIT_4_7StudentState,
  isTeacherSyncState: isUNIT_4_7TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit47',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_4_7TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_4_7TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_4_7TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_4_7TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_4_7_LESSON_STEPS,
  });
}
