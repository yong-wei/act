## Context

`SmartLessonPlanWorkspace` 是教师侧 client component，初始接收 server task/course-basis/textbook projection，随后自行维护筛选、选中任务、来源、教材范围、建议确认、刷新和滚动高亮。`src/lib/smart-lesson-plan` 已拥有输入 schema、生命周期、generation service/worker 和 revision identity；preparation document editor 已拥有可恢复的编辑与冲突协调。C32 要让 workspace 依赖这些 owner，而不是在 UI 中复制其状态机。

## Goals / Non-Goals

**Goals:**

- 让 task/draft/source/stage/approval/job/revision/status 的 durable meaning 只来自 smart-lesson-plan owner。
- 减少 workspace 的派生 state、effect、事件 alias 和 route-specific mapping，保持可观察行为和失败语义。
- 保留教师工作流、权限、教材/source binding、Konling 建议和课件交接。

**Non-Goals:**

- 不新增万能 AI workspace、第二 conversation store、第二任务/教案 store 或新的轮询框架。
- 不改变任务 schema、source-gap/approval 语义、provider correction 上限、queue/worker、课件发布和 classroom runtime。
- 不将客户端输入、AI 建议或 workspace state 变成教学、评估或学习事实。

## Before / After

### Before

- workspace 同时保存 task list、selected task、course basis/source options、textbook recommendation、job state 和 highlight/return state。
- `course-basis:changed`、`konling:smart-task-confirmed`、timer refresh 和 route response 各自更新局部 task projection。
- 计划编辑与 preparation document editor 之间存在额外转换和 scroll/event bridge。

### After

- server/service projection 是 task/draft/job/stage/revision/status 的唯一事实，workspace 只保留 query、selection、drawer/scroll 等瞬时 UI 状态。
- 事件和 route action 使用已有 smart-lesson-plan public/service contract；无调用的 alias/effect/mapper 删除。
- 文档编辑、冲突、return-state 统一复用 preparation document editor；AI suggestion 仍走现有 Konling session/confirm contract。

## Decisions

### 1. Simplify after understanding the state machine

按照 code-simplification skill 先查看所有读取/写入者、effect 生命周期、queue/worker 语义和测试，再分组删除。只删除可推导或无调用的状态和 alias；保留能表达业务意图的明确函数，不以行数为目标。

### 2. Keep server-owned projections and explicit refresh

task query、confirm、generation、retry、outline edit 和 courseware handoff 继续经过现有 API/schema/auth。workspace 可触发 refresh，但不自行合并不完整 payload 或覆盖较新 revision；请求竞态使用现有 abort/identity 方式处理。

### 3. Preserve source and approval identity

课程依据版本、教材范围、stable anchor、content hash、citation、goal/module source state、teacher approval、task revision 和 class context 仍由服务端解析和验证。客户端选择仅作为用户意图，不能创建 source binding 或批准缺口。

### 4. Keep AI advisory and bounded

Konling suggestion 继续使用已治理 session、server-owned context 和 confirm route。建议消息可以刷新 workspace，但不能直接改写 task、goal、source、LearningFact 或 publication state；真正修改由 owner action 完成并审计。

### 5. Verify before deletion

每次简化先运行 before/after tests，覆盖任务索引、归档/查询、建议确认、生成 stage、失败/重试/恢复、编辑冲突、返回位置和权限/隐私。若需要削弱断言或改变既有错误状态才能通过，则放弃该删除。

## Risks / Trade-offs

- [Risk] 删除本地 task snapshot 造成 server refresh 期间内容闪烁。→ 保留非事实性的 loading/selection presentation state，并在 stage projection 完整前不伪造完成内容。
- [Risk] 轮询和事件同时更新导致旧响应覆盖新 revision。→ 绑定 task/revision/request identity，拒绝 stale response，并加入延迟响应测试。
- [Risk] 教师来源绑定被简化为文本。→ 保留 stable anchor/content hash/citation contract，拒绝没有服务端 source identity 的写入。
- [Risk] workspace 迁移后 SSR/role boundary 改变。→ 保持 page server projection、route auth、AppShell/role/SSR/R3F 路径不变，补充 mounted tests。

## Migration Plan

1. 运行 code-simplification 前置审查，记录 workspace state/effect/event/route 的 before inventory 与 owner。
2. 将 durable 状态读取/写入对齐到 smart-lesson-plan service 和 preparation editor，保留行为兼容。
3. 删除重复 mapper、alias、局部状态和无效 effect；逐组验证 stale response、refresh、retry 和 return-state。
4. 运行 smart-lesson-plan、teacher workspace、smart-prep route、AI suggestion 和 UI tests，随后运行 typecheck/lint/strict validation。

回滚只恢复旧映射或 component glue，不恢复第二套 task state machine；服务端 revision、approval、source binding 和审计记录不回写。

## Open Questions

无。无法证明其只为 UI 临时用途的状态应继续保留，直到 owner 和行为证据明确。
