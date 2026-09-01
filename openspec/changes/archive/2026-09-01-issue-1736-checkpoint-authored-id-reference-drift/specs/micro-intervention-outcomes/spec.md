## ADDED Requirements

### Requirement: Checkpoint-authored validation questions use runtime identity

系统 SHALL 在微辅导启动、快照持久化、读取验证题和提交验证时，把 checkpoint-authored 作者态 source ID 解析为带 `checkpoint-authored-question:` 前缀的运行时身份。解析成功后，新 intervention 的 `validationRuntimeHash` MUST 非空且等于该运行时题目的规范哈希。作者态 ID 与对应运行时 ID SHALL 视为同一验证题身份。preset 与 generated 验证题 MUST 保持原有查找行为。已经持久化且 `validationRuntimeHash` 为 `null` 的 intervention MUST 继续不可验证，系统不得补写哈希。

#### Scenario: Authored source ID starts a new intervention

- **WHEN** 可用微辅导任务的验证题 ID 是 checkpoint-authored 作者态 source ID，且对应运行时题目存在
- **THEN** 系统 SHALL 把它解析为 `checkpoint-authored-question:<sourceId>`
- **AND** SHALL 持久化非空且与该运行时题目一致的 `validationRuntimeHash`

#### Scenario: Learner fetches and submits the authored validation question

- **WHEN** 上述新 intervention 完成学习后读取并提交验证题，且题目内容与版本未变
- **THEN** 系统 SHALL 返回学生安全题面并接受匹配的提交
- **AND** SHALL NOT 返回 `REFERENCE_DRIFT`

#### Scenario: Legacy null runtime hash stays fail-closed

- **WHEN** 已持久化 intervention 的 `validationRuntimeHash` 为 `null`
- **THEN** 系统 SHALL 拒绝读取或提交验证题
- **AND** SHALL NOT 根据当前题目补写哈希

#### Scenario: Real content drift still fail-closed

- **WHEN** 运行时验证题身份未变，但内容或答案语义在启动后发生变化
- **THEN** 系统 SHALL 返回 `REFERENCE_DRIFT` 或拒绝记录验证结果
- **AND** SHALL NOT 用过期哈希接受提交
