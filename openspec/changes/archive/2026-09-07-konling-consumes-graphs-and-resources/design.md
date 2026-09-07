## Context

控灵当前的教学资源消费链停在"文本 grounding"层：`resolveKonlingTeachingProjectionBinding` → `resolveKonlingTeachingProjectionContext` 产出的 `linkedResources` 只有 resourceId/resourceType/role/title/canonicalId/sourcePath，没有 href；`buildKonlingTeachingProjectionGroundingLines` 最多向模型暴露 8 条 `resId:role` 文本。回答正文链接被有意消灭：`AIMessageContent` 把 `<a>` 渲染为 suppressed span，`sanitizeVerifiedCitationMarkdown` 剥离全部 URL，提示词明令不得输出 URL。唯一可点击面是引用面板：`KonlingCitationPanel` 读 `message.metadata.konlingCitationGuard.citations`，带 href 的项渲染 `TextbookCitationLink` 芯片，含 `?vbh=` 句柄的先经 `/api/textbooks/version-bound-target` 重校验再跳转。

已存在的可复用资产：

- 陪伴资源卡 `CompanionResourceCards` 已有 resourceId→href 三段解析（教材 `textbook-unit:` 前缀 → `buildTextbookReaderHref`；DB TeachingResource → `/interactive-learning/resources/{id}`；registry → `launchTarget ?? renderTarget`），但由 trigger-engine 主动推送驱动、非聊天回答驱动，且受 `KONLING_COMPANION_ENABLED` 门控。
- 工程图谱检索栈（`runEngineeringRagQuery`、`composeEngineeringAndTeachingRag`、`engineeringCorpusFromLayeredPayload`、`resolveEngineeringRagAuthority`）完整存在；控灵目前只用 `payload.engineering.nodes` 做焦点 ID 白名单校验，工程节点与谓词不进提示词；`search_knowledge_graph` 工具查的是 Prisma 旧 knowledgeNode 表，不是 ActKG。
- `teaching-resource-rag`（`runTeachingResourceRagQuery`、`applyTeachingResourceRagConsumerActivation`）有实现无运行时调用方；`maybeRunKonlingCanonicalRagShadowDiagnostic` 因 `canonicalRagShadow` 无人传入恒为死代码；`selectRagAuthority('PRODUCTION_ANSWER')` 恒 LEGACY。
- `konlingDualDomainProvenance.teaching.resourceIds` 已随消息元数据持久化，但无客户端组件读取。

## Goals / Non-Goals

**Goals:**

- 绑定资源经服务端 citation allocator 进入引用面板，以可点击芯片呈现，点击在统一查看器壳中打开；teacherOnly 资源 fail-closed。
- 控灵获得只读工程图谱工具与有界工程邻域 grounding，工程节点经教材映射产出带 vbh 重校验的教材引用。
- `teaching-resource-rag` 作为 composed 的教学资源通道接入检索链（不退役）；`canonicalRagShadow` 死代码被接线为影子诊断；`PRODUCTION_ANSWER` 权威按 cutover 治理从 LEGACY 切到 composed。
- 双域 provenance（工程/教学）在引用元数据中完整保留并可被客户端消费。

**Non-Goals:**

- 不让模型在回答正文输出链接；不改 `AIMessageContent` 的 sanitizer 与正文链接抑制设计。
- 不改 companion trigger-engine 的主动推送机制与 `KONLING_COMPANION_ENABLED` 门控。
- 不新建检索基础设施：复用 `domain-composition` 的既有 RAG 函数，不新增第二套检索管线。
- 不执行生产内容发布或部署（步骤列入 tasks，执行时单独授权）。
- 不扩大教材范围（三本源教材为限），不改工程图谱拓扑与 overlay A 关系。

## Decisions

1. **可点击面只走引用面板，正文 sanitizer 不动。** 新增共享解析模块（从 `CompanionResourceCards` 的 verify 路由抽取三段解析为 server-owned 公共函数），将 `linkedResources` 中可解析的资源经 citation allocator 分配编号后写入 `konlingCitationGuard.citations`。备选是允许模型在正文输出受控 URL；拒绝，因为现有引用白名单执行与 sanitizer 设计是安全不变量，且引用面板已具备 vbh 重校验与受限态展示。

