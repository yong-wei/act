## Why

C28 之后，平台仍有 `useLegacyChat`、`ai-message-compat`、`ai-stream-compat` 以及 copilot/global sidebar 等旧桥接。它们把相同的会话、消息和流语义重新包装到各自的状态机，导致持久会话、interactive resource scope、角色权限和 provider runtime 之间存在多套入口。

本 change 退役这些 legacy chat bridges，把保留的用户表面迁移到已经存在的 Konling session/AI route 和 C28 canonical provider seam。退役的是派生桥接，不是用户可见的 AppShell、角色工作区或受治理对话能力。

## What Changes

- 将仍在使用的 Copilot、global AI/sidebar 和 interactive AI caller 接到既有 session/message API 与 canonical provider/stream runtime。
- 删除无调用者的 `useLegacyChat`、message/stream compatibility facade 及重复的 one-turn chat wiring；保留必要的 ingress adapter 时明确其非权威与删除条件。
- 让同一会话边界、资源/课程作用域、消息顺序、stream terminal/error、retry/cancel 和隐私脱敏适用于所有保留入口。
- 保留 SSR、AppShell、角色权限、teacher/student projection、Konling session persistence 及 AI 仅作学习建议的语义。
- 增加静态 import、mounted route、refresh/resume、resource switch、stream failure 和 keyboard/focus 回归，证明旧 bridge 不可达且没有第二套 conversation store。

## Capabilities

### New Capabilities

- `legacy-chat-bridge-retirement`: 规定旧 chat hook/facade 的迁移、删除、兼容保留和会话边界。

### Modified Capabilities

None. `interactive-ai-context-continuity` 和 `konling-agent-runtime` 的既有要求继续有效；本 change 只消除重复入口，不削弱持久会话、服务端上下文或工具权限。

## Impact

- 主要范围：`src/hooks/useLegacyChat.ts`、`src/lib/ai-message-compat.ts`、`src/lib/ai-stream-compat.ts`、`src/features/ai/copilot-panel.tsx`、`src/components/ai/*sidebar.tsx`、`src/features/interactive/hooks/*` 及相关 `/api/ai` routes/tests。
- 依赖 C28 `consolidate-ai-provider-and-stream-runtime` 的 canonical provider/stream contract。
- 不新增 conversation store、AI workspace、shell、业务事实写入口或 provider configuration source；不改 PlatformSetting、SSR/R3F、AppShell/role boundary 或 release/rollback validator。
- C30 依赖本 change 与各领域 canonical owner 的边界收口。
