## Why

互动课程中的 AI 学伴每轮请求只发送当前问题，虽然页面本地维护了消息列表、资源身份和课程进度，但这些信息没有形成连续的服务端会话上下文。学生无法围绕同一个误解进行多轮追问，AI 也无法判断学生正在课程中的哪一步；刷新或重新打开资源后，对话更会丢失。这个缺陷直接削弱了平台“基于真实学习过程提供陪伴”的核心价值。

## What Changes

- 为互动课程 AI 学伴建立可恢复的、多轮对话上下文。
- 将当前互动资源、课程步骤、进度和完成状态作为受约束的教学上下文提供给 AI。
- 复用既有会话身份、权限和持久化治理，避免互动课程形成一套孤立的聊天记录。
- 在刷新、重新打开、切换页面和进度变化时保持正确的会话边界与上下文更新。
- 保持 AI 回答为学习辅助，不自动写入官方成绩、排行榜、LearningFact 或学习画像。

## Capabilities

### New Capabilities

- `interactive-ai-context-continuity`: 互动课程 AI 学伴的多轮消息、资源边界和课程进度上下文连续性。

### Modified Capabilities

<!-- No existing requirement is being changed directly; the new capability defines the missing contract. -->

## Impact

- `src/features/interactive/hooks/useInteractiveAI.ts`、`InteractiveProvider.tsx` 与 `InteractiveAIPanel.tsx`。
- `/api/ai/chat` 的互动课程请求解析、会话上下文和模型消息构造。
- 既有用户级控灵会话与互动课程追踪/进度边界。
- 需要补充客户端、服务端和浏览器回归，覆盖第二轮追问、刷新/重开、进度变化、未认证开发入口和跨资源边界。
