## 1. Contract and evidence projection

- [ ] 1.1 Inventory `SimulationRun`、`SimulationLog` 及各领域 detail 的身份、归属、完成状态和质量摘要字段，确定可证明的去重键。
- [ ] 1.2 定义学生安全仿真证据 projection，覆盖 `available`、`empty`、`unavailable`、用户隔离和字段白名单。
- [ ] 1.3 将 `/profile` 统计、最近活动和 `/profile/portfolio` 仿真档案接入同一 projection。

## 2. Compatibility and boundaries

- [ ] 2.1 为有稳定关联的旧 `SimulationLog` 增加兼容回读；同一产物只保留一条展示记录。
- [ ] 2.2 排除 pending、指标不完整、归属不明和不可验证的运行，不把未知状态转化为零值或完成事实。
- [ ] 2.3 验证预览训练不进入官方成绩、排行榜、正式提交或能力达成。

## 3. Regression and acceptance

- [ ] 3.1 增加标准 `SimulationRun` 出现在个人中心统计、最近活动和仿真档案的回归。
- [ ] 3.2 增加旧日志兼容、canonical/legacy 去重、跨用户隔离和不可用状态回归。
- [ ] 3.3 增加个人中心与个人档案同源、一致摘要和预览边界回归。
- [ ] 3.4 执行相关单元/集成测试、`npm run typecheck`、严格 OpenSpec 校验和 `git diff --check`。
