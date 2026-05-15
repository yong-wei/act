我看了 `codex/arena-enhancement` 最新 PR #6。它确实比 `codex/arena-v2` 的 PR #5 往前推进了一大步，尤其修掉了上一轮最关键的几个问题：`gain` 已进入提交工件、无效/不兼容 `arenaTask` 已早退、多表征工作台会禁用无效分析、协议版本不再统一叫 `whitebox-v2`、自由探索选择器的回调问题也已补了一轮。PR 当前 head 是 `1c4e05e1...`，CI 已通过。

但和我们最初设计的“竞技场作为统一评测与排行榜基础设施”相比，仍有明显差距。这个 PR 可以视为 **Arena V2 第一阶段增强版**，还不能视为“深度整合完成版”。原设计中，Arena 不只是工作台入口，而是对象、任务、控制器工件、官方评测、榜单、黑箱实验、虚拟仿真、作业、奥德赛和学习证据之间的数据中枢。项目说明中也已经把 Arena 定位为控制竞技场，强调正式排名只消费 `/api/arena/evaluate` 写入的真实提交记录，并通过 `ArenaControllerArtifact`、`ArenaEvaluationRun`、`ArenaSubmission`、`ArenaBlackBoxExperiment`、`ArenaVirtualSimulationRun` 等结构支撑对象、任务、黑箱实验和预演链路。

下面是差距报告和面向编程代理的整改计划。

---

# 一、当前 PR 已经达到的部分

当前 PR 对我们设计计划中的第一层闭环有实质性推进。

第一，`arenaTask` 已能进入多表征工作台。多表征入口会解析 URL 中的 `arenaTask` 并传入 `arenaTaskId`。 `useMultiRepresentationLinkageModel` 也会调用 `resolveArenaWorkbenchContext`，生成 `arenaContextMissing`、`arenaContextIncompatible`、`isArenaChallengeMode` 等状态。

第二，无效或不兼容任务不再回退默认模型。当前 `page-client.tsx` 对 `arenaContextIncompatible` 和 `arenaContextMissing` 都做了早退页面，不再继续渲染默认图表。 `useControlEngine` 也增加了 `enabled` 参数，禁用时不会启动 Worker/WASM 分析。

第三，`gain` 丢失问题已经修正。`ArenaSubmitPanel` 现在接收 `gain`，并传给 `buildArenaArtifactFromMultiRepresentationState`。 artifact mapper 也把 `gain` 折算进 PID 参数和串联校正器参数。

第四，协议版本已经从单一 `whitebox-v2` 改为多族协议。当前 `protocol.ts` 定义了 `analysis-whitebox-v1`、`template-whitebox-v1`、`blackbox-v1` 和 `code-sandbox-disabled-v1`。

第五，自由探索模型选择器已经开始补齐。Codex review 先指出自由探索选择器没有 `onSelectObject`，后续提交已经加上 `selectArenaObjectForExploration`，并进一步修复了选择对象后丢失 `workbenchSeed.gain` 的问题。

这些改动说明当前 PR 已经解决了“竞技场任务进不了多表征工作台”和“工作台提交不可复现”的主要原型问题。

---

# 二、仍然存在的关键差距

## 1. 官方白箱评测仍然是启发式评测，不是真实控制分析评测

这是当前最大的差距。

虽然 PR 里新增了 `controller-to-analysis-request.ts`、`metric-extraction.ts`、`whitebox-metric-provider.ts` 和 `metric-profile-evaluator.ts`，但官方白箱评测主链路仍然没有真正使用 `ControlAnalysisResult`。`evaluateWhiteBoxSubmission` 里创建了 `createHeuristicWhiteBoxMetricProvider()`，但这个 provider 变量没有被使用；真实 metrics 仍然来自 `estimateMetrics(object.model, controller)`。

也就是说，当前状态是：

```text
官方评测入口已经结构化；
metric provider 抽象已经出现；
metric profile evaluator 已接入；
但实际指标仍然是旧的 estimateMetrics 启发式估算。
```

