# C29 bridge inventory 与 handoff 证据

绑定修订：claim branch `retire-legacy-chat-bridges` 实现 HEAD（基于 `5b9c344cda`，C28 合并后 integration）。

## 1.1 Caller 矩阵（before → after）

| Bridge | 迁移前 caller | 处置 |
|---|---|---|
| `useLegacyChat`（`src/hooks/useLegacyChat.ts`） | copilot page/panel、global/konling sidebar（4 个保留 surface，全部 `api: '/api/ai/chat'`） | **保留为 documented bounded ingress adapter**：只做 legacy Message/handleSubmit 形状 → canonical `@ai-sdk/react useChat` 转换；不含会话 store、provider 选择、业务事实（头注释记录非权威与删除条件） |
| `useKonlingSession`（非 local 版，服务端 SWR 会话 hook） | 零 caller（生产与测试均零） | **删除**。replacement 是既有 `/api/ai/sessions` route contract 本身；不引入替代 facade |
| `useLocalKonlingSession` | `useInteractiveAI`（bounded 历史缓存） | 保留（interactive 资源页显式支持的 bounded history；正式会话真源在服务端） |
| message/stream compat | C28 已收敛入 `src/lib/ai/` owner | 本 change 无新增 caller，路径契约由 C28 归档持有 |

## 1.3 Bridge 权威审计

- `useLegacyChat`：状态机属于 AI SDK `useChat`；不持久化会话（`legacy-chat-bridge-retirement.test.ts` 断言无 localStorage/indexedDB/prisma/@/features/provider import）。
- 4 个保留 surface：单一 endpoint `/api/ai/chat`（服务端 session/message 合同 + C28 canonical runtime）；global-ai-sidebar 的 localStorage 只存服务端会话 id 指针（resume 机制），不存消息内容。
- copilot page 会话：`useKonlingConversationLibrary`（服务端 conversation 真源，既有 standalone 测试覆盖 hydrate/resume）。
- interactive AI：server-validated resource session（`interactive-ai-context` 的 course/page 身份与 resource 隔离，既有测试覆盖）。

## 行为回归映射（1.2 / 2.4）

| 验收行为 | 证据 |
|---|---|
| persisted session resume / refresh | `standalone-copilot-conversation.test.ts`（hydrate + conversation id 绑定）+ `global-ai-sidebar-presentation`（恢复/remount） |
| resource switching 隔离 | `interactive-ai-context.test.ts`（course/page 身份、mismatch 不进入当前历史）+ `resource-identity.ts` |
| stream terminal/error、retry/cancel | `useLegacyChat.test.ts`（失败归一化、pending input 恢复）+ sidebar presentation（lost response retry、Escape/backdrop）+ `konling-chat-failure.test.ts` |
| duplicate-send | 新增 `suppresses duplicate sends while a turn is submitted or streaming` |
| focus/keyboard | sidebar presentation 12 项（Tab 圈闭、焦点归还、drawer inert） |

## 3.2 静态契约

新增 `src/lib/__tests__/legacy-chat-bridge-retirement.test.ts`：
1. ingress adapter 无会话 store/provider/业务权威；
2. 全部保留 surface 单一 canonical endpoint 且不用本地消息缓存 hook；
3. 不重新引入第二个客户端会话 store hook（`useKonlingSession` 非 local 版不得复活）；
4. interactive AI hook 不直接做 provider 选择。

## 3.3 Advisory

C28 `ai-runtime-business-isolation.test.ts`（owner 不触达业务域、prisma 仅配置）继续生效；本 change diff 未新增任何业务写入路径。

## 4.1 验证

- 契约 + hook + sidebar presentation：20 测试过；konling/interactive 广域 99 测试 98 过。
- 既有失败（stash 基线复现，与本 diff 无关）：integration 上 9 个（C28 记录的 8 个 + `konling-conversation-library-ui.test.ts`——#1837 将 hook fetch 包为 `konlingConversationFetch` 后未更新该 source-scan 断言，属该变更遗留债）。
- `typecheck` 0 错误；`lint` 0 warning；strict validate 通过。

## Rollback

恢复本提交删除的 `useKonlingSession` 服务端 hook 与文档注释变更；不恢复第二 conversation store，不改变 /api/ai 合同。

## C30 handoff

- Canonical client ingress：`@ai-sdk/react useChat` + `konling-chat-failure` safe fetch；legacy 形状仅存在于 `useLegacyChat` 一个 documented adapter。
- `useLegacyChat` 删除条件：4 个 surface 迁移到原生 useChat 契约（一次性 UI 迁移，C30 或后续 UI change）。
