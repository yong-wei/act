## Context

`add-konling-conversation-library` 决定控灵会话属于用户、可跨页面继续，并在用户主动删除前持续保留；统一数据治理政策可以覆盖保留期限。当前实现却沿用旧页面会话的技术 TTL：`KonlingSession.expiresAt` 为非空字段，创建路由固定设置七天，列表、详情、更新、聊天和回合声明均要求 `expiresAt > now`。

数据库迁移已经使用 `libraryVisible` 区分可用用户历史与过期、空或失败初始化会话。新原生会话默认 `libraryVisible=true`，因此可以在不恢复旧无用会话的情况下识别被固定 TTL 错误隐藏的用户历史。

## Goals / Non-Goals

**Goals:**

- 取消会话库历史的固定七天产品过期，使其持续可读、可继续和可组织。
- 保留未来全局治理为具体会话设置到期或删除的能力。
- 恢复已因旧七天期限隐藏、但仍属于会话库的用户历史。
- 保持迁移幂等、消息和时间不可变、用户隔离和显式删除语义。

**Non-Goals:**

- 不承诺供应商日志、模型缓存或所有临时 AgentSession 无限期保留。
- 不恢复 `libraryVisible=false` 的空、过期迁移候选或失败初始化会话。
- 不改变会话内容搜索、标题、置顶、工具授权或结构化成果生命周期。
- 不在本变更中制定完整平台数据保留政策。

## Decisions

### 1. Make library conversation expiry nullable

将 `KonlingSession.expiresAt` 改为可空。新建并进入会话库的原生会话写入 `null`，表示没有产品级到期时间。未来全局治理可以显式写入到期时间；运行时接受 `expiresAt IS NULL OR expiresAt > now`。

保留字段而不是删除字段，因为同一表仍可能承载受治理到期或非会话库技术记录，也为统一保留政策提供执行点。

### 2. Restore only previously visible library conversations

迁移将 `libraryVisible=true` 且具有旧固定到期时间的记录更新为 `expiresAt=null`。这些记录已经通过原会话库迁移的可用性筛选，或由原生创建流程明确进入会话库。`libraryVisible=false` 的记录保持原值，不因本次变更获得用户历史资格。

迁移不修改 `messages`、`createdAt`、`updatedAt`、`lastActivityAt`、标题、置顶和迁移来源。重复部署后结果保持不变。

### 3. Centralize active-retention filtering

列表、详情、更新、删除、聊天会话校验和并发回合声明使用同一可读条件：当前用户、`libraryVisible=true`，且没有治理到期或治理到期仍在未来。避免部分路由支持无到期值而其他写入继续返回 404。

客户端 `expiresAt` DTO 改为可空，界面不得把 `null` 显示为异常或“永久保证”；它只表示当前没有已安排的治理到期。

### 4. Keep explicit deletion authoritative

用户确认删除仍删除会话和受其拥有的消息/工具记录；已应用到其他领域的结构化业务成果继续独立保留。恢复迁移不得重建已经删除的行。

## Risks / Trade-offs

- [Risk] 数据量随会话历史增长。 -> 本变更恢复已约定的产品语义；容量、归档和统一保留应由可审计的全局治理政策解决，不使用隐藏的七天删除替代。
- [Risk] 迁移误恢复旧无用会话。 -> 只更新 `libraryVisible=true`，保留原迁移对空、过期和失败初始化会话的排除结果。
- [Risk] 某一路由仍使用 `expiresAt > now`。 -> 提取共享条件并覆盖列表、详情、修改、删除、聊天、消息和回合并发测试。
- [Risk] 真实生产数据规模导致迁移锁表。 -> 使用单列可空变更和受索引/布尔条件约束的幂等更新，在生产导出数据库上演练执行时间和计数。

## Migration Plan

1. 在真实 PostgreSQL 导出恢复环境统计 `libraryVisible`、已过期和未过期会话数量。
2. 将 `expiresAt` 改为可空，并把所有 `libraryVisible=true` 记录的旧固定期限清为 `null`。
3. 部署使用统一可读条件和新会话 `expiresAt=null` 的应用代码。
4. 核验恢复数量、用户隔离、消息哈希、列表/读取/发送、删除和无用会话排除。
5. 记录回滚方案：应用回退前不得重新施加任意七天期限；如必须回退，先制定不丢失已恢复会话的临时未来期限。

## Open Questions

None. 未来全局保留期限属于独立治理变更，不应在本修复中重新写死。
