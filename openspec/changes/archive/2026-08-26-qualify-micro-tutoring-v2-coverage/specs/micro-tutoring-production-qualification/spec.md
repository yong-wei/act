## ADDED Requirements

### Requirement: v2 生产资格绑定 135 题闭环证据

系统 SHALL 仅在 v2 严格覆盖显示 135 题及其全部错误选项完整，并且归因、编排、并发、幂等、事件持久化和验证结果的 production-like PostgreSQL 测试通过时，生成独立的 v2 生产资格候选。v1 资格回执 MUST 保持可审计且不被覆盖。浏览器证据 MUST 覆盖 practice、checkpoint、readiness 和 remediation 四类真实入口，但不得替代服务端和数据库验证。

#### Scenario: v2 闭环满足资格

- **WHEN** 同一捕获修订的 v2 严格报告完整，且必需服务端与浏览器证明通过
- **THEN** 系统 MAY 生成 `micro-tutoring-production-qualification.v2` 候选回执
- **AND** 候选不得改写 v1 回执或生产选择器

#### Scenario: 资格输入漂移

- **WHEN** Git 修订、脏工作树、混合 worktree、摘要、资源或验证题任一不一致
- **THEN** v2 资格 SHALL 失败关闭
- **AND** 不得写出 candidate receipt

### Requirement: v2 资格激活前后保留回滚证据

v2 资格通过 SHALL 只产生 candidate。未获显式激活授权时生产行为 MUST 保持不变；canary 越界或未授权激活 MUST 产生可回读 rollback/candidate-only 证据，并保留 append-only 干预数据。

#### Scenario: 候选通过但未授权激活

- **WHEN** v2 candidate receipt 有效而生产激活尚未授权
- **THEN** 评估结果为 candidate-only 且 productionUnchanged
- **AND** 生产选择器不得被修改
