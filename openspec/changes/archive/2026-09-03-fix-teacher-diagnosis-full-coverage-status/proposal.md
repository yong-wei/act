## Why

学情诊断在结构化证据完整覆盖（作业、测验、学习行为均 100/100 纳入）时，教师报告历史仍显示「证据部分可用——已有可用证据，但覆盖或归因仍不完整」（#1904，#1755/#1872 后续缺口）。两个根因在同一生成—投影链路：

1. 生成后校验链（语言、归因、薄弱判定校准、风险标志覆盖误读、总体—子群伪冲突）没有把 `limitations` 与确定性的 `sourceCoverage` 交叉校验，与完整覆盖事实矛盾的假设性限制（如「若部分学生数据缺失可能影响弱势人数统计的精确性」）仍被持久化。
2. 历史投影 `buildAvailability` 在 `confidence === 'medium'` 且未命中伪冲突或真实冲突分支时，无条件回退「证据部分可用」，把一般判断边界错误表述为覆盖或归因缺口；知识节点归因受限分支在 medium 置信度下也不可达。

## What Changes

- 新增持久化前确定性校验：`sourceCoverage` 完整（`coverage = 1`、`includedStudents ≥ classMembers`、作业/测验纳入缺失为 0）时，`limitations` 中「部分/少数/个别/某些学生…数据/证据/进度/记录…缺失/缺少/未覆盖/未纳入/不完整」措辞家族的声明按可重试模型行为缺陷拒绝，不持久化。
- 生成提示词补充覆盖一致性约束：受治理输入覆盖完整时，不得生成假设性学生数据缺失限制。
- 历史投影可用性状态拆分：完整覆盖 + medium + 非伪冲突/非真实冲突时，归因受限显示既有「知识节点归因受限」，否则显示「证据覆盖完整，结论需复核」并给出教师复核动作；「证据部分可用」仅在结构化覆盖确实不完整时出现。
- 诊断 benchmark 新增场景：完整覆盖 + 中置信度上限 + 非冲突判断边界（携带禁止假设性缺失声明的边界旗标）。
- 教师 PDF/交付视图无独立可用性状态面（仅置信度徽标与 limitations 列表），经生成端拦截后自然一致，不单独改动。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `teacher-diagnosis-generation-governance`: 增加 limitations×sourceCoverage 一致性的可重试拦截，以及教师历史投影可用性状态的准确语义要求。

## Impact

- `src/lib/diagnosis-generation-provider.ts`（一致性校验、错误类、提示词）。
- `src/lib/diagnosis-generation-worker.ts`（失败分类与重试）。
- `src/features/teacher/teacher-diagnosis-report-history-projection.ts`（`buildAvailability` 状态拆分）。
- `src/lib/diagnosis-benchmark/types.ts`、`scenarios.ts`、`runner.ts`（新场景与边界旗标）。
- 生成端、worker、历史投影与 benchmark 回归测试。

## Non-Goals

- 不回写或删除历史诊断报告；历史报告经安全投影显示准确状态。
- 不自动将完整覆盖报告提升为高置信度。
- 不放宽既有知识节点归因、薄弱判定校准和真实冲突校验。
- 不为未命中风险的学生伪造「无风险」记录。
- 不对 summary 做通用自然语言审查；仅拦截 limitations 中已知缺陷措辞家族。