这和我们原计划中的“官方评测应尽量复用现有控制分析类型和 Rust/WASM 数值能力，不信任客户端自报指标”仍有差距。当前 `template-whitebox-v1` 这个命名比之前更诚实，但 Arena 的评测可信度还没有达到设计目标。

## 2. `analysis-whitebox-v1` 只是预留，没有真实实现

当前 `protocol.ts` 定义了 `ANALYSIS_WHITEBOX_PROTOCOL_VERSION = 'analysis-whitebox-v1'`，但 `getArenaEvaluationProtocolVersion` 对所有非黑箱、非代码控制器仍然返回 `template-whitebox-v1`。

这意味着：

```text
analysis-whitebox-v1 目前只是符号；
PID / serial-compensator 还没有进入真实分析协议；
ControlAnalysisResult 提取链路没有成为官方评测结果来源。
```

这是合理的阶段性选择，但必须在文档和后续任务中明确：PR #6 只完成了“协议拆分和接口铺垫”，没有完成“真实白箱评测升级”。

## 3. 提交历史过滤仍保留 `whitebox-v1` 兼容，可能削弱协议隔离

`prisma-store.ts` 在 `listSubmissions` 中过滤提交时，除了匹配当前 expected protocol version，还保留了：

```ts
storedVersion === 'whitebox-v1'
```



这可能是为了兼容旧提交，但它与“protocol 版本隔离”的原则存在冲突。尤其当同一任务从 `whitebox-v1` 迁移到 `template-whitebox-v1` 或未来 `analysis-whitebox-v1` 后，旧提交是否还能进入榜单，应由 leaderboard policy 或 migration 策略决定，而不是在 store 里硬编码放行。

否则会出现：

```text
旧协议成绩和新协议成绩混榜；
同一 artifactHash 在不同协议下评测口径不一致；
教师端看不出榜单成绩是否来自旧评测协议。
```

## 4. 黑箱适配器仍然没有接入已有实验服务

PR body 声称黑箱适配器已经接入已有实验服务，且“实验预算、持久化、归属校验不被绕过”。 但代码中的 `createCruiseRollBlackBoxAdapter` 仍然直接用 `Date.now()`、`Math.random()` 和简化公式生成数据集，自己生成 `datasetHash`，没有调用现有的 `createArenaBlackBoxExperiment` 或 `runArenaBlackBoxExperiment`，也没有经过预算和 store 持久化。

这与原计划严重不一致。黑箱链路的底线是：

```text
实验数据必须来自官方实验接口；
数据集必须持久化；
预算必须生效；
datasetHash 必须可归属；
正式提交必须通过所有权校验。
```

当前 adapter 如果只是 mock，应标明为测试用；如果要生产使用，必须重构。

## 5. Arena 埋点字典和 telemetry 仍然是两套定义

`telemetry.ts` 中仍然定义了 `ARENA_CORE_EVENT_TYPES`、`ArenaCoreEventType` 和 `sendArenaCoreEvent`。 同时 `arena-event-dictionary.ts` 也定义了另一套 `ARENA_CORE_EVENT_TYPES`、`HIGH_VALUE_FACT_EVENTS` 和 `ARENA_COMPETENCY_DIMENSIONS`。

PR body 说“合并 telemetry 和 event-dictionary 为单一事件定义”，但代码上看并没有真正合并。更关键的是，我没有看到 Arena 高价值事件已经真实进入 LearningFact 物化链路。当前更像是：

```text
事件字典定义了；
telemetry 仍独立发送；
治理映射还未真正闭环。
```

这与我们最初设计中的“竞技场提交和失败成为学习证据，进入学生画像和教师洞察”仍有距离。

## 6. 模块边界治理还没有完成

