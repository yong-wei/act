import { CRUISE_ADORA_PARAMS, CRUISE_DEFAULT_PID } from '@/resources/simulations/core/constants';

export { CRUISE_DEFAULT_PID };

export type CruiseRole = 'teacher' | 'student';
export type CruiseStageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';

export interface CruiseLessonStep {
  id: string;
  stage: CruiseStageCode;
  title: string;
  hint: string;
}

export interface AdaptiveQuestion {
  id: string;
  abilityPoint: string;
  stem: string;
  options: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>;
  answer: 'A' | 'B' | 'C' | 'D';
}

export interface CruiseControllerParams {
  kp: number;
  ki: number;
  kd: number;
}

export type CruiseControllerMode = 'p' | 'pd' | 'pid';

export interface CruiseTargetForm {
  overshoot: number;
  settlingTime: number;
  steadyError: number;
  maxLateralAccel: number;
}

export interface CruisePerformanceResult {
  overshoot: number;
  settlingTime: number;
  accel: number;
}

export interface CourseComplexPoint {
  re: number;
  im: number;
}

export interface CourseOpenLoopModel {
  poles: CourseComplexPoint[];
  zeros: CourseComplexPoint[];
  gain: number;
}

export interface CruiseStageTask {
  title: string;
  description: string;
}

export const CRUISE_COURSE_TITLE = '柔性之海：豪华邮轮舒适度控制';
export const CRUISE_PRESET_KEY = 'cruise-comfort-v1';
export const CRUISE_COURSE_MODE = 'cruise-boppps';

export const CRUISE_STAGE_LABEL: Record<CruiseStageCode, string> = {
  B: 'B - 导入',
  O: 'O - 目标',
  P1: 'P1 - 快速前测',
  P2: 'P2 - 参与式学习',
  P3: 'P3 - 后测/校验',
  S: 'S - 总结',
};

export const CRUISE_STAGE_COLOR: Record<CruiseStageCode, string> = {
  B: 'bg-sky-500/20 text-sky-200 border-sky-300/30',
  O: 'bg-emerald-500/20 text-emerald-200 border-emerald-300/30',
  P1: 'bg-amber-500/20 text-amber-100 border-amber-300/30',
  P2: 'bg-cyan-500/20 text-cyan-100 border-cyan-300/30',
  P3: 'bg-orange-500/20 text-orange-100 border-orange-300/30',
  S: 'bg-indigo-500/20 text-indigo-100 border-indigo-300/30',
};

export const BLOOM_VERBS = ['识别', '解释', '分析', '设计', '评估', '优化'];

export const ABILITY_POINTS = ['极点-时域映射', '频域稳定判读', '工程约束表达', '参数整定收敛'];

export const DEMO_STUDENTS = ['张宁', '李晨', '王菲', '赵铭', '陈悦', '周航'];

export const CRUISE_LESSON_STEPS: CruiseLessonStep[] = [
  {
    id: 'class-code',
    stage: 'B',
    title: '课堂码发放',
    hint: '教师发布课堂码，学生通过课堂码加入本次课堂。',
  },
  {
    id: 'bridge',
    stage: 'B',
    title: '开场导入：邮轮舒适度冲突',
    hint: '播放导入视频，明确“速度 vs 舒适”工程约束冲突。',
  },
  {
    id: 'objective',
    stage: 'O',
    title: '个性化目标：布鲁姆动词驱动',
    hint: '教师先定义目标，再按学生能力画像生成个性化目标。',
  },
  {
    id: 'precheck',
    stage: 'P1',
    title: '快速前测：2道自适应题',
    hint: '教师发放题目并查看能力统计，学生完成能力点绑定题。',
  },
  {
    id: 'engineering-target',
    stage: 'P2',
    title: '工程目标设定',
    hint: '进入仿真+多表征综合页，按步骤设定目标。',
  },
  {
    id: 'first-exploration',
    stage: 'P2',
    title: '第一轮参数探索',
    hint: '从综合页切换标签做参数探索并观察跨域联动。',
  },
  {
    id: 'neural-ode',
    stage: 'P2',
    title: 'NeuralODE嵌入（教师）',
    hint: '教师展示前沿嵌入说明，学生继续在综合页操作。',
  },
  {
    id: 'ai-analysis',
    stage: 'P2',
    title: 'AI介入分析',
    hint: '教师说明要求，学生在仿真控制面板执行改造。',
  },
  {
    id: 'prompt-refine',
    stage: 'P2',
    title: '结构化提示词修改',
    hint: '学生从跨域返回仿真，在控制面板完成结构化改写。',
  },
  {
    id: 'pause-reflection',
    stage: 'P2',
    title: '暂停反思',
    hint: '教师给出静态文案，学生保留当前工作区状态。',
  },
  {
    id: 'adjustment',
    stage: 'P2',
    title: '反思调整',
    hint: '依据反思继续优化参数与目标表达。',
  },
  {
    id: 'consistency',
    stage: 'P3',
    title: '一致性校验',
    hint: '校验提示目标、操作行为与结果的一致性。',
  },
  {
    id: 'group-compare',
    stage: 'P2',
    title: '小组对比',
    hint: '围绕极点与响应曲线对比两组方案。',
  },
  {
    id: 'summary',
    stage: 'S',
    title: '收尾总结',
    hint: '教师看班级达成，学生看个性化达成。',
  },
];

