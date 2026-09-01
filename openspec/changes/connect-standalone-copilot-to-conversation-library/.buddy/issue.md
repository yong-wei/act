<!-- openspec-buddy change_id: connect-standalone-copilot-to-conversation-library -->

## Goal

让独立 `/ai/copilot` 页面复用现有控灵持久会话库，使学生的连续问答在刷新、离开后重开和跨页面继续时可以恢复，而不是只存在于页面内存。

## Scope

- 为认证学生接入受用户归属约束的会话创建、选择、消息恢复、持久化发送、新建和确认删除。
- 保持作品集反思、Evidence Copilot 和普通聊天的服务端任务与证据边界，不把会话内容自动写入正式学习记录。

## Acceptance

- `/ai/copilot` 的消息请求绑定可验证的 `conversationId`，刷新和重开恢复同一可见历史，恢复失败不伪装为空会话。
- 本地“清空”被真实会话生命周期替代，并通过归属隔离、任务态重校验、桌面端和 320px 浏览器验收。

Proposal: https://github.com/yong-wei/act/tree/integration/openspec/changes/connect-standalone-copilot-to-conversation-library
