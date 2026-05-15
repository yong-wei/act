## ADDED Requirements

### Req: adapter must not generate unpersisted experiments

`ArenaPlantAdapter.runPublicExperiment` 不得自行生成 `datasetHash` 或使用 `Math.random()` 创建不持久化的数据集。

### Req: adapter wraps existing experiment service

最新版 `createCruiseRollBlackBoxAdapter.runPublicExperiment` 必须调用 `createArenaBlackBoxExperiment` 或将自身标记为 `createMockAdapterForTests` 并仅在测试中使用。

### Req: all blackbox experiments remain budget-constrained

通过 adapter 触发的实验仍受每日预算（20 次/天）约束。

### Req: dataset ownership validation preserved

所有黑箱提交必须通过 `assertBlackBoxExperimentOwnership` 检查（datasetHash 归属、identificationModelId 对等）。
