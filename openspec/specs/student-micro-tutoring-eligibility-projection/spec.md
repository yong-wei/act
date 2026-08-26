# student-micro-tutoring-eligibility-projection Specification

## Purpose
为学生自适应练习返回题目阶段和微辅导资格投影，客户端只渲染服务端结果，不自行推断入口。
## Requirements
### Requirement: Server projects student-safe micro-tutoring eligibility

系统 SHALL 为当前自适应题目和错答返回服务端资格投影。客户端 MUST NOT 用 catalog 字段或审核状态自行推断是否可开始微辅导。

#### Scenario: Qualified wrong answer

- **WHEN** 错答完整匹配已激活 v2 归因、资源和独立验证题
- **THEN** 投影 `qualified` 为真
- **AND** 页面可以显示开始微辅导

#### Scenario: Unqualified item

- **WHEN** 题目未覆盖、内容哈希漂移、资源不可用、验证题不可用或访问撤销
- **THEN** 投影 `qualified` 为假并给出对应 `unavailableReason`
- **AND** 页面不得显示可用的开始入口

### Requirement: Adaptive practice shows the real assessment stage

自适应练习页面 SHALL 显示服务端题目阶段：常规练习、准备度、检查点、补救或终结验证。

#### Scenario: Checkpoint question is shown

- **WHEN** 当前题目阶段为 checkpoint
- **THEN** 标题 SHALL 标识检查点
- **AND** MUST NOT 把其他阶段显示为检查节点练习

### Requirement: Practice and path execution sessions stay isolated

独立练习与路径执行 SHALL 使用不同 session，并在切换时丢弃题目、答案和微辅导面板状态。

#### Scenario: Student leaves path execution for standalone practice

- **WHEN** session 从路径检查点切换到独立练习
- **THEN** 系统 SHALL 清空上一 session 的题目和微辅导状态
- **AND** MUST NOT 复用旧 checkpoint 答案

