import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type {
  InteractiveInteractionKind,
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_5_6StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_5_6TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct'
  | 'enabled';
export type UNIT_5_6PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'activity_card_set'
  | 'single_choice'
  | 'drag_match'
  | 'card_sort'
  | 'interactive_figure_submit'
  | 'teacher_reveal_only';

export interface UNIT_5_6PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_5_6PageContract {
  layout: {
    template: string;
    regions: UNIT_5_6PageRegionContract[];
  };
  interactionKind: InteractiveInteractionKind;
  teacherControls: {
    releaseActivity: UNIT_5_6TeacherControlMode;
    openBrowse: UNIT_5_6TeacherControlMode;
    teacherStepReveal: UNIT_5_6TeacherControlMode;
    revealReferenceAnswer: UNIT_5_6TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiPageGoal: string;
  aiDeliveryMode?: string;
  previewDemoPath: string;
}

export interface UNIT_5_6StepDefinition {
  id: string;
  stage: UNIT_5_6StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_5_6PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_5_6StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_5_6StudentCourseState {
  kind: 'unit56_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_5_6StepResponse>;
  viewedStepIds: string[];
  figureParameterSnapshots: Record<string, Record<string, string>>;
}

export interface UNIT_5_6TeacherCourseSyncState {
  kind: 'teacher_sync_unit56';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_5_6TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_5_6_ROUTE_SEGMENT = 'unit-5-6-method-comparison-cold-chain';
export const UNIT_5_6_PRESET_KEY = 'unit-5-6-method-comparison-cold-chain-v1';
export const UNIT_5_6_RESOURCE_KEY = UNIT_5_6_ROUTE_SEGMENT;
export const UNIT_5_6_LESSON_KEY = UNIT_5_6_PRESET_KEY;
export const UNIT_5_6_STUDENT_ITEM_ID = 'student:unit56:state';
export const UNIT_5_6_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_5_6_STUDENT_STATE_KEY = 'course';
export const UNIT_5_6_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_5_6_COURSE_TITLE = '5-6：方法迁移与前沿比较';
export const UNIT_5_6_COURSE_SUBTITLE = 'Method Comparison Cold Chain';
export const UNIT_5_6_COURSE_DESCRIPTION =
  '围绕同一冷链温控任务，比较经典 PI/PID、数据驱动预测补偿和策略学习监督层的收益、风险与验证责任。';

export const UNIT_5_6_STAGE_LABEL: Record<UNIT_5_6StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: '前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_5_6_STAGE_MAP: Record<UNIT_5_6StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function pageTypeFromInteraction(stepId: string, interactionKind: string): UNIT_5_6PageType {
  if (interactionKind === 'none') return stepId === 'step-18' ? 'summary' : 'display';
  if (
    interactionKind === 'quiz_group' ||
    interactionKind === 'activity_card_set' ||
    interactionKind === 'single_choice' ||
    interactionKind === 'drag_match' ||
    interactionKind === 'card_sort' ||
    interactionKind === 'interactive_figure_submit' ||
    interactionKind === 'teacher_reveal_only'
  ) {
    return interactionKind as UNIT_5_6PageType;
  }
  return 'display';
}

const STEP_SOURCE = [
  ['step-01', 'B', '冷链方法选择压力的导入场景', '从冷链仓库同题比较进入经典、预测补偿和策略监督层的路线选择压力。', 'none'],
  ['step-02', 'O', '本次课程目标', '呈现冷链同题比较、热模型、三路线和方法选择说明卡目标。', 'none'],
  ['step-03', 'P1', '前置基础快测', '本页考察快慢状态判断、执行限幅理解和多指标读表能力。', 'quiz_group'],
  ['step-04', 'P2', '冷链温控同题任务与约束证据', '生物制剂冷藏仓在集中入库和开门扰动下同时存在空气温度快速波动与货品核心温度慢热风险。本页固定同一个对象、温区、压缩机执行边界、扰动日志和评价指标，再把经典 PI/PID、预测补偿和策略监督层放入同一任务中比较。', 'activity_card_set'],
  ['step-05', 'P2', '二状态热模型与实验场景', '用二状态热模型和三场景表建立同题比较对象。', 'activity_card_set'],
  ['step-06', 'P2', '经典 PI/PID 冷链基线', '展开经典 PI/PID 的误差、限幅和抗饱和证据。', 'teacher_reveal_only'],
  ['step-07', 'P2', '热负荷预测补偿路线', '说明预测补偿只补足热负荷预判，不替代底层控制责任。', 'activity_card_set'],
  ['step-08', 'P2', '策略学习监督层调度边界', '限定策略学习为上层模式调度，保留底层 PI/PID 和安全壳。', 'drag_match'],
  ['step-09', 'P2', '同题实验数据与指标口径', '固定三场景同题实验的执行顺序、指标口径和比较责任。', 'activity_card_set'],
  ['step-10', 'P2', '常规日与经典控制优先判断', '判断常规日中经典路线足够时不应为了方法新而升级。', 'single_choice'],
  ['step-11', 'P2', '入库高峰与预测补偿收益判断', '读 E2 三路线图，判断预测补偿组合路线的收益与边界。', 'interactive_figure_submit'],
  ['step-12', 'P2', '未见扰动与覆盖风险判断', '用 E3 结果判断策略监督层和预测补偿在未见扰动下的验证压力。', 'activity_card_set'],
  ['step-13', 'P2', '路线选择的证据结构', '把收益、风险、验证路径和回退条件组织成路线选择证据结构。', 'activity_card_set'],
  ['step-14', 'P2', '方法选择说明卡工作区', '撰写方法选择说明卡并说明暂不采用其他路线的依据。', 'activity_card_set'],
  ['step-15', 'P2', '分层实践与评审陈述', '排序方法选择说明卡中的证据表达顺序，形成评审陈述。', 'card_sort'],
  ['step-16', 'P2', '边界情况与常见误判', '匹配冷链方法迁移中的边界情况和常见误判。', 'drag_match'],
  ['step-17', 'P3', '后测：方法迁移与证据责任判断', '检查冷链同题比较、路线收益和证据责任判断。', 'quiz_group'],
  ['step-18', 'S', '总结：同题比较的方法选择证据', '总结冷链三路线比较的收益、边界和证据责任。', 'none'],
] as const;

export const UNIT_5_6_LESSON_STEPS: readonly UNIT_5_6StepDefinition[] = STEP_SOURCE.map(
  ([id, stage, title, hint, interactionKind]) => ({
    id,
    stage,
    title,
    hint,
    duration: '5 min',
    pageType: pageTypeFromInteraction(id, interactionKind),
  }),
) as readonly UNIT_5_6StepDefinition[];

export const UNIT_5_6_AI_PAGE_GOALS: Record<string, string> = Object.fromEntries(
  STEP_SOURCE.map(([id, , , hint]) => [id, hint]),
) as Record<string, string>;

function normalizeUNIT_5_6InteractionKind(kind: string): InteractiveInteractionKind {
  if (
    kind === 'quiz_group' ||
    kind === 'activity_card_set' ||
    kind === 'single_choice' ||
    kind === 'drag_match' ||
    kind === 'card_sort' ||
    kind === 'interactive_figure_submit' ||
    kind === 'teacher_reveal_only'
  ) {
    return kind as InteractiveInteractionKind;
  }
  return 'none';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_5_6PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_5_6InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_5_6TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_5_6TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_5_6TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_5_6TeacherControlMode,
    },
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    aiPageGoal: step.aiContextSpec.pageGoal,
    aiDeliveryMode: step.aiContextSpec.deliveryMode,
    previewDemoPath: step.previewContract.demoPath,
  };
}

export function getUNIT_5_6ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('5-6 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_5_6PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_5_6ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_5_6Step(stepId: string) {
  return UNIT_5_6_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_5_6_LESSON_STEPS[0];
}

export function isUNIT_5_6InteractivePageType(pageType: UNIT_5_6PageType) {
  return pageType !== 'display' && pageType !== 'summary';
}

export function createEmptyUNIT_5_6StudentState(studentName: string): UNIT_5_6StudentCourseState {
  return {
    kind: 'unit56_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
    viewedStepIds: [],
    figureParameterSnapshots: {},
  };
}

export const UNIT_5_6_PREMIUM_LESSON_CARD = {
  id: UNIT_5_6_RESOURCE_KEY,
  title: UNIT_5_6_COURSE_TITLE,
  description: '精品互动课：围绕冷链温控同题任务，训练经典控制、预测补偿和策略监督层的方法选择证据判断。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_5_6_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_5_6StudentState(value: unknown): value is UNIT_5_6StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_6StudentCourseState>;
  return data.kind === 'unit56_student_state' && data.version === 1;
}

export function isUNIT_5_6TeacherSyncState(value: unknown): value is UNIT_5_6TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_5_6TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit56' && typeof data.activeStepId === 'string';
}

export const UNIT_5_6_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_5_6StudentCourseState,
  UNIT_5_6TeacherCourseSyncState,
  UNIT_5_6TeacherSyncInput
> = {
  lessonKey: UNIT_5_6_LESSON_KEY,
  studentItemId: UNIT_5_6_STUDENT_ITEM_ID,
  teacherItemId: UNIT_5_6_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_5_6_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_5_6_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_5_6StudentState,
  isStudentState: isUNIT_5_6StudentState,
  isTeacherSyncState: isUNIT_5_6TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit56',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_5_6TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_5_6TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_5_6TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_5_6TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_5_6_LESSON_STEPS,
  });
}
