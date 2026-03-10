/**
 * Lesson-13 柔性之海 类型定义
 *
 * 课程：豪华邮轮的舒适度控制
 * 场景载体：爱达·魔都号大型邮轮
 */

// ========== BOPPPS 教学阶段配置 ==========

export interface BOPPPSPhaseConfig {
  id: string;
  stage: BOPPPSStage;
  title: string;
  duration: number; // 分钟
  color: string;
  resourceId?: string;
  componentType: ComponentType;
}

export type BOPPPSStage =
  | 'BRIDGE_IN'
  | 'OBJECTIVE'
  | 'PRE_ASSESSMENT'
  | 'PARTICIPATORY'
  | 'POST_ASSESSMENT'
  | 'SUMMARY';

export type ComponentType =
  | 'video'
  | 'poll'
  | 'objective'
  | 'interactive-widget'
  | 'knowledge-card'
  | 'simulation'
  | 'assessment'
  | 'ai-report';

// ========== AI 角色配置 ==========

export interface AIPersonaConfig {
  id: string;
  name: string;
  nameChinese: string;
  role: string;
  avatar?: string;
  systemPrompt: string;
  proactive: boolean;
}

export const AI_PERSONAS: Record<string, AIPersonaConfig> = {
  'service-director': {
    id: 'service-director',
    name: 'Service Director',
    nameChinese: '客舱服务总监',
    role: '负责乘客舒适度体验的AI助手',
    systemPrompt: `你是爱达·魔都号邮轮的客舱服务总监。你的职责是帮助学生理解"舒适度控制"的重要性。
在教学过程中，你应该：
1. 强调乘客体验的重要性
2. 解释控制参数与舒适度的关系
3. 在学生过于追求速度时提醒他们考虑乘客感受
4. 使用生动的比喻解释技术概念`,
    proactive: true,
  },
  'safety-officer': {
    id: 'safety-officer',
    name: 'Safety Officer',
    nameChinese: '安全审计官',
    role: '负责监督操作安全的AI助手',
    systemPrompt: `你是爱达·魔都号邮轮的安全审计官。你的职责是监督学生操作的安全性。
在教学过程中，你应该：
1. 监测关键安全指标（横摇角、加速度等）
2. 在指标接近警戒值时发出警告
3. 解释相关安全法规（SOLAS、ISO 2631）
4. 在发生违规时引导学生进行整改`,
    proactive: true,
  },
};

// ========== 香槟塔物理模型 ==========

export interface ChampagneTowerState {
  /** 摆角（弧度） */
  angle: number;
  /** 角速度 */
  angularVelocity: number;
  /** 是否正在倒塌 */
  isFalling: boolean;
  /** 稳定性指数 (0-1) */
  stability: number;
  /** 当前侧向加速度 */
  lateralAccel: number;
}

export interface ChampagneTowerParams {
  /** 塔高（米），影响自然频率 */
  height: number;
  /** 阻尼比 */
  dampingRatio: number;
  /** 倒塌阈值角度（度） */
  fallThreshold: number;
}

export const DEFAULT_CHAMPAGNE_TOWER_PARAMS: ChampagneTowerParams = {
  height: 2.0,      // 2米高香槟塔
  dampingRatio: 0.1, // 低阻尼，容易摇晃
  fallThreshold: 5,  // 5度倒塌
};

// ========== 台风场景配置 ==========

export interface TyphoonScenarioConfig {
  id: string;
  name: string;
  description: string;
  /** 海况等级 (1-9) */
  seaState: number;
  /** 波浪方向（度） */
  waveDirection: number;
  /** 初始航向（度） */
  initialHeading: number;
  /** 目标航向（度） */
  targetHeading: number;
  /** 约束条件 */
  constraints: {
    /** 最大侧向加速度 (g) */
    maxLateralAccel: number;
    /** 伦理熔断阈值 (g) */
    ethicalThreshold: number;
    /** 最大完成时间（秒） */
    maxTime?: number;
  };
  /** 香槟塔配置 */
  champagneTower: {
    enabled: boolean;
    params?: ChampagneTowerParams;
  };
}

export const TYPHOON_SCENARIO: TyphoonScenarioConfig = {
  id: 'typhoon-avoidance',
  name: '台风避障 - 香槟塔保卫战',
  description: '爱达·魔都号正前方2海里发现台风外围涌浪，需执行30°紧急转向避障。宴会厅正在举行晚宴，有一座2米高的香槟塔。要求：转向过程中，香槟塔不能倒塌。',
  seaState: 5,
  waveDirection: 90,  // 横浪
  initialHeading: 0,
  targetHeading: 30,
  constraints: {
    maxLateralAccel: 0.15,   // < 0.15g 保护香槟塔
    ethicalThreshold: 0.20,  // > 0.2g 触发伦理熔断
    maxTime: 120,            // 2分钟内完成
  },
  champagneTower: {
    enabled: true,
    params: DEFAULT_CHAMPAGNE_TOWER_PARAMS,
  },
};

