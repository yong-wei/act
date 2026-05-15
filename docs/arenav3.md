竞技场实现需要修改的：
1，竞技场所有的挑战，在提交框里不要设置默认值
2，所有的公式显示必须使用latex形式渲染
3，所有页面文案，指标名称等必须使用中文。

---

# 一、总体差距判断

我们原设计的核心目标是：**Arena 作为统一评测与排行榜层，工作台作为设计与实验层，官方评测作为可信裁判层，数据治理作为学习证据层。** 项目说明也把 Arena 定位为“对象 + 任务 + 允许方法 + 评测协议 + 榜单规则”的统一评测与排行榜层，并强调正式排名只消费 `/api/arena/evaluate` 写入的真实提交记录。

当前 PR 做到了：

```text
Arena 任务可以进入多表征工作台；
多表征工作台可以识别 arenaTask；
白箱对象可以加载传递函数 plant；
挑战模式下对象编辑被锁定；
工作台内可以构造 ControllerArtifact；
可以从工作台提交到 /api/arena/evaluate；
新增了能力矩阵、上下文解析、榜单服务、评测协议文件、黑箱适配器雏形。
```

但还没有完全做到：

```text
官方评测真实复用 ControlAnalysisResult；
whitebox-v2 具备清晰、可信的协议语义；
自由探索模式下模型选择真正可用；
黑箱适配器复用已有预算/归属/数据集链路；
Arena 埋点真正进入治理事实链；
教师端、作业、奥德赛不是只“有模板”，而是有实际发布与提交上下文；
模块边界足够干净，避免 client/server 混导。
```

换句话说，当前 PR 是 **MVP 级深度接入**，还不是 **架构级深度整合完成版**。

---

# 二、与原计划吻合的部分

第一，Arena 工作台上下文确实建立起来了。PR 新增了 `ArenaWorkbenchContext`、`resolveArenaWorkbenchContext`、`inferArenaObjectCapabilities` 等能力。`resolveArenaWorkbenchContext` 会根据 taskId 找到 task、object、metric profile、leaderboard policy，并返回 capabilities、allowedMethods、recommendedWorkspaceMode、returnHref 等上下文信息。 这符合我们“竞技场进入工作台时带入完整挑战上下文”的方向。

第二，多表征工作台已经解析 `arenaTask`。`page.tsx` 现在会把 URL 中的 `arenaTask` 解析为 `arenaTaskId` 传入 `MultiRepresentationInitialParams`。 `model.ts` 中也会根据 `arenaTaskId` 调用 `resolveArenaWorkbenchContext`，并生成 `arenaContextMissing`、`arenaContextIncompatible`、`isArenaChallengeMode` 等状态。

第三，PR 已经修正了我上一次指出的两个关键问题：无效 `arenaTask` 已经在 UI 层早退，不再继续渲染默认图表；不兼容任务也会显示“当前挑战不支持多表征联动工作台”的专门页面。`page-client.tsx` 中对 `arenaContextIncompatible` 和 `arenaContextMissing` 都做了早退处理。

第四，工作台提交时已经把 `gain` 传入 artifact mapper。`ArenaSubmitPanel` 现在接收 `gain`，并把它传给 `buildArenaArtifactFromMultiRepresentationState`。 `artifact-mappers.ts` 也新增了 `gain?: number`，并将其折算进 PID 或串联校正器参数。 这修复了“工作台预评测包含 K，但官方提交丢 K”的 P1 问题。

第五，挑战对象种子补充了 `modelType`、`timeRange`、`frequencyRange`、`workbenchSeed` 等字段。典型二阶对象、积分对象、一阶对象、作业对象、奥德赛对象、船舶白箱对象、时滞对象和不稳定对象都增加了多表征工作台初始化所需信息。 这符合我们“不在 UI 层临时猜模型，而是在对象层维护工作台上下文”的要求。

---

# 三、仍然存在的主要差距

## 1. 最大差距：whitebox-v2 名义升级，但官方评测仍是启发式估算

这是当前最核心的问题。

