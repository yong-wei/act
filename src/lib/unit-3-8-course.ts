import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import {
  getInteractiveRuntimeStep,
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_3_8StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3';
export type UNIT_3_8TeacherControlMode =
  | 'not_applicable'
  | 'separate_toggle'
  | 'teacher_only'
  | 'always_on';

export type UNIT_3_8PageType =
  | 'none'
  | 'quiz_group'
  | 'row_focus_toggle'
  | 'curve_compare_panel'
  | 'activity_cards'
  | 'step_reveal'
  | 'reason_chain'
  | 'matrix_choice_cards'
  | 'card_sort'
  | 'hotspot_labeling'
  | 'band_focus_panel'
  | 'goal_cards'
  | 'evidence_mark_cards'
  | 'structured_compare'
  | 'scheme_vote_cards'
  | 'reflection_card'
  | 'teacher_reveal_only';

export interface UNIT_3_8PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_3_8PageContract {
  layout: {
    template: string;
    regions: UNIT_3_8PageRegionContract[];
  };
  interactionKind: UNIT_3_8PageType;
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  teacherControls: {
    releaseActivity: UNIT_3_8TeacherControlMode;
    openBrowse: UNIT_3_8TeacherControlMode;
    teacherStepReveal: UNIT_3_8TeacherControlMode;
    revealReferenceAnswer: UNIT_3_8TeacherControlMode;
    instructorDemoTools: string[];
  };
  previewDemoPath: string;
}

export interface UNIT_3_8StepDefinition {
  id: string;
  stage: UNIT_3_8StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_3_8PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_3_8StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_3_8StudentCourseState {
  kind: 'unit38_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_3_8StepResponse>;
}

export interface UNIT_3_8TeacherCourseSyncState {
  kind: 'teacher_sync_unit38';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_3_8TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_3_8TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_3_8TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_3_8_ROUTE_SEGMENT = 'unit-3-8-frequency-domain-translation-judgment';
export const UNIT_3_8_PRESET_KEY = 'unit-3-8-frequency-domain-translation-judgment-v1';
export const UNIT_3_8_RESOURCE_KEY = 'unit-3-8-frequency-domain-translation-judgment';
export const UNIT_3_8_LESSON_KEY = UNIT_3_8_PRESET_KEY;
export const UNIT_3_8_STUDENT_ITEM_ID = 'student:unit38:state';
export const UNIT_3_8_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_3_8_STUDENT_STATE_KEY = 'course';
export const UNIT_3_8_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_3_8_COURSE_TITLE = '3-8：频域判别与跨域综合语言';
export const UNIT_3_8_COURSE_SUBTITLE = 'Frequency-Domain Translation And Judgment';
export const UNIT_3_8_COURSE_DESCRIPTION =
  '围绕结构变化的频域指纹、Nyquist 与 Bode 统一判稳链、三频段分工和双工程案例读回，把模块 3 的动态线与稳态线收成同一张频域判断地图。';

export const UNIT_3_8_STAGE_LABEL: Record<UNIT_3_8StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测与收束',
};

export const UNIT_3_8_STAGE_MAP: Record<UNIT_3_8StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
};

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_3_8PageContract {
  return {
    layout: {
      template: step.layout.template,
      regions: step.layout.regions.map((region) => ({
        id: region.id,
        width: region.width,
        order: region.order,
      })),
    },
    interactionKind: step.interactionSpec.interactionKind as UNIT_3_8PageType,
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_3_8TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_3_8TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_3_8TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_3_8TeacherControlMode,
      instructorDemoTools: [],
    },
    previewDemoPath: step.previewContract.demoPath || `/interactive-learning/courses/${UNIT_3_8_ROUTE_SEGMENT}/student/demo?step=${step.id}`,
  };
}

export const UNIT_3_8_INTERACTIVE_PAGE_TYPES = new Set<UNIT_3_8PageType>([
  'quiz_group',
  'row_focus_toggle',
  'curve_compare_panel',
  'activity_cards',
  'step_reveal',
  'reason_chain',
  'matrix_choice_cards',
  'card_sort',
  'hotspot_labeling',
  'band_focus_panel',
  'goal_cards',
  'evidence_mark_cards',
  'structured_compare',
  'scheme_vote_cards',
  'reflection_card',
  'teacher_reveal_only',
]);

