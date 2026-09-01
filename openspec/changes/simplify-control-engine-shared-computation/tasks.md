## 1. Hard prerequisites and before baseline

- [ ] 1.1 确认 C25 与 C26 均已完成，读取两者 revision-bound symbol、ABI/export、bytes/lines、tolerance 和测试 receipts；任一缺失则保持 blocked。
- [ ] 1.2 冻结 canonical analysis/controller/simulation/metrics 的输入输出、错误、side effects/order、finite/constraint、checksum/replay 和 fixed-step characterization。
- [ ] 1.3 建立 shared-computation candidate ledger；记录目标分块、caller、唯一 owner、不可删除边界、允许删除对象和 rollback commit。

## 2. Governed simplification

- [ ] 2.1 对每个候选分块主动调用 `code-simplification` skill，输入行为不变量、trust boundaries、目标文件、tests、compatibility 范围，并保存 skill 的 before/after 判断。
- [ ] 2.2 合并可证明等价的纯 computation、fold、数据转换或无价值 wrapper；保留唯一 numerical validator、hard constraints、错误处理和 authority boundary。
- [ ] 2.3 对纯搬文件、改名、格式化、增加转发层或 after 更难理解的方案记录 `rejected-no-simplification` 并回退，不将其计入 C27 完成。
- [ ] 2.4 每个 accepted block 单独记录 before/after source identity、production bytes/lines、public exports/ABI、结果/error/tolerance 对照和 rollback commit。

## 3. Verification

- [ ] 3.1 每个分块后运行 Rust focused tests，比较分析/控制器/仿真/metrics JSON、错误、finite/constraint、trace cadence、checksum/replay 和 tolerance。
- [ ] 3.2 运行 control-engine client/worker/server facade、Practice live、Arena preview/official、server authority、preview≠official 和 fixed-step tests。
- [ ] 3.3 运行 generated WASM identity/build validation、Ponytail review；记录 accepted、rejected、deferred findings 和未处理邻近问题。

## 4. Completion and scope guard

- [ ] 4.1 汇总 C27 before/after receipt，证明没有 crate production bytes 增长、没有第二套实现、没有纯搬文件伪装，且 after 可理解性改善。
- [ ] 4.2 确认未修改 Artifact/Run contract、WASM facade、ABI/model id、Arena evaluator、production selector 或历史结果。
- [ ] 4.3 运行 `rtk npm run typecheck`（如 TS facade 受影响）、Rust/facade/domain suites、`rtk openspec validate simplify-control-engine-shared-computation --type change --strict` 和 `rtk git diff --check`。
