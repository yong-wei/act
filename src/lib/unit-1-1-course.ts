import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_1_1StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_1_1PageType = 'display' | 'quiz' | 'form' | 'ai' | 'summary';
export type Unit11WorkspaceKind = 'pole-response' | 'zero-effect' | 'element-slider' | 'none';

export interface UNIT_1_1StepDefinition {
  id: string;
  stage: UNIT_1_1StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_1_1PageType;
  workspaceKind?: Unit11WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_1_1StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_1_1StudentCourseState {
  kind: 'unit11_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_1_1StepResponse>;
}

export interface UNIT_1_1TeacherCourseSyncState {
  kind: 'teacher_sync_unit11';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_1_1TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_1_1TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_1_1TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_1_1_ROUTE_SEGMENT = 'unit-1-1-laplace-transfer-function';
export const UNIT_1_1_PRESET_KEY = 'unit-1-1-laplace-transfer-function-v1';
export const UNIT_1_1_RESOURCE_KEY = 'unit-1-1-laplace-transfer-function';
export const UNIT_1_1_LESSON_KEY = UNIT_1_1_PRESET_KEY;
export const UNIT_1_1_STUDENT_ITEM_ID = 'student:unit11:state';
export const UNIT_1_1_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_1_1_STUDENT_STATE_KEY = 'course';
export const UNIT_1_1_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_1_1_COURSE_TITLE = '1-1：拉氏变换与传递函数——从微分方程到代数方程';
export const UNIT_1_1_COURSE_SUBTITLE = 'Laplace & Transfer Function';
export const UNIT_1_1_COURSE_DESCRIPTION =
  '从船舶航向方程切入，建立“拉氏变换把微分方程降维为代数方程”的工程动机，完成传递函数三步法、零极点判读与典型环节识别。';

export const UNIT_1_1_STAGE_LABEL: Record<UNIT_1_1StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_1_1_STAGE_MAP: Record<UNIT_1_1StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_1_1_LESSON_STEPS: UNIT_1_1StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图',
    hint: '从 L-1 与 L-sum 回到 1-1 的数学精化起点。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入：船舶航向方程',
    hint: '从船舶转向微分方程切入，发出“求解太麻烦”的真实问题。',
    duration: '5 min',
    pageType: 'quiz',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '拉氏变换动机：降维逻辑',
    hint: '把时域微分方程变成 s 域代数方程，建立本课主线。',
    duration: '5 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '拉氏变换定义与三条性质',
    hint: '重点打透微分定理，并做一次即时验证。',
    duration: '10 min',
    pageType: 'form',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '传递函数定义：零初始条件',
    hint: '澄清“为什么必须零初始条件”，避免只记公式不懂边界。',
    duration: '5 min',
    pageType: 'quiz',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '三步法演示：船舶航向系统',
    hint: '把方程、拉氏变换、提取公因子和求比值串成可复用套路。',
    duration: '5 min',
    pageType: 'display',
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '例题 1：RC 电路传递函数',
    hint: '用最典型的一阶惯性环节再走一次三步法。',
    duration: '5 min',
    pageType: 'display',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: 'AI 融入：手算与 AI 验证',
    hint: '先写下自己的零极点判断，再用页内 AI 对照，最后提交反思。',
    duration: '5 min',
    pageType: 'ai',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '传递函数标准形式',
    hint: '比较首一形式与尾一形式，明确各自阅读优势。',
    duration: '5 min',
    pageType: 'quiz',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '零极点与四个家族的精确对应',
    hint: '拖动极点，观察响应从单调到振荡、到临界、再到发散。',
    duration: '10 min',
    pageType: 'form',
    workspaceKind: 'pole-response',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '零点的定性作用',
    hint: '在固定极点下引入零点，观察零点如何压制或放大模态。',
    duration: '5 min',
    pageType: 'form',
    workspaceKind: 'zero-effect',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '典型环节：比例与积分',
    hint: '从函数形式读物理原型，用匹配题固定“积木块”认知。',
    duration: '5 min',
    pageType: 'form',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '典型环节：惯性与振荡',
    hint: '用参数滑块观察时间常数与阻尼比如何改变响应。',
    duration: '8 min',
    pageType: 'form',
    workspaceKind: 'element-slider',
  },
  {
    id: 'step-14',
    stage: 'P3',
    title: '例题 3：弹簧-质量-阻尼器综合',
    hint: '把物理方程、传递函数、标准形式和参数判读一次串起来。',
    duration: '8 min',
    pageType: 'form',
  },
] as const;

export function getUNIT_1_1Step(stepId: string) {
  return UNIT_1_1_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_1_1_LESSON_STEPS[0];
}

export function createEmptyUNIT_1_1StudentState(studentName: string): UNIT_1_1StudentCourseState {
  return {
    kind: 'unit11_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_1_1_PREMIUM_LESSON_CARD = {
  id: 'unit-1-1-laplace-transfer-function',
  title: UNIT_1_1_COURSE_TITLE,
  description: '精品互动课：把“降维、三步法、零极点、典型环节”四条主线收束到一个完整的数学精化课堂。',
  duration: '100 分钟',
  href: `/interactive-learning/courses/${UNIT_1_1_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_1_1_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-03': '/course-runtime/lessons/1-1/media/h-02-laplace-transform-flow.svg',
  'step-07': '/course-runtime/lessons/1-1/media/h-05-rc-circuit.svg',
  'step-10': '/course-runtime/lessons/1-1/media/h-03-pole-response-family.svg',
  'step-13': '/course-runtime/lessons/1-1/media/h-04-typical-elements.svg',
  'step-14': '/course-runtime/lessons/1-1/media/h-01-spring-mass-damper.svg',
};

export function getUNIT_1_1MediaSrc(stepId: string) {
  return UNIT_1_1_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_1_1StudentState(value: unknown): value is UNIT_1_1StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_1_1StudentCourseState>;
  return data.kind === 'unit11_student_state' && data.version === 1;
}

export function isUNIT_1_1TeacherSyncState(value: unknown): value is UNIT_1_1TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_1_1TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit11' && typeof data.activeStepId === 'string';
}

export const UNIT_1_1_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_1_1StudentCourseState,
  UNIT_1_1TeacherCourseSyncState,
  UNIT_1_1TeacherSyncInput
> = {
  lessonKey: UNIT_1_1_LESSON_KEY,
  studentItemId: UNIT_1_1_STUDENT_ITEM_ID,
  teacherItemId: UNIT_1_1_TEACHER_SYNC_ITEM_ID,
  studentStateKey: 'course',
  teacherStateKey: 'teacher-sync',
  createEmptyStudentState: createEmptyUNIT_1_1StudentState,
  isStudentState: isUNIT_1_1StudentState,
  isTeacherSyncState: isUNIT_1_1TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit11',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_1_1TeacherSync(input: UNIT_1_1TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_1_1TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_1_1TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_1_1TeacherSession(input: UNIT_1_1TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
