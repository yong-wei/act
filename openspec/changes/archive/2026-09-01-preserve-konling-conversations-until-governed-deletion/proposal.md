## Why

控灵会话库的现行规格和领域决策要求用户会话在主动删除或全局保留治理执行前持续可用，但新建 `/api/ai/sessions` 会话仍被写入固定七天 `expiresAt`，所有列表、读取和消息写入也排除已到期记录。学生连续学习对话因此会在第八天无提示消失，置顶、改名和跨页面恢复同样失效。

## What Changes

- 将进入控灵会话库的用户会话与临时运行会话 TTL 分离；持久会话默认不设置产品级固定到期时间。
- 调整会话 schema、DTO、创建、列表、读取、修改、删除、消息写入和回合声明，使无到期时间的会话保持可用，同时仍尊重未来由全局治理明确设置的到期时间。
- 幂等恢复仍保存在数据库中、`libraryVisible=true` 且仅因旧七天期限被隐藏的会话，不重写消息、标题、置顶或原始时间。
- 保留旧迁移中 `libraryVisible=false` 的过期、空或失败初始化会话，不把不可用技术会话批量恢复为用户历史。
- 保持用户确认删除、用户归属、跨页面上下文、工具记录和结构化业务成果边界。
- 增加真实 PostgreSQL 迁移、到期时间边界、历史恢复、列表/读取/发送和浏览器回归。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `konling-agent-runtime`: 明确会话库历史不受固定七天产品 TTL 约束，并定义无到期、全局治理到期和旧隐藏会话恢复语义。

## Impact

- Affected schema and migration: `prisma/schema.prisma`、新的 PostgreSQL migration。
- Affected APIs/runtime: `/api/ai/sessions/**`、`/api/ai/chat`、`src/lib/konling-conversation-library.ts`、客户端会话 DTO。
- Existing conversation deletion, authorization, message ordering and independently persisted artifacts remain unchanged.
