## Why

教材资源辅导入口在会话库和活动会话尚未加载时，把空的 `activeAssistantBinding` 当作“不存在匹配会话”，立即创建新会话。初始资源 binding 又只写入 `sessionStorage`，服务端空会话无法在刷新后恢复该身份。学生每次刷新或重新打开同一教材单元都可能新增一个空会话，并失去原版本绑定对话的连续性。

## What Changes

- 资源辅导入口等待会话库和绑定恢复完成后，再决定选择精确匹配的既有会话或进入待提问空白态。
- 以服务端持久化并重新验证的 `resourceId`、`sourceRevision`、`unitId`、`contentHash` 和可选 `anchorId` 查找当前用户匹配会话，不以客户端 `sessionStorage` 作为恢复真源。
- 没有匹配历史时不在页面挂载阶段写入空会话；首轮提问时建立受治理会话并在模型回答前持久化完整资源绑定。
- 防止延迟的会话列表、详情或创建请求覆盖较新的页面身份和用户选择。
- 保持不同版本、单元、锚点和用户会话隔离，不把同标题或当前最新版本当作匹配。
- 增加慢速恢复、刷新重开、精确匹配、版本漂移、无重复空会话及桌面端/320px 浏览器验收。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `governed-resource-page-coaching`: 明确资源辅导先恢复精确版本绑定会话，未确认无匹配前不得创建会话。
- `konling-agent-runtime`: 提供服务端可恢复的会话绑定摘要或等价精确匹配能力，并保证首轮回答前绑定持久化。

## Impact

- Affected UI/hook: `src/components/ai/global-ai-sidebar.tsx`、`src/hooks/useKonlingConversationLibrary.ts`、`src/lib/textbook-resource-coach/session-switch.ts`。
- Affected session APIs/runtime: `/api/ai/sessions/**`、资源辅导 binding 序列化与校验。
- No scoring, learner portrait, LearningFact, textbook authority or citation identity rules are changed.
