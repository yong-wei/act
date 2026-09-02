# AI chat 客户端上下文边界 Receipt

基线：`c51b55ad1c`（claim branch 建立点）。

## 1. 漏洞面（task 1.1）

- 无 Konling runtime 上下文时的 legacy 分支 `} else if (pageContext)` 把**浏览器 authored 的 pageContext 整体**作为 `aiContext.page` 传给 `buildKonlingSystemPrompt`——courseTitle/topic/learningObjectives 自由文本直接进入私有系统提示词。
- 完全无上下文时 `buildContextAwarePrompt(SYSTEM_PROMPT, lessonContext)` 注入 `resourceTitle` 与 `customPrompt` 任意自由文本为「当前学习资源 / 特别指导」系统级指令（instruction injection / 诱导泄露提示词）。
- 部分 pageContext（如只有 topic）也会落入上述分支被当作权威学习上下文。

## 2. 修复（task 1.2 / 1.3 / 1.4 / 2.1 / 2.2 / 2.3）

新增 `src/lib/ai/chat-context-boundary.ts`：

- `resolveServerOwnedChatPageContext(pageContext)`：
  - url 必须是单行合法路径（含换行/控制字符的 instruction 注入直接 fail-closed）→ `resolveRegisteredAIContextFromPath` 注册表解析；
  - 其次 (courseId, stepId) → `getStepAIContext` 课程步骤注册表（含互动课键别名归一）；
  - 成功 → 返回**只含服务端字段**的 PageContext（注册表标题/主题/目标/知识类型），浏览器 authored 同名字段全部丢弃；
  - 部分、未注册、无法归属 → `{ ok: false, code: 'INVALID_AI_CONTEXT' }`。

route 集成：

- legacy pageContext 分支：解析失败 → 400 `INVALID_AI_CONTEXT`（模型与工具执行之前 fail-closed）；成功 → `page: resolvedPage.page`（服务端投影）。
- `buildContextAwarePrompt` 删除 `resourceTitle`/`customPrompt` 注入；保留 `stage`（BOPPPS/interactive 枚举查表）与 `aiPersona`（枚举查表）——legacy 兼容限于受控枚举。
- 无上下文普通聊天与 Konling runtime 主路径（已有 scope 验证 + server-owned pageContext）行为不变；客户端上下文不扩大 target/course/page/class/resource/privacy/tool scope（scope 一律由 `verifyKonlingRuntimeScope` 服务端决定）。

## 3. 回归（task 3.1–3.4）

- 新增 `ai-chat-context-boundary.test.ts` 5 项：注册路由 → 服务端字段（浏览器字段丢弃）；课程步骤注册表解析；partial/未知/换行注入 → INVALID_AI_CONTEXT；legacy 自由文本（resourceTitle/customPrompt 多行注入）不出现在提示词；context-free 与枚举 stage/persona 保持。
- route guard 新增边界断言（resolver 接线 + INVALID_AI_CONTEXT + 禁 `page: pageContext,` + lesson-prompts 禁自由文本消费）。
- 受影响面：route guard + konling runtime 208 + streaming fallback 7 + tutoring-state + useInteractiveAI 共 240+ 全部通过；typecheck exit 0；`git diff --check` 干净。

## 4. Scope guard

未改 Konling runtime 主路径授权、工具 scope、模型 grounding、诊断持久化或既有教学语义；仅收紧 legacy 无会话路径的信任边界。


## 5. Codex P1 修复（路由 url 推断不可作为身份）

- 事实：`/interactive-learning/` 等注册规则是宽泛前缀正则，不存在的 `/interactive-learning/courses/definitely-not-registered` 与 `/data-center` 均可经 url 推断得到 ok——客户端可把任意虚假页面身份写入系统提示词，违反「unknown/unauthorized → 400」验收。
- 修复：`resolveServerOwnedChatPageContext` 删除 url 推断路径（及换行校验、`pageContextFromRegistered`），仅接受 (courseId, stepId) 在课程步骤注册表的**精确命中**；服务端字段投影不变。前端盘点：两个 sidebar 调用方均带 courseId+pageId 走 Konling 分支，legacy url 路径零消费者。
- 回归：伪造/不存在路由 url（含 /data-center）→ INVALID_AI_CONTEXT；课程步骤命中用例保留；route guard 断言 resolver 不再引用 `resolveRegisteredAIContextFromPath`。