PR body 说 barrel 已拆分为 `domain/client/server`。 但我尝试读取 `src/features/arena/domain.ts`，该文件不存在；当前 `src/features/arena/index.ts` 仍然统一导出 types、seed-challenges、evaluation、submissions、persistence、teacher、workbench、adapters 等模块。

这比 PR #5 好一点，因为已经移除了 `ArenaModelSelectorPanel` 的直接导出，但主 barrel 仍然混合了 client 可用纯函数、server 评测逻辑、持久化逻辑和教师配置。长期仍有 client/server 边界污染风险。

## 7. 教师端、作业和奥德赛仍未形成真实业务闭环

当前 PR 主要修复的是 Arena 与多表征工作台、评测协议和自由探索模式的第一阶段问题。教师端、作业、奥德赛这些我们原计划中的深度接入仍然没有完成。

现状大致是：

```text
教师端：有配置模板，但没有真实发布、班级绑定、截止时间、榜单可见策略；
作业：有 homeworkEligible / homeworkPolicy，但没有作业提交与成绩规则闭环；
奥德赛：可作为任务来源，但还没有把 Control Odyssey 真实关卡结果映射到 ArenaSubmission；
黑箱：有实验和预演 API，但 adapter 没有回归现有实验服务。
```

这些是“深度整合”阶段必须补的部分。

---

# 三、当前 PR 与原计划的完成度判断

按模块估算：

```text
领域模型与工作台上下文：80%
多表征工作台接入：85%
工作台官方提交：80%
自由探索模型选择：65%
白箱官方真实评测：35%
评测协议治理：65%
榜单体系：65%
黑箱对象与虚拟仿真接入：40%
Arena 埋点与学习事实治理：35%
教师端 / 作业 / 奥德赛整合：25%
模块边界治理：45%
```

所以当前最准确的定位是：

> PR #6 已经把 Arena 从“原型接入”推进到“可运行的一阶段增强版”，但还没有达到最初设计中的“统一评测基础设施 + 教学数据中枢”。

---

# 四、面向编程代理的整改计划

下面计划建议作为 `codex/arena-enhancement` 的后续整改任务，优先修正“PR body 声称完成但代码未闭环”的部分。

---

## 阶段 1：校正 PR 声明与评测协议现实

### 目标

让协议版本、官方评测和 PR 文档保持一致，避免“名义上完成真实评测，实际上仍是启发式”的错位。

### 具体任务

1. 修改 `docs/arena/execution-log.md` 和 PR 描述中的相关表述。明确当前状态为：

```text
template-whitebox-v1 已完成；
analysis-whitebox-v1 仅定义协议名，尚未接入官方评测；
当前白箱官方评测仍使用 heuristic provider。
```

2. 在 `src/features/arena/evaluation/protocol.ts` 中保留 `ANALYSIS_WHITEBOX_PROTOCOL_VERSION`，但增加注释：

```ts
// Reserved for future server-side ControlAnalysisResult-based evaluation.
```

3. 在 `getArenaEvaluationProtocolVersion` 测试中明确验证：

```text
pid -> template-whitebox-v1
serial-compensator -> template-whitebox-v1
composite-compensation -> template-whitebox-v1
mpc -> template-whitebox-v1
black-box-control -> blackbox-v1
code-controller -> code-sandbox-disabled-v1
```

4. 删除或修正 `whitebox-evaluator.ts` 中未使用的：

```ts
const provider = createHeuristicWhiteBoxMetricProvider();
```

如果要保留 provider 机制，则必须真正使用：

```ts
const provider = selectWhiteBoxMetricProvider(input.artifact.method);
const metrics = provider.evaluateSync(...);
```

由于当前 `evaluateWhiteBoxSubmission` 是同步函数，不要使用 async provider，除非同步改造整条提交链。

### 交付标准

```text
1. PR 文档、代码和协议命名一致；
2. 不再声称官方评测已接入 ControlAnalysisResult；
3. whitebox-evaluator 中没有未使用 provider；
4. 协议版本测试覆盖所有 ControllerMethod。
```

---

