## Context

`useLegacyChat()` 使用 AI SDK `DefaultChatTransport`。该传输在响应非 2xx 时读取完整 `response.text()` 并以它构造 `Error`；请求无法到达服务器时，浏览器直接抛出 `Failed to fetch` 等英文异常。`/api/ai/chat` 的部分失败返回 JSON 机器码和中文 message，另一些历史路径仍返回 `Missing messages`、`Conversation not found`、`INVALID_AI_TASK_CONTEXT` 或状态冲突代码。

独立 Copilot 和全局控灵侧栏把 `error.message` 直接插入可见文案。单纯让服务端增加中文 message 不能解决问题，因为 SDK 仍会把整个 JSON 字符串交给 UI，网络失败也没有服务端响应；单纯替换每个组件的文案又会丢失状态差异并持续遗漏新入口。

## Goals / Non-Goals

**Goals:**

- 所有活动学生端控灵入口只显示稳定、简洁的中文产品错误。
- 根据认证、会话、任务状态、限流、服务不可用和网络失败提供真实可达的恢复动作。
- 保留稳定机器码供客户端分类，保留脱敏诊断供服务端排查，但不把技术详情展示给学生。
- 通过共享适配减少各页面重复判断，并覆盖原始响应、组件与浏览器行为。

**Non-Goals:**

- 不改变模型回答内容、system prompt 或提示词安全策略。
- 不向学生展示供应商、堆栈、内部路由、原始状态码或诊断摘要。
- 不把所有失败都变成自动重试，也不自动创建新会话覆盖学生历史。
- 不重写未被生产入口引用的旧展示组件，除非共享适配自然覆盖它们。

## Decisions

### 1. Normalize failures once at the shared client transport boundary

共享适配器读取 HTTP 状态和受限 JSON 字段，输出稳定的学生失败模型，例如 `auth-required`、`conversation-missing`、`task-context-invalid`、`state-conflict`、`rate-limited`、`service-unavailable`、`network-unavailable` 和 `unknown`。组件消费该模型，不读取任意异常正文。

仅在服务端统一文案无法覆盖网络异常，逐组件判断会产生漂移，因此采用共享传输适配。未知响应必须 fail closed 为通用中文错误，不能回退到原始文本。

### 2. Keep machine codes separate from student copy

公开错误响应可以包含 allowlist 中的稳定 code 和受限 message；客户端优先按 HTTP 状态与 code 分类。服务端原始异常、供应商详情和堆栈只进入现有脱敏日志，不进入公开 code 或 message。

不以任意服务端 `message` 作为可信展示文本，因为历史路由和未来调用者可能返回英文、JSON 或内部细节。学生文案由客户端受控映射或明确允许的公开消息表生成。

### 3. Match recovery actions to the state transition required

- 401 引导重新登录或恢复认证后再发送。
- 404 会话缺失刷新会话库并提供新建会话，不重放旧会话请求。
- 400/409 任务上下文或状态冲突重新获取当前任务状态，必要时返回有效入口。
- 429、503、网络失败提供稍后重试，并保持未发送内容可恢复。
- 未知失败提供安全重试和支持信息，不展示诊断正文。

组件可以按所在页面选择等价动作，但不得为不可重试状态只提供原请求重放。

### 4. Validate the rendered failure journey

单元测试验证 JSON、纯文本、空响应和 fetch rejection 的归一化；组件测试验证原始 canary 不出现在 DOM；浏览器测试在 `/ai/copilot` 和全局侧栏注入代表性 401、404、409、503 与网络失败，核验文案、焦点、动作结果和 1440/320 无溢出。

## Risks / Trade-offs

- [Risk] 过度归一化掩盖开发诊断。 -> 服务端保留脱敏结构化日志和稳定 code，测试环境可以检查诊断通道，学生 UI 不显示详情。
- [Risk] 恢复动作与页面状态不一致。 -> 共享失败类别与页面级动作分离，并用真实路由状态测试动作是否改变下一次请求条件。
- [Risk] HTTP 状态相同但语义不同。 -> 优先使用 allowlist code，状态作为回退；未知 code 使用通用安全类别。
- [Risk] 重试造成重复消息。 -> 保持现有请求身份和并发合同，只有可重试类别允许重放。

## Migration Plan

1. 建立失败模型、响应解析和未知值 fail-closed 测试。
2. 接入 `useLegacyChat()`，保留原始异常仅用于受控回调诊断或完全移除其公开可达性。
3. 改造独立 Copilot 和全局侧栏的错误文案与恢复动作。
4. 运行 focused tests、typecheck、OpenSpec strict，并捕获 revision-bound 桌面端和 320px 错误状态证据。
5. 无数据迁移；回滚会恢复原始错误暴露，因此仅用于紧急兼容并应立即重新部署修复。

## Open Questions

None. 失败类别、公开文案和恢复动作由现有 HTTP/会话/任务合同即可确定，不需要新增产品规则。

