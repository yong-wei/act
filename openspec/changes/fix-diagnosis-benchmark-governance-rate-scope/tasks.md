## 1. 指标分母修正

- [ ] 1.1 `computeScenarioMetrics` 四个治理率分母改为 `status === 'ok'`；空成功集记 1
- [ ] 1.2 单测：治理拒绝不进分母、全成功=1、全失败=1 且成功率=0、成功率口径不变

## 2. 验证

- [ ] 2.1 用第二次 live run（runId 2026-09-01T00-11-36-121Z-live）的 evaluations 重放聚合，确认 passed = true
- [ ] 2.2 typecheck / lint / 相关单测全量通过