## 阶段 2：把 metric provider 真正接入白箱评测主链路

### 目标

把当前“接口存在但未使用”的 provider 改成真正的评测入口。

### 具体任务

1. 新增同步 provider 接口：

```ts
export interface SyncWhiteBoxMetricProvider {
  id: 'heuristic-template' | 'analysis-control-result';
  protocolVersion: string;
  evaluate(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    artifact: ControllerArtifact;
    controller: ControllerSummary;
  }): Record<string, number>;
}
```

2. 实现：

```ts
createHeuristicWhiteBoxMetricProvider(): SyncWhiteBoxMetricProvider
```

3. 新增：

```ts
selectWhiteBoxMetricProvider(method: ControllerMethod): SyncWhiteBoxMetricProvider
```

当前规则：

```text
pid -> heuristic-template
serial-compensator -> heuristic-template
composite-compensation -> heuristic-template
optimized-pid -> heuristic-template
mpc -> heuristic-template
```

未来真实分析接入时再切换：

```text
pid -> analysis-control-result
serial-compensator -> analysis-control-result
```

4. 修改 `evaluateWhiteBoxSubmission`：

```ts
const provider = selectWhiteBoxMetricProvider(input.artifact.method);
const metrics = provider.evaluate({ task, object, artifact, controller });
```

5. `getArenaEvaluationProtocolVersion` 也应读取同一 selector，不要另写一套协议判断。

### 交付标准

```text
1. whitebox-evaluator 不直接调用 estimateMetrics；
2. estimateMetrics 只作为 heuristic provider 内部实现；
3. protocolVersion 和 provider.id 一致；
4. 测试验证切换 provider 会改变 protocolVersion。
```

---

## 阶段 3：实现 analysis-whitebox-v1 的最小真实评测

### 目标

完成原设计中最重要的一步：让 PID 与单级串联校正的官方评测指标至少可以来自 `ControlAnalysisResult`，而不是启发式估算。

### 具体任务

1. 审查现有 Rust/WASM 分析能否在服务端直接调用。若不能，先建立 server-side facade：

```ts
src/features/arena/evaluation/control-analysis-service.ts
```

建议接口：

```ts
export interface ControlAnalysisService {
  compute(request: ControlAnalysisRequest): Promise<ControlAnalysisResult>;
}
```

2. 因为当前 `createPersistedArenaSubmission` 是 async，允许把 `evaluateArenaSubmission` 改为 async：

```ts
evaluateArenaSubmission(...) => Promise<ArenaEvaluationResult>
evaluateWhiteBoxSubmission(...) => Promise<ArenaEvaluationResult>
```

`createPersistedArenaSubmission` 中已经是 async，可以自然 `await`。

3. 只对以下方法启用真实分析：

```text
pid
serial-compensator
```

4. 用已有 `buildArenaControlAnalysisRequest` 生成请求。该文件已经能把 PID 和 serial-compensator 转成 `ControlAnalysisRequest`。

5. 用 `extractMetricsFromAnalysisResult` 提取：

```text
overshoot
settlingTime
steadyStateError
phaseMargin
gainMargin
bandwidth
itae
```

`controlEnergy` 必须标记为 derived，不能伪装为控制量仿真能量。

6. 协议切换：

```text
pid -> analysis-whitebox-v1
serial-compensator -> analysis-whitebox-v1
其他白箱方法 -> template-whitebox-v1
```

### 交付标准

```text
1. PID / serial-compensator 官方 metrics 来自 ControlAnalysisResult；
2. analysis-whitebox-v1 只用于真实分析方法；
3. template-whitebox-v1 仍用于复合、MPC、优化 PID；
4. 新旧协议缓存隔离；
5. 至少覆盖二阶对象、积分对象、不稳定对象三个任务的评测测试。
```

---

## 阶段 4：清理旧协议混榜策略

### 目标

避免 `whitebox-v1` 旧结果和新协议结果直接混榜。

### 具体任务

