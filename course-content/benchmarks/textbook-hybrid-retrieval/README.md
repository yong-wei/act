# 教材混合检索语义基准

本基准包含 50 条教学查询，覆盖概念、公式、图表、中英文术语和跨教材表达。每题保留全部直接且完整支撑回答的最小结构单元及首选来源。

v2 固定拆分为 39 条 tuning 查询和 11 条 acceptance 查询。第一次且唯一一次 v1 holdout 的 5/7 one-shot 结果已归档到 `history/v1-initial-holdout/`；旧 holdout 已被读取，因此除已知失败题外的 6 条旧题只能转入 tuning。

4 条新增 tuning 查询和 10 条新增 acceptance 查询均在任何检索前预先分配。模型选择和参数调整阶段只允许读取 tuning 集；配置冻结后，v2 acceptance 只运行一次。验收要求 Recall@10 至少命中 9/11，且 `known-failure-first-order-unit-step-response` 必须命中。

文件：

- `benchmark.jsonl`：问题、类别、全部合格单元、首选单元和标注依据。
- `split.json`：固定 tuning/acceptance ID 集合。
- `benchmark-lock.json`：benchmark、split、ID 集合、候选模型与定价的冻结记录。
- `labeling-prompt.md`：直接完整支撑与首选来源的标注合同。

基准只保存查询和结构身份，不复制教材正文，也不包含任何用户数据。
