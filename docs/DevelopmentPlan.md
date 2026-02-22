# AI-OBE船舶智控平台开发计划

## 概述

本文档基于《教学创新成果报告》中声明的功能设计，对比分析 act.just.edu.cn 平台现有实现，详细列出需要实现的前后端需求，以完全匹配报告中声明的功能。

---

## 一、现状与目标差距分析

### 1.1 创新报告声明的核心功能

| 层级 | 功能模块 | 报告描述 | 实现状态 |
|------|----------|----------|----------|
| 结构可见 | 多表征联动可视化引擎 | 实时呈现"极点调整→时域响应变化→频域曲线偏移"的动态映射 | ❌ 未实现 |
| 结构可见 | 自适应跨域题库 | 基于协同过滤算法动态推荐或生成试题 | ❌ 未实现 |
| 结构可用 | 工程任务锚定 | 邮轮舒适度控制、破冰船鲁棒控制等真实工程场景 | ⚠️ 部分实现(仅驱逐舰) |
| 结构可用 | AI伴随探究 | 试错后介入分析失败原因，提示约束边界，引导重新探索 | ⚠️ 基础框架存在 |
| 结构可评 | 元提示词评价 | 结构化提示模板+质量评价(完整性/精确性/结构化/可执行性) | ❌ 未实现 |
| 结构可评 | 过程一致性校验 | "提示结构—设计行为—结果达成"一致性校验机制 | ❌ 未实现 |

### 1.2 现有平台已实现功能

- ✅ 用户认证与角色管理（学生/教师/管理员）
- ✅ 055型驱逐舰航向控制仿真（Nomoto模型+PID控制）
- ✅ AI Copilot聊天功能（基础Function Calling）
- ✅ 伦理决策模块（价值权衡场景）
- ✅ 知识图谱3D可视化
- ✅ 互动学习资源管理（BOPPPS教案结构）
- ✅ 课堂实时会话管理
- ✅ 基础仿真参数优化（Monte Carlo）

---

## 二、详细开发需求

### 模块一：多表征联动可视化引擎（内容重构）

#### 2.1.1 前端需求

**页面路径**: `/interactive-learning/multi-representation-linkage`

**核心组件**:

```typescript
// 1. 极点配置面板组件
interface PoleConfigPanelProps {
  poles: Complex[];  // 复平面极点坐标
  onPoleChange: (poles: Complex[]) => void;
  draggable?: boolean;  // 支持拖拽调整极点位置
}

// 2. 时域响应可视化组件
interface TimeDomainVisualizerProps {
  transferFunction: TransferFunction;
  timeRange: [number, number];
  responseType: 'step' | 'impulse' | 'ramp';
  metrics: {
    overshoot: number;
    settlingTime: number;
    riseTime: number;
    steadyStateError: number;
  };
}

// 3. 频域响应可视化组件
interface FrequencyDomainVisualizerProps {
  transferFunction: TransferFunction;
  frequencyRange: [number, number];  // 对数刻度
  plots: ('bode-magnitude' | 'bode-phase' | 'nyquist' | 'nichols')[];
  stabilityMargins: {
    gainMargin: { value: number; frequency: number };
    phaseMargin: { value: number; frequency: number };
  };
}

// 4. 跨域联动主控面板
interface LinkageDashboardProps {
  // 任一域的调整自动触发其他域的实时更新
  linkageMode: 'pole-to-time-freq' | 'param-to-all';
  updateLatency: number;  // 目标 < 100ms
  showCorrelationHints: boolean;  // 显示跨域关联提示
}
```

**交互功能**:

1. **极点拖拽联动**
   - 在复平面上拖拽极点位置
   - 实时计算并显示对应的时域响应曲线变化
   - 实时计算并显示频域Bode图变化
   - 显示阻尼比、自然频率等关键参数

2. **参数调整联动**
   - 调整PID参数时，同时显示：
     * 根轨迹图上极点位置变化
     * 时域响应特性变化
     * 频域稳定裕度变化

3. **跨域关联提示**
   - 当极点靠近虚轴时，提示"系统稳定性降低，时域响应振荡加剧"
   - 当相位裕度减小时，提示"频域稳定性降低，时域超调量可能增大"

#### 2.1.2 后端需求

**API端点**:

```typescript
// POST /api/linkage/calculate-time-domain
interface CalculateTimeDomainRequest {
  poles: Complex[];
  zeros?: Complex[];
  gain: number;
  timeRange: { start: number; end: number; step: number };
  responseType: 'step' | 'impulse' | 'ramp';
}

// POST /api/linkage/calculate-frequency-domain
interface CalculateFrequencyDomainRequest {
  poles: Complex[];
  zeros?: Complex[];
  gain: number;
  frequencyRange: { min: number; max: number; points: number };  // 对数分布
}

// POST /api/linkage/stability-analysis
interface StabilityAnalysisRequest {
  transferFunction: TransferFunction;
}
interface StabilityAnalysisResponse {
  isStable: boolean;
  stabilityMargins: {
    gainMargin: { value: number; frequency: number; isInfinite?: boolean };
    phaseMargin: { value: number; frequency: number };
  };
  polesInRHP: number;  // 右半平面极点数量
  dampingRatios: number[];  // 各极点阻尼比
}

// WebSocket /ws/linkage/realtime
// 支持实时流式计算，用于拖拽时的平滑更新
```

