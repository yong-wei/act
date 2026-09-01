<!-- openspec-buddy change_id: preserve-konling-conversations-until-governed-deletion -->

## Goal

修复控灵会话库把用户学习对话固定七天后隐藏的问题，使会话在用户删除或明确的全局保留治理执行前持续可恢复、可继续和可组织。

## Scope

- 取消会话库历史的固定七天产品到期，统一列表、读取、修改、删除和消息写入的治理保留条件。
- 幂等恢复仍存在且 `libraryVisible=true` 的旧隐藏会话；不恢复空、失败初始化或非会话库技术记录。

## Acceptance

- 超过七天但未被用户删除或治理到期的会话仍可列出、打开、继续、改名和置顶。
- PostgreSQL 迁移保留消息与时间并可安全重跑，用户隔离、显式删除和未来治理到期继续生效。

Proposal: https://github.com/yong-wei/act/tree/integration/openspec/changes/preserve-konling-conversations-until-governed-deletion
