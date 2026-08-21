## 1. v2 生命周期库存与策略

- [ ] 1.1 对当前 576 项目录按题源、九学习目标和五阶段分别统计登记、审核、path eligibility、运行时注册和可选择状态
- [ ] 1.2 定义 v2 baseline/release schema、逐项内容 identity、阶段最低覆盖和分母升级规则，保持 practice-v1 不变
- [ ] 1.3 由课程教学审核确定各阶段最低数量、独立性和 source-mix 限制，记录无法复用题目的理由

## 2. 目录与 terminal validation

- [ ] 2.1 扩展目录工件，显式记录 allowed、approved stage purpose、eligibility、runtime registration 和 lifecycle baseline identity
- [ ] 2.2 审核并补齐题目型 terminal-validation 候选，不使用 provisional、其他阶段或未审核题静默替代
- [ ] 2.3 为运行时增加 `terminal-validation` scope、确定性选择和不可变答题快照

## 3. 路径接入与兼容

- [ ] 3.1 将题目型 terminal validation 接入路径策略，并与 simulation/Arena terminal evidence 保持独立或显式组合
- [ ] 3.2 在候选不足、审核 stale、运行时缺失或版本漂移时返回 limitation/fallback，不声称路径已完整验证
- [ ] 3.3 保持 v1 报告、历史路径和历史 `AdaptiveAssessmentItemRef` 字节与解释兼容

## 4. 验证

- [ ] 4.1 增加五阶段矩阵、allowed/approved 区分、v1/v2 并存、分母漂移和 source-family 覆盖测试
- [ ] 4.2 增加 terminal-validation 成功选择、候选缺失、provisional 拒绝和 simulation/Arena 并存测试
- [ ] 4.3 运行受影响测试、typecheck、目录严格审计和 OpenSpec strict validation
