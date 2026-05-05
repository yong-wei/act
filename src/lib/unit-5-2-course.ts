import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_5_2StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_5_2TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'enabled';
export type UNIT_5_2PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'activity_card_set'
  | 'single_choice'
  | 'parameter_slider'
  | 'teacher_reveal_only';

export interface UNIT_5_2PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_5_2PageContract {
  layout: {
    template: string;
    regions: UNIT_5_2PageRegionContract[];
  };
  interactionKind: 'none' | 'quiz_group' | 'activity_card_set' | 'single_choice' | 'parameter_slider' | 'teacher_reveal_only';
  teacherControls: {
    releaseActivity: UNIT_5_2TeacherControlMode;
    openBrowse: UNIT_5_2TeacherControlMode;
    teacherStepReveal: UNIT_5_2TeacherControlMode;
    revealReferenceAnswer: UNIT_5_2TeacherControlMode;
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

export interface UNIT_5_2StepDefinition {
  id: string;
  stage: UNIT_5_2StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_5_2PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_5_2StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_5_2StudentCourseState {
  kind: 'unit52_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_5_2StepResponse>;
  viewedStepIds: string[];
  nonlinearParameterSnapshots: Record<string, Record<string, string>>;
}

export interface UNIT_5_2TeacherCourseSyncState {
  kind: 'teacher_sync_unit52';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_5_2TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_5_2_ROUTE_SEGMENT = 'unit-5-2-nonlinear-analysis-entry';
export const UNIT_5_2_PRESET_KEY = 'unit-5-2-nonlinear-analysis-entry-v1';
export const UNIT_5_2_RESOURCE_KEY = UNIT_5_2_ROUTE_SEGMENT;
export const UNIT_5_2_LESSON_KEY = UNIT_5_2_PRESET_KEY;
export const UNIT_5_2_STUDENT_ITEM_ID = 'student:unit52:state';
export const UNIT_5_2_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_5_2_STUDENT_STATE_KEY = 'course';
export const UNIT_5_2_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_5_2_COURSE_TITLE = '5-2：非线性系统的最小分析入口';
export const UNIT_5_2_COURSE_SUBTITLE = 'Nonlinear Analysis Entry';
export const UNIT_5_2_COURSE_DESCRIPTION =
  '围绕局部线性化、相平面、描述函数、负倒曲线、微小扰动法和舵机执行器自振风险，建立非线性系统分析的最小入口。';

export const UNIT_5_2_STAGE_LABEL: Record<UNIT_5_2StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: '前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_5_2_STAGE_MAP: Record<UNIT_5_2StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function pageTypeFromInteraction(stepId: string, interactionKind: string): UNIT_5_2PageType {
  if (interactionKind === 'none') return stepId === 'step-18' ? 'summary' : 'display';
  if (
    interactionKind === 'quiz_group' ||
    interactionKind === 'activity_card_set' ||
    interactionKind === 'single_choice' ||
    interactionKind === 'parameter_slider' ||
    interactionKind === 'teacher_reveal_only'
  ) {
    return interactionKind;
  }
  return 'display';
}

const STEP_SOURCE = [
  ['step-01', 'B', '非线性边界现象与三种观察工具', '建立非线性边界下三种观察工具的分工。', 'none'],
  ['step-02', 'O', '本次课程目标', '只呈现本次课程能力目标。', 'none'],
  ['step-03', 'P1', '前置基础快测', '检查状态变量、正弦信号和低通滤波三个基础概念。', 'quiz_group'],
  ['step-04', 'P2', '工作点附近的局部线性化', '固定工作点、小扰动和局部模型边界。', 'activity_card_set'],
  ['step-05', 'P2', '动态系统线性化与局部结论', '把动态线性化与局部结论边界绑定。', 'single_choice'],
  ['step-06', 'P2', '相平面中的状态轨迹与周期行为', '用三类二阶模型说明相平面轨迹由状态方程和初始点决定。', 'parameter_slider'],
  ['step-07', 'P2', '描述函数的基波近似', '让学生直接观察继电输出谐波、低通滤波与基波近似的关系。', 'single_choice'],
  ['step-08', 'P2', '饱和、死区与死区饱和的描述函数', '将无记忆非线性输入输出形态、参数和描述函数公式绑定。', 'activity_card_set'],
  ['step-09', 'P2', '继电、滞环继电与间隙的描述函数', '将继电类和路径相关非线性的形态、参数范围和相位来源绑定。', 'activity_card_set'],
  ['step-10', 'P2', '负倒描述函数与候选自振条件', '固定负倒描述函数交点只是候选自振条件。', 'single_choice'],
  ['step-11', 'P2', '微小扰动法判断稳定自振点', '通过交点拖动直接区分稳定与非稳定自振点。', 'activity_card_set'],
  ['step-12', 'P2', '常见负倒曲线与参数影响', '强制使用数值计算的 Rust 负倒曲线族面板理解参数影响。', 'activity_card_set'],
  ['step-13', 'P2', '理想继电闭环的自振计算', '完整显影继电闭环自振频率和振幅计算。', 'teacher_reveal_only'],
  ['step-14', 'P2', '饱和环节中线性增益改变自振条件', '通过 K=4 与 K=9 对比说明自振由线性部分和非线性部分共同决定。', 'teacher_reveal_only'],
  ['step-15', 'P2', '舵机执行器结构中的死区与饱和', '把舵机执行器结构和死区饱和来源绑定。', 'single_choice'],
  ['step-16', 'P2', '舵机自振风险与整改方向', '把舵机自振风险放回具体运行场景、仿真和整改方向中。', 'activity_card_set'],
  ['step-17', 'P3', '后测：非线性边界判断链', '用三题检查本课核心判断链是否形成。', 'quiz_group'],
  ['step-18', 'S', '总结：三种入口与工程验证边界', '用信息图和三种入口边界完成收束。', 'none'],
] as const;

export const UNIT_5_2_LESSON_STEPS: readonly UNIT_5_2StepDefinition[] = STEP_SOURCE.map(
  ([id, stage, title, hint, interactionKind]) => ({
    id,
    stage,
    title,
    hint,
    duration: '5 min',
    pageType: pageTypeFromInteraction(id, interactionKind),
  }),
) as readonly UNIT_5_2StepDefinition[];

export const UNIT_5_2_AI_PAGE_GOALS: Record<string, string> = Object.fromEntries(
  STEP_SOURCE.map(([id, , , hint]) => [id, hint]),
) as Record<string, string>;

function normalizeUNIT_5_2InteractionKind(kind: string): UNIT_5_2PageContract['interactionKind'] {
  if (
    kind === 'quiz_group' ||
    kind === 'activity_card_set' ||
    kind === 'single_choice' ||
    kind === 'parameter_slider' ||
    kind === 'teacher_reveal_only'
  ) {
    return kind;
  }
  return 'none';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_5_2PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_5_2InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_5_2TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_5_2TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_5_2TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_5_2TeacherControlMode,
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

export function getUNIT_5_2ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('5-2 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_5_2PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_5_2ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_5_2Step(stepId: string) {
  return UNIT_5_2_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_5_2_LESSON_STEPS[0];
}

export function isUNIT_5_2InteractivePageType(pageType: UNIT_5_2PageType) {
  return pageType !== 'display' && pageType !== 'summary' && pageType !== 'teacher_reveal_only';
}

export function createEmptyUNIT_5_2StudentState(studentName: string): UNIT_5_2StudentCourseState {
  return {
    kind: 'unit52_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
    viewedStepIds: [],
    nonlinearParameterSnapshots: {},
  };
}

export const UNIT_5_2_PREMIUM_LESSON_CARD = {
  id: UNIT_5_2_RESOURCE_KEY,
  title: UNIT_5_2_COURSE_TITLE,
  description: '精品互动课：用局部线性化、相平面、描述函数、负倒曲线和微小扰动法进入非线性分析。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_5_2_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_5_2StudentState(value: unknown): value is UNIT_5_2StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_2StudentCourseState>;
  return data.kind === 'unit52_student_state' && data.version === 1;
}

export function isUNIT_5_2TeacherSyncState(value: unknown): value is UNIT_5_2TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_2TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit52' && typeof data.activeStepId === 'string';
}

export const UNIT_5_2_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_5_2StudentCourseState,
  UNIT_5_2TeacherCourseSyncState,
  UNIT_5_2TeacherSyncInput
> = {
  lessonKey: UNIT_5_2_LESSON_KEY,
  studentItemId: UNIT_5_2_STUDENT_ITEM_ID,
  teacherItemId: UNIT_5_2_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_5_2_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_5_2_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_5_2StudentState,
  isStudentState: isUNIT_5_2StudentState,
  isTeacherSyncState: isUNIT_5_2TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit52',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_5_2TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_5_2TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_5_2TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_5_2TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await input.finishSession();
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_5_2_LESSON_STEPS,
  }));
}
