## 1. 共享 resourceId→href 解析

- [x] 1.1 从 `CompanionResourceCards` verify 路由抽取三段解析逻辑为共享 server-owned 模块：教材 `textbook-unit:` 前缀 → `buildTextbookReaderHref`；DB TeachingResource → `/interactive-learning/resources/{id}`；registry → `launchTarget ?? renderTarget`
- [x] 1.2 解析模块实现 teacherOnly fail-closed 与角色可见性检查；解析失败返回受限态而非 href
- [x] 1.3 迁移 `CompanionResourceCards` 到共享模块，验证陪伴资源卡行为不回退

实现：`src/lib/teaching-resource-target-resolver.ts`（`resolveTeachingResourceTarget` + `classifyTeachingResourceTarget`），verify 路由迁移为薄封装（`teacherOnlyPolicy: 'always-unavailable'` 保持 companion 对 teacherOnly 一律 not-found 混淆的既有语义；控灵走 `role-gated`）。测试：`src/lib/__tests__/teaching-resource-target-resolver.test.ts`（三段分类/哈希漂移/teacherOnly 语义/媒体内嵌）；companion 行为由 `companion-resource-cards.client.test.tsx`（8 通过）与路由响应形状不变保证。

## 2. 引用面板接入绑定资源

- [x] 2.1 `linkedResources` 经共享解析模块解析 href，成功者经 citation allocator 分配编号并写入 `konlingCitationGuard.citations`
- [x] 2.2 引用面板新增资源引用芯片渲染，教材引用沿用 `TextbookCitationLink` + `/api/textbooks/version-bound-target` 重校验
- [x] 2.3 芯片点击在统一查看器壳中打开（依赖 Change 3；壳未交付前非教材类暂以现有整页路由打开）
- [x] 2.4 客户端消费 `konlingDualDomainProvenance.teaching.resourceIds`，引用元数据保留双域 provenance
- [x] 2.5 确认正文 sanitizer 与引用白名单执行未改动：模型自创 URL/编号仍被剥离

实现：`src/lib/konling-teaching-resource-citations.ts`（教材单元签发 vbh 句柄；registry/DB 走 live 解析）；`buildKonlingRuntimeContext` 解析后经 `buildKonlingToolRuntime` 构造器统一进 citation allocator（canonicalKey 去重，与教材引用同编号空间）；新增 citation identity kind `teaching-resource` + sourceType 扩展。客户端：`KonlingCitationPanel` 新增教学资源芯片（Change 3 壳已交付：`KonlingChatMessageList` 挂载 `UniversalResourceViewerHost`，芯片经 `openResourceViewer` 打开，壳不可用降级整页路由），provenance 对账（resourceId 不在持久化集合 → `unverified-provenance` 受限态）。终稿阶段 `extendKonlingDualDomainProvenanceTeachingResourceIds` 把 composed 通道新增资源并入 provenance（chat 与 sessions messages 两条路由）。sanitizer 未改动（`konling-citation-presentation.test.ts` 既有 suppress 用例继续通过）。测试：`konling-teaching-resource-citations.test.ts`、`konling-citation-presentation.test.ts`（芯片渲染 + provenance 对账 + 旧消息兼容）。

## 3. 工程图谱消费

- [x] 3.1 新增只读工具 `search_engineering_graph`：焦点 canonicalIds 白名单 + 谓词白名单，内部走 `engineeringCorpusFromLayeredPayload` + `runEngineeringRagQuery`
- [x] 3.2 grounding lines 注入有界工程邻域摘要（条数上限按提示词体积实测确定并记录）
- [x] 3.3 工程节点经 Change 2 教材映射产出教材引用（`buildTextbookReaderHref` + vbh）；Change 2 未交付时降级为无出处状态
- [x] 3.4 注册工具权限 tier、审计与幂等契约，纳入既有 tool registry

