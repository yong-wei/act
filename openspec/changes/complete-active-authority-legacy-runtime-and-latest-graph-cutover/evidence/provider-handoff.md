# Provider handoff (#1509 → #1683)

本文件闭合任务 1.1、1.3、6.1–6.3。本变更不写生产 selector、不重跑停服事务、不 `deploy:runtime`。

## 1.1 Provider 已完成且依赖已关闭

- Issue [#1509](https://github.com/yong-wei/act/issues/1509) 已 `status:archived` 并关闭（completed）。
- OpenSpec 归档：`openspec/changes/archive/2026-08-30-coordinate-latest-authority-and-active-oss-cutover/`。
- 收口 PR：[#1718](https://github.com/yong-wei/act/pull/1718) 合入 `integration`；Git 树 `authority/current.json` 对齐 PR [#1720](https://github.com/yong-wei/act/pull/1720) → `integration@179115bb40765bda55b521b15368f6211c9e07de`。
- 原生 `blockedBy`：#1683 仅被已关闭的 #1509 阻挡，认领时无 OPEN blocker。
- 本变更于 2026-08-30 由 Buddy lite 认领：`change_id=complete-active-authority-legacy-runtime-and-latest-graph-cutover`。

## 1.3 / 6.1 执行时捕获的后继与前任

不可变候选目录：`course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c5/`。

| 角色 | 身份 |
| --- | --- |
| 后继 Authority | `ctr:release:control-theory-engineering-v0.37` / `snap-e2d8b92f6095a7b79036cc0808952fd42e2077ff3b5cf0a36291fd0bc7f26aae` |
| Git/宿主机 `authority/current.json` SHA-256 | `45ac968d86c191d45aeab88ab862e49250d9a041e8e596dcda41830f1b958af6` |
| 后继 Runtime | `runtime-150a505ac26b2130278fa269f41830f83a9d97658db4afd0aedddde` |
| 10.7 事务 | `tx-7cf89677-b091-4508-80ce-c8d9fa132c8a` |
| Teaching closure | `coordinated-teaching-closure-receipt/v1` status `COMPLETE`，`zeroUnresolved=true`，receiptHash `f9eb5d70…` |
| 前任 Runtime（补偿目标） | `runtime-bb309e6a7e1ded281038c4689c98d24e78e5f46db29f7cd2ee50057` |
| 前任 Authority | v0.22 / `snap-9c4b2c1c…`（仅回滚消费，不是现行） |

公开 Schema / consumer 合同沿用既有 `act-knowledge-surface/v1` 与 Authority shard envelope；未发现需另开适配变更的不兼容。

## 6.2 一份收据下的闭合身份（manifest extension）

密封工件：`successor-runtime-manifest-extension.json`（`coordinated-runtime-manifest-extension/v1`）。

- `teachingProjectionHash` = Git `projection/current.json` 的 `projectionHash` `c9a6f33e…`
- `domainShardSetHash` = Git shards `current.json` `shardSetHash` `c462da19…`
- `prerequisitePublicationHash` = Git prerequisites `publicationHash` `d55c3ac4…`
- `consumerActivationHash` = Git consumer-activation `activationHash` `1f3e70d4…`
- `composedDomainFragmentManifestHash` = `eb4d2d63…`（运行时 composed fragments，不在本变更写入）

消费者只重开并哈希校验这些成员；缺失、混版本或 Teaching `unavailable`/`partial` 时 latest-cutover 失败关闭。

## 6.3 认领前核对

- 停服事务与最终 coordinated active receipt 由 #1509 10.7 提交；生产 readback 当时 `readyz` 200、Authority v0.37、Runtime generation 44。
- GitHub 成就：#1509 已关闭。本变更不修复、不改写其 selector。
