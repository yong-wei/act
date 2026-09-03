## Why

`src/features/simulation-arena-workbench/experience-shell-contracts.ts` 已经把 Simulation、Arena、Control Workbench 和课程资源的 launch、replay、slot、model relation 与 workspace route 语义集中到一个过渡 feature。当前真正的页面 owner 已分别存在于 Platform UI、Practice/Control Workbench、Arena 和课程 runtime；继续让过渡层承载生产导入会形成不可删除的桥接中心。

## What Changes

- 将仍被使用的 launch provenance、replay/status 和 workspace slot 语义迁移到已有 Platform UI、Control Workbench、Arena 或课程 runtime owner。
- 在 C22 的 Artifact/Run contract 迁移完成后，删除 `simulation-arena-workbench` 顶层过渡 feature、其 compatibility exports 和仅保护该过渡层的测试。
- 保留 Arena official/preview 边界、Practice 非正式运行、课程 `ResourceRenderer` 链路、固定步长和现有 WASM facade；不以新 shell 取代这些权威。
- 确认 C23 完成后可进入 C24 的 Arena legacy entrypoint 清理。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulation-arena-workbench-experience-ui`: 保留已验证的跨场景显示合同，但移除过渡 feature 作为生产依赖和 owner 的资格。

## Dependency and Boundary

本变更为 C23，依赖 C22 `migrate-practice-artifact-consumers-to-existing-contract` 完成并提供 consumer/replacement/zero-caller 证据。C24 依赖 C23；两者不得并行删除同一旧入口。

不新增 shell 框架、Artifact/Run contract、WASM facade 或数值逻辑；不改变 Arena server evaluation、official score、leaderboard、生产 selector 或课程 runtime authority。

## Impact

- 过渡层：`src/features/simulation-arena-workbench/experience-shell-contracts.ts`。
- 迁移 callers：`src/features/control-workbench/shell/control-workbench-shell.tsx`、`src/app/simulations/cruise/page.tsx` 及其测试/route contracts。
- 目标 owners：既有 `platform-ui-contracts`、`control-workbench`、Arena workbench/route、simulation scene 和 lesson resource contracts。
- 保持 preview≠official、服务端 Arena authority、Rust/WASM 数值真源、固定步长和课程配置合并顺序。
