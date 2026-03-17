import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';

export type L2DStageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type L2DPageType = 'display' | 'quiz' | 'workspace' | 'reflection' | 'summary';
export type L2DTone = 'cyan' | 'sky' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate' | 'orange';

export interface L2DChoiceOption {
  value: string;
  label: string;
}

export interface L2DQuestion {
  key: string;
  prompt: string;
  type: 'single' | 'text';
  placeholder?: string;
  options?: L2DChoiceOption[];
  answer?: string;
}

export interface L2DSection {
  title: string;
  tone?: L2DTone;
  body?: string;
  bullets?: string[];
}

export interface L2DActivity {
  kind: 'none' | 'quiz' | 'taskOne' | 'taskTwo' | 'reflection' | 'postRange';
  helper?: string;
  submitLabel?: string;
  questions?: L2DQuestion[];
}

export interface L2DContentBlock {
  kicker: string;
  title: string;
  intro: string;
  sections: L2DSection[];
  controls?: string[];
  activity?: L2DActivity;
}

export interface L2DStepDefinition {
  id: string;
  stage: L2DStageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: L2DPageType;
  observationId?: 'OBS-PRE' | 'OBS-01' | 'OBS-02' | 'OBS-03' | 'OBS-POST' | null;
  teacher: L2DContentBlock;
  student: L2DContentBlock;
}

export interface L2DTaskOneSubmission {
  kCritical: number;
  gammaApprox: string;
  observation: string;
  score: number;
  feedback: string;
  submittedAt: number;
}

export interface L2DTaskTwoRowSubmission {
  rowId: string;
  k: number;
  sigma: number;
  omega: number;
  mp: number;
  ts: number;
  gamma: number;
  score: number;
  checks: Array<{ label: string; score: number; feedback?: string }>;
  feedback: string[];
  submittedAt: number;
}

export interface L2DReflectionSubmission {
  surpriseText: string;
  selectedOption: 'A' | 'B' | '';
  answerText: string;
  score: number;
  feedback: string[];
  submittedAt: number;
}

export interface L2DPostAssessmentSubmission {
  lowerBound: string;
  upperBound: string;
  submittedAt: number;
}

export interface L2DQuizSubmission {
  answers: Record<string, string>;
  submittedAt: number;
}

export interface L2DStudentCourseState {
  kind: 'l2d_student_state';
  version: 1;
  studentName: string;
  preAssessment?: L2DQuizSubmission;
  taskOne?: L2DTaskOneSubmission;
  taskTwoRows: Record<string, L2DTaskTwoRowSubmission>;
  reflection?: L2DReflectionSubmission;
  postAssessment?: L2DPostAssessmentSubmission;
  updatedAt: number;
}

export interface L2DTeacherSyncState {
  kind: 'teacher_sync_l2d';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  updatedAt: number;
}

export interface L2DTeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface L2DStudentFrozenSummaryResult {
  courseState?: L2DStudentCourseState | null;
}

export interface L2DTeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface L2DTeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

const EMPTY_ACTIVITY: L2DActivity = { kind: 'none' };

function createStep(config: {
  id: string;
  stage: L2DStageCode;
  title: string;
  duration: string;
  hint: string;
  intro: string;
  studentIntro?: string;
  sections: L2DSection[];
  controls?: string[];
  pageType?: L2DPageType;
  observationId?: 'OBS-PRE' | 'OBS-01' | 'OBS-02' | 'OBS-03' | 'OBS-POST' | null;
  studentActivity?: L2DActivity;
}): L2DStepDefinition {
  return {
    id: config.id,
    stage: config.stage,
    title: config.title,
    hint: config.hint,
    duration: config.duration,
    pageType: config.pageType ?? 'display',
    observationId: config.observationId ?? null,
    teacher: {
      kicker: `${config.stage} · ${config.duration}`,
      title: config.title,
      intro: config.intro,
      sections: config.sections,
      controls: config.controls,
      activity: EMPTY_ACTIVITY,
    },
    student: {
      kicker: `${config.stage} · ${config.duration}`,
      title: config.title,
      intro: config.studentIntro ?? config.intro,
      sections: config.sections,
      activity: config.studentActivity ?? EMPTY_ACTIVITY,
    },
  };
}

