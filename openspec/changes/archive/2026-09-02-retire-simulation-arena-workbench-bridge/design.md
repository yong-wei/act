## Context

过渡 feature 的 `experience-shell-contracts.ts` 同时定义 surface、slot、workspace archetype、launch kind、replay state、model relation、breadcrumb、status payload 和 route contracts。当前 `ControlWorkbenchShell` 与 simulation scene 仍直接导入它，而 Arena、Platform UI 和课程 runtime 已分别拥有自己的任务、status、route、resource-launch 和 submission contracts。

C22 将 artifact/run identity 从 mapper 中收口后，本变更只处理 shell context 的归属和过渡目录删除。共享体验的可见语义继续存在，但不再通过一个横向 feature 作为运行时中介。

## Goals / Non-Goals

**Goals:**

- 为每个仍使用的 shell context 指定一个已有 owner，并完成完整 caller 迁移。
- 删除不再被生产、测试或工具调用的 `simulation-arena-workbench` bridge，减少一条跨域依赖。
- 保持 launch context、return target、role scope、replay/model status 和 official/preview 文案的现有行为。
- 为 C24 提供 bridge zero-caller 和 rollback 证据。

**Non-Goals:**

- 不重新设计 AppShell、Mission Workspace 或任何课程视觉规范。
- 不新增横向 shell、事件总线、Artifact/Run contract、WASM facade 或 TypeScript 数值 stepper。
- 不改变 Arena evaluator、submission/leaderboard、Practice/preview persistence、课程 resource registry 或 production selector。

## Decisions

### 1. Move by responsibility, not by file copy

只迁移真实被调用的纯 context/helper：Platform UI 继续拥有通用 status/role display，Control Workbench 拥有其 session/return context，Arena 拥有 challenge/publication/submission context，simulation/lesson owner 保有 scene/resource provenance。未被调用的类型、slot 列表和描述函数直接删除；纯搬文件不算完成迁移。

### 2. Keep one shell contract per existing owner

如果多个 owner 需要相同字段，调用 C22 的 canonical artifact/run projection 或现有 platform contract；不复制一份全量 `ExperienceLaunchContext`。跨 owner 只传最小已验证 context，不能把 shell bridge 变成新的业务状态权威。

### 3. Preserve route and evidence boundaries

迁移必须保留 Arena task/publication 参数、课程 embedded/standalone provenance、replay checksum/status、role scope 和 preview/official distinction。页面数值仍由固定步长调度和 Rust/WASM facade 驱动，shell 只展示状态，不参与计算或持久化。

### 4. Delete after proof and hand off to C24

先列出生产、测试、动态导入和 compatibility callers，逐个迁移并执行 import-boundary check。`experience-shell-contracts.ts` 只有在 zero caller 且所有可见合同由既有 owner 覆盖后才能删除；C24 不得在此之前清理 Arena barrels。

## Risks / Trade-offs

- [Risk] 迁移 context 丢失 return target 或 publication identity。→ 为 Arena→Workbench、scene→return、course embedded 和 direct-entry 各保留 route characterization。
- [Risk] 通用状态被复制到多个 owner。→ 对每个字段记录唯一 owner，重复展示通过既有 platform primitive，不复制状态机。
- [Risk] 删除过渡层影响只在测试中发现的动态 caller。→ 扫描 dynamic import/string references 并将 test-only caller 单独迁移或明确删除。

## Migration Plan

1. 等待 C22 完成并读取其 contract readiness matrix。
2. 对 `experience-shell-contracts.ts` 导出逐项建立 caller、owner、replacement 和行为 characterization。
3. 迁移 Control Workbench、simulation scene、Arena route 和课程 resource callers；保持现有 route/context/status 语义。
4. 删除 zero-caller bridge、compatibility exports 和重复测试；记录 C24 readiness。
5. 运行 route/workbench/course tests、preview/official boundary checks、typecheck 和严格 OpenSpec 校验。

Rollback 恢复 bridge removal 提交和原 owner imports；不得恢复另一套 shell state 或改变 official/preview、Rust/WASM、fixed-step 和 persistence authority。

## Open Questions

无。任何无法归属的 export 或 caller 都使 C23 保持 blocked，直到补齐 owner 和 replacement 证据。
