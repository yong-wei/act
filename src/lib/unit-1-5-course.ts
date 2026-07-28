import type { BopppsStage } from '@prisma/client';
import { finalizeInteractiveLessonSession } from '@/lib/data-governance/interactive-session-finalization';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type {
  InteractiveInteractionKind,
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_1_5StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_1_5TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_only'
  | 'teacher_direct';
export type UNIT_1_5PageType =
  | 'display'
  | 'summary'
  | 'quiz_group'
  | 'activity_cards'
  | 'interactive_figure_submit'
  | 'worked_example_reveal'
  | 'table_builder'
  | 'task_card_workspace';

export interface UNIT_1_5PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_1_5PageContract {
  layout: {
    template: string;
    regions: UNIT_1_5PageRegionContract[];
  };
  interactionKind: InteractiveInteractionKind;
  teacherControls: {
    releaseActivity: UNIT_1_5TeacherControlMode;
    openBrowse: UNIT_1_5TeacherControlMode;
    teacherStepReveal: UNIT_1_5TeacherControlMode;
    revealReferenceAnswer: UNIT_1_5TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiPageGoal: string;
  aiDeliveryMode?: string;
  previewDemoPath: string;
}

export interface UNIT_1_5StepDefinition {
  id: string;
  stage: UNIT_1_5StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_1_5PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_1_5StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_1_5StudentCourseState {
  kind: 'unit15_student_state';
  version: 1;
  studentName?: string;
  updatedAt: number;
  responses: Record<string, UNIT_1_5StepResponse>;
  responseHistory?: Record<string, UNIT_1_5StepResponse[]>;
  viewedStepIds: string[];
}

export const UNIT_1_5_RESPONSE_HISTORY_LIMIT = 12;

export interface UNIT_1_5TeacherCourseSyncState {
  kind: 'teacher_sync_unit15';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_1_5TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export const UNIT_1_5_ROUTE_SEGMENT = 'unit-1-5-three-domain-gain-sweep';
export const UNIT_1_5_PRESET_KEY = 'unit-1-5-three-domain-gain-sweep-v1';
export const UNIT_1_5_RESOURCE_KEY = UNIT_1_5_ROUTE_SEGMENT;
export const UNIT_1_5_LESSON_KEY = UNIT_1_5_PRESET_KEY;
export const UNIT_1_5_STUDENT_ITEM_ID = 'student:unit15:state';
export const UNIT_1_5_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_1_5_STUDENT_STATE_KEY = 'course';
export const UNIT_1_5_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_1_5_COURSE_TITLE = '1-5：三域联动——一个增益如何改变稳定性';
export const UNIT_1_5_COURSE_SUBTITLE = 'Three-Domain Gain Sweep';
export const UNIT_1_5_COURSE_DESCRIPTION =
  '围绕同一个比例增益，联读闭环极点、阶跃响应与环路稳定裕度，沿低增益、中增益、高增益和临界状态建立三域证据链。';

export const UNIT_1_5_STAGE_LABEL: Record<UNIT_1_5StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_1_5_STAGE_MAP: Record<UNIT_1_5StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

function pageTypeFromInteraction(stepId: string, interactionKind: string): UNIT_1_5PageType {
  if (interactionKind === 'none') return stepId === 'step-14' ? 'summary' : 'display';
  if (
    interactionKind === 'quiz_group' ||
    interactionKind === 'activity_cards' ||
    interactionKind === 'interactive_figure_submit' ||
    interactionKind === 'worked_example_reveal' ||
    interactionKind === 'table_builder' ||
    interactionKind === 'task_card_workspace'
  ) {
    return interactionKind;
  }
  return 'display';
}

const STEP_SOURCE = [
  ['step-01', 'B', '增益旋钮牵动的三组证据', '识别增益变化同时影响极点、阶跃过程和稳定裕度。', 'none', '5 min'],
  ['step-02', 'O', '课程目标', '明确四项课堂必达目标与一项课后拓展目标。', 'none', '4 min'],
  ['step-03', 'P1', '极点、反馈与读图基础前测', '检查极点、单位反馈和三域读图基础。', 'quiz_group', '6 min'],
  ['step-04', 'P2', '三域联动的共同对象与观察协议', '固定对象、通道、特征方程和四个观察区段。', 'none', '转场协议'],
  ['step-05', 'P2', '低增益区的稳定余量', '在低增益区建立首组三域证据。', 'interactive_figure_submit', '8 min'],
  ['step-06', 'P2', '中增益区的振荡与余量收缩', '比较固定低增益基线与当前中增益状态。', 'interactive_figure_submit', '8 min'],
  ['step-07', 'P2', '高增益区的缓慢衰减', '比较固定高增益基线与动态高增益状态。', 'interactive_figure_submit', '10 min'],
  ['step-08', 'P2', '临界增益与越界状态', '推导并验证临界增益以及越界后的三域状态。', 'interactive_figure_submit', '8 min'],
  ['step-09', 'P2', '增益扫描的三域对照', '扫描五个代表点并完成结构化三域对照表。', 'task_card_workspace', '18 min'],
  ['step-10', 'P2', '三域证据分工与三种速度', '区分直接证据、跨域解释和三种速度语言。', 'activity_cards', '4 min'],
  ['step-11', 'P2', '两组增益的失稳距离比较', '按复平面、时域、频域组织失稳距离证据。', 'worked_example_reveal', '4 min'],
  ['step-12', 'P2', '临界边界与换对象迁移', '课后使用 MATLAB/Octave 复现并迁移观察协议。', 'task_card_workspace', '课后选做'],
  ['step-13', 'P3', '三域联动能力后测', '检验状态判断、三域归位和速度分辨能力。', 'quiz_group', '8 min'],
  ['step-14', 'S', '一个增益的完整证据链', '总结课堂目标一至四，并单列目标五拓展进度。', 'none', '7 min'],
] as const;

export const UNIT_1_5_LESSON_STEPS: readonly UNIT_1_5StepDefinition[] = STEP_SOURCE.map(
  ([id, stage, title, hint, interactionKind, duration]) => ({
    id,
    stage,
    title,
    hint,
    duration,
    pageType: pageTypeFromInteraction(id, interactionKind),
  }),
) as readonly UNIT_1_5StepDefinition[];

export const UNIT_1_5_AI_PAGE_GOALS: Record<string, string> = Object.fromEntries(
  STEP_SOURCE.map(([id, , , hint]) => [id, hint]),
) as Record<string, string>;

function normalizeUNIT_1_5InteractionKind(kind: string): InteractiveInteractionKind {
  if (
    kind === 'quiz_group' ||
    kind === 'activity_cards' ||
    kind === 'interactive_figure_submit' ||
    kind === 'worked_example_reveal' ||
    kind === 'table_builder' ||
    kind === 'task_card_workspace'
  ) {
    return kind as InteractiveInteractionKind;
  }
  return 'none';
}

function pageContractFromManifestStep(step: InteractiveRuntimeStepManifest): UNIT_1_5PageContract {
  return {
    layout: step.layout,
    interactionKind: normalizeUNIT_1_5InteractionKind(step.interactionSpec.interactionKind),
    teacherControls: {
      releaseActivity: step.teacherControls.releaseActivity as UNIT_1_5TeacherControlMode,
      openBrowse: step.teacherControls.openBrowse as UNIT_1_5TeacherControlMode,
      teacherStepReveal: step.teacherControls.teacherStepReveal as UNIT_1_5TeacherControlMode,
      revealReferenceAnswer: step.teacherControls.revealReferenceAnswer as UNIT_1_5TeacherControlMode,
    },
    teacherInsightWidgets: step.teacherInsightSpec.widgets,
    telemetrySummaryFields: step.telemetrySpec.summaryFields,
    misconceptionTags: step.telemetrySpec.misconceptionTags,
    aiPageGoal: step.aiContextSpec.pageGoal,
    aiDeliveryMode: step.aiContextSpec.deliveryMode,
    previewDemoPath: step.previewContract.demoPath,
  };
}

export function getUNIT_1_5ManifestStepFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  if (!manifest) {
    throw new Error('1-5 runtime manifest is required for page rendering.');
  }
  return manifest.steps.find((step) => step.id === stepId) ?? manifest.steps[0];
}

export function getUNIT_1_5PageContractFromManifest(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return pageContractFromManifestStep(getUNIT_1_5ManifestStepFromManifest(manifest, stepId));
}

export function getUNIT_1_5Step(stepId: string) {
  return UNIT_1_5_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_1_5_LESSON_STEPS[0];
}

export function isUNIT_1_5InteractivePageType(pageType: UNIT_1_5PageType) {
  return pageType !== 'display' && pageType !== 'summary';
}

export function createEmptyUNIT_1_5StudentState(_studentName: string): UNIT_1_5StudentCourseState {
  return {
    kind: 'unit15_student_state',
    version: 1,
    updatedAt: Date.now(),
    responses: {},
    responseHistory: {},
    viewedStepIds: [],
  };
}

export function appendUNIT_1_5ResponseHistory(
  history: UNIT_1_5StudentCourseState['responseHistory'],
  response: UNIT_1_5StepResponse,
) {
  const current = history?.[response.stepId] ?? [];
  return {
    ...(history ?? {}),
    [response.stepId]: [...current, response].slice(-UNIT_1_5_RESPONSE_HISTORY_LIMIT),
  };
}

function percent(completed: number, total: number) {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function hasResponse(state: UNIT_1_5StudentCourseState, stepId: string) {
  return Boolean(state.responses[stepId]);
}

function responseCompletion(
  state: UNIT_1_5StudentCourseState,
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  const response = state.responses[stepId];
  if (!response) return { answered: 0, total: 0, status: 'none' as const };
  const cards = manifest?.steps.find((item) => item.id === stepId)?.interactionSpec.activityCards ?? [];
  if (cards.length === 0) return { answered: 1, total: 1, status: 'complete' as const };
  const answered = cards.filter((card) => String(response.answers?.[card.id] ?? '').trim()).length;
  return {
    answered,
    total: cards.length,
    status: answered >= cards.length ? 'complete' as const : 'partial' as const,
  };
}

function hasCompleteResponse(
  state: UNIT_1_5StudentCourseState,
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return responseCompletion(state, manifest, stepId).status === 'complete';
}

function quizResultSummary(
  state: UNIT_1_5StudentCourseState,
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  const step = manifest?.steps.find((item) => item.id === stepId);
  const cards = step?.interactionSpec.activityCards ?? [];
  const answers = state.responses[stepId]?.answers ?? {};
  const answered = cards.filter((card) => String(answers[card.id] ?? '').trim()).length;
  const exactCards = cards.filter((card) => card.responseKind === 'choice.single' || card.responseKind === 'choice.binary');
  const exactMatches = exactCards.filter((card) => String(answers[card.id] ?? '').trim() === String(card.referenceAnswer ?? '').trim()).length;
  if (!state.responses[stepId]) return '未提交';
  return `已作答 ${answered}/${cards.length} 题；可直接核对的客观选择 ${exactMatches}/${exactCards.length} 与参考答案一致`;
}

function compactAnswer(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 18 ? `${normalized.slice(0, 18)}…` : normalized;
}

function classAnswerDistribution(
  states: UNIT_1_5StudentCourseState[],
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  const step = manifest?.steps.find((item) => item.id === stepId);
  const cards = step?.interactionSpec.activityCards ?? [];
  const cardSummaries = cards.flatMap((card) => {
    const counts = new Map<string, number>();
    for (const state of states) {
      const answer = String(state.responses[stepId]?.answers?.[card.id] ?? '').trim();
      if (!answer) continue;
      const label = compactAnswer(answer);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    if (!counts.size) return [];
    return [`${card.title ?? card.id}：${Array.from(counts.entries()).map(([answer, count]) => `${answer}×${count}`).join('，')}`];
  });
  return cardSummaries.length ? cardSummaries.join('；') : '暂无作答数据';
}

function classMisconceptionSummary(
  states: UNIT_1_5StudentCourseState[],
  manifest: InteractiveRuntimeManifest | null | undefined,
) {
  const labels: Record<string, string> = {
    'pole-natural-response': '极点响应状态误判',
    'feedback-characteristic': '反馈特征方程误判',
    'near-critical-state': '近临界状态误判',
  };
  const counts = new Map<string, number>();
  for (const stepId of ['step-03', 'step-13']) {
    const cards = manifest?.steps.find((item) => item.id === stepId)?.interactionSpec.activityCards ?? [];
    for (const card of cards) {
      const label = labels[card.id];
      if (!label) continue;
      for (const state of states) {
        const answer = String(state.responses[stepId]?.answers?.[card.id] ?? '').trim();
        if (answer && answer !== String(card.referenceAnswer ?? '').trim()) counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
  }
  return counts.size
    ? Array.from(counts.entries()).map(([label, count]) => `${label}×${count}`).join('，')
    : '暂无可直接核对的客观误判';
}

export function buildUNIT_1_5StudentAnalyticsItems(
  state: UNIT_1_5StudentCourseState,
  manifest?: InteractiveRuntimeManifest | null,
) {
  const viewed = new Set(state.viewedStepIds ?? []).size;
  const completionStates = Object.keys(state.responses).map((stepId) => responseCompletion(state, manifest, stepId));
  const submitted = completionStates.filter((item) => item.status === 'complete').length;
  const partial = completionStates.filter((item) => item.status === 'partial').length;
  const objectiveEvidence = [
    ['目标1', ['step-05', 'step-06', 'step-07', 'step-08']],
    ['目标2', ['step-09', 'step-11']],
    ['目标3', ['step-10', 'step-13']],
    ['目标4', ['step-08', 'step-13']],
  ] as const;
  return [
    `个人浏览：${viewed}/${UNIT_1_5_LESSON_STEPS.length} 页；完整提交：${submitted} 个步骤；部分提交：${partial} 个步骤。`,
    `前测结果：${quizResultSummary(state, manifest, 'step-03')}。`,
    `后测结果：${quizResultSummary(state, manifest, 'step-13')}。`,
    ...objectiveEvidence.map(([label, steps]) => {
      const completed = steps.filter((stepId) => hasCompleteResponse(state, manifest, stepId)).length;
      return `${label}课堂证据完成度：${completed}/${steps.length}（${percent(completed, steps.length)}%）。`;
    }),
    `目标5课后分层/迁移进度：${responseCompletion(state, manifest, 'step-12').status === 'complete' ? '完整提交' : responseCompletion(state, manifest, 'step-12').status === 'partial' ? '部分提交' : '未提交'}（不计入课堂目标1—4分母）。`,
  ];
}

export function buildUNIT_1_5TeacherAnalyticsItems(
  states: UNIT_1_5StudentCourseState[],
  manifest?: InteractiveRuntimeManifest | null,
) {
  const total = states.length;
  if (total === 0) {
    return [
      '班级暂无学生记录，提交率、证据完成度和作答分布将在学生进入并提交后显示。',
      '目标5课后分层/迁移进度单列，不计入课堂目标1—4分母。',
    ];
  }
  const submissionRate = (stepId: string) => percent(
    states.filter((state) => hasCompleteResponse(state, manifest, stepId)).length,
    total,
  );
  const classroomEvidenceSteps = ['step-05', 'step-06', 'step-07', 'step-08', 'step-09', 'step-10', 'step-11', 'step-13'];
  const completedEvidence = states.reduce(
    (sum, state) => sum + classroomEvidenceSteps.filter((stepId) => hasCompleteResponse(state, manifest, stepId)).length,
    0,
  );
  return [
    `班级记录：${total} 人；前测完整提交率 ${submissionRate('step-03')}%；后测完整提交率 ${submissionRate('step-13')}%。`,
    `课堂目标1—4证据完成度：${percent(completedEvidence, total * classroomEvidenceSteps.length)}%（按已提交证据计，不称达成率）。`,
    `三域扫描表完整提交率 ${submissionRate('step-09')}%；临界判断完整提交率 ${submissionRate('step-08')}%。`,
    `前测班级作答分布：${classAnswerDistribution(states, manifest, 'step-03')}。`,
    `后测班级作答分布：${classAnswerDistribution(states, manifest, 'step-13')}。`,
    `误判标签聚合：${classMisconceptionSummary(states, manifest)}。`,
    `目标5课后分层/迁移完整提交率 ${submissionRate('step-12')}%（单列，不计入课堂目标1—4分母）。`,
  ];
}

function parseUNIT_1_5StructuredAnswer(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractUNIT_1_5ParameterSource(parsed: unknown): Record<string, unknown> | null {
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

export function buildUNIT_1_5ParameterSnapshots({
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
    const source = extractUNIT_1_5ParameterSource(parseUNIT_1_5StructuredAnswer(value));
    if (!source) continue;
    for (const field of submitFields) {
      const fieldValue = source[field];
      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') snapshots[field] = fieldValue;
    }
  }
  return Object.keys(snapshots).length ? snapshots : null;
}

export function buildUNIT_1_5SubmissionDataOverrides({
  stepManifest,
  structuredAnswer,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  structuredAnswer: Record<string, unknown> | null;
}) {
  const shouldSkipLearningFact = stepManifest.modules.some((module) => {
    const policy = module.payload.learningFactPolicy ?? module.payload.learning_fact_policy;
    return Boolean(policy && typeof policy === 'object' && !Array.isArray(policy)
      && (policy as Record<string, unknown>).skipLearningFact === true);
  });
  return {
    ...(structuredAnswer?.schemaVersion === 'control-workbench-evidence-v1'
      ? { controlWorkbenchEvidenceDraft: structuredAnswer }
      : {}),
    ...(shouldSkipLearningFact
      ? {
          skipLearningFact: true,
          learningFactPolicyStatus: 'deferred_server_validation',
          validationScope: 'engine_result_only',
        }
      : {}),
  };
}

export const UNIT_1_5_PREMIUM_LESSON_CARD = {
  id: UNIT_1_5_RESOURCE_KEY,
  title: UNIT_1_5_COURSE_TITLE,
  description: '精品互动课：围绕同一个比例增益，联读闭环极点、阶跃响应和环路稳定裕度，完成三域增益扫描。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_1_5_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function isUNIT_1_5StudentState(value: unknown): value is UNIT_1_5StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_1_5StudentCourseState>;
  return data.kind === 'unit15_student_state'
    && data.version === 1
    && (data.studentName === undefined || typeof data.studentName === 'string')
    && typeof data.updatedAt === 'number'
    && Boolean(data.responses && typeof data.responses === 'object' && !Array.isArray(data.responses))
    && Array.isArray(data.viewedStepIds)
    && data.viewedStepIds.every((stepId) => typeof stepId === 'string');
}

export function isUNIT_1_5TeacherSyncState(value: unknown): value is UNIT_1_5TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_1_5TeacherCourseSyncState>;
  const isBooleanMap = (candidate: unknown) => Boolean(
    candidate
    && typeof candidate === 'object'
    && !Array.isArray(candidate)
    && Object.values(candidate).every((item) => typeof item === 'boolean'),
  );
  const isNumberMap = (candidate: unknown) => Boolean(
    candidate
    && typeof candidate === 'object'
    && !Array.isArray(candidate)
    && Object.values(candidate).every((item) => typeof item === 'number' && Number.isFinite(item)),
  );
  return data.kind === 'teacher_sync_unit15'
    && typeof data.activeStepId === 'string'
    && UNIT_1_5_LESSON_STEPS.some((step) => step.id === data.activeStepId)
    && isBooleanMap(data.revealedAnswers)
    && isBooleanMap(data.releasedActivities)
    && isBooleanMap(data.browseEnabled)
    && isNumberMap(data.teacherRevealProgress)
    && typeof data.updatedAt === 'number'
    && Number.isFinite(data.updatedAt);
}

export const UNIT_1_5_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_1_5StudentCourseState,
  UNIT_1_5TeacherCourseSyncState,
  UNIT_1_5TeacherSyncInput
> = {
  lessonKey: UNIT_1_5_LESSON_KEY,
  studentItemId: UNIT_1_5_STUDENT_ITEM_ID,
  teacherItemId: UNIT_1_5_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_1_5_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_1_5_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_1_5StudentState,
  isStudentState: isUNIT_1_5StudentState,
  isTeacherSyncState: isUNIT_1_5TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit15',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_1_5TeacherSync(input: {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_1_5TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_1_5TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_1_5TeacherSession(input: {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}) {
  await finalizeInteractiveLessonSession({
    finishSession: input.finishSession,
    trackSessionFinalize: input.trackSessionFinalize,
    currentStepId: input.currentStepId,
    steps: UNIT_1_5_LESSON_STEPS,
  });
}
