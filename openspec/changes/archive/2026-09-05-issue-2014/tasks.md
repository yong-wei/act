# Tasks

- [x] 1. `readLatestGovernedFactAt` 增加 `readRevokedFactIds`（按 factId 最大 sequence 判定最终 REVOKE），查询以 `id: { notIn }` 排除已撤销事实；db 缺少 transition 接口时保持现状。
- [x] 2. consumers 测试补撤销感知三场景（REVOKE 不触发过期 / 有效 UPSERT 仍过期 / 混合事实取有效时间），既有 mock 用例回归通过。
- [x] 3. typecheck、受影响文件 lint、data-governance 与教师洞察相关测试；OpenSpec strict 与归档。

## 完成说明

- Codex review P1 整改：CORRECT 事实的有效时间采用 transitionPayload.fact.startedAt（修正后时间），避免按不可变 LearningFact.startedAt 误判新旧。
- 撤销感知测试扩展至四场景（REVOKE 不触发过期 / UPSERT 仍过期 / 混合取有效时间 / CORRECT 修正时间参与比较），消费者域 19 用例通过。
