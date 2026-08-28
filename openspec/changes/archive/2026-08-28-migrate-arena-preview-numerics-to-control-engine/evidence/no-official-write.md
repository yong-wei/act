# Preview does not write official Arena records

预览允许写入：

- `ArenaVirtualSimulationRun`
- canonical `SimulationRun` / `SimulationTrace`，`runKind=arena_preview`
- 受治理的 preview evidence draft

预览禁止写入：

- `ArenaSubmission`
- 官方 `ArenaEvaluationRun`
- leaderboard 行
- 正式能力达成

证据：

- `/api/arena/virtual-simulation-runs` 在执行前拒收 client `trace`/`summary`/`checksum` 与 hidden 字段
- 持久化路径 `executor=server`，`authoritySource=control-engine-server-facade`，`evaluationVisibility=preview`，`officialEligible=false`
- 浏览器 `computeArenaVirtualPreviewBrowser` / 白箱 `buildArenaWorkbenchPreview` 的 `persisted=false`
- 白箱工作台预览不再调用 `template-preview` / heuristic
