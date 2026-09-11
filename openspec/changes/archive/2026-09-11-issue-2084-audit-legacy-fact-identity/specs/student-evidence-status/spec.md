# Delta: student-evidence-status

## ADDED Requirements

### Requirement: Profile exposes identity-grouped evidence statistics
画像 API 与学生端状态面 SHALL 展示按知识身份分组的证据统计，并明确呈现混合版本限制；混合身份证据 SHALL NOT 被呈现为单一知识版本。

#### Scenario: Mixed-version limitation is visible
- **WHEN** 学生证据跨越多个知识命名空间或 revision
- **THEN** 画像响应 SHALL 包含按知识身份分组的统计与 `singleVersionComparable=false` 的限制说明
- **AND** 学生端 SHALL 呈现该限制而非高置信度单一版本结论

#### Scenario: Isolated facts are accounted
- **WHEN** 部分事实因无法确定身份被隔离为零权重上下文
- **THEN** 画像统计 SHALL 说明该类事实的数量与受限状态
- **AND** SHALL NOT 将其计入高置信度证据
