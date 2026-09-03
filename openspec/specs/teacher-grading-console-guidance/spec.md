# teacher-grading-console-guidance Specification

## Purpose
TBD - created by archiving change improve-assignment-grading-visual-evidence. Update Purpose after archive.

## Requirements

### Requirement: 教师可理解一键批改资格
批改控制台 MUST 用中文说明一键批改当前可用或不可用的原因，包括截止时间、已提交作业、既有批改快照、权限、证据处理和策略状态。

#### Scenario: 未到截止时间
- **WHEN** 教师在作业截止前访问批改控制台
- **THEN** 控制台 MUST 显示未到批改时间的中文说明，且不显示可执行的 AI 批改操作

#### Scenario: 视觉证据待复核
- **WHEN** 已提交学生的某题视觉证据状态为待复核
- **THEN** 控制台 MUST 显示转人工或重试入口，并说明自动批改被阻断的业务原因

### Requirement: 控制台不泄露内部实现
教师和学生界面 MUST 使用中文业务术语，不得显示内部字段名、样例账号、Provider 名称、模型版本、数据表名、原始作答或身份映射。

#### Scenario: 渲染批改状态
- **WHEN** 控制台展示批改、转换或复核状态
- **THEN** 页面 MUST 使用中文业务文案和受控诊断码，而不是内部变量或实现细节
