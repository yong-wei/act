## 1. Reproduce the public-response leak

- [x] 1.1 Add a serialization regression containing user, assistant, page-context system and assistant-binding system messages with unique internal canary values.
- [x] 1.2 Add authenticated conversation-route coverage that inspects the raw JSON response and proves system roles, content, metadata and internal identifiers are currently reachable before the fix.

## 2. Enforce the server-owned public projection

- [x] 2.1 Update the shared conversation serializer to derive the bounded public assistant binding from complete server-owned history while returning only user and assistant messages.
- [x] 2.2 Preserve approved assistant citations, revisions, corrections and public structured actions while continuing to exclude private tool parts and metadata.
- [x] 2.3 Audit every public caller of the serializer and remove any route-specific path that can return the unfiltered persisted message array.

## 3. Verify compatibility and security boundaries

- [x] 3.1 Prove conversation GET and applicable update responses contain no internal canary values while preserving visible message order and the allowed assistant binding.
- [x] 3.2 Prove standalone Copilot and shared conversation-library recovery still restore the same student-visible history without relying on client-side filtering for confidentiality.
- [x] 3.3 Run focused Konling library, route and client tests, full TypeScript checking, strict change and repository OpenSpec validation, and `git diff --check` on the final implementation revision.
- [x] 3.4 Record an authenticated raw-response verification using browser Network inspection or an equivalent route-level capture; no Commercial UI screenshots are required unless implementation changes visible UI.

## Evidence Notes

- 1.1/3.1 序列化回归：`src/lib/__tests__/konling-conversation-library.test.ts` 新增 canary 用例，覆盖 classId/resourceId/pathNodeId/releaseSetId/releaseId/projectionDigest/sourceDatasetHash/Canonical ID 与 system 记录标记，断言 `JSON.stringify` 输出不含任何 canary，user/assistant 顺序与受限 `assistantBinding` 保持。
- 1.2/3.4 路由级原始响应捕获：`src/lib/__tests__/konling-session-detail-route.test.ts` 直接调用 `GET /api/ai/sessions/[id]` 处理器，断言 200 响应原始 JSON 无 system 角色与 canary，另覆盖 401/404。等价于浏览器 Network 抓包，无可见 UI 变化故无截图。
- 2.1/2.2 `serializeKonlingConversation()` 在共享边界过滤 `user`/`assistant`，`assistantBinding` 继续从完整服务端历史派生；`projectPublicKonlingMessage()` 的引用/修订/更正/结构化动作白名单与工具部件过滤保持不变（既有 41 用例全部通过）。
- 2.3 调用方审计：`sessions`、`sessions/[id]`（GET/PATCH）、`sessions/[id]/messages`、`chat` 全部经 `serializeKonlingConversation`；其余 `messages:` 用法均为请求体解析或 `streamText`/工具执行的服务端输入，无公开旁路。
- 3.2 恢复兼容：`standalone-copilot-conversation`、`useKonlingConversationLibrary`、`konling-conversation-library-ui`、`useInteractiveAI` 共 24 个恢复/展示用例通过；服务端输出仅含 user/assistant，客户端 `visibleKonlingMessages` 对其恒为恒等映射（不再承担保密职责，保留为显示层兜底）。