export const L2D_ROUTE_SEGMENT = 'l2d-three-domain-linkage-practice';
export const L2D_PRESET_KEY = 'l2d-three-domain-linkage-practice-v1';
export const L2D_RESOURCE_KEY = 'l2d-three-domain-linkage-practice';
export const L2D_LESSON_KEY = L2D_PRESET_KEY;
export const L2D_STUDENT_ITEM_ID = 'student:l2d:state';
export const L2D_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const L2D_STUDENT_STATE_KEY = 'course';
export const L2D_TEACHER_STATE_KEY = 'teacher-sync';
export const L2D_COURSE_TITLE = 'L-2d：三域联动探索 · 平台操作初体验';
export const L2D_COURSE_SUBTITLE = 'Three-Domain Practice Studio';
export const L2D_COURSE_DESCRIPTION =
  '围绕固定三阶系统 G(s)=K/[s(s+1)(s+6)]，在根轨迹、时域和频域三张图中同步拨动增益 K，完成临界增益定位、三域对照表与反思写作。';

export const L2D_STAGE_LABEL: Record<L2DStageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const L2D_STAGE_TONE_CLASS: Record<L2DStageCode, string> = {
  B: 'premium-tone-sky',
  O: 'premium-tone-emerald',
  P1: 'premium-tone-amber',
  P2: 'premium-tone-cyan',
  P3: 'premium-tone-orange',
  S: 'premium-tone-violet',
};

export const L2D_STAGE_MAP: Record<L2DStageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const L2D_SYSTEM_SPEC = {
  poles: [
    { re: 0, im: 0 },
    { re: -1, im: 0 },
    { re: -6, im: 0 },
  ],
  zeros: [] as Array<{ re: number; im: number }>,
  kRange: { min: 0.01, max: 80 },
  criticalGain: 42,
  rootLocusPoints: 120,
  frequencyRange: { min: 0.05, max: 120, points: 180 },
  timeRange: { start: 0, end: 25, step: 0.05 },
};

export const L2D_PRE_ASSESSMENT_QUESTIONS: L2DQuestion[] = [
  {
    key: 'q1',
    prompt: '对于 G(s)=K/[s(s+1)(s+6)]，将 K 从 1 增大到 10，根轨迹上的闭环共轭极点对会：',
    type: 'single',
    options: [
      { value: 'A', label: '向左移动（实部更负）' },
      { value: 'B', label: '向右移动（实部趋向零或正值）' },
      { value: 'C', label: '沿虚轴移动（实部不变）' },
    ],
    answer: 'B',
  },
  {
    key: 'q2',
    prompt: 'K 增大时，时域阶跃响应的超调量 Mp 会：',
    type: 'single',
    options: [
      { value: 'A', label: '变大' },
      { value: 'B', label: '变小' },
      { value: 'C', label: '基本不变' },
    ],
    answer: 'A',
  },
  {
    key: 'q3',
    prompt: 'K 增大时，Bode 图中哪条曲线会发生明显变化？',
    type: 'single',
    options: [
      { value: 'A', label: '幅频曲线整体上移，相频曲线不变' },
      { value: 'B', label: '相频曲线整体下移，幅频曲线不变' },
      { value: 'C', label: '两条曲线都明显变化' },
    ],
    answer: 'A',
  },
];

export const L2D_TASK_TWO_ROWS = ['row-1', 'row-2', 'row-3', 'row-4'] as const;

