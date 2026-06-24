# 面向 Codex 的实施提案：知识/能力/素质目标体系与图谱中心重构

## 0. 提案定位

本提案用于指导 Codex 基于 `integration` 分支开展 OpenSpec 系列变更设计与实现。目标是在进一步扩展资源中心、学习路径规划、控灵辅助、学情诊断、教师备课增强包之前，先重构平台的教学目标语义底座。

本次重构的核心不是单纯新增一个图谱页面，而是建立以下统一关系：

```text
知识目标 / 能力目标 / 素质目标
        ↓
知识图谱 / 能力图谱 / 素质图谱
        ↓
资源中心 / 学习路径 / 控灵辅助 / 学情诊断 / 教师备课增强包
        ↓
学生 7 维画像与目标达成状态
```

## 1. 背景与问题

当前平台已经具备较强的数据治理、资源节点、路径规划和能力画像基础，但目标体系仍存在以下问题：

1. 当前学习画像为 6 维，混合了学科能力、工程素质、学习策略和 AI 素养，不适合作为下一阶段“能力目标体系”的直接主干。
2. 当前知识图谱更多承担课程知识结构展示和部分路径基础，尚未升级为统一图谱中心。
3. 能力目标尚未形成正式能力图谱，已有能力目标结构分散在局部目标或路径规划接口中。
4. 素质目标尚未结构化，容易停留在课程思政口号层面，缺少情境、证据和评价 Rubric。
5. 学习目标、资源归属、图谱节点、学生状态之间的关系还不够明确，容易导致路径规划、资源推荐和学情分析口径不一致。

因此，需要先完成 K/A/Q 目标体系、三类图谱 schema、7 维画像映射和图谱中心契约，再进入资源中心与路径规划的深度改造。

## 2. 总体目标

本系列变更完成后，平台应具备以下能力：

1. 建立统一的知识目标、能力目标、素质目标体系。
2. 将现有 6 维画像升级为 7 维画像，并保持旧数据兼容。
3. 建立知识图谱、能力图谱、素质图谱的统一类型、节点、边、目标映射和学生状态 overlay 契约。
4. 将现有知识图谱页面升级为图谱中心，支持三类图谱切换。
5. 图谱中心支持按知识目标、能力目标、素质目标筛选节点与边。
6. 图谱中心支持学生状态视图，高亮知识掌握、能力水平、素质表现、证据数量和置信度。
7. 图谱中心支持班级热力视图和资源覆盖视图，为后续资源中心、路径规划、控灵辅助、学情诊断打基础。
8. 所有新语义结构必须可用于 OpenSpec、单元测试、页面契约测试和后续数据治理。

## 3. 非目标

本系列变更不直接完成以下内容：

1. 不一次性重建全部课程资源。
2. 不要求一次性完成所有知识图谱节点的人工精修。
3. 不要求立即实现完整自适应路径推荐算法升级。
4. 不要求将所有旧画像数据迁移为新数据表。
5. 不要求立即实现复杂图数据库；初期可使用 TypeScript seed/catalog + JSON schema + Prisma 扩展字段。
6. 不要求将素质目标做成精确数值评分；素质目标应优先采用等级、证据、置信度和 Rubric。

## 4. 推荐 OpenSpec 变更系列

本轮实际拆分为 6 个 OpenSpec changes：

```text
1. define-kaq-objectives-and-portrait-v2
2. introduce-kaq-graph-schema
3. seed-autocontrol-kaq-graph-catalog
4. build-graph-center-readonly-foundation
5. add-graph-resource-coverage-overlay
6. add-learner-class-graph-overlays
```

其中第 1、2、3 项是语义基础，第 4 项是只读图谱中心入口，第 5 项是资源覆盖 overlay，第 6 项是学生与班级状态 overlay。资源覆盖和学习者状态必须拆开，因为前者消费资源与 RAG 投影，后者涉及隐私、班级分母、证据置信度和授权边界。

---

# Change 1: define-kaq-objectives-and-portrait-v2

## 1.1 目标

重构平台的教学目标体系与学生画像维度。

具体目标：

1. 定义知识目标、能力目标、素质目标的统一类型。
2. 将学生画像从当前 6 维升级为 7 维。
3. 建立 K/A/Q 三级目标与 7 维画像之间的映射。
4. 保持现有 6 维数据兼容，避免破坏已有页面和数据治理逻辑。
5. 为后续知识图谱、能力图谱、素质图谱建设提供目标锚点。

## 1.2 新 7 维画像

新增画像维度版本 `competency-portrait.v2`，包含：

```text
1. controlModelingRepresentation     控制建模与系统表征
2. systemAnalysisInterpretation       系统分析与性能解释
3. controllerDesignSynthesis          控制设计与参数综合
4. simulationValidationEvidence       仿真验证与证据推理
5. engineeringConstraintSafety        工程约束与安全责任
6. transferIntegratedApplication      跨域迁移与综合应用
7. reflectionImprovementAiCollab      反思改进与 AI 协同
```

