## Why

控灵（Konling）当前只把教学投影绑定资源当作 grounding 行里的 `resId:role` 文本（`buildKonlingTeachingProjectionGroundingLines`），`linkedResources` 不含 href；回答正文中的链接被 sanitizer 有意消灭，唯一可点击面是引用面板。同时工程图谱检索（`runEngineeringRagQuery` / `composeEngineeringAndTeachingRag`）、`teaching-resource-rag` 与 `canonicalRagShadow` 诊断均已实现但无生产调用方，`selectRagAuthority('PRODUCTION_ANSWER')` 恒为 LEGACY。学生无法从控灵回答点击打开任何绑定资源，工程图谱节点与三本源教材出处也不进入回答。

## What Changes

- 资源可点击：把陪伴资源卡中的 resourceId→href 三段解析逻辑（教材 `textbook-unit:` 前缀 → `buildTextbookReaderHref`、DB TeachingResource → `/interactive-learning/resources/{id}`、registry → `launchTarget ?? renderTarget`）抽取为共享模块；`teachingProjectionContext.linkedResources` 经服务端 citation allocator 分配编号并写入 `konlingCitationGuard.citations`，在引用面板渲染为可点击芯片，点击在统一查看器壳中打开。**不修改**回答正文 sanitizer 设计，模型仍不得在正文输出 URL。
- 工程图谱消费：新增只读工具 `search_engineering_graph`，基于 `engineeringCorpusFromLayeredPayload` + `runEngineeringRagQuery`，以焦点 canonicalIds 与谓词白名单为边界；grounding lines 注入有界工程邻域摘要；工程节点经 Change 2（`engineering-graph-textbook-coverage`）的教材映射产出教材引用（`buildTextbookReaderHref` + vbh 句柄重校验）。
- RAG 接线：`teaching-resource-rag` 接入控灵检索链或在 design 中明确退役；清理或接线 `canonicalRagShadow` 死代码；`selectRagAuthority` 的 `PRODUCTION_ANSWER` 从 LEGACY 切到 composed，按 cutover 治理执行（影子对比 → 门禁指标 → 授权切换 → 回滚预案）。
- 双域 provenance：消费端读取已持久化的 `konlingDualDomainProvenance.teaching.resourceIds`，引用芯片与资源卡保持工程/教学双域身份可审计。

## Dependencies

- 依赖 Change 2 `engineering-graph-textbook-coverage`：工程节点→教材 v2 结构单元映射与 `buildTextbookReaderHref` 坐标解析。该变更未交付前，工程节点教材引用降级为无出处状态。
- 依赖 Change 3 `universal-resource-launch-and-viewer`：统一查看器壳组件与全类型 launch map。该变更未交付前，非教材类引用芯片暂以现有整页路由打开，壳接入为后续步骤。

## Capabilities

### New Capabilities

- `konling-teaching-resource-citations`：控灵教学资源引用的解析、分配、展示与打开契约——resourceId→href 解析、经 citation allocator 进引用面板、teacherOnly fail-closed、版本漂移重校验、查看器壳打开。

### Modified Capabilities

- `konling-agent-runtime`：教学投影绑定资源与工程图谱节点成为引用面板的可点击服务器验证引用；新增只读工程图谱工具；`PRODUCTION_ANSWER` 检索权威切换受 cutover 门禁约束。
- `konling-kaq-graph-context`：graph context 的工程域消费从焦点 ID 白名单校验扩展为有界邻域摘要与谓词白名单检索，provenance 保持工程/教学分域。
- `canonical-knowledge-resource-binding`：正式绑定集的资源成为控灵引用面板的可启动对象，其 href 解析与版本漂移处理沿用绑定的版本/捕获身份。

## Impact

影响控灵聊天运行时（`src/lib/konling-agent-runtime.ts`、`src/app/api/ai/chat/route.ts`）、教学投影上下文管线（`konling-teaching-projection-context.ts`）、引用面板与消息元数据、canonical-rag 权威选择（`authority.ts`、`konling-integration.ts`）、新增共享 resourceId→href 解析模块与只读工程图谱工具。不改回答正文 sanitizer、不改 companion trigger-engine、不新建检索基础设施（复用 domain-composition）、不执行生产发布；生产内容发布与部署步骤写入 tasks，执行时单独授权。
