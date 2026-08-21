## ADDED Requirements

### Requirement: 微干预学习事实绑定完整 Canonical 与来源身份

微干预 evidence producer 在写入知识范围 LearningFact 前 MUST 原子核验并保存 active Canonical Object、Authority ReleaseSet/Release、Teaching Projection、resource/path scope、学习目标、规范节点、source answer、intervention、validation item/content 和 capture identity。候选知识、混合修订、缺失 admission 或部分身份 SHALL fail closed。

#### Scenario: 当前投影上的验证事实被接受

- **WHEN** 微干预验证属于当前 active Authority/Teaching Projection、已准入节点和受治理资源/评估 scope
- **THEN** producer SHALL 在一个事实中保存完整知识与来源 lineage
- **AND** 该事实 SHALL 由唯一 outcome/evidence identity 幂等约束

#### Scenario: 节点或投影 identity 漂移

- **WHEN** outcome 的规范节点、Authority Release、Projection 或 capture revision 与当前写入边界不一致
- **THEN** producer SHALL 拒绝正式 LearningFact
- **AND** 仅记录私有 drift/limitation 供审计
