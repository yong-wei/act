## Context

控灵把页面上下文和助手绑定以 `system` 角色写入 `KonlingSession.messages`，用于跨页面恢复、审计、上下文身份去重和服务端提示构造。`serializeKonlingConversation()` 当前对全部持久化消息调用公开消息投影；该投影清理部分 metadata 和工具部件，但保留原始 `role` 与 `content`。`GET /api/ai/sessions/[id]` 因此把内部记录发送给浏览器，React Hook 随后才用 `visibleKonlingMessages()` 隐藏它们。

既有领域定义已经说明 system 上下文只保留在服务端，且客户端显示过滤不是安全边界。本变更需要收敛公开 DTO，而不能删除持久化记录或改变模型调用历史。

## Goals / Non-Goals

**Goals:**

- 公开会话响应只包含学生可见的用户和助手消息。
- 阻止原始 system 内容、内部上下文 metadata 和治理标识进入浏览器。
- 保持学生可见消息顺序、公开结构化动作和受限 `assistantBinding` 兼容。
- 让所有公开会话序列化路径复用同一服务端边界，并以回归测试证明原始响应已脱敏。

**Non-Goals:**

- 不删除或改写数据库中的内部上下文记录。
- 不改变服务端 system prompt、模型消息投影或供应商调用合同。
- 不改变会话归属、保留、删除、标题、置顶或工具审批生命周期。
- 不在本变更中建立通用提示词泄露检测或模型输出审查系统。

## Decisions

### 1. Filter internal roles in the server-owned public projection

`serializeKonlingConversation()` 继续接收完整内部消息，以此派生 `assistantBinding`；返回 `messages` 前只选择 `user` 和 `assistant` 角色，再执行现有公开消息投影。这样安全边界位于所有调用者共享的序列化函数，而不是依赖每个页面自行过滤。

备选方案是保留 system 消息并清空 content，或继续由客户端过滤。前者仍暴露内部状态形态并扩大 DTO，后者无法阻止 Network 响应和页面脚本读取，因此均不采用。

### 2. Keep assistant binding as a separate bounded projection

公开 `assistantBinding` 继续从完整内部消息中读取，但只通过现有受限规范化函数返回允许的模式与提示字段。原始绑定 system 消息、身份字段和 metadata 不进入 `messages`。

若先删除内部消息再派生绑定，会破坏会话恢复的任务态；若直接返回原始绑定记录，则重新引入泄露。因此先从完整记录派生受限 DTO，再独立过滤公开消息。

### 3. Treat raw API payload inspection as the acceptance boundary

测试直接断言序列化结果和会话详情 JSON，而不是只断言聊天气泡不可见。测试使用明确的内部 canary 值覆盖 `classId`、`resourceId`、`pathNodeId`、发布身份、投影摘要、数据集哈希和 Canonical ID，并证明这些值不出现在序列化 JSON 中。

同时验证用户和助手消息顺序、公开结构化动作及合法 `assistantBinding` 不回归。

## Risks / Trade-offs

- [Risk] 过滤顺序错误导致助手绑定丢失。 -> 从完整内部消息派生绑定，再过滤公开 `messages`，并添加绑定恢复回归。
- [Risk] 某个路由自行构造 DTO 绕过共享序列化。 -> 盘点会话详情和更新响应，路由测试直接检查原始 JSON。
- [Risk] 助手消息中的私有工具部件继续泄露。 -> 保留并验证现有 `projectPublicKonlingMessage()` 的工具部件和 metadata 白名单行为。
- [Risk] 前端依赖 system 消息数量或位置。 -> 现有 UI 已只渲染 user/assistant；增加会话恢复测试证明可见历史保持一致。

## Migration Plan

1. 调整共享公开序列化函数并补充 helper 回归。
2. 覆盖会话详情及适用更新响应的原始 JSON，确认内部 canary 不可见。
3. 验证独立 Copilot 和共享会话库恢复的可见消息顺序与助手绑定。
4. 无数据库迁移；回滚仅恢复旧 DTO，但会重新暴露内部上下文，因此仅用于紧急诊断并应立即重新部署修复。

## Open Questions

None. 内部 system 记录的服务端持久化和学生公开消息的边界已由既有领域文档确定。

