## Why

模块化单体重构的事实分散在 baseline、charter/deprecation ledger、dependency contract、fitness report、测试与工具链回执、QA evidence manifest 以及各领域迁移回执中。即使这些局部工件分别合格，也仍缺少一个绑定同一 source commit/tree、分母闭合且可重放的全局收口判断，无法区分真正的 closure、尚未完成的迁移和仅有旧文档或旧回执的表面完成。

本 change 提供最终的 validation-only 聚合能力：只引用现有权威工件的 immutable identity、结论和 totals，生成一个 revision-bound、确定性的 global closure receipt。它不重新发现输入事实，也不改变任何上游 authority、产品行为或生产状态。

## What Changes

- 新增 `verify-modular-monolith-refactor-closure` capability，消费已合格的 baseline、charter/deprecation ledger、domain dependency contract、fitness report、test/toolchain receipts、QA evidence manifests 和各领域 terminal receipts。
- 定义唯一输入 manifest、terminal coverage、source identity、receipt identity 与 denominator reconciliation 合同；所有输入必须证明来自同一个 source commit/tree。
- 生成规范化 closure receipt，记录 source commit/tree、输入 receipt identities、before/after metrics、included/excluded/duplicate/unresolved totals、terminal coverage、remaining compatibility/blocked records 和 `qualified|blocked|observed|unresolved` 状态。
- 对 dirty 或 mixed worktree、tree/identity drift、missing/duplicate/stale terminal receipt、重复 identity、分母不闭合、隔离树与主树同路径异内容执行 fail closed；排除项、重复项和未解析项保留并计入分母。
- 固定 authority 边界：charter 维护 owner/deprecation ledger，fitness 维护结构指标/预算，QA lifecycle 维护证据分类/隐私/retention，各领域 owner 执行迁移和删除；聚合器不重算这些事实。
- 增加 characterization、schema/validator、确定性重放、异常 fixture、唯一 consumer、无第二 aggregator/无 façade 证明、rollback 和 review 验收。
- 仅在 GitHub 由主线程建立最小 native `blockedBy`；本 change 不创建 Issue、claim、archive、部署、selector 切换或数据库写入。

### Native blockedBy handoff

下表是执行层依赖记录，不把 tracking parent #1603 当作 blocker。由主线程在 GitHub 建立原生关系：

| closure stage | native blocker |
| --- | --- |
| governance | #1548 |
| quality | #1554 |
| toolchain | #1557, #1558, #1559 |
| Assessment / Personalization | #1567 |
| Course / Classroom | #1576 |
| Learning Record | #1587 |
| Knowledge / Resource | #1592 |
| Practice | #1602 |
| Assignment retirement | #1607 |
| generated-content reconciliation | #1608 |

## Capabilities

### New Capabilities

- `verify-modular-monolith-refactor-closure`: 从 revision-bound 权威回执生成分母闭合、确定性的全局重构收口回执，并对资格状态执行 fail-closed 判定。

### Modified Capabilities

None. 现有 baseline、charter、dependency、fitness、test/toolchain、QA 和领域规范仍各自拥有其 requirements；本 change 只消费它们，不复制或削弱它们。

## Impact

- **Owner:** 由 charter 中 `platform`/架构控制面 owner 维护聚合器与 reader；各领域 owner 仍分别负责迁移、删除和 terminal receipt，不能由聚合器代行。
- **Callers:** 新增本地 `verify:architecture-closure` 命令和唯一的 closure reader；后续质量控制面可读取 receipt，Web、worker、课程 runtime、Arena、数据库和生产 selector 不读取它。
- **Script/module:** 计划使用 `scripts/architecture-closure.ts` 与 `src/lib/architecture-closure/`，复用既有 deterministic serialization、identity 和 privacy helper，不新增第二套 graph、ledger、budget 或 test inventory。
- **Tests:** 覆盖 schema/validator、source/tree identity、terminal matrix、denominator、status precedence、byte-identical replay、privacy/path、无第二 aggregator 和 rollback reader；测试本身拥有独立 test receipt。
- **Data/model:** 不新增 Prisma model、迁移、数据库表、事件或学习者状态。输入、规范化 receipt 和外部 evidence reference 是不可变文件/CI artifact；不复制原始领域证据。
- **Runtime/release:** 只产生派生验证回执；receipt 产生不等于 production activation，也不暗示范围外业务、Assignment retirement 或 generated-content reconciliation 已完成。
