# 实现记录（konling-consumes-graphs-and-resources）

## Design Open Questions 定案

### 1. 工程邻域条数上限与谓词白名单初值

- **邻域上限 = 12 条**（`KONLING_ENGINEERING_NEIGHBORHOOD_MAX_ENTRIES`）。依据：与教学投影 grounding 的 12 行展示预算对齐（`ai-prompt-builder` 的 teaching 块同为 slice(0, 12)），每条邻域行压缩为 `focus -->[predicate] neighbor (label) rel=<id>` 单行，12 条邻域 + 头行 + 边界约束行合计 ≤ 14 行，实测提示词增量有界。截断计数（`truncatedCount`）写入 `konlingDualDomainProvenance.engineeringNeighborhood`，满足 kaq-graph-context spec 的「截断记录在上下文元数据」要求。
- **谓词白名单 = canonical RAG 治理谓词集**（`RAG_SUPPORTED_PREDICATES`：is_a / part_of / has_component / has_formula / has_representation / applies_to / used_to_analyze / derived_from / association）。该集合本身就是 #1112 治理过的受支持谓词，白名单复用治理真源而非新造清单。`prerequisite`（先后修）**明确不在白名单**：先后修消费是 #2059（consume-engineering-prerequisite-order）的独立范围，两变更不混线。

### 2. teaching-resource-rag 接入通道位置：独立通道合并（非语料并入）

定案为**独立通道结果合并**：`search_textbook` 内 Legacy 教材前台检索完成后，并行执行 `composeEngineeringAndTeachingRag`（语料来自分层 payload：`engineeringCorpusFromLayeredPayload` + `teachingCorpusFromLayeredPayload`），教学域命中经共享三段解析器解析 href 后合入同一 citation allocator（canonicalKey `teaching-resource:{resourceId}:{projectionId}` 与上下文层 linkedResources 引用天然去重同编号）。理由：

- 语料并入会改写 Legacy 检索的候选池，冲击 #1949/#2017 引用核验白名单的现有基准；
- 独立合并保持 Legacy 前台字节不变（测试断言无 payload 时前台原样），回滚拨盘只影响新增字段；
- composed 每查询教学资源引用上限 8 条（`KONLING_COMPOSED_TEACHING_RESOURCE_LIMIT`），与 grounding 资源行 8 条预算一致。
- 工程域结果不并入 search_textbook（避免与 `search_engineering_graph` 工具重复暴露），工程域在 composed 中仅产出影子指标。

### 3. canonicalRagShadow 死代码处置：删除，由 composed 真实通路取代

评估结论：`KonlingCanonicalRagShadowContext` 要求完整的版本绑定 crosswalk 证据集（`CanonicalRagShadowInput`：release 指纹 + objects/relations/coverage + upstream seeds + crosswalks + structuralUnits，每个成员须携带完整 `CandidateContextFingerprint`）。生产 chat 路由无法组装该输入——这正是 #1117 控制面的预留范围；全仓 grep 证实 `canonicalRagShadow` 输入无任何生产调用方，`maybeRunKonlingCanonicalRagShadowDiagnostic` 在生产恒返回 null。处置（满足 konling-agent-runtime spec「Dead shadow code is not silently kept」）：

- 删除 `KonlingCanonicalRagShadowContext` / `runKonlingCanonicalRagShadowDiagnostic` / `maybeRunKonlingCanonicalRagShadowDiagnostic` 与 runtime 输入字段；
- 保留并复用 `extractProductionForegroundIdentities`，新增 `runKonlingComposedRagShadowDiagnostic`（`konling-integration.ts`）：对**真实执行**的 composed 结果记录 LEGACY 前台结构单元身份、教学域召回交集/差集、引用可验证率（resolved href 比例）与双域 availability，样本随消息 metadata `konlingComposedRagShadow` 持久化（chat 主路由 revision-1/revision-2 与 sessions messages 路由三条持久化路径）；
- #1112 离线 harness（`runLegacyProductionWithCanonicalShadow`）保留给 fixture 测试，内部显式固定 `productionAuthority: 'legacy'`，使 fixture 语义不再受生产拨盘影响。

### 4. PRODUCTION_ANSWER 切换与回滚（cutover 治理）

- 拨盘：`KONLING_RAG_PRODUCTION_AUTHORITY`。**缺省 `canonical-composed`（本次 #2047 授权切换即生效）**；`legacy` 为回滚位；非法值 fail-safe 回 LEGACY 并告警。选择器纯函数化（`readRagProductionAuthorityDial` + `SelectRagAuthorityOptions.productionAuthority` 显式覆盖供测试），切换可回滚、无数据迁移。
- 语义边界：composed 拨盘下教学资源命中合并进回答（分配编号、模型可引用、面板芯片）；legacy 拨盘下 composed 仅产出影子指标（不合并、不分配新编号），但**上下文层 linkedResources 引用芯片不受拨盘影响**——引用面板能力独立于检索权威（提案回滚方案：芯片移除与权威拨回是两个独立开关）。
- 不变量：`assertProductionSelectorUnchanged` 从「恒 LEGACY」改为「与配置拨盘一致」——legacy 拨盘禁止暴露 Canonical expansion，shadow 成功不得越过拨盘；`assertShadowCannotActivateCutover` 与 `CUTOVER_ACTIVATION` 抛错语义不变（composed 生产来自拨盘而非 shadow 自举）。
- 门禁指标（4.3）：影子样本随生产回答持久化（命中率 = 教学域 hitCount 与 linkedResources 交集 `sharedTeachingResourceIds`；引用可验证率 = `teachingCitationVerifiableRate`；答案差异采样 = `onlyInComposedResourceIds` + LEGACY 前台结构单元身份）。本地离线证据：`konling-consumes-graphs-and-resources.test.ts` 在两种拨盘态产出对照样本；生产流量采样随 5.4 部署后累积。

## 其他实现要点

- **companion verify 行为不变**：路由迁移到共享解析器后，`teacherOnlyPolicy: 'always-unavailable'` 保持「teacherOnly 对所有查看者按 not-found 混淆」的既有语义；STATIC_MEDIA 仍内嵌优先（路由层过滤 href）。
- **教材单元 vbh 身份**：`resourceId === unitId`（复合 `textbook-unit:` id），contentHash 为当前 markdown sha256，点击经 `/api/textbooks/version-bound-target` 重校验（`loadTextbookCoachContext` pinned 身份一致性）；vbh 签发密钥不可用时回退普通 reader href（仅开发弱密钥环境）。
- **工程教材引用坐标解析**：复用统一 reader 的单元索引（`loadTextbookCitationUnits`）作为 v2 runtime manifest 存在性校验，未引入第二套 units 索引；映射台账（candidates 29,904 行 + reviews 28,891 行）进程内一次性缓存（按 repoRoot）。
- **编号空间统一**：teaching-resource identity 的 projectionId 由教学投影上下文统一传入（上下文层与 composed 通道同值），保证 canonicalKey 去重；工程教材引用与教材检索候选共用 textbook identity key。
- **未做**：正文 sanitizer、companion trigger-engine、`KONLING_COMPANION_ENABLED` 门控均未改动；生产内容发布与部署（5.4）待单独授权。
