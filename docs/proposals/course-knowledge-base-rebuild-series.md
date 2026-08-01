# 课程知识基座重建两阶段系列（已退役）

> 状态：2026-07-27 被 ActKG 权威发布体系和 ACT 迁移系列
> [#1105](https://github.com/yong-wei/act/issues/1105) 取代。
>
> 本文仅保留为历史设计记录，不再构成活动 OpenSpec、迁移门禁或实施依赖。
> 已完成的输入调查仍可作为历史证据，但身份、领域、语义分块和工程关系治理归属
> ActKG；ACT 的课程覆盖、资源绑定、RAG、SAR、KAQ、学习路径和事实身份迁移以
> `openspec/changes/*authoritative*` 及 #1105 子项为准。旧系列未按原计划完成，
> 不得通过 `openspec archive` 将其 delta 合入正式规范。

课程知识基座重建采用两阶段 Buddy propose。共同来源为课程知识上下文、`docs/adr/README.md` 的 ADR 0015–0045 真实逐文件索引、版本化现状审计、[来源与派生契约](course-knowledge-base-governance-source-derivation-contract.md)和[机器可读来源注册表](course-knowledge-base-governance-source-registry.yaml)。

阶段一权威输入限定为当前正式课程与已审核范围锚点、当前 authoring 内容/卡片/媒体/资源、当前发布图谱及绑定迁移比对、活跃知识引用，以及经审核的 active legacy ID 到 canonical ID 映射。历史学习事实、事件和派生状态保留原图谱修订；本系列不生成、不消费、不验证相关诊断目录，外部独立治理不属于本系列工件或输入。

## 阶段一：清单制备

父变更 `prepare-course-knowledge-governance-manifests` 仅跟踪以下八个边界独立的可执行子变更：

1. `inventory-course-knowledge-governance-inputs`
2. `build-global-knowledge-identity-candidate-manifest`
3. `derive-controlled-knowledge-domain-candidate-manifest`
4. `partition-course-knowledge-semantic-blocks`
5. `derive-cross-block-identity-conflict-manifest`
6. `derive-cross-block-relation-review-manifest`
7. `derive-atomic-resource-binding-review-manifest`
8. `validate-course-knowledge-series-manifest`

阶段一只定义并交付只读清单 CLI、清单、验证报告和测试，不裁定最终知识内容，不实现迁移、投影导入、运行时切换或 GitHub Issue 创建。当前审计快照数字只保存在设计、提案和带日期证据中；永久 spec 只要求按声明快照报告 expected/observed drift。

## Future-child discriminated schema

每条 future-child record 必须包含：

```yaml
change_id: <stable-change-id>
work_kind: <semantic_block|cross_identity|cross_relation|resource_binding|global_closeout|cutover>
schema_version: <version>
algorithm_version: <version>
normalization_profile: <profile-id>
exact_count: <typed-record-count>
candidate_concept_count: <required-for-semantic-block>
exact_items:
  - item_kind: <typed-kind>
    identity_namespace: <namespace>
    source_id: <exact-id>
    source_digest: <digest>
owner_block: <required-when-applicable>
endpoint_blocks: [<required-for-cross-block>]
blockedBy: [<change-id>]
source_digests:
  - source_kind: <kind>
    source_id: <path-or-dataset-id>
    schema_version: <version>
    digest: <digest>
governance_contract_digest: <digest>
source_snapshot_digest: <digest>
upstream_manifest_digests:
  - manifest_kind: <kind>
    manifest_id: <id>
    digest: <digest>
required_outputs: [<typed-output>]
acceptance_profile: <profile-id>
scope_anchor_ids: [<anchor-id>]
```

`exact_count` 统计 typed record 并等于 `exact_items` 长度。去重键是 `(item_kind, identity_namespace, source_id)`；跨 namespace 同文字符串不得去重或改变 owner。块内关系、知识卡和迁移输入也必须作为 typed `exact_items` 纳入，不能只列概念 ID。`semantic_block.candidate_concept_count` 只统计该块拥有的身份等价分量，pending split 在阶段一计为一个分量；它独立于 `exact_count`。

字段适用性：

- `semantic_block`：必须有 `owner_block`，`endpoint_blocks` 可为空；包含该块全部概念、块内关系、卡片和迁移输入。阶段一为每个身份分量生成 card/visual 工作种子；阶段二任何 split 都必须使原 exact closure 失效，并为每个拆分后的最终规范概念分别生成一个 `canonical_card_review` 和一个 `visual_suitability_review` typed item。源卡缺失也必须生成显式待办记录；视觉不适用必须记录理由。
- `cross_identity`：必须有一个协调 `owner_block` 和完整 `endpoint_blocks`。
- `cross_relation`：必须有一个协调 `owner_block` 和两个或更多 `endpoint_blocks`。
- `resource_binding`：有明确 owner 时必须填写 `owner_block`；跨块目标必须填写完整 `endpoint_blocks`。
- `global_closeout`：`owner_block` 不适用，`endpoint_blocks` 为全部已声明块，`exact_items` 包含所有待闭合清单记录。
- `cutover`：`owner_block` 不适用，`endpoint_blocks` 为全部已声明块，必须依赖 `global_closeout` 并列出切换输入；阶段一只能生成候选记录，不能执行切换。

空队列以 `exact_count: 0`、空 `exact_items`、完整摘要与推导证据表达。通配符、范围、暂定批次、TODO、缺失摘要或 waiver 均无效。

## Closed acceptance-profile registry

`acceptance_profile` 必须解析到以下封闭注册表，工作类型与 profile 不匹配时验证失败：

- `semantic-block-governance/v1`：每个最终概念先验收唯一语义名称、严格定义、语义边界、近邻区分、同义词、范围依据、领域归属和基础概念裁定八项语义档案；同一 child 内相位固定为 `semantic_profile -> canonical_card -> in_block_relation`，前一相位未通过时后一相位不得开始。
- `cross-identity-governance/v1`：依赖全部端点 `semantic_block`，输出跨块身份裁定及必要的 closure regeneration。
- `cross-relation-governance/v1`：依赖全部端点 `semantic_block` 的语义档案验收和相关 `cross_identity`，只审核三类规范关系。
- `resource-binding-governance/v1`：依赖全部目标端点 `semantic_block` 的语义档案验收和相关 `cross_identity`，输出原子资源角色绑定裁定。
- `global-closeout-governance/v1`：依赖全部块、跨块身份、跨块关系和资源绑定 child。
- `cutover-governance/v1`：只依赖已通过的 global closeout，覆盖新投影、审核映射、活跃引用迁移、legacy 解析兼容和切换后新事实的唯一活动修订绑定。

`cross_identity`、`cross_relation` 与 `resource_binding` 的 `blockedBy` 必须逐一包含其每个 `endpoint_block` 对应的 `semantic_block` change ID；只存在一般拓扑闭包而缺少端点依赖时验证失败。语义档案验收输出必须作为具名 `required_outputs` 和上游摘要进入后续 child，不能以自由文本状态替代。

## 阶段二：精确所有者冻结后另行提出

只有阶段一全部八个子变更完成、清单通过独立审核、最终验证无漂移且 exact owner manifest 冻结后，才能提出阶段二 tracking parent 和实际 children。阶段二未来范围包括：

- 语义块内身份、领域、关系、规范卡和迁移输入治理；
- 跨块 near-similar 身份审核、关系审核和原子资源绑定审核；
- 经审核的 active legacy 身份映射，以及仍被读取或继续执行的课程、资源、进度、笔记和未完成路径引用迁移；
- authoring 投影生成、数据库整体导入与 DB-only read model 切换；
- 约束切换后新事实写入必须绑定唯一活动的新图谱修订，并明确 `/api/knowledge/nodes/[id]` 和 runtime-first loader 的迁移与退役归属；
- 全图收尾和一次性生产切换。

历史 `LearningFact`、事件、诊断、画像、风险、成长、推荐、班级聚合、Arena 记录和已完成路径不逐行重解释、不重放、不去重、不回填。无可证修订的旧事实通过 `legacy-unversioned` 或 legacy snapshot 兼容解析；全库 producer/decoder/writer closure 不是阶段一或切换门槛。

阶段二 child 数量、名称和 owner 不预设，也不沿用原型块数。