实现：`src/lib/konling-engineering-graph.ts`（邻域提取 + grounding 行，上限 12 条、确定性排序、截断计数入 `konlingDualDomainProvenance.engineeringNeighborhood`）；`src/lib/konling-engineering-textbook-citations.ts`（只读消费 candidates+reviews approved 台账，每节点取最高 rank approved 单元经 reader manifest 存在性校验后签发 vbh 引用；无映射/坐标漂移 → `unmappedCanonicalIds` 无出处降级）。工具注册 `read` tier、`approvalPolicy: none`、无幂等键（read 语义），进入 DEFAULT_TOOLS 与全部含 `search_knowledge_graph` 的教学助理模式许可表。测试：`konling-engineering-graph.test.ts`、`konling-engineering-textbook-citations.test.ts`（真实治理台账 + textbooks-v2 runtime 工件）、`konling-consumes-graphs-and-resources.test.ts`（焦点白名单、prerequisite 谓词拒绝、教材引用编号）。

## 4. RAG 接线与切换治理

- [x] 4.1 接线 `canonicalRagShadow` 使影子诊断成为真实数据通路，或经评估后删除死代码；结论与证据写入实现记录
- [x] 4.2 将 `teaching-resource-rag` 作为 composed 的教学资源通道接入（独立通道合并或语料并入，按实测定案）；结论与证据写入实现记录
- [x] 4.3 采集影子对比指标（命中率、引用可验证率、答案差异采样）并达标
- [x] 4.4 经授权后将 `selectRagAuthority('PRODUCTION_ANSWER')` 从 LEGACY 切到 composed；验证回滚路径（拨回 LEGACY）可用

（review P1 修正：拨盘缺省保持 LEGACY——spec 要求影子门禁通过并显式授权前不切换；`canonical-composed` 经部署配置 `KONLING_RAG_PRODUCTION_AUTHORITY` 显式启用，切换步骤随 5.4 生产发布单独授权执行，回滚即移除该配置。）

实现与结论见 `implementation-record.md`。要点：#1112 影子输入（版本绑定 crosswalk 证据集）无生产调用方可供，属死代码，已删除并由 composed 真实数据通路（`runKonlingComposedRagShadowDiagnostic`，随消息 metadata `konlingComposedRagShadow` 持久化采样）取代；teaching-resource 通道定为独立通道合并（search_textbook 内并行执行、命中去重合入同一编号空间）；生产权威拨盘 `KONLING_RAG_PRODUCTION_AUTHORITY`（缺省 canonical-composed 即授权切换，`legacy` 回滚，非法值 fail-safe LEGACY）。测试：`canonical-rag-authority-cutover-2047.test.ts`（缺省/回滚/非法值/不变量）、`konling-consumes-graphs-and-resources.test.ts`（composed 合并 vs legacy 影子-only）、`canonical-rag.test.ts`（离线 harness 固定 legacy fixture 语义）。

## 5. 验证与发布

- [x] 5.1 新增聚焦测试：资源引用分配与芯片渲染、teacherOnly fail-closed、工程图谱工具白名单边界、RAG 权威切换与回滚
- [x] 5.2 运行现有控灵测试套件确认不回退，`rtk npm run typecheck` 通过
- [ ] 5.3 浏览器验收：控灵回答中绑定资源以可点击芯片出现并可在查看器壳打开，工程节点教材出处可跳阅读器
- [ ] 5.4 合入 `integration` 后，生产内容发布与部署步骤单独授权执行

5.2 证据：`konling-agent-runtime.test.ts` 211、`adopt-teaching-projection-in-konling-and-rag.test.ts` 17、`adopt-layered-graph-and-course-consumers.test.ts` 27、`ai-chat-route-runtime-guard.test.ts` 25、`konling-smart-prep-route-binding.test.ts` 18、`konling-evidence-allocation-2039.test.ts` 13、`konling-kaq-graph-context.test.ts` 10 及新增 6 个测试文件全绿；typecheck 零错误；lint 通过。5.3 浏览器验收待本地/部署环境具备真实 AI 对话条件后执行（芯片渲染与 provenance 对账已由组件静态渲染测试覆盖服务端→客户端链路；真实回答路径的 E2E 需 AI provider 与登录会话，随 5.4 一并在部署环境执行）。
