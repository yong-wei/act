# 架构决策记录

本目录采用仓库级连续编号。ADR 可以属于不同领域上下文，但编号不在上下文内重新起算。

## 上下文范围

- ADR 0001–0014：教师备课与智能课件系列，术语见 [`../../CONTEXT.md`](../../CONTEXT.md)。
- ADR 0015–0045：课程知识基座治理，术语见 [`../contexts/course-knowledge-base/CONTEXT.md`](../contexts/course-knowledge-base/CONTEXT.md)。该决策来源集合由下列真实文件索引定义，不使用不存在的聚合路径。ADR 0045 部分修订 0030、0031 和 0037 的历史迁移边界。

## 课程知识基座治理决策来源

- [0015](0015-stable-knowledge-identities-and-unique-semantic-names.md)、[0016](0016-admit-only-independently-teachable-knowledge-concepts.md)、[0017](0017-model-knowledge-domain-membership-as-many-to-many.md)、[0018](0018-separate-course-structure-from-the-knowledge-ontology.md)、[0019](0019-restrict-the-knowledge-base-to-three-canonical-relations.md)
- [0020](0020-store-only-direct-prerequisites.md)、[0021](0021-support-alternative-prerequisite-groups.md)、[0022](0022-govern-associations-by-semantic-value-not-quotas.md)、[0023](0023-govern-relation-coexistence-per-concept-pair.md)、[0024](0024-model-concept-hierarchy-as-a-direct-acyclic-graph.md)
- [0025](0025-type-resource-to-knowledge-bindings-by-learning-role.md)、[0026](0026-gate-instructional-resources-on-typed-knowledge-bindings.md)、[0027](0027-use-one-canonical-markdown-card-per-published-concept.md)、[0028](0028-review-the-knowledge-base-in-blocks-and-close-globally.md)、[0029](0029-partition-review-after-global-duplicate-clustering.md)
- [0030](0030-preserve-historical-identity-through-canonical-id-mapping.md)、[0031](0031-rebuild-completely-before-a-single-production-cutover.md)、[0032](0032-bound-the-knowledge-base-to-the-formal-course.md)、[0033](0033-bind-knowledge-at-the-smallest-instructional-unit.md)、[0034](0034-require-a-complete-semantic-profile-before-relation-review.md)
- [0035](0035-review-identity-changes-and-record-same-name-revisions.md)、[0036](0036-archive-published-concepts-instead-of-deleting-them.md)、[0037](0037-govern-the-initial-rebuild-as-an-offline-change-series.md)、[0038](0038-use-repository-authoring-data-as-the-only-knowledge-source.md)、[0039](0039-use-the-database-as-the-only-runtime-knowledge-read-model.md)
- [0040](0040-block-unresolved-semantic-duplicate-candidates.md)、[0041](0041-use-a-flat-controlled-vocabulary-of-top-level-domains.md)、[0042](0042-require-markdown-cards-and-select-visual-cards-by-value.md)、[0043](0043-migrate-unambiguous-resource-bindings-and-review-the-rest.md)、[0044](0044-do-not-waive-core-knowledge-base-release-gates.md)
- [0045](0045-freeze-historical-facts-at-their-original-knowledge-revision.md)：历史事实保留原修订，仅迁移活跃引用，并要求切换后的新事实绑定唯一活动修订。
 - [0046](0046-kaq-sympy-formula-derivation.md)：使用 Next.js API 路由 + SymPy 子进程作为 KA-Q 系统公式推导引擎。

逐文件摘要与聚合摘要规则见 [课程知识基座治理来源与派生契约](../proposals/course-knowledge-base-governance-source-derivation-contract.md)。

领域上下文及其关系见 [`../../CONTEXT-MAP.md`](../../CONTEXT-MAP.md)。新增 ADR 使用当前最大编号加一，并在存在多个上下文时通过 `context` frontmatter 或正文明确归属。