export const L2D_LESSON_STEPS: L2DStepDefinition[] = [
  createStep({
    id: 'step-01',
    stage: 'B',
    title: '图谱定位：我们在哪里',
    duration: '2 min',
    hint: '回到层0地图，把 L-2a/L-2b/L-2c 与本课的实践节点连起来。',
    intro: '过去三节速通课分别给了你时域、根轨迹与频域的直觉。今天不是学新图，而是把三张图同时打开，亲手拨动一个参数，看三域一起响应。',
    sections: [
      {
        title: '当前节点',
        tone: 'sky',
        bullets: ['L-2a：时域直觉', 'L-2b：根轨迹直觉', 'L-2c：频域直觉', 'L-2d：三域联动操作体验（本节）', 'L-sum：设计可行域初探（下一节）'],
      },
    ],
  }),
  createStep({
    id: 'step-02',
    stage: 'B',
    title: '今天的研究对象',
    duration: '3 min',
    hint: '只保留一个旋钮 K，把注意力集中到极点、响应和裕度的联动上。',
    intro: '今天的系统是 G(s)=K/[s(s+1)(s+6)]。三个开环极点、无零点，唯一操作变量是增益 K。',
    sections: [
      {
        title: '为什么选它',
        tone: 'cyan',
        bullets: ['三条根轨迹分支，刚好够复杂', '增益过大一定会失稳，边界摸得着', '无零点，先看最纯净的“极点 ↔ 三域”因果链'],
      },
      {
        title: '工程背景',
        tone: 'slate',
        body: '这类三阶结构很像“舵机动力学 × 航向积分 × 传感器滤波”的串联结构，你今天调的 K 就是控制器比例增益。',
      },
    ],
  }),
  createStep({
    id: 'step-03',
    stage: 'O',
    title: '今日目标与评分规则',
    duration: '3 min',
    hint: '本课强调即时反馈与可重提，鼓励先提交再修正。',
    intro: '完成本次探索后，你要能识别稳定边界、建立三域对照表，并写出一个让自己意外的联动现象。',
    sections: [
      {
        title: '学习目标',
        tone: 'emerald',
        bullets: [
          '识别根轨迹上的稳定区域与不稳定区域',
          '判断 K 增大时 Mp、ts 和 γ 的联动方向',
          '记录典型 K 值下的三域指标，形成个人对照表',
          '发现至少一个让自己意外的三域联动现象',
        ],
      },
      {
        title: '评分结构',
        tone: 'amber',
        bullets: ['任务一：临界 K（30 分）', '任务二：四行三域对照表（40 分）', '任务三：发现与反思（30 分）', '总分 100，任务一和任务二可重做取最高'],
      },
    ],
  }),
  createStep({
    id: 'step-04',
    stage: 'P1',
    title: '前测：你的直觉预测',
    duration: '5 min',
    hint: '先写下直觉，不需要计算；课后会回看你现在的判断。',
    intro: '操作开始前，先记录三道选择题的直觉判断。教师端只看分布，不主动公布答案。',
    sections: [
      {
        title: 'OBS-PRE',
        tone: 'amber',
        body: '三道题都不计分，只作为操作前后的认知对照。教师端显示匿名统计，并可按平台规范手动揭示正确答案。',
      },
    ],
    pageType: 'quiz',
    observationId: 'OBS-PRE',
    studentActivity: {
      kind: 'quiz',
      helper: '提交后会显示“已记录你的预测，操作结束后我们一起对比。”',
      submitLabel: '提交前测',
      questions: L2D_PRE_ASSESSMENT_QUESTIONS,
    },
  }),
  createStep({
    id: 'step-05',
    stage: 'P2',
    title: '操作引入：认识工作区',
    duration: '5 min',
    hint: '左边看根轨迹，右上看时域，右下看 Bode；一个 K 带动三张图。',
    intro: '打开三面板工作区。你既可以拖动根轨迹上的蓝色极点，也可以使用 K 滑块；两种方式的效果完全相同。',
    sections: [
      {
        title: '工作区结构',
        tone: 'cyan',
        bullets: ['左：根轨迹面板，蓝点是当前 K 的闭环极点', '右上：阶跃响应曲线，标注 Mp 和 ts', '右下：Bode 图，标注相位裕度 γ'],
      },
      {
        title: '演示动作',
        tone: 'slate',
        bullets: ['先把 K 调到 5 观察方向', '再把 K 调到 20 感受变化速度', '最后尝试直接在根轨迹上拖动蓝点，确认 K 联动更新'],
      },
    ],
    pageType: 'workspace',
  }),
  createStep({
    id: 'step-06',
    stage: 'P2',
    title: '任务一说明',
    duration: '1 min',
    hint: '目标是找到闭环系统“刚好失稳”的那一刻。',
    intro: '你的目标是找到使闭环系统从稳定变为不稳定的临界 K 值，允许多次提交，系统取最高分。',
    sections: [
      {
        title: '判断方法',
        tone: 'orange',
        bullets: ['根轨迹：共轭极点实部从负变正的瞬间', '时域：响应从收敛振荡变为等幅/发散振荡', '频域：相位裕度 γ 趋近 0°'],
      },
    ],
  }),
  createStep({
    id: 'step-07',
    stage: 'P2',
    title: '任务一：找到稳定边界',
    duration: '19 min',
    hint: '缓慢增大 K，观察何时出现“等幅振荡 / γ≈0° / 极点到虚轴”。',
    intro: '在工作区里缓慢增大 K，找到系统刚好失稳的临界点。记录 K 值后提交，系统即时反馈。',
    sections: [
      {
        title: 'OBS-01',
        tone: 'orange',
        body: '理论临界值 Kcr = 42。提交后按 [36,48] / [28,36)∪(48,56] / 其他 三档计分。',
      },
    ],
    pageType: 'workspace',
    observationId: 'OBS-01',
    studentActivity: {
      kind: 'taskOne',
      helper: '支持反复提交，系统保留最高分。',
      submitLabel: '提交任务一',
    },
  }),
  createStep({
    id: 'step-08',
    stage: 'P2',
    title: '任务一汇总',
    duration: '3 min',
    hint: '把全班实验值和理论临界值 42 对齐。',
    intro: '教师端展示全班提交的 K 值分布，再揭示理论临界值 Kcr = 42，把实验直觉和后续劳斯判据衔接起来。',
    sections: [
      {
        title: '承诺兑现',
        tone: 'violet',
        body: '特征方程 s^3 + 7s^2 + 6s + K = 0，在劳斯表中满足 7×6−K = 0，因此临界值恰好是 42。完整推导放到单元 2-1。',
      },
    ],
  }),
  createStep({
    id: 'step-09',
    stage: 'P2',
    title: '任务二说明',
    duration: '1 min',
    hint: '在稳定范围内选 4 个 K 值，逐行建立三域对照表。',
    intro: '在稳定范围内（K < 42）选取 4 个不同的 K 值，逐一记录闭环主极点、Mp、ts 与 γ。',
    sections: [
      {
        title: '读取建议',
        tone: 'cyan',
        bullets: ['选取差距明显的 K 值，如 1 / 5 / 15 / 35', '先在工作区稳定读数，再填写该行', '每行都可以重填，系统对每行取最高分'],
      },
    ],
  }),
  createStep({
    id: 'step-10',
    stage: 'P2',
    title: '任务二：建立三域对照表',
    duration: '25 min',
    hint: '对照表检验的是内部一致性，而不是“抄标准答案”。',
    intro: '每行要填写 K、σ、ω、Mp、ts、γ。系统会按极点-时域、极点-超调、Mp-γ 三项一致性即时评分。',
    sections: [
      {
        title: 'OBS-02',
        tone: 'cyan',
        body: '每行满分 10 分：A 极点与 ts 一致性 4 分，B 极点与 Mp 一致性 4 分，C Mp 与 γ 方向一致性 2 分。',
      },
    ],
    pageType: 'workspace',
    observationId: 'OBS-02',
    studentActivity: {
      kind: 'taskTwo',
      helper: '每行独立评分，允许重填并取最高分。',
    },
  }),
  createStep({
    id: 'step-11',
    stage: 'P2',
    title: '任务三：自由探索',
    duration: '5 min',
    hint: '自由拨动 K，先找一个真正让你意外的现象。',
    intro: '工作区完全开放，自由探索 5 分钟，不需要提交数据，只需要为下一页反思积累一个你觉得有意思的现象。',
    sections: [
      {
        title: '推荐方向',
        tone: 'slate',
        bullets: ['K 很小时与 K 接近临界时，三域各有什么对比？', '根轨迹上有没有意外的转折点？', '为什么 K 变化时幅频整体上移，而相频曲线几乎不动？'],
      },
    ],
    pageType: 'workspace',
  }),
  createStep({
    id: 'step-12',
    stage: 'P2',
    title: '任务三：发现与反思',
    duration: '12 min',
    hint: '这里不需要“标准答案”，需要你自己的观察与解释。',
    intro: '先写一个让你意外的现象，再任选 A 或 B 做进一步反思。提交后即时给出 20 / 30 分。',
    sections: [
      {
        title: 'OBS-03',
        tone: 'violet',
        bullets: ['必答：描述一个观察到的现象（至少一句话，20 分）', '选答 A：一句话总结 Mp 与 γ 的关系', '选答 B：用对照表数据验证 γ≈100ζ° 是否近似成立'],
      },
    ],
    pageType: 'reflection',
    observationId: 'OBS-03',
    studentActivity: {
      kind: 'reflection',
      helper: '课后教师端会基于全班文本生成汇总评语，但即时得分只按填写情况给出。',
      submitLabel: '提交反思',
    },
  }),
  createStep({
    id: 'step-13',
    stage: 'P3',
    title: '后测：对照表能告诉我们什么',
    duration: '5 min',
    hint: '把对照表从“记录”变成“推断工具”，为 L-sum 做预热。',
    intro: '根据你今天建立的对照表，填写一个你认为能让 Mp < 20% 的 K 值区间。本题不计分，只作为下节课的预习起点。',
    sections: [
      {
        title: 'OBS-POST',
        tone: 'amber',
        body: '教师端收集全班区间分布，用来判断大家对“性能约束区间”的直觉起点。',
      },
    ],
    pageType: 'quiz',
    observationId: 'OBS-POST',
    studentActivity: {
      kind: 'postRange',
      helper: '不计分，只做下节课前的预习思考。',
      submitLabel: '提交后测区间',
    },
  }),
  createStep({
    id: 'step-14',
    stage: 'S',
    title: '总结：三域地图初探',
    duration: '7 min',
    hint: '把“一个 K 带动三域”这件事收束为下一课的约束地图。',
    intro: '今天的收获不是一个孤立数值，而是一张可以继续扩展的三域地图：K 增大时，极点右移、Mp 增大、γ 减小，直到临界增益 42。',
    sections: [
      {
        title: '今天的地图',
        tone: 'violet',
        bullets: ['K 增大 → 极点右移 → Mp 增大 → γ 减小', 'K = 42 → 极点到虚轴 → 等幅振荡 → γ = 0°', 'K > 42 → 极点进入右半平面 → 发散'],
      },
      {
        title: '下节课连接',
        tone: 'sky',
        body: 'L-sum 会在这张地图上画约束边界：同时满足 Mp < 20% 且 ts < 8s 的极点应该落在哪里？',
      },
    ],
    pageType: 'summary',
  }),
];

