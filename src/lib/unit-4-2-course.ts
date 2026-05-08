import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type {
  InteractiveInteractionKind,
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_4_2StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_4_2TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct';

export type UNIT_4_2PageType =
  | 'display'
  | 'step_reveal'
  | 'drag_match'
  | 'quiz_group'
  | 'activity_card_set'
  | 'interactive_figure_submit'
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
  interactionKind: InteractiveInteractionKind;
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

function pageTypeFromInteraction(interactionKind: string): UNIT_4_2PageType {
  if (interactionKind === 'none') return 'display';
  if (
    interactionKind === 'quiz_group' ||
    interactionKind === 'activity_card_set' ||
    interactionKind === 'multi_select_matrix' ||
    interactionKind === 'drag_match' ||
    interactionKind === 'step_reveal' ||
    interactionKind === 'worked_example_reveal' ||
    interactionKind === 'interactive_figure_submit' ||
    interactionKind === 'task_card_workspace' ||
    interactionKind === 'quiz_card_grid'
  ) {
    return interactionKind;
  }
  return 'display';
}

const STEP_SOURCE = [
  { id: 'step-01', stage: 'B', title: '控制器选型与整定任务的导入场景', hint: '用场景问题引出结构选型和单结构整定。', duration: '4 min', interactionKind: 'none' },
  { id: 'step-02', stage: 'O', title: '本次课程目标', hint: '呈现结构候选、参数初算和复核证据目标。', duration: '4 min', interactionKind: 'none' },
  { id: 'step-03', stage: 'P1', title: '前置基础快测', hint: '检查频域读图和反馈前馈边界基础。', duration: '4 min', interactionKind: 'quiz_group' },
  { id: 'step-04', stage: 'P2', title: '单结构整定的四类复核量', hint: '建立单结构整定的四类复核量。', duration: '4 min', interactionKind: 'activity_card_set' },
  { id: 'step-05', stage: 'P2', title: '典型控制结构的频域特性矩阵', hint: '按频域作用点组织控制结构工具箱。', duration: '4 min', interactionKind: 'multi_select_matrix' },
  { id: 'step-06', stage: 'P2', title: '控制器结构选型决策树', hint: '把任务证据映射到结构候选和复核量。', duration: '4 min', interactionKind: 'drag_match' },
  { id: 'step-07', stage: 'P2', title: '经验整定与临界比例整定步骤', hint: '说明临界比例法中 Ku 和 Pu 的来源。', duration: '4 min', interactionKind: 'step_reveal' },
  { id: 'step-08', stage: 'P2', title: '频域 PI 与滞后整定步骤', hint: '为例题 5.1 和 5.3 建立参数来源。', duration: '4 min', interactionKind: 'step_reveal' },
  { id: 'step-09', stage: 'P2', title: '频域 PD、超前与超前-滞后整定步骤', hint: '为例题 5.2 建立超前参数来源。', duration: '4 min', interactionKind: 'step_reveal' },
  { id: 'step-10', stage: 'P2', title: '模型匹配、IMC/SIMC 与前馈整定步骤', hint: '说明模型匹配、IMC/SIMC 和前馈的适用前提。', duration: '4 min', interactionKind: 'activity_card_set' },
  { id: 'step-11', stage: 'P2', title: '例题 5.1 频域 PI 参数计算', hint: '用例题 5.1 复核 PI 参数链。', duration: '4 min', interactionKind: 'interactive_figure_submit' },
  { id: 'step-12', stage: 'P2', title: '例题 5.2 频域超前参数计算', hint: '用例题 5.2 复核超前参数链。', duration: '4 min', interactionKind: 'interactive_figure_submit' },
  { id: 'step-13', stage: 'P2', title: '例题 5.3 滞后校正参数计算', hint: '用例题 5.3 复核滞后参数链。', duration: '4 min', interactionKind: 'interactive_figure_submit' },
  { id: 'step-14', stage: 'P2', title: '例题 5.4 Ziegler-Nichols PID 参数计算', hint: '用例题 5.4 复核 ZN PID 参数链。', duration: '4 min', interactionKind: 'interactive_figure_submit' },
  { id: 'step-15', stage: 'P2', title: '扰动前馈例题的补偿计算', hint: '用例题 5.5 说明扰动前馈对消和工程折减。', duration: '4 min', interactionKind: 'worked_example_reveal' },
  { id: 'step-16', stage: 'P2', title: '客船航向控制对象与候选参数初算', hint: '固定客船对象、基准证据和候选参数来源。', duration: '4 min', interactionKind: 'activity_card_set' },
  { id: 'step-17', stage: 'P2', title: '客船候选结构的 Bode 与时域复核', hint: '用客船候选结构复核单结构首轮判断。', duration: '4 min', interactionKind: 'interactive_figure_submit' },
  { id: 'step-18', stage: 'P2', title: '分层练习与单结构起步卡工作区', hint: '把例题和客船案例迁移为单结构首轮起步卡。', duration: '4 min', interactionKind: 'task_card_workspace' },
  { id: 'step-19', stage: 'P3', title: '后测：结构选型与整定复核判断', hint: '检查结构作用点、整定步骤和多指标复核。', duration: '4 min', interactionKind: 'quiz_group' },
  { id: 'step-20', stage: 'S', title: '总结：频域证据到首轮候选结构', hint: '收束频域证据到首轮候选结构的判断链。', duration: '4 min', interactionKind: 'none' },
] as const;

export const UNIT_4_2_LESSON_STEPS: UNIT_4_2StepDefinition[] = STEP_SOURCE.map((step) => ({
  id: step.id,
  stage: step.stage as UNIT_4_2StageCode,
  title: step.title,
  hint: step.hint,
  duration: step.duration,
  pageType: pageTypeFromInteraction(step.interactionKind),
}));

export const UNIT_4_2_INTERACTIVE_PAGE_TYPES = new Set<UNIT_4_2PageType>(
  UNIT_4_2_LESSON_STEPS
    .map((step) => step.pageType)
    .filter((pageType): pageType is Exclude<UNIT_4_2PageType, 'display'> => pageType !== 'display'),
);

export function getUNIT_4_2Step(stepId: string) {
  return UNIT_4_2_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_4_2_LESSON_STEPS[0];
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_4_2PageContract {
  return {
    layout: step.layout,
    interactionKind: step.interactionSpec.interactionKind,
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_4_2TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_4_2TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_4_2TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_4_2TeacherControlMode,
    },
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    figureLayoutMirror: step.interactiveFigureSpec.layoutMirror,
    controlsPlacement: step.interactiveFigureSpec.controlsPlacement,
    controlsCollapsedByDefault: step.interactiveFigureSpec.controlsCollapsedByDefault,
    aiPageGoal: step.aiContextSpec.pageGoal,
    previewDemoPath: step.previewContract.demoPath,
  };
}

export function getUNIT_4_2ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('4-2 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_4_2PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_4_2ManifestStepFromManifest(manifest, stepId));
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
  'step-20': '/course-runtime/lessons/4-2/media/4-2-info.png',
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
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_4_2_LESSON_STEPS,
  }));
}