**计算引擎**:

```python
# Python微服务（或使用mathjs在Node端）
class LinkageCalculationEngine:
    """
    跨域联动计算引擎
    核心算法：
    1. 极点→传递函数系数（使用numpy.poly）
    2. 时域响应数值求解（使用scipy.signal.lsim）
    3. 频域响应计算（使用scipy.signal.freqresp）
    4. 稳定裕度计算（使用控制理论算法）
    """

    def calculate_time_response(self, poles, zeros, gain, time_array):
        # 返回：时间数组、响应数组、性能指标
        pass

    def calculate_frequency_response(self, poles, zeros, gain, freq_array):
        # 返回：频率数组、幅值数组（dB）、相位数组（度）
        pass

    def calculate_root_locus(self, openLoopTF, gainRange):
        # 返回根轨迹数据，用于闭环极点可视化
        pass
```

**数据库模型扩展**:

```prisma
model LinkageSession {
  id        String   @id @default(cuid())
  userId    String
  createdAt DateTime @default(now())

  // 保存学生的探索历史
  interactions Json[]  // { timestamp, actionType, params, results }

  user User @relation(fields: [userId], references: [id])
}
```

---

### 模块二：自适应跨域题库系统（内容重构）

#### 2.2.1 前端需求

**页面路径**: `/assessment/adaptive-practice`

**核心组件**:

```typescript
// 1. 能力诊断面板
interface DiagnosticPanelProps {
  knowledgeDimensions: {
    computational: number;  // 计算型知识掌握度 0-100
    crossDomain: number;    // 跨域型知识掌握度 0-100
    design: number;         // 设计型知识掌握度 0-100
  };
  weakAreas: string[];  // 薄弱知识点标签
  recommendedFocus: string[];
}

// 2. 自适应练习界面
interface AdaptivePracticeProps {
  currentQuestion: CrossDomainQuestion;
  difficulty: number;  // 当前题目难度系数
  estimatedAbility: number;  // 系统估计的学生能力值
  questionHistory: {
    questionId: string;
    isCorrect: boolean;
    timeSpent: number;
    knowledgeTags: string[];
  }[];
}

// 3. 跨域题目展示组件
interface CrossDomainQuestion {
  id: string;
  stem: string;  // 题干
  // 跨域特征：同时涉及多个表征域
  domains: ('time' | 'frequency' | 'complex' | 'physical')[];
  // 题目类型
  type: 'pole-to-behavior' | 'bode-to-stability' | 'design-tradeoff' | 'multi-criteria';
  options?: Array<{
    label: string;
    isCorrect: boolean;
    explanation: string;  // 跨域解释
  }>;
  // AI生成题目的元数据
  generatedMetadata?: {
    model: string;
    generationTime: number;
    validatedBy: string[];
  };
}
```

**交互功能**:

1. **智能推荐**
   - 基于学生历史答题记录，使用协同过滤推荐相似难度题目
   - 针对薄弱知识点优先出题
   - 动态调整题目难度（CAT自适应测试逻辑）

2. **AI即时生成**
   - 当题库中匹配度不足时，调用LLM生成新题
   - 生成后自动进行答案验证和难度评估
   - 题目质量人工审核后入库

3. **答题分析**
   - 答错时展示跨域知识关联图谱
   - 推荐相关学习资源

#### 2.2.2 后端需求

**API端点**:

```typescript
// GET /api/assessment/diagnostic
// 获取学生能力诊断报告

// POST /api/assessment/next-question
interface NextQuestionRequest {
  userId: string;
  sessionId: string;
  previousAnswer?: {
    questionId: string;
    isCorrect: boolean;
    timeSpent: number;
  };
}
interface NextQuestionResponse {
  question: CrossDomainQuestion;
  estimatedAbility: number;  // IRT模型估计值
  confidenceInterval: [number, number];
}

// POST /api/assessment/generate-question
interface GenerateQuestionRequest {
  targetKnowledgeTags: string[];
  difficultyTarget: number;
  domains: ('time' | 'frequency' | 'complex')[];
}

// GET /api/assessment/ability-report/:userId
// 获取跨域能力发展报告
```

**推荐算法实现**:

```python
# 自适应推荐引擎
class AdaptiveQuestionEngine:
    """
    基于项目反应理论(IRT)和协同过滤的自适应出题引擎
    """

    def __init__(self):
        self.irt_model = self._load_irt_model()  # 预训练的能力评估模型
        self.collaborative_filter = self._load_cf_model()

    def estimate_ability(self, user_id: str) -> float:
        """
        基于答题历史估计学生能力参数(theta)
        使用IRT模型的最大似然估计
        """
        pass

    def select_next_question(self, user_id: str, current_theta: float) -> Question:
        """
        选择信息增益最大的下一题
        优先选择难度接近当前能力估计值的题目
        """
        # Fisher信息量计算
        # 返回使信息量最大化的题目
        pass

    def generate_cross_domain_question(
        self,
        knowledge_tags: List[str],
        difficulty: float,
        domains: List[str]
    ) -> GeneratedQuestion:
        """
        使用LLM生成跨域型题目
        Prompt模板需包含：
        1. 跨域型知识定义
        2. 难度控制参数
        3. 输出格式规范（含解析）
        """
        prompt = f"""
        请生成一道自动控制原理的跨域型练习题。

        跨域型知识特征：
        - 涉及极点位置（复域）与系统响应（时域）的关联
        - 或涉及频域特性与时域性能的映射
        - 强调结构理解而非纯计算

        目标难度系数：{difficulty} (0-1)
        涉及知识点：{', '.join(knowledge_tags)}
        要求表征域：{', '.join(domains)}

        请以JSON格式输出，包含：
        - stem: 题干
        - domains: 涉及的域
        - correctAnswer: 正确答案
        - explanation: 跨域原理解释
        - difficulty: 实际难度评估
        """
        # 调用LLM API并解析结果
        pass
```

**数据库模型**:

```prisma
// 题目库
model Question {
  id          String   @id @default(cuid())
  stem        String   @db.Text
  type        String   // computational | cross_domain | design
  domains     String[] // [time, frequency, complex]
  difficulty  Float    // IRT难度参数b

  // IRT参数
  discrimination Float  // 区分度参数a
  guessing      Float  // 猜测参数c

  knowledgeTags String[]

  // 答案与解析
  correctAnswer  String
  explanation    String @db.Text
  crossDomainHint String? @db.Text  // 跨域理解提示

  // 元数据
  source      String   // manual | ai_generated
  aiMetadata  Json?    // AI生成信息
  validationStatus String @default("pending") // pending | approved | rejected

  // 统计信息
  timesUsed      Int @default(0)
  correctRate    Float?
  avgTimeSpent   Float?

  createdAt DateTime @default(now())

  // 关联
  userAnswers UserAnswer[]
}

// 学生答题记录
model UserAnswer {
  id         String   @id @default(cuid())
  userId     String
  questionId String

  isCorrect   Boolean
  timeSpent   Int      // 秒
  answerGiven String

  // IRT分析
  thetaEstimate Float?  // 当时的能力估计值

  createdAt DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id])
  question Question @relation(fields: [questionId], references: [id])
}

// 能力评估记录
model AbilityAssessment {
  id     String @id @default(cuid())
  userId String

  // 三类知识的能力估计
  computationalTheta Float
  crossDomainTheta   Float
  designTheta        Float

  // 知识点粒度能力
  knowledgePointAbilities Json // { "pole-stability": 0.75, ... }

  assessedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

---

### 模块三：工程场景扩展（方法进阶）

#### 2.3.1 邮轮舒适度控制场景

**页面路径**: `/simulations/cruise-comfort`

**物理模型扩展**:

```typescript
// 邮轮动力学模型（考虑横摇-航向耦合）
interface CruiseShipDynamics {
  // 扩展Nomoto模型
  headingDynamics: NomotoModel;

  // 新增：横摇动力学
  rollDynamics: {
    naturalPeriod: number;     // 横摇固有周期
    dampingRatio: number;      // 横摇阻尼比
    waveExcitation: number;    // 波浪激励系数
  };

  // 舒适度评价指标
  comfortMetrics: {
    msi: number;  // Motion Sickness Index（晕船指数）
    rmsRoll: number;  // 横摇角均方根
    rmsPitch: number; // 纵摇角均方根
  };
}

// 舒适度约束下的控制器设计任务
interface ComfortControlTask {
  scenario: 'course-keeping' | 'turning' | 'zigzag';
  comfortRequirements: {
    maxMSI: number;       // 最大允许晕船指数
    maxRollAngle: number; // 最大允许横摇角
  };
  performanceRequirements: {
    maxSettlingTime: number;
    maxOvershoot: number;
  };
  // 多目标权衡：舒适度 vs 操控性
  tradeoffVisualization: boolean;
}
```

**前端组件**:

```typescript
// 1. 舒适度仪表盘
interface ComfortDashboardProps {
  currentMSI: number;
  currentRollAngle: number;
  comfortZone: {
    msiLimit: number;
    rollLimit: number;
  };
  comfortHistory: Array<{
    timestamp: number;
    msi: number;
    rollAngle: number;
  }>;
}

// 2. 多目标优化面板
interface MultiObjectivePanelProps {
  objectives: {
    comfort: { value: number; weight: number };
    performance: { value: number; weight: number };
    energy: { value: number; weight: number };
  };
  paretoFront?: Array<{ comfort: number; performance: number }>;
  currentDesign: { comfort: number; performance: number };
}
```

#### 2.3.2 破冰船鲁棒控制场景

**页面路径**: `/simulations/icebreaker-robust`

**物理模型扩展**:

```typescript
// 冰区航行干扰模型
interface IcebreakerDynamics {
  baseDynamics: NomotoModel;