export const L2D_STEP_DURATION = Object.fromEntries(
  L2D_LESSON_STEPS.map((step) => [step.id, step.duration]),
) as Record<string, string>;

export function createEmptyL2DStudentState(studentName: string): L2DStudentCourseState {
  return {
    kind: 'l2d_student_state',
    version: 1,
    studentName,
    taskTwoRows: {},
    updatedAt: Date.now(),
  };
}

export function isL2DStudentState(value: unknown): value is L2DStudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<L2DStudentCourseState>;
  return data.kind === 'l2d_student_state' && data.version === 1;
}

export function isL2DTeacherSyncState(value: unknown): value is L2DTeacherSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<L2DTeacherSyncState>;
  return data.kind === 'teacher_sync_l2d' && typeof data.activeStepId === 'string';
}

export const L2D_SESSION_ADAPTER: LessonSessionAdapter<
  L2DStudentCourseState,
  L2DTeacherSyncState,
  L2DTeacherSyncInput
> = {
  lessonKey: L2D_LESSON_KEY,
  studentItemId: L2D_STUDENT_ITEM_ID,
  teacherItemId: L2D_TEACHER_SYNC_ITEM_ID,
  studentStateKey: 'course',
  teacherStateKey: 'teacher-sync',
  createEmptyStudentState: createEmptyL2DStudentState,
  isStudentState: isL2DStudentState,
  isTeacherSyncState: isL2DTeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_l2d',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function buildL2DAttemptKey(input: {
  stepId: string;
  submissionKey: string;
  submittedAt?: number;
}) {
  return `${input.stepId}:${input.submissionKey}:${input.submittedAt ?? Date.now()}`;
}