function inferUNIT_3_8Stage(stepId: string): UNIT_3_8StageCode {
  if (stepId === 'step-01') return 'B';
  if (stepId === 'step-02') return 'O';
  if (stepId === 'step-03') return 'P1';
  if (stepId === 'step-21' || stepId === 'step-22') return 'P3';
  return 'P2';
}

function inferUNIT_3_8Duration(stepId: string): string {
  if (stepId === 'step-01' || stepId === 'step-02' || stepId === 'step-04') return '4 min';
  if (stepId === 'step-03' || stepId === 'step-21') return '8 min';
  if (stepId === 'step-22') return '3 min';
  return '5 min';
}

export const UNIT_3_8_LESSON_STEPS: UNIT_3_8StepDefinition[] = [
  ['step-01', '导入：三类结构变化为什么需要统一频域语言', 'none'],
  ['step-02', '课程目标：用频域语言解释结构变化与稳定边界', 'none'],
  ['step-03', '前测：四类典型误判先暴露出来', 'quiz_group'],
  ['step-04', '四类结构变化总表：先给开环传函与频率响应，再看频域指纹', 'none'],
  ['step-05', '2.2.1 增益提升：整条曲线一起被抬高', 'none'],
  ['step-06', '2.2.2 左半平面零点：重点改写中频', 'none'],
  ['step-07', '2.2.3 极点增加与积分环节：先给精度，再收紧余量', 'none'],
  ['step-08', '2.2.4 右半平面零点：为什么“看起来更强”却可能更难控制', 'none'],
  ['step-09', '例题 1：先从哪一段频带开始判断结构变化', 'activity_cards'],
  ['step-10', '从幅角原理到 Nyquist 判据：为什么要研究 F(s)=1+G(s)H(s)', 'teacher_reveal_only'],
  ['step-11', '例题 2：第一组 Nyquist 快速判稳题', 'none'],
  ['step-12', '例题 3：靠近边界与越过边界有什么本质不同', 'card_sort'],
  ['step-13', 'Bode 判稳：截止频率、相角裕度和增益裕度', 'hotspot_labeling'],
  ['step-14', '例题 4：由 Bode 图直接判断系统在边界哪一侧', 'activity_cards'],
  ['step-15', '三频段分工：精度、速度与代价不能混读', 'band_focus_panel'],
  ['step-16', '例题 5：目标切换时，先改哪一段频带', 'goal_cards'],
  ['step-17', '航向控制案例：先把基线方案的问题读清楚', 'evidence_mark_cards'],
  ['step-18', '航向控制案例：把时域指标翻译成频域目标，再看超前校正', 'structured_compare'],
  ['step-19', '稳定平台案例：为什么“只改增益”会左右为难', 'scheme_vote_cards'],
  ['step-20', '稳定平台案例：超前校正怎样兼顾速度和平稳', 'structured_compare'],
  ['step-21', '后测：把完整判断链独立走一遍', 'quiz_group'],
  ['step-22', '总结与去向：`3-9` 和模块 4 从哪里接走本课', 'reflection_card'],
].map(([id, title, pageType]) => ({
  id,
  stage: inferUNIT_3_8Stage(id),
  title,
  hint: title,
  duration: inferUNIT_3_8Duration(id),
  pageType: pageType as UNIT_3_8PageType,
}));

export function buildUNIT_3_8RuntimeSteps(
  manifest: InteractiveRuntimeManifest | null | undefined,
): UNIT_3_8StepDefinition[] {
  if (!manifest) {
    return UNIT_3_8_LESSON_STEPS;
  }

  return manifest.steps.map((step) => ({
    id: step.id,
    stage: inferUNIT_3_8Stage(step.id),
    title: step.title,
    hint: step.aiContextSpec.pageGoal || step.interactionSpec.studentTask || step.title,
    duration: inferUNIT_3_8Duration(step.id),
    pageType: step.interactionSpec.interactionKind as UNIT_3_8PageType,
  }));
}

export function getUNIT_3_8Step(stepId: string) {
  return UNIT_3_8_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_3_8_LESSON_STEPS[0];
}