  // 冰阻扰动模型
  iceDisturbance: {
    type: 'random' | 'periodic' | 'impulse';
    intensity: number;  // 冰况等级 1-5
    iceConcentration: number;  // 密集度 0-100%
  };

  // 鲁棒性评价
  robustnessMetrics: {
    disturbanceRejection: number;  // 扰动抑制能力
    parameterSensitivity: number;  // 参数敏感性
    stabilityMargin: number;       // 稳定裕度
  };
}

// 鲁棒控制设计任务
interface RobustControlTask {
  uncertaintyRange: {
    paramK: [number, number];  // K参数变化范围
    paramT: [number, number];  // T参数变化范围
  };
  disturbanceScenarios: Array<{
    name: string;
    disturbancePattern: number[];
  }>;
  // 要求：设计能在所有不确定情况下保持稳定的控制器
}
```

**后端实现**:

```python
# 扩展仿真引擎
class AdvancedSimulationEngine:
    """
    扩展仿真引擎，支持多场景物理模型
    """

    def __init__(self, ship_type: str):
        self.ship_type = ship_type
        self.physics_model = self._load_physics_model(ship_type)

    def simulate_cruise_comfort(self, params, sea_state, duration):
        """
        邮轮舒适度仿真
        返回：航迹数据 + 舒适度指标时序
        """
        pass

    def simulate_icebreaker_robust(self, params, ice_conditions, uncertainty):
        """
        破冰船鲁棒性仿真
        返回：多种扰动下的性能分布
        """
        pass

    def calculate_comfort_metrics(self, motion_data):
        """
        计算舒适度指标
        ISO 2631标准
        """
        # MSI计算
        # 横摇统计
        pass
```

---

### 模块四：AI伴随探究系统（方法进阶）

#### 2.4.1 现有功能分析

平台已有基础AI Copilot，但缺乏"试错后介入"的教育设计。

#### 2.4.2 需要新增功能

**前端组件**:

```typescript
// 1. AI介入时机管理器
interface AIInterventionManagerProps {
  studentState: {
    currentTask: string;
    attemptHistory: Array<{
      attemptNumber: number;
      params: PIDParams;
      result: SimulationResult;
      isSuccessful: boolean;
    }>;
    currentAttempt: number;
  };
  interventionRules: {
    afterFailedAttempts: number;  // 几次失败后介入
    onStagnation: boolean;        // 停滞时介入
    onConstraintViolation: boolean; // 约束违反时介入
  };
}

// 2. AI反馈面板
interface AIFeedbackPanelProps {
  feedbackType: 'failure-analysis' | 'constraint-hint' | 'guidance' | 'encouragement';
  content: string;
  suggestedNextSteps?: string[];
  relatedConcepts?: string[];
  // 可视化提示
  highlightParams?: string[];  // 高亮建议调整的参数
  showTrendPrediction?: boolean; // 显示趋势预测
}

// 3. 探索轨迹可视化
interface ExplorationTrajectoryProps {
  attempts: Array<{
    params: { kp: number; ki: number; kd: number };
    metrics: { overshoot: number; settlingTime: number; comfortIndex: number };
    isFeasible: boolean;
  }>;
  feasibleRegion?: Array<{ kp: number; ki: number; kd: number }>;
  paretoFront?: Array<{ comfort: number; performance: number }>;
}
```

**AI介入策略**:

```typescript
// AI介入决策逻辑
const interventionStrategies = {
  // 策略1：连续失败后的根因分析
  failureAnalysis: {
    trigger: (history) => history.filter(h => !h.isSuccessful).length >= 2,
    action: async (currentState) => {
      // 分析失败模式
      // 识别是超调问题、响应慢问题还是稳态误差问题
      // 返回针对性建议
    }
  },

  // 策略2：约束边界提示
  constraintHint: {
    trigger: (currentParams, constraints) => {
      return currentParams.kp > constraints.kpMax * 0.9;
    },
    action: async (currentParams, constraints) => {
      // 提示接近约束边界
      // 解释该约束的工程意义
    }
  },

  // 策略3：探索方向引导
  explorationGuidance: {
    trigger: (history) => {
      // 检测参数调整是否陷入局部
      const recentParams = history.slice(-3).map(h => h.params);
      return isStuckInLocalOptimum(recentParams);
    },
    action: async () => {
      // 建议尝试完全不同的参数组合
      // 提供探索性思路
    }
  }
};
```

#### 2.4.2 后端实现

```python
# AI伴随探究引擎
class AICompanionEngine:
    """
    AI伴随探究引擎
    核心逻辑：不提前给答案，在试错后介入分析
    """

    def __init__(self):
        self.llm_client = OpenAI()
        self.intervention_history = []

    def should_intervene(self, student_state: StudentState) -> InterventionDecision:
        """
        判断是否应该介入
        遵循教育设计原则：
        1. 学生已经尝试过（失败次数 >= 1）
        2. 学生主动求助
        3. 长时间无进展
        """
        failed_attempts = len([a for a in student_state.attempts if not a.success])

        if failed_attempts >= 2:
            return InterventionDecision(
                should_intervene=True,
                reason="multiple_failures",
                intervention_type="failure_analysis"
            )

        if student_state.time_since_last_attempt > 300:  # 5分钟无操作
            return InterventionDecision(
                should_intervene=True,
                reason="stagnation",
                intervention_type="guidance"
            )

        return InterventionDecision(should_intervene=False)

    def generate_intervention(self, decision: InterventionDecision, context: dict) -> str:
        """
        生成介入内容
        强调引导而非给答案
        """
        if decision.intervention_type == "failure_analysis":
            prompt = f"""
            学生连续{context['failed_attempts']}次尝试失败。

            当前参数：{context['current_params']}
            失败表现：{context['failure_metrics']}

            作为AI助教，请：
            1. 分析可能的失败原因（不要直接给答案）
            2. 提示学生关注哪些指标
            3. 引导思考参数调整的因果关系
            4. 鼓励继续探索

            语气：鼓励性、引导性，避免直接给出参数值
            """

        return self.llm_client.chat.completions.create(...)
