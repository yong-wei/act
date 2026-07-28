## Context

本变更依赖 `adopt-ctkg-0-2-aggregate-release-contract`。聚合发布扩大了 Canonical Object 范围，并公开 1302 条 `published_entity_id → retrieval_chunk_id → citation_target_id` 记录，但这些标识在 ACT 当前教材 runtime 和 #1124 资源清单中没有可直接复用的结构单元身份。#1124 已建立资源 inventory、候选、独立复核、争议裁决和 shadow publication 机制；其 489 included、3105 excluded、3456 unresolved 及零 Crosswalk/零 binding 是旧局部 ReleaseSet 下的审计基线，不是新发布的现成绑定。

CourseCoverage 也仍锁定旧根轨迹覆盖文件。聚合包可完整浏览，但未提供正式 Teaching Projection，不能把全部对象自动提升为课程目标或路径语义。

## Goals / Non-Goals

**Goals:**

- 对聚合发布中新增的系统建模对象形成逐项、可审计的课程覆盖处置。
- 将上游三字段 RAG reference 与 ACT 教材结构单元对齐，同时保留“上游引用身份”和“ACT 教学资源角色”两个权威层次。
- 在聚合发布身份下复用 #1124 的资源治理机制并重新计算有效 shadow 结果。
- 为后续 RAG、KAQ 和 SAR 提供版本一致、可核验的输入。

**Non-Goals:**

- 不修改 CTKG 0.2 协议、Schema snapshot、导入器或候选图谱。
- 不把 opaque retrieval/citation ID 直接解释为 ACT 内容身份。
- 不实现 RAG、KAQ、SAR、路径、学习事实或生产切换。
- 不把未发布的先修、包含、关联等教学语义推断成 Teaching Projection。

## Decisions

1. **课程覆盖按对象处置，不按发布名称自动纳入。** 通过组件成员身份识别新系统建模对象；实现代理逐项读取 Canonical semantic profile 与课程依据，记录 `formal_objective`、`necessary_prerequisite`、`explicit_extension` 或 `excluded_with_rationale`。未覆盖对象继续可浏览，但不进入教学消费者。
2. **上游 reference 与 ACT 对齐记录分层。** Change A 已将原始三字段记录保存为不可变 `UpstreamRagReference`；本变更只引用并核验该记录，不重复导入或复制上游权威数据。只有当定位过程同时给出 ACT source edition、结构单元 ID/version/hash、inventory run/capture revision、atomic resource/segment identity 和 validation digest 时，才形成 ACT `EvidenceStructuralUnitCrosswalk`。原始三字段本身不满足该合同。
3. **确定性优先，语义对齐受治理。** 若未来存在可验证的稳定 ID/hash 对应则确定性接受；否则以 Canonical Object 为起点，在一次稳定资源索引上下文中召回候选 ACT 结构单元，由独立 GPT 上下文复核对象语义、候选正文和引用身份。歧义、冲突或高影响结果进入既有人工裁决队列；无法建立证据链的 reference 保持 unresolved。
4. **节点驱动批次复用资源上下文。** 每个新增或变化的 Canonical Object 只处理一次，在同一索引/模型版本下对资源候选排序并产出 candidate；资源变更继续沿用 #1124 的反向增量路径。这样不会因未来新增节点重读并重审所有已稳定节点。
5. **旧决定只做有证据的重用。** 旧 inventory observation 保留。只有 Canonical ID、对象语义摘要、ACT resource/segment hash、角色、提示词/复核版本和结构门禁均未变化时，流程才能生成绑定新聚合 ReleaseSet 的复核回执；不得复制旧 publication 或让旧 ReleaseSet identity 直接通过。
6. **同一捕获修订闭合输入。** CourseCoverage authoring revision、resource inventory、ACT structural unit index、crosswalk 和 binding run 必须绑定同一 ACT Git capture revision 及对应数据库 watermark；混合 worktree 或漂移输入失败关闭。
7. **shadow 状态保持。** 有效结果最高为 `SHADOW_PUBLISHED`。RAG、推荐、路径、证据和学习事实继续选择 Legacy；本变更只让后续消费者具备可验收的 Canonical 输入。
8. **下游门禁按能力分开。** RAG 依赖经验证的 ACT Crosswalk；KAQ 依赖 CourseCoverage；SAR 依赖 KAQ 与经审阅资源绑定。路径、学习事实和最终切换仍等待完整 Teaching Projection 和其余消费者，不由本变更提前解除。

## Risks / Trade-offs

- [上游 ID 在 ACT 中没有直接身份] → 明确保存为 opaque reference；没有 ACT 结构、版本和哈希证据时保持 unresolved。
- [语义对齐可能误配] → 生成与复核上下文隔离，所有接受结果重新执行结构、版本、端点和唯一性门禁。
- [聚合范围使候选量增长] → 先处理新增/变化对象，复用稳定索引和未变化决定，只重算受影响 pair。
- [课程覆盖被误认为教学关系] → Overlay 只表达课程角色，不生成先修、包含、关联或路径边。

## Migration Plan

1. 在 Change A 聚合导入验收后，更新 CourseCoverage authoring schema/数据并生成逐对象处置清单。
2. 从同一干净 Git revision 捕获教材结构单元索引和资源 inventory，导入上游 references 并运行结构/语义对齐。
3. 重新运行聚合 ReleaseSet 下的 binding candidate、独立复核、争议裁决与 shadow publication。
4. 验证所有 included/excluded/unresolved、Crosswalk 和 binding 均可从同一捕获身份重建，且生产 selector 仍为 Legacy。
5. 若运行失败，丢弃未提交事务或保留失败回执；旧 shadow 历史和 Legacy 生产路径不变。

## Open Questions

无。
