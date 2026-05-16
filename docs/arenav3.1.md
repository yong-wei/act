下面这版计划把“竞技场继续升级”和“统一/综合控制工作台开发”改成可并行执行的方案。核心思路是：

**竞技场继续作为评测、提交、榜单、作业、发布和学习证据基础设施；综合控制工作台作为统一设计、仿真、辨识、预评测和提交入口。两者通过稳定契约通信，不互相吞并。**

当前项目已经具备相当多基础：Arena 已被定义为“对象 + 任务 + 允许方法 + 评测协议 + 榜单规则”的统一评测与排行榜层，正式排名只消费 `/api/arena/evaluate` 写入的真实提交记录。 现在的 `workspace-routing.ts` 仍按 `workspaceMode` 分流到多表征、黑箱、框图、MPC、Odyssey 等不同入口。 你提出的统一工作台，就是把这个“多入口分流”改造成“统一入口 + 任务上下文驱动的工作台布局”。

---

# 一、总体目标

本轮并行开发最终要达到：

```text
1. 学生端看到一个统一的“控制工作台”，而不是多个割裂工作台。
2. Arena 仍然负责官方评测、提交记录、榜单、作业发布、LearningFact 和权限边界。
3. 综合工作台负责模型探索、辨识、控制器设计、视图配置、预评测和提交入口。
4. 白箱串联校正继续保留当前四联图体验。
5. 复合校正、黑箱辨识、MPC/优化控制通过统一工作台预设逐步接入。
6. 自由探索模式成为功能丰富的工具箱；挑战模式严格受 Arena 任务配置约束。
7. 两个工作树并行推进时不抢同一批核心文件。
```

一句话概括：

```text
Arena 是裁判和记录系统；
综合工作台是设计和实验系统；
ControllerArtifact 是二者之间的工件协议。
```

---

# 二、并行开发分工

建议开三个分支/工作树，而不是两个。

## 工作树 A：综合控制工作台

建议分支：

```text
codex/unified-control-workbench
```

职责：

```text
src/app/interactive-learning/control-workbench/**
src/features/control-workbench/**
现有多表征工作台的可复用组件抽取
视图插件系统
工作台布局预设
工作台提交面板
黑箱辨识视图
复合校正参数面板
```

它不负责修改 Arena 官方评测逻辑，不改 Prisma，不改榜单，不改教师发布。

---

## 工作树 B：Arena 功能升级

建议分支：

```text
codex/arena-v3-evaluation-diagnostics
```

职责：

```text
黑箱官方隐藏场景评测
生产级 PlantAdapter registry
教师 Arena 发布报告
学生 Arena 诊断反馈
LearningFact 到教师/学生洞察的消费
作业榜单与成绩诊断增强
```

它不负责写综合工作台 UI，不改工作台布局，不改图表视图。

---

## 工作树 C：集成收口

建议分支：

```text
codex/arena-control-workbench-integration
```

职责：

```text
修改 workspace-routing.ts，把 Arena 任务默认路由到统一工作台
修改 challenge-detail 文案
旧多表征入口兼容或重定向
联调 publicationId / arenaTask / preset 参数
端到端验收
文档更新
```

集成分支应在 A、B 两条主线基本完成后再开。

---

# 三、先做共享契约，不要一上来各写各的

并行开发前必须先做一个“小而稳定”的契约 PR。

建议分支：

```text
codex/control-workbench-contracts
```

这个 PR 只定义类型、纯函数、约定，不写大 UI，不改评测逻辑。

## 3.1 新增契约目录

```text
src/features/control-workbench/contracts/
  session-context.ts
  targets.ts
  nominal-model.ts
  signals.ts
  views.ts
  methods.ts
  layout.ts
  controller-draft.ts
  artifact-bridge.ts
```

## 3.2 WorkbenchSessionContext

