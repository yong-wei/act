import type {
  ChallengeObject,
  ChallengeTask,
  LeaderboardPolicy,
  MetricProfile,
} from '../types';

export const ARENA_CHALLENGE_OBJECTS: ChallengeObject[] = [
  {
    id: 'plant-second-order-underdamped',
    name: '二阶欠阻尼对象',
    source: 'typical',
    visibility: 'white-box',
    chapter: '模块 2 / 模块 3',
    tags: ['二阶', '欠阻尼', '白箱'],
    model: { display: 'G(s)=16/(s^2+2.4s+16)', numerator: [16], denominator: [1, 2.4, 16] },
    relatedKnowledge: ['二阶系统动态指标', '根轨迹', '频域裕度'],
  },
  {
    id: 'plant-integrator-low-frequency',
    name: '含积分环节对象',
    source: 'typical',
    visibility: 'white-box',
    chapter: '模块 3',
    tags: ['积分环节', '稳态误差', '低频增益'],
    model: { display: 'G(s)=8/(s(s+2)(s+8))', numerator: [8], denominator: [1, 10, 16, 0] },
    relatedKnowledge: ['系统型别', '稳态误差', '低频补偿'],
  },
  {
    id: 'plant-first-order-lag',
    name: '一阶惯性对象',
    source: 'typical',
    visibility: 'white-box',
    chapter: '模块 2',
    tags: ['一阶', '时间常数', '白箱'],
    model: { display: 'G(s)=4/(2s+1)', numerator: [4], denominator: [2, 1] },
    relatedKnowledge: ['一阶响应', '频率特性'],
  },
  {
    id: 'plant-third-order-pure-pole',
    name: '三阶纯极点对象',
    source: 'typical',
    visibility: 'white-box',
    chapter: '模块 3',
    tags: ['三阶', '纯极点', '稳定裕度'],
    model: { display: 'G(s)=20/((s+1)(s+4)(s+6))', numerator: [20], denominator: [1, 11, 34, 24] },
    relatedKnowledge: ['劳斯判据', '根轨迹读图'],
  },
  {
    id: 'plant-non-minimum-phase-lite',
    name: '轻度非最小相位对象',
    source: 'typical',
    visibility: 'white-box',
    chapter: '模块 3',
    tags: ['非最小相位', '右半平面零点', '响应边界'],
    model: { display: 'G(s)=6(1-s/5)/((s+1)(s+3))', numerator: [-1.2, 6], denominator: [1, 4, 3] },
    relatedKnowledge: ['零点作用', '非最小相边界'],
  },
  {
    id: 'plant-homework-margin',
    name: '作业裕度对象',
    source: 'homework',
    visibility: 'white-box',
    chapter: '模块 3 作业',
    tags: ['作业对象', '相位裕度', '白箱'],
    model: { display: 'G(s)=10/(s(s+1)(0.2s+1))', numerator: [10], denominator: [0.2, 1.2, 1, 0] },
    relatedKnowledge: ['Bode 图', '裕度校正'],
  },
  {
    id: 'plant-odyssey-level-one',
    name: '控制奥德赛 Level 1 对象',
    source: 'control-odyssey',
    visibility: 'white-box',
    chapter: '控制奥德赛',
    tags: ['关卡挑战', '低阶对象', '白箱'],
    model: { display: 'G(s)=3/(s^2+1.6s+3)', numerator: [3], denominator: [1, 1.6, 3] },
    relatedKnowledge: ['闭环稳定', '参数调节'],
  },
  {
    id: 'plant-ship-roll-whitebox',
    name: '船舶横摇白箱模型',
    source: 'virtual-simulation',
    visibility: 'white-box',
    chapter: '模块 4 / 模块 5',
    tags: ['船舶横摇', '舒适度', '频域约束'],
    model: { display: 'G(s)=0.8/(s^2+0.5s+1.44)', numerator: [0.8], denominator: [1, 0.5, 1.44] },
    relatedKnowledge: ['频域舒适度', '陷波滤波', '控制量约束'],
  },
  {
    id: 'plant-delay-approximated',
    name: '时滞近似对象',
    source: 'typical',
    visibility: 'white-box',
    chapter: '模块 4',
    tags: ['时滞近似', 'Padé', '校正边界'],
    model: { display: 'G(s)=5(1-0.25s)/(s+1)(1+0.25s)', numerator: [-1.25, 5], denominator: [0.25, 1.25, 1] },
    relatedKnowledge: ['时滞控制', '稳定裕度'],
  },
];

