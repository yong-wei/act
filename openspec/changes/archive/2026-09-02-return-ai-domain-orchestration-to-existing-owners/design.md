## Context

ACT charter 已为 assessment、personalization、learning-record、course、classroom、assignment、practice-lab、arena、knowledge、identity 和 platform 分配 owner，并规定跨域调用经过 public API/application use case → domain core/ports → adapters。AI runtime 当前同时承载 provider、会话和若干业务编排，容易形成一个“知道所有领域”的中心层。C30 只收回业务编排，不回退 C28 的 provider runtime，也不改变 C29 之后保留的聊天表面。

## Goals / Non-Goals

**Goals:**

- 为每类 AI 触发的业务动作确认唯一领域 owner 和最小 public/application boundary。
- 让 AI 结果只作为 advisory content 或经过权限、作用域、幂等和审计校验的 tool intent。
- 删除 AI 对领域内部文件、Prisma model、route handler 和重复状态机的直接依赖。
- 维持现有 student/teacher/admin projection、SSR/R3F、隐私和发布/回滚安全约束。

**Non-Goals:**

- 不创建通用 `AIWorkspace`、`AIOrchestrator`、第二套领域 service 或全局业务 event bus。
- 不重写任何领域模型、学习事实、评估评分、课程内容、Arena 仿真、知识 Authority 或发布 selector。
- 不让 AI 自动批准、发布、评分、写入 LearningFact、修改画像或切换生产状态。
- 不把 canonical owner 责任迁回 `src/lib` 或另一个平台 façade。

## Decisions

### 1. Domain owner decides facts

assessment 决定尝试/评分，learning-record 决定学习事实，personalization 决定路径，course/classroom 决定课程与课堂状态，assignment 决定作业生命周期，practice/arena 决定训练与正式提交，knowledge 决定知识/资源投影，identity 决定身份权限，platform 只负责交付和共享基础设施。AI 不重复这些状态机。

### 2. Use existing public and application boundaries

每个 AI caller 先解析当前 user/role/scope，再调用 owner 的 public API 或 application use case。没有现成 boundary 时先由对应领域定义最小 port/contract；C30 不以 AI 层的内部 helper 代替。跨域读取使用 owner-owned read model 或显式 projection，禁止导入 Prisma、route 或 sibling internal file。

### 3. Separate suggestion from side effect

模型返回的 explanation、candidate、next action 或 tool intent 必须携带 scope 和 provenance，但不会直接落库。真正的 write 由 owner 校验当前 revision、权限、幂等 key 和状态转换；失败/冲突保持 owner 的错误 contract，并可被 AI 层以 advisory/unavailable 呈现。

### 4. Keep context bounded and server-owned

AI session/context 只组合经 owner 授权的读模型、资源和 evidence references；客户端字段、模型输出和旧 bridge 不能扩大 user/class/course/resource scope。敏感 payload 只在 owner 内部使用，AI projection 仍执行当前 privacy redaction。

### 5. Migrate by call graph, then delete duplicate state

先依据 C28/C29 的稳定 runtime 做调用图分组，按 owner 迁移 route/tool/workflow，加入失败和并发测试，再删除 AI 内部 duplicate orchestrator、alias 和 deep-import adapter。每个删除都必须有 caller inventory 和 behavior parity 证据。

## Risks / Trade-offs

- [Risk] 领域 public API 不足导致临时又造一个平台 façade。→ 由原领域 owner 提供最小 contract，AI 只消费，不在本 change 新建万能中间层。
- [Risk] advisory 建议被误存为事实。→ tool registry 明确 permission/write tier；owner 端拒绝缺少 scope/revision/provenance 的写入，测试检查数据库和事件无旁路写入。
- [Risk] 跨域读取增加一次 adapter。→ 接受少量显式边界成本，换取 owner 可独立审计、替换和回滚；不通过 deep import 优化短期代码量。
- [Risk] 并发 retry 产生重复 side effect。→ owner 负责 idempotency/concurrency，AI 只传递 opaque idempotency key 并展示明确冲突状态。

## Migration Plan

1. 汇总 C28/C29 之后 AI routes、tools、session flows 对各领域的读写调用及当前 authority。
2. 为每个领域确认 canonical public/application contract、scope、revision、permission、idempotency 和 error mapping。
3. 迁移 AI caller 到 owner boundary，保留 context assembler 的 bounded read-only 组合；为每个写动作增加 forged/mismatch/retry regression。
4. 删除 AI 内部重复业务 state、deep imports、Prisma/route access 和无调用 alias；保留必要的纯 presentation mapping。
5. 运行 AI/领域 suites、dependency/fitness checks、typecheck、lint、`verify:commit`/`verify:push` 和 OpenSpec strict validation。

回滚时恢复 caller mapping，不恢复 AI 事实 store 或重复状态机；owner 的数据、事件、revision 和审计记录保持不可变。

## Open Questions

无。若某领域暂时没有可验证 public/application boundary，应将该 AI 动作标记 unavailable 并阻止写入，而不是在 AI 层补一套实现。
