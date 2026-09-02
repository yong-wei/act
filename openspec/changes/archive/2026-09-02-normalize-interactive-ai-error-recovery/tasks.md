## 1. Reproduce the bypass

- [x] 1.1 Add a hook regression for generic non-2xx and network failures that records the current raw message path.
- [x] 1.2 Add a component regression proving an interactive panel does not render a status code, JSON body, provider detail or English browser error.

## 2. Normalize the interactive boundary

- [x] 2.1 Route `useInteractiveAI` HTTP and network failures through the shared student-safe failure contract.
- [x] 2.2 Preserve session-isolation and recovery-unavailable semantics and map them to the existing interactive recovery state.
- [x] 2.3 Render only safe copy and a matching recovery action from `InteractiveAIPanel`.

## 3. Verify the student workflow

- [x] 3.1 Add a real interactive-course browser regression for failure copy, recovery action, focus and 320px layout.
- [x] 3.2 Prove successful streaming replies and recovered history remain unchanged.
- [x] 3.3 Run focused tests, related Konling/interactive tests, typecheck, strict OpenSpec validation and `git diff --check`.

## 完成记录

- 1.1 复现证据：变更前 `useInteractiveAI` 对通用非 2xx 抛出 `AI request failed: <status>`（含原始状态码），网络异常保留原始 `Error.message`（如浏览器英文异常），`InteractiveAIPanel` 直接渲染 `ai.error.message`。回归：`src/features/interactive/hooks/__tests__/useInteractiveAI.test.tsx` 新增 503（含 `INTERNAL-STACK-CANARY-1870 SiliconFlow` trace）与 `Failed to fetch` 两类用例，断言 hook 离开边界前 `error` 已是 `{category, message}` 安全投影且不含原始状态码/响应体/供应商/英文异常。
- 1.2 组件回归：`src/features/interactive/__tests__/interactive-ai-panel.test.tsx` 新增 service-unavailable/conversation-missing/auth-required/state-conflict 四类渲染用例，断言 `role="alert"`、`data-interactive-ai-error` 分类、匹配恢复动作与 `AI request failed`/`409`/`INTERACTIVE_AI_RESOURCE_MISMATCH` 不进 DOM。
- 2.1 hook 边界：`/api/ai/chat` 的网络拒绝转 `network-unavailable`；通用非 2xx 读响应体经 `classifyKonlingChatFailure` 归类（稳定错误码优先，未知 fail closed 为 `unknown`）；`KonlingChatFailureError` 增加可选自定义消息参数（向后兼容，既有调用方不变）。`InteractiveAIContextValue.error` 类型收窄为 `KonlingChatFailure | null`。
- 2.2 会话语义保留：409 仍清空会话引用并重置消息列表，404（带会话）仍置 `recoveryStatus='unavailable'`，两处与恢复加载/不可用守卫消息改经失败对象承载原中文文案；`recover()` 失败同样落 `conversation-missing` 投影。
- 2.3 面板只渲染失败对象的安全文案 + 匹配动作：auth-required→重新登录（/login）、conversation-missing→恢复会话（retryRecovery）、state-conflict→重新提问（聚焦输入）、其余（rate-limited/service-unavailable/network-unavailable/unknown/task-context-invalid）→稍后重试（聚焦输入）。动作只改变下一次请求条件（新会话/重新登录/重新聚焦），不重放失败请求。
- 3.1 浏览器回归：`tests/interactive-ai-error-recovery-1870.spec.ts` 在真实互动课程入口 `/interactive-learning/courses/unit-2-1-modeling-language/student/demo`（页内 AI 步骤）验证 503（含 canary）、网络中断、409 隔离三类的安全文案/动作/无原始泄露，1440 与 320 双视口含恢复按钮焦点与横向溢出检查，另含失败→恢复→助手回答成功且错误区消失的闭环用例。5/5 通过，截图证据在 `artifacts/commercial-ui/interactive-ai-error-recovery-1870/`。
- 3.2 成功链路：hook 既有「恢复受治理历史 + 仅发送当前问题 + 隔离重置」用例与面板「recovered history」用例原样通过；浏览器闭环用例验证流式回答（`0:"..."` + `X-Interactive-AI-Session: recoverable`）渲染且 `[data-interactive-ai-error]` 清空；`tests/preserve-interactive-ai-context.spec.ts` 字面量契约通过。
- 3.3 聚焦 vitest（hook 6 + 面板 6 + konling-chat-failure + legacy-chat-bridge-retirement + ai-task-boundary-ui-source，共 27 用例）通过；`npm run typecheck` exit 0；`openspec validate normalize-interactive-ai-error-recovery --type change --strict` 通过；`git diff --check` 通过。
