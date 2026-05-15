# Arena V2 任务 06：白箱官方评测协议与指标 Provider

> 面向执行代理：官方评测应逐步靠近现有控制分析链；短期若服务端 WASM 不稳定，先完成可替换 provider 边界，不要硬搬浏览器 worker。

## 目标

把白箱官方评测从单文件启发式估算推进为可替换的评测协议服务。`evaluateArenaSubmission` 仍是唯一入口，但内部将“控制器转分析请求”“指标提供”“硬约束与评分”拆开。

## 当前协议边界

当前正式启用的是 `template-whitebox-v1`：`pid`、`serial-compensator`、`composite-compensation`、`optimized-pid`、`mpc` 均通过同步 heuristic template provider 产出指标，再进入统一 metric profile 评分。`analysis-whitebox-v1` 只是为后续服务端 `ControlAnalysisResult` 评测预留的协议名，当前不得用于官方提交、缓存复用或榜单隔离。

## 依赖

- 任务 02 提供稳定对象能力和上下文。
- 任务 05 工作台能生成标准 `ControllerArtifact`。

## 触及文件

```text
src/features/arena/evaluation/evaluator.ts
src/features/arena/evaluation/whitebox-evaluator.ts
src/features/arena/evaluation/blackbox-evaluator.ts
src/features/arena/evaluation/protocol.ts
src/features/arena/evaluation/controller-to-analysis-request.ts
src/features/arena/evaluation/whitebox-metric-provider.ts
src/features/arena/evaluation/metric-profile-evaluator.ts
src/features/arena/evaluation/metric-extraction.ts
src/resources/control-system/analysis/multi-representation-linkage-analysis.ts
src/features/arena/__tests__/arena-whitebox-evaluation.test.ts
```

## 执行步骤

- [ ] 保留 `evaluateArenaSubmission` 入口，不新增平行官方评测入口。
- [ ] 新增 `protocol.ts`，集中管理：

```text
protocolVersion
whitebox / blackbox / odyssey / virtual simulation 分发
缓存协议版本
```

- [ ] 新增 `controller-to-analysis-request.ts`，实现：

```ts
export function buildArenaControlAnalysisRequest(input: {
  task: ChallengeTask;
  object: ChallengeObject;
  artifact: ControllerArtifact;
}): ControlAnalysisRequest
```

- [ ] 转换 PID 和串联校正时复用现有 `buildPidCorrection`、`buildFrequencyTurnCorrection` 或同源结构构造逻辑，不重新发明参数结构。
- [ ] 新增 `whitebox-metric-provider.ts`：

```ts
export interface SyncWhiteBoxMetricProvider {
  id: string;
  protocolVersion: string;
  evaluate(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    artifact: ControllerArtifact;
  }): Record<string, number>;
}
```

- [ ] 第一版保留 `heuristicWhiteBoxMetricProvider` 包装现有估算逻辑；若服务端可以稳定调用 WASM，再增加 `analysisWhiteBoxMetricProvider`。
- [ ] 新增 `metric-extraction.ts`，从 `ControlAnalysisResult` 提取：

```text
closed_loop_stable
overshoot
settlingTime
steadyStateError
itae
phaseMargin
gainMargin
bandwidth
controlEnergy
```

`controlEnergy` 若仍是近似派生值，必须在内部结果中标记为 derived metric。

- [ ] 新增 `metric-profile-evaluator.ts`，承载硬约束、满意度、score、penalties 和 explanation。
- [ ] `whitebox-evaluator.ts` 改为编排白箱约束和指标 provider，不继续同时承担指标估算、评分和解释所有职责。
- [ ] 当前阶段使用 `template-whitebox-v1`；`analysis-whitebox-v1` 仅在真实服务端分析结果接入后启用，旧 `whitebox-v1` 不进入当前榜单默认列表。
- [ ] 测试至少覆盖：

```text
task-second-order-lead-pid
task-homework-margin-correction
task-unstable-first-order-stabilization
无效控制器
非 allowedMethods
黑箱对象误提交白箱评测
```

## 验证命令

```bash
rtk npm run test:unit -- src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-prisma-store.test.ts
rtk npm run lint
```

若改动涉及 Prisma Client 或缓存字段：

```bash
rtk npx prisma validate
```

## 验收条件

- `/api/arena/evaluate` 仍通过 `createPersistedArenaSubmission` 写入。
- `evaluateArenaSubmission` 仍是唯一官方评测入口。
- 白箱评测协议版本与实际 provider 一致；当前模板评测统一使用 `template-whitebox-v1`，缓存按协议隔离。
- 指标 provider 可替换，评测器不再被启发式估算锁死。
- 硬约束失败时 score 和 explanation 一致，不能出现无效提交高分。
- 工作台预评测和官方评测至少复用同一套 metric profile 评分口径。
