# C22 → C23/C24 readiness

绑定修订：实现提交 HEAD（见交付 PR）。合同：`src/lib/practice-lab-run-contract`。

C23 `retire-simulation-arena-workbench-bridge` 与 C24 `retire-arena-legacy-entrypoints`
不得在本矩阵缺项或 caller 仍为生产依赖时删除入口。

## Replacement / zero-caller / retained

| 旧 mapper / 入口 | 生产 caller | 测试/operator | 替代合同 API | 删除条件 | Rollback |
|---|---|---|---|---|---|
| Workbench persist 无 identity | `persistControlWorkbenchSimulationRun` | `simulation-scene-run-persistence.test.ts` | `projectSimulationRunIdentity` + `assertPreviewOrPracticeNotOfficial` | 不得删除 persistence / WASM facade | 恢复 persist 提交 |
| Scene/Practice persist 无 identity | `persistSceneTraceSimulationRun` ← `/api/simulation/runs` | 同上 | `projectPracticeOutcomeIdentity` | 不得删除 scene persist | 恢复 persist 提交 |
| Arena 虚拟预览写入 | `controller-preview.ts` | `practice-lab-run-contract.test.ts` | `projectArenaPreviewIdentity` | 不得删除 server facade | 恢复 preview writer |
| 虚拟预览路由 | `/api/arena/virtual-simulation-runs` | contract test | `rejectVirtualPreviewRequestBody` | 不得删除路由 | 恢复 route |
| Replay canonical run | `replay-service.ts` | `arena-replay-preview-contract.test.ts` | 校验已持久化 `runContract.identity`（foreign-owner / checksum drift fail-closed） | 不得删除 replay/hidden-input | 恢复 replay 提交 |
| 浏览器工作台预览旗标 | `workbench-preview.ts`（`'use client'`） | `arena-controller-artifact.test.ts` | `PREVIEW_DISPLAY_BOUNDARY`（`types.ts`，无 hasher） | **retained**：client 不得 import `canonicalIdentityHash`/`node:crypto` | 恢复 display 常量 |
| `artifact-mappers.ts` | `arena-submit-panel.tsx`、`domain.ts`、`index.ts` | `multi-representation-artifact-mapper.test.ts` | 无；UI→`ControllerArtifact` 参数转换 | **retained**：非 identity mapper；C23/C24 不得当 bridge 删除 | 保留文件 |
| `artifact-bridge.ts` | 仅 contracts barrel + 测试 | `control-workbench-contracts.test.ts` | 无；draft 成功/失败代数 | **retained**：无 identity 字段 | 保留文件 |
| `SimulationRunEnvelopeV1` | `run-contract.ts`、konling、replay | `simulation-run-contract.test.ts` | 存储形状；identity 另走 contract | **retained**：不得改 DB envelope | 保留类型 |
| `experience-shell-contracts.ts` | `control-workbench-shell.tsx`、`simulations/cruise/page.tsx` | `simulation-arena-workbench-experience-ui.test.ts` | C23 owner 迁移后删除 | **C23 blocked until callers=0** | C23 自己的 rollback |
| Arena `index.ts` / `domain.ts` barrel | 仍有内部 re-export `artifact-mappers` | `arena-boundary.test.ts` | C24 清 barrel | **C24 blocked until C23 zero-caller** | C24 自己的 rollback |

## Contract parity

- Preview / Practice `officialEligible=false` 同源：`PREVIEW_DISPLAY_BOUNDARY` / `PRACTICE_DISPLAY_BOUNDARY`。
- Official evaluator / submission / leaderboard 仍不走这些 project 函数。
- 浏览器预览 `persisted: false`，不写 run/evidence。
- 虚拟预览仍由 server facade 重算、checksum、持久化。

## C23/C24 当前状态

- C23 生产 caller 仍在：`control-workbench-shell.tsx`、`src/app/simulations/cruise/page.tsx`。**不可删除 bridge。**
- C24 Arena root barrel 仍导出 `artifact-mappers`。**不可清 barrel。**
