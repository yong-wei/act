import type { AdaptiveAssessmentCatalogStage } from './adaptive-assessment-item-catalog';
import { REVIEWED_TERMINAL_VALIDATION_QUESTIONS } from './learning-goal-terminal-validation-question-sets';
import type { CrossDomainQuestion, QuestionDomain, QuestionType } from '../assessment/adaptive-question-bank';

export const LEARNING_GOAL_CHECKPOINT_QUESTION_SET_VERSION = 'learning-goal-checkpoint-question-sets.v2';
export const LEARNING_GOAL_CHECKPOINT_QUESTION_SET_REVIEWED_AT = '2026-07-18T00:00:00.000Z';
export const LEARNING_GOAL_CHECKPOINT_QUESTION_SET_REVIEWER_ID = 'course-pedagogy-reviewer:issue-883';
export const LEARNING_GOAL_CHECKPOINT_QUESTION_SET_REVIEWER_ROLE = 'course-pedagogy-reviewer';
export const LEARNING_GOAL_CHECKPOINT_REVIEW_BATCH_ID = 'complete-assessment-checkpoint-resource-semantics.v2';
export const CHECKPOINT_AUTHORED_QUESTION_RUNTIME_ID_PREFIX = 'checkpoint-authored-question:';

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
  objectiveKinds: ObjectiveKind[];
  kaqObjectiveIds: string[];
  graphNodeIds: string[];
  knowledgeTags: string[];
  misconceptionTags: string[];
  remediationResourceNodeIds: string[];
  reviewedAt: string;
  reviewerId: string;
  reviewerRole: string;
  reviewBatchId: string;
  sourceRef: string;
}

const RUNTIME_DOMAINS_BY_STAGE: Record<AuthoredStage, QuestionDomain[]> = {
  readiness: ['complex', 'time'],
  practice: ['time', 'frequency'],
  checkpoint: ['complex', 'frequency'],
  remediation: ['time', 'physical'],
};

const RUNTIME_TYPE_BY_STAGE: Record<AuthoredStage, QuestionType> = {
  readiness: 'pole-to-behavior',
  practice: 'design-tradeoff',
  checkpoint: 'multi-criteria',
  remediation: 'design-tradeoff',
};

type AuthoredStage = 'readiness' | 'practice' | 'checkpoint' | 'remediation';

interface GoalReviewTarget {
  id: string;
  title: string;
  kaqObjectiveIds: string[];
  graphNodeIds: string[];
  remediationResourceNodeIds: string[];
  seeds: AuthoredQuestionSeedInput[];
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
  objectiveKinds: ObjectiveKind[];
}

type AuthoredQuestionSeedInput = Omit<AuthoredQuestionSeed, 'objectiveKinds'>;

const OPTION_KEYS = ['A', 'B', 'C'] as const;
type OptionKey = typeof OPTION_KEYS[number];
type ObjectiveKind = 'K' | 'A' | 'Q';

function seed(
  stage: AuthoredStage,
  stem: string,
  correct: string,
  distractors: [string, string],
  explanation: string,
  difficulty: number,
  cognitiveLevel: string,
  misconception: string,
): AuthoredQuestionSeedInput {
  return { stage, stem, correct, distractors, explanation, difficulty, cognitiveLevel, misconception };
}

const reviewedSeed = seed;

const EXPLICIT_CORRECT_KEYS: Readonly<Record<string, OptionKey>> = {
  'control-correction-readiness-01': 'A',
  'control-correction-readiness-02': 'B',
  'control-correction-readiness-03': 'C',
  'control-correction-practice-06': 'A',
  'control-correction-checkpoint-03': 'B',
  'frequency-response-foundations-readiness-01': 'C',
  'frequency-response-foundations-readiness-02': 'A',
  'frequency-response-foundations-readiness-03': 'B',
  'frequency-response-foundations-practice-05': 'C',
  'frequency-response-foundations-practice-06': 'A',
  'frequency-response-foundations-checkpoint-03': 'B',
  'feedback-loop-concept-foundations-readiness-02': 'C',
  'feedback-loop-concept-foundations-readiness-03': 'A',
  'feedback-loop-concept-foundations-practice-05': 'B',
  'feedback-loop-concept-foundations-practice-06': 'C',
  'feedback-loop-concept-foundations-checkpoint-02': 'A',
  'feedback-loop-concept-foundations-checkpoint-03': 'B',
  'transfer-function-modeling-foundations-readiness-01': 'C',
  'transfer-function-modeling-foundations-readiness-02': 'A',
  'transfer-function-modeling-foundations-readiness-03': 'B',
  'transfer-function-modeling-foundations-practice-06': 'C',
  'transfer-function-modeling-foundations-checkpoint-02': 'A',
  'transfer-function-modeling-foundations-checkpoint-03': 'B',
  'time-domain-response-analysis-readiness-01': 'C',
  'time-domain-response-analysis-readiness-02': 'A',
  'time-domain-response-analysis-practice-06': 'B',
  'time-domain-response-analysis-checkpoint-03': 'C',
  'root-locus-analysis-foundations-readiness-01': 'A',
  'root-locus-analysis-foundations-readiness-02': 'B',
  'root-locus-analysis-foundations-readiness-03': 'C',
  'root-locus-analysis-foundations-practice-06': 'A',
  'root-locus-analysis-foundations-checkpoint-03': 'B',
  'stability-margin-frequency-analysis-readiness-02': 'C',
  'stability-margin-frequency-analysis-practice-05': 'A',
  'stability-margin-frequency-analysis-practice-06': 'B',
  'stability-margin-frequency-analysis-checkpoint-03': 'C',
  'simulation-validation-practice-readiness-02': 'A',
  'simulation-validation-practice-readiness-03': 'B',
  'simulation-validation-practice-practice-06': 'C',
  'simulation-validation-practice-checkpoint-02': 'A',
  'simulation-validation-practice-checkpoint-03': 'B',
  'ship-ocean-transfer-application-readiness-01': 'C',
  'ship-ocean-transfer-application-readiness-02': 'A',
  'ship-ocean-transfer-application-readiness-03': 'B',
  'ship-ocean-transfer-application-practice-06': 'C',
  'ship-ocean-transfer-application-checkpoint-03': 'A',
  'control-correction-remediation-01': 'A',
  'control-correction-remediation-02': 'B',
  'control-correction-remediation-03': 'C',
  'frequency-response-foundations-remediation-01': 'B',
  'frequency-response-foundations-remediation-02': 'C',
  'frequency-response-foundations-remediation-03': 'A',
  'feedback-loop-concept-foundations-remediation-01': 'C',
  'feedback-loop-concept-foundations-remediation-02': 'A',
  'feedback-loop-concept-foundations-remediation-03': 'B',
  'transfer-function-modeling-foundations-remediation-01': 'A',
  'transfer-function-modeling-foundations-remediation-02': 'C',
  'transfer-function-modeling-foundations-remediation-03': 'B',
  'time-domain-response-analysis-remediation-01': 'B',
  'time-domain-response-analysis-remediation-02': 'A',
  'time-domain-response-analysis-remediation-03': 'C',
  'root-locus-analysis-foundations-remediation-01': 'C',
  'root-locus-analysis-foundations-remediation-02': 'B',
  'root-locus-analysis-foundations-remediation-03': 'A',
  'stability-margin-frequency-analysis-remediation-01': 'A',
  'stability-margin-frequency-analysis-remediation-02': 'B',
  'stability-margin-frequency-analysis-remediation-03': 'C',
  'simulation-validation-practice-remediation-01': 'B',
  'simulation-validation-practice-remediation-02': 'C',
  'simulation-validation-practice-remediation-03': 'A',
  'ship-ocean-transfer-application-remediation-01': 'C',
  'ship-ocean-transfer-application-remediation-02': 'A',
  'ship-ocean-transfer-application-remediation-03': 'B',
};

