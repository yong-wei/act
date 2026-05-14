以下计划面向编程代理执行，基准分支固定为：

```text
repo: yong-wei/act
branch: codex/arena-v2
context entry: docs/memory/CHATGPT_CONTEXT.md
```

当前分支已经把 `docs/memory` 设为正式项目记忆根目录，`CHATGPT_CONTEXT.md` 要求先读项目上下文入口、再读 `00-index.md`、`02-recent-summary.md`、`01-reading-map.md`，并按任务读取最小必要主题文件。 `docs/memory/README.md` 也明确 `CHATGPT_CONTEXT.md` 是给 ChatGPT/GitHub 连接器使用的入口，不能替代事实文件本身。

当前 Arena 已经不是空白模块。项目说明中已经把 Arena 定义为统一评测与排行榜层，包含对象任务种子、控制器工件、官方评测、提交记录、黑箱实验和虚拟仿真预演等结构。 代码上，`src/features/arena/index.ts` 已经导出 types、seed-challenges、evaluation、leaderboards、submission、telemetry、teacher configuration 和 workspace-routing 等模块。 现有 `ChallengeObject`、`ChallengeTask`、`MetricProfile`、`LeaderboardPolicy`、`ControllerArtifact` 等基础类型已经存在，但还偏轻量，尚不足以承载完整工作台上下文和长期扩展。

当前最关键的技术判断是：Arena 已有大厅、详情页、提交、缓存和黑箱实验骨架，但多表征工作台尚未真正消费 Arena 挑战上下文；白箱官方评测也仍主要是启发式估算，而不是复用现有 Rust/WASM 控制分析链。多表征入口目前只解析课程模式、角色、嵌入状态和邮轮控制器参数。 多表征模型内部则从邮轮控制器或默认模型生成 `openLoopSeed`，再构造分析请求。 竞技场路由目前只是把 `arenaTask` 拼进工作台 URL。

---

# 一、总目标

最终目标是把 Arena 从“已有页面与提交雏形”推进为本项目的控制设计统一评测基础设施，做到：

1. 从 `/arena` 选择挑战任务后，进入对应工作台时必须带入完整挑战上下文，而不是回退默认模型。
2. 多表征联动工作台能够消费 Arena 白箱 SISO LTI 任务上下文，显示对象、任务目标、允许方法、评价准则和当前预评测指标。
3. 工作台保存和提交的不是临时表单参数，而是标准化 `ControllerArtifact`。
4. 官方评测由服务端统一执行，复用现有控制分析类型和数值能力，不信任客户端自报指标。
5. 榜单、作业、奥德赛、虚拟仿真、黑箱辨识和学习数据治理都围绕 Arena 统一接口扩展。
6. 体系保持功能分离，不新增臃肿巨型服务；每个服务只承担一个稳定职责。

---

# 二、执行原则

编程代理必须遵守以下原则。

第一，先复用，后扩展。现有 Arena 已有 `types.ts`、`seed-challenges.ts`、`workspace-routing.ts`、`evaluation`、`submissions`、`blackbox`、`telemetry`、`prisma-store` 等模块，不允许另起一套并行的 `challenge`、`competition` 或 `score` 体系。现有对象和任务种子已经覆盖典型对象、作业对象、奥德赛对象、虚拟仿真白箱对象和黑箱对象。

第二，官方评测必须服务端执行。当前 `/api/arena/evaluate` 已经限制登录学生提交，并调用 `createPersistedArenaSubmission`。 后续必须扩展这条链路，不允许在前端直接写入排行榜。

第三，工作台预评测和官方评测要区分。多表征工作台里的曲线和指标是预评测；正式排名只来自 `/api/arena/evaluate` 生成的 `ArenaSubmission`。

第四，短期可以保留静态种子，长期要为数据库配置预留接口。第一阶段不要为了对象库和教师配置台立即大改 Prisma；先把 `seed-challenges` 背后的访问接口、能力矩阵和上下文结构稳定下来。

第五，不要把所有功能塞进多表征工作台。多表征联动只承担白箱 SISO LTI 串联校正、PID 与相关可视化；复合框图、黑箱辨识、MPC、虚拟仿真应通过统一 `ArenaWorkbenchContext` 分发到不同工作台模式。

第六，埋点只记录高价值事件。现有 Arena telemetry 已定义核心事件类型，包括打开挑战、进入工作台、运行仿真、保存控制器、提交、评测完成、查看榜单等。 不要把滑块每次移动都直接打到服务器。

---

# 三、阶段 0：基线核验与工作分支准备

## 目标

确认当前分支、现有代码、数据库模型、API 和测试状态，形成后续改造的真实基线。

## 代理执行步骤

1. 切换并确认分支：

```bash
git checkout codex/arena-v2
git status
```

2. 读取项目上下文：

```text
docs/memory/CHATGPT_CONTEXT.md
docs/memory/00-index.md
docs/memory/02-recent-summary.md
docs/memory/01-reading-map.md
docs/ProjectDescription.md
docs/arena.md
AGENTS.md
```

3. 读取 Arena 当前实现：

```text
src/features/arena/index.ts
src/features/arena/types.ts
src/features/arena/data/seed-challenges.ts
src/features/arena/arena-hall.tsx
src/features/arena/challenge-detail.tsx
src/features/arena/workspace-routing.ts
src/features/arena/evaluation/*
src/features/arena/submissions/*
src/features/arena/blackbox/*
src/features/arena/leaderboards/*
src/features/arena/telemetry.ts
src/app/arena/**
src/app/api/arena/**
```

4. 读取多表征工作台当前实现：

```text
src/app/interactive-learning/multi-representation-linkage/page.tsx
src/features/interactive/multi-representation-linkage/model.ts
src/features/interactive/multi-representation-linkage/page-client.tsx
src/resources/control-system/analysis/multi-representation-linkage-analysis.ts
src/resources/control-system/analysis/types.ts
src/resources/control-system/analysis/use-control-engine.ts
src/resources/control-system/analysis/control-analysis.worker.ts
```

5. 读取 Prisma 中 Arena 相关模型，确认是否已有：

```text
ArenaControllerArtifact
ArenaEvaluationRun
ArenaSubmission
ArenaBlackBoxExperiment
ArenaVirtualSimulationRun
```

6. 执行基础检查：

```bash
npm run lint
npm run test
npm run build
```

如果 build 当前有既有失败，必须记录失败点、是否与 Arena 无关、是否阻塞后续阶段。

## 交付标准

阶段 0 完成后，代理必须提交一份内部执行记录，至少包含：

```text
1. 当前分支、commit hash、工作区是否干净；
2. 当前 Arena 已有模块清单；
3. 当前多表征工作台与 Arena 的连接状态；
4. 当前 Prisma Arena 模型状态；
5. 当前 lint/test/build 状态；
6. 已发现的阻塞风险；
7. 下一阶段拟改动文件清单。
```

不允许在未完成阶段 0 的情况下开始大规模改代码。

---

# 四、阶段 1：稳定 Arena 领域模型与上下文抽象

## 目标

在现有 `src/features/arena/types.ts` 基础上扩展，而不是重写，建立后续所有模块共用的 Arena 上下文结构。

当前 `types.ts` 已有来源、公开程度、控制方法、榜单类型、工作台模式、对象、任务、指标、榜单政策和控制器工件等定义。 这一阶段要把这些轻量类型升级为足以支撑工作台、评测、黑箱和教师配置的结构。

## 建议新增或扩展的类型

在 `src/features/arena/types.ts` 或拆分到 `src/features/arena/domain/types.ts` 中新增，但要继续从 `src/features/arena/index.ts` 导出。

建议增加：

```ts
export type ArenaEntryMode =
  | 'challenge'
  | 'free-explore'
  | 'assignment'
  | 'odyssey'
  | 'virtual-sim';

export interface ArenaModelCapability {
  isLTI: boolean;
  isSISO: boolean;
  isMIMO: boolean;
  isNonlinear: boolean;
  hasTransferFunction: boolean;
  hasStateSpace: boolean;
  supportsStepResponse: boolean;
  supportsRootLocus: boolean;
  supportsBode: boolean;
  supportsNyquist: boolean;
  supportsSerialCorrection: boolean;
  supportsPID: boolean;
  supportsCompositeControl: boolean;
  supportsIdentification: boolean;
  supportsMPC: boolean;
  supportsVirtualSimulationEvaluation: boolean;
}

export interface ArenaWorkbenchModel {
  objectId: string;
  modelId: string;
  modelVersion: string;
  name: string;
  visibility: ModelVisibility;
  source: ChallengeObjectSource;
  adapterType?: ChallengeObjectAdapterType;
  transferFunction?: TransferFunctionModel;
  workbenchSeed?: {
    poles: Array<{ re: number; im: number }>;
    zeros: Array<{ re: number; im: number }>;
    gain: number;
  };
  timeRange?: { start: number; end: number; samples: number };
  frequencyRange?: { min: number; max: number; samples: number };
  capability: ArenaModelCapability;
}

export interface ArenaWorkbenchContext {
  entryMode: ArenaEntryMode;
  locked: boolean;
  task: ChallengeTask;
  object: ChallengeObject;
  model: ArenaWorkbenchModel;
  metricProfile: MetricProfile;
  leaderboardPolicy: LeaderboardPolicy;
  allowedMethods: ControllerMethod[];
  recommendedWorkspaceMode: WorkspaceMode;
  returnHref: string;
}
```

## 代理执行步骤

1. 扩展 `ChallengeObject`，不要删除原有字段。
2. 给现有 `ARENA_CHALLENGE_OBJECTS` 补充能力矩阵或通过工具函数推导能力。
3. 给支持多表征工作台的对象补充 `workbenchSeed`。短期允许显式写 poles/zeros/gain，避免在 UI 层临时实现不稳定多项式求根。
4. 新增选择器函数：

```ts
getArenaWorkbenchContext(taskId: string): ArenaWorkbenchContext | null
getArenaModelCapability(object: ChallengeObject): ArenaModelCapability
isArenaTaskCompatibleWithWorkspace(task, object, workspaceMode): boolean
```

