import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type {
  InteractiveInteractionKind,
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_5_4StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_5_4TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct'
  | 'enabled';
export type UNIT_5_4PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'activity_card_set'
  | 'single_choice'
  | 'drag_match'
  | 'multi_select'
  | 'interactive_figure_submit'
  | 'step_reveal';

export interface UNIT_5_4PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_5_4PageContract {
  layout: {
    template: string;
    regions: UNIT_5_4PageRegionContract[];
  };
  interactionKind: InteractiveInteractionKind;
  teacherControls: {
    releaseActivity: UNIT_5_4TeacherControlMode;
    openBrowse: UNIT_5_4TeacherControlMode;
    teacherStepReveal: UNIT_5_4TeacherControlMode;
    revealReferenceAnswer: UNIT_5_4TeacherControlMode;
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

export interface UNIT_5_4StepDefinition {
  id: string;
  stage: UNIT_5_4StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_5_4PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_5_4StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_5_4StudentCourseState {
  kind: 'unit54_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_5_4StepResponse>;
  viewedStepIds: string[];
  figureParameterSnapshots: Record<string, Record<string, string>>;
}

export interface UNIT_5_4TeacherCourseSyncState {
  kind: 'teacher_sync_unit54';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_5_4TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_5_4_ROUTE_SEGMENT = 'unit-5-4-data-driven-mpc-transition';
export const UNIT_5_4_PRESET_KEY = 'unit-5-4-data-driven-mpc-transition-v1';
export const UNIT_5_4_RESOURCE_KEY = UNIT_5_4_ROUTE_SEGMENT;
export const UNIT_5_4_LESSON_KEY = UNIT_5_4_PRESET_KEY;
export const UNIT_5_4_STUDENT_ITEM_ID = 'student:unit54:state';
export const UNIT_5_4_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_5_4_STUDENT_STATE_KEY = 'course';
export const UNIT_5_4_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_5_4_COURSE_TITLE = '5-4：从模型驱动到数据驱动';
export const UNIT_5_4_COURSE_SUBTITLE = 'Data Driven MPC Transition';
export const UNIT_5_4_COURSE_DESCRIPTION =
  '围绕模型预测偏差、MPC 约束优化、在线辨识与三路线比较，训练模型、数据、优化和安全保护的证据责任分配。';

export const UNIT_5_4_STAGE_LABEL: Record<UNIT_5_4StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: '前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_5_4_STAGE_MAP: Record<UNIT_5_4StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function pageTypeFromInteraction(stepId: string, interactionKind: string): UNIT_5_4PageType {
  if (interactionKind === 'none') return stepId === 'step-17' ? 'summary' : 'display';
  if (
    interactionKind === 'quiz_group' ||
    interactionKind === 'activity_card_set' ||
    interactionKind === 'single_choice' ||
    interactionKind === 'drag_match' ||
    interactionKind === 'multi_select' ||
    interactionKind === 'interactive_figure_submit' ||
    interactionKind === 'step_reveal'
  ) {
    return interactionKind as UNIT_5_4PageType;
  }
  return 'display';
}

const STEP_SOURCE = [
  ['step-01', 'B', '模型预测偏离真实对象的导入场景', '从模型预测偏离真实对象的场景进入方法迁移判断。', 'none'],
  ['step-02', 'O', '本次课程目标', '呈现 5-4 的四项能力目标。', 'none'],
  ['step-03', 'P1', '前置基础快测', '只检查对象参数、闭环误差和执行限幅基础。', 'quiz_group'],
  ['step-04', 'P2', '模型驱动控制的可解释关系', '建立模型驱动控制的可解释关系。', 'activity_card_set'],
  ['step-05', 'P2', '单一模型在复杂链路中的压力', '把复杂链路现象归类为模型压力来源。', 'drag_match'],
  ['step-06', 'P2', '名义航向模型预测偏差读图', '用三曲线读图区分预测改善和闭环安全证据。', 'interactive_figure_submit'],
  ['step-07', 'P2', 'MPC 的滚动预测与约束优化结构', '解释 MPC 的模型预测、优化和约束结构。', 'activity_card_set'],
  ['step-08', 'P2', 'MPC 对模型质量和在线计算的依赖', '区分 MPC 的收益和模型/计算依赖。', 'single_choice'],
  ['step-09', 'P2', '数据驱动控制的信息来源变化', '比较模型驱动与数据驱动的信息来源和责任差异。', 'activity_card_set'],
  ['step-10', 'P2', '在线辨识与数据驱动 MPC 局部责任', '说明在线辨识在数据驱动 MPC 中只承担局部预测模型更新责任。', 'step_reveal'],
  ['step-11', 'P2', '数据驱动进入闭环的四项条件', '检查数据、算力、验证和泛化四项闭环进入条件。', 'multi_select'],
  ['step-12', 'P2', '复杂航行任务中的数据驱动进入点', '把数据驱动进入点限定为局部责任分配。', 'activity_card_set'],
  ['step-13', 'P2', '长时漂移任务中的三路线设定', '让学生在同一任务条件下比较三条控制路线。', 'drag_match'],
  ['step-14', 'P2', '三路线仿真结果与指标比较', '让学生同时报告三路线比较中的收益和代价。', 'interactive_figure_submit'],
  ['step-15', 'P2', '模型数据责任分配与边界情况', '把数据驱动放回模型、优化和安全保护的证据责任链中。', 'activity_card_set'],
  ['step-16', 'P3', '后测：迁移条件与责任判断', '检查迁移条件和责任分配判断是否形成。', 'quiz_group'],
  ['step-17', 'S', '总结：数据驱动方法的收益与代价', '收束模型、数据、优化和安全保护的责任分配。', 'none'],
] as const;

export const UNIT_5_4_LESSON_STEPS: readonly UNIT_5_4StepDefinition[] = STEP_SOURCE.map(
  ([id, stage, title, hint, interactionKind]) => ({
    id,
    stage,
    title,
    hint,
    duration: '6 min',
    pageType: pageTypeFromInteraction(id, interactionKind),
  }),
) as readonly UNIT_5_4StepDefinition[];

export const UNIT_5_4_AI_PAGE_GOALS: Record<string, string> = Object.fromEntries(
  STEP_SOURCE.map(([id, , , hint]) => [id, hint]),
) as Record<string, string>;

function normalizeUNIT_5_4InteractionKind(kind: string): InteractiveInteractionKind {
  if (
    kind === 'quiz_group' ||
    kind === 'activity_card_set' ||
    kind === 'single_choice' ||
    kind === 'drag_match' ||
    kind === 'multi_select' ||
    kind === 'interactive_figure_submit' ||
    kind === 'step_reveal'
  ) {
    return kind;
  }
  return 'none';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_5_4PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_5_4InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_5_4TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_5_4TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_5_4TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_5_4TeacherControlMode,
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

export function getUNIT_5_4ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('5-4 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_5_4PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_5_4ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_5_4Step(stepId: string) {
  return UNIT_5_4_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_5_4_LESSON_STEPS[0];
}

export function isUNIT_5_4InteractivePageType(pageType: UNIT_5_4PageType) {
  return pageType !== 'display' && pageType !== 'summary';
}

export function createEmptyUNIT_5_4StudentState(studentName: string): UNIT_5_4StudentCourseState {
  return {
    kind: 'unit54_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
    viewedStepIds: [],
    figureParameterSnapshots: {},
  };
}

export const UNIT_5_4_PREMIUM_LESSON_CARD = {
  id: UNIT_5_4_RESOURCE_KEY,
  title: UNIT_5_4_COURSE_TITLE,
  description: '精品互动课：从模型预测偏差进入数据驱动 MPC 的收益、条件、代价和责任分配判断。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_5_4_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_5_4StudentState(value: unknown): value is UNIT_5_4StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_4StudentCourseState>;
  return data.kind === 'unit54_student_state' && data.version === 1;
}

export function isUNIT_5_4TeacherSyncState(value: unknown): value is UNIT_5_4TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_4TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit54' && typeof data.activeStepId === 'string';
}

export const UNIT_5_4_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_5_4StudentCourseState,
  UNIT_5_4TeacherCourseSyncState,
  UNIT_5_4TeacherSyncInput
> = {
  lessonKey: UNIT_5_4_LESSON_KEY,
  studentItemId: UNIT_5_4_STUDENT_ITEM_ID,
  teacherItemId: UNIT_5_4_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_5_4_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_5_4_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_5_4StudentState,
  isStudentState: isUNIT_5_4StudentState,
  isTeacherSyncState: isUNIT_5_4TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit54',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_5_4TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_5_4TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_5_4TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_5_4TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_5_4_LESSON_STEPS,
  });
}
