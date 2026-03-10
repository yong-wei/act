import type { BopppsStage } from '@prisma/client';

export type L2AStageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type L2ATone = 'cyan' | 'sky' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

export interface L2ALessonStep {
  id: string;
  stage: L2AStageCode;
  title: string;
  hint: string;
}

export interface L2AChoiceOption {
  value: string;
  label: string;
}

export interface L2AFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'radio' | 'checkbox-group';
  placeholder?: string;
  help?: string;
  options?: L2AChoiceOption[];
}

export interface L2AQuestion {
  key: string;
  prompt: string;
  type: 'single' | 'multi' | 'text';
  options?: L2AChoiceOption[];
  answer?: string | string[];
  placeholder?: string;
}

export interface L2AStudentActivity {
  kind: 'none' | 'form' | 'quiz';
  submitLabel?: string;
  helper?: string;
  fields?: L2AFormField[];
  questions?: L2AQuestion[];
}

export interface L2AContentSection {
  title: string;
  tone?: L2ATone;
  body?: string;
  bullets?: string[];
}

export interface L2AStepContent {
  kicker: string;
  title: string;
  intro: string;
  sections: L2AContentSection[];
  controls?: string[];
  activity?: L2AStudentActivity;
}

export interface L2AStepDefinition extends L2ALessonStep {
  duration: string;
  teacher: L2AStepContent;
  student: L2AStepContent;
}

export interface L2AWorkspaceSnapshot {
  zeta: number;
  wn: number;
  selectedPreset: string | null;
  lastMeasuredAt: number | null;
}

export interface L2AStepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string | string[]>;
}

export interface L2AStudentCourseState {
  kind: 'l2a_student_state';
  version: 1;
  studentName: string;
  workspace: L2AWorkspaceSnapshot;
  responses: Record<string, L2AStepResponse>;
  updatedAt: number;
}

export const L2A_ROUTE_SEGMENT = 'l2a-time-domain-fasttrack';
export const L2A_PRESET_KEY = 'l2a-time-domain-fasttrack-v1';
export const L2A_COURSE_TITLE = 'L-2a：三张面孔，同一系统 · 时域直觉速通';
export const L2A_COURSE_SUBTITLE = 'Time-Domain Intuition Fast Track';
export const L2A_COURSE_DESCRIPTION =
  '围绕船舶航向阶跃响应，在 18 个环节中建立“极点位置 → 曲线家族 → 三指标 → 两参数 → 时域局限”的直觉链路。';

export const L2A_STAGE_LABEL: Record<L2AStageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const L2A_STAGE_COLOR: Record<L2AStageCode, string> = {
  B: 'border-sky-300/35 bg-sky-500/10 text-sky-100',
  O: 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100',
  P1: 'border-amber-300/35 bg-amber-500/10 text-amber-100',
  P2: 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100',
  P3: 'border-orange-300/35 bg-orange-500/10 text-orange-100',
  S: 'border-violet-300/35 bg-violet-500/10 text-violet-100',
};

export const L2A_STAGE_MAP: Record<L2AStageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const L2A_SELF_RATING_OPTIONS: L2AChoiceOption[] = [
  { value: 'novice', label: '完全陌生，从零开始' },
  { value: 'fuzzy', label: '有一点印象，不确定' },
  { value: 'aware', label: '大致了解，期待确认' },
  { value: 'confident', label: '已经很熟悉了' },
];

export const L2A_PRE_ASSESSMENT_QUESTIONS: L2AQuestion[] = [
  {
    key: 'q1',
    prompt: '一个系统的极点在复平面右半平面，它的阶跃响应会：',
    type: 'single',
    options: [
      { value: 'A', label: '振荡后稳定' },
      { value: 'B', label: '单调上升到目标值' },
      { value: 'C', label: '发散不稳定' },
      { value: 'D', label: '保持不变' },
    ],
    answer: 'C',
  },
  {
    key: 'q2',
    prompt: '你认为“超调量”描述的是：',
    type: 'single',
    options: [
      { value: 'A', label: '响应到达目标值的速度' },
      { value: 'B', label: '响应冲过目标值的程度' },
      { value: 'C', label: '响应最终的稳态误差' },
      { value: 'D', label: '响应开始振荡的频率' },
    ],
    answer: 'B',
  },
  {
    key: 'q3',
    prompt: '你觉得哪些因素影响系统响应的快慢？',
    type: 'multi',
    options: [
      { value: 'A', label: '系统本身的某个参数' },
      { value: 'B', label: '输入信号的大小' },
      { value: 'C', label: '控制器的设计' },
      { value: 'D', label: '我还不知道' },
    ],
    answer: ['A', 'C'],
  },
];