当前 `prisma-store.ts` 中 `listSubmissions` 会放行 `storedVersion === 'whitebox-v1'`。 需要改成显式策略。

新增：

```ts
export interface ArenaSubmissionListOptions {
  taskId?: string;
  taskIds?: string[];
  userId?: string;
  includeLegacyProtocols?: boolean;
}
```

默认：

```text
includeLegacyProtocols = false
```

在挑战详情和榜单中只显示当前协议提交。

如果需要教师端查看历史，单独显示：

```text
历史协议提交
```

并标注协议版本。

### 交付标准

```text
1. 默认榜单不混入 whitebox-v1；
2. 历史提交仍可查询但明确标记；
3. 测试覆盖 legacy protocol 被排除和显式包含两种情况。
```

---

## 阶段 5：黑箱适配器回归现有实验服务

### 目标

修复当前 adapter 仍随机生成数据、绕过预算与持久化的问题。

### 具体任务

1. 重构 `src/features/arena/adapters/plant-adapter.ts`。

不要让 `runPublicExperiment` 直接返回随机 `ArenaBlackBoxExperimentDataset`。它应调用现有：

```text
createArenaBlackBoxExperiment
runArenaBlackBoxExperiment
prismaArenaBlackBoxExperimentStore
```

2. 修改接口，使其必须传入：

```ts
userId
store
experimentInput
now?
```

示例：

```ts
runPublicExperiment(input: {
  userId: string;
  taskId: string;
  experimentInput: ArenaBlackBoxExperimentInput;
  store: ArenaBlackBoxExperimentStore;
}): Promise<CreateArenaBlackBoxExperimentResult>
```

3. 如果仍需要随机 adapter，用明确命名：

```ts
createMockCruiseRollBlackBoxAdapterForTests
```

并只在测试中导出。

4. 黑箱提交继续通过 `assertBlackBoxExperimentOwnership`，不得放宽现有校验。当前持久化链路已经要求黑箱提交引用本人持久化实验数据集。

### 交付标准

```text
1. 生产 adapter 不再使用 Math.random 生成 datasetHash；
2. 黑箱实验仍走预算控制；
3. 数据集必须落库；
4. 所有黑箱提交仍需本人 datasetHash；
5. 测试覆盖预算耗尽、非本人数据集、合法数据集三种情况。
```

---

## 阶段 6：统一 Arena telemetry 与 LearningFact 物化

### 目标

把 Arena 事件从“发送日志”推进到“生成学习事实”。

### 具体任务

1. 合并两套事件定义。

当前两处都定义了 Arena 事件：

```text
src/features/arena/telemetry.ts
src/features/arena/arena-event-dictionary.ts
```
建议保留：

```text
src/features/arena/telemetry.ts
```

并将能力维度、high value 事件迁入其中，或相反保留 dictionary，让 telemetry 从 dictionary 导入。

2. 在数据治理物化链路中增加 Arena 映射：

```text
arena_evaluation_complete valid=true
  -> LearningFact: arena_submission_valid

arena_evaluation_complete valid=false
  -> LearningFact: arena_submission_constraint_failed

arena_identification_model_save
  -> LearningFact: arena_identification_model_saved

arena_virtual_simulation_import
  -> LearningFact: arena_virtual_preview_run
```

3. 每个事实至少包含：

```text
taskId
objectId
method
score
valid
artifactHash
metricProfileId
leaderboardPolicyId
```

4. 增加测试：

```text
src/lib/data-governance/__tests__/arena-learning-facts.test.ts
```

### 交付标准

```text
1. Arena 高价值事件能生成 LearningFact；
2. 学生画像可查询 Arena fact；
3. 教师班级洞察可聚合 Arena 达标率；
4. telemetry 与 dictionary 不再重复定义。
```

---

## 阶段 7：真正完成 domain / client / server 模块边界

### 目标

解决 `@/features/arena` 主 barrel 过宽的问题。

### 具体任务