## 1.3 与旧 6 维兼容关系

当前旧维度：

```text
controlModeling
parameterDesign
crossDomainTransfer
engineeringDecision
inquiryReflection
selfDirectedLearning
```

建议迁移映射：

```text
controlModelingRepresentation
≈ controlModeling 中的建模类证据

systemAnalysisInterpretation
≈ controlModeling 中的分析类证据 + assessment/time-domain/frequency-domain/root-locus 证据

controllerDesignSynthesis
≈ parameterDesign 中的控制器设计、参数综合、调参证据

simulationValidationEvidence
≈ simulation、arena、grading、report evidence 中的验证与证据化推理

engineeringConstraintSafety
≈ engineeringDecision 中的约束、安全、风险、伦理证据

transferIntegratedApplication
≈ crossDomainTransfer 中的船舶仿真、Arena、跨对象迁移、综合任务证据

reflectionImprovementAiCollab
≈ inquiryReflection + selfDirectedLearning 中的反思、提示词、AI 协作、路径执行证据
```

## 1.4 目标体系类型

新增文件建议：

```text
src/lib/objectives/objective-types.ts
src/lib/objectives/portrait-dimensions.ts
src/lib/objectives/objective-mapping.ts
src/lib/objectives/__tests__/objective-types.test.ts
```

定义基础类型：

```ts
export type ObjectiveDomain = 'knowledge' | 'capability' | 'quality';

export type ObjectiveLevel = 'overall' | 'secondary' | 'tertiary';

export type PortraitDimensionV2 =
  | 'controlModelingRepresentation'
  | 'systemAnalysisInterpretation'
  | 'controllerDesignSynthesis'
  | 'simulationValidationEvidence'
  | 'engineeringConstraintSafety'
  | 'transferIntegratedApplication'
  | 'reflectionImprovementAiCollab';

export interface ObjectiveDefinition {
  id: string;
  domain: ObjectiveDomain;
  level: ObjectiveLevel;
  parentId: string | null;
  title: string;
  description: string;
  courseModule?: string | null;
  portraitDimensions: PortraitDimensionV2[];
  evidencePolicy: ObjectiveEvidencePolicy;
  graphBinding: ObjectiveGraphBinding;
  status: 'draft' | 'active' | 'deprecated';
}
```

## 1.5 知识目标总体定义

知识目标总体表述：

```text
系统掌握自动控制原理的核心概念、数学表征、分析方法、设计理论与工程应用知识，能够理解各知识单元之间的先修、推导、对比和迁移关系。
```

二级知识目标建议：

```text
K-1 控制系统基本概念与反馈思想
K-2 系统建模与数学表征
K-3 时域分析与稳定性基础
K-4 根轨迹与频域分析方法
K-5 控制器设计与系统校正理论
K-6 现代控制、数字控制、非线性与船舶智控拓展知识
```

三级知识目标示例：

```text
K-2-1 理解传递函数的定义、适用条件及其与微分方程的关系
K-2-2 理解零点、极点与系统动态响应之间的关系
K-3-1 理解超调量、调节时间、稳态误差等时域性能指标
K-4-1 理解根轨迹规则及其对闭环极点变化的描述作用
K-4-2 理解 Bode 图、相位裕度、增益裕度与稳定性的关系
K-5-1 理解 PID、超前、滞后、滞后-超前、复合校正的适用场景
K-6-1 理解 MPC、数据驱动控制、黑箱辨识等前沿方法的基本思想
```

## 1.6 能力目标总体定义

能力目标总体表述：

```text
能够面向典型控制对象完成建模、分析、设计、仿真验证、工程约束权衡与跨场景迁移，形成可解释、可验证、可复现的控制系统设计方案。
```

二级能力目标建议直接对应 7 维画像：

```text
A-1 控制建模与系统表征能力
A-2 系统分析与性能解释能力
A-3 控制设计与参数综合能力
A-4 仿真验证与证据推理能力
A-5 工程约束与安全责任能力
A-6 跨域迁移与综合应用能力
A-7 反思改进与 AI 协同能力
```

三级能力目标示例：

```text
A-1-1 能根据物理对象建立微分方程、传递函数或方框图模型
A-1-2 能说明模型假设、参数意义和适用范围
A-2-1 能根据时域响应曲线判断系统性能瓶颈
A-2-2 能根据 Bode 图读取裕度并判断稳定风险
A-3-1 能根据性能指标选择合适的控制器结构
A-3-2 能解释 PID 或串联校正参数变化对响应的影响
A-4-1 能用控制工作台或仿真系统验证设计结果
A-4-2 能根据失败仿真结果定位模型、参数或约束原因
A-5-1 能在超调、能耗、饱和、安全边界之间做出有依据的权衡
A-6-1 能将课堂中的校正方法迁移到船舶航向、邮轮舒适度或 Arena 任务
A-7-1 能利用控灵建议进行方案改进，并保留验证证据
```

## 1.7 素质目标总体定义

素质目标总体表述：

