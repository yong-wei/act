## Why

互动课程的嵌入式 AI 面板仍走 `useInteractiveAI` 独立的传输路径。非 2xx 响应会被转换为 `AI request failed: <status>`，网络异常也会把浏览器或服务端错误文本带入 `Error.message`；`InteractiveAIPanel` 随后直接渲染该消息。已完成的 #1814 治理了独立 Copilot 和全局侧栏，但没有覆盖这个仍被生产课程使用的互动入口。

这会让学生看到英文 HTTP 技术信息，并在不同失败状态下得到没有区分度的反馈，削弱课程辅导的可恢复性。

## What Changes

- 在互动 AI 请求边界复用受治理的学生安全失败分类和中文文案。
- 保留 401、会话隔离、会话恢复不可用、限流、服务不可用和网络失败的状态差异，并提供匹配的下一步动作。
- 让互动 AI 面板只消费归一化后的学生安全信息，不渲染原始 `Error.message`。
- 增加互动课程入口的失败呈现、恢复动作和原始错误不进入 DOM 的回归。

## Capabilities

### Modified Capabilities

- `konling-agent-runtime`: 互动课程学生端失败必须遵守统一的安全呈现和恢复契约。

## Impact

- 生产代码：`src/features/interactive/hooks/useInteractiveAI.ts`、`src/features/interactive/InteractiveAIPanel.tsx` 及共享失败契约。
- 验证：互动 AI 组件/ hook 测试和至少一个真实互动课程页面的浏览器验收。
- 不新增数据源，不改变答案揭示、作答状态、会话持久化、成绩或学习画像。
