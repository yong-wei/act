import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type {
  InteractiveInteractionKind,
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_1_4StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_1_4TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct';
export type UNIT_1_4PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'activity_cards'
  | 'interactive_figure_submit'
  | 'worked_example_reveal'
  | 'table_builder';

export interface UNIT_1_4PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_1_4PageContract {
  layout: {
    template: string;
    regions: UNIT_1_4PageRegionContract[];
  };
  interactionKind: InteractiveInteractionKind;
  teacherControls: {
    releaseActivity: UNIT_1_4TeacherControlMode;
    openBrowse: UNIT_1_4TeacherControlMode;
    teacherStepReveal: UNIT_1_4TeacherControlMode;
    revealReferenceAnswer: UNIT_1_4TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiPageGoal: string;
  aiDeliveryMode?: string;
  previewDemoPath: string;
}

export interface UNIT_1_4StepDefinition {
  id: string;
  stage: UNIT_1_4StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_1_4PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_1_4StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_1_4StudentCourseState {
  kind: 'unit14_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_1_4StepResponse>;
  viewedStepIds: string[];
}

export interface UNIT_1_4TeacherCourseSyncState {
  kind: 'teacher_sync_unit14';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_1_4TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_1_4_ROUTE_SEGMENT = 'unit-1-4-time-frequency-views';
export const UNIT_1_4_PRESET_KEY = 'unit-1-4-time-frequency-views-v1';
export const UNIT_1_4_RESOURCE_KEY = UNIT_1_4_ROUTE_SEGMENT;
export const UNIT_1_4_LESSON_KEY = UNIT_1_4_PRESET_KEY;
export const UNIT_1_4_STUDENT_ITEM_ID = 'student:unit14:state';
export const UNIT_1_4_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_1_4_STUDENT_STATE_KEY = 'course';
export const UNIT_1_4_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_1_4_COURSE_TITLE = '1-4：时域与频域——同一个系统的两种观察视角';
export const UNIT_1_4_COURSE_SUBTITLE = 'Time-Domain and Frequency-Domain Views';
export const UNIT_1_4_COURSE_DESCRIPTION =
  '以船舶航向闭环为贯穿对象，联读极点、阶跃响应、Bode 图与 Nyquist 图，建立时域过程和频域节律之间的同源证据链。';

export const UNIT_1_4_STAGE_LABEL: Record<UNIT_1_4StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_1_4_STAGE_MAP: Record<UNIT_1_4StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function pageTypeFromInteraction(stepId: string, interactionKind: string): UNIT_1_4PageType {
  if (interactionKind === 'none') return stepId === 'step-12' ? 'summary' : 'display';
  if (
    interactionKind === 'quiz_group' ||
    interactionKind === 'activity_cards' ||
    interactionKind === 'interactive_figure_submit' ||
    interactionKind === 'worked_example_reveal' ||
    interactionKind === 'table_builder'
  ) {
    return interactionKind;
  }
  return 'display';
}

const STEP_SOURCE = [
  ['step-01', 'B', '船舶航向中的过程与节律', '区分一次转向过程与持续周期扰动对应的两类观察问题。', 'none', '6 min'],
  ['step-02', 'O', '课程目标', '明确时域、频域、通道标注和多图联读的学习目标。', 'none', '4 min'],
  ['step-03', 'P1', '复平面、正弦信号与反馈结构前测', '检查复平面、正弦信号和单位反馈结构基础。', 'quiz_group', '6 min'],
  ['step-04', 'P2', '观察域与输入输出通道', '先标清输入输出通道，再区分时域问题与频域问题。', 'activity_cards', '8 min'],
  ['step-05', 'P2', '闭环极点与阶跃响应的时域参照', '联动读取增益、闭环极点、阶跃响应与性能指标。', 'interactive_figure_submit', '10 min'],
  ['step-06', 'P2', '闭环 Bode 图、带宽与环路穿越频率', '辨析闭环带宽与环路增益穿越频率对应的不同对象。', 'activity_cards', '10 min'],
  ['step-07', 'P2', 'Bode 与 Nyquist 的同频点表达', '在同一频点联读幅值、相位与复平面位置。', 'interactive_figure_submit', '10 min'],
  ['step-08', 'P2', '闭环时域与环路频域的四图联读', '在极点、阶跃、Bode 与 Nyquist 四图间建立对象和信息映射。', 'activity_cards', '10 min'],
  ['step-09', 'P2', '多域数据与双图互译例题', '通过分步显影完成三域证据判断和 Bode/Nyquist 互译。', 'worked_example_reveal', '10 min'],
  ['step-10', 'P2', '船舶航向闭环的三域证据', '提交极点、时域过程与频域跟随能力组成的证据链。', 'table_builder', '8 min'],
  ['step-11', 'P3', '通道、双图与多域联读后测', '检验通道辨析、同频点互译和多域联读能力。', 'quiz_group', '5 min'],
  ['step-12', 'S', '先标通道、再读图、最后联读', '收束时域与频域观察的三条核心判断。', 'none', '3 min'],
] as const;

export const UNIT_1_4_LESSON_STEPS: readonly UNIT_1_4StepDefinition[] = STEP_SOURCE.map(
  ([id, stage, title, hint, interactionKind, duration]) => ({
    id,
    stage,
    title,
    hint,
    duration,
    pageType: pageTypeFromInteraction(id, interactionKind),
  }),
) as readonly UNIT_1_4StepDefinition[];

export const UNIT_1_4_AI_PAGE_GOALS: Record<string, string> = Object.fromEntries(
  STEP_SOURCE.map(([id, , , hint]) => [id, hint]),
) as Record<string, string>;

function normalizeUNIT_1_4InteractionKind(kind: string): InteractiveInteractionKind {
  if (
    kind === 'quiz_group' ||
    kind === 'activity_cards' ||
    kind === 'interactive_figure_submit' ||
    kind === 'worked_example_reveal' ||
    kind === 'table_builder'
  ) {
    return kind as InteractiveInteractionKind;
  }
  return 'none';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_1_4PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_1_4InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_1_4TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_1_4TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_1_4TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_1_4TeacherControlMode,
    },
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    aiPageGoal: step.aiContextSpec.pageGoal,
    aiDeliveryMode: step.aiContextSpec.deliveryMode,
    previewDemoPath: step.previewContract.demoPath,
  };
}

export function getUNIT_1_4ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('1-4 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_1_4PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_1_4ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_1_4Step(stepId: string) {
  return UNIT_1_4_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_1_4_LESSON_STEPS[0];
}

export function isUNIT_1_4InteractivePageType(pageType: UNIT_1_4PageType) {
  return pageType !== 'display' && pageType !== 'summary';
}

export function createEmptyUNIT_1_4StudentState(studentName: string): UNIT_1_4StudentCourseState {
  return {
    kind: 'unit14_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
    viewedStepIds: [],
  };
}

function parseUNIT_1_4StructuredAnswer(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractUNIT_1_4ParameterSource(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const payload = record.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const parameterSnapshot = (payload as Record<string, unknown>).parameterSnapshot;
    if (parameterSnapshot && typeof parameterSnapshot === 'object' && !Array.isArray(parameterSnapshot)) {
      return parameterSnapshot as Record<string, unknown>;
    }
  }
  return record;
}

export function buildUNIT_1_4ParameterSnapshots({
  answers,
  submitFields,
}: {
  answers: Record<string, string>;
  submitFields: readonly string[];
}) {
  const snapshots: Record<string, unknown> = {};
  for (const field of submitFields) {
    if (answers[field] !== undefined) snapshots[field] = answers[field];
  }
  for (const value of Object.values(answers)) {
    const source = extractUNIT_1_4ParameterSource(parseUNIT_1_4StructuredAnswer(value));
    if (!source) continue;
    for (const field of submitFields) {
      const fieldValue = source[field];
      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') snapshots[field] = fieldValue;
    }
  }
  return Object.keys(snapshots).length ? snapshots : null;
}

export const UNIT_1_4_PREMIUM_LESSON_CARD = {
  id: UNIT_1_4_RESOURCE_KEY,
  title: UNIT_1_4_COURSE_TITLE,
  description: '精品互动课：围绕船舶航向闭环，联读极点、阶跃响应、Bode 图与 Nyquist 图，建立时域和频域的同源观察视角。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_1_4_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_1_4StudentState(value: unknown): value is UNIT_1_4StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_1_4StudentCourseState>;
  return data.kind === 'unit14_student_state'
    && data.version === 1
    && typeof data.studentName === 'string'
    && typeof data.updatedAt === 'number'
    && Boolean(data.responses && typeof data.responses === 'object' && !Array.isArray(data.responses))
    && Array.isArray(data.viewedStepIds)
    && data.viewedStepIds.every((stepId) => typeof stepId === 'string');
}

export function isUNIT_1_4TeacherSyncState(value: unknown): value is UNIT_1_4TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_1_4TeacherCourseSyncState>;
  const isBooleanMap = (candidate: unknown) => Boolean(
    candidate
    && typeof candidate === 'object'
    && !Array.isArray(candidate)
    && Object.values(candidate).every((item) => typeof item === 'boolean'),
  );
  const isNumberMap = (candidate: unknown) => Boolean(
    candidate
    && typeof candidate === 'object'
    && !Array.isArray(candidate)
    && Object.values(candidate).every((item) => typeof item === 'number' && Number.isFinite(item)),
  );
  return data.kind === 'teacher_sync_unit14'
    && typeof data.activeStepId === 'string'
    && UNIT_1_4_LESSON_STEPS.some((step) => step.id === data.activeStepId)
    && isBooleanMap(data.revealedAnswers)
    && isBooleanMap(data.releasedActivities)
    && isBooleanMap(data.browseEnabled)
    && isNumberMap(data.teacherRevealProgress)
    && typeof data.updatedAt === 'number'
    && Number.isFinite(data.updatedAt);
}

export const UNIT_1_4_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_1_4StudentCourseState,
  UNIT_1_4TeacherCourseSyncState,
  UNIT_1_4TeacherSyncInput
> = {
  lessonKey: UNIT_1_4_LESSON_KEY,
  studentItemId: UNIT_1_4_STUDENT_ITEM_ID,
  teacherItemId: UNIT_1_4_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_1_4_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_1_4_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_1_4StudentState,
  isStudentState: isUNIT_1_4StudentState,
  isTeacherSyncState: isUNIT_1_4TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit14',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_1_4TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_1_4TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_1_4TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_1_4TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_1_4_LESSON_STEPS,
  });
}
