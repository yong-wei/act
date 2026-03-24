import type { BopppsStage } from '@prisma/client';

export type L2CStageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type L2CPageType = 'display' | 'quiz' | 'form' | 'ai' | 'summary';
export type L2CTone = 'cyan' | 'sky' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

export interface L2CChoiceOption {
  value: string;
  label: string;
}

export interface L2CFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'radio';
  placeholder?: string;
  options?: L2CChoiceOption[];
}

export interface L2CQuestion {
  key: string;
  prompt: string;
  type: 'single' | 'text';
  options?: L2CChoiceOption[];
  answer?: string;
  placeholder?: string;
}

export interface L2CSection {
  title: string;
  tone?: L2CTone;
  body?: string;
  bullets?: string[];
}

export interface L2CActivity {
  kind: 'none' | 'form' | 'quiz';
  submitLabel?: string;
  helper?: string;
  fields?: L2CFormField[];
  questions?: L2CQuestion[];
}

export interface L2CContentBlock {
  kicker: string;
  title: string;
  intro: string;
  sections: L2CSection[];
  controls?: string[];
  activity?: L2CActivity;
}

export interface L2CStepDefinition {
  id: string;
  stage: L2CStageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: L2CPageType;
  mediaKey?: keyof typeof L2C_MEDIA | null;
  aiPrompts?: string[];
  teacher: L2CContentBlock;
  student: L2CContentBlock;
}

export interface L2CStepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface L2CStudentCourseState {
  kind: 'l2c_student_state';
  version: 1;
  studentName: string;
  responses: Record<string, L2CStepResponse>;
  updatedAt: number;
}

const EMPTY_ACTIVITY: L2CActivity = { kind: 'none' };