const PRACTICE_WITH_QUALITY = new Set([
  'control-correction-practice-04', 'control-correction-practice-05', 'control-correction-practice-06',
  'frequency-response-foundations-practice-03', 'frequency-response-foundations-practice-06',
  'feedback-loop-concept-foundations-practice-04',
  'transfer-function-modeling-foundations-practice-02', 'transfer-function-modeling-foundations-practice-05',
  'time-domain-response-analysis-practice-05',
  'root-locus-analysis-foundations-practice-05',
  'stability-margin-frequency-analysis-practice-01', 'stability-margin-frequency-analysis-practice-02',
  'stability-margin-frequency-analysis-practice-03', 'stability-margin-frequency-analysis-practice-04',
  'stability-margin-frequency-analysis-practice-05', 'stability-margin-frequency-analysis-practice-06',
  'simulation-validation-practice-practice-01', 'simulation-validation-practice-practice-03',
  'simulation-validation-practice-practice-04', 'simulation-validation-practice-practice-05',
  'simulation-validation-practice-practice-06',
  'ship-ocean-transfer-application-practice-01', 'ship-ocean-transfer-application-practice-02',
  'ship-ocean-transfer-application-practice-03', 'ship-ocean-transfer-application-practice-04',
  'ship-ocean-transfer-application-practice-05', 'ship-ocean-transfer-application-practice-06',
]);

const CHECKPOINT_WITH_QUALITY = new Set([
  'control-correction-checkpoint-01', 'control-correction-checkpoint-02', 'control-correction-checkpoint-03',
  'frequency-response-foundations-checkpoint-02', 'frequency-response-foundations-checkpoint-03',
  'feedback-loop-concept-foundations-checkpoint-02', 'feedback-loop-concept-foundations-checkpoint-03',
  'transfer-function-modeling-foundations-checkpoint-01', 'transfer-function-modeling-foundations-checkpoint-02',
  'transfer-function-modeling-foundations-checkpoint-03',
  'time-domain-response-analysis-checkpoint-01', 'time-domain-response-analysis-checkpoint-03',
  'root-locus-analysis-foundations-checkpoint-03',
  'stability-margin-frequency-analysis-checkpoint-01', 'stability-margin-frequency-analysis-checkpoint-02',
  'stability-margin-frequency-analysis-checkpoint-03',
  'simulation-validation-practice-checkpoint-01', 'simulation-validation-practice-checkpoint-02',
  'simulation-validation-practice-checkpoint-03',
  'ship-ocean-transfer-application-checkpoint-01', 'ship-ocean-transfer-application-checkpoint-02',
  'ship-ocean-transfer-application-checkpoint-03',
]);

const REMEDIATION_K = new Set([
  'control-correction-remediation-01',
  'frequency-response-foundations-remediation-01', 'frequency-response-foundations-remediation-02',
  'feedback-loop-concept-foundations-remediation-01',
  'transfer-function-modeling-foundations-remediation-01',
  'time-domain-response-analysis-remediation-02',
  'root-locus-analysis-foundations-remediation-01',
  'stability-margin-frequency-analysis-remediation-01',
]);
const REMEDIATION_A = new Set([
  'control-correction-remediation-02',
  'frequency-response-foundations-remediation-03',
  'feedback-loop-concept-foundations-remediation-02', 'feedback-loop-concept-foundations-remediation-03',
  'transfer-function-modeling-foundations-remediation-02', 'transfer-function-modeling-foundations-remediation-03',
  'time-domain-response-analysis-remediation-01', 'time-domain-response-analysis-remediation-03',
  'root-locus-analysis-foundations-remediation-02', 'root-locus-analysis-foundations-remediation-03',
  'stability-margin-frequency-analysis-remediation-02',
  'simulation-validation-practice-remediation-01',
  'ship-ocean-transfer-application-remediation-01',
]);
const REMEDIATION_AQ = new Set([
  'control-correction-remediation-03', 'stability-margin-frequency-analysis-remediation-03',
  'simulation-validation-practice-remediation-03', 'ship-ocean-transfer-application-remediation-03',
]);
const REMEDIATION_Q = new Set([
  'simulation-validation-practice-remediation-02', 'ship-ocean-transfer-application-remediation-02',
]);

