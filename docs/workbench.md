你的想法是合理的，而且比“为每类任务单独建一个工作台”更适合长期平台化。

关键判断是：

**用户体验上应该是一套统一控制工作台；工程实现上不能是一个巨型工作台，而应是统一外壳 + 视图插件 + 控制方法插件 + 对象适配器 + 挑战配置驱动。**

也就是说，学生看到的是一个“控制工作台”；系统内部仍然保持功能分离。这样既降低认知负担，也不牺牲 Arena 作为长期统一评测基础设施的扩展性。

---

# 一、这和当前 Arena 长期设计如何结合

当前 Arena 的长期设计已经是“对象 + 任务 + 允许方法 + 评测协议 + 榜单规则”。项目说明里也明确 Arena 是统一评测与排行榜层，不是单一控制方法工作台；白箱、黑箱、虚拟仿真、控制器工件、官方评测、提交记录和榜单都已经在这套体系里。

现在的问题是：**Arena 的评测层已经逐渐统一，但工作台层还在按任务类型分流。**

当前 `workspace-routing.ts` 会根据 `workspaceMode` 把不同任务路由到不同页面：Control Odyssey、黑箱辨识、框图工作台、预测控制、多表征联动等。 这在工程早期合理，但长期会造成体验割裂：

```text
串联校正 -> 多表征工作台
黑箱对象 -> 邮轮仿真/辨识入口
复合校正 -> lesson-05 或框图入口
MPC -> unit-5-4 课程入口
奥德赛 -> control-odyssey
```

学生会觉得自己在不同应用之间跳转，而不是在同一个“控制设计环境”里处理不同任务。

你的方案本质上是把这个分流改成：

```text
Arena Challenge
    ↓
Unified Control Workbench
    ↓
根据任务上下文自动加载：
对象模型 / 控制方法 / 可用视图 / 评价指标 / 提交协议
```

这正好补上了 Arena 设计中“统一设计与实验层”的缺口。

---

# 二、需要坚持的架构原则

统一工作台不能理解为“所有逻辑写进一个大页面”。那会把系统拖垮。

更合理的结构是：

```text
UnifiedControlWorkbenchShell
├── WorkbenchContextResolver
├── PlantAdapter
├── NominalModelManager
├── ControllerArtifactManager
├── ViewRegistry
├── MethodRegistry
├── EvaluationPreviewEngine
├── OfficialSubmissionPanel
└── TelemetryBridge
```

学生只看到一个工作台，但系统内部仍然分层。

当前平台已经有不少基础可以复用。比如官方提交已经统一走 `/api/arena/evaluate`，并且提交时会解析 `publicationId`，把 `publicationId / classId / seasonId / isLate` 写入正式提交上下文。 白箱 PID 和串联校正也已经通过 `ControlAnalysisService` 走服务端 WASM 分析链。 所以统一工作台不应重写评测，而应消费这些已有服务。

---

# 三、统一工作台的产品形态

建议把统一工作台分成四个固定区域。

## 1. 顶部任务上下文栏

始终显示：

```text
任务名称
对象来源
模型公开程度
当前模式：挑战 / 自由探索 / 作业 / 奥德赛 / 黑箱
允许控制方法
官方评价指标
是否绑定 publicationId / classId
是否可提交官方评测
```

在挑战模式下，顶部栏应明确：

```text
当前对象与评价协议由挑战任务锁定
工作台预评测不等同于官方榜单成绩
```

在自由探索模式下，顶部栏应显示：

```text
当前为自由探索，未绑定 Arena 任务
可保存方案，但不能进入正式榜单
```

## 2. 左侧对象与控制器配置栏

这里取代现在多表征工作台的侧边栏，但内容按模式变化。

白箱串联校正任务：

```text
对象模型只读
PID / PI / PD / lead / lag 参数
响应类型
显示裕度
```

复合校正任务：

```text
结构模板
前置滤波
前馈通道
局部反馈
扰动补偿
控制量限制
```

黑箱任务：

```text
官方目标对象
实验数据集
辨识模型
名义模型参数
控制器参数
虚拟仿真预演参数
```

自由探索：

```text
对象选择
模型编辑
视图配置
方法选择
名义模型管理
```

## 3. 中间视图网格

