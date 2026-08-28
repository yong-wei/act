## Context

提案时 `integration` 的工作树 HEAD 为 `64ad736e4b5210968169ccc2a562267fc388b47e`，且已包含 `64ad736e4`。本地 `govern-adaptive-assessment-generation-review-publication` 目录有 proposal、design、tasks 和两份 spec delta，`openspec status` 仅按工件存在判定完成；其 tasks 仍是未勾选状态，而 GitHub #1480 已关闭并标记 archived。这个冲突本身就是本 change 的输入，不是完成证明。

代码中 `src/features/assessment/adaptive-engine.ts` 仍声明 `globalThis.__adaptiveAssessmentStore`，其中包含 `generatedQuestions: Map`；`src/features/assessment/adaptive-persistence.ts` 仍暴露 `isAdaptiveAssessmentPersistenceEnabled` 和多个 `*WithPersistenceFallback`。同时生成题的来源字段和 catalog 状态已被多个测试、目录选择器及 LearningFact 逻辑消费。必须先区分“临时 practice 的运行缓存”和“可发布候选”，再判断已有审核实现是否覆盖 canonical spec。

## Goals / Non-Goals

**Goals:**

- 固定一个可追溯的合同身份、实现 revision、测试集合、任务状态、归档路径和 Issue 状态对账表。
- 让 generation kind、候选 lineage、人工审核和 catalog publication 的语义与 canonical spec 一致。
- 证明或补齐候选到版本化目录的完整纵向链路，并保持 `AdaptiveAssessmentItemRef` 和历史答案不可变。
- 将模板 `Map` 明确降级为非权威临时 practice，删除/迁移其伪装为 `ai_generated` 的路径，给下游持久化 cutover 留出清晰删除条件。

**Non-Goals:**

- 不建立新的候选表、第二套 catalog、第二套审核状态机或第二个发布器。
- 不把 GitHub closed、`openspec status` 的文件完成或测试 fixture 当作单独的 qualified 证明。
- 不在本 change 完成 Assessment attempt 的 Map/flag 全部删除；其完整 path-owned 删除由下游 change 负责。
- 不把 prompt、原始模型响应、学生答案或本机绝对路径写入公开报告。
- 不部署、不修改 production selector、不进行生产激活。

## Decisions

### 1. 用一张 reconciliation matrix 决定 qualified

对账记录固定 `contractId`、canonical spec revision、source tree、implementation paths、test paths、task evidence、archive path、Issue number/status、publication receipt 和缺口。每项必须指向 repository-relative evidence；任一字段漂移、缺失或来自不同 revision 都返回 `NOT_QUALIFIED`。Issue closed 只能作为一列状态，不能绕过代码和证据检查。

### 2. 真实生成来源在最早边界归一化

生成器返回不可混淆的 `generationKind`（例如 `template-practice`、`model-candidate`、`human-authored`），后续目录和证据只读该 discriminator。固定模板若仍保留运行时缓存，必须带临时 practice 限制并不得创建候选 publication；删除 `ai_generated` 的字符串推断，而不是在下游再加一个覆盖字段。

### 3. 复用现有 candidate/catalog 合同

实现搜索优先复用已存在的候选、review decision、catalog item、content hash 和 publication receipt 类型。若一部分已存在，只补缺少的 adapter、状态转移或验证；若一部分不存在，按已有 `adaptive-assessment-generation-review-publication` delta 的 identity 实现，不新增平行表或平行 JSON schema。候选到目录的路径为：

```text
generation envelope
  -> deterministic precheck
  -> awaiting-human-review
  -> independent approval
  -> versioned catalog publication receipt
  -> stage policy / path eligibility
```

### 4. 阶段资格与生成审核分开

人工批准仅证明内容可发布；readiness、checkpoint、remediation、terminal-validation 和 path eligibility 仍由现有 catalog/stage policy 独立决定。模型建议、自动预检、普通浏览和临时模板练习不得写高置信 mastery 或重路径资格。

### 5. 以证据闭合旧入口

在完成对账前保留旧合同作为待迁移观察，不创建 facade。对账完成后，删除本 change 引入的错误 `ai_generated` 映射和无调用的生成入口；`adaptive-engine` 的全局 Map 以及 persistence fallback 的最终删除由 `cutover-path-owned-assessment-attempts` 负责，并以本 change 的 truthful catalog 身份为前置。

## Risks / Trade-offs

- [已有 #1480 工件被误认为实现完成] → 对账矩阵要求代码、测试、tasks、archive、Issue 和相同 revision 全部可验证，否则保持 `NOT_QUALIFIED`。
- [历史模板练习被误计入目录] → 在生成边界写入 `template-practice`，catalog exporter 只接受有 publication receipt 的候选。
- [补齐实现时重复定义候选模型] → 先查 canonical spec、活动 change 和现有持久化类型；新增代码只能实现既有合同缺口，并由架构依赖检查拒绝平行 identity。
- [人工审核队列无限扩大] → 只处理显式增量和当前发布资格缺口，历史一次性对账保留机器异常账本，不把所有运行时对象伪造为人工队列。
- [公开证据泄露敏感输入] → receipt 只包含 hash、版本、来源 identity 和状态；prompt、原始响应、答案正文和用户标识留在受限边界。

## Migration Plan

1. 冻结本 change、既有合同和 canonical spec 的输入 revision，完成代码/测试/tasks/archive/Issue 对账。
2. 先补 truthful generation kind 和模板 practice 限制，再补实际缺失的候选审核/目录发布路径。
3. 用同一 catalog builder 生成 publication receipt，验证阶段资格、历史快照和 LearningFact 权限不被放宽。
4. 通过针对测试、Assessment 域测试、strict validation 与 diff check 后，才由授权流程归档/关闭旧 change；任何一项状态不一致都保留为未 qualified。
5. 回滚时停止新增候选发布，保留历史候选、目录和答案 lineage；不得恢复 `ai_generated` 误标或删除历史快照。

## Open Questions

无需要在 proposal 阶段裁决的问题。实际缺口以对账矩阵为准；若合同身份或 canonical spec 在实现前漂移，应停止并重新确认依赖，而不是假定 #1480 已完成。
