# 个人中心只统计可验证的预览训练

日期：2026-08-10

## 背景

个人中心当前用全部 `ArenaVirtualSimulationRun` 行生成 `total` 和 `previewCount`，而最近列表已经要求完成状态、预览边界和完整质量指标。未完成、边界冲突或指标缺失的持久化行因此被误报为训练次数。

## 决策

个人中心的训练统计只接受 `projectArenaPortfolioRecentTrainingRun()` 成功投影的记录。服务端在同一个 `RepeatableRead` 事务中分页扫描候选运行，累计所有可展示记录的数量，并从同一集合取最近五条。每页最多 100 条，使用 `createdAt desc, id desc` 和 id 游标保证稳定前进。

治理候选运行仍可保留在持久化层，但不进入学生训练统计。该变更不触碰官方提交、成绩、排行榜或能力画像的权威数据。

## 后果

- `total`、`previewCount` 和 `recentRuns` 的口径一致。
- 统计能覆盖首个分页之后的有效记录，同时控制单页内存。
- 个人中心不再用不可验证的运行行误导学生。
