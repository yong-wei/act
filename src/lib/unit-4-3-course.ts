import type { BopppsStage } from '@prisma/client';
import { buildSessionFinalizeTelemetry } from '@/lib/data-governance/session-finalize-telemetry';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import {
  getInteractiveRuntimeStep,
  isInteractiveRuntimePageType,
  type InteractiveInteractionKind,
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';

export type UNIT_4_3StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_4_3PageType = InteractiveInteractionKind;

export interface UNIT_4_3RuntimeStepDefinition {
  id: string;
  stage: UNIT_4_3StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_4_3PageType;
}

export interface UNIT_4_3StepRuntimeMeta {
  stage: UNIT_4_3StageCode;
  duration: string;
}

export interface UNIT_4_3StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_4_3StudentCourseState {
  kind: 'unit43_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_4_3StepResponse>;
}

export interface UNIT_4_3TeacherCourseSyncState {
  kind: 'teacher_sync_unit43';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_4_3TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_4_3TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_4_3TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_4_3_ROUTE_SEGMENT = 'unit-4-3-initial-scheme-practice-first-validation';
export const UNIT_4_3_PRESET_KEY = 'unit-4-3-initial-scheme-practice-first-validation-v1';
export const UNIT_4_3_RESOURCE_KEY = 'unit-4-3-initial-scheme-practice-first-validation';
export const UNIT_4_3_LESSON_KEY = UNIT_4_3_PRESET_KEY;
export const UNIT_4_3_STUDENT_ITEM_ID = 'student:unit43:state';
export const UNIT_4_3_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_4_3_STUDENT_STATE_KEY = 'course';
export const UNIT_4_3_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_4_3_COURSE_TITLE = '4-3：经典复合控制的初始方案落地：从单结构候选到工程可运行方案';
export const UNIT_4_3_COURSE_SUBTITLE = 'Initial Scheme Practice';
export const UNIT_4_3_COURSE_DESCRIPTION =
  '围绕单结构候选缺口、经典复合控制边界、前馈与反馈分工、实现层保护和客船首轮记录，把已有反馈主结构推进为工程可运行的初始方案。';

export const UNIT_4_3_STAGE_LABEL: Record<UNIT_4_3StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_4_3_STAGE_MAP: Record<UNIT_4_3StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_4_3_STEP_RUNTIME_META: Record<string, UNIT_4_3StepRuntimeMeta> = {
  'step-01': { stage: 'B', duration: '4 min' },
  'step-02': { stage: 'O', duration: '4 min' },
  'step-03': { stage: 'P1', duration: '8 min' },
  'step-04': { stage: 'P2', duration: '5 min' },
  'step-05': { stage: 'P2', duration: '5 min' },
  'step-06': { stage: 'P2', duration: '6 min' },
  'step-07': { stage: 'P2', duration: '6 min' },
  'step-08': { stage: 'P2', duration: '6 min' },
  'step-09': { stage: 'P2', duration: '5 min' },
  'step-10': { stage: 'P2', duration: '5 min' },
  'step-11': { stage: 'P2', duration: '5 min' },
  'step-12': { stage: 'P2', duration: '6 min' },
  'step-13': { stage: 'P2', duration: '5 min' },
  'step-14': { stage: 'P2', duration: '6 min' },
  'step-15': { stage: 'P2', duration: '6 min' },
  'step-16': { stage: 'P2', duration: '5 min' },
  'step-17': { stage: 'P2', duration: '6 min' },
  'step-18': { stage: 'P3', duration: '7 min' },
  'step-19': { stage: 'S', duration: '5 min' },
};

export const UNIT_4_3_PRESET_STEPS: Array<
  UNIT_4_3RuntimeStepDefinition & { interactive: boolean }
> = [
  {
    id: 'step-01',
    stage: 'B',
    title: '单结构候选走向工程复合方案',
    hint: '把 4-3 固定为从单结构候选进入工程复合方案。',
    duration: '4 min',
    pageType: 'display',
    interactive: false,
  },
  {
    id: 'step-02',
    stage: 'O',
    title: '本次课程目标',
    hint: '目标只描述本次课程能力。',
    duration: '4 min',
    pageType: 'display',
    interactive: false,
  },
  {
    id: 'step-03',
    stage: 'P1',
    title: '前置基础读图与信号判断',
    hint: '检查前置读图能力。',
    duration: '8 min',
    pageType: 'quiz_group',
    interactive: true,
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '单结构候选留下的设计缺口',
    hint: '从单结构候选缺口进入复合控制。',
    duration: '5 min',
    pageType: 'quiz_group',
    interactive: true,
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '狭义复合控制与广义复合控制边界',
    hint: '固定本课复合控制范围。',
    duration: '5 min',
    pageType: 'card_sort',
    interactive: true,
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '反馈主结构与复合控制总表达',
    hint: '复合控制不是简单把 C(s) 写长。',
    duration: '6 min',
    pageType: 'step_reveal',
    interactive: true,
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '扰动前馈与反馈的分工关系',
    hint: '扰动前馈提前补偿但不替代反馈。',
    duration: '6 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '参考前馈与给定通道塑形',
    hint: '参考前馈提前处理参考变化，低通限制逆模型风险。',
    duration: '6 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: 'Bode 主环路分析的适用边界',
    hint: '只看 Bode 主环路不足以验证复合控制方案。',
    duration: '5 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '微分滤波与输出微分实现',
    hint: '微分项必须经过工程实现处理。',
    duration: '5 min',
    pageType: 'card_sort',
    interactive: true,
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '给定滤波与二自由度结构',
    hint: '给定滤波体现二自由度信号分工。',
    duration: '5 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '限幅斜率限制与抗积分饱和',
    hint: '抗饱和处理的是饱和后的恢复问题。',
    duration: '6 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '客船对象扰动加入点与反馈主结构',
    hint: '固定客船控制输入通道和扰动通道的差异。',
    duration: '5 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '客船扰动前馈的参数补偿',
    hint: '扰动前馈参数同时改变扰动偏移和舵角补偿。',
    duration: '6 min',
    pageType: 'interactive_figure_submit',
    interactive: true,
  },
  {
    id: 'step-15',
    stage: 'P2',
    title: '客船参考前馈的参数补偿',
    hint: '参考前馈单独减少变化给定阶段的跟随滞后。',
    duration: '6 min',
    pageType: 'interactive_figure_submit',
    interactive: true,
  },
  {
    id: 'step-16',
    stage: 'P2',
    title: '客船给定滤波的平顺性权衡',
    hint: '给定滤波牺牲跟踪速度换取更平滑控制量。',
    duration: '5 min',
    pageType: 'interactive_figure_submit',
    interactive: true,
  },
  {
    id: 'step-17',
    stage: 'P2',
    title: '客船执行器保护与抗饱和验证',
    hint: '含全部复合装置的抗饱和验证形成下一轮优化入口。',
    duration: '6 min',
    pageType: 'interactive_figure_submit',
    interactive: true,
  },
  {
    id: 'step-18',
    stage: 'P3',
    title: '复合控制初始方案后测',
    hint: '后测检查本课目标达成。',
    duration: '7 min',
    pageType: 'quiz_group',
    interactive: true,
  },
  {
    id: 'step-19',
    stage: 'S',
    title: '经典复合控制方案总结',
    hint: '总结经典复合控制初始方案并指向下一轮权衡优化。',
    duration: '5 min',
    pageType: 'display',
    interactive: false,
  },
];

export function buildUNIT_4_3RuntimeSteps(
  manifest: InteractiveRuntimeManifest | null,
): UNIT_4_3RuntimeStepDefinition[] {
  if (!manifest) {
    return UNIT_4_3_PRESET_STEPS.map(({ interactive: _interactive, ...step }) => step);
  }

  return manifest.steps.map((step) => {
    const meta = UNIT_4_3_STEP_RUNTIME_META[step.id] ?? { stage: 'P2' as const, duration: '5 min' };
    const pageType =
      step.interactionSpec.interactionKind === 'none'
        ? 'display'
        : step.interactionSpec.interactionKind;

    return {
      id: step.id,
      stage: meta.stage,
      title: step.title,
      hint: step.aiContextSpec.pageGoal || step.interactionSpec.studentTask || step.title,
      duration: meta.duration,
      pageType,
    };
  });
}

export function getUNIT_4_3StepManifest(
  manifest: InteractiveRuntimeManifest,
  stepId: string,
): InteractiveRuntimeStepManifest {
  return getInteractiveRuntimeStep(manifest, stepId) ?? manifest.steps[0];
}

export function isUNIT_4_3InteractivePageType(pageType: string) {
  return isInteractiveRuntimePageType(pageType);
}

export function isUNIT_4_3AiPageType(_pageType: string) {
  return false;
}

export function createEmptyUNIT_4_3StudentState(studentName: string): UNIT_4_3StudentCourseState {
  return {
    kind: 'unit43_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_4_3_PREMIUM_LESSON_CARD = {
  id: 'unit-4-3-initial-scheme-practice-first-validation',
  title: UNIT_4_3_COURSE_TITLE,
  description: '精品互动课：把单结构候选缺口、前馈与反馈分工、给定滤波、执行器保护和抗饱和验证连接成经典复合控制初始方案。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_4_3_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_4_3StudentState(value: unknown): value is UNIT_4_3StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_3StudentCourseState>;
  return data.kind === 'unit43_student_state' && data.version === 1;
}

export function isUNIT_4_3TeacherSyncState(value: unknown): value is UNIT_4_3TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_3TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit43' && typeof data.activeStepId === 'string';
}

export const UNIT_4_3_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_4_3StudentCourseState,
  UNIT_4_3TeacherCourseSyncState,
  UNIT_4_3TeacherSyncInput
> = {
  lessonKey: UNIT_4_3_LESSON_KEY,
  studentItemId: UNIT_4_3_STUDENT_ITEM_ID,
  teacherItemId: UNIT_4_3_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_4_3_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_4_3_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_4_3StudentState,
  isStudentState: isUNIT_4_3StudentState,
  isTeacherSyncState: isUNIT_4_3TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit43',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_4_3TeacherSync(input: UNIT_4_3TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_4_3TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_4_3TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_4_3TeacherSession(input: UNIT_4_3TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize(buildSessionFinalizeTelemetry({
    currentStepId: input.currentStepId,
    steps: UNIT_4_3_PRESET_STEPS,
  }));
}
