## ADDED Requirements

### Requirement: 目录发布显式生命周期覆盖身份

评估目录 release SHALL 对每个项目分别记录允许阶段、人工批准阶段用途、path eligibility、运行时注册状态和所属 lifecycle coverage baseline/version。一个字段的存在不得隐式推导其他层级；高风险阶段用途变化 MUST 触发审核 stale 和新发布回执。

#### Scenario: 目录项目进入 v2 阶段覆盖

- **WHEN** 一个项目被计入 v2 readiness、checkpoint、remediation 或 terminal-validation 单元
- **THEN** 它 SHALL 具有当前内容哈希、人工阶段决定、path eligibility、运行时引用和 v2 baseline identity
- **AND** 历史目录 release SHALL 保持不变

#### Scenario: 阶段用途或运行时注册缺失

- **WHEN** 项目仅有 allowed stage、仅有人工决定或仅有运行时题面之一
- **THEN** 目录 SHALL 报告缺失层级
- **AND** 项目不得计入当前可选择数量
