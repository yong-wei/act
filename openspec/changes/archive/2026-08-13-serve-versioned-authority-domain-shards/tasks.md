## 1. Shard Contracts

- [x] 1.1 Define root, domain-default, relation-family, node-neighborhood and node-detail DTOs with bounded payload contracts.
- [x] 1.2 Implement the composite Authority, catalog and optional Teaching Projection version envelope.
- [x] 1.3 Add authorization and routing that keeps full-graph access outside normal product interaction.

## 2. Server and Client Runtime

- [x] 2.1 Implement root and domain-default projection without fetching or serializing the full graph.
- [x] 2.2 Implement lazy engineering-family, bounded one-hop and detail/media shard resolvers.
- [x] 2.3 Add client cache and merge logic that preserves canonical objects, layout, selection and inspector state.
- [x] 2.4 Implement independent teaching-layer degradation and cache invalidation.

## 3. Verification

- [x] 3.1 Add request-count, payload-budget, cold-load and version-mismatch tests proving normal users never load the full graph.
- [x] 3.2 Add partial/empty/unavailable teaching cases proving engineering shards remain usable.
- [x] 3.3 Run related API/unit tests, performance checks, typecheck and strict OpenSpec validation.

## Review disposition

- ACCEPT：独立终审证明 Teaching Projection 曾只从非合同的 `relationsByDomain` pointer 扩展读取，且 live Teaching identity 变化会使工程 shard fail closed；现已改为读取正式 immutable composed projection，并仅失效教学层。增量复审范围 `563a42710c6de0f8b983fc9c9e9bd77be666b7b1..c54f6a1d1a9d42b94bbc4da2ec1779cedcedbc44`，无新的 P0/P1。
- REJECT：`active-desktop-light` 为空白的视觉 P1 主张与精确 SHA `45e5a8a343805b0beda64bbff9863a7cd5394b5b94e9eaf2acc4aa4406b7a190` 的直接原图复核矛盾。该图实际显示 4 个节点和 3 条关系边，结构化 SVG 几何记录一致，故不构成可达产品缺陷。
- ACCEPT：production cutover 未将 Authority domain shard pointer 纳入 sealed activation transaction，后续 Authority/Teaching 切换可能留下旧 shard pointer 并使 runtime fail closed。采用第五组件方案；plan、activation、rollback、recovery 与 active verification 必须共同覆盖该 pointer 和其 sealed immutable set。immutable set 的删除授权无法从可变 receipt 证明，故 rollback/recovery 只恢复 selector，不删除任何 set。

- ACCEPT（最终整改 A）：所有分片类别共享 Authority/catalog/Teaching identity drift 处理；Authority/catalog drift 中止当前请求世代并清空 workspace，Teaching-only drift 仅清除教学关系、coverage、domain-default/detail cache 与 loaded keys，保留工程对象、关系和布局并在新世代重取 active domain。
- ACCEPT（最终整改 B）：固定 OCI image `58f70df` 通过专用 full-src operator bundle 运行本 PR 的 `production-cutover.ts` 与静态依赖闭包；manifest、逐文件 digest、bundle/archive/manifest digest 与 capture revision 全部封存并绑定 sealed plan。远端在停止消费者前完成实际 bundle verifier，隔离 root 运行 activate/verify/rollback/recover。
- ACCEPT（最终整改 C）：node-detail API 按认证角色投影，STUDENT 响应完全移除 `teachingFields`，TEACHER/ADMIN 保持已有允许字段边界。
- ACCEPT（最终整改 D）：分片 API 对已知内部 store/identity 错误仅公开稳定 code、HTTP status 与固定安全文案，不得透传 I/O、解析器或本机路径原文。
