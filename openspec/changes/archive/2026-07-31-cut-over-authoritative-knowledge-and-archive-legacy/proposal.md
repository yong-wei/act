## Why

Issue #1117 的历史名称来自一次最终切换设想；本轮已经完成的证据只覆盖声明来源边界内、可复现的阶段性只读权威快照。原工件把这份快照误写成生产切换承诺，必须把边界收回到实际证据。

## What Changes

- 将 `resolve-then-freeze` 的结果定义为 `declared-authoritative-knowledge-snapshot`，精确绑定一个 ReleaseSet、Release、Bundle、Schema、Projection、所有相关 digest、已接受 import/Delta 回执和 ACT capture revision。
- 只允许在同一隔离快照内读取并验证 Bundle loader、逐跳 Delta 和确定性 CourseCoverage worklist；任一身份、哈希、修订或 schema 漂移都 fail closed。
- 将 3,609 项 CourseCoverage worklist 明确标为待审输入；其中 1,772 项 profile-only 证据不产生接受结论，旧 Coverage verdict 不得复用为新 authority。
- 明确 Teaching Projection、两个未可合法绑定的角色合同和全部正式消费者仍处于 blocked 或 Legacy；阶段快照不改变任何生产 selector，生产 selector 变化保持为 0。
- 允许后续 Release 生成新的阶段快照，但历史快照及其证明不得改写。
- 删除本 change 原有的三个最终切换 delta；生产 active authority、公开激活、全消费者 selector、Canonical writer、Legacy Archive、停服/生产迁移均不在本 change 范围内。

## Capabilities

### New Capabilities

- `declared-authoritative-knowledge-snapshot`: 在声明来源边界内冻结并审计一个隔离、只读、不可漂移的候选知识快照。

### Modified Capabilities

无。当前 change 不改变已归档能力的运行合同；后续最终切换由独立 change 承接。

## Impact

- 只影响 OpenSpec 证明合同、快照回执、CourseCoverage worklist 的状态表达和下游阻断记录；不要求生产代码、数据库 selector、运行时公开入口或部署脚本变化。
- 证据引用 `docs/coordination/1117/iteration-2-r3-chain-and-course-coverage-stop.md`，但不改写该历史记录。