```ts
export type WorkbenchMode =
  | 'challenge'
  | 'explore'
  | 'assignment'
  | 'odyssey';

export interface WorkbenchSessionContext {
  mode: WorkbenchMode;

  arenaTaskId?: string;
  publicationId?: string;
  classId?: string;
  seasonId?: string;

  task?: ChallengeTask;
  object?: ChallengeObject;
  metricProfile?: MetricProfile;
  leaderboardPolicy?: LeaderboardPolicy;

  officialTarget: WorkbenchPlantTarget | null;
  workingModel: NominalModelArtifact | null;

  allowedMethods: ControllerMethod[];
  allowedViews: WorkbenchViewId[];
  defaultPreset: WorkbenchPresetId;

  experimentPolicy?: WorkbenchExperimentPolicy;
  submissionPolicy: WorkbenchSubmissionPolicy;
}
```

## 3.3 Official target 与 working model 必须分开

```ts
export interface WorkbenchPlantTarget {
  id: string;
  objectId: string;
  visibility: 'white-box' | 'gray-box' | 'black-box';
  source: ChallengeObject['source'];
  modelType:
    | 'transfer-function'
    | 'state-space'
    | 'black-box'
    | 'virtual-simulation'
    | 'data-only';

  transferFunction?: {
    numerator: number[];
    denominator: number[];
    display?: string;
    latex?: string;
  };
}
```

```ts
export interface NominalModelArtifact {
  id: string;
  ownerId?: string;
  sourceObjectId?: string;
  sourceDatasetHash?: string;

  modelType:
    | 'transfer-function'
    | 'state-space'
    | 'discrete-transfer-function';

  label: string;
  representation: Record<string, unknown>;
  validationMetrics?: Record<string, number>;
  createdAt: string;
}
```

这条边界非常重要。白箱任务中：

```text
officialTarget = workingModel
```

黑箱任务中：

```text
officialTarget = 官方黑箱对象
workingModel = 学生辨识出的名义模型
```

自由探索中：

```text
officialTarget = null
workingModel = 学生选择或编辑的模型
```

## 3.4 WorkbenchSignal

```ts
export type WorkbenchSignalKind =
  | 'reference'
  | 'original-output'
  | 'corrected-output'
  | 'nominal-output'
  | 'blackbox-output'
  | 'error'
  | 'control'
  | 'disturbance'
  | 'feedforward-control'
  | 'feedback-control'
  | 'constraint-upper'
  | 'constraint-lower';

export interface WorkbenchSignal {
  id: string;
  label: string;
  kind: WorkbenchSignalKind;
  source:
    | 'official-target'
    | 'working-model'
    | 'controller'
    | 'preview'
    | 'experiment';

  data: Array<{ t: number; value: number }>;
  unit?: string;
}
```

## 3.5 View plugin contract

```ts
export type WorkbenchViewId =
  | 'time-domain'
  | 'bode'
  | 'root-locus'
  | 'nyquist'
  | 'identification'
  | 'control-effort'
  | 'error-integral'
  | 'mpc-prediction'
  | 'metric-summary'
  | 'structure-summary';

export interface WorkbenchViewConfig {
  viewId: WorkbenchViewId;
  enabled: boolean;
  position: {
    row: number;
    col: number;
    rowSpan?: number;
    colSpan?: number;
  };
  options: Record<string, unknown>;
}
```

## 3.6 ControllerDraft 与 ControllerArtifact 区分

```ts
export interface ControllerDraft {
  id: string;
  method: ControllerMethod;
  params: Record<string, unknown>;
  source:
    | 'manual'
    | 'workspace'
    | 'identification'
    | 'template'
    | 'odyssey';
  dirty: boolean;
}
```

工作台内部编辑 `ControllerDraft`；官方提交前才转换为 Arena 已有的 `ControllerArtifact`。

当前 `/api/arena/evaluate` 已经能够接收 `taskId`、`artifact` 和 `publicationId`，并解析 publication 上下文写入正式提交。 所以综合工作台只需要生成正确的 artifact，不应重写提交 API。

## 3.7 契约 PR 交付标准