PR 新增了 `protocol.ts`，把白箱协议版本设为 `whitebox-v2`。 但是 `evaluateArenaSubmission` 仍然直接调用 `evaluateWhiteBoxSubmission`。 而 `evaluateWhiteBoxSubmission` 内部仍然通过 `summarizeController` 和 `estimateMetrics` 做启发式估算。

虽然 PR 新增了：

```text
controller-to-analysis-request.ts
metric-extraction.ts
metric-profile-evaluator.ts
whitebox-metric-provider.ts
```

但这些模块还没有真正接入官方评测主链路。`whitebox-metric-provider.ts` 目前只是把原来的 `summarizeController + estimateMetrics` 包装成 async provider。

这和原计划的差距是实质性的。我们原计划要求“官方评测逐步复用现有 ControlAnalysisRequest / ControlAnalysisResult / Rust-WASM 控制分析链”，至少要做到评测协议和指标来源清晰。当前只是抽象了接口，但结果仍是旧估算。

**影响：**

```text
1. 工作台预评测与官方评测仍可能不一致；
2. whitebox-v2 会让旧缓存失效，但实际指标口径并没有真正升级；
3. 未来学生会质疑为什么图表上表现很好，但官方得分不同；
4. 教师端和学习画像拿到的是启发式成绩，不是真实控制行为证据。
```

## 2. 评测协议版本粒度仍然太粗

当前 `getArenaEvaluationProtocolVersion(taskId)` 只按对象是否黑箱返回：

```text
whitebox-v2
blackbox-v1
```



但 Arena 中的白箱方法至少包括：

```text
pid
serial-compensator
composite-compensation
optimized-pid
mpc
```

这些评测口径完全不同。PID 和串联校正可以走线性分析；复合校正可能需要框图闭环计算；MPC 和优化 PID 目前仍是模板化或启发式评价。统一叫 `whitebox-v2` 会掩盖方法间的协议差异。

原计划中我已经建议按方法或评测族划分协议：

```text
analysis-whitebox-v2
template-whitebox-v1
blackbox-v1
code-sandbox-disabled-v1
```

当前 PR 没有做到。

## 3. 基础模型选择面板仍未实现真正的自由探索模式

PR 新增了 `ArenaModelSelectorPanel`，但它实际仍主要在 challenge mode 使用。`page-client.tsx` 只有在 `model.arenaContext` 存在时才渲染该面板。 这意味着从普通多表征工作台入口进入的“自由探索模式”并不会显示这个模型选择面板。

此外，`ArenaModelSelectorPanel` 虽然有 `onSelectObject` 参数，但当前调用处没有传入该回调。 所以即使面板处于 unlocked 分支，点击兼容模型也无法真正切换工作台模型。

这和原计划中的要求仍有差距：

```text
挑战模式：模型锁定，只查看当前模型；
自由探索模式：可选择兼容模型；
不兼容模型：显示原因和推荐工作台。
```

当前只基本完成了第一项。

## 4. 黑箱适配器没有复用已有黑箱实验服务，反而新造了一个随机数据生成器

PR 新增 `ArenaPlantAdapter` 和 `createCruiseRollBlackBoxAdapter` 是正确方向，但实现有问题。`createCruiseRollBlackBoxAdapter.runPublicExperiment` 直接用 `Math.random()` 和简单正弦噪声生成样本，并自行生成 `datasetHash`。

这不符合我们原计划“复用现有黑箱实验服务”的要求。当前项目本来已经有：

```text
createArenaBlackBoxExperiment
runArenaBlackBoxExperiment
prismaArenaBlackBoxExperimentStore
每日预算
数据集归属校验
```

而新增 adapter 没有接入这些链路。

**风险：**

```text
1. 生成的数据不受预算控制；
2. datasetHash 不可复现；
3. 数据集未持久化；
4. 归属校验无法使用；
5. 后续如果误用 adapter，会绕过官方黑箱实验接口。
```

如果只是“接口草案”，应明确标记为 `stub` 或测试用 mock，不能作为生产 adapter 暴露在主导出中。

## 5. 埋点治理仍停留在“字典定义”，没有真正完成 LearningFact 接入

