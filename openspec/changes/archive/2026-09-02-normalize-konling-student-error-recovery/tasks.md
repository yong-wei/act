## 1. Establish the shared failure contract

- [x] 1.1 Add red tests for JSON errors, plain-text errors, empty responses, stream failures and rejected fetch calls, including internal canary strings that must never reach student output.
- [x] 1.2 Define the bounded failure categories, allowlisted server codes, Simplified Chinese copy and state-appropriate recovery descriptors.
- [x] 1.3 Align `/api/ai/chat` public failure responses with stable codes while keeping provider and exception details in redacted server diagnostics only.

## 2. Integrate active student surfaces

- [x] 2.1 Normalize failures in the shared `useLegacyChat` transport boundary without exposing raw `Error.message` to presentation components.
- [x] 2.2 Update `/ai/copilot` to handle authentication, missing conversation, invalid task context, state conflict and retryable service failures with matching actions.
- [x] 2.3 Update the global Konling sidebar status and error regions to consume the same bounded failure model and preserve accessible announcements.
- [x] 2.4 Audit production imports and avoid expanding the change to unreferenced legacy components unless they share the active adapter automatically.

## 3. Verify the student recovery journey

- [x] 3.1 Add component tests proving raw JSON, machine codes, provider names and browser exception text never appear in the active DOM.
- [x] 3.2 Add browser acceptance for representative 401, 404, 409, 503 and network failures, proving each action changes or repairs the required state.
- [x] 3.3 Capture revision-bound 1440px and 320px evidence for standalone Copilot and the global sidebar error states, including keyboard focus and no horizontal overflow.
- [x] 3.4 Run focused transport, route, component and Playwright tests, full TypeScript checking, strict change and repository OpenSpec validation, and `git diff --check` on the final revision.

## Evidence Notes

- 1.1/1.2 共享失败契约：`src/lib/konling-chat-failure.ts` 定义 8 类失败类别、稳定码 allowlist（AI_SERVICE_UNAVAILABLE、INVALID_AI_TASK_CONTEXT、UNAUTHORIZED、CONVERSATION_NOT_FOUND 等）、状态回退与学生安全中文文案；未知值 fail closed 为通用错误。单测 `src/lib/__tests__/konling-chat-failure.test.ts`（8 用例）覆盖 JSON、纯文本、空响应、fetch rejection 与 canary 不进输出。
- 1.3 `/api/ai/chat` 非 2xx 响应审计：全部为静态稳定串（未授权/Missing messages/INVALID_AI_TASK_CONTEXT/Conversation not found/INTERACTIVE_AI_RESOURCE_MISMATCH/AI_SERVICE_UNAVAILABLE/AI 服务未配置）+ 语义化状态码，无动态异常正文；供应商与异常细节仍只进 `summarizeAIChatError` 脱敏诊断。客户端按「码优先、状态回退」分类，无需改动服务端契约。
- 2.1 `useLegacyChat` 接入 `createKonlingSafeFetch`：非 2xx 与网络异常在共享传输边界转换为 `KonlingChatFailureError`（safe message + category），`error` 出口统一为归一化错误；发送失败时恢复未送达输入。会话库 `readJson` 同步归一化，使两界面的 `conversationError.message` 与全部 `cause.message` 站点自动脱敏。
- 2.2/2.3 `/ai/copilot` 与全局侧栏：错误区改为受限失败模型 + `KonlingChatFailureActions`（401→重新登录；404→刷新会话/开启新对话；400/409→刷新任务状态；429/503/网络→稍后重试），错误块渲染在消息分支之外，会话刷新清空消息后仍可见；侧栏 sr-only 状态播报改用安全文案。
- 2.4 消费者审计：`useLegacyChat` 的 4 个消费者中 `copilot-panel.tsx`、`konling-sidebar.tsx` 为遗留组件，经由共享传输边界自动脱敏，未单独改造；两活动界面为主要改动面。
- 3.1 组件测试：`global-ai-sidebar-presentation.client.test.tsx` 新增用例断言 canary/机器码/供应商名/英文异常/「出错了」均不出现在 DOM，且各失败类别渲染匹配恢复按钮；`useLegacyChat.test.ts` 补源级断言。
- 3.4 Commercial UI governance 门禁在本变更与干净 integration 基线上均以同一组 4 项 `incomplete-evidence`（含 `/ai/copilot` 可访问性证据缺失的既有登记缺口）失败，属基线既有债务，非本变更引入；已如实记录为残余风险。本变更自身证据（1440/320 截图、焦点、无横向溢出断言）在 Playwright 验收中闭合。
- 3.2/3.3 浏览器验收：`tests/konling-student-error-recovery-1814.spec.ts`（10 用例）覆盖 /ai/copilot 与全局侧栏的 401/404/409/503/网络中断，验证安全文案、匹配动作、键盘焦点、输入保留、1440/320 无横向溢出；证据截图入 `artifacts/commercial-ui/konling-student-error-recovery-1814/`。