```text
1. 新增 contracts 目录；
2. 不修改现有业务行为；
3. 类型不依赖 React；
4. 类型不依赖 Prisma；
5. 类型可被 client 和 server 安全导入；
6. 增加最小 type-level/unit 测试；
7. npm run lint 通过。
```

---

# 四、工作树 A：综合控制工作台实现方案

## A0. 目标边界

综合工作台第一阶段不追求所有功能完美，而是先完成：

```text
1. 新路由 /interactive-learning/control-workbench；
2. 挑战模式与自由探索模式；
3. 经典四联图预设；
4. 复合校正预设最小闭环；
5. 黑箱辨识视图最小闭环；
6. 统一提交面板；
7. 保持旧多表征工作台可用。
```

---

## A1. 新增统一工作台路由

### 新增文件

```text
src/app/interactive-learning/control-workbench/page.tsx
src/features/control-workbench/shell/control-workbench-shell.tsx
src/features/control-workbench/context/resolve-workbench-session.ts
src/features/control-workbench/context/use-workbench-session.ts
```

### URL 参数

支持：

```text
arenaTask
publicationId
preset
mode
```

示例：

```text
/interactive-learning/control-workbench?arenaTask=task-second-order-lead-pid&preset=classic-four-view
/interactive-learning/control-workbench?mode=explore&preset=classic-four-view
/interactive-learning/control-workbench?arenaTask=task-cruise-roll-blackbox-identification&preset=blackbox-identification
```

### 解析规则

```text
有 arenaTask：
  进入 challenge mode；
  调用 Arena domain 中的 resolveArenaWorkbenchContext；
  对象、方法、指标、榜单、publicationId 均由上下文决定。

无 arenaTask：
  进入 explore mode；
  使用默认对象；
  允许模型选择、布局配置、自由辨识；
  不允许官方提交。
```

### 交付标准

```text
1. 新路由可打开；
2. 无 arenaTask 时显示自由探索提示；
3. 有合法 arenaTask 时显示挑战上下文；
4. 有非法 arenaTask 时显示错误页，不回退默认模型；
5. 不影响旧 /interactive-learning/multi-representation-linkage。
```

---

## A2. 统一工作台 Shell

### 结构

```text
ControlWorkbenchShell
├── WorkbenchTopBar
├── WorkbenchSidePanel
├── WorkbenchViewGrid
├── WorkbenchBottomStatus
└── UnifiedSubmissionPanel
```

### 顶部栏显示

```text
任务名称
对象名称
公开程度
当前模式
允许方法
评价指标
publicationId / classId
官方提交状态
```

### 侧栏

侧栏不固定为串联校正，而是由 method panel 决定：

```text
SerialCorrectionPanel
CompositeControlPanel
BlackBoxIdentificationPanel
MpcTemplatePanel
FreeModelPanel
```

### 交付标准

```text
1. 顶部栏能区分 challenge / explore；
2. 侧栏根据 preset 切换；
3. 视图网格根据 layout preset 渲染；
4. 提交面板在 explore mode 下禁用。
```

---

## A3. 视图注册系统

### 新增文件

```text
src/features/control-workbench/views/view-registry.ts
src/features/control-workbench/views/time-domain-view.tsx
src/features/control-workbench/views/bode-view.tsx
src/features/control-workbench/views/root-locus-view.tsx
src/features/control-workbench/views/nyquist-view.tsx
src/features/control-workbench/views/identification-view.tsx
src/features/control-workbench/views/control-effort-view.tsx
src/features/control-workbench/views/view-config-menu.tsx
```

### TimeDomainView 配置

支持勾选：

```text
参考输入
原系统输出
校正后输出
名义模型输出
黑箱输出
误差
控制量
扰动
前馈分量
反馈分量
约束上下界
```

### BodeView 配置

支持勾选：

```text
原系统
校正后开环
串联控制器
名义模型
是否显示裕度
```

### RootLocusView 配置

只允许单选：

