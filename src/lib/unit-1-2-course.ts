import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_1_2StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_1_2PageType = 'display' | 'quiz' | 'form' | 'ai' | 'summary';
export type Unit12WorkspaceKind = 'pole-response' | 'zero-effect' | 'element-slider' | 'none';

export interface UNIT_1_2StepDefinition {
  id: string;
  stage: UNIT_1_2StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_1_2PageType;
  workspaceKind?: Unit12WorkspaceKind;
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
}

export interface UNIT_1_2TeacherCourseSyncState {
  kind: 'teacher_sync_unit12';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_1_2TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_1_2TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_1_2TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_1_2_ROUTE_SEGMENT = 'unit-1-2-block-diagram-simplification';
export const UNIT_1_2_PRESET_KEY = 'unit-1-2-block-diagram-simplification-v1';
export const UNIT_1_2_RESOURCE_KEY = 'unit-1-2-block-diagram-simplification';
export const UNIT_1_2_LESSON_KEY = UNIT_1_2_PRESET_KEY;
export const UNIT_1_2_STUDENT_ITEM_ID = 'student:unit12:state';
export const UNIT_1_2_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_1_2_STUDENT_STATE_KEY = 'course';
export const UNIT_1_2_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_1_2_COURSE_TITLE = '1-2：系统结构图与化简——从积木块到系统蓝图';
export const UNIT_1_2_COURSE_SUBTITLE = 'Block Diagram & Mason';
export const UNIT_1_2_COURSE_DESCRIPTION =
  '围绕结构图四元素、三种基本连接、等效变换、代数化简与梅森公式，学习如何把典型环节组装成完整系统蓝图并求出总传递函数。';

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

export const UNIT_1_2_LESSON_STEPS: UNIT_1_2StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图——知识图谱定位',
    hint: '从 1-1 的单环节传递函数回到 1-2 的系统组装视角。',
    duration: '3 min',
    pageType: 'display',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入——船舶航向控制系统的多环节连接',
    hint: '从工程照片切换到结构图，理解为什么需要图形语言来描述系统连接。',
    duration: '5 min',
    pageType: 'quiz',
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '结构图基本元素——四种图形语法',
    hint: '识别方框、信号线、比较点和引出点这四种基本元素。',
    duration: '5 min',
    pageType: 'display',
  },
  {
    id: 'step-04',
    stage: 'P2',
    title: '串联连接规则 + 即时练习',
    hint: '掌握串联相乘，并在三环节例子里完成等效传递函数。',
    duration: '6 min',
    pageType: 'form',
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '并联连接规则 + 即时练习',
    hint: '掌握并联相加，并在通分过程中保持分子分母表达正确。',
    duration: '5 min',
    pageType: 'form',
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '反馈连接规则——核心公式',
    hint: '掌握负反馈闭环传递函数、开环与闭环的差异，以及“负反馈分母加”。',
    duration: '8 min',
    pageType: 'display',
  },
  {
    id: 'step-07',
    stage: 'P1',
    title: '前测——简单结构图求传递函数',
    hint: '通过三道速测题确认串联、偏差信号和单位负反馈是否已经站稳。',
    duration: '5 min',
    pageType: 'quiz',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '等效变换六条规则 + 动画演示',
    hint: '理解为什么需要移动比较点和引出点，并掌握“逆流补乘、顺流补除”。',
    duration: '8 min',
    pageType: 'display',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '等效变换即时练习',
    hint: '在具体结构图中判断补乘还是补除，避免把比较点和引出点规则搞反。',
    duration: '5 min',
    pageType: 'form',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '代数化简法完整演示（例题2）',
    hint: '沿着“先内环、后串联、再外环”的策略，完整化简双环系统。',
    duration: '8 min',
    pageType: 'display',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '代数化简练习 + AI 验证',
    hint: '把例题 2 改成正反馈变形题，先手算，再用 AI 校核路径与稳定性判断。',
    duration: '12 min',
    pageType: 'ai',
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '信号流图概念',
    hint: '理解结构图如何映射成信号流图，为梅森公式做准备。',
    duration: '5 min',
    pageType: 'display',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '梅森增益公式讲解',
    hint: '读懂前向通路、回路、余因子和特征式四个关键词。',
    duration: '7 min',
    pageType: 'display',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '梅森公式应用（例题3）',
    hint: '在 5 节点信号流图上直接读取前向通路与回路，体验全局视角。',
    duration: '8 min',
    pageType: 'display',
  },
  {
    id: 'step-15',
    stage: 'P3',
    title: '后测——中等复杂度结构图限时化简',
    hint: '综合考查基本连接、等效变换、代数化简与梅森公式的初步应用。',
    duration: '10 min',
    pageType: 'form',
  },
  {
    id: 'step-16',
    stage: 'S',
    title: '思政融入——梅森的全局观',
    hint: '从梅森的工程方法回到“先见森林，再见树木”的课程理念。',
    duration: '2 min',
    pageType: 'display',
  },
  {
    id: 'step-17',
    stage: 'S',
    title: '总结与框架定位',
    hint: '用五个关键词收束本课，并把视角推进到下一课的时域响应分析。',
    duration: '3 min',
    pageType: 'summary',
  },
] as const;

export function getUNIT_1_2Step(stepId: string) {
  return UNIT_1_2_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_1_2_LESSON_STEPS[0];
}

export function createEmptyUNIT_1_2StudentState(studentName: string): UNIT_1_2StudentCourseState {
  return {
    kind: 'unit12_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_1_2_PREMIUM_LESSON_CARD = {
  id: 'unit-1-2-block-diagram-simplification',
  title: UNIT_1_2_COURSE_TITLE,
  description: '精品互动课：把典型环节从“单个积木块”推进到“系统蓝图”的组装与化简。',
  duration: '100 分钟',
  href: `/interactive-learning/courses/${UNIT_1_2_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_1_2_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/1-2/media/sh-02-ship-heading-control.svg',
  'step-03': '/course-runtime/lessons/1-2/media/sh-01-block-diagram-elements.svg',
  'step-08': '/course-runtime/lessons/1-2/media/sh-03-equivalent-transform-rules.svg',
  'step-12': '/course-runtime/lessons/1-2/media/sh-04-signal-flow-graph.svg',
};

export function getUNIT_1_2MediaSrc(stepId: string) {
  return UNIT_1_2_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_1_2StudentState(value: unknown): value is UNIT_1_2StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_1_2StudentCourseState>;
  return data.kind === 'unit12_student_state' && data.version === 1;
}

export function isUNIT_1_2TeacherSyncState(value: unknown): value is UNIT_1_2TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
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
  studentStateKey: 'course',
  teacherStateKey: 'teacher-sync',
  createEmptyStudentState: createEmptyUNIT_1_2StudentState,
  isStudentState: isUNIT_1_2StudentState,
  isTeacherSyncState: isUNIT_1_2TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit12',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_1_2TeacherSync(input: UNIT_1_2TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_1_2TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_1_2TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_1_2TeacherSession(input: UNIT_1_2TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
