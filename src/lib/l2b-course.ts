import type { BopppsStage } from '@prisma/client';

export type L2BStageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type L2BPageType = 'display' | 'quiz' | 'form' | 'workspace' | 'summary';
export type L2BTone = 'cyan' | 'sky' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

export interface L2BChoiceOption {
  value: string;
  label: string;
}

export interface L2BFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'radio';
  placeholder?: string;
  options?: L2BChoiceOption[];
}

export interface L2BQuestion {
  key: string;
  prompt: string;
  type: 'single' | 'text';
  options?: L2BChoiceOption[];
  answer?: string;
  placeholder?: string;
}

export interface L2BSection {
  title: string;
  tone?: L2BTone;
  body?: string;
  bullets?: string[];
}

export interface L2BActivity {
  kind: 'none' | 'form' | 'quiz';
  submitLabel?: string;
  helper?: string;
  fields?: L2BFormField[];
  questions?: L2BQuestion[];
}

export interface L2BContentBlock {
  kicker: string;
  title: string;
  intro: string;
  sections: L2BSection[];
  controls?: string[];
  activity?: L2BActivity;
}

export interface L2BStepDefinition {
  id: string;
  stage: L2BStageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: L2BPageType;
  mediaKey?: string | null;
  workspaceMode?: 'broadcast' | 'independent' | 'hybrid' | null;
  teacher: L2BContentBlock;
  student: L2BContentBlock;
}

export interface L2BWorkspaceSnapshot {
  gain: number;
  selectedPointKey: string | null;
  showRay45: boolean;
  studentUnlocked: boolean;
  lastMeasuredAt: number | null;
}

export interface L2BStepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface L2BStudentCourseState {
  kind: 'l2b_student_state';
  version: 1;
  studentName: string;
  workspace: L2BWorkspaceSnapshot;
  responses: Record<string, L2BStepResponse>;
  reflections: Record<string, string>;
  updatedAt: number;
}

const EMPTY_ACTIVITY: L2BActivity = { kind: 'none' };