```text
校正前
校正后
名义模型
```

为了清晰，不允许叠加。

### NyquistView 配置

支持有限叠加：

```text
校正前
校正后
```

### 交付标准

```text
1. 每个视图有配置菜单；
2. 不支持的信号显示禁用原因；
3. 根轨迹只允许单选；
4. Bode 和 Nyquist 可按规则叠加；
5. 配置状态可以保存在当前 session。
```

---

## A4. 经典四联图预设迁移

### 目标

把当前串联校正多表征体验放入统一工作台，不改学生熟悉体验。

### 新增预设

```text
ClassicFourViewPreset
```

默认布局：

```text
时域响应 | Bode
根轨迹   | Nyquist
```

默认侧栏：

```text
SerialCorrectionPanel
```

默认方法：

```text
PID / PI / PD / lead / lag
```

### 复用现有代码

现有多表征工作台已经能接入 Arena challenge context，并通过 `useControlEngine(enabled=false)` 处理无效任务。 当前控制分析 hook 支持浏览器 worker 和主线程 fallback，并支持 `enabled` 参数。

应尽量拆出：

```text
src/features/interactive/multi-representation-linkage/model.ts
```

中的可复用逻辑，而不是重写控制分析。

### 交付标准

```text
1. task-second-order-lead-pid 在统一工作台中表现与旧多表征工作台一致；
2. PID、lead、lag、根轨迹手柄、Bode 频率手柄正常；
3. 预评测指标正常；
4. 官方提交正常；
5. 旧多表征入口仍可访问。
```

---

## A5. 复合校正预设

### 新增文件

```text
src/features/control-workbench/presets/composite-control-preset.ts
src/features/control-workbench/method-panels/composite-control-panel.tsx
src/features/control-workbench/artifacts/build-composite-artifact.ts
```

### 参数

```text
prefilterGain
forwardGain
localFeedbackGain
disturbanceCompensation
```

### 视图布局

```text
时域响应        | 控制量
误差/扰动       | 指标摘要 / 结构摘要
```

### 视图默认勾选

时域：

```text
参考输入
校正后输出
误差
```

控制量：

```text
总控制量
前馈分量
反馈分量
控制量限幅
```

扰动视图：

```text
扰动输入
扰动补偿分量
```

### 官方评测

第一阶段继续走：

```text
template-whitebox-v1
```

但 UI 必须明确：

```text
当前复合校正官方评测为参数化模板评测，尚非完整框图真实闭环分析。
```

### 交付标准

```text
1. 复合校正任务能进入统一工作台；
2. 能编辑复合校正参数；
3. 能生成 composite-compensation ControllerArtifact；
4. 能调用 /api/arena/evaluate；
5. 视图不显示 Bode / 根轨迹等不适配内容，除非存在可分析名义模型。
```

---

## A6. 黑箱辨识预设

### 新增文件

```text
src/features/control-workbench/presets/blackbox-identification-preset.ts
src/features/control-workbench/views/identification-view.tsx
src/features/control-workbench/models/nominal-model-manager.ts
src/features/control-workbench/method-panels/blackbox-control-panel.tsx
```

### IdentificationView 功能

支持：

```text
选择测试信号 step / impulse / PRBS / sine
设置幅值、持续时间、采样时间、初始横摇、扰动等级
调用 /api/arena/blackbox-experiments
显示预算、datasetHash、输入输出曲线、dataQuality
保存名义模型
导入工作空间
```

当前黑箱实验服务已经通过 `createArenaBlackBoxExperiment` 执行预算控制和落库。 工作台必须调用 API，不得本地生成数据集。

### 名义模型

第一阶段支持手动填写二阶模型：

```text
gain
naturalFrequency
dampingRatio
delay?
```

自由探索模式可以提供最小二乘拟合；挑战模式默认不自动拟合，除非 task policy 允许。

### 时域对比

时域视图支持：

```text
黑箱实验响应
名义模型响应
控制后预演响应
参考输入
控制量
```