不是固定四联图，而是“可配置视图布局”。

默认可以保留经典四联图：

```text
时域响应
Bode 图
根轨迹
Nyquist 图
```

但对不同任务应自动切换布局。

例如串联校正挑战：

```text
时域响应 + Bode + 根轨迹 + Nyquist
```

复合校正挑战：

```text
时域响应 + 控制量 + 误差积分 + 结构摘要
```

黑箱辨识挑战：

```text
实验数据 + 辨识拟合 + 名义模型响应 + 黑箱/名义模型对比
```

MPC 挑战：

```text
时域轨迹 + 控制量/约束 + 预测窗口 + 目标函数/约束违反
```

Control Odyssey：

```text
关卡仿真 + 指标面板 + 控制配置 + Arena 提交状态
```

## 4. 底部或右侧提交与诊断区

统一显示：

```text
当前方案工件
预评测指标
官方提交按钮
最近提交
硬约束结果
与个人最好成绩对比
推荐改进方向
```

挑战详情页现在已经强调“仿真调试与方案提交均在工作台内完成”。 这和统一工作台方向一致：详情页负责说明任务，工作台负责设计、预评测、提交。

---

# 四、视图系统应该如何设计

你的视图配置想法是对的。建议把每个图表抽象为 `WorkbenchViewPlugin`。

```ts
interface WorkbenchViewPlugin {
  id: string;
  label: string;
  supportedModelKinds: string[];
  supportedControllerKinds: string[];
  defaultConfig: object;
  getAvailability(context: WorkbenchContext): ViewAvailability;
  render(props: WorkbenchViewProps): ReactNode;
}
```

## 1. 时域视图 TimeDomainView

支持多信号叠加：

```text
参考输入 r(t)
原系统输出 y0(t)
校正后输出 y(t)
黑箱真实输出 y_blackbox(t)
名义模型输出 y_nominal(t)
误差 e(t)
控制量 u(t)
扰动 d(t)
前馈分量 uff(t)
反馈分量 ufb(t)
约束上下界
```

挑战模式下由任务配置决定默认勾选项。自由探索模式允许学生任意配置。

例如：

```text
串联校正默认：
y0(t), y(t), r(t)

复合校正默认：
r(t), y(t), e(t), u(t), d(t)

黑箱默认：
y_blackbox(t), y_nominal(t), r(t), u(t)
```

## 2. BodeView

可选对象：

```text
原系统 G(s)
校正器 C(s)
开环 G(s)C(s)
校正前开环
校正后开环
名义模型
```

可选显示：

```text
幅频
相频
相角裕度
幅值裕度
交越频率
带宽
```

对黑箱对象，BodeView 不直接显示官方对象，只显示学生名义模型或辨识模型，并明确标注：

```text
频域图基于名义模型，不代表官方黑箱对象。
```

## 3. RootLocusView

你说“为了清晰不允许叠加”是对的。根轨迹叠加很容易误导。

建议只允许选择：

```text
校正前
校正后
名义模型
```

一次只显示一种。

如果任务不是 SISO LTI，直接不可用，并给解释：

```text
当前对象不具备公开 SISO LTI 传递函数，根轨迹视图不可用。
```

## 4. NyquistView

可以允许叠加，但要谨慎。建议：

```text
最多叠加 2 条：校正前 / 校正后
支持显示 -1 点
支持显示方向箭头
支持裕度辅助标识
```

## 5. IdentificationView

这是统一工作台中最关键的新视图。

支持：

```text
选择测试信号：step / impulse / PRBS / sine
设置幅值、采样时间、持续时间、初始条件、扰动等级
运行开环实验
显示输入输出数据
选择假设模型
填写或辨识参数
保存名义模型
导入工作空间
```

自由探索模式：

```text
允许最小二乘 / 曲线拟合 / 简化模型自动辨识
允许多个名义模型并列比较
```

挑战模式：

```text
按 challenge 配置限制实验次数、信号类型、采样点数、预算
通常只允许手动填写参数或有限辅助辨识
所有数据集必须落库并有 datasetHash
```

当前黑箱实验服务已经有预算控制、落库和 datasetHash 归属校验。`createArenaBlackBoxExperiment` 会调用 `runArenaBlackBoxExperiment`，再通过 store 做预算检查和持久化。 统一工作台的 IdentificationView 应直接调用这个服务，不应绕过它。

