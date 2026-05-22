import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import {
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_5_1StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_5_1TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only';
export type UNIT_5_1PageType = 'display' | 'summary' | 'quiz_group' | 'activity_card_set' | 'curve_compare_panel';

export interface UNIT_5_1PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_5_1PageContract {
  layout: {
    template: string;
    regions: UNIT_5_1PageRegionContract[];
  };
  interactionKind: 'none' | 'quiz_group' | 'activity_card_set' | 'curve_compare_panel';
  teacherControls: {
    releaseActivity: UNIT_5_1TeacherControlMode;
    openBrowse: UNIT_5_1TeacherControlMode;
    teacherStepReveal: UNIT_5_1TeacherControlMode;
    revealReferenceAnswer: UNIT_5_1TeacherControlMode;
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

export interface UNIT_5_1StepDefinition {
  id: string;
  stage: UNIT_5_1StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_5_1PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_5_1StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_5_1StudentCourseState {
  kind: 'unit51_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_5_1StepResponse>;
  viewedStepIds: string[];
  boundaryParameterSnapshots: Record<string, Record<string, string>>;
}

export interface UNIT_5_1TeacherCourseSyncState {
  kind: 'teacher_sync_unit51';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_5_1TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_5_1_ROUTE_SEGMENT = 'unit-5-1-linear-backbone-boundaries';
export const UNIT_5_1_PRESET_KEY = 'unit-5-1-linear-backbone-boundaries-v1';
export const UNIT_5_1_RESOURCE_KEY = UNIT_5_1_ROUTE_SEGMENT;
export const UNIT_5_1_LESSON_KEY = UNIT_5_1_PRESET_KEY;
export const UNIT_5_1_STUDENT_ITEM_ID = 'student:unit51:state';
export const UNIT_5_1_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_5_1_STUDENT_STATE_KEY = 'course';
export const UNIT_5_1_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_5_1_COURSE_TITLE = '5-1：线性主干的边界：饱和、死区、滞回、切换与模型失配';
export const UNIT_5_1_COURSE_SUBTITLE = 'Linear Backbone Boundaries';
export const UNIT_5_1_COURSE_DESCRIPTION =
  '围绕线性主干的默认条件、典型非线性环节、局部线性化边界和预测失真证据，建立进入非线性方法前的边界识别能力。';

export const UNIT_5_1_STAGE_LABEL: Record<UNIT_5_1StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: '前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_5_1_STAGE_MAP: Record<UNIT_5_1StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_5_1_LESSON_STEPS: readonly UNIT_5_1StepDefinition[] = [
  { id: 'step-01', stage: 'B', title: '舵机大角度响应中的线性边界显现', hint: '从舵机大角度响应读出线性预测和真实边界的分离。', duration: '4 min', pageType: 'display' },
  { id: 'step-02', stage: 'O', title: '本次课程目标', hint: '明确识别线性主干边界、解释失真证据并说明方法迁移理由。', duration: '4 min', pageType: 'display' },
  { id: 'step-03', stage: 'P1', title: '前测：线性模型的预备判断', hint: '检查比例叠加、工作点、小扰动和边界触碰的预备判断。', duration: '6 min', pageType: 'quiz_group' },
  { id: 'step-04', stage: 'P2', title: '线性主干依赖的五个默认条件', hint: '把线性模型的有效性落到五个可核对默认条件。', duration: '6 min', pageType: 'activity_card_set' },
  { id: 'step-05', stage: 'P2', title: '典型非线性环节的假设破坏类型', hint: '区分饱和、死区、滞回、切换、速率限制和模型失配破坏的假设。', duration: '6 min', pageType: 'activity_card_set' },
  { id: 'step-06', stage: 'P2', title: '合理局部线性化：平滑非线性的小扰动模型', hint: '用平滑非线性例子说明合理局部线性化。', duration: '7 min', pageType: 'curve_compare_panel' },
  { id: 'step-07', stage: 'P2', title: '继电器切换的伪线性化失真', hint: '用继电器例子说明不连续环节不能强行普通线性化。', duration: '7 min', pageType: 'curve_compare_panel' },
  { id: 'step-08', stage: 'P2', title: '饱和执行器：大指令下前段响应变慢', hint: '比较忽略饱和的预测与触边后的真实响应。', duration: '7 min', pageType: 'curve_compare_panel' },
  { id: 'step-09', stage: 'P2', title: '死区执行机构：小误差附近连续修正失效', hint: '识别死区吞掉小信号修正时的线性预测失真。', duration: '7 min', pageType: 'curve_compare_panel' },
  { id: 'step-10', stage: 'P2', title: '滞环继电器：阈值附近的切换和周期摆动', hint: '识别滞环记忆导致的切换和周期摆动。', duration: '7 min', pageType: 'curve_compare_panel' },
  { id: 'step-11', stage: 'P2', title: '速率限制舵机：快速指令下动作被拖慢', hint: '比较理想执行器和速率受限执行器的初段差异。', duration: '7 min', pageType: 'curve_compare_panel' },
  { id: 'step-12', stage: 'P2', title: '边界识别五步与方法迁移前说明', hint: '把证据、假设破坏、线性内处理和迁移理由写成边界说明。', duration: '8 min', pageType: 'activity_card_set' },
  { id: 'step-13', stage: 'P3', title: '后测：边界类型、线性化与风险说明', hint: '独立判断边界类型、局部线性化条件和风险说明。', duration: '8 min', pageType: 'quiz_group' },
  { id: 'step-14', stage: 'S', title: '总结：局部有效、全局失真与方法去向', hint: '收束局部有效、全局失真和方法迁移的判断链。', duration: '6 min', pageType: 'summary' },
] as const;

export const UNIT_5_1_AI_PAGE_GOALS: Record<string, string> = {
  'step-01': '从舵机大角度响应场景进入线性主干边界识别。',
  'step-02': '呈现 5-1 的五项目标。',
  'step-03': '检查线性模型使用前的预备判断。',
  'step-04': '把线性主干的默认条件转化为可检查假设。',
  'step-05': '识别典型非线性边界环节及其假设破坏类型。',
  'step-06': '用平滑非线性例子说明合理局部线性化。',
  'step-07': '用继电器例子说明伪线性化的失真。',
  'step-08': '比较饱和执行器下线性预测与实际响应差异。',
  'step-09': '比较死区执行机构下小信号线性预测与实际响应差异。',
  'step-10': '比较滞环继电器下平滑预测与实际切换响应。',
  'step-11': '比较速率限制舵机下线性预测与实际初段响应。',
  'step-12': '把边界识别五步转化为可提交说明。',
  'step-13': '用三道题检查 5-1 目标达成。',
  'step-14': '总结线性主干边界识别并展示个人或班级表现统计。',
};

function normalizeUNIT_5_1InteractionKind(kind: string): UNIT_5_1PageContract['interactionKind'] {
  if (kind === 'quiz_group' || kind === 'activity_card_set' || kind === 'curve_compare_panel') {
    return kind;
  }
  return 'none';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_5_1PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_5_1InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_5_1TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_5_1TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_5_1TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_5_1TeacherControlMode,
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

export function getUNIT_5_1ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('5-1 runtime manifest is required for page rendering.');
  }
  const activeManifest = manifest;
  return activeManifest.steps.find((step) => step.id === stepId) ?? activeManifest.steps[0];
}

export function getUNIT_5_1PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_5_1ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_5_1Step(stepId: string) {
  return UNIT_5_1_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_5_1_LESSON_STEPS[0];
}

export function isUNIT_5_1InteractivePageType(pageType: UNIT_5_1PageType) {
  return pageType === 'activity_card_set' || pageType === 'curve_compare_panel' || pageType === 'quiz_group';
}

export function createEmptyUNIT_5_1StudentState(studentName: string): UNIT_5_1StudentCourseState {
  return {
    kind: 'unit51_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
    viewedStepIds: [],
    boundaryParameterSnapshots: {},
  };
}

export const UNIT_5_1_PREMIUM_LESSON_CARD = {
  id: UNIT_5_1_RESOURCE_KEY,
  title: UNIT_5_1_COURSE_TITLE,
  description: '精品互动课：识别线性主干在饱和、死区、滞回、切换、速率限制和模型失配中的边界。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_5_1_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_5_1StudentState(value: unknown): value is UNIT_5_1StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_1StudentCourseState>;
  return data.kind === 'unit51_student_state' && data.version === 1;
}

export function isUNIT_5_1TeacherSyncState(value: unknown): value is UNIT_5_1TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_1TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit51' && typeof data.activeStepId === 'string';
}

export const UNIT_5_1_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_5_1StudentCourseState,
  UNIT_5_1TeacherCourseSyncState,
  UNIT_5_1TeacherSyncInput
> = {
  lessonKey: UNIT_5_1_LESSON_KEY,
  studentItemId: UNIT_5_1_STUDENT_ITEM_ID,
  teacherItemId: UNIT_5_1_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_5_1_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_5_1_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_5_1StudentState,
  isStudentState: isUNIT_5_1StudentState,
  isTeacherSyncState: isUNIT_5_1TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit51',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_5_1TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_5_1TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_5_1TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_5_1TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_5_1_LESSON_STEPS,
  });
}