```

---

### 模块五：元提示词评价系统（评价改革）

#### 2.5.1 前端需求

**页面路径**: `/evaluation/prompt-assessment`

**核心组件**:

```typescript
// 1. 结构化提示词编辑器
interface StructuredPromptEditorProps {
  template: {
    sections: Array<{
      id: string;
      label: string;
      description: string;
      required: boolean;
      example: string;
    }>;
  };
  // 必须包含的要素
  requiredElements: [
    { id: 'control-object', label: '控制对象', required: true },
    { id: 'performance-goals', label: '性能目标', required: true },
    { id: 'constraints', label: '约束条件', required: true },
    { id: 'design-context', label: '设计背景', required: false },
  ];
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  // 实时评价反馈
  liveFeedback?: PromptQualityFeedback;
}

// 2. 提示词质量仪表盘
interface PromptQualityDashboardProps {
  assessment: {
    overallScore: number;  // 总分100
    dimensions: {
      completeness: { score: number; weight: 0.3 };    // 完整性
      precision: { score: number; weight: 0.25 };      // 精确性
      structurization: { score: number; weight: 0.25 }; // 结构化
      executability: { score: number; weight: 0.2 };   // 可执行性
    };
    // 改进建议
    suggestions: Array<{
      dimension: string;
      issue: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  };
  // 历史轨迹
  improvementHistory: Array<{
    version: number;
    timestamp: number;
    score: number;
    changes: string[];
  }>;
}

// 3. 提示词版本对比
interface PromptVersionCompareProps {
  versions: Array<{
    version: number;
    prompt: string;
    aiResponse: string;
    qualityScore: number;
    designOutcome: SimulationResult;
  }>;
}
```

**评价维度详细定义**:

```typescript
// 静态评价指标
const staticEvaluationCriteria = {
  completeness: {
    weight: 0.30,
    criteria: [
      { item: '控制对象明确', check: (prompt) => containsControlObject(prompt) },
      { item: '性能指标完整', check: (prompt) => containsPerformanceMetrics(prompt) },
      { item: '约束条件清晰', check: (prompt) => containsConstraints(prompt) },
    ]
  },
  precision: {
    weight: 0.25,
    criteria: [
      { item: '术语使用准确', check: (prompt) => usesAccurateTerminology(prompt) },
      { item: '数值表达精确', check: (prompt) => hasPreciseValues(prompt) },
      { item: '无歧义表述', check: (prompt) => noAmbiguousLanguage(prompt) },
    ]
  },
  structurization: {
    weight: 0.25,
    criteria: [
      { item: '问题分解清晰', check: (prompt) => hasClearProblemDecomposition(prompt) },
      { item: '逻辑层次合理', check: (prompt) => hasLogicalHierarchy(prompt) },
      { item: '信息组织有序', check: (prompt) => hasOrganizedInformation(prompt) },
    ]
  },
  executability: {
    weight: 0.20,
    criteria: [
      { item: 'AI可理解', check: (prompt) => isAIUnderstandable(prompt) },
      { item: '可生成有效建议', check: (prompt) => canGenerateValidSuggestions(prompt) },
      { item: '可操作性强', check: (prompt) => isActionable(prompt) },
    ]
  }
};
```

#### 2.5.2 后端需求

**API端点**:

```typescript
// POST /api/evaluation/assess-prompt
interface AssessPromptRequest {
  prompt: string;
  structuredData?: Record<string, string>;  // 结构化输入数据
  context: {
    taskType: 'pid-tuning' | 'controller-design' | 'system-analysis';
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
}
interface AssessPromptResponse {
  overallScore: number;
  dimensionScores: {
    completeness: number;
    precision: number;
    structurization: number;
    executability: number;
  };
  suggestions: Array<{
    dimension: string;
    issue: string;
    suggestion: string;
    example?: string;
  }>;
  // 元提示词（系统内部使用）
  metaPromptAnalysis?: {
    detectedIntent: string;
    missingElements: string[];
    improvementPotential: number;
  };
}

// POST /api/evaluation/track-consistency
interface TrackConsistencyRequest {
  userId: string;
  designSessionId: string;
  promptVersion: number;
  promptContent: string;
  designActions: Array<{
    timestamp: number;
    action: string;
    params: Record<string, number>;
  }>;
  finalResult: SimulationResult;
}
interface TrackConsistencyResponse {
  consistencyScore: number;  // 提示-行为一致性得分
  alignmentAnalysis: {
    statedGoals: string[];
    actualOptimization: string[];
    mismatches: string[];
  };
  processQuality: {
    iterationCount: number;
    convergencePattern: 'steady' | 'oscillating' | 'diverging';
    explorationBreadth: number;
  };
}
```

**评价模型实现**:

```python
# 提示词质量评价引擎
class PromptQualityEvaluator:
    """
    提示词质量评价引擎
    结合规则引擎和LLM评判
    """

