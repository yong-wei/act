## Why

候选 ReleaseSet 的通用 Delta Receipt 只描述权威图谱发生了什么变化，不能自动决定对象在 ACT 课程中的角色、上游引用对应的教材结构单元或资源教学角色。该治理必须在发布身份一致的前提下完成一次基线建设，并在后续发布中按差异增量维护。

## What Changes

- 以已完成的 #1125 候选为冻结比较基线，并依赖 `import-compatible-actkg-public-bundles` 与 `govern-actkg-release-set-deltas`；首次没有已治理覆盖基线时逐对象建立完整 CourseCoverage，后续只处理 Delta Receipt 标识的新增、变化、删除和失效对象。
- 对进入当前课程范围的 Canonical 对象逐项确定 `formal_objective`、`necessary_prerequisite`、`explicit_extension` 或带理由排除；未纳入课程覆盖的对象仍可在候选图谱中浏览。
- 将上游 `published_entity_id → retrieval_chunk_id → citation_target_id` 作为定位输入，解析到 ACT 教材结构单元、版本、内容哈希和同一捕获修订，生成 ACT EvidenceStructuralUnitCrosswalk。
- 复用 #1124 的资源清单、候选生成、独立语义复核、争议裁决和发布门禁；只有输入身份与语义证据未变化时才生成新的可审计重验证回执。
- 对删除或变化的对象、Crosswalk 和资源片段按 Delta Receipt 失效依赖结果；纯 Bundle 包装修订不重跑语义治理。
- CourseCoverage、ACT Crosswalk 和资源角色最高保持 `SHADOW_PUBLISHED`；生产 RAG、推荐、路径、证据和学习事实继续使用 Legacy，直到最终统一切换。
- 不修改 Bundle 合同、导入器或 Delta 算法，不执行 RAG/KAQ/SAR/路径/学习事实迁移，不推断尚未发布的 Teaching Projection。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `course-knowledge-coverage-overlay`: 以候选 ReleaseSet 和 Delta Receipt 驱动基线及增量课程覆盖治理。
- `canonical-knowledge-resource-binding`: 以候选 ReleaseSet 和 Delta Receipt 增量维护 ACT 结构单元 Crosswalk 与资源教学角色。

## Impact

- 影响课程覆盖 authoring/runtime 投影、教材结构单元 Crosswalk、资源清单与候选/复核/裁决产物，以及后续消费者输入门禁。
- 后续兼容图谱发布成为导入、差异复算和增量治理流程，不再需要为发布版本新增本变更。
- 不改变生产读取路径、生产学习事实或最终 authority selector。
