## Why

2026-09-04 QA 巡检（Issue #1942，P1）发现已登录学生（demo）访问 `/knowledge` 时知识图谱加载失败，仅显示「当前知识图谱暂时无法加载」与「未请求另一套图谱数据」。

调查结论（2026-09-04）：
- 学生角色被服务端明确放行（`src/app/api/knowledge/_active-authority.ts:141-163`），root 分片加载路径没有任何按角色的数据源分支——该失败对教师与学生一致，不是权限回归。
- 最可能根因：生产 runtime 的当前 authority 分片集是 v0.22 时代物化产物，缺少 #1738（`54b34f0c85`）引入的 `coverage.json` 收据，root 入口按治理门 fail-closed（`shard-absent` → 404，`src/lib/authority-domain-shards/loader.ts:183,236-241`）；次可能为普通部署删除了 runtime selector（`activation-absent` → 503）。两者都是「应用代码已含治理门、生产内容未同步」的部署态错配，fail-closed 行为本身是规格要求，不得放松。
- 真正的代码缺口在呈现层：客户端 `fetchAuthorityShard`（`active-authority-graph.tsx:166-178`）不读服务端返回的 `code` 字段，`:138-143` 把所有非 401/403/409 错误折叠为同一句「暂时无法加载」，学生与运维都无法从 UI 区分「内容尚未发布完成（需重物化/重激活 runtime）」与「暂时故障（重试可恢复）」，也无任何行动指引。

## What Changes

- 服务端 shard 失败响应保留结构化失败码（`pointer-absent`/`shard-absent`/`activation-absent`/`consumer-not-ready` 等），API 响应携带稳定、不含内部路径的机器可读 `code`（既有 `ACTIVE_SHARD_*` 码延续）。
- 客户端读取失败码并投影为两类可行动文案：
  - 内容未就绪类（分片/指针/激活缺失）：说明知识数据尚未发布完成、需等待发布或联系教师，并提供「查看 legacy 图谱」入口（如可用）而不是空的重试。
  - 暂时故障类：保留重试引导。
- 失败态不泄露内部路径、存储结构或绝对路径（数据治理红线保持）。
- 交付物含生产恢复路径说明（不执行生产变更）：重物化带 coverage 收据的分片集并推进 runtime selector 激活，或走既有 cutover-aware 流程——作为运维手册条目写入文档。
- 增加失败码 → 用户文案投影的单元测试，以及 404/503 分片失败下的渲染契约测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `authority-domain-shard-delivery`: 分片交付失败必须向学习者投影可行动的原因分类，区分内容未就绪与暂时故障，且不泄露内部存储细节。

## Impact

- `src/app/api/knowledge/_active-authority.ts`（失败响应 code 透出，若已有则仅确认稳定性）。
- `src/features/knowledge/active-authority-graph.tsx`（错误分支与文案投影）。
- `src/lib/authority-locale-readiness/graph-interface-catalog.ts`（新增失败分类文案键）。
- 运维文档（生产恢复路径）。
- 相关单元与渲染契约测试。
- 显式非目标：不放松 coverage 收据门与 fail-closed 语义；不在本变更内执行生产 runtime 重物化/激活；不处理未登录态（#1939 范围）。
