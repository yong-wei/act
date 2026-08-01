## Context

Arena 黑箱预览已在一个事务中创建 `ArenaVirtualSimulationRun`、规范 `SimulationRun`、`SimulationTrace` 和仿真 `LearningFact`。但个人中心只读取官方 `ArenaSubmission`；同时证据物化的安全摘要丢弃了 `taskId`，使训练事实无法稳定映射到 Arena 任务及其能力标签。

训练是学习过程证据，官方提交是评测权威。两者必须共存、可追溯且语义分离。

## Goals / Non-Goals

**Goals:**
- 为新生成的 Arena 虚拟训练证据保留任务、场景、预览和重放摘要。
- 在个人中心显示由后端汇总的训练记录，且不改变官方提交统计。
- 让训练事实以低于官方证据的权重参与学习画像与成长建议，并保留来源边界。
- 使历史 `ArenaVirtualSimulationRun` 能进入个人中心训练统计。

**Non-Goals:**
- 不改变 Arena 官方评测、排行榜、通过次数、任务解锁或能力达成规则。
- 不复制高频仿真轨迹到 `LearningFact`，不增加 Prisma schema。
- 不把缺少任务归因的历史 `LearningFact` 伪造为任务级画像证据；历史事实修正另立受治理变更。

## Decisions

### 在规范运行摘要中保留紧凑 Arena 训练上下文

预览写入 `SimulationRun` 时增加紧凑的 Arena 训练上下文，至少包含 Arena 任务标识、场景、预览属性、官方不合格标记和现有摘要/重放引用。证据物化器将该上下文安全地写入 `LearningFact.contextJson.simulation`，并以任务标识作为可查询模块归因。

将任务 id 只保留在 `ArenaVirtualSimulationRun` 明细行中被拒绝，因为学习画像、证据浏览和路径服务以规范 `SimulationRun` 与 `LearningFact` 为边界，不能为了归因回读未经授权的预览明细。

### 官方提交和训练统计分开建模

`ArenaStudentPortfolio` 增加只读训练统计与近期训练记录，由后端从 `ArenaVirtualSimulationRun`/规范运行摘要生成。原有 `submissionSummary`、个人最佳、排行和官方能力状态继续只读取 `ArenaSubmission`。

把预览合并进提交列表被拒绝，因为会污染有效提交率、最佳成绩和排行榜语义。

### 训练对画像使用受限贡献

物化器对预览训练保留既有仿真能力映射，但以低于非预览受治理仿真的权重写入贡献和来源标记。学习画像可将它展示为能力观察信号；官方能力达成与排行榜仍只接受官方提交。

完全忽略训练证据会继续丢失学习过程；把训练作为官方证据则会错误地授予通过和排行语义。

## Risks / Trade-offs

- [Risk] 训练分数可能被误读为官方分数。 -> 个人中心使用独立训练字段和明确 `preview`/`officialEligible=false` 标记，官方汇总不读取训练行。
- [Risk] 旧训练事实没有任务 id。 -> 直接从历史训练运行读取个人统计；不回填或重写缺少可靠归因的既有事实。
- [Risk] 同一训练被重复物化。 -> 继续使用规范运行 id 与协议版本构成的幂等键。
- [Risk] 低质量预览过度影响画像。 -> 对预览贡献加权并保留置信度、重放和来源标记。

## Migration Plan

1. 部署兼容读取：个人中心训练查询可读取已有的 `ArenaVirtualSimulationRun`。
2. 部署新写入：后续训练在 `SimulationRun` 和 `LearningFact` 中保留任务上下文及预览权重。
3. 监测个人中心与学习画像中的训练来源；若异常，停止新训练上下文写入即可回退，既有官方提交与排行榜不受影响。
