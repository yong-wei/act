import type { BopppsStage } from '@prisma/client';

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
export const UNIT_4_3_COURSE_TITLE = '4-3：初始方案落地实践：从对象分析到结构组合与首轮验证';
export const UNIT_4_3_COURSE_SUBTITLE = 'Initial Scheme Practice';
export const UNIT_4_3_COURSE_DESCRIPTION =
  '围绕对象分析、结构分流、复合结构职责、客船首轮验证与问题清单，把 4-2 的起步卡推进成 4-4 可继续使用的第一版方案。';

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
  'step-02': { stage: 'P1', duration: '6 min' },
  'step-03': { stage: 'P2', duration: '6 min' },
  'step-04': { stage: 'P2', duration: '6 min' },
  'step-05': { stage: 'P2', duration: '7 min' },
  'step-06': { stage: 'P2', duration: '7 min' },
  'step-07': { stage: 'P2', duration: '7 min' },
  'step-08': { stage: 'P2', duration: '6 min' },
  'step-09': { stage: 'P2', duration: '8 min' },
  'step-10': { stage: 'P2', duration: '8 min' },
  'step-11': { stage: 'P2', duration: '7 min' },
  'step-12': { stage: 'P2', duration: '10 min' },
  'step-13': { stage: 'P2', duration: '6 min' },
  'step-14': { stage: 'S', duration: '5 min' },
};

export const UNIT_4_3_PRESET_STEPS: Array<
  UNIT_4_3RuntimeStepDefinition & { interactive: boolean }
> = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图：4-2 的起步卡如何长成 4-3 的第一版方案',
    hint: '固定 4-3 是把起步卡推进成第一版方案的课程。',
    duration: '4 min',
    pageType: 'display',
    interactive: false,
  },
  {
    id: 'step-02',
    stage: 'P1',
    title: '对象分析四问：对象入口不是重抄模型',
    hint: '固定对象分析是设计入口，而不是背景重复。',
    duration: '6 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-03',
    stage: 'P2',
    title: '结构分流：什么时候继续单结构，什么时候进入复合结构',
    hint: '让学生把分流判断与表 1 建立一一对应。',
    duration: '6 min',
    pageType: 'single_choice',
    interactive: true,
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '复合结构总览：三类常见写法不是公式堆长',
    hint: '固定三类复合结构的适用问题与分工。',
    duration: '6 min',
    pageType: 'display',
    interactive: false,
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '结构 A：`PI + 超前`——低频托举与中频整理分工',
    hint: '把 PI+超前 的职责分工落成完整方法页。',
    duration: '7 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '结构 B：`滞后 + 超前`——低频补偿与裕量回收并行',
    hint: '把滞后+超前 的稳健收益与速度代价写清。',
    duration: '7 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '结构 C：带微分滤波的 `PID`——紧凑表达与高频克制',
    hint: '把带微分滤波 PID 的紧凑表达与高频克制写完整。',
    duration: '7 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '客船案例入口：为什么这里先上超前，而不是立刻复合',
    hint: '固定客船案例当前主矛盾在中频动态品质。',
    duration: '6 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '客船参数方向显影：五步把超前初始方案写成可运行表达',
    hint: '把参数方向写成五步可解释链，而非参数表。',
    duration: '8 min',
    pageType: 'worked_example_reveal',
    interactive: true,
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '客船首轮验证：表 6 与问题清单怎样接成下一轮输入',
    hint: '把首轮验证结果转成下一轮问题清单。',
    duration: '8 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '最小例题：什么时候从单结构走向复合结构',
    hint: '用最小例题固定转入复合结构的触发条件。',
    duration: '7 min',
    pageType: 'worked_example_reveal',
    interactive: true,
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '实践工作区：对象分析记录单 + 初始方案表达卡 + 问题清单移交表',
    hint: '输出三份最小提交物，而不是单一大表单。',
    duration: '10 min',
    pageType: 'task_card_workspace',
    interactive: true,
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '边界案例：横摇减摇鳍说明复合不只来自频段叠加',
    hint: '说明复合结构还可能来自通道重写。',
    duration: '6 min',
    pageType: 'activity_card_set',
    interactive: true,
  },
  {
    id: 'step-14',
    stage: 'S',
    title: '后测与收束：从第一版方案走向 4-4 的多目标权衡',
    hint: '检查判断链是否形成，并把学生送往 4-4。',
    duration: '5 min',
    pageType: 'quiz_group',
    interactive: true,
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
  description: '精品互动课：把对象分析、复合结构职责、参数方向和首轮验证连接成第一版方案。',
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
  input.trackSessionFinalize({ currentStepId: input.currentStepId });
}