function objectiveKindsFor(id: string, stage: AuthoredStage): ObjectiveKind[] {
  if (stage === 'readiness') {
    if (id === 'ship-ocean-transfer-application-readiness-03') return ['Q'];
    if (id === 'ship-ocean-transfer-application-readiness-01' || id === 'ship-ocean-transfer-application-readiness-02') {
      return ['K', 'Q'];
    }
    return ['K'];
  }
  if (stage === 'practice') return PRACTICE_WITH_QUALITY.has(id) ? ['A', 'Q'] : ['A'];
  if (stage === 'checkpoint') return CHECKPOINT_WITH_QUALITY.has(id) ? ['A', 'Q'] : ['A'];
  if (REMEDIATION_K.has(id)) return ['K'];
  if (REMEDIATION_A.has(id)) return ['A'];
  if (REMEDIATION_AQ.has(id)) return ['A', 'Q'];
  if (REMEDIATION_Q.has(id)) return ['Q'];
  throw new Error(`Missing authored objectiveKinds for ${id}`);
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
      seed('remediation', '系统稳态误差超标、相角裕度仍充足，希望提高低频增益且尽量不明显移动增益交叉频率，首选哪种校正及原因？', '滞后校正；提高低频增益，并通过极零点配置控制交叉频率变化', ['超前校正；理由仅是提高高频增益', '任意增加比例增益；无需复核稳定裕度'], '滞后校正适用于稳定裕度尚有余量、主要需改善稳态精度且希望少改变交叉频率的情形；设计后仍须复核相角裕度和动态响应。超前校正的主要作用是在目标频段提供正相角，不是单纯提高高频增益；任意增加比例增益可能移动交叉频率并侵蚀稳定裕度。', 0.45, 'apply', 'confuses-dynamic-and-steady-error'),
      seed('remediation', '对 G(s)=K/[s(s+2)]，候选根轨迹点 s=-1+j。由幅值条件复核得到的 K 是多少？', '2', ['1', '4'], '代入得 |s(s+2)|=|(-1+j)(1+j)|=2，所以 K=2。K=1漏掉复数乘积的模，K=4误把模平方当作增益。', 0.47, 'apply', 'gain-only-design'),
      seed('remediation', '校正后输出指标达标，但控制量峰值为12 V，执行器允许峰值不超过10 V。方案应如何判定？', '不通过，执行器峰值超限2 V', ['通过，因为输出指标达标', '通过，只需把纵轴改成百分比'], '12 V>10 V，超限2 V，因此方案不可执行。只看输出忽略执行器约束，改坐标单位也不会消除真实饱和。', 0.5, 'analyze', 'ignores-implementation-constraint'),
      reviewedSeed('readiness', '设计校正器前，哪组指标必须同时确认？', '稳态误差、动态响应和稳定裕度', ['只确认稳态误差', '只确认控制器阶次'], '校正设计需同时约束精度、动态性和稳定性。', 0.36, 'understand', 'single-metric-readiness'),
      reviewedSeed('readiness', '超前校正通常首先改变什么？', '提供正相角并提高可用带宽', ['只增加系统型别', '必然降低截止频率'], '超前网络主要提供相角超前并改善快速性。', 0.4, 'understand', 'lead-equals-integral'),
      reviewedSeed('readiness', '滞后校正更适合哪一目标？', '改善稳态精度且尽量保持原动态特性', ['同时大幅提高带宽', '消除所有模型不确定性'], '滞后网络利用低频增益与高频衰减改善稳态性能。', 0.42, 'understand', 'lag-increases-bandwidth'),
      reviewedSeed('practice', '系统相角裕度不足且响应偏慢，应优先试哪种校正？', '超前校正并复核交叉频率', ['增加纯积分且不复核稳定性', '降低采样点数量'], '超前校正能补充相角并提高截止频率，但仍需复核裕度。', 0.58, 'apply', 'tuning-without-margin-check'),
      reviewedSeed('checkpoint', '验收要求稳态误差≤2%、相角裕度PM≥35°；实测稳态误差1.4%、PM=12°。应如何判定？', '不通过，PM比门槛低23°', ['通过，因为稳态误差1.4%已达标', '通过，因为两项指标平均后达标'], '稳态误差1.4%≤2%，但PM=12°<35°且缺23°，双阈值未同时满足。只看稳态误差或平均不同量纲指标都会掩盖稳定裕度失败。', 0.72, 'evaluate', 'steady-error-overrides-margin'),
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
      seed('remediation', '频率响应模值 |G(jω)|=2，对应幅值是多少 dB？', '约6.02 dB', ['2 dB', '约3.01 dB'], '20log10(2)≈6.02 dB。直接把线性倍数当dB会得2 dB，使用10log10会误得3.01 dB。', 0.38, 'apply', 'db-linear-confusion'),
      seed('remediation', '一阶极点 G(s)=1/(1+s) 在 ω=1 rad/s 时贡献的相位约为多少？', '-45°', ['+45°', '-90°'], '相位为-arctan(ω)=-arctan(1)=-45°。+45°把极点误作零点，-90°把交接频率处误作高频极限。', 0.42, 'apply', 'phase-source-missing'),
      seed('remediation', '增益交叉频率处开环相位为-150°，项目要求相角裕度至少35°。应如何判定？', '不通过，相角裕度仅30°', ['通过，相角裕度为150°', '通过，因为幅值已在0 dB交叉'], 'PM=180°-150°=30°<35°，因此不通过。150°是相位绝对值而非裕度，出现0 dB交叉也不代表裕度达标。', 0.45, 'analyze', 'amplitude-only-stability'),
      reviewedSeed('readiness', 'Bode幅值图的纵轴通常表示什么？', '20log10|G(jω)|', ['相位裕度', '时间常数本身'], '幅值图以分贝表示频率响应模值。', 0.28, 'remember', 'magnitude-axis-confusion'),
      reviewedSeed('readiness', '一阶极点越过交接频率后对渐近斜率贡献多少？', '-20 dB/dec', ['+20 dB/dec', '0 dB/dec'], '每个一阶极点使高频斜率减少20 dB/dec。', 0.34, 'understand', 'pole-slope-sign'),
      reviewedSeed('readiness', '增益交叉频率如何定义？', '开环幅值等于1的频率', ['相位等于0°的频率', '闭环峰值时间'], '该频率是计算相角裕度的基准。', 0.36, 'understand', 'crossover-definition-swap'),
      reviewedSeed('practice', '幅频渐近线斜率从-20变为-40 dB/dec，说明可能遇到什么？', '一个额外一阶极点', ['一个一阶零点', '直流增益消失'], '斜率减少20 dB/dec对应新增一阶极点。', 0.52, 'apply', 'slope-break-misread'),
      reviewedSeed('practice', '带宽提高通常带来哪项权衡？', '响应更快但噪声敏感性可能增加', ['响应更慢且噪声必然减小', '只改变稳态误差'], '带宽连接快速性、噪声放大与鲁棒性。', 0.56, 'analyze', 'bandwidth-only-speed'),
      reviewedSeed('checkpoint', 'Bode图显示相角裕度小且高频增益偏大，应如何评价？', '同时存在鲁棒性和噪声放大风险', ['只说明稳态误差大', '系统一定无振荡'], '频域证据应联合解释稳定裕度与高频敏感性。', 0.7, 'evaluate', 'single-bode-feature'),
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
      seed('remediation', '负反馈系统中 r=5、y=4、传感器 H=0.8，误差信号 e 是多少？', '1.8', ['1.0', '0.8'], '反馈量 b=Hy=3.2，故 e=r-b=1.8。1.0误把反馈量直接等同输出，0.8把传感器增益当成误差。', 0.38, 'apply', 'feedback-equals-output'),
      seed('remediation', '比较点标为参考输入“+”、反馈输入“-”，误差信号应写成哪一式？', 'e=r-b', ['e=r+b', 'e=b-r'], '沿比较点符号相加得到 e=r-b。e=r+b把负反馈写成正反馈，e=b-r则把误差方向整体反转。', 0.36, 'apply', 'error-sign-confusion'),
      seed('remediation', '前向 G(s)=2/(s+1)、反馈 H(s)=0.5 的负反馈系统，其闭环特征方程化简为何式？', 's+2=0', ['s+1=0', 's=0'], '由1+GH=0得1+1/(s+1)=0，化简为s+2=0。s+1=0忽略反馈回路，s=0误把分母相减。', 0.44, 'analyze', 'gain-stability-confusion'),
      reviewedSeed('readiness', '负反馈闭环中比较点形成什么信号？', '给定与反馈量之差形成误差', ['输出与扰动之和', '控制器输出本身'], '误差信号驱动控制器修正偏差。', 0.28, 'understand', 'error-signal-definition'),
      reviewedSeed('readiness', '反馈符号接反最直接的风险是什么？', '负反馈变正反馈并可能失稳', ['只改变单位', '只降低传感器噪声'], '符号决定反馈作用方向。', 0.34, 'understand', 'feedback-sign-irrelevant'),
      reviewedSeed('practice', '已知对象、控制器和传感器，闭环建模还需明确什么？', '比较点、信号方向和反馈路径', ['只需对象名称', '只需最终输出'], '方框图语义取决于连接关系和信号方向。', 0.5, 'apply', 'components-without-connections'),
      reviewedSeed('practice', '扰动加在对象输入端时，应如何进入方框图？', '在对象前的求和点加入并保留符号', ['与参考输入视为同一点且不标符号', '直接删除'], '扰动位置决定其到输出和误差的传递路径。', 0.54, 'apply', 'disturbance-location-ignored'),
      reviewedSeed('checkpoint', '某图遗漏传感器动态却声称适用于高频测量，应如何判定？', '模型边界不完整，结论不可直接采用', ['通过，因为低频结构正确', '只修改图标题'], '被省略动态若影响目标频段，就必须进入边界说明。', 0.68, 'evaluate', 'omitted-sensor-dynamics'),
      reviewedSeed('checkpoint', '开环方案与闭环方案标称输出相同，哪项仍需比较？', '扰动和参数变化下的误差修正能力', ['只比较线条数量', '二者必然等价'], '闭环价值体现在反馈修正和鲁棒性，不只在标称输出。', 0.66, 'analyze', 'nominal-output-proves-equivalence'),
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
      seed('remediation', '由线性微分方程定义输入到输出的传递函数时，应采用哪种初始条件？', '全部初始条件为零', ['保留任意非零初值', '只令输入初值为零'], '传递函数是零初始条件下Y(s)/U(s)。保留非零初值会混入自由响应，只令输入初值为零并未清除系统储能。', 0.4, 'apply', 'initial-condition-mixed-in'),
      seed('remediation', '质量-弹簧-阻尼系统满足 2x¨+3x˙+8x=F，输入为F、输出为x。传递函数 X(s)/F(s) 是？', '1/(2s²+3s+8)', ['(2s²+3s+8)', '1/(2s²+8)'], '零初值拉氏变换得(2s²+3s+8)X=F。取倒数方向错误会得到多项式，漏掉3s则忽略阻尼。', 0.42, 'apply', 'undefined-input-output'),
      seed('remediation', '扰动 d 原在环节 G 前的求和点。若把求和点移到 G 后，为保持输出等价，扰动支路应如何变换？', '在扰动支路乘以 G', ['保持 d 不变', '在扰动支路除以 G'], '原输出含Gd，移到G后必须注入Gd。保持不变会漏乘G，除以G则把等效关系反向。', 0.48, 'analyze', 'invalid-block-diagram-transform'),
      reviewedSeed('readiness', '由微分方程求传递函数通常采用什么初始条件？', '零初始条件', ['任意未知初值', '稳态输出为零'], '传递函数定义为零初始条件下输出与输入拉氏变换之比。', 0.28, 'remember', 'nonzero-initial-condition'),
      reviewedSeed('readiness', '传递函数的极点由什么决定？', '约简后分母根', ['输入幅值', '输出单位'], '极点来自系统动态特征方程。', 0.32, 'understand', 'poles-from-input'),
      reviewedSeed('readiness', '串联系统的总传递函数如何得到？', '各环节传递函数相乘', ['各分母相加', '只取最后一环节'], '无内环串联通道按信号关系相乘。', 0.34, 'apply', 'series-addition'),
      reviewedSeed('practice', '单位负反馈、前向G(s)时闭环传递函数是？', 'G(s)/(1+G(s))', ['1/G(s)', 'G(s)+1'], '由比较点和反馈关系消元得到闭环表达式。', 0.48, 'apply', 'closed-loop-denominator'),
      reviewedSeed('checkpoint', '非线性对象只在小扰动工作点线性化，传递函数结论应如何表述？', '仅在声明的工作点和扰动范围内有效', ['对所有工况全局有效', '与工作点无关'], '线性化模型必须保留工作点与适用范围。', 0.68, 'evaluate', 'linearization-global-validity'),
      reviewedSeed('checkpoint', '两个模型拟合相近，但一个遗漏关键执行器动态，应选哪个？', '保留执行器动态且满足目标频段验证的模型', ['阶次最低者无条件优先', '参数最多者无条件优先'], '模型选择应服从任务边界与可验证动态，而非只看阶次。', 0.72, 'evaluate', 'model-order-only'),
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
      seed('remediation', '响应稳态值为2.0、峰值为2.5，百分比超调量是多少？', '25%', ['20%', '125%'], '按(2.5-2.0)/2.0×100%=25%。20%误用峰值作分母，125%把峰值比当作超调。', 0.35, 'apply', 'overshoot-definition-missing'),
      seed('remediation', '相邻两个振荡峰值相对稳态的偏差由0.8降为0.4，这段证据支持什么判断？', '振荡包络在衰减，符合稳定欠阻尼特征', ['振荡必然发散', '仅凭出现振荡即可判不稳定'], '峰值偏差比0.4/0.8=0.5<1，包络衰减。把衰减看成发散或把任何振荡等同失稳，都忽略了峰值序列证据。', 0.42, 'analyze', 'oscillation-equals-unstable'),
      seed('remediation', '标准二阶系统 ζ=0.5、ωn=4 rad/s，按近似式 ts(2%)≈4/(ζωn)，调节时间约为多少？', '2 s', ['0.5 s', '8 s'], 'ts≈4/(0.5×4)=2 s。0.5 s漏掉分子4，8 s把乘法关系错误地放到分子。', 0.4, 'apply', 'metric-evidence-missing'),
      reviewedSeed('readiness', '调节时间的判定依据是什么？', '响应进入并持续停留在规定误差带内', ['第一次到达稳态值', '响应峰值出现的时刻'], '调节时间要求此后持续位于误差带。', 0.32, 'understand', 'first-crossing-is-settling'),
      reviewedSeed('readiness', '超调量应相对哪个量归一化？', '稳态值', ['输入峰值', '仿真时长'], '超调量比较响应峰值与稳态值。', 0.34, 'understand', 'overshoot-wrong-reference'),
      reviewedSeed('practice', '两条响应稳态值相同，甲超调更小但调节更慢，正确判断是？', '甲改善超调但牺牲快速性', ['甲在所有动态指标上都更优', '二者动态性能完全相同'], '指标必须分别比较，不能由单一指标推断整体更优。', 0.55, 'analyze', 'single-index-ranking'),
      reviewedSeed('checkpoint', '计算值与 stepinfo 结果不一致时，最先核对什么？', '输入、误差带、稳态值定义和时间范围', ['直接采用软件结果', '删除解析计算'], '证据一致性依赖相同的模型、输入和指标定义。', 0.7, 'evaluate', 'tool-output-is-authority'),
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
      seed('remediation', '负反馈根轨迹在 K=0 时从哪些点出发？', '开环极点', ['闭环极点', '开环零点'], 'K=0时闭环特征根退化到开环极点，因此分支从开环极点出发。闭环极点随K变化不是固定起点，开环零点通常是终点。', 0.38, 'apply', 'open-closed-pole-confusion'),
      seed('remediation', '开环实轴极点为0、-2、-5，实轴零点为-1。哪些区间属于负反馈根轨迹？', '(-5,-2) 与 (-1,0)', ['(-∞,-5) 与 (-2,-1)', '(-2,0)'], '按右侧实轴零极点数为奇数判定，(-5,-2)右侧有3个、(-1,0)右侧有1个。另两项分别使用偶数区间或跨过零点后未重新计数。', 0.4, 'apply', 'real-axis-rule-missing'),
      seed('remediation', '闭环特征多项式为 s³+3s²+2s+K。Routh 判据给出的稳定增益范围是？', '0<K<6', ['K>6', '-6<K<0'], 'Routh首列为1、3、(6-K)/3、K，全部为正要求0<K<6。K>6使第三项变负，负K使常数项变负。', 0.48, 'analyze', 'stability-range-missing'),
      reviewedSeed('readiness', '根轨迹分支从哪里开始、到哪里结束？', '从开环极点到开环零点或无穷远零点', ['从闭环零点到闭环极点', '从虚轴到实轴'], '根轨迹描述增益变化时闭环极点的轨迹。', 0.34, 'understand', 'reversed-endpoints'),
      reviewedSeed('readiness', '负反馈180°根轨迹上的点需满足什么？', '角度条件且对应增益为正', ['仅满足幅值为1', '实部必须为零'], '角度条件确定轨迹，幅值条件再确定增益。', 0.42, 'understand', 'magnitude-only'),
      reviewedSeed('readiness', '实轴某点是否在根轨迹上由什么判断？', '其右侧实轴开环零极点总数为奇数', ['其左侧极点数为奇数', '该点模长小于1'], '实轴奇偶规则来自180°角度条件。', 0.4, 'apply', 'wrong-side-count'),
      reviewedSeed('practice', '已确认候选点满足角度条件，如何求对应K？', '用幅值条件求开环增益', ['用稳态误差直接代替K', '令所有极点实部为零'], '轨迹归属由角度条件判断，增益由幅值条件计算。', 0.58, 'apply', 'angle-gives-gain'),
      reviewedSeed('checkpoint', '设计要求ζ≥0.6且闭环稳定，如何从根轨迹选K？', '取轨迹与ζ线满足区间的点并用幅值条件求K', ['取最大K', '只取根轨迹与虚轴交点'], 'K选择必须同时满足阻尼和稳定边界。', 0.72, 'evaluate', 'max-gain-is-best'),
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
      seed('remediation', 'Bode 幅值曲线在 ω=4 rad/s 由正值穿过0 dB。增益交叉频率是多少？', '4 rad/s', ['0 dB', '由相位曲线的-180°交点决定'], '增益交叉频率就是幅值为0 dB处的频率4 rad/s。0 dB是幅值不是频率，-180°交点定义相位交叉频率。', 0.38, 'apply', 'gain-crossover-missing'),
      seed('remediation', '项目门槛为 PM≥30° 且 GM≥8 dB，测得 PM=30°、GM=8 dB。应如何判定？', '两项均达到边界，按该门槛通过', ['不通过，因为必须严格大于门槛', '只看PM即可通过'], '“≥”包含等号，30°和8 dB分别达标。改成严格大于误读了阈值，只核对PM则遗漏GM双门槛。', 0.42, 'apply', 'margin-type-confusion'),
      seed('remediation', '设计要求闭环带宽≥6 rad/s 且 PM≥35°，候选方案带宽8 rad/s、PM=28°。应如何判定？', '不通过，虽然带宽达标但PM不足7°', ['通过，因为带宽更高', '通过，因为两个指标取平均后足够'], '8≥6但28<35，PM缺7°，双阈值必须同时满足。只看带宽或把不同量纲指标平均都会掩盖安全余量不足。', 0.5, 'analyze', 'speed-over-safety'),
      reviewedSeed('readiness', '相角裕度表示什么？', '增益交叉频率处距离-180°的附加相位余量', ['相位交叉频率处的幅值', '稳态误差大小'], '相角裕度度量闭环失稳前可容许的相位损失。', 0.38, 'understand', 'margin-definition-swap'),
      reviewedSeed('practice', '增益交叉频率上升且相角裕度下降，最合理结论是？', '响应可能更快但鲁棒性降低', ['稳态精度必然变差', '系统一定无超调'], '带宽与裕度变化体现快速性和鲁棒性的权衡。', 0.58, 'analyze', 'bandwidth-without-robustness'),
      reviewedSeed('practice', '模型新增纯延迟后，幅频近似不变，应重点复核什么？', '相角裕度和闭环稳定性', ['只复核直流增益', '无需复核'], '延迟增加负相位，可能显著侵蚀相角裕度。', 0.62, 'analyze', 'delay-affects-no-margin'),
      reviewedSeed('checkpoint', '所有可信参数组合均要求PM≥30°；标称PM=42°，最坏组合PM=5°。应如何判定？', '不通过，最坏组合比门槛低25°', ['通过，因为标称42°达标', '通过，因为只需报告标称组合'], '可信组合必须逐一满足PM≥30°，最坏5°仅比失稳边界多5°且低于门槛25°。以标称值或省略最坏组合都会掩盖安全边界失败。', 0.76, 'evaluate', 'nominal-overrides-worst-case'),
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
      seed('remediation', '方案甲用单位阶跃、方案乙用单位斜坡，现要比较峰值和调节时间。哪项处理正确？', '先统一输入及初始条件再比较', ['直接比较现有曲线', '只把两张图的时间轴设为相同'], '不同输入激励产生的指标不可直接归因于方案差异，必须统一输入和初值。直接比较或只统一坐标都没有控制实验变量。', 0.42, 'apply', 'uncontrolled-simulation-input'),
      seed('remediation', '哪组记录足以让第三方复核一次仿真结论？', '模型哈希、参数快照、输入、步长、运行编号和指标读数', ['只有最终截图和结论', '只有控制器名称和运行日期'], '可复核链需要定位模型、参数、激励、数值设置与结果。截图缺少生成条件，名称与日期也无法重建运行。', 0.46, 'apply', 'parameter-provenance-missing'),
      seed('remediation', '同一方案在标称、参数上偏差和强扰动三种工况中，前两项通过、强扰动超限。总体结论应是什么？', '不能宣称全工况通过，强扰动是已验证失败边界', ['按多数工况判通过', '删除强扰动结果后判通过'], '最坏可信工况已经超限，所以全工况声明不成立。多数表决不适用于安全边界，删除失败结果会破坏证据完整性。', 0.54, 'analyze', 'cherry-picked-simulation'),
      reviewedSeed('readiness', '哪项才构成模型验证而非仅作图？', '用独立预期或解析结果比较并声明容差', ['生成一条平滑曲线', '增加图表颜色'], '验证必须有可比较预期、容差和判据。', 0.34, 'understand', 'plot-equals-validation'),
      reviewedSeed('readiness', '可复现实验最少应记录什么？', '模型版本、参数、输入、步长和判据', ['只记录最终截图', '只记录运行日期'], '缺少运行条件无法复核仿真证据。', 0.38, 'understand', 'screenshot-is-reproducible'),
      reviewedSeed('practice', '解析峰值1.20，仿真峰值1.22，容差±0.03，应如何判定？', '该指标通过，但仍需检查其他判据', ['整个模型无条件通过', '因数值不同立即判失败'], '单项差值在容差内只证明该项通过。', 0.54, 'apply', 'one-metric-proves-model'),
      reviewedSeed('checkpoint', '仿真与解析结果偏差随步长减小而收敛，最可能原因是？', '数值离散误差', ['解析模型必然错误', '输入定义无关'], '步长收敛是识别数值误差的重要证据。', 0.68, 'analyze', 'ignores-step-convergence'),
      reviewedSeed('checkpoint', '仿真结论没有模型哈希和参数快照，应如何处理？', '不作为掌握或终端证据，补齐来源后重跑', ['直接按截图通过', '只补写结论文本'], '缺少来源与配置不能形成可审计证据。', 0.76, 'evaluate', 'unversioned-run-is-authoritative'),
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
    remediationResourceNodeIds: ['arena-task:task-second-order-lead-pid'],
    seeds: [
      seed('practice', '把课堂模型迁移到船海任务时，首先应练习识别什么？', '任务环境、被控对象差异和安全约束。', ['只复制原控制器参数。', '只更换变量名称。'], '迁移应用必须先确认场景边界。', 0.54, 'analyze', 'copies-controller-without-context'),
      seed('practice', '船舶航向控制中扰动增强时，应练习哪项判断？', '控制方案对环境扰动和执行器限制的适应性。', ['只看无扰动标称响应。', '只比较题目分数。'], '船海任务强调环境扰动下的可用性。', 0.62, 'evaluate', 'ignores-ocean-disturbance'),
      seed('practice', '跨模型迁移时，模型阶次和参数含义改变，应练习什么？', '说明哪些设计假设仍成立，哪些需要重新验证。', ['认为所有线性模型都可直接套用。', '删除不一致参数。'], '迁移不是照搬，而是审查假设。', 0.66, 'evaluate', 'assumption-transfer-missing'),
      seed('practice', '任务包含乘员舒适性要求时，应练习哪项权衡？', '航迹误差、控制能量和舒适性指标之间的权衡。', ['只追求最快响应。', '只看稳态误差为零。'], '船海场景需要任务级多目标判断。', 0.64, 'evaluate', 'single-objective-transfer'),
      seed('practice', 'Arena 任务前，学生应练习哪项证据准备？', '整理仿真记录、约束说明和失败边界。', ['只准备最终答案截图。', '只背任务背景。'], '进入 Arena 前需要可追溯的方案证据。', 0.58, 'analyze', 'arena-evidence-missing'),
      seed('checkpoint', '船海迁移检查点能否只由普通练习题替代？', '不能，普通题支持诊断，终端验证需要 Arena 或仿真迁移证据。', ['可以，只要练习题分数高。', '可以，只要学生完成阅读。'], '该目标需要 typed terminal evidence。', 0.7, 'evaluate', 'quiz-replaces-transfer-evidence'),
      seed('checkpoint', '学生提交迁移方案但没有说明适用海况，应如何判定？', '检查点不完整，需要补任务边界和环境条件。', ['直接通过，因为控制器已给出。', '只要求把图画得更清晰。'], '船海迁移必须声明适用边界。', 0.68, 'evaluate', 'missing-operational-envelope'),
      seed('remediation', '课堂 Nomoto 模型参数 K=0.20、T=8 s，目标船模型 K=0.12、T=14 s。迁移控制器时应如何处理？', '按目标船 K、T 重新计算并在目标工况验证', ['原参数可直接照搬', '只把时间轴乘以14/8即可'], '对象增益和时间常数均已变化，必须基于0.12与14 s重新设计并验证。直接照搬忽略对象差异，只缩放时间轴不能修正闭环增益与约束。', 0.46, 'apply', 'parameter-copying'),
      seed('remediation', '舵机饱和率门槛为不超过10%，平静海况为4%，高海况为31%。应如何记录适用边界？', '平静海况通过，高海况因31%>10%不通过', ['两种海况平均17.5%，按平均值判定', '只报告4%的成功工况'], '4%≤10%而31%>10%，所以边界位于高海况之前。平均值不能替代逐工况安全阈值，只报成功工况会隐去失败边界。', 0.52, 'analyze', 'missing-failure-envelope'),
      seed('remediation', '舒适性要求航向RMS≤1.5°且舵机饱和率≤10%，某工况测得RMS=1.4°、饱和率9%。应如何判定？', '两项均达标，该工况通过', ['只因RMS达标即可通过，无需看饱和率', '不通过，因为任一指标都必须等于零'], '1.4°≤1.5°且9%≤10%，双阈值同时满足。只看舒适性会漏掉执行器边界，要求指标为零则擅自改变验收标准。', 0.56, 'evaluate', 'comfort-precision-tradeoff-missing'),
      reviewedSeed('readiness', '将课堂模型迁移到船海任务前，首先应声明什么？', '任务工况、对象差异和适用边界', ['只声明控制器名称', '只声明仿真软件'], '迁移判断必须以任务边界和模型差异为起点。', 0.38, 'understand', 'missing-operational-envelope'),
      reviewedSeed('readiness', '航向控制中哪组约束不能省略？', '风浪扰动、舵机限幅和航向误差要求', ['只保留标称航速', '只保留无扰动响应'], '船海方案必须覆盖环境扰动与执行器约束。', 0.42, 'understand', 'ignores-ocean-and-actuator-limits'),
      reviewedSeed('readiness', '普通选择题能否替代船海迁移的终端证据？', '不能，终端验证需官方Arena或带来源的仿真运行', ['能，只要得分高', '能，只要完成阅读'], '题目支持诊断，但不能替代typed terminal evidence。', 0.48, 'understand', 'quiz-replaces-terminal-evidence'),
      reviewedSeed('practice', '同一控制器在四级与五级海况下，航向RMS分别为1.8°、1.2°，舵机饱和率分别为4%、31%；要求RMS≤1.5°且饱和率≤10%。应如何判定？', '两个海况均不通过：四级RMS超0.3°，五级饱和率超21个百分点', ['四级通过，因为饱和率4%达标', '五级通过，因为RMS为1.2°达标'], '四级1.8°>1.5°，五级31%>10%，每个海况都至少违反一个阈值。只看各自达标的单项会漏掉双阈值约束。', 0.7, 'evaluate', 'single-objective-transfer'),
      reviewedSeed('checkpoint', '验收覆盖四至五级海况，要求RMS≤1.5°、舵角≤20°、最坏PM≥30°；提交仅含四级RMS=1.2°、舵角18°，应如何判定？', '不通过，缺少五级海况和最坏PM证据', ['通过，四级两项数值均达标', '通过，可由四级结果推定五级与最坏PM'], '四级RMS与舵角达标，但验收还要求五级工况及所有可信组合的最坏PM；缺失证据不能推定为通过。只核对已提交数值或外推未测工况都会破坏证据完整性。', 0.76, 'evaluate', 'missing-operational-envelope'),
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
  const correctKey = EXPLICIT_CORRECT_KEYS[id] ?? OPTION_KEYS[stableOptionIndex(`${id}:${seedItem.stem}`)];
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
  const objectiveKinds = seedItem.objectiveKinds;
  const objectiveIndexes = objectiveKinds.map((kind) => ({ K: 0, A: 1, Q: 2 })[kind]);
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
    objectiveKinds,
    kaqObjectiveIds: objectiveIndexes.map((index) => target.kaqObjectiveIds[index]),
    graphNodeIds: objectiveIndexes.map((index) => target.graphNodeIds[index]),
    knowledgeTags: [target.id, seedItem.stage],
    misconceptionTags: [`misconception:${target.id}:${seedItem.misconception}`],
    remediationResourceNodeIds: target.remediationResourceNodeIds,
    reviewedAt: LEARNING_GOAL_CHECKPOINT_QUESTION_SET_REVIEWED_AT,
    reviewerId: LEARNING_GOAL_CHECKPOINT_QUESTION_SET_REVIEWER_ID,
    reviewerRole: LEARNING_GOAL_CHECKPOINT_QUESTION_SET_REVIEWER_ROLE,
    reviewBatchId: LEARNING_GOAL_CHECKPOINT_REVIEW_BATCH_ID,
    sourceRef: `src/features/adaptive-assessment/learning-goal-checkpoint-question-sets.ts#${id}`,
  };
}