export const L2A_POST_ASSESSMENT_QUESTIONS: L2AQuestion[] = [
  {
    key: 'q1',
    prompt: '下列哪个描述对应“欠阻尼稳定”系统的阶跃响应？',
    type: 'single',
    options: [
      { value: 'A', label: '单调上升，无超调' },
      { value: 'B', label: '振荡衰减，有超调' },
      { value: 'C', label: '等幅持续振荡' },
      { value: 'D', label: '响应发散' },
    ],
    answer: 'B',
  },
  {
    key: 'q2',
    prompt: 'tₛ（调节时间）描述的是：',
    type: 'single',
    options: [
      { value: 'A', label: '响应从 0% 到 100% 的时间' },
      { value: 'B', label: '响应超过目标值的程度' },
      { value: 'C', label: '响应进入 ±2% 范围并保持的时刻' },
      { value: 'D', label: '响应的振荡周期' },
    ],
    answer: 'C',
  },
  {
    key: 'q3',
    prompt: '保持 ωₙ 不变，将 ζ 从 0.3 增大到 0.7，超调量 Mₚ 会：',
    type: 'single',
    options: [
      { value: 'A', label: '增大' },
      { value: 'B', label: '减小' },
      { value: 'C', label: '不变' },
      { value: 'D', label: '先增后减' },
    ],
    answer: 'B',
  },
  {
    key: 'q4',
    prompt: '用一句话说明：为什么时域响应不能直接告诉你“如何设计控制器”？',
    type: 'text',
    placeholder: '80 字以内写下你的反思',
  },
];

