# C22 consumer inventory

绑定修订：见交付 PR HEAD。合同入口：`src/lib/practice-lab-run-contract`。
Hasher：仅 `canonicalize.ts` 的 `canonicalIdentityHash`（`node:crypto`）。
展示边界常量：`PREVIEW_DISPLAY_BOUNDARY` / `PRACTICE_DISPLAY_BOUNDARY`（`types.ts`，无 hasher）。

## 已走合同 API 的消费者

| 消费者 | 路径 | 合同入口 | 官方边界 |
|---|---|---|---|
| Arena 虚拟预览写入 | `controller-preview.ts` | `projectArenaPreviewIdentity` | preview / `officialEligible=false` |
| 虚拟预览路由 | `/api/arena/virtual-simulation-runs` | `rejectVirtualPreviewRequestBody` | 拒绝客户端 trace/hiddenInputs |
| Control Workbench 服务端持久化 | `persistControlWorkbenchSimulationRun` | `projectSimulationRunIdentity` | practice / 非正式 |
| Practice/scene 服务端持久化 | `persistSceneTraceSimulationRun` | `projectPracticeOutcomeIdentity` | practice / 非正式 |
| Replay canonical run | `replay-service.ts` | `projectSimulationRunIdentity` + fail-closed | 拒绝 official 投影 |
| 浏览器工作台预览旗标 | `workbench-preview.ts` | `PREVIEW_DISPLAY_BOUNDARY`（leaf `types.ts`） | display-only，不写 run |
| Practice live 测试 | `practice-live-control-engine.test.ts` | `projectPracticeOutcomeIdentity` | practice / 非正式 |

## Retained（非 identity 重复转换）

| 入口 | 理由 | C23/C24 |
|---|---|---|
| `artifact-mappers.ts` | UI→ControllerArtifact 参数，不声明 identity | 不得当 bridge 删除 |
| `artifact-bridge.ts` | draft 成功/失败代数 | 保留 |
| `SimulationRunEnvelopeV1` | DB 存储形状 | 保留 |
| `experience-shell-contracts.ts` | 仍有生产 caller | C23 负责 |
| Arena `index.ts` barrel | 仍 re-export mappers | C24 负责 |

## Client vs server

client 预览只读 `types.ts` 展示常量，不得 import hasher。权威 envelope 只在 server persist/replay 发出。

## Rollback

回滚最后一个完整迁移提交；不得恢复 PracticeRun schema，也不得用客户端结果回填历史 SimulationRun。
