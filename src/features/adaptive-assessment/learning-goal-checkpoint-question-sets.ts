import type { AdaptiveAssessmentCatalogStage } from './adaptive-assessment-item-catalog';

export const LEARNING_GOAL_CHECKPOINT_QUESTION_SET_VERSION = 'learning-goal-checkpoint-question-sets.v1';
export const LEARNING_GOAL_CHECKPOINT_QUESTION_SET_REVIEWED_AT = '2026-07-03T00:00:00.000Z';
export const LEARNING_GOAL_CHECKPOINT_QUESTION_SET_REVIEWER_ID = 'openspec-buddy:learning-goal-checkpoint-question-sets';

export interface CheckpointAuthoredQuestionRecord {
  id: string;
  learningGoalId: string;
  learningGoalTitle: string;
  stagePurpose: AdaptiveAssessmentCatalogStage | 'readiness-gate' | 'precheck' | 'practice';
  stem: string;
  options: Array<{
    key: string;
    text: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  answerKeys: string[];
  explanation: string;
  difficulty: number;
  cognitiveLevel: string;
  kaqObjectiveIds: string[];
  graphNodeIds: string[];
  knowledgeTags: string[];
  misconceptionTags: string[];
  remediationResourceNodeIds: string[];
  reviewedAt: string;
  reviewerId: string;
  reviewBatchId: typeof LEARNING_GOAL_CHECKPOINT_QUESTION_SET_VERSION;
  sourceRef: string;
}

type AuthoredStage = 'readiness' | 'practice' | 'checkpoint' | 'remediation';

interface GoalReviewTarget {
  id: string;
  title: string;
  kaqObjectiveIds: string[];
  graphNodeIds: string[];
  remediationResourceNodeIds: string[];
  seeds: AuthoredQuestionSeed[];
}

interface AuthoredQuestionSeed {
  stage: AuthoredStage;
  stem: string;
  correct: string;
  distractors: [string, string];
  explanation: string;
  difficulty: number;
  cognitiveLevel: string;
  misconception: string;
}

const OPTION_KEYS = ['A', 'B', 'C'] as const;
type OptionKey = typeof OPTION_KEYS[number];

function seed(
  stage: AuthoredStage,
  stem: string,
  correct: string,
  distractors: [string, string],
  explanation: string,
  difficulty: number,
  cognitiveLevel: string,
  misconception: string,
): AuthoredQuestionSeed {
  return { stage, stem, correct, distractors, explanation, difficulty, cognitiveLevel, misconception };
}

const GOAL_REVIEW_TARGETS: GoalReviewTarget[] = [
  {
    id: 'control-correction',
    title: '控制系统校正设计',
    kaqObjectiveIds: [
      'knowledge:autocontrol:controller-correction',
      'capability:autocontrol:synthesize-controller-correction',
      'quality:autocontrol:system-tradeoff',
    ],
    graphNodeIds: [
      'kn:autocontrol:controller-correction',
      'cap:autocontrol:synthesize-controller-correction',
      'qual:autocontrol:system-tradeoff',
    ],
    remediationResourceNodeIds: ['registry:lesson09-correction-precheck'],
    seeds: [
      seed('practice', '给定超调量过大但稳态误差合格，优先练习哪项校正判断？', '判断是否需要增加阻尼并选择超前或测速反馈思路。', ['直接增大积分作用以消除已经合格的稳态误差。', '只降低开环增益，不检查响应速度和相位裕度。'], '该练习针对从时域指标反推校正方向的能力。', 0.54, 'analyze', 'confuses-overshoot-with-steady-error'),
      seed('practice', '根轨迹向右偏移导致闭环极点靠近虚轴时，应练习哪项操作？', '比较零点引入、增益调整与目标极点区域的关系。', ['把任意零点放在原点即可稳定系统。', '只看稳态误差常数，不看闭环极点位置。'], '校正设计需要把根轨迹形状与目标极点区域对应起来。', 0.58, 'analyze', 'ignores-root-locus-geometry'),
      seed('practice', '频域超前校正常用于弥补哪类设计缺口？', '在目标截止频率附近增加相位并改善稳定裕度。', ['在低频无限增加积分阶次。', '把所有高频噪声都放大以提高响应速度。'], '超前校正的核心是相位裕度与带宽的折中。', 0.56, 'analyze', 'misuses-lead-compensation'),
      seed('practice', '若校正后仿真显示控制量峰值过高，应练习哪项复核？', '把性能改善与执行器约束一起检查。', ['只要输出曲线快，控制量大小可以忽略。', '只保留最慢方案，因为慢一定安全。'], '校正目标不能脱离执行器代价和工程约束。', 0.62, 'evaluate', 'ignores-actuator-cost'),
      seed('practice', '串联校正方案完成后，哪项练习能防止只满足单一指标？', '同时核对超调、调节时间、稳态误差和控制量。', ['只核对第一项达标指标。', '只看教师给出的最终参数，不解释依据。'], '多指标复核是校正设计进入检查点前的必要练习。', 0.6, 'evaluate', 'single-metric-design'),
      seed('checkpoint', '学生提交校正方案时，哪组证据最能支撑检查点通过？', '原系统问题、补偿器选择理由、参数计算和校正前后响应对比。', ['只有补偿器传递函数，没有设计依据。', '只有一张仿真截图，没有指标读数和参数来源。'], '检查点要求判断链和证据链同时完整。', 0.68, 'evaluate', 'missing-design-rationale'),
      seed('checkpoint', '若学生声称“已完成校正”，但没有给出校正后稳定裕度，应如何判定？', '不能通过检查点，需补充频域或等价稳定性证据。', ['只要时域曲线变快即可通过。', '只要补偿器形式正确即可通过。'], '校正完成必须包含稳定性与鲁棒性边界的复核。', 0.7, 'evaluate', 'omits-stability-margin'),
      seed('remediation', '学生把超调过大归因于稳态误差不足，应推送哪类补救？', '回到动态性能指标与主导极点阻尼比的关系。', ['继续做积分分离高级题。', '跳到船海迁移任务。'], '该误解需要先分清动态误差和稳态误差。', 0.45, 'apply', 'confuses-dynamic-and-steady-error'),
      seed('remediation', '学生只凭一个增益值决定校正器，应补救哪项基础？', '根轨迹形状、目标极点区域和增益选择的联合判断。', ['只训练 Bode 图坐标读数。', '只背诵校正器名称。'], '根轨迹校正不能把增益从几何位置中剥离出来。', 0.47, 'apply', 'gain-only-design'),
      seed('remediation', '学生忽略控制量峰值导致方案不可执行，应补救哪项意识？', '工程约束下的性能代价权衡。', ['只增加题目难度。', '只要求重画系统框图。'], '控制系统校正目标必须包含可执行性。', 0.5, 'analyze', 'ignores-implementation-constraint'),
    ],
  },
  {
    id: 'frequency-response-foundations',
    title: '频率响应基础',
    kaqObjectiveIds: [
      'knowledge:autocontrol:frequency-response',
      'capability:autocontrol:interpret-time-frequency-response',
      'quality:autocontrol:system-tradeoff',
    ],
    graphNodeIds: [
      'kn:autocontrol:frequency-response',
      'cap:autocontrol:interpret-time-frequency-response',
      'qual:autocontrol:system-tradeoff',
    ],
    remediationResourceNodeIds: ['registry:lesson12-frequency-precheck'],
    seeds: [
      seed('practice', 'Bode 幅频图低频段斜率变化时，练习重点是什么？', '把斜率变化与零极点数量变化联系起来。', ['只记住曲线颜色。', '只看相位图而不读幅频斜率。'], '频率响应基础需要从曲线形态回到系统结构。', 0.5, 'analyze', 'reads-bode-as-picture'),
      seed('practice', '相频曲线快速下降时，应练习哪项解释？', '判断相位滞后增加对稳定裕度的影响。', ['把相位下降解释为稳态误差变小。', '认为相位只影响作图不影响闭环。'], '相位信息直接影响闭环稳定边界。', 0.55, 'analyze', 'ignores-phase-margin'),
      seed('practice', '若学生只会读截止频率数值，还缺哪项练习？', '解释截止频率与响应速度、噪声敏感性的折中。', ['把截止频率越大越好作为唯一规则。', '完全不讨论带宽。'], '截止频率不是孤立数值，而是性能权衡入口。', 0.58, 'evaluate', 'bandwidth-is-always-better'),
      seed('practice', '读奈奎斯特曲线前，哪项频率响应练习最关键？', '确认开环频率曲线与临界点距离的含义。', ['先背诵所有稳定判据结论。', '只练习时域单位阶跃响应。'], '奈奎斯特判据需要频域距离和环绕概念。', 0.6, 'analyze', 'skips-critical-point-meaning'),
      seed('checkpoint', '频率响应基础检查点应要求学生提交哪项证据？', '从一张 Bode 图读出低频增益、截止频率和相位裕度含义。', ['只提交 Bode 图截图。', '只写“系统稳定”。'], '检查点应证明学生能从图读出控制含义。', 0.66, 'evaluate', 'unexplained-bode-reading'),
      seed('checkpoint', '学生说“相角裕度越大越好”时，检查点应追问什么？', '追问过大裕度可能带来的带宽和响应速度代价。', ['直接判定完全正确。', '只要求重新画相频曲线。'], '频率响应基础包含稳定裕度和性能之间的折中。', 0.68, 'evaluate', 'margin-without-tradeoff'),
      seed('remediation', '学生把 dB 当作普通线性幅值相加，应补救什么？', '补读对数幅值、增益倍数和 dB 换算。', ['直接进入超前校正综合题。', '只练习根轨迹渐近线。'], 'dB 概念不清会破坏所有幅频判读。', 0.38, 'apply', 'db-linear-confusion'),
      seed('remediation', '学生无法解释相频曲线为什么会滞后，应回到哪类资源？', '零极点对相位贡献的基础知识卡。', ['船海任务背景材料。', 'Arena 综合挑战入口。'], '相位来源不清时需要补零极点频率特性。', 0.42, 'apply', 'phase-source-missing'),
      seed('remediation', '学生只凭幅频图判断闭环安全，应补救什么？', '补相位裕度和稳定裕度的联合判读。', ['继续只读幅频斜率。', '跳过裕度直接做优化。'], '闭环安全边界不能只由幅值判断。', 0.45, 'analyze', 'amplitude-only-stability'),
    ],
  },
  {
    id: 'feedback-loop-concept-foundations',
    title: '反馈与闭环结构基础',
    kaqObjectiveIds: [
      'knowledge:autocontrol:feedback-loop',
      'capability:autocontrol:model-feedback-system',
      'quality:autocontrol:model-boundary-awareness',
    ],
    graphNodeIds: [
      'kn:autocontrol:feedback-loop',
      'cap:autocontrol:model-feedback-system',
      'qual:autocontrol:model-boundary-awareness',
    ],
    remediationResourceNodeIds: ['registry:lesson01-feedback-precheck-v1'],
    seeds: [
      seed('readiness', '进入闭环结构学习前，学生应先能区分哪组信号？', '给定量、输出量、反馈量和误差信号。', ['只区分输入和输出两个端点。', '只记住控制器名称。'], '闭环结构的入口能力是识别信号关系。', 0.34, 'apply', 'signal-role-confusion'),
      seed('practice', '负反馈框图中比较点符号改变时，应练习什么？', '判断误差信号符号和闭环关系是否随之改变。', ['只移动方块位置，不检查符号。', '认为比较点永远不影响传函。'], '反馈结构判断必须尊重符号约定。', 0.46, 'analyze', 'ignores-summing-sign'),
      seed('practice', '扰动进入被控对象前后位置不同，应练习哪项分析？', '分别写出给定通道和扰动通道对输出的影响。', ['把所有扰动都并入给定输入。', '只画单一路径不区分通道。'], '闭环概念需要分清多通道作用点。', 0.52, 'analyze', 'single-channel-thinking'),
      seed('practice', '若传感器环节不为 1，闭环结构练习应关注什么？', '反馈通道动态对误差信号和闭环传函的影响。', ['忽略传感器，永远按单位反馈处理。', '把传感器当作前向控制器。'], '非单位反馈是闭环结构理解的关键边界。', 0.56, 'analyze', 'assumes-unity-feedback'),
      seed('practice', '开环增益提高后闭环响应变化，应练习哪项解释？', '同时说明误差减小、稳定裕度可能下降的关系。', ['只说增益越大越稳定。', '只说增益和闭环无关。'], '反馈带来性能改善也带来稳定性权衡。', 0.58, 'evaluate', 'gain-always-good'),
      seed('checkpoint', '闭环结构检查点最应检查哪项能力？', '能从框图写出给定和扰动到输出的关系。', ['只会背闭环传函公式。', '只会标出控制器方块。'], '检查点要验证结构到表达式的转换。', 0.64, 'evaluate', 'formula-without-structure'),
      seed('remediation', '学生把反馈量和输出量完全等同，应补救什么？', '补传感器环节和测量反馈的区别。', ['直接做根轨迹设计。', '只背负反馈优点。'], '反馈量通常经过测量环节，不一定等于输出。', 0.38, 'apply', 'feedback-equals-output'),
      seed('remediation', '学生无法确定误差信号方向，应回到哪项资源？', '比较点符号、参考输入和反馈输入的基础练习。', ['先做仿真优化。', '直接看频域裕度。'], '误差信号方向错误会导致后续闭环表达式错误。', 0.36, 'apply', 'error-sign-confusion'),
      seed('remediation', '学生把闭环稳定性等同于开环增益大，应补救什么？', '补闭环特征方程和稳定裕度的概念入口。', ['只增加开环增益计算。', '只练习单位换算。'], '闭环稳定性来自特征方程，不是增益大小单独决定。', 0.44, 'analyze', 'gain-stability-confusion'),
    ],
  },
  {
    id: 'transfer-function-modeling-foundations',
    title: '传递函数建模基础',
    kaqObjectiveIds: [
      'knowledge:autocontrol:transfer-function-model',
      'capability:autocontrol:model-feedback-system',
      'quality:autocontrol:model-boundary-awareness',
    ],
    graphNodeIds: [
      'kn:autocontrol:transfer-function-model',
      'cap:autocontrol:model-feedback-system',
      'qual:autocontrol:model-boundary-awareness',
    ],
    remediationResourceNodeIds: ['registry:lesson02-laplace-precheck-v1'],
    seeds: [
      seed('practice', '从微分方程得到传递函数时，首要练习是什么？', '在零初值条件下对输入输出做拉普拉斯变换。', ['直接把微分符号删掉。', '保留任意初始条件并称为传递函数。'], '传递函数定义依赖零初值输入输出关系。', 0.45, 'apply', 'ignores-zero-initial-condition'),
      seed('practice', '机械平动系统建模时，应练习哪项变量选择？', '明确位移、速度、力以及阻尼/弹簧参数的对应关系。', ['把所有参数都写成同一个增益。', '只画方块图不写物理量。'], '建模基础要求变量和物理参数可追溯。', 0.5, 'analyze', 'untracked-physical-variables'),
      seed('practice', '方块图化简前，应练习哪项检查？', '确认串联、并联和反馈连接关系是否真实成立。', ['看到相邻方块就直接相乘。', '把所有节点都合并成一个增益。'], '传递函数组合必须遵守连接拓扑。', 0.52, 'analyze', 'invalid-block-reduction'),
      seed('practice', '建模后分母阶次异常偏低，应练习什么？', '回查是否漏掉储能元件或状态变量。', ['直接把分母补成高阶。', '只调整分子系数。'], '模型阶次应反映系统储能结构。', 0.58, 'evaluate', 'lost-system-order'),
      seed('practice', '把传感器动态纳入模型时，应练习哪项表达？', '区分被控对象传函和测量通道传函。', ['把传感器并入外部扰动。', '删除测量通道以便化简。'], '建模边界决定后续闭环表达式是否可信。', 0.56, 'analyze', 'measurement-path-omitted'),
      seed('checkpoint', '传递函数建模检查点应要求学生说明什么？', '建模假设、零初值条件、输入输出定义和最终传函。', ['只给最终公式。', '只给物理系统照片。'], '检查点要验证模型来源而非只看结果。', 0.66, 'evaluate', 'formula-without-assumptions'),
      seed('remediation', '学生把非零初值响应也放进传递函数，应补救什么？', '补零初值定义和自由响应/受迫响应区别。', ['继续练高阶因式分解。', '直接做频域校正。'], '初值概念不清会污染传递函数定义。', 0.4, 'apply', 'initial-condition-mixed-in'),
      seed('remediation', '学生无法从物理图确定输入输出，应补救什么？', '补系统边界、作用量和被测量的定义。', ['只背标准二阶形式。', '只画根轨迹。'], '输入输出不清会使模型没有可验证对象。', 0.42, 'apply', 'undefined-input-output'),
      seed('remediation', '学生把方块图任意交换顺序，应补救什么？', '补串联交换条件和取样点/比较点移动规则。', ['只做数值代入。', '直接进入 Arena 任务。'], '方块图等效变换需要结构条件。', 0.48, 'analyze', 'invalid-block-diagram-transform'),
    ],
  },
  {
    id: 'time-domain-response-analysis',
    title: '时域响应与性能指标分析',
    kaqObjectiveIds: [
      'knowledge:autocontrol:time-domain-performance',
      'capability:autocontrol:interpret-time-frequency-response',
      'quality:autocontrol:evidence-integrity',
    ],
    graphNodeIds: [
      'kn:autocontrol:time-domain-performance',
      'cap:autocontrol:interpret-time-frequency-response',
      'qual:autocontrol:evidence-integrity',
    ],
    remediationResourceNodeIds: ['registry:lesson07-response-explorer'],
    seeds: [
      seed('practice', '阶跃响应首次峰值明显超过稳态值时，应练习读出什么？', '最大超调量和峰值时间。', ['只读稳态误差。', '只看曲线颜色深浅。'], '时域响应分析需要从曲线读出动态指标。', 0.45, 'apply', 'misses-overshoot-metric'),
      seed('practice', '响应进入并保持在允许误差带内，应练习计算什么？', '调节时间。', ['上升时间。', '系统型别。'], '调节时间描述响应最终稳定到指标带的过程。', 0.44, 'apply', 'settling-rise-confusion'),
      seed('practice', '稳态输出不等于目标值时，应练习哪项判断？', '计算稳态误差并说明误差来源。', ['只判断系统不稳定。', '只读峰值时间。'], '稳态误差是终态偏差，不等于所有动态异常。', 0.48, 'analyze', 'steady-error-as-instability'),
      seed('practice', '欠阻尼二阶系统阻尼比增大，常见响应变化是什么？', '超调减小但响应速度可能变慢。', ['超调一定增大。', '稳态误差必然为零。'], '阻尼比影响超调和速度折中。', 0.56, 'analyze', 'damping-effect-reversed'),
      seed('practice', '比较两个阶跃响应方案时，应练习哪种证据表达？', '用同一指标表同时列出超调、调节时间和稳态误差。', ['只说其中一条曲线更好看。', '只给最终结论不列指标。'], '时域比较必须用一致指标支撑。', 0.58, 'evaluate', 'unstructured-response-comparison'),
      seed('checkpoint', '时域响应检查点中，哪项提交最完整？', '曲线截图、指标读数、允许误差带和结论。', ['只有曲线截图。', '只有一行“响应快”。'], '检查点应同时包含图、数值和解释。', 0.64, 'evaluate', 'curve-without-metrics'),
      seed('checkpoint', '若学生把峰值时间当作调节时间，应如何处理？', '检查点不通过，要求重新标注误差带和最终保持时间。', ['直接通过，因为都是时间指标。', '只要求改单位。'], '峰值时间和调节时间语义不同。', 0.62, 'evaluate', 'time-metric-confusion'),
      seed('remediation', '学生不会读超调量，应先补哪项？', '峰值、稳态值和百分比超调的定义。', ['根轨迹增益换算。', '船海任务背景。'], '超调量定义是时域指标入门。', 0.35, 'apply', 'overshoot-definition-missing'),
      seed('remediation', '学生把所有振荡都判为不稳定，应补救什么？', '稳定欠阻尼振荡和发散振荡的区别。', ['只背 Bode 斜率。', '直接做 PID 参数优化。'], '振荡形态需要结合包络和终值判断。', 0.42, 'analyze', 'oscillation-equals-unstable'),
      seed('remediation', '学生缺少指标证据链，应推送哪项补救？', '从响应曲线逐点标注指标读数的练习。', ['只让学生重新看结论。', '只给最终答案。'], '证据链缺口要用可复查读图训练补齐。', 0.4, 'apply', 'metric-evidence-missing'),
    ],
  },
  {
    id: 'root-locus-analysis-foundations',
    title: '根轨迹分析基础',
    kaqObjectiveIds: [
      'knowledge:autocontrol:root-locus',
      'capability:autocontrol:interpret-time-frequency-response',
      'quality:autocontrol:system-tradeoff',
    ],
    graphNodeIds: [
      'kn:autocontrol:root-locus',
      'cap:autocontrol:interpret-time-frequency-response',
      'qual:autocontrol:system-tradeoff',
    ],
    remediationResourceNodeIds: ['registry:lesson09-correction-precheck'],
    seeds: [
      seed('practice', '根轨迹起点和终点分别由什么决定？', '开环极点和开环零点。', ['闭环零点和闭环极点。', '输入信号幅值和采样时间。'], '根轨迹基础必须先确认起止规则。', 0.42, 'apply', 'root-locus-endpoint-confusion'),
      seed('practice', '实轴上某点是否属于根轨迹，应练习哪条规则？', '其右侧开环实零极点数量为奇数。', ['其左侧零极点数量为偶数。', '只要在实轴上就属于根轨迹。'], '实轴段判定是根轨迹绘制基础。', 0.5, 'analyze', 'wrong-real-axis-rule'),
      seed('practice', '渐近线交点异常时，应回查什么？', '极点和零点数量及其代数和。', ['输入幅值是否为 1。', '响应曲线是否有超调。'], '渐近线来自零极点数量差和位置。', 0.54, 'analyze', 'asymptote-centroid-error'),
      seed('practice', '根轨迹穿越虚轴时，应练习哪项稳定性判断？', '用 Routh 或特征方程求临界增益。', ['只凭图形粗略估计通过。', '认为穿越虚轴仍稳定。'], '虚轴穿越决定闭环稳定增益范围。', 0.6, 'evaluate', 'imaginary-crossing-ignored'),
      seed('practice', '新增开环零点靠近目标极点区域时，应练习什么？', '判断轨迹拉向零点后是否改善动态指标。', ['认为零点越多越稳定。', '只检查稳态误差常数。'], '零点引入需要服务目标极点位置。', 0.58, 'analyze', 'zero-without-target-region'),
      seed('checkpoint', '根轨迹检查点应要求学生提交哪项证据？', '起止点、实轴段、渐近线、关键交点和稳定范围。', ['只提交一张无标注图。', '只写“轨迹在左半平面”。'], '检查点要验证绘制规则和稳定判断。', 0.66, 'evaluate', 'unannotated-root-locus'),
      seed('checkpoint', '若根轨迹图没有增益方向箭头，应如何评价？', '检查点不完整，无法判断随增益变化的闭环极点走向。', ['只要曲线形状存在即可通过。', '方向箭头只属于美化。'], '增益方向是根轨迹解释的一部分。', 0.62, 'evaluate', 'missing-gain-direction'),
      seed('remediation', '学生把闭环极点当作开环极点绘制起点，应补救什么？', '补开环零极点与闭环极点轨迹的区别。', ['直接做频域裕度题。', '只练习单位换算。'], '起点概念错误会导致整张根轨迹错误。', 0.38, 'apply', 'open-closed-pole-confusion'),
      seed('remediation', '学生实轴段判断反复错误，应补救什么？', '补右侧零极点奇偶规则和标注练习。', ['跳到校正综合设计。', '只看三维仿真。'], '实轴段规则是后续绘图的底层规则。', 0.4, 'apply', 'real-axis-rule-missing'),
      seed('remediation', '学生无法从根轨迹判断稳定范围，应补救什么？', '补虚轴穿越和临界增益计算。', ['只背根轨迹定义。', '只调大图像比例。'], '稳定范围判断需要连接图和特征方程。', 0.48, 'analyze', 'stability-range-missing'),
    ],
  },
  {
    id: 'stability-margin-frequency-analysis',
    title: '稳定裕度与频域安全边界',
    kaqObjectiveIds: [
      'knowledge:autocontrol:frequency-response',
      'capability:autocontrol:trade-off-engineering-constraints',
      'quality:autocontrol:safety-responsibility',
    ],
    graphNodeIds: [
      'kn:autocontrol:stability-margin',
      'cap:autocontrol:trade-off-engineering-constraints',
      'qual:autocontrol:safety-responsibility',
    ],
    remediationResourceNodeIds: ['registry:lesson14-margin-tradeoff-lab'],
    seeds: [
      seed('readiness', '进入稳定裕度学习前，应先能读出哪两个频率点？', '增益穿越频率和相位穿越频率。', ['峰值时间和上升时间。', '采样频率和显示刷新率。'], '稳定裕度建立在穿越频率识别上。', 0.36, 'apply', 'crossing-frequency-missing'),
      seed('practice', '相位裕度为负时，应练习哪项结论？', '闭环稳定风险高，不能只凭低频增益判断安全。', ['相位裕度负值说明响应更快且安全。', '只要幅值裕度大就一定安全。'], '相位裕度直接指向稳定安全边界。', 0.54, 'analyze', 'negative-margin-misread'),
      seed('practice', '幅值裕度读数很小，应练习什么工程解释？', '模型增益轻微变化就可能使系统接近不稳定。', ['系统一定没有稳态误差。', '控制器计算量一定过大。'], '幅值裕度描述增益不确定性的安全余量。', 0.56, 'analyze', 'gain-margin-meaning-missing'),
      seed('practice', '提高带宽后相位裕度降低，应练习哪类权衡？', '速度提升与稳定安全边界收窄之间的权衡。', ['带宽越高越安全。', '相位裕度和带宽互不相关。'], '频域安全边界要求同时看速度和裕度。', 0.62, 'evaluate', 'bandwidth-margin-tradeoff-missing'),
      seed('practice', '若存在执行器饱和风险，稳定裕度分析还应补充什么？', '将频域裕度与控制量限制共同说明。', ['只保留 Bode 图，不讨论执行器。', '只看时域超调。'], '安全边界既有频域裕度，也有工程约束。', 0.64, 'evaluate', 'ignores-actuator-safety'),
      seed('checkpoint', '稳定裕度检查点应要求哪组证据？', 'Bode/Nyquist 读数、穿越频率、裕度数值和安全结论。', ['只说“裕度足够”。', '只提交没有坐标的曲线图。'], '检查点需要可复查的频域读数。', 0.68, 'evaluate', 'margin-without-numeric-evidence'),
      seed('checkpoint', '学生没有说明裕度与任务风险的关系，应如何判定？', '检查点不完整，需要补安全责任和任务约束解释。', ['直接通过，因为数值已经写出。', '只让学生改图例名称。'], '稳定裕度学习目标包含安全边界解释。', 0.7, 'evaluate', 'margin-without-safety-context'),
      seed('remediation', '学生不会找增益穿越频率，应补救什么？', '补 0 dB 交叉点和相位读数的图上定位。', ['直接做综合校正参数优化。', '只背根轨迹渐近线公式。'], '穿越频率定位是裕度计算前置能力。', 0.38, 'apply', 'gain-crossover-missing'),
      seed('remediation', '学生把幅值裕度和相位裕度互换，应补救什么？', '补两个裕度的定义、单位和读取位置。', ['只要求重新画曲线。', '直接进入船海任务。'], '裕度类型混淆会导致安全结论错误。', 0.42, 'apply', 'margin-type-confusion'),
      seed('remediation', '学生只追求大带宽忽略安全余量，应补救什么？', '补带宽、噪声和稳定裕度的工程折中。', ['只做低频增益计算。', '只看闭环静态误差。'], '频域设计不能把速度和安全边界割裂。', 0.5, 'analyze', 'speed-over-safety'),
    ],
  },
  {
    id: 'simulation-validation-practice',
    title: '仿真验证实践',
    kaqObjectiveIds: [
      'knowledge:autocontrol:simulation-validation',
      'capability:autocontrol:validate-with-simulation-evidence',
      'quality:autocontrol:evidence-integrity',
    ],
    graphNodeIds: [
      'kn:autocontrol:simulation-validation',
      'cap:autocontrol:validate-with-simulation-evidence',
      'qual:autocontrol:evidence-integrity',
    ],
    remediationResourceNodeIds: ['registry:sim-pid-v1'],
    seeds: [
      seed('readiness', '进入仿真验证前，学生应先能说明什么？', '仿真输入、模型参数、输出指标和对照基线。', ['只说明仿真界面颜色。', '只给最终控制器名称。'], '验证实践需要可复查的实验条件。', 0.36, 'apply', 'simulation-setup-missing'),
      seed('practice', '仿真前后响应对比时，应练习哪项记录？', '统一输入条件下的指标表和曲线截图。', ['只保存较好看的曲线。', '改变输入后直接比较结果。'], '对照实验必须保持条件一致。', 0.5, 'analyze', 'invalid-simulation-comparison'),
      seed('practice', '仿真结果与理论预测不一致，应练习哪项排查？', '检查模型参数、离散步长、饱和限制和初始条件。', ['直接认为理论无效。', '只重新运行一次不记录差异。'], '验证实践要解释差异来源。', 0.62, 'evaluate', 'unexplained-simulation-gap'),
      seed('practice', '多次仿真数据需要支撑结论时，应练习什么？', '记录运行编号、参数版本和指标摘要。', ['只保留最后一次截图。', '只写“多次验证”。'], '证据完整性要求可追溯实验记录。', 0.58, 'evaluate', 'missing-run-provenance'),
      seed('practice', '控制器在标称模型有效但扰动下失效，应练习哪项判断？', '说明验证范围和鲁棒性限制。', ['只汇报标称模型成功。', '把扰动失败删除。'], '仿真验证目标包含边界条件说明。', 0.66, 'evaluate', 'hides-validation-limits'),
      seed('practice', '仿真结论要写入学习证据前，应练习哪项复核？', '确认指标、参数和运行记录能对应到同一次仿真。', ['只把最高分截图写入证据。', '只记录控制器名称不记录运行条件。'], '学习证据需要一次仿真内的参数、指标和结果一致。', 0.6, 'evaluate', 'simulation-evidence-not-linked'),
      seed('checkpoint', '仿真验证检查点能否只用选择题通过？', '不能，选择题只能支持诊断，终端证据必须来自受治理仿真记录。', ['可以，答对选择题即可替代仿真。', '可以，只要学生口头说明做过仿真。'], '该目标需要 typed simulation-run 终端证据。', 0.7, 'evaluate', 'quiz-replaces-simulation'),
      seed('remediation', '学生没有固定仿真输入条件，应补救什么？', '补对照实验设计和输入条件记录。', ['直接提高题目难度。', '只讲控制器分类。'], '缺少统一条件会使仿真结论不可比。', 0.42, 'apply', 'uncontrolled-simulation-input'),
      seed('remediation', '学生只保存截图不保存参数，应补救什么？', '补参数版本、模型版本和指标摘要记录。', ['只改截图标题。', '只要求重跑一次。'], '参数可追溯性是仿真证据的一部分。', 0.46, 'apply', 'parameter-provenance-missing'),
      seed('remediation', '学生把仿真失败结果删除，应补救什么？', '补失败案例、边界条件和限制说明的证据要求。', ['只展示最优案例。', '直接进入 Arena 排名。'], '验证实践需要呈现限制，不是筛选成功截图。', 0.54, 'analyze', 'cherry-picked-simulation'),
    ],
  },
  {
    id: 'ship-ocean-transfer-application',
    title: '船海场景迁移应用',
    kaqObjectiveIds: [
      'knowledge:autocontrol:modern-transfer',
      'capability:autocontrol:transfer-to-ship-ocean-mission',
      'quality:autocontrol:ship-ocean-mission',
    ],
    graphNodeIds: [
      'kn:autocontrol:modern-transfer',
      'cap:autocontrol:transfer-to-ship-ocean-mission',
      'qual:autocontrol:ship-ocean-mission',
    ],
    remediationResourceNodeIds: ['registry:arena-challenge-workbench'],
    seeds: [
      seed('practice', '把课堂模型迁移到船海任务时，首先应练习识别什么？', '任务环境、被控对象差异和安全约束。', ['只复制原控制器参数。', '只更换变量名称。'], '迁移应用必须先确认场景边界。', 0.54, 'analyze', 'copies-controller-without-context'),
      seed('practice', '船舶航向控制中扰动增强时，应练习哪项判断？', '控制方案对环境扰动和执行器限制的适应性。', ['只看无扰动标称响应。', '只比较题目分数。'], '船海任务强调环境扰动下的可用性。', 0.62, 'evaluate', 'ignores-ocean-disturbance'),
      seed('practice', '跨模型迁移时，模型阶次和参数含义改变，应练习什么？', '说明哪些设计假设仍成立，哪些需要重新验证。', ['认为所有线性模型都可直接套用。', '删除不一致参数。'], '迁移不是照搬，而是审查假设。', 0.66, 'evaluate', 'assumption-transfer-missing'),
      seed('practice', '任务包含乘员舒适性要求时，应练习哪项权衡？', '航迹误差、控制能量和舒适性指标之间的权衡。', ['只追求最快响应。', '只看稳态误差为零。'], '船海场景需要任务级多目标判断。', 0.64, 'evaluate', 'single-objective-transfer'),
      seed('practice', 'Arena 任务前，学生应练习哪项证据准备？', '整理仿真记录、约束说明和失败边界。', ['只准备最终答案截图。', '只背任务背景。'], '进入 Arena 前需要可追溯的方案证据。', 0.58, 'analyze', 'arena-evidence-missing'),
      seed('checkpoint', '船海迁移检查点能否只由普通练习题替代？', '不能，普通题支持诊断，终端验证需要 Arena 或仿真迁移证据。', ['可以，只要练习题分数高。', '可以，只要学生完成阅读。'], '该目标需要 typed terminal evidence。', 0.7, 'evaluate', 'quiz-replaces-transfer-evidence'),
      seed('checkpoint', '学生提交迁移方案但没有说明适用海况，应如何判定？', '检查点不完整，需要补任务边界和环境条件。', ['直接通过，因为控制器已给出。', '只要求把图画得更清晰。'], '船海迁移必须声明适用边界。', 0.68, 'evaluate', 'missing-operational-envelope'),
      seed('remediation', '学生照搬课堂参数到船海模型，应补救什么？', '补模型差异、参数含义和重新验证流程。', ['直接给 Arena 高阶题。', '只做单位换算。'], '迁移应用的主要误区是无条件照搬。', 0.46, 'apply', 'parameter-copying'),
      seed('remediation', '学生不记录失败海况，应补救什么？', '补失败边界和安全责任记录。', ['只保留成功案例。', '只看标称模型。'], '船海任务需要负面证据来说明边界。', 0.52, 'analyze', 'missing-failure-envelope'),
      seed('remediation', '学生无法解释舒适性与控制精度冲突，应补救什么？', '补多目标工程权衡和任务责任边界。', ['只提高控制增益。', '只降低评分门槛。'], '船海迁移不能只优化单一误差指标。', 0.56, 'evaluate', 'comfort-precision-tradeoff-missing'),
    ],
  },
];

function stagePurpose(stage: AuthoredStage): CheckpointAuthoredQuestionRecord['stagePurpose'] {
  if (stage === 'readiness') return 'readiness-gate';
  if (stage === 'practice') return 'practice';
  return stage;
}

function stableOptionIndex(seedValue: string): number {
  let hash = 0;
  for (const char of seedValue) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  }
  return hash % OPTION_KEYS.length;
}

