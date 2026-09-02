## Why

Practice、Control Workbench、Manifest Runtime 和 Arena preview 都需要表达控制器工件与运行结果，但当前仍有多套局部映射和转换。已有的 `src/lib/practice-lab-run-contract` 已经定义了唯一的 Artifact/Run identity、owner、authority、visibility、executor、checksum 和 tolerance 语义；继续扩展局部合同会让 preview、Practice 和 official 边界重新分叉。

## What Changes

- 将 Workbench、Manifest Runtime、Practice live、Arena preview 和 SimulationRun 消费者迁移到现有 `practice-lab-artifact-run-contract`，不创建第二套持久化 schema 或重建 contract。
- 统一消费者对 owner/authority、task/spec、artifact/controller snapshot、protocol/runtime/model、seed/checksum、visibility 和 `officialEligible` 的投影。
- 删除仅用于平行转换的 mapper、类型别名和重复验证；保留真实的 source-owner 与 Arena server-evaluation 边界。
- 使 C23（simulation-arena-workbench bridge 退役）和 C24（Arena legacy entrypoint 清理）以该合同为前置。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `practice-lab-artifact-run-contract`: 明确既有 v1 contract 是所有 Practice/Workbench/Arena preview consumers 的唯一映射入口。

## Dependency and Boundary

本变更为 C22。C23 与 C24 均依赖 C22 完成的消费者迁移和 zero-caller 证据；C22 不依赖它们。迁移不得修改 Arena official scoring authority、server evaluation、WASM facade 或任何生产 selector。

## Impact

- Contract：`src/lib/practice-lab-run-contract/`。
- Practice/Workbench：`src/features/control-workbench/contracts/`、`src/features/interactive/`、`src/resources/simulations/core/` 及 live-run consumers。
- Arena：`src/features/arena/workbench/`、`src/features/arena/submissions/`、virtual preview route 和 server adapters。
- 测试：现有 artifact/run、preview、replay、official submission、privacy 和 role isolation tests。
- 保持 preview≠official、服务端 Arena authority、Rust/WASM 数值真源、固定步长、WASM facade 和历史运行身份不变。