---

# 五、统一工作台与 Arena 的上下文关系

统一工作台最核心的输入不应该是“模型”，而是：

```ts
WorkbenchSessionContext
```

建议结构：

```ts
interface WorkbenchSessionContext {
  mode: 'challenge' | 'explore' | 'assignment' | 'odyssey';
  task?: ChallengeTask;
  object?: ChallengeObject;
  publicationId?: string;
  classId?: string;
  seasonId?: string;

  officialTarget: PlantTarget;
  workingModel?: NominalModel;
  allowedMethods: ControllerMethod[];
  allowedViews: WorkbenchViewId[];
  defaultLayout: WorkbenchLayoutPreset;
  metricProfile?: MetricProfile;
  leaderboardPolicy?: LeaderboardPolicy;

  experimentPolicy?: ExperimentPolicy;
  submissionPolicy?: SubmissionPolicy;
}
```

这里要区分两类模型：

```text
officialTarget：官方目标对象，可能是白箱、灰箱、黑箱、虚拟仿真对象
workingModel：学生工作模型，可能来自公开传函、手动输入、辨识结果
```

这对黑箱任务尤其重要。

黑箱模式下：

```text
officialTarget = 官方黑箱对象
workingModel = 学生辨识得到的名义模型
```

白箱串联校正模式下：

```text
officialTarget = 公开传递函数对象
workingModel = 同一个公开传递函数
```

自由探索模式下：

```text
officialTarget = null
workingModel = 学生选择或编辑的模型
```

这个区分不能丢。否则学生会误以为“名义模型表现很好 = 官方对象表现很好”。

---

# 六、统一工作台如何兼容当前实现

当前已有实现不需要推倒。可以这样迁移。

## 1. 当前多表征工作台变成第一个视图预设

原 `/interactive-learning/multi-representation-linkage` 不立即废弃，而是作为统一工作台的 legacy alias。

新入口可以是：

```text
/interactive-learning/control-workbench
```

旧入口重定向或渲染：

```text
/interactive-learning/control-workbench?preset=classic-four-view
```

当前的四联图和侧栏逻辑保留为：

```text
ClassicSerialCorrectionPreset
```

## 2. 当前 workspace-routing 逐步统一

现在 `getArenaWorkspaceHref` 会按 `workspaceMode` 路由到不同页面。

下一步可以改为：

```ts
return withArenaTask('/interactive-learning/control-workbench', task.id, {
  preset: task.workspaceMode,
  ...params,
});
```

也就是说：

```text
multi-representation-linkage -> control-workbench?preset=classic-four-view
black-box-identification -> control-workbench?preset=blackbox-identification
block-diagram-workbench -> control-workbench?preset=composite-control
predictive-control -> control-workbench?preset=mpc
control-odyssey -> 暂时保留专用页面，后续嵌入为视图插件
```

Control Odyssey 可以最后迁移，因为它包含游戏化机制，不应过早塞进统一工作台。

## 3. 当前服务继续复用

统一工作台仍然调用：

```text
/api/arena/evaluate
/api/arena/blackbox-experiments
/api/arena/virtual-simulation-runs
```

当前 `/api/arena/evaluate` 已经能接收 `publicationId` 并解析学生发布上下文。 黑箱预演也已有 API，并且会校验黑箱数据集归属。 这些都不需要重写。

---

# 七、统一工作台的推荐布局预设

建议先不要给学生完全自由拖拽布局。第一阶段采用“预设 + 局部配置”更稳。

## 1. ClassicFourViewPreset

适用于：

```text
串联校正
PID
典型白箱 SISO LTI
作业白箱模型
```

布局：

```text
时域响应 | Bode
根轨迹   | Nyquist
```

默认视图配置：

```text
时域：原系统、校正后、给定
Bode：原系统、校正后、串联控制器、裕度
根轨迹：校正后
Nyquist：校正前 + 校正后
```

## 2. CompositeControlPreset

适用于：

```text
复合校正
前馈 + 反馈
扰动补偿
局部反馈
```

布局：

```text
时域响应        | 控制量
扰动/误差       | 结构摘要 / 指标面板
```

默认视图配置：

