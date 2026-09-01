## Why

控灵会话详情 API 当前把持久化的 `system` 消息连同用户和助手消息一起返回浏览器，前端只在渲染前隐藏它们。学生本人或页面脚本仍可从 Network 响应读取课程、资源、路径、权威发布、数据集哈希和 Canonical ID 等服务端内部上下文，违反既有“内部上下文只保留在服务端”的会话边界。

## What Changes

- 在服务端公开会话投影中排除所有内部 `system` 上下文记录和绑定记录，只返回学生可见的 `user`、`assistant` 消息。
- 保留现有独立 `assistantBinding` 公开投影，但只包含明确允许的助手模式和受限客户端提示，不复用原始 system 消息。
- 让会话详情、更新响应和其他公开序列化调用共享同一学生安全投影，避免某个路由绕过过滤。
- 增加 API、序列化和客户端恢复回归，证明内部标识不进入浏览器响应，消息顺序、会话恢复和公开绑定保持兼容。
- 保留服务端持久化、审计、上下文去重和模型消息投影语义，不删除内部记录。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `konling-agent-runtime`: 明确公开会话 API 只能返回学生可见消息和受限公开绑定，内部 system 上下文不得进入浏览器响应。

## Impact

- Affected server projection: `src/lib/konling-conversation-library.ts`。
- Affected APIs: `/api/ai/sessions/[id]` 及复用公开会话序列化的响应路径。
- Affected client: 控灵会话恢复与消息展示继续消费学生可见消息，不再承担保密过滤责任。
- No schema migration and no change to conversation ownership, persistence, retention, model invocation or official learning records.