PR 新增了 `arena-event-dictionary.ts`，其中定义了 Arena 核心事件、能力维度映射和高价值事件集合。 但现有 `telemetry.ts` 仍然保留原来的 `ARENA_CORE_EVENT_TYPES` 和 `sendArenaCoreEvent` 实现。

也就是说，现在存在两份 Arena 事件定义：

```text
src/features/arena/telemetry.ts
src/features/arena/arena-event-dictionary.ts
```

我没有看到新字典被 `sendArenaCoreEvent` 或数据治理物化链路真正消费。PR 虽然修改了 `/api/interactive/events` 和 data-governance worker，但这些改动主要是 session report refresh 相关，不是 Arena 事件 → LearningFact 的核心闭环。

这和原计划差距较大。原计划要求：

```text
arena_evaluation_complete valid=true -> LearningFact；
arena_submit valid=false -> 待改进证据；
arena_identification_model_save -> 跨域迁移证据；
学生画像和教师洞察可消费 Arena 证据。
```

当前只完成了前半步：事件词典设计。

## 6. `src/features/arena/index.ts` 主导出仍然过宽，存在 client/server 边界风险

当前 `src/features/arena/index.ts` 继续导出：

```text
evaluation
submissions
persistence
teacher/configuration
workbench client component
artifact-mappers
plant-adapter
```



同时，多表征 `model.ts` 是 `'use client'` 文件，却从 `@/features/arena` 这个主 barrel 导入 `resolveArenaWorkbenchContext` 和类型。

这目前可能能 build，但从架构上仍然不干净。因为 `@/features/arena` 未来很容易混入 server-only 模块，例如 Prisma、BullMQ、fs、server action 等。一旦主 barrel 导入链发生变化，client bundle 就可能被污染。

原计划强调功能分离，不建臃肿超大服务。这里的正确方向是拆出：

```text
src/features/arena/domain.ts
src/features/arena/client.ts
src/features/arena/server.ts
```

或者至少不要让 client hook 从总 barrel 引入业务全集。

## 7. 教师端、作业、奥德赛仍只是“配置模板”，不是实际闭环

PR 中 `teacher/configuration.ts` 的确已经定义了模板、发布输入、发布结果和作业评价函数。 但是这还不是实际的教师端发布闭环。

目前看还缺少：

```text
教师选择 Arena task 发布到班级；
学生从班级/作业入口进入 Arena challenge；
提交时写入 classId；
班级榜按 classId 过滤；
截止前隐藏完整榜单；
截止后开放优秀方案；
作业成绩组合规则接入实际作业系统。
```

控制奥德赛也是类似。`resolveArenaWorkbenchContext` 能识别 `task-odyssey-*` 并返回 `entryMode='odyssey'`。 但这不是“Control Odyssey 与 Arena 双向整合”。它还没有实现从奥德赛真实关卡结果映射到 ArenaSubmission 的链路。

## 8. PR 混入了较多 Arena 无关改动

PR 同时修改了 session framework、data governance worker、session report refresh、fetch diagnostics、teacher lesson session 等文件。当前 compare 显示这些文件也被改动。

这些改动可能是有价值的，但和 Arena V2 主线关系不够直接。尤其是 `.claude/settings.json` 和 `CLAUDE.md` 也被加入 PR。`.claude/settings.json` 会配置本地 PostToolUse / SessionStart hooks，自动运行 `code-review-graph` 命令。 这属于开发环境代理配置，不应混入 Arena 功能 PR，除非项目明确把它作为团队规范的一部分。

---

# 四、进一步整改计划：面向编程代理

下面计划建议作为 PR #5 后续整改分支或追加 commits 执行。目标不是推倒当前 PR，而是把它从“能跑的阶段性实现”推进到“符合原设计的可长期维护实现”。

---

## 阶段 A：收口当前 PR 的阻塞项

### 目标

先保证当前 PR 不违背 Arena 基本可信性：工作台预评测、提交工件、官方评测和任务上下文不能互相打架。

### 任务 A1：确认 gain 语义与官方提交一致

当前 PR 已经把 `gain` 传入 artifact mapper，并折算进 PID 与串联校正参数。 但仍需补测试，验证折算结果与工作台 `buildLinkageAnalysisRequest` 的结构语义一致。

代理执行：