5. 新增单元测试覆盖：

   * 每个 task 都能找到 object、metricProfile、leaderboardPolicy；
   * 每个 multi-representation task 的 object 必须有白箱传递函数和 workbenchSeed；
   * black-box task 不允许生成传递函数工作台上下文；
   * 每个 task 的 allowedMethods 与 workspaceMode 不冲突。

## 交付标准

阶段 1 完成后必须满足：

```text
1. 所有现有 ARENA_CHALLENGE_TASKS 均通过完整性校验；
2. multi-representation-linkage 类型任务均能生成 ArenaWorkbenchContext；
3. 黑箱任务不会误判为多表征可用；
4. src/features/arena/index.ts 继续统一导出领域类型和选择器；
5. 新增测试通过。
```

---

# 五、阶段 2：评测协议服务化，替换白箱启发式估算

## 目标

把 Arena 官方评测从启发式指标估算升级为复用现有控制分析请求和 Rust/WASM 数值链。当前 `whitebox-evaluator.ts` 已经能校验 PID、串联校正、复合校正、优化 PID、MPC 等固定模板，但它内部用 `estimateMetrics` 估算调节时间、超调、稳态误差、控制能量等，不是实际仿真结果。

这一阶段要建立“官方评测协议服务”，但不要求一次性完成所有高级方法。第一目标是白箱 PID 和串联校正的真实评测。

## 服务拆分要求

不要做一个 `arenaService.ts` 巨型文件。建议拆分：

```text
src/features/arena/evaluation/protocol.ts
src/features/arena/evaluation/control-analysis-adapter.ts
src/features/arena/evaluation/metric-extraction.ts
src/features/arena/evaluation/whitebox-evaluator.ts
src/features/arena/evaluation/blackbox-evaluator.ts
```

职责如下：

```text
protocol.ts
  管理 protocolVersion、任务评测类型、评测入口分发。

control-analysis-adapter.ts
  将 ChallengeObject + ControllerArtifact 转为 ControlAnalysisRequest。

metric-extraction.ts
  从 ControlAnalysisResult 提取 Arena metrics。

whitebox-evaluator.ts
  只负责白箱任务硬约束、指标满意度、分数解释。

blackbox-evaluator.ts
  只负责黑箱任务官方评测或占位边界，不混入白箱逻辑。
```

## 代理执行步骤

1. 保留现有 `evaluateArenaSubmission` 入口，不新增平行入口。
2. 新增 `buildArenaControlAnalysisRequest(task, object, artifact)`。
3. 复用现有控制分析类型 `ControlAnalysisRequest`。该类型已经包含 plant、structures、outputs、timeRange、frequencyRange、rootLocus、delay、discreteConfig、stateSpaceSpec、referenceProfile、disturbanceProfile 等字段。
4. 复用 `buildPidCorrection` 和 `buildFrequencyTurnCorrection`，不要重新造 PID/lead/lag 结构转换。多表征分析适配器已经提供这些结构构造函数。
5. 建立服务端控制分析适配器：

   * 优先复用现有 WASM `compute_analysis`；
   * 如果服务端直接加载 WASM 存在 Next.js bundling 问题，先建立可测试 adapter interface，并保留浏览器 worker 和服务端 evaluator 的边界；
   * 不允许把浏览器 worker 直接搬到 API route 中。
6. 指标提取至少覆盖：

   * `closed_loop_stable`
   * `overshoot`
   * `settlingTime`
   * `steadyStateError`
   * `itae`
   * `phaseMargin`
   * `gainMargin`
   * `bandwidth`
   * `controlEnergy` 的第一版近似可保留，但必须标注为 `derivedMetric`，不能伪装成仿真直接输出。
7. 保留现有 `normalizeMetricValue` 和 `scoreMetricSatisfaction`。它们已经实现满意度归一化和加权几何平均，方向是正确的。

## 交付标准

阶段 2 完成后必须满足：

```text
1. 白箱 PID 与串联校正提交的 step metrics 来自 ControlAnalysisResult，而不是 estimateMetrics；
2. evaluateArenaSubmission 仍是唯一官方评测入口；
3. getArenaEvaluationProtocolVersion 升级，例如 whitebox-v2；
4. protocolVersion 改变后，旧缓存不会被误用；
5. 单元测试覆盖至少 3 个任务：
   - task-second-order-lead-pid
   - task-homework-margin-correction
   - task-unstable-first-order-stabilization
6. 无效控制器、非允许方法、非白箱对象、黑箱对象误提交均返回明确错误；
7. /api/arena/evaluate 仍通过 createPersistedArenaSubmission 写入，而不是直接在 route 中写数据库。
```

---

# 六、阶段 3：多表征工作台接入 ArenaWorkbenchContext

## 目标

从 `/arena/challenges/[taskId]` 进入 `/interactive-learning/multi-representation-linkage?arenaTask=...` 后，工作台必须加载对应对象、模型、评价准则和允许方法；不能再使用默认邮轮模型。

当前 workspace routing 已经把 `arenaTask` 拼进 URL。 但多表征 route 当前没有解析 `arenaTask`，只解析 courseMode、role、embed、controlMode、kp、ki、kd。

## 代理执行步骤

1. 扩展 `MultiRepresentationInitialParams`：

```ts
export interface MultiRepresentationInitialParams {
  courseMode?: boolean;
  role?: 'teacher' | 'student';
  embed?: boolean;
  controlMode?: CruiseControllerMode;
  controller?: Partial<CruiseControllerParams>;

  arenaTaskId?: string;
  arenaContext?: ArenaWorkbenchContext;
}
```

2. 修改：

```text
src/app/interactive-learning/multi-representation-linkage/page.tsx
```

解析：

```text
arenaTask
```

并调用 `getArenaWorkbenchContext(arenaTask)`。

3. 规则必须明确：

```text
存在 arenaTask 且 context 加载成功 -> challenge mode
存在 arenaTask 但 context 加载失败 -> 显示错误页，不回退默认模型
不存在 arenaTask -> 保留原自由探索/课程模式逻辑
```

4. 修改 `useMultiRepresentationLinkageModel(initialParams)`：

   * 如果 `initialParams.arenaContext` 存在，使用 `arenaContext.model.workbenchSeed` 初始化 poles、zeros、gain；
   * 使用 `arenaContext.model.timeRange` 和 `frequencyRange`；
   * challenge mode 下 `isCourseMode = false`，但 `locked = true`；
   * challenge mode 下禁止添加/删除 open-loop poles/zeros，除非任务允许“模型探索”。
5. 顶部 UI 增加 Arena 上下文栏：

   * 当前任务；
   * 被控对象；
   * 来源；
   * 模型公开程度；
   * 允许方法；
   * 评价指标；
   * 当前是否可提交。
6. 顶部性能指标栏读取 `MetricProfile`，把 `adaptedAnalysis` 中的当前指标映射到任务评价指标。
7. 工作台预评测明确标记：

```text
工作台预评测，不等同于官方榜单成绩
```

## 交付标准

阶段 3 完成后必须满足：

```text
1. 从 task-second-order-lead-pid 进入多表征工作台，显示二阶欠阻尼对象 G(s)=16/(s^2+2.4s+16)；
2. 不再显示默认邮轮模型；
3. 顶部显示任务名、模型、评价准则；
4. challenge mode 下模型锁定，不能随意切换为其他对象；
5. 没有 arenaTask 时原多表征自由探索和邮轮课程模式不回归；
6. 新增测试覆盖 parseInitialParams 和 Arena context 加载；
7. 浏览器手测至少覆盖：
   - /arena -> 挑战详情 -> 进入工作台；
   - 多表征自由入口；
   - 邮轮课程嵌入入口。
```

---

# 七、阶段 4：控制器工件从工作台生成、保存、提交

## 目标

让工作台产出的不是临时 UI 参数，而是标准化 `ControllerArtifact`，并能调用现有 `/api/arena/evaluate` 进入官方评测。当前 `ControllerArtifact` 类型已经存在，`controller-artifact-builder.ts` 也支持从表单参数构建 PID、串联校正、优化 PID、复合补偿和 MPC 工件。

## 代理执行步骤

1. 新增：

```text
src/features/arena/workbench/artifact-mappers.ts
```

职责：

```ts
buildArenaArtifactFromMultiRepresentationState(context, modelState): ControllerArtifact
buildPreviewMetricsFromControlAnalysis(context, adaptedAnalysis): PreviewMetricSnapshot
```

2. 不要让多表征工作台直接拼 artifact JSON。它应调用 mapper。
3. 对不同校正模式映射：

   * PID/PI/PD → `method: 'pid'`，params 包含 `kp/ki/kd`；
   * lead/lag/lead_lag → 第一阶段映射为 `serial-compensator`，params 包含 `gain/zero/pole`；
   * lead_lag 如当前官方 artifact 不支持完整结构，必须先显示“可预评测，暂不可官方提交”，不能伪造成单一 lead。
4. 在多表征工作台 challenge mode 增加三个动作：

   * 保存方案；
   * 官方预提交检查；
   * 提交官方评测。
5. 提交调用现有：

```text
POST /api/arena/evaluate
```

该 API 当前已经检查登录和学生角色，并调用持久化提交链路。

6. 提交成功后显示：

   * score；
   * valid；
   * metrics；
   * hardConstraintResults；
   * explanation；
   * reusedEvaluation。
7. 保存方案第一阶段可以先保存在客户端 local state；正式保存到数据库可在后续阶段加入 `ArenaControllerArtifact` 持久化 API。

## 交付标准

阶段 4 完成后必须满足：

```text
1. 多表征工作台可从当前 PID 参数生成 ControllerArtifact；
2. 多表征工作台可从当前超前/滞后参数生成可提交或明确不可提交的 Artifact；
3. 点击提交后调用 /api/arena/evaluate；
4. 返回结果进入 ArenaSubmission；
5. challenge detail 页刷新后能看到提交摘要；
6. 非 allowedMethods 不可提交；
7. 表单错误、硬约束失败、官方评测失败均有明确 UI 提示。
```

