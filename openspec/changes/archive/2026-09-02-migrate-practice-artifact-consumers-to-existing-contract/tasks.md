## 1. Contract characterization

- [x] 1.1 冻结 `src/lib/practice-lab-run-contract` v1 的字段、canonical hash、privacy、owner/authority、visibility、executor、authoritySource、seed/checksum 和 tolerance 语义。
- [x] 1.2 盘点 Workbench、Manifest Runtime、Practice live、Arena preview、SimulationRun、replay、test 和 operator caller，绑定当前 revision/tree。
- [x] 1.3 为每类消费者记录 before projection、错误/不可用语义、preview/Practice non-official 状态、hidden-input 排除和删除条件。

## 2. Consumer migration

- [x] 2.1 将 Control Workbench artifact bridge、draft projection 和 presets 改为消费现有 contract，不重新声明 identity 或 authority。
- [x] 2.2 将 Manifest Runtime、Practice live 和 `SimulationRun` 适配到现有 canonicalize/project/validate API，保持固定步长与 Rust/WASM facade 调用。
- [x] 2.3 将 Arena preview/workbench mapper 和 virtual preview projection 迁移到同一 envelope，保留 server recomputation/persistence 与 preview≠official。
- [x] 2.4 保持 Arena official evaluator、submission、leaderboard、hidden inputs 和 historical records 的独立 authority。

## 3. Cleanup and downstream handoff

- [x] 3.1 删除仅供重复转换使用且已证明 zero-caller 的 mapper、类型别名和重复 guard；不得删除真实 contract API 或 server evaluator。
- [x] 3.2 生成 C23/C24 可消费的 replacement/zero-caller/rollback/contract-parity evidence，并标记残余 compatibility 为 retained。

## 4. Verification and scope guard

- [x] 4.1 验证 preview、Practice 和 browser/worker display-only 结果不能创建 official submission/evaluation/leaderboard，且虚拟 preview 仍由 server facade 重算并持久化。
- [x] 4.2 验证 artifact/run identity 变化、checksum drift、hidden field、foreign owner 和 role mismatch 均 fail closed，不重写历史。
- [x] 4.3 运行 contract/preview/replay/official-boundary/domain tests、`rtk npm run typecheck`、`rtk openspec validate migrate-practice-artifact-consumers-to-existing-contract --type change --strict` 和 `rtk git diff --check`。