export const REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS: CheckpointAuthoredQuestionRecord[] = GOAL_REVIEW_TARGETS
  .flatMap((target) => {
    const stageOrdinals = new Map<AuthoredStage, number>();
    return target.seeds.map((seedItem) => {
      const ordinal = (stageOrdinals.get(seedItem.stage) ?? 0) + 1;
      stageOrdinals.set(seedItem.stage, ordinal);
      const id = `${target.id}-${seedItem.stage}-${String(ordinal).padStart(2, '0')}`;
      return authoredQuestion(target, {
        ...seedItem,
        objectiveKinds: objectiveKindsFor(id, seedItem.stage),
      }, ordinal);
    });
  });

function runtimeStage(record: CheckpointAuthoredQuestionRecord): AuthoredStage {
  if (record.stagePurpose === 'readiness' || record.stagePurpose === 'readiness-gate' || record.stagePurpose === 'precheck') {
    return 'readiness';
  }
  if (record.stagePurpose === 'checkpoint' || record.stagePurpose === 'terminal-validation') return 'checkpoint';
  if (record.stagePurpose === 'remediation') return 'remediation';
  return 'practice';
}

export function checkpointAuthoredQuestionRuntimeId(sourceId: string): string {
  return `${CHECKPOINT_AUTHORED_QUESTION_RUNTIME_ID_PREFIX}${sourceId}`;
}