export const QUESTION_BANK: AdaptiveQuestion[] = [
  {
    id: 'q1',
    abilityPoint: '极点-时域映射',
    stem: '主导极点向虚轴靠近时，系统通常会出现什么变化？',
    options: [
      { key: 'A', text: '调节时间缩短且超调减小' },
      { key: 'B', text: '振荡增强且稳定时间延长' },
      { key: 'C', text: '稳态误差一定为零' },
      { key: 'D', text: '系统从欠阻尼变为过阻尼' },
    ],
    answer: 'B',
  },
  {
    id: 'q2',
    abilityPoint: '频域稳定判读',
    stem: '若相位裕度过低，最直接的风险是：',
    options: [
      { key: 'A', text: '响应过慢但绝对稳定' },
      { key: 'B', text: '能耗下降' },
      { key: 'C', text: '振荡与鲁棒性不足' },
      { key: 'D', text: '稳态误差自动降低' },
    ],
    answer: 'C',
  },
  {
    id: 'q3',
    abilityPoint: '工程约束表达',
    stem: '针对邮轮舒适度场景，哪项约束最能直接体现乘客安全？',
    options: [
      { key: 'A', text: '最大舵角变化率' },
      { key: 'B', text: '最大侧向加速度' },
      { key: 'C', text: '控制器采样周期' },
      { key: 'D', text: '积分项上限' },
    ],
    answer: 'B',
  },
  {
    id: 'q4',
    abilityPoint: '参数整定收敛',
    stem: '当系统超调过大时，优先可尝试的调整是：',
    options: [
      { key: 'A', text: '提高 Kp 并降低 Kd' },
      { key: 'B', text: '降低 Kp 或提升 Kd' },
      { key: 'C', text: '只提高 Ki' },
      { key: 'D', text: '关闭反馈环节' },
    ],
    answer: 'B',
  },
];

export const DEFAULT_TARGET_FORM: CruiseTargetForm = {
  overshoot: 12,
  settlingTime: 65,
  steadyError: 2,
  maxLateralAccel: 0.15,
};

export const DEFAULT_PROMPT = {
  controlObject: '豪华邮轮航向-舒适度耦合对象',
  performanceGoal: '超调≤12%，调节时间≤65s',
  constraints: '侧向加速度<0.15g，避免乘客跌倒风险',
  strategy: '先提升阻尼再微调带宽，最后检查裕度',
};

export const CRUISE_PRESET_OBJECTIVES = [
  '识别 极点分布、时域响应与频域裕度之间的对应关系',
  '设计 满足舒适度约束（侧向加速度）与效率目标的控制参数',
  '评估 提示词目标、调参行为与系统结果之间的一致性',
];

export const CRUISE_WAITING_THINK_PROMPTS = [
  '当调节时间更短时，为什么乘客舒适度可能变差？',
  '你会优先约束超调量，还是优先约束侧向加速度？为什么？',
  '同样的控制目标，P/PD/PID 控制器会带来哪些差异？',
];

export const CRUISE_CLOSING_COPY = '今天我们选择了安全。控制，不只是计算，更是对系统后果负责。';

const STUDENT_STAGE_TASKS: Record<string, CruiseStageTask> = {
  'engineering-target': {
    title: '环节目标：工程目标设定',
    description: '先定义超调、调节时间与侧向加速度约束，再进入调参。',
  },
  'first-exploration': {
    title: '环节目标：第一轮参数探索',
    description: '观察极点移动、时域响应和频域曲线同步变化，记录一次失败原因。',
  },
  'ai-analysis': {
    title: '环节目标：AI介入分析',
    description: '结合 AI 建议解释失败机制，明确边界，再执行下一轮调参。',
  },
  'prompt-refine': {
    title: '环节目标：结构化提示词修改',
    description: '按“对象-目标-约束-策略”重写提示词，并验证参数变化效果。',
  },
  'pause-reflection': {
    title: '环节目标：暂停反思',
    description: '暂停操作，提炼当前方案的一个优点与一个风险。',
  },
  adjustment: {
    title: '环节目标：反思调整',
    description: '基于反思结果做一项关键改动，并给出验证指标。',
  },
  consistency: {
    title: '环节目标：一致性校验',
    description: '对照目标表达、调参轨迹与结果指标，修正偏差。',
  },
  'group-compare': {
    title: '环节目标：小组对比',
    description: '比较不同策略下的极点分布与响应曲线，说明取舍逻辑。',
  },
};

