## Context

Node-detail 用 `matchActiveTeachingProjection` 要求 shard envelope 的 teaching `projectionId` 等于 `course-content/runtime/knowledge/projection/current.json`。分片信封实际是 domain-fragments `proj-eb4d2d63…`，课程投影是 `proj-c9a6f33e…`。于是所有节点资源都报身份不一致；学习内容 `activeProjectionCardIds()` 同样返回 null，抽屉不渲染卡。磁盘上有 1236 张 Authority 卡、信息图、891 条绑定；v2 manifest 不存在（仓库 v1 仅 2 条）；资源 `title` 全空。

## Goals / Non-Goals

**Goals:**

- 同一 inspector 读路径只承认一套 Teaching Projection 身份。
- 每张现存卡、每张现存信息图都链接到恰好一个当前图谱节点。
- 合格卡/信息图在对应抽屉可见。
- 任一未链接卡或信息图使发布 fail closed。
- 每条系统资源都绑定到合适节点，无孤儿；可启动类型有安全 href 与标题。

**Non-Goals:**

- 不把 draft-blocked 卡渲染成已审知识。
- 不在抽屉内嵌播放器。
- 不切换生产 selector。
- 不生成新的工程关系。

## Decisions

1. **身份真源**  
   Active node-detail 的 teaching 身份跟随 **domain-fragments / shard envelope**（与画布同一 Teaching overlay）。课程级 `projection/current.json` 必须重发布为同一 `projectionId`/`projectionHash`，或降为该信封下的 artifacts sidecar，禁止第二套 current pointer 参与 inspector。

2. **v2 manifest 全量枚举**  
   每个 `cards/authority/nodes/*.md` 与 `infographs/authority/nodes/*` 都有一行。`safeId`、sha256、state、canonicalId 必填。v1 一律拒绝。

3. **质量与展示**  
   `ok` 且 sha 匹配 → 抽屉渲染。`draft-blocked` → 不展示正文，但覆盖账本计为已链接。缺文件、sha 漂移、canonicalId 对不上 → 未链接，阻断。

4. **同名多 id**  
   只按 `authority_entity_id` / object id 链接，禁止按中文名模糊匹配。同名分叉必须各自有卡或显式 exclusion 理由。

5. **资源无孤儿**  
   `resources.jsonl` 每条必须至少一条 `bindings.jsonl` 指向现存 canonicalId。无 title 不得投影为 available；缺 title 阻断，直到补人类标题。lesson/handout/step 必须有 registry 安全 href；video/audio/card/exercise 走既有 launcher 合同，不得因无 lesson 路由被当成未绑定。

6. **验证**  
   单一脚本扫：卡文件、信息图文件、manifest、cards-index、bindings、resources、7476 节点 id。任一未链接或孤儿则非零退出。

## Risks / Trade-offs

- [统一 projection 身份会重写课程投影] → 新 projection 版本，旧 pointer 可回滚。
- [空 title 的 1058 条资源] → 从 resourceId/scope 的人类目录回填标题，禁止用 canonicalId 当标题。
- [cards-index 只有 205 行 vs 1236 张卡] → 以 Authority 卡文件为分母，cards-index 必须覆盖全部 ok 卡。

## Migration Plan

等待教学投影重物化身份稳定 → 重建 v2 manifest 与 bindings → 本地 node-detail 抽样与全量脚本。生产切换另授权。

## Open Questions

无。