function createDisplayStep(config: {
  id: string;
  stage: L2BStageCode;
  title: string;
  duration: string;
  hint: string;
  intro: string;
  studentIntro?: string;
  sections: L2BSection[];
  controls?: string[];
  pageType?: L2BPageType;
  mediaKey?: string | null;
  workspaceMode?: 'broadcast' | 'independent' | 'hybrid' | null;
  studentActivity?: L2BActivity;
}): L2BStepDefinition {
  return {
    id: config.id,
    stage: config.stage,
    title: config.title,
    hint: config.hint,
    duration: config.duration,
    pageType: config.pageType ?? 'display',
    mediaKey: config.mediaKey ?? null,
    workspaceMode: config.workspaceMode ?? null,
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

export const L2B_ROUTE_SEGMENT = 'l2b-root-locus-fasttrack';
export const L2B_PRESET_KEY = 'l2b-root-locus-fasttrack-v1';
export const L2B_COURSE_TITLE = 'L-2b：根轨迹直觉速通 · 极点迁移的几何感知';
export const L2B_COURSE_SUBTITLE = 'Root-Locus Intuition Fast Track';
export const L2B_COURSE_DESCRIPTION =
  '围绕根轨迹直觉、增益-极点-响应联动、45°射线几何定位与双端同步课堂，构建从预测到验证到 AI 对比的完整学习链路。';

export const L2B_STAGE_LABEL: Record<L2BStageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const L2B_STAGE_COLOR: Record<L2BStageCode, string> = {
  B: 'border-sky-200 bg-sky-50 text-sky-700',
  O: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  P1: 'border-amber-200 bg-amber-50 text-amber-700',
  P2: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  P3: 'border-orange-200 bg-orange-50 text-orange-700',
  S: 'border-violet-200 bg-violet-50 text-violet-700',
};

export const L2B_STAGE_MAP: Record<L2BStageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const L2B_MEDIA = {
  knowledgeMap: '/course-runtime/lessons/legacy/L-2b/media/knowledge-map-l2b.svg',
  poleMigration: '/course-runtime/lessons/legacy/L-2b/media/sh-01-pole-migration-locus.svg',
  performanceZones: '/course-runtime/lessons/legacy/L-2b/media/sh-02-root-locus-performance-zones.svg',
  optimalDamping: '/course-runtime/lessons/legacy/L-2b/media/sh-03-root-locus-optimal-damping.svg',
  exampleOne: '/course-runtime/lessons/legacy/L-2b/media/h-04-example1-root-locus.svg',
  exampleTwo: '/course-runtime/lessons/legacy/L-2b/media/h-05-example2-root-locus-crossing.svg',
} as const;

export const L2B_PRE_ASSESSMENT_QUESTIONS: L2BQuestion[] = [
  {
    key: 'q1',
    prompt: '某系统极点为 s = -0.1 ± 5j，其时域响应最可能是？',
    type: 'single',
    options: [
      { value: 'A', label: '单调缓慢上升，无振荡' },
      { value: 'B', label: '快速振荡，衰减很慢' },
      { value: 'C', label: '响应发散，越来越大' },
      { value: 'D', label: '持续等幅振荡，不衰减' },
    ],
    answer: 'B',
  },
  {
    key: 'q2',
    prompt: '增大开环增益 K，你认为闭环极点会（　　）',
    type: 'single',
    options: [
      { value: 'A', label: '保持在原位置不动' },
      { value: 'B', label: '只沿实轴移动' },
      { value: 'C', label: '在复平面上移动，具体轨迹未知' },
      { value: 'D', label: '移入右半平面，系统不稳定' },
    ],
    answer: 'C',
  },
];

export const L2B_POST_ASSESSMENT_QUESTIONS: L2BQuestion[] = [
  {
    key: 'q1',
    prompt: '根轨迹图的横轴代表（　　）',
    type: 'single',
    options: [
      { value: 'A', label: '时间 t（秒）' },
      { value: 'B', label: '频率 ω（rad/s）' },
      { value: 'C', label: '复平面实部 σ' },
      { value: 'D', label: '增益 K' },
    ],
    answer: 'C',
  },
  {
    key: 'q2',
    prompt: '根轨迹上某点坐标为 s = -2 + 2j，该点对应的阻尼比 ζ 约为？',
    type: 'single',
    options: [
      { value: 'A', label: 'ζ ≈ 0.5' },
      { value: 'B', label: 'ζ ≈ 0.707' },
      { value: 'C', label: 'ζ ≈ 0.9' },
      { value: 'D', label: 'ζ = 1.0' },
    ],
    answer: 'B',
  },
];

export const L2B_LESSON_STEPS: L2BStepDefinition[] = [
  createDisplayStep({
    id: 'knowledge-map',
    stage: 'B',
    title: '知识地图：我们现在在这里',
    duration: '2 min',
    hint: '确认本节位于 L-2a 与 L-2c 之间的根轨迹节点。',
    intro: '用知识地图承接“极点决定响应”并引出“调 K 看极点怎么走”。',
    sections: [
      { title: '教学主线', tone: 'sky', bullets: ['上节：极点位置 → 时域响应形状', '本节：调节增益 K → 极点移动 → 响应变化', '下节：频域视角补足第三张脸'] },
    ],
  }),
  createDisplayStep({
    id: 'scenario-question',
    stage: 'B',
    title: '场景问题：极点不对，工程师怎么办？',
    duration: '3 min',
    hint: '用船舶控制情景引出“旋钮”问题。',
    intro: '先回到 L-2a 的极点-响应结论图，再提出“我有什么旋钮可以转？”这个工程问题。',
    sections: [
      { title: '场景卡', tone: 'cyan', body: '某船右转 10° 后响应振荡剧烈，超调约 35%。工程师只想知道：我能调什么？' },
    ],
    studentActivity: {
      kind: 'form',
      submitLabel: '记录直觉',
      fields: [{ key: 'first-impression', label: '你觉得增大 K 会更稳定还是更剧烈？', type: 'textarea', placeholder: '写下你的第一直觉，不计分。' }],
    },
  }),
  createDisplayStep({
    id: 'lesson-goals',
    stage: 'O',
    title: '本节目标',
    duration: '3 min',
    hint: '明确今天只建直觉，不做绘图法则推导。',
    intro: '三条目标同时对应解释、读图和几何定位能力。',
    sections: [
      { title: '你将完成', tone: 'emerald', bullets: ['解释极点迁移', '在根轨迹图上读出极点与响应关系', '用 45°射线定位 ζ = 0.707 对应的 K 值'] },
    ],
    studentActivity: {
      kind: 'form',
      submitLabel: '勾选课后回看项',
      fields: [
        { key: 'goal-1', label: '解释极点迁移', type: 'radio', options: [{ value: 'todo', label: '课后再勾选' }] },
      ],
    },
  }),
  createDisplayStep({
    id: 'precheck',
    stage: 'P1',
    title: '前测：回顾极点与响应',
    duration: '5 min',
    hint: '两道题摸底时域直觉与对 K 的预判。',
    intro: '先看旧知识是否稳，再看大家对“极点会不会动”有没有初始直觉。',
    sections: [{ title: '教师提示', tone: 'amber', bullets: ['题 1 错误率高时补回 L-2a', '题 2 结果用于判断演示时间长短'] }],
    pageType: 'quiz',
    studentActivity: {
      kind: 'quiz',
      submitLabel: '提交前测',
      questions: L2B_PRE_ASSESSMENT_QUESTIONS,
    },
  }),
  createDisplayStep({
    id: 'two-trajectories',
    stage: 'P2',
    title: '两种轨迹：时间 vs 复平面',
    duration: '5 min',
    hint: '澄清根轨迹不是时间轨迹。',
    intro: '建立 y(t) 与 s(K) 两种图的语义区分，避免后续所有误解。',
    sections: [
      { title: '对比关键词', tone: 'cyan', bullets: ['y(t) 看输出随时间怎么变', 's(K) 看极点随 K 怎么走', '根轨迹横轴是实部 σ，不是时间 t'] },
    ],
    studentActivity: {
      kind: 'quiz',
      submitLabel: '确认继续',
      questions: [
        {
          key: 'quick-check',
          prompt: '根轨迹图上的一个点代表什么？',
          type: 'single',
          options: [
            { value: 'A', label: '某时刻系统输出值' },
            { value: 'B', label: '某个 K 下的极点位置' },
            { value: 'C', label: '系统频率响应值' },
          ],
          answer: 'B',
        },
      ],
    },
  }),
  createDisplayStep({
    id: 'open-close-loop',
    stage: 'P2',
    title: '开环旋钮与闭环极点：反馈框图',
    duration: '8 min',
    hint: '用收音机旋钮类比解释调开环、看闭环。',
    intro: '让学生知道“调的是 K，看的是闭环极点”并不矛盾。',
    sections: [
      { title: '记忆句', tone: 'sky', bullets: ['开环增益 = 旋钮（你调的）', '闭环极点 = 结果（系统最终状态）', '根轨迹 = 旋钮从 0 拧到 ∞，极点走过的路径'] },
    ],
    pageType: 'workspace',
  }),
  createDisplayStep({
    id: 'pole-drag-demo',
    stage: 'P2',
    title: '极点在走：拖动演示',
    duration: '8 min',
    hint: 'step-07 需要广播模式 + 学生独立解锁。',
    intro: '教师先广播拖动，随后放权给学生自己探索根轨迹。',
    sections: [
      { title: '关键 K 值', tone: 'cyan', bullets: ['K=1：分叉点，最快无超调', 'K=2：ζ=0.707，最佳阻尼', 'K=5：超调明显，调节时间近似不变'] },
    ],
    pageType: 'workspace',
    workspaceMode: 'hybrid',
    mediaKey: 'poleMigration',
  }),
  createDisplayStep({
    id: 'migration-table',
    stage: 'P2',
    title: '极点迁移数值表',
    duration: '4 min',
    hint: '逐行揭示 K、极点类型与响应映射。',
    intro: '通过数值表压实“实部不变、虚部增大”的两条观察。',
    sections: [
      { title: '观察目标', tone: 'sky', bullets: ['实部是否变化？', '虚部如何随 K 变化？', '调节时间与超调分别跟谁联动？'] },
    ],
    mediaKey: 'poleMigration',
    studentActivity: {
      kind: 'form',
      submitLabel: '提交观察',
      fields: [
        { key: 'real-part', label: '实部变化', type: 'radio', options: [{ value: 'increase', label: '变大' }, { value: 'same', label: '不变' }, { value: 'decrease', label: '变小' }] },
        { key: 'imag-part', label: '虚部变化', type: 'radio', options: [{ value: 'increase', label: '变大' }, { value: 'same', label: '不变' }, { value: 'decrease', label: '变小' }] },
      ],
    },
  }),
  createDisplayStep({
    id: 'two-observations',
    stage: 'P2',
    title: '两个关键观察',
    duration: '3 min',
    hint: '从表格结论过渡到设计上限。',
    intro: '点明“仅靠调 K 无法缩短调节时间”的限制。',
    sections: [
      { title: '结论 1', tone: 'cyan', body: '实部固定 = 衰减速度固定 = 调节时间基本固定。' },
      { title: '结论 2', tone: 'cyan', body: '虚部增大 = 振荡更快、超调更大。' },
    ],
    studentActivity: {
      kind: 'form',
      submitLabel: '保存猜测',
      fields: [{ key: 'next-guess', label: '如果想让调节时间也变短，你猜还要改什么？', type: 'textarea', placeholder: '写下你的猜测，后续再验证。' }],
    },
  }),
  createDisplayStep({
    id: 'design-map',
    stage: 'P2',
    title: '根轨迹是设计可行域地图',
    duration: '5 min',
    hint: '把根轨迹从“图”切换为“地图”的心智模型。',
    intro: '学生可点选轨迹位置，比较不同点对应的系统行为。',
    sections: [
      { title: '三种区域', tone: 'emerald', bullets: ['慢且保守', '理想工作区', '高超调危险区'] },
    ],
    pageType: 'workspace',
    workspaceMode: 'independent',
    mediaKey: 'performanceZones',
    studentActivity: {
      kind: 'form',
      submitLabel: '记录选点',
      fields: [
        { key: 'target-pole', label: '我选择的极点', type: 'text', placeholder: '例如：-1 + 1.2j' },
        { key: 'target-k', label: '对应 K', type: 'text', placeholder: '例如：2.4' },
        { key: 'target-reason', label: '理由', type: 'textarea', placeholder: '一句话说明为什么这个点最好。' },
      ],
    },
  }),
  createDisplayStep({
    id: 'stability-boundary',
    stage: 'P2',
    title: '稳定边界：根轨迹不能越过虚轴',
    duration: '4 min',
    hint: '引入三阶系统例子，解释临界增益与稳定裕度。',
    intro: '通过含虚轴穿越的三阶系统，建立“快不是越大越好”的安全边界意识。',
    sections: [
      { title: '工程原则', tone: 'amber', bullets: ['穿越虚轴意味着临界稳定', '进入右半平面意味着不稳定', '实际工程必须预留裕度'] },
    ],
    mediaKey: 'exampleTwo',
    studentActivity: {
      kind: 'quiz',
      submitLabel: '提交判断',
      questions: [
        {
          key: 'stable-left',
          prompt: '根轨迹只要在左半平面，对对应 K 值系统就稳定。',
          type: 'single',
          options: [{ value: 'T', label: '对' }, { value: 'F', label: '错' }],
          answer: 'T',
        },
      ],
    },
  }),
  createDisplayStep({
    id: 'challenge-intro',
    stage: 'P2',
    title: '挑战任务发布：找最佳阻尼比',
    duration: '2 min',
    hint: '为 step-13~15 的 AI 融入流程做任务发令。',
    intro: '把任务压缩成一句话：找到让 ζ = 0.707 的增益 K。',
    sections: [
      { title: '三步流程', tone: 'violet', bullets: ['先写下你的预测', '再用平台验证', '最后向 AI 提问并对比'] },
    ],
  }),
  createDisplayStep({
    id: 'prediction',
    stage: 'P2',
    title: '[AI融入点] 学生独立预测',
    duration: '3 min',
    hint: '学生先独立预测，不允许直接看别人或看 AI。',
    intro: '预测是为了让后续验证和 AI 对照真正产生认知冲击。',
    sections: [
      { title: '预测题', tone: 'sky', body: '为了从 K≈1 的无超调状态走到 ζ=0.707，你认为 K 应该调大、调小，还是不确定？' },
    ],
    pageType: 'form',
    studentActivity: {
      kind: 'form',
      submitLabel: '提交预测',
      fields: [
        { key: 'prediction-choice', label: '你的选择', type: 'radio', options: [{ value: 'up', label: '调大（K > 1）' }, { value: 'down', label: '调小（K < 1）' }, { value: 'unknown', label: '我不确定' }] },
        { key: 'prediction-reason', label: '理由', type: 'text', placeholder: '一句话说明你的直觉。' },
      ],
    },
  }),
  createDisplayStep({
    id: 'verify-and-ray',
    stage: 'P2',
    title: '[AI融入点] 平台验证 + 几何定位',
    duration: '7 min',
    hint: 'step-14 需要 45° 射线开关、K 显示、ζ 实时值。',
    intro: '通过 45° 射线与根轨迹交点，把最佳阻尼比定位从图上直接读出来。',
    sections: [
      { title: '验证任务', tone: 'cyan', bullets: ['试 K = 0.5 / 1 / 2', '打开 45° 射线开关', '记录交点极点与对应 K'] },
    ],
    pageType: 'workspace',
    workspaceMode: 'independent',
    mediaKey: 'optimalDamping',
    studentActivity: {
      kind: 'form',
      submitLabel: '提交验证结果',
      fields: [
        { key: 'ray-k', label: '交点对应的 K', type: 'text', placeholder: '例如：2' },
        { key: 'ray-pole', label: '交点极点坐标', type: 'text', placeholder: '例如：-1 ± j1' },
      ],
    },
  }),
  createDisplayStep({
    id: 'ai-compare',
    stage: 'P2',
    title: '[AI融入点] 向AI提问并对比',
    duration: '5 min',
    hint: '要有提示词复制和三栏对比区域。',
    intro: '把预测、平台验证与 AI 输出摆到同一张表上比较。',
    sections: [
      { title: '推荐提示词', tone: 'violet', body: '对于闭环系统特征方程 s²+2s+K=0，当 K 等于多少时，阻尼比 ζ=0.707？请给出极点坐标和计算过程。' },
      { title: '反思问题', tone: 'amber', bullets: ['预测哪里对了/错了？', 'AI 计算与几何法哪个更直观？', '若目标改成 ζ=0.5，图上应找哪条射线？'] },
    ],
    pageType: 'form',
    studentActivity: {
      kind: 'form',
      submitLabel: '保存对比',
      fields: [
        { key: 'ai-k', label: 'AI 给出的 K', type: 'text', placeholder: '填入 AI 结果' },
        { key: 'ai-pole', label: 'AI 给出的极点', type: 'text', placeholder: '填入 AI 结果' },
        { key: 'ai-reflection', label: '你的反思', type: 'textarea', placeholder: '比较预测、平台验证与 AI 结果。' },
      ],
    },
  }),
  createDisplayStep({
    id: 'postcheck',
    stage: 'P3',
    title: '后测：概念确认 + 应用',
    duration: '7 min',
    hint: '用 2 道题检查横轴语义和 45° 几何读图。',
    intro: '后测要把“根轨迹不是时间图”和“45° 对应 0.707”钉牢。',
    sections: [{ title: '教师提示', tone: 'amber', bullets: ['错误率高时重申横轴语义', '必要时重演 45° 几何关系'] }],
    pageType: 'quiz',
    studentActivity: {
      kind: 'quiz',
      submitLabel: '提交后测',
      questions: L2B_POST_ASSESSMENT_QUESTIONS,
    },
  }),
  createDisplayStep({
    id: 'summary',
    stage: 'S',
    title: '总结：知识地图回顾 + 下节预告',
    duration: '5 min',
    hint: '逐条回收五个核心结论并高亮 L-2c。',
    intro: '最后把“根轨迹 = 设计地图”的核心心智模型收回到知识地图里。',
    sections: [
      { title: '五条结论', tone: 'emerald', bullets: ['根轨迹是复平面轨迹，不是时间轨迹', '开环增益是旋钮，闭环极点是结果', '根轨迹图是设计可行域地图', 'ζ=0.707 对应 45° 射线交点，且本例 K=2', '虚轴穿越意味着增益上限与稳定裕度'] },
    ],
    pageType: 'summary',
    studentActivity: {
      kind: 'form',
      submitLabel: '记录我的猜测',
      fields: [{ key: 'next-lesson-guess', label: '你对 L-2c 的猜测', type: 'textarea', placeholder: '频域里会看到什么？写下你的猜测。' }],
    },
  }),
];

export const L2B_STEP_DURATION = Object.fromEntries(
  L2B_LESSON_STEPS.map((step) => [step.id, step.duration]),
);

export const L2B_WORKSPACE_VISIBLE_STEP_IDS = new Set(
  L2B_LESSON_STEPS.filter((step) => step.pageType === 'workspace').map((step) => step.id),
);

export const L2B_PREMIUM_LESSON_CARD = {
  id: 'l2b-root-locus-fasttrack',
  title: L2B_COURSE_TITLE,
  description: '17 步精品互动课：根轨迹直觉、45° 射线与预测-验证-AI 对比闭环。',
  duration: '79 分钟',
  href: `/interactive-learning/courses/${L2B_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

export function getL2BStep(stepId: string) {
  return L2B_LESSON_STEPS.find((step) => step.id === stepId) ?? L2B_LESSON_STEPS[0];
}

export function getL2BMediaSrc(mediaKey: string | null | undefined) {
  if (!mediaKey) {
    return null;
  }
  return L2B_MEDIA[mediaKey as keyof typeof L2B_MEDIA] ?? null;
}

export function createEmptyL2BStudentState(studentName: string): L2BStudentCourseState {
  return {
    kind: 'l2b_student_state',
    version: 1,
    studentName,
    workspace: {
      gain: 1,
      selectedPointKey: null,
      showRay45: false,
      studentUnlocked: false,
      lastMeasuredAt: null,
    },
    responses: {},
    reflections: {},
    updatedAt: Date.now(),
  };
}
