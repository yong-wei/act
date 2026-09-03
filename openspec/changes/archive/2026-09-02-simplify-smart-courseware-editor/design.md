## Context

课件页面由 server projection 组装 teacher envelope，再在 client 侧同时处理文档编辑、generation job 刷新、module candidate、student preview、review 和 publication action。domain/service 已经提供这些状态的持久化与校验；编辑器中仍保留一套可从 envelope 或 response 重新推导的状态，形成多个可互相过期的 representation。

## Goals / Non-Goals

**Goals:**

- 让一个课件 revision/hash/source-gap identity 在 UI、API 和 domain projection 中始终来自同一 owner。
- 减少编辑器 local state、DTO adapter 和重复刷新逻辑，在不改变输入/输出/错误/副作用的情况下提升可读性。
- 保留 teacher-only review、student-safe preview、publication and classroom contracts。

**Non-Goals:**

- 不新增编辑器框架、通用 AI workspace、第二 courseware store 或第二 publication authority。
- 不改 manifest schema、BOPPPS content、source-gap acknowledgement、发布 gate、PDF 或 classroom runtime。
- 不把 provider output、AI review 或 UI state 变成 courseware fact。

## Before / After

### Before

- page projection、editor envelope、student preview 和各类 API payload 各自保存相同 draft/version/hash/status 的派生副本。
- generation polling、module candidate、review 和 publication action 在 component 内组合多套转换与 refresh 分支。
- 文档字段与 preparation document editor 的保存/冲突语义之间存在额外 adapter。

### After

- `src/lib/smart-courseware` domain/service 是状态、revision、hash、job 和 publication identity 的唯一 owner。
- preparation document editor 是文档编辑/冲突 owner；课件 editor 只选择现有 projection 并派发已有 service action。
- student/teacher projection 仍按角色隔离，但不再复制事实；只有 UI 临时交互状态留在 component。

## Decisions

### 1. Simplify by deletion and composition

按 code-simplification skill 先理解 state owner、调用者、边界和测试，再做小步删除。优先删除重复 mapper、alias、派生 state 和无效 effect；保留为可测试概念的命名 helper，不为未来能力新造抽象。

### 2. Preserve service and API contracts

编辑器继续使用现有 courseware service、route schema、idempotency key、optimistic version、job retry/resume 和 publication gate。若返回 payload 已是 canonical projection，UI 不再二次推导能影响提交的事实；不兼容历史 payload 时只在单一 ingress adapter 兼容。

### 3. Separate role projections from edit state

teacher editor 可以看到审阅、source gap、provider audit 的受限投影；student preview 只能读取 student-safe manifest。SSR page 负责授权和初始 projection，client 只执行已授权交互；R3F/interactive preview 继续沿用 dynamic boundary。

### 4. Test before/after observable behavior

在删除每组 state/alias 前锁定初始加载、字段编辑、保存冲突、生成/重试、module regeneration、review、publication、preview、refresh/resume 和 return-state 行为。任何必须修改测试断言才能通过的变化视为行为变化，停止该简化。

## Risks / Trade-offs

- [Risk] 删除 local snapshot 使长请求期间 UI 失去稳定显示。→ 保留只读的 in-flight presentation state，事实仍从 domain projection 读取；测试 stale response 和 retry。
- [Risk] teacher projection 与 student preview 混用。→ 保持两套已有 role projection contract 和静态隐私检查，不共享 raw envelope。
- [Risk] 复杂 editor 仍需拆分。→ 只在现有 owner 内拆出有明确职责的 helper；不建立新的通用 workspace。
- [Risk] 回滚后重复 state 再次分叉。→ 回滚只恢复等价的旧映射，保留 domain/service 为 authority，并记录删除条件。

## Migration Plan

1. 运行 code-simplification 前置审查，记录 editor/service/preparation-editor 的调用图、状态字段和行为基线。
2. 以服务端 projection 和既有 editor contract 替换可推导的 local state/mapper，逐组运行 focused tests。
3. 删除无调用 alias 和重复 refresh/preview conversion；保留单一 ingress compatibility adapter（若仍有历史 caller）。
4. 运行 courseware unit/route/component/Playwright tests、typecheck、lint、`verify:commit`/`verify:push` 和 OpenSpec strict validation。

回滚按 commit 恢复被删的 UI adapter，不恢复新的 authority；数据库、published revision、classroom binding 和已有 receipts 不变。

## Open Questions

无。无法证明行为等价的状态或 adapter 应保留并标注原因，不强行删除。
