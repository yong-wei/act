## Why

现有教学资源仍绑定旧节点，而 ActKG 来源证据与 ACT 资源教学用途是两种不同关系。生产切换前必须让所有有效教学资源获得可审核的 Canonical 绑定，同时避免全库重复读取和模型自我批准。

## What Changes

- 区分 ActKG Canonical→Source/Evidence 权威对齐与 ACT 资源的讲解、练习、评价、引用教学角色。
- 建立稳定 Crosswalk，将 EvidenceSegment 解析到 ACT 原子内容片段和引用锚点。
- 采用节点主导、变化端触发的双向增量绑定；缓存身份包含对象修订、资源片段哈希和提示词版本。
- 唯一 EvidenceSegment 对齐且资源类型唯一确定教学角色时允许确定性发布。
- 词面、向量或 GPT 结果只形成候选，由隔离上下文的 GPT 独立审核；争议、高影响和冲突项进入人工裁定。
- 仅已发布、可推荐、可进入路径或可产生证据的有效教学资源阻断最终切换。
- 切换前 Canonical 绑定只进入影子审计，正式资源消费者继续使用 Legacy 活动权威；由最终停服事务统一激活资源 authority selector。
- 本变更依赖 `add-authoritative-knowledge-repository` 和 `add-course-knowledge-coverage-overlay`。

## Capabilities

### New Capabilities

- `canonical-knowledge-resource-binding`: 定义来源 Crosswalk、教学角色绑定、增量候选、独立审核和切换门禁。

### Modified Capabilities

- `resource-node-registry`: 将有效教学资源的知识身份从旧节点数组迁移到受审核 Canonical 绑定。

## Impact

- 影响资源注册、内容片段索引、绑定实体、审核任务、缓存和资源完整性门禁。
- 不修改 ActKG 权威对象或把 ACT 教学角色写回 Engineering Release。