export function resolveL2DStudentSummaryCourseState(input: {
  frozenSummary?: L2DStudentFrozenSummaryResult | null;
  fallbackState: L2DStudentCourseState;
}) {
  return input.frozenSummary?.courseState ?? input.fallbackState;
}

export function shouldPostL2DTeacherSync(input: L2DTeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveL2DTeacherRevealedAnswers(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  teacherSyncState: L2DTeacherSyncState | null;
}) {
  return input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {};
}

export async function finalizeL2DTeacherSession(input: L2DTeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}

export function getL2DStep(stepId: string) {
  return L2D_LESSON_STEPS.find((step) => step.id === stepId) ?? L2D_LESSON_STEPS[0];
}

export function scoreTaskOne(kCriticalInput: number) {
  const kCritical = Number.isFinite(kCriticalInput) ? kCriticalInput : 0;
  if (kCritical >= 36 && kCritical <= 48) {
    return {
      score: 30,
      feedback: '找到了！这就是临界增益附近。注意此时时域接近等幅振荡，相位裕度 γ ≈ 0°。',
    };
  }
  if ((kCritical >= 28 && kCritical < 36) || (kCritical > 48 && kCritical <= 56)) {
    return {
      score: 15,
      feedback: '方向正确，但还可以更精确。等幅振荡的那一刻就是临界点。',
    };
  }
  return {
    score: 0,
    feedback: kCritical < L2D_SYSTEM_SPEC.criticalGain ? '这个 K 值还偏小，继续增大 K 接近临界边界。' : '这个 K 值已经偏大，系统越过了临界边界，回退一点再找。',
  };
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function computeZeta(sigma: number, omega: number) {
  const numerator = Math.abs(sigma);
  const denominator = Math.sqrt(sigma * sigma + omega * omega);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return 1;
  }
  return numerator / denominator;
}

