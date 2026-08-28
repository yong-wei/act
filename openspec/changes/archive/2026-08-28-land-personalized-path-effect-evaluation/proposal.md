# Proposal: Land personalized path effect evaluation

## Why

#1561 已冻结“画像事实 → 路径决策 → 候选差异”证据链，但教师仍无法判断个性化路径是否改善了学习过程。系统只能展示个性化说明，不能把路径快照、执行结果和受治理证据连成可复现、隐私安全的效果评估。

## What Changes

- 建立只读评估投影：绑定学习目标、生成时 learner-state 决策快照、路径版本/候选批次和评估窗口。
- 汇总采纳、完成、检查点、能力变化，并把冷启动/低置信/过期样本与高置信个性化效果分开。
- 个性化路径与同目标基准路径使用相同资格和终结验证约束；样本不足时只显示“数据不足”。
- 教师/管理员只读视图展示样本数、分母、完整度、置信度和限制，不改写路径或掌握度。

## Capabilities

### New Capabilities

- `personalized-path-effect-evaluation`: 路径效果评估 read model、权威边界和只读视图。

### Modified Capabilities

无。复用既有 `adaptive-learning-path-planning`、`adaptive-learning-optimization-experiments` 与决策证据合同，不引入 bandit 或第二套评分。

## Impact

- 新增评估投影、教师班级 API 与分析页只读区块
- 读取 LearningPath、执行记录和已冻结 candidate-batch 决策证据
- 不修改路径、执行状态、画像或 Arena 正式成绩
