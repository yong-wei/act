import type { CheckpointAuthoredQuestionRecord } from './learning-goal-checkpoint-question-sets';

export const TERMINAL_VALIDATION_QUESTION_SET_VERSION = 'learning-goal-terminal-validation-question-sets.v1';
export const TERMINAL_VALIDATION_QUESTION_SET_REVIEWED_AT = '2026-08-21T00:00:00.000Z';
export const TERMINAL_VALIDATION_QUESTION_SET_REVIEWER_ID = 'course-pedagogy-reviewer:issue-1478';
export const TERMINAL_VALIDATION_QUESTION_SET_REVIEWER_ROLE = 'course-pedagogy-reviewer';
export const TERMINAL_VALIDATION_REVIEW_BATCH_ID = 'extend-adaptive-assessment-lifecycle-coverage-v2.terminal-validation';

interface TerminalValidationSeed {
  learningGoalId: string;
  learningGoalTitle: string;
  kaqObjectiveIds: [string, string, string];
  graphNodeIds: [string, string, string];
  remediationResourceNodeIds: string[];
  stem: string;
  correct: string;
  distractors: [string, string];
  explanation: string;
  misconception: string;
}

const SEEDS: TerminalValidationSeed[] = [
  {
    learningGoalId: 'control-correction',
    learningGoalTitle: '控制系统校正设计',
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
    stem: '校正方案要作为题目型终结验证通过，最少必须同时具备哪组独立证据？',
    correct: '原系统缺口、补偿器选择理由、参数计算，以及校正前后指标对比',
    distractors: ['检查点已通过的同一张 Bode 截图', '低风险练习中答对的超前/滞后选择题'],
    explanation: '题目型终结验证不能复用检查点或练习证据，必须单独证明设计链和指标对比完整。',
    misconception: 'checkpoint-evidence-replaces-terminal-validation',
  },
  {
    learningGoalId: 'frequency-response-foundations',
    learningGoalTitle: '频率响应基础',
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
    stem: '频率响应题目型终结验证应独立证明什么，而不能只重复检查点读图？',
    correct: '能从指定 Bode 图同时给出低频增益、截止频率、相位裕度及其性能含义',
    distractors: ['再次提交检查点用过的 Bode 截图', '只答对练习中的斜率变化题'],
    explanation: '终结验证要求独立读图与指标解释，不能把检查点截图或练习正确项当作终态证据。',
    misconception: 'reuses-checkpoint-bode-screenshot',
  },
  {
    learningGoalId: 'feedback-loop-concept-foundations',
    learningGoalTitle: '反馈与闭环结构基础',
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
    stem: '闭环结构题目型终结验证要通过，学生必须独立完成哪项转换？',
    correct: '从给定框图写出给定通道和扰动通道到输出的关系',
    distractors: ['复述检查点背过的闭环公式', '只标出控制器方块位置'],
    explanation: '终结验证检查结构到表达式的独立转换，不接受检查点公式复述或练习级识别题替代。',
    misconception: 'formula-recitation-as-terminal-validation',
  },
  {
    learningGoalId: 'transfer-function-modeling-foundations',
    learningGoalTitle: '传递函数建模基础',
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
    stem: '传递函数建模题目型终结验证必须单独声明什么，才能与检查点区分？',
    correct: '建模假设、零初值条件、输入输出定义和最终传函来源',
    distractors: ['只交检查点已经批过的最终公式', '练习题中选对的串联相乘项'],
    explanation: '终结验证要独立核验模型来源与假设，不能把检查点公式或练习选项当作终态建模证据。',
    misconception: 'checkpoint-formula-as-model-origin',
  },
  {
    learningGoalId: 'time-domain-response-analysis',
    learningGoalTitle: '时域响应与性能指标分析',
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
    stem: '时域响应题目型终结验证最少应同时提交哪组独立证据？',
    correct: '曲线、指标读数、允许误差带和与检查点不同的结论说明',
    distractors: ['检查点已用过的同一张曲线截图', '只写“响应快”'],
    explanation: '终结验证需要独立图表、读数和误差带，不能复用检查点截图或练习级口头结论。',
    misconception: 'checkpoint-curve-reuse',
  },
  {
    learningGoalId: 'root-locus-analysis-foundations',
    learningGoalTitle: '根轨迹分析基础',
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
    stem: '根轨迹题目型终结验证要通过，必须独立给出哪组标注？',
    correct: '起止点、实轴段、渐近线、关键交点、增益方向和稳定范围',
    distractors: ['检查点那张无标注轨迹图', '练习题中的实轴奇偶判断'],
    explanation: '终结验证要求完整绘制与稳定范围，练习规则题或检查点草图都不能替代。',
    misconception: 'unannotated-locus-as-terminal-validation',
  },
  {
    learningGoalId: 'stability-margin-frequency-analysis',
    learningGoalTitle: '稳定裕度与频域安全边界',
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
    stem: '稳定裕度题目型终结验证必须独立报告什么安全结论？',
    correct: '穿越频率、PM/GM 数值，以及相对任务风险门槛是否同时满足',
    distractors: ['检查点写过的“裕度足够”', '只提交没有坐标的 Bode 图'],
    explanation: '终结验证要给出可复查读数和双门槛判定，不能沿用检查点定性句或练习级作图。',
    misconception: 'qualitative-margin-as-terminal-validation',
  },
  {
    learningGoalId: 'simulation-validation-practice',
    learningGoalTitle: '仿真验证实践',
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
    stem: '题目型终结验证能否替代受治理仿真运行记录？',
    correct: '不能。选择题只证明诊断能力，仿真终端证据仍须来自独立仿真记录',
    distractors: ['可以，答对这道题即可关闭仿真验证', '可以，只要检查点说过做过仿真'],
    explanation: '该目标的题目型终结验证与仿真/Arena 证据并存，互不替代。',
    misconception: 'quiz-replaces-simulation-terminal-evidence',
  },
  {
    learningGoalId: 'ship-ocean-transfer-application',
    learningGoalTitle: '船海场景迁移应用',
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
    stem: '船海迁移题目型终结验证能否只由普通练习或检查点题替代 Arena/仿真迁移证据？',
    correct: '不能。题目型验证只证明边界判断，终端迁移证据仍须来自 Arena 或仿真',
    distractors: ['可以，练习分数高即可关闭迁移验证', '可以，检查点通过后不必再提交任务边界'],
    explanation: '题目型终结验证与 Arena/仿真迁移证据显式组合，不能互相静默替代。',
    misconception: 'quiz-replaces-transfer-terminal-evidence',
  },
];