```text
新增测试：
src/features/arena/__tests__/multi-representation-artifact-mapper.test.ts
```

测试用例：

```text
1. PID: gain=2 时，kp/ki/kd 应整体放大 2 倍；
2. PI: kd=0 且 kp/ki 被 gain 放大；
3. PD: ki=0 且 kp/kd 被 gain 放大；
4. lead: serial gain 应等价于工作台 K * lead 结构固有增益；
5. lag: serial gain 应等价于工作台 K * lag 结构固有增益；
6. lead_lag: 仍不可提交，必须返回 unsupportedMethod。
```

如果 lag 的等价关系无法证明，先禁止 lag 官方提交，只允许 PID 与 lead，避免提交成绩与预评测不一致。

交付标准：

```text
工作台中可官方提交的方法，必须有参数等价性测试；
不能证明等价的方法，不能进入官方榜单。
```

### 任务 A2：无效和不兼容 arenaTask 不启动默认模型分析

UI 层已经早退，但 hook 层仍会构造默认 `openLoopSeed` 和分析请求。 如果只是 UI 不显示，风险较低；但从原则上，challenge context 失败不应启动默认模型分析。

代理执行：

```text
在 useMultiRepresentationLinkageModel 内增加 disabled analysis path。
```

可行方式：

```ts
const shouldRunControlAnalysis = !arenaContextMissing && !arenaContextIncompatible;
```

如果现有 `useControlEngine` 不支持 disabled，则新增一个轻量 wrapper：

```ts
function useOptionalControlEngine(request, enabled) {
  return enabled ? useControlEngine(request) : EMPTY_CONTROL_ENGINE_STATE;
}
```

注意 React hooks 不能条件调用，所以 wrapper 内部仍需保持 hook 顺序稳定。

交付标准：

```text
1. bad arenaTask 不触发默认模型图表；
2. black-box task 手动进入多表征页面不触发默认模型图表；
3. 相关测试覆盖页面早退和 hook 状态。
```

---

## 阶段 B：修正评测协议与白箱官方评测口径

### 目标

解决当前最大差距：`whitebox-v2` 名义升级但官方评测仍是启发式估算的问题。

### 任务 B1：重命名或拆分协议版本

代理执行：

修改：

```text
src/features/arena/evaluation/protocol.ts
```

建议协议：

```ts
export const ANALYSIS_WHITEBOX_PROTOCOL_VERSION = 'analysis-whitebox-v1';
export const TEMPLATE_WHITEBOX_PROTOCOL_VERSION = 'template-whitebox-v1';
export const BLACKBOX_PROTOCOL_VERSION = 'blackbox-v1';
export const CODE_SANDBOX_DISABLED_PROTOCOL_VERSION = 'code-sandbox-disabled-v1';
```

新增：

```ts
export function getArenaEvaluationProtocolVersion(input: {
  taskId: string;
  method?: ControllerMethod;
}): string
```

规则：

```text
black-box object -> blackbox-v1
code-controller -> code-sandbox-disabled-v1
pid / serial-compensator -> analysis-whitebox-v1, if actually using ControlAnalysisResult
composite / optimized-pid / mpc -> template-whitebox-v1, until真实分析接入
```

同时调整：

```text
createPersistedArenaSubmission
prisma-store listSubmissions
tests
```

交付标准：

```text
不同评测口径不会共用同一个 protocolVersion；
旧缓存隔离逻辑仍然有效；
测试覆盖同 task 不同 method 返回不同 protocolVersion。
```

### 任务 B2：把 metric provider 真正接入 evaluateWhiteBoxSubmission

当前 `whitebox-metric-provider.ts` 只是包装启发式评测。 `metric-profile-evaluator.ts` 已能根据 metrics、hardConstraintResults 生成结果，但没有被白箱主链路使用。

代理执行：

拆分 `evaluateWhiteBoxSubmission`：

```ts
validateWhiteBoxSubmissionConfig()
summarizeController()
evaluateWhiteBoxHardConstraints()
selectWhiteBoxMetricProvider()
evaluateMetricProfile()
```

然后：