```text
形成面向复杂工程系统的安全责任、证据诚信、系统权衡、人机协同、持续改进和船海工程使命意识，能够在控制系统设计与验证过程中体现可靠、规范、负责的工程判断。
```

二级素质目标建议：

```text
Q-1 工程安全与责任意识
Q-2 证据诚信与可追溯意识
Q-3 模型边界与规范意识
Q-4 系统权衡与绿色低碳意识
Q-5 人机协同与 AI 使用责任
Q-6 持续改进与抗挫折意识
Q-7 船海装备使命与工程报国意识
```

三级素质目标示例：

```text
Q-1-1 在控制器设计中主动检查超调、振荡、饱和和安全边界
Q-2-1 在报告中保留仿真、Arena、作业批改等证据来源，不伪造或选择性隐瞒结果
Q-3-1 能说明模型假设、线性化条件、数据来源和适用范围
Q-4-1 能在响应速度、稳定裕度、能耗、舒适性之间做出有依据的折中
Q-5-1 使用 AI 建议时能够追问依据、进行验证并标注 AI 参与
Q-6-1 面对仿真或 Arena 失败结果，能够复盘原因并形成改进路径
Q-7-1 能结合船舶安全、绿色航运和海洋装备自主可控理解控制系统设计责任
```

## 1.8 验收标准

1. 新增目标类型文件，能表达知识、能力、素质三类目标。
2. 新增 7 维画像维度定义。
3. 旧 6 维画像保留，不破坏现有页面和测试。
4. 新增 v1→v2 画像维度映射函数。
5. 每个二级目标必须至少映射一个画像维度。
6. 每个三级目标必须声明：

   * 所属 domain
   * 所属 parent
   * 关联画像维度
   * 证据策略
   * 图谱绑定策略
7. 单元测试覆盖：

   * 目标层级完整性
   * parentId 有效性
   * 画像维度映射有效性
   * 旧 6 维到新 7 维兼容转换
8. OpenSpec 校验通过：

```bash
rtk openspec validate define-kaq-objectives-and-portrait-v2 --strict
```

---

# Change 2: introduce-kaq-graph-schema

## 2.1 目标

建立知识图谱、能力图谱、素质图谱的统一 schema，为图谱中心、资源中心、路径规划和学情诊断提供结构化基础。

## 2.2 新增文件建议

```text
src/lib/graphs/graph-types.ts
src/lib/graphs/knowledge-graph-schema.ts
src/lib/graphs/capability-graph-schema.ts
src/lib/graphs/quality-graph-schema.ts
src/lib/graphs/graph-overlay-types.ts
src/lib/graphs/graph-validation.ts
src/lib/graphs/__tests__/graph-validation.test.ts
```

## 2.3 通用图谱类型

```ts
export type GraphDomain = 'knowledge' | 'capability' | 'quality';

export interface GraphNodeBase {
  id: string;
  domain: GraphDomain;
  title: string;
  description: string;
  objectiveIds: string[];
  courseModule?: string | null;
  portraitDimensions: PortraitDimensionV2[];
  status: 'active' | 'draft' | 'deprecated';
}

export interface GraphEdgeBase {
  id: string;
  domain: GraphDomain;
  fromNodeId: string;
  toNodeId: string;
  relation: string;
  strength: 'required' | 'recommended' | 'contextual';
  rationale: string;
}
```

## 2.4 知识图谱节点与边

知识图谱节点表示稳定知识对象。

```ts
export interface KnowledgeGraphNode extends GraphNodeBase {
  domain: 'knowledge';
  knowledgeType:
    | 'concept'
    | 'principle'
    | 'formula'
    | 'method'
    | 'criterion'
    | 'model'
    | 'case'
    | 'frontier';
  aliases: string[];
  canonicalObjectiveIds: string[];
}
```

知识图谱边建议：

```ts
export type KnowledgeGraphRelation =
  | 'prerequisite'
  | 'derived_from'
  | 'part_of'
  | 'contrasts_with'
  | 'applies_to'
  | 'transfers_to'
  | 'remediates';
```

## 2.5 能力图谱节点与边

能力图谱节点表示可观察能力。

```ts
export interface CapabilityGraphNode extends GraphNodeBase {
  domain: 'capability';
  knowledgeNodeIds: string[];
  bloomLevel:
    | 'remember'
    | 'understand'
    | 'apply'
    | 'analyze'
    | 'evaluate'
    | 'create';
  behaviorVerb: string;
  taskContext: string;
  successCriteria: string[];
  observableEvidenceTypes: Array<
    | 'question'
    | 'simulation-run'
    | 'arena-official-evaluation'
    | 'design-report'
    | 'reflection'
    | 'agent-interaction'
    | 'teacher-rubric'
  >;
  evaluationMethods: string[];
}
```

能力图谱边建议：

```ts
export type CapabilityGraphRelation =
  | 'requires'
  | 'enables'
  | 'validates'
  | 'remediates'
  | 'transfers_to'
  | 'extends';
```

## 2.6 素质图谱节点与边

