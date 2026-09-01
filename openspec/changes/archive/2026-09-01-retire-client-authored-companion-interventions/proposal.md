## Why

Issue #1312 已建立以持久化正式 `ArenaSubmission` 为唯一尝试来源的控制工作台陪伴闭环，但生产工作台仍同时挂载旧 `AICompanionPanel`。学生可以在该面板手填参数、指标和成功状态，再由 `/api/ai/intervention/generate` 将客户端 `studentState` 持久化为 `AIIntervention`、证据和 Memory。两个通道对同一任务使用不同真源，直接违反现行正式评测陪伴规格，并可能让未验证输入进入受治理干预历史。

## What Changes

- 从 Arena 控制工作台移除或停用客户端手填尝试生成受治理陪伴的生产入口，正式评测结果卡成为唯一陪伴入口。
- 禁止 `/api/ai/intervention/generate` 或等价运行时从客户端 `studentState` 创建 Arena 受治理干预；Arena 干预必须绑定当前学生、当前任务的持久化正式提交。
- 继续复用任务、允许方法和 `MetricProfile` 解释正式提交中的参数与指标，但客户端字段不再决定尝试、约束、冷却或验证。
- 以正式提交身份完成去重和下一次同任务正式提交验证；不得让旧任务/方法时间冷却覆盖正式提交轮次。
- 保留既有客户端自报干预记录作为历史审计数据，但不把它们纳入正式陪伴基线、回访、学习事实或官方结果。
- 增加旧入口不可达、伪造 `studentState` 拒绝、正式结果陪伴无回归以及 1440px/320px 浏览器验收。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `konling-official-evaluation-companion`: 明确控制工作台正式评测陪伴是唯一生产受治理通道，客户端自报尝试不得并行创建干预。
- `control-method-aware-companion-guidance`: 将任务与方法上下文绑定到正式提交证据；旧客户端 practice observation 不再触发持久化干预或冷却。
- `konling-agent-runtime`: Arena 干预持久化必须携带并验证正式提交引用，拒绝仅有客户端 `studentState` 的写入。

## Impact

- Affected UI: `src/features/control-workbench/shell/control-workbench-shell.tsx`、`src/features/ai/companion/ai-companion-panel.tsx`。
- Affected API/runtime: `src/app/api/ai/intervention/generate/route.ts`、`src/lib/konling-agent-runtime.ts` 及正式 Arena 评测陪伴适配器。
- Existing official score, constraints, leaderboard, LearningFact and learner portrait contracts remain unchanged; no destructive historical migration is required.
