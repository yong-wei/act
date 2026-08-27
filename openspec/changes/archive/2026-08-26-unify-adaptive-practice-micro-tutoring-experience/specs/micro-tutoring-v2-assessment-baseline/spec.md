## ADDED Requirements

### Requirement: Student entry consumes the v2 denominator

学生微辅导入口 SHALL 以当前激活的 v2 题目分母和阶段为准。仅有 `catalogItemId` 或 `reviewState=reviewed` MUST NOT 视为可开始微辅导。

#### Scenario: Reviewed item is outside v2 coverage

- **WHEN** 题目已审核但不在当前 v2 分母或缺少选项归因
- **THEN** 学生入口 SHALL 报告未覆盖
- **AND** MUST NOT 显示可用的开始微辅导
