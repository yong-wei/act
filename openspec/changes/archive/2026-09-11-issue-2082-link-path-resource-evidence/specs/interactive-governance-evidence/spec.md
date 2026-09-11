# Delta: interactive-governance-evidence

## ADDED Requirements

### Requirement: Path-launched gradable events carry path attribution
路径内启动的可评分互动事件 SHALL 携带路径、目标、节点与资源身份归属，并物化为带该归属的受治理证据；独立打开的资源 SHALL 保持 `standalone_resource` 语义，SHALL NOT 伪造路径归属。

#### Scenario: In-path gradable event is attributed
- **WHEN** 学生从候选路径节点进入可评分测验或规范仿真并完成提交
- **THEN** 事件载荷 SHALL 携带 pathId、goalId、nodeId 与资源身份
- **AND** 物化证据 SHALL 保留该归属，可供路径执行记录与后续画像消费追溯

#### Scenario: Standalone resource stays standalone
- **WHEN** 学生未经路径启动上下文独立打开同一资源并完成
- **THEN** 事件 SHALL 保持 `standalone_resource` 分类且无路径归属字段
- **AND** SHALL NOT 被提升为路径执行证据

#### Scenario: Non-gradable activity is not elevated
- **WHEN** 路径内仅发生页面浏览、视频停留或未评分完成
- **THEN** 系统 SHALL NOT 将其提升为能力掌握证据或写入路径执行 evidenceRefs
