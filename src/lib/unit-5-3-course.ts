import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type {
  InteractiveInteractionKind,
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_5_3StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_5_3TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct'
  | 'enabled';
export type UNIT_5_3PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'activity_card_set'
  | 'single_choice'
  | 'drag_match';

export interface UNIT_5_3PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_5_3PageContract {
  layout: {
    template: string;
    regions: UNIT_5_3PageRegionContract[];
  };
  interactionKind: InteractiveInteractionKind;
  teacherControls: {
    releaseActivity: UNIT_5_3TeacherControlMode;
    openBrowse: UNIT_5_3TeacherControlMode;
    teacherStepReveal: UNIT_5_3TeacherControlMode;
    revealReferenceAnswer: UNIT_5_3TeacherControlMode;
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

export interface UNIT_5_3StepDefinition {
  id: string;
  stage: UNIT_5_3StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_5_3PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_5_3StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_5_3StudentCourseState {
  kind: 'unit53_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_5_3StepResponse>;
  viewedStepIds: string[];
  turningParameterSnapshots: Record<string, Record<string, string>>;
}

export interface UNIT_5_3TeacherCourseSyncState {
  kind: 'teacher_sync_unit53';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_5_3TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_5_3_ROUTE_SEGMENT = 'unit-5-3-mass-coordination-chain';
export const UNIT_5_3_PRESET_KEY = 'unit-5-3-mass-coordination-chain-v1';
export const UNIT_5_3_RESOURCE_KEY = UNIT_5_3_ROUTE_SEGMENT;
export const UNIT_5_3_LESSON_KEY = UNIT_5_3_PRESET_KEY;
export const UNIT_5_3_STUDENT_ITEM_ID = 'student:unit53:state';
export const UNIT_5_3_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_5_3_STUDENT_STATE_KEY = 'course';
export const UNIT_5_3_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_5_3_COURSE_TITLE = '5-3：从单回路控制到复杂自主系统链路';
export const UNIT_5_3_COURSE_SUBTITLE = 'MASS Coordination Chain';
export const UNIT_5_3_COURSE_DESCRIPTION =
  '围绕 MASS 的感知、估计、规划、控制、执行和监督链路，训练从单回路控制证据推进到复杂自主系统责任诊断。';

export const UNIT_5_3_STAGE_LABEL: Record<UNIT_5_3StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: '前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_5_3_STAGE_MAP: Record<UNIT_5_3StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function pageTypeFromInteraction(stepId: string, interactionKind: string): UNIT_5_3PageType {
  if (interactionKind === 'none') return stepId === 'step-15' ? 'summary' : 'display';
  if (
    interactionKind === 'quiz_group' ||
    interactionKind === 'activity_card_set' ||
    interactionKind === 'single_choice' ||
    interactionKind === 'drag_match'
  ) {
    return interactionKind;
  }
  return 'display';
}

const STEP_SOURCE = [
  ['step-01', 'B', '复杂自主系统链路中的控制位置', '建立复杂自主系统中的控制位置与责任链问题。', 'none'],
  ['step-02', 'O', '本次课程目标', '只呈现本次课程能力目标。', 'none'],
  ['step-03', 'P1', '前置基础快测', '只诊断闭环误差、反馈质量和执行约束基础。', 'quiz_group'],
  ['step-04', 'P2', 'MASS 协同链路与责任流', '建立感知到监督的基本信息流。', 'drag_match'],
  ['step-05', 'P2', '单回路控制在自主系统链路中的位置', '固定控制层在自主系统链路中的输入、输出和责任边界。', 'activity_card_set'],
  ['step-06', 'P2', '上游信息质量与反馈可信度', '用表格和两张固定日志图判断反馈状态是否可信。', 'activity_card_set'],
  ['step-07', 'P2', '规划参考可实现性', '把几何路径、航向参考、控制输出和实际舵角连成证据链。', 'single_choice'],
  ['step-08', 'P2', '执行约束与可实现反馈', '说明执行约束会改变真实运动并反馈给规划与控制。', 'activity_card_set'],
  ['step-09', 'P2', '链路责任诊断顺序', '建立从信息到监督的链路诊断顺序。', 'activity_card_set'],
  ['step-10', 'P2', '自主避碰中的偏差传播场景', '把避碰偏差分解为信息、参考、控制和执行证据。', 'activity_card_set'],
  ['step-11', 'P2', '避碰转弯半径与舵角可行域分析', '通过单情形 Rust 面板判断规划半径、舵角上限和安全约束之间的联动。', 'activity_card_set'],
  ['step-12', 'P2', 'MASS 自动化等级与责任边界', '区分自动化等级、责任主体和技术链路证据。', 'single_choice'],
  ['step-13', 'P2', '链路阅读的最小方法', '用五问路径阅读新的复杂自主系统日志。', 'drag_match'],
  ['step-14', 'P3', '后测：链路诊断与可行性判断', '检查链路诊断、可实现性判断和责任边界意识。', 'quiz_group'],
  ['step-15', 'S', '总结：MASS 链路责任边界', '收束 MASS 链路责任边界，并展示个人与班级表现统计。', 'none'],
] as const;

export const UNIT_5_3_LESSON_STEPS: readonly UNIT_5_3StepDefinition[] = STEP_SOURCE.map(
  ([id, stage, title, hint, interactionKind]) => ({
    id,
    stage,
    title,
    hint,
    duration: '6 min',
    pageType: pageTypeFromInteraction(id, interactionKind),
  }),
) as readonly UNIT_5_3StepDefinition[];

export const UNIT_5_3_AI_PAGE_GOALS: Record<string, string> = Object.fromEntries(
  STEP_SOURCE.map(([id, , , hint]) => [id, hint]),
) as Record<string, string>;

function normalizeUNIT_5_3InteractionKind(kind: string): InteractiveInteractionKind {
  if (
    kind === 'quiz_group' ||
    kind === 'activity_card_set' ||
    kind === 'single_choice' ||
    kind === 'drag_match'
  ) {
    return kind;
  }
  return 'none';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_5_3PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_5_3InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_5_3TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_5_3TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_5_3TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_5_3TeacherControlMode,
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

export function getUNIT_5_3ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('5-3 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_5_3PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_5_3ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_5_3Step(stepId: string) {
  return UNIT_5_3_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_5_3_LESSON_STEPS[0];
}

export function isUNIT_5_3InteractivePageType(pageType: UNIT_5_3PageType) {
  return pageType !== 'display' && pageType !== 'summary';
}

export function createEmptyUNIT_5_3StudentState(studentName: string): UNIT_5_3StudentCourseState {
  return {
    kind: 'unit53_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
    viewedStepIds: [],
    turningParameterSnapshots: {},
  };
}

export const UNIT_5_3_PREMIUM_LESSON_CARD = {
  id: UNIT_5_3_RESOURCE_KEY,
  title: UNIT_5_3_COURSE_TITLE,
  description: '精品互动课：从单回路控制出发，进入 MASS 链路中的感知、规划、控制、执行和责任诊断。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_5_3_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_5_3StudentState(value: unknown): value is UNIT_5_3StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_3StudentCourseState>;
  return data.kind === 'unit53_student_state' && data.version === 1;
}

export function isUNIT_5_3TeacherSyncState(value: unknown): value is UNIT_5_3TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_3TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit53' && typeof data.activeStepId === 'string';
}

export const UNIT_5_3_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_5_3StudentCourseState,
  UNIT_5_3TeacherCourseSyncState,
  UNIT_5_3TeacherSyncInput
> = {
  lessonKey: UNIT_5_3_LESSON_KEY,
  studentItemId: UNIT_5_3_STUDENT_ITEM_ID,
  teacherItemId: UNIT_5_3_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_5_3_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_5_3_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_5_3StudentState,
  isStudentState: isUNIT_5_3StudentState,
  isTeacherSyncState: isUNIT_5_3TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit53',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_5_3TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_5_3TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_5_3TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_5_3TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await input.finishSession();
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_5_3_LESSON_STEPS,
  }));
}
