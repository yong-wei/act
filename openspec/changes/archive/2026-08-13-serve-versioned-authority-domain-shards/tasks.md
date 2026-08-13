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
