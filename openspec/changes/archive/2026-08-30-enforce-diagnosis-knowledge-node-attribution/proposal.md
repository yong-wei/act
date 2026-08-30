# Change: Enforce knowledge-node attribution in diagnosis findings

## Why

Issue #1712：知识点发现缺失 `knowledgeNodeId` 时，完整的数据覆盖被误展示为"证据可用，但覆盖受限"。经核实（2026-08-30）机制全部属实：

- 生成契约允许 `knowledgeNodeId` 缺省（provider schema `.optional()`），且没有任何校验要求"引用 knowledge-progress 证据的知识点发现必须携带与引用证据一致的有效节点"——模型漏填、填入不存在的节点或与引用证据不一致都会被当作成功结果持久化。
- 受治理输入本身携带节点映射：provider 请求中每条 knowledge-progress 行都带 `knowledgeNodeId`（`row.nodeId`）与自身的 `evidenceRefs`，确定性回填所需信息在生成端完全可得，但当前未被使用。
- 投影层（#1620/#1652 保留的规则）：任一引用 knowledge-progress 证据的 finding 缺 `knowledgeNodeId` 即 `attributionLimited`，在 confidenceReasons 注入"部分发现没有可核验的知识节点映射…"，进而使高置信度、覆盖完整的报告显示"证据可用，但覆盖受限"，造成数据资源不完整的误解。

运行时样本披露：Issue 所述"最新报告"（100 人班、覆盖完整、两条知识点发现缺节点）在生产库（最新 2026-08-21，7 人班、0 findings）与本地库均未找到；与 #1711 相同，以机制修复 + 生成端/投影层回归测试阻断该路径。

## What changes

- 生成端新增确定性归因校验与回填：对引用 knowledge-progress 证据的 finding——
  - 引用证据行解析出唯一节点且 finding 未填节点 → 确定性回填该节点（等效"修正"处理）；
  - 引用证据行解析出多个不同节点且未填节点 → 模型行为缺陷，拒绝并重试（不得持久化）；
  - 已填节点不在受治理输入的节点全集、或与引用证据行解析出的节点不一致 → 模型行为缺陷，拒绝并重试；
  - 引用证据行在输入中无任何节点（真实无映射）→ 保持现状，由投影层如实标注归因受限。
- system prompt 增加对应输出要求（知识点发现必须携带与引用证据一致的 knowledgeNodeId；总体风险、成绩分布类发现豁免）。
- worker 失败分类接入新错误（同语言门先例：可重试模型行为缺陷），耗尽预算后任务失败并呈现中文原因。
- 投影层区分归因与覆盖：当 attribution-limited 是唯一置信原因（数据覆盖完整）时，可用性状态表述为"知识节点归因受限"及对应恢复建议，不再使用"证据可用，但覆盖受限"；真实的数据覆盖不足提示保持不变。

## Non-goals

- 不为非知识节点发现（总体风险、成绩分布等）编造或要求 `knowledgeNodeId`（保持 #1620/#1652 规则）。
- 不降低真实知识节点归因缺失的治理要求，不将完整数据覆盖与知识节点映射合并为同一含义。
- 不改变生成任务的身份、幂等、并发与授权语义；不重新设计报告版式。

## Impact

- Specs：`teacher-diagnosis-generation-governance`（新增归因校验/回填/重试需求）、`teacher-diagnosis-report-delivery`（MODIFIED：attribution-limited 状态 + 归因专属可用性表述）。
- Code：`src/lib/diagnosis-generation-provider.ts`（归因解析、校验、回填、prompt、新错误类型）、`src/lib/diagnosis-generation-worker.ts`（失败分类）、`src/features/teacher/teacher-diagnosis-report-history-projection.ts`（归因专属可用性状态）。
- Tests：生成端归因校验/回填/拒绝与 worker 分类断言；投影层归因专属状态与既有覆盖规则回归。