```text
时域：给定、输出、误差
控制量：总控制量、前馈分量、反馈分量、限幅线
扰动：扰动输入、扰动补偿分量
指标：IAE、ITAE、控制能量、约束违反
```

## 3. BlackBoxIdentificationPreset

适用于：

```text
黑箱对象
虚拟仿真对象
辨识 + 控制
```

布局：

```text
实验数据        | 辨识模型
黑箱/名义响应对比 | 控制器设计 / 提交
```

默认视图配置：

```text
实验数据：输入、输出
辨识模型：参数表、拟合误差
响应对比：黑箱响应、名义模型响应
控制器：PID/串联/黑箱控制器参数
```

## 4. PredictiveControlPreset

适用于：

```text
MPC
约束控制
优化控制
```

布局：

```text
时域轨迹      | 控制量与约束
预测窗口      | 目标函数 / 约束违反
```

默认视图配置：

```text
时域：参考、输出、预测输出
控制量：u(t)、Δu(t)、上下限
预测窗口：预测轨迹
指标：目标函数、约束违反次数、计算时间
```

---

# 八、挑战模式与自由探索模式的区别

这个必须清晰，否则统一工作台会变乱。

## 挑战模式

由 Arena task 决定：

```text
对象是否锁定
允许控制方法
允许视图
默认布局
实验预算
是否允许自动辨识
是否允许保存名义模型
是否允许官方提交
评测协议
榜单规则
```

学生可以调控制器，但不能随便改官方对象。

## 自由探索模式

学生可以：

```text
选择对象
编辑模型
选择视图
配置布局
运行辨识
保存名义模型
保存控制器方案
```

但不能直接进入榜单。若要提交，必须绑定到某个 Arena challenge，并通过兼容性检查。

建议显示：

```text
当前为自由探索模式，结果不会进入竞技场榜单。
```

---

# 九、统一工作台的核心数据流

建议所有模式都走同一条数据流：

```text
WorkbenchContext
    ↓
PlantTarget / WorkingModel
    ↓
ControllerDraft
    ↓
SimulationRequest / AnalysisRequest
    ↓
ViewDataStore
    ↓
PreviewMetrics
    ↓
ControllerArtifact
    ↓
Official Evaluation
    ↓
ArenaSubmission
```

其中：

```text
ControllerDraft：工作台中的当前设计状态
ControllerArtifact：可保存、可复现、可提交的正式工件
```

不要把 UI state 直接提交给 Arena。

当前项目已经有 `ControllerArtifact`、`ArenaSubmission`、`ArenaEvaluationRun` 这条链路，不应重造。官方评测入口继续使用 `/api/arena/evaluate`。

---

# 十、需要新增的几个抽象

## 1. WorkbenchViewConfig

```ts
interface WorkbenchViewConfig {
  viewId: string;
  enabled: boolean;
  position: { row: number; col: number; rowSpan?: number; colSpan?: number };
  options: Record<string, unknown>;
}
```

## 2. WorkbenchLayoutPreset

```ts
interface WorkbenchLayoutPreset {
  id: string;
  label: string;
  viewConfigs: WorkbenchViewConfig[];
  methodPanel: string;
  defaultControllerKind?: ControllerMethod;
}
```

## 3. WorkbenchSignal

```ts
interface WorkbenchSignal {
  id: string;
  label: string;
  kind:
    | 'reference'
    | 'plant-output'
    | 'corrected-output'
    | 'nominal-output'
    | 'blackbox-output'
    | 'error'
    | 'control'
    | 'disturbance'
    | 'feedforward-control'
    | 'feedback-control';
  data: Array<{ t: number; value: number }>;
  source: 'official-target' | 'working-model' | 'controller' | 'preview' | 'experiment';
}
```

## 4. NominalModelArtifact

```ts
interface NominalModelArtifact {
  id: string;
  ownerId: string;
  sourceObjectId?: string;
  sourceDatasetHash?: string;
  modelType: 'transfer-function' | 'state-space' | 'discrete-transfer-function';
  representation: object;
  validationMetrics?: Record<string, number>;
  createdAt: string;
}
```

这个对黑箱任务很关键。学生需要把辨识模型作为“工作模型”导入工作台，但不能把它当官方对象。

---

# 十一、面向编程代理的开发计划

