## Context

标准候选导入与 Delta Receipt 建立后，课程和资源治理不应再绑定某个发布名称或固定对象数量。首次接入没有已治理基线，需要对当前候选 ReleaseSet 做完整处置；之后每个兼容发布只处理 Delta Receipt 中受影响的对象、Crosswalk、组件和相关资源片段。

#1124 已建立资源 inventory、候选、独立复核、争议裁决和 shadow publication 机制。该机制可以复用，但旧发布身份下的结果只有在 Canonical 语义、资源内容、角色、提示词/复核版本和结构门禁全部未变化时，才能生成新 ReleaseSet 下的重验证回执。

## Goals / Non-Goals

**Goals:**

- 建立一次完整课程覆盖和 ACT 结构单元/资源绑定基线。
- 按 ReleaseSet Delta 做对象驱动和资源驱动的增量治理。
- 使上游 opaque reference、ACT 结构单元定位和资源教学角色保持三个独立层次。
- 保持所有结果为 shadow，并向下游提供版本一致的输入门禁。

**Non-Goals:**

- 不修改 Bundle 兼容、候选导入或 Delta 算法。
- 不把工程关系推断为 Teaching Projection。
- 不实施 RAG、KAQ、SAR、路径、事实或生产切换。

## Decisions

1. **基线与增量共用一套处置合同。** 当当前候选尚无已治理覆盖基线时，无论其 ReleaseSet Delta 是空库 `BASELINE` 还是从 #1125 演进的普通内容差异，都必须处置全部当前对象；已有有效覆盖基线后，Delta 才只调度新增、payload/type-safe 变化、删除和显式失效对象。所有当前对象最终必须有一个有效课程处置或排除理由。
2. **课程覆盖按对象决定。** 发布名、组件名或 tier 不能自动决定课程角色；实现代理逐项依据 Canonical profile 与课程来源记录 `formal_objective`、`necessary_prerequisite`、`explicit_extension` 或 `excluded_with_rationale`。
3. **三层记录保持独立。** 导入的上游三字段记录只用于定位；ACT EvidenceStructuralUnitCrosswalk 绑定教材版次、结构单元 ID/version/hash、资源片段和捕获身份；资源 teaching role 另存，不修改 ActKG 数据。
4. **确定性优先，语义对齐受治理。** 稳定 ID/hash 唯一匹配可直接进入结构门禁；否则以 Canonical Object 为起点，在固定结构索引中生成候选，再由隔离上下文复核。歧义、冲突和高影响结果保持 unresolved 或进入既有裁决队列。
5. **增量失效由 Delta 驱动。** 对象删除或变化使其覆盖、Crosswalk 和绑定失效；Crosswalk 删除只失效对应 ACT 对齐；资源内容变化使用 #1124 反向索引。未受影响的结果通过严格身份比较生成重验证回执，不复制旧 publication。
6. **纯包装修订不重跑语义治理。** 当 Delta 分类为 packaging revision 且语义 digest 不变时，只记录治理无需变更的回执。
7. **输入必须同一捕获修订。** ReleaseSet/Delta、CourseCoverage authoring、资源 inventory、结构单元索引、数据库 watermark、Crosswalk 和 binding run 绑定同一干净 ACT capture revision；漂移失败关闭。
8. **下游门禁分开。** RAG 需要有效 ACT Crosswalk；KAQ 需要 CourseCoverage；SAR 需要 KAQ 与经审阅绑定。Teaching Projection、路径、事实和最终切换继续由后续变更负责。

## Risks / Trade-offs

- [首个基线体量较大] → 通过稳定 manifest 分批执行，但逐项处置和全量闭合仍是基线验收条件。
- [语义对齐误配] → 生成与复核上下文隔离，最终接受仍执行身份、版本、哈希、端点和唯一性门禁。
- [上游 ID 无法解析] → 保持 unresolved，不把字符串相似度提升为权威映射。
- [Delta 漏掉资源侧变化] → 保留 #1124 的资源反向增量入口，与图谱 Delta 共同形成有效输入集。

## Migration Plan

1. 等候候选导入和对应 Delta Receipt 完成。
2. 若当前候选没有已治理覆盖基线，生成完整课程处置 manifest、结构单元索引和资源 inventory，并在同一捕获修订下运行治理。
3. 发布 CourseCoverage、ACT Crosswalk 和资源绑定为 `SHADOW_PUBLISHED`，验证生产选择器不变。
4. 用合成内容更新、删除、Crosswalk 更新和纯包装修订验证增量路径。
5. 失败时保留失败回执并丢弃未提交结果；上一有效 shadow 和 Legacy 生产路径不变。

## Open Questions

无。