### 官方提交

生成：

```ts
{
  method: 'black-box-control',
  params: {
    representation: 'identified-model-controller',
    experimentDatasetHash,
    identificationModelId,
    identificationQuality,
    experimentCount,
    controllerGain,
    dampingCompensation,
    energyBudget
  }
}
```

虚拟仿真预演继续调用 `/api/arena/virtual-simulation-runs`，该 API 已经要求学生身份并校验黑箱数据集归属。

### 交付标准

```text
1. 黑箱任务可在统一工作台中运行实验；
2. 实验受预算限制；
3. datasetHash 可见；
4. 可以生成名义模型；
5. 可以运行虚拟仿真预演；
6. 可以提交 black-box-control artifact；
7. explore mode 不能进入官方榜单。
```

---

## A7. MPC / 优化控制预设占位

### 目标

先让入口和 artifact 生成闭环，不做完整 MPC 求解器。

### 新增文件

```text
src/features/control-workbench/presets/predictive-control-preset.ts
src/features/control-workbench/method-panels/mpc-template-panel.tsx
```

### 参数

```text
predictionHorizon
controlHorizon
outputWeight
controlWeight
terminalWeight
inputLimit
sampleTime
```

### 视图

```text
时域轨迹
控制量与约束
预测窗口占位
目标函数/约束违反摘要
```

### 官方评测

继续：

```text
template-whitebox-v1
```

UI 明确说明当前是参数化模板评测。

### 交付标准

```text
1. predictive-control 类型任务进入统一工作台；
2. 可编辑 MPC 参数；
3. 可生成 mpc ControllerArtifact；
4. 可提交官方评测；
5. 不开放任意代码控制器。
```

---

## A8. 统一提交面板

### 新增文件

```text
src/features/control-workbench/submission/unified-submission-panel.tsx
src/features/control-workbench/submission/build-controller-artifact.ts
```

### 功能

```text
显示当前 ControllerDraft
校验 allowedMethods
转换 ControllerArtifact
显示预评测指标
调用 /api/arena/evaluate
携带 publicationId
显示 official result
显示 protocolVersion / score / hard constraints / explanation
```

当前 `/api/arena/evaluate` 已经能解析 `publicationId` 并写入上下文。

### 交付标准

```text
1. 所有 preset 共用该提交面板；
2. 自由探索模式禁用官方提交；
3. 挑战模式提交成功；
4. publicationId 不丢失；
5. code-controller 不开放。
```

---

# 五、工作树 B：Arena 功能升级兼容方案

工作树 B 不直接做统一工作台 UI。它给统一工作台提供更强的后端能力。

---

## B1. 生产级 PlantAdapter Registry

### 目标

为综合工作台和 Arena 后端提供统一对象适配能力。

### 新增文件

```text
src/features/arena/adapters/types.ts
src/features/arena/adapters/registry.ts
src/features/arena/adapters/cruise-roll-blackbox-adapter.ts
src/features/arena/adapters/whitebox-transfer-function-adapter.ts
```

### 任务

1. 保留现有 mock adapter，但只在测试中使用。当前 `createMockCruiseRollBlackBoxAdapterForTests` 已明确是测试 mock。
2. 新增生产 `CruiseRollBlackBoxAdapter`：

   * `runPublicExperiment` 调用 `createArenaBlackBoxExperiment`；
   * `runVirtualPreview` 调用 `createArenaVirtualSimulationPreviewRun`；
   * `runOfficialEvaluation` 先留接口，后续进入黑箱隐藏场景。
3. 新增 `getArenaPlantAdapterForObject(object)`。
4. `/api/arena/blackbox-experiments` 和 `/api/arena/virtual-simulation-runs` 改为通过 registry 调用。

### 交付标准

```text
1. 生产路径不使用 mock adapter；
2. 黑箱实验预算不被绕过；
3. 数据集仍落库；
4. 预演仍校验数据集归属；
5. 测试覆盖 registry 选择。
```

---