素质图谱节点表示工程情境中的价值判断倾向。

```ts
export interface QualityGraphNode extends GraphNodeBase {
  domain: 'quality';
  qualityType:
    | 'engineering-safety'
    | 'evidence-integrity'
    | 'model-boundary'
    | 'system-tradeoff'
    | 'ai-collaboration-responsibility'
    | 'continuous-improvement'
    | 'ship-ocean-mission';
  scenario: string;
  observableBehaviors: string[];
  rubricLevels: Array<{
    level: 0 | 1 | 2 | 3 | 4;
    label: string;
    descriptor: string;
  }>;
  evidenceSources: Array<
    | 'simulation-constraint'
    | 'arena-submission'
    | 'design-report'
    | 'reflection'
    | 'konling-interaction'
    | 'teacher-review'
  >;
}
```

素质图谱边建议：

```ts
export type QualityGraphRelation =
  | 'supports'
  | 'triggered_by'
  | 'evidenced_by'
  | 'conflicts_with'
  | 'reinforces'
  | 'requires_tradeoff';
```

## 2.7 学生状态 Overlay 类型

图谱本体不存学生状态。学生状态通过 overlay 表达。

```ts
export interface LearnerGraphNodeOverlay {
  nodeId: string;
  domain: GraphDomain;
  learnerId: string;
  state:
    | 'mastered'
    | 'developing'
    | 'weak'
    | 'not-started'
    | 'locked'
    | 'evidence-needed';
  score: number | null;
  confidence: number;
  evidenceCount: number;
  lastEvidenceAt: string | null;
  evidenceRefs: string[];
  recommendation:
    | 'next'
    | 'review'
    | 'remediate'
    | 'extend'
    | 'locked'
    | 'none';
}
```

班级 overlay：

```ts
export interface ClassGraphNodeOverlay {
  nodeId: string;
  domain: GraphDomain;
  classId: string;
  distribution: {
    mastered: number;
    developing: number;
    weak: number;
    notStarted: number;
    evidenceNeeded: number;
  };
  averageScore: number | null;
  confidence: number;
  commonIssueCodes: string[];
}
```

## 2.8 验收标准

1. 三类图谱 schema 均已定义。
2. 三类图谱节点均可绑定 objectiveIds 和 portraitDimensions。
3. 三类图谱边具有明确 relation 和 strength。
4. 学生状态 overlay 与图谱本体分离。
5. 校验函数至少检查：

   * 节点 id 唯一
   * 边引用节点存在
   * objectiveIds 存在
   * portraitDimensions 合法
   * capability node 必须绑定至少一个 knowledge node
   * quality node 必须声明 observableBehaviors 和 rubricLevels
6. 单元测试覆盖合法和非法图谱样例。
7. OpenSpec 校验通过：

```bash
rtk openspec validate introduce-kaq-graph-schema --strict
```

---

# Change 3: seed-autocontrol-kaq-graph-catalog

## 3.1 目标

为自动控制原理课程建立首批 K/A/Q 目标与三类图谱种子数据，使平台具备可演示、可测试、可迭代的基础图谱。

## 3.2 新增文件建议

```text
src/lib/objectives/seed-autocontrol-objectives.ts
src/lib/graphs/seed-autocontrol-knowledge-graph.ts
src/lib/graphs/seed-autocontrol-capability-graph.ts
src/lib/graphs/seed-autocontrol-quality-graph.ts
src/lib/graphs/seed-autocontrol-graph-catalog.ts
src/lib/graphs/__tests__/seed-autocontrol-graph-catalog.test.ts
```

## 3.3 首批知识目标覆盖范围

建议覆盖 6 个二级知识目标，每个二级目标下至少 3 个三级目标。

首批重点知识节点建议：

```text
反馈控制
控制系统组成
微分方程模型
传递函数
零点极点
方框图
信号流图
时域响应
稳态误差
稳定性
根轨迹
Bode 图
Nyquist 图
相位裕度
增益裕度
PID 控制
串联校正
超前校正
滞后校正
复合校正
离散控制
MPC
船舶航向控制
黑箱辨识
```

## 3.4 首批能力图谱覆盖范围

建议至少建立 25 个能力节点，覆盖 7 个二级能力目标。

示例：

```text
A-1-1-model-from-physical-object
A-1-2-explain-model-assumptions
A-2-1-read-time-domain-performance
A-2-2-read-bode-margin
A-2-3-judge-root-locus-trend
A-3-1-select-controller-structure
A-3-2-tune-pid-with-rationale
A-3-3-design-lead-lag-compensator
A-4-1-run-simulation-validation
A-4-2-diagnose-failed-response
A-4-3-cite-evidence-in-report
A-5-1-check-actuator-saturation
A-5-2-balance-speed-stability-energy
A-6-1-transfer-to-ship-heading
A-6-2-transfer-to-arena-task
A-7-1-use-konling-with-verification
A-7-2-reflect-and-correct-path-deviation
```

## 3.5 首批素质图谱覆盖范围