新增三个入口：

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
export * from './workspace-routing';

// client.ts
export * from './telemetry';
export { ArenaModelSelectorPanel } from './workbench/arena-model-selector-panel';

// server.ts
export * from './evaluation/evaluator';
export * from './submissions/persistence';
export * from './submissions/prisma-store';
export * from './blackbox/experiment-service';
```

然后修改 imports：

```text
client hook / UI -> @/features/arena/domain 或 @/features/arena/client
api route / server service -> @/features/arena/server
```

主 `index.ts` 可以保留兼容，但不再作为新代码默认入口。

### 交付标准

```text
1. client 文件不从 @/features/arena 总入口导入；
2. server route 不从 client.ts 导入；
3. build 通过；
4. 增加 import boundary 测试或 lint 约束。
```

---

## 阶段 8：教师端、作业、奥德赛第二阶段闭环

### 目标

补足原设计中的平台级深度整合。

### 具体任务

1. 教师发布 Arena 任务。

新增或扩展：

```text
src/app/teacher/arena/page.tsx
src/app/api/arena/publications/route.ts
src/features/arena/teacher/publication-store.ts
```

支持：

```text
taskId
classId
deadline
leaderboardVisibility
homeworkBinding
gradingPolicy
```

2. 学生从班级/作业入口进入 Arena challenge。

提交时 `/api/arena/evaluate` 应能接收并写入：

```text
classId
seasonId
publicationId
```

3. 作业榜单规则：

```text
截止前隐藏完整榜单；
显示个人达标状态；
截止后可公开班级榜和优秀方案。
```

4. Control Odyssey 映射。

实现：

```text
Control Odyssey 关卡完成
-> 生成 Arena 可识别的 result artifact
-> /api/arena/evaluate
-> ArenaSubmission
```

不要直接把 Odyssey 游戏分数当 Arena score。

### 交付标准

```text
1. 教师能发布 Arena 作业挑战；
2. 学生能从班级任务进入挑战；
3. 提交记录写入 classId/publicationId；
4. 班级榜能按 classId 过滤；
5. Odyssey 关卡结果能产生 ArenaSubmission；
6. 原 Odyssey 积分系统不受影响。
```

---

# 五、给代理的优先级建议

当前不建议再把所有事情塞进 PR #6。推荐拆成两轮。

## 第一轮：PR #6 合并前必须补

```text
1. 修正 whitebox provider 没有真正使用的问题；
2. 文档明确 template-whitebox-v1 与 analysis-whitebox-v1 的边界；
3. 移除或封存生产随机黑箱 adapter；
4. 修复 telemetry 与 event-dictionary 双定义；
5. 主 barrel 至少不要继续作为 client hook 默认导入入口。
```

## 第二轮：合并后新 PR 做深度整合

```text
1. analysis-whitebox-v1 真实接入 ControlAnalysisResult；
2. Arena 事件进入 LearningFact；
3. 教师发布 / 作业 / 班级榜；
4. Control Odyssey 真实结果同步 Arena；
5. 黑箱辨识与虚拟仿真预演进入完整对象适配器体系。
```

---

# 六、最终判断

经过 PR #6 后，Arena 分支已经从“原型接入”进化到“第一阶段可用增强版”。它解决了 PR #5 中最明显的几个 P1/P2 问题，工作台上下文和工件提交链路已经明显更可靠。

但它和最初设计相比，仍缺三类核心能力：

```text
1. 官方评测可信性：真实 ControlAnalysisResult 评测尚未接入；
2. 平台级数据闭环：Arena 事件尚未真正成为 LearningFact 和学情画像证据；
3. 教学业务闭环：教师发布、作业榜、奥德赛同步、黑箱辨识链路还未落地。
```

因此，当前 PR 可以作为 Arena V2 第一阶段的增强基础，但不能宣称已经完成“竞技场与平台深度整合”。真正的深度整合至少还需要上面阶段 3、6、8 三条线继续推进。
