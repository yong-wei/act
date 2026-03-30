import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_2_1StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_2_1PageType = 'display' | 'quiz' | 'form' | 'ai' | 'summary';
export type Unit21WorkspaceKind =
  | 'object-chain'
  | 'initial-state'
  | 'typical-elements'
  | 'connection-rules'
  | 'signal-flow-terms'
  | 'mason-highlight'
  | 'none';

export interface UNIT_2_1StepDefinition {
  id: string;
  stage: UNIT_2_1StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_2_1PageType;
  workspaceKind?: Unit21WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_2_1StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_2_1StudentCourseState {
  kind: 'unit21_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_2_1StepResponse>;
}

export interface UNIT_2_1TeacherCourseSyncState {
  kind: 'teacher_sync_unit21';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_2_1TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_2_1TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_2_1TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_2_1_ROUTE_SEGMENT = 'unit-2-1-modeling-language';
export const UNIT_2_1_PRESET_KEY = 'unit-2-1-modeling-language-v1';
export const UNIT_2_1_RESOURCE_KEY = 'unit-2-1-modeling-language';
export const UNIT_2_1_LESSON_KEY = UNIT_2_1_PRESET_KEY;
export const UNIT_2_1_STUDENT_ITEM_ID = 'student:unit21:state';
export const UNIT_2_1_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_2_1_STUDENT_STATE_KEY = 'course';
export const UNIT_2_1_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_2_1_COURSE_TITLE = '2-1：建模与变换语言——从真实对象到统一分析对象';
export const UNIT_2_1_COURSE_SUBTITLE = 'Modeling Language';
export const UNIT_2_1_COURSE_DESCRIPTION =
  '围绕微分方程、拉氏变换、零初值传递函数、典型环节、结构图、信号流图与梅森公式，建立模块 2 的统一对象语言。';

export const UNIT_2_1_STAGE_LABEL: Record<UNIT_2_1StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_2_1_STAGE_MAP: Record<UNIT_2_1StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_2_1_LESSON_STEPS: UNIT_2_1StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图——为什么模块 2 先从建模语言开始',
    hint: '从模块 1 的现象直觉，切换到模块 2 的对象语言。',
    duration: '3 min',
    pageType: 'display',
    workspaceKind: 'object-chain',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入——为什么光有微分方程还不够',
    hint: '先判断：微分方程是终点，还是统一分析对象的起点。',
    duration: '5 min',
    pageType: 'quiz',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '学习目标——今天要建哪条对象链',
    hint: '把“微分方程 -> 传递函数 -> 结构表达 -> 总体对象”一次看清。',
    duration: '2 min',
    pageType: 'display',
    workspaceKind: 'object-chain',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测——对象、初值与结构的三个误区',
    hint: '先暴露最容易混淆的三件事：对象定义、初始状态、结构表达。',
    duration: '4 min',
    pageType: 'quiz',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '拉氏变换的工程动机',
    hint: '不讲积分技巧，讲清为什么它能把微分方程改写成统一代数对象。',
    duration: '6 min',
    pageType: 'form',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '零初值下传递函数怎样形成',
    hint: '明确传递函数为什么不是“原方程换个写法”。',
    duration: '8 min',
    pageType: 'form',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '非零初值为什么不能混进对象定义',
    hint: '先自己区分对象项和初值项，再让 AI 只对照推理链。',
    duration: '6 min',
    pageType: 'ai',
    workspaceKind: 'initial-state',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '典型环节对象库：先看清对象由什么组成',
    hint: '先认对象，再做运算，把形式、名称和工程判断配起来。',
    duration: '8 min',
    pageType: 'form',
    workspaceKind: 'typical-elements',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '结构图三类基本连接',
    hint: '串联、并联、反馈三类规则先立住，不进入复杂变换技巧。',
    duration: '8 min',
    pageType: 'form',
    workspaceKind: 'connection-rules',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '船舶航向系统：把对象真正连成系统',
    hint: '把控制器、舵机、船体和传感器放进同一张结构图。',
    duration: '5 min',
    pageType: 'form',
    workspaceKind: 'connection-rules',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '方框图为什么还不够：信号流图补位',
    hint: '结构图看模块组成，信号流图看节点路径与回路。',
    duration: '5 min',
    pageType: 'display',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '梅森公式的最小使用集',
    hint: '只抓四个术语和一个公式：前向通路、回路、互不接触回路、余子式。',
    duration: '6 min',
    pageType: 'form',
    workspaceKind: 'signal-flow-terms',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '例题一：单回路闭环对象如何收束',
    hint: '从对象识别到信号流图验证，走完整个对象收束链。',
    duration: '8 min',
    pageType: 'form',
    workspaceKind: 'mason-highlight',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '补充辨析：余子式为什么不一定等于 1',
    hint: '重点分清：互不接触回路，与“不接触某条前向通路”不是一回事。',
    duration: '6 min',
    pageType: 'form',
    workspaceKind: 'mason-highlight',
  },
  {
    id: 'step-15',
    stage: 'P3',
    title: '后测——会不会用对象语言复述本课',
    hint: '后测看的是对象建立链是否真正站稳，不只是术语记忆。',
    duration: '5 min',
    pageType: 'quiz',
  },
  {
    id: 'step-16',
    stage: 'S',
    title: '总结——对象语言已建立，下一课进入响应分析',
    hint: '把对象建立、对象识别、结构表达和总体对象四段主线收束起来。',
    duration: '5 min',
    pageType: 'summary',
  },
] as const;

