# CTKG Root Locus Engineering v0.1

发布日期：2026-07-26

## 发布身份

- Release：`root-locus-engineering-v0.1`
- 状态：`RELEASED`
- 协议：`ctkg-m1c-v14p-root-locus-engineering-release-v1`
- 权威来源：CTKG JSON
- 范围：`general_engineering_knowledge_graph`
- 来源运行：`v14p-fd0216551aa62debe2ef6209`
- 来源实现提交：`52fc3ef1e03b991cbac0d534497736c2d51633d6`
- Contract SHA-256：`2f12ae211f853737722d89fa407646a40f5e622f58332681f51c9901a5bdbf50`
- Release 规范哈希：`8b1e3832f10d4142db0c395c3b6b2188af6f400faab56f0870502e39c9493e74`

`Release 规范哈希`是发布对象去除自身 `release_hash` 字段后，按照项目规范序列化
计算的内容哈希。文件原始字节的 SHA-256 记录在 `SHA256SUMS`。

## 发布文件

| 文件 | 角色 |
| --- | --- |
| `root-locus-engineering-v0.1.json` | 本次发布的唯一权威知识数据 |
| `ctkg.schema.json` | CTKG 0.1.0 本体词汇与类型的 JSON Schema 快照 |
| `SHA256SUMS` | 权威数据和 Schema 文件的原始字节校验和 |
| `RELEASE-NOTES.md` | 发布范围、语义边界和验证说明 |

`root-locus-engineering-v0.1.json`是工程 Release 封装，不是
`CTKGDataset` 根实例。`ctkg.schema.json`用于解释和验证其中采用的 CTKG
实体词汇，不应直接作为 Release 外层封装的根级校验器。

## 内容清单

| 内容 | 数量 |
| --- | ---: |
| Canonical Object | 103 |
| Source → Canonical 身份映射 | 125 |
| Gold 直接关系 | 38 |
| Silver 间接关系 | 3 |
| 来源对象存根 | 1165 |
| EvidenceSegment 定位存根 | 2753 |

规范对象类型：

| 类型 | 数量 |
| --- | ---: |
| `DomainConcept` | 85 |
| `Formula` | 16 |
| `KnowledgeStatement` | 1 |
| `SystemModel` | 1 |

Gold 关系类型：

| 类型 | 数量 |
| --- | ---: |
| `association` | 26 |
| `represented_by` | 4 |
| `applies_to` | 3 |
| `derived_from` | 2 |
| `used_to_analyze` | 2 |
| `is_a` | 1 |

## 权威语义

- `canonical_nodes`、`source_mappings`和`gold_relations`构成本 Release 的正式
  工程知识层。
- `silver_relations`保存经审核确认存在语义联系、但不满足直接关系条件的边。消费方
  不得将其提升为 Gold 或与 Gold 无差别使用。
- `source_object_stubs`和`evidence_segment_stubs`只提供稳定 ID、来源定位及内容
  哈希，不包含教材正文。
- `release_status=RELEASED`及 Release 的实体清单决定本次受控发布范围。规范对象中
  保留的`publication_status=unpublished`是进入 Release 前的冻结实体状态，不否定
  其已被本 Release 纳入。
- CTKG JSON 是权威数据源。Neo4j、可视化、检索索引及其他图数据库均为可重建投影，
  不得反向覆盖本 Release。

## 完整性验证

在发布目录执行：

```bash
shasum -a 256 -c SHA256SUMS
```

预期两个文件均返回`OK`。

本次正式门禁：

| 门禁 | 结果 |
| --- | --- |
| Canonical object | PASS |
| Explicit relation | PASS |
| Query usability | PASS |
| Incremental recomputation | PASS |
| Projection idempotency | PASS |
| Release integrity | PASS |

正式 Neo4j 验证投影重复执行前后均为7385个节点、9795条关系；18条固定查询全部
成功执行，其中16条满足预期。

## 已知限制

- 本 Release 仅覆盖三本教材的根轨迹完整章节，不是自动控制全学科图谱。
- 12条关键关系覆盖5条，低于建议值6条，但按冻结发布合同属于非阻断完整性缺口。
- `rlr:005`因独立审核分歧保持 Deferred。
- 正根轨迹和Routh-Hurwitz判据仍缺规范对象。
- 发布存根不携带教材正文；逐字证据核查需要项目私有 EvidenceSegment 工件。

## 隐私与分发边界

本发布包不包含教材正文、模型请求与完整响应、审核草稿、API密钥、数据库密码或
本机绝对路径。它是项目受控工程发布，不构成教材原文的公开分发；使用与再分发仍需
遵循项目许可及各来源材料的权利约束。