function computeExpectedMp(zeta: number) {
  if (zeta >= 1) {
    return 0;
  }
  const denominator = Math.sqrt(Math.max(1 - zeta * zeta, 1e-6));
  return 100 * Math.exp((-Math.PI * zeta) / denominator);
}

export function scoreTaskTwoRow(
  row: Pick<L2DTaskTwoRowSubmission, 'rowId' | 'k' | 'sigma' | 'omega' | 'mp' | 'ts' | 'gamma'>,
  previousRow?: Pick<L2DTaskTwoRowSubmission, 'mp' | 'gamma'> | null,
) {
  const sigma = safeNumber(row.sigma);
  const omega = safeNumber(row.omega);
  const mp = safeNumber(row.mp);
  const ts = Math.max(safeNumber(row.ts), 0);
  const gamma = safeNumber(row.gamma);

  const zeta = computeZeta(sigma, omega);
  const tsExpected = Math.abs(sigma) > 1e-6 ? 4 / Math.abs(sigma) : Number.POSITIVE_INFINITY;
  const mpExpected = computeExpectedMp(zeta);

  const checks: Array<{ label: string; score: number; feedback?: string }> = [];

  const tsError = Number.isFinite(tsExpected) ? Math.abs(ts - tsExpected) / Math.max(tsExpected, 1e-6) : Number.POSITIVE_INFINITY;
  if (tsError < 0.3) {
    checks.push({ label: 'A · 极点与 ts 一致性', score: 4 });
  } else if (tsError < 0.5) {
    checks.push({
      label: 'A · 极点与 ts 一致性',
      score: 2,
      feedback: `调节时间与极点实部不太吻合。参考：ts ≈ 4/|σ| = ${tsExpected.toFixed(1)} s`,
    });
  } else {
    checks.push({
      label: 'A · 极点与 ts 一致性',
      score: 0,
      feedback: `调节时间读数偏差较大。参考：ts ≈ 4/|σ| = ${tsExpected.toFixed(1)} s`,
    });
  }

  const mpError = Math.abs(mp - mpExpected);
  if (mpError < 20) {
    checks.push({ label: 'B · 极点与 Mp 一致性', score: 4 });
  } else if (mpError < 35) {
    checks.push({
      label: 'B · 极点与 Mp 一致性',
      score: 2,
      feedback: `超调量与阻尼比不太吻合。参考：ζ=${zeta.toFixed(2)} 对应 Mp≈${mpExpected.toFixed(0)}%`,
    });
  } else {
    checks.push({
      label: 'B · 极点与 Mp 一致性',
      score: 0,
      feedback: `超调量读数偏差较大。参考：ζ=${zeta.toFixed(2)} 对应 Mp≈${mpExpected.toFixed(0)}%`,
    });
  }

  if (!previousRow) {
    checks.push({ label: 'C · Mp 与 γ 方向一致性', score: 2 });
  } else {
    const directionMatches =
      (mp > previousRow.mp && gamma < previousRow.gamma)
      || (mp < previousRow.mp && gamma > previousRow.gamma)
      || Math.abs(mp - previousRow.mp) < 1e-6;
    checks.push({
      label: 'C · Mp 与 γ 方向一致性',
      score: directionMatches ? 2 : 0,
      feedback: directionMatches ? undefined : '超调量和相位裕度的变化方向不一致。Mp 增大时 γ 应减小，请检查读数。',
    });
  }

  return {
    score: checks.reduce((sum, item) => sum + item.score, 0),
    checks,
    feedback: checks.flatMap((item) => (item.feedback ? [item.feedback] : [])),
  };
}