建议新建分支：

```text
codex/unified-control-workbench
```

建议 OpenSpec change：

```text
unified-control-workbench
```

---

## 阶段 1：建立统一工作台外壳

### 目标

新增统一工作台路由，但不破坏现有多表征工作台。

### 新增文件

```text
src/app/interactive-learning/control-workbench/page.tsx
src/features/control-workbench/shell.tsx
src/features/control-workbench/types.ts
src/features/control-workbench/context/resolve-workbench-session.ts
src/features/control-workbench/layout/layout-presets.ts
```

### 任务

1. 新增 `/interactive-learning/control-workbench`。
2. 支持 URL 参数：

```text
arenaTask
publicationId
preset
mode=explore | challenge
```

3. 在 `resolveWorkbenchSession` 中复用 Arena 的：

```text
resolveArenaWorkbenchContext
getArenaChallengeObject
getArenaWorkspaceHref
```

4. 没有 `arenaTask` 时进入自由探索模式。
5. 有 `arenaTask` 时进入挑战模式，并锁定 challenge context。

### 交付标准

```text
1. /interactive-learning/control-workbench 可打开；
2. /interactive-learning/control-workbench?arenaTask=task-second-order-lead-pid 可加载挑战上下文；
3. 无效 arenaTask 不回退默认模型；
4. 自由探索模式显示“未绑定竞技场任务”；
5. 不影响现有 /interactive-learning/multi-representation-linkage。
```

---

## 阶段 2：把现有多表征四联图迁入统一工作台

### 目标

保留当前串联校正体验，但放进统一工作台外壳。

### 任务

1. 从现有 `multi-representation-linkage` 中拆出可复用组件：

```text
ClassicFourViewPanel
SerialCorrectionSidePanel
ClassicLinkageModelHook
```

2. 在统一工作台中建立 `ClassicFourViewPreset`。
3. 支持视图配置：

```text
TimeDomainView
BodeView
RootLocusView
NyquistView
```

4. 当前多表征旧路由可继续存在，但内部可以调用统一工作台 preset。

### 交付标准

```text
1. task-second-order-lead-pid 在新工作台中显示四联图；
2. PID / lead / lag 参数行为和旧工作台一致；
3. 官方提交结果一致；
4. 旧路由无回归。
```

---

## 阶段 3：实现视图配置系统

### 目标

让每个视图有自己的配置菜单，而不是固定显示内容。

### 新增文件

```text
src/features/control-workbench/views/view-registry.ts
src/features/control-workbench/views/time-domain-view.tsx
src/features/control-workbench/views/bode-view.tsx
src/features/control-workbench/views/root-locus-view.tsx
src/features/control-workbench/views/nyquist-view.tsx
src/features/control-workbench/views/view-config-menu.tsx
```

### 任务