export function hashToUnit(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

export function buildAbilityProfile(student: string): Record<string, number> {
  const profile: Record<string, number> = {};
  ABILITY_POINTS.forEach((point, index) => {
    const seed = hashToUnit(`${student}-${point}-${index}`);
    profile[point] = Math.round((55 + seed * 40) * 10) / 10;
  });
  return profile;
}

export function buildPersonalizedObjectives(
  student: string,
  variant: 'teacher' | 'studentFallback' = 'teacher'
): string[] {
  const profile = buildAbilityProfile(student);
  const weakest = [...ABILITY_POINTS].sort((a, b) => profile[a] - profile[b])[0];

  if (variant === 'studentFallback') {
    return [
      `解释 ${weakest} 在本节控制任务中的关键判断依据`,
      `优化 满足舒适度边界（侧向加速度）与响应速度的参数组合`,
      '审视 自己的目标表达是否和调参行为保持一致',
    ];
  }

  return [
    `识别 根轨迹/伯德图在“${weakest}”上的联动变化`,
    '设计 满足超调、调节时间与舒适度约束的控制参数',
    '评估 目标文本、参数轨迹与系统结果的一致性',
  ];
}

export function getStudentStageTask(stepId: string): CruiseStageTask {
  return STUDENT_STAGE_TASKS[stepId] ?? {
    title: '环节目标',
    description: '根据教师指令完成当前步骤，并记录你的关键判断依据。',
  };
}

export function pickTwoAdaptiveQuestions(student: string): AdaptiveQuestion[] {
  const profile = buildAbilityProfile(student);
  const weakest = [...ABILITY_POINTS].sort((a, b) => profile[a] - profile[b]).slice(0, 2);
  return weakest
    .map((point) => QUESTION_BANK.find((question) => question.abilityPoint === point))
    .filter((question): question is AdaptiveQuestion => Boolean(question));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, digits = 3): number {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

export function computePerformanceFromController(controller: CruiseControllerParams): CruisePerformanceResult {
  const overshoot = Math.max(4, 32 - controller.kd * 10 - controller.kp * 2.1);
  const settlingTime = Math.max(28, 110 - controller.kp * 12 + controller.ki * 2.4);
  const accel = Math.max(0.07, 0.26 - controller.kd * 0.05 + controller.kp * 0.01);
  return {
    overshoot: round(overshoot, 1),
    settlingTime: round(settlingTime, 1),
    accel: round(accel, 3),
  };
}

export function computeConsistencyScore(target: CruiseTargetForm, result: CruisePerformanceResult) {
  const overshootPass = result.overshoot <= target.overshoot;
  const settlePass = result.settlingTime <= target.settlingTime;
  const accelPass = result.accel <= target.maxLateralAccel;
  const passCount = [overshootPass, settlePass, accelPass].filter(Boolean).length;
  return {
    overshootPass,
    settlePass,
    accelPass,
    score: Math.round((passCount / 3) * 100),
  };
}

export function controllerFromDominantPole(pole: CourseComplexPoint): CruiseControllerParams {
  const kp = Math.max(0.6, round(-2 * pole.re, 2));
  const ki = Math.max(0.2, round(pole.re * pole.re + pole.im * pole.im, 2));
  const kd = Math.max(0.1, round(Math.abs(pole.im) / 2.8, 2));
  return { kp, ki, kd };
}

export function normalizeControllerByMode(
  controller: CruiseControllerParams,
  mode: CruiseControllerMode
): CruiseControllerParams {
  if (mode === 'p') {
    return { kp: Math.max(0, round(controller.kp, 3)), ki: 0, kd: 0 };
  }
  if (mode === 'pd') {
    return { kp: Math.max(0, round(controller.kp, 3)), ki: 0, kd: Math.max(0, round(controller.kd, 3)) };
  }
  return {
    kp: Math.max(0, round(controller.kp, 3)),
    ki: Math.max(0, round(controller.ki, 3)),
    kd: Math.max(0, round(controller.kd, 3)),
  };
}

function quadraticRoots(a: number, b: number, c: number): CourseComplexPoint[] {
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) < 1e-6) {
      return [];
    }
    return [{ re: round(-c / b, 3), im: 0 }];
  }
  const delta = b * b - 4 * a * c;
  if (delta >= 0) {
    const rootDelta = Math.sqrt(delta);
    return [
      { re: round((-b + rootDelta) / (2 * a), 3), im: 0 },
      { re: round((-b - rootDelta) / (2 * a), 3), im: 0 },
    ];
  }
  const rootDelta = Math.sqrt(-delta);
  return [
    { re: round(-b / (2 * a), 3), im: round(rootDelta / (2 * a), 3) },
    { re: round(-b / (2 * a), 3), im: round(-rootDelta / (2 * a), 3) },
  ];
}