---

# 八、阶段 5：基础模型选择面板与工作台能力矩阵

## 目标

在多表征工作台顶部增加基础模型选择面板，但区分 challenge mode 和 free explore mode。

## 代理执行步骤

1. 新增 `ArenaModelSelectorPanel`：

```text
src/features/arena/workbench/arena-model-selector-panel.tsx
```

2. 模型列表来自：

```text
ARENA_CHALLENGE_OBJECTS
```

不要新造一份模型清单。

3. 分组方式：

   * 典型对象；
   * 作业对象；
   * 控制奥德赛；
   * 虚拟仿真对象；
   * 前沿拓展对象。
4. 每个模型显示：

   * 对象名；
   * 来源；
   * 公开程度；
   * 模型类型；
   * 支持工作台；
   * 支持方法；
   * 是否有 Arena 任务。
5. challenge mode：

   * 只显示当前挑战模型；
   * 面板可展开查看详情；
   * 不允许直接切换模型；
   * 提供“脱离挑战，进入自由探索”的明确动作。
6. free explore mode：

   * 允许切换兼容模型；
   * 不兼容模型不可选，但显示推荐工作台；
   * 选择模型后工作台进入未绑定任务状态，不能直接提交到原挑战。
7. 不支持的面板不能静默消失。要显示原因：

   * 非白箱：不能显示根轨迹/Bode；
   * 非 SISO LTI：多表征串联面板不支持；
   * 黑箱：需进入辨识工作台；
   * MPC：需进入预测控制工作台。

## 交付标准

阶段 5 完成后必须满足：

```text
1. challenge mode 下模型锁定；
2. free explore mode 下可从 Arena 对象清单选择兼容白箱模型；
3. 不兼容对象显示原因和推荐工作台；
4. 切换模型不会污染 challenge submission；
5. 至少覆盖 4 类对象：
   - typical white-box transfer-function
   - homework white-box
   - virtual-simulation white-box
   - virtual-simulation black-box
6. 新增能力矩阵测试。
```

---

# 九、阶段 6：榜单与提交记录规范化

## 目标

把当前提交和榜单从“可用”升级为“可解释、可筛选、可长期维护”。

当前持久化链路已经有 `ArenaEvaluationRun` 缓存、`ArenaControllerArtifact` upsert 和 `ArenaSubmission` 写入逻辑。 Prisma store 已经按 `taskId + artifactHash + protocolVersion` 查找评测缓存，并在 `listSubmissions` 中过滤当前协议版本。 这一阶段应扩展而不是替换。

## 代理执行步骤

1. 检查并补齐 leaderboards 模块：

   * 主榜；
   * 方法榜；
   * 指标榜；
   * Pareto 榜；
   * 班级榜；
   * 赛季榜。
2. 新增或完善排行榜查询服务：

```text
src/features/arena/leaderboards/leaderboard-service.ts
```

职责：

* 只读 submissions；
* 不做评测；
* 不写数据库；
* 返回 leaderboard view model。

3. 主榜规则：

   * 只纳入 `evaluation.valid === true`；
   * 同一学生同一任务只取最高分；
   * 同分按 `LeaderboardPolicy.tieBreakers`。
4. 方法榜：

   * 按 artifact.method 分组。
5. 指标榜：

   * 对每个 primaryMetric 生成单指标排名；
   * 指标方向来自 `MetricDefinition.direction`。
6. Pareto 榜：

   * 针对 task.primaryMetrics 计算非支配集合；
   * 标出每个方案是否被支配。
7. 班级榜：

   * 利用 `ArenaSubmission.classId`；
   * 如果尚未从课堂或作业入口传入 classId，先保留接口和空状态。
8. 赛季榜：

   * 利用 `seasonId`；
   * 无 seasonId 时归入默认赛季或不显示赛季榜。

## 交付标准

阶段 6 完成后必须满足：

```text
1. challenge detail 能展示真实榜单摘要；
2. 榜单页面或面板可切换主榜、方法榜、指标榜；
3. Pareto 任务能显示非支配解集合；
4. 无提交、无有效提交、全部无效提交都有合理空态；
5. 同一用户重复提交时榜单去重逻辑正确；
6. artifactHash + protocolVersion 缓存复用逻辑不破坏；
7. 单元测试覆盖 leaderboard tie-breaker、method leaderboard、metric leaderboard、pareto。
```

---

# 十、阶段 7：黑箱实验与虚拟仿真工作台整合

## 目标

把现有黑箱实验雏形升级为可用于“虚拟仿真对象 -> 实验数据 -> 辨识模型 -> 控制器工件 -> 官方评测”的链路。

当前黑箱实验已经有服务、预算、所有权校验和数据集 hash；每日预算常量为 `20`，并通过 Prisma transaction 控制预算。 实验数据当前由 `runArenaBlackBoxExperiment` 生成，支持 step、impulse、prbs、sine 信号，限制采样数并生成 datasetHash。 `/api/arena/blackbox-experiments` 已限制学生角色调用并写入实验。

## 代理执行步骤

1. 抽象黑箱对象适配器：

```text
src/features/arena/adapters/plant-adapter.ts
```

建议接口：

```ts
interface ArenaPlantAdapter {
  canRunPublicExperiment(task, object): boolean;
  runPublicExperiment(input): Promise<ArenaBlackBoxExperimentDataset>;
  canRunOfficialEvaluation(task, object): boolean;
  runOfficialEvaluation(artifact): Promise<ArenaEvaluationResult>;
}
```

2. 将当前 `runArenaBlackBoxExperiment` 作为 `cruise-roll-blackbox` 的 public experiment adapter 实现，不要直接散落在 API route。
3. 在 `/simulations/cruise?mode=black-box-identification&arenaTask=...` 中读取 Arena context。
4. 增加黑箱工作台的最小闭环：

   * 选择实验信号；
   * 运行实验；
   * 展示数据集和预算；
   * 保存辨识模型引用；
   * 构建 black-box-control artifact；
   * 提交官方评测。
5. 保留所有权校验。现有 `assertBlackBoxExperimentOwnership` 要继续作为提交硬门槛。
6. 明确区分：

   * `ArenaBlackBoxExperiment`：学生实验；
   * `IdentificationArtifact`：学生工作模型；
   * `ArenaVirtualSimulationRun`：虚拟仿真预演；
   * `ArenaSubmission`：正式榜单提交。
7. 不要把虚拟仿真预演结果直接写入榜单。

## 交付标准

阶段 7 完成后必须满足：

```text
1. 黑箱任务能从详情页进入辨识工作台或虚拟仿真入口；
2. 学生能运行受预算限制的黑箱实验；
3. 数据集归属校验有效；
4. 非本人 datasetHash 不能提交；
5. 黑箱控制器 artifact 必须引用 datasetHash 和 identificationModelId；
6. 虚拟仿真预演不进入正式排行榜；
7. 黑箱任务官方提交仍通过 /api/arena/evaluate；
8. 增加 API 和服务层测试。
```

---

# 十一、阶段 8：Control Odyssey、作业与教师端 Arena 集成

## 目标

让 Arena 不只是学生自由挑战入口，而是能接入作业、控制奥德赛和教师配置。

## 代理执行步骤

1. Control Odyssey 集成：

   * 保持现有 Control Odyssey 游戏逻辑，不把它搬进 Arena；
   * 通过 `workspaceMode: 'control-odyssey'` 路由进入；
   * 提交结果时可选择同步生成 ArenaSubmission；
   * 不破坏现有 `control-odyssey` 积分、商店、等级和 AI 历史逻辑。
2. 作业集成：

   * 支持 task.homeworkEligible；
   * 教师可把 Arena task 绑定到班级或课堂；
   * 作业模式在截止前默认隐藏完整榜单，可显示个人达标或匿名百分位；
   * 截止后可开放优秀方案。
3. 教师端 Arena：

   * 使用已有 `src/features/arena/teacher/configuration` 扩展；
   * `/teacher/arena` 负责任务预览、发布作业挑战、查看班级榜；
   * 不在教师端重写评测逻辑。
4. classId 传递：

   * 从教师发布的任务、课堂或班级上下文传入 `ArenaSubmission.classId`；
   * 无班级上下文时作为公开练习。
5. seasonId 传递：

   * 对 Control Odyssey 或公开赛季设置默认 season；
   * 赛季策略不要写死在 UI。

## 交付标准

阶段 8 完成后必须满足：

```text
1. 教师可查看 Arena task 列表和详情；
2. 教师可选择任务发布为班级挑战；
3. 学生从班级/作业入口提交时 ArenaSubmission 写入 classId；
4. Control Odyssey 任务不会破坏原积分系统；
5. 作业模式与公开练习模式在榜单展示上可区分；
6. 现有 Control Odyssey 测试和页面不回归。
```

---

# 十二、阶段 9：Arena 埋点进入数据治理与学习画像

## 目标

把 Arena 的高价值事件纳入现有数据治理链，不只是停留在 UI 日志。

当前 Arena telemetry 已经构造 `/api/interactive/events` 可接收的事件格式。 项目说明也明确数据治理链路把 `InteractionLog`、`LearningFact`、`StudentCompetencySnapshot` 等用于学生画像、教师洞察和推荐资源。

## 代理执行步骤

1. 确认 `/api/interactive/events` 对 Arena 事件是否正确写入 `InteractionLog`。
2. 补充事件词典或治理映射：

   * `arena_challenge_open`
   * `arena_workspace_start`
   * `arena_simulation_run`
   * `arena_controller_save`
   * `arena_identification_model_save`
   * `arena_submit`
   * `arena_evaluation_complete`
   * `arena_leaderboard_view`
3. 高价值事实建议：

   * 官方有效提交；
   * 硬约束失败；
   * 从无效到有效的改进；
   * 黑箱实验数据质量；
   * 进入 Pareto 前沿；
   * 作业挑战达标；
   * 鲁棒隐藏场景通过。