```ts
if method in ['pid', 'serial-compensator'] and analysis provider available:
  metrics = analysis provider
else:
  metrics = heuristic provider
```

第一轮可以先不接 WASM，只需明确：

```text
pid/serial 当前仍使用 heuristic provider -> protocol = template-whitebox-v1
```

或者真正接入 `ControlAnalysisResult` 后再升级到 `analysis-whitebox-v1`。

交付标准：

```text
1. protocolVersion 与实际 metric provider 一致；
2. evaluateWhiteBoxSubmission 不再直接调用 estimateMetrics，除非通过 provider；
3. metric-profile-evaluator 被主链路复用；
4. PR 描述不再声称未完成的真实分析评测。
```

### 任务 B3：补齐 ControlAnalysisResult 衍生指标

当前 `metric-extraction.ts` 中 `itae` 仍为 null，`controlEnergy` 是由 step response 变化率粗略推导。

代理执行：

```text
1. itae 从 stepResponse.points 数值积分计算；
2. iae / ise 可以预留；
3. steadyStateError 继续由 finalValue 推导；
4. controlEnergy 标记为 derived-from-response 或 derived-from-controller；
5. hiddenScenarioWorst、comfortBandPeak 不允许从普通 step response 伪造。
```

建议新增类型：

```ts
export type ArenaMetricSource =
  | 'control-analysis'
  | 'derived-from-response'
  | 'derived-from-controller'
  | 'scenario-evaluation'
  | 'blackbox-official'
  | 'unavailable';
```

交付标准：

```text
所有官方 metrics 都有来源标记；
不能计算的指标不进入评分，或触发该方法不适配该任务；
不再用 null 指标参与 normalizeMetricValue 后默默变 0。
```

---

## 阶段 C：完成基础模型选择面板的自由探索模式

### 目标

落实原计划中的“挑战模式锁定模型，自由探索模式可选择模型”。

### 任务 C1：自由探索模式显示模型选择面板

当前 `ArenaModelSelectorPanel` 只在 `model.arenaContext` 存在时渲染。

代理执行：

在 `page-client.tsx` 中：

```tsx
<ArenaModelSelectorPanel
  currentObjectId={model.currentArenaObjectId}
  locked={model.isLockedByChallenge}
  workspaceMode="multi-representation-linkage"
  onSelectObject={model.selectArenaObjectForExploration}
/>
```

无 `arenaContext` 时也显示，但应标注：

```text
当前为自由探索，未绑定竞技场任务，不能提交官方评测。
```

### 任务 C2：在 model hook 中实现 object selection

新增状态：

```ts
const [exploreObjectId, setExploreObjectId] = useState<string | null>(null);
```

当选择对象时：

```text
1. 读取 object.model 和 workbenchSeed；
2. 设置 modelPoles、modelZeros、gain；
3. 设置 timeRange / frequencyRange；
4. 清空 arenaContext；
5. 禁止官方提交。
```

交付标准：

```text
1. 多表征自由入口可切换典型二阶、一阶、积分、时滞等对象；
2. 切换后图表立即刷新；
3. 未绑定 Arena task 时不显示官方提交按钮；
4. 不兼容对象显示原因和推荐工作台。
```

### 任务 C3：不兼容对象跳转不能硬编码

当前 `ArenaModelSelectorPanel` 不兼容对象的链接仍存在硬编码风险。最新版文件需要确认是否已经完全修掉；如仍有类似 `task-cruise-roll-blackbox-identification` 的硬编码，应改为：

```ts
findRecommendedTaskForObject(objectId)
```

规则：

```text
优先找同 objectId 的 task；
优先 task.workspaceMode 匹配推荐模式；
没有 task 则只显示不可用说明，不给假链接。
```

交付标准：

```text
不再使用 as any 构造假任务；
所有跳转均来自真实 ChallengeTask。
```

---

## 阶段 D：黑箱适配器回归已有实验服务

### 目标

让 `ArenaPlantAdapter` 成为现有黑箱实验服务的抽象层，而不是新造一套随机实验。

### 任务 D1：把当前 adapter 标记为 test/mock 或删除随机实现

当前 `createCruiseRollBlackBoxAdapter` 用 `Math.random()` 生成数据集。 这不应进入生产主链路。

