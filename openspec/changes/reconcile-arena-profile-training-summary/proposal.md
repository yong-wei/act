# 统一个人中心预览训练统计口径

## Why

`/api/user/profile` 目前把所有 `ArenaVirtualSimulationRun` 持久化行计入训练总数，但可展示的最近训练已经要求完成状态、明确的预览边界和完整质量指标。未完成或不完整的运行会被呈现为学生已完成的预览训练，破坏学习证据的可追溯性。

## What Changes

- 让训练数量和最近训练列表共同使用可验证预览训练投影。
- 通过稳定分页扫描覆盖全部候选运行，并在同一 RepeatableRead 快照中计算数量和最近记录。
- 保持学生作用域隔离，不改变官方提交、成绩、排行榜或能力画像。
- 增加 pending、边界冲突、指标缺失、分页和完整运行的回归覆盖。

## Scope

- `src/app/api/user/profile/route.ts`
- `src/features/arena/profile.ts`
- 竞技场画像和个人中心接口测试

不新增数据库表或迁移。
