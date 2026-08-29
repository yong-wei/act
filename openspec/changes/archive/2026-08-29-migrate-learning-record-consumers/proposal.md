## Why

教师、学生、AI、Personalization 以及页面级 helper 仍分别读取 raw event、旧 snapshot、cache 或临时聚合。这样同一 LearningFact 会被不同口径重复计数，stale/unknown 会被误写成零值，角色和小样本隐私也依赖调用者自律。新加入 integration 的 `ground-evidence-copilot` 已有 server-authorized context 合同，迁移时必须接入稳定 read port，不能复制一套权限或上下文解析。

## What Changes

- 将教师、学生、AI、Personalization 和 ground-evidence-copilot 迁移到第三项定义的稳定 Learning Record read ports。
- 以角色最小字段、服务器作用域、独立学习者小样本抑制、privacy classification 和 provenance 作为统一消费边界。
- 禁止页面和普通 route 自行聚合 raw events；raw 仅保留给 audit/debug/migration/drilldown。
- 保持 Copilot 的 URL 仅为 navigation/goal hints，证据仍由服务器解析；保持 advisory-only 和原有 server authorization。
- 以 consumer characterization、纵向迁移、零 caller 证据和删除台账替换重复 readers/aggregators，不做 facade-only 迁移。

## Scope

范围包括 consumer inventory、read-port 接口适配、页面/API/AI/Personalization 迁移、角色/隐私/小样本验证和旧聚合调用删除条件。它不修改 LearningFact ingestion、projection 算法、Copilot 权限合同、Arena official authority，也不执行生产部署或 selector 切换。

## Dependencies and Coordination

- 依赖 `publish-learning-record-current-projections` 的 revision-bound current projection 和 stale/conflict 语义。
- 复用 `evidence-driven-personalization`、`adaptive-learner-state-service`、`student-evidence-status`、teacher-evidence-governance 和 feature-cache contracts。
- 与 `migrate-personalization-recommendations-and-interventions`、`reduce-personalization-learner-state` 和 `ground-evidence-copilot` 协同；Personalization 继续拥有 recommendation/intervention，Copilot 继续拥有 server-authorized context resolver。

## Success Criteria

- 每个 consumer 的 raw source、旧 reader、scope、最小字段、privacy、小样本、stale 处理和删除条件都有闭合分母。
- 学生/教师/AI/Personalization 的正常页面响应均从稳定 read port 获取，且可追溯到 projection revision/LearningFact watermark。
- `ground-evidence-copilot` 不接受客户端 evidence、权限或 raw prompt；现有 ordinary Copilot 行为和 advisory-only 写回边界保持不变。
- 未授权跨用户/跨班级读取、小样本泄露、已知零值与 unknown 混淆、raw aggregation 回退均有失败测试。
- 最后一条旧 consumer 调用和重复 aggregator 在 ledger 有 revision-bound 删除证据。