1. `TimeDomainView` 支持勾选：

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
```

2. `BodeView` 支持勾选：

```text
原系统
校正后
串联控制器
名义模型
裕度
```

3. `RootLocusView` 支持单选：

```text
校正前
校正后
名义模型
```

4. `NyquistView` 支持叠加：

```text
校正前
校正后
```

5. 不支持的配置项灰掉并说明原因。

### 交付标准

```text
1. 串联校正任务默认视图配置正确；
2. 学生可以打开每个视图的配置菜单；
3. 不支持的信号不会显示假数据；
4. 配置状态可以保存在本地 session。
```

---

## 阶段 4：实现复合校正预设

### 目标

复合校正不再进入独立页面，而是进入统一工作台的 `CompositeControlPreset`。

### 新增文件

```text
src/features/control-workbench/methods/composite-control-panel.tsx
src/features/control-workbench/presets/composite-control-preset.ts
```

### 任务

1. 支持参数：

```text
prefilterGain
forwardGain
localFeedbackGain
disturbanceCompensation
```

2. 生成 `composite-compensation` ControllerArtifact。
3. 视图默认显示：

```text
时域响应
控制量
误差
扰动补偿分量
指标面板
```

4. 官方评测继续走 `template-whitebox-v1`，但 UI 明确说明当前是参数化模板评测。

### 交付标准

```text
1. block-diagram-workbench 类型任务进入统一工作台；
2. 可编辑复合校正参数；
3. 可生成 ControllerArtifact；
4. 可提交 /api/arena/evaluate；
5. 不再依赖 lesson-05 作为工作台入口。
```

---

## 阶段 5：实现黑箱辨识视图

### 目标

让黑箱任务在统一工作台中完成实验、辨识、名义模型导入和控制设计。

### 新增文件

```text
src/features/control-workbench/views/identification-view.tsx
src/features/control-workbench/models/nominal-model-manager.ts
src/features/control-workbench/presets/blackbox-identification-preset.ts
```

### 任务

1. IdentificationView 调用：

```text
/api/arena/blackbox-experiments
```

而不是直接本地生成数据。

2. 显示：

```text
实验预算
datasetHash
输入输出数据
dataQuality
```

3. 自由探索模式允许最小二乘辨识。
4. 挑战模式根据 task policy 决定是否允许自动辨识；默认可以先只允许手动填写：

```text
二阶模型参数
阻尼
固有频率
增益
```

5. 保存 `NominalModelArtifact`。
6. 将名义模型导入工作空间。
7. 时域视图支持叠加：

```text
黑箱实验响应
名义模型响应
控制后预演响应
```

### 交付标准

```text
1. 黑箱挑战能在统一工作台内运行实验；
2. 数据集落库且受预算限制；
3. 可创建名义模型；
4. 名义模型可用于后续 PID / 串联控制设计；
5. 黑箱官方提交仍校验 datasetHash 归属。
```

---

## 阶段 6：统一工作台官方提交面板

### 目标

所有模式都通过一个提交面板提交 `ControllerArtifact`。

### 新增文件

```text
src/features/control-workbench/submission/unified-submission-panel.tsx
src/features/control-workbench/submission/build-controller-artifact.ts
```

### 任务

1. 支持方法：

```text
pid
serial-compensator
composite-compensation
mpc
black-box-control
```

2. 按任务 allowedMethods 限制。
3. 按 challenge mode 控制是否可提交。
4. 提交时携带：

```text
taskId
publicationId
artifact
```

5. 显示：

```text
官方分数
硬约束
分项指标
协议版本
是否复用缓存
```

### 交付标准

```text
1. 所有工作台模式共用同一提交面板；
2. 自由探索模式不可官方提交；
3. challenge mode 正常提交；
4. publicationId 能透传到 /api/arena/evaluate；
5. 提交结果与 ArenaSubmission 一致。
```

---

## 阶段 7：统一路由迁移

### 目标

Arena 任务默认都进入统一工作台。

### 修改文件

```text
src/features/arena/workspace-routing.ts
```

### 任务

把当前分流逻辑逐步替换为：

```ts
return withArenaTask('/interactive-learning/control-workbench', task.id, {
  preset: task.workspaceMode,
  ...params,
});
```

Control Odyssey 可暂时保留原路由：

```text
control-odyssey 暂缓迁移
```

原因是 Odyssey 有游戏化积分和关卡机制，应该后迁移。

### 交付标准

```text
1. 白箱任务进入统一工作台；
2. 复合任务进入统一工作台；
3. 黑箱任务进入统一工作台；
4. MPC 任务进入统一工作台；
5. Control Odyssey 暂保持现状；
6. 挑战详情页文案改为“进入控制工作台”。
```

---

# 十二、我对你方案的判断

我支持“统一工作台”这个产品方向，但要加一个限定：

**统一的是入口、上下文、视图管理、控制器工件和提交体验；不统一的是底层模型、数值引擎和评测协议。**

这句话很关键。

否则会走向两个错误：

```text
错误 1：为每个任务做一个工作台，学生体验割裂。
错误 2：把所有功能写进一个巨型工作台，工程不可维护。
```

正确路线是：

```text
一个工作台外壳
多个视图插件
多个控制方法插件
多个对象适配器
一个官方提交协议
一个 Arena 评测与榜单系统
```

这样既符合你的体验目标，也不破坏我们已经建立起来的 Arena 长期基础设施。

我建议下一阶段就不要再优先做“黑箱官方评测”或“教师报告”这种后端功能了，而是先做 **统一控制工作台外壳 + 经典四联图迁移 + 视图配置系统**。因为工作台体验一旦统一，后续黑箱、复合、MPC、教师发布、自由探索都会有一个稳定承载面。