function fallbackPageContract(stepId: string): UNIT_3_8PageContract {
  const step = getUNIT_3_8Step(stepId);
  return {
    layout: {
      template: 'single_column',
      regions: [{ id: 'main', width: 'full', order: 1 }],
    },
    interactionKind: step.pageType,
    teacherInsightWidgets: [],
    telemetrySummaryFields: ['viewed'],
    misconceptionTags: [],
    teacherControls: {
      releaseActivity: 'not_applicable',
      openBrowse: 'not_applicable',
      teacherStepReveal: 'not_applicable',
      revealReferenceAnswer: 'not_applicable',
      instructorDemoTools: [],
    },
    previewDemoPath: `/interactive-learning/courses/${UNIT_3_8_ROUTE_SEGMENT}/student/demo?step=${step.id}`,
  };
}

export const UNIT_3_8_PAGE_CONTRACTS: Record<string, UNIT_3_8PageContract> = Object.fromEntries(
  UNIT_3_8_LESSON_STEPS.map((step) => [step.id, fallbackPageContract(step.id)]),
);

export function getUNIT_3_8ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) return null;
  return getInteractiveRuntimeStep(manifest, stepId) ?? manifest.steps[0] ?? null;
}

export function getUNIT_3_8PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  const step = getUNIT_3_8ManifestStepFromManifest(manifest, stepId);
  return step ? pageContractFromManifestStep(step) : fallbackPageContract(stepId);
}

export function getUNIT_3_8PageContract(stepId: string) {
  return UNIT_3_8_PAGE_CONTRACTS[stepId] ?? UNIT_3_8_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_3_8InteractivePageType(pageType: UNIT_3_8PageType) {
  return UNIT_3_8_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_3_8AiPageType(pageType: UNIT_3_8PageType) {
  return false;
}

export function createEmptyUNIT_3_8StudentState(studentName: string): UNIT_3_8StudentCourseState {
  return {
    kind: 'unit38_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_3_8_PREMIUM_LESSON_CARD = {
  id: 'unit-3-8-frequency-domain-translation-judgment',
  title: UNIT_3_8_COURSE_TITLE,
  description: '精品互动课：频域统一翻译、Nyquist/Bode 判稳、三频段分工与工程案例读回。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_3_8_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_3_8_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/3-8/media/3-8-cover-comic.png',
  'step-11': '/course-runtime/lessons/3-8/media/3-8-nyquist-quickcheck.png',
  'step-12': '/course-runtime/lessons/3-8/media/3-8-nyquist-example.png',
  'step-13': '/course-runtime/lessons/3-8/media/3-8-bode-example.png',
  'step-15': '/course-runtime/lessons/3-8/media/3-8-three-band-overview.png',
  'step-17': '/course-runtime/lessons/3-8/media/3-8-heading-baseline.png',
  'step-18': '/course-runtime/lessons/3-8/media/3-8-heading-case.png',
  'step-19': '/course-runtime/lessons/3-8/media/3-8-platform-block-diagram.png',
  'step-20': '/course-runtime/lessons/3-8/media/3-8-platform-case.png',
  'step-22': '/course-runtime/lessons/3-8/media/3-8-info.png',
};

export function getUNIT_3_8MediaSrc(stepId: string) {
  return UNIT_3_8_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_3_8StudentState(value: unknown): value is UNIT_3_8StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_8StudentCourseState>;
  return data.kind === 'unit38_student_state' && data.version === 1;
}

export function isUNIT_3_8TeacherSyncState(value: unknown): value is UNIT_3_8TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_3_8TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit38' && typeof data.activeStepId === 'string';
}

export const UNIT_3_8_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_3_8StudentCourseState,
  UNIT_3_8TeacherCourseSyncState,
  UNIT_3_8TeacherSyncInput
> = {
  lessonKey: UNIT_3_8_LESSON_KEY,
  studentItemId: UNIT_3_8_STUDENT_ITEM_ID,
  teacherItemId: UNIT_3_8_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_3_8_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_3_8_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_3_8StudentState,
  isStudentState: isUNIT_3_8StudentState,
  isTeacherSyncState: isUNIT_3_8TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit38',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_3_8TeacherSync(input: UNIT_3_8TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_3_8TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_3_8TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_3_8TeacherSession(input: UNIT_3_8TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_3_8_LESSON_STEPS,
  }));
}