function buildRecord(seed: TerminalValidationSeed): CheckpointAuthoredQuestionRecord {
  const id = `${seed.learningGoalId}-terminal-validation-01`;
  return {
    id,
    learningGoalId: seed.learningGoalId,
    learningGoalTitle: seed.learningGoalTitle,
    stagePurpose: 'terminal-validation',
    stem: seed.stem,
    options: [
      {
        key: 'A',
        text: seed.correct,
        isCorrect: true,
        explanation: seed.explanation,
      },
      {
        key: 'B',
        text: seed.distractors[0],
        isCorrect: false,
        explanation: `该选项对应误区：${seed.misconception}。`,
      },
      {
        key: 'C',
        text: seed.distractors[1],
        isCorrect: false,
        explanation: '该选项把其他阶段证据静默当成终结验证。',
      },
    ],
    answerKeys: ['A'],
    explanation: seed.explanation,
    difficulty: 0.74,
    cognitiveLevel: 'evaluate',
    objectiveKinds: ['A', 'Q'],
    kaqObjectiveIds: [...seed.kaqObjectiveIds],
    graphNodeIds: [...seed.graphNodeIds],
    knowledgeTags: [seed.learningGoalId, 'terminal-validation'],
    misconceptionTags: [`misconception:${seed.learningGoalId}:${seed.misconception}`],
    remediationResourceNodeIds: seed.remediationResourceNodeIds,
    reviewedAt: TERMINAL_VALIDATION_QUESTION_SET_REVIEWED_AT,
    reviewerId: TERMINAL_VALIDATION_QUESTION_SET_REVIEWER_ID,
    reviewerRole: TERMINAL_VALIDATION_QUESTION_SET_REVIEWER_ROLE,
    reviewBatchId: TERMINAL_VALIDATION_REVIEW_BATCH_ID,
    sourceRef: `src/features/adaptive-assessment/learning-goal-terminal-validation-question-sets.ts#${id}`,
  };
}

export const REVIEWED_TERMINAL_VALIDATION_QUESTIONS: CheckpointAuthoredQuestionRecord[] = SEEDS.map(buildRecord);
