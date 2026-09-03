## Why

独立 `/ai/copilot` 页面仍把消息保存在 React 内存中，直接调用 `/api/ai/chat` 且不携带 `conversationId`；刷新、离开后重开或点击“清空”都会丢失或仅隐藏当前消息。这与平台已经完成的用户级控灵持久会话和跨页面连续性不一致，也使作品集反思、证据复盘等学习陪伴过程无法恢复和追溯。

## What Changes

- 让认证学生的独立 Copilot 复用现有控灵会话库、会话身份、消息持久化和跨页面上下文追加能力。
- 页面发送消息前建立或选择受当前用户拥有的会话，并向 `/api/ai/chat` 传递服务端可验证的 `conversationId`。
- 页面加载、刷新和重新打开时恢复活动会话的可见消息；恢复失败、未登录和空会话使用明确状态，不静默伪装成无历史。
- 将当前“清空本地消息”改为真实的新建空白会话或确认删除操作，不允许只修改浏览器状态而保留隐藏的服务端历史。
- 保持作品集反思和 Evidence Copilot 的服务端任务契约、候选草稿和显式保存边界；会话持久化不自动写入正式学习记录。
- 增加会话归属、刷新恢复、切换竞态、任务态上下文、桌面端和 320px 浏览器验收。

## Capabilities

### New Capabilities

- `standalone-copilot-conversation`: 定义独立 Copilot 页面使用用户级持久会话、恢复、切换和真实清空的产品合同。

### Modified Capabilities

- `konling-agent-runtime`: 将独立 Copilot 纳入既有会话库和跨页面上下文连续性，同时保留会话归属与任务上下文校验。

## Impact

- Affected page: `src/app/ai/copilot/page.tsx`。
- Reused client and API surfaces: `src/hooks/useKonlingConversationLibrary.ts`、`/api/ai/sessions/**`、`/api/ai/chat`。
- Focused client, route and Playwright tests are required; no new database table, LearningFact writer, scoring rule or draft-promotion path is introduced.
