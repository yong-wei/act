import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type {
  InteractiveInteractionKind,
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_1_2StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_1_2TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct'
  | 'enabled';
export type UNIT_1_2PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'step_reveal'
  | 'teacher_reveal_only'
  | 'structured_compare'
  | 'single_choice'
  | 'interactive_figure_submit';

export interface UNIT_1_2PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_1_2PageContract {
  layout: {
    template: string;
    regions: UNIT_1_2PageRegionContract[];
  };
  interactionKind: InteractiveInteractionKind;
  teacherControls: {
    releaseActivity: UNIT_1_2TeacherControlMode;
    openBrowse: UNIT_1_2TeacherControlMode;
    teacherStepReveal: UNIT_1_2TeacherControlMode;
    revealReferenceAnswer: UNIT_1_2TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiPageGoal: string;
  aiDeliveryMode?: string;
  previewDemoPath: string;
}

export interface UNIT_1_2StepDefinition {
  id: string;
  stage: UNIT_1_2StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_1_2PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_1_2StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_1_2StudentCourseState {
  kind: 'unit12_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_1_2StepResponse>;
  viewedStepIds: string[];
}

export interface UNIT_1_2TeacherCourseSyncState {
  kind: 'teacher_sync_unit12';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_1_2TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_1_2_ROUTE_SEGMENT = 'unit-1-2-modeling-from-object-to-system';
export const UNIT_1_2_PRESET_KEY = 'unit-1-2-modeling-from-object-to-system-v1';
export const UNIT_1_2_RESOURCE_KEY = UNIT_1_2_ROUTE_SEGMENT;
export const UNIT_1_2_LESSON_KEY = UNIT_1_2_PRESET_KEY;
export const UNIT_1_2_STUDENT_ITEM_ID = 'student:unit12:state';
export const UNIT_1_2_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_1_2_STUDENT_STATE_KEY = 'course';
export const UNIT_1_2_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_1_2_COURSE_TITLE = '1-2：建模——从真实对象到可分析的系统';
export const UNIT_1_2_COURSE_SUBTITLE = 'Modeling From Object To System';
export const UNIT_1_2_COURSE_DESCRIPTION =
  '围绕机理建模、微分方程、传递函数、结构图、信号流图与极点行为地图，建立从真实对象到可分析系统的第一条建模链路。';

export const UNIT_1_2_STAGE_LABEL: Record<UNIT_1_2StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_1_2_STAGE_MAP: Record<UNIT_1_2StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function pageTypeFromInteraction(stepId: string, interactionKind: string): UNIT_1_2PageType {
  if (interactionKind === 'none') return stepId === 'step-14' ? 'summary' : 'display';
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
  ['step-01', 'B', '导入——不同对象的行为差异与共性', '用两种现象对比引出建模的必要性。', 'none'],
  ['step-02', 'O', '课程目标', '展示本课五个能力目标。', 'none'],
  ['step-03', 'P1', '前测——进入建模专题前的准备', '检测 1-1 基础概念掌握程度。', 'quiz_group'],
  ['step-04', 'P2', '建模的两条路径', '建立机理建模 vs 数据驱动建模的对比框架。', 'none'],
  ['step-05', 'P2', '微分方程——物理对象的第一次翻译', '让学生体验微分方程直接求解的繁琐，建立对传递函数的需求。', 'teacher_reveal_only'],
  ['step-06', 'P2', '传递函数——从微分运算到代数运算', '让学生理解拉氏变换到传递函数的三步法转换链。', 'single_choice'],
  ['step-07', 'P2', '方框图——系统的结构表达', '建立方框图作为系统结构表达工具的认识。', 'structured_compare'],
  ['step-08', 'P2', '信号流图——变量间的决定关系', '建立信号流图作为方框图互补工具的认识。', 'single_choice'],
  ['step-09', 'P2', '极点的几何来源——三维幅值曲面', '用三维几何直观解释极点名称来源。', 'none'],
  ['step-10', 'P2', '拖动极点看响应——行为地图的互动验证', '让学生亲手验证极点位置决定行为这条核心规律。', 'interactive_figure_submit'],
  ['step-11', 'P2', '案例——三艘船，三种行为', '用三种极点分布验证复平面读图规则。', 'single_choice'],
  ['step-12', 'P2', '例题——从特征方程到行为判断', '让学生亲手走完特征方程、极点、读图、行为的完整判断链。', 'single_choice'],
  ['step-13', 'P3', '后测——检验本次课程目标达成', '验证五个课程目标的达成度。', 'quiz_group'],
  ['step-14', 'S', '总结——建模专题的局部地图', '收束全课，回顾五个地标并明确边界。', 'none'],
] as const;

export const UNIT_1_2_LESSON_STEPS: readonly UNIT_1_2StepDefinition[] = STEP_SOURCE.map(
  ([id, stage, title, hint, interactionKind]) => ({
    id,
    stage,
    title,
    hint,
    duration: '6 min',
    pageType: pageTypeFromInteraction(id, interactionKind),
  }),
) as readonly UNIT_1_2StepDefinition[];

export const UNIT_1_2_AI_PAGE_GOALS: Record<string, string> = Object.fromEntries(
  STEP_SOURCE.map(([id, , , hint]) => [id, hint]),
) as Record<string, string>;

function normalizeUNIT_1_2InteractionKind(kind: string): InteractiveInteractionKind {
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

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_1_2PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_1_2InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_1_2TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_1_2TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_1_2TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_1_2TeacherControlMode,
    },
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    aiPageGoal: step.aiContextSpec.pageGoal,
    aiDeliveryMode: step.aiContextSpec.deliveryMode,
    previewDemoPath: step.previewContract.demoPath,
  };
}

export function getUNIT_1_2ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('1-2 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_1_2PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_1_2ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_1_2Step(stepId: string) {
  return UNIT_1_2_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_1_2_LESSON_STEPS[0];
}

export function isUNIT_1_2InteractivePageType(pageType: UNIT_1_2PageType) {
  return pageType !== 'display' && pageType !== 'summary';
}

export function createEmptyUNIT_1_2StudentState(studentName: string): UNIT_1_2StudentCourseState {
  return {
    kind: 'unit12_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
    viewedStepIds: [],
  };
}

function parseUNIT_1_2StructuredAnswer(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractUNIT_1_2ParameterSource(parsed: unknown): Record<string, unknown> | null {
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

export function buildUNIT_1_2ParameterSnapshots({
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
    const parsed = parseUNIT_1_2StructuredAnswer(value);
    const source = extractUNIT_1_2ParameterSource(parsed);
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

export const UNIT_1_2_PREMIUM_LESSON_CARD = {
  id: UNIT_1_2_RESOURCE_KEY,
  title: UNIT_1_2_COURSE_TITLE,
  description: '精品互动课：从真实工程对象出发，走通微分方程、传递函数、结构图、信号流图和极点行为地图。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_1_2_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_1_2StudentState(value: unknown): value is UNIT_1_2StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_1_2StudentCourseState>;
  return data.kind === 'unit12_student_state' && data.version === 1;
}

export function isUNIT_1_2TeacherSyncState(value: unknown): value is UNIT_1_2TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_1_2TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit12' && typeof data.activeStepId === 'string';
}

export const UNIT_1_2_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_1_2StudentCourseState,
  UNIT_1_2TeacherCourseSyncState,
  UNIT_1_2TeacherSyncInput
> = {
  lessonKey: UNIT_1_2_LESSON_KEY,
  studentItemId: UNIT_1_2_STUDENT_ITEM_ID,
  teacherItemId: UNIT_1_2_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_1_2_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_1_2_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_1_2StudentState,
  isStudentState: isUNIT_1_2StudentState,
  isTeacherSyncState: isUNIT_1_2TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit12',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_1_2TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_1_2TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_1_2TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_1_2TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_1_2_LESSON_STEPS,
  });
}
