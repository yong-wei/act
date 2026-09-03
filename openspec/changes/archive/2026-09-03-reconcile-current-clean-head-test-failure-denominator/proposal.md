## Why

当前测试命令合同与红测基线的历史证据不能直接回答：在 A 的后收敛 successor capture 所绑定的同一 clean source tree 上，实际测试分母是什么、哪些失败仍然可达、哪些只是外部或运行特定限制。若继续沿用提案阶段的固定数量，或把未核验的失败归为历史债，就会让默认 PR lane 在分母不闭合时错误地产生 clean 结论。B 需要在 A 的 immutable identity 可消费之后，基于现行命令合同完成一次可重放、可审计的失败分母调查，并诚实输出 clean 或 non-clean 结论。

## What Changes

- 将 A 的 `successorCaptureId`、source commit/tree、capture digest 和完整 artifact locator/digest 作为硬前置；A 未关闭、未带 `status:archived`、native `blockedBy` 未解除、身份缺失或漂移时，本 change 保持 blocked，不开始 claim、实现或测试。
- 扩展既有 `scripts/test-command-contracts.ts` 与 `src/lib/architecture-test-commands/**` 合同，复用现有 universe、discovery、result、receipt、disposition 和 release authority，按实际 generator 输出双向闭合所有受管测试 scope；不把当前提案数字固化为未来分母。
- 明确区分 subject identity 与 generator identity：subject 固定为 A successor 的 `sourceCommit`/`sourceTree`/`successorCaptureId`/digest；若 B 改动 collector、projector 或 validator，先形成 clean tool implementation checkpoint，记录 `toolCommit`/`toolTree`、schema/version 和入口 bundle digest，再在独立 clean subject checkout 上运行，或由 clean tool checkout 消费 subject checkout 输出。若工具未改动，`toolCommit`/`toolTree` 可等于 subject，但仍必须显式记录。
- 在同一 subject/tool identity 与冻结输入下运行已登记的 default、unit、contract、integration、critical E2E、release、nightly、Rust/WASM、OpenSpec、commercial-UI 及其他实际登记 scope，记录 deterministic discovery/result core 与环境敏感 measurement receipt；缺失或外部不可用时保留有证据的 blocker，不伪造通过。
- 保持 lane 隔离：default PR clean 只由现有 registry 声明为 default mandatory 的 scope/requiredInputs 决定；release、nightly、PostgreSQL、full Playwright 等非默认 lane 各自输出 pass、non-clean 或 BLOCKED。缺少 release manifest 或 `nightly-not-run` 不得污染 default clean，也不得被全局汇总隐藏；仅在 registry 显式声明依赖时允许跨 lane 影响。
- 为每个 failure fingerprint 建立可追溯的 owner、root-cause evidence、lane、closure condition、expiry（适用时）和计划 disposition：`FIX`、`DELETE`、`QUARANTINE`、`BLOCKED`。`release-input` 只能作为明确 non-default release qualification lane 的受管 `QUARANTINE` subtype；`external-blocker` 是 `BLOCKED`，`remove` 统一记录为 `DELETE`。
- 生成紧凑的 manifest、failure inventory/disposition summary、receipt index 和 artifact locator/digest；原始日志、巨型逐测试 ledger、答案/事件载荷、用户标识和本机绝对路径留在受管外部工件，不进入 Git。
- 只有 default registry 的 mandatory scope/requiredInputs 对应的 failures、unhandled errors、unregistered skips、unresolved discovery 和未决 disposition 全部为零时，才允许为 default PR lane 输出 clean certificate；各非默认 lane 独立输出自身结论，否则输出 non-clean blocker package，并明确不得声称 clean。
- 本 change 只调查、分类和交接当前失败分母，不执行后续 `FIX`/`DELETE`/`QUARANTINE`，不修改产品或测试断言、timeout、skip、retry、runner、命令 scope、`REQUIRED_BASELINE`、`REQUIRED_FITNESS_BUDGET`、CI/branch protection，也不开后续 Issue 或 N4。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `restore-trustworthy-test-command-contracts`: 使测试 universe、声明 root/classification、命令 scope、结果与 measurement receipt 能绑定 A successor identity，并对 source/discovery/receipt drift 及未闭合分母 fail closed。
- `eliminate-accepted-red-test-baseline`: 将当前 clean-head 失败调查、四类计划 disposition、受管 release-input subtype、external blocker 语义及 default PR clean/non-clean 输出纳入 revision-bound 红测基线合同，禁止 accepted、silent skip、flaky retry 和永久/无主 quarantine。

## Impact

- 影响既有测试命令合同和 receipt/disposition 适配层（`scripts/test-command-contracts.ts`、`src/lib/architecture-test-commands/**`）及其聚焦合同测试、测试文档和 OpenSpec delta；不新增第二套 discovery、runner、quality framework 或数据口径。
- 需要消费 A 的 immutable successor capture、既有 command/discovery core、command docs、measurement receipts 与 failure inventory，并让每个 discovery core、measurement receipt、failure package 同时绑定 subject 与 tool identities、schema/version 和入口 bundle digest；最终 artifact commit 不得伪装成 subject tree。
- 结果会影响默认 PR lane 的资格判断和后续 release qualification 的输入，但本 change 不改变生产行为、数据库、runtime/OSS release、CI/branch protection、active baseline 或 GitHub coordination state；真实修复、删除、迁移和 N4 由后续明确授权的 change 处理。全局 summary 可汇总各 lane，但必须保留 per-lane denominator/status，只有 registry 显式声明的依赖才可跨 lane 传递阻断。
