## Why

CTKG 0.2 聚合发布扩大了可浏览的权威对象范围，但公开包中的三字段 RAG crosswalk 不能直接充当 ACT 教材结构单元或资源教学角色。后续消费者只有在课程覆盖和资源绑定基于新发布身份重新治理后，才能安全使用这些对象。

## What Changes

- 在 `adopt-ctkg-0-2-aggregate-release-contract` 完成后，对聚合发布中新加入的系统建模对象逐项确定 `formal_objective`、`necessary_prerequisite`、`explicit_extension` 或带理由排除；未纳入课程覆盖的对象仍可在候选图谱中浏览。
- 将上游 `published_entity_id → retrieval_chunk_id → citation_target_id` 作为定位输入，解析到 ACT 教材的结构单元、版本、内容哈希和同一捕获修订，生成满足 ACT 合同的 EvidenceStructuralUnitCrosswalk。
- 以聚合 ReleaseSet 重新运行 #1124 已建立的资源清单、候选生成、独立语义复核、争议裁决和发布门禁；只复用在新发布身份和资源内容身份下仍然有效的决定。
- 保持 Canonical CourseCoverage、crosswalk 和资源角色为 shadow；生产 RAG、推荐、路径、证据和学习事实继续使用 Legacy，直到最终统一切换。
- 为 RAG、KAQ 和 SAR 提供经治理的聚合课程覆盖与资源绑定输入；学习路径、学习事实和最终切换继续等待正式 Teaching Projection 与完整消费者门禁。
- 不在本变更中修改 CTKG Schema/协议适配、导入器、RAG/KAQ/SAR 消费逻辑、学习路径、学习事实或生产 authority selector。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `course-knowledge-coverage-overlay`: 将课程覆盖源和运行态投影重新绑定到聚合 ReleaseSet，并记录逐对象纳入角色或排除理由。
- `canonical-knowledge-resource-binding`: 将上游 crosswalk 解析为 ACT 可验证结构单元映射，并基于聚合发布身份重新治理资源教学角色。

## Impact

- 影响课程覆盖 authoring/runtime 投影、教材结构单元 crosswalk、资源清单与候选/复核/裁决产物，以及后续消费者的输入门禁。
- 复用 #1124 的治理框架和历史证据，不重建并行资源治理系统。
- 不改变生产读取路径、生产学习事实或最终切换条件。
