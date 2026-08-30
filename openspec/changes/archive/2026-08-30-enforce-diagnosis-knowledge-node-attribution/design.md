# Design: Enforce knowledge-node attribution in diagnosis findings

## Context

- 证据映射在生成端完全可得：`projectFrozenKnowledgeProgress` 输出的每行都携带 `knowledgeNodeId: row.nodeId` 与 `evidenceRefs: ['knowledge-progress:<rowId>']`，`generateGovernedDiagnosisReport` 内可零成本建立 `evidenceRef → nodeId` 解析表。
- 投影层现状：`attributionLimited = 任一 knowledge-progress 引用 finding 缺节点`（#1620 后保留）；高置信度 + 覆盖完整 + attributionLimited → "证据可用，但覆盖受限"（`buildAvailability` 的高置信分支）。
- 失败语义先例（#1711 语言门）：模型行为缺陷 → `validation: false` 可重试（3 次预算）；证据契约违例 → 不可重试。

## Decision

1. **能确定性回填的就不重试，不能回填的才拒绝。** 引用行唯一节点 + finding 未填 → 直接回填（模型漏填最常见的回归形态被确定性修正，不消耗重试预算）；引用行横跨多个节点时发现本身归因歧义，无论是否已填节点一律拒绝（防止挑选其中一个节点把其它节点的证据持久化为该发现依据）；填了不存在的节点、与唯一引用证据不一致 → 同样新错误 `DiagnosisGenerationFindingAttributionError`，worker 归类可重试（code `diagnosis-finding-attribution-invalid`），耗尽后 FAILED 并呈现中文原因。归因义务仅适用于引用 knowledge-progress 证据的发现（与投影层 `findingRequiresKnowledgeNodeAttribution` 语义一致）：非知识发现即使携带节点也不做全集校验，整体豁免。引用行在输入中本无节点 → 不是模型缺陷：未填则保持缺省，由投影层如实标注；模型填入其它行的有效节点同样拒绝（防止把无映射证据归因到别处节点）。
2. **节点全集以受治理输入为准。** "有效节点" = governedInput knowledgeProgress 行中出现过的 `nodeId`；冻结输入是唯一权威，模型不得引入输入之外的节点。
3. **投影层归因专属状态。** `attributionLimited && confidenceReasons.length === 1 && limitations 为空`（唯一原因即归因原因，且不存在声明限制、所有证据组均为 available——`LIMITATION_LABELS` 之外的自定义限制文本不进入 confidenceReasons，行为组 partial（coverage<1 而 includedStudents=classMembers）也不产生置信原因，都必须单独排除）→ 可用性状态返回"知识节点归因受限"与归因恢复建议；与任何数据覆盖原因并存时保持现行为，真实覆盖不足提示不变。放在高置信分支前、低/中置信分支后：confidence 不足本身仍是更优先的真实状态。
4. **Prompt 与校验双保险**（同 #1711 先例）：prompt 要求知识点发现携带与引用证据一致的 `knowledgeNodeId`、总体风险/成绩分布类发现豁免；校验独立存在。

## Alternatives considered

- 全部走重试不做回填：最常见形态（单节点漏填）无需模型参与即可修正，浪费重试预算，放弃。
- 按引用行回填"多数节点"：引入非确定性猜测，宁可拒绝重试，放弃。
- 投影层把归因缺失改称覆盖不足的现状保留：正是 Issue 指出的误解来源，放弃。

## Risks / trade-offs

- 归因校验使既有英文 fixture 之外的旧式测试数据（知识点 finding 缺节点且引用行为单节点）被回填——属预期修正，测试相应更新断言。
- 多节点引用 + 漏填会触发重试：模型按 prompt 要求填节点后即通过；极端情况下重试耗尽任务失败，教师可显式重试，宁可失败不可错报。
- 运行时无已复现样本（生产/本地均未见 Issue 描述报告），验收以生成端与投影层回归测试覆盖。

## Migration Plan

单 PR 内完成生成端、worker 分类、投影层与测试；无数据迁移、无 schema 变更。已持久化的历史报告不回写。

## Open Questions

无。