## B2. 黑箱官方隐藏场景评测

### 目标

解决目前黑箱官方评测仍为模板估算的问题。当前 `blackbox-evaluator.ts` 仍根据 artifact 参数估算 trackingError、controlEnergy、constraintViolations 等。

### 新增文件

```text
src/features/arena/evaluation/blackbox-scenario-set.ts
src/features/arena/evaluation/blackbox-official-evaluator.ts
src/features/arena/evaluation/blackbox-official-metrics.ts
```

### 任务

1. 定义隐藏场景集：

```text
calm-sea
moderate-wave
strong-wave
initial-offset
energy-tight
```

2. 每个场景输出：

```text
trackingError
worstCaseDeviation
controlEnergy
constraintViolations
smoothness
```

3. 官方评测重新运行隐藏场景，不复用学生预演。
4. 协议版本升级：

```text
blackbox-official-v1
```

5. 当前 `blackbox-v1` 可保留为 legacy/template，但默认榜单不混入。

### 交付标准

```text
1. 黑箱官方成绩来自隐藏场景集；
2. 每个 ArenaEvaluationRun 记录 scenarioSetId；
3. 预演结果不进入正式榜单；
4. 数据集归属校验仍生效；
5. 测试覆盖合法、非法 dataset、隐藏场景失败、缓存复用。
```

---

## B3. 教师发布报告

### 当前基础

教师发布 API 已存在，`TeacherArenaConfig` 可以发布挑战。 教师页面也已接入配置组件。 发布 store 支持创建、列表、状态更新和学生可访问性解析。

### 新增页面

```text
src/app/teacher/arena/publications/[publicationId]/page.tsx
src/features/arena/teacher/arena-publication-report.tsx
src/features/arena/teacher/publication-analytics.ts
```

### 报告内容

```text
参与人数
提交次数
有效提交率
平均分 / 中位数 / 最高分
硬约束失败分布
弱指标分布
方法分布
未提交学生
个人最好成绩
优秀方案摘要
```

### 交付标准

```text
1. 教师可从 /teacher/arena 进入某个发布任务报告；
2. 报告按 publicationId / classId 过滤；
3. 不泄露其他班级数据；
4. 截止前隐藏榜单策略生效；
5. 测试覆盖权限、统计和空态。
```

---

## B4. 学生 Arena 诊断反馈

### 新增文件

```text
src/features/arena/student/arena-personal-feedback.tsx
src/features/arena/student/arena-feedback-rules.ts
```

### 功能

提交后给出：

```text
是否进入正式排名
硬约束失败原因
分项满意度
与个人最好成绩比较
主要瓶颈
下一步建议
```

### 与综合工作台关系

综合工作台的 `UnifiedSubmissionPanel` 应调用这里的反馈规则，不要自己写一套解释逻辑。

### 交付标准

```text
1. 白箱任务有反馈；
2. 黑箱任务有反馈；
3. 不泄露隐藏场景细节；
4. 反馈基于 metrics / hard constraints / satisfaction；
5. 测试覆盖不稳定、超调过大、能量过高、黑箱辨识不足。
```

---

## B5. Arena LearningFact 到教师/学生画像消费

### 当前基础

`LearningFact` 已能把 Arena 上下文写入 `contextJson.arena`。 数据治理事件类型也已经注册 Arena 核心事件和能力贡献。

### 新增文件

```text
src/lib/data-governance/arena-fact-analytics.ts
src/features/arena/analytics/student-arena-summary.ts
src/features/arena/analytics/class-arena-summary.ts
```

### 聚合指标

学生：

```text
最好成绩
有效提交率
最近挑战
主要弱项
方法偏好
从无效到有效的改进次数
```

教师班级：

```text
任务达标率
平均分
硬约束失败分布
弱指标热力图
方法分布
未提交名单
```

### 交付标准

```text
1. 学生 profile 可读取 Arena summary；
2. 教师班级洞察可读取 Arena summary；
3. 聚合来自 LearningFact 或 ArenaSubmission，不从前端拼；
4. 测试覆盖有效、无效、未提交三类学生。
```

