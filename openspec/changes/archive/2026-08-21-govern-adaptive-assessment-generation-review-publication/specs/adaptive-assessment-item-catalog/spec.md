## ADDED Requirements

### Requirement: 目录仅接收具备生成发布回执的候选题

生成来源题目只有在候选 lineage 完整、自动预检有效、独立人工审核批准且 publication receipt 可回读时，才 MAY 进入评估目录。目录记录 MUST 包含 generation kind、候选/修订引用、内容哈希、审核决定和 publication identity；临时内存题、模板练习或仅有模型建议的题目不得成为 path-eligible。

#### Scenario: 已批准生成题进入目录

- **WHEN** 目录构建读取到有效生成 publication receipt
- **THEN** 它 SHALL 登记对应不可变 catalog item 和完整 lineage
- **AND** 是否用于 readiness、checkpoint、remediation 或 terminal-validation SHALL 继续由独立阶段政策决定

#### Scenario: 生成题缺少人工批准或发布回执

- **WHEN** 候选只有模型输出、自动预检、临时运行时对象或过期审核
- **THEN** 目录 SHALL 将其报告为 provisional/blocked 或不纳入发布集合
- **AND** 不得以 `ai_generated` 字符串推断正式资格
