# 互动控灵作答状态 grounding Receipt

基线：`38f8f32f81`（claim branch 建立点）。

## 1. 现状与差距（task 1.1）

- 客户端 `createUNIT_1_4AIContext` / `createUNIT_1_5AIContext`（unit-1-4/1-5-ai-contexts.ts）把 responseStatus + answerVisible 烘焙进 `tools`/`systemPromptExtension` 后丢弃；其余 30 课为静态上下文。
- 服务端 `/api/ai/chat` 已忽略客户端 `tools`/`systemPromptExtension`（fail-safe），但 `buildServerOwnedPageContext` 只重建静态注册表上下文，不读任何作答状态 → 提交前后辅导相同（issue 复现成立）。
- 持久化真源：`StudentState`（sessionId+userId+stateKey 唯一；stateKey='course' 实时投影含 `responses[stepId].answers`；stateKey='teacher-sync'+itemId='teacher:course-sync' 含 `revealedAnswers`）与 `StudentStepResponse`（sessionId+userId+lessonKey+stepId 提交证据）。
- 回归证据：`konling-interactive-tutoring-state.test.ts` 证明 unanswered / in_progress / submitted / teacher_disclosed 四态产生不同 `promptSection` 与 `checkAnswerAllowed`——移除投影即回到相同的静态上下文（task 1.1 的差异化回归）。

## 2. 实现（task 2.1 / 2.2 / 2.3）

- 新增 `src/lib/konling-interactive-tutoring-state.ts`：
  - `extractInteractiveSessionHint(hint)`：从 pageContext.url/stepId 解析 `/student/<sid>` 或 `/classroom/<sid>`（查找提示，非授权事实）。
  - `resolveInteractiveTutoringState(db, {authenticatedUserId, role, courseId, pageId, sessionIdHint})`：
    - courseId 经 `resolveInteractiveLessonRegistryKey`（新导出，别名归一）映射到注册 lessonKey；非互动课返回 null（零查询）。
    - 无会话提示 / 教师与管理员 / 会话不存在 / 学生不属于会话班级（StudentProfile 校验）→ `unresolved`（兼容态：不声明作答感知、不允许检查答案）。
    - 并行读取 course 投影、teacher-sync 揭示行、StudentStepResponse 提交证据 → disclosed > submitted > in_progress > unanswered。
    - `checkAnswerAllowed = submitted || disclosed`；submitted/disclosed 时投影该学生自己的本页作答摘要（≤10 项、每值 ≤200 字符、仅本人字段）。
  - 状态规则文本与客户端工厂四态规则对齐（揭示/已提交可检查、部分/未提交禁止、不代答）。
- `src/app/api/ai/chat/route.ts`：在 `authorizedScope` 收敛点（两个入口——嵌入式 lessonContext.stage='interactive' 与全局控灵——都经过）解析 tutoring state：
  - `!checkAnswerAllowed` 时从 permittedTools 过滤 `analyze_attempt`（服务端工具权威）。
  - systemPrompt 追加 `promptSection`；unresolved 时规则明确「不得声称已读取学生作答」。
- 客户端零改动：全局侧栏 `pageContext.url` 已含课堂路由 `/student/<sessionId>`（route 静态上下文自带），仅作服务端查找提示并重新授权。

## 3. 敌意与边界（task 1.2 / 3.1 / 3.2 / 3.3）

- 客户端伪造 `tools`/`systemPromptExtension`/`answerVisible`/`savedResponse`：route 不解构这些字段（既有 guard 断言 + 新增 `not.toContain('answerVisible'/'savedResponse')`）；resolver 只读服务端行，`.answerVisible` 读取被 guard 禁止。
- 学生指向非本班会话：StudentProfile 校验失败 → unresolved，无作答/揭示泄漏。
- 未提交（unanswered/in_progress）：stateRule 禁止答案与检查，`analyze_attempt` 被过滤（工具层硬边界）。
- 已提交/已揭示：仅该学生自己的持久化作答进入摘要；不加载教师私有答案包。
- 回合间状态迁移：resolver 无会话内状态，每次请求从最新持久化解析（测试覆盖 unanswered→in_progress→submitted 序列）；不改历史会话消息、正式成绩、LearningFact、画像。
- 不新增数据源；跨页面持久会话策略未改。

## 4. 验证（task 3.4）

- `konling-interactive-tutoring-state.test.ts` 10/10（四态、unresolved 降级×4、敌意会话、回合迁移、摘要上限）。
- `ai-chat-route-runtime-guard.test.ts` 24/24（含新增 grounding guard；既有守卫全部保持）。
- 受影响面：`konling-agent-runtime.test.ts`、`useInteractiveAI.test.tsx`、`unit-1-4-course.test.ts`、`konling-kaq-graph-context.test.ts` 共 242 通过。
- `rtk npm run typecheck` exit 0；`rtk git diff --check` 干净；strict change validation 通过。

## 5. Scope guard

未修改正式成绩、LearningFact、画像、历史会话消息、数据库 schema；未新增 AI 数据源或跨页会话规则；教师/管理员预览按 unresolved 降级不产生学生状态。


## 6. Codex 三项 P1 修复（HEAD 30e2b6eb5f 上的 findings）

全部核实后 ACCEPT，同一根因（服务端绑定权威性不足）一次性修复：

1. **整页完整提交才开放检查**：`StudentStepResponse` 按卡片粒度生成，任一证据行 ≠ 整页完整。新增 `loadInteractiveStepRequiredResponseKeys`（lessonKey→`resolveInteractiveLessonIdentity`→runtime manifest，进程内缓存，读取失败保守降级）；`submitted` 态要求证据行存在 **且** 必答键（activityCards + compute.panel responseContractId）全部持久化在案，否则维持 `in_progress` 不开放 `analyze_attempt`。回归：部分必答 + 证据行 → in_progress。
2. **嵌入式入口解析到真实课次**：courseId `'interactive'` 不是注册表键导致嵌入式入口返回 null。新增 `resolveInteractiveLessonTarget`：注册表键直接命中；资源路径 `/interactive-learning/resources/<rid>/classroom/<sid>` 解析 `<prefix>:<stepId>`（unit11/21/22/23/24/41 六课前缀映射表，仅收录实际存在嵌入式 AI 的课）到 lessonKey + 页步骤 id，两入口共用同一状态机。回归：嵌入式资源路径 grounded。
3. **会话与课次不可变绑定**：会话 id 仅经班级成员校验可被指向同班其他课次/场次。新增课次锚定：学生的 `StudentState`(stateKey='course') 行必须存在于该会话且 `lessonKey === 当前课次键`（该行由课堂状态写入端持久化，lessonKey 为服务端事实），不匹配 → unresolved，揭示/作答/证据查询全部不生效。回归：跨课 course 行 → unresolved。

测试 12→15（新增三个 P1 回归），guard + runtime 套件 232 通过，typecheck exit 0。
