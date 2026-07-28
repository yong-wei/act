import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type {
  InteractiveInteractionKind,
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_1_3StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_1_3TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct'
  | 'enabled';
export type UNIT_1_3PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'step_reveal'
  | 'teacher_reveal_only'
  | 'structured_compare'
  | 'single_choice'
  | 'interactive_figure_submit';

export interface UNIT_1_3PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_1_3PageContract {
  layout: {
    template: string;
    regions: UNIT_1_3PageRegionContract[];
  };
  interactionKind: InteractiveInteractionKind;
  teacherControls: {
    releaseActivity: UNIT_1_3TeacherControlMode;
    openBrowse: UNIT_1_3TeacherControlMode;
    teacherStepReveal: UNIT_1_3TeacherControlMode;
    revealReferenceAnswer: UNIT_1_3TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiPageGoal: string;
  aiDeliveryMode?: string;
  previewDemoPath: string;
}

export interface UNIT_1_3StepDefinition {
  id: string;
  stage: UNIT_1_3StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_1_3PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_1_3StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_1_3StudentCourseState {
  kind: 'unit13_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_1_3StepResponse>;
  viewedStepIds: string[];
}

export interface UNIT_1_3TeacherCourseSyncState {
  kind: 'teacher_sync_unit13';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_1_3TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_1_3_ROUTE_SEGMENT = 'unit-1-3-parameter-pole-migration';
export const UNIT_1_3_PRESET_KEY = 'unit-1-3-parameter-pole-migration-v1';
export const UNIT_1_3_RESOURCE_KEY = UNIT_1_3_ROUTE_SEGMENT;
export const UNIT_1_3_LESSON_KEY = UNIT_1_3_PRESET_KEY;
export const UNIT_1_3_STUDENT_ITEM_ID = 'student:unit13:state';
export const UNIT_1_3_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_1_3_STUDENT_STATE_KEY = 'course';
export const UNIT_1_3_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_1_3_COURSE_TITLE = '1-3：参数变化与极点迁移';
export const UNIT_1_3_COURSE_SUBTITLE = 'Parameter Change and Pole Migration';
export const UNIT_1_3_COURSE_DESCRIPTION =
  '围绕开环与闭环增益角色、闭环特征方程、极点迁移、时域响应和根轨迹雏形，建立参数变化推动系统行为变化的证据链。';

export const UNIT_1_3_STAGE_LABEL: Record<UNIT_1_3StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_1_3_STAGE_MAP: Record<UNIT_1_3StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function pageTypeFromInteraction(stepId: string, interactionKind: string): UNIT_1_3PageType {
  if (interactionKind === 'none') return stepId === 'step-11' ? 'summary' : 'display';
  if (
    interactionKind === 'quiz_group' ||
    interactionKind === 'step_reveal' ||
    interactionKind === 'teacher_reveal_only' ||
    interactionKind === 'structured_compare' ||
    interactionKind === 'single_choice' ||
    interactionKind === 'interactive_figure_submit'
  ) {
    return interactionKind;
  }
  return 'display';
}

const STEP_SOURCE = [
  ['step-01', 'B', '导入——自动舵增益旋钮与极点迁移现象', '从自动舵调参现象引出参数推动极点迁移。', 'none', '6 min'],
  ['step-02', 'O', '课程目标', '明确参数、极点、响应和根轨迹之间的学习链。', 'none', '4 min'],
  ['step-03', 'P1', '前测——进入根轨迹前的准备', '检查极点读图、二次方程根类型和闭环结构基础。', 'quiz_group', '6 min'],
  ['step-04', 'P2', '开环与闭环——同一个增益，两种命运', '用结构图与代数推导区分开环和闭环增益角色。', 'single_choice', '14 min'],
  ['step-05', 'P2', '极点移动有连续性，响应变化也有连续性', '从极点公式建立 K 的三个连续区段。', 'none', '11 min'],
  ['step-06', 'P2', '从极点到曲线——三组 K 值的时域全貌', '联动读取 K、闭环极点、阶跃响应和性能指标。', 'interactive_figure_submit', '12 min'],
  ['step-07', 'P2', '根轨迹雏形——把极点路径画在同一张图上', '把离散极点位置提升为随 K 连续变化的根轨迹。', 'interactive_figure_submit', '10 min'],
  ['step-08', 'P2', '例题——追踪极点迁移，预判行为变化', '迁移使用特征方程、极点公式和区段判断方法。', 'single_choice', '9 min'],
  ['step-09', 'P2', '案例——自动舵增益调节的三次记录', '把极点迁移结论用于自动舵增益取舍。', 'single_choice', '9 min'],
  ['step-10', 'P3', '后测', '检验增益角色、极点迁移阶段和根轨迹定义。', 'quiz_group', '6 min'],
  ['step-11', 'S', '总结——三个可带走的判断', '收束开环结构、闭环特征方程、极点迁移、响应与根轨迹证据链。', 'none', '3 min'],
] as const;

export const UNIT_1_3_LESSON_STEPS: readonly UNIT_1_3StepDefinition[] = STEP_SOURCE.map(
  ([id, stage, title, hint, interactionKind, duration]) => ({
    id,
    stage,
    title,
    hint,
    duration,
    pageType: pageTypeFromInteraction(id, interactionKind),
  }),
) as readonly UNIT_1_3StepDefinition[];

export const UNIT_1_3_AI_PAGE_GOALS: Record<string, string> = Object.fromEntries(
  STEP_SOURCE.map(([id, , , hint]) => [id, hint]),
) as Record<string, string>;

function normalizeUNIT_1_3InteractionKind(kind: string): InteractiveInteractionKind {
  if (
    kind === 'quiz_group' ||
    kind === 'step_reveal' ||
    kind === 'teacher_reveal_only' ||
    kind === 'structured_compare' ||
    kind === 'single_choice' ||
    kind === 'interactive_figure_submit'
  ) {
    return kind as InteractiveInteractionKind;
  }
  return 'none';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_1_3PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_1_3InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_1_3TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_1_3TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_1_3TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_1_3TeacherControlMode,
    },
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    aiPageGoal: step.aiContextSpec.pageGoal,
    aiDeliveryMode: step.aiContextSpec.deliveryMode,
    previewDemoPath: step.previewContract.demoPath,
  };
}

export function getUNIT_1_3ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('1-3 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_1_3PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_1_3ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_1_3Step(stepId: string) {
  return UNIT_1_3_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_1_3_LESSON_STEPS[0];
}

export function isUNIT_1_3InteractivePageType(pageType: UNIT_1_3PageType) {
  return pageType !== 'display' && pageType !== 'summary';
}

export function createEmptyUNIT_1_3StudentState(studentName: string): UNIT_1_3StudentCourseState {
  return {
    kind: 'unit13_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
    viewedStepIds: [],
  };
}

function parseUNIT_1_3StructuredAnswer(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractUNIT_1_3ParameterSource(parsed: unknown): Record<string, unknown> | null {
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

export function buildUNIT_1_3ParameterSnapshots({
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
    const parsed = parseUNIT_1_3StructuredAnswer(value);
    const source = extractUNIT_1_3ParameterSource(parsed);
    if (!source) continue;
    for (const field of submitFields) {
      const fieldValue = source[field];
      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        snapshots[field] = fieldValue;
      }
    }
  }
  return Object.keys(snapshots).length ? snapshots : null;
}

export const UNIT_1_3_PREMIUM_LESSON_CARD = {
  id: UNIT_1_3_RESOURCE_KEY,
  title: UNIT_1_3_COURSE_TITLE,
  description: '精品互动课：从自动舵增益旋钮出发，联读闭环特征方程、极点迁移、时域响应与根轨迹雏形。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_1_3_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_1_3StudentState(value: unknown): value is UNIT_1_3StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_1_3StudentCourseState>;
  return data.kind === 'unit13_student_state' && data.version === 1;
}

export function isUNIT_1_3TeacherSyncState(value: unknown): value is UNIT_1_3TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_1_3TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit13' && typeof data.activeStepId === 'string';
}

export const UNIT_1_3_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_1_3StudentCourseState,
  UNIT_1_3TeacherCourseSyncState,
  UNIT_1_3TeacherSyncInput
> = {
  lessonKey: UNIT_1_3_LESSON_KEY,
  studentItemId: UNIT_1_3_STUDENT_ITEM_ID,
  teacherItemId: UNIT_1_3_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_1_3_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_1_3_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_1_3StudentState,
  isStudentState: isUNIT_1_3StudentState,
  isTeacherSyncState: isUNIT_1_3TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit13',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_1_3TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_1_3TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_1_3TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_1_3TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_1_3_LESSON_STEPS,
  });
}