    def __init__(self):
        self.llm_client = OpenAI()
        self.rule_engine = RuleEngine()

    def evaluate_static_quality(self, prompt: str, context: dict) -> StaticQualityResult:
        """
        静态质量评价
        """
        scores = {}

        # 完整性评价（规则+LLM）
        scores['completeness'] = self._evaluate_completeness(prompt, context)

        # 精确性评价
        scores['precision'] = self._evaluate_precision(prompt)

        # 结构化评价
        scores['structurization'] = self._evaluate_structure(prompt)

        # 可执行性评价（使用LLM模拟执行）
        scores['executability'] = self._evaluate_executability(prompt, context)

        return StaticQualityResult(
            dimension_scores=scores,
            overall_score=weighted_average(scores, weights),
            suggestions=self._generate_suggestions(scores)
        )

    def evaluate_dynamic_consistency(
        self,
        prompt: str,
        design_trajectory: List[DesignAction],
        final_result: SimulationResult
    ) -> ConsistencyResult:
        """
        动态一致性评价
        分析"提示结构—设计行为—结果达成"的一致性
        """
        # 从提示中提取声明的目标
        stated_goals = self._extract_goals(prompt)

        # 分析实际的设计行为
        actual_optimization = self._analyze_optimization_direction(design_trajectory)

        # 对比目标与行为
        mismatches = []
        for goal in stated_goals:
            if not self._goal_reflected_in_behavior(goal, actual_optimization):
                mismatches.append(f"声明目标'{goal}'未在设计行为中体现")

        # 计算一致性得分
        consistency_score = 1 - len(mismatches) / len(stated_goals) if stated_goals else 0

        return ConsistencyResult(
            consistency_score=consistency_score,
            stated_goals=stated_goals,
            actual_optimization=actual_optimization,
            mismatches=mismatches,
            process_quality=self._assess_process_quality(design_trajectory)
        )
```

---

### 模块六：过程一致性校验系统（评价改革）

#### 2.6.1 数据流设计

```
学生提示词 → [解析提取目标] → 存储目标声明
     ↓
设计行为记录（每次参数调整）→ [行为分析] → 存储行为轨迹
     ↓
仿真结果 → [结果评估] → 存储结果数据
     ↓
[一致性校验引擎] → 生成一致性报告
```

#### 2.6.2 前端组件

```typescript
// 1. 设计过程追踪器
interface DesignProcessTrackerProps {
  sessionId: string;
  stages: Array<{
    name: string;
    status: 'pending' | 'in-progress' | 'completed';
    data: any;
  }>;
  // 实时一致性反馈
  consistencyFeedback?: {
    score: number;
    alerts: string[];
    recommendations: string[];
  };
}

// 2. 一致性报告视图
interface ConsistencyReportViewProps {
  report: {
    overallConsistency: number;
    dimensions: {
      goalClarity: number;      // 目标表达清晰度
      goalBehaviorAlignment: number;  // 目标-行为对齐度
      behaviorResultCoherence: number; // 行为-结果连贯性
    };
    timeline: Array<{
      timestamp: number;
      event: string;
      consistencyImpact: 'positive' | 'negative' | 'neutral';
    }>;
    improvementSuggestions: string[];
  };
}
```

#### 2.6.3 后端实现

```python
# 过程一致性校验引擎
class ProcessConsistencyValidator:
    """
    过程一致性校验引擎
    实现"提示结构—设计行为—结果达成"的动态校验
    """

    def __init__(self):
        self.goal_extractor = GoalExtractor()
        self.behavior_analyzer = BehaviorAnalyzer()
        self.result_evaluator = ResultEvaluator()

    def validate_session(self, session_id: str) -> ConsistencyReport:
        """
        校验整个设计会话的一致性
        """
        session_data = self._load_session(session_id)

        # 1. 提取提示词中声明的目标
        stated_goals = self.goal_extractor.extract(
            session_data.prompt_versions[-1].content
        )

        # 2. 分析设计行为轨迹
        behavior_analysis = self.behavior_analyzer.analyze(
            session_data.design_actions
        )