export function getUNIT_2_1Step(stepId: string) {
  return UNIT_2_1_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_2_1_LESSON_STEPS[0];
}

export function createEmptyUNIT_2_1StudentState(studentName: string): UNIT_2_1StudentCourseState {
  return {
    kind: 'unit21_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_2_1_PREMIUM_LESSON_CARD = {
  id: 'unit-2-1-modeling-language',
  title: UNIT_2_1_COURSE_TITLE,
  description: '精品互动课：把微分方程、传递函数、结构图和梅森公式收束成模块 2 的统一对象语言。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_2_1_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_2_1_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/2-1/media/2-1-cover-comic.png',
  'step-08': '/course-runtime/lessons/2-1/media/2-1-md-01-typical-elements-map.png',
  'step-09': '/course-runtime/lessons/2-1/media/2-1-md-02-series-equivalent.png',
  'step-10': '/course-runtime/lessons/2-1/media/2-1-md-05-ship-heading-physical-blocks.png',
  'step-11': '/course-runtime/lessons/2-1/media/2-1-md-06-block-vs-sfg.png',
  'step-13': '/course-runtime/lessons/2-1/media/2-1-md-08-example-ship-sfg.png',
  'step-14': '/course-runtime/lessons/2-1/media/2-1-md-14-example2-sfg.png',
  'step-16': '/course-runtime/lessons/2-1/media/2-1-info.png',
};

export function getUNIT_2_1MediaSrc(stepId: string) {
  return UNIT_2_1_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_2_1StudentState(value: unknown): value is UNIT_2_1StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_2_1StudentCourseState>;
  return data.kind === 'unit21_student_state' && data.version === 1;
}

export function isUNIT_2_1TeacherSyncState(value: unknown): value is UNIT_2_1TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_2_1TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit21' && typeof data.activeStepId === 'string';
}

export const UNIT_2_1_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_2_1StudentCourseState,
  UNIT_2_1TeacherCourseSyncState,
  UNIT_2_1TeacherSyncInput
> = {
  lessonKey: UNIT_2_1_LESSON_KEY,
  studentItemId: UNIT_2_1_STUDENT_ITEM_ID,
  teacherItemId: UNIT_2_1_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_2_1_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_2_1_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_2_1StudentState,
  isStudentState: isUNIT_2_1StudentState,
  isTeacherSyncState: isUNIT_2_1TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit21',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_2_1TeacherSync(input: UNIT_2_1TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_2_1TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_2_1TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_2_1TeacherSession(input: UNIT_2_1TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