function createStep(config: {
  id: string;
  stage: L2CStageCode;
  title: string;
  duration: string;
  hint: string;
  intro: string;
  studentIntro?: string;
  sections: L2CSection[];
  controls?: string[];
  pageType?: L2CPageType;
  mediaKey?: keyof typeof L2C_MEDIA | null;
  aiPrompts?: string[];
  studentActivity?: L2CActivity;
}): L2CStepDefinition {
  return {
    id: config.id,
    stage: config.stage,
    title: config.title,
    hint: config.hint,
    duration: config.duration,
    pageType: config.pageType ?? 'display',
    mediaKey: config.mediaKey ?? null,
    aiPrompts: config.aiPrompts,
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

export const L2C_ROUTE_SEGMENT = 'l2c-frequency-bode-fasttrack';
export const L2C_PRESET_KEY = 'l2c-frequency-bode-fasttrack-v1';
export const L2C_COURSE_TITLE = 'L-2c：频域直觉速通 · Bode图与相位裕度初识';
export const L2C_COURSE_SUBTITLE = 'Frequency Intuition Fast Track';
export const L2C_COURSE_DESCRIPTION =
  '围绕 Bode 图、截止频率、相位裕度与三域联动，构建从场景直觉到频域判读再到 AI 对照的精品互动课堂。';

export const L2C_STAGE_LABEL: Record<L2CStageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const L2C_STAGE_TONE_CLASS: Record<L2CStageCode, string> = {
  B: 'premium-tone-sky',
  O: 'premium-tone-emerald',
  P1: 'premium-tone-amber',
  P2: 'premium-tone-cyan',
  P3: 'premium-tone-orange',
  S: 'premium-tone-violet',
};

export const L2C_STAGE_MAP: Record<L2CStageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const L2C_MEDIA = {
  equalizerAnalogy: '/course-runtime/lessons/legacy/L-2c/media/sh-00-equalizer-analogy.png',
  bodeMagnitudeRegions: '/course-runtime/lessons/legacy/L-2c/media/h-01-bode-magnitude-regions.svg',
  phaseMarginDiagram: '/course-runtime/lessons/legacy/L-2c/media/h-02-phase-margin-diagram.svg',
  bodeExampleAnnotated: '/course-runtime/lessons/legacy/L-2c/media/h-03-bode-example-annotated.svg',
  phaseMarginVsOvershoot: '/course-runtime/lessons/legacy/L-2c/media/sh-04-phase-margin-vs-overshoot.svg',
  threeDomainCoupling: '/course-runtime/lessons/legacy/L-2c/media/sh-05-three-domain-coupling.svg',
} as const;

export const L2C_PRE_ASSESSMENT_QUESTIONS: L2CQuestion[] = [
  {
    key: 'q1',
    prompt: '某二阶系统阻尼比 ζ = 0.5，超调量 Mp 大约是？',
    type: 'single',
    options: [
      { value: 'A', label: '约 5%' },
      { value: 'B', label: '约 16%' },
      { value: 'C', label: '约 50%' },
      { value: 'D', label: '0%（无超调）' },
    ],
    answer: 'B',
  },
  {
    key: 'q2',
    prompt: '你对“频率响应”的理解是什么？一句话描述即可。',
    type: 'text',
    placeholder: '例如：系统对不同频率输入的放大和滞后规律。',
  },
];

export const L2C_POST_ASSESSMENT_QUESTIONS: L2CQuestion[] = [
  {
    key: 'q1',
    prompt: '某系统幅频曲线在 ω = 2 rad/s 处穿越 0 dB，则截止频率是？',
    type: 'single',
    options: [
      { value: 'A', label: 'ωc = 0 rad/s' },
      { value: 'B', label: 'ωc = 2 rad/s' },
      { value: 'C', label: 'ωc = -3 dB 处' },
      { value: 'D', label: '需要看相频曲线才能确定' },
    ],
    answer: 'B',
  },
  {
    key: 'q2',
    prompt: '某系统相位裕度 γ = 20°，以下描述最准确的是？',
    type: 'single',
    options: [
      { value: 'A', label: '系统稳定，超调较小' },
      { value: 'B', label: '系统稳定，但超调较大，接近振荡边界' },
      { value: 'C', label: '系统不稳定' },
      { value: 'D', label: '完全无法判断' },
    ],
    answer: 'B',
  },
  {
    key: 'q3',
    prompt: '截止频率和穿越频率分别对应哪条曲线、哪条参考线？',
    type: 'text',
    placeholder: '写出 ωc 与 ωg 的定义对象。',
  },
];

export const L2C_LESSON_STEPS: L2CStepDefinition[] = [
  createStep({
    id: 'step-01',
    stage: 'B',
    title: '知识地图：三张面孔，今天补上频域',
    duration: '2 min',
    hint: '用三次课地图把 L-2a、L-2b 与 L-2c 连起来。',
    intro: '先把课程位置讲清楚：上两节看时域和根轨迹，这一节补上频域，下一节进入三域联动实操。',
    sections: [
      {
        title: '课程主线',
        tone: 'sky',
        bullets: ['L-2a：极点怎样决定响应', 'L-2b：增益怎样推动极点迁移', 'L-2c：频域怎样描述系统对不同节拍的反应', 'L-2d：把三张面孔放到同一个操作界面联动观察'],
      },
    ],
    controls: ['展示知识地图', '强调“第三张面孔”', '过渡到船舶场景问题'],
  }),
  createStep({
    id: 'step-02',
    stage: 'B',
    title: '场景问题：海浪会把船“压垮”吗？',
    duration: '3 min',
    hint: '从周期性扰动切入“系统对不同频率的抵抗能力”。',
    intro: '先给出音乐均衡器类比，再把问题落到船舶航向控制：同样是干扰，不同频率的海浪为什么效果不同？',
    sections: [
      {
        title: '核心问题',
        tone: 'cyan',
        body: '海浪每隔几秒就推一次船头，控制系统能抵抗哪些频率的周期性扰动，哪些又会被放大？这正是频域要回答的问题。',
      },
    ],
    controls: ['展示 sh-00 类比图', '抛出开放问题', '暂不揭晓答案'],
    mediaKey: 'equalizerAnalogy',
    pageType: 'form',
    studentActivity: {
      kind: 'form',
      submitLabel: '记录直觉',
      helper: '不计分，课程结束时会回看你现在的判断。',
      fields: [
        {
          key: 'prediction',
          label: '你猜系统能抵抗住海浪（频率约 0.6 rad/s）吗？为什么？',
          type: 'textarea',
          placeholder: '写下你此刻的直觉判断。',
        },
      ],
    },
  }),
  createStep({
    id: 'step-03',
    stage: 'O',
    title: '本节目标：从 Bode 图读出速度与稳定余量',
    duration: '3 min',
    hint: '把截止频率、相位裕度、幅值裕度和三域联动目标一次讲清。',
    intro: '学完本节，你应该能从一张 Bode 图读出系统快慢、稳定余量，并把频域信息联到 L-2a 和 L-2b 的结论。',
    sections: [
      {
        title: '学习目标',
        tone: 'emerald',
        bullets: ['说出 Bode 幅频图的通过区、过渡区、衰减区和截止频率 ωc 的含义', '从图上读出截止频率与相位裕度，并用 γ≈100ζ° 预判超调量范围', '明确 ωc 与 ωg 是两个不同的频率', '说出相位裕度和幅值裕度各衡量什么风险'],
      },
    ],
    controls: ['逐条揭示目标', '最后强调 ωc 与 ωg 的区别'],
  }),
  createStep({
    id: 'step-04',
    stage: 'P1',
    title: '前测：先唤醒阻尼比与超调量',
    duration: '5 min',
    hint: '用一道单选和一道开放题确认学生已有的时域基础。',
    intro: '先看班级是否还记得 L-2a / L-2b 的 ζ 与超调量关系，再顺势暴露大家对“频率响应”一词的起点理解。',
    sections: [
      {
        title: '教师关注点',
        tone: 'amber',
        bullets: ['若题 1 正确率偏低，进入新内容前先口头复盘 ζ 与 Mp', '开放题重点看学生是否把“频率响应”误解为“响应的频率”'],
      },
    ],
    controls: ['释放题目', '查看实时分布', '按需复盘后进入下一页'],
    pageType: 'quiz',
    studentActivity: {
      kind: 'quiz',
      submitLabel: '提交前测',
      helper: '第 1 题有标准答案，第 2 题用于摸底，不计分。',
      questions: L2C_PRE_ASSESSMENT_QUESTIONS,
    },
  }),
  createStep({
    id: 'step-05',
    stage: 'P2',
    title: 'Bode 幅频图：系统的“频率简历”',
    duration: '8 min',
    hint: '建立“低频跟踪、高频过滤”的第一直觉。',
    intro: '把幅频图看成系统面对不同节拍时给出的简历：低频跟得上，高频会被过滤，中间有个门槛叫截止频率。',
    sections: [
      {
        title: '三个区域',
        tone: 'cyan',
        bullets: ['通过区：低频信号输入≈输出', '过渡区：开始跟不上，幅值快速下降', '衰减区：高频振动被明显过滤'],
      },
      {
        title: '直觉关键词',
        tone: 'sky',
        bullets: ['0 dB：放大倍数为 1', '正 dB：放大', '负 dB：衰减', 'ωc：从“跟得上”切换到“开始跟不上”的门槛'],
      },
    ],
    controls: ['分 4 次揭示类比、三区域、ωc 定义、船舶场景结论'],
    mediaKey: 'bodeMagnitudeRegions',
  }),
  createStep({
    id: 'step-06',
    stage: 'P2',
    title: '截止频率 ωc：响应速度的频域标志',
    duration: '7 min',
    hint: '把 ωc 与调节时间 ts 建立跨域对应。',
    intro: '截止频率不是一张图上的装饰，它是系统快慢在频域里的说法。ωc 变大，通常意味着系统变快，但也会带来新的权衡。',
    sections: [
      {
        title: '跨域联动',
        tone: 'emerald',
        bullets: ['ωc ↑ ⇔ ts ↓ ⇔ 系统更快', '速度变快不等于无条件更好，往往会挤压稳定余量'],
      },
      {
        title: '工程权衡',
        tone: 'amber',
        body: '船舶控制既要快，也要稳。只追求更高的 ωc，通常会让相位裕度变小，超调变大。',
      },
    ],
    controls: ['先建立速度直觉', '再提示“ωc 变大不一定越好”', '给出船舶量级感知'],
    pageType: 'form',
    studentActivity: {
      kind: 'form',
      submitLabel: '保存预判',
      helper: '这条预判会在下一页 AI 探索环节里回显。',
      fields: [
        {
          key: 'speed-judgement',
          label: '如果把截止频率从 0.05 提高到 0.1 rad/s，调节时间会怎样变化？为什么？',
          type: 'textarea',
          placeholder: '例如：会变短，因为……',
        },
      ],
    },
  }),
  createStep({
    id: 'step-07',
    stage: 'P2',
    title: '[AI 探索①] 用 AI 验证 ωc 与调节时间的关系',
    duration: '7 min',
    hint: '让学生先看自己的预判，再向页内 AI 提问并对照。',
    intro: '这一页不是替代思考，而是让学生先有预判，再用 AI 验证“截止频率增大是否意味着调节时间缩短”。',
    sections: [
      {
        title: '探索任务',
        tone: 'violet',
        bullets: ['先回看你上一页写下的判断', '再向页内 AI 询问 ωc 与 ts 的近似关系', '最后判断自己是完全正确、方向正确还是需要修正'],
      },
    ],
    controls: ['等待大多数学生完成', '收拢全班讨论“AI 说了什么，哪里有保留条件”'],
    pageType: 'ai',
    aiPrompts: [
      '二阶控制系统中，截止频率ωc与调节时间ts之间有怎样的近似关系？',
      'ωc增大时ts如何变化？请给出定性解释和近似公式。',
    ],
    studentActivity: {
      kind: 'form',
      submitLabel: '保存探索记录',
      helper: '先自己想，再用 AI 验证。AI 给出的“条件”也要记录下来。',
      fields: [
        {
          key: 'ai-note',
          label: '摘录 AI 的核心结论',
          type: 'textarea',
          placeholder: '例如：ωc 增大通常意味着 ts 变短，但这只是粗略近似……',
        },
        {
          key: 'compare',
          label: '你的判断和 AI 的结论一致吗？',
          type: 'radio',
          options: [
            { value: 'same', label: '完全一致' },
            { value: 'partial', label: '方向一致，但细节有偏差' },
            { value: 'diff', label: '我原先判断错了' },
          ],
        },
      ],
    },
  }),
  createStep({
    id: 'step-08',
    stage: 'P2',
    title: '记忆唤醒：第一轮速通中的两个裕度',
    duration: '3 min',
    hint: '先唤醒旧表达，再在下一页给精确定义。',
    intro: '先把第一轮速通留下的模糊印象叫回来：相位裕度是“相角离危险边界还有多远”，幅值裕度是“增益离危险边界还有多远”。',
    sections: [
      {
        title: '旧表达回看',
        tone: 'slate',
        bullets: ['相位裕度：幅值不增不减时，相角离 -180° 还有多远', '幅值裕度：系统已经实际反向时，幅值离 0 dB 还有多远'],
      },
    ],
    controls: ['先口头提问 3~5 秒', '再展示回顾卡片'],
    pageType: 'form',
    studentActivity: {
      kind: 'form',
      submitLabel: '保存印象',
      helper: '这是一条可选记录，用来帮助你回想旧知识。',
      fields: [
        {
          key: 'memory',
          label: '你现在对“相位裕度”的第一印象是什么？',
          type: 'text',
          placeholder: '一句话即可。',
        },
      ],
    },
  }),
  createStep({
    id: 'step-09',
    stage: 'P2',
    title: '相位裕度 γ：在哪里量、量什么',
    duration: '8 min',
    hint: '在 ωc 处量与 -180° 的差值，并引出工程经验范围。',
    intro: '相位裕度的核心不是公式本身，而是先认清“在哪里量”。只要位置对了，公式自然就有意义。',
    sections: [
      {
        title: '精确定义',
        tone: 'cyan',
        bullets: ['相位裕度在截止频率 ωc 处测量', 'γ = 180° + ∠G(jωc)', 'γ > 0 表示仍有相位余量，γ = 0 是临界振荡'],
      },
      {
        title: '工程经验',
        tone: 'emerald',
        bullets: ['30°~60° 是常用良好范围', '45° 往往是速度与稳定性折中的典型点'],
      },
    ],
    controls: ['先回顾失稳条件', '再给出 ωc 位置和 γ 的定义', '最后落到工程经验值'],
    mediaKey: 'phaseMarginDiagram',
    pageType: 'form',
    studentActivity: {
      kind: 'form',
      submitLabel: '保存随堂记录',
      fields: [
        {
          key: 'pm-note',
          label: '用自己的话写下相位裕度的定义',
          type: 'textarea',
          placeholder: '例如：在截止频率处，相角离 -180° 的差值。',
        },
      ],
    },
  }),
  createStep({
    id: 'step-10',
    stage: 'P2',
    title: '幅值裕度 Kg：另一维稳定余量',
    duration: '5 min',
    hint: '明确 ωg 是相频曲线穿越 -180° 的频率。',
    intro: '除了相位余量，还要看增益余量。幅值裕度回答的是：相位已经危险时，增益还能被放大多少倍才会真正失稳。',
    sections: [
      {
        title: '关键区分',
        tone: 'amber',
        bullets: ['ωg：相频曲线穿越 -180° 的频率', 'Kg：在 ωg 处，幅值距离 0 dB 还有多远', '工程上常要求 Kg ≥ 6 dB'],
      },
    ],
    controls: ['引入 ωg', '给出 Kg 定义', '强调 Kg 与 γ 不可互相替代'],
  }),
  createStep({
    id: 'step-11',
    stage: 'P2',
    title: '两个频率要分清：ωc ≠ ωg',
    duration: '4 min',
    hint: '用一页整合卡片彻底防止把两个特征频率混掉。',
    intro: '这一页只做一件事：把“哪条曲线穿哪条参考线，对应哪个裕度”彻底分开。',
    sections: [
      {
        title: '对照记忆',
        tone: 'rose',
        bullets: ['ωc：幅频曲线穿越 0 dB，用来定义相位裕度 γ', 'ωg：相频曲线穿越 -180°，用来定义幅值裕度 Kg'],
      },
    ],
    controls: ['整页强调一次', '口头抽答 1~2 人复述'],
    pageType: 'form',
    studentActivity: {
      kind: 'form',
      submitLabel: '保存对照',
      fields: [
        {
          key: 'wc-vs-wg',
          label: '写一句你区分 ωc 和 ωg 的记忆口诀',
          type: 'text',
          placeholder: '例如：幅频过零看 ωc，相频过 -180° 看 ωg。',
        },
      ],
    },
  }),
  createStep({
    id: 'step-12',
    stage: 'P2',
    title: '[AI 探索②] 用 γ≈100ζ° 预测超调量',
    duration: '7 min',
    hint: '先算再问 AI，再对比近似关系的有效范围。',
    intro: '这一步把频域和时域真正接起来：先用 γ≈100ζ° 做粗估，再看 AI 是否给出相近的超调量判断。',
    sections: [
      {
        title: '探索任务',
        tone: 'violet',
        bullets: ['先自己估：γ = 45° 时，ζ 与 Mp 大约是多少', '再向 AI 询问相位裕度和超调量的关系', '比较 AI 结论与近似公式是否一致'],
      },
    ],
    controls: ['提醒学生先独立估算', 'AI 结果回来后再组织全班对照'],
    pageType: 'ai',
    aiPrompts: [
      '二阶系统相位裕度45度时，超调量大约是多少？请给出解释。',
      'γ≈100ζ° 这个近似通常在什么范围内可靠？',
    ],
    studentActivity: {
      kind: 'form',
      submitLabel: '保存 AI 对照',
      helper: '先自己估算，再把 AI 给出的结论与条件记下来。',
      fields: [
        {
          key: 'rough-estimate',
          label: '你在问 AI 之前，自己估的超调量范围是多少？',
          type: 'text',
          placeholder: '例如：大约 20% 左右。',
        },
        {
          key: 'ai-compare',
          label: 'AI 的结论与你的估算差异在哪里？',
          type: 'textarea',
          placeholder: '记录 AI 的结论、你的修正点和适用条件。',
        },
      ],
    },
  }),
  createStep({
    id: 'step-13',
    stage: 'P2',
    title: 'γ≈100ζ°：频域与时域的快速通道',
    duration: '6 min',
    hint: '把相位裕度、阻尼比和超调量放到同一张图里看。',
    intro: '相位裕度增大，通常意味着阻尼比变大、超调量变小。对二阶系统来说，这条通道足够让你做快速工程预判。',
    sections: [
      {
        title: '快通道结论',
        tone: 'emerald',
        bullets: ['γ ↑ ⇒ ζ ↑ ⇒ Mp ↓', 'γ≈45° 时，ζ≈0.45，超调约 20%', '这是工程近似，不是放之四海皆准的精确等式'],
      },
    ],
    controls: ['结合图示讲 30° / 45° / 60° 三个参考点', '提醒学生近似适用范围'],
    mediaKey: 'phaseMarginVsOvershoot',
  }),
  createStep({
    id: 'step-14',
    stage: 'P2',
    title: '三张面孔汇聚：极点、时域、频域',
    duration: '8 min',
    hint: '把 L-2a、L-2b、L-2c 的三条线索归到同一个三角框架里。',
    intro: '同一个系统，只是从三个窗口看：极点位置决定时域响应，也通过阻尼比联到频域稳定余量。',
    sections: [
      {
        title: '三域联动',
        tone: 'sky',
        bullets: ['极点 ↔ 时域：ζ、ωn 决定 Mp、ts', '极点 ↔ 频域：γ≈100ζ°', '频域 ↔ 时域：通过 ζ 这座桥连接'],
      },
    ],
    controls: ['展示三角图', '强调“改变一个参数，三张面孔会一起动”'],
    mediaKey: 'threeDomainCoupling',
    pageType: 'form',
    studentActivity: {
      kind: 'form',
      submitLabel: '保存框架',
      fields: [
        {
          key: 'bridge',
          label: '用一句话概括：阻尼比 ζ 为什么是三域桥梁？',
          type: 'textarea',
          placeholder: '例如：ζ 同时决定超调量和相位裕度的量级。',
        },
      ],
    },
  }),
  createStep({
    id: 'step-15',
    stage: 'P2',
    title: '例题读图：从一张 Bode 图快速判断系统表现',
    duration: '7 min',
    hint: '把 ωc、γ 和超调量预测串成一个完整流程。',
    intro: '最后用一张带标注的 Bode 图，把“读出截止频率 → 读出相位 → 算相位裕度 → 预判超调量”完整走一遍。',
    sections: [
      {
        title: '解题步骤',
        tone: 'cyan',
        bullets: ['先在幅频图上找 0 dB 穿越点，得到 ωc', '再在相频图读出 ωc 处的相角', '用 γ = 180° + ∠G(jωc) 算出相位裕度', '再用 γ≈100ζ° 粗估超调量'],
      },
    ],
    controls: ['分 3 步揭示例题图上的读图标记', '点名让学生口头报出 γ 和超调量范围'],
    mediaKey: 'bodeExampleAnnotated',
    pageType: 'form',
    studentActivity: {
      kind: 'form',
      submitLabel: '提交例题结果',
      fields: [
        {
          key: 'example-answer',
          label: '写出你读到的 ωc、γ 和超调量范围',
          type: 'textarea',
          placeholder: '例如：ωc≈0.05 rad/s，γ≈45°，超调约 20%~25%。',
        },
      ],
    },
  }),
  createStep({
    id: 'step-16',
    stage: 'P3',
    title: '后测：能否独立区分 ωc、ωg 与稳定余量',
    duration: '7 min',
    hint: '用 2 道单选 + 1 道开放题回收本节目标。',
    intro: '现在回到出口票：截止频率、相位裕度、幅值裕度和两个特征频率，你是否已经能用自己的语言说清楚？',
    sections: [
      {
        title: '教师关注点',
        tone: 'amber',
        bullets: ['看学生是否还会把 ωc 和 ωg 混掉', '开放题重点关注是否能说出“哪条曲线穿哪条线”'],
      },
    ],
    controls: ['释放后测', '查看实时统计', '揭示答案并挑选出口问题'],
    pageType: 'quiz',
    studentActivity: {
      kind: 'quiz',
      submitLabel: '提交后测',
      helper: '提交后可等待教师揭示正确答案。',
      questions: L2C_POST_ASSESSMENT_QUESTIONS,
    },
  }),
  createStep({
    id: 'step-17',
    stage: 'S',
    title: '总结：三张面孔已齐，准备进入 L-2d 实操',
    duration: '5 min',
    hint: '回收 step-02 的直觉判断，并预告下一课三域联动操作。',
    intro: '最后回到最初的船舶问题：你现在是否能用频域语言解释系统为什么能过滤某些海浪节拍？',
    sections: [
      {
        title: '本节收获',
        tone: 'violet',
        bullets: ['Bode 图告诉你系统对不同频率信号的选择性', 'ωc 是快慢门槛，γ 和 Kg 是稳定余量', '三张面孔分别是时域、复平面、频域，它们描述的是同一个系统'],
      },
    ],
    controls: ['回看 step-02 预测', '预告 L-2d 三域联动实操'],
    pageType: 'summary',
    studentActivity: {
      kind: 'form',
      submitLabel: '保存总结',
      fields: [
        {
          key: 'takeaway',
          label: '写一句你准备带到 L-2d 的核心判断标准',
          type: 'textarea',
          placeholder: '例如：先看 ωc 判断快慢，再看 γ 与 Kg 判断余量。',
        },
      ],
    },
  }),
];

export const L2C_STEP_DURATION = Object.fromEntries(L2C_LESSON_STEPS.map((step) => [step.id, step.duration])) as Record<string, string>;

export function createEmptyL2CStudentState(studentName: string): L2CStudentCourseState {
  return {
    kind: 'l2c_student_state',
    version: 1,
    studentName,
    responses: {},
    updatedAt: Date.now(),
  };
}

export function getL2CStep(stepId: string) {
  return L2C_LESSON_STEPS.find((step) => step.id === stepId) ?? L2C_LESSON_STEPS[0];
}

export function getL2CMediaSrc(mediaKey?: keyof typeof L2C_MEDIA | null) {
  if (!mediaKey) {
    return null;
  }
  return L2C_MEDIA[mediaKey] ?? null;
}

export const L2C_PREMIUM_LESSON_CARD = {
  id: 'l2c-frequency-bode-fasttrack',
  title: L2C_COURSE_TITLE,
  description: '精品互动课：Bode 图、截止频率、稳定裕度与三域联动的频域直觉速通。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${L2C_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;
