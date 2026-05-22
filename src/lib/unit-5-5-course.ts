import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type {
  InteractiveInteractionKind,
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_5_5StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_5_5TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct'
  | 'enabled';
export type UNIT_5_5PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'activity_card_set'
  | 'single_choice'
  | 'drag_match'
  | 'multi_select'
  | 'interactive_figure_submit'
  | 'step_reveal'
  | 'rust_toy_training_panel'
  | 'rust_heading_rl_training_panel';

export interface UNIT_5_5PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_5_5PageContract {
  layout: {
    template: string;
    regions: UNIT_5_5PageRegionContract[];
  };
  interactionKind: InteractiveInteractionKind;
  teacherControls: {
    releaseActivity: UNIT_5_5TeacherControlMode;
    openBrowse: UNIT_5_5TeacherControlMode;
    teacherStepReveal: UNIT_5_5TeacherControlMode;
    revealReferenceAnswer: UNIT_5_5TeacherControlMode;
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

export interface UNIT_5_5StepDefinition {
  id: string;
  stage: UNIT_5_5StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_5_5PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_5_5StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_5_5StudentCourseState {
  kind: 'unit55_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_5_5StepResponse>;
  viewedStepIds: string[];
  figureParameterSnapshots: Record<string, Record<string, string>>;
}

export interface UNIT_5_5TeacherCourseSyncState {
  kind: 'teacher_sync_unit55';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_5_5TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_5_5_ROUTE_SEGMENT = 'unit-5-5-policy-learning-entry-risk';
export const UNIT_5_5_PRESET_KEY = 'unit-5-5-policy-learning-entry-risk-v1';
export const UNIT_5_5_RESOURCE_KEY = UNIT_5_5_ROUTE_SEGMENT;
export const UNIT_5_5_LESSON_KEY = UNIT_5_5_PRESET_KEY;
export const UNIT_5_5_STUDENT_ITEM_ID = 'student:unit55:state';
export const UNIT_5_5_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_5_5_STUDENT_STATE_KEY = 'course';
export const UNIT_5_5_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_5_5_COURSE_TITLE = '5-5：从显式控制器到策略学习';
export const UNIT_5_5_COURSE_SUBTITLE = 'Policy Learning Entry Risk';
export const UNIT_5_5_COURSE_DESCRIPTION =
  '围绕显式控制律、策略学习入口、强化学习闭环和航向控制三路线评价，训练策略学习进入控制系统时的收益、代价与工程责任判断。';

export const UNIT_5_5_STAGE_LABEL: Record<UNIT_5_5StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: '前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_5_5_STAGE_MAP: Record<UNIT_5_5StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function pageTypeFromInteraction(stepId: string, interactionKind: string): UNIT_5_5PageType {
  if (interactionKind === 'none') return stepId === 'step-17' ? 'summary' : 'display';
  if (
    interactionKind === 'quiz_group' ||
    interactionKind === 'activity_card_set' ||
    interactionKind === 'single_choice' ||
    interactionKind === 'drag_match' ||
    interactionKind === 'multi_select' ||
    interactionKind === 'interactive_figure_submit' ||
    interactionKind === 'step_reveal' ||
    interactionKind === 'rust_toy_training_panel' ||
    interactionKind === 'rust_heading_rl_training_panel'
  ) {
    return interactionKind as UNIT_5_5PageType;
  }
  return 'display';
}

const STEP_SOURCE = [
  ['step-01', 'B', '策略学习进入控制问题的导入场景', '从复杂航行情境进入策略学习的入口条件和工程责任判断。', 'none'],
  ['step-02', 'O', '本次课程目标', '呈现显式控制律、策略学习入口、强化学习闭环和航向控制路线评价目标。', 'none'],
  ['step-03', 'P1', '前置基础快测', '前测只考察闭环误差、执行器约束和样本覆盖基础。', 'quiz_group'],
  ['step-04', 'P2', '显式控制律的结构证据', '用显式控制律公式说明动作来源、参数影响和执行边界证据。', 'activity_card_set'],
  ['step-05', 'P2', '复杂自主系统中的动作选择压力', '说明迁移压力来自动作选择空间和目标权衡扩大，而不是显式控制器失效。', 'drag_match'],
  ['step-06', 'P2', '显式控制律与学习策略的证明责任', '比较显式控制律和学习策略的证据来源，强调工程责任没有减少。', 'activity_card_set'],
  ['step-07', 'P2', '强化学习的序贯决策与长期回报', '建立强化学习控制中的状态、动作、回报、策略和长期回报最小闭环。', 'activity_card_set'],
  ['step-08', 'P2', '横向误差修正实时训练', '用小型 Q-learning 训练面板说明学习策略由回报形成，同时限定其证明范围。', 'rust_toy_training_panel'],
  ['step-09', 'P2', '策略学习进入控制任务的五项条件', '用任务、样本、回报、验证和监控五项条件判断策略学习是否具备控制任务入口。', 'multi_select'],
  ['step-10', 'P2', '进入条件与风险矩阵', '把是否进入 RL 表述成证据矩阵判断，而不是方法偏好。', 'drag_match'],
  ['step-11', 'P2', '航向控制中的三类 RL 进入结构', '比较直接控舵、参考航向生成和 PID 参数调度三类 RL 进入结构。', 'single_choice'],
  ['step-12', 'P2', 'Nomoto 航向环境的状态与动作设计', '说明航向 RL 环境包含对象模型、状态、动作和执行器边界。', 'activity_card_set'],
  ['step-13', 'P2', '航向保持奖励与 Q-learning 更新', '逐层说明奖励项如何表达跟踪、平稳、执行器保护和安全边界。', 'step_reveal'],
  ['step-14', 'P2', '训练覆盖、安全外壳与部署验证', '把训练覆盖、安全保护和部署验证作为策略学习进入控制系统的必要证据链。', 'activity_card_set'],
  ['step-15', 'P2', '三类航向 RL 策略训练与评价', '在同一航向边缘场景中训练并比较 RL直接、RL安全外壳和RL调度PID，所有结果都与 PID 基准比较。', 'rust_heading_rl_training_panel'],
  ['step-16', 'P3', '后测：策略学习入口与责任判断', '检查学生是否能迁移策略学习入口、奖励安全项和四路线评价责任。', 'quiz_group'],
  ['step-17', 'S', '总结：策略学习的收益、代价与边界', '总结策略学习的收益、代价与边界，并回收学生个人和班级整体学习证据。', 'none'],
] as const;

export const UNIT_5_5_LESSON_STEPS: readonly UNIT_5_5StepDefinition[] = STEP_SOURCE.map(
  ([id, stage, title, hint, interactionKind]) => ({
    id,
    stage,
    title,
    hint,
    duration: '6 min',
    pageType: pageTypeFromInteraction(id, interactionKind),
  }),
) as readonly UNIT_5_5StepDefinition[];

export const UNIT_5_5_AI_PAGE_GOALS: Record<string, string> = Object.fromEntries(
  STEP_SOURCE.map(([id, , , hint]) => [id, hint]),
) as Record<string, string>;

function normalizeUNIT_5_5InteractionKind(kind: string): InteractiveInteractionKind {
  if (
    kind === 'quiz_group' ||
    kind === 'activity_card_set' ||
    kind === 'single_choice' ||
    kind === 'drag_match' ||
    kind === 'multi_select' ||
    kind === 'interactive_figure_submit' ||
    kind === 'step_reveal' ||
    kind === 'rust_toy_training_panel' ||
    kind === 'rust_heading_rl_training_panel'
  ) {
    return kind;
  }
  return 'none';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_5_5PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_5_5InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_5_5TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_5_5TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_5_5TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_5_5TeacherControlMode,
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

export function getUNIT_5_5ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('5-5 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_5_5PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_5_5ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_5_5Step(stepId: string) {
  return UNIT_5_5_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_5_5_LESSON_STEPS[0];
}

export function isUNIT_5_5InteractivePageType(pageType: UNIT_5_5PageType) {
  return pageType !== 'display' && pageType !== 'summary';
}

export function createEmptyUNIT_5_5StudentState(studentName: string): UNIT_5_5StudentCourseState {
  return {
    kind: 'unit55_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
    viewedStepIds: [],
    figureParameterSnapshots: {},
  };
}

export const UNIT_5_5_PREMIUM_LESSON_CARD = {
  id: UNIT_5_5_RESOURCE_KEY,
  title: UNIT_5_5_COURSE_TITLE,
  description: '精品互动课：从显式控制律进入策略学习，训练 RL 进入条件、航向控制路线评价和安全责任判断。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_5_5_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_5_5StudentState(value: unknown): value is UNIT_5_5StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_5StudentCourseState>;
  return data.kind === 'unit55_student_state' && data.version === 1;
}

export function isUNIT_5_5TeacherSyncState(value: unknown): value is UNIT_5_5TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_5TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit55' && typeof data.activeStepId === 'string';
}

export const UNIT_5_5_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_5_5StudentCourseState,
  UNIT_5_5TeacherCourseSyncState,
  UNIT_5_5TeacherSyncInput
> = {
  lessonKey: UNIT_5_5_LESSON_KEY,
  studentItemId: UNIT_5_5_STUDENT_ITEM_ID,
  teacherItemId: UNIT_5_5_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_5_5_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_5_5_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_5_5StudentState,
  isStudentState: isUNIT_5_5StudentState,
  isTeacherSyncState: isUNIT_5_5TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit55',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_5_5TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_5_5TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_5_5TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_5_5TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_5_5_LESSON_STEPS,
  });
}