4. 能力维度映射：

   * 控制建模与分析：对象识别、模型选择、指标理解；
   * 参数设计与调优：控制器方案、性能改善；
   * 跨域迁移与联动：虚拟仿真/奥德赛/黑箱迁移；
   * 工程决策与约束：硬约束、安全约束、能耗；
   * 探究反思与提示词：AI 反馈、方案解释；
   * 自主学习进展：重复挑战、改进轨迹。
5. 避免高频噪声：

   * 参数滑块变化本地聚合；
   * 只在仿真运行、保存、提交、查看反馈时打核心事件。
6. 教师和学生端展示：

   * 学生个人中心显示 Arena 提交与改进；
   * 教师班级学情显示 Arena 任务达标率和典型失败指标。

## 交付标准

阶段 9 完成后必须满足：

```text
1. Arena 核心事件写入 InteractionLog；
2. 官方提交可物化为 LearningFact；
3. 有效提交、无效提交、黑箱实验至少三类事实可区分；
4. 学生 profile 最近活动能看到 Arena 行为；
5. 教师端班级洞察能聚合 Arena 达标情况；
6. 数据治理 worker/backfill 测试通过。
```

---

# 十三、阶段 10：文档、测试、迁移与验收

## 目标

把功能从“能跑”推进到“可维护、可验收、可交接”。

## 代理执行步骤

1. 更新文档：

   * `docs/arena.md`
   * `docs/ProjectDescription.md`
   * `docs/memory/02-recent-summary.md`
   * 必要时新增 `docs/memory/20-architecture/arena.md`
2. 增加测试：

   * Arena domain integrity test；
   * scoring test；
   * whitebox evaluation test；
   * submission persistence test；
   * blackbox experiment budget and ownership test；
   * workspace context parser test；
   * multi-representation challenge mode test；
   * leaderboard test；
   * telemetry event test。
3. 增加 Playwright 或最小浏览器验收：

   * `/arena` 筛选任务；
   * 进入 challenge detail；
   * 进入多表征工作台；
   * 显示任务上下文；
   * 修改控制器；
   * 提交官方评测；
   * 回到榜单看到结果。
4. Prisma：

   * 如果 schema 有变更，必须生成 migration；
   * 如果只复用现有 Arena 模型，不要制造空 migration；
   * 运行 `npx prisma validate`。
5. 构建验证：

```bash
npm run lint
npm run test
npm run test:integration   # 如改动覆盖前端主流程
npm run build
```

6. 更新项目说明中的验收摘要，不写夸张描述，只写已完成事实和仍未覆盖的功能。

## 交付标准

阶段 10 完成后必须满足：

```text
1. 文档与代码一致；
2. 核心测试通过；
3. npm run lint 通过；
4. npm run test 通过；
5. npm run build 通过，或明确记录非本轮引入的既有阻塞；
6. Arena 从大厅到工作台再到官方评测形成闭环；
7. 提交记录、榜单、埋点和数据治理均有最小可验证链路；
8. 无重复评测服务、无重复模型库、无 UI 私算正式成绩。
```

---

# 十四、建议的阶段顺序与最小可交付切片

不要一次性做完所有阶段。推荐按以下顺序切片交付：

```text
第一轮：阶段 0 + 阶段 1
目标：Arena 上下文与能力矩阵稳定。

第二轮：阶段 2
目标：白箱官方评测协议真实化。

第三轮：阶段 3 + 阶段 4
目标：多表征工作台从 Arena 进入后能加载模型、显示评价、提交官方评测。

第四轮：阶段 5 + 阶段 6
目标：模型选择面板与榜单体系可用。

第五轮：阶段 7
目标：黑箱实验与虚拟仿真链路形成最小闭环。

第六轮：阶段 8 + 阶段 9
目标：教师端、作业、奥德赛和学习画像接入。

第七轮：阶段 10
目标：文档、测试、验收与交付收口。
```

每一轮都应单独提交，不建议混成一个大 PR。

---

# 十五、明确禁止事项

编程代理不得做以下事情：

1. 不得新增一套与 `src/features/arena` 平行的 `competition` 或 `challenge` 系统。
2. 不得绕过 `/api/arena/evaluate` 直接从前端写排行榜。
3. 不得在多表征工作台中把 `arenaTask` 加载失败静默回退为默认模型。
4. 不得把黑箱对象的真实后台模型暴露给学生端。
5. 不得把虚拟仿真预演结果直接写入正式榜单。
6. 不得把 Arena 评测逻辑写进 UI 组件。
7. 不得把高频参数变化全部上传服务器。
8. 不得把复合校正、MPC、黑箱控制硬塞进根轨迹/Bode 面板。
9. 不得在 `src/components` 下放 Arena 业务逻辑。
10. 不得为了赶进度牺牲 `ControllerArtifact`、`EvaluationRun`、`Submission` 这三层分离。

---

# 十六、最终验收图景

编程代理如实执行后，最终应达到下面状态：

```text
/arena
  展示挑战任务，可按来源、方法、公开程度、榜单筛选。

/arena/challenges/[taskId]
  展示对象、任务目标、允许方法、评价规则、榜单摘要和进入工作台入口。

/interactive-learning/multi-representation-linkage?arenaTask=task-second-order-lead-pid
  自动加载二阶对象挑战上下文；
  模型锁定；
  显示任务评价指标；
  支持 PID / 串联校正预评测；
  支持生成 ControllerArtifact；
  支持官方提交。

/api/arena/evaluate
  服务端执行官方评测；
  复用 artifact hash 和 protocolVersion 缓存；
  写入 ArenaEvaluationRun、ArenaControllerArtifact、ArenaSubmission。

leaderboard
  从真实 ArenaSubmission 生成主榜、方法榜、指标榜和 Pareto 榜。

black-box
  学生通过实验接口生成本人数据集；
  辨识模型引用可追踪；
  控制器工件可提交；
  官方评测不暴露后台模型。

data governance
  Arena 核心事件进入 InteractionLog；
  官方提交和关键失败进入 LearningFact；
  学生画像和教师洞察能看到 Arena 证据。
```

这套计划的关键不是增加一个“竞技场页面”，而是把 Arena 变成项目中控制任务、控制器工件、官方评测、排行榜和学习证据之间的中枢。现有代码已经具备相当多的骨架；真正要做的是补齐上下文注入、真实评测、工作台工件化和数据治理闭环。


可以。下面是一份面向编程代理的阶段化执行计划。它以当前工作分支 `codex/arena-v2` 为基准，不按 `main` 分支判断。该分支已经提供正式 ChatGPT 项目记忆入口 `docs/memory/CHATGPT_CONTEXT.md`，并明确读取顺序为 `CHATGPT_CONTEXT.md -> 00-index.md -> 02-recent-summary.md -> 01-reading-map.md -> 相关主题索引`。 `docs/memory/README.md` 也明确 `docs/memory` 是正式项目记忆根目录，`CHATGPT_CONTEXT.md` 是面向 ChatGPT/GitHub 连接器的入口。

当前 Arena 已不是空白模块。`src/features/arena/index.ts` 已导出 types、seed challenges、filtering、evaluation、leaderboard、artifact hash、submission service、persistence、stats、telemetry、teacher configuration 和 workspace routing 等能力。 `docs/arena.md` 已把 Arena 定义为统一评测与排行榜层，而不是单一校正工具；基本单元是“对象 + 任务 + 允许方法 + 评测协议 + 榜单规则”。

---

# 面向编程代理的执行计划：Arena 与平台深度整合

## 总目标

将当前 Arena 从“已有大厅、任务、提交、评测和榜单雏形”推进为与平台深度整合的控制设计任务基础设施。最终应实现：

1. 从 Arena 挑战进入工作台时，工作台必须加载该挑战的对象模型、任务上下文、允许方法、评价准则和提交目标。
2. 多表征联动工作台成为白箱 SISO LTI 串联校正 / PID / 频域设计任务的正式工作台模式，而不是独立默认模型工具。
3. 工作台探索、控制器工件保存、官方评测、排行榜、黑箱实验、虚拟仿真预演和学习数据埋点形成闭环。
4. 作业对象、控制奥德赛对象、虚拟仿真黑箱对象、典型白箱对象能够通过统一的 Arena 对象/任务/评测/榜单抽象接入。
5. 不重造已有接口；优先复用并扩展 `src/features/arena`、`src/resources/control-system`、`src/features/interactive/multi-representation-linkage`、`/api/arena/*`、`InteractionLog` 和数据治理链路。
6. 严格功能分离，避免出现一个臃肿的 Arena mega-service。

---

# 全局原则

编程代理执行期间必须遵守以下边界。

第一，工作分支固定为：

```text
codex/arena-v2
```

不要再基于 `main` 判断缺失文件。`src/features/arena/arena-hall.tsx`、`docs/arena.md`、`docs/memory/CHATGPT_CONTEXT.md` 均在当前分支存在。

第二，新增能力应围绕现有 Arena 抽象扩展，而不是另建平行体系。当前 `types.ts` 已有 `ChallengeObjectSource`、`ModelVisibility`、`ControllerMethod`、`LeaderboardType`、`WorkspaceMode`、`ChallengeObject`、`MetricProfile`、`LeaderboardPolicy`、`ChallengeTask`、`ControllerArtifact` 等基础类型。

第三，API route 只做鉴权、请求解析和错误返回；业务逻辑继续下沉到 `src/features/arena/**`。当前 `/api/arena/evaluate` 已按这个模式调用 `createPersistedArenaSubmission`，并限制只有学生可提交。

第四，数值计算和图表分析不要散落到页面组件。多表征联动工作台已经使用 `buildLinkageAnalysisRequest`、`useControlEngine` 和 Rust/WASM 分析结果，页面只是渲染 `ControlPerformanceBar`、时域、Bode、根轨迹、Nyquist 等面板。

第五，Arena 官方评测不能信任客户端自报指标。客户端工作台可以做预评测，但正式成绩必须走 `/api/arena/evaluate`，并由服务端创建 `ArenaEvaluationRun` 与 `ArenaSubmission`。当前持久化层已经具备按 `taskId + artifactHash + protocolVersion` 复用评测结果的结构。

