# CTKG 0.2 聚合发布包接入

该上下文记录 #1124 合并后，权威知识图谱迁移系列适配 CTKG 0.2 聚合发布包的领域语言。

## 语言

**CTKG 0.2 接入子变更**：
插入在已合并的资源 Canonical 绑定变更与后续 RAG 迁移之间的独立基础变更。它负责适配 CTKG 0.2 公开发布合同、更新候选 ReleaseSet、Repository 和候选图谱，并使依赖旧 ReleaseSet 的资源绑定影子结果失去当前资格；不生成新的课程覆盖、ACT Crosswalk 或资源角色，不改写 #1124 的已合并历史，也不提前实施 RAG、KAQ、SAR 或生产权威切换。
_避免：把发布合同适配混入 RAG、修改已归档变更、局部激活生产权威_

**聚合候选发布入口**：
候选 ReleaseSet 以 `control-theory-engineering-v0.2` 作为唯一当前发布入口，并校验、记录其组件清单中的组件身份和哈希。根轨迹与系统建模组件不作为并列候选重复导入；既有根轨迹包继续作为不可变来源和回归基线。
_避免：同时导入聚合包与组件包、按加载顺序消除重复对象、删除根轨迹回归工件_

**发布协议接入边界**：
CTKG 0.2 接入子变更只处理公开发布包的 ReleaseEntry、GraphProjection V2、RAG Crosswalk、组件清单、哈希与运行查询适配，并使依赖旧候选身份的影子数据显式失效、检查新基线是否具备重新治理条件。它不重新生成 CourseCoverage、ACT Crosswalk、资源候选、复核决定或 shadow publication，不裁定 Canonical Object 是否进入具体课程，也不批准 ACT 教学资源角色绑定。
_避免：由发布成员资格自动推导课程准入、由 RAG Crosswalk 自动推导教学角色_

**聚合发布语义治理子变更**：
位于 CTKG 0.2 接入之后、Canonical RAG 迁移之前的独立治理变更，负责审核新增系统建模对象的 CourseCoverage 角色和 ACT 原子教学资源绑定。新增对象在该治理完成前可以进入只读候选图谱，但不能因被公开发布而自动参与课程运行。
_避免：在协议适配器中完成课程裁定、把候选图谱可见性等同于教学激活_

**聚合迁移下游门禁**：
RAG 只能消费经治理的 ACT EvidenceStructuralUnitCrosswalk，KAQ 只能消费聚合 CourseCoverage，SAR 只能沿聚合身份下经审阅的 KAQ/资源绑定组合。学习路径、Canonical 新事实和最终切换仍等待正式 Teaching Projection、完整课程 ReleaseSet 与全部消费者门禁；`control-theory-engineering-v0.2` 的名称不能被解释为课程覆盖已经完整。
_避免：让上游三字段记录直接成为最终引用、用工程谓词生成教学路径、因聚合包已发布而解除最终切换门禁_

**上游 RAG Crosswalk**：
CTKG 0.2 公开发布包中由 `published_entity_id`、`retrieval_chunk_id` 和 `citation_target_id` 组成的权威检索定位工件。它属于发布协议并保留上游定位身份，但不能直接替代 #1124 建立的 ACT `EvidenceStructuralUnitCrosswalk`；后者还必须解析并验证 ACT 教材结构单元、版本、内容哈希、资源清单捕获身份和 Canonical 端点。
_避免：把三字段上游记录直接写成已验证 ACT Crosswalk、由上游检索定位推导教学资源角色_

**CTKG 消费合同快照**：
ACT 仓库保存的、由固定 ActKG 提交生成并以文件哈希约束的 CTKG 0.2 公开包校验合同。它离线校验 ReleaseEntry、GraphProjection V2、上游 RAG Crosswalk、组件清单、Schema 版本及包内哈希；Schema 升级通过显式增加适配器和合同快照完成，不要求 ACT 构建或运行环境安装 ActKG Python 校验器。
_避免：运行时联网取得最新 Schema、在 Node 应用容器中引入 ActKG Python 工具链、以手写宽松解析代替 Schema 校验_

**资源绑定影子基线变基**：
候选 ReleaseSet 改为 CTKG 0.2 聚合发布后，保留 #1124 的资源清单和历史影子运行作为审计记录；所有绑定到旧 ReleaseSet、Release 或对象修订身份的 Crosswalk、候选和审核决定失去当前资格并进入历史状态。协议接入子变更只完成这种确定性失效和新基线就绪检查，新的 ACT Crosswalk、课程覆盖与教学角色绑定由后续语义治理子变更生成。
_避免：覆盖旧影子运行、沿用旧 Release 身份的审核结论、在协议接入阶段生成语义绑定_

**公开工程发布包无损接入**：
ACT 完整保存并校验 CTKG 0.2 公开包中的发布成员、脱敏 Projection V2、上游 RAG Crosswalk、组件清单、哈希和公开血缘，使 ACT 运行视图能够由这些工件确定性重建。ActKG 私有 `CTKGDataset` 继续承担完整来源文本、精确证据和治理生产血缘，不进入 ACT；ACT 不把公开投影表述为私有 Dataset 的完整副本。
_避免：要求公开包包含教材正文、把 Projection V2 包装成 CTKGDataset、声称 ACT 已复制私有治理数据_
