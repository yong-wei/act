import type { AIContextConfig } from '@/types/ai-context';

export const UNIT_4_2_COURSE_META = {
  courseId: 'unit-4-2-controller-selection-first-start-v1',
  courseTitle: '4-2：控制器选型原理：不同控制结构为何适合不同任务',
  courseDescription:
    '围绕频域证据、结构选型决策树、分结构整定例题和客船候选结构复核，把任务证据推进成单结构首轮起步卡。',
  keyConcepts: ['频域作用点', '结构选型决策树', '参数初算', '多指标复核', '单结构起步卡'],
} as const;

type Unit42AiSource = {
  stepId: string;
  topic: string;
  pageType: AIContextConfig['pageType'];
  objectives: string[];
  quickQuestions: Array<{ label: string; question: string }>;
  systemPrompt: string;
};

function context(source: Unit42AiSource): AIContextConfig {
  return {
    enabled: true,
    courseId: UNIT_4_2_COURSE_META.courseId,
    courseTitle: UNIT_4_2_COURSE_META.courseTitle,
    pageType: source.pageType,
    stepId: source.stepId,
    topic: source.topic,
    learningObjectives: source.objectives,
    knowledgeType: 'D',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: source.quickQuestions,
    systemPromptExtension: source.systemPrompt,
  };
}