export function scoreReflection(input: { surpriseText: string; selectedOption: 'A' | 'B' | ''; answerText: string }) {
  const feedback: string[] = [];
  let score = 0;
  if (input.surpriseText.trim().length >= 10) {
    score += 20;
  } else {
    feedback.push('请描述一个具体的现象，至少写满一句话。');
  }

  if (input.selectedOption === 'A' && input.answerText.trim().length >= 10) {
    score += 10;
  } else if (input.selectedOption === 'B') {
    if (/\d/.test(input.answerText)) {
      score += 10;
    } else if (input.answerText.trim().length >= 10) {
      score += 5;
      feedback.push('选题 B 建议填入你在任务二中的具体数值来验证。');
    }
  }

  return { score, feedback };
}

export function getTaskTwoTotal(rows: Record<string, L2DTaskTwoRowSubmission>) {
  return L2D_TASK_TWO_ROWS.reduce((sum, rowId) => sum + (rows[rowId]?.score ?? 0), 0);
}

export function getCourseTotals(state: L2DStudentCourseState) {
  return {
    taskOne: state.taskOne?.score ?? 0,
    taskTwo: getTaskTwoTotal(state.taskTwoRows),
    reflection: state.reflection?.score ?? 0,
    total: (state.taskOne?.score ?? 0) + getTaskTwoTotal(state.taskTwoRows) + (state.reflection?.score ?? 0),
  };
}

export const L2D_PREMIUM_LESSON_CARD = {
  id: 'l2d-three-domain-linkage-practice',
  title: L2D_COURSE_TITLE,
  description: '实践型精品课：在根轨迹、时域与频域三面板中同步拨动 K，建立自己的三域地图。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${L2D_ROUTE_SEGMENT}`,
  badge: '精品课程',
};