第六，黑箱对象必须保留数据集归属校验。当前持久化层已经要求黑箱提交引用本人实验数据集，并校验 `experimentDatasetHash` 与 `identificationModelId` 的对应关系。

---

# 阶段 0：基线确认与任务地图建立

## 目标

让编程代理在动手前准确理解当前分支、当前 Arena 实现和已有风险，避免误判为“从零开发”。

## 必读文件

按顺序读取：

```text
docs/memory/CHATGPT_CONTEXT.md
docs/memory/README.md
docs/memory/00-index.md
docs/memory/02-recent-summary.md
docs/memory/01-reading-map.md
docs/ProjectDescription.md
docs/arena.md
src/features/arena/index.ts
src/features/arena/types.ts
src/features/arena/data/seed-challenges.ts
src/features/arena/workspace-routing.ts
src/features/arena/evaluation/evaluator.ts
src/features/arena/evaluation/whitebox-evaluator.ts
src/features/arena/submissions/persistence.ts
src/features/arena/submissions/prisma-store.ts
src/app/api/arena/evaluate/route.ts
src/app/api/arena/blackbox-experiments/route.ts
src/app/api/arena/virtual-simulation-runs/route.ts
src/app/interactive-learning/multi-representation-linkage/page.tsx
src/features/interactive/multi-representation-linkage/model.ts
src/features/interactive/multi-representation-linkage/page-client.tsx
src/resources/control-system/analysis/multi-representation-linkage-analysis.ts
prisma/schema.prisma
```

## 执行动作

1. 确认当前分支为 `codex/arena-v2`。
2. 运行一次最小基线检查：

```bash
npm run lint
npm run test:unit -- src/features/arena
```

如果测试路径不存在或命令失败，记录失败原因，不要擅自大范围修复无关历史问题。

3. 生成一份内部任务笔记，列出：

   * Arena 当前已实现能力；
   * Arena 与多表征工作台未接通处；
   * 当前白箱评测是否为真实控制分析还是启发式估计；
   * 当前黑箱实验、虚拟仿真预演是否可用；
   * 当前 Prisma 模型是否与 Prisma Client 生成结果一致。

## 交付标准

阶段 0 完成后，编程代理应能明确回答：

```text
1. Arena 的对象、任务、指标、榜单和工作台路由来自哪里；
2. /arena/challenges/[id] 如何进入工作台；
3. /api/arena/evaluate 如何写入提交；
4. 多表征工作台当前为什么不能加载 arenaTask；
5. 后续要改哪些文件，不要改哪些文件。
```

不得交付任何代码，除非只是补充必要的说明文档。

---

# 阶段 1：整理 Arena 领域契约，不重造类型体系

## 当前依据

Arena 当前已有核心领域类型：对象来源、模型公开程度、控制器方法、榜单类型、工作台模式、对象、指标配置、榜单策略、任务和控制器工件。 当前种子文件中已经包含典型白箱对象、作业对象、控制奥德赛对象、虚拟仿真白箱对象、邮轮黑箱对象、时滞对象、不稳定对象等。

## 目标

在不破坏已有类型的基础上，补齐“工作台上下文”和“能力矩阵”，让 Arena 任务能够正式驱动各类工作台。

## 需要新增或扩展的文件

建议新增：

```text
src/features/arena/workbench/types.ts
src/features/arena/workbench/context.ts
src/features/arena/workbench/capabilities.ts
src/features/arena/workbench/metric-mapping.ts
```

不要新增一个庞大的 `arena-service.ts`。

## 具体任务

### 1.1 扩展 `ChallengeObject`

在 `src/features/arena/types.ts` 中扩展，但不要破坏现有字段。

新增建议字段：

```ts
capabilities?: ArenaModelCapabilities;
modelVersion?: string;
modelType?: 'transfer-function' | 'state-space' | 'nonlinear-simulation' | 'virtual-simulation' | 'data-only';
timeRange?: {
  start: number;
  end: number;
  samples: number;
};
frequencyRange?: {
  min: number;
  max: number;
  samples: number;
};
```

其中 `ArenaModelCapabilities` 放到 `src/features/arena/workbench/types.ts`：

```ts
export interface ArenaModelCapabilities {
  isLti: boolean;
  isSiso: boolean;
  hasTransferFunction: boolean;
  hasStateSpace: boolean;
  supportsStepResponse: boolean;
  supportsRootLocus: boolean;
  supportsBode: boolean;
  supportsNyquist: boolean;
  supportsSerialCorrection: boolean;
  supportsPid: boolean;
  supportsCompositeControl: boolean;
  supportsIdentification: boolean;
  supportsMpc: boolean;
  supportsVirtualSimulationPreview: boolean;
  supportsOfficialEvaluation: boolean;
}
```

### 1.2 增加能力推断函数

在 `capabilities.ts` 中新增：

```ts
export function inferArenaObjectCapabilities(object: ChallengeObject): ArenaModelCapabilities
```

规则：

```text
white-box + transfer-function + model 存在：
  支持 step/rootLocus/Bode/Nyquist/serial/PID/official evaluation

black-box + virtual-simulation：
  不支持 rootLocus/Bode/Nyquist 的官方模型分析
  支持 black-box identification、virtual simulation preview、official evaluation

control-odyssey：
  支持 control-odyssey 工作台
  若有 transfer-function model，可视为白箱子集

block-diagram-workbench：
  支持 composite control
```

不要在各页面重复写这套判断。

### 1.3 定义 `ArenaWorkbenchContext`

在 `workbench/types.ts` 中新增：

```ts
export interface ArenaWorkbenchContext {
  entryMode: 'challenge' | 'explore';
  locked: boolean;
  task: ChallengeTask;
  object: ChallengeObject;
  metricProfile: MetricProfile;
  leaderboardPolicy: LeaderboardPolicy;
  capabilities: ArenaModelCapabilities;
}
```

### 1.4 提供上下文解析函数

在 `workbench/context.ts` 中新增：

```ts
export function resolveArenaWorkbenchContext(taskId: string): ArenaWorkbenchContext | null
```

它应复用现有：

```ts
getArenaChallengeTask
getArenaChallengeObject
getArenaMetricProfile
getArenaLeaderboardPolicy
```

如果 task、object、metric profile 或 leaderboard policy 缺失，返回 `null`，不要返回半成品。

### 1.5 增加测试

新增测试建议：

```text
src/features/arena/__tests__/workbench-context.test.ts
```

测试覆盖：

```text
1. task-second-order-lead-pid 可解析为 multi-representation-linkage 上下文；
2. 黑箱任务可解析为 black-box-identification 上下文；
3. 缺失 task 返回 null；
4. 白箱传函对象支持 rootLocus/Bode/Nyquist；
5. 黑箱对象不暴露 transfer function 能力。
```

## 交付标准

阶段 1 完成时：

```text
1. Arena 类型没有出现重复平行定义；
2. resolveArenaWorkbenchContext(taskId) 能稳定返回完整上下文；
3. 能力矩阵集中维护；
4. 现有 Arena 大厅和详情页不破坏；
5. 新增测试通过。
```

---

# 阶段 2：接通 Arena → 多表征工作台上下文

## 当前问题

`workspace-routing.ts` 已经会把默认白箱任务路由到：

```text
/interactive-learning/multi-representation-linkage?arenaTask=<taskId>
```



但是当前 `src/app/interactive-learning/multi-representation-linkage/page.tsx` 只解析 `courseMode`、`role`、`embed`、`controlMode`、`kp`、`ki`、`kd`，没有解析 `arenaTask`。 这就是从竞技场进入后没有加载挑战模型的直接原因。

## 目标

从 Arena 进入多表征工作台时，工作台必须加载挑战对象模型、评价指标、允许方法，并锁定当前挑战上下文。

## 需要修改的文件

```text
src/app/interactive-learning/multi-representation-linkage/page.tsx
src/features/interactive/multi-representation-linkage/model.ts
src/features/interactive/multi-representation-linkage/page-client.tsx
src/features/interactive/multi-representation-linkage/parameter-drawer.tsx
src/resources/control-system/analysis/multi-representation-linkage-analysis.ts
```

## 具体任务

### 2.1 路由解析 `arenaTask`

在 `page.tsx` 中扩展 `parseInitialParams`：

```ts
arenaTaskId: firstValue(searchParams?.arenaTask)
```

`MultiRepresentationInitialParams` 中新增：

```ts
arenaTaskId?: string;
```

不要把完整 Arena 上下文塞进 URL。

### 2.2 在客户端模型中解析 Arena 上下文

在 `useMultiRepresentationLinkageModel(initialParams)` 中：

```ts
const arenaContext = initialParams.arenaTaskId
  ? resolveArenaWorkbenchContext(initialParams.arenaTaskId)
  : null;
```

如果存在 `arenaTaskId` 但 `arenaContext === null`，模型应返回错误态，页面显示：

```text
挑战上下文加载失败，请从竞技场重新进入。
```

不得回退默认邮轮模型或默认二阶模型。

### 2.3 引入 `challenge mode`

新增派生状态：

```ts
const isArenaChallengeMode = Boolean(arenaContext);
const isLockedByChallenge = Boolean(arenaContext?.locked);
```

规则：

```text
courseMode 优先服务邮轮课堂；
arenaTask 优先服务竞技场挑战；
如果二者同时出现，报错或忽略 courseMode，不能混合。
```

建议直接报错，因为二者语义不同。

### 2.4 让工作台使用 Arena 对象模型

现有 `buildLinkageAnalysisRequest` 只接收 poles、zeros、gain，然后内部用 `polyFromRoots` 生成传递函数。 但 Arena 对象已经存储了 `model.numerator` 和 `model.denominator`。

因此应扩展 `BuildLinkageAnalysisRequestInput`：

```ts
plant?: ControlAnalysisRequest['plant'];
caseId?: string;
```

构造逻辑改为：