建议至少建立 14 个素质节点，每个二级素质目标至少 2 个三级节点。

示例：

```text
Q-1-1-check-safety-boundary
Q-1-2-prioritize-safe-control-action
Q-2-1-preserve-evidence-chain
Q-2-2-report-failure-honestly
Q-3-1-state-model-boundary
Q-3-2-distinguish-simulation-from-real-system
Q-4-1-balance-performance-and-energy
Q-4-2-explain-tradeoff-rationale
Q-5-1-verify-ai-suggestion
Q-5-2-label-ai-assisted-content
Q-6-1-iterate-after-failure
Q-6-2-use-feedback-for-correction
Q-7-1-connect-control-to-ship-safety
Q-7-2-understand-green-shipping-context
```

## 3.6 图谱种子要求

每个节点必须包含：

```text
id
domain
title
description
objectiveIds
courseModule
portraitDimensions
status
```

能力节点额外必须包含：

```text
knowledgeNodeIds
bloomLevel
behaviorVerb
taskContext
successCriteria
observableEvidenceTypes
evaluationMethods
```

素质节点额外必须包含：

```text
qualityType
scenario
observableBehaviors
rubricLevels
evidenceSources
```

## 3.7 验收标准

1. 至少存在：

   * 1 个知识总目标
   * 6 个二级知识目标
   * 18 个三级知识目标
   * 1 个能力总目标
   * 7 个二级能力目标
   * 25 个三级能力目标
   * 1 个素质总目标
   * 7 个二级素质目标
   * 14 个三级素质目标
2. 至少存在：

   * 24 个知识图谱节点
   * 25 个能力图谱节点
   * 14 个素质图谱节点
3. 所有能力节点必须绑定至少一个知识节点。
4. 所有素质节点必须绑定至少一个画像维度。
5. 所有图谱节点必须可追溯到目标体系。
6. 所有图谱边必须通过校验。
7. 测试应断言：

   * 没有孤立 active node
   * 没有无目标绑定 node
   * 没有无画像维度 node
   * 没有无证据策略 capability/quality node
8. OpenSpec 校验通过：

```bash
rtk openspec validate seed-autocontrol-kaq-graph-catalog --strict
```

---

# Change 4: build-graph-center-readonly-foundation

## 4.1 目标

将现有知识图谱页面升级为图谱中心，使其支持知识图谱、能力图谱、素质图谱的统一展示与筛选。

## 4.2 页面与路由建议

建议新增或迁移：

```text
src/app/graph-center/page.tsx
src/features/graph-center/graph-center-page.tsx
src/features/graph-center/graph-center-shell.tsx
src/features/graph-center/graph-viewer.tsx
src/features/graph-center/objective-filter-panel.tsx
src/features/graph-center/graph-node-detail-panel.tsx
src/features/graph-center/graph-legend.tsx
src/features/graph-center/graph-view-mode-switcher.tsx
```

现有 `/knowledge` 可做重定向或保留兼容入口：

```text
/knowledge -> /graph-center?domain=knowledge
```

## 4.3 图谱中心基础视图

图谱中心至少支持以下视图：

```text
1. 知识图谱视图
2. 能力图谱视图
3. 素质图谱视图
4. 目标筛选视图
5. 资源覆盖视图占位
6. 学生状态 overlay 占位
7. 班级热力 overlay 占位
```

第一阶段可以先完成静态种子数据展示和目标筛选，overlay 可用 demo fixture。

## 4.4 交互功能

必须支持：

1. 图谱类型切换：

   * knowledge
   * capability
   * quality

2. 目标域筛选：

   * 知识目标
   * 能力目标
   * 素质目标

3. 目标层级筛选：

   * 总体目标
   * 二级目标
   * 三级目标

4. 节点状态筛选：

   * active
   * draft
   * deprecated

5. 画像维度筛选：

   * 7 维画像中的任一维度

6. 节点详情：

   * 标题
   * 描述
   * 所属目标
   * 所属画像维度
   * 前置/后继节点
   * 关联资源数量
   * 证据类型
   * 学生状态 overlay 占位

## 4.5 UI 要求

1. 页面必须使用 AppShell。
2. 页面标题建议为“图谱中心”。
3. 顶部提供图谱类型切换 tabs。
4. 左侧或右侧提供目标筛选面板。
5. 中央为图谱展示区域。
6. 节点点击后显示详情面板。
7. 移动端至少退化为列表 + 详情模式。
8. 不允许只做静态 SVG 截图，必须基于图谱数据渲染。

## 4.6 API 或服务函数

第一阶段可以先使用 server-side loader，不一定立即新增 API。

建议提供：

```text
src/lib/graphs/graph-center-service.ts
```

函数：

```ts
listGraphDomains()
getGraphCenterPayload(input)
filterGraphByObjective(input)
filterGraphByPortraitDimension(input)
getGraphNodeDetail(input)
```

后续如需 API，可新增：

```text
src/app/api/graph-center/payload/route.ts
```

## 4.7 验收标准

