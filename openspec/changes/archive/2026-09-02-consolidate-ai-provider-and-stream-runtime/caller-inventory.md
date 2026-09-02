# C28 caller inventory 与 handoff 证据

绑定修订：claim branch `consolidate-ai-provider-and-stream-runtime` 实现 HEAD（基于 `2d2de1002a`，C24 合并后 integration）。

## 1.1 Caller 矩阵（Web / 测试 / tooling 图）

静态 import、动态 `import()`、`vi.mock` 字符串与 scripts 相对路径全量扫描结果：

| 旧入口 | 迁移前 caller | 处置 |
|---|---|---|
| `src/lib/ai-client.ts`（provider 函数） | api/ai/chat、check-modeling、sessions/[id]/messages、simulation/cruise-consistency-comment、cruise-summary-insight、data-governance/growth-evaluation + 3 测试 | → `src/lib/ai/provider-runtime.ts`（唯一 provider runtime 入口） |
| `src/lib/ai-client.ts`（提示词） | api/ai/chat、hooks/useLessonAI、resources/widgets/widget-props | → `src/lib/ai/lesson-prompts.ts`（教学提示词，非 provider 语义） |
| `src/lib/ai-message-compat.ts` | api/ai/chat、sessions/[id]/messages、hooks/useInteractiveAI、useKonlingSession、useLegacyChat、konling-conversation-library、konling-structured-action-runtime + 3 测试 | → `src/lib/ai/message-compat.ts`（纯移动，逻辑零变化） |
| `src/lib/ai-stream-compat.ts` | hooks/useLessonAI、useInteractiveAI（src/hooks 与 features/interactive 两处）、resources/control-odyssey + 1 测试 + 1 script | → `src/lib/ai/stream-compat.ts`（纯移动 + 删除零 caller 的 `extractAITextFromStreamChunk` alias） |
| `src/features/interactive/hooks/ai-stream.ts` | features/interactive/hooks/useInteractiveAI（相对路径） | **删除**（纯 re-export alias，caller 直连 `@/lib/ai/stream-compat`） |

`src/lib/ai-client.ts`、`src/lib/ai-message-compat.ts`、`src/lib/ai-stream-compat.ts` 删除后旧路径全仓库零引用（含 vi.mock 与动态 import）。

## 既有 canonical 事实（本 change 固化，不重建）

- Provider 选择 / 能力门控：`provider-settings.ts`（PlatformSetting 真源）+ `model-provider-compatibility.ts`（matrix + `selectModelProvider`）。
- Adapter：`provider-registry.ts` + `providers/{openai-compatible,siliconflow}.ts`（Vercel AI SDK）。
- 规范化：`normalizeProviderResponse` / `normalizeProviderStreamEvent`（OpenAI 与 Anthropic compatible 共享 `NormalizedAIResponse` / `NormalizedAIStreamEvent` 契约，恰好一次转换）。
- 脱敏：`redactProviderError`（Bearer/sk-/api_key + 500 字符上界），生产 callers：api/ai/chat、sessions messages、admin ai-settings/test、math-document-grading。

## 1.2 Characterization fixtures

既有 10 项（tool calls、citations、streaming deltas、DSML malformed、dedupe、redaction、capability 选择）+ 本 change 新增 `maps terminal stream states and withholds malformed frames`：双 provider finish 状态统一为 `message_stop`、`message_start` 透传、未知/畸形帧一律 `null`（不部分投影）、非 Error 输入与超长诊断脱敏有界。

## 1.3 配置真源

`PlatformSetting`（`ai_provider_settings` key）+ capability matrix 为唯一配置权威；`set-ai-provider-qwen-default.test.ts` 已证明 env fallback 不越过持久化选择（"writes Qwen even when env fallback would fill a custom model"）。本 change 未新增任何平行配置源；`ai-runtime-business-isolation.test.ts` 进一步断言 owner 内数据库访问仅限 `provider-settings.ts`。

## 3.1 Advisory 隔离回归

新增 `src/lib/__tests__/ai-runtime-business-isolation.test.ts`：
- `src/lib/ai/**` 不 import `@/features/*`（AI runtime 构造上无法触达课程/评估/LearningFact/画像/发布/生产 selector 写入）。
- owner 内 `@/lib/prisma` 访问仅限 `provider-settings.ts`（配置）。

## 3.2 未改变面

AppShell、角色检查、SSR/R3F 边界、release/rollback validator 无 diff（本 change 仅移动入口与更新 import）；ingress schema、timeout、Abort、审计行为零变化。

## 验证

- 直接相关 8 文件 89 测试全过；广域 lib/admin/smart-lesson-plan/hooks/interactive/data-governance 套件中 8 个失败经 stash 基线对比全部为既有失败（与 diff 无关）。
- `rtk npm run typecheck` 0 错误；`rtk npm run lint` 0 warning；`tsx scripts/tests/test-interactive-ai-stream.ts` 通过。

## Rollback

恢复本提交删除的四个文件（ai-client.ts、ai-message-compat.ts、ai-stream-compat.ts、interactive/hooks/ai-stream.ts）与全部 import 映射；不回滚 PlatformSetting、provider matrix、业务事实或生产 selector。

## C29 handoff

- Canonical 入口：`@/lib/ai/provider-runtime`（模型/绑定/可用性）、`@/lib/ai/message-compat`（消息转换）、`@/lib/ai/stream-compat`（UI stream 文本读取）。
- C29（retire-legacy-chat-bridges）可基于上述稳定 seam 清理 `useLegacyChat` 等遗留桥接。