```ts
const plant = input.plant ?? {
  numerator: polyFromRoots(input.zeros),
  denominator: polyFromRoots(input.poles),
  coefficientOrder: 'descending',
  label: input.plantLabel ?? '多表征联动开环模型',
};
```

Arena challenge mode 下传入：

```ts
plant: {
  numerator: object.model.numerator,
  denominator: object.model.denominator,
  coefficientOrder: 'descending',
  label: object.name,
}
```

### 2.5 禁用挑战模式下的对象编辑

Arena challenge mode 下：

```text
不能添加/删除开环极点；
不能拖动对象极点/零点；
可以调整控制器或校正器参数；
可以切换响应类型，但若任务评价固定为 step，切换只是探索，不参与官方评分；
reset 恢复到挑战对象，而不是默认模型。
```

`ParameterDrawer` 中若当前为 locked challenge，应把对象编辑区域收起或只读显示。

### 2.6 修复缓存匹配逻辑

当前 `model.ts` 用 `doesRootLocusMatchPoleZeroSet` 比对 open-loop poles/zeros 来避免图表错位。对于 `plant` 直接注入模式，不能继续依赖 `polesPayload/zerosPayload`。应新增：

```ts
function doesAnalysisMatchCurrentPlant(...)
```

或在 `plantOverride` 存在时，用 `requestKey` / `caseId + plant numerator + denominator + structures` 判断。

### 2.7 顶部显示挑战上下文

`page-client.tsx` 当前顶部只显示“多表征联动可视化引擎”和参数摘要。 需要新增 `ArenaChallengeContextBar`，显示：

```text
任务名称
对象名称
模型表达
来源
公开程度
允许方法
评价指标
是否挑战锁定
返回挑战详情链接
```

## 交付标准

阶段 2 完成时，访问：

```text
/interactive-learning/multi-representation-linkage?arenaTask=task-second-order-lead-pid
```

必须满足：

```text
1. 顶部显示“二阶对象快速稳定挑战”；
2. 对象显示 G(s)=16/(s^2+2.4s+16)，不再显示邮轮默认模型；
3. 评价指标显示该任务 metric profile 的 ranking metrics；
4. 对象编辑被锁定；
5. 校正器/PID 参数仍可调整；
6. 四个表征图正常刷新；
7. arenaTask 不存在或无效时不回退默认模型，而是显示挑战上下文错误。
```

---

# 阶段 3：顶部性能指标栏与预评测反馈

## 目标

工作台中直接显示当前方案对 Arena 评价准则的预评测结果，但明确区分“工作台预评测”和“官方评测”。

## 需要新增或修改的文件

```text
src/features/arena/workbench/preview-metrics.ts
src/features/interactive/multi-representation-linkage/page-client.tsx
src/features/interactive/multi-representation-linkage/model.ts
```

## 具体任务

### 3.1 建立指标映射函数

新增：

```ts
export function mapLinkageResultToArenaMetrics(
  analysis: LinkageAnalysisViewModel | null,
): Record<string, number>
```

映射建议：

```text
overshoot -> analysis.timeDomain.metrics.overshoot
settlingTime -> analysis.timeDomain.metrics.settlingTime
steadyStateError -> analysis.timeDomain.metrics.steadyStateError
phaseMargin -> analysis.stability.stabilityMargins.phaseMargin.value
gainMargin -> analysis.stability.stabilityMargins.gainMargin.value
```

对 `itae`、`controlEnergy`、`comfortBandPeak` 等如果当前多表征分析结果未提供，不要编造。可以显示：

```text
需官方评测
```

或在后续阶段补齐。

### 3.2 复用现有 scoring

`src/features/arena/evaluation/scoring.ts` 已有 `normalizeMetricValue`、`scoreMetricSatisfaction`、`clampScore`，其中 `scoreMetricSatisfaction` 使用加权几何平均，避免一个差指标被其他好指标洗掉。 预评测必须复用这些函数，不要在 UI 中另写一套评分公式。

### 3.3 构造 `ArenaWorkbenchPreviewSummary`

新增：

```ts
export interface ArenaWorkbenchPreviewSummary {
  metrics: Array<{
    id: string;
    label: string;
    value: number | null;
    unit?: string;
    satisfaction: number | null;
    status: 'pass' | 'warning' | 'fail' | 'unknown';
  }>;
  previewScore: number | null;
  missingOfficialOnlyMetrics: string[];
}
```

### 3.4 UI 展示规则

顶部性能栏显示：

```text
当前方案表现
- 调节时间
- 超调量
- 稳态误差
- 相角裕度等

官方评测说明
- 当前为工作台预评测
- 榜单成绩以 /api/arena/evaluate 官方评测为准
```

对缺失指标明确显示：

```text
官方评测计算
```

不要留空。

## 交付标准

阶段 3 完成时：

```text
1. 从 Arena 进入多表征工作台后，顶部显示任务评价指标；
2. 改变 PID/串联校正参数后，预评测指标随图表结果更新；
3. 缺失指标不会显示假数；
4. 预评测和官方评测的边界文案清晰；
5. scoring 逻辑复用 src/features/arena/evaluation/scoring.ts。
```

---

# 阶段 4：基础模型选择面板与能力门控

## 目标

在多表征工作台顶部增加可收起的基础模型选择面板。挑战模式下模型锁定；自由探索模式下可选择兼容模型；不兼容模型显示原因和跳转路径。

## 需要新增或修改的文件

```text
src/features/interactive/multi-representation-linkage/model-selector-panel.tsx
src/features/interactive/multi-representation-linkage/page-client.tsx
src/features/arena/workbench/capabilities.ts
src/features/arena/workspace-routing.ts
```

## 具体任务

### 4.1 挑战模式

如果 `arenaContext.locked === true`：

```text
面板只显示当前挑战模型；
不允许切换；
提供“返回挑战详情”和“脱离挑战进入自由探索”两个入口。
```

“脱离挑战”应跳转到：

```text
/interactive-learning/multi-representation-linkage
```

而不是在当前 session 中静默清除状态。

### 4.2 自由探索模式

列出 `ARENA_CHALLENGE_OBJECTS` 中的模型，按来源分组：

```text
典型对象
作业对象
控制奥德赛
虚拟仿真
前沿拓展
```

### 4.3 兼容性判断

用阶段 1 的 `inferArenaObjectCapabilities` 判断：

```text
可在当前多表征工作台打开：
  white-box + transfer-function + supportsRootLocus/Bode/Nyquist

部分兼容：
  white-box + transfer-function 但任务推荐不是 multi-representation

不兼容：
  black-box / nonlinear / virtual-simulation data-only
```

### 4.4 不兼容对象提示

不兼容对象不要静默隐藏。显示：

```text
当前对象不是公开 SISO LTI 传递函数，无法直接使用根轨迹 / Bode / Nyquist 面板。
建议进入：辨识 + 控制工作台 / 框图工作台 / 控制奥德赛工作台。
```

跳转 href 复用 `getArenaWorkspaceHref`，不要硬编码路径。

## 交付标准

阶段 4 完成时：

```text
1. 挑战模式下模型锁定；
2. 自由探索模式下可选择典型白箱模型；
3. 黑箱对象不可在多表征模式打开，但有明确原因和跳转入口；
4. 选择新模型后四个表征图刷新；
5. 不新增重复的模型注册表，数据仍来自现有 seed-challenges。
```

---

# 阶段 5：控制器工件生成与工作台内官方提交

## 当前依据

Arena 当前详情页的 `ArenaSubmissionPanel` 已经能够用表单参数构造控制器工件、运行本地预览并提交 `/api/arena/evaluate`。 但这套提交还停留在挑战详情页内部表单，没有与多表征工作台的真实参数状态打通。

## 目标

学生在多表征工作台完成设计后，可直接保存方案、运行预评测、提交官方评测，并将 `ControllerArtifact` 回写到 Arena。

## 需要新增或修改的文件

```text
src/features/arena/submissions/controller-artifact-builder.ts
src/features/interactive/multi-representation-linkage/model.ts
src/features/interactive/multi-representation-linkage/page-client.tsx
src/features/interactive/multi-representation-linkage/arena-submit-panel.tsx
```

## 具体任务

### 5.1 增加工作台状态到 ControllerArtifact 的转换

新增函数：

```ts
export function buildControllerArtifactFromMultiRepresentationState(input: {
  task: ChallengeTask;
  gain: number;
  correctionState: CorrectionState;
}): ControllerArtifact
```

映射规则：

```text
correction kind = pid:
  method = pid
  params = { kp, ki, kd }

correction kind = lead / lag / lead_lag:
  method = serial-compensator
  params 至少包含 { gain, zero, pole }
```

注意：当前 `whitebox-evaluator.ts` 对 `serial-compensator` 期望参数是 `gain`、`zero`、`pole`。 如果多表征中 `lead_lag` 无法压缩为当前单零单极格式，应先只允许 `lead` 或 `lag` 生成官方提交，`lead_lag` 显示“当前官方评测器暂不支持此结构”，不要伪造参数。

### 5.2 工作台内增加三个动作

在右上或底部增加：

```text
保存方案
运行预评测
提交官方评测
```

第一阶段可以只实现：

```text
运行预评测
提交官方评测
```

“保存方案”若暂未落库，应显示为 disabled，并在计划后续阶段实现。

### 5.3 提交调用现有 API

提交必须调用：

```text
POST /api/arena/evaluate
```

现有 route 会校验学生身份，并调用 `createPersistedArenaSubmission`。 不要新增 `/api/arena/workbench-submit`。

### 5.4 提交成功后的状态

提交成功后：

```text
1. 显示得分；
2. 显示 hard constraint 结果；
3. 显示 explanation；
4. 显示是否 reusedEvaluation；
5. 提供返回挑战详情 / 查看榜单链接；
6. 发送 arena_submit、arena_evaluation_complete、arena_result_view 埋点。
```

埋点复用 `sendArenaCoreEvent`，当前 telemetry 已有 `arena_submit`、`arena_evaluation_complete`、`arena_result_view` 等核心事件。

