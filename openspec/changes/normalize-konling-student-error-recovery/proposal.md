## Why

控灵聊天使用的 AI SDK 会把非 2xx 响应正文原样放入 `Error.message`，网络失败则产生浏览器英文异常。独立 Copilot 和全局控灵侧栏直接渲染该字段，学生会看到 JSON、内部错误码、英文技术文本，并且对登录失效、会话不存在或任务上下文无效等不可直接重试的失败仍只得到“重试”按钮。

## What Changes

- 在共享控灵聊天传输边界把 HTTP、响应机器码、流错误和网络异常归一化为受限失败类别、学生安全中文文案和恢复动作。
- 禁止生产学习陪伴界面直接显示 SDK、浏览器或服务端原始 `Error.message`、响应正文和内部代码。
- 区分可重试失败与身份、会话、任务状态修复失败，为 401、404、400/409、429/503 和网络失败提供匹配动作。
- 让独立 `/ai/copilot` 和全局控灵侧栏复用同一错误投影，同时保留服务端脱敏诊断日志。
- 增加 transport/helper、组件和真实浏览器回归，覆盖 JSON 错误、英文网络异常、恢复动作和移动端布局。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `konling-agent-runtime`: 定义学生安全的共享失败投影和按失败类别匹配的恢复行为，禁止直接呈现原始技术错误。

## Impact

- Affected transport and hooks: `src/hooks/useLegacyChat.ts`、控灵会话操作错误适配。
- Affected active UI: `src/app/ai/copilot/page.tsx`、`src/components/ai/global-ai-sidebar.tsx`。
- Affected API contract: `/api/ai/chat` 的稳定公开错误码和受限学生消息；服务端诊断仍使用脱敏日志。
- No model prompt, learner evidence, conversation persistence or official learning record behavior changes.