        # 3. 评估结果达成度
        result_evaluation = self.result_evaluator.evaluate(
            session_data.final_result,
            stated_goals
        )

        # 4. 综合一致性分析
        consistency = self._calculate_consistency(
            stated_goals,
            behavior_analysis,
            result_evaluation
        )

        return ConsistencyReport(
            overall_consistency=consistency.score,
            goal_behavior_alignment=consistency.alignment,
            behavior_result_coherence=consistency.coherence,
            alerts=consistency.alerts,
            suggestions=consistency.suggestions
        )

    def real_time_validation(self, session_id: str, current_action: DesignAction) -> list:
        """
        实时校验，当检测到偏离时触发提示
        """
        session_data = self._load_session(session_id)
        stated_goals = session_data.stated_goals

        # 检查当前行为是否与声明目标一致
        alerts = []
        for goal in stated_goals:
            if not self._action_aligned_with_goal(current_action, goal):
                alerts.append({
                    'type': 'deviation',
                    'message': f'当前调整可能与"{goal}"目标不一致',
                    'severity': 'warning'
                })

        return alerts
```

---

## 三、数据库Schema扩展汇总

### 新增数据模型

```prisma
// ==================== 多表征联动模块 ====================
model LinkageSession {
  id            String   @id @default(cuid())
  userId        String
  createdAt     DateTime @default(now())
  interactions  Json[]   // 探索交互记录

  user User @relation(fields: [userId], references: [id])
}

// ==================== 自适应题库模块 ====================
model Question {
  id                String   @id @default(cuid())
  stem              String   @db.Text
  type              String   // computational | cross_domain | design
  domains           String[]
  difficulty        Float
  discrimination    Float
  guessing          Float
  knowledgeTags     String[]
  correctAnswer     String
  explanation       String   @db.Text
  crossDomainHint   String?  @db.Text
  source            String
  aiMetadata        Json?
  validationStatus  String   @default("pending")
  timesUsed         Int      @default(0)
  correctRate       Float?
  avgTimeSpent      Float?
  createdAt         DateTime @default(now())

  userAnswers UserAnswer[]
}

model UserAnswer {
  id              String   @id @default(cuid())
  userId          String
  questionId      String
  isCorrect       Boolean
  timeSpent       Int
  answerGiven     String
  thetaEstimate   Float?
  createdAt       DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id])
  question Question @relation(fields: [questionId], references: [id])
}