export function sourceIdFromCheckpointAuthoredQuestionRuntimeId(questionId: string): string | null {
  return questionId.startsWith(CHECKPOINT_AUTHORED_QUESTION_RUNTIME_ID_PREFIX)
    ? questionId.slice(CHECKPOINT_AUTHORED_QUESTION_RUNTIME_ID_PREFIX.length)
    : null;
}

export function getCheckpointAuthoredQuestionRecordByRuntimeId(
  questionId: string,
): CheckpointAuthoredQuestionRecord | null {
  const sourceId = sourceIdFromCheckpointAuthoredQuestionRuntimeId(questionId);
  if (!sourceId) return null;
  return REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS.find((record) => record.id === sourceId)
    ?? REVIEWED_TERMINAL_VALIDATION_QUESTIONS.find((record) => record.id === sourceId)
    ?? null;
}

export function checkpointAuthoredQuestionToRuntimeQuestion(
  record: CheckpointAuthoredQuestionRecord,
): CrossDomainQuestion {
  const stage = runtimeStage(record);
  return {
    id: checkpointAuthoredQuestionRuntimeId(record.id),
    stem: record.stem,
    domains: RUNTIME_DOMAINS_BY_STAGE[stage],
    type: RUNTIME_TYPE_BY_STAGE[stage],
    difficulty: record.difficulty,
    knowledgeTags: record.knowledgeTags,
    options: record.options.map((option) => ({
      label: option.key,
      text: option.text,
      isCorrect: option.isCorrect,
      explanation: option.explanation,
    })),
  };
}

export const REVIEWED_LEARNING_GOAL_CHECKPOINT_RUNTIME_QUESTIONS: CrossDomainQuestion[] =
  REVIEWED_LEARNING_GOAL_CHECKPOINT_QUESTIONS.map(checkpointAuthoredQuestionToRuntimeQuestion);
