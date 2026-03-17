import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type LSUMStageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type LSUMPageType = 'display' | 'quiz' | 'form' | 'ai' | 'summary';

export interface LSUMStepDefinition {
  id: string;
  stage: LSUMStageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: LSUMPageType;
  aiContext?: StepAIContext;
}

export interface LSUMStepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface LSUMStudentCourseState {
  kind: 'lsum_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, LSUMStepResponse>;
}

export interface LSUMTeacherCourseSyncState {
  kind: 'teacher_sync_lsum';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface LSUMTeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface LSUMTeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface LSUMTeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const LSUM_ROUTE_SEGMENT = 'lsum-design-feasible-domain';
export const LSUM_PRESET_KEY = 'lsum-design-feasible-domain-v1';
export const LSUM_RESOURCE_KEY = 'lsum-design-feasible-domain';
export const LSUM_LESSON_KEY = LSUM_PRESET_KEY;
export const LSUM_STUDENT_ITEM_ID = 'student:lsum:state';
export const LSUM_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const LSUM_STUDENT_STATE_KEY = 'course';
export const LSUM_TEACHER_STATE_KEY = 'teacher-sync';
export const LSUM_COURSE_TITLE = 'L-sum：设计可行域——让约束成为指南针';
export const LSUM_COURSE_SUBTITLE = 'Design Feasible Domain';
export const LSUM_COURSE_DESCRIPTION =
  '围绕复平面可行域、根轨迹可行弧段以及时域/频域投影，把“给性能找参数”的设计视角第一次完整搭起来。';

export const LSUM_STAGE_LABEL: Record<LSUMStageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const LSUM_STAGE_MAP: Record<LSUMStageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const LSUM_LESSON_STEPS: LSUMStepDefinition[] = [
  { id: 'step-01', stage: 'B', title: '回到地图：层0的最后一块拼图', hint: '先把 L-2a 到 L-2d 与本课的收束关系讲清楚。', duration: '3 min', pageType: 'display' },
  { id: 'step-02', stage: 'B', title: '验收单困境：从分析到设计的切换', hint: '用“验收单”把问题从给 K 看性能切到给性能找 K。', duration: '5 min', pageType: 'display' },
  { id: 'step-03', stage: 'O', title: '今天能学到什么', hint: '明确四条学习目标与层0收束定位。', duration: '3 min', pageType: 'display' },
  { id: 'step-04', stage: 'P1', title: '前测：你还记得多少？', hint: '检查阻尼比与根轨迹前置认知。', duration: '7 min', pageType: 'quiz' },
  { id: 'step-05', stage: 'P2', title: '工程任务发布：给你一张验收单', hint: '把船舶航向控制的性能要求固定成一张任务单。', duration: '5 min', pageType: 'display' },
  { id: 'step-06', stage: 'P2', title: '草图预测：极点应该落在哪里？', hint: '先让学生写下自己的可行域直觉。', duration: '5 min', pageType: 'form' },
  { id: 'step-07', stage: 'P2', title: '复平面可行域：两条约束线', hint: '画出阻尼比射线与实部垂线，建立扇形可行域。', duration: '10 min', pageType: 'display' },
  { id: 'step-08', stage: 'P2', title: '根轨迹可行弧段：K 的允许范围', hint: '把根轨迹叠加到可行域上，读出 K 的边界。', duration: '8 min', pageType: 'display' },
  { id: 'step-09', stage: 'P2', title: '三域投影：同一组 K 的三张面孔', hint: '把复平面、时域和频域三张图并到同一个设计视角里。', duration: '7 min', pageType: 'display' },
  { id: 'step-10', stage: 'P2', title: 'AI 融入点：约束收紧，可行域如何变？', hint: '让学生先判断，再用页内 AI 做对照。', duration: '5 min', pageType: 'ai' },
  { id: 'step-11', stage: 'P2', title: '例题1：读懂可行域边界', hint: '用固定二阶系统判断哪个约束真正“咬住”系统。', duration: '12 min', pageType: 'display' },
  { id: 'step-12', stage: 'P2', title: '工程结论：哪个约束“咬住”了系统？', hint: '把例题收束成工程判断语句。', duration: '3 min', pageType: 'display' },
  { id: 'step-13', stage: 'P3', title: '后测：巩固三个核心判断', hint: '检查实部垂线、可行极点判读与约束收紧推理。', duration: '10 min', pageType: 'quiz' },
  { id: 'step-14', stage: 'S', title: '层0收束：五条设计直觉', hint: '回收层0的五条设计型直觉。', duration: '5 min', pageType: 'summary' },
  { id: 'step-15', stage: 'S', title: '下节预告：直觉翻译成公式', hint: '把 L-sum 过渡到 1-1 数学精化。', duration: '2 min', pageType: 'display' },
] as const;

export function getLSUMStep(stepId: string) {
  return LSUM_LESSON_STEPS.find((step) => step.id === stepId) ?? LSUM_LESSON_STEPS[0];
}

export function createEmptyLSUMStudentState(studentName: string): LSUMStudentCourseState {
  return {
    kind: 'lsum_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const LSUM_PREMIUM_LESSON_CARD = {
  id: 'lsum-design-feasible-domain',
  title: LSUM_COURSE_TITLE,
  description: '精品互动课：用复平面可行域把根轨迹、时域与频域三张图真正串成一套设计语言。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${LSUM_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const LSUM_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-01': '/course-runtime/lessons/L-sum/media/cd-01-feasible-domain-overview.svg',
  'step-07': '/course-runtime/lessons/L-sum/media/sh-03-feasible-region-full.svg',
  'step-08': '/course-runtime/lessons/L-sum/media/h-04-root-locus-feasible-arc.svg',
  'step-09': '/course-runtime/lessons/L-sum/media/h-06-bode-feasible-band.svg',
  'step-11': '/course-runtime/lessons/L-sum/media/h-07-example1-root-locus.svg',
  'step-12': '/course-runtime/lessons/L-sum/media/h-08-feasible-region-comparison.svg',
  'step-13': '/course-runtime/lessons/L-sum/media/ic-09-posttest-complex-plane.svg',
};

export function getLSUMMediaSrc(stepId: string) {
  return LSUM_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isLSUMStudentState(value: unknown): value is LSUMStudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<LSUMStudentCourseState>;
  return data.kind === 'lsum_student_state' && data.version === 1;
}

export function isLSUMTeacherSyncState(value: unknown): value is LSUMTeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<LSUMTeacherCourseSyncState>;
  return data.kind === 'teacher_sync_lsum' && typeof data.activeStepId === 'string';
}

export const LSUM_SESSION_ADAPTER: LessonSessionAdapter<
  LSUMStudentCourseState,
  LSUMTeacherCourseSyncState,
  LSUMTeacherSyncInput
> = {
  lessonKey: LSUM_LESSON_KEY,
  studentItemId: LSUM_STUDENT_ITEM_ID,
  teacherItemId: LSUM_TEACHER_SYNC_ITEM_ID,
  studentStateKey: 'course',
  teacherStateKey: 'teacher-sync',
  createEmptyStudentState: createEmptyLSUMStudentState,
  isStudentState: isLSUMStudentState,
  isTeacherSyncState: isLSUMTeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_lsum',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostLSUMTeacherSync(input: LSUMTeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveLSUMTeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: LSUMTeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeLSUMTeacherSession(input: LSUMTeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
