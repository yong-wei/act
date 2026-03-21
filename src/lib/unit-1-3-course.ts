import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_1_3StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_1_3PageType = 'display' | 'quiz' | 'form' | 'ai' | 'summary';
export type Unit13WorkspaceKind =
  | 'time-constant'
  | 'second-order-parameter-map'
  | 'response-family'
  | 'metric-overview'
  | 'settling-band'
  | 'worked-example'
  | 'pole-region'
  | 'none';

export interface UNIT_1_3StepDefinition {
  id: string;
  stage: UNIT_1_3StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_1_3PageType;
  workspaceKind?: Unit13WorkspaceKind;
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
}

export interface UNIT_1_3TeacherCourseSyncState {
  kind: 'teacher_sync_unit13';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_1_3TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_1_3TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_1_3TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_1_3_ROUTE_SEGMENT = 'unit-1-3-time-domain-response';
export const UNIT_1_3_PRESET_KEY = 'unit-1-3-time-domain-response-v1';
export const UNIT_1_3_RESOURCE_KEY = 'unit-1-3-time-domain-response';
export const UNIT_1_3_LESSON_KEY = UNIT_1_3_PRESET_KEY;
export const UNIT_1_3_STUDENT_ITEM_ID = 'student:unit13:state';
export const UNIT_1_3_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_1_3_STUDENT_STATE_KEY = 'course';
export const UNIT_1_3_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_1_3_COURSE_TITLE = '1-3：时域响应分析——从响应曲线到动态性能指标';
export const UNIT_1_3_COURSE_SUBTITLE = 'Time-Domain Response';
export const UNIT_1_3_COURSE_DESCRIPTION =
  '围绕单位阶跃响应、一阶与二阶系统标准型、上升时间、峰值时间、超调量与调节时间，建立从闭环传递函数到动态性能语言的第一套分析框架。';

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

export const UNIT_1_3_LESSON_STEPS: UNIT_1_3StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图——从传函走向响应曲线',
    hint: '前两课解决系统怎么写出来，这一课开始解决系统会怎样表现。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入——稳定并不等于表现一样',
    hint: '比较两条都稳定的曲线，先建立“动态过程也要评价”的意识。',
    duration: '4 min',
    pageType: 'quiz',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '学习目标——本课要建立哪套语言',
    hint: '明确会看、会算、会连这三类目标。',
    duration: '2 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测——快、稳、冲分别看什么',
    hint: '用三道速测题暴露“稳定、快速、超调”之间的混淆。',
    duration: '5 min',
    pageType: 'quiz',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '时域分析对象与典型输入',
    hint: '区分脉冲、阶跃、斜坡，但把单位阶跃确立为本课默认场景。',
    duration: '5 min',
    pageType: 'form',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '一阶系统阶跃响应与时间常数',
    hint: '抓住 t=T 时达到终值 63.2% 这一锚点，理解时间尺度。',
    duration: '10 min',
    pageType: 'form',
    workspaceKind: 'time-constant',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '二阶系统标准型：wn、zeta、wd',
    hint: '把自然频率、阻尼比和阻尼振荡频率三者各自负责的现象说清楚。',
    duration: '7 min',
    pageType: 'form',
    workspaceKind: 'second-order-parameter-map',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '四种响应家族对比',
    hint: '把无阻尼、欠阻尼、临界阻尼、过阻尼看成阻尼比连续变化的一条谱。',
    duration: '6 min',
    pageType: 'form',
    workspaceKind: 'response-family',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '动态性能指标总览',
    hint: '先把上升时间、峰值时间、超调量、调节时间的语言全景搭起来。',
    duration: '4 min',
    pageType: 'display',
    workspaceKind: 'metric-overview',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '上升时间的定义与推导',
    hint: '理解“第一次到达终值”的含义，并判断 wn 变化对 tr 的影响。',
    duration: '6 min',
    pageType: 'form',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '峰值时间与超调量',
    hint: '明确 Mp 主要由 zeta 决定，而不是由 wn 决定。',
    duration: '7 min',
    pageType: 'form',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '调节时间与误差带',
    hint: '区分严格定义与工程近似，并把注意力转到极点实部。',
    duration: '7 min',
    pageType: 'form',
    workspaceKind: 'settling-band',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '例题一——已知参数求指标',
    hint: '按“读 wn、zeta -> 求 wd -> 顺推四指标”的三步法组织解题。',
    duration: '8 min',
    pageType: 'form',
    workspaceKind: 'worked-example',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '例题二——由指标反推参数区域 + AI 对照',
    hint: '先独立判断参数约束，再让 AI 帮你核对推理链。',
    duration: '10 min',
    pageType: 'ai',
  },
  {
    id: 'step-15',
    stage: 'P2',
    title: '跨域桥接——从时域指标走向极点',
    hint: '把“更快、更稳、更小超调”翻译成复平面中的极点区域语言。',
    duration: '5 min',
    pageType: 'form',
    workspaceKind: 'pole-region',
  },
  {
    id: 'step-16',
    stage: 'P3',
    title: '后测——公式会算，更要会解释',
    hint: '检验你是否能把公式结果翻译回系统品质语言。',
    duration: '6 min',
    pageType: 'quiz',
  },
  {
    id: 'step-17',
    stage: 'S',
    title: '总结与后续预告',
    hint: '用关键词收束时域分析，并把视角推进到极点与性能映射。',
    duration: '5 min',
    pageType: 'summary',
  },
] as const;

export function getUNIT_1_3Step(stepId: string) {
  return UNIT_1_3_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_1_3_LESSON_STEPS[0];
}

export function createEmptyUNIT_1_3StudentState(studentName: string): UNIT_1_3StudentCourseState {
  return {
    kind: 'unit13_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_1_3_PREMIUM_LESSON_CARD = {
  id: 'unit-1-3-time-domain-response',
  title: UNIT_1_3_COURSE_TITLE,
  description: '精品互动课：把闭环传递函数翻译成响应曲线与动态性能指标。',
  duration: '100 分钟',
  href: `/interactive-learning/courses/${UNIT_1_3_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_1_3_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/1-3/media/td-04-time-domain-indices-annotated.svg',
  'step-05': '/course-runtime/lessons/1-3/media/td-01-time-domain-input-response-overview.svg',
  'step-06': '/course-runtime/lessons/1-3/media/td-02-first-order-step-time-constant.svg',
  'step-08': '/course-runtime/lessons/1-3/media/td-03-second-order-response-families.svg',
  'step-09': '/course-runtime/lessons/1-3/media/td-04-time-domain-indices-annotated.svg',
  'step-13': '/course-runtime/lessons/1-3/media/td-05-example-response-with-indices.svg',
  'step-15': '/course-runtime/lessons/1-3/media/td-06-time-spec-to-pole-region.svg',
};

export function getUNIT_1_3MediaSrc(stepId: string) {
  return UNIT_1_3_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_1_3StudentState(value: unknown): value is UNIT_1_3StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_1_3StudentCourseState>;
  return data.kind === 'unit13_student_state' && data.version === 1;
}

export function isUNIT_1_3TeacherSyncState(value: unknown): value is UNIT_1_3TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
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
  studentStateKey: 'course',
  teacherStateKey: 'teacher-sync',
  createEmptyStudentState: createEmptyUNIT_1_3StudentState,
  isStudentState: isUNIT_1_3StudentState,
  isTeacherSyncState: isUNIT_1_3TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit13',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_1_3TeacherSync(input: UNIT_1_3TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_1_3TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_1_3TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_1_3TeacherSession(input: UNIT_1_3TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