export function buildOpenLoopFromController(
  controller: CruiseControllerParams = CRUISE_DEFAULT_PID,
  mode: CruiseControllerMode = 'pid'
): CourseOpenLoopModel {
  const normalized = normalizeControllerByMode(controller, mode);
  const t1Pole = round(-1 / CRUISE_ADORA_PARAMS.T1, 3);
  const t2Pole = round(-1 / CRUISE_ADORA_PARAMS.T2, 3);

  const poles: CourseComplexPoint[] = [{ re: t1Pole, im: 0 }, { re: t2Pole, im: 0 }];

  if (mode === 'p') {
    return {
      poles,
      zeros: [],
      gain: round(Math.max(CRUISE_ADORA_PARAMS.K * Math.max(normalized.kp, 1e-3), 0.001), 3),
    };
  }

  if (mode === 'pd') {
    const zeros =
      Math.abs(normalized.kd) > 1e-6
        ? [{ re: round(-normalized.kp / normalized.kd, 3), im: 0 }]
        : [];
    const gainBase =
      Math.abs(normalized.kd) > 1e-6
        ? CRUISE_ADORA_PARAMS.K * normalized.kd
        : CRUISE_ADORA_PARAMS.K * Math.max(normalized.kp, 1e-3);
    return {
      poles,
      zeros,
      gain: round(Math.max(gainBase, 0.001), 3),
    };
  }

  const pidPoles: CourseComplexPoint[] = [{ re: 0, im: 0 }, ...poles];
  const zeros = quadraticRoots(normalized.kd, normalized.kp, normalized.ki);
  let gainBase = CRUISE_ADORA_PARAMS.K;
  if (Math.abs(normalized.kd) > 1e-6) {
    gainBase *= normalized.kd;
  } else if (Math.abs(normalized.kp) > 1e-6) {
    gainBase *= normalized.kp;
  } else {
    gainBase *= Math.max(normalized.ki, 1e-3);
  }
  return {
    poles: pidPoles,
    zeros,
    gain: round(Math.max(gainBase, 0.001), 3),
  };
}

export function estimateControllerFromOpenLoop(
  poles: CourseComplexPoint[],
  zeros: CourseComplexPoint[],
  gain: number,
  mode: CruiseControllerMode,
  fallback: CruiseControllerParams = CRUISE_DEFAULT_PID
): CruiseControllerParams {
  if (mode === 'p') {
    return { kp: round(Math.max(gain / CRUISE_ADORA_PARAMS.K, 0.001), 3), ki: 0, kd: 0 };
  }

  if (mode === 'pd') {
    const kd = round(Math.max(gain / CRUISE_ADORA_PARAMS.K, 0.001), 3);
    const zero = zeros.find((item) => Math.abs(item.im) < 1e-5);
    const kp = zero ? round(Math.max(-zero.re * kd, 0.001), 3) : fallback.kp;
    return { kp, ki: 0, kd };
  }

  if (mode === 'pid') {
    const kd = round(Math.max(gain / CRUISE_ADORA_PARAMS.K, 0.001), 3);
    if (zeros.length >= 2) {
      const [z1, z2] = zeros;
      const sum = z1.re + z2.re;
      const product = z1.re * z2.re - z1.im * z2.im;
      const kp = round(Math.max(-kd * sum, 0.001), 3);
      const ki = round(Math.max(kd * product, 0.001), 3);
      return normalizeControllerByMode({ kp, ki, kd }, 'pid');
    }
    if (zeros.length === 1) {
      const kp = round(Math.max(-kd * zeros[0].re, 0.001), 3);
      return normalizeControllerByMode({ kp, ki: fallback.ki, kd }, 'pid');
    }
    return normalizeControllerByMode({ kp: fallback.kp, ki: fallback.ki, kd }, 'pid');
  }

  const complexPoles = poles.filter((pole) => Math.abs(pole.im) > 1e-5);
  if (complexPoles.length > 0) {
    return controllerFromDominantPole(complexPoles[0]);
  }
  const realPole = poles.find((pole) => pole.re < 0);
  if (!realPole) {
    return fallback;
  }
  return controllerFromDominantPole({ re: realPole.re, im: 1.2 });
}

export function scaleControllerForGain(
  controller: CruiseControllerParams,
  mode: CruiseControllerMode,
  scale: number
): CruiseControllerParams {
  const factor = Math.max(scale, 0.001);
  return normalizeControllerByMode(
    {
      kp: controller.kp * factor,
      ki: controller.ki * factor,
      kd: controller.kd * factor,
    },
    mode
  );
}