model AbilityAssessment {
  id                      String   @id @default(cuid())
  userId                  String
  computationalTheta      Float
  crossDomainTheta        Float
  designTheta             Float
  knowledgePointAbilities Json
  assessedAt              DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

// ==================== AI伴随探究模块 ====================
model AIIntervention {
  id              String   @id @default(cuid())
  userId          String
  sessionId       String
  triggerType     String   // multiple_failures | stagnation | constraint_violation
  interventionType String  // failure_analysis | guidance | constraint_hint
  content         String   @db.Text
  studentResponse String?  @db.Text
  wasHelpful      Boolean?
  createdAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

// ==================== 元提示词评价模块 ====================
model PromptAssessment {
  id                String   @id @default(cuid())
  userId            String
  sessionId         String
  promptContent     String   @db.Text
  structuredData    Json?

  // 评价结果
  overallScore      Float
  completenessScore Float
  precisionScore    Float
  structurizationScore Float
  executabilityScore Float

  suggestions       Json[]   // 改进建议
  version           Int
  createdAt         DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

// ==================== 过程一致性校验模块 ====================
model DesignSession {
  id              String   @id @default(cuid())
  userId          String
  taskType        String

  // 提示词版本历史
  promptVersions  Json[]   // { version, content, timestamp, assessmentId }

  // 设计行为轨迹
  designActions   Json[]   // { timestamp, action, params, context }

  // 仿真结果
  finalResult     Json?

  // 一致性评价
  consistencyScore      Float?
  goalBehaviorAlignment Float?
  behaviorResultCoherence Float?

  startedAt       DateTime @default(now())
  completedAt     DateTime?

  user User @relation(fields: [userId], references: [id])
}
```

---

## 四、API端点汇总

### 4.1 多表征联动API

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/linkage/calculate-time-domain` | 计算时域响应 |
| POST | `/api/linkage/calculate-frequency-domain` | 计算频域响应 |
| POST | `/api/linkage/stability-analysis` | 稳定性分析 |
| WS | `/ws/linkage/realtime` | 实时联动计算 |

### 4.2 自适应题库API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/assessment/diagnostic` | 能力诊断报告 |
| POST | `/api/assessment/next-question` | 获取下一题 |
| POST | `/api/assessment/generate-question` | AI生成题目 |
| POST | `/api/assessment/submit-answer` | 提交答案 |
| GET | `/api/assessment/ability-report/:userId` | 能力发展报告 |

### 4.3 AI伴随探究API

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/ai/intervention/check` | 检查是否需要介入 |
| POST | `/api/ai/intervention/generate` | 生成介入内容 |
| POST | `/api/ai/intervention/feedback` | 学生反馈介入效果 |

### 4.4 元提示词评价API

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/evaluation/assess-prompt` | 评价提示词质量 |
| POST | `/api/evaluation/track-consistency` | 追踪一致性 |
| GET | `/api/evaluation/prompt-history/:userId` | 获取提示词改进历史 |

---

## 五、开发优先级与里程碑

### Phase 1：核心基础（4周）

**目标**：实现"结构可见"的基础功能

- [ ] 多表征联动可视化引擎（极点↔时域↔频域）
- [ ] 基础跨域题库（50道预置题目）
- [ ] 简单自适应推荐（基于规则的难度调整）

### Phase 2：场景扩展（3周）

**目标**：实现"结构可用"的工程场景

- [ ] 邮轮舒适度控制场景开发
- [ ] 破冰船鲁棒控制场景开发
- [ ] AI伴随探究基础框架（介入时机判断）

### Phase 3：评价改革（4周）

**目标**：实现"结构可评"的评价体系

- [ ] 元提示词评价系统（静态评价）
- [ ] 提示词可视化编辑器
- [ ] 过程一致性校验引擎
- [ ] 评价数据仪表盘

### Phase 4：集成优化（2周）

**目标**：系统集成与性能优化

- [ ] 各模块数据打通
- [ ] 实时计算性能优化
- [ ] 用户体验优化
- [ ] 测试与Bug修复

---

## 六、技术实现注意事项

### 6.1 性能考虑

1. **实时计算优化**
   - 跨域联动计算使用Web Workers或WebAssembly
   - 复杂仿真使用服务端计算+流式返回
   - 缓存常用传递函数的响应数据

2. **LLM调用优化**
   - 题目生成使用异步队列
   - 提示词评价使用轻量级规则引擎预处理
   - AI介入内容可预生成模板

### 6.2 数据安全

1. 学生设计行为数据脱敏存储
2. AI生成内容需人工审核后入库
3. 评价算法需可解释、可审计

### 6.3 可扩展性

1. 新船舶类型场景遵循统一接口规范
2. 评价维度可配置化
3. 支持未来接入更多AI模型

---

## 七、预期成果

完成本开发计划后，平台将完全匹配《教学创新成果报告》中声明的所有功能：

1. ✅ **结构可见**：多表征联动可视化引擎 + 自适应跨域题库
2. ✅ **结构可用**：邮轮/破冰船场景 + AI伴随探究
3. ✅ **结构可评**：元提示词评价 + 过程一致性校验

同时生成可用于教创赛提交的平台截图证明和功能演示视频素材。

---

*文档版本: 1.0*
*最后更新: 2026-02-21*


用户备注：

  - 多表征联动可视化引擎
      - 页面：src/app/interactive-learning/multi-representation-linkage/page.tsx
      - 引擎：src/lib/control/linkage-engine.ts
      - API：src/app/api/linkage/calculate-time-domain/route.ts、src/app/api/linkage/calculate-frequency-domain/
        route.ts、src/app/api/linkage/stability-analysis/route.ts
  - 自适应跨域题库系统
      - 页面：src/app/assessment/adaptive-practice/page.tsx
      - 题库与引擎：src/features/assessment/adaptive-question-bank.ts、src/features/assessment/adaptive-engine.ts
      - API：src/app/api/assessment/diagnostic/route.ts、src/app/api/assessment/next-question/route.ts、src/app/api/
        assessment/generate-question/route.ts、src/app/api/assessment/submit-answer/route.ts、src/app/api/assessment/
        ability-report/[userId]/route.ts
  - AI伴随探究系统
      - 引擎与面板：src/features/ai/companion/intervention-engine.ts、src/features/ai/companion/ai-companion-
        panel.tsx
      - API：src/app/api/ai/intervention/check/route.ts、src/app/api/ai/intervention/generate/route.ts、src/app/api/
        ai/intervention/feedback/route.ts
  - 元提示词评价 + 过程一致性校验
      - 页面：src/app/evaluation/prompt-assessment/page.tsx
      - 引擎：src/features/evaluation/prompt-quality.ts
      - API：src/app/api/evaluation/assess-prompt/route.ts、src/app/api/evaluation/track-consistency/route.ts、src/
        app/api/evaluation/prompt-history/[userId]/route.ts
  - 工程场景扩展（邮轮舒适度 / 破冰船鲁棒）
      - 页面：src/app/simulations/cruise-comfort/page.tsx、src/app/simulations/icebreaker-robust/page.tsx
      - 分析 API：src/app/api/simulation/cruise-comfort-analysis/route.ts、src/app/api/simulation/icebreaker-robust-
        analysis/route.ts
  - 数据层与文档
      - Prisma 扩展：prisma/schema.prisma
      - 迁移已生成并应用：prisma/migrations/20260221235601_add_development_plan_modules/migration.sql
      - 项目说明更新：docs/ProjectDescription.md
      - 执行计划已写入：.codex/plans/2026-02-21-development-plan-execution.md