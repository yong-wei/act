# micro-tutoring-v2-assessment-baseline Specification

## Purpose
TBD - created by archiving change expand-micro-tutoring-v2-option-attribution. Update Purpose after archive.
## Requirements
### Requirement: v2 固定当前全阶段合格题目分母

系统 SHALL 以独立版本工件固定当前 135 道人工审核且 path-eligible 的自适应题，阶段计数 SHALL 为 practice 54、checkpoint 27、remediation 27、readiness/readiness-gate 27。每条记录 MUST 绑定 `catalogItemId`、内容哈希、审核阶段和题目审核哈希。v1 的 54 题工件和既有资格证据 MUST 保持不变。

#### Scenario: 当前目录与 v2 基线一致

- **WHEN** 生成器读取当前目录项和人工语义审核快照
- **THEN** 它生成恰好 135 条 v2 基线记录
- **AND** 阶段计数与固定合同一致

#### Scenario: 目录或审核发生漂移

- **WHEN** 题目内容哈希、审核哈希、审核状态或阶段与 v2 基线不一致
- **THEN** v2 记录不得被视为当前有效输入
- **AND** 不得回退到题目级猜测归因

### Requirement: Student entry consumes the v2 denominator

学生微辅导入口 SHALL 以当前激活的 v2 题目分母和阶段为准。仅有 `catalogItemId` 或 `reviewState=reviewed` MUST NOT 视为可开始微辅导。

#### Scenario: Reviewed item is outside v2 coverage

- **WHEN** 题目已审核但不在当前 v2 分母或缺少选项归因
- **THEN** 学生入口 SHALL 报告未覆盖
- **AND** MUST NOT 显示可用的开始微辅导