function authoredOptions(
  id: string,
  seedItem: AuthoredQuestionSeed,
): {
  options: CheckpointAuthoredQuestionRecord['options'];
  answerKeys: CheckpointAuthoredQuestionRecord['answerKeys'];
} {
  const correctKey = OPTION_KEYS[stableOptionIndex(`${id}:${seedItem.stem}`)];
  const distractorKeys = OPTION_KEYS.filter((key) => key !== correctKey);
  const byKey = new Map<OptionKey, CheckpointAuthoredQuestionRecord['options'][number]>([
    [correctKey, {
      key: correctKey,
      text: seedItem.correct,
      isCorrect: true,
      explanation: seedItem.explanation,
    }],
    [distractorKeys[0], {
      key: distractorKeys[0],
      text: seedItem.distractors[0],
      isCorrect: false,
      explanation: `该选项对应误区：${seedItem.misconception}。`,
    }],
    [distractorKeys[1], {
      key: distractorKeys[1],
      text: seedItem.distractors[1],
      isCorrect: false,
      explanation: '该选项缺少本 LearningGoal 要求的证据或边界判断。',
    }],
  ]);
  return {
    options: OPTION_KEYS.map((key) => byKey.get(key)!),
    answerKeys: [correctKey],
  };
}

function authoredQuestion(
  target: GoalReviewTarget,
  seedItem: AuthoredQuestionSeed,
  ordinal: number,
): CheckpointAuthoredQuestionRecord {
  const id = `${target.id}-${seedItem.stage}-${String(ordinal).padStart(2, '0')}`;
  const { options, answerKeys } = authoredOptions(id, seedItem);
  return {
    id,
    learningGoalId: target.id,
    learningGoalTitle: target.title,
    stagePurpose: stagePurpose(seedItem.stage),
    stem: seedItem.stem,
    options,
    answerKeys,
    explanation: seedItem.explanation,
    difficulty: seedItem.difficulty,
    cognitiveLevel: seedItem.cognitiveLevel,
    kaqObjectiveIds: target.kaqObjectiveIds,
    graphNodeIds: target.graphNodeIds,
    knowledgeTags: [target.id, seedItem.stage],
    misconceptionTags: [`misconception:${target.id}:${seedItem.misconception}`],
    remediationResourceNodeIds: target.remediationResourceNodeIds,
    reviewedAt: LEARNING_GOAL_CHECKPOINT_QUESTION_SET_REVIEWED_AT,
    reviewerId: LEARNING_GOAL_CHECKPOINT_QUESTION_SET_REVIEWER_ID,
    reviewBatchId: LEARNING_GOAL_CHECKPOINT_QUESTION_SET_VERSION,
    sourceRef: `src/features/adaptive-assessment/learning-goal-checkpoint-question-sets.ts#${id}`,
  };
}

export const REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS: CheckpointAuthoredQuestionRecord[] = GOAL_REVIEW_TARGETS
  .flatMap((target) => {
    const stageOrdinals = new Map<AuthoredStage, number>();
    return target.seeds.map((seedItem) => {
      const ordinal = (stageOrdinals.get(seedItem.stage) ?? 0) + 1;
      stageOrdinals.set(seedItem.stage, ordinal);
      return authoredQuestion(target, seedItem, ordinal);
    });
  });
