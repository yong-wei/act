## Context

#1124 已完成旧局部发布包下的资源清单与影子绑定机制，但当前 importer、ReleaseSet lock、GraphProjection adapter、候选图谱说明和测试夹具仍固定在 `root-locus-engineering-v0.1` 及 CTKG 0.1 协议。ActKG 新发布的 `control-theory-engineering-v0.2` 是聚合工程包：公开内容由 release、GraphProjection V2、RAG crosswalk、组件清单、校验和和发布说明组成，内部引用两个组件发布；它不携带私有 CTKGDataset 正文。

当前聚合包包含 841 个 release entries、744 个投影节点、97 条投影关系和 1302 条上游 RAG crosswalk。若先实施下游消费者，它们会依赖错误的局部发布身份和旧结构。

## Goals / Non-Goals

**Goals:**

- 为 CTKG 0.2 公开工程包固定可复现、失败关闭的消费合同。
- 以聚合发布作为唯一当前候选入口，验证组件血缘而不重复导入组件。
- 无损保存公开包及其真实血缘，并为 Repository、候选图谱和候选态控灵提供一致版本身份。
- 使旧发布身份下的影子结果可审计但不能继续充当当前结果。

**Non-Goals:**

- 不运行 ActKG Python 代码，也不导入、推断或重建私有 CTKGDataset。
- 不设计面向未知未来 Schema 的通用插件框架；下一次真实协议变化另立变更。
- 不生成 CourseCoverage、ACT 教材 crosswalk 或资源教学角色。
- 不实施 RAG、KAQ、SAR、路径、学习事实或生产权威切换。

## Decisions

1. **固定消费合同快照。** ACT 保存来自一个明确 ActKG commit 的 CTKG 0.2 Schema/JSON Schema、允许字段、规范化和哈希规则，并在锁文件中记录 commit 与文件哈希。运行时不依赖 ActKG 仓库或 Python 环境。0.1 与 0.2 使用两个精确 adapter；不以条件分支拼成声称支持未知版本的通用 adapter。
2. **聚合发布是唯一当前 ReleaseSet 成员。** `control-theory-engineering-v0.2` 是候选选择器、Repository 和投影的版本入口。`component-releases.json` 与 release 中的组件 ID 必须相互一致，且组件目录、Release ID、release hash 和 `SHA256SUMS` 必须验证通过；组件对象不再作为并列 ReleaseSet 成员写入。
3. **公开包定义无损边界。** 导入器保存每个公开 artifact 的原始字节、相对路径、媒体类型和 SHA-256，并保存可查询的 release entries、投影节点/关系及上游 crosswalk。往返校验针对公开包，不把缺失的私有 CTKGDataset 字段补成 null 以上的虚构权威载荷。
4. **一致性门禁覆盖整个 bundle。** 单事务验证 `SHA256SUMS`、schema version、release/projection/source dataset hash、组件清单、release entries 和 projection endpoints。三字段 crosswalk 只验证 schema、非空 ID、唯一性、`published_entity_id` 的聚合成员资格及包中实际声明的引用一致性；`retrieval_chunk_id` 和 `citation_target_id` 保持 opaque，不要求包内实体或 ACT 结构单元解析。任何失败都不产生部分候选版本；同一锁定包重复导入复用同一语义版本和回执。
5. **候选投影保留上游语义。** GraphProjection V2 的 `entity_type`、`relation_type`、`direction`、`relation_family`、`release_tier` 和证据状态按固定合同保存并投影。方向或谓词与固定合同冲突时拒绝导入，不再在运行时改写并继续。
6. **历史按发布身份隔离。** 旧 ReleaseSet、回执、清单、crosswalk、candidate 和 decision 保留。凡身份包含旧 ReleaseSet、旧 canonical revision 或旧 projection digest 的结果标记为历史/失效；不得复制为聚合发布结果，也不得据此通过当前 readiness。
7. **下游变更按真实门禁重排。** RAG 与 KAQ 依赖本变更和后续课程覆盖/资源绑定治理；SAR 继续依赖 KAQ 及经审阅绑定；路径、学习事实和最终切换继续等待正式 Teaching Projection 与完整消费者验收。聚合包名称不等于课程覆盖完整。
8. **固定发布夹具证明适配准确。** 回归测试断言当前锁定包的 841 entries、744 nodes、97 links、1302 crosswalk rows、九种关系谓词、投影端点闭合、crosswalk triple 唯一且 published entity 属于聚合成员；opaque retrieval/citation ID 的 ACT 可解析性留给 B。这些是当前包夹具，不转化为对未来包的协议承诺。

## Risks / Trade-offs

- [公开包比旧私有形状更薄] → 只承诺公开 bundle 无损，不把 projection 或 crosswalk 存根提升为私有权威对象。
- [双 adapter 增加少量重复] → 以明确版本边界换取可审计性；旧 adapter 仅保留历史回归，不接受新候选。
- [聚合 identity 使旧 shadow 结果失效] → 保留全部历史并生成确定性失效报告，后续治理变更只重算实际受影响部分。
- [包内显示名仍有待上游修订的内容] → 原样保存并显示真实发布内容，不在 ACT 中静默修正权威字段。

## Migration Plan

1. 提交并验证 CTKG 0.2 消费合同快照、聚合包和 ReleaseSet lock。
2. 扩展持久化与导入器，在本地数据库执行迁移并导入聚合包；验证重复导入、单点破坏回滚和公开 bundle 往返。
3. 切换候选 Repository、V2 投影、候选图谱和候选态控灵到聚合身份，运行固定夹具和页面验收。
4. 生成旧 shadow 结果失效报告；生产 selector 保持 Legacy。
5. 若候选验证失败，回退应用版本并继续保留旧候选数据；不需要修改生产权威或历史事实。

## Open Questions

无。
