## Why

ActKG 已发布 CTKG 0.2 聚合工程包 `control-theory-engineering-v0.2`，而 ACT 当前候选底座仍锁定并解释旧的局部根轨迹包。继续实施后续 RAG、KAQ 与资源治理会把旧协议、旧发布身份和不完整覆盖固化到消费者中，因此需要先完成一个独立、可审计的协议变基。

## What Changes

- 将当前候选 ReleaseSet 锁定为单一聚合入口 `control-theory-engineering-v0.2`；两个组件发布只用于校验聚合包声明的血缘和哈希，不作为并列导入项。
- 固定 ActKG 某一审阅提交对应的 CTKG 0.2 消费端 Schema、JSON Schema 与契约哈希快照；仅实现 0.2 的精确适配，同时保留 0.1 精确适配用于历史审计和回归。
- 按公开工程包的真实边界无损保存并校验 release、GraphProjection V2、RAG crosswalk、组件清单、校验和与发布说明；不导入或声称能够重建 ActKG 私有 CTKGDataset。
- 以事务、幂等和失败关闭方式校验聚合包、组件、对象、关系和投影闭合；对上游 crosswalk 只校验三字段结构、唯一性与 `published_entity_id` 的聚合成员资格，保持 retrieval/citation ID opaque，并产生绑定聚合发布身份的导入回执。
- 将 Repository、候选画布、节点详情和候选态控灵上下文切换到聚合 ReleaseSet，显示实际覆盖、完整 `canonical_type` 与谓词词表；默认仍为“扩展”视图，“核心/扩展”分别对应 Gold/Silver。
- 保留旧 ReleaseSet、导入回执和影子运行作为审计历史；使依赖旧发布身份的 shadow candidate、decision 与 binding 失去当前资格，但不删除历史记录。
- 修改尚未实施的下游迁移变更，使其显式依赖新的聚合发布身份和后续课程覆盖/资源绑定治理，不把“控制理论聚合包”误写成完整课程或完整教学语义。
- 不在本变更中生成 CourseCoverage、ACT EvidenceStructuralUnitCrosswalk、资源教学角色、RAG、KAQ、SAR、学习路径、学习事实，也不切换生产权威。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `authoritative-knowledge-release-ingestion`: 将锁定、校验、血缘、公开包无损保存和回执合同从旧局部包升级到 CTKG 0.2 聚合发布。
- `authoritative-knowledge-repository`: 使候选 Repository 和投影以聚合 ReleaseSet 及其完整公开类型、谓词和版本身份为边界。
- `knowledge-graph-projection-contract`: 将候选投影适配和版本身份升级为受固定契约约束的 GraphProjection V2。
- `candidate-authoritative-knowledge-graph`: 用聚合发布的真实覆盖、类型、谓词和核心/扩展治理语义取代局部根轨迹说明。
- `konling-agent-runtime`: 使候选态控灵读取聚合 ReleaseSet 的对象、关系、覆盖限制和发布身份，不读取旧局部发布身份。

## Impact

- 影响权威发布锁、导入器、数据库候选版本与回执、Repository 投影、候选图谱/详情、候选态控灵及其回归夹具。
- 影响后续迁移变更的依赖和输入合同，但不实现这些消费者。
- Legacy 生产选择器、现有学习事实和历史审计记录保持不变。