// ========== BOPPPS 教学流程 ==========

export const LESSON_13_BOPPPS_FLOW: BOPPPSPhaseConfig[] = [
  {
    id: 'bridge-in',
    stage: 'BRIDGE_IN',
    title: '导入：舒适度对比',
    duration: 3,
    color: 'emerald',
    resourceId: 'video-comfort-contrast',
    componentType: 'video',
  },
  {
    id: 'bridge-poll',
    stage: 'BRIDGE_IN',
    title: '投票：控制好坏的标准',
    duration: 0, // 包含在导入中
    color: 'emerald',
    resourceId: 'poll-comfort-definition',
    componentType: 'poll',
  },
  {
    id: 'objective',
    stage: 'OBJECTIVE',
    title: '学习目标',
    duration: 2,
    color: 'blue',
    resourceId: 'card-lesson-objectives',
    componentType: 'objective',
  },
  {
    id: 'pretest',
    stage: 'PRE_ASSESSMENT',
    title: '前测：阻尼调节',
    duration: 5,
    color: 'amber',
    resourceId: 'widget-physics-builder-simple',
    componentType: 'interactive-widget',
  },
  {
    id: 'part-a-mapping',
    stage: 'PARTICIPATORY',
    title: '指标映射：ISO 2631',
    duration: 5,
    color: 'red',
    resourceId: 'card-iso2631-mapping',
    componentType: 'knowledge-card',
  },
  {
    id: 'part-b-simulation',
    stage: 'PARTICIPATORY',
    title: '仿真挑战：香槟塔保卫战',
    duration: 15,
    color: 'red',
    resourceId: 'sim-cruise-typhoon',
    componentType: 'simulation',
  },
  {
    id: 'part-c-ethics',
    stage: 'PARTICIPATORY',
    title: '伦理熔断',
    duration: 5,
    color: 'red',
    resourceId: 'ethical-trigger-comfort',
    componentType: 'simulation', // 内嵌在仿真中
  },
  {
    id: 'part-d-optimization',
    stage: 'PARTICIPATORY',
    title: '优化设计：响应整形',
    duration: 5,
    color: 'red',
    resourceId: 'widget-response-shaping',
    componentType: 'interactive-widget',
  },
  {
    id: 'posttest',
    stage: 'POST_ASSESSMENT',
    title: '后测：参数提交',
    duration: 3,
    color: 'violet',
    resourceId: 'quiz-design-verify',
    componentType: 'assessment',
  },
  {
    id: 'summary',
    stage: 'SUMMARY',
    title: '总结：课堂报告',
    duration: 2,
    color: 'slate',
    resourceId: 'report-class-summary',
    componentType: 'ai-report',
  },
];

// ========== 评分公式 ==========

/**
 * 后测评分公式
 * Score = 100 / (1 + MSI) - Penalty × N_fail
 *
 * MSI: 晕船指数 (0-100%)
 * N_fail: 熔断次数
 * Penalty: 每次熔断扣分
 */
export interface AssessmentScoring {
  baseScore: number;
  msiWeight: number;
  penaltyPerViolation: number;
}

export const LESSON_13_SCORING: AssessmentScoring = {
  baseScore: 100,
  msiWeight: 1.0,          // MSI 权重
  penaltyPerViolation: 10, // 每次熔断扣10分
};

/**
 * 计算最终得分
 */
export function calculateScore(msi: number, violationCount: number): number {
  const { baseScore, msiWeight, penaltyPerViolation } = LESSON_13_SCORING;
  const msiPenalty = baseScore * (1 - 1 / (1 + msi * msiWeight));
  const violationPenalty = penaltyPerViolation * violationCount;
  return Math.max(0, baseScore - msiPenalty - violationPenalty);
}

// ========== 舒适度标准映射 ==========

export interface ComfortMapping {
  controlMetric: string;
  controlSymbol: string;
  userExperience: string;
  description: string;
  threshold?: string;
}

export const ISO_2631_MAPPINGS: ComfortMapping[] = [
  {
    controlMetric: '超调量',
    controlSymbol: 'σ%',
    userExperience: '晕船指数 (MSI)',
    description: '系统响应超过目标值的百分比，对应乘客的眩晕感',
    threshold: '当 σ% > 15% 时，普通人将产生明显的眩晕感',
  },
  {
    controlMetric: '调节时间',
    controlSymbol: 'ts',
    userExperience: '避障窗口期',
    description: '系统达到稳态所需的时间，决定了紧急避障的响应速度',
    threshold: '邮轮转向需要在30-60秒内完成',
  },
  {
    controlMetric: '加速度',
    controlSymbol: 'a',
    userExperience: '物品滑落/老人摔倒风险',
    description: '船舶运动产生的侧向加速度，直接影响乘客和物品的稳定性',
    threshold: 'a > 0.15g 时餐具滑动，a > 0.2g 时有摔倒风险',
  },
];