## 交付标准

阶段 5 完成时：

```text
1. 学生从 task-second-order-lead-pid 进入多表征工作台；
2. 调整 PID 参数；
3. 点击提交官方评测；
4. /api/arena/evaluate 创建真实 ArenaSubmission；
5. 回到挑战详情页能看到新增提交；
6. 相同控制器再次提交能复用评测结果；
7. 禁止未登录或非学生身份提交。
```

---

# 阶段 6：白箱官方评测与工作台预评测一致性改造

## 当前问题

当前 `evaluateWhiteBoxSubmission` 内部通过 `estimateMetrics` 估计指标，并不是直接复用 Rust/WASM 控制分析结果。 这可以作为 MVP，但长期会导致“工作台图表指标”和“官方评测指标”不一致。

## 目标

建立统一的白箱指标计算服务，使多表征工作台预评测和 Arena 官方评测至少使用同一套指标映射与计算口径。不能在页面、API、评测器中各写一套。

## 建议拆分

新增：

```text
src/features/arena/evaluation/whitebox-metric-provider.ts
src/features/arena/evaluation/controller-to-analysis-request.ts
src/features/arena/evaluation/metric-profile-evaluator.ts
```

### 6.1 `controller-to-analysis-request.ts`

负责：

```text
ChallengeObject + ControllerArtifact -> ControlAnalysisRequest
```

复用：

```text
buildPidCorrection
buildFrequencyTurnCorrection
buildLinkageAnalysisRequest
```

`buildLinkageAnalysisRequest` 已支持 correction structures 和 outputs。

### 6.2 `whitebox-metric-provider.ts`

提供接口：

```ts
export interface WhiteBoxMetricProvider {
  evaluate(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    artifact: ControllerArtifact;
  }): Promise<Record<string, number>>;
}
```

第一阶段实现两种：

```text
heuristicWhiteBoxMetricProvider：包装现有 estimateMetrics
analysisWhiteBoxMetricProvider：若能在 Node/服务端调用 Rust/WASM，则使用真实 ControlAnalysisResult
```

如果服务端 Rust/WASM 目前不可用，不要硬改大量底层。先把接口抽出来，保留 heuristic provider，但写明 TODO 和测试，保证未来可替换。

### 6.3 `metric-profile-evaluator.ts`

把以下逻辑从 `whitebox-evaluator.ts` 中拆出：

```text
hard constraints
satisfaction
score
penalties
explanation
```

使其可以接收任意 metric provider 输出。

## 交付标准

阶段 6 完成时：

```text
1. whitebox-evaluator 不再同时承担参数归一化、指标估计、硬约束、评分、解释所有职责；
2. 官方评测仍保持现有 API 返回结构；
3. 现有提交、榜单测试不破坏；
4. metric provider 可以被替换；
5. 工作台预评测与官方评测至少复用同一 metric-profile-evaluator 和 scoring。
```

---

# 阶段 7：榜单体系强化与真实数据一致性

## 当前依据

现有提交持久化层会写入 `ArenaControllerArtifact`、`ArenaEvaluationRun`、`ArenaSubmission`，并支持 `listSubmissions`。 Arena 详情页已经展示榜单摘要、参与人数、提交次数和不同榜单入口。

## 目标

让主榜、方法榜、指标榜、Pareto 榜、班级榜、赛季榜的生成规则统一、可测试、可复用。

## 需要检查或修改的文件

```text
src/features/arena/leaderboards/leaderboard.ts
src/features/arena/stats.ts
src/features/arena/challenge-detail.tsx
src/features/arena/submissions/prisma-store.ts
```

## 具体任务

### 7.1 统一榜单输入

所有榜单只接收：

```ts
ArenaSubmissionRecord[]
```

不要让 UI 自己拼 Prisma row。

### 7.2 主榜规则

建议规则：

```text
只纳入 valid=true；
同一学生同一 task 只取最高 score；
score 降序；
同分按 policy.tieBreakers；
```

### 7.3 方法榜

```text
按 artifact.method 过滤；
仍只纳入 valid=true；
```

### 7.4 指标榜

```text
metric direction 来自 MetricProfile；
minimize 指标升序；
maximize 指标降序；
同一学生保留该指标最优提交；
```

### 7.5 Pareto 榜

实现非支配排序：

```text
输入：task.primaryMetrics
direction：来自 MetricProfile
输出：paretoTier
```

如果指标缺失，则该提交不能进入 Pareto 榜，不能按 0 填充。

### 7.6 班级榜与赛季榜

当前 `ArenaSubmission` 已有 `classId`、`seasonId` 字段路径。 需要确保 API 提交能接收 class/session 上下文时写入这些字段。第一阶段可以不在 UI 开启，只保证服务函数支持。

## 交付标准

阶段 7 完成时：

```text
1. buildArenaLeaderboard 有单元测试；
2. 主榜、方法榜、指标榜、Pareto 榜规则清晰；
3. 同一学生重复提交不会在主榜刷屏；
4. 指标方向来自 MetricProfile，不在榜单函数中硬编码；
5. 详情页榜单预览与后端真实数据一致。
```

---

# 阶段 8：黑箱实验与虚拟仿真预演闭环

## 当前依据

黑箱实验 API 已存在 `/api/arena/blackbox-experiments`，只允许学生运行，并调用 `createArenaBlackBoxExperiment`。 黑箱实验服务中设置了每日预算 `ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET = 20`，并通过 store 在事务中检查预算。 虚拟仿真预演 API 已存在 `/api/arena/virtual-simulation-runs`，用于将控制器工件导入预演，但不等于正式提交。

## 目标

把黑箱挑战从“详情页能提交”推进到“实验数据集 -> 辨识模型 -> 控制器工件 -> 虚拟仿真预演 -> 官方评测”的清晰流程。

## 需要修改或新增

```text
src/features/arena/blackbox/*
src/features/arena/submissions/arena-blackbox-submission-panel.tsx
src/features/arena/workbench/blackbox-workbench-context.ts
src/app/api/arena/blackbox-experiments/route.ts
src/app/api/arena/virtual-simulation-runs/route.ts
```

## 具体任务

### 8.1 黑箱数据集页面状态

在黑箱提交面板中显示：

```text
今日实验预算：已用 / 剩余
最近数据集 hash
信号类型
采样点数
可导出的辨识模型 ID
```

### 8.2 辨识模型来源规则

当前黑箱提交要求：

```text
experimentDatasetHash 以 arena-blackbox-dataset- 开头
identificationModelId 必须等于 expectedIdentificationModelId(datasetHash)
dataset 必须属于当前 user + task
```



这条规则保留，不要为了 UI 方便放宽。

### 8.3 虚拟仿真预演提示

明确文案：

```text
虚拟仿真预演用于观察闭环轨迹、安全违反、控制能量和平滑度；
预演结果不直接进入正式榜单；
正式排名只消费 /api/arena/evaluate 的官方提交。
```

这与 `docs/ProjectDescription.md` 中 Arena 的定位一致：`ArenaVirtualSimulationRun` 用于导入黑箱控制器工件进行虚拟仿真预演，不直接进入正式榜单。

### 8.4 防止暴力搜索

继续保留预算机制。后续若增加更重的虚拟仿真，需增加：

```text
每学生并发限制
同 artifactHash 预演缓存
run duration 上限
同 datasetHash + artifactHash 重复预演复用
```

## 交付标准

阶段 8 完成时：

```text
1. 黑箱挑战能生成实验数据集；
2. 数据集 hash 和辨识模型 ID 在 UI 中可见；
3. 黑箱提交必须引用本人数据集；
4. 虚拟仿真预演可以运行并显示结果；
5. 预演不进入 ArenaSubmission；
6. 官方提交仍走 /api/arena/evaluate。
```

---

# 阶段 9：Arena 事件埋点与数据治理接入

## 当前依据

Arena 已定义核心事件类型，包括打开挑战、进入工作台、运行仿真、保存控制器、保存辨识模型、导入虚拟仿真、提交、评测完成、查看结果、查看榜单、查看反馈。 `sendArenaCoreEvent` 已经把事件发送到 `/api/interactive/events`。

## 目标

让 Arena 行为成为学习证据，但只记录高价值事件，避免过重埋点。

## 需要修改

```text
src/features/arena/arena-telemetry-client.tsx
src/features/arena/telemetry.ts
src/lib/data-governance/*
src/app/api/interactive/events/route.ts
```

## 具体任务

### 9.1 补齐关键埋点触发点

必须记录：

```text
arena_challenge_open
arena_workspace_start
arena_simulation_run
arena_controller_save
arena_submit
arena_evaluation_complete
arena_result_view
arena_leaderboard_view
```

黑箱额外记录：

```text
arena_identification_model_save
arena_virtual_simulation_import
```

### 9.2 统一 eventData

每个 Arena 事件至少包含：

```ts
{
  taskId,
  objectId,
  method,
  workspaceMode,
  score,
  valid,
  artifactHash,
  metricProfileId,
  leaderboardPolicyId
}
```

缺失则为 `null`，不要省字段。

### 9.3 数据治理映射

在治理层把高价值 Arena 事件转成 LearningFact：

```text
arena_evaluation_complete valid=true:
  能力维度：参数设计与调优、工程决策与约束

arena_blackbox_experiment / identification:
  能力维度：跨域迁移与联动、探究反思

arena_submit valid=false:
  作为风险/待改进证据，不直接负向惩罚
```

### 9.4 控制日志量

不要记录滑块每次移动。工作台参数变化只在：

```text
运行预评测
保存控制器
提交官方评测
```

时记录摘要。

## 交付标准

阶段 9 完成时：

```text
1. Arena 关键事件能进入 InteractionLog；
2. eventData 字段稳定；
3. 重复打开页面不产生大量冗余事件；
4. 至少 arena_evaluation_complete 能被治理链路识别；
5. 个人中心或教师端后续可消费这些学习事实。
```

---

# 阶段 10：教师端 Arena 配置与作业模式

## 当前依据

