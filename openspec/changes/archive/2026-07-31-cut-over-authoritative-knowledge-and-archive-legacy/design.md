## Context

本轮证据已经证明 ActKG r3 修订链、正式 Bundle loader、逐跳 ReleaseSet Delta 和隔离数据库导入可以在同一 ACT capture 上重现；它随后只生成了绑定 v0.8:r3 的 3,609 项 worklist。CourseCoverage 尚无与新摘要匹配的逐项审核决定，且两个角色属于活动/评价或场景迁移能力，不能近似绑定为 Canonical 知识对象。因此当前产物是阶段性证明，不是生产权威。

## Goals / Non-Goals

**Goals:**

- 以 `resolve-then-freeze` 固定声明来源边界内的单一 ReleaseSet/Release/Bundle/Schema/Projection 身份及其 digest、import/Delta 回执和 ACT capture revision。
- 在同一隔离数据库快照中完成正式 loader、逐跳 Delta、worklist 生成和漂移拒绝验证，并留下可重放证据。
- 记录 CourseCoverage、角色 Mapping、Teaching Projection、handoff/attestation 和正式消费者仍被阻断的原因，以及生产 selector 不变事实。

**Non-Goals:**

- 不激活生产 authority、公开 candidate、任何全消费者 selector 或 Canonical writer。
- 不生成接受的 CourseCoverage、Teaching Projection、handoff 或 attestation；不把旧 Coverage verdict 复制为新 authority。
- 不建立 Legacy Archive，不执行停服、生产数据迁移、备份/回滚窗口或旧运行时退役。

## Decisions

1. **Resolve then freeze。** 先按已验证的稳定链解析唯一端点，再冻结 `releaseSetId`、`releaseId`/`releaseHash`、`bundleId`/`bundleDigest`、`schemaVersion`/`schemaSha256`、`projectionId`/`projectionDigest`、source dataset digest、accepted import receipt、每跳 Delta receipt、ACT capture revision 和 resolution digest。冻结后不得以目录名、版本号或最新扫描结果替换身份。
2. **同快照读取。** Bundle、Release、Projection、ImportReceipt、BundleReceipt、Delta 和 worklist 的输入必须来自同一隔离 schema/数据库快照并校验 capture revision；缺行、混用旧 schema、锁/Projection 错配或任何 digest 漂移都在写出前拒绝。
3. **Worklist 不是 verdict。** 3,609 项 worklist 只表达待审输入与 deterministic input digest；1,772 项只有 Canonical profile 的记录保留为 profile-only，不能据此生成 role/disposition 或 CURRENT/SHADOW CourseCoverage。旧 v0.3 决定只能作为历史检索线索，不能复制。
4. **角色类型先于 Mapping。** 九角色复核保留可行候选的审查记录，但“仿真验证与跨模型比较”必须改为活动/评价能力合同，“现代控制与船海迁移”必须改为场景迁移能力合同；两者未完成合同修订前不得绑定近似 Canonical 知识对象，也不得进入 Stage 2。
5. **所有下游保持阻断。** Teaching Projection、handoff、attestation、正式图谱/RAG/KAQ/SAR/资源/路径/学习事实消费者保持 blocked 或 Legacy；阶段快照不改变任何生产 selector，`PRODUCTION_SELECTOR_CHANGE=0`。
6. **快照可扩展但不可改写。** 新 Release 只能生成新快照及新 digest；已冻结快照的身份、成员、回执和结论不可就地修改。

## Evidence and Verification

`docs/coordination/1117/iteration-2-r3-chain-and-course-coverage-stop.md` 记录了 r3 chain、6 个 Delta、87 个隔离 migration、7/7 导入、worklist deterministic regeneration、95/95 targeted tests、typecheck 和 selector invariance。该记录保持历史原文，本 change 只引用其证据边界。不可变阶段性 receipt 位于 `course-content/authoring/knowledge/issue-1117-v08-r3-chain/metadata/declared-authoritative-snapshot-receipt.json`，纯验证器位于 `src/lib/aggregate-governance/declared-authoritative-snapshot.ts`；receipt digest 必须由验证器从除自身外的完整 payload 重算，且关键字段漂移或非空 violations 均 fail closed。

## Risks / Trade-offs

- [快照被误读为生产证明] → 在合同和回执中同时记录 blocked 状态与 selector change=0，并拒绝公开激活路径。
- [新版本漂移] → 冻结身份后逐字段比较；漂移时 fail closed，重新生成新快照而非覆盖旧快照。
- [profile-only 证据被误当作审核结论] → worklist schema 不含最终 role/disposition，并把 1,772 条作为显式未决输入。

## Migration Plan

本 change 不执行生产迁移。后续独立 change 只有在新的逐项 CourseCoverage 审核、角色合同、正式 Teaching Projection、全部消费者门禁和生产演练均完成后，才可承接最终切换。

## Open Questions

无；未决事项已经作为后续 change 的输入和阻断条件记录。
