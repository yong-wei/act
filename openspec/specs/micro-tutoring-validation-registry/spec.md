# micro-tutoring-validation-registry Specification

## Purpose
定义从自适应评估目录和不可变 `AdaptiveAssessmentItemRef` 派生的微辅导验证用途投影：为每个规范节点和已审核错因提供与来源题独立的验证候选，绑定 catalog 身份、内容哈希、学生可见性和版本。本投影不是第二套题库，也不表示 54/54 运行时已完成。
## Requirements
### Requirement: 微辅导验证登记复用受治理评估目录

系统 SHALL 从 `adaptive-assessment-item-catalog` 和不可变 `AdaptiveAssessmentItemRef` 派生版本化微辅导验证投影。每条绑定 MUST 包含 catalog item id、内容哈希、人工审核和用途决定、学习目标、active `kn:` 节点、适用错因、难度、学生可见性、投影版本及捕获修订，不得复制题目正文形成第二套题库。

#### Scenario: 现有 remediation 题通过验证用途审核

- **WHEN** 一个现有 path-eligible 题目经人工确认适合特定学习目标、节点和错因的独立验证
- **THEN** 投影 SHALL 引用其现有 catalog 和内容身份
- **AND** 保留原来源、审核和阶段 lineage

#### Scenario: 题目阶段标签未经验证用途审核

- **WHEN** 一个题目仅标记为 remediation 或 checkpoint，但没有微辅导验证用途决定
- **THEN** 系统 SHALL 将其视为候选而非合格验证题
- **AND** 不得自动计入覆盖

### Requirement: 验证题与来源题保持内容和身份独立

验证选择 SHALL 排除与来源题具有相同题目 ID 或相同内容哈希的候选，并 SHALL 要求人工审核记录同一关键概念下的合理变式依据。重命名、复制或仅改变非语义字段的题目不得作为独立验证。

#### Scenario: 验证候选复用来源内容

- **WHEN** 候选题与来源题的题目 ID 或内容哈希任一相同
- **THEN** 候选 SHALL 被排除
- **AND** 编排在无其他候选时 SHALL 返回 `VALIDATION_QUESTION_UNAVAILABLE`

#### Scenario: 合格概念变式被选择

- **WHEN** 候选具有不同 ID/hash、相同学习目标和节点、适用错因且通过变式独立性审核
- **THEN** 选择器 MAY 将其作为验证题
- **AND** 选择结果 SHALL 封存全部资格和内容身份

### Requirement: 验证选择确定、学生安全且版本封存

服务端 SHALL 从当前合格候选中确定性选择一个验证题并在干预开始时封存；学生投影 MUST 排除答案、教师说明、私有标签和内部审核理由。候选退役、权限撤销、内容变化或投影修订漂移 SHALL 阻止新选择，并 SHALL 使不再匹配快照的提交 fail closed。

#### Scenario: 学生获取验证题

- **WHEN** 当前干预具有一个合格、可访问、版本匹配的验证题
- **THEN** 服务端 SHALL 返回学生安全题面并保留服务端答案语义
- **AND** 客户端不得指定替代题

#### Scenario: 验证题在提交前漂移

- **WHEN** 封存后的题目内容、答案语义、权限或投影 identity 发生变化
- **THEN** 系统 SHALL 返回 `REFERENCE_DRIFT`
- **AND** 不得记录验证结果

### Requirement: v2 验证注册表覆盖全部当前基线题

系统 SHALL 为 `micro-tutoring-assessment-baseline-v2` 中的每道题登记一道与来源题身份和内容哈希均不同的独立验证题。正式注册表 MUST 恰好包含 135 条唯一 catalog、source 与 contentHash 记录，并绑定确定性 item revision。v1 验证注册表工件 MUST 保持只读历史兼容。

#### Scenario: v2 分母均有独立验证题

- **WHEN** 加载当前 v2 基线与验证注册表
- **THEN** 注册表恰好包含 135 条唯一身份记录
- **AND** 每条验证题与其来源题的 ID 和内容哈希均不同

### Requirement: 验证用途决定必须来自独立审核工件

系统 SHALL 从可审计的 `micro-tutoring-validation-purpose-reviews-v1.jsonl` 读取每条验证题的用途决定，并同时核对其 catalog 身份、sourceId、contentHash 与规范知识节点。生成器不得根据普通 assessment approval 或阶段标签自行合成用途审核。缺失或不匹配时 MUST fail closed，该题不得进入正式注册表。

#### Scenario: 已批准题目缺少用途审核

- **WHEN** 某题 assessment semantic review 为 approved，但独立用途审核工件中没有匹配记录
- **THEN** 验证注册表拒绝该条目
- **AND** 不得把该题计入合格验证覆盖