---

# 六、工作树 C：集成收口方案

工作树 C 等 A、B 合并后再开。

---

## C1. 路由统一

修改：

```text
src/features/arena/workspace-routing.ts
```

从当前按 `workspaceMode` 分流，改为大部分任务进入统一工作台。

```ts
export function getArenaWorkspaceHref(task, object, params = {}) {
  if (object?.source === 'control-odyssey' || task.workspaceMode === 'control-odyssey') {
    return withArenaTask('/interactive-learning/control-odyssey', task.id, params);
  }

  return withArenaTask('/interactive-learning/control-workbench', task.id, {
    preset: task.workspaceMode,
    ...params,
  });
}
```

Control Odyssey 暂时保留专用页面，因为它有游戏化系统和积分系统，当前已经有桥接逻辑。

### 交付标准

```text
1. 白箱任务进入 unified control workbench；
2. 黑箱任务进入 unified control workbench；
3. 复合任务进入 unified control workbench；
4. MPC 任务进入 unified control workbench；
5. Control Odyssey 保持现有入口；
6. publicationId 正确透传。
```

---

## C2. 挑战详情页文案更新

当前 challenge detail 已经强调“仿真调试与方案提交均在工作台内完成”。 需要把具体文案统一为：

```text
进入控制工作台
```

而不是多表征/黑箱/框图等分散称呼。

### 交付标准

```text
1. 所有任务卡片和详情页入口文案一致；
2. 工作台名称不暴露过多内部模式；
3. 任务详情仍显示推荐 preset / 方法。
```

---

## C3. 旧入口兼容

旧路由：

```text
/interactive-learning/multi-representation-linkage
```

保留两种选择：

```text
方案 A：继续渲染旧页面；
方案 B：重定向到 /interactive-learning/control-workbench?preset=classic-four-view
```

建议第一阶段选方案 A，避免一次迁移过猛。等统一工作台稳定后再改方案 B。

### 交付标准

```text
旧入口不回归；
新入口可用；
Arena 默认进入新入口。
```

---

# 七、多工作树冲突控制表

## 工作树 A 可以改

```text
src/app/interactive-learning/control-workbench/**
src/features/control-workbench/**
src/features/interactive/multi-representation-linkage/** 仅限抽取复用组件
```

## 工作树 B 可以改

```text
src/features/arena/evaluation/**
src/features/arena/adapters/**
src/features/arena/blackbox/**
src/features/arena/teacher/**
src/features/arena/analytics/**
src/lib/data-governance/**
src/app/api/arena/**
src/app/api/teacher/arena/**
```

## 工作树 C 才能改

```text
src/features/arena/workspace-routing.ts
src/features/arena/challenge-detail.tsx
src/features/arena/arena-hall.tsx
docs/arena.md
docs/ProjectDescription.md
```

## 尽量不要并行改

```text
src/features/arena/types.ts
src/features/arena/data/seed-challenges.ts
prisma/schema.prisma
src/features/arena/domain.ts
src/features/arena/server.ts
src/features/arena/client.ts
```

如果必须改，先通过共享契约 PR。

---

# 八、验收矩阵

最终集成后必须手测和自动测试以下路径。

## 白箱串联校正

```text
/arena/challenges/task-second-order-lead-pid
→ 进入统一控制工作台
→ PID / lead 调参
→ 四联图刷新
→ 官方提交
→ 榜单更新
```

## 复合校正

```text
复合任务
→ 进入统一控制工作台
→ 编辑 prefilter / forward / local feedback / disturbance compensation
→ 显示时域、控制量、误差
→ 官方提交 template-whitebox-v1
```

## 黑箱辨识

```text
黑箱任务
→ 进入统一控制工作台
→ 运行实验
→ 查看 datasetHash
→ 手动填写名义模型
→ 运行预演
→ 官方提交
→ 黑箱评测结果
```