1. `/graph-center` 可访问。
2. `/knowledge` 兼容跳转或显示知识图谱视图。
3. 可切换知识图谱、能力图谱、素质图谱。
4. 可按目标 domain、目标层级、画像维度筛选。
5. 点击节点可查看详情。
6. 能清晰区分图谱本体与学生状态 overlay。
7. 没有学生数据时，显示“标准课程图谱”。
8. 页面通过基础可访问性检查：

   * tabs 有语义
   * 图谱节点可键盘聚焦或有列表替代
   * 节点详情有明确标题
9. 单元测试覆盖 graph-center-service。
10. 至少一个 Playwright 或 component test 覆盖：

    * 打开图谱中心
    * 切换图谱类型
    * 选择目标筛选
    * 打开节点详情
11. OpenSpec 校验通过：

```bash
rtk openspec validate build-graph-center-readonly-foundation --strict
```

---

# Change 5: add-graph-resource-coverage-overlay

## 5.1 目标

在图谱中心中接入资源覆盖状态，使图谱中心能够暴露每个图谱节点是否有可学、可练、可测、可引用和可验证的资源支撑。本变更不接入学生或班级状态，避免把资源治理与个人画像隐私混在同一个实施单元。

## 5.2 资源覆盖状态

新增服务：

```text
src/lib/graphs/resource-coverage-service.ts
```

每个图谱节点输出：

```ts
ResourceCoverageStatus {
  nodeId: string;
  domain: GraphDomain;
  linkedResourceCount: number;
  pathEligibleResourceCount: number;
  ragIndexedResourceCount: number;
  citationReadyResourceCount: number;
  verifiedCitationResourceCount: number;
  assessmentResourceCount: number;
  simulationResourceCount: number;
  arenaPreviewResourceCount: number;
  arenaOfficialResourceCount: number;
  terminalValidationCapableResourceCount: number;
  coverageState: 'sufficient' | 'partial' | 'missing' | 'not-audited';
  missingCoverageTypes: string[];
  limitations: string[];
}
```

必须明确：

1. `ragIndexedResourceCount` 只表示进入检索投影，不等于可引用。
2. `citationReadyResourceCount` 表示有 CitationAddress 或可解析 citation target。
3. `verifiedCitationResourceCount` 表示通过权限、authority、freshness、scope 和 citation resolver 校验。
4. Arena 覆盖必须区分 preview、official 和 terminal-validation-capable；正式评价证据仍以 governed ArenaSubmission 为准。

## 5.3 前端显示

图谱中心新增资源覆盖模式：

```text
resource        资源覆盖
```

节点颜色建议：

```text
绿色：覆盖充分
黄色：覆盖部分
红色：覆盖缺失
灰色：未审计
```

不要把颜色作为唯一信息，应同时显示文本标签、覆盖计数、缺失覆盖类型和 citation readiness 限制。

## 5.4 验收标准

1. 图谱中心支持 resource coverage 模式。
2. 资源覆盖模式能显示每个节点是否有资源支撑。
3. 资源覆盖至少区分：

   * linked resources
   * path eligible resources
   * RAG indexed resources
   * citation-ready resources
   * verified citation resources
   * assessment resources
   * simulation resources
   * Arena preview / official / terminal-validation-capable resources
4. “已索引”不得显示为“可引用”。
5. Coverage overlay 不修改图谱本体数据。
6. Overlay payload 包含 generatedAt 和 limitations。
7. 单元测试覆盖 sufficient / partial / missing / not-audited 分类，以及 indexed 与 citation-ready 的差异。
8. OpenSpec 校验通过：

```bash
rtk openspec validate add-graph-resource-coverage-overlay --strict
```

---

# Change 6: add-learner-class-graph-overlays

## 6.1 目标

在图谱中心中接入学生状态 overlay 和班级热力 overlay，使图谱中心从标准课程结构与资源治理入口，进一步成为诊断和学习状态入口。

## 6.2 学生状态 Overlay

新增服务：

```text
src/lib/graphs/learner-graph-overlay-service.ts
```

输入：

```ts
{
  learnerId: string;
  classId?: string | null;
  graphDomain: 'knowledge' | 'capability' | 'quality';
  objectiveIds?: string[];
}
```

输出：

```ts
LearnerGraphOverlayPayload {
  learnerId: string;
  generatedAt: string;
  graphDomain: GraphDomain;
  nodeOverlays: LearnerGraphNodeOverlay[];
  limitations: string[];
}
```

## 6.3 Overlay 状态规则

建议状态计算规则：

```text
mastered:
  score >= 0.8 且 confidence >= 0.6 且 evidenceCount >= 最小证据数

developing:
  score >= 0.5 或已有有效证据但未达 mastered

weak:
  多次失败、低分、约束违反或教师评价不足

not-started:
  无证据且未被路径推荐

locked:
  前置知识或能力未满足

evidence-needed:
  有学习记录但证据不足或置信度不足
```

## 6.4 班级热力 Overlay

新增服务：

```text
src/lib/graphs/class-graph-overlay-service.ts
```

功能：

