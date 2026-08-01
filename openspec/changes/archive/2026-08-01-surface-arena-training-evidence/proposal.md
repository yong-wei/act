## Why

Arena 黑箱虚拟仿真已被保存为规范的 `SimulationRun` 并物化为 `LearningFact`，但个人中心只汇总官方 `ArenaSubmission`，训练运行没有可见统计。同时，仿真证据的安全摘要遗漏 Arena 任务标识，学习画像只能看到泛化仿真活动，不能可靠归因到任务能力。

这使学生完成的受治理训练既不在个人中心形成记录，也不能以正确的置信度参与学习画像和成长建议。

## What Changes

- 保留 Arena 虚拟预览的任务、场景、预览边界和可重放摘要，并将其写入紧凑、可查询的 `LearningFact` 上下文。
- 在学生个人中心的 Arena 画像中增加训练运行统计和近期训练记录，与官方提交统计、排行榜和正式能力达成分开显示。
- 让已完成的 Arena 训练作为可追溯、低置信度的仿真证据进入学习画像；预览不得成为官方提交、排行榜成绩、正式通过次数或官方能力结论。
- 为训练任务归因、个人中心汇总和学习画像边界增加定向回归测试。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `simulation-arena-evidence-governance`: Arena 预览的 `SimulationRun` 学习事实保留 Arena 任务上下文，并可被下游画像消费。
- `arena-learning-evidence-consumption`: 学生个人中心消费受治理的 Arena 训练运行，同时保持官方提交汇总的权威边界。
- `arena-student-growth-recommendation`: 学生成长视图区分官方能力证据和低置信度训练证据。

## Impact

- `src/features/arena/blackbox/controller-preview.ts`
- `src/lib/data-governance/simulation-agent-evidence-materialization.ts`
- `src/features/arena/profile.ts`、个人中心 API 与页面
- 仿真证据、Arena 个人画像和学习画像的定向测试
- 不涉及排行榜写入、官方评测规则、既有官方提交或 Prisma schema 迁移