2. **工程图谱工具为只读、白名单边界。** 新工具 `search_engineering_graph` 以当前焦点 canonicalIds 为白名单种子，`engineeringCorpusFromLayeredPayload` 构建语料，`runEngineeringRagQuery` 检索，谓词集合限定白名单；结果以有界邻域摘要注入 grounding lines，工程节点经 Change 2 映射产出教材引用。备选是直接向模型暴露任意图遍历；拒绝，因为无界遍历会放大提示词体积并引入未治理节点。

3. **RAG 切换按 cutover 治理，先影子后门禁；`teaching-resource-rag` 接线不退役。** `teaching-resource-rag` 是密封 consumer-activation 中的命名消费者，承载"控灵检索教学投影绑定资源"（讲义/卡/习题/媒体等非教材语料，带 canonical 双域 provenance）的职责，textbook pack v2 只覆盖教材正文，二者不重叠；它是本系列"全资源可消费"目标的必要组成，必须接线。先接线 `canonicalRagShadow` 使影子诊断成为真实数据通路（composed 结果与 LEGACY 结果对比采样），达标后再把 `selectRagAuthority('PRODUCTION_ANSWER')` 从 LEGACY 切到 composed（teaching-resource-rag 作为 composed 的教学资源通道）；切换以可回滚的配置/发布步骤完成，回滚即拨回 LEGACY。

4. **教材引用沿用 vbh 句柄重校验。** 工程节点教材出处与教学投影教材资源统一经 `buildTextbookReaderHref` 生成带 `?vbh=` 的句柄，点击前由 `/api/textbooks/version-bound-target` 重校验；版本漂移时芯片降级为受限态而非跳转旧版本。registry/DB 资源的版本对齐沿用 Change 3 建立的 B′ authoringRevision 与部署 APP_REVISION 对齐机制。

5. **teacherOnly 与未解析资源 fail-closed。** 解析失败、权限为 teacherOnly、或当前角色不可见的资源不进入 citation allocator，只在 grounding 文本中保留非链接形式；不产出"半可点击"状态。

## Risks / Trade-offs

- [提示词体积膨胀] → grounding lines 与工程邻域摘要均设上限（沿用现有 8 条资源上限并新增邻域条数上限），超限截断并在元数据记录截断计数。
- [citation 白名单剥离新引用] → 新增资源引用必须经 citation allocator 分配编号，未分配编号的模型自创引用仍被白名单执行剥离；allocator 输入只接受服务端解析成功的资源。
- [版本漂移导致死链] → 教材引用走 vbh 重校验；registry/DB 资源在解析时校验 live registry index 与部署版本对齐，漂移时芯片降级为受限态。
- [RAG 切换回归] → 影子对比指标（命中率、引用可验证率、答案差异采样）达标并授权后才切换；回滚为拨回 `selectRagAuthority` 配置，不需要数据迁移。
- [Change 2/3 未就绪] → 教材引用与查看器壳两处降级路径已在提案 Dependencies 写明；本变更的本地验证不依赖生产发布。

## Migration Plan

1. 抽取共享解析模块并接入 citation allocator，本地跑控灵绑定与引用面板测试。
2. 接线 `canonicalRagShadow` 影子诊断，采集对比样本。
3. 影子指标达标并经授权后切换 `PRODUCTION_ANSWER` 为 composed；异常时拨回 LEGACY。
4. 合入 `integration`；生产内容发布/部署步骤单独授权执行。
5. 回滚：`selectRagAuthority` 拨回 LEGACY；引用面板新增引用类型移除即恢复文本 grounding 行为。

## Open Questions

- 工程邻域摘要的条数上限与谓词白名单初值，在实现期按提示词体积实测确定，写入实现记录。
- `teaching-resource-rag` 接入 composed 的具体通道位置（独立通道结果合并 vs 语料并入）在实现期按检索质量实测定案，结论写入实现记录。