export const ARENA_METRIC_PROFILES: MetricProfile[] = [
  {
    id: 'metric-whitebox-time-domain-balanced',
    name: '白箱时域均衡评分',
    hardConstraints: ['closed_loop_stable', 'finite_response', 'controller_causal'],
    rankingMetrics: [
      { id: 'settlingTime', label: '调节时间', direction: 'minimize', idealValue: 2.4, unacceptableValue: 8, unit: 's' },
      { id: 'overshoot', label: '超调量', direction: 'minimize', idealValue: 5, unacceptableValue: 35, unit: '%' },
      { id: 'steadyStateError', label: '稳态误差', direction: 'minimize', idealValue: 0.01, unacceptableValue: 0.12 },
      { id: 'itae', label: 'ITAE', direction: 'minimize', idealValue: 1.8, unacceptableValue: 12 },
    ],
    diagnosticMetrics: ['riseTime', 'peakTime', 'controlEnergy', 'phaseMargin'],
  },
  {
    id: 'metric-whitebox-frequency-comfort',
    name: '白箱频域舒适度评分',
    hardConstraints: ['closed_loop_stable', 'finite_response', 'control_not_saturated'],
    rankingMetrics: [
      { id: 'comfortBandPeak', label: '舒适频段峰值', direction: 'minimize', idealValue: 0.8, unacceptableValue: 2.8 },
      { id: 'settlingTime', label: '调节时间', direction: 'minimize', idealValue: 4, unacceptableValue: 12, unit: 's' },
      { id: 'controlEnergy', label: '控制能量', direction: 'minimize', idealValue: 3, unacceptableValue: 16 },
      { id: 'overshoot', label: '超调量', direction: 'minimize', idealValue: 8, unacceptableValue: 30, unit: '%' },
    ],
    diagnosticMetrics: ['bandwidth', 'phaseMargin', 'maxControl', 'sensitivityPeak'],
  },
];

export const ARENA_LEADERBOARD_POLICIES: LeaderboardPolicy[] = [
  {
    id: 'leaderboard-whitebox-default',
    name: '白箱默认榜单',
    types: ['main', 'method', 'metric'],
    tieBreakers: ['hardConstraintPass', 'score', 'controlEnergy', 'submittedAt'],
    visibility: 'course',
  },
  {
    id: 'leaderboard-class-homework',
    name: '班级作业挑战榜',
    types: ['main', 'method', 'metric', 'class'],
    tieBreakers: ['hardConstraintPass', 'score', 'steadyStateError', 'submittedAt'],
    visibility: 'class',
  },
];

export const ARENA_CHALLENGE_TASKS: ChallengeTask[] = [
  {
    id: 'task-second-order-lead-pid',
    objectId: 'plant-second-order-underdamped',
    title: '二阶对象快速稳定挑战',
    goal: '缩短调节时间，同时限制超调量和稳态误差。',
    difficulty: '基础',
    allowedMethods: ['serial-compensator', 'pid'],
    metricProfileId: 'metric-whitebox-time-domain-balanced',
    leaderboardPolicyId: 'leaderboard-whitebox-default',
    leaderboardTypes: ['main', 'method', 'metric'],
    primaryMetrics: ['settlingTime', 'overshoot', 'steadyStateError', 'itae'],
    workspaceMode: 'multi-representation-linkage',
    homeworkPolicy: '可作为作业挑战',
    homeworkEligible: true,
    practiceMode: 'open',
  },
  {
    id: 'task-integrator-low-frequency-balance',
    objectId: 'plant-integrator-low-frequency',
    title: '低频误差与速度均衡挑战',
    goal: '在稳态误差达标后，比较控制能量与响应速度之间的取舍。',
    difficulty: '进阶',
    allowedMethods: ['pid', 'serial-compensator'],
    metricProfileId: 'metric-whitebox-time-domain-balanced',
    leaderboardPolicyId: 'leaderboard-class-homework',
    leaderboardTypes: ['main', 'method', 'metric', 'class'],
    primaryMetrics: ['settlingTime', 'overshoot', 'steadyStateError', 'itae'],
    workspaceMode: 'multi-representation-linkage',
    homeworkPolicy: '可作为作业挑战',
    homeworkEligible: true,
    practiceMode: 'guided',
  },
  {
    id: 'task-ship-roll-comfort',
    objectId: 'plant-ship-roll-whitebox',
    title: '横摇舒适度白箱挑战',
    goal: '在舒适度指标约束下压低峰值响应，并保持控制量不过度放大。',
    difficulty: '挑战',
    allowedMethods: ['serial-compensator', 'pid'],
    metricProfileId: 'metric-whitebox-frequency-comfort',
    leaderboardPolicyId: 'leaderboard-whitebox-default',
    leaderboardTypes: ['main', 'method', 'metric'],
    primaryMetrics: ['comfortBandPeak', 'settlingTime', 'controlEnergy', 'overshoot'],
    workspaceMode: 'multi-representation-linkage',
    homeworkPolicy: '课程项目候选',
    homeworkEligible: false,
    practiceMode: 'project',
  },
];

export function getArenaChallengeObject(id: string): ChallengeObject | undefined {
  return ARENA_CHALLENGE_OBJECTS.find((object) => object.id === id);
}

export function getArenaChallengeTask(id: string): ChallengeTask | undefined {
  return ARENA_CHALLENGE_TASKS.find((task) => task.id === id);
}

export function getArenaMetricProfile(id: string): MetricProfile | undefined {
  return ARENA_METRIC_PROFILES.find((profile) => profile.id === id);
}

export function getArenaLeaderboardPolicy(id: string): LeaderboardPolicy | undefined {
  return ARENA_LEADERBOARD_POLICIES.find((policy) => policy.id === id);
}
