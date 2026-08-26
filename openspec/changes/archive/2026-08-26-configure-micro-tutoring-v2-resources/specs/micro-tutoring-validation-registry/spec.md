## ADDED Requirements

### Requirement: v2 验证注册表覆盖全部当前基线题

系统 SHALL 为 `micro-tutoring-assessment-baseline-v2` 中的每道题登记一道与来源题身份和内容哈希均不同的独立验证题。正式 v2 注册表文件 `micro-tutoring-validation-registry-v2.json` MUST 使用版本 `micro-tutoring-validation-registry.v2`，恰好包含 135 条唯一 catalog、source 与 contentHash 记录，并绑定确定性 item revision 与当前可达的捕获修订。v1 验证注册表文件 `micro-tutoring-validation-registry.json` MUST 保持只读历史兼容，不得被原地扩写。

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
