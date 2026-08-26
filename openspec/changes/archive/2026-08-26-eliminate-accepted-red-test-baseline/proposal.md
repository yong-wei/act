## Why

阶段 1 的基线已经暴露出 `test:unit` 的未处理错误，以及 `npm test` 中依赖 run-specific commercial UI 证据的失败。把这些结果笼统标成 integration 遗留会让真实产品/测试缺陷与过期证据继续进入默认门禁，形成“已知失败但可合并”的永久状态。需要在可信命令合同之上逐项关闭红色基线。

## What Changes

- 为当前 `test:unit` 未处理错误和 `npm test` 证据失败建立 revision-bound failure inventory、稳定 fingerprint 与 owner/disposition receipt；观察数量只能来自当前命令结果，不固化为永久数字。
- 对每个失败严格分流为修复真实产品或测试 defect、删除已失效测试、或迁移 run-specific release evidence 到显式发布资格输入；每项都必须有可验证的关闭条件。
- 将无效测试和历史证明依赖从默认产品测试中移除，恢复 PR 默认“无 accepted failure、无 unhandled error、无隐藏 skip”的绿色语义。
- 禁止 skip、flaky retry、宽化断言、永久 quarantine、扩大 fixture 或重写错误分类来伪造绿色；外部权限/计划限制只能记录 blocker receipt。
- 为失败 disposition、删除证明、发布输入和 closure receipt 建立契约测试与文档交接。

## Capabilities

### New Capabilities

- `eliminate-accepted-red-test-baseline`: 定义默认测试基线的失败分流、红色关闭、证据迁移和禁止伪绿策略。

### Modified Capabilities

None. The trustworthy command contract supplies execution and receipt semantics; existing product and release capabilities retain their behavior.

## Impact

- 影响受影响的 Vitest 测试/实现、默认测试编排、commercial UI evidence 校验入口、release qualification manifest、failure ledger 和测试文档。
- 读取 `restore-trustworthy-test-command-contracts` 的命令/receipt contract，以及 baseline/charter 的 owner、authority 和现状证据。
- 不把 release evidence 迁移误写为产品功能变更，不调整 production selector、部署或 GitHub branch protection；不 claim、部署或激活。

## Dependencies and Blockers

- 硬前置：已 qualified 的 `restore-trustworthy-test-command-contracts`；缺少可复现的 command/discovery receipt 时，不能把当前红测分类为历史、删除或 release-input。
- 真实 defect、退役 capability 或外部权限限制无法以证据分流时，保持该 fingerprint 为 blocker，不生成 accepted baseline。
- 输出的 failure closure/release-input receipts 是 `enforce-pr-integration-quality-gates` 的 PR 默认绿色与 release 强门禁输入。
