## Why

RAG 需要利用权威对象和关系改善实体对齐与候选扩展，但图谱摘要和关系不能取代用户可核验的教材正文。现有检索合同必须迁移到 Canonical 身份并保持引用证据边界。

## What Changes

- 使用聚合 ReleaseSet 中的 Canonical Object、别名和经 RAG 明确支持的精确工程关系执行实体对齐、有限关系扩展和候选正文定位。
- 只消费 `govern-aggregate-course-coverage-and-resource-bindings` 产出的版本化 ACT EvidenceStructuralUnitCrosswalk；上游三字段 RAG reference 只是输入，不能直接充当 ACT 正文引用。
- 最终 `[序号]` 引用必须落到用户可读的 ACT 正文结构单元或锚点。
- 图谱信号只改变候选集合和排序；节点摘要、关系和上游 reference 不能直接证明回答。
- 保留词面、向量、重排和证据裁决链，不读取 Legacy 节点或隐式回退。
- 本变更依赖标准候选导入、对应 `ReleaseSetDeltaReceipt` 和 `govern-aggregate-course-coverage-and-resource-bindings`，并只在候选 ReleaseSet、CourseCoverage 与 ACT Crosswalk 版本一致时以影子方式验证。
- RAG authority selector 在最终停服切换前保持 Legacy，Canonical 检索结果不得局部成为生产回答。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `learning-evidence-rag-corpus`: 将图谱扩展迁移到 Canonical 身份并固定正文引用边界。
- `source-pack-retrieval`: 消费经治理的 ACT EvidenceStructuralUnitCrosswalk，并固定结构化正文和引用锚点的证据所有权。

## Impact

- 影响检索候选生成、图谱扩展、引用解析、排序诊断和 RAG 验收。
- 不让候选图谱回答产生学习事实或提前接管生产问答。