1. 聚合班级学生在图谱节点上的状态。
2. 输出 mastered/developing/weak/notStarted/evidenceNeeded 分布。
3. 标注班级共性薄弱节点。
4. 支持教师端图谱中心热力模式。
5. 对小样本和低分母节点执行隐私抑制、分桶或不可用状态。
6. 输出 includedPopulation、excludedPopulation、denominator、suppressionReason 和 roundingPolicy，避免教师从单个图谱节点反推出单个学生状态。

## 6.5 推荐与依据合同

学生 overlay 的 recommendation 不得是裸建议。每条推荐必须包含：

```text
recommendation
reasonCode
evidenceWindow
sourceCoverage
confidence
requiredCitationClasses
verifiedCitationRefs
limitations
```

推荐必须区分：

1. 目标要求。
2. 已观察掌握。
3. 资源覆盖。
4. 路径上下文。
5. 低置信度或缺证据限制。

## 6.6 前端显示

图谱中心新增视图模式：

```text
learner         学生状态
class-heatmap   班级热力
```

节点颜色建议：

```text
绿色：已掌握
黄色：发展中
红色：薄弱
灰色：未开始 / 未审计
蓝色：推荐下一步
锁图标：前置条件不足
```

不要把颜色作为唯一信息，应同时显示文本标签。

## 6.7 验收标准

1. 图谱中心支持 learner / class-heatmap 模式。
2. 没有学生上下文时，learner 模式显示明确空状态。
3. 有 demo learner fixture 时，能高亮掌握、薄弱、未开始、locked、evidence-needed 节点。
4. learner overlay recommendation 必须包含 reasonCode、evidenceWindow、sourceCoverage、confidence、verifiedCitationRefs 和 limitations。
5. 有 demo class fixture 时，能显示班级热力分布。
6. class overlay 必须提供 denominator、includedPopulation、excludedPopulation、suppressionReason 和 roundingPolicy。
7. 小样本或低分母节点必须进入 suppressed / unavailable 状态，而不是展示可反推个人的分布。
8. Overlay 不修改图谱本体数据。
9. Overlay payload 包含 generatedAt 和 limitations。
10. 单元测试覆盖：

   * learner overlay 状态计算
   * recommendation 依据字段
   * class overlay 聚合
   * 小样本抑制
11. 页面测试覆盖：

* 切换 learner overlay
* 切换 class-heatmap overlay
* 查看节点详情中的 overlay 信息

12. OpenSpec 校验通过：

```bash
rtk openspec validate add-learner-class-graph-overlays --strict
```

---

# 6. 数据模型建议

## 6.1 第一阶段不强制 Prisma 落库

第一阶段建议优先采用 TypeScript catalog/seed + validation。原因：

1. 目标体系和图谱结构仍在快速演进。
2. 先完成类型、schema、测试和页面契约，比直接建表风险更低。
3. 后续资源中心和教师编辑功能稳定后，再考虑 Prisma 化。

## 6.2 后续可选 Prisma 表

后续可扩展：

```prisma
model ObjectiveDefinition {
  id          String   @id
  domain      String
  level       String
  parentId    String?
  title       String
  description String
  payload     Json
  status      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model GraphNode {
  id          String   @id
  domain      String
  title       String
  description String
  payload     Json
  status      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model GraphEdge {
  id          String   @id
  domain      String
  fromNodeId  String
  toNodeId    String
  relation    String
  strength    String
  payload     Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model LearnerGraphSnapshot {
  id          String   @id @default(cuid())
  learnerId   String
  classId     String?
  domain      String
  generatedAt DateTime
  payload     Json
}
```

但本轮 OpenSpec 不要求落库。

---

# 7. 与现有模块的衔接

## 7.1 与 ResourceNode 的关系

ResourceNode 继续承担资源中心和路径规划节点的角色。

新增图谱中心后，应建立：

```text
GraphNode -> ObjectiveDefinition
GraphNode -> ResourceNode
ResourceNode -> GraphNode
ResourceNode -> PlanningUnit
ResourceNode -> RetrievalChunk
```

资源不应只绑定章节，而应可同时绑定：

```text
知识节点
能力节点
素质节点
学习目标
画像维度
```

## 7.2 与路径规划的关系

路径规划后续应从 LearningGoal 出发，内部读取：

```text
知识图谱先修
能力图谱前置
素质图谱任务要求
资源节点可用性
学生状态 overlay
```

本轮不要求升级路径算法，但必须保证 graph center payload 能被路径规划复用。

## 7.3 与控灵的关系

控灵后续回答应能引用：

```text
当前学习目标
相关知识节点
相关能力节点
相关素质节点
资源片段
学生状态 overlay
证据 refs
```

本轮不要求改控灵回答逻辑，但图谱中心和 overlay 服务应为后续上下文提供结构化 payload。

## 7.4 与学情诊断的关系

学生画像仍可展示 7 维雷达图，但节点级诊断应来自：

```text
KnowledgeGraphNode mastery
CapabilityGraphNode performance
QualityGraphNode disposition evidence
```