## 教师发布

```text
/teacher/arena
→ 发布 Arena 作业
→ 学生在 /arena 看到 publication
→ 进入挑战
→ 工作台提交携带 publicationId
→ 教师报告页看到提交
```

## Control Odyssey

```text
/interactive-learning/control-odyssey?arenaTask=task-odyssey-level-one-growth
→ 原游戏流程正常
→ 有 runId 时桥接 ArenaSubmission
→ 原积分不丢
```

---

# 九、阶段优先级建议

如果并行资源有限，建议这样排：

```text
第 1 优先级：共享契约 PR
原因：避免两个工作树各写一套 context / signal / artifact 类型。

第 2 优先级：综合工作台 Shell + 经典四联图迁移
原因：这是体验统一的核心。

第 3 优先级：工作台统一提交面板
原因：必须保证所有模式最终回到 Arena 官方提交。

第 4 优先级：黑箱辨识视图
原因：它是统一工作台区别于旧多表征工具的关键能力。

第 5 优先级：复合校正预设
原因：复合校正是从经典控制走向工程控制的第一步。

第 6 优先级：黑箱官方隐藏场景评测
原因：这是评测可信度升级，但可以与工作台并行。

第 7 优先级：教师报告与学生诊断反馈
原因：这是数据价值释放，依赖前面提交链路稳定。
```

---

# 十、给编程代理的硬性约束

1. **不要重写 `/api/arena/evaluate`。**
   综合工作台只生成 `ControllerArtifact`，官方提交继续走现有 API。当前 API 已能处理 publication 上下文。

2. **不要在工作台里计算正式成绩。**
   工作台只能做预评测，正式成绩来自 `ArenaEvaluationRun`。

3. **不要把黑箱实验本地生成。**
   必须调用 `/api/arena/blackbox-experiments`，底层走预算和持久化。

4. **不要把名义模型当官方模型。**
   黑箱任务中必须区分 `officialTarget` 和 `workingModel`。

5. **不要把所有 UI 写进一个组件。**
   必须使用 Shell + View Plugin + Method Panel + Preset。

6. **不要马上迁移 Control Odyssey。**
   Odyssey 已经有游戏化和 Arena 桥接，先保持专用页面。

7. **不要开放 code-controller。**
   当前代码型控制器仍应保持沙箱未验证则失败。

---

# 十一、建议最终 PR 切分

建议形成 5 个 PR：

```text
PR 1：control-workbench-contracts
只定义共享契约和类型。

PR 2：unified-control-workbench-shell
新增统一工作台路由、Shell、ClassicFourViewPreset。

PR 3：unified-workbench-views-and-methods
新增视图配置、复合校正预设、黑箱辨识视图、MPC 模板预设。

PR 4：arena-v3-backend-upgrades
生产 PlantAdapter registry、黑箱隐藏场景评测、教师报告、学生反馈、LearningFact 聚合。

PR 5：arena-workbench-integration
修改 workspace-routing、challenge-detail、旧入口兼容、文档和端到端验收。
```

每个 PR 都应独立通过：

```bash
npm run lint
npm run test:unit -- src/features/arena
npm run test:unit -- src/features/control-workbench
npm run build
```

涉及页面时增加浏览器 smoke test。

---

# 十二、最终判断

你的统一工作台方向应当作为下一阶段主线。它不会推翻 Arena 设计，反而会让 Arena 的长期设计真正落地：

```text
Arena 统一评测；
Control Workbench 统一设计；
PlantAdapter 统一对象接入；
ControllerArtifact 统一提交工件；
LearningFact 统一学习证据。
```

这样做之后，学生不需要理解“我该进哪个工作台”，只需要理解：

```text
我在控制工作台里解决当前挑战。
```

而系统内部仍然能根据挑战上下文自动启用：

```text
串联校正四联图
复合校正时域/控制量视图
黑箱辨识视图
MPC 预测控制视图
官方提交和榜单
```

这才是平台化方向。
