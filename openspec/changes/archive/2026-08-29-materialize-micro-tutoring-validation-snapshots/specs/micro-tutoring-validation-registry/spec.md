## ADDED Requirements

### Requirement: v2 验证投影必须物化到可编排的 AdaptiveAssessmentItemRef

系统 SHALL 将 `micro-tutoring-validation-registry-v2.json` 中每条启用且学生可见的验证题幂等物化到 `AdaptiveAssessmentItemRef`。物化记录 MUST 使用该条目的 `sourceId` 与内容哈希作为身份，并写入当前 catalog 快照、`itemRevision`、捕获修订和 `learnerVisible=true`。v1 验证注册表文件 MUST 保持只读。编排器查询与 fail-closed 条件 MUST 保持不变：投影与数据库快照交集为空时仍返回 `VALIDATION_QUESTION_UNAVAILABLE`。

#### Scenario: 缺失的验证题快照被创建

- **WHEN** 当前数据库没有某条 v2 验证题 `sourceId` 与内容哈希对应的 `AdaptiveAssessmentItemRef`
- **AND** 该题在当前 catalog 中存在且内容哈希、版本与治理身份一致
- **THEN** 同步 SHALL 创建一条不可变快照
- **AND** 写入 `remediationValidation` 治理元数据，包含 `learnerVisible`、`itemRevision` 与当前干净 Git 捕获修订

#### Scenario: 已有一致记录保持幂等

- **WHEN** 已有 `AdaptiveAssessmentItemRef` 的题目身份、内容哈希、题目版本和治理元数据与当前投影一致
- **THEN** 同步 MUST 不新增重复记录
- **AND** MUST 不改变该行主键或其他身份字段

#### Scenario: 编排器能解析复现错因

- **WHEN** 物化后的数据库路径收到规范节点 `kn:autocontrol:feedback-loop` 与错因 `misconception:feedback-loop-concept-foundations:assumes-unity-feedback`，来源题为 `feedback-loop-concept-foundations-practice-03`
- **THEN** 编排器 SHALL 选择至少一道不同于来源题的合格验证题
- **AND** 不得返回 `VALIDATION_QUESTION_UNAVAILABLE`

#### Scenario: frequency-response 复现错因同样可编排

- **WHEN** 物化后的数据库路径收到 `frequency-response-foundations-practice-06` 的已审核错误选项
- **THEN** 编排器 SHALL 选择至少一道不同于来源题的合格验证题
- **AND** 不得返回 `VALIDATION_QUESTION_UNAVAILABLE`

#### Scenario: 54 道 practice 题的已审核错误选项均可形成任务

- **WHEN** 对当前 v2 基线 54 道 practice 题的每个已审核错误选项执行覆盖检查，并使用同步后的 TeachingResource 与验证题快照
- **THEN** 归因明确时 MUST 能选择至少一项合格资源和一项不同于原题的验证题
- **AND** 生成满足 5–10 分钟预算的任务

#### Scenario: 缺失、漂移或治理元数据不一致时 fail-closed

- **WHEN** catalog 缺失、内容哈希漂移、版本漂移、`learnerVisible=false`、同一身份冲突或不洁净 Git
- **THEN** 同步 SHALL 返回稳定失败原因并指出具体缺口
- **AND** 不得覆盖历史答题快照、放宽编排查询或通过预先作答偶然创建快照

### Requirement: VALIDATION_QUESTION_UNAVAILABLE 必须有明确学生可见说明

当编排因验证题快照不可用而返回 `VALIDATION_QUESTION_UNAVAILABLE` 时，学生界面 SHALL 显示明确中文说明，MUST NOT 使用笼统的“当前没有可安全执行的微辅导任务”。

#### Scenario: 学生看到验证题快照不可用

- **WHEN** 学生从已归因错题启动微辅导，编排结果为 `UNAVAILABLE` 且原因为 `VALIDATION_QUESTION_UNAVAILABLE`
- **THEN** 页面 SHALL 说明当前没有可用于本次微辅导的独立验证题快照
- **AND** MUST NOT 暴露内部治理字段或另一名学习者的证据