Arena 大厅已经展示 homeworkPolicy、homeworkEligible、practiceMode，并支持来源、方法、难度、公开程度、任务属性和榜单筛选。 `ChallengeDetail` 也展示任务属性、榜单类型、同分决胜和提交入口。

## 目标

让教师能够把 Arena 任务作为作业/课程挑战发布，而不是只让学生自由进入。

## 推荐阶段策略

第一阶段不要做完整可视化挑战编辑器。先做“教师可选择现有 task 并发布作业挑战”的轻量入口。

## 需要新增或修改

```text
src/app/teacher/arena/page.tsx
src/features/arena/teacher/configuration.ts
src/features/arena/teacher/*
src/app/api/arena/teacher/*
```

## 具体任务

### 10.1 教师 Arena 页面

显示：

```text
可发布任务列表
任务来源
是否作业可用
推荐工作台
评价指标
榜单可见范围
```

### 10.2 发布配置

初期字段：

```ts
{
  taskId,
  classId,
  titleOverride?,
  openAt?,
  dueAt?,
  leaderboardVisibility: 'hidden-until-due' | 'anonymous' | 'open',
  gradingPolicy: 'pass' | 'score-bonus' | 'rank-bonus'
}
```

### 10.3 作业榜单规则

作业期间建议：

```text
不公开完整榜单；
只显示个人达标状态、个人最好成绩、匿名百分位；
截止后可公开优秀方案。
```

### 10.4 不按名次直接计主成绩

成绩规则：

```text
达标分
过程分
改进分
性能附加分
反思说明
```

排名只能作为奖励，不作为唯一成绩。

## 交付标准

阶段 10 完成时：

```text
1. 教师能选择 homeworkEligible=true 的任务；
2. 能绑定班级发布；
3. 学生从班级任务进入 Arena challenge；
4. 提交记录写入 classId；
5. 班级榜可按 classId 过滤；
6. 截止前榜单显示策略可配置。
```

---

# 阶段 11：Control Odyssey 与 Arena 的双向整合

## 当前依据

Arena 种子中已有 `plant-odyssey-level-one` 和 `task-odyssey-level-one-growth`，工作台模式为 `control-odyssey`。 `workspace-routing.ts` 已将 control-odyssey 来源或模式路由到 `/interactive-learning/control-odyssey?arenaTask=<taskId>`。

## 目标

让 Control Odyssey 可以作为 Arena 任务来源，同时不破坏原有游戏化进度、积分、商店和赛季榜逻辑。

## 执行策略

不要把 Control Odyssey 的全部积分体系迁入 Arena。应采用适配器模式：

```text
Control Odyssey 原系统负责关卡游玩、积分、解锁；
Arena 只负责把部分关卡抽象为挑战任务并记录官方提交。
```

## 需要修改

```text
src/resources/interactive-learning/control-odyssey/index.tsx
src/app/actions/control-odyssey.ts
src/features/arena/workspace-routing.ts
src/features/arena/evaluation/*
```

## 具体任务

### 11.1 读取 `arenaTask`

Control Odyssey 页面解析 `arenaTask` 后：

```text
显示 Arena 挑战条；
限定可选 level / tier / controller；
完成后可选择“提交至 Arena”；
```

### 11.2 不污染原有游戏得分

原 `submitGameScore` 仍服务 Control Odyssey 原榜单。Arena 提交必须走 `/api/arena/evaluate` 或 Arena 专门适配器，不要把 Control Odyssey 分数直接写成 Arena score。

### 11.3 任务指标映射

将 Control Odyssey 结果映射为 Arena metrics：

```text
settlingTime / 通关时间
overshoot / 偏离峰值
steadyStateError / 终点误差
controlEnergy / 操作强度
```

这与 `metric-odyssey-growth` 的 ranking metrics 一致。

## 交付标准

阶段 11 完成时：

```text
1. 从 Arena 的奥德赛任务进入 Control Odyssey；
2. 页面知道自己处在 Arena challenge mode；
3. 原有 Odyssey 游玩不受影响；
4. 可将一次完成结果提交为 Arena submission；
5. Arena 榜单与 Odyssey 原榜单边界清楚。
```

---

# 阶段 12：复合校正、MPC 和优化调参工作台的能力边界

## 目标

为非串联线性任务建立可扩展入口，但不在第一轮把所有方法塞进多表征工作台。

## 当前依据

Arena 类型已包含 `composite-compensation`、`mpc`、`optimized-pid`、`black-box-control` 等方法。 白箱评测器也已经对 `composite-compensation`、`optimized-pid`、`mpc` 有参数模板校验和摘要逻辑。

## 执行策略

### 12.1 复合校正

不要直接塞进多表征工作台。

建立：

```text
src/features/arena/workbenches/block-diagram/
```

第一阶段只做参数化结构：

```text
prefilterGain
forwardGain
localFeedbackGain
disturbanceCompensation
```

与当前 evaluator 期望保持一致。

### 12.2 MPC

第一阶段只开放参数化 MPC 模板：

```text
template = bounded-linear-mpc
predictionHorizon
controlHorizon
outputWeight
controlWeight
terminalWeight
inputLimit
sampleTime
```

不要开放任意代码控制器。

### 12.3 优化 PID

第一阶段只开放权重化模板：

```text
template = bounded-optimized-pid
speedWeight
energyWeight
robustnessWeight
overshootWeight
searchBudget
```

### 12.4 代码控制器

保持 evaluator 当前策略：没有外部沙箱时默认失败。当前 evaluator 已明确代码型控制器需要外部沙箱验证，并列出禁止网络访问、运行时间限制、内存限制、固定随机种子、依赖锁、禁止访问真实模型内部参数等要求。

## 交付标准

阶段 12 完成时：

```text
1. block-diagram-workbench 可提交 composite-compensation；
2. predictive-control 工作台可提交 mpc 和 optimized-pid；
3. 参数校验与 whitebox-evaluator 一致；
4. 任意代码控制器仍不开放正式评测；
5. 不把复合/MPC/优化模板强行塞进多表征联动 UI。
```

---

# 阶段 13：文档、测试与交付守卫

## 目标

保证深度整合不是一次性 patch，而是可维护、可验证、可继续扩展的工程成果。

## 需要更新的文档

```text
docs/arena.md
docs/ProjectDescription.md
docs/memory/02-recent-summary.md
docs/memory/20-architecture/*
```

`docs/ProjectDescription.md` 应记录 Arena 当前结构与运行链路。上传的项目说明已经把 Arena 描述为统一评测与排行榜层，列出了对象任务种子、控制器工件、官方评测、提交记录、黑箱实验和虚拟仿真预演等核心结构。

## 测试要求

至少新增或更新：

```text
src/features/arena/__tests__/workbench-context.test.ts
src/features/arena/__tests__/leaderboard.test.ts
src/features/arena/__tests__/submission-persistence.test.ts
src/features/arena/__tests__/blackbox-ownership.test.ts
src/features/interactive/__tests__/multi-representation-arena-context.test.tsx
```

## 验收命令

按阶段执行：

```bash
npm run test:unit -- src/features/arena
npm run test:unit -- src/features/interactive/__tests__/multi-representation-arena-context.test.tsx
npm run lint
npm run test
```

最终合并前执行：

```bash
npm run build
```

如 build 失败，需区分：

```text
本次改动引入的问题：必须修复；
历史已知问题：记录并说明，不得伪装为通过。
```

## 最终交付标准

全部阶段完成后，应满足：

```text
1. /arena 大厅能筛选并展示全部挑战任务；
2. /arena/challenges/[id] 展示对象、指标、榜单、工作台入口和提交入口；
3. 白箱多表征任务从 Arena 进入时加载正确挑战模型，不再回退默认模型；
4. 多表征工作台顶部显示挑战上下文和评价指标；
5. 工作台能生成 ControllerArtifact 并提交官方评测；
6. /api/arena/evaluate 仍是唯一正式成绩入口；
7. 榜单基于真实 ArenaSubmission；
8. 黑箱实验有预算、有归属校验、有预演和正式提交边界；
9. Arena 核心事件进入 InteractionLog；
10. 教师端可发布至少一种 Arena 作业挑战；
11. Control Odyssey 可作为 Arena 任务来源但不污染原有游戏体系；
12. 文档、测试和 ProjectDescription 同步更新。
```

---

# 建议的代理执行节奏

建议编程代理不要一次性执行全部阶段。合理迭代顺序是：

```text
第 1 轮：阶段 0-2
先打通 Arena -> 多表征工作台上下文注入。

第 2 轮：阶段 3-5
完成顶部指标、预评测和工作台内官方提交。

第 3 轮：阶段 6-7
重构白箱评测服务与榜单体系。

第 4 轮：阶段 8-9
完善黑箱实验、虚拟仿真预演与埋点治理。

第 5 轮：阶段 10-12
接入教师作业、Control Odyssey、复合/MPC/优化工作台。

第 6 轮：阶段 13
文档、测试、验收与记忆更新。
```

每一轮结束都应提交：

```text
1. 代码变更摘要；
2. 触及文件清单；
3. 已运行测试；
4. 未完成项；
5. 不确定风险；
6. 下一轮建议。
```

---

# 关键技术判断

当前最优先的不是重写 Arena，而是修复一个核心断点：

```text
getArenaWorkspaceHref 已经把 arenaTask 带到多表征工作台，
但 multi-representation-linkage/page.tsx 没有解析 arenaTask，
所以工作台仍然走默认课程/探索模型。
```

这个断点修好后，Arena 与多表征工作台就会从“并列页面”变成“任务驱动工作台”。后续控制器工件、官方评测、榜单和埋点才有稳定上下文。

长期上，真正不能妥协的是官方评测口径。当前白箱评测器已经具备参数校验、硬约束、指标满意度和评分结构，但其指标估计还应逐步转向与现有 Rust/WASM 控制分析一致的计算口径。第一阶段可以保留当前评测器作为稳定 MVP，但必须通过 `metric provider` 抽象把它从最终架构中解耦出来，避免以后所有榜单和教学反馈都被启发式指标锁死。