代理执行：

方案一：

```text
重命名为 createMockCruiseRollBlackBoxAdapterForTests
只在测试中导出/使用
```

方案二：

```text
删除随机 runPublicExperiment，实现改为调用 runArenaBlackBoxExperiment 或 createArenaBlackBoxExperiment。
```

推荐方案二。

### 任务 D2：定义 adapter 与 store 的边界

正确接口应类似：

```ts
interface ArenaPlantAdapter {
  runPublicExperiment(input, store, userId): Promise<CreateArenaBlackBoxExperimentResult>;
  runPreview(input, store, userId): Promise<ArenaVirtualSimulationPreviewRun>;
  runOfficialEvaluation(input): Promise<ArenaEvaluationResult>;
}
```

也就是说，adapter 不能绕过：

```text
预算
持久化
datasetHash
所有权校验
```

交付标准：

```text
1. 黑箱实验仍只通过 /api/arena/blackbox-experiments 产生；
2. adapter 不生成未持久化 datasetHash；
3. 所有黑箱提交仍必须通过 assertBlackBoxExperimentOwnership；
4. 黑箱 adapter 测试覆盖预算与归属。
```

---

## 阶段 E：埋点治理真正接入 LearningFact

### 目标

从“定义事件字典”推进到“Arena 事件变成学习证据”。

### 任务 E1：合并事件定义

当前同时存在：

```text
src/features/arena/telemetry.ts
src/features/arena/arena-event-dictionary.ts
```

`telemetry.ts` 中已有 `ARENA_CORE_EVENT_TYPES` 和 `sendArenaCoreEvent`。 新字典也定义了一组事件和能力维度。

代理执行：

```text
1. 保留一个事实来源；
2. telemetry.ts 从 arena-event-dictionary.ts 导入事件类型；
3. 补齐 arena_feedback_view 是否保留；
4. 确保所有事件 payload 字段稳定。
```

### 任务 E2：在数据治理中物化 Arena 高价值事件

新增或修改：

```text
src/lib/data-governance/event-dictionary.ts
src/lib/data-governance/learning-fact-materialization.ts
```

映射建议：

```text
arena_evaluation_complete valid=true
  -> factType: arena_submission_valid
  -> competency: 参数设计与调优 / 工程决策与约束

arena_evaluation_complete valid=false
  -> factType: arena_submission_failed_constraint
  -> competency: 工程决策与约束

arena_identification_model_save
  -> factType: arena_identification_model_saved
  -> competency: 跨域迁移与联动

arena_virtual_simulation_import
  -> factType: arena_virtual_preview
  -> competency: 工程决策与约束
```

交付标准：

```text
1. /api/interactive/events 接收 Arena 事件后能进入 InteractionLog；
2. event ingestion 能生成 LearningFact；
3. 学生 profile 或教师洞察至少能读取 Arena fact 计数；
4. 单元测试覆盖 valid / invalid / blackbox 三类事件。
```

---

## 阶段 F：清理模块边界与 PR 范围

### 目标

避免 Arena 主 barrel 和 client/server 边界长期污染。

### 任务 F1：拆分导出入口

新增：

```text
src/features/arena/domain.ts
src/features/arena/client.ts
src/features/arena/server.ts
```

建议：

```ts
// domain.ts
export * from './types';
export * from './data/seed-challenges';
export * from './workbench/types';
export * from './workbench/capabilities';
export * from './workbench/context';
export * from './workbench/metric-mapping';

// client.ts
export * from './telemetry';
export { ArenaModelSelectorPanel } from './workbench/arena-model-selector-panel';

// server.ts
export * from './evaluation/evaluator';
export * from './submissions/persistence';
export * from './submissions/prisma-store';
export * from './blackbox/experiment-service';
```

然后修改 client 文件：

```ts
import { resolveArenaWorkbenchContext } from '@/features/arena/domain';
```

不要从 `@/features/arena` 总入口导入。

交付标准：

```text
1. client 文件不从 server barrel 导入；
2. server route 不从 client barrel 导入；
3. npm run build 通过；
4. 增加一次 import boundary 检查或测试。
```

