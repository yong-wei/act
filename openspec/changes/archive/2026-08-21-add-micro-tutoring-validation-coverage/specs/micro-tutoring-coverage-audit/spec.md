## ADDED Requirements

### Requirement: 覆盖审计验证独立验证题投影

覆盖审计 SHALL 为每个错误选项验证同一捕获修订上的微辅导验证投影，并证明至少一个候选具有当前人工用途审核、相同学习目标和规范节点、适用错因、学生可见性、稳定内容身份，且与来源题 ID/hash 均不同。

#### Scenario: 验证链路完整

- **WHEN** 错误选项存在至少一个当前合格且独立的验证题候选
- **THEN** 审计 SHALL 记录验证题的不可逆安全引用、内容哈希和投影版本
- **AND** 验证侧不得产生覆盖缺口

#### Scenario: 候选题与来源题不独立

- **WHEN** 所有候选均与来源题共享 ID/hash 或缺少变式用途审核
- **THEN** 审计 SHALL 输出 `VALIDATION_QUESTION_UNAVAILABLE`
- **AND** 严格模式 SHALL 失败
