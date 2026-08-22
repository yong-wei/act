## ADDED Requirements

### Requirement: 微干预事件按验证权威分配质量权重

LearningFact 质量政策 SHALL 将微干预资源打开、学习动作、提示和完成事件标记为 context-only、零 profile weight；治理合格的独立验证结果 MAY 获得有界 assessment-backed 权重。权重政策 MUST 记录算法版本、原因、重复抑制和终结性掌握限制。

#### Scenario: 参与事件物化为 LearningFact

- **WHEN** 微干预参与事件需要保留为可追踪上下文
- **THEN** LearningFact SHALL 设置零 profile weight 和显式 policy reason
- **AND** 不得参与 competency/profile 得分

#### Scenario: 独立验证结果物化

- **WHEN** 合格微干预验证投影创建 LearningFact
- **THEN** producer SHALL 持久化有界 profile weight、skip flag、policy reason 和证据算法版本
- **AND** 单条事实不得被标记为 terminal-mastery-grade