const STEP_AI_SOURCE: Unit42AiSource[] = [
  {
    stepId: 'step-01',
    topic: '控制器选型与整定任务的导入场景',
    pageType: 'theory',
    objectives: ['说明为什么不能把 PID 当成默认首轮答案', '把任务证据转回频域作用点和复核链'],
    quickQuestions: [
      { label: '为什么不能直接 PID', question: '为什么客船航向控制已有任务证据后，首轮仍不能直接写 PID？' },
      { label: '先看什么证据', question: '结构选型前最先要判断哪些频域或通道证据？' },
    ],
    systemPrompt: '只围绕导入场景解释结构选型问题，不提前给出后续例题答案。',
  },
  {
    stepId: 'step-02',
    topic: '本次课程目标',
    pageType: 'theory',
    objectives: ['解释本课能力目标', '区分结构候选、参数初算和复核证据'],
    quickQuestions: [
      { label: '本课产出', question: '本课最终产出为什么是单结构起步卡，而不是完整复合方案？' },
      { label: '目标怎么读', question: '结构候选、参数初算和复核证据之间是什么关系？' },
    ],
    systemPrompt: '只解释本课目标和学习路径，不展开课程管理口径。',
  },
  {
    stepId: 'step-03',
    topic: '前置基础快测',
    pageType: 'quiz',
    objectives: ['检查相角裕度读图', '检查低频增益和反馈前馈边界'],
    quickQuestions: [
      { label: '裕度怎么读', question: 'Bode 图中的相角裕度应从哪个频率点读取？' },
      { label: '前馈边界', question: '为什么前馈加入后反馈仍然需要承担稳定性？' },
    ],
    systemPrompt: '只做前置概念解释和错因提示，不替学生直接作答。',
  },
  {
    stepId: 'step-04',
    topic: '单结构整定的四类复核量',
    pageType: 'practice',
    objectives: ['用低频增益、截止频率、相角裕度和高频增益复核结构', '说明收益和代价必须同时出现'],
    quickQuestions: [
      { label: '四类复核量', question: '为什么低频增益、截止频率、相角裕度和高频增益要一起看？' },
      { label: '不能只增益', question: '相角裕度不足时为什么不能只增大比例增益？' },
    ],
    systemPrompt: '帮助学生回到四类复核量，不把结构名称当答案。',
  },
  {
    stepId: 'step-05',
    topic: '典型控制结构的频域特性矩阵',
    pageType: 'practice',
    objectives: ['把控制结构映射到频域作用点', '识别低频、中频、高频和通道补偿职责'],
    quickQuestions: [
      { label: '结构作用点', question: 'PI、超前、滞后和前馈分别首先改变哪类证据？' },
      { label: '为什么先频域', question: '为什么结构选型要先看开环频率特性？' },
    ],
    systemPrompt: '解释结构频域语义，不替学生完成多选矩阵。',
  },
  {
    stepId: 'step-06',
    topic: '控制器结构选型决策树',
    pageType: 'practice',
    objectives: ['把任务证据映射到频段或通道', '沿决策树筛出候选结构和复核量'],
    quickQuestions: [
      { label: '决策树怎么走', question: '从稳态误差、裕度不足或可测扰动出发，决策树分别会走向哪里？' },
      { label: '复核量怎么列', question: '选出候选结构后为什么还必须列复核量？' },
    ],
    systemPrompt: '只帮助学生理解证据匹配逻辑，不直接给拖动题答案。',
  },
  {
    stepId: 'step-07',
    topic: '经验整定与临界比例整定步骤',
    pageType: 'theory',
    objectives: ['解释经验整定初值', '说明 ZN 中 Ku 和 Pu 的来源'],
    quickQuestions: [
      { label: 'Ku 来源', question: '临界比例法中的 Ku 和 Pu 分别来自什么实验现象？' },
      { label: 'ZN 边界', question: '为什么 ZN 结果只能作为 PID 初值？' },
    ],
    systemPrompt: '按显影步骤解释参数来源，不跳到例题答案。',
  },
  {
    stepId: 'step-08',
    topic: '频域 PI 与滞后整定步骤',
    pageType: 'theory',
    objectives: ['说明 PI 参数来源', '说明滞后参数来源和复核边界'],
    quickQuestions: [
      { label: 'PI 参数链', question: 'PI 的零点、Ti、Kp 和 Ki 分别怎样确定？' },
      { label: '滞后代价', question: '滞后提高低频能力时最容易牺牲什么？' },
    ],
    systemPrompt: '解释 PI 与滞后参数链，不替学生提交后续例题参数。',
  },
  {
    stepId: 'step-09',
    topic: '频域 PD、超前与超前-滞后整定步骤',
    pageType: 'theory',
    objectives: ['说明超前参数链', '识别中频相位收益与高频代价'],
    quickQuestions: [
      { label: '超前怎么算', question: '超前校正中的 alpha、T 和 Kc 分别来自哪一步？' },
      { label: '高频代价', question: '为什么强超前不能只看相位收益？' },
    ],
    systemPrompt: '解释中频相位补偿和代价，不替学生完成例题。',
  },
  {
    stepId: 'step-10',
    topic: '模型匹配、IMC/SIMC 与前馈整定步骤',
    pageType: 'practice',
    objectives: ['说明模型匹配和 IMC/SIMC 参数含义', '区分前馈补偿与反馈保底'],
    quickQuestions: [
      { label: 'lambda 含义', question: 'IMC/SIMC 中 lambda 变大时响应速度和鲁棒性通常怎样变化？' },
      { label: '前馈职责', question: '前馈整定为什么不能替代反馈闭环？' },
    ],
    systemPrompt: '帮助学生判断适用前提和边界，不把前馈讲成万能方案。',
  },
  {
    stepId: 'step-11',
    topic: '例题 5.1 频域 PI 参数计算',
    pageType: 'practice',
    objectives: ['复核 PI 求解步骤', '用时域和频域二连图检查 Ti、Kp、Ki'],
    quickQuestions: [
      { label: 'PI 复核', question: 'Ti、Kp、Ki 改动后应同时观察哪些时域和频域证据？' },
      { label: '裕度不足', question: '如果 PI 后相角裕度偏低，应先考虑怎样调整？' },
    ],
    systemPrompt: '可以解释参数含义和曲线变化，不直接代填提交字段。',
  },
  {
    stepId: 'step-12',
    topic: '例题 5.2 频域超前参数计算',
    pageType: 'practice',
    objectives: ['复核超前求解步骤', '识别高频增益和控制量代价'],
    quickQuestions: [
      { label: 'alpha 含义', question: 'alpha 变小时相位补偿和高频代价通常怎样变化？' },
      { label: '超前复核', question: '超前参数提交前必须检查哪些曲线证据？' },
    ],
    systemPrompt: '解释超前参数与曲线变化，不替学生直接提交。',
  },
  {
    stepId: 'step-13',
    topic: '例题 5.3 滞后校正参数计算',
    pageType: 'practice',
    objectives: ['复核滞后参数链', '检查低频改善和相角裕度代价'],
    quickQuestions: [
      { label: 'beta 怎么来', question: '滞后校正中的 beta 为什么来自误差改善倍数？' },
      { label: '滞后复核', question: '为什么滞后后必须复核响应速度和裕度？' },
    ],
    systemPrompt: '解释滞后参数来源和复核口径，不直接生成答案。',
  },
  {
    stepId: 'step-14',
    topic: '例题 5.4 Ziegler-Nichols PID 参数计算',
    pageType: 'practice',
    objectives: ['复核 ZN PID 参数换算', '识别 ZN 初值的超调风险'],
    quickQuestions: [
      { label: 'ZN 参数', question: 'Kp、Ti、Td、Ki、Kd 是怎样由 Ku 和 Pu 得到的？' },
      { label: '为什么要复核', question: 'ZN PID 为什么不能直接作为最终参数？' },
    ],
    systemPrompt: '围绕 ZN 初值和二连图复核提供解释，不替学生提交参数。',
  },
  {
    stepId: 'step-15',
    topic: '扰动前馈例题的补偿计算',
    pageType: 'practice',
    objectives: ['解释扰动对消公式', '说明工程折减和反馈边界'],
    quickQuestions: [
      { label: '对消公式', question: '为什么扰动前馈理论值满足 Fd=-Gd/G？' },
      { label: '工程折减', question: '为什么理论前馈值通常还要做工程折减？' },
    ],
    systemPrompt: '解释扰动前馈计算和边界，不替代学生判断。',
  },
  {
    stepId: 'step-16',
    topic: '客船航向控制对象与候选参数初算',
    pageType: 'practice',
    objectives: ['固定客船对象和基准指标', '说明候选结构参数来源'],
    quickQuestions: [
      { label: '基准问题', question: '客船基准对象最明显的问题证据是什么？' },
      { label: '分支来源', question: '滞后、PI、超前和超前-滞后分别来自哪类整定分支？' },
    ],
    systemPrompt: '帮助学生整理客船对象证据和参数来源，不提前定最终结构。',
  },
  {
    stepId: 'step-17',
    topic: '客船候选结构的 Bode 与时域复核',
    pageType: 'practice',
    objectives: ['比较候选结构的 Bode 和时域证据', '形成多指标复核判断'],
    quickQuestions: [
      { label: '候选怎么比', question: '比较客船候选结构时为什么不能只看超调？' },
      { label: '复核量', question: 'Bode、阶跃、扰动、灵敏度和控制量各自回答什么问题？' },
    ],
    systemPrompt: '解释候选结构比较证据，不把某个候选直接宣布为最终答案。',
  },
  {
    stepId: 'step-18',
    topic: '分层练习与单结构起步卡工作区',
    pageType: 'practice',
    objectives: ['把练习任务转成单结构起步卡', '补齐结构、整定入口、收益、代价和复核证据'],
    quickQuestions: [
      { label: '起步卡字段', question: '八字段起步卡中哪些字段最容易漏掉？' },
      { label: '证据怎么写', question: '四类复核证据怎样写得可检查？' },
    ],
    systemPrompt: '只做字段完整性和证据对应检查，不替学生写完整方案。',
  },
  {
    stepId: 'step-19',
    topic: '后测：结构选型与整定复核判断',
    pageType: 'quiz',
    objectives: ['检查结构作用点判断', '检查整定步骤和复核边界'],
    quickQuestions: [
      { label: '后测重点', question: '后测主要检查结构名字、参数步骤还是复核边界？' },
      { label: '错因定位', question: '如果只选出结构却说不清代价，说明缺了哪一步？' },
    ],
    systemPrompt: '只提供概念澄清和错因提示，不替学生作答。',
  },
  {
    stepId: 'step-20',
    topic: '总结：频域证据到首轮候选结构',
    pageType: 'theory',
    objectives: ['收束频域证据到结构候选', '查看个人与班级表现统计'],
    quickQuestions: [
      { label: '五句带走', question: '本课结束时最该保留的结构选型判断链是什么？' },
      { label: '下一步关系', question: '为什么本课只到单结构首轮候选，后续还要进入复合结构和优化？' },
    ],
    systemPrompt: '只做总结和迁移提醒，不展开新的复合结构设计。',
  },
];

export const UNIT_4_2_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  STEP_AI_SOURCE.map((source) => [source.stepId, context(source)]),
);

export function getUnit42StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_4_2_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit42StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_4_2_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_4_2StepAIContext = getUnit42StepAIContext;
export const getUNIT_4_2StepQuickQuestions = getUnit42StepQuickQuestions;