export const L2A_LESSON_STEPS: L2AStepDefinition[] = [
  {
    id: 'knowledge-map',
    stage: 'B',
    title: '知识图谱定位',
    hint: '回到知识图谱，确认 L-2a 在“时域”链路中的位置。',
    duration: '0.5 min',
    teacher: {
      kicker: 'BRIDGE IN · 0.5 min',
      title: '知识图谱定位',
      intro: '用一页知识图谱把“传递函数与极点”过渡到“时域直觉”。',
      sections: [
        {
          title: '教师口述主线',
          tone: 'sky',
          bullets: [
            '上节课 L-1：认识传递函数与极点。',
            '今天：第一张面孔是时域，直接看系统行为曲线。',
            '后续：L-2b 根轨迹、L-2c 频域会继续补足设计视角。',
          ],
        },
      ],
      controls: ['点击“开始本节课”后进入下一环节'],
    },
    student: {
      kicker: 'START · 0.5 min',
      title: '点亮今天的知识节点',
      intro: '今天你会把“曲线家族、三指标、两参数、时域局限”串成一条完整链路。',
      sections: [
        {
          title: '本节将点亮',
          tone: 'cyan',
          bullets: ['阶跃响应家族', '超调量 Mₚ', '调节时间 tₛ', '上升时间 tᵣ', '阻尼比 ζ', '自然频率 ωₙ'],
        },
      ],
      activity: { kind: 'none' },
    },
  },
  {
    id: 'bridge-in-1',
    stage: 'B',
    title: '导入：情境展示',
    hint: '从船舶转向曲线出发，让学生先用自然语言观察系统行为。',
    duration: '4 min',
    teacher: {
      kicker: 'BRIDGE IN · 4 min',
      title: '先看故事，再谈公式',
      intro: '播放船舶转向情境，定格在航向阶跃响应曲线，先让学生观察。',
      sections: [
        {
          title: '教师提问',
          tone: 'sky',
          body: '“这条曲线，你能读出几件事？先不要说答案，思考 30 秒。”',
        },
        {
          title: '操作顺序',
          tone: 'slate',
          bullets: ['播放情境视频或动画', '切到航向阶跃响应图', '随机抽答 2-3 人', '不评价对错，只记录观察'],
        },
      ],
      controls: ['播放视频', '切换曲线图', '抽答 2-3 人'],
    },
    student: {
      kicker: 'OBSERVE · 4 min',
      title: '你先像工程师一样描述现象',
      intro: '请先观察曲线，再用 1-3 句话写下你看到的行为特征。',
      sections: [
        {
          title: '关注什么',
          tone: 'cyan',
          bullets: ['有没有冲过目标值？', '有没有振荡？', '什么时候才真正稳定？'],
        },
      ],
      activity: {
        kind: 'form',
        submitLabel: '提交观察',
        helper: '提交后教师端会显示若干代表性回答。',
        fields: [
          {
            key: 'observation',
            label: '从这条曲线中，你能读出哪些信息？',
            type: 'textarea',
            placeholder: '例如：先快速上升，冲过目标值，随后振荡衰减，最后稳定下来。',
          },
        ],
      },
    },
  },
  {
    id: 'bridge-in-2',
    stage: 'B',
    title: '导入：情境收拢',
    hint: '把学生观察收束为“家族、指标、参数”三条主线。',
    duration: '2 min',
    teacher: {
      kicker: 'BRIDGE IN · 2 min',
      title: '从自由观察收束到今天的任务',
      intro: '把大家的自然语言描述压缩成今天要解决的三件事。',
      sections: [
        {
          title: '三条主线',
          tone: 'sky',
          bullets: ['曲线形状：它属于哪一类响应家族？', '曲线特征：怎样用数字描述它？', '曲线成因：什么参数决定它的形状？'],
        },
      ],
      controls: ['展示代表性回答', '逐步揭示三条主线'],
    },
    student: {
      kicker: 'FOCUS · 2 min',
      title: '把观察变成任务',
      intro: '今天的学习会围绕“家族、指标、参数”三件事依次展开。',
      sections: [
        {
          title: '今天要完成',
          tone: 'cyan',
          bullets: ['认识四种曲线家族', '掌握三个性能指标', '理解两个关键参数'],
        },
      ],
      activity: {
        kind: 'form',
        submitLabel: '确认已准备好',
        fields: [{ key: 'ready', label: '你准备好了吗？', type: 'radio', options: [{ value: 'yes', label: '已准备好 ✓' }] }],
      },
    },
  },
  {
    id: 'objective',
    stage: 'O',
    title: '今天的目标',
    hint: '明确今天只建直觉，不做公式推导。',
    duration: '2 min',
    teacher: {
      kicker: 'OBJECTIVE · 2 min',
      title: '今天不算式子，只建立直觉',
      intro: '用四个目标限定学习边界，让学生知道今天解决什么、不解决什么。',
      sections: [
        {
          title: '四项目标',
          tone: 'emerald',
          bullets: [
            '看一条阶跃响应曲线，说出它属于哪种家族',
            '知道 Mₚ、tₛ、tᵣ 各自描述什么',
            '能说出 ζ 和 ωₙ 如何影响曲线形状',
            '知道时域视角的局限，以及后两节课要补什么',
          ],
        },
      ],
      controls: ['发布目标', '查看学生自评分布'],
    },
    student: {
      kicker: 'OBJECTIVE · 2 min',
      title: '先给自己一个起点判断',
      intro: '完成自评后，后面你能更清楚地看到自己从哪里进步。',
      sections: [
        {
          title: '提醒',
          tone: 'emerald',
          body: '今天只建直觉，不要求当场推导公式。真正重要的是把“曲线语言”读明白。',
        },
      ],
      activity: {
        kind: 'form',
        submitLabel: '提交自评',
        helper: '教师端会匿名汇总大家的自评起点。',
        fields: [{ key: 'selfRating', label: '你现在对这些内容的了解程度？', type: 'radio', options: L2A_SELF_RATING_OPTIONS }],
      },
    },
  },
  {
    id: 'pre-assessment',
    stage: 'P1',
    title: '前测',
    hint: '用 3 题摸底 L-1 稳定性记忆与超调直觉。',
    duration: '5 min',
    teacher: {
      kicker: 'PRE-ASSESSMENT · 5 min',
      title: '先摸清大家现在站在哪里',
      intro: '前测不计分，只为教师调整节奏。',
      sections: [
        {
          title: '教学调整提示',
          tone: 'amber',
          bullets: ['题 1 错误率 > 40%：快速补回 L-1 极点稳定性结论', '题 2 若多数选 A/C：说明“超调”的直觉尚未建立，需要再解读一次曲线'],
        },
      ],
      activity: {
        kind: 'quiz',
        questions: L2A_PRE_ASSESSMENT_QUESTIONS,
      },
    },
    student: {
      kicker: 'PRE-ASSESSMENT · 5 min',
      title: '前测：帮教师了解你的起点',
      intro: '3 题都不计分，重点是把你当前的真实想法交出来。',
      sections: [],
      activity: {
        kind: 'quiz',
        submitLabel: '提交前测',
        helper: '多选题可多选，提交后会锁定。',
        questions: L2A_PRE_ASSESSMENT_QUESTIONS,
      },
    },
  },
  {
    id: 'participatory-intro-1',
    stage: 'P2',
    title: '过渡：引入四种家族',
    hint: '把左侧工作区与“极点位置决定形态”建立直接联系。',
    duration: '1 min',
    teacher: {
      kicker: 'PARTICIPATORY · 1 min',
      title: '第一件事：先认识四种曲线家族',
      intro: '告诉学生左侧工作区不是装饰，而是今天理解“极点位置 → 曲线形态”的核心工具。',
      sections: [
        {
          title: '要点',
          tone: 'cyan',
          bullets: ['极点在复平面的不同区域，会产生不同曲线家族', '左侧工作区现在开始全程在线', '先观察，再命名，不急着背术语'],
        },
      ],
      controls: ['播放 15 秒过渡动画', '继续进入家族图示'],
    },
    student: {
      kicker: 'PARTICIPATORY · 1 min',
      title: '先把左侧工作区玩起来',
      intro: '试着调参数或拖极点，让你看到曲线确实会换“性格”。',
      sections: [
        {
          title: '小提示',
          tone: 'cyan',
          body: '你不需要记公式，只要建立“极点位置 → 曲线形态”的直觉。',
        },
      ],
      activity: { kind: 'none' },
    },
  },
  {
    id: 'participatory-families-1',
    stage: 'P2',
    title: '四种响应家族：图示',
    hint: '从图示中认识过阻尼、欠阻尼、临界阻尼与不稳定。',
    duration: '8 min',
    teacher: {
      kicker: 'PARTICIPATORY · 8 min',
      title: '四种家族：先看形，再给名',
      intro: '用同一套坐标把四种典型响应放在一起，帮助学生建立整体对比。',
      sections: [
        {
          title: '四个家族',
          tone: 'cyan',
          bullets: [
            '过阻尼：单调上升，无超调，较慢到位',
            '欠阻尼：振荡衰减，有超调，工程最常见',
            '临界阻尼：单调上升，无超调，是无超调中最快的',
            '不稳定：发散，不收敛',
          ],
        },
      ],
      controls: ['遮住标签先展示曲线', '依次揭示正式名称', '高亮“欠阻尼最常见”'],
    },
    student: {
      kicker: 'PARTICIPATORY · 8 min',
      title: '给每种曲线起一个工程外号',
      intro: '先用你自己的语言给四种曲线命名，再对照正式术语。',
      sections: [],
      activity: {
        kind: 'form',
        submitLabel: '提交命名',
        fields: [
          { key: 'family1', label: '家族①（单调、慢）', type: 'text', placeholder: '例如：老实型 / 保守型' },
          { key: 'family2', label: '家族②（振荡衰减）', type: 'text', placeholder: '例如：活跃型 / 运动员型' },
          { key: 'family3', label: '家族③（单调、最快）', type: 'text', placeholder: '例如：恰好型 / 一步到位型' },
          { key: 'family4', label: '家族④（发散）', type: 'text', placeholder: '例如：失控型 / 越跑越远型' },
        ],
      },
    },
  },
  {
    id: 'participatory-families-2',
    stage: 'P2',
    title: '四种家族：工作区自由探索',
    hint: '让学生在工作区中亲自找到四种家族的极点区域。',
    duration: '4 min',
    teacher: {
      kicker: 'PARTICIPATORY · 4 min',
      title: '把“名字”变成“位置记忆”',
      intro: '此时教师只需要巡视，不要替学生完成观察。',
      sections: [
        {
          title: '巡视重点',
          tone: 'sky',
          bullets: ['谁能说出“穿过虚轴”意味着什么？', '谁能找到“极点靠近虚轴，超调增大”的证据？', '谁把四种家族和极点区域对上了'],
        },
      ],
      controls: ['展示学生命名汇总', '强调“阻尼就是耗散能力”'],
    },
    student: {
      kicker: 'PARTICIPATORY · 4 min',
      title: '在左侧工作区做三次探索',
      intro: '真正把“极点区域”和“曲线家族”一一对应起来。',
      sections: [],
      activity: {
        kind: 'form',
        submitLabel: '保存探索记录',
        fields: [
          { key: 'region', label: '极点在什么位置时，曲线超调最大？', type: 'text', placeholder: '例如：靠近虚轴且有较大虚部' },
          { key: 'crossImaginary', label: '穿过虚轴的瞬间，曲线会怎样？', type: 'text', placeholder: '例如：从衰减振荡变成不收敛甚至发散' },
          { key: 'discovery', label: '你最关键的一条发现', type: 'textarea', placeholder: '一句话写下你的结论' },
        ],
      },
    },
  },
  {
    id: 'participatory-intro-2',
    stage: 'P2',
    title: '过渡：引入三个指标',
    hint: '把“形状描述”升级到“量化描述”。',
    duration: '1 min',
    teacher: {
      kicker: 'PARTICIPATORY · 1 min',
      title: '第二件事：工程师要用数字说话',
      intro: '从“这条曲线像什么”切到“这条曲线到底好不好用”。',
      sections: [
        {
          title: '三个问题',
          tone: 'cyan',
          bullets: ['冲了多高？', '多久稳定？', '起步有多快？'],
        },
      ],
      controls: ['释放预热问题', '继续进入三指标定义'],
    },
    student: {
      kicker: 'PARTICIPATORY · 1 min',
      title: '先凭直觉做一次工程排序',
      intro: '不同场景对“快、稳、冲”的取舍并不一样。',
      sections: [],
      activity: {
        kind: 'form',
        submitLabel: '提交直觉排序',
        fields: [
          {
            key: 'priority',
            label: '对于一艘船，下面哪个最重要？',
            type: 'radio',
            options: [
              { value: 'overshoot', label: '转向时头冲出去多少（超调）' },
              { value: 'settling', label: '多长时间完成转向并稳定' },
              { value: 'rise', label: '开始转向后多快达到目标角度' },
            ],
          },
          { key: 'reason', label: '简单说明理由', type: 'text', placeholder: '1 句话即可' },
        ],
      },
    },
  },
  {
    id: 'participatory-metrics-1',
    stage: 'P2',
    title: '三个性能指标：定义',
    hint: '在同一条曲线上标出 Mₚ、tₛ、tᵣ 的位置和含义。',
    duration: '10 min',
    teacher: {
      kicker: 'PARTICIPATORY · 10 min',
      title: 'Mₚ、tₛ、tᵣ：同一条曲线上的三把尺子',
      intro: '今天只要把符号和工程含义对上，不做推导。',
      sections: [
        {
          title: '工程含义',
          tone: 'cyan',
          bullets: ['Mₚ：船头冲过目标航向的程度', 'tₛ：多久才算真正稳定', 'tᵣ：从起步到“有明显动作”需要多久'],
        },
        {
          title: '课堂追问',
          tone: 'amber',
          body: '“客船 vs 海巡船，你更在乎哪个指标？为什么？”',
        },
      ],
      controls: ['依次标注 Mₚ / tₛ / tᵣ', '发起客船 vs 海巡船追问'],
    },
    student: {
      kicker: 'PARTICIPATORY · 10 min',
      title: '把三个指标和真实场景对上',
      intro: '你要知道每个指标在船舶场景里到底意味着什么。',
      sections: [
        {
          title: '速查',
          tone: 'cyan',
          bullets: ['Mₚ：峰值超过稳态值的百分比', 'tₛ：进入 ±2% 并保持的时刻', 'tᵣ：10% → 90% 的上升段时间'],
        },
      ],
      activity: {
        kind: 'form',
        submitLabel: '提交对比判断',
        fields: [
          { key: 'passengerPriority', label: '客轮更在意什么？', type: 'text', placeholder: '例如：更在意 Mₚ 和舒适性' },
          { key: 'patrolPriority', label: '海事巡逻船更在意什么？', type: 'text', placeholder: '例如：更在意 tᵣ 和机动性' },
          { key: 'explain', label: '用 1-2 句话说明理由', type: 'textarea', placeholder: '说明你的工程判断逻辑' },
        ],
      },
    },
  },
  {
    id: 'participatory-metrics-2',
    stage: 'P2',
    title: '三指标：工作区测量实践',
    hint: '让学生在工作区里直接读出默认系统的 Mₚ、tₛ、tᵣ。',
    duration: '3 min',
    teacher: {
      kicker: 'PARTICIPATORY · 3 min',
      title: '从定义转到实测：三指标到底是多少',
      intro: '教师不报答案，让学生先自己从曲线里量出来。',
      sections: [
        {
          title: '教师提醒',
          tone: 'sky',
          bullets: ['最高点与稳态值之差给 Mₚ', '进入 ±2% 误差带后的第一个稳定时刻给 tₛ', '10% 到 90% 的时间段给 tᵣ'],
        },
      ],
      controls: ['释放工作区测量任务', '展示典型测量结果'],
    },
    student: {
      kicker: 'PARTICIPATORY · 3 min',
      title: '去左侧工作区把三组数读出来',
      intro: '当前默认系统参数已就位，请直接测量。',
      sections: [],
      activity: {
        kind: 'form',
        submitLabel: '提交我的测量',
        helper: '数值允许有少量误差，重点是会读图。',
        fields: [
          { key: 'mp', label: 'Mₚ（%）', type: 'number', placeholder: '例如：16' },
          { key: 'ts', label: 'tₛ（s）', type: 'number', placeholder: '例如：6.2' },
          { key: 'tr', label: 'tᵣ（s）', type: 'number', placeholder: '例如：1.2' },
          { key: 'challenge', label: '进阶挑战：能否让 Mₚ 和 tₛ 同时减小？', type: 'text', placeholder: '一句话写下结论' },
        ],
      },
    },
  },
  {
    id: 'participatory-intro-3',
    stage: 'P2',
    title: '过渡：引入两个参数',
    hint: '从现象回到参数：谁在决定这些曲线？',
    duration: '1 min',
    teacher: {
      kicker: 'PARTICIPATORY · 1 min',
      title: '第三件事：两个关键参数',
      intro: '把四种家族和三指标背后的“源头”明确为 ζ 与 ωₙ。',
      sections: [
        {
          title: '过渡问题',
          tone: 'cyan',
          body: '“是什么决定系统属于哪个家族？又是什么决定 Mₚ、tₛ、tᵣ 的变化？”',
        },
      ],
      controls: ['释放参数预测题', '继续进入 ζ 图示'],
    },
    student: {
      kicker: 'PARTICIPATORY · 1 min',
      title: '先把你的预测写下来',
      intro: '预测正确与否不重要，重要的是后面你能看到自己的认知修正。',
      sections: [],
      activity: {
        kind: 'form',
        submitLabel: '保存我的预测',
        fields: [
          {
            key: 'zetaPrediction',
            label: '如果增大 ζ，超调量 Mₚ 会怎样？',
            type: 'radio',
            options: [
              { value: 'increase', label: '增大' },
              { value: 'decrease', label: '减小' },
              { value: 'same', label: '不变' },
              { value: 'unknown', label: '说不准' },
            ],
          },
          {
            key: 'wnPrediction',
            label: '如果增大 ωₙ，系统响应会怎样？',
            type: 'radio',
            options: [
              { value: 'faster', label: '更快' },
              { value: 'slower', label: '更慢' },
              { value: 'same', label: '不变' },
              { value: 'unknown', label: '说不准' },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'participatory-zeta',
    stage: 'P2',
    title: '参数 ζ：图示与规律',
    hint: '聚焦阻尼比如何改变形状与超调。',
    duration: '8 min',
    teacher: {
      kicker: 'PARTICIPATORY · 8 min',
      title: '参数一：阻尼比 ζ 控制曲线形状',
      intro: '让学生看清“ζ 越大，超调越小、振荡越弱，但并不意味着一切都更快”。',
      sections: [
        {
          title: '方向性速记',
          tone: 'cyan',
          bullets: ['ζ ↑ → Mₚ ↓', 'ζ ↑ → tᵣ ↑', 'ζ ↑ → tₛ 先↓后↑', 'ζ ≈ 0.7 是经验最优附近'],
        },
      ],
      controls: ['遮住标签先展示曲线族', '逐个揭示 ζ 值', '高亮 ζ ≈ 0.7'],
    },
    student: {
      kicker: 'PARTICIPATORY · 8 min',
      title: '用左侧工作区验证“ζ 控形状”',
      intro: '把你刚才的预测与真实变化逐项对照。',
      sections: [],
      activity: {
        kind: 'form',
        submitLabel: '保存 ζ 观察',
        fields: [
          { key: 'zetaGuessResult', label: '你原先的预测与实际观察一致吗？', type: 'radio', options: [
            { value: 'correct', label: '完全正确' },
            { value: 'partial', label: '方向对但幅度差' },
            { value: 'wrong', label: '完全相反' },
          ] },
          { key: 'zetaMp', label: 'ζ = 0.5 时，曲线超调量大约是多少？', type: 'number', placeholder: '例如：16' },
          { key: 'zetaTs', label: 'ζ 从 0.7 增大到 1.0，tₛ 是缩短还是延长？', type: 'text', placeholder: '例如：开始延长' },
          { key: 'zetaFinding', label: '你的一句话发现', type: 'textarea', placeholder: '总结 ζ 改变时你看到的规律' },
        ],
      },
    },
  },
  {
    id: 'participatory-wn',
    stage: 'P2',
    title: '参数 ωₙ：图示与规律',
    hint: '聚焦自然频率如何改变速度与振荡节奏。',
    duration: '8 min',
    teacher: {
      kicker: 'PARTICIPATORY · 8 min',
      title: '参数二：自然频率 ωₙ 控制曲线快慢',
      intro: '同样的形状，时间尺度不同；这就是“自然频率”的真正含义。',
      sections: [
        {
          title: '核心结论',
          tone: 'cyan',
          bullets: ['ωₙ ↑ → tₛ ↓', 'ωₙ ↑ → tᵣ ↓', 'ωₙ ↑ → Mₚ 近似不变', '同样时间窗口内，振荡周期数会更多'],
        },
      ],
      controls: ['先问周期数，再揭示 ωₙ 标签', '补完整张速记表的 ωₙ 行'],
    },
    student: {
      kicker: 'PARTICIPATORY · 8 min',
      title: '验证“ωₙ 控速度，不改形状”',
      intro: '把同一阻尼下的不同自然频率做成直接对比。',
      sections: [],
      activity: {
        kind: 'form',
        submitLabel: '保存 ωₙ 观察',
        fields: [
          { key: 'wnGuessResult', label: '你原先的预测与实际观察一致吗？', type: 'radio', options: [
            { value: 'correct', label: '完全正确' },
            { value: 'partial', label: '部分正确' },
            { value: 'wrong', label: '完全错误' },
          ] },
          { key: 'wnTs', label: '把 ωₙ 调到最大时，tₛ 大约是多少秒？', type: 'number', placeholder: '例如：1.8' },
          { key: 'wnShape', label: 'ωₙ 改变时，曲线的超调量（形状）变了吗？', type: 'text', placeholder: '例如：基本不变' },
          { key: 'wnMeaning', label: '用自己的话解释“自然频率”', type: 'textarea', placeholder: '例如：单位时间内振荡节奏更快' },
        ],
      },
    },
  },
  {
    id: 'participatory-table',
    stage: 'P2',
    title: '完整速记表',
    hint: '把 ζ、ωₙ 对 Mₚ、tₛ、tᵣ 的影响收束为一张表。',
    duration: '3 min',
    teacher: {
      kicker: 'PARTICIPATORY · 3 min',
      title: '最后把规律压缩成一张速记表',
      intro: '让学生记住“ζ 控形状，ωₙ 控速度”，以及 tₛ 的非单调性。',
      sections: [
        {
          title: '一张表记住',
          tone: 'cyan',
          bullets: ['ζ ↑ → Mₚ ↓ · tₛ 先↓后↑ · tᵣ ↑', 'ωₙ ↑ → Mₚ ≈ 不变 · tₛ ↓ · tᵣ ↓'],
        },
      ],
      controls: ['逐行揭示速记表', '强调 ζ≈0.7 的经验平衡点'],
    },
    student: {
      kicker: 'PARTICIPATORY · 3 min',
      title: '核对你的实测与表格是否一致',
      intro: '如果你的记录与规律不一致，就立刻回到左侧工作区再验证一次。',
      sections: [],
      activity: {
        kind: 'form',
        submitLabel: '保存速记表理解',
        fields: [
          { key: 'tableMp', label: '你测到 ζ = 0.5 时的 Mₚ（%）', type: 'number', placeholder: '例如：16' },
          { key: 'tableInvariant', label: '你是否确认“ωₙ 不影响形状”？', type: 'radio', options: [
            { value: 'confirmed', label: '确认' },
            { value: 'retry', label: '还要再试一次' },
          ] },
          { key: 'tableInsight', label: 'tₛ 先减后增说明了什么？', type: 'textarea', placeholder: '例如：存在一个快与稳的平衡点' },
        ],
      },
    },
  },
  {
    id: 'participatory-limit',
    stage: 'P2',
    title: '局限性与预告',
    hint: '明确时域只能告诉你结果，不能直接指导控制器设计。',
    duration: '5 min',
    teacher: {
      kicker: 'PARTICIPATORY · 5 min',
      title: '时域这张面孔的边界',
      intro: '学生此时已经能读懂曲线，但还不会把设计参数和曲线直接连起来。',
      sections: [
        {
          title: '关键留白',
          tone: 'rose',
          body: '“知道 ζ 太小，但具体该改哪个控制器参数？时域曲线本身能告诉你吗？”',
        },
        {
          title: '预告',
          tone: 'violet',
          bullets: ['L-2b：根轨迹告诉你极点如何移动', 'L-2c：频域告诉你裕度如何量化', '三张面孔，缺一不可'],
        },
      ],
      controls: ['停顿 5 秒再揭示答案', '展示三域关系示意'],
    },
    student: {
      kicker: 'PARTICIPATORY · 5 min',
      title: '想一想：知道结果，不等于知道怎么设计',
      intro: '如果只看时域曲线，你会发现自己还缺一块“设计导航图”。',
      sections: [
        {
          title: '30 秒自想',
          tone: 'rose',
          bullets: ['知道 Mₚ 太大了', '知道应该增大 ζ', '但具体改 Kₚ、Kᵢ、Kd 哪一个？'],
        },
      ],
      activity: {
        kind: 'form',
        submitLabel: '保存我的判断',
        fields: [
          {
            key: 'limitChoice',
            label: '如果只看时域曲线，你能直接知道该改哪个控制器参数吗？',
            type: 'radio',
            options: [
              { value: 'kp', label: '能，先改 Kₚ' },
              { value: 'ki', label: '能，先改 Kᵢ' },
              { value: 'kd', label: '能，先改 Kd' },
              { value: 'cannot', label: '不能，时域曲线本身不告诉我' },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'post-assessment',
    stage: 'P3',
    title: '后测',
    hint: '用 4 题验证家族、指标、参数方向和局限性理解。',
    duration: '8 min',
    teacher: {
      kicker: 'POST-ASSESSMENT · 8 min',
      title: '后测：检查今天的直觉链路是否闭环',
      intro: '三道选择题看共识，一道开放题看表达。',
      sections: [
        {
          title: '使用方式',
          tone: 'amber',
          bullets: ['前 3 题用于看班级正确率', '第 4 题开放回答可作为 L-2b 的开场素材', '若 1/2/3 任一正确率 < 70%，下节课先快速复盘'],
        },
      ],
      activity: {
        kind: 'quiz',
        questions: L2A_POST_ASSESSMENT_QUESTIONS,
      },
    },
    student: {
      kicker: 'POST-ASSESSMENT · 8 min',
      title: '后测：检验今天的时域直觉',
      intro: '这不是成绩，而是确认你能否真正把“曲线语言”说清楚。',
      sections: [],
      activity: {
        kind: 'quiz',
        submitLabel: '提交后测',
        questions: L2A_POST_ASSESSMENT_QUESTIONS,
      },
    },
  },
  {
    id: 'summary',
    stage: 'S',
    title: '总结与预告',
    hint: '回到知识图谱，回收今天点亮的节点和个人记录。',
    duration: '5 min',
    teacher: {
      kicker: 'SUMMARY · 5 min',
      title: '把今天的 5 句关键结论钉牢',
      intro: '总结必须短，但要把“结果 vs 设计”的边界说透。',
      sections: [
        {
          title: '五句小结',
          tone: 'violet',
          bullets: [
            '时域响应 = 阶跃输入下从初态到稳态的全过程曲线',
            '四种家族 = 极点位置决定曲线形态',
            '三个指标：Mₚ（冲多高）、tₛ（多久稳定）、tᵣ（多快上升）',
            '两个参数：ζ 控形状，ωₙ 控速度',
            '局限：时域看结果，不直接指导控制器设计',
          ],
        },
      ],
      controls: ['逐条揭示小结', '展示知识图谱', '随机抽答“为什么 ζ≈0.7 常被偏爱”'],
    },
    student: {
      kicker: 'SUMMARY · 5 min',
      title: '带着你自己的记录离开这节课',
      intro: '最后回头看一次：你刚才的预测、测量与修正，已经构成你的个人学习证据。',
      sections: [
        {
          title: '课后 AI 协同任务',
          tone: 'violet',
          bullets: ['先预测 ζ 从 0.2 到 0.8 时 tₛ 的走势', '让 AI 生成表格与 Python 曲线', '运行并截图，对比你原来的预测'],
        },
      ],
      activity: { kind: 'none' },
    },
  },
];

export const L2A_STEP_DURATION = Object.fromEntries(
  L2A_LESSON_STEPS.map((step) => [step.id, step.duration]),
) as Record<string, string>;

export const L2A_WORKSPACE_PERSIST_STEP_IDS = new Set(
  L2A_LESSON_STEPS.map((step) => step.id),
);

export const L2A_WORKSPACE_VISIBLE_STEP_IDS = new Set(
  L2A_LESSON_STEPS.map((step) => step.id),
);

export const L2A_PREMIUM_LESSON_CARD = {
  id: 'l2a-time-domain-fasttrack',
  title: 'L-2a：三张面孔，同一系统',
  description: '79 分钟精品互动课堂：围绕船舶阶跃响应建立时域直觉，双端同步 + 常驻工作区。',
  duration: '79 分钟',
  href: `/interactive-learning/courses/${L2A_ROUTE_SEGMENT}`,
  badge: '重构精品课',
} as const;

export function getL2AStep(stepId: string) {
  return L2A_LESSON_STEPS.find((step) => step.id === stepId) ?? L2A_LESSON_STEPS[0];
}

export function createEmptyL2AStudentState(studentName: string): L2AStudentCourseState {
  return {
    kind: 'l2a_student_state',
    version: 1,
    studentName,
    workspace: {
      zeta: 0.45,
      wn: 1.8,
      selectedPreset: 'balanced',
      lastMeasuredAt: null,
    },
    responses: {},
    updatedAt: Date.now(),
  };
}
