## 1. 共享 resourceId→href 解析

- [ ] 1.1 从 `CompanionResourceCards` verify 路由抽取三段解析逻辑为共享 server-owned 模块：教材 `textbook-unit:` 前缀 → `buildTextbookReaderHref`；DB TeachingResource → `/interactive-learning/resources/{id}`；registry → `launchTarget ?? renderTarget`
- [ ] 1.2 解析模块实现 teacherOnly fail-closed 与角色可见性检查；解析失败返回受限态而非 href
- [ ] 1.3 迁移 `CompanionResourceCards` 到共享模块，验证陪伴资源卡行为不回退

## 2. 引用面板接入绑定资源

- [ ] 2.1 `linkedResources` 经共享解析模块解析 href，成功者经 citation allocator 分配编号并写入 `konlingCitationGuard.citations`
- [ ] 2.2 引用面板新增资源引用芯片渲染，教材引用沿用 `TextbookCitationLink` + `/api/textbooks/version-bound-target` 重校验
- [ ] 2.3 芯片点击在统一查看器壳中打开（依赖 Change 3；壳未交付前非教材类暂以现有整页路由打开）
- [ ] 2.4 客户端消费 `konlingDualDomainProvenance.teaching.resourceIds`，引用元数据保留双域 provenance
- [ ] 2.5 确认正文 sanitizer 与引用白名单执行未改动：模型自创 URL/编号仍被剥离

## 3. 工程图谱消费

- [ ] 3.1 新增只读工具 `search_engineering_graph`：焦点 canonicalIds 白名单 + 谓词白名单，内部走 `engineeringCorpusFromLayeredPayload` + `runEngineeringRagQuery`
- [ ] 3.2 grounding lines 注入有界工程邻域摘要（条数上限按提示词体积实测确定并记录）
- [ ] 3.3 工程节点经 Change 2 教材映射产出教材引用（`buildTextbookReaderHref` + vbh）；Change 2 未交付时降级为无出处状态
- [ ] 3.4 注册工具权限 tier、审计与幂等契约，纳入既有 tool registry

## 4. RAG 接线与切换治理

- [ ] 4.1 接线 `canonicalRagShadow` 使影子诊断成为真实数据通路，或经评估后删除死代码；结论与证据写入实现记录
- [ ] 4.2 将 `teaching-resource-rag` 作为 composed 的教学资源通道接入（独立通道合并或语料并入，按实测定案）；结论与证据写入实现记录
- [ ] 4.3 采集影子对比指标（命中率、引用可验证率、答案差异采样）并达标
- [ ] 4.4 经授权后将 `selectRagAuthority('PRODUCTION_ANSWER')` 从 LEGACY 切到 composed；验证回滚路径（拨回 LEGACY）可用

## 5. 验证与发布

- [ ] 5.1 新增聚焦测试：资源引用分配与芯片渲染、teacherOnly fail-closed、工程图谱工具白名单边界、RAG 权威切换与回滚
- [ ] 5.2 运行现有控灵测试套件确认不回退，`rtk npm run typecheck` 通过
- [ ] 5.3 浏览器验收：控灵回答中绑定资源以可点击芯片出现并可在查看器壳打开，工程节点教材出处可跳阅读器
- [ ] 5.4 合入 `integration` 后，生产内容发布与部署步骤单独授权执行