7 维只是聚合展示，不是图谱本体。

---

# 8. 建议实施顺序

## 阶段一：语义基础

1. `define-kaq-objectives-and-portrait-v2`
2. `introduce-kaq-graph-schema`

验收重点：

```text
类型稳定
测试通过
旧 6 维兼容
目标体系可被校验
```

## 阶段二：种子数据

3. `seed-autocontrol-kaq-graph-catalog`

验收重点：

```text
至少完成一批覆盖自动控制主线的目标和图谱节点
能力节点绑定知识节点
素质节点具备情境和 Rubric
```

## 阶段三：图谱中心

4. `build-graph-center-readonly-foundation`

验收重点：

```text
可访问
可切换三类图谱
可按目标和画像维度筛选
可看节点详情
```

## 阶段四：资源覆盖

5. `add-graph-resource-coverage-overlay`

验收重点：

```text
资源覆盖模式可切换
区分 linked/path-eligible/indexed/citation-ready/verified-citation
资源覆盖可暴露缺口
overlay 不污染图谱本体
```

## 阶段五：学生与班级状态

6. `add-learner-class-graph-overlays`

验收重点：

```text
学生状态、班级热力两种 overlay 可切换
学生推荐必须带 reasonCode、sourceCoverage、evidenceWindow 和 verifiedCitationRefs
班级热力必须有低分母/小样本抑制
overlay 不污染图谱本体
```

---

# 9. Codex 执行要求

## 9.1 开发前读取文件

Codex 开始任一 change 前应先读取：

```text
docs/memory/CHATGPT_CONTEXT.md
docs/memory/02-recent-summary.md
docs/memory/10-project/10-current-state.md
docs/ProjectDescription.md
src/lib/data-governance/competency-model.ts
src/lib/adaptive-learning-path-planner.ts
src/lib/resource-node-registry.ts
src/lib/data-governance/adaptive-learner-state-service.ts
src/lib/konling-agent-runtime.ts
openspec/specs/resource-node-registry/spec.md
openspec/specs/adaptive-learning-path-planning/spec.md
```

## 9.2 开发方式

1. 所有变更从 `integration` 分支开出。
2. 每个 OpenSpec change 独立分支实现。
3. 先写 OpenSpec proposal/spec/tasks，再写代码。
4. 不要把目标体系、图谱 schema、前端图谱中心混在一个巨大 PR 中。
5. 不要直接删除旧 6 维字段。
6. 不要让学生 overlay 写入图谱本体。
7. 不要把素质目标做成纯口号节点，必须声明情境、行为和证据。
8. 不要把图谱中心做成静态展示图，必须由结构化数据驱动。

## 9.3 推荐测试命令

根据改动范围选择：

```bash
rtk openspec validate --changes --strict
rtk npm run test -- src/lib/objectives
rtk npm run test -- src/lib/graphs
rtk npm run test -- src/features/graph-center
rtk npm run lint
rtk npm run build
```

如果已有项目测试命令不同，以仓库脚本为准。

---

# 10. 总体验收标准

本系列全部完成后，应满足：

1. 平台有明确的知识目标、能力目标、素质目标定义。
2. 每类目标均包含总体目标、二级目标、三级目标。
3. 学生画像从 6 维兼容升级为 7 维。
4. 目标与 7 维画像之间存在显式映射。
5. 知识图谱、能力图谱、素质图谱均有正式 schema。
6. 三类图谱节点均可绑定目标、画像维度和资源。
7. 图谱中心可切换知识、能力、素质三类图谱。
8. 图谱中心可按 K/A/Q 目标筛选。
9. 图谱中心可显示标准图谱和学生状态 overlay。
10. 图谱中心可显示资源覆盖状态。
11. 图谱本体、学生状态、资源覆盖三者在数据结构上分离。
12. 后续资源中心、路径规划、控灵辅助、学情诊断可以复用相同目标和图谱 payload。
13. 所有 OpenSpec 变更通过 strict validation。
14. 核心类型和服务函数有单元测试。
15. 前端图谱中心有最小页面验收测试。

---

# 11. 最终产品形态

完成后，平台应形成如下产品逻辑：

```text
教师：
  在图谱中心查看课程标准图谱
  按知识/能力/素质目标筛选图谱
  查看班级薄弱节点和资源缺口
  基于图谱缺口生成备课增强包

学生：
  在图谱中心查看自己的学习状态
  看到已掌握、发展中、薄弱、未开始和被锁定节点
  从推荐节点进入学习路径或资源

系统：
  用知识图谱保证认知先修
  用能力图谱保证训练递进
  用素质图谱保证工程判断与价值取向
  用资源中心保证每个目标有可学、可练、可测、可解释资源
  用 7 维画像聚合展示学生状态
```

本轮重构完成后，后续再开展资源中心、学习目标目录、路径规划升级、控灵图谱上下文和学情诊断重构会更稳，不会继续在旧的 6 维能力模型和单一知识图谱上叠加复杂逻辑。