### 任务 F2：把 `.claude/settings.json` 和 CLAUDE.md 从 Arena PR 中拆出

当前 PR 增加了 `.claude/settings.json`。 这属于开发环境配置，不属于 Arena V2 业务实现。

代理执行：

```text
1. 从当前 PR 移除 .claude/settings.json；
2. CLAUDE.md 若确需保留，单独开“agent workflow docs” PR；
3. docs/arena/execution-log.md 可保留，但应与 docs/arena.md 建立链接。
```

交付标准：

```text
Arena PR 只包含 Arena、工作台、评测、榜单、数据治理必要改动；
开发代理配置不混入业务 PR。
```

---

## 阶段 G：教师端、作业与奥德赛实际闭环

### 目标

把“配置模板”推进为真实平台链路。

### 任务 G1：教师发布 Arena 挑战到班级

基于 `teacher/configuration.ts` 已有模板继续实现。

新增：

```text
src/app/teacher/arena/page.tsx
src/app/api/arena/publications/route.ts
src/features/arena/teacher/publication-store.ts
```

第一轮可以使用轻量数据库表或现有配置存储，但要能表达：

```text
taskId
classId
deadline
leaderboardVisibility
homeworkBinding
gradingPolicy
```

交付标准：

```text
教师可发布 homeworkEligible=true 的 Arena task；
学生从班级入口看到该挑战；
提交时 ArenaSubmission 写入 classId。
```

### 任务 G2：班级榜和作业榜真实过滤

扩展 `/arena/challenges/[taskId]` 或新增班级上下文入口：

```text
/arena/challenges/[taskId]?classId=...
```

规则：

```text
作业截止前隐藏完整榜单；
显示个人最好成绩和达标状态；
截止后可显示班级榜。
```

交付标准：

```text
class leaderboard 使用真实 classId 过滤；
不是所有公开提交混在作业榜中。
```

### 任务 G3：Control Odyssey 结果映射到 Arena

实现：

```text
Control Odyssey 关卡完成
-> 生成 ControllerArtifact 或 LevelResultArtifact
-> /api/arena/evaluate
-> ArenaSubmission
```

不要把 Odyssey 原积分直接写进 Arena score。

交付标准：

```text
Arena 的 task-odyssey-level-one-growth 可以从奥德赛工作台产生真实 ArenaSubmission；
原 Control Odyssey 积分系统不受破坏。
```

---

# 五、推荐给代理的执行顺序

我建议不要继续在当前 PR 一口气塞所有阶段。当前 PR 已经很大，最合理的方式是拆成两个追加整改 PR 或一个短修 PR + 一个后续增强 PR。

## 修复 PR #5 必做项

```text
A1 gain 等价性测试
A2 无效/不兼容 arenaTask 不启动默认分析
B1 protocolVersion 按评测族/方法拆分
B2 whitebox-v2 名义与实际口径一致
F1 拆分 client/domain/server 导出
F2 移除 .claude/settings.json
```

这些完成后，PR #5 可以作为 Arena V2 第一阶段合并。

## 后续 PR：Arena V2 深度整合第二阶段

```text
C 自由探索模型选择面板
D 黑箱 adapter 接入已有实验服务
E Arena 事件进入 LearningFact
G 教师发布、作业榜、奥德赛提交
```

这些更适合作为第二个 PR，因为它们涉及更多平台链路，不宜继续堆在当前 PR。

---

# 六、最终判断

当前 PR 相比我们原计划，完成度大约是：

```text
领域模型与上下文：70%
多表征工作台接入：75%
工作台官方提交：70%
白箱真实评测：30%
榜单服务：60%
黑箱接入：35%
埋点治理：30%
教师/作业/奥德赛：25%
模块边界治理：40%
```

最关键的结论是：

**这个 PR 已经把 Arena 和多表征工作台接上了，但还没有把 Arena 的“官方评测可信性”和“学习证据价值”真正打通。**

如果现在直接合并，它可以作为一个功能原型；如果要作为平台长期基础设施合并，至少应先完成协议版本修正、评测主链路接入、模型选择自由模式、黑箱适配器回归现有服务、client/server 导出边界清理这几项。
